# Issue: Replica placement si ferma prima di trovare nodi liberi

Status: Resolved in working tree (verifica manuale richiesta)
Severity: Medium
Apps: hdfs_interactive.html, hadoop_full.html

## Worklog
- 2025-02-14: ciclo replica continua finche RF raggiunto. Ref: `hdfs_interactive.html:856-874`, `hadoop_full.html:1247-1264`.

## Evidenza
- `hdfs_interactive.html:856-874` ciclo continua finche non raggiunge RF.
- `hadoop_full.html:1247-1264` ciclo continua finche non raggiunge RF.

## Impatto
Replica insufficienti anche quando esistono nodi con spazio disponibile, con rischio di dati sotto-replicati.

## Piano di lavoro
1. Caricare file finche alcuni nodi sono quasi pieni.
2. Caricare un file che richieda replica su nodi piu in basso nella lista.
3. Verificare che la replica continui a cercare nodi disponibili oltre i primi RF.
4. Confermare che il numero di repliche raggiunga RF quando lo spazio esiste.

## Criteri di chiusura
- Replica raggiunge RF se c e spazio sufficiente su qualsiasi nodo attivo.
