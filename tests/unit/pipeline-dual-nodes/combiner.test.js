import test from 'node:test';
import assert from 'node:assert/strict';
import {
  combine,
  sortByPartitionThenKey,
  mergeSpills,
  aggregateByKey,
  sortAndCombineBuffer
} from '../../../assets/js/pipeline-dual-nodes/combiner.js';

test('combine aggregates records by key', () => {
  const input = [
    { k: 'cat', p: 0, c: 'bg-p0' },
    { k: 'cat', p: 0, c: 'bg-p0' },
    { k: 'dog', p: 1, c: 'bg-p1' }
  ];

  const result = combine(input);

  assert.equal(result.length, 2);
  const cat = result.find(r => r.k === 'cat');
  const dog = result.find(r => r.k === 'dog');
  assert.equal(cat.count, 2);
  assert.equal(dog.count, 1);
});

test('combine respects existing counts', () => {
  const input = [
    { k: 'cat', p: 0, c: 'bg-p0', count: 3 },
    { k: 'cat', p: 0, c: 'bg-p0', count: 2 }
  ];

  const result = combine(input);

  assert.equal(result.length, 1);
  assert.equal(result[0].count, 5);
});

test('combine preserves all record properties', () => {
  const input = [{ k: 'cat', p: 0, c: 'bg-p0' }];

  const result = combine(input);

  assert.equal(result[0].k, 'cat');
  assert.equal(result[0].p, 0);
  assert.equal(result[0].c, 'bg-p0');
  assert.equal(result[0].count, 1);
});

test('combine handles empty input', () => {
  const result = combine([]);
  assert.deepEqual(result, []);
});

test('sortByPartitionThenKey orders by partition first', () => {
  const input = [
    { k: 'dog', p: 1 },
    { k: 'ant', p: 0 },
    { k: 'cat', p: 0 }
  ];

  const result = sortByPartitionThenKey(input);

  assert.equal(result[0].p, 0);
  assert.equal(result[1].p, 0);
  assert.equal(result[2].p, 1);
});

test('sortByPartitionThenKey orders by key within partition', () => {
  const input = [
    { k: 'dog', p: 0 },
    { k: 'ant', p: 0 },
    { k: 'cat', p: 0 }
  ];

  const result = sortByPartitionThenKey(input);

  assert.equal(result[0].k, 'ant');
  assert.equal(result[1].k, 'cat');
  assert.equal(result[2].k, 'dog');
});

test('sortByPartitionThenKey does not mutate original', () => {
  const input = [
    { k: 'dog', p: 1 },
    { k: 'ant', p: 0 }
  ];
  const originalFirst = input[0];

  sortByPartitionThenKey(input);

  assert.equal(input[0], originalFirst);
});

test('sortByPartitionThenKey handles empty input', () => {
  const result = sortByPartitionThenKey([]);
  assert.deepEqual(result, []);
});

test('mergeSpills combines and sorts multiple spills', () => {
  const spills = [
    [{ k: 'cat', p: 0, c: 'bg-p0', count: 2 }],
    [{ k: 'cat', p: 0, c: 'bg-p0', count: 1 }, { k: 'dog', p: 1, c: 'bg-p1', count: 1 }]
  ];

  const result = mergeSpills(spills);

  assert.equal(result.length, 2);
  assert.equal(result.find(r => r.k === 'cat').count, 3);
  assert.equal(result.find(r => r.k === 'dog').count, 1);
});

test('mergeSpills maintains partition order', () => {
  const spills = [
    [{ k: 'dog', p: 1, c: 'bg-p1', count: 1 }],
    [{ k: 'cat', p: 0, c: 'bg-p0', count: 1 }]
  ];

  const result = mergeSpills(spills);

  assert.equal(result[0].k, 'cat');
  assert.equal(result[1].k, 'dog');
});

test('mergeSpills handles empty spills array', () => {
  const result = mergeSpills([]);
  assert.deepEqual(result, []);
});

test('mergeSpills handles spills with empty arrays', () => {
  const spills = [[], [{ k: 'cat', p: 0, c: 'bg-p0', count: 1 }], []];
  const result = mergeSpills(spills);
  assert.equal(result.length, 1);
});

test('aggregateByKey produces final counts', () => {
  const input = [
    { k: 'cat', count: 3 },
    { k: 'cat', count: 2 },
    { k: 'dog', count: 1 }
  ];

  const result = aggregateByKey(input);

  assert.equal(result.get('cat'), 5);
  assert.equal(result.get('dog'), 1);
});

test('aggregateByKey handles records without count', () => {
  const input = [
    { k: 'cat' },
    { k: 'cat' }
  ];

  const result = aggregateByKey(input);

  assert.equal(result.get('cat'), 2);
});

test('aggregateByKey returns Map instance', () => {
  const result = aggregateByKey([{ k: 'cat', count: 1 }]);
  assert.ok(result instanceof Map);
});

test('aggregateByKey handles empty input', () => {
  const result = aggregateByKey([]);
  assert.equal(result.size, 0);
});

test('sortAndCombineBuffer sorts and combines', () => {
  const buffer = [
    { k: 'dog', p: 1, c: 'bg-p1' },
    { k: 'cat', p: 0, c: 'bg-p0' },
    { k: 'cat', p: 0, c: 'bg-p0' }
  ];

  const result = sortAndCombineBuffer(buffer);

  assert.equal(result.length, 2);
  assert.equal(result[0].k, 'cat');
  assert.equal(result[0].count, 2);
  assert.equal(result[1].k, 'dog');
  assert.equal(result[1].count, 1);
});
