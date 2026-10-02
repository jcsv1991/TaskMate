import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Button, ButtonGroup } from 'react-bootstrap';
import { CheckCircle2, Download, Pencil, Plus, ReceiptText, RotateCcw, Search, Trash2 } from 'lucide-react';
import { downloadCsv, invoices as invoicesApi } from '../services/endpoints';
import { useAsync } from '../hooks/useAsync';
import { useDebounced } from '../hooks/useDebounced';
import { useToast } from '../context/ToastContext';
import { getErrorMessage } from '../utils/errors';
import { formatCurrency, formatDate } from '../utils/format';
import PageHeader from '../components/PageHeader';
import Pager from '../components/Pager';
import ConfirmModal from '../components/ConfirmModal';
import InvoiceFormModal from '../components/InvoiceFormModal';
import { useClientOptions } from '../components/useClientOptions';
import { InvoiceStatusBadge } from '../components/Badges';
import { EmptyState, ErrorState, LoadingBlock } from '../components/Feedback';

const PER_PAGE = 20;
const STATUS = [
  { value: '', label: 'All' },
  { value: 'outstanding', label: 'Outstanding' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'paid', label: 'Paid' },
];

export default function Invoices() {
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const { clients } = useClientOptions();

  const status = params.get('status') || '';
  const clientId = params.get('clientId') || '';
  const sort = params.get('sort') || 'createdAt:desc';
  const page = Math.max(1, Number(params.get('page')) || 1);
  const urlSearch = params.get('q') || '';

  const [search, setSearch] = useState(urlSearch);
  const debounced = useDebounced(search, 300);

  const update = (changes) => {
    const next = new URLSearchParams(params);
    Object.entries({ page: '1', ...changes }).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    setParams(next, { replace: true });
  };

  useEffect(() => {
    if (debounced !== urlSearch) update({ q: debounced });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  const query = useMemo(() => {
    const [sortBy, order] = sort.split(':');
    return { status: status || undefined, clientId: clientId || undefined, search: urlSearch || undefined, sortBy, order, page, limit: PER_PAGE };
  }, [status, clientId, urlSearch, sort, page]);

  const { data, loading, error, reload } = useAsync(() => invoicesApi.list(query), [JSON.stringify(query)]);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [exporting, setExporting] = useState(false);

  const setStatus = async (invoice, next) => {
    try {
      await invoicesApi.update(invoice._id, { status: next });
      toast.success(next === 'paid' ? `Invoice ${invoice.number || ''} marked as paid`.replace('  ', ' ') : 'Invoice reopened');
      reload();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const confirmDelete = async () => {
    try {
      await invoicesApi.remove(deleting._id);
      toast.success('Invoice deleted');
      setDeleting(null);
      reload();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const exportCsv = async () => {
    setExporting(true);
    try {
      await downloadCsv('invoices');
      toast.success('Invoices exported');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setExporting(false);
    }
  };

  const filtered = Boolean(urlSearch || status || clientId);
  const items = data ? data.items : [];

  return (
    <>
      <PageHeader
        title="Invoices"
        subtitle="Know what you’ve billed, what’s been paid, and what’s late."
        actions={
          <>
            <Button variant="outline-secondary" onClick={exportCsv} disabled={exporting}>
              <Download size={16} className="me-1" aria-hidden="true" />
              {exporting ? 'Exporting…' : 'Export CSV'}
            </Button>
            <Button onClick={() => setEditing('new')}>
              <Plus size={16} className="me-1" aria-hidden="true" />
              New invoice
            </Button>
          </>
        }
      />

      <div className="tm-card p-3 mb-3">
        <div className="row g-2 align-items-end">
          <div className="col-lg-3">
            <label htmlFor="invoice-search" className="form-label small text-secondary mb-1">
              Search
            </label>
            <div className="input-group">
              <span className="input-group-text" aria-hidden="true">
                <Search size={15} />
              </span>
              <input id="invoice-search" type="search" className="form-control" placeholder="Search invoices" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </div>
          <div className="col-6 col-lg-3">
            <label htmlFor="invoice-client-filter" className="form-label small text-secondary mb-1">
              Client
            </label>
            <select id="invoice-client-filter" className="form-select" value={clientId} onChange={(e) => update({ clientId: e.target.value })}>
              <option value="">All clients</option>
              {clients.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="col-6 col-lg-2">
            <label htmlFor="invoice-sort" className="form-label small text-secondary mb-1">
              Sort by
            </label>
            <select id="invoice-sort" className="form-select" value={sort} onChange={(e) => update({ sort: e.target.value })}>
              <option value="createdAt:desc">Newest first</option>
              <option value="dueDate:asc">Due date (soonest)</option>
              <option value="dueDate:desc">Due date (latest)</option>
              <option value="amount:desc">Amount (high to low)</option>
              <option value="amount:asc">Amount (low to high)</option>
            </select>
          </div>
          <div className="col-lg-4">
            <ButtonGroup className="w-100" aria-label="Invoice status">
              {STATUS.map((s) => (
                <Button key={s.value || 'all'} variant={status === s.value ? 'primary' : 'outline-primary'} size="sm" onClick={() => update({ status: s.value })} aria-pressed={status === s.value}>
                  {s.label}
                </Button>
              ))}
            </ButtonGroup>
          </div>
        </div>
      </div>

      {loading && !data ? (
        <LoadingBlock label="Loading invoices…" />
      ) : error && !data ? (
        <ErrorState error={error} onRetry={reload} />
      ) : items.length === 0 ? (
        <div className="tm-card">
          {filtered ? (
            <EmptyState icon={Search} title="No invoices match these filters" action={<Button variant="outline-primary" onClick={() => { setSearch(''); setParams({}, { replace: true }); }}>Clear filters</Button>}>
              Try a different status or search term.
            </EmptyState>
          ) : (
            <EmptyState icon={ReceiptText} title="No invoices yet" action={<Button onClick={() => setEditing('new')}>Create your first invoice</Button>}>
              Invoices are numbered automatically and flagged as overdue when they pass their due date.
            </EmptyState>
          )}
        </div>
      ) : (
        <div className="tm-card overflow-hidden" aria-busy={loading}>
          <div className="table-responsive">
            <table className="table tm-table tm-table-stack align-middle mb-0" data-testid="invoice-table">
              <thead>
                <tr>
                  <th scope="col">Invoice</th>
                  <th scope="col">Client</th>
                  <th scope="col" className="d-none d-lg-table-cell">
                    Description
                  </th>
                  <th scope="col">Due</th>
                  <th scope="col" className="text-end">
                    Amount
                  </th>
                  <th scope="col">Status</th>
                  <th scope="col" className="text-end">
                    <span className="visually-hidden">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((inv) => (
                  <tr key={inv._id} data-testid="invoice-row">
                    <td className="text-nowrap tm-c-number">
                      <Link to={`/invoice/${inv._id}`} className="fw-medium text-reset">
                        {inv.number || 'Invoice'}
                      </Link>
                    </td>
                    <td className="tm-c-client">{inv.client ? <Link to={`/client/${inv.client._id}`} className="text-reset">{inv.client.name}</Link> : <span className="text-secondary">Unknown client</span>}</td>
                    <td className="d-none d-lg-table-cell text-secondary text-truncate" style={{ maxWidth: 220 }}>
                      {inv.description || '—'}
                    </td>
                    <td className="text-nowrap tm-c-due">
                      <span className="d-md-none text-secondary">Due </span>
                      {formatDate(inv.dueDate)}
                    </td>
                    <td className="text-end text-nowrap fw-medium tm-c-amount">{formatCurrency(inv.amount)}</td>
                    <td className="tm-c-status">
                      <InvoiceStatusBadge status={inv.effectiveStatus} />
                    </td>
                    <td className="text-end text-nowrap tm-c-actions">
                      {inv.status === 'paid' ? (
                        <Button variant="link" className="tm-icon-btn text-secondary" onClick={() => setStatus(inv, 'unpaid')} aria-label={`Mark invoice ${inv.number || ''} as unpaid`} title="Mark as unpaid">
                          <RotateCcw size={16} aria-hidden="true" />
                        </Button>
                      ) : (
                        <Button variant="link" className="tm-icon-btn text-success" onClick={() => setStatus(inv, 'paid')} aria-label={`Mark invoice ${inv.number || ''} as paid`} title="Mark as paid">
                          <CheckCircle2 size={16} aria-hidden="true" />
                        </Button>
                      )}
                      <Button variant="link" className="tm-icon-btn text-secondary" onClick={() => setEditing(inv)} aria-label={`Edit invoice ${inv.number || ''}`}>
                        <Pencil size={16} aria-hidden="true" />
                      </Button>
                      <Button variant="link" className="tm-icon-btn text-danger" onClick={() => setDeleting(inv)} aria-label={`Delete invoice ${inv.number || ''}`}>
                        <Trash2 size={16} aria-hidden="true" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
              {data && data.totalAmount !== undefined && (
                <tfoot>
                  <tr>
                    <th scope="row" colSpan={4} className="text-end text-secondary fw-medium">
                      Total of {data.total} {data.total === 1 ? 'invoice' : 'invoices'}{filtered ? ' matching' : ''}
                    </th>
                    <td className="text-end fw-semibold text-nowrap" data-testid="invoice-total">
                      {formatCurrency(data.totalAmount)}
                    </td>
                    <td colSpan={2} className="tm-c-foot-empty" />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      {data && <Pager page={data.page} totalPages={data.totalPages} total={data.total} perPage={data.perPage} onPage={(p) => update({ page: String(p) })} />}

      <InvoiceFormModal
        show={editing !== null}
        invoice={editing && editing !== 'new' ? editing : undefined}
        defaults={clientId ? { clientId } : undefined}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          reload();
        }}
      />
      <ConfirmModal show={Boolean(deleting)} title="Delete this invoice?" onConfirm={confirmDelete} onClose={() => setDeleting(null)}>
        Invoice {deleting && deleting.number} for {deleting && formatCurrency(deleting.amount)} will be permanently removed.
      </ConfirmModal>
    </>
  );
}
