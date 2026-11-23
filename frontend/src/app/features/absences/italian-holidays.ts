export function italianHolidays(year: number): ReadonlyMap<string, string> {
  const date = (month: number, day: number): string =>
    `${year.toString().padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const holidays = new Map<string, string>([
    [date(1, 1), 'Capodanno'],
    [date(1, 6), 'Epifania'],
    [date(4, 25), 'Festa della Liberazione'],
    [date(5, 1), 'Festa del Lavoro'],
    [date(6, 2), 'Festa della Repubblica'],
    [date(8, 15), 'Ferragosto'],
    [date(11, 1), 'Ognissanti'],
    [date(12, 8), 'Immacolata Concezione'],
    [date(12, 25), 'Natale'],
    [date(12, 26), 'Santo Stefano'],
  ]);
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  const easter = new Date(Date.UTC(year, month - 1, day));
  holidays.set(easter.toISOString().slice(0, 10), 'Pasqua');
  easter.setUTCDate(easter.getUTCDate() + 1);
  holidays.set(easter.toISOString().slice(0, 10), 'Pasquetta');
  return holidays;
}
