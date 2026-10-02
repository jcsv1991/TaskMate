import { act, render, renderHook, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { THEME_KEY, TOKEN_KEY } from '../config';
import { fakeApi, VALID_EMAIL, VALID_PASSWORD } from '../test/fakeApi';
import { server } from '../test/server';
import { AuthProvider, useAuth } from './AuthContext';
import { ThemeProvider, useTheme } from './ThemeContext';
import { ToastProvider, useToast } from './ToastContext';

describe('useAuth / useToast / useTheme outside a provider', () => {
  it.each([
    ['useAuth', useAuth, /AuthProvider/],
    ['useToast', useToast, /ToastProvider/],
    ['useTheme', useTheme, /ThemeProvider/],
  ])('%s explains what is missing', (_name, hook, message) => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const swallow = (e) => e.preventDefault(); // keeps jsdom from printing the (expected) uncaught error
    window.addEventListener('error', swallow);
    expect(() => renderHook(() => hook())).toThrow(message);
    window.removeEventListener('error', swallow);
  });
});

const authWrapper = ({ children }) => (
  <MemoryRouter>
    <ToastProvider>
      <AuthProvider>{children}</AuthProvider>
    </ToastProvider>
  </MemoryRouter>
);

describe('AuthProvider', () => {
  it('is anonymous without a stored token and never calls the API', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper: authWrapper });
    expect(result.current.status).toBe('anon');
    expect(result.current.isAuthed).toBe(false);
    expect(fakeApi.calls).toHaveLength(0);
  });

  it('verifies a stored token on start-up', async () => {
    window.localStorage.setItem(TOKEN_KEY, fakeApi.token);
    const { result } = renderHook(() => useAuth(), { wrapper: authWrapper });
    expect(result.current.status).toBe('loading');
    await waitFor(() => expect(result.current.status).toBe('authed'));
    expect(result.current.user.email).toBe(VALID_EMAIL);
  });

  it('drops a token the server rejects', async () => {
    window.localStorage.setItem(TOKEN_KEY, 'expired');
    const { result } = renderHook(() => useAuth(), { wrapper: authWrapper });
    await waitFor(() => expect(result.current.status).toBe('anon'));
    expect(window.localStorage.getItem(TOKEN_KEY)).toBeNull();
  });

  it('keeps the token when the server is merely unreachable, and lets the user retry', async () => {
    window.localStorage.setItem(TOKEN_KEY, fakeApi.token);
    fakeApi.failNext('GET', '/auth/me', { network: true, times: 1 });
    const { result } = renderHook(() => useAuth(), { wrapper: authWrapper });
    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(window.localStorage.getItem(TOKEN_KEY)).toBe(fakeApi.token);
    act(() => result.current.retry());
    await waitFor(() => expect(result.current.status).toBe('authed'));
  });

  it('signs in, stores the token and reports isDemo=false', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper: authWrapper });
    await act(async () => {
      await result.current.login({ email: VALID_EMAIL, password: VALID_PASSWORD });
    });
    expect(result.current.isAuthed).toBe(true);
    expect(result.current.isDemo).toBe(false);
    expect(window.localStorage.getItem(TOKEN_KEY)).toBe(fakeApi.token);
  });

  it('rejects bad credentials without changing state', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper: authWrapper });
    await expect(act(() => result.current.login({ email: VALID_EMAIL, password: 'wrong' }))).rejects.toBeTruthy();
    expect(result.current.status).toBe('anon');
    expect(window.localStorage.getItem(TOKEN_KEY)).toBeNull();
  });

  it('starts a demo session', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper: authWrapper });
    await act(async () => {
      await result.current.startDemo();
    });
    expect(result.current.isDemo).toBe(true);
  });

  it('signs up', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper: authWrapper });
    await act(async () => {
      await result.current.signup({ email: 'new@example.com', password: 'longenough1', name: 'New' });
    });
    expect(result.current.user).toMatchObject({ email: 'new@example.com', name: 'New' });
  });

  it('logs out and forgets the token', async () => {
    window.localStorage.setItem(TOKEN_KEY, fakeApi.token);
    const { result } = renderHook(() => useAuth(), { wrapper: authWrapper });
    await waitFor(() => expect(result.current.isAuthed).toBe(true));
    act(() => result.current.logout());
    expect(result.current.status).toBe('anon');
    expect(window.localStorage.getItem(TOKEN_KEY)).toBeNull();
  });

  it('flags an expired session when any later request comes back 401', async () => {
    window.localStorage.setItem(TOKEN_KEY, fakeApi.token);
    const { result } = renderHook(() => useAuth(), { wrapper: authWrapper });
    await waitFor(() => expect(result.current.isAuthed).toBe(true));
    server.use(http.get('*/api/tasks', () => HttpResponse.json({ msg: 'Token is not valid' }, { status: 401 })));
    const { tasks } = await import('../services/endpoints');
    await act(async () => {
      await tasks.list().catch(() => {});
    });
    expect(result.current.status).toBe('anon');
    expect(result.current.sessionExpired).toBe(true);
  });

  it('lets the profile be replaced', async () => {
    window.localStorage.setItem(TOKEN_KEY, fakeApi.token);
    const { result } = renderHook(() => useAuth(), { wrapper: authWrapper });
    await waitFor(() => expect(result.current.isAuthed).toBe(true));
    act(() => result.current.updateUser({ ...result.current.user, name: 'Renamed' }));
    expect(result.current.user.name).toBe('Renamed');
  });
});

describe('ThemeProvider', () => {
  const setup = () => renderHook(() => useTheme(), { wrapper: ThemeProvider });

  it('defaults to the system preference', () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: true, addEventListener() {}, removeEventListener() {} });
    const { result } = setup();
    expect(result.current.theme).toBe('dark');
    expect(document.documentElement).toHaveAttribute('data-bs-theme', 'dark');
  });

  it('defaults to light when the system has no preference', () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: false, addEventListener() {}, removeEventListener() {} });
    expect(setup().result.current.theme).toBe('light');
  });

  it('a saved choice beats the system preference', () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: true });
    window.localStorage.setItem(THEME_KEY, 'light');
    expect(setup().result.current.theme).toBe('light');
  });

  it('toggles, applies the attribute and remembers the choice', () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: false });
    const { result } = setup();
    act(() => result.current.toggle());
    expect(result.current.theme).toBe('dark');
    expect(document.documentElement).toHaveAttribute('data-bs-theme', 'dark');
    expect(window.localStorage.getItem(THEME_KEY)).toBe('dark');
    act(() => result.current.toggle());
    expect(window.localStorage.getItem(THEME_KEY)).toBe('light');
  });

  it('ignores a corrupt saved value', () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: false });
    window.localStorage.setItem(THEME_KEY, 'neon');
    expect(setup().result.current.theme).toBe('light');
  });
});

describe('ToastProvider', () => {
  function Buttons() {
    const toast = useToast();
    return (
      <>
        <button onClick={() => toast.success('Saved it')}>ok</button>
        <button onClick={() => toast.error('It broke')}>bad</button>
        <button onClick={() => toast.info('FYI')}>info</button>
        <button onClick={() => ['one', 'two', 'three', 'four', 'five', 'six'].forEach((m) => toast.info(m))}>many</button>
      </>
    );
  }
  const setup = () =>
    render(
      <ToastProvider>
        <Buttons />
      </ToastProvider>
    );

  it('shows success as a polite status and errors as an alert', async () => {
    setup();
    await userEvent.click(screen.getByText('ok'));
    expect(await screen.findByRole('status')).toHaveTextContent('Saved it');
    await userEvent.click(screen.getByText('bad'));
    expect(await screen.findByRole('alert')).toHaveTextContent('It broke');
  });

  it('can be dismissed', async () => {
    setup();
    await userEvent.click(screen.getByText('info'));
    await userEvent.click(await screen.findByRole('button', { name: 'Dismiss' }));
    await waitFor(() => expect(screen.queryByText('FYI')).not.toBeInTheDocument());
  });

  it('hides itself after a few seconds (errors linger longer)', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    setup();
    await userEvent.click(screen.getByText('info'));
    await userEvent.click(screen.getByText('bad'));
    expect(screen.getByText('FYI')).toBeInTheDocument();
    await act(async () => { await vi.advanceTimersByTimeAsync(4100); });
    expect(screen.queryByText('FYI')).not.toBeInTheDocument();
    expect(screen.getByText('It broke')).toBeInTheDocument();
    await act(async () => { await vi.advanceTimersByTimeAsync(3000); });
    expect(screen.queryByText('It broke')).not.toBeInTheDocument();
  });

  it('never stacks more than four toasts', async () => {
    setup();
    await userEvent.click(screen.getByText('many'));
    await waitFor(() => expect(screen.getAllByRole('status')).toHaveLength(4));
    expect(screen.queryByText('one')).not.toBeInTheDocument();
    expect(screen.getByText('six')).toBeInTheDocument();
  });
});
