import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatPaginatorIntl, MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSelectModule } from '@angular/material/select';
import { Api, Page, Row, errorMessage } from '../../core/api';
import { DisplayPipe } from '../../shared/format';
import { italianPaginator } from '../../shared/paginator';
import { MatDialog } from '@angular/material/dialog';
import { Detail } from '../../shared/detail/detail';
import { definitions } from '../../shared/schema';
import { NotificationInbox, notificationTitle } from '../../core/notification-inbox';
import { RowActions, RowAction } from '../../shared/row-actions/row-actions';

@Component({
  imports: [
    FormsModule,
    MatButtonModule,
    MatCheckboxModule,
    MatPaginatorModule,
    MatSelectModule,
    DisplayPipe,
    RowActions,
  ],
  providers: [{ provide: MatPaginatorIntl, useFactory: italianPaginator }],
  templateUrl: './notifications.html',
})
export class Notifications {
  private readonly api = inject(Api);
  private readonly dialogs = inject(MatDialog);
  private readonly inbox = inject(NotificationInbox);
  readonly title = notificationTitle;
  readonly data = signal<Page<Row>>({
    items: [],
    page: 0,
    size: 20,
    totalElements: 0,
    totalPages: 0,
  });
  readonly error = signal('');
  readonly loading = signal(false);
  readonly busy = signal(false);
  kind = '';
  unread = false;
  archived = false;
  pageIndex = 0;
  private query: Record<string, string | boolean> = {};
  private generation = 0;
  constructor() {
    inject(ActivatedRoute)
      .queryParamMap.pipe(takeUntilDestroyed())
      .subscribe((params) => {
        this.unread = params.get('unread') === 'true';
        this.search();
      });
  }
  actionsFor(item: Row): RowAction[] {
    const actions: RowAction[] = [];
    if (item['personId'])
      actions.push({
        key: 'person',
        label: `Scheda persona #${item['personId']}`,
        icon: 'person',
        link: ['/people', String(item['personId'])],
      });
    if (item['taskId']) actions.push({ key: 'task', label: 'Apri task', icon: 'detail' });
    if (!item['readAt'] && !item['archivedAt'])
      actions.push({ key: 'read', label: 'Segna letta', icon: 'check' });
    if (!item['archivedAt'])
      actions.push({ key: 'archive', label: 'Archivia notifica', icon: 'archive' });
    return actions;
  }
  runAction(item: Row, action: string): void {
    if (action === 'task') void this.openTask(item);
    else if (action === 'read' || action === 'archive') void this.mark(item, action);
  }
  async openTask(item: Row): Promise<void> {
    this.busy.set(true);
    this.error.set('');
    try {
      const row = await this.api.get<Row>(`tasks/${item['taskId']}`);
      this.dialogs.open(Detail, {
        data: { row, definition: definitions.tasks },
        width: '680px',
        maxWidth: '95vw',
      });
    } catch (error) {
      this.error.set(errorMessage(error));
    } finally {
      this.busy.set(false);
    }
  }
  search(): void {
    this.pageIndex = 0;
    this.query = {
      unreadOnly: this.unread,
      includeArchived: this.archived,
      ...(this.kind ? { kind: this.kind } : {}),
    };
    void this.load();
  }
  paginate(event: PageEvent): void {
    this.pageIndex = event.pageIndex;
    void this.load();
  }
  async load(): Promise<void> {
    const generation = ++this.generation;
    this.loading.set(true);
    this.error.set('');
    try {
      const data = await this.api.get<Page<Row>>('notifications', {
        ...this.query,
        page: this.pageIndex,
        size: 20,
      });
      if (generation !== this.generation) return;
      this.data.set(data);
      if (data.items.length === 0 && this.pageIndex > 0) {
        this.pageIndex--;
        await this.load();
      }
    } catch (error) {
      if (generation === this.generation) {
        this.error.set(errorMessage(error));
        this.data.set({ items: [], page: 0, size: 20, totalElements: 0, totalPages: 0 });
      }
    } finally {
      if (generation === this.generation) this.loading.set(false);
    }
  }
  async mark(item: Row, command: 'read' | 'archive'): Promise<void> {
    this.busy.set(true);
    this.error.set('');
    try {
      await this.api.post(`notifications/${item.id}/${command}`, { version: item.version ?? null });
      void this.inbox.refresh();
      await this.load();
    } catch (error) {
      this.error.set(errorMessage(error));
    } finally {
      this.busy.set(false);
    }
  }
}
