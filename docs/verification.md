# Verifica finale del piano — 28 ottobre 2026

Branch locale: `codex/didactic-simulators`, base `d9cfa1a`.
Il lavoro è nella worktree `/Users/micheleciavotta/.codex/worktrees/412f/hadoopSim`.
Il checkout principale e il sito pubblicato non sono stati aggiornati.

## Consegne del piano

| Task | Consegna e prova                                                                                                                                  |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | Contratti delle otto viste, diversi livelli didattici, conteggio indipendente delle chiavi e test separati per pipeline automatica/guidata        |
| 2    | Clock deterministico, seed, fixture, lint JS/JSX, Prettier sull'intero sorgente mantenuto, errori pagina/console intercettati nei test            |
| 3    | Rimossi archivio e script morto; standalone conservate; inventario delle differenze storiche e descrizioni corrette                               |
| 4    | Build esbuild/React/XState locale, licenze incluse, apertura diretta con rete esterna bloccata e prefisso `/hadoopSim/`                           |
| 5    | Next/Play/Pause/Reset, doppio Next, renderer fallito, reset in tutte le fasi, cancellazione dei timer e degli overlay                             |
| 6    | Trasformazioni guidate pure, input vuoti/sbilanciati, conteggi conservati e spill ai confini degli split                                          |
| 7    | Run XState separato, mapper concorrenti, cancellazione map/shuffle/folding e run-reset-run senza doppio conteggio                                 |
| 8    | Validazione, file vuoti, FIFO, mapper in ondate, retry con replica, perdita dati, guasto AM, reset/dispose e accounting risorse                   |
| 9    | Scenari lezione, tastiera/etichette/live region/reduced motion, browser, documentazione e workflow che pubblica soltanto `dist/` dopo i controlli |

## Revisione indipendente e correzioni

Un revisore indipendente ha esaminato il ramo e riprodotto tre difetti importanti:

1. Mapper remoto completato dopo la perdita dell'ultima replica: ora ogni mapper
   non completato richiede input ancora accessibile dopo un guasto.
2. Reset in un listener di fallimento con più job: il motore smette di visitare
   i job della sessione precedente.
3. Reset nella callback di fine passo guidato: il cursore nuovo rimane a zero.

Per ciascuno è stata osservata la regressione fallire e poi passare. La lacuna
sulle animazioni è stata risolta propagando AbortSignal a attese, voli, sweep e
folding; lo shuffle gestisce le promesse concorrenti anche durante l'aborto.

Ulteriori completamenti: rifiuto di richieste YARN impossibili (anche nella UI
dei job distribuiti), regioni live persistenti per le notifiche, etichette
associate ai controlli e licenze runtime nel sito generato.

## Controlli eseguiti

Ultima esecuzione da installazione pulita (`npm ci --offline`), Node 24.22.1:

- ESLint e Prettier: esito positivo.
- Unit test: 147 superati, zero fallimenti.
- Chromium: 42 superati, zero fallimenti.
- WebKit: 42 superati, zero fallimenti.
- Build statica, licenze e controllo `git diff --check`: esito positivo.
- Cinque trace della lezione per browser: ZIP validi e leggibili.

Con Node 26.12.1 le asserzioni della lezione passavano ma quattro test scadevano
durante l'esportazione delle trace. La prova isolata e le suite complete su
Node 24.22.1 passano anche l'esportazione: sviluppo e CI usano questa versione.
I comandi da ripetere con la versione Node in `.node-version` sono:

```sh
npm ci
npm run lint
npm run format:check
npm run test:unit
npm test
npx playwright test --browser=webkit --output=test-results-webkit
git diff --check
```

I test di build conservano screenshot delle nove pagine a 1440×1000. I test
lezione coprono anche 1024×768 e conservano trace per la diagnosi. Le directory
`test-results/` e `test-results-webkit/` sono artefatti locali esclusi da Git.
Il workflow conserva inoltre `test-results/` come artefatto per sette giorni.

Il collaudo manuale in Safari ha verificato le sei viste della homepage: upload,
esecuzione job e reset in Ecosystem; upload/job/guasto/reset nel cluster completo;
upload/guasto in HDFS; allocazioni semplici e distribuite in YARN; mapper
concorrenti e reset nella pipeline; Next/Play/Pause/Reset nella guidata.
In Chrome sono stati verificati homepage e collegamento alla guidata, avanzamento,
Play/Pause/Reset con console aperta. La suite automatica controlla errori JS,
errori console e warning React in tutte le pagine.

## Decisioni rispetto alla sequenza originaria

- Le prime modifiche sono state intercalate fra task, con alcuni commit comuni:
  baseline e CDN impedivano la verifica nella sequenza prevista. Non è possibile
  ricreare retroattivamente commit separati o una baseline manuale pre-modifica;
  il costo è una revisione del diff complessivo, effettuata dal revisore finale.
- Prettier era inizialmente limitato ai file nuovi per ridurre il rumore nel diff.
  Questa limitazione è stata rimossa in `e261743`, commit di sola formattazione;
  il costo è un diff meccanico ampio ma separabile dalle correzioni.
- Il modello guidato usa `buildTeachingSteps` e `applyTeachingStep`, evitando un
  secondo proprietario dello stato/cursore. Un futuro consumatore standalone
  dovrà comporre queste funzioni con un proprio cursore.
- Il playback guidato usa la macchina UI e gli attori di passo esistenti,
  senza la factory wrapper `createPlayback`: minore riusabilità fuori pagina.
  I casi previsti in `playback.test.js` sono verificati attraverso l'API e i
  controlli reali in `teaching_pipeline.spec.js`.
- La pipeline automatica usa un attore XState per run e fasi espresse in codice,
  senza una macchina universale: sequenziamento e concorrenza restano locali.
- Le richieste YARN strutturalmente impossibili vengono rifiutate, anche se la
  parte FIFO del piano parlava soprattutto di MapReduce. Questo applica il
  vincolo della spec sulle code non risolvibili; i chiamanti vedono un rifiuto
  esplicito invece di un'attesa senza fine.
- Le verifiche sistematiche dei reset di ogni fase, dei guasti e dei viewport
  sono automatizzate; il collaudo manuale campiona le interazioni principali.
  Non è una certificazione di accessibilità con tecnologie assistive.

Non rimangono finding importanti noti dalla revisione. I limiti didattici e le
funzioni storiche non migrate sono documentati nei contratti, non mascherati come
simulazioni implementate. Il Gantt e la selezione storica di 1–5 nodi restano
recuperabili da Git, ma non fanno parte del sito corrente.

## Integrazione e pubblicazione

Il workflow è preparato per PR, main e dispatch autorizzato; usa la versione Node
in `.node-version`, esegue i controlli, costruisce e pubblica `dist/`. Non sono
stati eseguiti merge, push, creazione PR o deploy. La verifica sul dominio reale
GitHub Pages avviene dopo l'integrazione autorizzata; una build locale non ne
costituisce prova.
