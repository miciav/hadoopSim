import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG, PARTITIONS, LOG_TYPES, SWEEP_COLORS } from '../../../assets/js/pipeline-dual-nodes/config.js';

test('CONFIG is frozen', () => {
  assert.ok(Object.isFrozen(CONFIG));
});

test('CONFIG has expected values', () => {
  assert.equal(CONFIG.BUFFER_CAPACITY, 6);
  assert.equal(CONFIG.SPILL_THRESHOLD, 0.75);
  assert.equal(CONFIG.DEFAULT_SPEED, 1.5);
  assert.equal(CONFIG.MAX_LOG_ENTRIES, 30);
});

test('PARTITIONS is frozen', () => {
  assert.ok(Object.isFrozen(PARTITIONS));
});

test('PARTITIONS has three partitions', () => {
  assert.ok(PARTITIONS[0]);
  assert.ok(PARTITIONS[1]);
  assert.ok(PARTITIONS[2]);
});

test('PARTITIONS have correct CSS classes', () => {
  assert.equal(PARTITIONS[0].cssClass, 'bg-p0');
  assert.equal(PARTITIONS[1].cssClass, 'bg-p1');
  assert.equal(PARTITIONS[2].cssClass, 'bg-p2');
});

test('LOG_TYPES is frozen', () => {
  assert.ok(Object.isFrozen(LOG_TYPES));
});

test('LOG_TYPES has all types', () => {
  assert.equal(LOG_TYPES.SYS, 'log-sys');
  assert.equal(LOG_TYPES.MAP, 'log-map');
  assert.equal(LOG_TYPES.DISK, 'log-disk');
  assert.equal(LOG_TYPES.NET, 'log-net');
  assert.equal(LOG_TYPES.RED, 'log-red');
});

test('SWEEP_COLORS is frozen', () => {
  assert.ok(Object.isFrozen(SWEEP_COLORS));
});

test('SWEEP_COLORS has all colors', () => {
  assert.equal(SWEEP_COLORS.AMBER, 'sweep-amber');
  assert.equal(SWEEP_COLORS.GREEN, 'sweep-green');
  assert.equal(SWEEP_COLORS.PURPLE, 'sweep-purple');
});
