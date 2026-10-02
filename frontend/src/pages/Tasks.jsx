import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Button, ButtonGroup } from 'react-bootstrap';
import { CheckSquare, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { tasks as tasksApi } from '../services/endpoints';
import { useAsync } from '../hooks/useAsync';
import { useDebounced } from '../hooks/useDebounced';
import { useToast } from '../context/ToastContext';
import { getErrorMessage } from '../utils/errors';
import { dueInfo } from '../utils/format';
import PageHeader from '../components/PageHeader';
import Pager from '../components/Pager';
import ConfirmModal from '../components/ConfirmModal';
import TaskFormModal from '../components/TaskFormModal';
import { useClientOptions } from '../components/useClientOptions';
import { DueBadge, PriorityBadge } from '../components/Badges';
import { EmptyState, ErrorState, LoadingBlock } from '../components/Feedback';

const PER_PAGE = 20;
const STATUS = [
  { value: 'false', label: 'Open' },
  { value: 'true', label: 'Completed' },
  { value: 'all', label: 'All' },
];

export default function Tasks() {
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const { clients } = useClientOptions();

  // Filters live in the URL, so a refresh, a bookmark or a link from the dashboard all land in the same view.
  const status = params.get('completed') ?? 'false';
  const priority = params.get('priority') || '';
  const clientId = params.get('clientId') || '';
  const sortBy = params.get('sortBy') || 'dueDate';
  const order = params.get('order') || 'asc';
  const page = Math.max(1, Number(params.get('page')) || 1);
  const urlSearch = params.get('q') || '';

  const [search, setSearch] = useState(urlSearch);
  const debouncedSearch = useDebounced(search, 300);

  const update = (changes) => {
    const next = new URLSearchParams(params);
    Object.entries({ page: '1', ...changes }).forEach(([key, value]) => {
      if (value === '' || value === undefined || value === null) next.delete(key);
      else next.set(key, value);
    });
    setParams(next, { replace: true });
  };

  // Push the debounced search text into the URL.
  useEffect(() => {
    if (debouncedSearch !== urlSearch) update({ q: debouncedSearch });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  const query = useMemo(
    () => ({
      completed: status === 'all' ? undefined : status,
      priority: priority || undefined,
      clientId: clientId || undefined,
      search: urlSearch || undefined,
      sortBy,
      order,
      page,
      limit: PER_PAGE,
    }),
    [status, priority, clientId, urlSearch, sortBy, order, page]
  );

  const { data, loading, error, reload } = useAsync(() => tasksApi.list(query), [JSON.stringify(query)]);

  const [editing, setEditing] = useState(null); // task | 'new' | null
  const [deleting, setDeleting] = useState(null);

  const toggle = async (task) => {
    try {
      await tasksApi.update(task._id, { completed: !task.completed });
      toast.success(task.completed ? 'Task reopened' : 'Task completed');
      reload();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const confirmDelete = async () => {
    try {
      await tasksApi.remove(deleting._id);
      toast.success('Task deleted');
      setDeleting(null);
      reload();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const filtered = Boolean(urlSearch || priority || clientId || status !== 'false');
  const clearFilters = () => {
    setSearch('');
    setParams({}, { replace: true });
  };

  const items = data ? data.items : [];

  return (
    <>
      <PageHeader
        title="Tasks"
        subtitle="Everything you need to get done, in the order that matters."
        actions={
          <Button onClick={() => setEditing('new')}>
            <Plus size={16} className="me-1" aria-hidden="true" />
            New task
          </Button>
        }
      />

      <div className="tm-card p-3 mb-3">
        <div className="row g-2 align-items-end">
          <div className="col-lg-3">
            <label htmlFor="task-search" className="form-label small text-secondary mb-1">
              Search
            </label>
            <div className="input-group">
              <span className="input-group-text" aria-hidden="true">
                <Search size={15} />
              </span>
              <input id="task-search" type="search" className="form-control" placeholder="Title or description" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </div>
          <div className="col-6 col-lg-2">
            <label htmlFor="task-priority-filter" className="form-label small text-secondary mb-1">
              Priority
            </label>
            <select id="task-priority-filter" className="form-select" value={priority} onChange={(e) => update({ priority: e.target.value })}>
              <option value="">Any</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
          <div className="col-6 col-lg-2">
            <label htmlFor="task-client-filter" className="form-label small text-secondary mb-1">
              Client
            </label>
            <select id="task-client-filter" className="form-select" value={clientId} onChange={(e) => update({ clientId: e.target.value })}>
              <option value="">All clients</option>
              {clients.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="col-6 col-lg-3">
            <label htmlFor="task-sort" className="form-label small text-secondary mb-1">
              Sort by
            </label>
            <select
              id="task-sort"
              className="form-select"
              value={`${sortBy}:${order}`}
              onChange={(e) => {
                const [s, o] = e.target.value.split(':');
                update({ sortBy: s, order: o });
              }}
            >
              <option value="dueDate:asc">Due date (soonest)</option>
              <option value="dueDate:desc">Due date (latest)</option>
              <option value="title:asc">Title (A–Z)</option>
              <option value="title:desc">Title (Z–A)</option>
              <option value="createdAt:desc">Newest first</option>
            </select>
          </div>
          <div className="col-6 col-lg-2">
            <ButtonGroup className="w-100" aria-label="Task status">
              {STATUS.map((s) => (
                <Button key={s.value} variant={status === s.value ? 'primary' : 'outline-primary'} size="sm" onClick={() => update({ completed: s.value })} aria-pressed={status === s.value}>
                  {s.label}
                </Button>
              ))}
            </ButtonGroup>
          </div>
        </div>
      </div>

      {loading && !data ? (
        <LoadingBlock label="Loading tasks…" />
      ) : error && !data ? (
        <ErrorState error={error} onRetry={reload} />
      ) : items.length === 0 ? (
        <div className="tm-card">
          {filtered ? (
            <EmptyState icon={Search} title="No tasks match these filters" action={<Button variant="outline-primary" onClick={clearFilters}>Clear filters</Button>}>
              Try a different search or remove a filter.
            </EmptyState>
          ) : (
            <EmptyState icon={CheckSquare} title="No open tasks" action={<Button onClick={() => setEditing('new')}>Add your first task</Button>}>
              When you add work it will show up here, sorted by due date.
            </EmptyState>
          )}
        </div>
      ) : (
        <div className="tm-card" aria-busy={loading}>
          <ul className="list-unstyled mb-0 tm-rows px-3 px-md-4 py-2" data-testid="task-list">
            {items.map((task) => {
              const info = dueInfo(task.dueDate, { completed: task.completed });
              return (
                <li key={task._id} className={`tm-row d-flex align-items-start gap-3 ${task.completed ? 'tm-done' : ''}`} data-testid="task-row">
                  <input className="form-check-input tm-check mt-1" type="checkbox" checked={task.completed} onChange={() => toggle(task)} aria-label={task.completed ? `Reopen “${task.title}”` : `Mark “${task.title}” as complete`} />
                  <div className="flex-grow-1 min-w-0">
                    <div className="d-flex flex-wrap align-items-center gap-2">
                      <Link to={`/task/${task._id}`} className="fw-medium text-reset tm-task-title">
                        {task.title}
                      </Link>
                      <PriorityBadge priority={task.priority} />
                    </div>
                    {task.description && <div className="text-secondary small text-truncate-2 mt-1">{task.description}</div>}
                    <div className="d-flex flex-wrap align-items-center gap-2 mt-1 small">
                      <DueBadge info={info} />
                      {task.client && (
                        <Link to={`/client/${task.client._id}`} className="text-secondary">
                          {task.client.name}
                        </Link>
                      )}
                    </div>
                  </div>
                  <div className="d-flex gap-1 flex-shrink-0">
                    <Button variant="link" className="tm-icon-btn text-secondary" onClick={() => setEditing(task)} aria-label={`Edit “${task.title}”`}>
                      <Pencil size={16} aria-hidden="true" />
                    </Button>
                    <Button variant="link" className="tm-icon-btn text-danger" onClick={() => setDeleting(task)} aria-label={`Delete “${task.title}”`}>
                      <Trash2 size={16} aria-hidden="true" />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {data && <Pager page={data.page} totalPages={data.totalPages} total={data.total} perPage={data.perPage} onPage={(p) => update({ page: String(p) })} />}

      <TaskFormModal
        show={editing !== null}
        task={editing && editing !== 'new' ? editing : undefined}
        defaults={clientId ? { clientId } : undefined}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          reload();
        }}
      />
      <ConfirmModal show={Boolean(deleting)} title="Delete this task?" onConfirm={confirmDelete} onClose={() => setDeleting(null)}>
        “{deleting && deleting.title}” will be permanently removed.
      </ConfirmModal>
    </>
  );
}
