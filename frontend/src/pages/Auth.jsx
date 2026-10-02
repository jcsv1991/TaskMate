import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Alert, Button, Spinner } from 'react-bootstrap';
import { ArrowRight, BarChart3, Eye, EyeOff, FileDown, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getErrorMessage, getFieldErrors } from '../utils/errors';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const HIGHLIGHTS = [
  { icon: BarChart3, title: 'A dashboard that answers “what needs me today?”', text: 'Overdue work, money owed and revenue by month, at a glance.' },
  { icon: Sparkles, title: 'Invoices that know when they are late', text: 'Overdue status is calculated from the due date, so nothing slips.' },
  { icon: FileDown, title: 'Your data stays yours', text: 'Export to CSV any time, or delete your account in one click.' },
];

export default function Auth() {
  const { isAuthed, login, signup, startDemo, sessionExpired } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(null); // 'form' | 'demo'
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  const from = (location.state && location.state.from && location.state.from.pathname) || '/';
  if (isAuthed) return <Navigate to={from} replace />;

  const isLogin = mode === 'login';
  const set = (name) => (e) => {
    setForm((f) => ({ ...f, [name]: e.target.value }));
    setError('');
    setFieldErrors((fe) => ({ ...fe, [name]: undefined }));
  };

  const switchMode = (next) => {
    setMode(next);
    setError('');
    setFieldErrors({});
  };

  const submit = async (e) => {
    e.preventDefault();
    const problems = {};
    if (!EMAIL.test(form.email.trim())) problems.email = 'Enter a valid email address';
    if (!form.password) problems.password = 'Enter your password';
    else if (!isLogin && form.password.length < 8) problems.password = 'Use at least 8 characters';
    if (Object.keys(problems).length) {
      setFieldErrors(problems);
      return;
    }
    setBusy('form');
    setError('');
    try {
      if (isLogin) await login({ email: form.email.trim(), password: form.password });
      else await signup({ email: form.email.trim(), password: form.password, name: form.name.trim() || undefined });
      navigate(from, { replace: true });
    } catch (err) {
      setFieldErrors(getFieldErrors(err));
      setError(getErrorMessage(err));
      setBusy(null);
    }
  };

  const tryDemo = async () => {
    setBusy('demo');
    setError('');
    try {
      await startDemo();
      navigate('/', { replace: true });
    } catch (err) {
      setError(getErrorMessage(err));
      setBusy(null);
    }
  };

  return (
    <div className="row g-4 g-lg-5 align-items-center tm-auth">
      <div className="col-lg-6 order-2 order-lg-1">
        <p className="tm-eyebrow">Built for freelancers</p>
        <h1 className="display-6 fw-bold mb-3">Tasks, clients and invoices in one calm place.</h1>
        <p className="lead text-secondary mb-4">TaskMate keeps your work, your people and your money organised, so you can spend your time on the work itself.</p>
        <ul className="list-unstyled d-grid gap-3 mb-0">
          {HIGHLIGHTS.map(({ icon: Icon, title, text }) => (
            <li key={title} className="d-flex gap-3">
              <span className="tm-stat-icon bg-primary-subtle text-primary-emphasis flex-shrink-0" aria-hidden="true">
                <Icon size={18} />
              </span>
              <span>
                <strong className="d-block">{title}</strong>
                <span className="text-secondary">{text}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="col-lg-5 offset-lg-1 order-1 order-lg-2">
        <div className="tm-card p-4 p-md-5">
          {sessionExpired && (
            <Alert variant="warning" className="py-2" role="status">
              Your session expired. Please sign in again.
            </Alert>
          )}

          <div className="d-grid mb-3">
            <Button size="lg" variant="primary" onClick={tryDemo} disabled={busy !== null} data-testid="demo-button">
              {busy === 'demo' ? (
                <>
                  <Spinner size="sm" className="me-2" aria-hidden="true" />
                  Setting up sample data…
                </>
              ) : (
                <>
                  Explore with sample data <ArrowRight size={18} className="ms-1" aria-hidden="true" />
                </>
              )}
            </Button>
            <div className="form-text text-center mt-2">No sign-up needed. A private demo workspace is created for you.</div>
          </div>

          <div className="tm-divider" role="separator">
            <span>or {isLogin ? 'sign in' : 'create an account'}</span>
          </div>

          {error && (
            <Alert variant="danger" className="py-2" role="alert">
              {error}
            </Alert>
          )}

          <form onSubmit={submit} noValidate aria-label={isLogin ? 'Sign in' : 'Create account'}>
            {!isLogin && (
              <div className="mb-3">
                <label htmlFor="auth-name" className="form-label fw-medium">
                  Name <span className="text-secondary fw-normal">(optional)</span>
                </label>
                <input id="auth-name" className="form-control" autoComplete="name" value={form.name} onChange={set('name')} maxLength={80} />
              </div>
            )}
            <div className="mb-3">
              <label htmlFor="auth-email" className="form-label fw-medium">
                Email
              </label>
              <input id="auth-email" type="email" className={`form-control ${fieldErrors.email ? 'is-invalid' : ''}`} autoComplete="email" value={form.email} onChange={set('email')} aria-describedby={fieldErrors.email ? 'auth-email-error' : undefined} required />
              {fieldErrors.email && (
                <div className="invalid-feedback" id="auth-email-error">
                  {fieldErrors.email}
                </div>
              )}
            </div>
            <div className="mb-3">
              <label htmlFor="auth-password" className="form-label fw-medium">
                Password
              </label>
              <div className="input-group has-validation">
                <input
                  id="auth-password"
                  type={showPassword ? 'text' : 'password'}
                  className={`form-control ${fieldErrors.password ? 'is-invalid' : ''}`}
                  autoComplete={isLogin ? 'current-password' : 'new-password'}
                  value={form.password}
                  onChange={set('password')}
                  aria-describedby={fieldErrors.password ? 'auth-password-error' : undefined}
                  required
                />
                <button type="button" className="btn btn-outline-secondary" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? 'Hide password' : 'Show password'}>
                  {showPassword ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
                </button>
                {fieldErrors.password && (
                  <div className="invalid-feedback" id="auth-password-error">
                    {fieldErrors.password}
                  </div>
                )}
              </div>
              {!isLogin && <div className="form-text">At least 8 characters.</div>}
            </div>
            <div className="d-grid">
              <Button type="submit" variant={isLogin ? 'outline-primary' : 'success'} disabled={busy !== null}>
                {busy === 'form' ? 'Please wait…' : isLogin ? 'Sign in' : 'Create account'}
              </Button>
            </div>
          </form>

          <p className="text-center text-secondary mt-3 mb-0">
            {isLogin ? 'New here?' : 'Already have an account?'}{' '}
            <button type="button" className="btn btn-link p-0 align-baseline" onClick={() => switchMode(isLogin ? 'register' : 'login')}>
              {isLogin ? 'Create an account' : 'Sign in'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
