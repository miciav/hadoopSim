# Issue: Mutazioni di stato e rendering accoppiati in molti punti

Status: Open
Severity: Low
Apps: hdfs_interactive.html, yarn_interactive.html, hadoop_full.html

## Worklog
- 2025-02-14: issue accettata in backlog; nessuna modifica applicata ancora.

## Evidenza
- `hdfs_interactive.html:755-795` upload muta `cluster` e chiama subito `renderCluster`.
- `yarn_interactive.html:711-767` submit muta stato e chiama `renderCluster`.
- `hadoop_full.html:1160-1184` upload muta stato e chiama `renderCluster`.

## Impatto
Aumenta il rischio di update parziali o duplicati quando si aggiungono nuove azioni, e rende difficile testare le funzioni.

## Piano di lavoro
1. Introdurre un wrapper unico (es. `applyAction(fn)`) che muta stato e poi fa una sola render.
2. Aggiornare le azioni principali a usare il wrapper, una per volta.
3. Tenere le funzioni helper pure dove possibile (no side effects).
4. Verificare che ogni azione aggiorni la UI una sola volta.

## Criteri di chiusura
- Ogni action muta lo stato e chiama `renderCluster` da un solo punto centrale.
