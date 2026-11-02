# Frontend - struttura riservata

Implementazione prevista allo Step 3 dopo approvazione del contratto API.
La versione Angular sara l'ultima LTS disponibile e verificata in quel momento;
Material avra la stessa major. Node e lockfile saranno fissati insieme al progetto.

Struttura prevista:

```text
src/app/
  core/                   autenticazione, client HTTP, gestione errori
  shared/                 componenti e formatter comuni
  features/
    people/
    salaries/
    raise-requests/
    career-talks/
    tasks/
    dashboard/
```

Standalone components e signals dove sensato. Nessun mock di autenticazione
o applicazione Angular viene creato nello Step 1.
