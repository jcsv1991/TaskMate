import { screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { THEME_KEY, TOKEN_KEY } from '../config';
import { fakeApi } from '../test/fakeApi';
import { server } from '../test/server';
import { location, renderApp } from '../test/render';

const nav = () => within(screen.getByRole('navigation', { name: 'Main' }));

describe('App shell', () => {
  it('navigates between sections and highlights the current one', async () => {
    fakeApi.addClient({ name: 'Acme' });
    const { user } = renderApp('/');
    await screen.findByRole('heading', { level: 1 });
    expect(nav().getByRole('link', { name: 'Dashboard' })).toHaveClass('active');
    for (const [label, path, heading] of [
      ['Tasks', '/tasks', 'Tasks'],
      ['Clients', '/clients', 'Clients'],
      ['Invoices', '/invoices', 'Invoices'],
    ]) {
      await user.click(nav().getByRole('link', { name: label }));
      expect(await screen.findByRole('heading', { level: 1, name: heading })).toBeInTheDocument();
      expect(location().path).toBe(path);
      expect(nav().getByRole('link', { name: label })).toHaveClass('active');
      expect(nav().getByRole('link', { name: 'Dashboard' })).not.toHaveClass('active');
    }
  });

  it('has a skip link, a main landmark and a footer crediting the author', async () => {
    renderApp('/');
    await screen.findByRole('heading', { level: 1 });
    expect(screen.getByRole('link', { name: 'Skip to content' })).toHaveAttribute('href', '#main');
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main');
    const footer = screen.getByRole('contentinfo');
    expect(footer).toHaveTextContent('built by Juan Soria');
    expect(within(footer).getByRole('link', { name: /source on GitHub/ })).toHaveAttribute('href', 'https://github.com/jcsv1991/TaskMate');
  });

  it('shows a 404 page with a way home for unknown URLs', async () => {
    const { user } = renderApp('/this/does/not/exist');
    expect(await screen.findByText('Page not found')).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: 'Back to the dashboard' }));
    expect(location().path).toBe('/');
  });

  it('hides the section links from visitors and offers sign-in', async () => {
    renderApp('/auth', { signedIn: false });
    await screen.findByRole('form', { name: 'Sign in' });
    expect(nav().queryByRole('link', { name: 'Tasks' })).not.toBeInTheDocument();
    expect(nav().getByRole('link', { name: 'Sign in' })).toBeInTheDocument();
  });

  describe('theme', () => {
    it('toggles dark mode and remembers it', async () => {
      const { user } = renderApp('/');
      await screen.findByRole('heading', { level: 1 });
      await user.click(screen.getByRole('button', { name: 'Switch to dark theme' }));
      expect(document.documentElement).toHaveAttribute('data-bs-theme', 'dark');
      expect(window.localStorage.getItem(THEME_KEY)).toBe('dark');
      await user.click(screen.getByRole('button', { name: 'Switch to light theme' }));
      expect(document.documentElement).toHaveAttribute('data-bs-theme', 'light');
    });
  });

  describe('account menu', () => {
    it('shows who is signed in and signs out', async () => {
      const { user } = renderApp('/tasks');
      await screen.findByRole('heading', { level: 1, name: 'Tasks' });
      await user.click(screen.getByRole('button', { name: 'Account menu' }));
      expect(await screen.findByText('ada@example.com')).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: /Sign out/ }));
      expect(await screen.findByRole('form', { name: 'Sign in' })).toBeInTheDocument();
      expect(window.localStorage.getItem(TOKEN_KEY)).toBeNull();
      // And the private pages are closed again.
      await waitFor(() => expect(location().path).toBe('/auth'));
    });

    it('labels the demo workspace honestly and offers to remove it', async () => {
      fakeApi.db.user = { _id: 'demo', email: 'demo@taskmate.invalid', name: 'Demo User', isDemo: true };
      const { user } = renderApp('/');
      await screen.findByRole('heading', { level: 1 });
      expect(screen.getByText('Demo workspace')).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Account menu' }));
      expect(await screen.findByText('Sample data, expires automatically')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Remove demo data/ })).toBeInTheDocument();
      expect(screen.queryByText('demo@taskmate.invalid')).not.toBeInTheDocument();
    });

    it('deletes the account only after confirmation', async () => {
      const { user } = renderApp('/');
      await screen.findByRole('heading', { level: 1 });
      await user.click(screen.getByRole('button', { name: 'Account menu' }));
      await user.click(await screen.findByRole('button', { name: /Delete account/ }));
      const dialog = await screen.findByRole('dialog', { name: 'Delete your account?' });
      expect(dialog).toHaveTextContent('permanently deletes your account');
      expect(fakeApi.callsTo('DELETE', '/auth/me')).toHaveLength(0);
      await user.click(within(dialog).getByRole('button', { name: 'Delete everything' }));
      expect(await screen.findByRole('form', { name: 'Sign in' })).toBeInTheDocument();
      expect(fakeApi.callsTo('DELETE', '/auth/me')).toHaveLength(1);
      expect(await screen.findByText('Your account and all its data were deleted.')).toBeInTheDocument();
      expect(window.localStorage.getItem(TOKEN_KEY)).toBeNull();
    });

    it('keeps the user signed in if account deletion fails', async () => {
      fakeApi.failNext('DELETE', '/auth/me', { status: 500, times: 1 });
      const { user } = renderApp('/');
      await screen.findByRole('heading', { level: 1 });
      await user.click(screen.getByRole('button', { name: 'Account menu' }));
      await user.click(await screen.findByRole('button', { name: /Delete account/ }));
      await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Delete everything' }));
      expect(await screen.findByRole('alert')).toHaveTextContent(/server exploded/i);
      expect(window.localStorage.getItem(TOKEN_KEY)).toBe(fakeApi.token);
    });

    it('removing demo data signs out with a matching message', async () => {
      fakeApi.db.user = { _id: 'demo', email: 'demo@taskmate.invalid', name: 'Demo User', isDemo: true };
      const { user } = renderApp('/');
      await screen.findByRole('heading', { level: 1 });
      await user.click(screen.getByRole('button', { name: 'Account menu' }));
      await user.click(await screen.findByRole('button', { name: /Remove demo data/ }));
      await user.click(within(await screen.findByRole('dialog', { name: 'Remove demo data?' })).getByRole('button', { name: 'Remove' }));
      expect(await screen.findByText('Demo workspace removed.')).toBeInTheDocument();
    });
  });

  describe('session check on start-up', () => {
    it('shows a retry screen instead of logging out when the server is unreachable', async () => {
      fakeApi.failNext('GET', '/auth/me', { network: true, times: 1 });
      const { user } = renderApp('/tasks');
      expect(await screen.findByText(/couldn’t reach the server to check your session/i)).toBeInTheDocument();
      expect(window.localStorage.getItem(TOKEN_KEY)).toBe(fakeApi.token);
      await user.click(screen.getByRole('button', { name: 'Try again' }));
      expect(await screen.findByRole('heading', { level: 1, name: 'Tasks' })).toBeInTheDocument();
    });

    it('shows a loading message while the session is being verified', async () => {
      server.use(
        http.get('*/api/auth/me', async () => {
          await new Promise((r) => setTimeout(r, 100));
          return HttpResponse.json({ user: fakeApi.db.user });
        })
      );
      renderApp('/tasks');
      expect(screen.getByText('Checking your session…')).toBeInTheDocument();
      expect(await screen.findByRole('heading', { level: 1, name: 'Tasks' })).toBeInTheDocument();
    });

    it('sends someone with a stale token to sign in, then straight back to where they were going', async () => {
      window.localStorage.setItem(TOKEN_KEY, 'stale-token');
      const { user } = renderApp('/invoices', { signedIn: false });
      expect(await screen.findByRole('form', { name: 'Sign in' })).toBeInTheDocument();
      expect(location().state.from.pathname).toBe('/invoices');
      expect(window.localStorage.getItem(TOKEN_KEY)).toBeNull();
      void user;
    });
  });
});
