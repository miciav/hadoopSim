# Contratti didattici delle viste

Le sezioni spiegano fenomeni diversi. Un passo guidato non equivale a un tick
del cluster né a un evento della pipeline automatica. Gli URL restano invariati.

| Pagina                                     | Obiettivo e unità osservata                                                                       | Avanzamento e completamento                                                                 | Controlli e scenario di verifica                                                                                                          |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `hadoop-ecosystem-simulator.html`          | Relazione fra HDFS, nodi e job: blocchi, container e mapper                                       | Progresso aggregato dei mapper; completato solo quando tutti riescono                       | Upload 256/512/1024 MB, esecuzione per file, guasto e reset; verificare che file/job/notifiche siano cancellati dal reset                 |
| `hadoop_full.html`                         | Storage e calcolo insieme: locality, CPU e memoria                                                | Mapper in ondate; AM e container rilasciati a termine/fallimento                            | Upload piccolo/grande, job YARN semplice/distribuito, MapReduce, guasto e reset; verificare coda, recupero con replica, perdita dati e AM |
| `hdfs_interactive.html`                    | Placement, repliche e disponibilità                                                               | Un upload crea blocchi; guasto e ri-replicazione aggiornano il placement                    | Upload piccolo/grande, guasto, reset; verificare repliche distinte, capacità e cancellazione del recupero ritardato                       |
| `yarn_interactive.html`                    | Contesa fra richieste di CPU/memoria                                                              | Container allocati o in coda; rilascio abilita nuove allocazioni                            | Job semplice/distribuito e reset; saturare risorse, liberarle e verificare svuotamento della coda                                         |
| `hadoop-map-side-pipeline-dual_nodes.html` | Flusso concorrente fra due mapper e tre reducer: record, spill e partizioni                       | Run automatico fino ai file di output, mapper e trasferimenti sovrapposti                   | Deploy, reset, velocità, modalità didattica e split; reset durante map/shuffle/folding e nuova esecuzione                                 |
| `hadoopsim-teaching.html`                  | Spiegazione controllata: gruppi di record e operazioni                                            | Next avanza un passo; Play ripete; Pause termina il passo corrente; Reset interrompe subito | Next, Play/Pause, Reset e split; provare ogni fase, doppio Next e riavvio immediato                                                       |
| `hadoop-map-side-pipeline.html`            | Narrazione standalone di un mapper: buffer circolare, due spill, merge e distribuzione ai reducer | Sequenza visuale predefinita, distinta dai modelli modulari                                 | Start/Pause/Reset e velocità; apertura diretta conservata                                                                                 |
| `hadoop-map-side-pipeline-dual.html`       | Narrazione standalone con due mapper e buffer distinti                                            | Sequenza visuale predefinita; non coincide con i passi guidati modulari                     | Start/Pause/Reset e velocità; apertura diretta conservata                                                                                 |

## Limiti da esplicitare in aula

Le viste cluster non simulano shuffle/reduce, Gantt o tempi Hadoop realistici.
Il guasto AM termina il job: il suo riavvio non è modellato. FIFO riguarda
l'ammissione MapReduce, non una fairness globale fra scheduler. YARN distingue
risorse temporaneamente occupate da richieste che nessun nodo attivo può soddisfare.

Le pipeline modulari condividono soltanto regole equivalenti, fra cui
ordinamento, combinazione e merge. Il modello guidato è puro; le fasi automatiche
mantengono la propria orchestrazione concorrente e possono calcolare senza DOM.
Velocità e jitter sono espedienti grafici, non misure di prestazioni o contesa reale.
Le standalone conservate non sono state migrate a XState e non ricevono le
stesse garanzie di lifecycle delle due pipeline modulari.

## Dataset e risultato verificato

Le due pipeline modulari contengono 12 record per mapper. Il risultato per chiave,
contato indipendentemente dagli input, è `ant: 7`, `arm: 2`, `car: 5`, `cat: 1`,
`cup: 3`, `day: 3`, `dog: 2`, `dot: 1`. Le partizioni sono rispettivamente
`ant/arm → 0`, `car/cat/cup → 1`, `day/dog/dot → 2`.

La somma resta 24 qualunque sia lo split. Uno split terminato produce uno spill
anche prima della soglia del buffer; con split di 3 record ciascun mapper
produce quattro spill. Non si confrontano il numero di passi o le tracce fra
vista guidata e automatica. I test del modello coprono anche input vuoti,
mapper sbilanciati, chiavi ripetute e split inferiori/superiori al buffer.

## Archivi rimossi

`old_stuff/` e lo script monolitico non referenziato sono stati eliminati dal
sito mantenuto. La cronologia precedente a `e955ca1` resta la fonte recuperabile;
non si afferma l'equivalenza di tutti i contenuti storici.

| Varianti storiche                                                                                                                      | Contenuto / differenza individuata                                                                                                         |
| -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `hadoop-ecosystem-simulator.html`                                                                                                      | Gantt e controlli di topologia/ribilanciamento storici, assenti dalla dashboard attuale                                                    |
| `hadoop-map-side-pipeline-multi-node_v1.html`                                                                                          | Selezione di 1–5 nodi, assente nelle sei viste mantenute                                                                                   |
| `hadoop-map-side-pipeline.html`, `hadoop-map-side-pipeline-dual.html`, `hadoop-map-side-pipeline-dual_v2.html`, `hadoop-pipeline.html` | Narrazioni map-side con play/pausa o Start/Reset; le due pagine root standalone restano disponibili                                        |
| `hadoop-map-side-pipeline-dual_v3/v4/v5/v6/v8/v9/v10.html`                                                                             | Evoluzioni della pipeline a due mapper: espansione dinamica, animazioni, ghost, realismo e modalità didattica; non sono URL della homepage |
| `hadoop-map-side-pipeline-dual_nodes_v10/v11.html`                                                                                     | Evoluzioni visuali della vista cluster a nodi distinti, con modalità didattica e velocità                                                  |
| `hadoop-map-side-pipeline-dual_nodes_v7/v8.html`                                                                                       | Esportazioni Cocoa HTML Writer con sorgente rappresentato come documento, non entry point modulari                                         |

Per consultare un originale senza ripristinarlo nel sito:
`git show d9cfa1a:old_stuff/<nome-file>`.
