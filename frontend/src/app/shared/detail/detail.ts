import { Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { Row } from '../../core/api';
import { DisplayPipe } from '../format';
import { Column, Definition } from '../schema';
import { ButtonIcon } from '../button-icon/button-icon';
import { PercentagePipe } from '../percentage';

@Component({
  imports: [MatDialogModule, MatButtonModule, DisplayPipe, PercentagePipe, ButtonIcon],
  templateUrl: './detail.html',
})
export class Detail {
  readonly data = inject<{ row: Row; definition: Definition }>(MAT_DIALOG_DATA);
  readonly displayRow: Row = {
    ...this.data.row,
    ...(typeof this.data.row['benefits'] === 'object' && !Array.isArray(this.data.row['benefits'])
      ? this.data.row['benefits']
      : {}),
  };
  readonly fieldRows: Column[][] = [
    ...this.data.definition.fields
      .filter((field) => field.type !== 'id')
      .map((field) => [
        {
          key: field.key,
          label: field.label,
          group: field.group,
          type: ['amount', 'requestedSalary', 'bonusLetterAmount'].includes(field.key)
            ? 'money'
            : field.type,
        },
      ]),
    ...(
      [
        { key: 'status', label: 'Stato' },
        { key: 'outcomeOn', label: 'Data esito', type: 'date' },
        { key: 'outcomeNotes', label: 'Note esito' },
        { key: 'completedAt', label: 'Completato', type: 'instant' },
        { key: 'archivedAt', label: 'Archiviato', type: 'instant' },
      ] satisfies Column[]
    )
      .filter((field) => this.data.row[field.key])
      .map((field) => [field]),
  ];
}
