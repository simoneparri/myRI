import { Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatInputModule } from '@angular/material/input';
import { HttpErrorResponse } from '@angular/common/http';
import { Auth } from '../../core/auth';
import { errorMessage } from '../../core/api';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, MatButtonModule, MatCardModule, MatInputModule],
  templateUrl: './login.html',
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
