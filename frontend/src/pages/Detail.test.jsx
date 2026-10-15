import { screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { daysFromToday, fakeApi } from '../test/fakeApi';
import { location, renderApp } from '../test/render';

// Real jsPDF builds the file; only the final hand-off to the browser (save) is replaced, so tests can read what was built.
const savePdf = vi.hoisted(() => vi.fn());
vi.mock('jspdf', async (importOriginal) => {
  const actual = await importOriginal();
  function jsPDF(...args) {
    const doc = new actual.jsPDF(...args);
    doc.save = (...saveArgs) => savePdf.apply(doc, saveArgs);
    return doc;
  }
  return { ...actual, jsPDF };
});

describe('Invoice detail page', () => {
  const seed = (overrides = {}) => {
    const client = fakeApi.addClient({ name: 'Initech', company: 'Initech LLC', email: 'bill@initech.test' });
    const invoice = fakeApi.addInvoice({ clientId: client._id, amount: 1850, description: 'Phase 2 deposit', dueDate: daysFromToday(-5), ...overrides });
    return { client, invoice };
  };

  it('shows an invoice with who it is from and to', async () => {
    const { client, invoice } = seed();
    renderApp(`/invoice/${invoice._id}`);
    expect(await screen.findByRole('heading', { name: 'INV-0001' })).toBeInTheDocument();
    expect(screen.getByText('Overdue')).toBeInTheDocument();
    expect(within(screen.getByRole('article')).getByText('Ada Lovelace')).toBeInTheDocument(); // from
    expect(screen.getByRole('link', { name: 'Initech' })).toHaveAttribute('href', `/client/${client._id}`);
    expect(screen.getByText('Initech LLC')).toBeInTheDocument();
    expect(screen.getByText('bill@initech.test')).toBeInTheDocument();
    const table = screen.getByRole('table');
    expect(within(table).getByText('Phase 2 deposit')).toBeInTheDocument();
    expect(within(table).getAllByText('$1,850.00')).toHaveLength(2); // line + total
    expect(screen.getByText('Amount due').nextSibling).toHaveTextContent('$1,850.00');
  });

  it('uses fallback wording when the description is empty', async () => {
    const { invoice } = seed({ description: '' });
    renderApp(`/invoice/${invoice._id}`);
    expect(await screen.findByText('Services rendered')).toBeInTheDocument();
  });

  it('marks paid: amount due drops to zero and the paid date appears; then reopens', async () => {
    const { invoice } = seed();
    const { user } = renderApp(`/invoice/${invoice._id}`);
    await user.click(await screen.findByRole('button', { name: 'Mark as paid' }));
    expect(await screen.findByText('Marked as paid')).toBeInTheDocument();
    expect(await screen.findByText(/^Paid /)).toBeInTheDocument();
    expect(screen.getByText('Amount due').nextSibling).toHaveTextContent('$0.00');
    expect(screen.getAllByText('Paid').length).toBeGreaterThan(0);

    await user.click(screen.getByRole('button', { name: 'Mark as unpaid' }));
    expect(await screen.findByText('Invoice reopened')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('Amount due').nextSibling).toHaveTextContent('$1,850.00'));
  });

  it('shows the day it was paid in the viewer’s time zone', async () => {
    // 03:00 UTC on Oct 5 is the evening of Oct 4 in Los Angeles, where the suite runs.
    const { invoice } = seed({ status: 'paid', paidAt: '2026-10-05T03:00:00.000Z' });
    renderApp(`/invoice/${invoice._id}`);
    expect(await screen.findByText('Paid Oct 4, 2026')).toBeInTheDocument();
  });

  it('edits the invoice', async () => {
    const { invoice } = seed();
    const { user } = renderApp(`/invoice/${invoice._id}`);
    await user.click(await screen.findByRole('button', { name: 'Edit' }));
    const dialog = await screen.findByRole('dialog', { name: 'Edit invoice INV-0001' });
    await user.clear(within(dialog).getByLabelText('Description'));
    await user.type(within(dialog).getByLabelText('Description'), 'Final payment');
    await user.click(within(dialog).getByRole('button', { name: 'Save changes' }));
    expect(await within(screen.getByRole('table')).findByText('Final payment')).toBeInTheDocument();
  });

  it('prints through the browser', async () => {
    const { invoice } = seed();
    const { user } = renderApp(`/invoice/${invoice._id}`);
    await user.click(await screen.findByRole('button', { name: 'Print' }));
    expect(window.print).toHaveBeenCalled();
  });

  describe('Download PDF', () => {
    beforeEach(() => {
      savePdf.mockReset().mockResolvedValue();
    });
    const builtPdf = () => savePdf.mock.contexts[0].output();

    it('downloads the invoice as a PDF named after its number', async () => {
      const { invoice } = seed();
      const { user } = renderApp(`/invoice/${invoice._id}`);
      await user.click(await screen.findByRole('button', { name: 'Download PDF' }));
      expect(await screen.findByText('Downloaded INV-0001.pdf')).toBeInTheDocument();
      expect(savePdf).toHaveBeenCalledWith('INV-0001.pdf', { returnPromise: true });
      expect(builtPdf()).toContain('(Initech) Tj');
      expect(builtPdf()).toContain('(Ada Lovelace) Tj');
      expect(builtPdf()).toContain('(OVERDUE) Tj');
    });

    it('disables the button while the file is being made', async () => {
      let finish;
      savePdf.mockReturnValue(new Promise((resolve) => (finish = resolve)));
      const { invoice } = seed();
      const { user } = renderApp(`/invoice/${invoice._id}`);
      await user.click(await screen.findByRole('button', { name: 'Download PDF' }));
      expect(await screen.findByRole('button', { name: 'Preparing PDF…' })).toBeDisabled();
      finish();
      expect(await screen.findByRole('button', { name: 'Download PDF' })).toBeEnabled();
    });

    it('leaves the demo account’s placeholder email off the PDF', async () => {
      fakeApi.db.user = { ...fakeApi.db.user, name: 'Demo User', email: 'demo@taskmate.invalid', isDemo: true };
      const { invoice } = seed();
      const { user } = renderApp(`/invoice/${invoice._id}`);
      await user.click(await screen.findByRole('button', { name: 'Download PDF' }));
      await screen.findByText('Downloaded INV-0001.pdf');
      expect(builtPdf()).toContain('(Demo User) Tj');
      expect(builtPdf()).not.toContain('demo@taskmate.invalid');
    });

    it('says so when the PDF cannot be made', async () => {
      savePdf.mockRejectedValue(new Error('blocked'));
      const { invoice } = seed();
      const { user } = renderApp(`/invoice/${invoice._id}`);
      await user.click(await screen.findByRole('button', { name: 'Download PDF' }));
      expect(await screen.findByText('Could not create the PDF. Please try again.')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Download PDF' })).toBeEnabled();
    });
  });

  it('deletes after confirmation and returns to the list', async () => {
    const { invoice } = seed();
    const { user } = renderApp(`/invoice/${invoice._id}`);
    await user.click(await screen.findByRole('button', { name: 'Delete' }));
    await user.click(within(await screen.findByRole('dialog', { name: 'Delete this invoice?' })).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(location().path).toBe('/invoices'));
    expect(fakeApi.db.invoices).toHaveLength(0);
  });

  it('copes with a missing invoice', async () => {
    renderApp('/invoice/nope');
    expect(await screen.findByText('Invoice not found')).toBeInTheDocument();
  });

  it('shows a retryable error when the API fails', async () => {
    const { invoice } = seed();
    fakeApi.failNext('GET', `/invoices/${invoice._id}`, { status: 500, times: 1 });
    const { user } = renderApp(`/invoice/${invoice._id}`);
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('heading', { name: 'INV-0001' })).toBeInTheDocument();
  });

  it('copes with an invoice whose client was removed', async () => {
    const { invoice } = seed();
    fakeApi.db.clients = [];
    renderApp(`/invoice/${invoice._id}`);
    expect(await screen.findByText('Unknown client')).toBeInTheDocument();
  });
});

describe('Task detail page', () => {
  const seed = (overrides = {}) => {
    const client = fakeApi.addClient({ name: 'Globex' });
    const task = fakeApi.addTask({ title: 'Prepare slides', description: 'Line one\nLine two', priority: 'high', dueDate: daysFromToday(2), clientId: client._id, ...overrides });
    return { client, task };
  };

  it('shows the details', async () => {
    const { client, task } = seed();
    renderApp(`/task/${task._id}`);
    expect(await screen.findByRole('heading', { name: 'Prepare slides' })).toBeInTheDocument();
    expect(screen.getByText('High')).toBeInTheDocument();
    expect(screen.getByText('Due in 2 days')).toBeInTheDocument();
    expect(screen.getByText('· Open')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Globex' })).toHaveAttribute('href', `/client/${client._id}`);
    expect(screen.getByText(/Line one/)).toBeInTheDocument();
  });

  it('shows "None" and "No description" when those are empty', async () => {
    const { task } = seed({ clientId: null, description: '' });
    renderApp(`/task/${task._id}`);
    expect(await screen.findByText('None')).toBeInTheDocument();
    expect(screen.getByText('No description')).toBeInTheDocument();
  });

  it('completes and reopens', async () => {
    const { task } = seed();
    const { user } = renderApp(`/task/${task._id}`);
    await user.click(await screen.findByRole('button', { name: 'Mark complete' }));
    expect(await screen.findByText('Task completed')).toBeInTheDocument();
    expect(await screen.findByText(/· Completed/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Prepare slides' })).toHaveClass('text-decoration-line-through');
    await user.click(screen.getByRole('button', { name: 'Reopen' }));
    expect(await screen.findByText('· Open')).toBeInTheDocument();
  });

  it('edits', async () => {
    const { task } = seed();
    const { user } = renderApp(`/task/${task._id}`);
    await user.click(await screen.findByRole('button', { name: 'Edit' }));
    const dialog = await screen.findByRole('dialog', { name: 'Edit task' });
    await user.clear(within(dialog).getByLabelText('Title'));
    await user.type(within(dialog).getByLabelText('Title'), 'Prepare keynote');
    await user.click(within(dialog).getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByRole('heading', { name: 'Prepare keynote' })).toBeInTheDocument();
  });

  it('deletes after confirmation and returns to the list', async () => {
    const { task } = seed();
    const { user } = renderApp(`/task/${task._id}`);
    await user.click(await screen.findByRole('button', { name: 'Delete' }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(location().path).toBe('/tasks'));
    expect(fakeApi.db.tasks).toHaveLength(0);
  });

  it('copes with a missing task', async () => {
    renderApp('/task/nope');
    expect(await screen.findByText('Task not found')).toBeInTheDocument();
  });

  it('shows a retryable error', async () => {
    const { task } = seed();
    fakeApi.failNext('GET', `/tasks/${task._id}`, { status: 500, times: 1 });
    const { user } = renderApp(`/task/${task._id}`);
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('heading', { name: 'Prepare slides' })).toBeInTheDocument();
  });
});
