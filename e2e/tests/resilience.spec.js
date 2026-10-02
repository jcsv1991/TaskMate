const { test, expect } = require('@playwright/test');
const { createUser, signIn, dateIn } = require('../support/api');

test.describe('a sleeping or failing server', () => {
  test('explains a cold start, keeps trying, and recovers by itself', async ({ page, request }) => {
    const user = await createUser(request);
    await user.api.task({ title: 'Loads after the wake-up' });
    await signIn(page, user);

    // The free hosting tier can take a minute to wake: simulate a server that is down for a while.
    let blocked = true;
    await page.route('**/api/**', (route) => (blocked ? route.abort('connectionrefused') : route.continue()));

    await page.goto('/tasks');
    await expect(page.getByTestId('server-waking')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('server-waking')).toContainText(/waking up the server/i);

    blocked = false;
    await expect(page.getByTestId('server-waking')).toBeHidden({ timeout: 15_000 });
    // The session check failed while the server was down, but the token was kept: retry works.
    const retry = page.getByRole('button', { name: 'Try again' });
    if (await retry.isVisible()) await retry.click();
    await expect(page.getByText('Loads after the wake-up')).toBeVisible();
  });

  test('a failed save shows an error, keeps the form and succeeds on retry', async ({ page, request }) => {
    const user = await createUser(request);
    await signIn(page, user);
    await page.goto('/tasks');
    await expect(page.getByText('No open tasks')).toBeVisible();

    let failures = 1;
    await page.route('**/api/tasks', (route) => {
      if (route.request().method() === 'POST' && failures > 0) {
        failures -= 1;
        return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ msg: 'Server error' }) });
      }
      return route.continue();
    });

    await page.getByRole('button', { name: 'Add your first task' }).click();
    const dialog = page.getByRole('dialog', { name: 'New task' });
    await dialog.getByLabel('Title').fill('Persist me');
    await dialog.getByRole('button', { name: 'Add task' }).click();
    await expect(dialog.getByRole('alert')).toBeVisible();
    await expect(dialog.getByLabel('Title')).toHaveValue('Persist me');

    await dialog.getByRole('button', { name: 'Add task' }).click();
    await expect(page.getByText('Task added')).toBeVisible();
    await expect(page.getByTestId('task-row')).toContainText('Persist me');
  });

  test('a token revoked mid-session sends the user to sign in with an explanation', async ({ page, request }) => {
    const user = await createUser(request);
    await user.api.task({ title: 'Visible while signed in' });
    await signIn(page, user);
    await page.goto('/tasks');
    await expect(page.getByText('Visible while signed in')).toBeVisible();

    await page.route('**/api/tasks**', (route) => route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ msg: 'Token is not valid' }) }));
    await page.getByRole('button', { name: 'Completed' }).click();
    await expect(page.getByRole('form', { name: 'Sign in' })).toBeVisible();
    await expect(page.getByText(/your session expired/i)).toBeVisible();
  });

  test('fast typing in the search box never shows results for an older query', async ({ page, request }) => {
    const user = await createUser(request);
    await user.api.task({ title: 'alpha one' });
    await user.api.task({ title: 'alpha two' });
    await user.api.task({ title: 'beta' });
    await signIn(page, user);

    // Make the broad query slow so its response arrives after the narrow one.
    await page.route('**/api/tasks?**search=alpha**', async (route) => {
      const url = route.request().url();
      if (!/search=alpha(%20| |\+)two/.test(url)) await new Promise((r) => setTimeout(r, 1500));
      await route.continue();
    });
    await page.goto('/tasks');
    await expect(page.getByTestId('task-row')).toHaveCount(3);
    await page.getByLabel('Search').fill('alpha');
    await page.waitForTimeout(450); // let the debounce fire the slow request
    await page.getByLabel('Search').fill('alpha two');
    await expect(page.getByTestId('task-row')).toHaveCount(1);
    await page.waitForTimeout(2000); // the stale response has now arrived
    await expect(page.getByTestId('task-row')).toHaveCount(1);
    await expect(page.getByTestId('task-row')).toContainText('alpha two');
  });
});

test.describe('hostile input', () => {
  test('HTML in user content is shown as text and never executed', async ({ page, request }) => {
    const user = await createUser(request);
    const xss = '<img src=x onerror="window.__pwned=1"><script>window.__pwned=2</script>';
    const client = await user.api.client({ name: xss, company: xss, notes: xss });
    await user.api.task({ title: xss, description: xss, clientId: client._id, dueDate: dateIn(1) });
    await user.api.invoice({ clientId: client._id, amount: 10, dueDate: dateIn(-1), description: xss });
    await signIn(page, user);

    for (const path of ['/', '/tasks', '/clients', '/invoices', `/client/${client._id}`]) {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      expect(await page.evaluate(() => window.__pwned)).toBeUndefined();
    }
    await page.goto('/tasks');
    await expect(page.getByTestId('task-row')).toContainText('<img src=x onerror="window.__pwned=1">');
  });

  test('NoSQL-operator payloads are rejected, not interpreted', async ({ request }) => {
    const res = await request.post(`http://127.0.0.1:${process.env.E2E_API_PORT || '5055'}/api/auth/login`, { data: { email: { $gt: '' }, password: { $gt: '' } } });
    expect(res.status()).toBe(400);
  });
});
