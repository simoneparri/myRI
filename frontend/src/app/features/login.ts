import { Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatInputModule } from '@angular/material/input';
import { HttpErrorResponse } from '@angular/common/http';
import { Auth } from '../core/auth';
import { errorMessage } from '../core/api';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, MatButtonModule, MatCardModule, MatInputModule],
  template: `
    <section class="login" aria-labelledby="login-title">
      <mat-card>
        <mat-card-header><h1 mat-card-title id="login-title">Accedi a myRI</h1></mat-card-header>
        <mat-card-content>
          <p>People management personale</p>
          @if (error() || auth.failure()) {
            <p role="alert" class="error">{{ error() || auth.failure() }}</p>
          }
          <form [formGroup]="form" (ngSubmit)="login()" class="editor-form">
            <mat-form-field appearance="outline">
              <mat-label>Nome utente</mat-label>
              <input matInput formControlName="username" autocomplete="username" required />
              <mat-error>Inserisci il nome utente.</mat-error>
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Password</mat-label>
              <input
                matInput
                type="password"
                formControlName="password"
                autocomplete="current-password"
                required
              />
              <mat-error>Inserisci la password.</mat-error>
            </mat-form-field>
            <button mat-flat-button [disabled]="busy()">
              {{ busy() ? 'Accesso...' : 'Accedi' }}
            </button>
          </form>
        </mat-card-content>
      </mat-card>
    </section>
  `,
})
export class Login {
  readonly auth = inject(Auth);
  private readonly router = inject(Router);
  readonly error = signal('');
  readonly busy = signal(false);
  readonly form = new FormGroup({
    username: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    password: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });
  async login(): Promise<void> {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    try {
      const { username, password } = this.form.getRawValue();
      await this.auth.login(username, password);
      this.form.controls.password.reset();
      await this.router.navigateByUrl('/people');
    } catch (error) {
      this.error.set(
        error instanceof HttpErrorResponse && error.status === 401
          ? 'Nome utente o password non validi.'
          : 'Accesso non riuscito. ' + errorMessage(error),
      );
      this.form.controls.password.reset();
    } finally {
      this.busy.set(false);
    }
  }
}
