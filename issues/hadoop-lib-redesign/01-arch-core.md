# Issue 01 — Architettura e core della libreria

## Obiettivo
Definire l'API pubblica della nuova libreria Hadoop-sim e scaffolding dei moduli core (eventi, clock, RNG, config/state). La libreria deve essere DOM-free, testabile in Node, con dipendenze iniettate (random e clock).

## Deliverable
- `assets/js/hadoop-sim/` con entry `index.js`.
- Moduli core: `events.js`, `clock.js`, `random.js`, `config.js`, `state.js`.
- Test unitari per eventi/clock/RNG/config.
- Documento breve in `docs/architecture.md` con data model e invarianti principali.

## Piano di lavoro
1. Definire data model minimo: `Cluster`, `Node`, `File`, `Block`, `Container`, `Job` (campi e unità base MB).
2. Disegnare l'API pubblica: `createSimulation(config, deps)` con `state`, `actions`, `subscribe`.
3. Implementare `EventEmitter` semplice (subscribe/unsubscribe, emit).
4. Implementare `Clock` con interfaccia `setTimeout`, `setInterval`, `clear*`, `now`, `advance(ms)`; default su `window` per browser.
5. Implementare `Rng` iniettato (seeded per test) + helper `pick`, `shuffle`.
6. Creare `state.js` con factory iniziale (nessun DOM, solo dati).
7. Scrivere test unitari Node per eventi/clock/RNG e validare invarianti base.

## Criteri di accettazione
- La libreria non accede al DOM e non usa `window` direttamente salvo che nei default.
- `Clock` e `Rng` sono iniettati e sostituibili in test.
- Test unitari passano su Node.

## Test
- `node --test tests/unit/core/*.test.js`.
