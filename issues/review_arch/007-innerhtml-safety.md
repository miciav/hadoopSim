# Issue: Uso esteso di innerHTML con interpolazioni (rischio XSS futuro)

Status: Open
Severity: Low
Apps: hdfs_interactive.html, yarn_interactive.html, hadoop_full.html

## Worklog
- 2025-02-14: issue accettata in backlog; nessuna modifica applicata ancora.

## Evidenza
- `hdfs_interactive.html:653-705` e `hdfs_interactive.html:723-752` rendono markup con `innerHTML`.
- `yarn_interactive.html:605-666` e `yarn_interactive.html:689-705` rendono markup con `innerHTML`.
- `hadoop_full.html:706-818`, `hadoop_full.html:1025-1039`, `hadoop_full.html:1058-1082` rendono markup con `innerHTML`.

## Impatto
Oggi i dati sono interni, ma se in futuro arrivano input esterni o querystring, si apre un vettore XSS.

## Piano di lavoro
1. Identificare le sezioni che possono ricevere input esterno ora o in futuro.
2. Sostituire `innerHTML` con `createElement` + `textContent` per i campi testo.
3. Usare `DocumentFragment` per liste lunghe per non perdere performance.
4. Lasciare `innerHTML` solo per stringhe statiche non interpolate.
5. Verificare visivamente che il layout resti identico.

## Criteri di chiusura
- Nessuna interpolazione non fidata in `innerHTML`.
- Rendering invariato per tutti i pannelli principali.
