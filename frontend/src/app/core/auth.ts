import { HttpClient, HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, firstValueFrom, from, switchMap, throwError } from 'rxjs';
import { errorMessage } from './api';

interface Csrf {
  headerName: string;
  token: string;
}
interface User {
  id: string;
  username: string;
}

@Injectable({ providedIn: 'root' })
export class Auth {
  private readonly http = inject(HttpClient);
  readonly user = signal<User | null>(null);
  readonly failure = signal('');
  private checked = false;
  private token: Csrf | null = null;
  private tokenRequest?: Promise<Csrf>;

  csrf(): Promise<Csrf> {
    if (this.token) return Promise.resolve(this.token);
    this.tokenRequest ??= firstValueFrom(this.http.get<Csrf>('/api/v1/auth/csrf'))
      .then((token) => {
        this.token = token;
        return token;
      })
      .finally(() => {
        this.tokenRequest = undefined;
      });
    return this.tokenRequest;
  }
  async restore(): Promise<boolean> {
    if (this.checked) return this.user() !== null;
    this.failure.set('');
    try {
      return await this.verifySession();
    } catch (error) {
      this.failure.set(errorMessage(error));
      return false;
    }
  }
  async verifySession(): Promise<boolean> {
    try {
      this.user.set(await firstValueFrom(this.http.get<User>('/api/v1/auth/me')));
      this.checked = true;
      return true;
    } catch (error) {
      if (error instanceof HttpErrorResponse && error.status === 401) {
        this.expire();
        return false;
      }
      throw error;
    }
  }
  async login(username: string, password: string): Promise<void> {
    this.token = null;
    await this.csrf();
    const body = new URLSearchParams({ username, password });
    await firstValueFrom(
      this.http.post('/api/v1/auth/login', body.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      }),
    );
    this.token = null;
    await this.csrf();
    this.checked = false;
    if (!(await this.restore())) throw new Error('Session restore failed');
  }
  async logout(): Promise<void> {
    await firstValueFrom(this.http.post('/api/v1/auth/logout', {}));
    this.expire();
  }
  expire(): void {
    this.user.set(null);
    this.checked = false;
    this.token = null;
  }
}

export const authGuard: CanActivateFn = async () => {
  const auth = inject(Auth);
  const router = inject(Router);
  return (await auth.restore()) || router.createUrlTree(['/login']);
};

export const sessionInterceptor: HttpInterceptorFn = (request, next) => {
  const auth = inject(Auth);
  const router = inject(Router);
  if (!request.url.startsWith('/api/v1/')) return next(request);
  return next(request).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse && !request.url.startsWith('/api/v1/auth/')) {
        if (error.status === 401) {
          auth.expire();
          void router.navigateByUrl('/login');
        } else if (error.status === 403) {
          // Spring may reject CSRF before returning 401 for an expired session.
          return from(auth.verifySession()).pipe(
            switchMap((valid) => {
              if (!valid) void router.navigateByUrl('/login');
              return throwError(() => error);
            }),
          );
        }
      }
      return throwError(() => error);
    }),
  );
};

export const csrfInterceptor: HttpInterceptorFn = (request, next) => {
  const auth = inject(Auth);
  if (!request.url.startsWith('/api/v1/') || ['GET', 'HEAD', 'OPTIONS'].includes(request.method))
    return next(request);
  // Never replay mutations automatically: a lost response may already have committed.
  return from(auth.csrf()).pipe(
    switchMap((token) => next(request.clone({ setHeaders: { [token.headerName]: token.token } }))),
  );
};
