import { Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { Row } from '../core/api';
import { DisplayPipe } from './format';
import { Definition } from './schema';

@Component({
  imports: [MatDialogModule, MatButtonModule, DisplayPipe],
  template: `
    <h2 mat-dialog-title>Dettaglio {{ data.definition.singular }}</h2>
    <mat-dialog-content>
      <dl>
        @for (field of data.definition.fields; track field.key) {
          <dt>{{ field.label }}</dt>
          <dd>{{ data.row[field.key] | display: field.type }}</dd>
        }
        <dt>ID</dt>
        <dd>{{ data.row.id }}</dd>
        @if (data.row['status']) {
          <dt>Stato</dt>
          <dd>{{ data.row['status'] | display }}</dd>
        }
        @if (data.row['outcomeOn']) {
          <dt>Data esito</dt>
          <dd>{{ data.row['outcomeOn'] | display: 'date' }}</dd>
        }
        @if (data.row['outcomeNotes']) {
          <dt>Note esito</dt>
          <dd>{{ data.row['outcomeNotes'] }}</dd>
        }
        @if (data.row['salaryId']) {
          <dt>RAL generata</dt>
          <dd>#{{ data.row['salaryId'] }}</dd>
        }
        @if (data.row['sourceRaiseRequestId']) {
          <dt>Richiesta origine</dt>
          <dd>#{{ data.row['sourceRaiseRequestId'] }}</dd>
        }
        @if (data.row['sourceTaskId']) {
          <dt>Task origine</dt>
          <dd>#{{ data.row['sourceTaskId'] }}</dd>
        }
        @if (data.row['completedAt']) {
          <dt>Completato</dt>
          <dd>{{ data.row['completedAt'] | display: 'instant' }}</dd>
        }
        @if (data.row['archivedAt']) {
          <dt>Archiviato</dt>
          <dd>{{ data.row['archivedAt'] | display: 'instant' }}</dd>
        }
      </dl>
    </mat-dialog-content>
    <mat-dialog-actions><button mat-button mat-dialog-close>Chiudi</button></mat-dialog-actions>
  `,
})
export class Detail {
  readonly data = inject<{ row: Row; definition: Definition }>(MAT_DIALOG_DATA);
}
