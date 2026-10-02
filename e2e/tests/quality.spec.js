const AxeBuilder = require('@axe-core/playwright').default;
const { test, expect } = require('@playwright/test');
const { createUser, signIn, dateIn } = require('../support/api');

const seed = async (request) => {
  const user = await createUser(request, { name: 'Axe Tester' });
  const client = await user.api.client({ name: 'Acme', company: 'Acme Inc', phone: '555-0100' });
  const task = await user.api.task({ title: 'Ship the thing', dueDate: dateIn(-1), priority: 'high', clientId: client._id, description: 'Do it' });
  await user.api.task({ title: 'Done thing', completed: true });
  const overdue = await user.api.invoice({ clientId: client._id, amount: 900, dueDate: dateIn(-6), description: 'Overdue' });
  await user.api.invoice({ clientId: client._id, amount: 450, dueDate: dateIn(9) });
  return { user, client, task, overdue };
};

const scan = async (page) => {
  await page.waitForLoadState('networkidle');
  const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  const summary = violations.map((v) => `${v.id} (${v.impact}): ${v.help}\n   ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join('\n   ')}`);
  expect(violations, `Accessibility violations:\n${summary.join('\n')}`).toEqual([]);
};

for (const theme of ['light', 'dark']) {
  test.describe(`accessibility (${theme})`, () => {
    test.beforeEach(async ({ page }) => {
      // Axe samples colours mid-transition otherwise; the app honours this setting (and that is worth knowing).
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.addInitScript((t) => window.localStorage.setItem('taskmate_theme', t), theme);
    });

    test('sign-in and registration', async ({ page }) => {
      await page.goto('/auth');
      await expect(page.getByTestId('demo-button')).toBeVisible();
      await scan(page);
      await page.getByRole('button', { name: 'Create an account' }).click();
      await page.getByRole('button', { name: 'Create account' }).click(); // with validation errors showing
      await scan(page);
    });

    test('dashboard, lists and detail pages', async ({ page, request }) => {
      const { user, client, task, overdue } = await seed(request);
      await signIn(page, user);
      for (const path of ['/', '/tasks', '/tasks?completed=all', '/clients', '/invoices', `/client/${client._id}`, `/task/${task._id}`, `/invoice/${overdue._id}`]) {
        await page.goto(path);
        await expect(page.getByRole('main')).toBeVisible();
        await scan(page);
      }
    });

    test('dialogs', async ({ page, request }) => {
      const { user } = await seed(request);
      await signIn(page, user);
      await page.goto('/tasks');
      await page.getByRole('button', { name: 'New task' }).click();
      await expect(page.getByRole('dialog', { name: 'New task' })).toBeVisible();
      await page.getByRole('dialog').getByRole('button', { name: 'Add task' }).click(); // shows a field error
      await scan(page);
      await page.keyboard.press('Escape');
      await page.getByRole('button', { name: /Delete “Ship the thing”/ }).click();
      await expect(page.getByRole('dialog', { name: 'Delete this task?' })).toBeVisible();
      await scan(page);
    });
  });
}

test.describe('keyboard use', () => {
  test('a visitor can sign in without touching the mouse', async ({ page, request }) => {
    const user = await createUser(request);
    await page.goto('/auth');
    await page.getByLabel('Email').focus();
    await page.keyboard.type(user.email);
    await page.keyboard.press('Tab');
    await page.keyboard.type(user.password);
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page).toHaveURL(/\/$/);
  });

  test('the skip link jumps to the content and dialogs trap and restore focus', async ({ page, request }) => {
    const { user } = await seed(request);
    await signIn(page, user);
    await page.goto('/tasks');
    await expect(page.getByTestId('task-row').first()).toBeVisible();

    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('#main')).toBeFocused();

    const newTask = page.getByRole('button', { name: 'New task' });
    await newTask.focus();
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog', { name: 'New task' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel('Title')).toBeFocused(); // autofocus on the first field
    for (let i = 0; i < 12; i += 1) await page.keyboard.press('Tab');
    expect(await page.evaluate(() => !!document.activeElement.closest('[role="dialog"]'))).toBe(true); // focus never escapes
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(newTask).toBeFocused(); // and returns to the trigger
  });
});

test.describe('theme', () => {
  test('dark mode applies, persists across reloads and follows the OS the first time', async ({ page, request }) => {
    const user = await createUser(request);
    await signIn(page, user);

    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-bs-theme', 'dark');

    await page.getByRole('button', { name: 'Switch to light theme' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-bs-theme', 'light');
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-bs-theme', 'light'); // the explicit choice beats the OS
    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(bg).not.toBe('rgb(0, 0, 0)');
  });
});
