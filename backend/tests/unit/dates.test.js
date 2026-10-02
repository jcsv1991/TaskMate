const { toDateKey, startOfDay, addDays, isValidDateKey, resolveToday, monthKey } = require('../../utils/dates');

const reqWith = (header) => ({ get: (name) => (name.toLowerCase() === 'x-client-today' ? header : undefined) });
const NOW = new Date('2026-10-02T03:30:00.000Z'); // 8:30pm on Oct 1st in Vancouver

describe('date helpers', () => {
  test('toDateKey / startOfDay round-trip', () => {
    expect(toDateKey(new Date('2026-03-04T23:59:59.999Z'))).toBe('2026-03-04');
    expect(startOfDay('2026-03-04').toISOString()).toBe('2026-03-04T00:00:00.000Z');
  });

  test('addDays crosses month, year and leap-day boundaries', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2026-10-02', 0)).toBe('2026-10-02');
  });

  test.each([
    ['2026-10-02', true],
    ['2026-13-01', false],
    ['2026-10-2', false],
    ['10/02/2026', false],
    ['', false],
    [undefined, false],
    [20261002, false],
  ])('isValidDateKey(%p) -> %p', (value, expected) => {
    expect(isValidDateKey(value)).toBe(expected);
  });

  test('monthKey', () => {
    expect(monthKey('2026-10-02T12:00:00.000Z')).toBe('2026-10');
  });
});

describe('resolveToday', () => {
  test('uses the server date when no header is sent', () => {
    expect(resolveToday(reqWith(undefined), NOW)).toBe('2026-10-02');
  });

  test('trusts the client local date when it is plausible (user is behind UTC)', () => {
    expect(resolveToday(reqWith('2026-10-01'), NOW)).toBe('2026-10-01');
  });

  test('trusts a client that is ahead of UTC', () => {
    expect(resolveToday(reqWith('2026-10-03'), NOW)).toBe('2026-10-03');
  });

  test('ignores a header that is far from the server clock', () => {
    expect(resolveToday(reqWith('2020-01-01'), NOW)).toBe('2026-10-02');
    expect(resolveToday(reqWith('2026-10-09'), NOW)).toBe('2026-10-02');
  });

  test('ignores malformed headers', () => {
    expect(resolveToday(reqWith("2026-10-01'; DROP"), NOW)).toBe('2026-10-02');
    expect(resolveToday(reqWith('not-a-date'), NOW)).toBe('2026-10-02');
  });

  test('works without a request object', () => {
    expect(resolveToday(undefined, NOW)).toBe('2026-10-02');
  });
});
