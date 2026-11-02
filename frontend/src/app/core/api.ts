import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

export type Value = string | number | boolean | null;
export interface Row {
  id: string;
  version?: string;
  [key: string]: Value | undefined;
}
export interface Page<T> {
  items: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}
export type Payload = Record<string, Value>;

@Injectable({ providedIn: 'root' })
export class Api {
  private readonly http = inject(HttpClient);
  get<T>(path: string, query: Record<string, string | number | boolean> = {}): Promise<T> {
    return firstValueFrom(
      this.http.get<T>('/api/v1/' + path, { params: new HttpParams({ fromObject: query }) }),
    );
  }
  post<T>(path: string, body: Payload = {}): Promise<T> {
    return firstValueFrom(this.http.post<T>('/api/v1/' + path, body));
  }
  put<T>(path: string, body: Payload): Promise<T> {
    return firstValueFrom(this.http.put<T>('/api/v1/' + path, body));
  }
  async choices(path: string, query: Record<string, string> = {}): Promise<Row[]> {
    const rows: Row[] = [];
    for (let page = 0; ; page++) {
      const result = await this.get<Page<Row>>(path, {
        ...query,
        page,
        size: 100,
        includeArchived: true,
      });
      rows.push(...result.items);
      if (page + 1 >= result.totalPages) return rows;
    }
  }
}

export function errorMessage(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    if (error.status === 401) return 'Sessione scaduta. Accedi nuovamente.';
    if (error.status === 403)
      return 'Sessione o token CSRF non valido. Ricarica la pagina e riprova.';
    if (error.status === 409)
      return 'Conflitto: ricarica i dati prima di riprovare. Nessuna modifica locale e stata applicata.';
    if (error.status === 0) return 'Server non raggiungibile. Verifica la connessione e riprova.';
    const body: unknown = error.error;
    if (body && typeof body === 'object' && 'detail' in body && typeof body.detail === 'string') {
      return body.detail;
    }
  }
  return 'Operazione non riuscita. Riprova o ricarica la pagina.';
}
