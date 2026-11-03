# Piano incrementale myRI

## Stato e autorizzazioni

- Step 0 completato e approvato dall'utente, commit f8ba44d.
- Step 1 completato e approvato dall'utente, commit 3f2a102.
- Step 2 completato: backend con API e sicurezza.
- Step 3 completato e committato: frontend e integrazione nginx.
- Step 4 autorizzato dall'utente e completato. Step 5 non ancora autorizzato.
- Gli step seguenti si eseguono uno alla volta dopo assegnazione dell'utente.
- Handoff manuali e deleghe non costituiscono autorizzazione a superare questi gate.

Step 0 realizzato: nove agenti, quattro prompt, istruzioni e impostazioni.
Verificati con parsing YAML/JSON frontmatter, destinazioni handoff/deleghe,
restrizioni strumenti reviewer, link locali e assenza di backend/frontend.
Resta da verificare discovery ed esecuzione in una sessione VS Code interattiva.

## Scelte di struttura dello Step 1 approvate

- Monorepo backend/ e frontend/, Maven Wrapper, package per dominio con layer
  controller/service/repository/dto/mapper; contratti REST sotto /api/v1.
- BIGINT AUTO_INCREMENT per semplicita, indici compatti e nessuna esigenza
  distribuita monoutente; confronto con UUID BINARY(16) in ADR 0001.
- Sessione server con cookie HttpOnly, SameSite e CSRF, nginx same-origin,
  BCrypt e futura autenticazione OIDC/Keycloak: strategia confermata.
- MySQL 8.x con patch/digest da fissare all'implementazione; test mysql:8.
  Java 21, Spring Boot parent 3.5.16 e Flyway 11.20.3 per supporto MySQL 8.4.
  Maven Wrapper 3.9.12 con checksum distribuzione; nessuna API applicativa ancora.
- Angular ultima LTS verificata nello Step 3, non latest a prescindere.
- Runtime DB con soli privilegi DML necessari; credenziali migrazioni distinte
  con privilegi DDL limitati allo schema, da progettare con il bootstrap.

## Decisioni confermate dall'utente nello Step 1

1. Nessuna cancellazione fisica: archiviazione/annullamento per tutte le entita,
   RAL/audit append-only senza modifiche distruttive.
2. Manager interno opzionale oppure esterno testuale, alternativi; vietati
   auto-riporto e cicli.
3. Task con piu collegamenti simultanei, purche della stessa persona.
4. Importo aumento come RAL desiderata; importo e percentuale possono coesistere
   se coerenti con la base. Approvazione con generazione RAL opzionale esplicita,
   atomica e non duplicabile, stessa valuta e decorrenza obbligatoria se generata.
5. Ricorrenza giornaliera/settimanale/mensile: al completamento una sola prossima
   occorrenza futura, saltando le scadenze perse.
6. Europe/Rome configurabile per calendario e UI; timestamp UTC.
7. Reminder career talk: N iniziale 3 mesi configurabile, persone attive,
   data assunzione come riferimento per chi non ha incontri; deduplicazione.
8. Sessione/CSRF, bootstrap account unico da ambiente solo al primo avvio,
   recupero password con comando amministrativo locale, nessuna registrazione.

Dettagli proposti per l'approvazione dello schema: ADR 0001 (date/ordine timeline,
finestre calendario, arrotondamenti e ancoraggio ricorrenze) e ADR 0002 (API).
Conferma Step 2: richieste modificabili anche dopo invio, senza cambio di stato;
approvate/rifiutate definitive. Le rimandate possono tornare in bozza.

## Step 0 - workspace

Scope: AGENTS.md, .github/copilot-instructions.md, istruzioni mirate, nove agenti,
handoff manuali, quattro prompt, impostazioni/estensioni VS Code, docs/agents.md,
README iniziale e ignore per segreti e file locali.

Criteri: frontmatter valido, nomi agenti/handoff coerenti, strumenti minimi,
reviewer read-only, planner limitato al piano e architect ai documenti,
gate espliciti e compatibilita harness documentata. Nessun codice applicativo.

Commit: `chore(workspace): configure Copilot multi-agent workflow`.
Stop: richiedere conferma per lo Step 1.

## Step 1 - struttura, dominio e schema

Prerequisito: conferma Step 0 e risoluzione delle decisioni di dominio rilevanti.
Architect prepara docs/adr/ con ER Mermaid, cardinalita, PK, invarianti, ON DELETE,
contratti e scelte transazionali. Db-dev crea migrazioni iniziali e indici.
Struttura backend/frontend, manifest minimi e harness di test schema solo quanto
necessario alla verifica; niente API/UI funzionali anticipate.

Copertura: Persona, Contatto, RAL, RichiestaAumento, CareerTalk, Task/Reminder;
valutare tabelle tecniche per utente, audit, notifiche e ricorrenza.
Test: migrazione pulita su Testcontainers mysql:8, CHECK, FK, indici e tipi;
serve un ambiente Docker funzionante. Nessuna migrazione dichiarata verificata
se Docker non e disponibile.

Criteri: schema aderente a ER, migrazioni reali verificate, decisioni approvate,
UTF8/collation/UTC espliciti. Commit logico schema/struttura.
Stop: richiedere conferma prima dello Step 2.

Realizzato: backend/pom.xml, Maven Wrapper, V1 (nove tabelle), V2 (trigger di
protezione), harness SchemaMigrationTest, frontend/README.md, ADR con ER e
contratto REST preliminare. Nessuna API, login o UI anticipata.

Verifica eseguita: Maven Wrapper verify con JDK 21 completo, Flyway 11.20.3 e
Testcontainers mysql:8 (MySQL 8.4): **14 test, zero fallimenti/errori/skipped**.
V1 su schema vuoto, fixture fittizia, upgrade V2 con storico preservato,
validate e successiva migrate senza modifiche. Verificati anche YAML/JSON
del workspace, link documentali locali e assenza errori whitespace.
L'ambiente aveva solo JRE, cache Maven parzialmente non scrivibile e repository
aziendali non raggiungibili: usati JDK, cache e settings isolati nella sessione,
senza cambiare configurazioni globali. Nessun fallback H2 o test saltato.

## Step 2 - backend e sicurezza

Prerequisito: conferma Step 1. Backend-dev implementa CRUD compatibili con
append-only, ricerca/filtri/paginazione, DTO/mapper, OpenAPI, login e
autorizzazione, audit RAL/aumenti, bootstrap account e seed dev fittizi.
Devops fornisce servizi DB/backend locali necessari alla verifica.
Test: service, MySQL/Flyway, validazione, sessione/CSRF o ADR alternativo,
audit atomico, concorrenza e aumento->RAL idempotente.
Commit logici: infrastruttura backend; dominio/API; autenticazione/audit.

Incremento 2a: applicazione Boot, configurazione Flyway/JPA validate, sessione
con CSRF anche per login/logout, cookie HttpOnly/SameSite, bootstrap BCrypt,
reset amministrativo e invalidazione tramite versione credenziali.
Verificati 3 unit test account e 3 integrazioni MySQL per login reale, rotazione
sessione, password rimossa dal principal, round-trip CSRF e protezione OpenAPI.
Commit: `822d96f feat(backend): add Spring Boot and session authentication`.

Incremento 2b: service/repository/DTO e mapper, CRUD senza delete fisico,
filtri/paginazione, RAL append-only con requestKey (V3), aumenti e audit atomici,
career talk, task e completamento ricorrente idempotente, timeline e API lettura
notifiche. OpenAPI protetta con schemi univoci e numeri precisi.
Suite completa: 51 test passati, nessun errore/fallimento/skipped, inclusi
rollback su audit fallito e concorrenza su approvazione, RAL, manager e task.
Gli account test MySQL replicano migrazioni/runtime distinti a privilegi minimi.
Commit: `55ab02c feat(api): implement people management services and financial audit`.

Incremento 2c: Dockerfile non-root, compose DB/backend a rete interna senza porte,
healthcheck/dipendenza healthy, volume persistente, credenziali runtime/migrator
distinte, .env.example e README operativo. Seed dev atomico su DB vuoto.
Verificati build e avvio Docker reali, health, login con CSRF, API e OpenAPI
autenticate, reset password come processo non-web, revoca sessione precedente,
password persistita al riavvio e fixture non duplicata. Rimossi container,
network e solo volume fittizio dedicati alla verifica. Nessun dato reale usato.
Frontend, scheduler, dashboard, viste todolist ed export/backup non anticipati;
restano agli step successivi. Hardening/review finali restano allo Step 5.

## Step 3 - frontend

Versione verificata il 2026-11-02 sulla tabella ufficiale Angular:
21 LTS (fine supporto giugno 2027), 22 Active. Scelta Angular 21/Material 21,
Node 24. Lockfile con versioni esatte; tool Node isolato in Docker perche
Node/npm non presenti sull'host. Test Vitest/jsdom e Playwright Chromium.
UI italiana con orari in APP_TIMEZONE; editing/filtri orari UTC espliciti,
date civili e importi/ID stringa senza conversioni floating point.
Completato: shell login/sessione/CSRF, guard e logout; liste paginabili con
ricerca/filtri/errori/loading/empty, schede persona e timeline; CRUD di contatti,
RAL, aumenti, career talk e task con versioni, riferimenti, ricorrenza,
archiviazione confermata e dettaglio. Valori Long/BigDecimal sono mantenuti come
stringhe; validazioni locali rispettano limiti Long, DECIMAL e Integer. Gestione
403 dopo scadenza verifica la sessione e non ripete mai la mutazione; i dialog
con dati precedenti si chiudono. Orari renderizzati in APP_TIMEZONE; input e
filtri istanti esplicitamente UTC, date civili invariate.

Compose ora integra nginx Angular same-origin, unico servizio pubblicato su
127.0.0.1; backend e MySQL non hanno porte host e restano su reti separate.
Immagine nginx non-root/read-only, header di sicurezza, CSP, log senza path/query
e configurazione timezone runtime. Configurazione e browser test fittizi descritti
in README e frontend/README.md. Nessun scheduler, dashboard, vista todolist o
export/backup introdotto.

Verifiche finali dopo `npm ci`: **20 test unitari/componenti, 0 fallimenti**;
**3 flussi Playwright reali passati** su stack Compose MySQL/dev dedicato:
CRUD/modifica/archivio, aumento e generazione RAL, career talk, ricorrenza,
timeline, login/logout, sessione scaduta, errore server, viewport mobile e
conflitto senza ritentare/perdere input. Build production Angular riuscita:
chunk iniziale 465.87 kB entro il budget 500 kB. `docker compose config --quiet`,
healthcheck e accesso localhost verificati; solo frontend esponeva 127.0.0.1.
Il volume di prova e stato conservato, non avviato contro dati reali.

Commit UI: `0ce0a8d feat(frontend): add Angular people management interface`.

Prerequisito: contratti/backend dello Step 2. Verificare e fissare Angular LTS.
Frontend-dev: login, persone/contatti, storico RAL, aumenti, career talk, task,
filtri e scheda persona con timeline. Devops: build nginx e proxy same-origin,
compose completo db/backend/frontend senza esporre DB/backend.
Test: componenti/service, errori/empty/loading/accessibilita, e2e login e CRUD,
timeline e navigazione.
Commit logici: shell/login; feature UI; integrazione compose.

## Step 4 - reminder, dashboard, export e backup

Decisioni confermate: reminder dall'inizio del giorno di scadenza, inclusi
task arretrati; CSV unico con tipo record e unione delle colonne delle entita.
JSON e CSV comprendono anche le voci archiviate. Limite export di 1000 record
complessivi, con errore esplicito senza troncamenti e backup completo alternativo.

Prerequisito: Step 2/3 e semantica calendario/ricorrenza approvata.
Scheduler @Scheduled, notifiche in-app deduplicate, suggerimenti career talk,
todolist oggi/scaduti/7 giorni/per persona, dashboard e andamento RAL.
Export persona CSV/JSON con gestione CSV formula injection e formato relazionale
documentato; backup mysqldump --single-transaction e retention configurabile.
Test: Clock controllato, soglie N mesi e calendario, ricorrenza/idempotenza,
aggregazioni, autorizzazione export, backup/retention e restore su dati fittizi.
Commit logici: reminder; dashboard/todolist; export/backup.

Realizzato: scheduler fixed-delay configurabile con deduplicazione e lock
concorrente, soglie career talk, todolist calendariale, riepilogo dashboard,
lista persone oltre soglia e andamento RAL paginati. UI integrata con menu,
notifiche leggibili/archiviabili e dettaglio task. Export persona transazionale
CSV/JSON, storico e archivio inclusi, limite concordato e formula injection
neutralizzata in CSV. V4 aggiunge solo indici; V1/V2/V3 invariate.
Backup manuale con migrator non root, file privati e atomici, lock e retention
configurabile per numero di file. Procedura restore amministrativo su target
nuovo documentata in docs/backup.md.

Verifiche: **62 test backend passati**, MySQL reale con Flyway V1-V4, inclusi
concorrenza scheduler, soglie/DST, autorizzazione e limite export (1000 accettati,
1001 rifiutati). Test Step 4 passati anche con JVM Pacific/Honolulu, distinta
dal fuso applicativo e UTC DB. **25 test frontend e 4 flussi Playwright passati**,
inclusi scheduler reale, notifiche, viste calendario, trend, download JSON/CSV
ed errore export esplicito. Build production: 467.10 kB iniziali, budget 500 kB.
Harness backup: retention piu recente, input invalidi, permessi, symlink, lock,
cleanup e mancata potatura su fallimento. Dump reale via migrator ripristinato
in un nuovo stack/volume fittizio; checksum identici di tutte le nove tabelle
e flyway_schema_history, trigger salary/audit rifiutano UPDATE e DELETE (1644).
Avvio applicativo e quattro flussi browser ripetuti sul database ripristinato.
Nessun dato reale usato; review e hardening finali restano allo Step 5.

## Step 5 - hardening e consegna

Prerequisito: step funzionali completi. Devops/test-engineer completano verifiche
upgrade, avvio pulito, persistenza, restore, README, .env.example e HTTPS opzionale.
Security-reviewer e code-reviewer producono report read-only; le correzioni
passano agli specialisti con scope approvato e test di regressione.
Criteri: nessun blocco non dichiarato, niente segreti/dati reali, permessi minimi,
solo localhost frontend, build e test riproducibili, documentazione aderente.
Commit logici: hardening e test; documentazione operativa finale.

## Regole di integrazione

Ogni incarico elenca file posseduti, dipendenze e condizione di stop.
Backend e DB non scrivono contemporaneamente migrazioni/manifest.
Un solo integratore verifica diff, test, assenza segreti e crea i commit.
Non aggiungere release, cloud deployment o Keycloak completo allo scope iniziale.
