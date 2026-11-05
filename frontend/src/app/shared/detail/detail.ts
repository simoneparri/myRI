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
  readonly fieldRows: Column[][] = [
    ...this.data.definition.fields.map((field) => [
      {
        key: field.key,
        label: field.label,
        group: field.group,
        type: ['amount', 'requestedSalary', 'bonusLetterAmount'].includes(field.key)
          ? 'money'
          : field.type,
      },
    ]),
    [{ key: 'id', label: 'ID' }],
    ...(
      [
        { key: 'status', label: 'Stato' },
        { key: 'outcomeOn', label: 'Data esito', type: 'date' },
        { key: 'outcomeNotes', label: 'Note esito' },
        { key: 'salaryId', label: 'RAL generata', type: 'reference' },
        { key: 'sourceRaiseRequestId', label: 'Richiesta origine', type: 'reference' },
        { key: 'sourceTaskId', label: 'Task origine', type: 'reference' },
        { key: 'completedAt', label: 'Completato', type: 'instant' },
        { key: 'archivedAt', label: 'Archiviato', type: 'instant' },
      ] satisfies Column[]
    )
      .filter((field) => this.data.row[field.key])
      .map((field) => [field]),
  ];
}
