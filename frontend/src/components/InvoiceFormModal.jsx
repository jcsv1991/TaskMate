import { useState } from 'react';
import FormModal, { Field } from './FormModal';
import { invoices } from '../services/endpoints';
import { useClientOptions } from './useClientOptions';
import { useToast } from '../context/ToastContext';
import { getErrorMessage, getFieldErrors } from '../utils/errors';
import { localDateKey, toDateInput } from '../utils/format';

const addDays = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return localDateKey(d);
};

const blank = (defaults = {}) => ({ clientId: '', amount: '', dueDate: addDays(14), description: '', ...defaults });

/** Create an invoice, or edit one when `invoice` is passed. */
export default function InvoiceFormModal({ show, invoice, defaults, onClose, onSaved }) {
  const toast = useToast();
  const { clients, loading: loadingClients } = useClientOptions(show);
  const [form, setForm] = useState(blank());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  // Reset the form each time the dialog opens (Modal's onShow), not on every parent re-render.
  const reset = () => {
    setError('');
    setFieldErrors({});
    setForm(
      invoice
        ? { clientId: invoice.clientId || '', amount: String(invoice.amount), dueDate: toDateInput(invoice.dueDate), description: invoice.description || '' }
        : blank(defaults)
    );
  };

  const set = (name) => (e) => setForm((f) => ({ ...f, [name]: e.target.value }));
  const noClients = !loadingClients && clients.length === 0;

  const submit = async () => {
    const problems = {};
    if (!form.clientId) problems.clientId = 'Choose a client';
    const amount = Number(form.amount);
    if (!form.amount || !(amount > 0)) problems.amount = 'Enter an amount greater than 0';
    if (!form.dueDate) problems.dueDate = 'Choose a due date';
    if (Object.keys(problems).length) {
      setFieldErrors(problems);
      return;
    }
    setSaving(true);
    setError('');
    setFieldErrors({});
    try {
      const body = { clientId: form.clientId, amount, dueDate: form.dueDate, description: form.description };
      const saved = invoice ? await invoices.update(invoice._id, body) : await invoices.create(body);
      toast.success(invoice ? 'Invoice updated' : `Invoice ${saved.number || ''} created`.trim());
      onSaved(saved);
    } catch (err) {
      setFieldErrors(getFieldErrors(err));
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormModal show={show} onShow={reset} title={invoice ? `Edit invoice ${invoice.number || ''}`.trim() : 'New invoice'} onClose={onClose} onSubmit={submit} saving={saving} error={error} submitLabel={invoice ? 'Save changes' : 'Create invoice'}>
      <Field id="invoice-client" label="Client" error={fieldErrors.clientId} hint={noClients ? 'Add a client first, then you can invoice them.' : undefined}>
        <select id="invoice-client" className={`form-select ${fieldErrors.clientId ? 'is-invalid' : ''}`} value={form.clientId} onChange={set('clientId')} disabled={noClients} required>
          <option value="">{loadingClients ? 'Loading clients…' : 'Select a client'}</option>
          {clients.map((c) => (
            <option key={c._id} value={c._id}>
              {c.name}
            </option>
          ))}
        </select>
      </Field>
      <div className="row g-3">
        <div className="col-sm-6">
          <Field id="invoice-amount" label="Amount" error={fieldErrors.amount}>
            <input id="invoice-amount" type="number" inputMode="decimal" min="0.01" step="0.01" className={`form-control ${fieldErrors.amount ? 'is-invalid' : ''}`} value={form.amount} onChange={set('amount')} required />
          </Field>
        </div>
        <div className="col-sm-6">
          <Field id="invoice-due" label="Due date" error={fieldErrors.dueDate}>
            <input id="invoice-due" type="date" className={`form-control ${fieldErrors.dueDate ? 'is-invalid' : ''}`} value={form.dueDate} onChange={set('dueDate')} required />
          </Field>
        </div>
      </div>
      <Field id="invoice-description" label="Description" error={fieldErrors.description} hint="What this invoice is for.">
        <input id="invoice-description" className="form-control" value={form.description} onChange={set('description')} maxLength={500} />
      </Field>
    </FormModal>
  );
}
