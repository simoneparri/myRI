# ADR 0002 - sessione locale e contratto REST

Stato: strategia approvata; API dello Step 2 implementate, dettagli in ../api.md.
Data: 2026-11-02.

## Autenticazione

Un account singleton, niente registrazione pubblica. Login password con BCrypt
tramite Spring Security e sessione server, non JWT. Nginx serve frontend e API
same-origin; cookie HttpOnly, SameSite=Lax, Secure quando si attiva HTTPS.
CSRF obbligatorio sulle scritture, compresi login/logout. Il frontend recupera
un token CSRF tramite endpoint dedicato e lo reinvia secondo contratto Spring.
Rotazione sessione al login, invalidazione al logout, scadenze configurabili.

Bootstrap solo quando non esiste l'account, da variabili d'ambiente obbligatorie
definite allo Step 2; password mai nei log o nel repository. Un riavvio non
reimposta l'account esistente. Comando amministrativo locale per reset password,
senza endpoint pubblico di recupero; invalidare le sessioni preesistenti.
Stato utente disabled_at gestito senza DELETE.

In futuro OIDC/Keycloak tramite configurazione Security separata, non autenticazione
fittizia o dipendenza obbligatoria ora. Prima di abilitarlo definire associazione
subject/provider all'account singleton e strategia di logout; migrazione dedicata.

Spring Security protegge tutte le risorse di dominio, audit e OpenAPI; gli export
saranno protetti allo stesso modo quando implementati.
Solo login/CSRF e healthcheck minimale strettamente necessario accessibili senza
sessione, senza dettagli di infrastruttura o dati. Nessun body sensibile nei log.
Restituire 401/403 JSON alle API, non redirect HTML; nessuna CORS permissiva.

## Convenzioni API

Base `/api/v1`, DTO e mapper, errori ProblemDetail senza dettagli SQL/interni,
validazione Bean Validation e messaggi presentabili in UI italiana.
ID BIGINT serializzati come **stringhe decimali** per non perdere precisione in JS.
Importi e percentuali come stringhe decimali, non float JavaScript.
Date ISO `YYYY-MM-DD`; istanti ISO 8601 UTC con `Z`; codici enum come nello schema.

Risposte lista:

```json
{
  "items": [],
  "page": 0,
  "size": 20,
  "totalElements": 0,
  "totalPages": 0
}
```

Paginazione con size massima 100, sort su whitelist, filtri validati.
`includeArchived=false` predefinito. Ogni DTO aggiornabile espone version:
le scritture devono inviare la versione corrente, conflitto 409 se obsoleta.
Le RAL append-only non espongono update/delete. I comandi finanziari e di
completamento devono essere sicuri ai retry, non solo fidarsi della UI.

## Superfici proposte

| Risorsa | Letture / comandi |
| --- | --- |
| auth | GET csrf, GET me, POST login, POST logout |
| people | GET lista/dettaglio, POST, PUT, POST archive; filtri nome/stato/manager |
| contacts | GET/POST sotto people/{id}/contacts, PUT contacts/{id}, POST archive |
| salaries | GET/POST people/{id}/salaries; niente PUT/PATCH/DELETE |
| raise-requests | GET lista/dettaglio, POST, PUT autorizzati dallo stato, POST submit/approve/reject/postpone/archive |
| career-talks | GET lista/dettaglio, POST, PUT, POST archive; filtri persona/intervallo |
| tasks | GET lista/dettaglio, POST, PUT, POST complete/cancel/archive; viste e filtri scadenza/persona/stato/priorita |
| timeline | GET people/{id}/timeline con paginazione e filtro tipi |
| notifications | GET lista, POST {id}/read, POST {id}/archive |
| dashboard | GET aggregati e people/{id}/salary-trend |
| export | GET people/{id}/export?format=json oppure csv |
| audit | GET protetto per persona/risorsa/intervallo, nessun comando mutabile |

Archive e annullamento sono comandi logici, non eliminazione. Non sono previsti
endpoint pubblici di restore/unarchive prima di concordarne le regole.
Gli endpoint dashboard/reminder/export vengono implementati solo allo Step 4.
Il documento non sostituisce OpenAPI eseguibile, disponibile nel backend.

Aggiornamento Step 2: OpenAPI eseguibile e protetta ora disponibile. Comando
reopen aggiunto per postponed -> draft. Le richieste restano modificabili dopo
invio; approvate/rifiutate definitive. POST RAL richiede requestKey per retry
idempotenti. Tipi JSON e schemi OpenAPI degli ID/importi sono stringhe esplicite.
Vedi [API implementate](../api.md) per login form/CSRF, DTO e transizioni.

## Approvazione aumento proposta

`POST /api/v1/raise-requests/{id}/approve` riceve version, outcomeOn, outcomeNotes,
createSalary (boolean esplicito), effectiveOn obbligatorio se createSalary=true.
Importo/valuta derivano dalla richiesta e dalla base immutabile, non da parametri
liberi che possano divergere. Risposta con richiesta e salaryId opzionale.
Retry con stesso esito restituisce la voce esistente; payload incompatibile
con un'approvazione gia registrata produce 409, non una seconda RAL.

## Export e audit

JSON conserva relazioni e metadati con schema/versione di export. CSV deve
documentare sezioni/archivio e neutralizzare formula injection; dettagli allo Step 4.
Download autenticati con cache disabilitata, nessun dato sensibile nei filename.
Audit in tabella dedicata immutabile, nella transazione di ogni modifica
RAL/richiesta; attore unico autenticato, ID target e nomi campi modificati.
Niente audit su console o logging di snapshot completi.
