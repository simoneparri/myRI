---
name: prepare-release
description: Pianifica e coordina una verifica di rilascio senza pubblicazione automatica.
argument-hint: "Versione candidata e scope approvato"
agent: orchestrator
---

Leggi [regole](../../AGENTS.md) e [piano](../../docs/plan.md).
Prepara checklist per build/test backend, integrazione MySQL/Flyway, build/test
Angular/e2e, compose e healthcheck, bootstrap login, assenza segreti,
upgrade migrazioni, backup e restore su dati fittizi, README e .env.example.
Registra evidenze disponibili e verifiche mancanti; non dichiararle eseguite.
Proponi incarichi limitati a devops/test-engineer e review read-only.
Solo dopo approvazione delega le verifiche nello scope autorizzato.
Non avviare release, tag, commit, push, deploy o cancellazioni di volumi.
Output: piano aggiornato e criteri go/no-go, con ogni blocco esplicito.
