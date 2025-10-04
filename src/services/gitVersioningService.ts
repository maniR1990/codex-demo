import git from 'isomorphic-git';
import http from 'isomorphic-git/http/web';
import LightningFS from '@isomorphic-git/lightning-fs';
import type { FinancialSnapshot } from '../types';
import { normaliseSnapshot } from '../utils/snapshotMerge';
import { encryptData } from './indexedDbService';

const fs = new LightningFS('wealth-git', { wipe: false });
const pfs = fs.promises;
const gitApi = git as typeof git & {
  isRepo?: (args: { fs: typeof fs; dir: string }) => Promise<boolean>;
};
const REPO_DIR = '/repo';
let repoInitialised = false;

export interface GitCommitOptions {
  message: string;
  author?: { name: string; email: string };
  encrypt?: boolean;
  keyFingerprint?: string;
}

export interface GitCommitSummary {
  oid: string;
  message: string;
  author: string;
  committedAt: string;
}

export interface GitStatusSummary {
  head: string | null;
  remotes: { remote: string; url: string }[];
}

async function ensureRepo() {
  if (repoInitialised) return;
  try {
    await pfs.stat(REPO_DIR);
  } catch {
    await pfs.mkdir(REPO_DIR);
  }

  const isRepo = (await gitApi.isRepo?.({ fs, dir: REPO_DIR })) ?? false;
  if (!isRepo) {
    await gitApi.init({ fs, dir: REPO_DIR, defaultBranch: 'main' });
  }
  repoInitialised = true;
}

export async function commitSnapshotToGit(snapshot: FinancialSnapshot, options: GitCommitOptions) {
  await ensureRepo();
  const normalised = normaliseSnapshot(snapshot);
  const timestamp = new Date().toISOString();

  const payload = options.encrypt
    ? JSON.stringify(
        {
          encrypted: true,
          algorithm: 'AES-GCM',
          keyFingerprint: options.keyFingerprint ?? 'local-keystore',
          payload: await encryptData(JSON.stringify(normalised))
        },
        null,
        2
      )
    : JSON.stringify({ encrypted: false, snapshot: normalised }, null, 2);

  await pfs.writeFile(`${REPO_DIR}/snapshot.json`, payload, 'utf8');
  await pfs.writeFile(
    `${REPO_DIR}/metadata.json`,
    JSON.stringify(
      {
        committedAt: timestamp,
        revision: normalised.revision,
        currency: normalised.profile?.currency ?? 'INR',
        lastLocalChangeAt: normalised.lastLocalChangeAt,
        encryption: options.encrypt
          ? { enabled: true, keyFingerprint: options.keyFingerprint ?? 'local-keystore' }
          : { enabled: false }
      },
      null,
      2
    ),
    'utf8'
  );

  await git.add({ fs, dir: REPO_DIR, filepath: 'snapshot.json' });
  await git.add({ fs, dir: REPO_DIR, filepath: 'metadata.json' });
  const oid = await git.commit({
    fs,
    dir: REPO_DIR,
    message: options.message,
    author: {
      name: options.author?.name ?? 'Wealth Accelerator',
      email: options.author?.email ?? 'noreply@wealth.local',
      timestamp: Math.floor(Date.now() / 1000),
      timezoneOffset: 0
    }
  });

  return oid;
}

export async function listGitHistory(limit = 20): Promise<GitCommitSummary[]> {
  await ensureRepo();
  const log = await git.log({ fs, dir: REPO_DIR, depth: limit });
  return log.map((entry) => ({
    oid: entry.oid,
    message: entry.commit.message.trim(),
    author: entry.commit.author.name,
    committedAt: new Date(entry.commit.author.timestamp * 1000).toISOString()
  }));
}

export async function getGitStatus(): Promise<GitStatusSummary> {
  await ensureRepo();
  const remotes = await git.listRemotes({ fs, dir: REPO_DIR });
  let head: string | null = null;
  try {
    head = await git.resolveRef({ fs, dir: REPO_DIR, ref: 'HEAD' });
  } catch {
    head = null;
  }
  return { head, remotes };
}

export async function configureGitRemote(remote: string, url: string) {
  await ensureRepo();
  const remotes = await git.listRemotes({ fs, dir: REPO_DIR });
  const existing = remotes.find((item) => item.remote === remote);
  if (existing) {
    await git.deleteRemote({ fs, dir: REPO_DIR, remote });
  }
  await git.addRemote({ fs, dir: REPO_DIR, remote, url, force: true });
}

export async function pushGitRemote(
  remote: string,
  branch = 'main',
  auth?: { username?: string; password?: string; token?: string }
) {
  await ensureRepo();
  await git.push({
    fs,
    http,
    dir: REPO_DIR,
    remote,
    ref: branch,
    onAuth: auth
      ? () =>
          auth.token
            ? { username: 'token', password: auth.token }
            : { username: auth.username ?? '', password: auth.password ?? '' }
      : undefined
  });
}

export async function exportGitRepository(): Promise<Blob> {
  await ensureRepo();
  const files = await git.listFiles({ fs, dir: REPO_DIR });
  const entries = await Promise.all(
    files.map(async (filepath) => ({
      path: filepath,
      content: await pfs.readFile(`${REPO_DIR}/${filepath}`, 'utf8')
    }))
  );
  const commits = await listGitHistory(50);
  return new Blob([JSON.stringify({ files: entries, commits }, null, 2)], { type: 'application/json' });
}
