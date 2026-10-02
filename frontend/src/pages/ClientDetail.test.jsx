import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { daysFromToday, fakeApi } from '../test/fakeApi';
import { location, renderApp } from '../test/render';

const seed = () => {
  const client = fakeApi.addClient({ name: 'Initech', company: 'Initech LLC', email: 'bill@initech.test', phone: '555-0123', notes: 'Pays on the 15th\nPrefers email' });
  fakeApi.addTask({ title: 'Open task', clientId: client._id, dueDate: daysFromToday(2), priority: 'high' });
  fakeApi.addTask({ title: 'Closed task', clientId: client._id, completed: true });
  fakeApi.addTask({ title: 'Somebody else’s task' });
  fakeApi.addInvoice({ clientId: client._id, amount: 900, description: 'Phase one', dueDate: daysFromToday(-4) });
  fakeApi.addInvoice({ clientId: client._id, amount: 300, status: 'paid', dueDate: daysFromToday(-30) });
  return client;
};

describe('Client detail page', () => {
  it('shows contact details, notes, stats and only this client’s work', async () => {
    const client = seed();
    renderApp(`/client/${client._id}`);
    expect(await screen.findByRole('heading', { level: 1, name: 'Initech' })).toBeInTheDocument();
    expect(screen.getByText('Initech LLC')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /bill@initech.test/ })).toHaveAttribute('href', 'mailto:bill@initech.test');
    expect(screen.getByRole('link', { name: /555-0123/ })).toHaveAttribute('href', 'tel:555-0123');
    expect(screen.getByText(/Pays on the 15th/)).toBeInTheDocument();

    // stat cards: open tasks, outstanding, overdue, paid
    expect(screen.getByText('Open tasks').closest('.tm-card')).toHaveTextContent('1');
    expect(screen.getByText('Outstanding').closest('.tm-card')).toHaveTextContent('$900.00');
    expect(screen.getAllByText('Overdue')[0].closest('.tm-card')).toHaveTextContent('$900.00');
    expect(screen.getByText('Paid to date').closest('.tm-card')).toHaveTextContent('$300.00');

    const tasks = within(screen.getByTestId('client-tasks')).getAllByRole('listitem');
    expect(tasks).toHaveLength(2);
    expect(screen.queryByText('Somebody else’s task')).not.toBeInTheDocument();
    const invoices = within(screen.getByTestId('client-invoices')).getAllByRole('listitem');
    expect(invoices).toHaveLength(2);
    expect(within(invoices[0]).getByText('Overdue')).toBeInTheDocument();
    expect(within(invoices[1]).getByText('Paid')).toBeInTheDocument();
  });

  it('completes a task from here', async () => {
    const client = seed();
    const { user } = renderApp(`/client/${client._id}`);
    await user.click(await screen.findByRole('checkbox', { name: /Mark “Open task” as complete/ }));
    await waitFor(() => expect(screen.getByRole('checkbox', { name: /Reopen “Open task”/ })).toBeChecked());
  });

  it('adds a task already linked to this client', async () => {
    const client = seed();
    const { user } = renderApp(`/client/${client._id}`);
    await user.click(await screen.findByRole('button', { name: 'Task' }));
    const dialog = await screen.findByRole('dialog', { name: 'New task' });
    await user.type(within(dialog).getByLabelText('Title'), 'Follow up');
    await user.click(within(dialog).getByRole('button', { name: 'Add task' }));
    await waitFor(() => expect(within(screen.getByTestId('client-tasks')).getByText('Follow up')).toBeInTheDocument());
    expect(fakeApi.lastCall('POST', '/tasks').body.clientId).toBe(client._id);
  });

  it('creates an invoice for this client and shows it in the list', async () => {
    const client = seed();
    const { user } = renderApp(`/client/${client._id}`);
    await user.click(await screen.findByRole('button', { name: 'Invoice' }));
    const dialog = await screen.findByRole('dialog', { name: 'New invoice' });
    await waitFor(() => expect(within(dialog).getByLabelText('Client')).toHaveValue(client._id));
    await user.type(within(dialog).getByLabelText('Amount'), '1250.5');
    await user.type(within(dialog).getByLabelText('Description'), 'Phase two');
    await user.click(within(dialog).getByRole('button', { name: 'Create invoice' }));
    expect(await screen.findByText('Invoice INV-0003 created')).toBeInTheDocument();
    await waitFor(() => expect(within(screen.getByTestId('client-invoices')).getByText('INV-0003')).toBeInTheDocument());
    expect(screen.getByText('Outstanding').closest('.tm-card')).toHaveTextContent('$2,150.50');
  });

  it('edits the client', async () => {
    const client = seed();
    const { user } = renderApp(`/client/${client._id}`);
    await user.click(await screen.findByRole('button', { name: 'Edit' }));
    const dialog = await screen.findByRole('dialog', { name: 'Edit client' });
    expect(within(dialog).getByLabelText('Name')).toHaveValue('Initech');
    await user.clear(within(dialog).getByLabelText('Name'));
    await user.type(within(dialog).getByLabelText('Name'), 'Initech International');
    await user.click(within(dialog).getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Initech International' })).toBeInTheDocument();
  });

  describe('deleting', () => {
    it('removes a client without invoices and keeps their tasks (unlinked)', async () => {
      const client = fakeApi.addClient({ name: 'Solo' });
      fakeApi.addTask({ title: 'Linked task', clientId: client._id });
      const { user } = renderApp(`/client/${client._id}`);
      await user.click(await screen.findByRole('button', { name: 'Delete' }));
      const dialog = await screen.findByRole('dialog', { name: 'Delete this client?' });
      expect(dialog).toHaveTextContent('Their tasks stay in your list');
      await user.click(within(dialog).getByRole('button', { name: 'Delete' }));
      expect(await screen.findByText('Client deleted')).toBeInTheDocument();
      await waitFor(() => expect(location().path).toBe('/clients'));
      expect(fakeApi.db.clients).toHaveLength(0);
      expect(fakeApi.db.tasks).toHaveLength(1);
      expect(fakeApi.db.tasks[0].clientId).toBeNull();
    });

    it('protects a client who still has invoices, and needs a second explicit confirmation', async () => {
      const client = seed();
      const { user } = renderApp(`/client/${client._id}`);
      await user.click(await screen.findByRole('button', { name: 'Delete' }));
      await user.click(within(await screen.findByRole('dialog', { name: 'Delete this client?' })).getByRole('button', { name: 'Delete' }));

      const cascade = await screen.findByRole('dialog', { name: 'Delete Initech and 2 invoices?' });
      expect(cascade).toHaveTextContent('permanently delete them too');
      expect(fakeApi.db.clients).toHaveLength(1); // nothing is gone yet
      expect(fakeApi.db.invoices).toHaveLength(2);
      expect(fakeApi.lastCall('DELETE', `/clients/${client._id}`).search).toBe('');

      await user.click(within(cascade).getByRole('button', { name: 'Delete everything' }));
      await waitFor(() => expect(location().path).toBe('/clients'));
      expect(fakeApi.lastCall('DELETE', `/clients/${client._id}`).search).toBe('?cascade=true');
      expect(fakeApi.db.invoices).toHaveLength(0);
      expect(fakeApi.db.clients).toHaveLength(0);
    });

    it('lets the user back out of the cascade step', async () => {
      const client = seed();
      const { user } = renderApp(`/client/${client._id}`);
      await user.click(await screen.findByRole('button', { name: 'Delete' }));
      await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Delete' }));
      const cascade = await screen.findByRole('dialog', { name: /and 2 invoices/ });
      await user.click(within(cascade).getByRole('button', { name: 'Cancel' }));
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect(fakeApi.db.clients).toHaveLength(1);
      expect(fakeApi.db.invoices).toHaveLength(2);
      expect(location().path).toBe(`/client/${client._id}`);
    });
  });

  it('handles an unknown client gracefully', async () => {
    renderApp('/client/does-not-exist');
    expect(await screen.findByText('Client not found')).toBeInTheDocument();
    expect(within(screen.getByRole('main')).getByRole('link', { name: /Clients/ })).toHaveAttribute('href', '/clients');
  });

  it('shows empty sections for a brand-new client', async () => {
    const client = fakeApi.addClient({ name: 'Fresh' });
    renderApp(`/client/${client._id}`);
    expect(await screen.findByText('No tasks for this client yet.')).toBeInTheDocument();
    expect(screen.getByText('No invoices for this client yet.')).toBeInTheDocument();
  });

  it('shows a retryable error if the API is down', async () => {
    const client = fakeApi.addClient({ name: 'Flaky' });
    fakeApi.failNext('GET', `/clients/${client._id}`, { status: 500, times: 1 });
    const { user } = renderApp(`/client/${client._id}`);
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Flaky' })).toBeInTheDocument();
  });
});
