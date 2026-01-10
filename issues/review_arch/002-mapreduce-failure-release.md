# Issue: MapReduce fallito non libera risorse e non mostra stato corretto

Status: Resolved in working tree (verifica manuale richiesta)
Severity: High
Apps: hadoop_full.html

## Worklog
- 2025-02-14: aggiunta cleanup risorse MapReduce e label di stato fallito. Ref: `hadoop_full.html:1495-1516`, `hadoop_full.html:1069-1077`, `hadoop_full.html:1598-1605`, `hadoop_full.html:1867-1879`.

## Evidenza
- `hadoop_full.html:1495-1516` funzione `releaseMapReduceResources` per liberare mapper/AM.
- `hadoop_full.html:1598-1605` fallimento per blocco mancante usa la cleanup.
- `hadoop_full.html:1867-1879` fallimento per AM non riallocato libera risorse.
- `hadoop_full.html:1069-1077` etichetta di stato include "Failed".

## Impatto
Senza cleanup, CPU/memoria restano occupate e i contatori diventano incoerenti; lo stato UI mostra "Completed" anche se il job fallisce.

## Piano di lavoro
1. Avviare MapReduce con file caricato.
2. Forzare un failure: simulare failure di nodi fino a perdere il blocco oppure rendere impossibile riallocare l AM.
3. Verificare che le risorse tornino disponibili e che lo stato mostri "Failed".
4. Controllare che non rimangano container AM/mapper in `node.containers`.

## Criteri di chiusura
- Risorse liberate e contatori corretti dopo failure; UI mostra stato "Failed".
