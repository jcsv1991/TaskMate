import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { daysFromToday, fakeApi } from '../test/fakeApi';
import { location, renderApp } from '../test/render';

const stat = (id) => screen.getByTestId(id);

const seed = () => {
  const acme = fakeApi.addClient({ name: 'Acme' });
  const beta = fakeApi.addClient({ name: 'Beta' });
  fakeApi.addTask({ title: 'Late one', dueDate: daysFromToday(-2), priority: 'high', clientId: acme._id });
  fakeApi.addTask({ title: 'Due today', dueDate: daysFromToday(0), clientId: beta._id });
  fakeApi.addTask({ title: 'Next week', dueDate: daysFromToday(6) });
  fakeApi.addTask({ title: 'Far away', dueDate: daysFromToday(30) });
  fakeApi.addTask({ title: 'Finished', completed: true, dueDate: daysFromToday(-1) });
  fakeApi.addInvoice({ clientId: acme._id, amount: 1200, dueDate: daysFromToday(-10) });
  fakeApi.addInvoice({ clientId: beta._id, amount: 800, dueDate: daysFromToday(5) });
  fakeApi.addInvoice({ clientId: beta._id, amount: 500, status: 'paid', paidAt: new Date().toISOString(), dueDate: daysFromToday(-1) });
  return { acme, beta };
};

describe('Dashboard', () => {
  it('summarises tasks and money', async () => {
    seed();
    renderApp('/');
    await screen.findByTestId('stat-open-tasks');
    expect(stat('stat-open-tasks')).toHaveTextContent('4');
    expect(stat('stat-open-tasks')).toHaveTextContent('1 overdue');
  });

  it('counts "due this week" as today through seven days out, never the past', async () => {
    seed();
    renderApp('/');
    await screen.findByTestId('stat-due-week');
    // Due today (0) and next week (+6) are inside the window; the overdue one and the one 30 days out are not.
    expect(stat('stat-due-week')).toHaveTextContent(/^Due this week\s*2/);
    expect(stat('stat-due-week')).toHaveTextContent('1 due today');
  });

  it('shows outstanding money, how much of it is late, and what was paid this month', async () => {
    seed();
    renderApp('/');
    await screen.findByTestId('stat-outstanding');
    expect(stat('stat-outstanding')).toHaveTextContent('$2,000.00');
    expect(stat('stat-outstanding')).toHaveTextContent('$1,200.00 overdue');
    expect(stat('stat-paid-month')).toHaveTextContent('$500.00');
    expect(stat('stat-paid-month')).toHaveTextContent('$500.00 all time');
  });

  it('lists focus tasks in due order, with overdue first and far-off work excluded', async () => {
    seed();
    renderApp('/');
    const list = await screen.findByTestId('focus-list');
    const items = within(list).getAllByRole('listitem');
    expect(items.map((li) => li.textContent)).toEqual([
      expect.stringContaining('Late one'),
      expect.stringContaining('Due today'),
      expect.stringContaining('Next week'),
    ]);
    expect(within(items[0]).getByText('2 days overdue')).toBeInTheDocument();
    expect(within(items[0]).getByText('Acme')).toBeInTheDocument();
    expect(within(items[0]).getByText('High')).toBeInTheDocument();
    expect(within(list).queryByText('Far away')).not.toBeInTheDocument();
    expect(within(list).queryByText('Finished')).not.toBeInTheDocument();
  });

  it('completes a task straight from the focus list', async () => {
    seed();
    const { user } = renderApp('/');
    await user.click(await screen.findByRole('checkbox', { name: /Mark “Due today” as complete/ }));
    expect(await screen.findByText('Task completed')).toBeInTheDocument();
    await waitFor(() => expect(within(screen.getByTestId('focus-list')).queryByText('Due today')).not.toBeInTheDocument());
    expect(stat('stat-open-tasks')).toHaveTextContent('3');
  });

  it('lists overdue invoices and marks one paid in place', async () => {
    seed();
    const { user } = renderApp('/');
    const list = await screen.findByTestId('overdue-list');
    expect(within(list).getByText(/Acme/)).toBeInTheDocument();
    expect(within(list).getByText('INV-0001')).toBeInTheDocument();
    expect(within(list).getByText(/10 days overdue/)).toBeInTheDocument();
    expect(within(list).getByText('$1,200.00')).toBeInTheDocument();

    await user.click(within(list).getByRole('button', { name: /Mark invoice INV-0001 as paid/ }));
    expect(await screen.findByText('Invoice marked as paid')).toBeInTheDocument();
    expect(await screen.findByText('Every invoice is paid or not yet due. Nice.')).toBeInTheDocument();
    expect(stat('stat-outstanding')).toHaveTextContent('$800.00');
    expect(stat('stat-outstanding')).toHaveTextContent('Nothing overdue');
  });

  it('ranks clients by billing and shows what each still owes', async () => {
    seed();
    renderApp('/');
    const list = await screen.findByTestId('top-clients');
    const items = within(list).getAllByRole('listitem');
    expect(items[0]).toHaveTextContent('Beta');
    expect(items[0]).toHaveTextContent('$1,300.00');
    expect(items[0]).toHaveTextContent('$800.00 owed');
    expect(items[1]).toHaveTextContent('Acme');
    expect(items[1]).toHaveTextContent('$1,200.00 owed');
  });

  it('links the stat cards to the matching filtered lists', async () => {
    seed();
    const { user } = renderApp('/');
    await screen.findByTestId('stat-outstanding');
    await user.click(within(stat('stat-outstanding').closest('a')).getByText('Outstanding'));
    await waitFor(() => expect(location().path).toBe('/invoices'));
    expect(location().search).toBe('?status=outstanding');
    await screen.findAllByTestId('invoice-row');
    // The invoice list and the dashboard card agree about what "outstanding" means.
    expect(screen.getByTestId('invoice-total')).toHaveTextContent('$2,000.00');
  });

  it('shows 6-month totals under the chart', async () => {
    seed();
    renderApp('/');
    const totals = await screen.findByTestId('revenue-totals');
    expect(totals).toHaveTextContent('Received$500.00');
    expect(totals).toHaveTextContent('Still to collect$2,000.00');
    expect(screen.getByRole('img', { name: /Revenue by month/ })).toBeInTheDocument();
  });

  it('greets a brand-new user with a three-step start', async () => {
    const { user } = renderApp('/');
    expect(await screen.findByRole('heading', { name: 'Welcome to TaskMate' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '1. Add a client' }));
    expect(await screen.findByRole('dialog', { name: 'New client' })).toBeInTheDocument();
  });

  it('shows friendly empty panels once there is data but nothing urgent', async () => {
    const c = fakeApi.addClient({ name: 'Quiet' });
    fakeApi.addTask({ title: 'Someday', dueDate: daysFromToday(60), clientId: c._id });
    renderApp('/');
    expect(await screen.findByText('You’re clear for the week')).toBeInTheDocument();
    expect(screen.getByText('Every invoice is paid or not yet due. Nice.')).toBeInTheDocument();
    expect(screen.getByText('No billing yet')).toBeInTheDocument();
    expect(stat('stat-open-tasks')).toHaveTextContent('All on track');
  });

  it('quick-add buttons open the right dialogs and refresh the numbers', async () => {
    seed();
    const { user } = renderApp('/');
    await screen.findByTestId('stat-open-tasks');
    await user.click(screen.getByRole('button', { name: 'Task' }));
    const dialog = await screen.findByRole('dialog', { name: 'New task' });
    await user.type(within(dialog).getByLabelText('Title'), 'Brand new');
    await user.click(within(dialog).getByRole('button', { name: 'Add task' }));
    await waitFor(() => expect(stat('stat-open-tasks')).toHaveTextContent('5'));
  });

  it('greets by time of day, and by first name for real accounts', async () => {
    seed();
    renderApp('/');
    const heading = await screen.findByRole('heading', { level: 1 });
    expect(heading).toHaveTextContent(/^(Working late|Good (morning|afternoon|evening)), Ada$/);
  });

  it('shows a retryable error when the summary fails', async () => {
    seed();
    fakeApi.failNext('GET', '/dashboard/summary', { status: 500, times: 1 });
    const { user } = renderApp('/');
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    await screen.findByTestId('stat-open-tasks');
  });

  it('sends the viewer’s calendar date so "overdue" matches their day', async () => {
    seed();
    renderApp('/');
    await screen.findByTestId('stat-open-tasks');
    expect(fakeApi.lastCall('GET', '/dashboard/summary').headers['x-client-today']).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
