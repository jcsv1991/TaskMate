/**
 * Due dates are "calendar dates", not instants. They are stored as midnight UTC
 * and all "is it overdue?" comparisons use a calendar-date string (YYYY-MM-DD)
 * for *today*. The browser sends its local date in the X-Client-Today header so
 * that a user in Vancouver at 6pm is not told today's tasks are already overdue
 * just because it is already tomorrow in UTC.
 */
const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 24 * 60 * 60 * 1000;

const toDateKey = (date) => new Date(date).toISOString().slice(0, 10);
const startOfDay = (key) => new Date(`${key}T00:00:00.000Z`);
const addDays = (key, days) => toDateKey(startOfDay(key).getTime() + days * DAY_MS);

const isValidDateKey = (value) =>
  typeof value === 'string' && DATE_KEY.test(value) && !Number.isNaN(startOfDay(value).getTime());

/**
 * Resolve "today" for a request. The client header is only trusted when it is
 * within a day or two of the server clock (time zones span UTC-12..UTC+14).
 */
function resolveToday(req, now = new Date()) {
  const serverKey = toDateKey(now);
  const header = req && typeof req.get === 'function' ? req.get('x-client-today') : undefined;
  if (isValidDateKey(header)) {
    const diffDays = Math.abs(startOfDay(header) - startOfDay(serverKey)) / DAY_MS;
    if (diffDays <= 2) return header;
  }
  return serverKey;
}

const monthKey = (date) => toDateKey(date).slice(0, 7);

module.exports = { toDateKey, startOfDay, addDays, isValidDateKey, resolveToday, monthKey, DAY_MS };
