# Trasferimento persone tra RI

La pagina **Import/Export** permette di selezionare una o piu persone, anche
su pagine diverse e includendo gli archiviati, e scaricare `myri-transfer.json`.
Il destinatario seleziona il file nella stessa pagina della propria installazione
e conferma l'importazione.

Il formato `myri-transfer`, versione 1, contiene anagrafica, contatti, progetti,
storico RAL, richieste di aumento, career talk e task, incluse voci archiviate,
stati, date e benefit (distinguendo null, No e zero). Gli ID vengono rigenerati
localmente e i collegamenti interni rimappati, incluse RAL generate e ricorrenze.
Gli importi e gli ID sono stringhe JSON per non perdere precisione.
Le date storiche vengono conservate; le versioni di concorrenza sono nuove e locali.
Le vecchie anagrafiche possono mantenere i campi legacy null, senza inventare dati.

Prima di ogni persona viene verificato se **RSNO Agresso oppure MyPad ID**
e gia presente nel database, anche tra le persone archiviate o importate poco
prima nello stesso file. Il confronto usa la collation MySQL esistente,
case/accent insensitive. Basta la corrispondenza di uno dei due codici per saltare
l'intera persona e tutti i suoi dati, senza aggiornare nulla. I null non sono
identificativi. Il riepilogo mostra importate, saltate e motivo per ID origine.
Un conflitto sul distinto Inside ID e un errore, non un criterio di salto.

I manager interni importati insieme sono ricollegati. Se il manager non e incluso
o viene saltato, resta il suo nome come riferimento esterno: nessun ID del file
viene interpretato come ID locale. Non vengono creati manager implicitamente.
Notifiche, account, sessioni e audit del RI originario non vengono trasferiti;
l'audit locale registra le nuove voci finanziarie nella stessa transazione.
Il normale scheduler potra generare notifiche locali per i dati importati.

File incompatibili, dati non validi, riferimenti mancanti/ciclici o altri conflitti
annullano **l'intero import**, senza persistenza parziale. Le persone duplicate
sono invece saltate senza validarne o importarne il dettaglio.
Importazioni e normali scritture anagrafiche condividono il lock monoutente.
Limiti: 100 persone, 1000 record per persona in export, 10000 record complessivi
e 10 MiB per file; nessun troncamento. Ridurre la selezione se si superano i limiti.
Gli export JSON/CSV dalla scheda persona restano invariati e non sono il formato
di trasferimento accettato dalla nuova pagina.

API autenticate e protette da CSRF:

- `POST /api/v1/transfers/export`, body `{"personIds":["123","456"]}`,
  restituisce il file JSON con `Cache-Control: no-store`.
- `POST /api/v1/transfers/import`, body JSON originale del file,
  restituisce `{ imported, skipped, results }`; ogni risultato contiene
  `sourceId`, `personId` locale (solo se importata), `status` e `reason`.

Il file contiene dati personali, note e retribuzioni **in chiaro**: non inserirlo
in repository, log o ticket. Trasferirlo solo tramite un canale protetto e
conservarlo con permessi privati; cancellare le copie quando non servono piu.
Non e un backup completo ne un trasferimento automatico verso servizi esterni.

Le utility di pulizia sono separate in
[`scripts/sql-utilities`](../scripts/sql-utilities/README.md), limitate a dati
fittizi dev/test. Non autorizzano cancellazioni fisiche di dati reali.
