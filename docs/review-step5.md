# Review finale Step 5

Review statica read-only della base Step 0-4, commit c3b7d43, seguita dalle
correzioni e verifiche sotto. Nessun accesso a dati reali.
I reviewer non hanno eseguito test: le verifiche dinamiche sono dell'integratore.
Nessuna certificazione di assenza vulnerabilita; nessuna scansione CVE automatica
di dipendenze/immagini svolta in questo step.

## Sicurezza

| Severita | Evidenza | Condizioni e impatto | Confidenza | Stato |
| --- | --- | --- | --- | --- |
| MEDIUM | compose.yaml:53-61; backend/src/main/java/it/myri/config/RuntimeGrants.java:17-47; scripts/mysql/01-create-users.sh:23-24 | Una compromissione del processo web rende disponibili anche le credenziali migrator, con DDL/trigger/UPDATE e GRANT OPTION nello schema; possibile aggirare le protezioni append-only. Nessun vettore remoto verificato. | 9/10 | Accettato dall'utente: documentazione senza modifica architetturale. NON risolto. |

Rimedio proposto e non implementato per decisione utente: Flyway e grant in un
job amministrativo separato, runtime web senza credenziali migrazioni.
Decisione raccolta dopo presentazione del rilievo: l'utente ha scelto
"Documenta il rischio senza cambiare l'architettura".
Le utenze restano distinte; runtime senza DELETE/DDL e soltanto SELECT/INSERT su
salary/audit. Questi limiti **non** confinano un processo che legge anche la
seconda credenziale.

Hardening informativo: backup non cifrati (limite mantenuto e documentato);
COOKIE_SECURE=false nel solo HTTP locale. L'overlay HTTPS forza Secure e
toglie l'esposizione HTTP, senza indebolire CSRF o trust TLS.
Proteggere `.env`, chiavi TLS, dump e download; non esporre lo stack alla rete.

## Correttezza

| Rilievo | Scenario | Correzione | Regressione |
| --- | --- | --- | --- |
| P2: retry complete/approve dopo archive | Risposta persa, archivio da altra sessione, retry respinto pur essendo gia riuscito | Il ramo gia concluso precede il controllo writable; approval verifica payload identico | API/MySQL: un solo successore; approvazione con/senza RAL, nessun audit duplicato, payload diverso 409, risorse aperte archiviate non modificabili |
| P2: default outcomeOn in UTC | Dopo mezzanotte locale ma prima di mezzanotte UTC propone giorno precedente | Helper calendarDate con APP_TIMEZONE, riusato nel badge RAL futuro | Dialog alle 23:30 UTC con Europe/Rome: default giorno locale successivo; input istanti restano UTC |

## Ambito delle verifiche

La consegna include suite backend MySQL/Flyway, frontend/unit/build, browser
su DB fittizio, nuovo avvio senza seed, ricreazione con persistenza e bootstrap
non sovrascritto, backup/restore su target nuovo e HTTPS con CA attendibile.
Nessun controllo TLS/CSRF disabilitato. La guida operativa distingue avvio,
aggiornamento, restore e rollback. Evidenze e conteggi nel [piano](plan.md).

Il rischio MEDIUM resta aperto per scelta esplicita: non viene classificato
come corretto dai test passati. Nessun via libera a pubblicazione remota,
release automatica, OIDC o uso multiutente.
