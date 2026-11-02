---
name: new-feature
description: Trasforma una richiesta in piano incrementale senza implementarla.
argument-hint: "Descrivi funzionalita, obiettivo e vincoli"
agent: orchestrator
---

Leggi [regole](../../AGENTS.md) e [piano](../../docs/plan.md).
Analizza la richiesta dell'utente; se mancano dettagli comportamentali importanti,
chiedili prima di scegliere. Aggiorna solo docs/plan.md con scope, dipendenze,
contratti, file previsti, test e criteri di accettazione, rischi e commit logici.
Proponi eventuale analisi architect, senza implementazioni delegate.
Fermati e richiedi approvazione; non considerare questo prompt autorizzazione
a superare i gate Step 0/1.
