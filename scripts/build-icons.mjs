import { build } from 'esbuild';
import { copyFile } from 'node:fs/promises';

await build({
  entryPoints: ['scripts/icon-runtime.jsx'],
  outfile: 'hosting-source/icon-runtime.js',
  bundle: true,
  minify: true,
  platform: 'browser',
  format: 'iife',
  target: ['es2020'],
  define: { 'process.env.NODE_ENV': '"production"' },
  legalComments: 'none'
});

await copyFile('hosting-source/icon-runtime.js', 'offline-mockup/icon-runtime.js');
