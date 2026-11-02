---
description: Convenzioni Java e Spring Boot del backend myRI.
applyTo: "**/*.java"
---

- Java 21 e Spring Boot 3; organizzazione per dominio con layer controller,
  service, repository, dto e mapper. Constructor injection.
- Entity non esposte dalle API; DTO con Bean Validation e mapper espliciti.
- Transazioni nei service, readOnly per letture quando appropriato.
  Evitare N+1, query illimitate e serializzazione delle relazioni lazy.
- Denaro BigDecimal; Instant per timestamp UTC e LocalDate per date civili.
  Clock iniettabile per scadenze e scheduler testabili.
- Errori REST coerenti senza dettagli interni o dati sensibili. Validare filtri,
  sort, paginazione, transizioni di stato e coerenza dei collegamenti.
- RAL append-only; approvazione e creazione RAL atomiche, idempotenti e protette
  dalla concorrenza. Audit nella stessa transazione delle modifiche finanziarie.
- Tutte le API di dominio richiedono autenticazione. Non indebolire CSRF/sessioni.
  Nessun payload, RAL, nota personale, token o credenziale nei log.
- Scheduler idempotente, notifiche deduplicate, configurazione validata.
- Test unitari sui service e integrazione Testcontainers mysql:8 con Flyway reale.
  Non usare H2 come sostituto della verifica MySQL.
- Seed fittizi esclusivamente sotto profilo dev; mai schema Hibernate auto-update.
