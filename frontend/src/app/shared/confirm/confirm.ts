import { Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { ButtonIcon } from '../button-icon/button-icon';

@Component({
  selector: 'app-confirm',
  imports: [MatDialogModule, MatButtonModule, ButtonIcon],
  templateUrl: './confirm.html',
})
export class Confirm {
  readonly message = inject<string>(MAT_DIALOG_DATA);
  readonly dialog = inject(MatDialogRef<Confirm, boolean>);
}
