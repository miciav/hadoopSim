# Issue: Animazioni senza supporto prefers-reduced-motion

Status: Resolved in working tree (verifica manuale richiesta)
Severity: Low
Apps: hdfs_interactive.html, yarn_interactive.html, hadoop_full.html

## Worklog
- 2025-02-14: aggiunto `prefers-reduced-motion` in tutte le pagine. Ref: `hdfs_interactive.html:494-499`, `yarn_interactive.html:468-473`, `hadoop_full.html:522-526`.

## Evidenza
- `hdfs_interactive.html:494-499` override per reduced motion.
- `yarn_interactive.html:468-473` override per reduced motion.
- `hadoop_full.html:522-526` override per reduced motion.

## Impatto
Utenti con motion sensitivity non possono ridurre animazioni e transizioni.

## Piano di lavoro
1. Abilitare prefers-reduced-motion nel browser.
2. Verificare che animazioni e transizioni siano disattivate in tutte le app.
3. Controllare che le notifiche e i hover non introducano movimento.

## Criteri di chiusura
- Nessuna animazione/transizione visibile con prefers-reduced-motion attivo.
