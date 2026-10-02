import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { EmptyState } from '../components/Feedback';

export default function NotFound() {
  return (
    <EmptyState icon={Compass} title="Page not found" action={<Link to="/" className="btn btn-primary">Back to the dashboard</Link>}>
      The page you’re looking for doesn’t exist or has moved.
    </EmptyState>
  );
}
