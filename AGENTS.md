# myRI - regole condivise

Applicazione self-hosted, monoutente, per persone, contatti, RAL storicizzata,
richieste di aumento, career talk, task e reminder. Login obbligatorio.

## Processo

- Leggere `docs/plan.md`: implementare solo lo step esplicitamente autorizzato.
- Step 0: solo workspace. Attendere conferma prima dello Step 1.
- Step 1: proposta monorepo, ER e migrazioni; attendere conferma prima dello Step 2.
- Chiarire le decisioni comportamentali importanti prima di implementarle.
- Ogni step implementativo include test pertinenti, documentazione e commit logico.
- Non dichiarare eseguiti comandi non eseguiti; segnalare blocchi e verifiche mancanti.
- Non sovrascrivere modifiche altrui, fare push o azioni distruttive senza permesso.
- Nessun commit automatico da subagent: un solo responsabile integra e committa.

## Stack e convenzioni

- Monorepo previsto: `backend/`, `frontend/`, `docs/`, `scripts/`, `compose.yaml`.
- Java 21, Spring Boot 3, Spring Data JPA, Flyway e `flyway-mysql`,
  Spring Security, Bean Validation, REST/OpenAPI.
- Controller -> service -> repository; DTO distinti dalle entity, mapper espliciti.
  Transazioni nei service, errori coerenti, paginazione e filtri validati.
- Angular ultima LTS da verificare allo Step 3, Material della stessa major,
  standalone components, TypeScript strict, signals dove sensato.
- MySQL 8.x (almeno 8.0.16), InnoDB, `utf8mb4`, `utf8mb4_0900_ai_ci`.
  Tabelle/colonne snake_case minuscolo; stati VARCHAR con CHECK, testi lunghi TEXT,
  importi DECIMAL(12,2), indici espliciti su FK, scadenze task e date career talk.
- Ogni FK dichiara ON DELETE. Timestamp UTC, JDBC `serverTimezone=UTC`.
  Date di calendario distinte dagli istanti; denaro con BigDecimal, mai floating point.
- Migrazioni versionate in `backend/src/main/resources/db/migration/`;
  non modificare migrazioni gia applicate. Hibernate valida, non genera lo schema.
- RAL append-only: nessuna modifica o cancellazione distruttiva dello storico.
  Approvazione aumento ed eventuale RAL atomiche e protette da duplicazioni.
- Unit test service, integrazione Testcontainers `mysql:8` con Flyway di produzione,
  test UI/e2e per i flussi toccati. Seed solo fittizio e solo con profilo `dev`.

## Sicurezza

- Nessun segreto, dump, export reale o dato personale nel repository.
- Non leggere o stampare `.env`, credenziali, dump o dati reali senza necessita.
- Nessun dato sensibile nei log: inclusi payload, note, RAL, token e password.
  Audit finanziario dedicato, protetto e distinto dai log applicativi.
- Autenticazione obbligatoria; BCrypt/Argon2; niente credenziali predefinite.
  Sessione con CSRF oppure JWT secondo ADR approvato; predisposizione futura OIDC/Keycloak.
- Account MySQL applicativo non root a privilegi minimi; separare runtime e migrazioni.
- Solo frontend pubblicato su `127.0.0.1`; nessuna porta host per backend o MySQL.
  Volume DB persistente; healthcheck DB e depends_on con service_healthy.
- Backup `mysqldump --single-transaction`, retention validata, file privati e restore verificabile.
- Non disabilitare protezioni, approvazioni strumenti o controlli TLS per far passare test.

## Comandi previsti, non ancora disponibili allo Step 0

```sh
cd backend && ./mvnw verify
cd frontend && npm ci && npm run build
cd frontend && npm test -- --watch=false
cd frontend && npm run e2e
docker compose config --quiet
docker compose up --build -d
docker compose down
./scripts/backup.sh
```

Non eseguirli finche i relativi file/script non esistono. Lo Step 3 deve allineare
i comandi frontend al runner scelto. Non usare `docker compose down -v` sui dati reali.
