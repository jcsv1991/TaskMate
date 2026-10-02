import { useState } from 'react';
import FormModal, { Field } from './FormModal';
import { tasks } from '../services/endpoints';
import { useClientOptions } from './useClientOptions';
import { useToast } from '../context/ToastContext';
import { getErrorMessage, getFieldErrors } from '../utils/errors';
import { toDateInput } from '../utils/format';

const blank = (defaults = {}) => ({ title: '', description: '', dueDate: '', priority: 'medium', clientId: '', ...defaults });

/** Create a task, or edit one when `task` is passed. */
export default function TaskFormModal({ show, task, defaults, onClose, onSaved }) {
  const toast = useToast();
  const { clients } = useClientOptions(show);
  const [form, setForm] = useState(blank());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  // Reset the form each time the dialog opens (Modal's onShow), not on every parent re-render.
  const reset = () => {
    setError('');
    setFieldErrors({});
    setForm(
      task
        ? { title: task.title, description: task.description || '', dueDate: toDateInput(task.dueDate), priority: task.priority || 'medium', clientId: task.clientId || '' }
        : blank(defaults)
    );
  };

  const set = (name) => (e) => setForm((f) => ({ ...f, [name]: e.target.value }));

  const submit = async () => {
    if (!form.title.trim()) {
      setFieldErrors({ title: 'Give the task a title' });
      return;
    }
    setSaving(true);
    setError('');
    setFieldErrors({});
    try {
      const body = { ...form, title: form.title.trim() };
      const saved = task ? await tasks.update(task._id, body) : await tasks.create(body);
      toast.success(task ? 'Task updated' : 'Task added');
      onSaved(saved);
    } catch (err) {
      setFieldErrors(getFieldErrors(err));
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormModal show={show} onShow={reset} title={task ? 'Edit task' : 'New task'} onClose={onClose} onSubmit={submit} saving={saving} error={error} submitLabel={task ? 'Save changes' : 'Add task'}>
      <Field id="task-title" label="Title" error={fieldErrors.title}>
        <input id="task-title" className={`form-control ${fieldErrors.title ? 'is-invalid' : ''}`} value={form.title} onChange={set('title')} maxLength={120} autoFocus required />
      </Field>
      <Field id="task-description" label="Description" error={fieldErrors.description} hint="Optional notes, links or next steps.">
        <textarea id="task-description" className="form-control" rows={3} value={form.description} onChange={set('description')} maxLength={2000} />
      </Field>
      <div className="row g-3">
        <div className="col-sm-6">
          <Field id="task-due" label="Due date" error={fieldErrors.dueDate}>
            <input id="task-due" type="date" className="form-control" value={form.dueDate} onChange={set('dueDate')} />
          </Field>
        </div>
        <div className="col-sm-6">
          <Field id="task-priority" label="Priority">
            <select id="task-priority" className="form-select" value={form.priority} onChange={set('priority')}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </Field>
        </div>
      </div>
      <Field id="task-client" label="Client" error={fieldErrors.clientId}>
        <select id="task-client" className="form-select" value={form.clientId} onChange={set('clientId')}>
          <option value="">No client</option>
          {clients.map((c) => (
            <option key={c._id} value={c._id}>
              {c.name}
            </option>
          ))}
        </select>
      </Field>
    </FormModal>
  );
}
