#!/usr/bin/env node
import { rm, mkdir, cp } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const projectRoot = resolve(__dirname, '..');
const distDir = resolve(projectRoot, 'dist');

async function build() {
  await rm(distDir, { recursive: true, force: true });
  await mkdir(distDir, { recursive: true });
  await Promise.all([
    cp(resolve(projectRoot, 'index.html'), resolve(distDir, 'index.html')),
    cp(resolve(projectRoot, 'service-worker.js'), resolve(distDir, 'service-worker.js')),
    cp(resolve(projectRoot, 'src'), resolve(distDir, 'src'), { recursive: true }),
    cp(resolve(projectRoot, 'public'), resolve(distDir, 'public'), { recursive: true })
  ]);
  console.log('Static bundle prepared in dist/');
}

build().catch((error) => {
  console.error('Build failed', error);
  process.exitCode = 1;
});
