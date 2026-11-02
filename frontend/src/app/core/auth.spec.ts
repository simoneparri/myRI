import { TestBed } from '@angular/core/testing';
import {
  provideHttpClient,
  withInterceptors,
  withNoXsrfProtection,
  HttpClient,
} from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { Auth, csrfInterceptor, sessionInterceptor } from './auth';

describe('session and CSRF', () => {
  let http: HttpTestingController;
  let auth: Auth;
  let client: HttpClient;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(
          withNoXsrfProtection(),
          withInterceptors([sessionInterceptor, csrfInterceptor]),
        ),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(Auth);
    client = TestBed.inject(HttpClient);
  });
  afterEach(() => {
    try {
      http.verify();
    } finally {
      TestBed.resetTestingModule();
    }
  });
  it('loads CSRF before mutation and never sends it to external URLs', async () => {
    const response = firstValueFrom(client.post('/api/v1/tasks', { title: 'Test' }));
    http.expectOne('/api/v1/auth/csrf').flush({ headerName: 'X-CSRF-TOKEN', token: 'test-token' });
    const request = await vi.waitFor(() => http.expectOne('/api/v1/tasks'));
    expect(request.request.headers.get('X-CSRF-TOKEN')).toBe('test-token');
    request.flush({});
    await response;
    const external = firstValueFrom(client.post('https://example.invalid/', {}));
    const outbound = http.expectOne('https://example.invalid/');
    expect(outbound.request.headers.has('X-CSRF-TOKEN')).toBe(false);
    outbound.flush({});
    await external;
  });
  it('does not automatically replay a mutation on CSRF failure', async () => {
    const response = firstValueFrom(client.post('/api/v1/tasks', {}));
    const rejected = expect(response).rejects.toMatchObject({ status: 403 });
    http.expectOne('/api/v1/auth/csrf').flush({ headerName: 'X-CSRF-TOKEN', token: 'test-token' });
    const request = await vi.waitFor(() => http.expectOne('/api/v1/tasks'));
    request.flush({}, { status: 403, statusText: 'Forbidden' });
    http.expectOne('/api/v1/auth/me').flush({ id: '1', username: 'test-owner' });
    await rejected;
    http.expectNone('/api/v1/tasks');
  });
  it('distinguishes an expired-session CSRF 403 without replaying the mutation', async () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    auth.user.set({ id: '1', username: 'test-owner' });
    const response = firstValueFrom(client.post('/api/v1/tasks', {}));
    const rejected = expect(response).rejects.toMatchObject({ status: 403 });
    http.expectOne('/api/v1/auth/csrf').flush({ headerName: 'X-CSRF-TOKEN', token: 'old-token' });
    const request = await vi.waitFor(() => http.expectOne('/api/v1/tasks'));
    request.flush({}, { status: 403, statusText: 'Forbidden' });
    http.expectOne('/api/v1/auth/me').flush({}, { status: 401, statusText: 'Unauthorized' });
    await rejected;
    expect(auth.user()).toBeNull();
    expect(navigate).toHaveBeenCalledWith('/login');
    http.expectNone('/api/v1/tasks');
  });
  it('rotates CSRF after login, restores identity, and clears state on logout', async () => {
    const login = auth.login('test-owner', 'fictitious-password');
    http.expectOne('/api/v1/auth/csrf').flush({ headerName: 'X-CSRF-TOKEN', token: 'pre-login' });
    const loginRequest = await vi.waitFor(() => http.expectOne('/api/v1/auth/login'));
    expect(loginRequest.request.headers.get('X-CSRF-TOKEN')).toBe('pre-login');
    expect(loginRequest.request.body).toContain('username=test-owner');
    loginRequest.flush(null, { status: 204, statusText: 'No Content' });
    const csrf = await vi.waitFor(() => http.expectOne('/api/v1/auth/csrf'));
    csrf.flush({ headerName: 'X-CSRF-TOKEN', token: 'post-login' });
    const me = await vi.waitFor(() => http.expectOne('/api/v1/auth/me'));
    me.flush({ id: '1', username: 'test-owner' });
    await login;
    expect(auth.user()?.username).toBe('test-owner');
    const logout = auth.logout();
    const request = await vi.waitFor(() => http.expectOne('/api/v1/auth/logout'));
    expect(request.request.headers.get('X-CSRF-TOKEN')).toBe('post-login');
    request.flush(null);
    await logout;
    expect(auth.user()).toBeNull();
  });
  it('expires the identity and navigates to login on a protected API 401', async () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    auth.user.set({ id: '1', username: 'test-owner' });
    const response = firstValueFrom(client.get('/api/v1/people'));
    const rejected = expect(response).rejects.toMatchObject({ status: 401 });
    http.expectOne('/api/v1/people').flush({}, { status: 401, statusText: 'Unauthorized' });
    await rejected;
    expect(auth.user()).toBeNull();
    expect(navigate).toHaveBeenCalledWith('/login');
  });
  it('surfaces server unavailability while restoring a session', async () => {
    const response = auth.restore();
    http.expectOne('/api/v1/auth/me').flush({}, { status: 503, statusText: 'Unavailable' });
    expect(await response).toBe(false);
    expect(auth.failure()).not.toBe('');
  });
});
