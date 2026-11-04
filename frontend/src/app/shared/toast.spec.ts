import { TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Toast } from './toast';

describe('Toast', () => {
  it('shows an accessible, dismissible confirmation for four seconds at the top right', () => {
    const open = vi.fn();
    TestBed.configureTestingModule({
      providers: [{ provide: MatSnackBar, useValue: { open } }],
    });
    TestBed.inject(Toast).success('Salvataggio completato.');
    expect(open).toHaveBeenCalledExactlyOnceWith('Salvataggio completato.', 'Chiudi', {
      duration: 4000,
      horizontalPosition: 'end',
      verticalPosition: 'top',
      politeness: 'polite',
    });
  });
});
