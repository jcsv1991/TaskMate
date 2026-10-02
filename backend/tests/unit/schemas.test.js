const tasks = require('../../schemas/tasks');
const invoices = require('../../schemas/invoices');
const clients = require('../../schemas/clients');
const auth = require('../../schemas/auth');

const ID = 'a'.repeat(24);
const messages = (result) => result.error.issues.map((i) => i.message);

describe('calendar date handling', () => {
  test('accepts YYYY-MM-DD and ISO strings and normalises to midnight UTC', () => {
    expect(tasks.create.parse({ title: 't', dueDate: '2026-02-28' }).dueDate.toISOString()).toBe('2026-02-28T00:00:00.000Z');
    expect(tasks.create.parse({ title: 't', dueDate: '2026-02-28T17:45:00.000Z' }).dueDate.toISOString()).toBe('2026-02-28T00:00:00.000Z');
  });

  test('rejects impossible and out-of-range dates', () => {
    expect(messages(tasks.create.safeParse({ title: 't', dueDate: '2026-02-30' }))).toContain('Not a real calendar date');
    expect(tasks.create.safeParse({ title: 't', dueDate: '1800-01-01' }).success).toBe(false);
    expect(tasks.create.safeParse({ title: 't', dueDate: '2200-01-01' }).success).toBe(false);
    expect(tasks.create.safeParse({ title: 't', dueDate: 'tomorrow' }).success).toBe(false);
  });

  test('empty string means "no date"', () => {
    expect(tasks.create.parse({ title: 't', dueDate: '' }).dueDate).toBeNull();
    expect(tasks.create.parse({ title: 't', dueDate: null }).dueDate).toBeNull();
    expect(tasks.create.parse({ title: 't' }).dueDate).toBeUndefined();
  });
});

describe('task schema', () => {
  test('trims and requires a title', () => {
    expect(tasks.create.parse({ title: '  Write tests  ' }).title).toBe('Write tests');
    expect(tasks.create.safeParse({ title: '   ' }).success).toBe(false);
    expect(tasks.create.safeParse({}).success).toBe(false);
    expect(tasks.create.safeParse({ title: 'x'.repeat(121) }).success).toBe(false);
  });

  test('priority must be known', () => {
    expect(tasks.create.safeParse({ title: 't', priority: 'urgent' }).success).toBe(false);
    expect(tasks.create.parse({ title: 't', priority: 'high' }).priority).toBe('high');
  });

  test('strips unknown fields (mass-assignment protection)', () => {
    const parsed = tasks.create.parse({ title: 't', userId: ID, completed: true, _id: ID });
    expect(parsed).not.toHaveProperty('userId');
    expect(parsed).not.toHaveProperty('completed');
    expect(parsed).not.toHaveProperty('_id');
  });

  test('update must change something and clientId may be cleared', () => {
    expect(tasks.update.safeParse({}).success).toBe(false);
    expect(tasks.update.parse({ clientId: '' }).clientId).toBeNull();
    expect(tasks.update.parse({ completed: false })).toEqual({ completed: false });
    expect(tasks.update.safeParse({ completed: 'yes' }).success).toBe(false);
  });

  test('list query treats blanks as absent and applies defaults', () => {
    expect(tasks.list.parse({ completed: '', priority: '', sortBy: '', clientName: '' })).toEqual({ order: 'asc', page: 1, limit: 50 });
    expect(tasks.list.parse({ page: '3', limit: '10', completed: 'true' })).toMatchObject({ page: 3, limit: 10, completed: 'true' });
  });

  test('list query rejects operator injection and bad values', () => {
    expect(tasks.list.safeParse({ completed: { $ne: 'x' } }).success).toBe(false);
    expect(tasks.list.safeParse({ clientId: { $gt: '' } }).success).toBe(false);
    expect(tasks.list.safeParse({ limit: '1000' }).success).toBe(false);
    expect(tasks.list.safeParse({ page: '0' }).success).toBe(false);
    expect(tasks.list.safeParse({ sortBy: 'password' }).success).toBe(false);
  });
});

describe('invoice schema', () => {
  const valid = { clientId: ID, amount: 100, dueDate: '2026-10-02' };

  test('rounds amount to cents', () => {
    expect(invoices.create.parse({ ...valid, amount: 19.999 }).amount).toBe(20);
    expect(invoices.create.parse({ ...valid, amount: 10.254 }).amount).toBe(10.25);
  });

  test.each([[0], [-5], ['12'], [null], [2_000_000_000], [NaN]])('rejects amount %p', (amount) => {
    expect(invoices.create.safeParse({ ...valid, amount }).success).toBe(false);
  });

  test('requires a valid client id and due date', () => {
    expect(invoices.create.safeParse({ ...valid, clientId: 'nope' }).success).toBe(false);
    expect(invoices.create.safeParse({ clientId: ID, amount: 1 }).success).toBe(false);
  });

  test('status values', () => {
    expect(invoices.update.parse({ status: 'paid' })).toEqual({ status: 'paid' });
    expect(invoices.update.safeParse({ status: 'archived' }).success).toBe(false);
  });
});

describe('client schema', () => {
  test('requires name and a valid email, lowercases email', () => {
    expect(clients.create.parse({ name: ' Bob ', email: 'BOB@Example.com' })).toMatchObject({ name: 'Bob', email: 'bob@example.com' });
    expect(clients.create.safeParse({ name: 'Bob', email: 'not-an-email' }).success).toBe(false);
    expect(clients.create.safeParse({ email: 'a@b.co' }).success).toBe(false);
  });

  test('phone is optional now', () => {
    expect(clients.create.safeParse({ name: 'Bob', email: 'a@b.co' }).success).toBe(true);
  });

  test('cascade flag only accepts true/false', () => {
    expect(clients.remove.safeParse({ cascade: 'true' }).success).toBe(true);
    expect(clients.remove.safeParse({ cascade: 'maybe' }).success).toBe(false);
  });
});

describe('auth schema', () => {
  test('signup normalises email and enforces password length', () => {
    expect(auth.signup.parse({ email: ' Me@Example.COM ', password: '12345678' }).email).toBe('me@example.com');
    expect(auth.signup.safeParse({ email: 'a@b.co', password: '1234567' }).success).toBe(false);
    expect(auth.signup.safeParse({ email: 'a@b.co', password: 'x'.repeat(73) }).success).toBe(false);
    expect(auth.signup.safeParse({ email: 'nope', password: '12345678' }).success).toBe(false);
  });

  test('login does not enforce the new password minimum (legacy accounts)', () => {
    expect(auth.login.safeParse({ email: 'a@b.co', password: '123456' }).success).toBe(true);
    expect(auth.login.safeParse({ email: 'a@b.co', password: '' }).success).toBe(false);
  });
});
