---
name: add-entity
description: Pianifica una entita completa e i passaggi tra specialisti.
argument-hint: "Nome entita, campi, relazioni e regole di business"
agent: orchestrator
---

Segui [regole](../../AGENTS.md) e [piano](../../docs/plan.md).
Definisci prima invarianti, PK, vincoli, ON DELETE, dati sensibili, semantica CRUD,
ricerca/filtri, DTO e contratto API. Richiedi decisioni mancanti.
Pianifica il percorso completo architect -> db-dev/backend-dev/frontend-dev
-> test-engineer -> security-reviewer -> code-reviewer.
Includi migrazione Flyway, JPA, repository/service/mapper, API/OpenAPI,
form e liste Angular, test service/MySQL/UI/e2e e documentazione.
Assegna ownership senza scritture concorrenti. Aggiorna solo docs/plan.md e
attendi conferma prima degli handoff implementativi; rispetta gli step autorizzati.
