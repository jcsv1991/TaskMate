import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { daysFromToday, fakeApi } from '../test/fakeApi';
import { location, renderApp } from '../test/render';

const rows = () => screen.queryAllByTestId('task-row');
const titles = () => rows().map((r) => within(r).getAllByRole('link')[0].textContent);
const lastTasksQuery = () => new URLSearchParams(fakeApi.lastCall('GET', '/tasks').search);

describe('Tasks page', () => {
  describe('listing', () => {
    it('shows open tasks, soonest due first, with undated tasks last', async () => {
      fakeApi.addTask({ title: 'Later', dueDate: daysFromToday(10) });
      fakeApi.addTask({ title: 'No date' });
      fakeApi.addTask({ title: 'Sooner', dueDate: daysFromToday(2) });
      fakeApi.addTask({ title: 'Already done', completed: true, dueDate: daysFromToday(1) });
      renderApp('/tasks');
      await screen.findAllByTestId('task-row');
      expect(titles()).toEqual(['Sooner', 'Later', 'No date']);
      expect(screen.getByText('Showing 1–3 of 3')).toBeInTheDocument();
    });

    it('describes due dates relative to today and flags overdue work', async () => {
      fakeApi.addTask({ title: 'Late', dueDate: daysFromToday(-3) });
      fakeApi.addTask({ title: 'Today', dueDate: daysFromToday(0) });
      fakeApi.addTask({ title: 'Tomorrow', dueDate: daysFromToday(1) });
      fakeApi.addTask({ title: 'Soon', dueDate: daysFromToday(4) });
      renderApp('/tasks');
      await screen.findAllByTestId('task-row');
      const row = (title) => rows().find((r) => within(r).queryByText(title));
      expect(within(row('Late')).getByText('3 days overdue')).toHaveAttribute('data-tone', 'danger');
      expect(within(row('Today')).getByText('Due today')).toBeInTheDocument();
      expect(within(row('Tomorrow')).getByText('Due tomorrow')).toBeInTheDocument();
      expect(within(row('Soon')).getByText('Due in 4 days')).toBeInTheDocument();
    });

    it('shows a far-off due date as the same calendar day in a time zone west of UTC', async () => {
      fakeApi.addTask({ title: 'Fixed date', dueDate: '2031-03-15T00:00:00.000Z' });
      renderApp('/tasks');
      expect(await screen.findByText('Mar 15, 2031')).toBeInTheDocument();
    });

    it('shows priority, description and the client link', async () => {
      const c = fakeApi.addClient({ name: 'Globex' });
      fakeApi.addTask({ title: 'Ship it', priority: 'high', description: 'Before the demo', clientId: c._id });
      renderApp('/tasks');
      const row = (await screen.findAllByTestId('task-row'))[0];
      expect(within(row).getByText('High')).toBeInTheDocument();
      expect(within(row).getByText('Before the demo')).toBeInTheDocument();
      expect(within(row).getByRole('link', { name: 'Globex' })).toHaveAttribute('href', `/client/${c._id}`);
      expect(within(row).getByRole('link', { name: 'Ship it' })).toHaveAttribute('href', expect.stringMatching(/^\/task\//));
    });

    it('has a friendly empty state that opens the create dialog', async () => {
      const { user } = renderApp('/tasks');
      expect(await screen.findByText('No open tasks')).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Add your first task' }));
      expect(await screen.findByRole('dialog', { name: 'New task' })).toBeInTheDocument();
    });

    it('shows an error with a working retry when the API fails', async () => {
      fakeApi.addTask({ title: 'Back online' });
      fakeApi.failNext('GET', '/tasks', { status: 500, times: 1 });
      const { user } = renderApp('/tasks');
      expect(await screen.findByRole('alert')).toHaveTextContent(/server exploded/i);
      await user.click(screen.getByRole('button', { name: 'Try again' }));
      expect(await screen.findByText('Back online')).toBeInTheDocument();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  describe('filters', () => {
    const seed = () => {
      const a = fakeApi.addClient({ name: 'Acme' });
      const b = fakeApi.addClient({ name: 'Beta' });
      fakeApi.addTask({ title: 'Design logo', priority: 'high', clientId: a._id, dueDate: daysFromToday(1) });
      fakeApi.addTask({ title: 'Write copy', priority: 'low', clientId: b._id, dueDate: daysFromToday(2) });
      fakeApi.addTask({ title: 'Plan launch', priority: 'high', clientId: b._id, dueDate: daysFromToday(3), description: 'logo reveal' });
      fakeApi.addTask({ title: 'Old job', priority: 'medium', completed: true });
      return { a, b };
    };

    it('filters by priority and keeps the choice in the URL', async () => {
      seed();
      const { user } = renderApp('/tasks');
      await screen.findAllByTestId('task-row');
      await user.selectOptions(screen.getByLabelText('Priority'), 'high');
      await waitFor(() => expect(titles()).toEqual(['Design logo', 'Plan launch']));
      expect(location().search).toContain('priority=high');
      expect(lastTasksQuery().get('priority')).toBe('high');
    });

    it('filters by client', async () => {
      const { b } = seed();
      const { user } = renderApp('/tasks');
      await screen.findAllByTestId('task-row');
      await user.selectOptions(screen.getByLabelText('Client'), b._id);
      await waitFor(() => expect(titles()).toEqual(['Write copy', 'Plan launch']));
      expect(location().search).toContain(`clientId=${b._id}`);
    });

    it('switches between open, completed and all', async () => {
      seed();
      const { user } = renderApp('/tasks');
      await screen.findAllByTestId('task-row');
      expect(screen.getByRole('button', { name: 'Open' })).toHaveAttribute('aria-pressed', 'true');

      await user.click(screen.getByRole('button', { name: 'Completed' }));
      await waitFor(() => expect(titles()).toEqual(['Old job']));
      expect(screen.getByRole('button', { name: 'Completed' })).toHaveAttribute('aria-pressed', 'true');

      await user.click(screen.getByRole('button', { name: 'All' }));
      await waitFor(() => expect(rows()).toHaveLength(4));
      expect(lastTasksQuery().has('completed')).toBe(false); // "all" sends no completed filter
    });

    it('re-sorts', async () => {
      seed();
      const { user } = renderApp('/tasks');
      await screen.findAllByTestId('task-row');
      await user.selectOptions(screen.getByLabelText('Sort by'), 'title:asc');
      await waitFor(() => expect(titles()).toEqual(['Design logo', 'Plan launch', 'Write copy']));
      await user.selectOptions(screen.getByLabelText('Sort by'), 'dueDate:desc');
      await waitFor(() => expect(titles()).toEqual(['Plan launch', 'Write copy', 'Design logo']));
    });

    it('searches titles and descriptions after the user stops typing', async () => {
      seed();
      const { user } = renderApp('/tasks');
      await screen.findAllByTestId('task-row');
      await user.type(screen.getByLabelText('Search'), 'logo');
      await waitFor(() => expect(titles()).toEqual(['Design logo', 'Plan launch']));
      expect(location().search).toContain('q=logo');
      // One request for the whole word, not one per keystroke.
      const searches = fakeApi.callsTo('GET', '/tasks').filter((c) => c.search.includes('search='));
      expect(searches).toHaveLength(1);
      expect(new URLSearchParams(searches[0].search).get('search')).toBe('logo');
    });

    it('restores every filter from the URL (bookmark, refresh, dashboard link)', async () => {
      const { b } = seed();
      renderApp(`/tasks?priority=high&clientId=${b._id}&completed=false&sortBy=title&order=desc&q=launch`);
      await screen.findAllByTestId('task-row');
      expect(titles()).toEqual(['Plan launch']);
      expect(screen.getByLabelText('Priority')).toHaveValue('high');
      expect(screen.getByLabelText('Client')).toHaveValue(b._id);
      expect(screen.getByLabelText('Sort by')).toHaveValue('title:desc');
      expect(screen.getByLabelText('Search')).toHaveValue('launch');
    });

    it('offers a way out when filters match nothing', async () => {
      seed();
      const { user } = renderApp('/tasks?q=zzz');
      expect(await screen.findByText('No tasks match these filters')).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Clear filters' }));
      await waitFor(() => expect(titles()).toHaveLength(3));
      expect(location().search).toBe('');
      expect(screen.getByLabelText('Search')).toHaveValue('');
    });

    it('treats search text literally (regex characters are not special)', async () => {
      fakeApi.addTask({ title: 'Fix (urgent) bug [prod]' });
      const { user } = renderApp('/tasks');
      await screen.findAllByTestId('task-row');
      await user.type(screen.getByLabelText('Search'), '(urgent)');
      await waitFor(() => expect(titles()).toEqual(['Fix (urgent) bug [prod]']));
    });
  });

  describe('paging', () => {
    it('moves between pages and resets to page 1 when a filter changes', async () => {
      for (let i = 1; i <= 25; i += 1) fakeApi.addTask({ title: `Task ${String(i).padStart(2, '0')}`, dueDate: daysFromToday(i), priority: i % 2 ? 'high' : 'low' });
      const { user } = renderApp('/tasks');
      await screen.findAllByTestId('task-row');
      expect(rows()).toHaveLength(20);
      expect(screen.getByText('Page 1 of 2')).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Next page' }));
      await waitFor(() => expect(rows()).toHaveLength(5));
      expect(screen.getByText('Showing 21–25 of 25')).toBeInTheDocument();
      expect(location().search).toContain('page=2');

      await user.selectOptions(screen.getByLabelText('Priority'), 'low');
      await waitFor(() => expect(rows()).toHaveLength(12));
      expect(location().search).not.toContain('page=2');
      expect(screen.getByText('Showing 1–12 of 12')).toBeInTheDocument();
    });
  });

  describe('completing and reopening', () => {
    it('ticks a task off, removing it from the open list', async () => {
      fakeApi.addTask({ title: 'Do the thing' });
      const { user } = renderApp('/tasks');
      await user.click(await screen.findByRole('checkbox', { name: /Mark “Do the thing” as complete/ }));
      await waitFor(() => expect(rows()).toHaveLength(0));
      expect(await screen.findByRole('status')).toHaveTextContent('Task completed');
      expect(fakeApi.db.tasks[0]).toMatchObject({ completed: true });
      expect(fakeApi.lastCall('PATCH', `/tasks/${fakeApi.db.tasks[0]._id}`).body).toEqual({ completed: true });
    });

    it('reopens a completed task', async () => {
      fakeApi.addTask({ title: 'Done already', completed: true });
      const { user } = renderApp('/tasks?completed=true');
      await user.click(await screen.findByRole('checkbox', { name: /Reopen “Done already”/ }));
      await waitFor(() => expect(fakeApi.db.tasks[0].completed).toBe(false));
      expect(await screen.findByText('Task reopened')).toBeInTheDocument();
    });

    it('shows an error toast and leaves the task alone when the update fails', async () => {
      const t = fakeApi.addTask({ title: 'Stubborn' });
      fakeApi.failNext('PATCH', `/tasks/${t._id}`, { status: 500, times: 1 });
      const { user } = renderApp('/tasks');
      await user.click(await screen.findByRole('checkbox', { name: /Mark “Stubborn” as complete/ }));
      expect(await screen.findByRole('alert')).toHaveTextContent(/server exploded/i);
      expect(rows()).toHaveLength(1);
      expect(fakeApi.db.tasks[0].completed).toBe(false);
    });
  });

  describe('creating', () => {
    it('adds a task with every field and refreshes the list', async () => {
      const c = fakeApi.addClient({ name: 'Initech' });
      const { user } = renderApp('/tasks');
      await user.click(await screen.findByRole('button', { name: 'New task' }));
      const dialog = await screen.findByRole('dialog', { name: 'New task' });
      await user.type(within(dialog).getByLabelText('Title'), '  Draft proposal ');
      await user.type(within(dialog).getByLabelText('Description'), 'Outline + pricing');
      await user.type(within(dialog).getByLabelText('Due date'), '2031-05-20');
      await user.selectOptions(within(dialog).getByLabelText('Priority'), 'high');
      await user.selectOptions(await within(dialog).findByLabelText('Client'), c._id);
      await user.click(within(dialog).getByRole('button', { name: 'Add task' }));

      expect(await screen.findByText('Task added')).toBeInTheDocument();
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect(await screen.findByText('Draft proposal')).toBeInTheDocument();
      expect(screen.getByText('May 20, 2031')).toBeInTheDocument();
      expect(fakeApi.lastCall('POST', '/tasks').body).toEqual({ title: 'Draft proposal', description: 'Outline + pricing', dueDate: '2031-05-20', priority: 'high', clientId: c._id });
    });

    it('requires a title', async () => {
      const { user } = renderApp('/tasks');
      await user.click(await screen.findByRole('button', { name: 'New task' }));
      const dialog = await screen.findByRole('dialog');
      await user.click(within(dialog).getByRole('button', { name: 'Add task' }));
      expect(within(dialog).getByText('Give the task a title')).toBeInTheDocument();
      expect(fakeApi.callsTo('POST', '/tasks')).toHaveLength(0);
    });

    it('keeps the dialog open and the input intact when the server rejects it', async () => {
      const { user } = renderApp('/tasks');
      await user.click(await screen.findByRole('button', { name: 'New task' }));
      const dialog = await screen.findByRole('dialog');
      await user.type(within(dialog).getByLabelText('Title'), 'Will fail');
      fakeApi.failNext('POST', '/tasks', { status: 500, times: 1 });
      await user.click(within(dialog).getByRole('button', { name: 'Add task' }));
      expect(await within(dialog).findByRole('alert')).toHaveTextContent(/server exploded/i);
      expect(within(dialog).getByLabelText('Title')).toHaveValue('Will fail');
      expect(within(dialog).getByRole('button', { name: 'Add task' })).toBeEnabled();
    });

    it('starts blank every time it is opened', async () => {
      const { user } = renderApp('/tasks');
      await user.click(await screen.findByRole('button', { name: 'New task' }));
      let dialog = await screen.findByRole('dialog');
      await user.type(within(dialog).getByLabelText('Title'), 'abandoned draft');
      await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      await user.click(screen.getByRole('button', { name: 'New task' }));
      dialog = await screen.findByRole('dialog');
      expect(within(dialog).getByLabelText('Title')).toHaveValue('');
    });

    it('pre-selects the client when the list is filtered to one', async () => {
      const c = fakeApi.addClient({ name: 'Initech' });
      const { user } = renderApp(`/tasks?clientId=${c._id}`);
      await user.click(await screen.findByRole('button', { name: 'New task' }));
      const dialog = await screen.findByRole('dialog');
      await waitFor(() => expect(within(dialog).getByLabelText('Client')).toHaveValue(c._id));
    });
  });

  describe('editing', () => {
    it('pre-fills the form, saves changes and shows them', async () => {
      const c = fakeApi.addClient({ name: 'Initech' });
      fakeApi.addTask({ title: 'Old title', description: 'old notes', priority: 'low', dueDate: '2031-01-10T00:00:00.000Z', clientId: c._id });
      const { user } = renderApp('/tasks');
      await user.click(await screen.findByRole('button', { name: /Edit “Old title”/ }));
      const dialog = await screen.findByRole('dialog', { name: 'Edit task' });
      expect(within(dialog).getByLabelText('Title')).toHaveValue('Old title');
      expect(within(dialog).getByLabelText('Description')).toHaveValue('old notes');
      expect(within(dialog).getByLabelText('Due date')).toHaveValue('2031-01-10'); // not 01-09, despite the Pacific time zone
      expect(within(dialog).getByLabelText('Priority')).toHaveValue('low');
      await waitFor(() => expect(within(dialog).getByLabelText('Client')).toHaveValue(c._id));

      await user.clear(within(dialog).getByLabelText('Title'));
      await user.type(within(dialog).getByLabelText('Title'), 'New title');
      await user.selectOptions(within(dialog).getByLabelText('Priority'), 'high');
      await user.click(within(dialog).getByRole('button', { name: 'Save changes' }));

      expect(await screen.findByText('Task updated')).toBeInTheDocument();
      expect(await screen.findByText('New title')).toBeInTheDocument();
      expect(fakeApi.db.tasks[0]).toMatchObject({ title: 'New title', priority: 'high', dueDate: '2031-01-10T00:00:00.000Z' });
    });

    it('can clear the due date', async () => {
      fakeApi.addTask({ title: 'Dated', dueDate: '2031-01-10T00:00:00.000Z' });
      const { user } = renderApp('/tasks');
      await user.click(await screen.findByRole('button', { name: /Edit “Dated”/ }));
      const dialog = await screen.findByRole('dialog');
      await user.clear(within(dialog).getByLabelText('Due date'));
      await user.click(within(dialog).getByRole('button', { name: 'Save changes' }));
      expect(await screen.findByText('No due date')).toBeInTheDocument();
      expect(fakeApi.db.tasks[0].dueDate).toBeNull();
    });
  });

  describe('deleting', () => {
    it('asks first, then deletes', async () => {
      fakeApi.addTask({ title: 'Doomed' });
      fakeApi.addTask({ title: 'Survivor' });
      const { user } = renderApp('/tasks');
      await user.click(await screen.findByRole('button', { name: /Delete “Doomed”/ }));
      const dialog = await screen.findByRole('dialog', { name: 'Delete this task?' });
      expect(dialog).toHaveTextContent('“Doomed” will be permanently removed.');
      expect(fakeApi.callsTo('DELETE', `/tasks/${fakeApi.db.tasks[0]._id}`)).toHaveLength(0);
      await user.click(within(dialog).getByRole('button', { name: 'Delete' }));
      expect(await screen.findByText('Task deleted')).toBeInTheDocument();
      await waitFor(() => expect(titles()).toEqual(['Survivor']));
    });

    it('does nothing when cancelled', async () => {
      fakeApi.addTask({ title: 'Keep me' });
      const { user } = renderApp('/tasks');
      await user.click(await screen.findByRole('button', { name: /Delete “Keep me”/ }));
      await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Cancel' }));
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect(fakeApi.db.tasks).toHaveLength(1);
      expect(titles()).toEqual(['Keep me']);
    });

    it('reports a failed delete and keeps the task', async () => {
      const t = fakeApi.addTask({ title: 'Sticky' });
      fakeApi.failNext('DELETE', `/tasks/${t._id}`, { status: 500, times: 1 });
      const { user } = renderApp('/tasks');
      await user.click(await screen.findByRole('button', { name: /Delete “Sticky”/ }));
      await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Delete' }));
      expect(await screen.findByRole('alert')).toHaveTextContent(/server exploded/i);
      expect(fakeApi.db.tasks).toHaveLength(1);
    });
  });
});
