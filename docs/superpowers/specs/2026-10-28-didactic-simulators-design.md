# Simulatori Hadoop per la didattica — design

## Scopo e provenienza

Consolidare i simulatori per l'uso durante le lezioni: correttezza concettuale,
reset affidabile, risultati ripetibili e pubblicazione automatica su GitHub Pages.
Questo documento registra la proposta discussa in conversazione. Il vincolo
esplicito aggiunto dall'utente è prioritario: le sezioni rappresentano fenomeni
diversi, anche a granularità diverse. Non uniformarne artificialmente i modelli.

## Approcci

- Correggere soltanto il runtime esistente: meno migrazione, ma lifecycle e
  cancellazione restano implementati localmente.
- XState per governare lifecycle e transizioni: approccio proposto e base del
  piano. Regole Hadoop e contenuti didattici rimangono nel progetto.
- Motore a eventi discreti come SimScript: utile per studi quantitativi su
  carichi e scheduling; fuori dallo scopo didattico attuale.

Usare una release stabile di XState, fissata esattamente all'implementazione.
Non introdurre SimScript, un backend, servizi cloud o attori per ogni record.

## Confini didattici

Le sei viste della homepage restano disponibili agli stessi URL. La tabella è
un inventario iniziale da verificare contro il comportamento delle pagine:

| Vista               | Oggetto spiegato                             | Unità osservate                           |
| ------------------- | -------------------------------------------- | ----------------------------------------- |
| Ecosystem           | Relazione tra file, nodi e job               | Blocchi, container, avanzamento aggregato |
| Hadoop full         | Allocazione congiunta di storage e calcolo   | Nodi, risorse, allocazioni e locality     |
| HDFS                | Placement, repliche e disponibilità dei dati | File, blocchi, repliche                   |
| YARN                | Contesa e rilascio delle risorse             | Richieste, container e coda               |
| Pipeline automatica | Flusso concorrente fra mapper e reducer      | Record, buffer, spill, partizioni         |
| Pipeline guidata    | Spiegazione controllata delle operazioni     | Passi didattici e gruppi di record        |

Prima di migrare una vista, documentare ciò che simula, omette e aggrega.
Un passo guidato non deve corrispondere necessariamente a un tick o a un evento
della vista automatica. Conservare il parallelismo osservabile della pipeline.
Condividere calcoli solo quando gli input, gli output e le regole coincidono.
Non imporre un controller universale o un unico modello di dominio.

## Invarianti e comportamento

- Reset termina la sessione precedente, incluse animazioni, timer di recupero,
  notifiche e callback che potrebbero modificare la nuova sessione.
- La pausa della pipeline si applica alla fine del passo significativo corrente;
  reset è immediato. Non aggiungere pause a tutte le viste per uniformità.
- Velocità e presenza del DOM non cambiano risultati e conteggi.
- Stessi input, seed e interventi agli stessi punti logici producono gli stessi
  esiti per una data vista; non richiedere tracce identiche tra viste diverse.
- Nessun job termina con successo se un task richiesto non è riuscito o se
  l'input necessario non ha repliche accessibili.
- Nel modello iniziale il guasto dell'ApplicationMaster fa fallire il job;
  la mancata simulazione del suo riavvio viene dichiarata nella spiegazione.
- Risorse sempre entro i limiti; richieste impossibili e valori invalidi non
  possono creare stati parziali o code eterne.
- FIFO per l'ammissione dei job MapReduce; mapper avviati progressivamente
  quando le risorse lo consentono. Nessuna promessa di Hadoop Fair Scheduler.
- Le viste aggregate non devono dichiarare di simulare shuffle/reduce o
  misurazioni temporali realistiche se rappresentano soltanto i mapper.

## Repository e pubblicazione

Rimuovere `old_stuff/` dopo aver verificato riferimenti e materiali unici;
le versioni precedenti rimangono nella cronologia Git. Rimuovere lo script
monolitico sostituito e vis-timeline inutilizzata. Conservare le altre pagine
root finché una verifica semantica non ne dimostri l'effettiva ridondanza.

GitHub Pages resta l'hosting. Una build include localmente le dipendenze e
precompila JSX; pubblica soltanto `dist/`, con URL e percorsi relativi validi
anche sotto il nome del repository. La stessa cartella si può servire con HTTP
in locale. Nessun service worker o supporto automatico offline richiesto.

## Verifica e limiti

Node test per il dominio, Playwright per interazioni e animazioni, ESLint e
Prettier configurati esplicitamente. CI deve verificare l'output realmente
pubblicato. Verifica manuale browser dopo modifiche alle viste, con console.
Semplificazioni didattiche esplicite; niente riscrittura grafica, nuove politiche
Hadoop o Gantt aggiunto per rendere vera una descrizione obsoleta.
