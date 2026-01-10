# Issue: Notifiche non annunciate ai lettori di schermo

Status: Resolved in working tree (verifica manuale richiesta)
Severity: Low
Apps: hdfs_interactive.html, yarn_interactive.html, hadoop_full.html

## Worklog
- 2025-02-14: notifiche marcate con `role=\"status\"` e `aria-live=\"polite\"`. Ref: `hdfs_interactive.html:967-973`, `yarn_interactive.html:888-894`, `hadoop_full.html:2006-2012`.

## Evidenza
- `hdfs_interactive.html:967-973` set `role` e `aria-live`.
- `yarn_interactive.html:888-894` set `role` e `aria-live`.
- `hadoop_full.html:2006-2012` set `role` e `aria-live`.

## Impatto
Gli annunci di stato non vengono letti dai lettori di schermo, riducendo l accessibilita.

## Piano di lavoro
1. Avviare le app con un lettore di schermo attivo.
2. Attivare azioni che generano notifiche.
3. Verificare che le notifiche vengano annunciate in modo coerente.

## Criteri di chiusura
- Notifiche annunciate correttamente in tutti i flussi principali.
