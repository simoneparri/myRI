import { ApplicationConfig, LOCALE_ID } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideHttpClient, withInterceptors, withNoXsrfProtection } from '@angular/common/http';
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
  ],
};
