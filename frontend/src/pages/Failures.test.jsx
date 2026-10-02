import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { daysFromToday, fakeApi } from '../test/fakeApi';
import { location, renderApp } from '../test/render';

// What the user sees when a write fails: an error toast, and nothing silently changes.
const expectErrorToast = async () => expect(await screen.findByRole('alert')).toHaveTextContent(/server exploded/i);

describe('failed writes', () => {
  it('dashboard: completing a task', async () => {
    const t = fakeApi.addTask({ title: 'Urgent', dueDate: daysFromToday(0) });
    fakeApi.failNext('PATCH', `/tasks/${t._id}`, { status: 500, times: 1 });
    const { user } = renderApp('/');
    await user.click(await screen.findByRole('checkbox', { name: /Mark “Urgent” as complete/ }));
    await expectErrorToast();
    expect(fakeApi.db.tasks[0].completed).toBe(false);
    expect(screen.getByTestId('focus-list')).toHaveTextContent('Urgent');
  });

  it('dashboard: marking an invoice paid', async () => {
    const c = fakeApi.addClient();
    const i = fakeApi.addInvoice({ clientId: c._id, dueDate: daysFromToday(-3) });
    fakeApi.failNext('PATCH', `/invoices/${i._id}`, { status: 500, times: 1 });
    const { user } = renderApp('/');
    await user.click(await screen.findByRole('button', { name: /Mark invoice INV-0001 as paid/ }));
    await expectErrorToast();
    expect(fakeApi.db.invoices[0].status).toBe('unpaid');
  });

  it('client page: ticking a task', async () => {
    const c = fakeApi.addClient();
    const t = fakeApi.addTask({ title: 'Linked', clientId: c._id });
    fakeApi.failNext('PATCH', `/tasks/${t._id}`, { status: 500, times: 1 });
    const { user } = renderApp(`/client/${c._id}`);
    await user.click(await screen.findByRole('checkbox', { name: /Mark “Linked” as complete/ }));
    await expectErrorToast();
  });

  it('client page: a delete failure other than "has invoices" is reported, and the client stays', async () => {
    const c = fakeApi.addClient({ name: 'Keeper' });
    fakeApi.failNext('DELETE', `/clients/${c._id}`, { status: 500, times: 1 });
    const { user } = renderApp(`/client/${c._id}`);
    await user.click(await screen.findByRole('button', { name: 'Delete' }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Delete' }));
    await expectErrorToast();
    expect(fakeApi.db.clients).toHaveLength(1);
    expect(location().path).toBe(`/client/${c._id}`);
  });

  it('client page: a failure during the cascade step is reported too', async () => {
    const c = fakeApi.addClient({ name: 'Keeper' });
    fakeApi.addInvoice({ clientId: c._id });
    const { user } = renderApp(`/client/${c._id}`);
    await user.click(await screen.findByRole('button', { name: 'Delete' }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Delete' }));
    const cascade = await screen.findByRole('dialog', { name: /and 1 invoice\?/ });
    fakeApi.failNext('DELETE', `/clients/${c._id}`, { status: 500, times: 1 });
    await user.click(within(cascade).getByRole('button', { name: 'Delete everything' }));
    await expectErrorToast();
    expect(fakeApi.db.invoices).toHaveLength(1);
  });

  it('task page: toggling and deleting', async () => {
    const t = fakeApi.addTask({ title: 'Stuck' });
    const { user } = renderApp(`/task/${t._id}`);
    await screen.findByRole('heading', { name: 'Stuck' });
    fakeApi.failNext('PATCH', `/tasks/${t._id}`, { status: 500, times: 1 });
    await user.click(screen.getByRole('button', { name: 'Mark complete' }));
    await expectErrorToast();
    expect(fakeApi.db.tasks[0].completed).toBe(false);

    fakeApi.failNext('DELETE', `/tasks/${t._id}`, { status: 500, times: 1 });
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Delete' }));
    expect(await screen.findAllByRole('alert')).not.toHaveLength(0);
    expect(fakeApi.db.tasks).toHaveLength(1);
    expect(location().path).toBe(`/task/${t._id}`);
  });

  it('invoice page: changing status and deleting', async () => {
    const c = fakeApi.addClient();
    const i = fakeApi.addInvoice({ clientId: c._id });
    const { user } = renderApp(`/invoice/${i._id}`);
    await screen.findByRole('heading', { name: 'INV-0001' });
    fakeApi.failNext('PATCH', `/invoices/${i._id}`, { status: 500, times: 1 });
    await user.click(screen.getByRole('button', { name: 'Mark as paid' }));
    await expectErrorToast();
    expect(fakeApi.db.invoices[0].status).toBe('unpaid');

    fakeApi.failNext('DELETE', `/invoices/${i._id}`, { status: 500, times: 1 });
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Delete' }));
    expect((await screen.findAllByRole('alert')).length).toBeGreaterThan(0);
    expect(fakeApi.db.invoices).toHaveLength(1);
  });

  it('invoice list: deleting', async () => {
    const c = fakeApi.addClient();
    const i = fakeApi.addInvoice({ clientId: c._id });
    fakeApi.failNext('DELETE', `/invoices/${i._id}`, { status: 500, times: 1 });
    const { user } = renderApp('/invoices');
    await user.click(await screen.findByRole('button', { name: 'Delete invoice INV-0001' }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Delete' }));
    await expectErrorToast();
    expect(fakeApi.db.invoices).toHaveLength(1);
  });

  it('forms: a network failure shows the “can’t reach the server” message and keeps the input', async () => {
    const { user } = renderApp('/clients');
    await user.click(await screen.findByRole('button', { name: 'New client' }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText('Name'), 'Offline Co');
    await user.type(within(dialog).getByLabelText('Email'), 'o@x.test');
    fakeApi.failNext('POST', '/clients', { network: true, times: 1 });
    await user.click(within(dialog).getByRole('button', { name: 'Add client' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(/can't reach the server/i);
    expect(within(dialog).getByLabelText('Name')).toHaveValue('Offline Co');
  });
});
