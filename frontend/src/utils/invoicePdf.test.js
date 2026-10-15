import { jsPDF } from 'jspdf';
import { describe, expect, it } from 'vitest';
import { buildInvoicePdf, invoicePdfFilename, toPdfText } from './invoicePdf';

/** The text a PDF viewer would show, one entry per drawn string (jsPDF writes them uncompressed). */
const textOf = (doc) => [...doc.output().matchAll(/\((.*?)(?<!\\)\) Tj/g)].map((m) => m[1].replace(/\\([()\\])/g, '$1'));

const invoice = (overrides = {}) => ({
  _id: 'i1',
  number: 'INV-0007',
  amount: 1850,
  description: 'Phase 2 deposit',
  dueDate: '2026-10-05T00:00:00.000Z',
  createdAt: '2026-09-20T18:00:00.000Z',
  status: 'unpaid',
  effectiveStatus: 'overdue',
  paidAt: null,
  client: { _id: 'c1', name: 'Initech', company: 'Initech LLC', email: 'bill@initech.test' },
  ...overrides,
});
const from = { name: 'Ada Lovelace', email: 'ada@example.test' };

describe('invoice PDF', () => {
  it('contains the number, status, parties, dates, line and totals', () => {
    const text = textOf(buildInvoicePdf(jsPDF, invoice(), { from }));
    expect(text).toEqual(
      expect.arrayContaining(['INVOICE', 'INV-0007', 'OVERDUE', 'Ada Lovelace', 'ada@example.test', 'Initech', 'Initech LLC', 'bill@initech.test'])
    );
    expect(text).toEqual(expect.arrayContaining(['Issue date', 'Sep 20, 2026', 'Due date', 'Oct 5, 2026', 'Phase 2 deposit']));
    expect(text.filter((t) => t === '$1,850.00')).toHaveLength(3); // line, total, amount due
    expect(text).toContain('Amount due');
    expect(text).not.toContain('Paid on');
  });

  it('shows the due date as the stored calendar day and the issue date as the viewer’s day', () => {
    // Runs in Los Angeles: 03:00 UTC on the 21st is still the evening of the 20th there.
    const text = textOf(buildInvoicePdf(jsPDF, invoice({ createdAt: '2026-09-21T03:00:00.000Z', dueDate: '2026-10-01T00:00:00.000Z' }), { from }));
    expect(text).toContain('Sep 20, 2026');
    expect(text).toContain('Oct 1, 2026');
  });

  it('a paid invoice shows when it was paid and nothing left to pay', () => {
    const text = textOf(buildInvoicePdf(jsPDF, invoice({ status: 'paid', effectiveStatus: 'paid', paidAt: '2026-10-02T17:00:00.000Z' }), { from }));
    expect(text).toEqual(expect.arrayContaining(['PAID', 'Paid on', 'Oct 2, 2026', '-$1,850.00', '$0.00']));
    expect(text).not.toContain('OVERDUE');
  });

  it('copes with old or partial records', () => {
    const text = textOf(buildInvoicePdf(jsPDF, invoice({ number: undefined, client: null, description: '', createdAt: undefined, effectiveStatus: undefined }), { from: {} }));
    expect(text).toEqual(expect.arrayContaining(['Invoice', 'Unknown client', 'Services rendered', 'UNPAID']));
    expect(text).not.toContain('Issue date');
  });

  it('wraps a long description instead of running off the page', () => {
    const description = 'Design, build and launch of the marketing site including three rounds of revisions and handover'.repeat(2);
    const text = textOf(buildInvoicePdf(jsPDF, invoice({ description }), { from }));
    const lines = text.filter((t) => description.includes(t.trim()) && t.trim().length > 10);
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.join(' ').replace(/\s+/g, ' ')).toBe(description.replace(/\s+/g, ' ').trim());
  });

  it('wraps a long client name inside its column', () => {
    const name = 'A client with a rather long name to test wrapping Limited';
    const doc = buildInvoicePdf(jsPDF, invoice({ client: { name, company: 'Initech LLC', email: 'bill@initech.test' } }), { from });
    const text = textOf(doc);
    expect(text).not.toContain(name);
    const parts = text.filter((t) => name.includes(t) && t.length > 3);
    expect(parts.join(' ')).toBe(name);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    for (const part of parts) expect(110 + doc.getTextWidth(part)).toBeLessThanOrEqual(190);
    expect(text.indexOf('Initech LLC')).toBeGreaterThan(text.indexOf(parts.at(-1))); // the company moves down below it
  });

  it('keeps accents and turns phone punctuation into characters the PDF font can draw', () => {
    expect(toPdfText('Zoë’s café – “final” draft…')).toBe('Zoë\'s café - "final" draft...');
    expect(toPdfText('日本 ✓')).toBe('?? ?');
    expect(toPdfText(null)).toBe('');
    const text = textOf(buildInvoicePdf(jsPDF, invoice({ description: 'Logo – Zoë’s café', client: { name: 'Señor Ñandú' } }), { from }));
    expect(text).toContain("Logo - Zoë's café");
    expect(text).toContain('Señor Ñandú');
  });

  it('sets the document title so viewers and screen readers announce it', () => {
    const doc = buildInvoicePdf(jsPDF, invoice(), { from });
    expect(doc.output()).toContain('/Title (Invoice INV-0007)');
    expect(doc.output()).toContain('/Lang (en-US)');
  });

  it('names the file after the invoice number', () => {
    expect(invoicePdfFilename({ _id: 'abc', number: 'INV-0007' })).toBe('INV-0007.pdf');
    expect(invoicePdfFilename({ _id: '65f0c1' })).toBe('invoice-65f0c1.pdf');
    expect(invoicePdfFilename({ _id: 'x', number: 'A/B 1' })).toBe('A-B-1.pdf');
  });
});
