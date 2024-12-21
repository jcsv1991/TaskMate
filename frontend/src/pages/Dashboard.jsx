import React, { useEffect, useState } from 'react';
import API from '../services/api';
import { Alert } from 'react-bootstrap';

// Changes:
// - Redesigned to show upcoming tasks and overdue invoices
// - Upcoming tasks: tasks due in next 7 days
// - Overdue invoices: invoices with dueDate < today and not paid

const Dashboard = () => {
  const [upcomingTasks, setUpcomingTasks] = useState([]);
  const [overdueInvoices, setOverdueInvoices] = useState([]);
  const [error, setError] = useState('');

  const fetchData = async () => {
    try {
      const now = new Date();
      const nextWeek = new Date();
      nextWeek.setDate(now.getDate() + 7);

      const tasksRes = await API.get('/tasks', { params: { dueAfter: now.toISOString().split('T')[0], dueBefore: nextWeek.toISOString().split('T')[0] } });
      setUpcomingTasks(tasksRes.data);

      const invoicesRes = await API.get('/invoices', { params: { dueBefore: now.toISOString().split('T')[0], status:'unpaid' } });
      setOverdueInvoices(invoicesRes.data);
    } catch (err) {
      setError('Failed to load dashboard data');
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <div className="container mt-5" style={{paddingTop:'60px'}}>
      <h1>Dashboard</h1>
      {error && <Alert variant="danger">{error}</Alert>}
      <p className="text-muted">A quick glance at upcoming tasks and overdue invoices.</p>

      <div className="row mt-4">
        <div className="col-md-6">
          <h3>Upcoming Tasks (Next 7 Days)</h3>
          {upcomingTasks.length === 0 ? (
            <p>No upcoming tasks found.</p>
          ) : (
            <ul className="list-group">
              {upcomingTasks.map(t => (
                <li key={t._id} className="list-group-item">
                  <strong>{t.title}</strong><br/>
                  <small>{t.description}</small><br/>
                  <small>Due: {t.dueDate ? new Date(t.dueDate).toLocaleDateString() : 'N/A'}</small>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="col-md-6">
          <h3>Overdue Invoices</h3>
          {overdueInvoices.length === 0 ? (
            <p>No overdue invoices.</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Amount</th>
                  <th>Due Date</th>
                </tr>
              </thead>
              <tbody>
                {overdueInvoices.map(inv => (
                  <tr key={inv._id}>
                    <td>{inv.clientId?.name || 'Unknown'}</td>
                    <td>${inv.amount}</td>
                    <td>{new Date(inv.dueDate).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
