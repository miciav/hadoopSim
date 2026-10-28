import { createActor, createMachine } from 'xstate';

const jobMachine = createMachine({
  initial: 'queued',
  states: {
    queued: { on: { START: 'running', COMPLETE: 'completed', FAIL: 'failed' } },
    running: { on: { COMPLETE: 'completed', FAIL: 'failed' } },
    completed: { type: 'final' },
    failed: { type: 'final' }
  }
});

export function createJobActor() {
  return createActor(jobMachine).start();
}
