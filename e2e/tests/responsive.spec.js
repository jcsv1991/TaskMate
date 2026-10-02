const { test, expect, devices } = require('@playwright/test');
const { createUser, signIn, dateIn } = require('../support/api');

const phone = { viewport: { width: 375, height: 760 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, userAgent: devices['iPhone 13'].userAgent };

const noHorizontalScroll = async (page) => {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  const culprits = overflow > 0
    ? await page.evaluate(() => [...document.querySelectorAll('body *')].filter((el) => el.getBoundingClientRect().right > window.innerWidth + 1).slice(0, 5).map((el) => `${el.tagName}.${String(el.className).slice(0, 50)}`))
    : [];
  expect(overflow, `${page.url()} is wider than the screen. Widest elements: ${culprits.join(', ')}`).toBeLessThanOrEqual(0);
};

test.describe('on a phone', () => {
  test.use(phone);

  const seed = async (request) => {
    const user = await createUser(request, { name: 'Mobile Tester' });
    const client = await user.api.client({ name: 'A client with a rather long name to test wrapping Ltd', company: 'An equally long company name for good measure' });
    await user.api.task({ title: 'A task title that is long enough that it has to wrap onto several lines on a narrow screen', dueDate: dateIn(2), clientId: client._id, priority: 'high' });
    await user.api.invoice({ clientId: client._id, amount: 12345.67, dueDate: dateIn(-4), description: 'Overdue invoice with a long description that should never push the layout wider' });
    await user.api.invoice({ clientId: client._id, amount: 99, dueDate: dateIn(20) });
    return { user, client };
  };

  test('no page scrolls sideways', async ({ page, request }) => {
    const { user, client } = await seed(request);
    await signIn(page, user);
    const invoices = await user.api.get('/invoices');
    const tasks = await user.api.get('/tasks');
    for (const path of ['/', '/tasks', '/clients', '/invoices', `/client/${client._id}`, `/invoice/${invoices[0]._id}`, `/task/${tasks[0]._id}`, '/nope']) {
      await page.goto(path);
      await expect(page.locator('main')).toBeVisible();
      await page.waitForLoadState('networkidle');
      await noHorizontalScroll(page);
    }
  });

  test('the sign-in page fits too, and the demo button is the first thing to tap', async ({ page }) => {
    await page.goto('/auth');
    await expect(page.getByTestId('demo-button')).toBeVisible();
    await noHorizontalScroll(page);
    const demo = await page.getByTestId('demo-button').boundingBox();
    const heading = await page.getByRole('heading', { level: 1 }).boundingBox();
    expect(demo.y).toBeLessThan(heading.y); // the form card comes before the marketing copy on small screens
    expect(demo.y + demo.height).toBeLessThan(760); // visible without scrolling
  });

  test('the menu collapses into a toggle and navigates', async ({ page, request }) => {
    const { user } = await seed(request);
    await signIn(page, user);
    await page.goto('/');
    const nav = page.getByRole('navigation', { name: 'Main' });
    await expect(nav.getByRole('link', { name: 'Tasks' })).toBeHidden();
    await page.getByRole('button', { name: 'Toggle navigation' }).click();
    await expect(nav.getByRole('link', { name: 'Tasks' })).toBeVisible();
    await nav.getByRole('link', { name: 'Tasks' }).click();
    await expect(page).toHaveURL(/\/tasks$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Tasks' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Clients' })).toBeHidden(); // the menu closed itself after the tap
  });

  test('invoices become stacked cards that keep every action reachable', async ({ page, request }) => {
    const { user } = await seed(request);
    await signIn(page, user);
    await page.goto('/invoices');
    const rows = page.getByTestId('invoice-row');
    await expect(rows).toHaveCount(2);
    await expect(page.locator('thead')).toBeHidden();
    const first = rows.filter({ hasText: 'INV-0001' });
    await expect(first).toContainText('$12,345.67');
    await expect(first.getByText('Overdue', { exact: true })).toBeVisible();
    for (const name of [/Mark invoice INV-0001 as paid/, /Edit invoice INV-0001/, /Delete invoice INV-0001/]) {
      const box = await first.getByRole('button', { name }).boundingBox();
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(375);
      expect(box.height).toBeGreaterThanOrEqual(30); // a finger-sized target
    }
    await first.getByRole('button', { name: /Mark invoice INV-0001 as paid/ }).tap();
    await expect(page.getByText('Invoice INV-0001 marked as paid')).toBeVisible();
  });

  test('dialogs fit the screen and can be completed by touch', async ({ page, request }) => {
    const { user } = await seed(request);
    await signIn(page, user);
    await page.goto('/tasks');
    await page.getByRole('button', { name: 'New task' }).tap();
    const dialog = page.getByRole('dialog', { name: 'New task' });
    await expect(dialog).toBeVisible();
    const box = await dialog.locator('.modal-content').boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(375);
    await dialog.getByLabel('Title').fill('Added on a phone');
    await dialog.getByRole('button', { name: 'Add task' }).tap();
    await expect(page.getByText('Task added')).toBeVisible();
    await expect(page.getByTestId('task-row').filter({ hasText: 'Added on a phone' })).toBeVisible();
  });
});

test.describe('on a tablet', () => {
  test.use({ viewport: { width: 820, height: 1100 } });

  test('layout stays within the screen', async ({ page, request }) => {
    const user = await createUser(request);
    const client = await user.api.client({ name: 'Tablet Co' });
    await user.api.invoice({ clientId: client._id, amount: 500, dueDate: dateIn(3) });
    await signIn(page, user);
    for (const path of ['/', '/tasks', '/clients', '/invoices']) {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      await noHorizontalScroll(page);
    }
  });
});
