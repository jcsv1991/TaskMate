import { screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { daysFromToday, fakeApi } from '../test/fakeApi';
import { server } from '../test/server';
import { location, renderApp } from '../test/render';

const rows = () => screen.queryAllByTestId('invoice-row');
const numbers = () => rows().map((r) => within(r).getAllByRole('link')[0].textContent);

const seed = () => {
  const acme = fakeApi.addClient({ name: 'Acme' });
  const beta = fakeApi.addClient({ name: 'Beta' });
  fakeApi.addInvoice({ clientId: acme._id, amount: 1000, status: 'paid', dueDate: daysFromToday(-20), description: 'Logo' });
  fakeApi.addInvoice({ clientId: acme._id, amount: 250.5, dueDate: daysFromToday(-3), description: 'Brand guide' });
  fakeApi.addInvoice({ clientId: beta._id, amount: 400, dueDate: daysFromToday(10), description: 'Website' });
  return { acme, beta };
};

describe('Invoices page', () => {
  it('lists invoices with client, due date, amount and an effective status', async () => {
    seed();
    renderApp('/invoices');
    await screen.findAllByTestId('invoice-row');
    expect(rows()).toHaveLength(3);
    const overdue = rows().find((r) => within(r).queryByText('INV-0002'));
    expect(within(overdue).getByText('Acme')).toBeInTheDocument();
    expect(within(overdue).getByText('$250.50')).toBeInTheDocument();
    expect(within(overdue).getByText('Overdue')).toBeInTheDocument(); // stored as "unpaid", derived from the due date
    const upcoming = rows().find((r) => within(r).queryByText('INV-0003'));
    expect(within(upcoming).getByText('Unpaid')).toBeInTheDocument();
  });

  it('totals everything matching the filter, not just the visible page', async () => {
    seed();
    const { user } = renderApp('/invoices');
    await screen.findAllByTestId('invoice-row');
    expect(screen.getByTestId('invoice-total')).toHaveTextContent('$1,650.50');
    expect(screen.getByText('Total of 3 invoices')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Overdue' }));
    await waitFor(() => expect(rows()).toHaveLength(1));
    expect(screen.getByTestId('invoice-total')).toHaveTextContent('$250.50');
    expect(screen.getByText('Total of 1 invoice matching')).toBeInTheDocument();
  });

  it('filters by status, including "Outstanding" (unpaid + overdue)', async () => {
    seed();
    const { user } = renderApp('/invoices');
    await screen.findAllByTestId('invoice-row');
    await user.click(screen.getByRole('button', { name: 'Paid' }));
    await waitFor(() => expect(numbers()).toEqual(['INV-0001']));
    await user.click(screen.getByRole('button', { name: 'Outstanding' }));
    await waitFor(() => expect(numbers().sort()).toEqual(['INV-0002', 'INV-0003']));
    expect(location().search).toContain('status=outstanding');
    await user.click(screen.getByRole('button', { name: 'All' }));
    await waitFor(() => expect(rows()).toHaveLength(3));
    expect(location().search).not.toContain('status');
  });

  it('filters by client and searches by number, description or client name', async () => {
    const { beta } = seed();
    const { user } = renderApp('/invoices');
    await screen.findAllByTestId('invoice-row');
    await user.selectOptions(screen.getByLabelText('Client'), beta._id);
    await waitFor(() => expect(numbers()).toEqual(['INV-0003']));
    await user.selectOptions(screen.getByLabelText('Client'), '');
    await waitFor(() => expect(rows()).toHaveLength(3));
    await user.type(screen.getByLabelText('Search'), 'brand');
    await waitFor(() => expect(numbers()).toEqual(['INV-0002']));
  });

  it('sorts by amount', async () => {
    seed();
    const { user } = renderApp('/invoices');
    await screen.findAllByTestId('invoice-row');
    await user.selectOptions(screen.getByLabelText('Sort by'), 'amount:desc');
    await waitFor(() => expect(numbers()).toEqual(['INV-0001', 'INV-0003', 'INV-0002']));
    await user.selectOptions(screen.getByLabelText('Sort by'), 'amount:asc');
    await waitFor(() => expect(numbers()).toEqual(['INV-0002', 'INV-0003', 'INV-0001']));
  });

  it('opens straight into a filtered view from a dashboard link', async () => {
    seed();
    renderApp('/invoices?status=outstanding');
    await screen.findAllByTestId('invoice-row');
    expect(numbers().sort()).toEqual(['INV-0002', 'INV-0003']);
    expect(screen.getByRole('button', { name: 'Outstanding' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('explains an empty list and offers to create the first invoice', async () => {
    fakeApi.addClient();
    const { user } = renderApp('/invoices');
    expect(await screen.findByText('No invoices yet')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Create your first invoice' }));
    expect(await screen.findByRole('dialog', { name: 'New invoice' })).toBeInTheDocument();
  });

  it('offers to clear filters when nothing matches', async () => {
    seed();
    const { user } = renderApp('/invoices?status=paid&q=zzz');
    expect(await screen.findByText('No invoices match these filters')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    await waitFor(() => expect(rows()).toHaveLength(3));
  });

  it('retries after a failed load', async () => {
    seed();
    fakeApi.failNext('GET', '/invoices', { status: 500, times: 1 });
    const { user } = renderApp('/invoices');
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    await screen.findAllByTestId('invoice-row');
  });

  describe('status changes', () => {
    it('marks an invoice paid and unpaid from the row', async () => {
      seed();
      const { user } = renderApp('/invoices');
      await screen.findAllByTestId('invoice-row');
      await user.click(screen.getByRole('button', { name: 'Mark invoice INV-0002 as paid' }));
      expect(await screen.findByText('Invoice INV-0002 marked as paid')).toBeInTheDocument();
      await waitFor(() => expect(within(rows().find((r) => within(r).queryByText('INV-0002'))).getByText('Paid')).toBeInTheDocument());
      expect(fakeApi.db.invoices[1]).toMatchObject({ status: 'paid' });
      expect(fakeApi.db.invoices[1].paidAt).toBeTruthy();

      await user.click(screen.getByRole('button', { name: 'Mark invoice INV-0002 as unpaid' }));
      expect(await screen.findByText('Invoice reopened')).toBeInTheDocument();
      await waitFor(() => expect(within(rows().find((r) => within(r).queryByText('INV-0002'))).getByText('Overdue')).toBeInTheDocument());
      expect(fakeApi.db.invoices[1].paidAt).toBeNull();
    });

    it('reports a failure without changing the row', async () => {
      seed();
      fakeApi.failNext('PATCH', `/invoices/${fakeApi.db.invoices[2]._id}`, { status: 500, times: 1 });
      const { user } = renderApp('/invoices');
      await user.click(await screen.findByRole('button', { name: 'Mark invoice INV-0003 as paid' }));
      expect(await screen.findByRole('alert')).toHaveTextContent(/server exploded/i);
      expect(fakeApi.db.invoices[2].status).toBe('unpaid');
    });
  });

  describe('creating', () => {
    it('creates an invoice with the next number and refreshes the list', async () => {
      seed();
      const { user } = renderApp('/invoices');
      await screen.findAllByTestId('invoice-row');
      await user.click(screen.getByRole('button', { name: 'New invoice' }));
      const dialog = await screen.findByRole('dialog', { name: 'New invoice' });
      const beta = fakeApi.db.clients[1];
      await waitFor(() => expect(within(dialog).getByRole('option', { name: 'Beta' })).toBeInTheDocument());
      await user.selectOptions(within(dialog).getByLabelText('Client'), beta._id);
      await user.type(within(dialog).getByLabelText('Amount'), '99.99');
      await user.type(within(dialog).getByLabelText('Description'), 'Hosting');
      await user.click(within(dialog).getByRole('button', { name: 'Create invoice' }));
      expect(await screen.findByText('Invoice INV-0004 created')).toBeInTheDocument();
      await waitFor(() => expect(rows()).toHaveLength(4));
      expect(fakeApi.lastCall('POST', '/invoices').body).toMatchObject({ clientId: beta._id, amount: 99.99, description: 'Hosting' });
      // Default due date is two weeks out.
      expect(fakeApi.lastCall('POST', '/invoices').body.dueDate).toBe(daysFromToday(14).slice(0, 10));
    });

    it('checks client, amount and due date', async () => {
      seed();
      const { user } = renderApp('/invoices');
      await user.click(await screen.findByRole('button', { name: 'New invoice' }));
      const dialog = await screen.findByRole('dialog');
      await user.clear(within(dialog).getByLabelText('Due date'));
      await user.click(within(dialog).getByRole('button', { name: 'Create invoice' }));
      expect(within(dialog).getByText('Choose a client')).toBeInTheDocument();
      expect(within(dialog).getByText('Enter an amount greater than 0')).toBeInTheDocument();
      expect(within(dialog).getByText('Choose a due date')).toBeInTheDocument();
      expect(fakeApi.callsTo('POST', '/invoices')).toHaveLength(0);
    });

    it('rejects zero and negative amounts', async () => {
      seed();
      const { user } = renderApp('/invoices');
      await user.click(await screen.findByRole('button', { name: 'New invoice' }));
      const dialog = await screen.findByRole('dialog');
      await waitFor(() => expect(within(dialog).getByRole('option', { name: 'Acme' })).toBeInTheDocument());
      await user.selectOptions(within(dialog).getByLabelText('Client'), fakeApi.db.clients[0]._id);
      await user.type(within(dialog).getByLabelText('Amount'), '-5');
      await user.click(within(dialog).getByRole('button', { name: 'Create invoice' }));
      expect(within(dialog).getByText('Enter an amount greater than 0')).toBeInTheDocument();
    });

    it('tells a new user they need a client first', async () => {
      const { user } = renderApp('/invoices');
      await user.click(await screen.findByRole('button', { name: 'New invoice' }));
      const dialog = await screen.findByRole('dialog');
      expect(await within(dialog).findByText('Add a client first, then you can invoice them.')).toBeInTheDocument();
      expect(within(dialog).getByLabelText('Client')).toBeDisabled();
    });
  });

  describe('editing and deleting', () => {
    it('edits amount and due date', async () => {
      seed();
      const { user } = renderApp('/invoices');
      await user.click(await screen.findByRole('button', { name: 'Edit invoice INV-0003' }));
      const dialog = await screen.findByRole('dialog', { name: 'Edit invoice INV-0003' });
      expect(within(dialog).getByLabelText('Amount')).toHaveValue(400);
      expect(within(dialog).getByLabelText('Due date')).toHaveValue(daysFromToday(10).slice(0, 10));
      await user.clear(within(dialog).getByLabelText('Amount'));
      await user.type(within(dialog).getByLabelText('Amount'), '450');
      await user.click(within(dialog).getByRole('button', { name: 'Save changes' }));
      expect(await screen.findByText('Invoice updated')).toBeInTheDocument();
      await waitFor(() => expect(screen.getByText('$450.00')).toBeInTheDocument());
    });

    it('confirms before deleting', async () => {
      seed();
      const { user } = renderApp('/invoices');
      await user.click(await screen.findByRole('button', { name: 'Delete invoice INV-0003' }));
      const dialog = await screen.findByRole('dialog', { name: 'Delete this invoice?' });
      expect(dialog).toHaveTextContent('Invoice INV-0003 for $400.00 will be permanently removed.');
      await user.click(within(dialog).getByRole('button', { name: 'Delete' }));
      expect(await screen.findByText('Invoice deleted')).toBeInTheDocument();
      await waitFor(() => expect(rows()).toHaveLength(2));
      expect(screen.getByText('Total of 2 invoices')).toBeInTheDocument();
    });
  });

  describe('CSV export', () => {
    it('downloads through an authenticated request', async () => {
      seed();
      const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
      const { user } = renderApp('/invoices');
      await user.click(await screen.findByRole('button', { name: /Export CSV/ }));
      expect(await screen.findByText('Invoices exported')).toBeInTheDocument();
      expect(click).toHaveBeenCalled();
      expect(fakeApi.lastCall('GET', '/export/invoices.csv')).toBeTruthy();
    });

    it('shows an error if the export fails', async () => {
      seed();
      server.use(http.get('*/api/export/invoices.csv', () => HttpResponse.json({ msg: 'Export unavailable' }, { status: 503 })));
      const { user } = renderApp('/invoices');
      await user.click(await screen.findByRole('button', { name: /Export CSV/ }));
      expect(await screen.findByRole('alert')).toBeInTheDocument();
    });
  });
});
