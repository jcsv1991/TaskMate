const { test, expect } = require('@playwright/test');
const { createUser, signIn, dateIn } = require('../support/api');

const titles = (page) => page.getByTestId('task-row').locator('a.tm-task-title');

test.describe('tasks', () => {
  test('filters, search and sorting are kept in the URL and survive a reload', async ({ page, request }) => {
    const user = await createUser(request);
    const acme = await user.api.client({ name: 'Acme' });
    await user.api.task({ title: 'Design logo', priority: 'high', dueDate: dateIn(2), clientId: acme._id });
    await user.api.task({ title: 'Write copy', priority: 'low', dueDate: dateIn(1) });
    await user.api.task({ title: 'Plan launch', priority: 'high', dueDate: dateIn(5), description: 'logo reveal' });
    await user.api.task({ title: 'Old chore', priority: 'low', completed: true });
    await signIn(page, user);

    await page.goto('/tasks');
    await expect(titles(page)).toHaveText(['Write copy', 'Design logo', 'Plan launch']); // open, soonest first

    await page.getByLabel('Priority').selectOption('high');
    await expect(titles(page)).toHaveText(['Design logo', 'Plan launch']);
    await expect(page).toHaveURL(/priority=high/);

    await page.getByLabel('Search').fill('logo');
    await expect(titles(page)).toHaveText(['Design logo', 'Plan launch']); // title OR description
    await expect(page).toHaveURL(/q=logo/);

    await page.getByLabel('Client').selectOption({ label: 'Acme' });
    await expect(titles(page)).toHaveText(['Design logo']);

    // A reload (or a bookmark) lands in exactly the same view.
    await page.reload();
    await expect(titles(page)).toHaveText(['Design logo']);
    await expect(page.getByLabel('Priority')).toHaveValue('high');
    await expect(page.getByLabel('Search')).toHaveValue('logo');

    await page.goto('/tasks?completed=true');
    await expect(titles(page)).toHaveText(['Old chore']);
    await page.goto('/tasks?completed=all&sortBy=title&order=asc');
    await expect(titles(page)).toHaveText(['Design logo', 'Old chore', 'Plan launch', 'Write copy']);
  });

  test('add, edit, complete, reopen and delete a task', async ({ page, request }) => {
    const user = await createUser(request);
    await signIn(page, user);
    await page.goto('/tasks');
    await expect(page.getByText('No open tasks')).toBeVisible();

    await page.getByRole('button', { name: 'Add your first task' }).click();
    let dialog = page.getByRole('dialog', { name: 'New task' });
    await dialog.getByRole('button', { name: 'Add task' }).click();
    await expect(dialog.getByText('Give the task a title')).toBeVisible(); // validation, no request sent
    await dialog.getByLabel('Title').fill('Write the proposal');
    await dialog.getByLabel('Description').fill('Scope, timeline, price');
    await dialog.getByLabel('Due date').fill(dateIn(1));
    await dialog.getByRole('button', { name: 'Add task' }).click();
    await expect(page.getByText('Task added')).toBeVisible();
    const row = page.getByTestId('task-row').filter({ hasText: 'Write the proposal' });
    await expect(row).toContainText('Due tomorrow');
    await expect(row).toContainText('Scope, timeline, price');

    // edit
    await row.getByRole('button', { name: /Edit “Write the proposal”/ }).click();
    dialog = page.getByRole('dialog', { name: 'Edit task' });
    await expect(dialog.getByLabel('Title')).toHaveValue('Write the proposal');
    await dialog.getByLabel('Title').fill('Write and send the proposal');
    await dialog.getByLabel('Priority').selectOption('high');
    await dialog.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByText('Task updated')).toBeVisible();
    await expect(page.getByTestId('task-row')).toContainText('Write and send the proposal');
    await expect(page.getByTestId('task-row')).toContainText('High');

    // complete → leaves the open list, shows under Completed, can be reopened
    await page.getByRole('checkbox', { name: /Mark “Write and send the proposal” as complete/ }).click();
    await expect(page.getByText('Task completed')).toBeVisible();
    await expect(page.getByText('No open tasks')).toBeVisible();
    await page.getByRole('button', { name: 'Completed' }).click();
    await expect(page.getByTestId('task-row')).toContainText('Write and send the proposal');
    await page.getByRole('checkbox', { name: /Reopen “Write and send the proposal”/ }).click();
    await expect(page.getByText('Task reopened')).toBeVisible();
    await page.getByRole('button', { name: 'Open' }).click();
    await expect(page.getByTestId('task-row')).toHaveCount(1);

    // delete asks first
    await page.getByRole('button', { name: /Delete “Write and send the proposal”/ }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByTestId('task-row')).toHaveCount(1);
    await page.getByRole('button', { name: /Delete “Write and send the proposal”/ }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
    await expect(page.getByText('Task deleted')).toBeVisible();
    await expect(page.getByText('No open tasks')).toBeVisible();
    expect(await user.api.get('/tasks')).toEqual([]);
  });

  test('a task page can be opened directly and edited from there', async ({ page, request }) => {
    const user = await createUser(request);
    const client = await user.api.client({ name: 'Globex' });
    const task = await user.api.task({ title: 'Prepare slides', priority: 'medium', clientId: client._id, dueDate: dateIn(0) });
    await signIn(page, user);

    await page.goto(`/task/${task._id}`);
    await expect(page.getByRole('heading', { name: 'Prepare slides' })).toBeVisible();
    await expect(page.getByText('Due today').first()).toBeVisible();
    await page.getByRole('link', { name: 'Globex' }).click();
    await expect(page).toHaveURL(new RegExp(`/client/${client._id}$`));
    await expect(page.getByTestId('client-tasks')).toContainText('Prepare slides');
  });

  test('more than one page of tasks can be paged through', async ({ page, request }) => {
    const user = await createUser(request);
    for (let i = 1; i <= 23; i += 1) await user.api.task({ title: `Task ${String(i).padStart(2, '0')}`, dueDate: dateIn(i) });
    await signIn(page, user);
    await page.goto('/tasks');
    await expect(page.getByTestId('task-row')).toHaveCount(20);
    await expect(page.getByText('Showing 1–20 of 23')).toBeVisible();
    await page.getByRole('button', { name: 'Next page' }).click();
    await expect(page.getByTestId('task-row')).toHaveCount(3);
    await expect(page).toHaveURL(/page=2/);
    await page.reload();
    await expect(page.getByTestId('task-row')).toHaveCount(3);
    await expect(page.getByText('Showing 21–23 of 23')).toBeVisible();
  });

  test('a calendar due date is the same day in the browser (no off-by-one west of UTC)', async ({ page, request }) => {
    const user = await createUser(request);
    const task = await user.api.task({ title: 'Fixed date', dueDate: '2031-03-15' });
    await signIn(page, user);
    await page.goto('/tasks?completed=all');
    await expect(page.getByTestId('task-row').filter({ hasText: 'Fixed date' })).toContainText('Mar 15, 2031');
    await page.getByRole('button', { name: /Edit “Fixed date”/ }).click();
    await expect(page.getByRole('dialog').getByLabel('Due date')).toHaveValue('2031-03-15');
    expect((await user.api.get(`/tasks/${task._id}`)).dueDate).toMatch(/^2031-03-15T00:00:00/);
  });
});
