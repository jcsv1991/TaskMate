import { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Container, Dropdown, Nav, Navbar } from 'react-bootstrap';
import { CheckSquare, LayoutDashboard, LogOut, Moon, ReceiptText, Sun, Trash2, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import { auth as authApi } from '../services/endpoints';
import { getErrorMessage } from '../utils/errors';
import { initials } from '../utils/format';
import ConfirmModal from './ConfirmModal';
import ServerStatusBanner from './ServerStatusBanner';

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/tasks', label: 'Tasks', icon: CheckSquare },
  { to: '/clients', label: 'Clients', icon: Users },
  { to: '/invoices', label: 'Invoices', icon: ReceiptText },
];

export default function AppLayout() {
  const { user, isAuthed, isDemo, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const toast = useToast();
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/auth');
  };

  const handleDeleteAccount = async () => {
    try {
      await authApi.deleteAccount();
      logout();
      setConfirmDelete(false);
      toast.info(isDemo ? 'Demo workspace removed.' : 'Your account and all its data were deleted.');
      navigate('/auth');
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  return (
    <>
      <a href="#main" className="tm-skip-link">
        Skip to content
      </a>
      <Navbar expand="md" expanded={expanded} onToggle={setExpanded} className="tm-navbar" fixed="top" aria-label="Main">
        <Container>
          <Navbar.Brand as={Link} to="/" className="d-flex align-items-center gap-2 fw-semibold">
            <span className="tm-logo" aria-hidden="true">
              <CheckSquare size={18} />
            </span>
            TaskMate
          </Navbar.Brand>
          <Navbar.Toggle aria-controls="main-nav" aria-label="Toggle navigation" />
          <Navbar.Collapse id="main-nav">
            {isAuthed && (
              <Nav className="me-auto ms-md-3 gap-md-1" as="ul">
                {NAV.map(({ to, label, icon: Icon, end }) => (
                  <li className="nav-item" key={to}>
                    <NavLink to={to} end={end} className="nav-link d-flex align-items-center gap-2" onClick={() => setExpanded(false)}>
                      <Icon size={16} aria-hidden="true" />
                      {label}
                    </NavLink>
                  </li>
                ))}
              </Nav>
            )}
            <div className="d-flex align-items-center gap-2 ms-md-auto mt-3 mt-md-0">
              <button type="button" className="btn btn-outline-secondary btn-sm tm-icon-btn" onClick={toggle} aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}>
                {theme === 'dark' ? <Sun size={16} aria-hidden="true" /> : <Moon size={16} aria-hidden="true" />}
              </button>
              {isAuthed ? (
                <Dropdown align="end">
                  <Dropdown.Toggle variant="light" size="sm" className="tm-user-toggle d-flex align-items-center gap-2" id="user-menu" aria-label="Account menu">
                    <span className="tm-avatar" aria-hidden="true">
                      {initials(user.name || user.email)}
                    </span>
                    <span className="d-none d-lg-inline text-truncate" style={{ maxWidth: 140 }}>
                      {isDemo ? 'Demo workspace' : user.name || user.email}
                    </span>
                  </Dropdown.Toggle>
                  <Dropdown.Menu>
                    <Dropdown.ItemText className="small text-secondary">{isDemo ? 'Sample data, expires automatically' : user.email}</Dropdown.ItemText>
                    <Dropdown.Divider />
                    <Dropdown.Item onClick={handleLogout} className="d-flex align-items-center gap-2">
                      <LogOut size={15} aria-hidden="true" /> Sign out
                    </Dropdown.Item>
                    <Dropdown.Item onClick={() => setConfirmDelete(true)} className="d-flex align-items-center gap-2 text-danger">
                      <Trash2 size={15} aria-hidden="true" /> {isDemo ? 'Remove demo data' : 'Delete account'}
                    </Dropdown.Item>
                  </Dropdown.Menu>
                </Dropdown>
              ) : (
                <Link to="/auth" className="btn btn-primary btn-sm">
                  Sign in
                </Link>
              )}
            </div>
          </Navbar.Collapse>
        </Container>
      </Navbar>

      <ServerStatusBanner />

      <main id="main" className="tm-main container py-4 py-md-5" tabIndex={-1}>
        <Outlet />
      </main>

      <footer className="tm-footer container text-center text-secondary small pb-4">
        TaskMate · built by Juan Soria ·{' '}
        <a href="https://github.com/jcsv1991/TaskMate" target="_blank" rel="noreferrer">
          source on GitHub
        </a>
      </footer>

      <ConfirmModal
        show={confirmDelete}
        title={isDemo ? 'Remove demo data?' : 'Delete your account?'}
        confirmLabel={isDemo ? 'Remove' : 'Delete everything'}
        onConfirm={handleDeleteAccount}
        onClose={() => setConfirmDelete(false)}
      >
        {isDemo
          ? 'This removes the sample workspace you are exploring. You can start a fresh one any time.'
          : 'This permanently deletes your account, clients, tasks and invoices. It cannot be undone.'}
      </ConfirmModal>
    </>
  );
}
