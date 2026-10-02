import { screen, waitFor } from '@testing-library/react';
import { delay, http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { TOKEN_KEY } from '../config';
import { fakeApi, VALID_EMAIL, VALID_PASSWORD } from '../test/fakeApi';
import { server } from '../test/server';
import { location, renderApp } from '../test/render';

const signInForm = () => screen.getByRole('form', { name: 'Sign in' });

describe('Auth page', () => {
  it('sends visitors to /auth from a private page and remembers where they were going', async () => {
    renderApp('/invoices?status=overdue', { signedIn: false });
    expect(await screen.findByRole('form', { name: 'Sign in' })).toBeInTheDocument();
    expect(location().path).toBe('/auth');
    expect(location().state.from.pathname).toBe('/invoices');
  });

  it('signs in and lands back on the page they asked for', async () => {
    fakeApi.addClient({ name: 'Initech' });
    const { user } = renderApp('/clients', { signedIn: false });
    await user.type(await screen.findByLabelText('Email'), VALID_EMAIL);
    await user.type(screen.getByLabelText('Password'), VALID_PASSWORD);
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('heading', { name: 'Clients' })).toBeInTheDocument();
    expect(await screen.findByText('Initech')).toBeInTheDocument();
    expect(location().path).toBe('/clients');
    expect(window.localStorage.getItem(TOKEN_KEY)).toBe(fakeApi.token);
  });

  it('validates before calling the API', async () => {
    const { user } = renderApp('/auth', { signedIn: false });
    await user.click(await screen.findByRole('button', { name: 'Sign in' }));
    expect(screen.getByText('Enter a valid email address')).toBeInTheDocument();
    expect(screen.getByText('Enter your password')).toBeInTheDocument();
    expect(fakeApi.callsTo('POST', '/auth/login')).toHaveLength(0);
  });

  it('clears a field’s error as soon as the user edits it', async () => {
    const { user } = renderApp('/auth', { signedIn: false });
    await user.click(await screen.findByRole('button', { name: 'Sign in' }));
    await user.type(screen.getByLabelText('Email'), 'a');
    expect(screen.queryByText('Enter a valid email address')).not.toBeInTheDocument();
    expect(screen.getByText('Enter your password')).toBeInTheDocument();
  });

  it('shows the server’s message for wrong credentials and stays on the page', async () => {
    const { user } = renderApp('/auth', { signedIn: false });
    await user.type(await screen.findByLabelText('Email'), VALID_EMAIL);
    await user.type(screen.getByLabelText('Password'), 'not-the-password');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid credentials');
    expect(location().path).toBe('/auth');
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeEnabled(); // not stuck on "Please wait…"
  });

  it('reports an unreachable server in plain words', async () => {
    fakeApi.failNext('POST', '/auth/login', { network: true });
    const { user } = renderApp('/auth', { signedIn: false });
    await user.type(await screen.findByLabelText('Email'), VALID_EMAIL);
    await user.type(screen.getByLabelText('Password'), VALID_PASSWORD);
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/can't reach the server/i);
  });

  it('toggles password visibility', async () => {
    const { user } = renderApp('/auth', { signedIn: false });
    const password = await screen.findByLabelText('Password');
    expect(password).toHaveAttribute('type', 'password');
    await user.click(screen.getByRole('button', { name: 'Show password' }));
    expect(password).toHaveAttribute('type', 'text');
    await user.click(screen.getByRole('button', { name: 'Hide password' }));
    expect(password).toHaveAttribute('type', 'password');
  });

  describe('creating an account', () => {
    const openRegister = async (user) => {
      await user.click(await screen.findByRole('button', { name: 'Create an account' }));
      return screen.getByRole('form', { name: 'Create account' });
    };

    it('switches modes and back, dropping stale errors', async () => {
      const { user } = renderApp('/auth', { signedIn: false });
      await user.click(await screen.findByRole('button', { name: 'Sign in' }));
      expect(screen.getByText('Enter your password')).toBeInTheDocument();
      await openRegister(user);
      expect(screen.queryByText('Enter your password')).not.toBeInTheDocument();
      expect(screen.getByLabelText(/Name/)).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Sign in' }));
      expect(signInForm()).toBeInTheDocument();
    });

    it('requires 8+ characters', async () => {
      const { user } = renderApp('/auth', { signedIn: false });
      await openRegister(user);
      await user.type(screen.getByLabelText('Email'), 'grace@example.com');
      await user.type(screen.getByLabelText('Password'), 'short');
      await user.click(screen.getByRole('button', { name: 'Create account' }));
      expect(screen.getByText('Use at least 8 characters')).toBeInTheDocument();
      expect(fakeApi.callsTo('POST', '/auth/signup')).toHaveLength(0);
    });

    it('creates the account, signs in and opens the dashboard', async () => {
      const { user } = renderApp('/auth', { signedIn: false });
      await openRegister(user);
      await user.type(screen.getByLabelText(/Name/), '  Grace Hopper ');
      await user.type(screen.getByLabelText('Email'), ' grace@example.com ');
      await user.type(screen.getByLabelText('Password'), 'compilers-1952');
      await user.click(screen.getByRole('button', { name: 'Create account' }));
      expect(await screen.findByRole('heading', { name: /Welcome to TaskMate/ })).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/, Grace$/);
      // Whitespace is trimmed before it goes over the wire.
      expect(fakeApi.lastCall('POST', '/auth/signup').body).toEqual({ email: 'grace@example.com', password: 'compilers-1952', name: 'Grace Hopper' });
    });

    it('omits an empty name instead of sending ""', async () => {
      const { user } = renderApp('/auth', { signedIn: false });
      await openRegister(user);
      await user.type(screen.getByLabelText('Email'), 'anon@example.com');
      await user.type(screen.getByLabelText('Password'), 'long-enough-pw');
      await user.click(screen.getByRole('button', { name: 'Create account' }));
      await waitFor(() => expect(fakeApi.callsTo('POST', '/auth/signup')).toHaveLength(1));
      expect(fakeApi.lastCall('POST', '/auth/signup').body).not.toHaveProperty('name');
    });

    it('shows a duplicate-email error from the server', async () => {
      const { user } = renderApp('/auth', { signedIn: false });
      await openRegister(user);
      await user.type(screen.getByLabelText('Email'), VALID_EMAIL);
      await user.type(screen.getByLabelText('Password'), 'long-enough-pw');
      await user.click(screen.getByRole('button', { name: 'Create account' }));
      expect(await screen.findByRole('alert')).toHaveTextContent(/already exists/i);
    });

    it('puts server-side validation errors next to the field', async () => {
      const { user } = renderApp('/auth', { signedIn: false });
      await openRegister(user);
      await user.type(screen.getByLabelText('Email'), 'late@example.com');
      await user.type(screen.getByLabelText('Password'), 'longenough');
      fakeApi.failNext('POST', '/auth/signup', { status: 400, msg: 'Validation failed', extra: { errors: [{ path: 'password', message: 'Password is too common' }] } });
      await user.click(screen.getByRole('button', { name: 'Create account' }));
      expect(await screen.findByText('Password is too common')).toBeInTheDocument();
      expect(screen.getByLabelText('Password')).toHaveClass('is-invalid');
    });
  });

  describe('sample data', () => {
    it('opens a ready-made workspace in one click', async () => {
      const { user } = renderApp('/auth', { signedIn: false });
      await user.click(await screen.findByTestId('demo-button'));
      expect(await screen.findByTestId('focus-list')).toHaveTextContent('Send revised mockups');
      expect(location().path).toBe('/');
      expect(screen.getByText('Demo workspace')).toBeInTheDocument();
    });

    it('shows progress while it sets up and disables the form', async () => {
      server.use(
        http.post('*/api/auth/demo', async () => {
          await delay(150);
          return HttpResponse.json({ token: fakeApi.token, user: { _id: 'd', email: 'd@x.invalid', name: 'Demo User', isDemo: true } }, { status: 201 });
        })
      );
      const { user } = renderApp('/auth', { signedIn: false });
      const button = await screen.findByTestId('demo-button');
      await user.click(button);
      expect(button).toBeDisabled();
      expect(button).toHaveTextContent('Setting up sample data…');
      expect(screen.getByRole('button', { name: 'Sign in' })).toBeDisabled();
      expect(await screen.findByRole('heading', { name: /Welcome to TaskMate/ })).toBeInTheDocument();
    });

    it('recovers if the demo cannot be created', async () => {
      fakeApi.failNext('POST', '/auth/demo', { status: 503, msg: 'Demo workspaces are unavailable right now' });
      const { user } = renderApp('/auth', { signedIn: false });
      await user.click(await screen.findByTestId('demo-button'));
      expect(await screen.findByRole('alert')).toHaveTextContent('Demo workspaces are unavailable right now');
      expect(screen.getByTestId('demo-button')).toBeEnabled();
    });
  });

  it('bounces an already signed-in user to the dashboard', async () => {
    fakeApi.addClient();
    renderApp('/auth');
    await waitFor(() => expect(location().path).toBe('/'));
  });

  it('explains an expired session when the server rejects the token mid-use', async () => {
    fakeApi.addTask({ title: 'Something to do' });
    const { user } = renderApp('/tasks');
    await screen.findByText('Something to do');
    fakeApi.db.token = 'rotated-on-the-server'; // the stored token is now stale
    await user.click(screen.getByRole('button', { name: 'Completed' }));
    expect(await screen.findByRole('form', { name: 'Sign in' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(/your session expired/i);
    expect(window.localStorage.getItem(TOKEN_KEY)).toBeNull();
  });
});
