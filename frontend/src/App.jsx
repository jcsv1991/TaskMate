import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Dashboard from './pages/Dashboard';
import Auth from './pages/Auth';
import Tasks from './components/Tasks';
import Clients from './components/Clients';
import Invoices from './components/Invoices';
import ClientDetail from './pages/ClientDetail';
import TaskDetail from './pages/TaskDetail';
import InvoiceDetail from './pages/InvoiceDetail';
import ProtectedRoute from './components/ProtectedRoute';

const App = () => (
  <Router>
    <Navbar />
    <div style={{marginTop:'80px'}}>
      <Routes>
        <Route 
          path="/" 
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          } 
        />
        <Route path="/auth" element={<Auth />} />
        <Route 
          path="/clients" 
          element={
            <ProtectedRoute>
              <Clients />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/tasks" 
          element={
            <ProtectedRoute>
              <Tasks />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/invoices" 
          element={
            <ProtectedRoute>
              <Invoices />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/client/:id" 
          element={
            <ProtectedRoute>
              <ClientDetail />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/task/:id" 
          element={
            <ProtectedRoute>
              <TaskDetail />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/invoice/:id" 
          element={
            <ProtectedRoute>
              <InvoiceDetail />
            </ProtectedRoute>
          } 
        />
      </Routes>
    </div>
  </Router>
);

export default App;
