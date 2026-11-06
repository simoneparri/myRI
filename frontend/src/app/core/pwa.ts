import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { SwUpdate } from '@angular/service-worker';
import { MatSnackBar } from '@angular/material/snack-bar';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter, fromEvent, interval } from 'rxjs';

type BrowserPermission = NotificationPermission | 'unsupported';

@Injectable({ providedIn: 'root' })
export class Pwa {
  private readonly updates = inject(SwUpdate);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);
  readonly notificationPermission = signal<BrowserPermission>(
    typeof Notification === 'undefined' || !('serviceWorker' in navigator)
      ? 'unsupported'
      : Notification.permission,
  );
  readonly notificationError = signal('');

  constructor() {
    if (!this.updates.isEnabled) return;
    this.updates.versionUpdates
      .pipe(filter((event) => event.type === 'VERSION_READY'))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.offerUpdate());
    void navigator.serviceWorker.ready.then(
      () => this.checkForUpdate(),
      () =>
        this.snackBar.open('Registrazione del service worker non riuscita.', 'Chiudi', {
          duration: 6000,
        }),
    );
    fromEvent(window, 'online')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => void this.checkForUpdate());
    interval(6 * 60 * 60 * 1000)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => void this.checkForUpdate());
  }

  get browserNotificationsSupported(): boolean {
    return (
      this.updates.isEnabled && typeof Notification !== 'undefined' && 'serviceWorker' in navigator
    );
  }

  async requestBrowserNotifications(): Promise<void> {
    this.notificationError.set('');
    if (!this.browserNotificationsSupported) {
      this.notificationError.set('Le notifiche browser non sono disponibili in questo ambiente.');
      return;
    }
    if (Notification.permission === 'denied') {
      this.notificationPermission.set('denied');
      this.snackBar.open(
        'Permesso negato: abilita le notifiche myRI dalle impostazioni del browser.',
        'Chiudi',
        { duration: 6000 },
      );
      return;
    }
    try {
      const permission = await Notification.requestPermission();
      this.notificationPermission.set(permission);
      this.snackBar.open(
        permission === 'granted'
          ? 'Notifiche browser attivate.'
          : 'Permesso alle notifiche non concesso.',
        'Chiudi',
        { duration: 4000 },
      );
    } catch {
      const message = 'Non è stato possibile richiedere il permesso alle notifiche.';
      this.notificationError.set(message);
      this.snackBar.open(message, 'Chiudi', { duration: 6000 });
    }
  }

  async showUnreadNotification(): Promise<void> {
    if (!this.browserNotificationsSupported || Notification.permission !== 'granted') return;
    this.notificationError.set('');
    try {
      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification('myRI', {
        body: 'Hai nuove notifiche da consultare.',
        icon: '/favicon.svg',
        tag: 'myri-unread-notifications',
      });
    } catch {
      const message = 'Non è stato possibile mostrare la notifica browser.';
      this.notificationError.set(message);
      this.snackBar.open(message, 'Chiudi', { duration: 6000 });
    }
  }

  private offerUpdate(): void {
    const notice = this.snackBar.open('È disponibile una nuova versione di myRI.', 'Aggiorna', {
      duration: undefined,
      horizontalPosition: 'end',
      verticalPosition: 'top',
    });
    notice.onAction().subscribe(() => void this.activateUpdate());
  }

  private async activateUpdate(): Promise<void> {
    try {
      if (await this.updates.activateUpdate()) window.location.reload();
    } catch {
      this.snackBar.open(
        'Aggiornamento non riuscito. Ricarica la pagina per riprovare.',
        'Chiudi',
        { duration: 6000 },
      );
    }
  }

  private async checkForUpdate(): Promise<void> {
    if (!navigator.onLine) return;
    try {
      await this.updates.checkForUpdate();
    } catch {
      this.snackBar.open('Verifica aggiornamenti temporaneamente non disponibile.', 'Chiudi', {
        duration: 6000,
      });
    }
  }
}
