# Issue 04 — Engine MapReduce

## Obiettivo
Implementare MapReduce con mappers per block, locality preference, progress, failure handling e rilascio risorse.

## Deliverable
- Modulo `assets/js/hadoop-sim/mapreduce.js`.
- API MapReduce: `runJob(fileId)`, `tickProgress`, `handleNodeFailure`, `stats`.
- Test unitari per locality, mappers=blocks, failure rescheduling.

## Piano di lavoro
1. Derivare block locations da HDFS e scegliere nodi preferiti (locality first).
2. Allocare un mapper per blocco usando YARN; fallback su nodi non-locali.
3. Simulare progresso con `Clock` (step e intervalli configurabili).
4. Gestire failure: re-schedulazione mappers se risorse disponibili, altrimenti marking failed.
5. Rilasciare risorse a fine job.
6. Test: uno mapper per block, locality >= soglia, nessun mapper attivo su nodo failed.

## Criteri di accettazione
- Progress deterministico sotto RNG/Clock controllati.
- Risorse liberate a fine job.

## Test
- `node --test tests/unit/mapreduce/*.test.js`.
