import { TestBed } from '@angular/core/testing';
import { FormControl } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { HttpErrorResponse } from '@angular/common/http';
import { Api } from '../core/api';
import { Editor, EditorData, payloadFor, validatorsFor } from './editor';
import { TIMEZONE, decimalDisplay } from './format';
import { canEdit, definitions } from './schema';

describe('precision and validation', () => {
  it('preserves BIGINT and decimal strings exactly', () => {
    const payload = payloadFor(definitions['raise-requests'].fields, {
      personId: '9007199254740993',
      baseSalaryId: '9223372036854775807',
      requestedSalary: '9999999999.99',
      requestedPercentage: '12.1234',
      requestedOn: '2026-11-02',
      motivation: 'Fittizia',
    });
    expect(payload['personId']).toBe('9007199254740993');
    expect(payload['baseSalaryId']).toBe('9223372036854775807');
    expect(payload['requestedSalary']).toBe('9999999999.99');
    expect(payload['requestedPercentage']).toBe('12.1234');
    expect(decimalDisplay('9999999999.99')).toBe('9.999.999.999,99');
  });
  it('converts only recurrence intervals to numbers and UTC editor values to instants', () => {
    const payload = payloadFor(definitions.tasks.fields, {
      recurrenceInterval: '2',
      dueAt: '2026-11-02T10:30',
    });
    expect(payload['recurrenceInterval']).toBe(2);
    expect(payload['dueAt']).toBe('2026-11-02T10:30:00.000Z');
    expect(payload['personId']).toBeNull();
  });
  it('rejects fractional identifiers, comma decimals and excess precision', () => {
    const id = new FormControl('1.5', validatorsFor({ key: 'id', label: '', type: 'id' }));
    expect(id.invalid).toBe(true);
    const decimal = new FormControl(
      '12000,50',
      validatorsFor({ key: 'amount', label: '', type: 'decimal', fraction: 2 }),
    );
    expect(decimal.invalid).toBe(true);
    decimal.setValue('12000.501');
    expect(decimal.invalid).toBe(true);
    decimal.setValue('12000.50');
    expect(decimal.valid).toBe(true);
    decimal.setValue('0.00');
    expect(decimal.invalid).toBe(true);
    decimal.setValue('12345678901.00');
    expect(decimal.invalid).toBe(true);
    const percentage = new FormControl(
      '99999.9999',
      validatorsFor({ key: 'requestedPercentage', label: '', type: 'decimal', fraction: 4 }),
    );
    expect(percentage.valid).toBe(true);
    const longId = new FormControl(
      '9223372036854775808',
      validatorsFor({ key: 'id', label: '', type: 'id' }),
    );
    expect(longId.invalid).toBe(true);
    const maxInteger = new FormControl(
      '2147483648',
      validatorsFor({ key: 'value', label: '', type: 'integer' }),
    );
    expect(maxInteger.invalid).toBe(true);
    const weeklyHours = new FormControl(
      '168.01',
      validatorsFor({ key: 'weeklyHours', label: '', type: 'decimal', fraction: 2 }),
    );
    expect(weeklyHours.invalid).toBe(true);
    weeklyHours.setValue('168.00');
    expect(weeklyHours.valid).toBe(true);
  });
  it('never enables modification of salary history, closed requests or archived rows', () => {
    expect(canEdit('salaries', { id: '1' })).toBe(false);
    expect(canEdit('raise-requests', { id: '1', status: 'approved' })).toBe(false);
    expect(canEdit('tasks', { id: '1', status: 'done' })).toBe(false);
    expect(canEdit('people', { id: '1', archivedAt: '2026-01-01T00:00:00Z' })).toBe(false);
    expect(canEdit('raise-requests', { id: '1', status: 'submitted' })).toBe(true);
  });
});

describe('Editor', () => {
  const post = vi.fn();
  const put = vi.fn();
  const close = vi.fn();
  function create(data: EditorData): Editor {
    post.mockReset();
    put.mockReset();
    close.mockReset();
    TestBed.configureTestingModule({
      imports: [Editor],
      providers: [
        { provide: TIMEZONE, useValue: 'Europe/Rome' },
        { provide: MAT_DIALOG_DATA, useValue: data },
        { provide: MatDialogRef, useValue: { close, disableClose: false } },
        { provide: Api, useValue: { post, put, choices: vi.fn().mockResolvedValue([]) } },
      ],
    });
    return TestBed.createComponent(Editor).componentInstance;
  }
  it('defaults outcome dates to the application calendar across UTC midnight', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-03T23:30:00Z'));
    try {
      const editor = create({
        resource: 'raise-requests',
        path: 'raise-requests',
        command: 'approve',
        row: { id: '2', version: '4' },
      });
      expect(editor.form.controls['outcomeOn'].value).toBe('2026-11-04');
    } finally {
      vi.useRealTimers();
    }
  });
  it('requires a valid MyPad ID at census and keeps career start before hiring', async () => {
    const editor = create({ resource: 'people', path: 'people' });
    await vi.waitFor(() => expect(editor.loading()).toBe(false));
    editor.form.patchValue({
      firstName: 'Persona',
      lastName: 'Fittizia',
      hiredOn: '2020-01-01',
      careerStartedOn: '2021-01-01',
      seniorityLevel: 'medior',
    });
    expect(editor.form.controls['mypadId'].invalid).toBe(true);
    editor.form.controls['mypadId'].setValue('../invalid');
    expect(editor.form.controls['mypadId'].invalid).toBe(true);
    editor.form.controls['mypadId'].setValue('fictitious-123');
    await editor.save();
    expect(post).not.toHaveBeenCalled();
    expect(editor.error()).toContain("successivo all'assunzione");
    editor.form.controls['careerStartedOn'].setValue('2018-01-01');
    post.mockResolvedValue({});
    await editor.save();
    expect(post).toHaveBeenCalledWith(
      'people',
      expect.objectContaining({
        mypadId: 'fictitious-123',
        hiredOn: '2020-01-01',
        careerStartedOn: '2018-01-01',
        seniorityLevel: 'medior',
      }),
    );
    expect(close).toHaveBeenCalledWith(true);
  });
  it('allows editing a legacy person without inventing MyPad ID or career information', () => {
    const editor = create({
      resource: 'people',
      path: 'people',
      row: { id: '1', version: '4', hiredOn: '2020-01-01' },
    });
    expect(editor.form.controls['mypadId'].valid).toBe(true);
    expect(editor.form.controls['careerStartedOn'].value).toBe('');
    expect(editor.form.controls['seniorityLevel'].value).toBe('');
  });
  it('requires keeping MyPad ID when editing an identified person', () => {
    const editor = create({
      resource: 'people',
      path: 'people',
      row: { id: '1', version: '4', hiredOn: '2020-01-01', mypadId: 'fictitious-123' },
    });
    editor.form.controls['mypadId'].setValue('');
    expect(editor.form.controls['mypadId'].invalid).toBe(true);
  });
  it('uses the same salary idempotency key on retry and surfaces the failed request', async () => {
    const editor = create({ resource: 'salaries', path: 'people/1/salaries', personId: '1' });
    await vi.waitFor(() => expect(editor.loading()).toBe(false));
    editor.form.patchValue({
      amount: '45000.00',
      currency: 'EUR',
      effectiveOn: '2026-01-01',
      contractType: 'Tempo indeterminato',
      weeklyHours: '40.00',
      classificationLevel: 'Livello fittizio',
      reason: 'Fittizia',
    });
    post.mockRejectedValueOnce(new HttpErrorResponse({ status: 503 })).mockResolvedValueOnce({});
    await editor.save();
    expect(editor.error()).not.toBe('');
    expect(close).not.toHaveBeenCalled();
    await editor.save();
    expect(post.mock.calls[0][1]['requestKey']).toBe(post.mock.calls[1][1]['requestKey']);
    expect(close).toHaveBeenCalledWith(true);
  });
  it('requires explicit salary decision and consistent effective date on approval', async () => {
    const editor = create({
      resource: 'raise-requests',
      path: 'raise-requests',
      command: 'approve',
      row: { id: '2', version: '4' },
    });
    await vi.waitFor(() => expect(editor.loading()).toBe(false));
    editor.form.patchValue({ createSalary: 'true' });
    await editor.save();
    expect(post).not.toHaveBeenCalled();
    expect(editor.error()).toContain('decorrenza');
    editor.form.patchValue({ effectiveOn: '2026-12-01' });
    post.mockResolvedValue({});
    await editor.save();
    expect(post).toHaveBeenCalledWith(
      'raise-requests/2/approve',
      expect.objectContaining({ createSalary: true, version: '4', effectiveOn: '2026-12-01' }),
    );
  });
  it('prevents a recurring task without a deadline', async () => {
    const editor = create({ resource: 'tasks', path: 'tasks' });
    await vi.waitFor(() => expect(editor.loading()).toBe(false));
    editor.form.patchValue({
      title: 'Fittizio',
      recurrenceFrequency: 'weekly',
      recurrenceInterval: '1',
    });
    await editor.save();
    expect(post).not.toHaveBeenCalled();
    expect(editor.error()).toContain('scadenza');
  });
  it('preserves immutable person/base and optimistic version in an update', async () => {
    const editor = create({
      resource: 'raise-requests',
      path: 'raise-requests',
      row: {
        id: '3',
        version: '5',
        personId: '9',
        baseSalaryId: '11',
        requestedOn: '2026-11-01',
        requestedSalary: '48000.00',
        motivation: 'Fittizia',
      },
    });
    await vi.waitFor(() => expect(editor.loading()).toBe(false));
    expect(editor.form.controls['personId'].disabled).toBe(true);
    put.mockRejectedValue(new HttpErrorResponse({ status: 409 }));
    await editor.save();
    expect(put).toHaveBeenCalledWith(
      'raise-requests/3',
      expect.objectContaining({ version: '5', personId: '9', baseSalaryId: '11' }),
    );
    expect(editor.error()).toContain('Conflitto');
    expect(close).not.toHaveBeenCalled();
  });
});
