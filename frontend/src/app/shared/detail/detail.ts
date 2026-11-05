import { Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { Row } from '../../core/api';
import { DisplayPipe } from '../format';
import { Definition } from '../schema';
import { ButtonIcon } from '../button-icon/button-icon';

@Component({
  imports: [MatDialogModule, MatButtonModule, DisplayPipe, ButtonIcon],
  templateUrl: './detail.html',
})
export class Detail {
  readonly data = inject<{ row: Row; definition: Definition }>(MAT_DIALOG_DATA);
}
