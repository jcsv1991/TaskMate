import { Button } from 'react-bootstrap';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function Pager({ page, totalPages, total, perPage, onPage }) {
  if (!total) return null;
  const from = (page - 1) * perPage + 1;
  const to = Math.min(page * perPage, total);
  return (
    <nav className="d-flex flex-wrap align-items-center justify-content-between gap-2 mt-3" aria-label="Pagination">
      <span className="text-secondary small">
        Showing {from}–{to} of {total}
      </span>
      {totalPages > 1 && (
        <div className="d-flex align-items-center gap-2">
          <Button variant="outline-secondary" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Previous page">
            <ChevronLeft size={16} aria-hidden="true" />
          </Button>
          <span className="small" aria-current="page">
            Page {page} of {totalPages}
          </span>
          <Button variant="outline-secondary" size="sm" disabled={page >= totalPages} onClick={() => onPage(page + 1)} aria-label="Next page">
            <ChevronRight size={16} aria-hidden="true" />
          </Button>
        </div>
      )}
    </nav>
  );
}
