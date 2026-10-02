import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ServerStatusBanner from './ServerStatusBanner';
import { health } from '../services/endpoints';

vi.mock('../services/endpoints', () => ({ health: vi.fn() }));

const tick = (ms) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });

describe('ServerStatusBanner', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('stays invisible when the server answers quickly', async () => {
    health.mockResolvedValue({ status: 'ok' });
    render(<ServerStatusBanner />);
    await tick(10);
    expect(screen.queryByTestId('server-waking')).not.toBeInTheDocument();
    await tick(5000);
    expect(screen.queryByTestId('server-waking')).not.toBeInTheDocument();
  });

  it('does not flash a warning during the first couple of seconds', async () => {
    health.mockRejectedValue(new Error('asleep'));
    render(<ServerStatusBanner />);
    await tick(2000);
    expect(screen.queryByTestId('server-waking')).not.toBeInTheDocument();
  });

  it('explains a slow start, keeps retrying, and disappears once the API is up', async () => {
    health.mockRejectedValueOnce(new Error('asleep')).mockRejectedValueOnce(new Error('asleep')).mockResolvedValue({ status: 'ok' });
    render(<ServerStatusBanner />);
    await tick(2600);
    expect(screen.getByTestId('server-waking')).toHaveTextContent(/waking up the server/i);
    await tick(3000); // second retry fails
    expect(health).toHaveBeenCalledTimes(2);
    await tick(3000); // third attempt succeeds
    expect(health).toHaveBeenCalledTimes(3);
    expect(screen.queryByTestId('server-waking')).not.toBeInTheDocument();
  });

  it('gives up after two minutes and offers a reload', async () => {
    health.mockRejectedValue(new Error('down'));
    render(<ServerStatusBanner />);
    await tick(125000);
    expect(screen.getByRole('alert')).toHaveTextContent(/can’t reach the server/i);
    expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument();
    const calls = health.mock.calls.length;
    await tick(30000);
    expect(health.mock.calls.length).toBe(calls); // stops polling
  });

  it('stops polling when unmounted', async () => {
    health.mockRejectedValue(new Error('down'));
    const { unmount } = render(<ServerStatusBanner />);
    await tick(100);
    const calls = health.mock.calls.length;
    unmount();
    await tick(20000);
    expect(health.mock.calls.length).toBe(calls);
  });
});
