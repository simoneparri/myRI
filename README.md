# myRI

People management self-hosted per un team lead, monoutente con autenticazione
obbligatoria. **Stato: Step 2, backend REST con sicurezza e MySQL;
frontend Angular previsto allo Step 3.**

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
  adr/                   decisioni, ER Mermaid e contratti
  api.md                 API implementate e autenticazione
backend/                 Java 21, Boot 3, Maven Wrapper, API e test
frontend/                Angular LTS, Material, standalone (Step 3)
scripts/mysql/           inizializzazione utenti DB a privilegi separati
compose.yaml             db e backend; frontend nginx allo Step 3
.env.example             configurazione senza segreti
```

Disponibili workspace, backend Maven con API, migrazioni e test, Dockerfile,
compose DB/backend e frontend/ come spazio riservato documentato.

Il [modello dati con ER Mermaid](docs/adr/0001-domain-and-schema.md) descrive nove
tabelle, PK BIGINT, RAL/audit append-only, archiviazione senza cancellazioni fisiche
e collegamenti task coerenti per persona. Il [contratto REST e autenticazione](docs/adr/0002-authentication-and-api.md) definisce
sessione/CSRF e futura integrazione OIDC. I dettagli effettivi sono nella
[guida API](docs/api.md).

## Avvio e configurazione

Copiare `.env.example` in `.env`, compilare tutte le password vuote e APP_USERNAME,
quindi, con Docker e Compose v2:

```sh
cp .env.example .env
chmod 600 .env
# Compilare .env con credenziali proprie prima dell'avvio.
docker compose up --build -d
```

Nello Step 2 nessuna porta e pubblicata, neanche per il backend. I servizi sono
verificabili senza esporre dati:

```sh
docker compose ps
docker compose exec backend wget --quiet -O - http://127.0.0.1:8080/health
docker compose down
```

Allo Step 3 nginx sara l'unico servizio pubblicato su localhost e inoltrera le API.
MySQL 8.4.13 usa volume persistente /var/lib/mysql, rete interna e healthcheck;
il backend parte solo dopo service_healthy, esegue Flyway e valida lo schema JPA.
L'immagine backend esegue Java 21 come UID 10001, filesystem read-only e tmpfs /tmp.
Non usare down -v: cancellerebbe i dati.

| Variabile | Uso |
| --- | --- |
| DB_NAME | Schema (default myri, nome lowercase ASCII) |
| DB_USERNAME / DB_PASSWORD | Runtime DML non root; username lowercase ASCII, massimo 32 caratteri |
| DB_MIGRATION_USERNAME / DB_MIGRATION_PASSWORD | Utenza distinta per Flyway e grant per tabella |
| DB_ROOT_PASSWORD | Solo inizializzazione/amministrazione MySQL, non fornita al backend |
| APP_USERNAME / APP_PASSWORD | Bootstrap account unico solo se assente |
| APP_TIMEZONE | Europe/Rome predefinito, istanti DB sempre UTC |
| COOKIE_SECURE | false per HTTP locale; true quando si abilita HTTPS |
| SPRING_PROFILES_ACTIVE | default; dev inserisce fixture solo su DB privo di persone |

Password applicativa: almeno 12 caratteri, massimo 72 byte UTF-8 per evitare
troncamenti BCrypt. Credenziali DB distinte, nessuna password predefinita.
Root resta interno al DB; Flyway dispone di CREATE/ALTER/INDEX/REFERENCES/TRIGGER
e SELECT/INSERT/UPDATE con GRANT OPTION limitati allo schema. Il callback
afterMigrate assegna DML per tabella al runtime, SELECT/INSERT soltanto su
salary/audit_event, nessun DELETE o DDL. Non riutilizzare account amministrativi.
log_bin_trust_function_creators=1 consente i trigger senza assegnare SUPER a Flyway.

Gli script MySQL iniziali girano soltanto su volume vuoto: cambiare password
nel .env non ruota automaticamente quelle di un DB esistente. Su dati esistenti
occorre una procedura amministrativa esplicita, senza eliminare il volume.
Flyway V1/V2 non sono state modificate; V3 aggiunge la chiave idempotenza RAL.

Bootstrap applicativo non cambia la password a un account gia esistente.
Per reset amministrativo locale, senza scrivere la password nella cronologia:

```sh
read -rs -p 'Nuova password: ' APP_RESET_PASSWORD; printf '\n'
export APP_RESET_PASSWORD
docker compose run --rm --no-deps -e APP_RESET_PASSWORD backend --myri.reset-password=true
unset APP_RESET_PASSWORD
```

Il comando usa un processo non-web, aggiorna BCrypt ed esce. Richiede DB avviato;
le vecchie sessioni sono invalidate alla richiesta successiva. Le sessioni non
persistono tra riavvii del backend. Non inviare password come argomenti CLI.
L'eventuale .env rimane privato e non deve contenere dati da copiare nei prompt.

## Backup previsto allo Step 4

Backup previsto: `./scripts/backup.sh`, basato su
`mysqldump --single-transaction`, retention configurabile e permessi privati.
Script e istruzioni di restore verranno realizzati e verificati su dati fittizi
allo Step 4/5. Non usare ancora il comando di backup: lo script non esiste.
Non versionare `.env`, dump, export personali o credenziali.

## Build e verifiche backend

Prerequisiti: **JDK 21 completo (non solo JRE)**, Docker funzionante, accesso a
Maven Central e Docker Hub per dipendenze/immagini. Maven Wrapper 3.9.12 con
checksum distribuzione; Spring Boot parent 3.5.16, Flyway/flyway-mysql 11.20.3.

```sh
cd backend
./mvnw verify
```

I test avviano MySQL effimero `mysql:8`. Lo schema viene creato da V1 e aggiornato
a V2/V3, verificando conservazione e protezione dello storico.
Usa le stesse migrazioni di produzione, valida Flyway e verifica il no-op
di una successiva migrate. Controlla tipi,
charset/collation, FK/indici, immutabilita RAL/audit, soft archive, account unico,
collegamenti task, ricorrenza e deduplicazione. I test API usano account DB
migrazioni/runtime distinti con gli stessi privilegi del compose, login e CSRF
reali, validazione, filtri, audit, rollback e scritture concorrenti.
Il container di test pubblica una porta effimera per JDBC: e un harness locale,
non il futuro compose di produzione, che non pubblichera MySQL.
Non usa DB/dati reali e non salta automaticamente i test se Docker manca.

Se le impostazioni Maven personali puntano a mirror aziendali non raggiungibili,
usare `./mvnw -s /percorso/settings-personali.xml verify` con configurazione propria;
non modificare configurazioni globali o versionare credenziali.
Se la cache utente non e scrivibile, impostare `-Dmaven.repo.local=/percorso/scrivibile`.

Il package produce un JAR Spring Boot eseguibile; `./mvnw verify` non richiede
.env o un DB locale preesistente. Solo il profilo dev inserisce fixture fittizie.
La build Docker non riesegue i test: eseguire verify prima di distribuire
un'immagine modificata.

## Prossimi step

Step 3: Angular LTS/Material e nginx same-origin. Step 4: scheduler/notifiche,
dashboard, viste todolist e export/backup. Step 5: hardening, review e consegna.
La ricorrenza transazionale al completamento task e gia presente nello Step 2.

Le regole cross-row (cicli manager, percentuale vs RAL base, transizioni di stato)
sono nei service e nei test; non si affidano soltanto ai CHECK SQL.
