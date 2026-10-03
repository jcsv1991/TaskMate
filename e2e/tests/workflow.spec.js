const { test, expect } = require('@playwright/test');
const { createUser, signIn, dateIn } = require('../support/api');

/**
 * The story a freelancer actually lives: add a client, plan work for them,
 * bill them, get paid, and see all of it on the dashboard.
 */
test('from first client to first payment', async ({ page, request }) => {
  const user = await createUser(request, { name: 'Juan Tester' });
  await signIn(page, user);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Welcome to TaskMate' })).toBeVisible();

  // 1. a client
  await page.getByRole('button', { name: '1. Add a client' }).click();
  let dialog = page.getByRole('dialog', { name: 'New client' });
  await dialog.getByLabel('Name').fill('Northwind Studio');
  await dialog.getByLabel('Company').fill('Northwind Design Co.');
  await dialog.getByLabel('Email').fill('hello@northwind.example');
  await dialog.getByRole('button', { name: 'Add client' }).click();
  await expect(page.getByText('Client added')).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0); // let the closing animation finish before looking at the page behind it

  // 2. work for that client, due in three days
  await page.getByRole('button', { name: 'Task', exact: true }).click();
  dialog = page.getByRole('dialog', { name: 'New task' });
  await dialog.getByLabel('Title').fill('Deliver brand guidelines');
  await dialog.getByLabel('Due date').fill(dateIn(3));
  await dialog.getByLabel('Priority').selectOption('high');
  await dialog.getByLabel('Client').selectOption({ label: 'Northwind Studio' });
  await dialog.getByRole('button', { name: 'Add task' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0); // let the closing animation finish before looking at the page behind it

  const stat = (id) => page.getByTestId(id);
  await expect(stat('stat-open-tasks')).toContainText('1');
  await expect(stat('stat-due-week')).toContainText('1');
  const focus = page.getByTestId('focus-list');
  await expect(focus).toContainText('Deliver brand guidelines');
  await expect(focus).toContainText('Due in 3 days');
  await expect(focus).toContainText('Northwind Studio');

  // 3. an invoice that is already late
  await page.getByRole('button', { name: 'Invoice', exact: true }).click();
  dialog = page.getByRole('dialog', { name: 'New invoice' });
  await dialog.getByLabel('Client').selectOption({ label: 'Northwind Studio' });
  await dialog.getByLabel('Amount').fill('2400.50');
  await dialog.getByLabel('Due date').fill(dateIn(-7));
  await dialog.getByLabel('Description').fill('Brand identity, milestone 1');
  await dialog.getByRole('button', { name: 'Create invoice' }).click();
  await expect(page.getByText('Invoice INV-0001 created')).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0); // let the closing animation finish before looking at the page behind it

  await expect(stat('stat-outstanding')).toContainText('$2,400.50');
  await expect(stat('stat-outstanding')).toContainText('$2,400.50 overdue');
  const overdue = page.getByTestId('overdue-list');
  await expect(overdue).toContainText('Northwind Studio');
  await expect(overdue).toContainText('7 days overdue');

  // 4. get paid
  await overdue.getByRole('button', { name: /Mark invoice INV-0001 as paid/ }).click();
  await expect(page.getByText('Invoice marked as paid')).toBeVisible();
  await expect(stat('stat-outstanding')).toContainText('$0.00');
  await expect(stat('stat-paid-month')).toContainText('$2,400.50');
  await expect(page.getByText('Every invoice is paid or not yet due. Nice.')).toBeVisible();
  await expect(page.getByTestId('revenue-totals')).toContainText('$2,400.50');

  // 5. finish the work
  await focus.getByRole('checkbox', { name: /Mark “Deliver brand guidelines” as complete/ }).check();
  await expect(page.getByText('Task completed')).toBeVisible();
  await expect(stat('stat-open-tasks')).toContainText('0');
  await expect(page.getByText('You’re clear for the week')).toBeVisible();

  // 6. the client page tells the same story
  await page.getByTestId('top-clients').getByRole('link', { name: 'Northwind Studio' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Northwind Studio' })).toBeVisible();
  await expect(page.getByText('Paid to date').locator('xpath=ancestor::div[contains(@class,"tm-card")][1]')).toContainText('$2,400.50');
  await expect(page.getByTestId('client-invoices')).toContainText('INV-0001');
  await expect(page.getByTestId('client-tasks')).toContainText('Deliver brand guidelines');

  // The data really is in the database, not just in the page.
  const invoices = await user.api.get('/invoices');
  expect(invoices).toHaveLength(1);
  expect(invoices[0]).toMatchObject({ number: 'INV-0001', amount: 2400.5, status: 'paid', effectiveStatus: 'paid' });
});

test('invoice numbers are sequential per user and never reused', async ({ page, request }) => {
  const user = await createUser(request);
  const client = await user.api.client({ name: 'Numbering Co' });
  for (let i = 0; i < 3; i += 1) await user.api.invoice({ clientId: client._id, amount: 100 + i, dueDate: dateIn(10) });
  const list = await user.api.get('/invoices?sortBy=createdAt&order=asc');
  expect(list.map((i) => i.number)).toEqual(['INV-0001', 'INV-0002', 'INV-0003']);

  // Deleting the latest invoice does not cause its number to be handed out again.
  await signIn(page, user);
  await page.goto('/invoices');
  await page.getByRole('button', { name: 'Delete invoice INV-0003' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
  await expect(page.getByTestId('invoice-row')).toHaveCount(2);
  await expect(page.getByRole('dialog')).toHaveCount(0); // let the closing animation finish before looking at the page behind it

  await page.getByRole('button', { name: 'New invoice' }).click();
  const dialog = page.getByRole('dialog', { name: 'New invoice' });
  await dialog.getByLabel('Client').selectOption({ label: 'Numbering Co' });
  await dialog.getByLabel('Amount').fill('5');
  await dialog.getByRole('button', { name: 'Create invoice' }).click();
  await expect(page.getByText('Invoice INV-0004 created')).toBeVisible();
});

test('two users never see each other’s data', async ({ page, request }) => {
  const alice = await createUser(request, { name: 'Alice' });
  const bob = await createUser(request, { name: 'Bob' });
  const secretClient = await alice.api.client({ name: 'Alice’s Secret Client' });
  const secretTask = await alice.api.task({ title: 'Alice’s private task' });

  await signIn(page, bob);
  await page.goto('/clients');
  await expect(page.getByRole('heading', { name: 'No clients yet' })).toBeVisible();
  await page.goto('/tasks');
  await expect(page.getByText('Alice’s private task')).toHaveCount(0);

  // Guessing her URLs does not help either.
  await page.goto(`/client/${secretClient._id}`);
  await expect(page.getByText('Client not found')).toBeVisible();
  await page.goto(`/task/${secretTask._id}`);
  await expect(page.getByText('Task not found')).toBeVisible();
});
