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

### Permessi degli asset generati

Gli hook npm generano il catalogo `src/app/shared/framework-catalog-data.json`
e gli asset Devicon/intl-tel-input in `public/assets/devicon/`. Eseguire npm e
Node con l'utente proprietario della checkout, mai con `sudo`.
Il generatore rifiuta l'esecuzione come root su una checkout di un altro utente,
prima di scrivere file. La build Docker resta compatibile: lavora su copie
interne all'immagine, senza scrivere nella checkout host.

Per usare Node in un container con bind mount, passare sempre UID/GID locali
e una HOME scrivibile, anche per installazioni, test e Playwright:

```sh
docker run --rm --user "$(id -u):$(id -g)" -e HOME=/tmp \
  --mount "type=bind,src=$(pwd),dst=/workspace" -w /workspace \
  node:24-bookworm-slim npm run build
```

Il comando presuppone di trovarsi in `frontend/` con dipendenze gia installate.
Per file precedentemente creati da root, correggere una sola volta la proprieta
dei soli percorsi coinvolti, senza usare `chmod 777` o cambiare ricorsivamente
l'intero repository. I test del generatore si eseguono con
`node --test scripts/generate-framework-catalog.spec.mjs`; il caso root richiede
un container root senza bind mount scrivibili sulla checkout.

## Funzioni e contratti

- Layout dati dichiarativo: righe della scheda e dei dettagli in array di array
  TypeScript, colonne delle tabelle in array di descrittori. Gli HTML usano `@for`;
  non aggiungere ordinamenti/posizioni per campo in SCSS. La scheda mantiene i
  gruppi di righe anche su mobile, riducendo solo il numero di colonne.
  Inserire `[]` in `fieldRows` per disegnare una linea orizzontale fra i gruppi.
- Valuta non mostrata nei form, filtri, elenchi, dettagli, timeline e andamento
  RAL. La creazione RAL invia automaticamente `currency: "EUR"`; gli aumenti
  ereditano la valuta della RAL base secondo il contratto API esistente.
  Campo DB, dati storici ed export restano invariati, senza conversioni.
- Pipe `percentage` per formato italiano con due decimali: frazione `0.058`
  visualizzata come `5,80%`. Liste e dettagli degli aumenti usano esplicitamente
  la modalita `points`: DB/API e form conservano `5.8` per indicare `5,80%`,
  senza conversioni dei dati persistiti o modifiche ai calcoli.
- Login, logout e sessione server HttpOnly; token CSRF solo in memoria.
  Nessun token o dato personale in localStorage/sessionStorage, log o telemetria.
- Persone e scheda con data di assunzione e data di inizio carriera distinte,
  ciascuna con durata calcolata in anni e mesi tra parentesi; livello di seniority
  Junior/Medior/Senior selezionabile manualmente,
  sede di assunzione e residenza; timeline, contatti e RAL append-only con tipo
  contratto, ore settimanali e livello storicizzati per ogni voce; richieste con
  transizioni esplicite, career talk e task con riferimenti/ricorrenza.
  Data di nascita obbligatoria per le nuove persone, facoltativa per i record
  preesistenti senza date inventate; una data assegnata puo essere corretta ma
  non svuotata. Date future o impossibili sono rifiutate. La scheda mostra la
  data in `gg/mm/aaaa` con l'eta in anni compiuti tra parentesi, calcolata nel
  fuso applicativo e non salvata come valore statico. Per il 29 febbraio,
  negli anni non bisestili l'anno si completa il 1 marzo.
  Su desktop la seconda riga mostra data di nascita ed educazione, in questo
  ordine. Seguono ruolo/seniority/framework e poi assunzione e inizio lavoro.
  RSNO Agresso e Inside ID sono codici testuali univoci (massimo 100 caratteri,
  zeri iniziali preservati, unicita anche sulle persone archiviate).
  Educazione e un menu a scelta singola: Diploma, Laurea breve, Laurea magistrale,
  PhD. Tutti e tre obbligatori per i nuovi censimenti; restano sconosciuti sui
  record legacy fino alla compilazione e non sono svuotabili una volta assegnati.
  RSNO Agresso e il primo campo della scheda, seguito da email e telefono;
  Inside ID e MyPad ID non compaiono fra i dati della scheda, ma restano nei
  form e negli export. Educazione e visibile nella scheda. La migrazione V11
  non inventa valori per i record esistenti.
  La tab Contatti mostra la data di contatto (`gg/mm/aaaa`), obbligatoria per i
  nuovi inserimenti e non svuotabile dopo l'assegnazione. Le righe sono ordinate
  dal backend per data decrescente anche tra pagine; i contatti legacy senza data
  restano modificabili e sono mostrati in fondo, senza date inventate.
  I framework conosciuti si selezionano da un catalogo Devicon multiplo e
  ricercabile nel pannello; i valori storici fuori catalogo restano selezionati.
  Le icone Devicon bianche sono rese nere, mentre gli altri colori restano
  invariati. Sono mostrati accanto al ruolo nella lista persone e nella scheda.
  Il campo telefono offre selezione paese con Italia predefinita e salva i
  numeri validi in E.164; numeri legacy non validi restano invariati durante
  la modifica finche non viene inserito un numero valido.
  Nei dialog l'etichetta del telefono resta sopra il campo, separata dal
  selettore paese; lo spazio superiore del form preserva l'etichetta del primo
  input anche quando riceve automaticamente il focus.
  Manager interno/esterno non sono piu mostrati o modificabili; gli eventuali
  valori legacy sono preservati durante le modifiche della persona.
  La nuova tab Progetti gestisce cliente, date da/a facoltative, BM di riferimento,
  Presenza/Remoto/Ibrido e note. Progetti attivi ora evidenziati e filtri dedicati
  per attivi, passati e futuri; dettaglio, modifica e archiviazione con versione.
  Gli estremi data sono inclusivi nel fuso applicativo; date assenti indicano
  estremi aperti (entrambe assenti = progetto attivo). Sono ammesse sovrapposizioni.
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
  Nelle richieste di aumento la percentuale viene derivata dalla RAL base e
  dalla RAL target, arrotondata per eccesso al decimo di punto percentuale;
  lasciando vuota la RAL target e possibile inserirla manualmente, lasciando
  al backend il calcolo della RAL target. Se il valore arrotondato non coincide
  al centesimo con la RAL inserita, viene inviato solo il target: l'API rifiuta
  una coppia target/percentuale incoerente.
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
`e2e/people-sheet.spec.ts` e `e2e/projects.spec.ts` usano soltanto API simulate
con dati fittizi e verificano lista, scheda, modifica, icone e calendario su
desktop/mobile, oltre ai filtri data/ora, payload UTC, creazione/modifica
progetti, percentuale aumento automatica/manuale e telefono internazionale:
si possono eseguire senza database o credenziali con
`E2E_BASE_URL=http://127.0.0.1:4200 npx playwright test e2e/people-sheet.spec.ts e2e/projects.spec.ts`
contro il dev server.

## Consegna e limiti

Review/hardening Step 5 e limiti accettati sono in [guida operativa](../docs/operations.md).
La data esito predefinita usa APP_TIMEZONE, non il giorno UTC del browser.
La timeline e paginata e filtrabile per tipo; per leggere
il dettaglio completo o modificarlo usare la scheda nella relativa tab.
La UI non offre cancellazione fisica o modifica di RAL storiche.
