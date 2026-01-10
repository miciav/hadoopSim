# Issue: Timer pendenti dopo reset possono mutare lo stato

Status: Resolved in working tree (verifica manuale richiesta)
Severity: High
Apps: hdfs_interactive.html, yarn_interactive.html, hadoop_full.html

## Worklog
- 2025-02-14: verifica statica dei punti `setTimeout`/`setInterval`; solo i wrapper sono usati per job/re-replication, restano solo timeout UI per notifiche.

## Evidenza
- `hdfs_interactive.html:622-636` tracking dei timeout; `hdfs_interactive.html:959-963` pulizia in reset.
- `yarn_interactive.html:575-589` tracking dei timeout; `yarn_interactive.html:880-884` pulizia in reset.
- `hadoop_full.html:669-697` tracking di timeout/interval; `hadoop_full.html:1993-2001` pulizia in reset.

## Impatto
Se un timeout o interval scatta dopo un reset, aggiorna il cluster nuovo con dati vecchi (risorse negative, container fantasma, notifiche incoerenti).

## Piano di lavoro
1. Avviare ogni app e creare piu job con completamento ritardato.
2. Premere Reset mentre i job sono in corso.
3. Attendere oltre il tempo massimo dei timeout (>= 15s).
4. Verificare che non arrivino completamenti o notifiche riferite a job pre-reset.
5. Se compaiono eventi tardivi, cercare setTimeout/setInterval non instradati tramite i wrapper di tracking.

## Criteri di chiusura
- Nessuna notifica o completamento post-reset dopo 15s in tutte le app.
