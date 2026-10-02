import { Badge } from 'react-bootstrap';

const INVOICE = {
  paid: { bg: 'success', label: 'Paid' },
  unpaid: { bg: 'primary', label: 'Unpaid' },
  overdue: { bg: 'danger', label: 'Overdue' },
};

const PRIORITY = {
  high: { bg: 'danger', label: 'High' },
  medium: { bg: 'warning', label: 'Medium' },
  low: { bg: 'secondary', label: 'Low' },
};

const subtle = (bg) => `bg-${bg}-subtle text-${bg}-emphasis border border-${bg}-subtle fw-medium`;

export function InvoiceStatusBadge({ status }) {
  const { bg, label } = INVOICE[status] || INVOICE.unpaid;
  return (
    <Badge pill bg="" className={subtle(bg)} data-status={status}>
      {label}
    </Badge>
  );
}

export function PriorityBadge({ priority }) {
  const { bg, label } = PRIORITY[priority] || PRIORITY.medium;
  return (
    <Badge pill bg="" className={subtle(bg)} data-priority={priority}>
      {label}
    </Badge>
  );
}

export function DueBadge({ info }) {
  return (
    <span className={`tm-due text-${info.tone === 'secondary' ? 'secondary' : `${info.tone}-emphasis`} small`} data-tone={info.tone}>
      {info.label}
    </span>
  );
}
