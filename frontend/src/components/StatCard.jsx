import { Link } from 'react-router-dom';

export default function StatCard({ icon: Icon, label, value, hint, tone = 'primary', to, testId }) {
  const body = (
    <div className="tm-card tm-stat h-100 p-3 p-md-4" data-testid={testId}>
      <div className="d-flex align-items-center justify-content-between mb-2">
        <span className="text-secondary small fw-medium">{label}</span>
        {Icon && (
          <span className={`tm-stat-icon bg-${tone}-subtle text-${tone}-emphasis`} aria-hidden="true">
            <Icon size={18} />
          </span>
        )}
      </div>
      <div className="tm-stat-value">{value}</div>
      {hint && <div className="small mt-1">{hint}</div>}
    </div>
  );
  return to ? (
    <Link className="text-decoration-none text-reset d-block h-100 tm-card-link" to={to}>
      {body}
    </Link>
  ) : (
    body
  );
}
