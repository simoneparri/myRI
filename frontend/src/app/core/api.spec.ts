import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Api, errorMessage } from './api';

describe('API helpers', () => {
  it('loads reference options beyond the first hundred items', async () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const api = TestBed.inject(Api);
    const get = vi
      .spyOn(api, 'get')
      .mockResolvedValueOnce({
        items: [{ id: '9007199254740993', firstName: 'Fittizia' }],
        totalPages: 2,
      })
      .mockResolvedValueOnce({
        items: [{ id: '9007199254740994', firstName: 'Seconda' }],
        totalPages: 2,
      });
    const rows = await api.choices('people');
    expect(rows.map((row) => row.id)).toEqual(['9007199254740993', '9007199254740994']);
    expect(get).toHaveBeenLastCalledWith('people', { page: 1, size: 100, includeArchived: true });
  });
  it('does not expose raw server stack traces or arbitrary HTML error responses', () => {
    expect(
      errorMessage(
        new HttpErrorResponse({ status: 500, error: '<script>private database error</script>' }),
      ),
    ).toBe('Operazione non riuscita. Riprova o ricarica la pagina.');
  });
});
