import { BrowserRouter, Route, Routes } from 'react-router-dom';
import AppLayout from './components/AppLayout';
import ProtectedRoute from './components/ProtectedRoute';
import Auth from './pages/Auth';
import Dashboard from './pages/Dashboard';
import Tasks from './pages/Tasks';
import TaskDetail from './pages/TaskDetail';
import Clients from './pages/Clients';
import ClientDetail from './pages/ClientDetail';
import Invoices from './pages/Invoices';
import InvoiceDetail from './pages/InvoiceDetail';
import NotFound from './pages/NotFound';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';

/** Everything the pages need from context, shared by the app and the tests. */
export function Providers({ children }) {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>{children}</AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}

export function AppRoutes() {
  const guard = (element) => <ProtectedRoute>{element}</ProtectedRoute>;
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={guard(<Dashboard />)} />
        <Route path="/tasks" element={guard(<Tasks />)} />
        <Route path="/task/:id" element={guard(<TaskDetail />)} />
        <Route path="/clients" element={guard(<Clients />)} />
        <Route path="/client/:id" element={guard(<ClientDetail />)} />
        <Route path="/invoices" element={guard(<Invoices />)} />
        <Route path="/invoice/:id" element={guard(<InvoiceDetail />)} />
        <Route path="/auth" element={<Auth />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Providers>
        <AppRoutes />
      </Providers>
    </BrowserRouter>
  );
}
