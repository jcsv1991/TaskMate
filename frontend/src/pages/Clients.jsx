import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Button } from 'react-bootstrap';
import { Building2, Mail, Phone, Plus, Search, Users } from 'lucide-react';
import { clients as clientsApi } from '../services/endpoints';
import { useAsync } from '../hooks/useAsync';
import { useDebounced } from '../hooks/useDebounced';
import { formatCurrency, initials, pluralize } from '../utils/format';
import PageHeader from '../components/PageHeader';
import Pager from '../components/Pager';
import ClientFormModal from '../components/ClientFormModal';
import { EmptyState, ErrorState, LoadingBlock } from '../components/Feedback';

const PER_PAGE = 12;

export default function Clients() {
  const [params, setParams] = useSearchParams();
  const urlSearch = params.get('q') || '';
  const sort = params.get('sort') || 'name:asc';
  const page = Math.max(1, Number(params.get('page')) || 1);

  const [search, setSearch] = useState(urlSearch);
  const debounced = useDebounced(search, 300);
  const [adding, setAdding] = useState(false);

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
    return { search: urlSearch || undefined, sortBy, order, page, limit: PER_PAGE };
  }, [urlSearch, sort, page]);

  const { data, loading, error, reload } = useAsync(() => clientsApi.list(query), [JSON.stringify(query)]);
  const items = data ? data.items : [];

  return (
    <>
      <PageHeader
        title="Clients"
        subtitle="The people and companies you work with."
        actions={
          <Button onClick={() => setAdding(true)}>
            <Plus size={16} className="me-1" aria-hidden="true" />
            New client
          </Button>
        }
      />

      <div className="row g-2 mb-3">
        <div className="col-md-8">
          <label htmlFor="client-search" className="visually-hidden">
            Search clients
          </label>
          <div className="input-group">
            <span className="input-group-text" aria-hidden="true">
              <Search size={15} />
            </span>
            <input id="client-search" type="search" className="form-control" placeholder="Search by name, company or email" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>
        <div className="col-md-4">
          <label htmlFor="client-sort" className="visually-hidden">
            Sort clients
          </label>
          <select id="client-sort" className="form-select" value={sort} onChange={(e) => update({ sort: e.target.value })}>
            <option value="name:asc">Name (A–Z)</option>
            <option value="name:desc">Name (Z–A)</option>
            <option value="createdAt:desc">Newest first</option>
          </select>
        </div>
      </div>

      {loading && !data ? (
        <LoadingBlock label="Loading clients…" />
      ) : error && !data ? (
        <ErrorState error={error} onRetry={reload} />
      ) : items.length === 0 ? (
        <div className="tm-card">
          {urlSearch ? (
            <EmptyState icon={Search} title="No clients match your search">
              Check the spelling or try part of the name.
            </EmptyState>
          ) : (
            <EmptyState icon={Users} title="No clients yet" action={<Button onClick={() => setAdding(true)}>Add your first client</Button>}>
              Clients let you link tasks and invoices to the people they are for.
            </EmptyState>
          )}
        </div>
      ) : (
        <div className="row g-3" data-testid="client-grid" aria-busy={loading}>
          {items.map((c) => (
            <div className="col-md-6 col-xl-4" key={c._id}>
              <article className="tm-card tm-client-card h-100 p-3 p-md-4 position-relative">
                <div className="d-flex align-items-center gap-3 mb-3">
                  <span className="tm-avatar tm-avatar-lg" aria-hidden="true">
                    {initials(c.name)}
                  </span>
                  <div className="min-w-0">
                    <h2 className="h6 mb-0 text-truncate">
                      <Link to={`/client/${c._id}`} className="stretched-link text-reset text-decoration-none">
                        {c.name}
                      </Link>
                    </h2>
                    {c.company && (
                      <div className="small text-secondary text-truncate">
                        <Building2 size={13} className="me-1" aria-hidden="true" />
                        {c.company}
                      </div>
                    )}
                  </div>
                </div>
                <div className="small text-secondary d-grid gap-1 mb-3">
                  <span className="text-truncate">
                    <Mail size={13} className="me-2" aria-hidden="true" />
                    {c.email}
                  </span>
                  {c.phone && (
                    <span>
                      <Phone size={13} className="me-2" aria-hidden="true" />
                      {c.phone}
                    </span>
                  )}
                </div>
                <div className="d-flex flex-wrap gap-2 small">
                  <span className="tm-chip">{pluralize(c.stats.openTasks, 'open task')}</span>
                  {c.stats.overdueAmount > 0 ? (
                    <span className="tm-chip tm-chip-danger">{formatCurrency(c.stats.overdueAmount)} overdue</span>
                  ) : c.stats.outstandingAmount > 0 ? (
                    <span className="tm-chip tm-chip-warn">{formatCurrency(c.stats.outstandingAmount)} owed</span>
                  ) : (
                    <span className="tm-chip">{pluralize(c.stats.invoiceCount, 'invoice')}</span>
                  )}
                </div>
              </article>
            </div>
          ))}
        </div>
      )}

      {data && <Pager page={data.page} totalPages={data.totalPages} total={data.total} perPage={data.perPage} onPage={(p) => update({ page: String(p) })} />}

      <ClientFormModal
        show={adding}
        onClose={() => setAdding(false)}
        onSaved={() => {
          setAdding(false);
          reload();
        }}
      />
    </>
  );
}
