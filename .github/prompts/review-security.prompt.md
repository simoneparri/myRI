---
name: review-security
description: Revisione statica di sicurezza senza modifiche o comandi.
argument-hint: "Indica lo step o i file da revisionare"
agent: security-reviewer
---

Revisiona lo scope fornito rispetto a [regole](../../AGENTS.md) e
[piano](../../docs/plan.md). Se manca lo scope, identifica le modifiche disponibili
con gli strumenti di lettura e dichiarale nel report.
Controlla login, autorizzazioni, password/sessioni/CSRF, audit, log,
export CSV/JSON, Docker/nginx/MySQL, credenziali e backup.
Non leggere segreti, non eseguire comandi e non modificare file.
Restituisci evidenze redatte con severita, file:righe, impatto, confidenza,
rimedio e limiti della verifica. Non trasformare ipotesi in vulnerabilita certe.
