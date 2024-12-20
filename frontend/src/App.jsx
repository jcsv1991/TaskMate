import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Dashboard from './pages/Dashboard';
import Auth from './pages/Auth';
import Tasks from './components/Tasks';
import Clients from './components/Clients';
import Invoices from './components/Invoices';
import ProtectedRoute from './components/ProtectedRoute';

const App = () => (
  <Router>
    <Navbar />
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
        path="/tasks" 
        element={
          <ProtectedRoute>
            <Tasks />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/clients" 
        element={
          <ProtectedRoute>
            <Clients />
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
    </Routes>
  </Router>
);

export default App;
