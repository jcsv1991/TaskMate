import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { daysFromToday, fakeApi } from '../test/fakeApi';
import { location, renderApp } from '../test/render';

const cards = () => screen.queryAllByRole('article');
const names = () => cards().map((c) => within(c).getByRole('heading').textContent);

describe('Clients page', () => {
  it('lists clients A–Z with their numbers', async () => {
    const zed = fakeApi.addClient({ name: 'Zed Corp', email: 'z@zed.test', company: 'Zed Holdings', phone: '555-0100' });
    const amy = fakeApi.addClient({ name: 'Amy Ltd', email: 'a@amy.test' });
    fakeApi.addTask({ clientId: zed._id });
    fakeApi.addTask({ clientId: zed._id });
    fakeApi.addTask({ clientId: zed._id, completed: true });
    fakeApi.addInvoice({ clientId: zed._id, amount: 1500, dueDate: daysFromToday(-5) });
    fakeApi.addInvoice({ clientId: amy._id, amount: 400, dueDate: daysFromToday(9) });
    renderApp('/clients');
    await screen.findAllByRole('article');
    expect(names()).toEqual(['Amy Ltd', 'Zed Corp']);

    const [amyCard, zedCard] = cards();
    expect(within(zedCard).getByText('Zed Holdings')).toBeInTheDocument();
    expect(within(zedCard).getByText('555-0100')).toBeInTheDocument();
    expect(within(zedCard).getByText('2 open tasks')).toBeInTheDocument();
    expect(within(zedCard).getByText('$1,500.00 overdue')).toBeInTheDocument(); // overdue wins over "owed"
    expect(within(amyCard).getByText('0 open tasks')).toBeInTheDocument();
    expect(within(amyCard).getByText('$400.00 owed')).toBeInTheDocument();
    expect(screen.getByText('Showing 1–2 of 2')).toBeInTheDocument();
  });

  it('shows the invoice count for a client who owes nothing', async () => {
    const c = fakeApi.addClient({ name: 'Paid Up' });
    fakeApi.addInvoice({ clientId: c._id, status: 'paid' });
    fakeApi.addInvoice({ clientId: c._id, status: 'paid' });
    renderApp('/clients');
    expect(await screen.findByText('2 invoices')).toBeInTheDocument();
  });

  it('links each card to the client page', async () => {
    const c = fakeApi.addClient({ name: 'Linked' });
    renderApp('/clients');
    expect(await screen.findByRole('link', { name: 'Linked' })).toHaveAttribute('href', `/client/${c._id}`);
  });

  it('searches by name, email and company, and keeps the query in the URL', async () => {
    fakeApi.addClient({ name: 'Acme', email: 'x@acme.test', company: 'Rocket Skates' });
    fakeApi.addClient({ name: 'Beta', email: 'rocket@beta.test' });
    fakeApi.addClient({ name: 'Gamma', email: 'g@gamma.test' });
    const { user } = renderApp('/clients');
    await screen.findAllByRole('article');
    await user.type(screen.getByLabelText('Search clients'), 'rocket');
    await waitFor(() => expect(names()).toEqual(['Acme', 'Beta']));
    expect(location().search).toContain('q=rocket');
    expect(screen.getByText('Showing 1–2 of 2')).toBeInTheDocument();
  });

  it('says so when a search finds nobody', async () => {
    fakeApi.addClient({ name: 'Acme' });
    renderApp('/clients?q=nobody');
    expect(await screen.findByText('No clients match your search')).toBeInTheDocument();
  });

  it('sorts', async () => {
    fakeApi.addClient({ name: 'Bravo', createdAt: '2026-01-02T00:00:00.000Z' });
    fakeApi.addClient({ name: 'Alpha', createdAt: '2026-01-01T00:00:00.000Z' });
    fakeApi.addClient({ name: 'Charlie', createdAt: '2026-01-03T00:00:00.000Z' });
    const { user } = renderApp('/clients');
    await screen.findAllByRole('article');
    await user.selectOptions(screen.getByLabelText('Sort clients'), 'name:desc');
    await waitFor(() => expect(names()).toEqual(['Charlie', 'Bravo', 'Alpha']));
    await user.selectOptions(screen.getByLabelText('Sort clients'), 'createdAt:desc');
    await waitFor(() => expect(names()).toEqual(['Charlie', 'Bravo', 'Alpha']));
    expect(location().search).toContain('sort=createdAt%3Adesc');
  });

  it('pages through a long list', async () => {
    for (let i = 1; i <= 14; i += 1) fakeApi.addClient({ name: `Client ${String(i).padStart(2, '0')}`, email: `c${i}@x.test` });
    const { user } = renderApp('/clients');
    await screen.findAllByRole('article');
    expect(cards()).toHaveLength(12);
    await user.click(screen.getByRole('button', { name: 'Next page' }));
    await waitFor(() => expect(names()).toEqual(['Client 13', 'Client 14']));
  });

  it('invites the first client, via the empty state', async () => {
    const { user } = renderApp('/clients');
    await user.click(await screen.findByRole('button', { name: 'Add your first client' }));
    expect(await screen.findByRole('dialog', { name: 'New client' })).toBeInTheDocument();
  });

  it('shows an error state with retry', async () => {
    fakeApi.addClient({ name: 'Recovered' });
    fakeApi.failNext('GET', '/clients', { status: 500, times: 1 });
    const { user } = renderApp('/clients');
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('heading', { name: 'Recovered' })).toBeInTheDocument();
  });

  describe('adding a client', () => {
    it('saves a new client and shows it', async () => {
      const { user } = renderApp('/clients');
      await user.click(await screen.findByRole('button', { name: 'New client' }));
      const dialog = await screen.findByRole('dialog', { name: 'New client' });
      await user.type(within(dialog).getByLabelText('Name'), 'Hooli');
      await user.type(within(dialog).getByLabelText('Company'), 'Hooli Inc');
      await user.type(within(dialog).getByLabelText('Email'), 'gavin@hooli.test');
      await user.type(within(dialog).getByLabelText('Phone'), '555-0199');
      await user.type(within(dialog).getByLabelText('Notes'), 'Net 30');
      await user.click(within(dialog).getByRole('button', { name: 'Add client' }));
      expect(await screen.findByText('Client added')).toBeInTheDocument();
      expect(await screen.findByRole('heading', { name: 'Hooli' })).toBeInTheDocument();
      expect(fakeApi.lastCall('POST', '/clients').body).toEqual({ name: 'Hooli', company: 'Hooli Inc', email: 'gavin@hooli.test', phone: '555-0199', notes: 'Net 30' });
    });

    it('validates name and email before sending anything', async () => {
      const { user } = renderApp('/clients');
      await user.click(await screen.findByRole('button', { name: 'New client' }));
      const dialog = await screen.findByRole('dialog');
      await user.type(within(dialog).getByLabelText('Email'), 'not-an-email');
      await user.click(within(dialog).getByRole('button', { name: 'Add client' }));
      expect(within(dialog).getByText('Enter the client’s name')).toBeInTheDocument();
      expect(within(dialog).getByText('Enter a valid email address')).toBeInTheDocument();
      expect(fakeApi.callsTo('POST', '/clients')).toHaveLength(0);
    });

    it('shows a field error sent by the server beside the field and keeps the dialog open', async () => {
      const { user } = renderApp('/clients');
      await user.click(await screen.findByRole('button', { name: 'New client' }));
      const dialog = await screen.findByRole('dialog');
      await user.type(within(dialog).getByLabelText('Name'), 'Another');
      await user.type(within(dialog).getByLabelText('Email'), 'someone@blocked.test');
      await user.click(within(dialog).getByRole('button', { name: 'Add client' }));
      expect(await within(dialog).findByText('This email domain is not accepted')).toBeInTheDocument();
      expect(within(dialog).getByRole('alert')).toBeInTheDocument();
      expect(screen.getByRole('dialog')).toBeInTheDocument(); // stays open for the fix
    });
  });
});
