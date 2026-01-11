# Issue 03 — Engine YARN

## Obiettivo
Implementare lo scheduler YARN (allocazione container, queueing, rilascio risorse, metriche).

## Deliverable
- Modulo `assets/js/hadoop-sim/yarn.js`.
- API YARN: `submitJob`, `submitDistributedJob`, `releaseContainer`, `drainQueue`, `stats`.
- Test unitari su capacità, queue e rilascio.

## Piano di lavoro
1. Definire `ContainerRequest` (cpu, memory, name, jobId) e stato job.
2. Implementare allocazione su nodi non failed con policy simple-fit/least-loaded.
3. Implementare coda FIFO per job non allocabili.
4. Implementare completamento container e rilascio risorse.
5. Implementare metriche aggregate (cpu/mem usage, active apps).
6. Test: risorse non superano capacity, queue si scarica quando si libera spazio.

## Criteri di accettazione
- Nessuna risorsa negativa o oltre capacity.
- Queue deterministica con RNG/clock iniettati.

## Test
- `node --test tests/unit/yarn/*.test.js`.
