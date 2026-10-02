const fs = require('node:fs');
const { test, expect } = require('@playwright/test');
const { createUser, signIn, dateIn } = require('../support/api');

test.describe('clients', () => {
  test('add, search, edit and open a client', async ({ page, request }) => {
    const user = await createUser(request);
    await user.api.client({ name: 'Zed Corp', email: 'zed@example.com' });
    await signIn(page, user);
    await page.goto('/clients');

    await page.getByRole('button', { name: 'New client' }).click();
    let dialog = page.getByRole('dialog', { name: 'New client' });
    await dialog.getByRole('button', { name: 'Add client' }).click();
    await expect(dialog.getByText('Enter the client’s name')).toBeVisible();
    await expect(dialog.getByText('Enter a valid email address')).toBeVisible();
    await dialog.getByLabel('Name').fill('Amy Ltd');
    await dialog.getByLabel('Email').fill('amy@example.com');
    await dialog.getByLabel('Phone').fill('604-555-0101');
    await dialog.getByRole('button', { name: 'Add client' }).click();
    await expect(page.getByText('Client added')).toBeVisible();

    const names = page.getByTestId('client-grid').getByRole('heading');
    await expect(names).toHaveText(['Amy Ltd', 'Zed Corp']); // A–Z

    await page.getByLabel('Search clients').fill('zed');
    await expect(names).toHaveText(['Zed Corp']);
    await expect(page).toHaveURL(/q=zed/);

    await page.getByRole('link', { name: 'Zed Corp' }).click();
    await page.getByRole('button', { name: 'Edit' }).click();
    dialog = page.getByRole('dialog', { name: 'Edit client' });
    await dialog.getByLabel('Company').fill('Zed Holdings');
    await dialog.getByLabel('Notes').fill('Pays within 14 days');
    await dialog.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByText('Zed Holdings')).toBeVisible();
    await expect(page.getByText('Pays within 14 days')).toBeVisible();
  });

  test('deleting a client keeps their tasks, and protects their invoices until confirmed twice', async ({ page, request }) => {
    const user = await createUser(request);
    const client = await user.api.client({ name: 'Protected Co' });
    await user.api.task({ title: 'Survives the delete', clientId: client._id });
    await user.api.invoice({ clientId: client._id, amount: 700, dueDate: dateIn(5) });
    await user.api.invoice({ clientId: client._id, amount: 300, dueDate: dateIn(9) });
    await signIn(page, user);
    await page.goto(`/client/${client._id}`);

    await page.getByRole('main').getByRole('button', { name: 'Delete' }).click();
    await page.getByRole('dialog', { name: 'Delete this client?' }).getByRole('button', { name: 'Delete' }).click();

    // The API refuses (409) and the UI asks again, spelling out the consequence.
    const cascade = page.getByRole('dialog', { name: 'Delete Protected Co and 2 invoices?' });
    await expect(cascade).toBeVisible();
    expect(await user.api.get('/invoices')).toHaveLength(2); // nothing was deleted yet

    await cascade.getByRole('button', { name: 'Cancel' }).click();
    await expect(page).toHaveURL(new RegExp(`/client/${client._id}$`));

    await page.getByRole('main').getByRole('button', { name: 'Delete' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
    await page.getByRole('dialog', { name: /and 2 invoices/ }).getByRole('button', { name: 'Delete everything' }).click();

    await expect(page).toHaveURL(/\/clients$/);
    await expect(page.getByText('Client deleted')).toBeVisible();
    expect(await user.api.get('/invoices')).toEqual([]);
    const tasks = await user.api.get('/tasks');
    expect(tasks).toHaveLength(1);
    expect(tasks[0]).toMatchObject({ title: 'Survives the delete', clientId: null });
  });

  test('an unknown client id shows a friendly page, not a crash', async ({ page, request }) => {
    const user = await createUser(request);
    await signIn(page, user);
    await page.goto('/client/000000000000000000000000');
    await expect(page.getByText('Client not found')).toBeVisible();
    await page.goto('/client/not-an-id');
    await expect(page.getByText('Client not found')).toBeVisible();
  });
});

test.describe('invoices', () => {
  const seed = async (request) => {
    const user = await createUser(request);
    const acme = await user.api.client({ name: 'Acme' });
    const beta = await user.api.client({ name: 'Beta' });
    await user.api.invoice({ clientId: acme._id, amount: 1000, dueDate: dateIn(-20), description: 'Logo' });
    await user.api.invoice({ clientId: acme._id, amount: 250.5, dueDate: dateIn(-3), description: 'Brand guide' });
    await user.api.invoice({ clientId: beta._id, amount: 400, dueDate: dateIn(10), description: 'Website' });
    const all = await user.api.get('/invoices?sortBy=createdAt&order=asc');
    await fetchPatch(request, user, all[0]._id, { status: 'paid' });
    return user;
  };
  const fetchPatch = async (request, user, id, data) => {
    const r = await request.patch(`http://127.0.0.1:${process.env.E2E_API_PORT || '5055'}/api/invoices/${id}`, { headers: user.headers, data });
    expect(r.ok()).toBeTruthy();
  };
  const numbers = (page) => page.getByTestId('invoice-row').locator('td:first-child a');

  test('status is derived from the due date, and the filters agree with the dashboard', async ({ page, request }) => {
    const user = await seed(request);
    await signIn(page, user);

    await page.goto('/');
    await expect(page.getByTestId('stat-outstanding')).toContainText('$650.50');
    await expect(page.getByTestId('stat-outstanding')).toContainText('$250.50 overdue');

    // Clicking the card lands on the matching list, whose total is the same number.
    await page.getByTestId('stat-outstanding').click();
    await expect(page).toHaveURL(/status=outstanding/);
    await expect(numbers(page)).toHaveCount(2);
    await expect(page.getByTestId('invoice-total')).toHaveText('$650.50');

    await page.getByRole('button', { name: 'Overdue', exact: true }).click();
    await expect(numbers(page)).toHaveText(['INV-0002']);
    await expect(page.getByTestId('invoice-total')).toHaveText('$250.50');
    await page.getByRole('button', { name: 'Paid', exact: true }).click();
    await expect(numbers(page)).toHaveText(['INV-0001']);
    await page.getByRole('button', { name: 'All', exact: true }).click();
    await expect(numbers(page)).toHaveCount(3);
    await expect(page.getByTestId('invoice-total')).toHaveText('$1,650.50');
  });

  test('search, client filter and sorting', async ({ page, request }) => {
    const user = await seed(request);
    await signIn(page, user);
    await page.goto('/invoices');
    await page.getByLabel('Search').fill('brand');
    await expect(numbers(page)).toHaveText(['INV-0002']);
    await page.getByLabel('Search').fill('');
    await page.getByLabel('Client').selectOption({ label: 'Beta' });
    await expect(numbers(page)).toHaveText(['INV-0003']);
    await page.getByLabel('Client').selectOption({ label: 'All clients' });
    await page.getByLabel('Sort by').selectOption('amount:desc');
    await expect(numbers(page)).toHaveText(['INV-0001', 'INV-0003', 'INV-0002']);
  });

  test('mark paid and unpaid, edit, print view and delete from the invoice page', async ({ page, request }) => {
    const user = await seed(request);
    await signIn(page, user);
    await page.goto('/invoices');
    await page.getByRole('link', { name: 'INV-0002' }).click();

    await expect(page.getByRole('heading', { name: 'INV-0002' })).toBeVisible();
    await expect(page.getByText('Overdue', { exact: true })).toBeVisible();
    await expect(page.getByText('Amount due').locator('xpath=following-sibling::div[1]')).toHaveText('$250.50');

    await page.getByRole('button', { name: 'Mark as paid' }).click();
    await expect(page.getByText('Marked as paid')).toBeVisible();
    await expect(page.getByText('Amount due').locator('xpath=following-sibling::div[1]')).toHaveText('$0.00');
    await expect(page.getByText(/^Paid /)).toBeVisible();

    await page.getByRole('button', { name: 'Mark as unpaid' }).click();
    await expect(page.getByText('Invoice reopened')).toBeVisible();
    await expect(page.getByText('Overdue', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Edit' }).click();
    const dialog = page.getByRole('dialog', { name: 'Edit invoice INV-0002' });
    await dialog.getByLabel('Amount').fill('300');
    await dialog.getByLabel('Due date').fill(dateIn(30));
    await dialog.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByText('Invoice updated')).toBeVisible();
    await expect(page.getByText('Unpaid', { exact: true })).toBeVisible(); // a later due date means it is no longer overdue
    await expect(page.getByText('Amount due').locator('xpath=following-sibling::div[1]')).toHaveText('$300.00');

    // Print hides the controls (the .d-print-none toolbar) and keeps the invoice.
    await page.emulateMedia({ media: 'print' });
    await expect(page.getByRole('button', { name: 'Mark as paid' })).toBeHidden();
    await expect(page.getByRole('heading', { name: 'INV-0002' })).toBeVisible();
    await page.emulateMedia({ media: 'screen' });

    await page.getByRole('button', { name: 'Delete' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
    await expect(page).toHaveURL(/\/invoices$/);
    await expect(numbers(page)).toHaveCount(2);
  });

  test('CSV export downloads a correct, spreadsheet-safe file', async ({ page, request }) => {
    const user = await createUser(request);
    const client = await user.api.client({ name: '=HYPERLINK("http://evil.example","click")' });
    await user.api.invoice({ clientId: client._id, amount: 1234.5, dueDate: '2031-03-15', description: 'Line, with "quotes"' });
    await signIn(page, user);
    await page.goto('/invoices');

    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /Export CSV/ }).click()]);
    expect(download.suggestedFilename()).toMatch(/^taskmate-invoices-.*\.csv$/);
    const text = fs.readFileSync(await download.path(), 'utf8');
    expect(text.charCodeAt(0)).toBe(0xfeff); // BOM so Excel reads UTF-8
    expect(text).toContain('INV-0001');
    expect(text).toContain('1234.5');
    expect(text).toContain('2031-03-15'); // the calendar date, not the day before
    expect(text).toContain('"Line, with ""quotes"""'); // quoting
    expect(text).toContain("'=HYPERLINK"); // formula injection is neutralised
    expect(text).not.toMatch(/(^|,)=HYPERLINK/m);
    await expect(page.getByText('Invoices exported')).toBeVisible();
  });
});
