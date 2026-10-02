import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Button } from 'react-bootstrap';
import { ArrowLeft, Mail, Pencil, Phone, Plus, Trash2 } from 'lucide-react';
import { clients, tasks as tasksApi } from '../services/endpoints';
import { useAsync } from '../hooks/useAsync';
import { useToast } from '../context/ToastContext';
import { getErrorMessage } from '../utils/errors';
import { dueInfo, formatCurrency, formatDate, initials, pluralize } from '../utils/format';
import StatCard from '../components/StatCard';
import ConfirmModal from '../components/ConfirmModal';
import ClientFormModal from '../components/ClientFormModal';
import TaskFormModal from '../components/TaskFormModal';
import InvoiceFormModal from '../components/InvoiceFormModal';
import { DueBadge, InvoiceStatusBadge, PriorityBadge } from '../components/Badges';
import { EmptyState, ErrorState, LoadingBlock } from '../components/Feedback';

export default function ClientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { data, loading, error, reload } = useAsync(() => clients.get(id), [id]);
  const [modal, setModal] = useState(null); // edit | task | invoice | delete | cascade
  const [invoiceCount, setInvoiceCount] = useState(0);
  const defaults = useMemo(() => ({ clientId: id }), [id]);

  if (loading && !data) return <LoadingBlock label="Loading client…" />;
  if (error && !data) {
    const notFound = error.response && (error.response.status === 404 || error.response.status === 400);
    return (
      <div>
        <Link to="/clients" className="d-inline-flex align-items-center gap-1 mb-3">
          <ArrowLeft size={16} aria-hidden="true" /> Clients
        </Link>
        {notFound ? <EmptyState title="Client not found">It may have been deleted.</EmptyState> : <ErrorState error={error} onRetry={reload} />}
      </div>
    );
  }

  const { client, tasks, invoices, stats } = data;

  const toggleTask = async (task) => {
    try {
      await tasksApi.update(task._id, { completed: !task.completed });
      reload();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const remove = async (cascade) => {
    try {
      await clients.remove(id, { cascade });
      toast.success('Client deleted');
      navigate('/clients');
    } catch (err) {
      // The API protects clients that still have invoices; offer the explicit option.
      if (err.response && err.response.status === 409 && !cascade) {
        setInvoiceCount((err.response.data.details && err.response.data.details.invoiceCount) || invoices.length);
        setModal('cascade');
      } else {
        toast.error(getErrorMessage(err));
      }
    }
  };

  return (
    <>
      <Link to="/clients" className="d-inline-flex align-items-center gap-1 mb-3">
        <ArrowLeft size={16} aria-hidden="true" /> Clients
      </Link>

      <div className="d-flex flex-wrap align-items-start justify-content-between gap-3 mb-4">
        <div className="d-flex align-items-center gap-3 min-w-0">
          <span className="tm-avatar tm-avatar-lg" aria-hidden="true">
            {initials(client.name)}
          </span>
          <div className="min-w-0">
            <h1 className="h3 mb-0">{client.name}</h1>
            {client.company && <div className="text-secondary">{client.company}</div>}
            <div className="d-flex flex-wrap gap-3 small mt-1">
              <a href={`mailto:${client.email}`} className="d-inline-flex align-items-center gap-1">
                <Mail size={14} aria-hidden="true" /> {client.email}
              </a>
              {client.phone && (
                <a href={`tel:${client.phone}`} className="d-inline-flex align-items-center gap-1">
                  <Phone size={14} aria-hidden="true" /> {client.phone}
                </a>
              )}
            </div>
          </div>
        </div>
        <div className="d-flex flex-wrap gap-2">
          <Button variant="outline-secondary" onClick={() => setModal('edit')}>
            <Pencil size={15} className="me-1" aria-hidden="true" />
            Edit
          </Button>
          <Button variant="outline-danger" onClick={() => setModal('delete')}>
            <Trash2 size={15} className="me-1" aria-hidden="true" />
            Delete
          </Button>
        </div>
      </div>

      {client.notes && (
        <div className="tm-card p-3 mb-3">
          <div className="small text-secondary fw-medium mb-1">Notes</div>
          <div style={{ whiteSpace: 'pre-wrap' }}>{client.notes}</div>
        </div>
      )}

      <div className="row g-3 mb-4">
        <div className="col-6 col-lg-3">
          <StatCard label="Open tasks" value={stats.openTasks} tone="primary" />
        </div>
        <div className="col-6 col-lg-3">
          <StatCard label="Outstanding" value={formatCurrency(stats.outstandingAmount)} tone="warning" />
        </div>
        <div className="col-6 col-lg-3">
          <StatCard label="Overdue" value={formatCurrency(stats.overdueAmount)} tone="danger" />
        </div>
        <div className="col-6 col-lg-3">
          <StatCard label="Paid to date" value={formatCurrency(stats.paidAmount)} tone="success" />
        </div>
      </div>

      <div className="row g-3">
        <div className="col-lg-6">
          <section className="tm-card h-100" aria-labelledby="client-tasks">
            <div className="d-flex align-items-center justify-content-between px-3 px-md-4 pt-3 pb-2">
              <h2 className="h6 mb-0" id="client-tasks">
                Tasks
              </h2>
              <Button size="sm" variant="outline-primary" onClick={() => setModal('task')}>
                <Plus size={14} className="me-1" aria-hidden="true" />
                Task
              </Button>
            </div>
            <div className="px-3 px-md-4 pb-3">
              {tasks.length === 0 ? (
                <p className="text-secondary mb-0 py-3">No tasks for this client yet.</p>
              ) : (
                <ul className="list-unstyled mb-0 tm-rows" data-testid="client-tasks">
                  {tasks.map((t) => (
                    <li key={t._id} className={`tm-row d-flex align-items-center gap-3 ${t.completed ? 'tm-done' : ''}`}>
                      <input className="form-check-input tm-check" type="checkbox" checked={t.completed} onChange={() => toggleTask(t)} aria-label={t.completed ? `Reopen “${t.title}”` : `Mark “${t.title}” as complete`} />
                      <div className="flex-grow-1 min-w-0">
                        <div className="text-truncate tm-task-title fw-medium">{t.title}</div>
                        <DueBadge info={dueInfo(t.dueDate, { completed: t.completed })} />
                      </div>
                      <PriorityBadge priority={t.priority} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </div>

        <div className="col-lg-6">
          <section className="tm-card h-100" aria-labelledby="client-invoices">
            <div className="d-flex align-items-center justify-content-between px-3 px-md-4 pt-3 pb-2">
              <h2 className="h6 mb-0" id="client-invoices">
                Invoices
              </h2>
              <Button size="sm" variant="outline-primary" onClick={() => setModal('invoice')}>
                <Plus size={14} className="me-1" aria-hidden="true" />
                Invoice
              </Button>
            </div>
            <div className="px-3 px-md-4 pb-3">
              {invoices.length === 0 ? (
                <p className="text-secondary mb-0 py-3">No invoices for this client yet.</p>
              ) : (
                <ul className="list-unstyled mb-0 tm-rows" data-testid="client-invoices">
                  {invoices.map((inv) => (
                    <li key={inv._id} className="tm-row d-flex align-items-center gap-3">
                      <div className="flex-grow-1 min-w-0">
                        <Link to={`/invoice/${inv._id}`} className="fw-medium text-reset">
                          {inv.number || 'Invoice'}
                        </Link>
                        <div className="small text-secondary text-truncate">
                          {inv.description || 'No description'} · due {formatDate(inv.dueDate)}
                        </div>
                      </div>
                      <strong className="text-nowrap">{formatCurrency(inv.amount)}</strong>
                      <InvoiceStatusBadge status={inv.effectiveStatus} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </div>
      </div>

      <ClientFormModal
        show={modal === 'edit'}
        client={client}
        onClose={() => setModal(null)}
        onSaved={() => {
          setModal(null);
          reload();
        }}
      />
      <TaskFormModal
        show={modal === 'task'}
        defaults={defaults}
        onClose={() => setModal(null)}
        onSaved={() => {
          setModal(null);
          reload();
        }}
      />
      <InvoiceFormModal
        show={modal === 'invoice'}
        defaults={defaults}
        onClose={() => setModal(null)}
        onSaved={() => {
          setModal(null);
          reload();
        }}
      />
      <ConfirmModal show={modal === 'delete'} title="Delete this client?" onConfirm={() => remove(false)} onClose={() => setModal(null)}>
        “{client.name}” will be removed. Their tasks stay in your list but are no longer linked to a client.
      </ConfirmModal>
      <ConfirmModal show={modal === 'cascade'} title={`Delete ${client.name} and ${pluralize(invoiceCount, 'invoice')}?`} confirmLabel="Delete everything" onConfirm={() => remove(true)} onClose={() => setModal(null)}>
        This client still has {pluralize(invoiceCount, 'invoice')}. Deleting the client will permanently delete {invoiceCount === 1 ? 'it' : 'them'} too. This cannot be undone.
      </ConfirmModal>
    </>
  );
}
