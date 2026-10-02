import { CURRENCY } from '../config';

const currencyFormat = new Intl.NumberFormat('en-US', { style: 'currency', currency: CURRENCY });
const currencyCompact = new Intl.NumberFormat('en-US', { style: 'currency', currency: CURRENCY, notation: 'compact', minimumFractionDigits: 0, maximumFractionDigits: 1 });

export const formatCurrency = (value) => currencyFormat.format(Number(value) || 0);
export const formatCurrencyCompact = (value) => currencyCompact.format(Number(value) || 0);

/**
 * Due dates are calendar dates stored as midnight UTC. Formatting them in the
 * viewer's time zone would show the *previous* day for anyone west of UTC (the
 * original app had exactly this bug), so they are always formatted in UTC.
 */
const dateFormat = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', year: 'numeric', month: 'short', day: 'numeric' });
const monthFormat = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'short' });

export const formatDate = (iso) => (iso ? dateFormat.format(new Date(iso)) : '—');
export const formatMonth = (yyyyMm) => monthFormat.format(new Date(`${yyyyMm}-01T00:00:00Z`));

/** The viewer's own calendar date as YYYY-MM-DD (not UTC). */
export const localDateKey = (date = new Date()) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

/** Value for <input type="date"> from an ISO string (calendar date, UTC). */
export const toDateInput = (iso) => (iso ? new Date(iso).toISOString().slice(0, 10) : '');

const DAY = 24 * 60 * 60 * 1000;
export const daysBetween = (fromKey, toKey) => Math.round((Date.parse(`${toKey}T00:00:00Z`) - Date.parse(`${fromKey}T00:00:00Z`)) / DAY);

/**
 * Human wording for a due date relative to the viewer's today.
 * Returns { label, tone } where tone maps to a Bootstrap colour.
 */
export function dueInfo(dueIso, { completed = false, today = localDateKey() } = {}) {
  if (!dueIso) return { label: 'No due date', tone: 'secondary' };
  const dueKey = new Date(dueIso).toISOString().slice(0, 10);
  const diff = daysBetween(today, dueKey);
  if (completed) return { label: formatDate(dueIso), tone: 'secondary' };
  if (diff < -1) return { label: `${-diff} days overdue`, tone: 'danger' };
  if (diff === -1) return { label: '1 day overdue', tone: 'danger' };
  if (diff === 0) return { label: 'Due today', tone: 'warning' };
  if (diff === 1) return { label: 'Due tomorrow', tone: 'warning' };
  if (diff <= 7) return { label: `Due in ${diff} days`, tone: 'info' };
  return { label: formatDate(dueIso), tone: 'secondary' };
}

export const greeting = (date = new Date()) => {
  const hour = date.getHours();
  if (hour < 5) return 'Working late';
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
};

export const initials = (nameOrEmail = '') => {
  const base = nameOrEmail.split('@')[0].replace(/[^a-zA-Z ]+/g, ' ').trim();
  const parts = base.split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
};

export const pluralize = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
