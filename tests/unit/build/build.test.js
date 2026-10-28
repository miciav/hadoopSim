import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

test('build includes a self-contained ecosystem entry', () => {
  execFileSync(process.execPath, ['scripts/build.mjs']);
  assert.ok(existsSync('dist/hadoop-ecosystem-simulator.html'));
  const html = readFileSync('dist/hadoop-ecosystem-simulator.html', 'utf8');
  assert.doesNotMatch(html, /https?:\/\//);
  assert.match(html, /type="module"/);
  assert.ok(existsSync('dist/assets/js/hadoop-ecosystem-simulator.js'));
});
