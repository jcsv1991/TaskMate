export default function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="d-flex flex-wrap align-items-start justify-content-between gap-3 mb-4">
      <div>
        <h1 className="h3 mb-1">{title}</h1>
        {subtitle && <p className="text-secondary mb-0">{subtitle}</p>}
      </div>
      {actions && <div className="d-flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
