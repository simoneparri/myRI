# Operazioni locali e consegna

## Confini e rischio accettato

Installazione monoutente su host fidato, accessibile solo da localhost.
Non pubblicare porte su LAN/Internet e non condividere il socket Docker.
Host, amministratori Docker, `.env`, backup e download sono nel confine di
fiducia. Read-only non impedisce la lettura di segreti gia disponibili.

La review Step 5 ha individuato un rischio MEDIUM: **il backend web riceve anche
le credenziali migrator**, necessarie a Flyway e al callback dei grant.
Un'esecuzione di codice nel backend potrebbe usarle per modificare schema,
trigger e storico, aggirando i limiti dell'utenza runtime.
Non e stato dimostrato un vettore remoto di compromissione del backend.
L'utente ha scelto di **documentare il rischio senza cambiare l'architettura**:
non si tratta di un problema risolto o di isolamento completo delle migrazioni.
Separare Flyway/grant in un job amministrativo senza credenziali nel web tier
resta il rimedio raccomandato prima di ampliare il confine di fiducia.

Altri limiti: dump non cifrati; nessuna pianificazione automatica backup;
nessuna verifica automatica delle CVE delle immagini o delle dipendenze in
questa consegna. Aggiornare le dipendenze in modo controllato e ripetere i test.
La review statica non certifica l'assenza di vulnerabilita.
Risultati e condizioni in [review Step 5](review-step5.md).

## Avvio HTTP locale

I comandi senza `-f` si riferiscono a MySQL interno. Per MySQL esterno usare
sempre `--env-file .env.external-db -f compose.external-db.yaml`; prerequisiti
DB/utenti/TLS nel README. HTTPS si aggiunge con `-f compose.https.yaml` anche
alla variante esterna. Backup/restore via servizio db sono solo per la variante
interna; per quella esterna operare con DBA/provider e client TLS verificato.

Prerequisiti: Docker Engine e Compose v2; per l'overlay HTTPS, Compose >= 2.24.4
(tag `!reset`). Non servono Java/Node sull'host se si usa la build Docker.
Le immagini e dipendenze richiedono accesso ai rispettivi registry.
Compilare `.env` con password distinte e mantenerlo modo 600, mai nei log.

```sh
docker compose config --quiet
docker compose up --build -d --wait
docker compose ps
docker compose exec -T backend wget --quiet -O - http://127.0.0.1:8080/health
```

Il primo avvio su volume vuoto crea utenti DB, applica migrazioni e bootstrap.
Su volume esistente Flyway valida/aggiorna; il bootstrap non cambia password.
Cambiare password DB nel `.env` **non** cambia le utenze gia presenti: ruotarle
con procedura amministrativa esplicita, senza esporre segreti o perdere il volume.
Il profilo `dev` e soltanto per installazioni fittizie dedicate.

### Trigger solo in sviluppo

Le migrazioni normali continuano a creare i trigger di protezione di RAL, audit,
cancellazioni e riferimenti. MySQL non offre un comando temporaneo DISABLE TRIGGER:
lo script amministrativo seguente li rimuove e li ricrea esplicitamente.
Usarlo esclusivamente su dati fittizi sacrificabili. Non disabilita CSRF,
autenticazione, CHECK/FK, validazioni service o privilegi runtime.
La rimozione non autorizza DELETE/UPDATE finanziari tramite l'account runtime.

Il comando richiede un backend avviato con profilo `dev`, un database con nome
terminante in `_dev` o `_test` e una conferma esplicita. Usa il migrator del
servizio MySQL interno senza stampare credenziali; fallisce se i requisiti mancano.
Per istanze MySQL esterne serve una procedura DBA dedicata: questo comando
non le gestisce. Evitare scritture concorrenti durante rimozione/ripristino.

```sh
MYRI_DEV_DATABASE_CONFIRM=fictitious-data-only bash scripts/dev-triggers.sh disable
MYRI_DEV_DATABASE_CONFIRM=fictitious-data-only bash scripts/dev-triggers.sh enable
```

`MYRI_ENV_FILE` seleziona un env file privato alternativo; `COMPOSE_FILE` e
`COMPOSE_PROJECT_NAME` consentono di selezionare lo stack fittizio dedicato.
Il ripristino ricrea le definizioni versionate V2/V8, senza riscrivere la storia
Flyway. Riavviare il backend **non** ripristina automaticamente i trigger rimossi:
eseguire `enable` prima di riutilizzare il database con protezioni normali.
Il DDL non e transazionale: in caso di errore il comando fallisce esplicitamente
e possono essere presenti solo alcuni trigger; rieseguire `enable` e verificare.
Nessuno stack esistente e modificato automaticamente dall'aggiunta dello script.
Harness: `bash scripts/test-dev-triggers.sh`.

`docker compose down` rimuove container/reti, **non il volume dati**.
Non usare `down -v`, prune o cancellazioni di volumi per risolvere errori.
Le sessioni sono in memoria: un riavvio backend richiede un nuovo login.
I reminder vengono ricalcolati dopo l'intervallo configurato; leggere o
archiviare notifiche non elimina le chiavi di deduplicazione.
Per reset password usare il comando amministrativo del README; la nuova
password non va negli argomenti CLI. Le vecchie sessioni vengono revocate
alla successiva richiesta. Nessuna registrazione o password di emergenza.

## HTTPS opzionale su localhost

`compose.https.yaml` aggiunge un reverse proxy TLS non-root/read-only.
**Rimuove la porta HTTP del frontend**, forza COOKIE_SECURE=true nel backend
e pubblica solo `127.0.0.1:8443`. DB e backend restano privati.
Non abilita accesso remoto, ACME o gestione automatica dei certificati.

Preparare certificato PEM e chiave privata **fuori dal repository**, con SAN
valido per l'indirizzo usato (per esempio IP 127.0.0.1) e catena completa.
Il certificato deve essere attendibile dal browser/sistema. Per una CA locale,
installare la CA nel trust store con procedura amministrativa esplicita.
Non usare `curl -k`, bypass TLS del browser o ignore-certificate-errors.

Chiave modo 600 e directory privata. TLS_UID e TLS_GID permettono al proxy
di usare l'UID/GID del proprietario dei file senza avviarsi come root.
Non usare UID 0. Impostare variabili nell'ambiente della shell:

```sh
export TLS_UID="$(id -u)" TLS_GID="$(id -g)"
export TLS_CERT_FILE=/percorso/privato/tls/cert.pem
export TLS_KEY_FILE=/percorso/privato/tls/key.pem
export HTTPS_PORT=8443
docker compose -f compose.yaml -f compose.https.yaml config --quiet
docker compose -f compose.yaml -f compose.https.yaml up --build -d --wait
curl --fail --cacert /percorso/privato/tls/ca.pem https://127.0.0.1:8443/config.json
```

Usare gli stessi `-f` e variabili anche per ps/down e aggiornamenti. Accedere a
https://127.0.0.1:8443. TLS 1.2/1.3, cookie Secure/HttpOnly/SameSite=Lax,
CSRF sempre attivo. Gli header CSP/no-store/frame-deny sono forniti da nginx
frontend anche tramite il proxy. I log dei due nginx contengono solo status e
metodo, non URI, query, cookie o payload.
Il healthcheck TLS verifica la configurazione; il controllo HTTPS esterno
verifica anche connessione e certificato. Monitorare scadenza e rinnovo.

Dopo rinnovo PEM ricreare solo il proxy per ricaricare anche i bind mount:
`docker compose -f compose.yaml -f compose.https.yaml up -d --force-recreate tls`.
Non inserire chiavi nell'immagine, nel volume MySQL o nei backup del repository.
Per tornare volontariamente a HTTP locale: fermare lo stack con entrambi i file,
poi riavviare con il solo compose.yaml e COOKIE_SECURE=false. Le sessioni
precedenti non vengono conservate. Non farlo per aggirare errori TLS.

## Aggiornamento e rollback

1. Annotare revisione applicativa e immagini correnti senza esportare `.env`.
2. Eseguire build/test della candidata su un progetto fittizio separato, incluso
   restore di un dump fittizio e verifiche schema/privilegi.
3. Fermare il backend da aggiornare, lasciare DB healthy. Eseguire backup
   verificato; nessun DDL contemporaneo al dump.
4. Avviare la candidata con `up --build -d --wait`, poi controllare health,
   login, storico, audit e notifiche. Non cancellare i volumi.

Flyway validate fallito: fermarsi, non modificare migrazioni applicate, checksum
o flyway_schema_history per aggirare l'errore. Non copiare log integrali in ticket;
non aggiungere SQL/payload debug. DDL MySQL non offre rollback transazionale.
Se ci sono migrazioni incompatibili, **non riavviare semplicemente il vecchio JAR
contro il nuovo schema**. Ripristinare il backup in un nuovo progetto/volume con
revisione precedente, verificare e pianificare il passaggio. L'originale resta
intatto. Vedere [backup e restore](backup.md).

## Verifiche riproducibili

Backend: `cd backend && ./mvnw verify` (JDK 21 completo e Docker).
Frontend: `cd frontend && npm ci && npm test -- --watch=false && npm run build`
(Node 24); browser: [frontend/README.md](../frontend/README.md).
Backup simulato: `bash scripts/test-backup.sh`.

`scripts/verify-stack.py` usa solo Python 3 standard library e HTTP, non legge
`.env` e non gestisce container. E **soltanto per dati fittizi**: create aggiunge
persona, RAL e task; verify consulta i loro ID senza ricrearli.
Richiede consenso esplicito, URL loopback con porta e credenziali da ambiente.
Questo non rende sicuro un URL scelto erroneamente: verificare progetto, porta
e volume prima di abilitarlo.

```sh
export MYRI_ALLOW_FICTITIOUS_TESTS=true
export E2E_BASE_URL=http://127.0.0.1:18086
export E2E_USERNAME=utente-del-db-fittizio
read -rs -p 'Password fittizia: ' E2E_PASSWORD; printf '\n'
export E2E_PASSWORD
python3 scripts/verify-stack.py create --state /percorso/privato/test-state.json
# Ricreare lo stack fittizio, mantenendo il volume.
python3 scripts/verify-stack.py verify --state /percorso/privato/test-state.json
unset E2E_PASSWORD
```

Per HTTPS usare URL https e `E2E_CA_FILE=/percorso/ca.pem`: la verifica TLS resta
attiva e il test richiede un cookie Secure. Riutilizzare lo state dopo restore
in una nuova destinazione fittizia per provare la persistenza.
Lo state contiene solo ID fittizi, e creato modo 600 e non va committato.
Il test controlla login/logout, CSRF, header, protezione API/OpenAPI, precisione,
audit e todolist. Non stampa risposte o credenziali. Gli e2e coprono separatamente
UI, dialog, scadenza sessione, notifiche e download.
