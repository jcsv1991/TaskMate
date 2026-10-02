import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { daysFromToday, fakeApi } from '../test/fakeApi';
import { location, renderApp } from '../test/render';

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
