import { ApplicationConfig, isDevMode, LOCALE_ID } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideHttpClient, withInterceptors, withNoXsrfProtection } from '@angular/common/http';
import { provideServiceWorker } from '@angular/service-worker';
import { csrfInterceptor, sessionInterceptor } from './core/auth';

import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    { provide: LOCALE_ID, useValue: 'it-IT' },
    provideHttpClient(
      withNoXsrfProtection(),
      withInterceptors([sessionInterceptor, csrfInterceptor]),
    ),
    provideRouter(routes, withComponentInputBinding()),
    provideServiceWorker('custom-sw.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
  ],
};
