import { Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-confirm',
  imports: [MatDialogModule, MatButtonModule],
  template: `
    <h2 mat-dialog-title>Conferma operazione</h2>
    <mat-dialog-content>{{ message }}</mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="dialog.close(false)">Annulla</button>
      <button mat-flat-button (click)="dialog.close(true)">Conferma</button>
    </mat-dialog-actions>
  `,
})
export class Confirm {
  readonly message = inject<string>(MAT_DIALOG_DATA);
  readonly dialog = inject(MatDialogRef<Confirm, boolean>);
}
