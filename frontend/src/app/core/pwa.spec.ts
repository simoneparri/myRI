import { TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { Subject } from 'rxjs';
import { Pwa } from './pwa';

describe('Pwa', () => {
  const serviceWorkerDescriptor = Object.getOwnPropertyDescriptor(navigator, 'serviceWorker');
  afterEach(() => {
    TestBed.resetTestingModule();
    vi.unstubAllGlobals();
    if (serviceWorkerDescriptor) {
      Object.defineProperty(navigator, 'serviceWorker', serviceWorkerDescriptor);
    } else {
      Reflect.deleteProperty(navigator, 'serviceWorker');
    }
  });

  it('notifies the user when a new app version is ready', () => {
    const versionUpdates = new Subject<VersionReadyEvent>();
    const action = new Subject<void>();
    const open = vi.fn().mockReturnValue({ onAction: () => action });
    TestBed.configureTestingModule({
      providers: [
        {
          provide: SwUpdate,
          useValue: {
            isEnabled: true,
            versionUpdates,
            checkForUpdate: vi.fn().mockResolvedValue(false),
            activateUpdate: vi.fn().mockResolvedValue(true),
          },
        },
        { provide: MatSnackBar, useValue: { open } },
      ],
    });
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: { ready: Promise.resolve({}) },
    });

    TestBed.inject(Pwa);
    versionUpdates.next({
      type: 'VERSION_READY',
      currentVersion: { hash: 'old' },
      latestVersion: { hash: 'new' },
    });

    expect(open).toHaveBeenCalledWith(
      'È disponibile una nuova versione di myRI.',
      'Aggiorna',
      expect.objectContaining({ duration: undefined }),
    );
  });

  it('uses the service worker for generic unread notifications after permission is granted', async () => {
    const showNotification = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: { ready: Promise.resolve({ showNotification }) },
    });
    vi.stubGlobal('Notification', {
      permission: 'granted',
      requestPermission: vi.fn(),
    });
    TestBed.configureTestingModule({
      providers: [
        {
          provide: SwUpdate,
          useValue: {
            isEnabled: true,
            versionUpdates: new Subject<VersionReadyEvent>(),
            checkForUpdate: vi.fn().mockResolvedValue(false),
            activateUpdate: vi.fn().mockResolvedValue(true),
          },
        },
        { provide: MatSnackBar, useValue: { open: vi.fn() } },
      ],
    });

    await TestBed.inject(Pwa).showUnreadNotification();

    expect(showNotification).toHaveBeenCalledWith('myRI', {
      body: 'Hai nuove notifiche da consultare.',
      icon: '/favicon.svg',
      tag: 'myri-unread-notifications',
    });
  });
});
