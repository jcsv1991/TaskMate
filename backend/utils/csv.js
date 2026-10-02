/**
 * Minimal RFC 4180 CSV writer with protection against CSV/formula injection:
 * a cell that starts with = + - @ (or tab/CR) is prefixed with a single quote so
 * spreadsheet software treats it as text instead of executing it.
 */
const DANGEROUS_START = /^[=+\-@\t\r]/;

function cell(value) {
  if (value === null || value === undefined) return '';
  let text = value instanceof Date ? value.toISOString().slice(0, 10) : String(value);
  if (typeof value === 'string' && DANGEROUS_START.test(text)) text = `'${text}`;
  if (/[",\n\r]/.test(text)) text = `"${text.replace(/"/g, '""')}"`;
  return text;
}

function toCsv(columns, rows) {
  const header = columns.map((c) => cell(c.header)).join(',');
  const lines = rows.map((row) => columns.map((c) => cell(c.value(row))).join(','));
  // The BOM makes Excel read the file as UTF-8 (so "Café" is not mangled).
  return `\uFEFF${[header, ...lines].join('\r\n')}\r\n`;
}

module.exports = { toCsv, cell };
