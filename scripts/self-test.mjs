#!/usr/bin/env node
import { access } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const projectRoot = resolve(__dirname, '..');

const requiredFiles = [
  'index.html',
  'src/main.js',
  'src/store.js',
  'src/views.js',
  'src/utils.js',
  'service-worker.js'
];

(async () => {
  try {
    await Promise.all(requiredFiles.map((file) => access(resolve(projectRoot, file))));
    console.log('Self-test complete: core application files present.');
  } catch (error) {
    console.error('Self-test failed:', error);
    process.exitCode = 1;
  }
})();
