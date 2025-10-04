#!/usr/bin/env node
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const projectRoot = resolve(__dirname, '..');
const port = process.env.PORT ? Number(process.env.PORT) : 4173;

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json',
  '.ico': 'image/x-icon'
};

async function resolveFile(pathname) {
  const cleanPath = pathname.split('?')[0].split('#')[0];
  let requestedPath = join(projectRoot, cleanPath);
  try {
    const fileStat = await stat(requestedPath);
    if (fileStat.isDirectory()) {
      requestedPath = join(requestedPath, 'index.html');
    }
    await stat(requestedPath);
    return requestedPath;
  } catch (error) {
    return join(projectRoot, 'index.html');
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host}`);
  const filePath = await resolveFile(url.pathname);
  try {
    const data = await readFile(filePath);
    const type = mimeTypes[extname(filePath)] ?? 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type });
    res.end(data);
  } catch (error) {
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('Internal server error');
    console.error('Failed to serve', filePath, error);
  }
});

server.listen(port, () => {
  console.log(`Dev server running at http://127.0.0.1:${port}`);
});
