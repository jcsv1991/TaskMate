import { describe, expect, it } from 'vitest';
import { daysBetween, dueInfo, formatCurrency, formatCurrencyCompact, formatDate, formatMonth, greeting, initials, localDateKey, pluralize, toDateInput } from './format';

describe('currency', () => {
  it('formats dollars with cents and thousands separators', () => {
    expect(formatCurrency(1234.5)).toBe('$1,234.50');
    expect(formatCurrency(0)).toBe('$0.00');
  });
  it('treats junk as zero instead of printing NaN', () => {
    expect(formatCurrency(undefined)).toBe('$0.00');
    expect(formatCurrency('abc')).toBe('$0.00');
    expect(formatCurrency(null)).toBe('$0.00');
  });
  it('has a compact form for chart axes', () => {
    expect(formatCurrencyCompact(2500)).toBe('$2.5K');
    expect(formatCurrencyCompact(10000)).toBe('$10K');
  });
});

describe('dates', () => {
  // The suite runs in America/Los_Angeles (see globalSetup): midnight UTC is the previous evening there.
  it('shows a stored calendar date as that same day, whatever the viewer time zone', () => {
    expect(formatDate('2026-10-05T00:00:00.000Z')).toBe('Oct 5, 2026');
    expect(formatDate('2026-01-01T00:00:00.000Z')).toBe('Jan 1, 2026');
    expect(new Date('2026-10-05T00:00:00.000Z').getDate()).toBe(4); // proves the zone really is west of UTC
  });
  it('shows a dash for missing dates', () => {
    expect(formatDate(null)).toBe('—');
    expect(formatDate('')).toBe('—');
  });
  it('formats month labels from YYYY-MM', () => {
    expect(formatMonth('2026-03')).toBe('Mar');
    expect(formatMonth('2026-12')).toBe('Dec');
  });
  it('builds a date-input value from an ISO calendar date', () => {
    expect(toDateInput('2026-10-05T00:00:00.000Z')).toBe('2026-10-05');
    expect(toDateInput(null)).toBe('');
  });
  it('localDateKey uses the viewer’s own calendar day', () => {
    expect(localDateKey(new Date(2026, 9, 5, 23, 59))).toBe('2026-10-05');
    expect(localDateKey(new Date(2026, 0, 2, 0, 1))).toBe('2026-01-02');
  });
  it('counts whole days between keys, across month ends and leap days', () => {
    expect(daysBetween('2026-10-02', '2026-10-05')).toBe(3);
    expect(daysBetween('2026-10-05', '2026-10-02')).toBe(-3);
    expect(daysBetween('2028-02-28', '2028-03-01')).toBe(2);
    expect(daysBetween('2026-03-07', '2026-03-09')).toBe(2); // across a US daylight-saving change
  });
});

describe('dueInfo', () => {
  const today = '2026-10-10';
  const at = (key) => `${key}T00:00:00.000Z`;
  it.each([
    ['2026-09-10', '30 days overdue', 'danger'],
    ['2026-10-07', '3 days overdue', 'danger'],
    ['2026-10-08', '2 days overdue', 'danger'],
    ['2026-10-09', '1 day overdue', 'danger'],
    ['2026-10-10', 'Due today', 'warning'],
    ['2026-10-11', 'Due tomorrow', 'warning'],
    ['2026-10-12', 'Due in 2 days', 'info'],
    ['2026-10-13', 'Due in 3 days', 'info'],
    ['2026-10-17', 'Due in 7 days', 'info'],
    ['2026-10-18', 'Oct 18, 2026', 'secondary'],
  ])('%s -> %s', (due, label, tone) => {
    expect(dueInfo(at(due), { today })).toEqual({ label, tone });
  });
  it('has wording for no due date', () => {
    expect(dueInfo(null, { today })).toEqual({ label: 'No due date', tone: 'secondary' });
  });
  it('never calls a completed task overdue', () => {
    expect(dueInfo(at('2026-09-01'), { today, completed: true })).toEqual({ label: 'Sep 1, 2026', tone: 'secondary' });
  });
});

describe('small helpers', () => {
  it('greets by time of day', () => {
    expect(greeting(new Date(2026, 0, 1, 3))).toBe('Working late');
    expect(greeting(new Date(2026, 0, 1, 9))).toBe('Good morning');
    expect(greeting(new Date(2026, 0, 1, 14))).toBe('Good afternoon');
    expect(greeting(new Date(2026, 0, 1, 20))).toBe('Good evening');
  });
  it('makes initials from names and emails', () => {
    expect(initials('Ada Lovelace')).toBe('AL');
    expect(initials('ada')).toBe('A');
    expect(initials('grace.hopper@navy.mil')).toBe('GH');
    expect(initials('ada@example.com')).toBe('A');
    expect(initials('')).toBe('?');
    expect(initials('123@x.com')).toBe('?');
  });
  it('pluralizes', () => {
    expect(pluralize(1, 'task')).toBe('1 task');
    expect(pluralize(0, 'task')).toBe('0 tasks');
    expect(pluralize(2, 'open task')).toBe('2 open tasks');
    expect(pluralize(2, 'category', 'categories')).toBe('2 categories');
  });
});
