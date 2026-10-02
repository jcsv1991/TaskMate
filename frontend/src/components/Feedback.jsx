import { Alert, Button, Spinner } from 'react-bootstrap';
import { AlertTriangle } from 'lucide-react';
import { getErrorMessage } from '../utils/errors';

export function LoadingBlock({ label = 'Loading…', className = '' }) {
  return (
    <div className={`d-flex align-items-center justify-content-center gap-2 text-secondary py-5 ${className}`} role="status">
      <Spinner animation="border" size="sm" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

export function ErrorState({ error, onRetry, title = 'We couldn’t load this' }) {
  return (
    <Alert variant="danger" className="d-flex flex-wrap align-items-center gap-3 mb-0" role="alert">
      <AlertTriangle size={20} aria-hidden="true" />
      <div className="flex-grow-1">
        <strong className="d-block">{title}</strong>
        <span>{getErrorMessage(error)}</span>
      </div>
      {onRetry && (
        <Button variant="outline-danger" size="sm" onClick={onRetry}>
          Try again
        </Button>
      )}
    </Alert>
  );
}

export function EmptyState({ icon: Icon, title, children, action }) {
  return (
    <div className="tm-empty text-center py-5 px-3">
      {Icon && (
        <div className="tm-empty-icon mx-auto mb-3" aria-hidden="true">
          <Icon size={26} />
        </div>
      )}
      <h3 className="h5 mb-1">{title}</h3>
      {children && <p className="text-secondary mb-3 mx-auto" style={{ maxWidth: 420 }}>{children}</p>}
      {action}
    </div>
  );
}
