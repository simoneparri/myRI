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
- Persone e scheda con timeline, contatti, RAL append-only, richieste con
  transizioni esplicite, career talk e task con riferimenti/ricorrenza.
- Dashboard con conteggi e persone senza career talk recente; notifiche storiche
  leggibili/archiviabili e dettaglio del task collegato.
- Viste Task oggi/scaduti/prossimi 7 giorni/tutti aperti, anche per persona.
  I preset non applicano i filtri della gestione completa nascosti.
- Andamento RAL cronologico nella scheda persona, importi precisi e valute
  invariate, badge futuro secondo APP_TIMEZONE.
- Download JSON/CSV esplicito dalla scheda, incluse voci archiviate; massimo
  1000 record complessivi, con errore visibile senza troncamenti. Il file
  scaricato contiene dati personali e va protetto.
- Ricerca, filtri, archiviati, paginazione server-side, dettaglio e form validati.
  Archiviazione e comandi di chiusura richiedono conferma.
- Errori, caricamento e assenza risultati espliciti. Un conflitto mantiene
  il form: annullare, ricaricare la lista e riaprire prima di riprovare.
  Un errore di rete non ritenta automaticamente una scrittura. Per la RAL
  manuale il retry nello stesso form conserva la chiave idempotenza.
- ID/versioni/importi restano stringhe. Gli importi accettano il punto decimale
  e vengono presentati in formato italiano senza convertirli a Number.
- Le date civili non cambiano fuso. Gli orari sono visualizzati nel fuso
  configurato; i campi data/ora e filtri sono esplicitamente **UTC**.
  Non viene usato implicitamente il fuso del browser.
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

## Consegna e limiti

Review/hardening Step 5 e limiti accettati sono in [guida operativa](../docs/operations.md).
La data esito predefinita usa APP_TIMEZONE, non il giorno UTC del browser.
La timeline e paginata e filtrabile per tipo; per leggere
il dettaglio completo o modificarlo usare la scheda nella relativa tab.
La UI non offre cancellazione fisica o modifica di RAL storiche.
