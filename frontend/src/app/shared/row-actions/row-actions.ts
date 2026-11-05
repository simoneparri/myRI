import { Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { ButtonIcon, IconName } from '../button-icon/button-icon';

export interface RowAction {
  key: string;
  label: string;
  icon: IconName;
  link?: string[];
}

@Component({
  selector: 'app-row-actions',
  imports: [RouterLink, MatButtonModule, MatMenuModule, ButtonIcon],
  templateUrl: './row-actions.html',
})
export class RowActions {
  readonly actions = input.required<RowAction[]>();
  readonly disabled = input(false);
  readonly selected = output<string>();
}
