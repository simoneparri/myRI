# Backup e ripristino

## Creazione

Richiede Bash, Docker Compose v2, GNU coreutils/find/sort, gzip e flock (Linux).
MySQL deve essere healthy. Dalla radice:

```sh
BACKUP_DIR=/percorso/privato/myri-backups BACKUP_RETENTION=14 ./scripts/backup.sh
```

BACKUP_DIR predefinita: `backups/` nel repository, esclusa da Git.
Directory dell'utente corrente senza permessi group/other (consigliato 700);
lo script crea le directory nuove con umask 077 e rifiuta il symlink diretto.
File gzip con permessi 600, nome UTC a nanosecondi e suffisso casuale.
Lock esclusivo impedisce due backup simultanei nella stessa directory.
Dump in file temporaneo, controllo gzip e rename prima di applicare retention.
Un dump fallito non elimina backup precedenti e rimuove il file parziale.

BACKUP_RETENTION e il **numero di file** da conservare, default 14, da 1 a 3650.
Si eliminano soltanto i file completi con il formato nome dello script, dal piu
vecchio. Non e una durata in giorni. Queste due variabili vanno nell'ambiente
del comando, **non nel .env di Compose**. MYRI_ENV_FILE seleziona il file Compose
privato (default `.env`); COMPOSE_PROJECT_NAME seleziona il progetto, se diverso
dal nome predefinito. Lo script non esegue/source il file .env.

Il dump usa l'utenza **migrazioni**, non root, con credenziali espanse soltanto
nel container DB e non negli argomenti host:
`mysqldump --single-transaction --skip-lock-tables --no-tablespaces
--set-gtid-purged=OFF --hex-blob --triggers`.
Comprende tutte le tabelle, storico, audit, notifiche, hash dell'account e
flyway_schema_history, oltre ai trigger. Non comprende utenze/grant MySQL:
sono ricreati dal bootstrap dello stack.

Single-transaction e consistente per InnoDB. **Non eseguire migrazioni o altro
DDL durante il dump.** Per un punto di ripristino di un aggiornamento fermare
prima il backend, lasciando avviato il DB. I dati applicativi contengono date
civili e timestamp UTC; la connessione mysql interna ha timezone UTC.
Il backup non e cifrato e non esiste pianificazione automatica: proteggere
disco, copie esterne e permessi; pianificare esternamente il comando se desiderato.
Non incollare dump o credenziali nei log, prompt o repository.

## Ripristino su destinazione nuova

Operazione amministrativa, **mai sullo schema/volume in uso**. Il dump contiene
DROP TABLE per le sue tabelle: un errore di destinazione distruggerebbe dati.
Usare un progetto Docker separato, un volume nuovo e un `.env` privato distinto.
Impostare lo **stesso DB_NAME e DB_MIGRATION_USERNAME dell'origine**: i trigger
contengono il DEFINER di quell'utenza. Le password possono essere nuove.
Configurare anche runtime e account bootstrap; nessuna password negli argomenti.
Usare la stessa versione MySQL 8.4.13 e la stessa revisione applicativa.

Negli esempi, `/percorso/restore.env` e un file privato completo, non dati reali
da versionare. Il progetto `myri-restore` deve essere nuovo:

```sh
docker compose -p myri-restore --env-file /percorso/restore.env up -d --wait db
docker compose -p myri-restore --env-file /percorso/restore.env exec -T db sh -c \
  'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysql --user=root --skip-column-names --batch --database="$MYSQL_DATABASE" -e "SHOW TABLES"'
```

**L'ultimo comando non deve mostrare tabelle.** Se ne mostra, fermarsi:
non importare in una destinazione non vuota. Nessun backend deve essere avviato.
Selezionare esplicitamente il file corretto, verificarne integrita e importarlo:

```sh
set -o pipefail
gzip -t -- /percorso/privato/myri-backup.sql.gz
gzip -cd -- /percorso/privato/myri-backup.sql.gz |
  docker compose -p myri-restore --env-file /percorso/restore.env exec -T db sh -c \
    'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysql --user=root -- "$MYSQL_DATABASE"'
```

Qui root e necessario solo per il restore amministrativo di trigger/DEFINER.
Nessun --force: un errore deve interrompere il ripristino. In caso di errore
isolare questa destinazione incompleta, non riavviare l'import su dati esistenti.
Non modificare manualmente migrazioni o rimuovere trigger per farlo riuscire.

Prima di aprire il backend confrontare con l'origine quiescente i conteggi o
checksum delle nove tabelle e di flyway_schema_history; verificare i trigger
con `SHOW TRIGGERS` senza pubblicare i risultati. Su destinazione fittizia
provare il rifiuto di UPDATE/DELETE su salary e audit_event (errore 1644).
Poi avviare backend/frontend del progetto separato con una porta localhost libera:

```sh
FRONTEND_PORT=18085 docker compose -p myri-restore --env-file /percorso/restore.env up --build -d
docker compose -p myri-restore --env-file /percorso/restore.env ps
```

Flyway valida lo storico e riapplica i grant runtime tramite callback. Verificare
health, login con la **password dell'account presente nel dump**, consultazione
persona, RAL e audit. APP_PASSWORD non sostituisce un account gia ripristinato;
se necessario usare il reset amministrativo documentato nel README.
Sessioni precedenti non sopravvivono al riavvio del backend.
Non promuovere la destinazione fino alla verifica; nessuna eliminazione
automatica del volume originale e nessun `docker compose down -v`.

## Verifiche

`bash scripts/test-backup.sh` usa un comando Docker fittizio e verifica retention
del piu recente, permessi, validazione, lock e mancata potatura su dump fallito.
La verifica reale Step 4 usa esclusivamente stack/volumi dedicati con dati
fittizi, dump tramite migrator e restore amministrativo in un nuovo stack:
confronto tabelle/storico e trigger append-only, poi avvio applicativo.
