# Utility SQL amministrative (solo dati fittizi)

`delete-person-dev.sql` elimina irreversibilmente una persona tramite ID myRI e
contatti, progetti, RAL, richieste, career talk, task, notifiche e audit collegati.
Non e una migrazione e non e esposta dalle API. Nessuna cancellazione fisica
e stata abilitata nel runtime.

Usare esclusivamente un database sacrificabile con suffisso `_dev` o `_test`,
backend fermo durante la pulizia (e nessun altro writer). Non basta il nome del
database: l'operatore deve confermare che contiene soltanto dati fittizi.
L'account amministrativo deve avere privilegi DML, `CREATE ROUTINE`,
`ALTER ROUTINE` ed `EXECUTE`; non assegnarli all'account runtime.

1. Verificare che il backend usi esplicitamente il profilo `dev`, poi disattivare
   volontariamente i trigger con il comando amministrativo esistente:
   `MYRI_DEV_DATABASE_CONFIRM=fictitious-data-only bash scripts/dev-triggers.sh disable`.
2. Fermare backend e ogni altro writer. Connettersi con il client MySQL
   usando l'opzione `--abort-source-on-error` e un
   account amministrativo al database fittizio, senza password sulla riga di comando.
3. Eseguire nella stessa sessione, dalla radice della checkout:

   ```sql
   SET @myri_dev_database_confirm = 'fictitious-data-only';
   SET @person_id = 123; -- sostituire con l'ID myRI fittizio da eliminare
   SOURCE scripts/sql-utilities/delete-person-dev.sql;
   ```

4. Riattivare immediatamente tutti i trigger tramite il file V2 originale
   (`SOURCE backend/src/main/resources/db/migration/V2__protect_history_and_prevent_physical_deletes.sql;`).
   Se l'utility fallisce, ripristinare comunque i trigger prima di riavviare il
   backend. Se la procedura e rimasta presente dopo un errore, rimuoverla con
   `DROP PROCEDURE myri_delete_person_dev;` prima di riprovare.

La procedura verifica conferma, nome DB, ID esistente e assenza dei trigger
protettivi. Le sole modifiche ai dati sono transazionali: in caso di errore
avviene rollback. La creazione/rimozione della procedura e DDL e non fa parte
della transazione. Non disabilita FK, trigger o controlli e non modifica Flyway.
I riferimenti al manager eliminato nelle altre persone vengono azzerati;
le altre persone e i loro dati rimangono presenti.
