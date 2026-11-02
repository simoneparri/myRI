---
description: Schema e migrazioni Flyway MySQL myRI.
applyTo: "**/db/migration/*.sql"
---

- File V<n>__descrizione.sql, versioni uniche concordate con l'integratore.
  Mai modificare una migrazione gia applicata; correggere con nuova migrazione.
- MySQL 8.x >= 8.0.16, InnoDB, charset utf8mb4, collation utf8mb4_0900_ai_ci.
- Tabelle/colonne snake_case minuscolo. PK secondo ADR dello Step 1.
- Stati VARCHAR con CHECK nominati, non ENUM MySQL. Testi lunghi TEXT;
  importi DECIMAL(12,2), vincoli di positivita/coerenza secondo requisiti.
- Dichiarare ogni FK con ON DELETE esplicito e indice esplicito.
  Indici su scadenze task, date career talk e query dimostrate.
- UTC per timestamp, date civili come DATE; aggiornamenti concorrenti considerati.
- Non cancellare/cascadare lo storico RAL o l'audit per comodita.
- Separare utenza migrazioni e runtime a privilegi minimi; niente password nello SQL.
- Non inserire seed di produzione; seed fittizi attivati solo dal profilo dev.
- Considerare implicit commit del DDL MySQL: non promettere rollback transazionale.
- Verificare su Testcontainers mysql:8 con gli stessi file usati in produzione,
  sia inizializzazione pulita sia upgrade quando esiste una versione precedente.
