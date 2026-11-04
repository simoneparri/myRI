# myRI frontend

Angular **21 LTS**, Material 21, standalone, TypeScript strict e signals.
Versioni esatte nel lockfile: Angular core 21.2.25, Material 21.2.14, CLI 21.2.29.
Node **24.x**, npm 11.19.1. La tabella ufficiale consultata il 2 novembre 2026
classifica 21 come ultima LTS e 22 come Active:
https://angular.dev/reference/releases.

## Avvio

Il percorso consigliato e `docker compose up --build -d` dalla radice dopo
configurazione privata di `.env`. Aprire http://127.0.0.1:8080
(oppure `FRONTEND_PORT`). Non sono richiesti Node o Java sull'host.

Per sviluppo con Node 24:

```sh
npm ci
npm start
npm test -- --watch=false
npm run build
```

Il dev server usa il proxy same-origin di `proxy.conf.json` verso un backend
di sviluppo su 127.0.0.1:8080; il compose non pubblica il backend. Per lavorare
contro lo stack completo usare la build nginx, senza aggiungere porte DB/API.
Il file `public/config.json` configura il fuso del solo dev server.
In Docker viene generato da `APP_TIMEZONE`, condiviso con il backend.

## Funzioni e contratti

- Login, logout e sessione server HttpOnly; token CSRF solo in memoria.
  Nessun token o dato personale in localStorage/sessionStorage, log o telemetria.
- Persone e scheda con data di assunzione e data di inizio carriera distinte,
  ciascuna con durata calcolata in anni e mesi tra parentesi; livello di seniority
  Junior/Medior/Senior selezionabile manualmente,
  sede di assunzione e residenza; timeline, contatti e RAL append-only con tipo
  contratto, ore settimanali e livello storicizzati per ogni voce; richieste con
  transizioni esplicite, career talk e task con riferimenti/ricorrenza.
  La lista persone apre la Scheda: tutte le informazioni del precedente dettaglio
  sono visibili nella pagina, da cui si puo modificare la persona non archiviata.
  Le azioni di lista, scheda e dialog hanno icone SVG locali decorative e label
  testuali accessibili, senza font o richieste a servizi esterni.
  Il censimento richiede un MyPad ID univoco (1-100 lettere ASCII/numeri,
  underscore o trattino), separato dall'ID tecnico myRI non mostrato in anagrafica.
  Il valore apre `https://mypad.altengroup.com/employees/{mypad-id}` in una
  nuova scheda con `noopener noreferrer`; nessun accesso al servizio al caricamento.
  I record esistenti mantengono la data gia salvata come assunzione; inizio
  carriera, livello e MyPad ID restano non specificati fino alla compilazione.
  Un MyPad ID assegnato non puo essere svuotato; puo essere corretto senza
  cambiare la PK myRI. L'inizio carriera non puo essere successivo all'assunzione.
- Dashboard con conteggi e persone senza career talk recente; notifiche storiche
  leggibili/archiviabili e dettaglio del task collegato.
- Viste Task oggi/scaduti/prossimi 7 giorni/tutti aperti, anche per persona.
  I preset non applicano i filtri della gestione completa nascosti.
- Andamento RAL cronologico nella scheda persona, importi precisi e valute
  invariate, badge futuro secondo APP_TIMEZONE.
- Download JSON/CSV esplicito dalla scheda, incluse voci archiviate; massimo
  1000 record complessivi, con errore visibile senza troncamenti. Il file
  scaricato contiene dati personali e va protetto. I pulsanti sono sotto le tab
  e la paginazione, a fine contenuto della scheda.
- Ricerca, filtri, archiviati, paginazione server-side, dettaglio e form validati.
  Archiviazione e comandi di chiusura richiedono conferma.
- Errori, caricamento e assenza risultati espliciti. Un conflitto mantiene
  il form: annullare, ricaricare la lista e riaprire prima di riprovare.
  Un errore di rete non ritenta automaticamente una scrittura. Per la RAL
  manuale il retry nello stesso form conserva la chiave idempotenza.
  Salvataggi, esiti e comandi completati mostrano una conferma toast Material
  in alto a destra per 4 secondi, chiudibile con "Chiudi" e annunciata agli
  screen reader. Nessun messaggio di successo persistente nel contenuto;
  errori e conflitti restano visibili nel form o nella pagina.
- ID/versioni/importi restano stringhe. Gli importi accettano il punto decimale
  e vengono presentati in formato italiano senza convertirli a Number.
- Le date civili non cambiano fuso. Gli orari sono visualizzati nel fuso
  configurato; i campi data/ora e filtri sono esplicitamente **UTC**.
  Non viene usato implicitamente il fuso del browser.
  Date visualizzate e digitate in `gg/mm/aaaa`, anche per gli istanti con anno
  a quattro cifre; per gli input data/ora aggiungere `HH:mm` (UTC).
  Editor e filtri offrono un calendario oltre alla digitazione manuale e
  rifiutano date impossibili. I valori API restano ISO e le date civili non
  vengono convertite in UTC tramite il fuso locale.
  Gli importi sono visualizzati come `45.000,00`, sempre con due decimali e
  senza conversioni floating point; percentuali e ore mantengono la precisione.
- I selettori riferimenti caricano tutte le pagine, senza troncare le persone
  alla prima pagina. I dati archiviati restano consultabili.
- La scadenza della sessione rimanda al login e chiude i dialog con dati
  precedenti. I guard UI non sostituiscono le autorizzazioni backend.

`core/` contiene HTTP/sessione; `shared/` contiene form/dettaglio riusabili,
definizioni dei campi e formatter; `features/` contiene login, liste e scheda.
Le definizioni dichiarano esplicitamente le chiavi DTO consentite, evitando
di inviare ID o timestamp tecnici copiati dalle risposte.
Le API effettive sono documentate in [../docs/api.md](../docs/api.md).

## Browser test

**Solo su un progetto Compose e database dedicati con dati fittizi.**
Gli e2e creano e modificano persone, RAL, richieste, career talk e task.
Non eseguirli contro dati personali o un'installazione in uso.
Con lo stack dedicato gia healthy:

Per il flusso scheduler Step 4 configurare `REMINDERS_INTERVAL_MS=1000` nel solo
stack fittizio (il default operativo e 60000). I test verificano anche i download
e cancellano i file scaricati dopo il controllo, senza registrarne il contenuto.

```sh
npx playwright install --with-deps chromium
E2E_BASE_URL=http://127.0.0.1:8080 \
E2E_USERNAME=<utente-fittizio> E2E_PASSWORD=<password-fittizia> npm run e2e
```

In alternativa usare l'immagine ufficiale Playwright della stessa versione del
lockfile (attualmente `mcr.microsoft.com/playwright:v1.64.1-noble`), montando
questa directory e raggiungendo il frontend. Non sono salvati trace, screenshot
o video che potrebbero contenere dati; credenziali obbligatorie dall'ambiente.
Gli unit/component test usano Vitest e jsdom, senza MySQL o browser installati.
`e2e/people-sheet.spec.ts` usa soltanto API simulate con dati fittizi e verifica
lista, scheda, modifica, icone e calendario su desktop/mobile, oltre ai filtri
data/ora e ai payload UTC: si puo eseguire senza database
o credenziali con `E2E_BASE_URL=http://127.0.0.1:4200 npx playwright test e2e/people-sheet.spec.ts`
contro il dev server.

## Consegna e limiti

Review/hardening Step 5 e limiti accettati sono in [guida operativa](../docs/operations.md).
La data esito predefinita usa APP_TIMEZONE, non il giorno UTC del browser.
La timeline e paginata e filtrabile per tipo; per leggere
il dettaglio completo o modificarlo usare la scheda nella relativa tab.
La UI non offre cancellazione fisica o modifica di RAL storiche.
