import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { DueBadge, InvoiceStatusBadge, PriorityBadge } from './Badges';
import ConfirmModal from './ConfirmModal';
import { EmptyState, ErrorState, LoadingBlock } from './Feedback';
import PageHeader from './PageHeader';
import Pager from './Pager';
import RevenueChart from './RevenueChart';
import StatCard from './StatCard';

describe('Badges', () => {
  it.each([
    ['paid', 'Paid'],
    ['unpaid', 'Unpaid'],
    ['overdue', 'Overdue'],
  ])('invoice status %s reads "%s"', (status, label) => {
    render(<InvoiceStatusBadge status={status} />);
    expect(screen.getByText(label)).toHaveAttribute('data-status', status);
  });
  it('falls back to "Unpaid" for an unknown invoice status', () => {
    render(<InvoiceStatusBadge status="weird" />);
    expect(screen.getByText('Unpaid')).toBeInTheDocument();
  });
  it.each([
    ['high', 'High'],
    ['medium', 'Medium'],
    ['low', 'Low'],
  ])('priority %s reads "%s"', (priority, label) => {
    render(<PriorityBadge priority={priority} />);
    expect(screen.getByText(label)).toHaveAttribute('data-priority', priority);
  });
  it('falls back to "Medium" for an unknown priority', () => {
    render(<PriorityBadge priority={undefined} />);
    expect(screen.getByText('Medium')).toBeInTheDocument();
  });
  it('colours the due label by tone', () => {
    const { rerender } = render(<DueBadge info={{ label: '3 days overdue', tone: 'danger' }} />);
    expect(screen.getByText('3 days overdue')).toHaveClass('text-danger-emphasis');
    rerender(<DueBadge info={{ label: 'Oct 5, 2026', tone: 'secondary' }} />);
    expect(screen.getByText('Oct 5, 2026')).toHaveClass('text-secondary');
  });
});

describe('Pager', () => {
  it('renders nothing when there are no results', () => {
    const { container } = render(<Pager page={1} totalPages={1} total={0} perPage={20} onPage={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });
  it('shows the visible range without paging controls on a single page', () => {
    render(<Pager page={1} totalPages={1} total={9} perPage={20} onPage={() => {}} />);
    expect(screen.getByText('Showing 1–9 of 9')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /next page/i })).not.toBeInTheDocument();
  });
  it('shows the right range on the last, partial page', () => {
    render(<Pager page={3} totalPages={3} total={45} perPage={20} onPage={() => {}} />);
    expect(screen.getByText('Showing 41–45 of 45')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /next page/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /previous page/i })).toBeEnabled();
  });
  it('asks for the neighbouring page', async () => {
    const onPage = vi.fn();
    render(<Pager page={2} totalPages={3} total={50} perPage={20} onPage={onPage} />);
    await userEvent.click(screen.getByRole('button', { name: /next page/i }));
    await userEvent.click(screen.getByRole('button', { name: /previous page/i }));
    expect(onPage.mock.calls).toEqual([[3], [1]]);
  });
  it('disables "previous" on the first page', () => {
    render(<Pager page={1} totalPages={3} total={50} perPage={20} onPage={() => {}} />);
    expect(screen.getByRole('button', { name: /previous page/i })).toBeDisabled();
    expect(screen.getByText('Page 1 of 3')).toBeInTheDocument();
  });
});

describe('StatCard', () => {
  it('shows label, value and hint', () => {
    render(<StatCard label="Open tasks" value={9} hint="All on track" testId="open" />);
    const card = screen.getByTestId('open');
    expect(within(card).getByText('Open tasks')).toBeInTheDocument();
    expect(within(card).getByText('9')).toBeInTheDocument();
    expect(within(card).getByText('All on track')).toBeInTheDocument();
  });
  it('becomes a link when given a destination', () => {
    render(
      <MemoryRouter>
        <StatCard label="Outstanding" value="$5" to="/invoices?status=outstanding" />
      </MemoryRouter>
    );
    expect(screen.getByRole('link')).toHaveAttribute('href', '/invoices?status=outstanding');
  });
});

describe('ConfirmModal', () => {
  it('confirms and cancels', async () => {
    const onConfirm = vi.fn().mockResolvedValue();
    const onClose = vi.fn();
    render(
      <ConfirmModal show title="Delete it?" onConfirm={onConfirm} onClose={onClose}>
        Really?
      </ConfirmModal>
    );
    expect(screen.getByRole('dialog', { name: 'Delete it?' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
  it('locks the dialog while the action is running', async () => {
    let finish;
    const onConfirm = vi.fn(() => new Promise((resolve) => (finish = resolve)));
    render(
      <ConfirmModal show title="Delete it?" onConfirm={onConfirm} onClose={() => {}}>
        Really?
      </ConfirmModal>
    );
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(screen.getByRole('button', { name: 'Working…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    finish();
    expect(await screen.findByRole('button', { name: 'Delete' })).toBeEnabled();
  });
  it('supports a custom label', () => {
    render(
      <ConfirmModal show title="Wipe" confirmLabel="Delete everything" onConfirm={() => {}} onClose={() => {}}>
        x
      </ConfirmModal>
    );
    expect(screen.getByRole('button', { name: 'Delete everything' })).toBeInTheDocument();
  });
});

describe('Feedback', () => {
  it('LoadingBlock announces itself as a status', () => {
    render(<LoadingBlock label="Loading clients…" />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading clients…');
  });
  it('ErrorState shows a friendly message and offers a retry', async () => {
    const onRetry = vi.fn();
    render(<ErrorState error={{ response: { status: 500, data: {} } }} onRetry={onRetry} />);
    expect(screen.getByRole('alert')).toHaveTextContent(/server had a problem/i);
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalled();
  });
  it('ErrorState without a retry handler has no button', () => {
    render(<ErrorState error={new Error('x')} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
  it('EmptyState renders title, body and action', () => {
    render(<EmptyState title="Nothing here" action={<button>Add one</button>}>Create something.</EmptyState>);
    expect(screen.getByRole('heading', { name: 'Nothing here' })).toBeInTheDocument();
    expect(screen.getByText('Create something.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add one' })).toBeInTheDocument();
  });
});

describe('PageHeader', () => {
  it('renders title, subtitle and actions', () => {
    render(<PageHeader title="Tasks" subtitle="Get things done" actions={<button>New</button>} />);
    expect(screen.getByRole('heading', { level: 1, name: 'Tasks' })).toBeInTheDocument();
    expect(screen.getByText('Get things done')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New' })).toBeInTheDocument();
  });
});

describe('RevenueChart', () => {
  const data = [
    { month: '2026-08', paid: 2500, outstanding: 0 },
    { month: '2026-09', paid: 1000, outstanding: 4000 },
    { month: '2026-10', paid: 0, outstanding: 0 },
  ];
  it('describes the data for screen readers', () => {
    render(<RevenueChart data={data} />);
    const label = screen.getByRole('img').getAttribute('aria-label');
    expect(label).toContain('Aug: $2,500.00 received, $0.00 outstanding');
    expect(label).toContain('Sep: $1,000.00 received, $4,000.00 outstanding');
  });
  it('picks round axis values and labels every month', () => {
    render(<RevenueChart data={data} />);
    const svg = screen.getByRole('img');
    expect(svg).toHaveTextContent('$5K'); // 4,000 + 1,000 -> a "nice" 5K ceiling
    expect(svg).toHaveTextContent('$0');
    ['Aug', 'Sep', 'Oct'].forEach((m) => expect(svg).toHaveTextContent(m));
  });
  it('copes with an empty year', () => {
    render(<RevenueChart data={[{ month: '2026-10', paid: 0, outstanding: 0 }]} />);
    expect(screen.getByRole('img')).toBeInTheDocument();
  });
  it('legend explains solid vs striped bars', () => {
    render(<RevenueChart data={data} />);
    expect(screen.getByText('Received')).toBeInTheDocument();
    expect(screen.getByText(/outstanding \(by due month\)/i)).toBeInTheDocument();
  });
});
