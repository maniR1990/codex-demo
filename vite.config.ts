import { webcrypto } from 'node:crypto';
import { defineConfig } from 'vite';
import { setupWebCrypto } from './src/utils/setupWebCrypto';

setupWebCrypto(webcrypto);

export default defineConfig({
  esbuild: {
    jsx: 'automatic',
    jsxImportSource: 'react'
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
  },
  build: {
    target: 'esnext',
    manifest: true
  }
});
