import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createInitialState,
  addToBuffer,
  clearBuffer,
  addSpill,
  setFinal,
  addToReducer,
  splitInputData,
  getSpillTriggerCount,
  calculateSpillCount,
  calculateBufferUsage,
  shouldSpill,
  calculateBufferPercentage,
  RAW_DATA_A,
  RAW_DATA_B
} from '../../../assets/js/pipeline-dual-nodes/state.js';

test('RAW_DATA_A is frozen', () => {
  assert.ok(Object.isFrozen(RAW_DATA_A));
  assert.equal(RAW_DATA_A.length, 10);
});

test('RAW_DATA_B is frozen', () => {
  assert.ok(Object.isFrozen(RAW_DATA_B));
  assert.equal(RAW_DATA_B.length, 8);
});

test('createInitialState produces clean state', () => {
  const state = createInitialState();

  assert.equal(state.running, false);
  assert.equal(state.shuffleComplete, false);
  assert.equal(state.mappers.length, 2);
  assert.equal(state.mappers[0].buffer.length, 0);
  assert.equal(state.mappers[0].spills.length, 0);
  assert.equal(state.mappers[0].final.length, 0);
  assert.equal(state.inputSplits.length, 2);
  assert.equal(state.inputSplits[0].length, 1);
  assert.equal(state.inputSplits[1].length, 1);
  assert.equal(state.spillCounts[0], 2);
  assert.equal(state.spillCounts[1], 2);
  assert.deepEqual(Object.keys(state.reducers), ['0', '1', '2']);
});

test('createInitialState mappers have correct IDs', () => {
  const state = createInitialState();

  assert.equal(state.mappers[0].id, 0);
  assert.equal(state.mappers[1].id, 1);
});

test('createInitialState uses provided data', () => {
  const customA = [{ k: 'test', p: 0, c: 'bg-p0' }];
  const customB = [{ k: 'test2', p: 1, c: 'bg-p1' }];

  const state = createInitialState(customA, customB);

  assert.equal(state.mappers[0].data.length, 1);
  assert.equal(state.mappers[0].data[0].k, 'test');
  assert.equal(state.mappers[1].data.length, 1);
  assert.equal(state.mappers[1].data[0].k, 'test2');
  assert.equal(state.inputSplits[0].length, 1);
  assert.equal(state.inputSplits[1].length, 1);
  assert.equal(state.spillCounts[0], 1);
  assert.equal(state.spillCounts[1], 1);
});

test('createInitialState copies data arrays', () => {
  const customA = [{ k: 'test', p: 0, c: 'bg-p0' }];
  const state = createInitialState(customA, []);

  customA.push({ k: 'another', p: 0, c: 'bg-p0' });

  assert.equal(state.mappers[0].data.length, 1);
});

test('addToBuffer returns new state without mutation', () => {
  const mapper = { id: 0, buffer: [], spills: [], final: [], data: [] };
  const record = { k: 'cat', p: 0, c: 'bg-p0' };

  const newMapper = addToBuffer(mapper, record);

  assert.equal(mapper.buffer.length, 0);
  assert.equal(newMapper.buffer.length, 1);
  assert.equal(newMapper.buffer[0].k, 'cat');
});

test('addToBuffer preserves other properties', () => {
  const mapper = { id: 0, buffer: [{ k: 'existing' }], spills: [['spill']], final: ['final'], data: ['data'] };
  const record = { k: 'cat', p: 0, c: 'bg-p0' };

  const newMapper = addToBuffer(mapper, record);

  assert.equal(newMapper.id, 0);
  assert.deepEqual(newMapper.spills, [['spill']]);
  assert.deepEqual(newMapper.final, ['final']);
  assert.deepEqual(newMapper.data, ['data']);
});

test('clearBuffer returns new state with empty buffer', () => {
  const mapper = { id: 0, buffer: [{ k: 'cat' }, { k: 'dog' }], spills: [], final: [], data: [] };

  const newMapper = clearBuffer(mapper);

  assert.equal(mapper.buffer.length, 2);
  assert.equal(newMapper.buffer.length, 0);
});

test('addSpill returns new state with additional spill', () => {
  const mapper = { id: 0, buffer: [], spills: [], final: [], data: [] };
  const spillData = [{ k: 'cat', count: 2 }];

  const newMapper = addSpill(mapper, spillData);

  assert.equal(mapper.spills.length, 0);
  assert.equal(newMapper.spills.length, 1);
  assert.deepEqual(newMapper.spills[0], spillData);
});

test('addSpill preserves existing spills', () => {
  const existingSpill = [{ k: 'existing', count: 1 }];
  const mapper = { id: 0, buffer: [], spills: [existingSpill], final: [], data: [] };
  const newSpill = [{ k: 'new', count: 2 }];

  const newMapper = addSpill(mapper, newSpill);

  assert.equal(newMapper.spills.length, 2);
  assert.deepEqual(newMapper.spills[0], existingSpill);
  assert.deepEqual(newMapper.spills[1], newSpill);
});

test('setFinal returns new state with final data', () => {
  const mapper = { id: 0, buffer: [], spills: [], final: [], data: [] };
  const finalData = [{ k: 'cat', count: 5 }];

  const newMapper = setFinal(mapper, finalData);

  assert.equal(mapper.final.length, 0);
  assert.deepEqual(newMapper.final, finalData);
});

test('addToReducer returns new state with record added to partition', () => {
  const reducers = { 0: [], 1: [], 2: [] };
  const record = { k: 'cat', count: 2 };

  const newReducers = addToReducer(reducers, 0, record);

  assert.equal(reducers[0].length, 0);
  assert.equal(newReducers[0].length, 1);
  assert.deepEqual(newReducers[0][0], record);
});

test('addToReducer preserves other partitions', () => {
  const reducers = { 0: [{ k: 'existing' }], 1: [], 2: [] };
  const record = { k: 'cat', count: 2 };

  const newReducers = addToReducer(reducers, 1, record);

  assert.deepEqual(newReducers[0], [{ k: 'existing' }]);
  assert.equal(newReducers[1].length, 1);
  assert.equal(newReducers[2].length, 0);
});

test('calculateBufferUsage computes correct ratio', () => {
  const buffer = [1, 2, 3];
  assert.equal(calculateBufferUsage(buffer, 6), 0.5);
});

test('calculateBufferUsage with default capacity', () => {
  const buffer = [1, 2, 3, 4, 5, 6];
  assert.equal(calculateBufferUsage(buffer), 1);
});

test('calculateBufferUsage with empty buffer', () => {
  assert.equal(calculateBufferUsage([]), 0);
});

test('shouldSpill returns true at threshold', () => {
  const buffer = [1, 2, 3, 4, 5];
  assert.equal(shouldSpill(buffer, 0.75, 6), true);
});

test('shouldSpill returns false below threshold', () => {
  const buffer = [1, 2, 3];
  assert.equal(shouldSpill(buffer, 0.75, 6), false);
});

test('shouldSpill returns true exactly at threshold', () => {
  const buffer = [1, 2, 3, 4];
  assert.equal(shouldSpill(buffer, 0.5, 8), true);
});

test('shouldSpill with default parameters', () => {
  const buffer = [1, 2, 3, 4, 5];
  assert.equal(shouldSpill(buffer), true);
});

test('calculateBufferPercentage returns percentage', () => {
  const buffer = [1, 2, 3];
  assert.equal(calculateBufferPercentage(buffer, 6), 50);
});

test('calculateBufferPercentage caps at 100', () => {
  const buffer = [1, 2, 3, 4, 5, 6, 7, 8];
  assert.equal(calculateBufferPercentage(buffer, 6), 100);
});

test('calculateBufferPercentage rounds to nearest integer', () => {
  const buffer = [1, 2];
  assert.equal(calculateBufferPercentage(buffer, 6), 33);
});

test('splitInputData chunks records by split size', () => {
  const data = [{ k: 'a' }, { k: 'b' }, { k: 'c' }, { k: 'd' }, { k: 'e' }];
  const splits = splitInputData(data, 2);

  assert.equal(splits.length, 3);
  assert.equal(splits[0].length, 2);
  assert.equal(splits[2].length, 1);
});

test('getSpillTriggerCount respects capacity and threshold', () => {
  assert.equal(getSpillTriggerCount(6, 0.75), 5);
  assert.equal(getSpillTriggerCount(4, 0.5), 2);
});

test('calculateSpillCount returns 0 for empty data', () => {
  assert.equal(calculateSpillCount(0, 6, 0.75), 0);
});

test('calculateSpillCount rounds up for partial spills', () => {
  assert.equal(calculateSpillCount(9, 6, 0.75), 2);
  assert.equal(calculateSpillCount(10, 6, 0.75), 2);
  assert.equal(calculateSpillCount(11, 6, 0.75), 3);
});
