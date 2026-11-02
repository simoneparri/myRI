# myRI

People management self-hosted per un team lead, monoutente con autenticazione
obbligatoria. **Stato: solo Step 0, workspace multi-agente; applicazione non ancora
implementata e non avviabile.**

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

## Struttura proposta, da approvare

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

Solo workspace e documenti Step 0 esistono. Non sono presenti scheletro applicativo,
SQL o decisioni architetturali gia approvate.

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

## Verifiche previste

Backend: `cd backend && ./mvnw verify`, unit test service e Testcontainers
`mysql:8` con le migrazioni di produzione. Frontend: build, test ed e2e con
runner da fissare nello Step 3. Compose: `docker compose config --quiet`.
I comandi applicativi non sono ancora disponibili.

Il prossimo passo richiede conferma esplicita: struttura monorepo, decisioni di
dominio, ER e migrazioni MySQL dello **Step 1**, poi nuovo punto di approvazione.
