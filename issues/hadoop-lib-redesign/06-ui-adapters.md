# Issue 06 — UI adapters e HTML

## Obiettivo
Aggiornare le pagine HTML a usare la nuova libreria con adapters sottili e aggiornare i binding UI.

## Deliverable
- Script per ogni pagina che crea `simulation` e aggiorna il DOM.
- `hadoop-ecosystem-simulator` (React) aggiornato per usare la libreria (no JSX changes, solo wiring).
- Eventuali modifiche HTML/IDs se necessari.

## Piano di lavoro
1. Definire adapter base (subscribe -> render) per le pagine non React.
2. Aggiornare `hdfs_interactive.html`, `yarn_interactive.html`, `hadoop_full.html`.
3. Integrare la libreria nel React simulator via hooks (state derivato dalla libreria).
4. Aggiornare map-side pipeline se utile o mantenerla separata.

## Criteri di accettazione
- UI funziona con il nuovo runtime.
- Nessun DOM access nel core.

## Test
- Playwright su tutte le pagine.
