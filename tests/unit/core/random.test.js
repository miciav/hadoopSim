import test from 'node:test';
import assert from 'node:assert/strict';
import { createSeededRng, randomInt, shuffle } from '../../../assets/js/hadoop-sim/random.js';

test('seeded rng is deterministic', () => {
  const rngA = createSeededRng(123);
  const rngB = createSeededRng(123);

  const seqA = [rngA(), rngA(), rngA()];
  const seqB = [rngB(), rngB(), rngB()];

  assert.deepEqual(seqA, seqB);
});

test('randomInt respects bounds', () => {
  const rng = createSeededRng(5);
  for (let i = 0; i < 20; i += 1) {
    const value = randomInt(3, 5, rng);
    assert.ok(value >= 3 && value <= 5);
  }
});

test('shuffle returns new array with same items', () => {
  const rng = createSeededRng(8);
  const source = [1, 2, 3, 4, 5];
  const shuffled = shuffle(source, rng);

  assert.notEqual(shuffled, source);
  assert.deepEqual([...shuffled].sort(), [...source].sort());
});
