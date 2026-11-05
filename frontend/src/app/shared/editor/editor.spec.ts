import { TestBed } from '@angular/core/testing';
import { FormControl } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { HttpErrorResponse } from '@angular/common/http';
import { Api, Row } from '../../core/api';
import {
  Editor,
  EditorData,
  increasePercentage,
  payloadFor,
  roundedPercentageMatchesTarget,
  resolvePhoneValue,
  validatorsFor,
} from './editor';
import { TIMEZONE, decimalDisplay } from '../format';
import { canEdit, definitions } from '../schema';
import { frameworkIconClass, frameworkOptions } from '../framework-catalog';

describe('precision and validation', () => {
  it('calculates increase percentages with exact decimal arithmetic and upward tenths', () => {
    expect(increasePercentage('100.00', '110.00')).toBe('10');
    expect(increasePercentage('100.00', '110.10')).toBe('10.1');
    expect(increasePercentage('3.00', '3.01')).toBe('0.4');
    expect(increasePercentage('8.00', '8.01')).toBe('0.2');
    expect(increasePercentage('45000.00', '45000.01')).toBe('0.1');
    expect(roundedPercentageMatchesTarget('100.00', '110.00', '10')).toBe(true);
    expect(roundedPercentageMatchesTarget('3.00', '3.01', '0.4')).toBe(true);
    expect(roundedPercentageMatchesTarget('45000.00', '45250.00', '0.6')).toBe(false);
    expect(increasePercentage('45000.00', '45000.00')).toBeNull();
    expect(increasePercentage('45000.00', '44999.99')).toBeNull();
    expect(increasePercentage('0.00', '1.00')).toBeNull();
  });
  it('normalizes valid phone numbers and preserves invalid legacy values', () => {
    expect(resolvePhoneValue('+39 02 12345678', true, '+390212345678', '', false)).toEqual({
      value: '+390212345678',
      warning: false,
      invalid: false,
    });
    expect(resolvePhoneValue('Numero legacy', false, '', 'Numero legacy', true)).toEqual({
      value: 'Numero legacy',
      warning: true,
      invalid: false,
    });
    expect(resolvePhoneValue('', false, '', 'Numero legacy', true)).toEqual({
      value: 'Numero legacy',
      warning: true,
      invalid: false,
    });
    expect(resolvePhoneValue('', false, '', '+390212345678', false)).toEqual({
      value: null,
      warning: false,
      invalid: false,
    });
    expect(resolvePhoneValue('test non valido', false, '', '', false).invalid).toBe(true);
  });
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
  it('provides Devicon selections with icons and validates framework list limits', () => {
    const frameworks = definitions.people.fields.find((field) => field.key === 'frameworks')!;
    expect(frameworks.type).toBe('framework-multiselect');
    expect(frameworkOptions.map((option) => option.value)).toContain('Angular');
    expect(frameworkOptions.map((option) => option.value)).toContain('React');
    expect(frameworkIconClass('Java')).toContain('devicon-java-plain');
    expect(frameworkIconClass('Spring Boot')).toContain('devicon-spring-original');
    const control = new FormControl(' Java \nSpring Boot', {
      nonNullable: true,
      validators: validatorsFor(frameworks),
    });
    expect(control.valid).toBe(true);
    expect(payloadFor([frameworks], { frameworks: control.value })['frameworks']).toEqual([
      'Java',
      'Spring Boot',
    ]);
    control.setValue('Java\n java ');
    expect(control.invalid).toBe(true);
    control.setValue('x'.repeat(101));
    expect(control.invalid).toBe(true);
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
  const choices = vi.fn();
  const close = vi.fn();
  function create(data: EditorData, salaryRows: Row[] = []): Editor {
    post.mockReset();
    put.mockReset();
    choices.mockReset().mockResolvedValue(salaryRows);
    close.mockReset();
    TestBed.configureTestingModule({
      imports: [Editor],
      providers: [
        { provide: TIMEZONE, useValue: 'Europe/Rome' },
        { provide: MAT_DIALOG_DATA, useValue: data },
        { provide: MatDialogRef, useValue: { close, disableClose: false } },
        { provide: Api, useValue: { post, put, choices } },
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
  it('requires a valid contact date for new contacts and sends a calendar date unchanged', async () => {
    const editor = create({ resource: 'contacts', path: 'people/9/contacts' });
    await vi.waitFor(() => expect(editor.loading()).toBe(false));
    editor.form.patchValue({ type: 'reference', value: 'Fittizio' });
    expect(editor.form.controls['contactedOn'].invalid).toBe(true);
    editor.form.controls['contactedOn'].setValue('2026-02-30');
    expect(editor.form.controls['contactedOn'].invalid).toBe(true);
    editor.form.controls['contactedOn'].setValue('2026-11-05');
    post.mockResolvedValue({});
    await editor.save();
    expect(post).toHaveBeenCalledWith(
      'people/9/contacts',
      expect.objectContaining({ contactedOn: '2026-11-05' }),
    );
  });
  it('allows undated legacy contacts to be edited without inventing a date', () => {
    const editor = create({
      resource: 'contacts',
      path: 'people/9/contacts',
      row: { id: '1', version: '0', type: 'reference', value: 'Fittizio', contactedOn: null },
    });
    expect(editor.form.controls['contactedOn'].value).toBe('');
    expect(editor.form.controls['contactedOn'].valid).toBe(true);
  });
  it('requires keeping an assigned contact date', () => {
    const editor = create({
      resource: 'contacts',
      path: 'people/9/contacts',
      row: { id: '1', version: '0', contactedOn: '2026-11-05' },
    });
    editor.form.controls['contactedOn'].setValue('');
    expect(editor.form.controls['contactedOn'].invalid).toBe(true);
  });
  it('requires a valid MyPad ID at census and keeps career start before hiring', async () => {
    const editor = create({ resource: 'people', path: 'people' });
    await vi.waitFor(() => expect(editor.loading()).toBe(false));
    editor.form.patchValue({
      firstName: 'Persona',
      lastName: 'Fittizia',
      bornOn: '1990-01-01',
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
    expect(editor.form.controls['bornOn'].value).toBe('');
    expect(editor.form.controls['bornOn'].valid).toBe(true);
  });
  it('requires birth date at census and rejects impossible and future dates', async () => {
    const editor = create({ resource: 'people', path: 'people' });
    await vi.waitFor(() => expect(editor.loading()).toBe(false));
    editor.form.patchValue({
      firstName: 'Persona',
      lastName: 'Fittizia',
      mypadId: 'fictitious-birth',
      hiredOn: '2020-01-01',
    });
    expect(editor.form.controls['bornOn'].invalid).toBe(true);
    editor.form.controls['bornOn'].setValue('1990-02-30');
    expect(editor.form.controls['bornOn'].invalid).toBe(true);
    editor.form.controls['bornOn'].setValue('9999-12-31');
    await editor.save();
    expect(post).not.toHaveBeenCalled();
    expect(editor.error()).toContain('nascita non puo essere futura');
    editor.form.controls['bornOn'].setValue('1990-01-01');
    post.mockResolvedValue({});
    await editor.save();
    expect(post).toHaveBeenCalledWith('people', expect.objectContaining({ bornOn: '1990-01-01' }));
  });
  it('requires keeping an assigned birth date', () => {
    const editor = create({
      resource: 'people',
      path: 'people',
      row: { id: '1', version: '0', bornOn: '1990-01-01' },
    });
    editor.form.controls['bornOn'].setValue('');
    expect(editor.form.controls['bornOn'].invalid).toBe(true);
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
  it('searches framework choices and preserves selected legacy values', () => {
    const editor = create({
      resource: 'people',
      path: 'people',
      row: { id: '1', version: '4', frameworks: ['Java', 'Legacy Toolkit'] },
    });
    editor.frameworkSearch = 'react';
    const filtered = editor.filteredFrameworks('frameworks');
    expect(filtered.map((option) => option.value)).toEqual(
      expect.arrayContaining(['Java', 'Legacy Toolkit', 'React']),
    );
    expect(
      filtered
        .filter((option) => !['Java', 'Legacy Toolkit'].includes(option.value))
        .every((option) => option.searchText.includes('react')),
    ).toBe(true);
    editor.updateFrameworks('frameworks', ['React', 'Java', 'Legacy Toolkit']);
    expect(editor.selectedFrameworks('frameworks')).toEqual(['Java', 'Legacy Toolkit', 'React']);
    expect(editor.form.controls['frameworks'].valid).toBe(true);
  });
  it('derives percentage from the selected base and allows manual percentage without a target', async () => {
    const editor = create(
      {
        resource: 'raise-requests',
        path: 'raise-requests',
        row: {
          id: '3',
          version: '5',
          personId: '9',
          baseSalaryId: '11',
          requestedOn: '2026-11-01',
          requestedSalary: '49500.00',
          requestedPercentage: '1.2345',
          motivation: 'Motivazione fittizia',
        },
      },
      [{ id: '11', amount: '45000.00', currency: 'EUR', effectiveOn: '2026-01-01' }],
    );
    await vi.waitFor(() => expect(editor.loading()).toBe(false));
    expect(editor.form.controls['requestedPercentage'].value).toBe('10');
    expect(editor.form.controls['requestedPercentage'].disabled).toBe(true);
    expect(editor.percentageMatchesTarget()).toBe(true);

    editor.form.controls['requestedSalary'].setValue('');
    expect(editor.form.controls['requestedPercentage'].enabled).toBe(true);
    expect(editor.form.controls['requestedPercentage'].value).toBe('');
    editor.form.controls['requestedPercentage'].setValue('5.25');
    put.mockResolvedValue({});
    await editor.save();
    expect(put).toHaveBeenCalledWith(
      'raise-requests/3',
      expect.objectContaining({ requestedSalary: null, requestedPercentage: '5.25' }),
    );
  });
  it('hides legacy manager fields and preserves their stored values when editing people', async () => {
    const editor = create({
      resource: 'people',
      path: 'people',
      row: {
        id: '1',
        version: '4',
        firstName: 'Persona',
        lastName: 'Fittizia',
        hiredOn: '2020-01-01',
        status: 'active',
        managerId: '2',
        externalManager: null,
      },
    });
    await vi.waitFor(() => expect(editor.loading()).toBe(false));
    expect(editor.form.controls['managerId']).toBeUndefined();
    expect(editor.form.controls['externalManager']).toBeUndefined();
    put.mockResolvedValue({});
    await editor.save();
    expect(put).toHaveBeenCalledWith(
      'people/1',
      expect.objectContaining({ managerId: '2', externalManager: null }),
    );
  });
  it('validates project dates and allows both endpoints to be absent', async () => {
    const editor = create({ resource: 'projects', path: 'people/1/projects', personId: '1' });
    await vi.waitFor(() => expect(editor.loading()).toBe(false));
    editor.form.patchValue({
      client: 'Cliente fittizio',
      startsOn: '2026-11-06',
      endsOn: '2026-11-05',
    });
    await editor.save();
    expect(post).not.toHaveBeenCalled();
    expect(editor.error()).toContain('fine progetto');
    editor.form.patchValue({ startsOn: '', endsOn: '', businessManager: 'BM fittizio' });
    post.mockResolvedValue({});
    await editor.save();
    expect(post).toHaveBeenCalledWith(
      'people/1/projects',
      expect.objectContaining({
        client: 'Cliente fittizio',
        startsOn: null,
        endsOn: null,
        businessManager: 'BM fittizio',
        workMode: 'hybrid',
      }),
    );
  });
  it('uses the same salary idempotency key on retry and surfaces the failed request', async () => {
    const editor = create({ resource: 'salaries', path: 'people/1/salaries', personId: '1' });
    await vi.waitFor(() => expect(editor.loading()).toBe(false));
    editor.form.patchValue({
      amount: '45000.00',
      effectiveOn: '2026-01-01',
      contractType: 'Tempo indeterminato',
      weeklyHours: '40.00',
      classificationLevel: 'Livello fittizio',
      reason: 'Fittizia',
    });
    post.mockRejectedValueOnce(new HttpErrorResponse({ status: 503 })).mockResolvedValueOnce({});
    await editor.save();
    expect(editor.fields.some((field) => field.key === 'currency')).toBe(false);
    expect(editor.form.controls['currency']).toBeUndefined();
    expect(post.mock.calls[0][1]['currency']).toBe('EUR');
    expect(editor.error()).not.toBe('');
    expect(close).not.toHaveBeenCalled();
    await editor.save();
    expect(post.mock.calls[1][1]['currency']).toBe('EUR');
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
    const editor = create(
      {
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
      },
      [{ id: '11', amount: '40000.00', currency: 'EUR', effectiveOn: '2026-01-01' }],
    );
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
