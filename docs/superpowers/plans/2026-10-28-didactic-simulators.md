# Didactic Hadoop Simulators Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rendere affidabili le dimostrazioni Hadoop, preservando obiettivi e granularità di ogni vista e il deploy su GitHub Pages.

**Architecture:** XState governa i lifecycle che oggi usano timer e flag distribuiti. Il core del cluster e le pipeline dettagliate mantengono i propri modelli; le viste guidata e automatica possono usare unità di avanzamento diverse. Le animazioni rappresentano risultati del modello e non decidono le trasformazioni dei dati.

**Tech Stack:** JavaScript ES modules, React esistente, XState stabile, esbuild per bundle e JSX, Node test, Playwright, ESLint, Prettier, GitHub Actions/Pages.

**Spec:** [Design e vincoli](../specs/2026-10-28-didactic-simulators-design.md)

## Global Constraints

- Le sezioni rappresentano fenomeni diversi, anche a granularità diverse. Non uniformarne artificialmente i modelli.
- Le sei viste della homepage restano disponibili agli stessi URL.
- Un passo guidato non deve corrispondere necessariamente a un tick o a un evento della vista automatica.
- Conservare il parallelismo osservabile della pipeline.
- Velocità e presenza del DOM non cambiano risultati e conteggi.
- GitHub Pages resta l'hosting; pubblicare soltanto `dist/` al termine della migrazione.
- Nessun backend, SimScript, service worker, conversione generale a TypeScript o riscrittura grafica.
- Dipendenze stabili fissate esattamente; lockfile versionato. Nessun caricamento CDN necessario durante una lezione.
- Stato iniziale dell'audit: 101/109 unit test verdi, 6/11 smoke test verdi. Rimisurare prima di intervenire; questi numeri non sono una baseline da accettare permanentemente.
- Pianificazione soltanto: installazioni, rimozioni, commit del codice e modifica del deploy appartengono all'esecuzione.

## Review Focus

- Reset seguito immediatamente da start mentre una callback precedente termina: task 5 e 8.
- Una vista che aggrega più record per passo deve preservare il proprio racconto e il totale dei dati: task 1, 6 e 7.
- Job che richiede più mapper di quelli eseguibili simultaneamente, ma singoli mapper ammissibili: task 8.
- Più timer alla stessa scadenza, uno dei quali cancella gli altri: task 2.
- Sito servito sotto `/hadoopSim/`, rete esterna bloccata e accesso diretto a una sottopagina: task 4 e 9.

## Ordine e dimensione

Tre parti collegate, ciascuna verificabile: A) baseline e pulizia, task 1–3;
B) build e lifecycle delle pipeline, task 4–7; C) core del cluster e rilascio,
task 8–9. Non migrare tutto contemporaneamente. Per ogni task: test mirati,
modifica minima, verifica, revisione del diff e commit separato durante
l'esecuzione. Nessun push o pubblicazione è implicito nella pianificazione.

Eseguire la migrazione su un branch isolato. Dopo il task 4, i sorgenti possono
richiedere la build mentre il workflow esistente pubblica ancora la root:
non integrare quel tratto intermedio su main prima di aver completato il task 9.
Le parti di baseline/pulizia possono essere integrate prima solo se conservano
il funzionamento del deploy attuale. Una versione per la lezione già pubblicata
non deve essere sostituita da una migrazione incompleta.

## Mappa dei file

| Area                | File e responsabilità                                                                                                                                  |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Contratto didattico | `docs/teaching-contracts.md`: cosa rappresenta ogni pagina e come verificarlo                                                                          |
| Core cluster        | `assets/js/hadoop-sim/{config,state,hdfs,yarn,mapreduce,simulation,clock}.js`: dominio, risorse, lifecycle                                             |
| Lifecycle job       | Nuovo `assets/js/hadoop-sim/job-machine.js`: stati XState del job, senza rendering                                                                     |
| Pipeline guidata    | `assets/js/pipeline-teaching/engine-step.js`: API UI; nuovi `model.js` e `playback-machine.js`: calcolo e lifecycle                                    |
| Pipeline automatica | `assets/js/pipeline-dual-nodes/engine.js`, `phases/*.js`, nuovo `run-machine.js`: orchestrazione concorrente senza imporre i passi della vista guidata |
| Animazioni          | `assets/js/pipeline-dual-nodes/dom/*.js`, `pipeline-teaching/dom-helpers.js`: presentazione e cleanup                                                  |
| Adattatori UI       | `assets/js/{hadoop-ecosystem-simulator,hadoop_full,hdfs_interactive,yarn_interactive}.js`                                                              |
| Build               | Nuovo `scripts/build.mjs`, `package.json`, `.gitignore`, HTML di ingresso                                                                              |
| Qualità             | Nuovi `eslint.config.js`, `.prettierrc.json`, `.prettierignore`; test esistenti e nuovi test elencati sotto                                            |
| Deploy              | `.github/workflows/pages.yml`, `playwright.config.js`: test sull'output e pubblicazione                                                                |

## Task 1: fissare i contratti didattici delle viste

**Files:** creare `docs/teaching-contracts.md`; leggere tutti gli HTML root, `docs/domain-model.md`, `docs/architecture.md` e i rispettivi entry point JS. Test: `tests/{hadoop_ecosystem,hadoop_full,hdfs_interactive,yarn_interactive,map_side_pipeline}.spec.js`; creare `tests/teaching_pipeline.spec.js`.

**Interfaces:** preservare URL, controlli e API `window.simulation`, `window.pipelineSimulation`, `window.teachingSimulation` finché i loro chiamanti non vengono aggiornati insieme. Nessuna nuova API di prodotto.

- [ ] Per ogni vista annotare obiettivo, unità osservata, significato di avanzamento/completamento, semplificazioni, scenari e controlli esistenti. Separare comportamento desiderato dai bug osservati.
- [ ] Per le due pagine root non in homepage (`hadoop-map-side-pipeline.html`, `hadoop-map-side-pipeline-dual.html`) registrare le differenze didattiche. Conservarle per default; non dedurre inutilità dall'assenza di link.
- [ ] Rilevare per ciascuna pipeline dataset, partizioni e conteggi finali attesi con conteggio indipendente delle chiavi. Aggiungere test con assertion `assert.deepEqual(actualCounts, expectedCounts)` e verificare parallelismo e passo guidato separatamente.
- [ ] Eseguire `npm run test:unit` e `npm test`; registrare errori e screenshot iniziali. Non aggiornare snapshot per accettare comportamenti errati.
- [ ] Verificare manualmente le sei viste; salvare contratto e test di caratterizzazione in un commit dedicato. I test che espongono difetti restano documentati per i task successivi.

## Task 2: rendere affidabile la base di test e analisi statica

**Files:** `assets/js/hadoop-sim/clock.js`, `assets/js/pipeline-dual-nodes/engine.js`; `tests/unit/core/clock.test.js`, `tests/unit/pipeline-dual-nodes/{engine,phases,selectors,state}.test.js`, `tests/helpers.js`, smoke test; `package.json`, lockfile, `playwright.config.js`; creare configurazioni ESLint/Prettier.

**Interfaces:** mantenere `createManualClock(startMs)`, `setTimeout`, `clearTimeout`, `setInterval`, `clearInterval`, `advance(ms)`. Helper browser `seedPage(page, seed): Promise<void>` passa il seed esplicitamente a `page.addInitScript`.

- [ ] Aggiungere regressioni per auto-cancellazione e cancellazione di un secondo callback con la stessa scadenza. Esempio centrale:

```js
let calls = 0;
const id = clock.setInterval(() => {
  calls++;
  clock.clearInterval(id);
}, 10);
clock.advance(40);
assert.equal(calls, 1);
```

- [ ] Eseguire `node --test tests/unit/core/clock.test.js`; confermare che il caso nuovo fallisce prima della correzione.
- [ ] Correggere il riaccodamento dei timer cancellati, importare `CONFIG`, correggere il seed serializzato. Riparare fixture obsolete usando il contratto del task 1; nessun indebolimento delle assertion per ottenere verde.
- [ ] Limitare Playwright a `**/*.spec.js`; installare ascoltatori di `pageerror` prima della navigazione e far fallire il test se vi sono errori. Diagnosticare le globali mancanti prima di aggiungere attese: niente sleep arbitrari.
- [ ] Configurare ESLint per browser, Node e JSX senza falsi positivi sui componenti. Script `lint`, `format:check`, `format`; Prettier a due spazi, stile coerente con i sorgenti, esclusi output e archivi in rimozione. Formattazione in commit distinto dalla logica.
- [ ] Eseguire `npm run test:unit`, `npm test`, `npm run lint`, `npm run format:check`. Se un test espone un bug di dominio, collegarlo al task 8 senza nasconderlo; non dichiarare la suite risolta finché non lo è.
- [ ] Verificare il reset in browser e registrare i risultati nel commit.

## Task 3: eliminare le versioni morte e le promesse obsolete

**Files:** eliminare `old_stuff/` e `assets/js/hadoop-map-side-pipeline-dual_nodes.js`; modificare `hadoop-ecosystem-simulator.html`, `assets/js/hadoop-ecosystem-simulator.js`, `index.html`, `README.md`, documentazione che li cita.

**Interfaces:** conservare gli URL attivi del task 1. Non cancellare le due pagine root standalone senza dimostrarne l'equivalenza semantica.

- [ ] Cercare con `rg` riferimenti testuali, import, script e collegamenti a ciascun candidato. Confrontare gli archivi per contenuti didattici unici prima della rimozione; annotare eventuali eccezioni nel contratto.
- [ ] Eliminare cartella e script sostituito; rimuovere `vis-timeline` JS/CSS e selettori esclusivamente inutilizzati. Non rimuovere CSS condiviso sulla sola base del prefisso.
- [ ] Correggere homepage, README e titolo: niente promessa di Gantt o localStorage assenti; esplicitare il livello semplificato della vista cluster senza aggiungere shuffle/reduce fittizi.
- [ ] Eseguire smoke test delle pagine conservate, controllare tutti i link della homepage e `git diff --check`. Commit della pulizia, senza refactoring funzionale.

## Task 4: build statica riproducibile prima di introdurre XState

**Files:** creare `scripts/build.mjs`, `tests/build.spec.js`; modificare `package.json`, lockfile, `.gitignore`, HTML di ingresso, `assets/js/hadoop-ecosystem-simulator.js`, `playwright.config.js`; eliminare `assets/js/hadoop-sim/bridge.js` quando non più referenziato.

**Interfaces:** `npm run build` produce `dist/` completo; `npm run preview` serve `dist/` via HTTP; `npm test` usa build/preview. `node scripts/build.mjs` usa esbuild e `node:fs`, senza plugin o framework di build aggiuntivi.

- [ ] Aggiungere test browser di apertura diretta per gli URL preservati, con richieste esterne bloccate, e un'esecuzione sotto `/hadoopSim/`. Verificare assenza di pageerror e di asset mancanti. Fallimento atteso iniziale: CDN e output non presenti.
- [ ] Installare versioni stabili esatte di esbuild, React/ReactDOM compatibili con la major già usata e XState v5 stabile per i task successivi. Registrare versioni e licenze; non adottare una major alpha.
- [ ] Il build copia gli HTML root conservati e gli asset necessari, compila entry point ESM e JSX con bundle locali sotto `dist/assets/js/`. Usare URL relativi. Pulire esclusivamente `dist/`; preservare pagine standalone con script inline.
- [ ] Sostituire caricamento React/Babel via CDN con import locali compilati; importare `createSimulation` direttamente. Eliminare bridge globale, polling di disponibilità e Babel runtime con i rispettivi chiamanti.
- [ ] Documentare che i sorgenti ora richiedono build per l'uso browser; la distribuzione resta una cartella statica servibile con Python. Non modificare ancora il deploy Pages della root senza aver pronto il task 9.
- [ ] Eseguire `npm run build`, `npm test`, `npm run test:unit`; aprire l'output nel browser e ripetere la verifica con rete esterna bloccata. Commit.

## Task 5: animazioni cancellabili e lifecycle della vista guidata

**Files:** creare `assets/js/pipeline-teaching/playback-machine.js`, `tests/unit/pipeline-teaching/playback.test.js`; modificare `engine-step.js`, `index.js`, `dom-helpers.js`, `assets/js/pipeline-dual-nodes/dom/{animations,records,reset}.js`, `hadoopsim-teaching.html`, `tests/teaching_pipeline.spec.js`.

**Interfaces:** nuova factory `createPlayback({ next, reset, clock })` con `send(event)`, `subscribe(listener)`, `stop()`. Eventi `NEXT`, `PLAY`, `PAUSE`, `RESET`. `next({ signal }): Promise<{ done: boolean }>` esegue un solo passo guidato; `reset(): void` ripristina modello e UI. Stati `ready`, `executing`, `completed`, `error`; intenzione play/pausa nel contesto. `wait(ms, signal?)` e `flyRecord(sourceId, targetId, record, duration, signal?)` interrompibili con cleanup.

- [ ] Scrivere test con promessa controllata: NEXT, RESET, risoluzione della vecchia promessa. Assertion: indice 0, nessun callback di completamento vecchio, nessun avanzamento della nuova sessione.
- [ ] Aggiungere casi doppio NEXT (un passo), PAUSE durante un passo (termina quel passo e non il successivo), RESET seguito da PLAY, errore del renderer (errore visibile, controlli recuperabili).
- [ ] Eseguire `node --test tests/unit/pipeline-teaching/playback.test.js` e confermare le regressioni prima della modifica.
- [ ] Implementare macchina XState e attività invocata con AbortSignal. Propagare cancellazione a ogni attesa e side effect; non presumere che fermare l'attore annulli automaticamente una Promise JavaScript.
- [ ] Collegare la API UI esistente alla macchina; rimuovere flag e avanzamenti concorrenti sostituiti. Aggiungere play/pausa solo alla vista che li utilizza. Cleanup di record volanti, sweep e timeout di rendering.
- [ ] Eseguire test unitari, `npm test -- tests/teaching_pipeline.spec.js`, verifica manuale reset in ogni fase e console. Commit. Questa è la prima verifica concreta dell'utilità di XState, prima di migrare il cluster.

## Task 6: separare il modello dei passi guidati dal DOM

**Files:** creare `assets/js/pipeline-teaching/model.js`, `tests/unit/pipeline-teaching/model.test.js`; modificare `engine-step.js`, `dom-helpers.js`; riusare `assets/js/pipeline-dual-nodes/{state,combiner}.js` solo per regole equivalenti.

**Interfaces:** `createTeachingModel({ dataA, dataB, splitSize })` restituisce `getState()`, `getStepInfo()`, `advance()`, `reset()`. `advance()` restituisce `{ step, before, after, done }`, con snapshot stabili senza riferimenti mutabili condivisi col rendering. I tipi di passo rimangono quelli didattici di `STEP_TYPES`; non definirli come eventi universali per tutte le viste.

- [ ] Aggiungere test senza `document` per dati vuoti, chiavi ripetute, split più piccolo e più grande del buffer, spill di fine split. Contare indipendentemente le chiavi di input e confrontarle con output per partizione.
- [ ] Verificare che la somma dei record rappresentati sia conservata e che il numero di spill derivi dai confini degli split, non soltanto dal totale dei record. Attese e animazioni non entrano nei test del modello.
- [ ] Estrarre calcoli e costruzione dei passi dall'engine esistente. Riutilizzare `combine`, `sortByPartitionThenKey`, `aggregateByKey`; non creare copie né cambiare l'unità di spiegazione della vista.
- [ ] Adattare `next({signal})` del task 5: avanzare il modello una volta, animare il risultato, notificare soltanto se la sessione è ancora attiva. DOM opzionale per il calcolo; non silenziare elementi mancanti obbligatori per la UI.
- [ ] Eseguire `node --test tests/unit/pipeline-teaching/*.test.js` e test browser guidato; confronto visivo con il contratto del task 1. Commit.

## Task 7: lifecycle della pipeline automatica preservandone la concorrenza

**Files:** creare `assets/js/pipeline-dual-nodes/run-machine.js`; modificare `engine.js`, `index.js`, `phases/{mapper,spill,merge,shuffle,reduce,output}.js`, `dom/reset.js`; test `tests/unit/pipeline-dual-nodes/{engine,phases}.test.js`, `tests/map_side_pipeline.spec.js`.

**Interfaces:** conservare `createSimulation()` con `run`, `stop`, `reset`, `getState`, `updateSplitSize`; aggiungere `pause`/`resume` solo se collegati a controlli. Ogni fase riceve il segnale della propria esecuzione. La macchina governa le fasi proprie della vista, non chiama il modello dei passi guidati.

- [ ] Testare run-reset-run con attese controllate e verificare un solo conteggio per record. Verificare mapper simultaneamente in attività e shuffle con contributi da entrambi.
- [ ] Testare l'elaborazione senza fill element: i risultati del modello restano corretti, anche se il rendering viene saltato. Confrontare le due pipeline solo su risultati e invarianti comuni a parità di regole, non su tracce o numero di passi.
- [ ] Migrare il lifecycle a XState, preservare i gruppi concorrenti e separare trasformazioni da aggiornamenti DOM nelle fasi. Eliminare il vecchio controllo `running` dove sostituito; nessun doppio orchestratore.
- [ ] Propagare cancellazione alle attività del task 5. Pausa al confine di fase/operazione definito nel contratto della vista, senza interrompere arbitrariamente metà aggregazione.
- [ ] Eseguire unit test pipeline e smoke test; verifica manuale automatica/guidata affiancata per accertare che mantengano il loro diverso valore didattico. Commit.

## Task 8: correggere il dominio del cluster e il lifecycle dei job

**Files:** nuovo `assets/js/hadoop-sim/job-machine.js`; modificare `config.js`, `state.js`, `hdfs.js`, `yarn.js`, `mapreduce.js`, `simulation.js`, `index.js` nella stessa directory; tutti e quattro gli adattatori UI del cluster. Test: `tests/unit/{hdfs/hdfs,yarn/yarn,mapreduce/mapreduce,integration/simulation,core/state}.test.js`, smoke test cluster.

**Interfaces:** preservare `createSimulation(config, deps)`, `state`, `actions`, `on/off`. `actions.reset()` arresta tutti i job prima di ricreare lo stato. Aggiungere `dispose(): void` per teardown UI. `runJob({fileName})` conserva il job restituito, con status `queued|running|completed|failed` e `failureReason` opzionale. Evento nuovo `mapreduce:failed` con `{job, reason}` quando un job esistente fallisce; conservare il caso senza file e adattare tutti i listener.

Questo blocco comprende quattro consegne sequenziali, con verifica e revisione
separate: **8A** validazione e file vuoti; **8B** disponibilità dati e fallimenti;
**8C** ammissione FIFO e mapper progressivi; **8D** lifecycle XState, reset e
adattatori. Le regressioni sotto sono assegnate alla consegna proprietaria e
devono fallire prima della sua modifica e passare prima del relativo commit.
Non attendere la fine dell'intero blocco per verificare il lavoro.

- [ ] Scrivere regressioni dell'audit: job nuovo al 93.75% dopo reset conserva i suoi container; blocco perso non viene elaborato; mapper fallito non è escluso dal successo; guasto solo AM termina il job; coda riparte quando si libera capacità.
- [ ] Testare un cluster con CPU totale 3 e mapper da 2 CPU, AM da 1, file di tre blocchi: tutti i mapper devono completare in sequenza. Richieste singolarmente impossibili devono fallire senza trattenere AM o occupare la coda.
- [ ] Definire validazione atomica: size finita >=0; file vuoto ammesso con zero blocchi e job completato senza allocazioni. CPU richieste intere >0, memoria >0, capacità positive finite, replica/block size/split size interi >0 dove applicabile; id nodo univoci. Input non valido: `RangeError` prima di contatori/allocazioni; UI mostra errore comprensibile.
- [ ] Testare richieste invalide, file inesistente esplicitamente richiesto (nessun fallback al primo), seed 0 e reset ripetibile. Se `deps.rng` è iniettato dal chiamante, documentare che il reset del suo stato compete al chiamante; il seed gestito dalla simulazione riparte al reset.
- [ ] Implementare controlli HDFS e invarianti di risorse. Implementare job-machine per lifecycle e tentativi, mantenendo record serializzabili nello stato; conservare actor reference privatamente nel motore, senza classi/actor dentro `state`.
- [ ] Implementare FIFO di ammissione MapReduce e avvio progressivo dei mapper. La richiesta AM parte solo quando esiste capacità per almeno un mapper dopo la sua allocazione; evitare AM che bloccano tutta la capacità. Rivalutare su rilascio e guasto senza ricorsione di drain. YARN semplice conserva la propria semantica: non dichiarare fairness globale tra i due scheduler.
- [ ] Retry mapper: soltanto con replica attiva; attesa se manca temporaneamente capacità, fallimento se manca il dato. Guasto AM: fail esplicito, rilascio atomico e stop attività. Job completo solo quando tutti i task richiesti sono completi. Nessun nuovo modello di shuffle/reduce nel cluster aggregato.
- [ ] Reset/dispose cancellano timer di progressione e side effect degli adattatori, inclusi completamenti YARN, re-replication ritardata e notifiche. Cleanup React allo smontaggio. Gli adattatori derivano progress e stato dal core e gestiscono anche l'evento failed.
- [ ] Eseguire `npm run test:unit` e tutti gli smoke test cluster; riprodurre manualmente guasto recuperabile, perdita dati, guasto AM e reset. Commit separabili per validazione, dominio e integrazione, ciascuno con la propria verifica.

## Task 9: verifica della lezione e pubblicazione protetta su Pages

**Files:** `.github/workflows/pages.yml`, `playwright.config.js`, `README.md`, `AGENTS.md`, `docs/architecture.md`, `docs/domain-model.md`, `docs/teaching-contracts.md`, HTML/UI per le sole spiegazioni e controlli modificati; creare `tests/lesson.spec.js`.

**Interfaces:** workflow `npm ci` → lint/format/unit → build → browser test di `dist/` → upload `dist/` → deploy. Pull request eseguono i controlli; deploy soltanto su main o dispatch autorizzato. Permessi Pages soltanto al job deploy.

- [ ] Test browser della lezione: upload, avanzamento, pausa dove prevista, reset durante animazione, nuova esecuzione, guasto recuperabile, perdita dati e job accodato che riparte. Registrare separatamente scenari per ogni granularità.
- [ ] Testare tutti gli URL conservati sotto un prefisso di progetto con rete esterna bloccata. Garantire avvio diretto delle pagine e assenza di pageerror, React warning e richieste asset fallite.
- [ ] Aggiornare workflow a una versione Node supportata fissata e allineata con ambiente locale; installare browser Playwright in CI. Configurare preview del task 4 senza riusare server estranei in CI. Pubblicare solo se tutti i controlli precedenti passano.
- [ ] Aggiornare README e istruzioni di sviluppo ai comandi build/preview, documentare semplificazioni AM/FIFO/mapper e differenze delle viste. Non descrivere come simulate le funzionalità soltanto illustrate.
- [ ] Verifica manuale Chromium e Safari se disponibile; viewport da proiezione e portatile, tastiera, notifiche accessibili e reduced-motion per controlli/animazioni toccati. Annotare espressamente browser non disponibili.
- [ ] Eseguire `npm run lint`, `npm run format:check`, `npm run test:unit`, `npm run build`, `npm test`, `git diff --check`. Tutti devono riuscire; conservare screenshot e trace dei casi significativi.
- [ ] Preparare commit/PR con comportamento, accounting risorse, verifiche e rischi. Il deploy reale si verifica dopo l'integrazione autorizzata, non si dichiara riuscito sulla sola build locale.

## Copertura dei findings e consegna

| Audit                                           | Task          |
| ----------------------------------------------- | ------------- |
| 1 timer/reset cluster                           | 8             |
| 2 blocchi persi, 3 mapper falliti, 4 AM, 5 coda | 8             |
| 6 reset animazioni                              | 5, 7          |
| 7 clock, 8 CONFIG, 10 fixture/seed              | 2             |
| 9 validazione                                   | 8             |
| 11 CI/test discovery                            | 2, 9          |
| 12 DOM/dominio                                  | 6, 7          |
| 13 script morto, 14 vis-timeline/documentazione | 3, 9          |
| old_stuff                                       | 3             |
| XState                                          | 5, 7, 8       |
| Build/GitHub Pages                              | 4, 9          |
| Differenze didattiche/granularità               | 1, 6, 7, 8, 9 |

Self-review: tutte le aree approvate hanno task e criterio di verifica; i tre
modelli di esecuzione non dipendono da una falsa identità dei passi. Resta da
misurare in implementazione la corrispondenza tra API XState della versione
fissata e i test temporali. Se il primo lifecycle del task 5 non riduce i
problemi senza duplicare l'orchestrazione, rivedere quel confine prima di
estendere la migrazione; non introdurre un secondo motore in parallelo.

Esecuzione consigliata: sequenziale nella stessa sessione, con revisione finale
indipendente, perché modello, animazioni e adattatori condividono molti file.
In alternativa task affidati ad agenti con revisione tra un task e l'altro;
non modificare le stesse aree in parallelo.
