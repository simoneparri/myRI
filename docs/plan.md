# Piano incrementale myRI

## Stato e autorizzazioni

- Autorizzato: Step 0, workspace multi-agente.
- Step 1 non autorizzato: attendere conferma esplicita dell'utente.
- Step 2 richiede una ulteriore conferma dopo ER e migrazioni dello Step 1.
- Gli step seguenti si eseguono uno alla volta dopo assegnazione dell'utente.
- Handoff manuali e deleghe non costituiscono autorizzazione a superare questi gate.

Step 0 realizzato: nove agenti, quattro prompt, istruzioni e impostazioni.
Verificati con parsing YAML/JSON frontmatter, destinazioni handoff/deleghe,
restrizioni strumenti reviewer, link locali e assenza di backend/frontend.
Resta da verificare discovery ed esecuzione in una sessione VS Code interattiva.

## Proposte preliminari, non decisioni approvate

- Monorepo backend/ e frontend/, Maven Wrapper, package per dominio con layer
  controller/service/repository/dto/mapper; contratti REST sotto /api/v1.
- Preferenza BIGINT AUTO_INCREMENT per semplicita, indici compatti e nessuna
  esigenza distribuita monoutente. Confronto con UUID BINARY(16) nello Step 1.
- Preferenza sessione server con cookie HttpOnly, SameSite e CSRF, nginx same-origin;
  BCrypt e futura autenticazione OIDC/Keycloak. Confermare in ADR prima del backend.
- MySQL 8.x con patch/digest da fissare all'implementazione; test mysql:8.
  Java 21 e Spring Boot 3 vincolati dalla richiesta; verificare supporto e
  compatibilita di minor/patch e dipendenze prima di sceglierle.
- Angular ultima LTS verificata nello Step 3, non latest a prescindere.
- Runtime DB con soli privilegi DML necessari; credenziali migrazioni distinte
  con privilegi DDL limitati allo schema, da progettare con il bootstrap.

## Decisioni da chiedere nello Step 1

1. CRUD vs RAL immutabile: proponiamo append-only con correzioni mediante nuove
   voci e persona archiviata; definire cancellazioni per le altre entita e audit.
2. Manager: relazione opzionale a una persona, riferimento esterno o entrambi?
   Definire prevenzione di auto-riporto e cicli.
3. Task: uno solo tra persona/career talk/aumento oppure piu collegamenti?
   Se un task punta a un talk/aumento, definire derivazione della persona e coerenza.
4. Aumento: importo come incremento o RAL target? Importo e percentuale alternativi
   o entrambi? Definire base di calcolo, arrotondamento, decorrenza e valuta.
   Approvazione non implica automaticamente creazione RAL senza scelta esplicita.
5. Ricorrenza: frequenze supportate, fuso, comportamento al completamento,
   scadenze saltate e chiave di deduplicazione.
6. Career talk non recente: valore iniziale N, persone mai incontrate,
   attivi/inattivi, uso della data suggerita e deduplicazione notifiche.
7. Timeline: data di evento vs registrazione, gestione eventi futuri e parita;
   fuso di visualizzazione per oggi, scaduti e prossimi 7 giorni.
8. Account unico: bootstrap iniziale e recupero password senza password predefinite;
   sessione proposta da confermare, nessuna registrazione pubblica.

Non scegliere queste semantiche durante la sola creazione del workspace.

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

## Step 2 - backend e sicurezza

Prerequisito: conferma Step 1. Backend-dev implementa CRUD compatibili con
append-only, ricerca/filtri/paginazione, DTO/mapper, OpenAPI, login e
autorizzazione, audit RAL/aumenti, bootstrap account e seed dev fittizi.
Devops fornisce servizi DB/backend locali necessari alla verifica.
Test: service, MySQL/Flyway, validazione, sessione/CSRF o ADR alternativo,
audit atomico, concorrenza e aumento->RAL idempotente.
Commit logici: infrastruttura backend; dominio/API; autenticazione/audit.

## Step 3 - frontend

Prerequisito: contratti/backend dello Step 2. Verificare e fissare Angular LTS.
Frontend-dev: login, persone/contatti, storico RAL, aumenti, career talk, task,
filtri e scheda persona con timeline. Devops: build nginx e proxy same-origin,
compose completo db/backend/frontend senza esporre DB/backend.
Test: componenti/service, errori/empty/loading/accessibilita, e2e login e CRUD,
timeline e navigazione.
Commit logici: shell/login; feature UI; integrazione compose.

## Step 4 - reminder, dashboard, export e backup

Prerequisito: Step 2/3 e semantica calendario/ricorrenza approvata.
Scheduler @Scheduled, notifiche in-app deduplicate, suggerimenti career talk,
todolist oggi/scaduti/7 giorni/per persona, dashboard e andamento RAL.
Export persona CSV/JSON con gestione CSV formula injection e formato relazionale
documentato; backup mysqldump --single-transaction e retention configurabile.
Test: Clock controllato, soglie N mesi e calendario, ricorrenza/idempotenza,
aggregazioni, autorizzazione export, backup/retention e restore su dati fittizi.
Commit logici: reminder; dashboard/todolist; export/backup.

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
