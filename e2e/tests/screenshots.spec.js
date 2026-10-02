const path = require('node:path');
const { test, expect } = require('@playwright/test');

// Generates the README images from the real app and the built-in sample data.
//   npm run screenshots        (from the e2e folder)
const OUT = path.join(__dirname, '..', '..', 'docs', 'screenshots');
const shot = (page, name, options = {}) => page.screenshot({ path: path.join(OUT, `${name}.png`), ...options });

const openDemo = async (page, theme = 'light') => {
  await page.addInitScript((t) => window.localStorage.setItem('taskmate_theme', t), theme);
  await page.goto('/auth');
  await page.getByTestId('demo-button').click();
  await expect(page.getByTestId('stat-open-tasks')).toBeVisible();
  await expect(page.getByTestId('focus-list')).toBeVisible();
};

test.describe('@screenshots desktop', () => {
  test.use({ viewport: { width: 1280, height: 860 }, deviceScaleFactor: 1 });

  test('sign-in', async ({ page }) => {
    await page.goto('/auth');
    await expect(page.getByTestId('demo-button')).toBeVisible();
    await shot(page, 'sign-in');
  });

  test('dashboard, tasks, clients, invoices', async ({ page }) => {
    await openDemo(page);
    await page.waitForTimeout(600);
    await shot(page, 'dashboard', { fullPage: true });

    await page.getByRole('link', { name: 'Tasks', exact: true }).first().click();
    await expect(page.getByTestId('task-row').first()).toBeVisible();
    await shot(page, 'tasks', { fullPage: true });

    await page.getByRole('link', { name: 'Clients', exact: true }).first().click();
    await expect(page.getByTestId('client-grid')).toBeVisible();
    await shot(page, 'clients', { fullPage: true });

    await page.getByRole('link', { name: 'Invoices', exact: true }).first().click();
    await expect(page.getByTestId('invoice-row').first()).toBeVisible();
    await shot(page, 'invoices', { fullPage: true });

    await page.getByTestId('invoice-row').filter({ hasText: 'Overdue' }).first().getByRole('link').first().click();
    await expect(page.getByRole('heading', { name: /INV-/ })).toBeVisible();
    await shot(page, 'invoice-detail', { fullPage: true });
  });

  test('a client page and the new-task dialog', async ({ page }) => {
    await openDemo(page);
    await page.getByRole('link', { name: 'Clients', exact: true }).first().click();
    await page.getByRole('link', { name: 'Harbourview Realty' }).click();
    await expect(page.getByTestId('client-invoices')).toBeVisible();
    await shot(page, 'client-detail', { fullPage: true });

    await page.getByRole('button', { name: 'Task', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'New task' });
    await dialog.getByLabel('Title').fill('Send the monthly report');
    await dialog.getByLabel('Priority').selectOption('high');
    await expect(dialog).toBeVisible();
    await page.waitForTimeout(400);
    await shot(page, 'new-task-dialog');
  });

  test('dark theme', async ({ page }) => {
    await openDemo(page, 'dark');
    await page.waitForTimeout(600);
    await shot(page, 'dashboard-dark', { fullPage: true });
  });
});

test.describe('@screenshots mobile', () => {
  test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });

  test('phone views', async ({ page }) => {
    await openDemo(page);
    await page.waitForTimeout(600);
    await shot(page, 'mobile-dashboard', { fullPage: false });
    await page.goto('/invoices');
    await expect(page.getByTestId('invoice-row').first()).toBeVisible();
    await shot(page, 'mobile-invoices', { fullPage: false });
    await page.goto('/tasks');
    await expect(page.getByTestId('task-row').first()).toBeVisible();
    await shot(page, 'mobile-tasks', { fullPage: false });
  });
});
