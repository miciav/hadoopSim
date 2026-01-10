# Issue: Upload fallito lascia blocchi orfani e storage usato

Status: Resolved in working tree (verifica manuale richiesta)
Severity: Medium
Apps: hdfs_interactive.html, hadoop_full.html

## Worklog
- 2025-02-14: rollback blocchi su upload fallito per HDFS e full. Ref: `hdfs_interactive.html:887-901`, `hadoop_full.html:1270-1283`.

## Evidenza
- `hdfs_interactive.html:787-833` upload fallito richiama rollback; `hdfs_interactive.html:887-901` rollback dei blocchi.
- `hadoop_full.html:1177-1224` upload fallito richiama rollback; `hadoop_full.html:1270-1283` rollback dei blocchi.

## Impatto
Storage usato aumenta anche se il file non esiste, con inconsistenza tra UI e stato reale.

## Piano di lavoro
1. Riempire il cluster fino a rendere un upload parzialmente fallibile.
2. Avviare un upload grande che fallisce a meta.
3. Verificare che non restino blocchi del file sui nodi e che lo storage usato torni indietro.
4. Controllare che `cluster.files` non contenga il file fallito.

## Criteri di chiusura
- Nessun blocco orfano e storage coerente dopo upload fallito.
