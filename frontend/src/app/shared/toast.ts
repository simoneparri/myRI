import { Injectable, inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';

@Injectable({ providedIn: 'root' })
export class Toast {
  private readonly snackBar = inject(MatSnackBar);

  success(message: string): void {
    this.snackBar.open(message, 'Chiudi', {
      duration: 4000,
      horizontalPosition: 'end',
      verticalPosition: 'bottom',
      politeness: 'polite',
      panelClass: 'toast-success',
    });
  }

  error(message: string): void {
    this.snackBar.open(message, 'Chiudi', {
      duration: 6000,
      horizontalPosition: 'end',
      verticalPosition: 'bottom',
      politeness: 'assertive',
      panelClass: 'toast-error',
    });
  }
}
