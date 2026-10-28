# Contratti didattici delle viste

Questo inventario distingue ciò che la pagina rappresenta dai comportamenti
che devono ancora essere corretti. L'avanzamento e i passi non hanno la stessa
unità nelle diverse viste.

| Pagina                                     | Scopo                                   | Granularità e controlli                                                       | Limiti attuali                                                            |
| ------------------------------------------ | --------------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `hadoop-ecosystem-simulator.html`          | Relazioni tra HDFS, nodi e job          | Blocchi, container e progresso dei mapper; upload, job, guasto, reset         | Non simula shuffle/reduce o Gantt nel core aggregato.                     |
| `hadoop_full.html`                         | Vista congiunta storage e calcolo       | Blocchi, risorse, container, mapper; upload, job, guasto, reset               | I job MapReduce mostrano il progresso dei mapper.                         |
| `hdfs_interactive.html`                    | Replicazione e disponibilità            | File, blocchi e repliche; upload, guasto, reset                               | Placement e capacità sono semplificati.                                   |
| `yarn_interactive.html`                    | Allocazione e attesa                    | Container, capacità e coda; job, job distribuito, reset                       | Risorse e durate sono simulate.                                           |
| `hadoop-map-side-pipeline-dual_nodes.html` | Flusso concorrente dei mapper e reducer | Record, spill, partizioni; avvio, reset, velocità, modalità didattica e split | L'animazione è attualmente accoppiata al modello.                         |
| `hadoopsim-teaching.html`                  | Spiegazione guidata della pipeline      | Gruppi di record e passi didattici; passo successivo, reset e split           | Un passo non equivale necessariamente a un evento della vista automatica. |
| `hadoop-map-side-pipeline.html`            | Pipeline map-side singola               | Sequenza narrata di passi                                                     | Pagina autonoma, da conservare fino al confronto semantico.               |
| `hadoop-map-side-pipeline-dual.html`       | Pipeline map-side a due mapper          | Sequenza narrata e buffer distinti                                            | Pagina autonoma, da conservare fino al confronto semantico.               |

I dataset predefiniti delle due pipeline modulari contengono 12 record per
mapper; il risultato atteso aggregato per chiave è `ant: 7`, `arm: 2`,
`car: 5`, `cat: 1`, `cup: 3`, `day: 3`, `dog: 2`, `dot: 1`.
Questi conteggi non impongono lo stesso numero di passi alle due viste.

## Removed historical variants

The removed `old_stuff/` directory included an older ecosystem page with a
Gantt timeline and `hadoop-map-side-pipeline-multi-node_v1.html`, which let the
user select one to five nodes. Neither capability is represented by the current
six home-page views. These historical files remain in Git history before commit
`e955ca1`; removing them from the current site does not assert that their
teaching content is equivalent to the maintained pages.
