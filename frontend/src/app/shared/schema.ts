import { Row } from '../core/api';

export interface Option {
  value: string;
  label: string;
}
export interface Field {
  key: string;
  label: string;
  type?:
    'text' | 'textarea' | 'email' | 'date' | 'instant' | 'id' | 'decimal' | 'integer' | 'select';
  required?: boolean;
  requiredOnCreate?: boolean;
  pattern?: string;
  max?: number;
  fraction?: number;
  options?: Option[];
  reference?: 'people' | 'salaries' | 'career-talks' | 'raise-requests';
  immutable?: boolean;
  initial?: string;
}
export interface Column {
  key: string;
  label: string;
  type?: string;
}
export type Resource =
  'people' | 'contacts' | 'salaries' | 'raise-requests' | 'career-talks' | 'tasks';
export interface Definition {
  title: string;
  singular: string;
  fields: Field[];
  columns: Column[];
  statuses?: string[];
}
export function newLabel(resource: Resource): string {
  return (
    (['contacts', 'career-talks', 'tasks'].includes(resource) ? 'Nuovo ' : 'Nuova ') +
    definitions[resource].singular
  );
}
const person: Field = {
  key: 'personId',
  label: 'Persona',
  type: 'id',
  reference: 'people',
  required: true,
  immutable: true,
};
const text = (key: string, label: string, required = false, max = 10000): Field => ({
  key,
  label,
  type: 'textarea',
  required,
  max,
});
const choice = (key: string, label: string, values: string[], initial: string): Field => ({
  key,
  label,
  type: 'select',
  required: true,
  options: values.map((value) => ({ value, label: value })),
  initial,
});
export const definitions: Record<Resource, Definition> = {
  people: {
    title: 'Persone',
    singular: 'persona',
    statuses: ['active', 'inactive'],
    fields: [
      { key: 'firstName', label: 'Nome', required: true, max: 100 },
      { key: 'lastName', label: 'Cognome', required: true, max: 100 },
      {
        key: 'mypadId',
        label: 'MyPad ID',
        max: 100,
        pattern: '^[A-Za-z0-9_-]+$',
        requiredOnCreate: true,
      },
      { key: 'email', label: 'Email', type: 'email', max: 254 },
      { key: 'phone', label: 'Telefono', max: 50 },
      { key: 'role', label: 'Ruolo', max: 150 },
      {
        key: 'frameworks',
        label: 'Framework conosciuti (uno per riga)',
        type: 'textarea',
        max: 5049,
      },
      { key: 'hiredOn', label: 'Data di assunzione', type: 'date', required: true },
      { key: 'careerStartedOn', label: 'Data di inizio lavoro', type: 'date' },
      {
        key: 'seniorityLevel',
        label: 'Livello di seniority',
        type: 'select',
        options: [
          { value: 'junior', label: 'Junior' },
          { value: 'medior', label: 'Medior' },
          { value: 'senior', label: 'Senior' },
        ],
      },
      { key: 'hiringLocation', label: 'Sede di assunzione', max: 200 },
      { key: 'residence', label: 'Residenza', max: 500 },
      { key: 'managerId', label: 'Manager interno', type: 'id', reference: 'people' },
      { key: 'externalManager', label: 'Manager esterno (alternativo)', max: 200 },
      text('notes', 'Note'),
      choice('status', 'Stato', ['active', 'inactive'], 'active'),
    ],
    columns: [
      { key: 'firstName', label: 'Nome' },
      { key: 'lastName', label: 'Cognome' },
      { key: 'role', label: 'Ruolo' },
      { key: 'frameworks', label: 'Framework conosciuti' },
      { key: 'email', label: 'Email' },
      { key: 'status', label: 'Stato' },
    ],
  },
  contacts: {
    title: 'Contatti',
    singular: 'contatto',
    fields: [
      { key: 'type', label: 'Tipo', required: true, max: 50 },
      { key: 'value', label: 'Recapito o riferimento', required: true, max: 500 },
      text('notes', 'Note'),
    ],
    columns: [
      { key: 'type', label: 'Tipo' },
      { key: 'value', label: 'Recapito' },
      { key: 'notes', label: 'Note' },
    ],
  },
  salaries: {
    title: 'Storico RAL',
    singular: 'voce RAL',
    fields: [
      {
        key: 'amount',
        label: 'RAL annua (es. 45000.00)',
        type: 'decimal',
        required: true,
        fraction: 2,
      },
      { key: 'currency', label: 'Valuta ISO (es. EUR)', required: true, max: 3, initial: 'EUR' },
      { key: 'effectiveOn', label: 'Decorrenza', type: 'date', required: true },
      { key: 'contractType', label: 'Tipo contratto', required: true, max: 100 },
      { key: 'weeklyHours', label: 'Ore settimanali', type: 'decimal', required: true, fraction: 2 },
      { key: 'classificationLevel', label: 'Livello di inquadramento', required: true, max: 100 },
      text('reason', 'Motivo della variazione', true),
    ],
    columns: [
      { key: 'amount', label: 'RAL annua', type: 'money' },
      { key: 'currency', label: 'Valuta' },
      { key: 'effectiveOn', label: 'Decorrenza', type: 'date' },
      { key: 'contractType', label: 'Tipo contratto' },
      { key: 'weeklyHours', label: 'Ore settimanali', type: 'decimal' },
      { key: 'classificationLevel', label: 'Livello' },
      { key: 'reason', label: 'Motivo' },
    ],
  },
  'raise-requests': {
    title: 'Richieste di aumento',
    singular: 'richiesta',
    statuses: ['draft', 'submitted', 'approved', 'rejected', 'postponed'],
    fields: [
      person,
      {
        key: 'baseSalaryId',
        label: 'RAL base',
        type: 'id',
        reference: 'salaries',
        required: true,
        immutable: true,
      },
      { key: 'requestedOn', label: 'Data richiesta', type: 'date', required: true },
      {
        key: 'requestedSalary',
        label: 'RAL annua target (non incremento)',
        type: 'decimal',
        fraction: 2,
      },
      { key: 'requestedPercentage', label: 'Percentuale aumento', type: 'decimal', fraction: 4 },
      text('motivation', 'Motivazione', true),
    ],
    columns: [
      { key: 'personId', label: 'Persona' },
      { key: 'requestedOn', label: 'Richiesta', type: 'date' },
      { key: 'requestedSalary', label: 'RAL target', type: 'money' },
      { key: 'requestedPercentage', label: '%', type: 'decimal' },
      { key: 'currency', label: 'Valuta' },
      { key: 'status', label: 'Stato' },
    ],
  },
  'career-talks': {
    title: 'Career talk',
    singular: 'career talk',
    fields: [
      person,
      { key: 'heldAt', label: 'Data e ora incontro (UTC)', type: 'instant', required: true },
      text('topics', 'Argomenti'),
      text('agreedGoals', 'Obiettivi concordati'),
      text('feedbackGiven', 'Feedback dato'),
      text('feedbackReceived', 'Feedback ricevuto'),
      text('nextSteps', 'Prossimi passi'),
      { key: 'suggestedNextOn', label: 'Prossimo incontro suggerito', type: 'date' },
    ],
    columns: [
      { key: 'personId', label: 'Persona' },
      { key: 'heldAt', label: 'Incontro', type: 'instant' },
      { key: 'topics', label: 'Argomenti' },
      { key: 'suggestedNextOn', label: 'Prossimo incontro', type: 'date' },
    ],
  },
  tasks: {
    title: 'Task',
    singular: 'task',
    statuses: ['todo', 'in_progress', 'done', 'cancelled'],
    fields: [
      { key: 'title', label: 'Titolo', required: true, max: 200 },
      text('description', 'Descrizione'),
      { key: 'dueAt', label: 'Scadenza (UTC)', type: 'instant' },
      choice('priority', 'Priorita', ['low', 'medium', 'high'], 'medium'),
      choice('status', 'Stato', ['todo', 'in_progress'], 'todo'),
      { ...person, required: false, immutable: false },
      {
        key: 'careerTalkId',
        label: 'Career talk collegato',
        type: 'id',
        reference: 'career-talks',
      },
      {
        key: 'raiseRequestId',
        label: 'Richiesta collegata',
        type: 'id',
        reference: 'raise-requests',
      },
      {
        key: 'recurrenceFrequency',
        label: 'Ricorrenza',
        type: 'select',
        options: ['daily', 'weekly', 'monthly'].map((value) => ({ value, label: value })),
      },
      { key: 'recurrenceInterval', label: 'Intervallo ricorrenza', type: 'integer' },
    ],
    columns: [
      { key: 'title', label: 'Titolo' },
      { key: 'personId', label: 'Persona' },
      { key: 'dueAt', label: 'Scadenza', type: 'instant' },
      { key: 'priority', label: 'Priorita' },
      { key: 'status', label: 'Stato' },
    ],
  },
};
export function canEdit(resource: Resource, row: Row): boolean {
  if (row['archivedAt'] || resource === 'salaries') return false;
  if (resource === 'raise-requests') return ['draft', 'submitted'].includes(String(row['status']));
  if (resource === 'tasks') return ['todo', 'in_progress'].includes(String(row['status']));
  return true;
}
