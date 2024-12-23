// src/pages/Dashboard.jsx
import React, { useEffect, useState } from 'react';
import API from '../services/api';
import { Alert, Button, Table } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';

const Dashboard = () => {
  const [upcomingTasks, setUpcomingTasks] = useState([]);
  const [invoices, setInvoices] = useState([]); // Changed variable name from overdueInvoices to invoices
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const fetchData = async () => {
    try {
      const now = new Date();
      const nextWeek = new Date();
      nextWeek.setDate(now.getDate() + 7);

      // Fetch upcoming tasks
      const tasksRes = await API.get('/tasks', {
        params: {
          dueAfter: now.toISOString().split('T')[0],
          dueBefore: nextWeek.toISOString().split('T')[0]
        }
      });
      setUpcomingTasks(tasksRes.data);

      // Previously "Overdue Invoices," now just "Invoices."
      // Example: can show overdue or all. Here, using the same logic as before
      // to show only overdue. However, the heading is changed to "Invoices."
      const invoicesRes = await API.get('/invoices', {
        params: {
          dueBefore: now.toISOString().split('T')[0],
          status: 'unpaid'
        }
      });
      setInvoices(invoicesRes.data);
    } catch (err) {
      setError('Failed to load dashboard data');
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const viewTaskDetails = (id) => {
    navigate(`/task/${id}`);
  };

  const viewInvoiceDetails = (id) => {
    navigate(`/invoice/${id}`);
  };

  return (
    <div className="container mt-5" style={{ paddingTop: '60px', textAlign: 'center' }}>
      <h1>Dashboard</h1>
      {error && <Alert variant="danger">{error}</Alert>}
      <p className="text-muted">A quick glance at upcoming tasks and invoices</p>

      <div className="row mt-4">
        <div className="col-md-6" style={{ marginBottom: '20px' }}>
          <h3>Upcoming Tasks</h3>
          {upcomingTasks.length === 0 ? (
            <p>No upcoming tasks found</p>
          ) : (
            <Table className="table mt-3" bordered hover responsive>
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Due Date</th>
                  <th>View Details</th>
                </tr>
              </thead>
              <tbody>
                {upcomingTasks.map((t) => (
                  <tr key={t._id}>
                    <td>{t.title}</td>
                    <td>{t.dueDate ? new Date(t.dueDate).toLocaleDateString() : 'N/A'}</td>
                    <td>
                      <Button onClick={() => viewTaskDetails(t._id)} size="sm">
                        View Details
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </div>
        <div className="col-md-6">
          <h3>Invoices</h3> {/* Changed heading from Overdue Invoices to Invoices */}
          {invoices.length === 0 ? (
            <p>No invoices to display</p>
          ) : (
            <Table className="table mt-3" bordered hover responsive>
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Amount</th>
                  <th>Due Date</th>
                  <th>View Details</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv._id}>
                    <td>{inv.clientId?.name || 'Unknown'}</td>
                    <td>${inv.amount}</td>
                    <td>{new Date(inv.dueDate).toLocaleDateString()}</td>
                    <td>
                      <Button onClick={() => viewInvoiceDetails(inv._id)} size="sm">
                        View Details
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
