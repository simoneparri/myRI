import { DOCUMENT } from '@angular/common';
import {
  AfterViewInit,
  Component,
  DestroyRef,
  ElementRef,
  OnDestroy,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
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
import { Api, Payload, Row, errorMessage } from '../../core/api';
import { DisplayPipe, TIMEZONE, calendarDate, moneyDisplay, personLabel } from '../format';
import { Field, Option, Resource, definitions, newLabel } from '../schema';
import { ButtonIcon } from '../button-icon/button-icon';
import { DateInput, dateInputDisplay, parseDateInput } from '../date-input/date-input';
import {
  FrameworkOption,
  frameworkOptions as deviconFrameworkOptions,
  frameworkIconClass,
} from '../framework-catalog';
import { FrameworkIcons } from '../framework-icons';
import intlTelInput, { NUMBER_FORMAT, type Iti } from 'intl-tel-input';

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
  if (field.pattern) rules.push(Validators.pattern(field.pattern));
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
  if (field.key === 'frameworks')
    rules.push((control) => {
      const entries = String(control.value)
        .split(/\r?\n/)
        .map((entry) => entry.trim())
        .filter(Boolean);
      const normalized = entries.map((entry) => entry.toLowerCase());
      return entries.length > 50 ||
        entries.some((entry) => entry.length > 100) ||
        new Set(normalized).size !== normalized.length
        ? { frameworks: true }
        : null;
    });
  return rules;
}

export function payloadFor(fields: Field[], values: Record<string, string>): Payload {
  const payload: Payload = {};
  for (const field of fields) {
    const value = values[field.key]?.trim() ?? '';
    payload[field.key] =
      field.key === 'frameworks'
        ? value
            .split(/\r?\n/)
            .map((entry) => entry.trim())
            .filter(Boolean)
        : value === ''
        ? null
        : field.type === 'integer'
          ? Number(value)
          : field.type === 'instant'
            ? new Date(value + 'Z').toISOString()
            : value;
  }
  return payload;
}

function cents(value: string): bigint | null {
  const match = /^(0|[1-9]\d*)(?:\.(\d{1,2}))?$/.exec(value);
  if (!match) return null;
  return BigInt(match[1]) * 100n + BigInt((match[2] ?? '').padEnd(2, '0'));
}

export function increasePercentage(baseAmount: string, targetAmount: string): string | null {
  const base = cents(baseAmount);
  const target = cents(targetAmount);
  if (base === null || target === null || base <= 0n || target <= base) return null;

  // Percentuali espresse in decimi: ceil((target - base) / base * 1000).
  const numerator = (target - base) * 1000n;
  const tenths = (numerator + base - 1n) / base;
  if (tenths > 999999n) return null;
  const whole = tenths / 10n;
  const decimal = tenths % 10n;
  return decimal === 0n ? whole.toString() : `${whole}.${decimal}`;
}

export function roundedPercentageMatchesTarget(
  baseAmount: string,
  targetAmount: string,
  percentage: string,
): boolean {
  const base = cents(baseAmount);
  const target = cents(targetAmount);
  const match = /^(\d+)(?:\.(\d))?$/.exec(percentage);
  if (base === null || target === null || !match || base <= 0n) return false;
  const percentageTenths = BigInt(match[1]) * 10n + BigInt(match[2] ?? '0');
  const targetNumerator = base * (1000n + percentageTenths);
  const roundedTarget = (targetNumerator + 500n) / 1000n;
  return roundedTarget === target;
}

export interface PhoneResolution {
  value: string | null;
  warning: boolean;
  invalid: boolean;
}

export function resolvePhoneValue(
  input: string,
  valid: boolean,
  e164: string,
  legacyValue: string,
  legacyWasInvalid: boolean,
): PhoneResolution {
  if (input.trim() && valid && e164.startsWith('+'))
    return { value: e164, warning: false, invalid: false };
  if (!input.trim() && !legacyWasInvalid)
    return { value: null, warning: false, invalid: false };
  if (legacyWasInvalid && legacyValue)
    return { value: legacyValue, warning: true, invalid: false };
  return { value: null, warning: false, invalid: !!input.trim() };
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
  templateUrl: './editor.html',
})
export class Editor implements AfterViewInit, OnDestroy {
  readonly data = inject<EditorData>(MAT_DIALOG_DATA);
  private readonly ref = inject(MatDialogRef<Editor, boolean>);
  private readonly api = inject(Api);
  private readonly destroy = inject(DestroyRef);
  private readonly document = inject(DOCUMENT);
  private readonly timezone = inject(TIMEZONE);
  private readonly frameworkIcons = inject(FrameworkIcons);
  private readonly display = new DisplayPipe();
  readonly fields: Field[];
  readonly title: string;
  readonly form = new FormRecord<FormControl<string>>({});
  readonly error = signal('');
  readonly saving = signal(false);
  readonly automaticPercentage = signal(false);
  readonly percentageMatchesTarget = signal(false);
  readonly phoneNotice = signal('');
  readonly loading = signal(false);
  readonly referencesFailed = signal(false);
  readonly options = signal<Record<string, Option[]>>({});
  readonly baseSalaryAmounts = signal<Record<string, string>>({});
  readonly frameworkOptions = deviconFrameworkOptions;
  frameworkSearch = '';
  @ViewChild('phoneInput') private phoneInputElement?: ElementRef<HTMLInputElement>;
  private phonePlugin?: Iti;
  private phoneStylesPromise?: Promise<void>;
  private phoneOriginalValue = '';
  private phoneOriginalWasInvalid = false;
  private generation = 0;
  private readonly requestKey = crypto.randomUUID();

  constructor() {
    this.fields = this.data.command
      ? this.decisionFields()
      : definitions[this.data.resource].fields.map((field) =>
          field.requiredOnCreate
            ? { ...field, required: !this.data.row || !!this.data.row[field.key] }
            : field,
        );
    this.title = this.data.command
      ? {
          approve: 'Approva richiesta',
          reject: 'Rifiuta richiesta',
          postpone: 'Rimanda richiesta',
        }[this.data.command]
      : this.data.row
        ? 'Modifica ' + definitions[this.data.resource].singular
        : newLabel(this.data.resource);
    if (this.fields.some((field) => field.type === 'framework-multiselect'))
      this.frameworkIcons.load();
    for (const field of this.fields) {
      const current = this.data.row?.[field.key];
      let value =
        field.key === 'frameworks' && Array.isArray(current)
          ? current.join('\n')
          : current == null
            ? (field.initial ?? '')
            : String(current);
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
    this.phoneOriginalValue = String(this.data.row?.['phone'] ?? '');
    this.setupRaisePercentage();
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
  ngAfterViewInit(): void {
    const input = this.phoneInputElement?.nativeElement;
    if (!input) return;
    void this.loadPhoneInputStyles().then(() => {
      if (this.destroy.destroyed) return;
      this.initializePhoneInput(input);
    });
  }
  private loadPhoneInputStyles(): Promise<void> {
    if (this.phoneStylesPromise) return this.phoneStylesPromise;
    this.phoneStylesPromise = new Promise((resolve) => {
      const stylesheet = this.document.createElement('link');
      stylesheet.id = 'intl-tel-input-stylesheet';
      stylesheet.rel = 'stylesheet';
      stylesheet.href = new URL(
        'assets/devicon/intl-tel-input/css/intlTelInput.css',
        this.document.baseURI,
      ).toString();
      stylesheet.onload = () => resolve();
      stylesheet.onerror = () => resolve();
      this.document.head.append(stylesheet);
    });
    return this.phoneStylesPromise;
  }
  private initializePhoneInput(input: HTMLInputElement): void {
    this.phonePlugin = intlTelInput(input, {
      initialCountry: 'it',
      countryNameLocale: 'it',
      countrySelectorMode: 'DROPDOWN',
      loadUtils: () => import('intl-tel-input/utils'),
    });
    void this.phonePlugin.promise
      .then(() => {
        this.phoneOriginalWasInvalid =
          !!this.phoneOriginalValue.trim() && !this.phonePlugin?.isValidNumber();
        this.updatePhoneNotice();
      })
      .catch(() => {
        this.phoneOriginalWasInvalid = !!this.phoneOriginalValue.trim();
        this.updatePhoneNotice();
      });
  }
  ngOnDestroy(): void {
    this.phonePlugin?.destroy();
  }
  phoneChanged(): void {
    this.updatePhoneNotice();
  }
  private updatePhoneNotice(): void {
    if (!this.phoneOriginalWasInvalid) {
      this.phoneNotice.set('');
      return;
    }
    if (this.phonePlugin?.isValidNumber()) {
      this.phoneNotice.set('');
      return;
    }
    this.phoneNotice.set(
      'Il numero esistente non e valido e restera invariato finche non inserisci un numero valido.',
    );
  }
  private setupRaisePercentage(): void {
    if (this.data.resource !== 'raise-requests' || this.data.command) return;
    const target = this.form.controls['requestedSalary'];
    const baseId = this.form.controls['baseSalaryId'];
    if (!target || !baseId) return;
    target.valueChanges.pipe(takeUntilDestroyed(this.destroy)).subscribe(() => {
      this.updateRaisePercentage();
    });
    baseId.valueChanges.pipe(takeUntilDestroyed(this.destroy)).subscribe(() => {
      this.updateRaisePercentage();
    });
    this.updateRaisePercentage();
  }
  private updateRaisePercentage(): void {
    const target = this.form.controls['requestedSalary'];
    const percentage = this.form.controls['requestedPercentage'];
    if (!target || !percentage) return;
    if (!target.value.trim()) {
      if (this.automaticPercentage()) percentage.setValue('', { emitEvent: false });
      this.automaticPercentage.set(false);
      this.percentageMatchesTarget.set(false);
      if (percentage.disabled) percentage.enable({ emitEvent: false });
      return;
    }
    const baseAmount = this.baseSalaryAmounts()[this.form.controls['baseSalaryId']?.value];
    const computed = baseAmount ? increasePercentage(baseAmount, target.value.trim()) : null;
    this.automaticPercentage.set(true);
    this.percentageMatchesTarget.set(
      !!baseAmount &&
        !!computed &&
        roundedPercentageMatchesTarget(baseAmount, target.value.trim(), computed),
    );
    percentage.setValue(computed ?? '', { emitEvent: false });
    percentage.disable({ emitEvent: false });
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
      const baseSalaryAmounts: Record<string, string> = {};
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
            if (field.reference === 'salaries') {
              for (const row of rows)
                if (typeof row['amount'] === 'string')
                  baseSalaryAmounts[row.id] = String(row['amount']);
            }
            results[field.key] = rows
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
      if (generation === this.generation) {
        this.baseSalaryAmounts.set(baseSalaryAmounts);
        this.options.set(results);
        this.updateRaisePercentage();
      }
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
  selectedFrameworks(fieldKey: string): string[] {
    return (
      this.form.controls[fieldKey]?.value
        .split(/\r?\n/)
        .map((value) => value.trim())
        .filter(Boolean) ?? []
    );
  }
  filteredFrameworks(fieldKey: string): FrameworkOption[] {
    const search = this.frameworkSearch.trim().toLocaleLowerCase();
    const selected = this.selectedFrameworks(fieldKey);
    const catalogValues = new Set(this.frameworkOptions.map((option) => option.value));
    const legacy = selected
      .filter((value) => !catalogValues.has(value))
      .map((value) => ({
        value,
        label: value,
        iconClass: frameworkIconClass(value),
        searchText: value.toLocaleLowerCase(),
      }));
    const legacyIcons = new Set(
      legacy
        .map((option) => option.iconClass)
        .filter((iconClass) => iconClass !== 'framework-icon'),
    );
    return [
      ...legacy,
      ...this.frameworkOptions.filter(
        (option) =>
          !legacyIcons.has(option.iconClass) &&
          (selected.includes(option.value) || !search || option.searchText.includes(search)),
      ),
    ];
  }
  updateFrameworks(fieldKey: string, values: string[]): void {
    const current = this.selectedFrameworks(fieldKey);
    const selected = new Set(values);
    const retained = current.filter((value) => selected.has(value));
    const added = values.filter((value) => !current.includes(value));
    this.form.controls[fieldKey]?.setValue([...new Set([...retained, ...added])].join('\n'));
  }
  async save(): Promise<void> {
    if (this.saving() || this.loading()) return;
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    this.error.set('');
    const values = this.form.getRawValue();
    if (
      this.data.resource === 'people' &&
      values['careerStartedOn'] &&
      values['careerStartedOn'] > values['hiredOn']
    ) {
      this.error.set("L'inizio lavoro non puo essere successivo all'assunzione.");
      return;
    }
    if (
      this.data.resource === 'projects' &&
      values['startsOn'] &&
      values['endsOn'] &&
      values['startsOn'] > values['endsOn']
    ) {
      this.error.set('La data di fine progetto non puo precedere quella di inizio.');
      return;
    }
    if (
      this.data.resource === 'raise-requests' &&
      !this.data.command &&
      !values['requestedSalary'] &&
      !values['requestedPercentage']
    ) {
      this.error.set('Indica una RAL target o una percentuale.');
      return;
    }
    if (
      this.data.resource === 'raise-requests' &&
      !this.data.command &&
      values['requestedSalary'] &&
      !increasePercentage(
        this.baseSalaryAmounts()[values['baseSalaryId']] ?? '',
        values['requestedSalary'],
      )
    ) {
      this.error.set(
        'La RAL target deve superare la RAL base selezionata e rientrare nei limiti della percentuale API.',
      );
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
      if (
        this.data.resource === 'raise-requests' &&
        !this.data.command &&
        values['requestedSalary'] &&
        !this.percentageMatchesTarget()
      ) {
        // The API rejects a target and rounded percentage that imply different cents.
        payload['requestedPercentage'] = null;
      }
      if (this.data.resource === 'people') {
        const phone = await this.phoneValueForSave(values['phone'] ?? '');
        if (phone.invalid) {
          this.error.set('Inserisci un numero di telefono valido oppure lascia il campo vuoto.');
          return;
        }
        payload['phone'] = phone.value;
        this.phoneNotice.set(
          phone.warning
            ? 'Il numero esistente non e valido e verra mantenuto finche non inserisci un numero valido.'
            : '',
        );
      }
      if (this.data.resource === 'people' && this.data.row) {
        payload['managerId'] = this.data.row['managerId'] ?? null;
        payload['externalManager'] = this.data.row['externalManager'] ?? null;
      }
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
  private async phoneValueForSave(input: string): Promise<PhoneResolution> {
    if (!input.trim() && !this.phoneOriginalWasInvalid)
      return resolvePhoneValue(input, false, '', this.phoneOriginalValue, false);
    if (!this.phonePlugin) {
      return resolvePhoneValue(
        input,
        false,
        '',
        this.phoneOriginalValue,
        this.phoneOriginalWasInvalid,
      );
    }
    try {
      await this.phonePlugin.promise;
    } catch {
      return resolvePhoneValue(
        input,
        false,
        '',
        this.phoneOriginalValue,
        this.phoneOriginalWasInvalid,
      );
    }
    return resolvePhoneValue(
      input,
      !!this.phonePlugin.isValidNumber(),
      this.phonePlugin.getNumber(NUMBER_FORMAT.E164),
      this.phoneOriginalValue,
      this.phoneOriginalWasInvalid,
    );
  }
}
