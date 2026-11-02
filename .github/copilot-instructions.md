# myRI - contesto GitHub Copilot

People management locale, self-hosted con Docker, uso singolo con login obbligatorio.
Dominio: persone e contatti, RAL append-only, richieste di aumento, career talk,
task/reminder, timeline, dashboard ed export CSV/JSON.

Seguire [AGENTS.md](../AGENTS.md) e [piano autorizzazioni](../docs/plan.md).
Le regole essenziali sotto devono restare coerenti con AGENTS.md.

## Processo e struttura

- Eseguire solo lo step autorizzato: Step 0/1/2 completati, Step 3 autorizzato.
  Non anticipare scheduler/dashboard/export Step 4.
- Monorepo previsto `backend/`, `frontend/`, `docs/`, `scripts/`, `compose.yaml`.
- Test mirati, documentazione e commit logico per ogni step implementativo.
  Un solo integratore committa; subagent senza commit/push.
- Esplicitare dubbi importanti e verifiche non eseguibili. Preservare modifiche altrui.

## Stack e codice

- Java 21, Spring Boot 3, JPA/Hibernate, Flyway + `flyway-mysql`,
  Spring Security, Bean Validation, REST/OpenAPI.
- Layer controller/service/repository, DTO separati dalle entity e mapper espliciti.
  Service transazionali, errori coerenti, ricerca/filtri paginati e validati.
- Angular ultima LTS verificata allo Step 3, Material allineato, standalone,
  TypeScript strict, signals per stato locale/derivato quando utili.
- MySQL 8.x >= 8.0.16, InnoDB, utf8mb4/utf8mb4_0900_ai_ci.
  snake_case minuscolo, stati VARCHAR con CHECK, TEXT per testi lunghi,
  DECIMAL(12,2)/BigDecimal per denaro, indici espliciti su FK e date rilevanti.
- ON DELETE esplicito, timestamp UTC e JDBC `serverTimezone=UTC`.
  Flyway in `backend/src/main/resources/db/migration/`, schema validato da Hibernate.
  Mai riscrivere migrazioni applicate.
- Storico RAL mai sovrascritto; generazione RAL da aumento atomica e non duplicabile.
- Nessuna cancellazione fisica: archiviazione/annullamento. Manager interno/esterno
  alternativi; task con piu riferimenti solo per la stessa persona. Importo aumento
  come RAL target, coerente con l'eventuale percentuale: vedi ADR 0001.
- Unit test sui service; Testcontainers `mysql:8` con migrazioni reali, non H2;
  test frontend/e2e dei flussi. Seed fittizi solo sotto profilo Spring `dev`.

## Sicurezza

- Mai segreti o dati personali reali in repository, fixture, prompt o log.
  Non stampare `.env`, payload, RAL, note, password o token.
- Audit delle modifiche finanziarie separato, protetto, senza snapshot indiscriminati.
- Login obbligatorio, BCrypt/Argon2, nessuna password predefinita.
  Sessione/CSRF o JWT solo dopo ADR; futura integrazione Keycloak/OIDC.
- Utente DB runtime non root, privilegi minimi, identita migrazioni separata.
- Compose espone solo frontend su localhost, niente porte MySQL/backend;
  volume persistente DB e healthcheck con dipendenza service_healthy.
- Backup `mysqldump --single-transaction`, retention validata, permessi privati.
  Non disabilitare approvazioni, CSRF, TLS o controlli di sicurezza per aggirare errori.

## Comandi

`cd backend && ./mvnw verify` verifica schema, service e API con JDK 21 completo
e Docker. Compose completo dopo configurazione privata di .env; solo nginx su
127.0.0.1:8080. Frontend Angular 21 LTS/Material 21, Node 24, Vitest/Playwright.
E2E solo su DB fittizio dedicato, credenziali da ambiente. Backup resta Step 4.

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

Attendere la creazione dei file; allineare i comandi Angular al runner effettivo.
Mai `docker compose down -v` su dati reali.
