import { formatCurrency, formatCurrencyCompact, formatMonth } from '../utils/format';

const W = 520;
const H = 240;
const PAD = { top: 16, right: 12, bottom: 30, left: 52 };

/** "Nice" axis maximum so the gridlines land on round numbers. */
function niceMax(value) {
  if (value <= 0) return 100;
  const pow = 10 ** Math.floor(Math.log10(value));
  const n = value / pow;
  const nice = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return nice * pow;
}

/**
 * A small dependency-free stacked bar chart: money received per month (solid)
 * plus money still owed that falls due that month (striped).
 */
export default function RevenueChart({ data }) {
  const max = niceMax(Math.max(0, ...data.map((d) => d.paid + d.outstanding)));
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const band = innerW / Math.max(1, data.length);
  const barW = Math.min(44, band * 0.58);
  const y = (v) => PAD.top + innerH - (v / max) * innerH;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * max);

  const summary = data.map((d) => `${formatMonth(d.month)}: ${formatCurrency(d.paid)} received, ${formatCurrency(d.outstanding)} outstanding`).join('. ');

  return (
    <figure className="m-0">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Revenue by month. ${summary}`} className="tm-chart w-100">
        <defs>
          <pattern id="tm-stripes" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="6" height="6" fill="var(--tm-warn-soft)" />
            <rect width="3" height="6" fill="var(--tm-warn)" opacity="0.55" />
          </pattern>
        </defs>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} className="tm-grid" />
            <text x={PAD.left - 8} y={y(t) + 4} textAnchor="end" className="tm-axis">
              {formatCurrencyCompact(t)}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const x = PAD.left + band * i + (band - barW) / 2;
          const paidH = (d.paid / max) * innerH;
          const owedH = (d.outstanding / max) * innerH;
          return (
            <g key={d.month} data-month={d.month}>
              <title>{`${formatMonth(d.month)}: ${formatCurrency(d.paid)} received, ${formatCurrency(d.outstanding)} outstanding`}</title>
              {d.paid > 0 && <rect x={x} y={y(d.paid)} width={barW} height={paidH} rx="4" className="tm-bar-paid" />}
              {d.outstanding > 0 && <rect x={x} y={y(d.paid + d.outstanding)} width={barW} height={owedH} rx="4" fill="url(#tm-stripes)" className="tm-bar-owed" />}
              <text x={x + barW / 2} y={H - 10} textAnchor="middle" className="tm-axis">
                {formatMonth(d.month)}
              </text>
            </g>
          );
        })}
      </svg>
      <figcaption className="d-flex flex-wrap gap-3 small text-secondary mt-2">
        <span className="d-inline-flex align-items-center gap-2">
          <i className="tm-swatch tm-swatch-paid" aria-hidden="true" /> Received
        </span>
        <span className="d-inline-flex align-items-center gap-2">
          <i className="tm-swatch tm-swatch-owed" aria-hidden="true" /> Outstanding (by due month)
        </span>
      </figcaption>
    </figure>
  );
}
