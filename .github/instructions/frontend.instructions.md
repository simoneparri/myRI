---
description: Convenzioni Angular, Material e integrazione API myRI.
applyTo: "**/*.ts,**/*.html,**/*.scss"
---

- Angular LTS verificata all'avvio dello Step 3, Material della stessa major.
  Standalone components, TypeScript strict, separazione feature/core/shared.
- Ogni componente vive in una cartella dedicata con `.ts`, `.html`, eventuale
  `.scss` e test pertinenti affiancati. Template e stili stanno in file esterni
  collegati con `templateUrl` e `styleUrl`; mai usare HTML o CSS inline nei `.ts`.
- Signals per stato sincrono locale e derivato; RxJS per flussi asincroni.
  Non duplicare lo stato e gestire cancellazione e cleanup delle subscription.
- API tipizzate, niente any o entity backend replicate senza contratto.
  Non perdere precisione degli importi; formato monetario concordato con le API.
- Material accessibile, label esplicite, navigazione da tastiera, stati loading,
  empty ed error visibili. Form validati, messaggi in italiano.
- Date/istanti distinti; rendere esplicito il fuso usato nelle viste oggi/scaduti.
- Guard UI non sostituisce autorizzazione server. Non salvare segreti nei sorgenti
  o token in localStorage. Seguire l'ADR autenticazione e la protezione CSRF.
- Niente dati personali in console/telemetria. Non usare bypass HTML non fidato.
- Test componenti/service e flussi e2e pertinenti con dati esclusivamente fittizi.
