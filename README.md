# myRI

People management self-hosted per un team lead, monoutente con autenticazione
obbligatoria. **Step 0-5 implementati: stack locale Angular/REST/MySQL,
reminder, dashboard, todolist, andamento RAL, export e backup.**

**Rischio accettato:** il backend conserva anche le credenziali DB di migrazione.
Una compromissione del processo web puo aggirare i soli privilegi runtime
e le protezioni append-only. L'utente ha scelto di documentarlo senza separare
le migrazioni. Uso solo locale su host fidato; dettagli in
[review finale](docs/review-step5.md) e [guida operativa](docs/operations.md).

Funzioni disponibili: anagrafica/contatti, RAL con storico immutabile, richieste
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
frontend/                Angular 21 LTS, Material, standalone e browser test
scripts/mysql/           inizializzazione utenti DB a privilegi separati
scripts/backup.sh        dump consistente, privato e con retention
compose.yaml             db, backend e frontend nginx
compose.external-db.yaml backend e frontend con MySQL esterno
.env.example             configurazione senza segreti
.env.external-db.example configurazione alternativa per MySQL esterno
```

Disponibili workspace, backend Maven con API, migrazioni e test, Dockerfile,
compose completo e frontend per login, persone, contatti, RAL, aumenti,
career talk, task e timeline; dashboard, notifiche, viste calendario ed export.

Il [modello dati con ER Mermaid](docs/adr/0001-domain-and-schema.md) descrive nove
tabelle, PK BIGINT, RAL/audit append-only, archiviazione senza cancellazioni fisiche
e collegamenti task coerenti per persona. Il [contratto REST e autenticazione](docs/adr/0002-authentication-and-api.md) definisce
sessione/CSRF e futura integrazione OIDC. I dettagli effettivi sono nella
[guida API](docs/api.md).

## Avvio e configurazione

Sono disponibili **due Compose alternativi e autonomi**:

| File | Servizi | Configurazione |
| --- | --- | --- |
| `compose.yaml` | db MySQL interno, backend, frontend | `.env` da `.env.example` |
| `compose.external-db.yaml` | backend e frontend, MySQL gia disponibile esternamente | `.env.external-db` da `.env.external-db.example` |

Non combinare i due file con `-f`: sceglierne uno. Il secondo non crea container,
volume, schema o utenti MySQL; Flyway continua ad applicare le migrazioni nello
schema dedicato gia predisposto. Il cambio di Compose **non trasferisce dati**.
Per passare da interno a esterno usare un backup/restore verificato, mai cancellare
il volume originale. Fermare prima la variante in uso con il suo comando `down`
senza `-v`, per non lasciare container orfani o conflitti sulla porta UI.
Solo frontend pubblicato su localhost in entrambe le modalita.

### MySQL interno (predefinito)

Copiare `.env.example` in `.env`, compilare tutte le password vuote e APP_USERNAME,
quindi, con Docker e Compose v2:

```sh
cp .env.example .env
chmod 600 .env
# Compilare .env con credenziali proprie prima dell'avvio.
docker compose up --build -d
```

Aprire **http://127.0.0.1:8080** e accedere con le credenziali applicative
configurate. Solo nginx pubblica una porta su localhost; API e MySQL restano
senza porte host. La porta UI e configurabile con `FRONTEND_PORT`.
Verificare i servizi senza esporre dati:

```sh
docker compose ps
docker compose exec backend wget --quiet -O - http://127.0.0.1:8080/health
docker compose down
```

Nginx serve la SPA e inoltra le API same-origin con cookie/CSRF, senza CORS.
MySQL 8.4.13 usa volume persistente /var/lib/mysql, rete interna e healthcheck;
il backend parte solo dopo service_healthy, esegue Flyway e valida lo schema JPA.
L'immagine backend esegue Java 21 come UID 10001, filesystem read-only e tmpfs /tmp.
Non usare down -v: cancellerebbe i dati.
HTTPS opzionale su localhost, aggiornamento e rollback sono descritti nella
[guida operativa](docs/operations.md). `compose.https.yaml` richiede Compose
>= 2.24.4, certificati attendibili privati fuori dal repository, elimina la
porta HTTP e forza il cookie Secure.

### MySQL esterno

Preparare prima un database **dedicato a myRI**, MySQL 8.x >= 8.0.16
(consigliato 8.4.13), InnoDB, charset `utf8mb4`, collation
`utf8mb4_0900_ai_ci`. Non usare schemi condivisi con altre applicazioni.
Il DBA deve creare due utenti distinti non root: runtime e migrazioni.
Nomi lowercase ASCII come negli esempi, password distinte e private.
Il callback attuale assegna i grant a `'DB_USERNAME'@'%'`: deve esistere
esattamente quell'account runtime, senza grant globali, DDL o DELETE preesistenti.
Limitare gli accessi con firewall/rete privata; un eventuale account con host
piu specifico non viene configurato dal callback.

Per l'utente migrazioni sono necessari, **solo sullo schema dedicato**,
`CREATE, ALTER, INDEX, REFERENCES, TRIGGER, SELECT, INSERT, UPDATE WITH GRANT OPTION`.
L'utente runtime inizialmente puo essere privo di grant: Flyway assegna i DML per
tabella, SELECT/INSERT soltanto su salary/audit_event. Il server deve permettere
la creazione di trigger senza SUPER (`log_bin_trust_function_creators=1` quando
richiesto dal binary log). Verificare che il provider MySQL consenta questi
privilegi e i DEFINER dei trigger prima dell'avvio; nessun fallback senza trigger.
Non fornire credenziali root al backend. Resta il rischio migrator accettato.

```sh
cp .env.external-db.example .env.external-db
chmod 600 .env.external-db
# Compilare host, porta, schema e credenziali private.
docker compose --env-file .env.external-db -f compose.external-db.yaml config --quiet
docker compose --env-file .env.external-db -f compose.external-db.yaml up --build -d --wait
docker compose --env-file .env.external-db -f compose.external-db.yaml ps
docker compose --env-file .env.external-db -f compose.external-db.yaml down
```

`DB_HOST` e visto **dal container backend**: `localhost`/`127.0.0.1` indicano
il container stesso, non il PC. Per un server sul PC usare
`host.docker.internal` (mapping host-gateway incluso anche su Linux); MySQL deve
ascoltare sull'interfaccia raggiungibile da Docker e consentire la subnet Docker
nel firewall, non essere esposto pubblicamente. Per un altro host usare il suo DNS
privato raggiungibile dal container. `DB_PORT` predefinita 3306.
Non esiste `depends_on` sul DB esterno: deve essere pronto prima dell'avvio.
Se connessione/migrazioni falliscono il backend non diventa healthy e il frontend
non viene avviato. Root password e volume dati non appartengono a questo Compose.

La connessione esterna forza **TLS `VERIFY_IDENTITY`** per runtime e Flyway:
certificato valido per DB_HOST e CA attendibile dalla JVM. Non disabilitare
TLS o verifica hostname per aggirare errori. Per una CA privata aggiungere un
piccolo overlay locale (non versionare certificati/chiavi) al backend:

```yaml
services:
  backend:
    volumes:
      - /percorso/privato/mysql-truststore.p12:/run/mysql-truststore.p12:ro
      - /percorso/privato/mysql-java.options:/run/mysql-java.options:ro
    environment:
      JDK_JAVA_OPTIONS: "@/run/mysql-java.options"
```

Creare il truststore con `keytool -importcert` importando la CA verificata tramite
canale fidato; renderlo leggibile all'UID 10001 del backend. Non contiene chiavi
private. Il file privato `mysql-java.options`, anch'esso leggibile solo dal
proprietario e dall'UID 10001, contiene le opzioni JVM:

```text
-Djavax.net.ssl.trustStore=/run/mysql-truststore.p12
-Djavax.net.ssl.trustStoreType=PKCS12
-Djavax.net.ssl.trustStorePassword=<password-del-truststore>
```

Non mettere quella password direttamente in JAVA_TOOL_OPTIONS/JDK_JAVA_OPTIONS:
la JVM ne stampa il valore all'avvio. Il riferimento `@file` evita di stampare
il contenuto. Non versionare il file opzioni; conservare directory e file con
permessi privati. Il truststore deve contenere almeno una CA e la sua password
deve essere corretta, altrimenti Connector/J puo riportare trustAnchors vuoto.
Applicare l'overlay privato con un ulteriore `-f /percorso/privato/mysql-ca.yaml`
a tutti i comandi, incluso reset password. La CA/hostname rimangono verificati:
non usare trust-all e non rimuovere i controlli d'integrita del truststore.

HTTPS UI opzionale funziona con entrambe le varianti:

```sh
# Dopo aver configurato TLS_CERT_FILE, TLS_KEY_FILE, TLS_UID/GID come in docs/operations.md:
docker compose --env-file .env.external-db -f compose.external-db.yaml -f compose.https.yaml up --build -d --wait
```

Per health, reset password, aggiornamento e down usare sempre lo stesso
`--env-file .env.external-db -f compose.external-db.yaml` (e gli overlay scelti).
Il reset continua a usare `run --rm --no-deps -e APP_RESET_PASSWORD backend`
con flag `--myri.reset-password=true`, password da ambiente come descritto sotto.
`./scripts/backup.sh` e invece **solo per MySQL interno**: esegue mysqldump nel
servizio db. Per quello esterno usare il backup gestito dal DBA/provider o
mysqldump con `--single-transaction --no-tablespaces --set-gtid-purged=OFF
--hex-blob --triggers`, credenziali in file privato, TLS `VERIFY_IDENTITY` e CA
attendibile. Testare restore, retention e permessi sul server esterno; non
eseguire lo script interno aspettandosi che selezioni il DB esterno.

| Variabile | Uso |
| --- | --- |
| DB_NAME | Schema (default myri, nome lowercase ASCII) |
| DB_HOST / DB_PORT | Solo Compose esterno: hostname obbligatorio e porta (default 3306); interno usa db:3306 |
| DB_USERNAME / DB_PASSWORD | Runtime DML non root; username lowercase ASCII, massimo 32 caratteri |
| DB_MIGRATION_USERNAME / DB_MIGRATION_PASSWORD | Utenza distinta per Flyway e grant per tabella |
| DB_ROOT_PASSWORD | Solo inizializzazione/amministrazione MySQL, non fornita al backend |
| APP_USERNAME / APP_PASSWORD | Bootstrap account unico solo se assente |
| APP_TIMEZONE | Europe/Rome predefinito, istanti DB sempre UTC |
| COOKIE_SECURE | false per HTTP locale; true quando si abilita HTTPS |
| FRONTEND_PORT | Porta nginx su 127.0.0.1 (default 8080) |
| SPRING_PROFILES_ACTIVE | default; dev inserisce fixture solo su DB privo di persone |
| REMINDERS_ENABLED | true predefinito; false disabilita la generazione periodica |
| CAREER_TALK_MONTHS | Soglia career talk, default 3, intervallo 1-120 mesi |
| REMINDERS_INTERVAL_MS | Ritardo fra esecuzioni e prima esecuzione, default 60000, intervallo 1000-86400000 |

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
Flyway V1/V2/V3 non sono state modificate; V4 aggiunge indici per le viste Step 4.

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

## Reminder, dashboard ed export

Dashboard e Notifiche sono nel menu. I reminder includono task aperti dall'inizio
del giorno di scadenza, anche arretrati, e persone attive senza career talk svolto
da oltre N mesi (assunzione come riferimento iniziale). Lo scheduler lavora anche
senza browser aperto; aggiornare la vista per vedere nuove notifiche.
Lettura e archiviazione non rigenerano lo stesso reminder; le notifiche sono
storiche, non una lista di scadenze ancora aperte.

La vista Task offre gestione completa oppure solo aperti: oggi, scaduti,
prossimi 7 giorni e tutti/per persona. Il calendario usa APP_TIMEZONE; oggi puo
sovrapporsi a scaduti, i prossimi 7 giorni iniziano domani.
La scheda persona contiene l'andamento RAL cronologico, incluse decorrenze future,
senza conversione fra valute, e i pulsanti export JSON/CSV.
Gli export comprendono sei entita di business, incluse voci archiviate, non
credenziali, audit o notifiche. Limite concordato: **1000 record totali inclusa
la persona**, oltre il quale si riceve errore 422, senza file parziale.
Il CSV unico usa tipo record e colonne comuni; le formule sono neutralizzate.
Contratto dettagliato nella [guida API](docs/api.md).

## Backup e ripristino

```sh
BACKUP_RETENTION=14 ./scripts/backup.sh
bash scripts/test-backup.sh
python3 scripts/test-compose.py
```

Il primo comando usa `mysqldump --single-transaction` e conserva gli ultimi
14 **file**, non giorni. Directory predefinita `backups/` privata, file gzip
modo 600; retention solo dopo successo e verifica gzip. Il secondo esegue un
harness fittizio, non accede al database. Il backup e manuale: pianificarlo
esternamente se necessario. Non e cifrato: proteggere disco e copie esterne.
Vedere [backup e restore su destinazione nuova](docs/backup.md) per configurazione,
limiti di consistenza e procedura amministrativa verificata.
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
a V2/V3/V4, verificando conservazione e protezione dello storico.
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

## Consegna e limiti

Frontend: [guida sviluppo, test e convenzioni UI](frontend/README.md).
Angular 21 e l'ultima LTS verificata nella documentazione ufficiale; la 22 e
Active. Node 24/npm e dipendenze sono dichiarati nel frontend e nel lockfile.
Gli orari sono mostrati in APP_TIMEZONE; input e filtri data/ora sono UTC espliciti.

Step 5: review statiche, regressioni corrette, HTTPS opzionale e verifiche
operative. Nessuna release, push o pubblicazione remota automatica.
La review non certifica assenza vulnerabilita; rischio migrator accettato,
backup non cifrati e scansione CVE non effettuata sono espliciti nella guida.
La ricorrenza transazionale al completamento task e gia presente nello Step 2.

Le regole cross-row (cicli manager, percentuale vs RAL base, transizioni di stato)
sono nei service e nei test; non si affidano soltanto ai CHECK SQL.
