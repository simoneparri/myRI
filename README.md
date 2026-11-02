# myRI

People management self-hosted per un team lead, monoutente con autenticazione
obbligatoria. **Stato: Step 1, workspace e schema MySQL con test;
API/UI e avvio applicativo non ancora implementati.**

Funzioni previste: anagrafica/contatti, RAL con storico immutabile, richieste
di aumento, career talk, task/reminder, timeline, dashboard ed export CSV/JSON.

## Workspace disponibile

Configurazione in `.github/` per nove agenti specializzati, handoff manuali,
istruzioni condivise e quattro prompt. Impostazioni ed estensioni consigliate
in `.vscode/`. Il workflow completo richiede l'harness **Local di VS Code**:
il runtime Copilot nativo non interpreta allo stesso modo handoff e prompt.

Leggere [guida agenti](docs/agents.md), [regole condivise](AGENTS.md) e
[piano con gate di conferma](docs/plan.md). Aprire questa radice in VS Code,
scegliere orchestrator e verificare discovery con Chat Diagnostics.

## Struttura

```text
.github/                 istruzioni, agenti, prompt
.vscode/                 impostazioni e raccomandazioni estensioni
docs/
  agents.md              uso e compatibilita degli agenti
  plan.md                step, autorizzazioni e criteri di accettazione
  adr/                   decisioni, ER Mermaid e contratti (Step 1)
backend/                 Java 21, Boot 3, Maven Wrapper (Step 1/2)
frontend/                Angular LTS, Material, standalone (Step 3)
scripts/                 backup e operativita (step successivi)
compose.yaml             db, backend, frontend nginx (Step 2/3)
.env.example             configurazione senza segreti (con compose)
```

Disponibili workspace, backend Maven con migrazioni/test e frontend/ come spazio
riservato documentato. Compose, script di backup e .env.example saranno creati
insieme ai servizi che configurano, non come file fittizi non funzionanti.

Il [modello dati con ER Mermaid](docs/adr/0001-domain-and-schema.md) descrive nove
tabelle, PK BIGINT, RAL/audit append-only, archiviazione senza cancellazioni fisiche
e collegamenti task coerenti per persona. Il [contratto preliminare REST e
autenticazione](docs/adr/0002-authentication-and-api.md) prepara il backend con
sessione/CSRF e futura integrazione OIDC, senza implementarlo nello Step 1.

## Avvio, configurazione e backup previsti

A implementazione completata il percorso previsto sara copiare `.env.example`
in `.env`, impostare credenziali proprie, quindi:

```sh
docker compose up --build -d
```

Il frontend sara l'unico servizio pubblicato su localhost; nginx inoltrera le API.
MySQL avra volume persistente, rete interna e healthcheck. Backend senza porta
host, timezone UTC; account DB applicativo non root e account migrazioni separato.
Valori delle variabili, porta frontend e bootstrap account saranno documentati
insieme all'implementazione, senza password predefinite.

Backup previsto: `./scripts/backup.sh`, basato su
`mysqldump --single-transaction`, retention configurabile e permessi privati.
Script e istruzioni di restore verranno realizzati e verificati su dati fittizi
allo Step 4/5. Non usare questi comandi ora: i file non esistono ancora.
Non versionare `.env`, dump, export personali o credenziali.

## Verifica dello schema disponibile

Prerequisiti: **JDK 21 completo (non solo JRE)**, Docker funzionante, accesso a
Maven Central e Docker Hub per dipendenze/immagini. Maven Wrapper 3.9.12 con
checksum distribuzione; Spring Boot parent 3.5.16, Flyway/flyway-mysql 11.20.3.

```sh
cd backend
./mvnw verify
```

Il test avvia un MySQL effimero `mysql:8`, applica V1 a schema vuoto, inserisce
dati fittizi e aggiorna a V2, verificando conservazione e protezione dello storico.
Usa le stesse migrazioni di produzione, valida Flyway e verifica il no-op
di una successiva migrate. Controlla tipi,
charset/collation, FK/indici, immutabilita RAL/audit, soft archive, account unico,
collegamenti task, ricorrenza strutturale e deduplicazione.
Il container di test pubblica una porta effimera per JDBC: e un harness locale,
non il futuro compose di produzione, che non pubblichera MySQL.
Non usa DB/dati reali e non salta automaticamente i test se Docker manca.

Se le impostazioni Maven personali puntano a mirror aziendali non raggiungibili,
usare `./mvnw -s /percorso/settings-personali.xml verify` con configurazione propria;
non modificare configurazioni globali o versionare credenziali.
Se la cache utente non e scrivibile, impostare `-Dmaven.repo.local=/percorso/scrivibile`.

## Verifiche dei prossimi step

Backend: aggiungere unit test service e integrazione delle API. Frontend: build, test ed e2e con
runner da fissare nello Step 3. Compose: `docker compose config --quiet`.
I comandi frontend/compose non sono ancora disponibili.

Il prossimo passo richiede conferma esplicita dello schema/ADR:
**Step 2, backend con API e sicurezza**. Le regole cross-row (cicli manager,
percentuale vs RAL base, transizioni di stato) richiedono i service e relativi
test; non sono falsamente considerate garantite dai soli vincoli SQL.
