const { test, expect } = require('@playwright/test');
const { createUser, unique } = require('../support/api');

const openAccountMenu = (page) => page.getByRole('button', { name: 'Account menu' }).click();

test.describe('authentication', () => {
  test('private pages send visitors to sign in, then back to where they were going', async ({ page, request }) => {
    const user = await createUser(request, { name: 'Grace Hopper' });

    await page.goto('/invoices');
    await expect(page).toHaveURL(/\/auth$/);
    await expect(page.getByRole('form', { name: 'Sign in' })).toBeVisible();

    await page.getByLabel('Email').fill(user.email);
    await page.getByLabel('Password', { exact: true }).fill(user.password);
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page).toHaveURL(/\/invoices$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Invoices' })).toBeVisible();
  });

  test('a new visitor can register, stay signed in across a reload, sign out and sign back in', async ({ page }) => {
    const email = `e2e-${unique()}@example.com`;
    const password = 'a-decent-password-1';

    await page.goto('/auth');
    await page.getByRole('button', { name: 'Create an account' }).click();
    await page.getByLabel('Name').fill('Ada Lovelace');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Create account' }).click();

    await expect(page.getByRole('heading', { name: 'Welcome to TaskMate' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Ada');

    await page.reload();
    await expect(page.getByRole('heading', { name: 'Welcome to TaskMate' })).toBeVisible();

    await openAccountMenu(page);
    await expect(page.getByText(email)).toBeVisible();
    await page.getByRole('button', { name: /Sign out/ }).click();
    await expect(page).toHaveURL(/\/auth$/);

    // Signed out means the private pages are closed again.
    await page.goto('/tasks');
    await expect(page).toHaveURL(/\/auth$/);

    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL(/\/tasks$/);
  });

  test('registration rejects a short password and a duplicate email', async ({ page, request }) => {
    const user = await createUser(request);
    await page.goto('/auth');
    await page.getByRole('button', { name: 'Create an account' }).click();

    await page.getByLabel('Email').fill('someone@example.com');
    await page.getByLabel('Password', { exact: true }).fill('short');
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page.getByText('Use at least 8 characters')).toBeVisible();

    await page.getByLabel('Email').fill(user.email);
    await page.getByLabel('Password', { exact: true }).fill('long-enough-password');
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page.getByRole('alert')).toContainText(/already/i);
    await expect(page).toHaveURL(/\/auth$/);
  });

  test('a wrong password is refused with a clear message', async ({ page, request }) => {
    const user = await createUser(request);
    await page.goto('/auth');
    await page.getByLabel('Email').fill(user.email);
    await page.getByLabel('Password', { exact: true }).fill('definitely-not-it');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByRole('alert')).toContainText(/invalid credentials/i);
    await expect(page).toHaveURL(/\/auth$/);
    expect(await page.evaluate(() => window.localStorage.getItem('taskmate_token'))).toBeNull();
  });

  test('an expired or tampered token is discarded and the user is asked to sign in', async ({ page }) => {
    await page.addInitScript(() => window.localStorage.setItem('taskmate_token', 'not.a.real.token'));
    await page.goto('/tasks');
    await expect(page).toHaveURL(/\/auth$/);
    expect(await page.evaluate(() => window.localStorage.getItem('taskmate_token'))).toBeNull();
  });

  test('"Explore with sample data" opens a populated workspace without signing up', async ({ page }) => {
    await page.goto('/auth');
    await page.getByTestId('demo-button').click();

    await expect(page.getByTestId('stat-open-tasks')).toBeVisible();
    await expect(page.getByText('Demo workspace')).toBeVisible();
    await expect(page.getByTestId('focus-list').getByRole('listitem').first()).toBeVisible();
    await expect(page.getByTestId('top-clients').getByRole('listitem')).not.toHaveCount(0);

    await page.getByRole('link', { name: 'Clients' }).first().click();
    await expect(page.getByTestId('client-grid').getByRole('article')).not.toHaveCount(0);

    // Removing the demo ends the session and wipes the sample data.
    await openAccountMenu(page);
    await page.getByRole('button', { name: /Remove demo data/ }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Remove' }).click();
    await expect(page).toHaveURL(/\/auth$/);
  });

  test('each demo is a separate private workspace', async ({ browser }) => {
    const open = async () => {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      await page.goto('/auth');
      await page.getByTestId('demo-button').click();
      await expect(page.getByTestId('stat-open-tasks')).toBeVisible();
      return { ctx, page };
    };
    const a = await open();
    const b = await open();

    await a.page.getByRole('link', { name: 'Tasks' }).first().click();
    await a.page.getByRole('button', { name: 'New task' }).click();
    await a.page.getByLabel('Title').fill('Only in workspace A');
    await a.page.getByRole('button', { name: 'Add task' }).click();
    await expect(a.page.getByText('Only in workspace A')).toBeVisible();

    await b.page.getByRole('link', { name: 'Tasks' }).first().click();
    await expect(b.page.getByTestId('task-row').first()).toBeVisible();
    await expect(b.page.getByText('Only in workspace A')).toHaveCount(0);
    await a.ctx.close();
    await b.ctx.close();
  });

  test('deleting the account removes it for good', async ({ page, request }) => {
    const user = await createUser(request);
    await page.goto('/auth');
    await page.getByLabel('Email').fill(user.email);
    await page.getByLabel('Password', { exact: true }).fill(user.password);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    await openAccountMenu(page);
    await page.getByRole('button', { name: /Delete account/ }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Delete everything' }).click();
    await expect(page).toHaveURL(/\/auth$/);

    await page.getByLabel('Email').fill(user.email);
    await page.getByLabel('Password', { exact: true }).fill(user.password);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByRole('alert')).toContainText(/invalid credentials/i);
  });
});
