import { TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Toast } from './toast';

describe('Toast', () => {
  it('shows accessible success and error messages at the bottom right', () => {
    const open = vi.fn();
    TestBed.configureTestingModule({
      providers: [{ provide: MatSnackBar, useValue: { open } }],
    });
    TestBed.inject(Toast).success('Salvataggio completato.');
    expect(open).toHaveBeenCalledExactlyOnceWith('Salvataggio completato.', 'Chiudi', {
      duration: 4000,
      horizontalPosition: 'end',
      verticalPosition: 'bottom',
      politeness: 'polite',
      panelClass: 'toast-success',
    });
    TestBed.inject(Toast).error('Operazione non riuscita.');
    expect(open).toHaveBeenLastCalledWith('Operazione non riuscita.', 'Chiudi', {
      duration: 6000,
      horizontalPosition: 'end',
      verticalPosition: 'bottom',
      politeness: 'assertive',
      panelClass: 'toast-error',
    });
  });
});
