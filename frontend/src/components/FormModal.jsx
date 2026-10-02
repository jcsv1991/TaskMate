import { useId } from 'react';
import { Alert, Button, Modal } from 'react-bootstrap';

/** Shared frame for the create/edit dialogs: title, error banner, Cancel/Save. */
export default function FormModal({ show, title, onClose, onSubmit, onShow, saving, error, submitLabel = 'Save', children, size }) {
  const titleId = useId();
  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit();
  };
  return (
    <Modal show={show} onHide={saving ? undefined : onClose} onShow={onShow} centered size={size} backdrop="static" aria-labelledby={titleId}>
      <form onSubmit={handleSubmit} noValidate>
        <Modal.Header closeButton={!saving}>
          <Modal.Title as="h2" className="h5" id={titleId}>
            {title}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {error && (
            <Alert variant="danger" role="alert">
              {error}
            </Alert>
          )}
          {children}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={saving}>
            {saving ? 'Saving…' : submitLabel}
          </Button>
        </Modal.Footer>
      </form>
    </Modal>
  );
}

export function Field({ id, label, error, hint, children }) {
  return (
    <div className="mb-3">
      <label htmlFor={id} className="form-label fw-medium">
        {label}
      </label>
      {children}
      {hint && !error && <div className="form-text">{hint}</div>}
      {error && (
        <div className="invalid-feedback d-block" id={`${id}-error`}>
          {error}
        </div>
      )}
    </div>
  );
}
