import test from 'node:test';
import assert from 'node:assert/strict';
import { createJobActor } from '../../../assets/js/hadoop-sim/job-machine.js';

test('completed and failed jobs cannot restart', () => {
  for (const terminal of ['COMPLETE', 'FAIL']) {
    const actor = createJobActor();
    assert.equal(actor.getSnapshot().value, 'queued');
    actor.send({ type: 'START' });
    assert.equal(actor.getSnapshot().value, 'running');
    actor.send({ type: terminal });
    const finalState = actor.getSnapshot().value;
    actor.send({ type: 'START' });
    assert.equal(actor.getSnapshot().value, finalState);
  }
});
