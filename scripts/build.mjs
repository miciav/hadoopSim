import { cp, mkdir, readdir, rm } from 'node:fs/promises';
import { build } from 'esbuild';

await rm('dist', { recursive: true, force: true });
await mkdir('dist/assets/js', { recursive: true });
await cp('assets', 'dist/assets', { recursive: true });
for (const name of await readdir('.')) {
  if (name.endsWith('.html')) await cp(name, `dist/${name}`);
}
await build({
  entryPoints: [
    'assets/js/hadoop-ecosystem-simulator.js',
    'assets/js/hadoop_full.js',
    'assets/js/hdfs_interactive.js',
    'assets/js/yarn_interactive.js',
    'assets/js/pipeline-dual-nodes/index.js',
    'assets/js/pipeline-teaching/index.js'
  ],
  outbase: 'assets/js',
  outdir: 'dist/assets/js',
  bundle: true,
  format: 'esm',
  loader: { '.js': 'jsx' },
  define: { 'process.env.NODE_ENV': '"production"' }
});

await mkdir('dist/licenses', { recursive: true });
for (const name of ['react', 'react-dom', 'scheduler', 'xstate']) {
  await cp(`node_modules/${name}/LICENSE`, `dist/licenses/${name}.txt`);
}
await cp('THIRD_PARTY_NOTICES.md', 'dist/THIRD_PARTY_NOTICES.md');
