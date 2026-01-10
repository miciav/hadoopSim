# Issue: Rendering completo a ogni update (potenziale costo crescente)

Status: Open
Severity: Low
Apps: hdfs_interactive.html, yarn_interactive.html, hadoop_full.html

## Worklog
- 2025-02-14: issue accettata in backlog; nessuna modifica applicata ancora.

## Evidenza
- `hdfs_interactive.html:653-705` ricostruisce tutto il grid e la lista file.
- `yarn_interactive.html:605-666` ricostruisce tutto il grid nodi.
- `hadoop_full.html:733-818` ricostruisce tutti i nodi unificati.

## Impatto
Con piu nodi/blocchi l aggiornamento completo puo diventare lento e peggiorare la fluidita.

## Piano di lavoro
1. Misurare con DevTools i tempi di render durante azioni ripetute.
2. Identificare le sezioni che cambiano davvero (es. solo un nodo o un contatore).
3. Introdurre update mirati per sezioni specifiche (es. updateStats + updateNode).
4. Mantenere un fallback full render per reset iniziale.
5. Verificare che non si creino desincronizzazioni UI/stato.

## Criteri di chiusura
- Render per azione ridotto a sezioni strettamente necessarie.
- Nessuna regressione visiva nei flussi principali.
