import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  FormControl,
  FormRecord,
  ReactiveFormsModule,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { Api, Payload, Row, errorMessage } from '../core/api';
import { DisplayPipe, TIMEZONE, calendarDate, moneyDisplay, personLabel } from './format';
import { Field, Option, Resource, definitions, newLabel } from './schema';
import { ButtonIcon } from './button-icon';
import { DateInput, dateInputDisplay, parseDateInput } from './date-input';

export interface EditorData {
  resource: Resource;
  path: string;
  row?: Row;
  personId?: string;
  command?: 'approve' | 'reject' | 'postpone';
}

export function validatorsFor(field: Field): ValidatorFn[] {
  const rules: ValidatorFn[] = [];
  if (field.required) rules.push(Validators.required, Validators.pattern(/\S/));
  if (field.max) rules.push(Validators.maxLength(field.max));
  if (field.type === 'email') rules.push(Validators.email);
  if (field.type === 'id')
    rules.push(Validators.pattern(/^[1-9]\d{0,18}$/), (control) =>
      control.value && control.value.length === 19 && control.value > '9223372036854775807'
        ? { max: true }
        : null,
    );
  if (field.type === 'integer')
    rules.push(Validators.pattern(/^[1-9]\d{0,9}$/), (control) =>
      control.value && Number(control.value) > 2147483647 ? { max: true } : null,
    );
  if (field.type === 'decimal') {
    const maxIntegerDigits =
      field.key === 'requestedPercentage' ? 5 : field.key === 'weeklyHours' ? 3 : 10;
    rules.push(
      Validators.pattern(
        new RegExp(
          `^(?:0|[1-9]\\d{0,${maxIntegerDigits - 1}})(?:\\.\\d{1,${field.fraction ?? 2}})?$`,
        ),
      ),
      (control) =>
        typeof control.value === 'string' &&
        /^\d+(?:\.\d+)?$/.test(control.value) &&
        BigInt(control.value.replace('.', '')) === 0n
          ? { min: true }
          : null,
    );
    if (field.key === 'weeklyHours')
      rules.push((control) =>
        control.value && Number(control.value) > 168 ? { max: true } : null,
      );
  }
  if (field.key === 'currency') rules.push(Validators.pattern(/^[A-Z]{3}$/));
  if (field.type === 'date') rules.push(Validators.pattern(/^[1-9]\d{3}-\d{2}-\d{2}$/));
  if (field.type === 'date' || field.type === 'instant')
    rules.push((control) =>
      control.value &&
      !parseDateInput(dateInputDisplay(String(control.value)), field.type === 'instant')
        ? { dateInput: true }
        : null,
    );
  return rules;
}

export function payloadFor(fields: Field[], values: Record<string, string>): Payload {
  const payload: Payload = {};
  for (const field of fields) {
    const value = values[field.key]?.trim() ?? '';
    payload[field.key] =
      value === ''
        ? null
        : field.type === 'integer'
          ? Number(value)
          : field.type === 'instant'
            ? new Date(value + 'Z').toISOString()
            : value;
  }
  return payload;
}

@Component({
  selector: 'app-editor',
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    DisplayPipe,
    ButtonIcon,
    DateInput,
  ],
  template: `
    <h2 mat-dialog-title>{{ title }}</h2>
    <mat-dialog-content>
      @if (error()) {
        <p role="alert" class="error">{{ error() }}</p>
      }
      @if (loading()) {
        <p role="status">Caricamento riferimenti...</p>
      }
      @if (data.resource === 'salaries') {
        <p>Lo storico e immutabile. Per correggere una RAL si aggiunge una nuova voce motivata.</p>
      }
      @if (data.command === 'approve') {
        <p>L'approvazione e definitiva. La nuova RAL e facoltativa.</p>
      }
      <form id="entity-form" [formGroup]="form" (ngSubmit)="save()" class="editor-form">
        @for (field of fields; track field.key) {
          @if (field.type === 'date' || field.type === 'instant') {
            <app-date-input
              [formControlName]="field.key"
              [label]="field.label"
              [required]="!!field.required"
              [instant]="field.type === 'instant'"
            />
          } @else {
            <mat-form-field appearance="outline">
              <mat-label>{{ field.label }}</mat-label>
              @if (field.reference || field.type === 'select') {
                <mat-select [formControlName]="field.key" [required]="!!field.required">
                  @if (!field.required) {
                    <mat-option value="">Nessuno</mat-option>
                  }
                  @for (option of options()[field.key] || field.options || []; track option.value) {
                    <mat-option [value]="option.value">{{ option.label | display }}</mat-option>
                  }
                </mat-select>
              } @else if (field.type === 'textarea') {
                <textarea
                  matInput
                  [formControlName]="field.key"
                  rows="3"
                  [required]="!!field.required"
                  [attr.maxlength]="field.max ?? null"
                ></textarea>
              } @else {
                <input
                  matInput
                  [formControlName]="field.key"
                  [required]="!!field.required"
                  step="any"
                  [type]="field.type === 'email' ? 'email' : 'text'"
                  [attr.maxlength]="field.max ?? null"
                  [attr.inputmode]="
                    field.type === 'decimal' || field.type === 'integer' ? 'decimal' : null
                  "
                />
              }
              @if (form.controls[field.key].invalid) {
                <mat-error
                  >Valore richiesto o formato non valido{{
                    field.type === 'decimal' ? ' (usa il punto decimale)' : ''
                  }}.</mat-error
                >
              }
            </mat-form-field>
          }
        }
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button [disabled]="saving()" (click)="close()">
        <svg appButtonIcon="close"></svg>Annulla
      </button>
      <button
        mat-flat-button
        type="submit"
        form="entity-form"
        [disabled]="saving() || loading() || referencesFailed()"
      >
        <svg appButtonIcon="save"></svg>
        {{ saving() ? 'Salvataggio...' : 'Salva' }}
      </button>
    </mat-dialog-actions>
  `,
})
export class Editor {
  readonly data = inject<EditorData>(MAT_DIALOG_DATA);
  private readonly ref = inject(MatDialogRef<Editor, boolean>);
  private readonly api = inject(Api);
  private readonly destroy = inject(DestroyRef);
  private readonly timezone = inject(TIMEZONE);
  private readonly display = new DisplayPipe();
  readonly fields: Field[];
  readonly title: string;
  readonly form = new FormRecord<FormControl<string>>({});
  readonly error = signal('');
  readonly saving = signal(false);
  readonly loading = signal(false);
  readonly referencesFailed = signal(false);
  readonly options = signal<Record<string, Option[]>>({});
  private generation = 0;
  private readonly requestKey = crypto.randomUUID();

  constructor() {
    this.fields = this.data.command
      ? this.decisionFields()
      : definitions[this.data.resource].fields;
    this.title = this.data.command
      ? {
          approve: 'Approva richiesta',
          reject: 'Rifiuta richiesta',
          postpone: 'Rimanda richiesta',
        }[this.data.command]
      : this.data.row
        ? 'Modifica ' + definitions[this.data.resource].singular
        : newLabel(this.data.resource);
    for (const field of this.fields) {
      const current = this.data.row?.[field.key];
      let value = current == null ? (field.initial ?? '') : String(current);
      if (field.type === 'instant' && value) value = value.replace(/Z$/, '');
      if (field.key === 'personId' && this.data.personId) value = this.data.personId;
      const fixed =
        (!!this.data.row && !!field.immutable) ||
        (field.key === 'personId' && !!this.data.personId);
      this.form.addControl(
        field.key,
        new FormControl(
          { value, disabled: fixed },
          {
            nonNullable: true,
            validators: validatorsFor(field),
          },
        ),
      );
    }
    this.form.controls['personId']?.valueChanges
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe(() => {
        if (!this.data.row) this.form.controls['baseSalaryId']?.setValue('');
        this.form.controls['careerTalkId']?.setValue('');
        this.form.controls['raiseRequestId']?.setValue('');
        void this.loadOptions();
      });
    void this.loadOptions();
    this.ref.disableClose = true;
  }
  private decisionFields(): Field[] {
    return [
      {
        key: 'outcomeOn',
        label: 'Data esito',
        type: 'date',
        required: true,
        initial: calendarDate(new Date(), this.timezone),
      },
      { key: 'outcomeNotes', label: 'Note esito', type: 'textarea', max: 10000 },
      ...(this.data.command === 'approve'
        ? [
            {
              key: 'createSalary',
              label: 'Generare nuova RAL?',
              type: 'select' as const,
              required: true,
              initial: 'false',
              options: [
                { value: 'false', label: 'No' },
                { value: 'true', label: 'Si' },
              ],
            },
            {
              key: 'effectiveOn',
              label: 'Decorrenza RAL (solo se generata)',
              type: 'date' as const,
            },
          ]
        : []),
    ];
  }
  private async loadOptions(): Promise<void> {
    const generation = ++this.generation;
    this.loading.set(true);
    this.referencesFailed.set(false);
    try {
      const results: Record<string, Option[]> = {};
      const personId = this.form.controls['personId']?.value || this.data.personId;
      await Promise.all(
        this.fields
          .filter((field) => field.reference)
          .map(async (field) => {
            const path =
              field.reference === 'salaries'
                ? personId
                  ? `people/${personId}/salaries`
                  : null
                : field.reference;
            if (!path) {
              results[field.key] = [];
              return;
            }
            const rows = await this.api.choices(
              path,
              field.reference !== 'people' && field.reference !== 'salaries' && personId
                ? { personId }
                : {},
            );
            results[field.key] = rows
              .filter((row) => field.key !== 'managerId' || row.id !== this.data.row?.id)
              .map((row) => ({
                value: row.id,
                label:
                  field.reference === 'people'
                    ? personLabel(row)
                    : field.reference === 'salaries'
                      ? `${moneyDisplay(String(row['amount']))} ${row['currency']} - ${this.display.transform(row['effectiveOn'], 'date')} (#${row.id})`
                      : `${row['title'] ?? this.display.transform(row['heldAt'] ?? row['requestedOn'], row['heldAt'] ? 'instant' : 'date')} (#${row.id}, persona #${row['personId']})`,
              }));
          }),
      );
      if (generation === this.generation) this.options.set(results);
    } catch (error) {
      if (generation === this.generation) {
        this.error.set(errorMessage(error));
        this.referencesFailed.set(true);
      }
    } finally {
      if (generation === this.generation) this.loading.set(false);
    }
  }
  close(): void {
    this.ref.close(false);
  }
  async save(): Promise<void> {
    if (this.saving() || this.loading()) return;
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    this.error.set('');
    const values = this.form.getRawValue();
    if (
      this.data.resource === 'raise-requests' &&
      !this.data.command &&
      !values['requestedSalary'] &&
      !values['requestedPercentage']
    ) {
      this.error.set('Indica una RAL target o una percentuale.');
      return;
    }
    if (values['managerId'] && values['externalManager']) {
      this.error.set('Scegli un solo tipo di manager.');
      return;
    }
    if (
      this.data.resource === 'tasks' &&
      (!!values['recurrenceFrequency'] !== !!values['recurrenceInterval'] ||
        (!!values['recurrenceFrequency'] && !values['dueAt']))
    ) {
      this.error.set('La ricorrenza richiede frequenza, intervallo e scadenza.');
      return;
    }
    if (
      this.data.command === 'approve' &&
      (values['createSalary'] === 'true') !== !!values['effectiveOn']
    ) {
      this.error.set('Indica la decorrenza se e solo se generi una nuova RAL.');
      return;
    }
    this.saving.set(true);
    try {
      const payload = payloadFor(this.fields, values);
      if (this.data.row) payload['version'] = this.data.row.version ?? null;
      if (this.data.resource === 'salaries') payload['requestKey'] = this.requestKey;
      if (this.data.command === 'approve')
        payload['createSalary'] = values['createSalary'] === 'true';
      if (this.data.command)
        await this.api.post(`${this.data.path}/${this.data.row?.id}/${this.data.command}`, payload);
      else if (this.data.row)
        await this.api.put(`${this.data.resource}/${this.data.row.id}`, payload);
      else await this.api.post(this.data.path, payload);
      this.ref.close(true);
    } catch (error) {
      this.error.set(errorMessage(error));
    } finally {
      this.saving.set(false);
    }
  }
}
