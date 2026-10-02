import { Navigate, useLocation } from 'react-router-dom';
import { Button } from 'react-bootstrap';
import { useAuth } from '../context/AuthContext';
import { LoadingBlock } from './Feedback';

/** Keeps signed-out visitors away from private pages, and sends them back after login. */
export default function ProtectedRoute({ children }) {
  const { status, retry } = useAuth();
  const location = useLocation();

  if (status === 'loading') return <LoadingBlock label="Checking your session…" />;

  if (status === 'error') {
    return (
      <div className="container py-5 text-center">
        <p className="mb-3">We couldn’t reach the server to check your session.</p>
        <Button onClick={retry}>Try again</Button>
      </div>
    );
  }

  if (status !== 'authed') return <Navigate to="/auth" replace state={{ from: location }} />;
  return children;
}
