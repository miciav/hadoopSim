# Issue 02 — Engine HDFS

## Obiettivo
Implementare la simulazione HDFS con allocazione blocchi, replica, rollback, failure, e metriche, usando il data model comune.

## Deliverable
- Modulo `assets/js/hadoop-sim/hdfs.js`.
- API HDFS: `uploadFile`, `allocateBlock`, `rollbackFile`, `failNode`, `reReplicate`, `stats`.
- Test unitari su invarianti HDFS.

## Piano di lavoro
1. Definire policy di allocazione (replica su nodi distinti, spazio sufficiente, no duplicati per nodo).
2. Implementare `uploadFile(sizeMb)` con rollback completo se una replica fallisce.
3. Implementare `failNode(nodeId)` e `reReplicate()` con tracking di blocchi persi/under-replicated.
4. Implementare `stats()` (nodes attivi, storage usage, blocks, files).
5. Test: RF mantenuto quando c'è spazio, rollback su spazio insufficiente, nessun blocco su nodo failed, storage non negativo.

## Criteri di accettazione
- Unità coerenti (MB) e nessun mix MB/GB nel core.
- Repliche mai sullo stesso nodo.
- Rollback pulito su fallimento.

## Test
- `node --test tests/unit/hdfs/*.test.js`.
