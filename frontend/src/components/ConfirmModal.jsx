import { useId, useState } from 'react';
import { Button, Modal } from 'react-bootstrap';

/**
 * Replaces the original "click Delete and it is gone" behaviour. `onConfirm`
 * may be async; the button shows progress and errors keep the dialog open.
 */
export default function ConfirmModal({ show, title, children, confirmLabel = 'Delete', variant = 'danger', onConfirm, onClose }) {
  const [busy, setBusy] = useState(false);
  const titleId = useId();

  const handleConfirm = async () => {
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal show={show} onHide={busy ? undefined : onClose} centered aria-labelledby={titleId}>
      <Modal.Header closeButton={!busy}>
        <Modal.Title as="h2" className="h5" id={titleId}>
          {title}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>{children}</Modal.Body>
      <Modal.Footer>
        <Button variant="outline-secondary" onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button variant={variant} onClick={handleConfirm} disabled={busy}>
          {busy ? 'Working…' : confirmLabel}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
