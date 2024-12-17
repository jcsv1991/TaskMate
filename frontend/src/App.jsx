import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Dashboard from './pages/Dashboard';
import Auth from './pages/Auth';
import Tasks from './components/Tasks';
import Clients from './components/Clients';
import Invoices from './components/Invoices';

const App = () => (
  <Router>
    <Navbar />
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/auth" element={<Auth />} />
      <Route path="/tasks" element={<Tasks />} />
      <Route path="/clients" element={<Clients />} />
      <Route path="/invoices" element={<Invoices />} />
    </Routes>
  </Router>
);

export default App;
