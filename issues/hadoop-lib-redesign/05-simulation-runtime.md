# Issue 05 — Runtime di simulazione

## Obiettivo
Unificare HDFS/YARN/MapReduce in un runtime coerente con event bus e azioni aggregate.

## Deliverable
- Modulo `assets/js/hadoop-sim/simulation.js`.
- API unificata: `createSimulation(config, deps)` -> `{ state, actions, subscribe }`.
- Test di integrazione su scenari end-to-end (upload + mapreduce + failure).

## Piano di lavoro
1. Comporre HDFS/YARN/MapReduce con un unico `state` condiviso.
2. Esporre `actions`: `uploadFile`, `submitMapReduce`, `submitYarnJob`, `failNode`, `reset`.
3. Emissione eventi su ogni mutazione per UI (`stateChanged`, `jobCompleted`, `warning`).
4. Test integrazione con clock finto e RNG deterministico.

## Criteri di accettazione
- Nessun accesso DOM nel runtime.
- Eventi coerenti e facilmente consumabili dalle UI.

## Test
- `node --test tests/unit/integration/*.test.js`.
