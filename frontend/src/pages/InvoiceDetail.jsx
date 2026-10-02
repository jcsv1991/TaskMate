import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Button } from 'react-bootstrap';
import { ArrowLeft, CheckCircle2, Pencil, Printer, RotateCcw, Trash2 } from 'lucide-react';
import { invoices } from '../services/endpoints';
import { useAsync } from '../hooks/useAsync';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { getErrorMessage } from '../utils/errors';
import { formatCurrency, formatDate } from '../utils/format';
import ConfirmModal from '../components/ConfirmModal';
import InvoiceFormModal from '../components/InvoiceFormModal';
import { InvoiceStatusBadge } from '../components/Badges';
import { EmptyState, ErrorState, LoadingBlock } from '../components/Feedback';

export default function InvoiceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  const { data: invoice, loading, error, reload } = useAsync(() => invoices.get(id), [id]);
  const [modal, setModal] = useState(null);

  if (loading && !invoice) return <LoadingBlock label="Loading invoice…" />;
  if (error && !invoice) {
    const missing = error.response && (error.response.status === 404 || error.response.status === 400);
    return (
      <div>
        <Link to="/invoices" className="d-inline-flex align-items-center gap-1 mb-3">
          <ArrowLeft size={16} aria-hidden="true" /> Invoices
        </Link>
        {missing ? <EmptyState title="Invoice not found">It may have been deleted.</EmptyState> : <ErrorState error={error} onRetry={reload} />}
      </div>
    );
  }

  const paid = invoice.status === 'paid';

  const setStatus = async (status) => {
    try {
      await invoices.update(id, { status });
      toast.success(status === 'paid' ? 'Marked as paid' : 'Invoice reopened');
      reload();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const remove = async () => {
    try {
      await invoices.remove(id);
      toast.success('Invoice deleted');
      navigate('/invoices');
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  return (
    <>
      <div className="d-print-none">
        <Link to="/invoices" className="d-inline-flex align-items-center gap-1 mb-3">
          <ArrowLeft size={16} aria-hidden="true" /> Invoices
        </Link>
        <div className="d-flex flex-wrap gap-2 mb-3">
          {paid ? (
            <Button variant="outline-secondary" onClick={() => setStatus('unpaid')}>
              <RotateCcw size={15} className="me-1" aria-hidden="true" />
              Mark as unpaid
            </Button>
          ) : (
            <Button variant="success" onClick={() => setStatus('paid')}>
              <CheckCircle2 size={15} className="me-1" aria-hidden="true" />
              Mark as paid
            </Button>
          )}
          <Button variant="outline-secondary" onClick={() => setModal('edit')}>
            <Pencil size={15} className="me-1" aria-hidden="true" />
            Edit
          </Button>
          <Button variant="outline-secondary" onClick={() => window.print()}>
            <Printer size={15} className="me-1" aria-hidden="true" />
            Print
          </Button>
          <Button variant="outline-danger" onClick={() => setModal('delete')}>
            <Trash2 size={15} className="me-1" aria-hidden="true" />
            Delete
          </Button>
        </div>
      </div>

      <article className="tm-card tm-invoice p-4 p-md-5" aria-labelledby="invoice-title">
        <header className="d-flex flex-wrap justify-content-between gap-3 mb-4">
          <div>
            <p className="tm-eyebrow mb-1">Invoice</p>
            <h1 className="h2 mb-1" id="invoice-title">
              {invoice.number || 'Invoice'}
            </h1>
            <InvoiceStatusBadge status={invoice.effectiveStatus} />
          </div>
          <div className="text-md-end">
            <div className="small text-secondary">Amount due</div>
            <div className="display-6 fw-bold">{paid ? formatCurrency(0) : formatCurrency(invoice.amount)}</div>
            {paid && <div className="small text-success-emphasis">Paid {formatDate(invoice.paidAt)}</div>}
          </div>
        </header>

        <div className="row g-4 mb-4">
          <div className="col-sm-6">
            <div className="small text-secondary fw-medium mb-1">From</div>
            <div>{user && user.name ? user.name : 'You'}</div>
            <div className="text-secondary small">{user && !user.isDemo ? user.email : ''}</div>
          </div>
          <div className="col-sm-6">
            <div className="small text-secondary fw-medium mb-1">Bill to</div>
            {invoice.client ? (
              <>
                <div>
                  <Link to={`/client/${invoice.client._id}`} className="text-reset">
                    {invoice.client.name}
                  </Link>
                </div>
                {invoice.client.company && <div className="text-secondary small">{invoice.client.company}</div>}
                <div className="text-secondary small">{invoice.client.email}</div>
              </>
            ) : (
              <span className="text-secondary">Unknown client</span>
            )}
          </div>
        </div>

        <div className="table-responsive">
          <table className="table tm-table mb-0">
            <thead>
              <tr>
                <th scope="col">Description</th>
                <th scope="col">Due date</th>
                <th scope="col" className="text-end">
                  Amount
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>{invoice.description || 'Services rendered'}</td>
                <td className="text-md-nowrap">{formatDate(invoice.dueDate)}</td>
                <td className="text-end text-nowrap">{formatCurrency(invoice.amount)}</td>
              </tr>
            </tbody>
            <tfoot>
              <tr>
                <th scope="row" colSpan={2} className="text-end">
                  Total
                </th>
                <td className="text-end fw-bold text-nowrap">{formatCurrency(invoice.amount)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </article>

      <InvoiceFormModal
        show={modal === 'edit'}
        invoice={invoice}
        onClose={() => setModal(null)}
        onSaved={() => {
          setModal(null);
          reload();
        }}
      />
      <ConfirmModal show={modal === 'delete'} title="Delete this invoice?" onConfirm={remove} onClose={() => setModal(null)}>
        Invoice {invoice.number} for {formatCurrency(invoice.amount)} will be permanently removed.
      </ConfirmModal>
    </>
  );
}
