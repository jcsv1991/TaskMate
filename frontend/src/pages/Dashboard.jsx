import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from 'react-bootstrap';
import { AlertCircle, CalendarClock, CheckCircle2, CircleDollarSign, ClipboardCheck, Plus, Users, Wallet } from 'lucide-react';
import { dashboard, invoices, tasks } from '../services/endpoints';
import { useAsync } from '../hooks/useAsync';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { getErrorMessage } from '../utils/errors';
import { dueInfo, formatCurrency, formatDate, greeting, pluralize } from '../utils/format';
import PageHeader from '../components/PageHeader';
import StatCard from '../components/StatCard';
import RevenueChart from '../components/RevenueChart';
import { DueBadge, PriorityBadge } from '../components/Badges';
import { EmptyState, ErrorState, LoadingBlock } from '../components/Feedback';
import TaskFormModal from '../components/TaskFormModal';
import InvoiceFormModal from '../components/InvoiceFormModal';
import ClientFormModal from '../components/ClientFormModal';

function Panel({ title, action, children, className = '', id }) {
  return (
    <section className={`tm-card h-100 ${className}`} aria-labelledby={id}>
      <div className="d-flex align-items-center justify-content-between px-3 px-md-4 pt-3 pt-md-4 pb-2">
        <h2 className="h6 mb-0 fw-semibold" id={id}>
          {title}
        </h2>
        {action}
      </div>
      <div className="px-3 px-md-4 pb-3 pb-md-4">{children}</div>
    </section>
  );
}

export default function Dashboard() {
  const { user, isDemo } = useAuth();
  const toast = useToast();
  const { data: summary, loading, error, reload } = useAsync(() => dashboard.summary(), []);
  const [modal, setModal] = useState(null); // 'task' | 'invoice' | 'client'

  const closeAndReload = () => {
    setModal(null);
    reload();
  };

  const completeTask = async (id) => {
    try {
      await tasks.update(id, { completed: true });
      toast.success('Task completed');
      reload();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const markPaid = async (id) => {
    try {
      await invoices.update(id, { status: 'paid' });
      toast.success('Invoice marked as paid');
      reload();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const firstName = (user && user.name ? user.name.split(' ')[0] : '') || '';
  const title = isDemo ? greeting() : `${greeting()}${firstName ? `, ${firstName}` : ''}`;

  const actions = (
    <>
      <Button variant="outline-primary" onClick={() => setModal('client')}>
        <Plus size={16} className="me-1" aria-hidden="true" />
        Client
      </Button>
      <Button variant="outline-primary" onClick={() => setModal('invoice')}>
        <Plus size={16} className="me-1" aria-hidden="true" />
        Invoice
      </Button>
      <Button variant="primary" onClick={() => setModal('task')}>
        <Plus size={16} className="me-1" aria-hidden="true" />
        Task
      </Button>
    </>
  );

  let body;
  if (loading && !summary) body = <LoadingBlock label="Loading your dashboard…" />;
  else if (error && !summary) body = <ErrorState error={error} onRetry={reload} />;
  else if (summary) {
    const { tasks: t, invoices: inv, clients: c } = summary;
    const brandNew = c.total === 0 && t.total === 0 && inv.total === 0;

    body = brandNew ? (
      <div className="tm-card p-4 p-md-5">
        <EmptyState icon={ClipboardCheck} title="Welcome to TaskMate">
          Start with a client, then add the work and the invoices. Your dashboard fills in as you go.
        </EmptyState>
        <div className="d-flex flex-wrap justify-content-center gap-2">
          <Button onClick={() => setModal('client')}>1. Add a client</Button>
          <Button variant="outline-primary" onClick={() => setModal('task')}>
            2. Add a task
          </Button>
          <Button variant="outline-primary" onClick={() => setModal('invoice')}>
            3. Create an invoice
          </Button>
        </div>
      </div>
    ) : (
      <>
        <div className="row g-3 mb-3">
          <div className="col-6 col-lg-3">
            <StatCard
              testId="stat-open-tasks"
              to="/tasks?completed=false"
              icon={ClipboardCheck}
              label="Open tasks"
              value={t.open}
              tone="primary"
              hint={t.overdue ? <span className="text-danger-emphasis fw-medium">{t.overdue} overdue</span> : <span className="text-secondary">All on track</span>}
            />
          </div>
          <div className="col-6 col-lg-3">
            <StatCard testId="stat-due-week" to="/tasks?completed=false&sortBy=dueDate" icon={CalendarClock} label="Due this week" value={t.dueThisWeek} tone="info" hint={<span className="text-secondary">{t.dueToday} due today</span>} />
          </div>
          <div className="col-6 col-lg-3">
            <StatCard
              testId="stat-outstanding"
              to="/invoices?status=outstanding"
              icon={Wallet}
              label="Outstanding"
              value={formatCurrency(inv.outstandingAmount)}
              tone="warning"
              hint={inv.overdueCount ? <span className="text-danger-emphasis fw-medium">{formatCurrency(inv.overdueAmount)} overdue</span> : <span className="text-secondary">Nothing overdue</span>}
            />
          </div>
          <div className="col-6 col-lg-3">
            <StatCard testId="stat-paid-month" to="/invoices?status=paid" icon={CircleDollarSign} label="Paid this month" value={formatCurrency(inv.paidThisMonth)} tone="success" hint={<span className="text-secondary">{formatCurrency(inv.paidAmount)} all time</span>} />
          </div>
        </div>

        <div className="row g-3 mb-3">
          <div className="col-lg-7">
            <Panel
              id="focus-heading"
              title="Focus: due within a week"
              action={
                <Link to="/tasks?completed=false" className="small">
                  All tasks
                </Link>
              }
            >
              {summary.focusTasks.length === 0 ? (
                <EmptyState icon={CheckCircle2} title="You’re clear for the week">
                  Nothing is due in the next 7 days.
                </EmptyState>
              ) : (
                <ul className="list-unstyled mb-0 tm-rows" data-testid="focus-list">
                  {summary.focusTasks.map((task) => {
                    const info = dueInfo(task.dueDate);
                    return (
                      <li key={task._id} className="tm-row d-flex align-items-center gap-3">
                        <input className="form-check-input tm-check" type="checkbox" aria-label={`Mark “${task.title}” as complete`} onChange={() => completeTask(task._id)} />
                        <div className="flex-grow-1 min-w-0">
                          <div className="fw-medium text-break">{task.title}</div>
                          <div className="d-flex flex-wrap gap-2 align-items-center small">
                            <DueBadge info={info} />
                            {task.clientName && <span className="text-secondary">{task.clientName}</span>}
                          </div>
                        </div>
                        <PriorityBadge priority={task.priority} />
                      </li>
                    );
                  })}
                </ul>
              )}
            </Panel>
          </div>
          <div className="col-lg-5">
            <Panel id="revenue-heading" title="Revenue, last 6 months">
              <RevenueChart data={summary.revenueByMonth} />
              <dl className="row g-0 mb-0 mt-3 pt-3 border-top tm-border" data-testid="revenue-totals">
                <div className="col-6">
                  <dt className="small text-secondary fw-normal">Received</dt>
                  <dd className="mb-0 fw-semibold">{formatCurrency(summary.revenueByMonth.reduce((sum, m) => sum + m.paid, 0))}</dd>
                </div>
                <div className="col-6">
                  <dt className="small text-secondary fw-normal">Still to collect</dt>
                  <dd className="mb-0 fw-semibold">{formatCurrency(summary.revenueByMonth.reduce((sum, m) => sum + m.outstanding, 0))}</dd>
                </div>
              </dl>
            </Panel>
          </div>
        </div>

        <div className="row g-3">
          <div className="col-lg-7">
            <Panel
              id="overdue-heading"
              title="Overdue invoices"
              action={
                <Link to="/invoices?status=overdue" className="small">
                  View all
                </Link>
              }
            >
              {summary.overdueInvoices.length === 0 ? (
                <EmptyState icon={CheckCircle2} title="Nothing overdue">
                  Every invoice is paid or not yet due. Nice.
                </EmptyState>
              ) : (
                <ul className="list-unstyled mb-0 tm-rows" data-testid="overdue-list">
                  {summary.overdueInvoices.map((i) => (
                    <li key={i._id} className="tm-row d-flex flex-wrap align-items-center gap-2 gap-sm-3">
                      <span className="tm-stat-icon bg-danger-subtle text-danger-emphasis flex-shrink-0" aria-hidden="true">
                        <AlertCircle size={18} />
                      </span>
                      <div className="flex-grow-1 min-w-0 tm-grow-basis">
                        <Link to={`/invoice/${i._id}`} className="fw-medium text-reset text-break d-block">
                          {i.clientName} <span className="text-secondary fw-normal">{i.number}</span>
                        </Link>
                        <span className="small text-danger-emphasis">
                          {pluralize(i.daysOverdue, 'day')} overdue · was due {formatDate(i.dueDate)}
                        </span>
                      </div>
                      <strong className="text-nowrap ms-auto">{formatCurrency(i.amount)}</strong>
                      <Button size="sm" variant="outline-success" onClick={() => markPaid(i._id)} aria-label={`Mark invoice ${i.number || ''} as paid`}>
                        Mark paid
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>
          <div className="col-lg-5">
            <Panel id="clients-heading" title="Top clients" action={<Link to="/clients" className="small">All clients</Link>}>
              {summary.topClients.length === 0 ? (
                <EmptyState icon={Users} title="No billing yet">
                  Create an invoice to see which clients bring in the most.
                </EmptyState>
              ) : (
                <ul className="list-unstyled mb-0 tm-rows" data-testid="top-clients">
                  {summary.topClients.map((c2) => (
                    <li key={c2.clientId} className="tm-row d-flex align-items-center justify-content-between gap-3">
                      <Link to={`/client/${c2.clientId}`} className="fw-medium text-reset text-truncate">
                        {c2.name}
                      </Link>
                      <span className="text-end text-nowrap">
                        <strong>{formatCurrency(c2.billed)}</strong>
                        {c2.outstanding > 0 && <span className="d-block small text-secondary">{formatCurrency(c2.outstanding)} owed</span>}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader title={title} subtitle={isDemo ? 'You’re exploring a private sample workspace. Change anything you like.' : 'Here’s where things stand today.'} actions={actions} />
      {body}

      <TaskFormModal show={modal === 'task'} onClose={() => setModal(null)} onSaved={closeAndReload} />
      <InvoiceFormModal show={modal === 'invoice'} onClose={() => setModal(null)} onSaved={closeAndReload} />
      <ClientFormModal show={modal === 'client'} onClose={() => setModal(null)} onSaved={closeAndReload} />
    </>
  );
}
