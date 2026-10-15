import { formatCurrency, formatDate, formatLocalDate } from './format';

const STATUS = {
  paid: { label: 'Paid', color: [20, 108, 67] },
  unpaid: { label: 'Unpaid', color: [10, 88, 202] },
  overdue: { label: 'Overdue', color: [176, 42, 55] },
};

const INK = [33, 37, 41];
const MUTED = [90, 96, 102];
const RULE = [206, 212, 218];

/**
 * The PDF's built-in Helvetica only covers Latin-1. One character outside it makes
 * jsPDF re-encode the whole string, which then prints as gibberish, so typographic
 * punctuation (the curly quotes and dashes phones type) becomes its plain
 * equivalent and anything else it cannot draw becomes "?". Accents such as é or ñ
 * are Latin-1 and pass through untouched.
 */
const REPLACEMENTS = {
  '‘': "'",
  '’': "'",
  '‚': "'",
  '“': '"',
  '”': '"',
  '„': '"',
  '–': '-',
  '—': '-',
  '−': '-',
  '…': '...',
  '•': '*',
  ' ': ' ',
  ' ': ' ',
};
export const toPdfText = (value) =>
  Array.from(String(value ?? ''))
    .map((ch) => REPLACEMENTS[ch] ?? (ch.codePointAt(0) > 0xff ? '?' : ch))
    .join('');

/** INV-0007.pdf, or invoice-<id>.pdf for old invoices that have no number. */
export const invoicePdfFilename = (invoice) => `${(invoice.number || `invoice-${invoice._id}`).replace(/[^\w.-]+/g, '-')}.pdf`;

/**
 * Lay out one invoice on an A4 page. Takes the jsPDF class as an argument so the
 * library (the heavy part) is only fetched when somebody actually downloads.
 * `from` is { name, email } of the sender; either may be empty.
 */
export function buildInvoicePdf(JsPDF, invoice, { from = {} } = {}) {
  const doc = new JsPDF({ unit: 'mm', format: 'a4' });
  const left = 20;
  const right = doc.internal.pageSize.getWidth() - 20;
  const middle = 110;
  const paid = invoice.status === 'paid';
  const status = STATUS[invoice.effectiveStatus] || STATUS.unpaid;
  const heading = invoice.number ? `Invoice ${invoice.number}` : 'Invoice';

  const write = (value, x, y, { size = 11, bold = false, color = INK, align } = {}) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    doc.setTextColor(...color);
    doc.text(toPdfText(value), x, y, align ? { align } : undefined);
  };
  const rule = (y) => {
    doc.setDrawColor(...RULE);
    doc.setLineWidth(0.3);
    doc.line(left, y, right, y);
  };

  doc.setProperties({ title: toPdfText(heading), subject: toPdfText(invoice.description || 'Invoice'), author: toPdfText(from.name || ''), creator: 'TaskMate' });
  doc.setLanguage('en-US');
  doc.viewerPreferences({ DisplayDocTitle: true });

  // Header: what it is, its number and where it stands.
  write('INVOICE', left, 24, { size: 10, bold: true, color: MUTED });
  write(invoice.number || 'Invoice', left, 35, { size: 24, bold: true });
  write(status.label.toUpperCase(), right, 24, { size: 11, bold: true, color: status.color, align: 'right' });

  // Who it is from and who pays it.
  let y = 52;
  write('FROM', left, y, { size: 9, bold: true, color: MUTED });
  write('BILL TO', middle, y, { size: 9, bold: true, color: MUTED });
  const fromLines = [from.name, from.email].filter(Boolean);
  const client = invoice.client;
  const toLines = client ? [client.name, client.company, client.email].filter(Boolean) : ['Unknown client'];
  // Name first in full ink, the rest muted; long values wrap within their column. Returns the rows used.
  const party = (lines, x, width) => {
    let row = 0;
    lines.forEach((line, i) => {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);
      doc.splitTextToSize(toPdfText(line), width).forEach((part) => write(part, x, y + 6 + row++ * 5.5, { color: i ? MUTED : INK }));
    });
    return row;
  };
  const rows = Math.max(party(fromLines, left, middle - left - 8), party(toLines, middle, right - middle), 1);
  y += 6 + rows * 5.5 + 6;

  // Dates.
  const dates = [
    invoice.createdAt && ['Issue date', formatLocalDate(invoice.createdAt)],
    ['Due date', formatDate(invoice.dueDate)],
    paid && invoice.paidAt && ['Paid on', formatLocalDate(invoice.paidAt)],
  ].filter(Boolean);
  dates.forEach(([label, value], i) => {
    write(label, left, y + i * 6, { size: 10, color: MUTED });
    write(value, left + 30, y + i * 6, { size: 10 });
  });
  y += dates.length * 6 + 8;

  // The line item.
  write('DESCRIPTION', left, y, { size: 9, bold: true, color: MUTED });
  write('AMOUNT', right, y, { size: 9, bold: true, color: MUTED, align: 'right' });
  rule(y + 3);
  y += 10;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  const description = doc.splitTextToSize(toPdfText(invoice.description || 'Services rendered'), right - left - 45);
  description.forEach((line, i) => write(line, left, y + i * 5.5));
  write(formatCurrency(invoice.amount), right, y, { align: 'right' });
  y += description.length * 5.5 + 2;
  rule(y);

  // Totals.
  y += 8;
  const labelX = right - 45;
  write('Total', labelX, y, { size: 10, color: MUTED, align: 'right' });
  write(formatCurrency(invoice.amount), right, y, { size: 10, align: 'right' });
  if (paid) {
    y += 6;
    write('Paid', labelX, y, { size: 10, color: MUTED, align: 'right' });
    write(`-${formatCurrency(invoice.amount)}`, right, y, { size: 10, align: 'right' });
  }
  y += 8;
  write('Amount due', labelX, y, { size: 12, bold: true, align: 'right' });
  write(formatCurrency(paid ? 0 : invoice.amount), right, y, { size: 12, bold: true, align: 'right' });

  return doc;
}

/** Build the PDF and hand it to the browser as a download. Resolves with the file name. */
export async function downloadInvoicePdf(invoice, options) {
  const { jsPDF } = await import('jspdf');
  const filename = invoicePdfFilename(invoice);
  await buildInvoicePdf(jsPDF, invoice, options).save(filename, { returnPromise: true });
  return filename;
}
