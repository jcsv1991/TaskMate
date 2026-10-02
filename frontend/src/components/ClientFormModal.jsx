import { useState } from 'react';
import FormModal, { Field } from './FormModal';
import { clients } from '../services/endpoints';
import { useToast } from '../context/ToastContext';
import { getErrorMessage, getFieldErrors } from '../utils/errors';

const blank = { name: '', email: '', phone: '', company: '', notes: '' };
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Create a client, or edit one when `client` is passed. */
export default function ClientFormModal({ show, client, onClose, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState(blank);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  // Reset the form each time the dialog opens (Modal's onShow), not on every parent re-render.
  const reset = () => {
    setError('');
    setFieldErrors({});
    setForm(client ? { name: client.name, email: client.email, phone: client.phone || '', company: client.company || '', notes: client.notes || '' } : blank);
  };

  const set = (name) => (e) => setForm((f) => ({ ...f, [name]: e.target.value }));

  const submit = async () => {
    const problems = {};
    if (!form.name.trim()) problems.name = 'Enter the client’s name';
    if (!EMAIL.test(form.email.trim())) problems.email = 'Enter a valid email address';
    if (Object.keys(problems).length) {
      setFieldErrors(problems);
      return;
    }
    setSaving(true);
    setError('');
    setFieldErrors({});
    try {
      const saved = client ? await clients.update(client._id, form) : await clients.create(form);
      toast.success(client ? 'Client updated' : 'Client added');
      onSaved(saved);
    } catch (err) {
      setFieldErrors(getFieldErrors(err));
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormModal show={show} onShow={reset} title={client ? 'Edit client' : 'New client'} onClose={onClose} onSubmit={submit} saving={saving} error={error} submitLabel={client ? 'Save changes' : 'Add client'}>
      <div className="row g-3">
        <div className="col-sm-6">
          <Field id="client-name" label="Name" error={fieldErrors.name}>
            <input id="client-name" className={`form-control ${fieldErrors.name ? 'is-invalid' : ''}`} value={form.name} onChange={set('name')} maxLength={100} autoFocus required />
          </Field>
        </div>
        <div className="col-sm-6">
          <Field id="client-company" label="Company" error={fieldErrors.company}>
            <input id="client-company" className="form-control" value={form.company} onChange={set('company')} maxLength={100} />
          </Field>
        </div>
        <div className="col-sm-6">
          <Field id="client-email" label="Email" error={fieldErrors.email}>
            <input id="client-email" type="email" className={`form-control ${fieldErrors.email ? 'is-invalid' : ''}`} value={form.email} onChange={set('email')} maxLength={254} required />
          </Field>
        </div>
        <div className="col-sm-6">
          <Field id="client-phone" label="Phone" error={fieldErrors.phone}>
            <input id="client-phone" type="tel" className="form-control" value={form.phone} onChange={set('phone')} maxLength={40} />
          </Field>
        </div>
      </div>
      <Field id="client-notes" label="Notes" error={fieldErrors.notes} hint="Payment terms, preferences, anything worth remembering.">
        <textarea id="client-notes" className="form-control" rows={3} value={form.notes} onChange={set('notes')} maxLength={2000} />
      </Field>
    </FormModal>
  );
}
