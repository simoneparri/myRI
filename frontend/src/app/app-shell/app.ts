import { Component, effect, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { Auth } from '../core/auth';
import { errorMessage } from '../core/api';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, MatButtonModule],
  templateUrl: './app.html',
})
export class App {
  readonly auth = inject(Auth);
  private readonly router = inject(Router);
  private readonly dialogs = inject(MatDialog);
  readonly error = signal('');
  readonly busy = signal(false);
  constructor() {
    effect(() => {
      if (!this.auth.user()) this.dialogs.closeAll();
    });
  }
  async logout(): Promise<void> {
    this.busy.set(true);
    this.error.set('');
    try {
      await this.auth.logout();
      await this.router.navigateByUrl('/login');
    } catch (error) {
      this.error.set(errorMessage(error));
    } finally {
      this.busy.set(false);
    }
  }
}
