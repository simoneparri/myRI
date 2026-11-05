import { PercentagePipe } from './percentage';

describe('PercentagePipe', () => {
  const pipe = new PercentagePipe();

  it('formats fractions as Italian percentages with exactly two decimal places', () => {
    expect(pipe.transform('0.058')).toBe('5,80%');
    expect(pipe.transform(0.058)).toBe('5,80%');
    expect(pipe.transform('0.58')).toBe('58,00%');
    expect(pipe.transform('0')).toBe('0,00%');
    expect(pipe.transform('1')).toBe('100,00%');
    expect(pipe.transform('-0.058')).toBe('-5,80%');
    expect(pipe.transform('0.05875')).toBe('5,88%');
  });

  it('preserves the points representation used by the raise API', () => {
    expect(pipe.transform('5.8', 'points')).toBe('5,80%');
    expect(pipe.transform('0.058', 'points')).toBe('0,06%');
    expect(pipe.transform('99999.9999', 'points')).toBe('100.000,00%');
  });

  it('distinguishes missing values from zero', () => {
    for (const value of [null, undefined, '']) expect(pipe.transform(value)).toBe('-');
    expect(pipe.transform(0, 'points')).toBe('0,00%');
  });

  it('rejects invalid values explicitly', () => {
    for (const value of ['invalid', '5,8', ' ', true, [], NaN, Infinity]) {
      expect(() => pipe.transform(value)).toThrow('Valore percentuale non valido.');
    }
  });
});
