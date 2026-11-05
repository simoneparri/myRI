import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app-shell/app';
import { TIMEZONE } from './app/shared/format';

async function start(): Promise<void> {
  const response = await fetch('/config.json', { cache: 'no-store' });
  if (!response.ok) throw new Error('Configurazione non disponibile.');
  const config: unknown = await response.json();
  if (
    !config ||
    typeof config !== 'object' ||
    !('timezone' in config) ||
    typeof config.timezone !== 'string'
  ) {
    throw new Error('Configurazione non valida.');
  }
  new Intl.DateTimeFormat('it-IT', { timeZone: config.timezone }).format();
  await bootstrapApplication(App, {
    providers: [...appConfig.providers, { provide: TIMEZONE, useValue: config.timezone }],
  });
}
void start().catch(() => {
  document.body.textContent =
    'Avvio myRI non riuscito. Verifica la configurazione e ricarica la pagina.';
});
