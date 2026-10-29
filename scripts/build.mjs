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

// Lecture skin fonts: latin subsets only, served locally.
const fonts = {
  'atkinson-hyperlegible-next': [400, 600, 700],
  'atkinson-hyperlegible-mono': [400, 600]
};
await mkdir('dist/assets/fonts', { recursive: true });
for (const [family, weights] of Object.entries(fonts)) {
  for (const weight of weights) {
    const file = `${family}-latin-${weight}-normal.woff2`;
    await cp(
      `node_modules/@fontsource/${family}/files/${file}`,
      `dist/assets/fonts/${file}`
    );
  }
}

await mkdir('dist/licenses', { recursive: true });
for (const name of ['react', 'react-dom', 'scheduler', 'xstate']) {
  await cp(`node_modules/${name}/LICENSE`, `dist/licenses/${name}.txt`);
}
for (const family of Object.keys(fonts)) {
  await cp(
    `node_modules/@fontsource/${family}/LICENSE`,
    `dist/licenses/${family}.txt`
  );
}
await cp('THIRD_PARTY_NOTICES.md', 'dist/THIRD_PARTY_NOTICES.md');
