import { build } from 'esbuild';
import { copyFile, mkdir } from 'node:fs/promises';

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

await mkdir('offline-mockup', { recursive: true });
await Promise.all([
  copyFile('hosting-source/icon-runtime.js', 'offline-mockup/icon-runtime.js'),
  copyFile('src/cinematic.js', 'hosting-source/cinematic.js'),
  copyFile('src/cinematic.js', 'offline-mockup/cinematic.js'),
  copyFile('src/cinematic.css', 'hosting-source/cinematic.css'),
  copyFile('src/cinematic.css', 'offline-mockup/cinematic.css')
]);
