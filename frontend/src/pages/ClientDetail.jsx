import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import API from '../services/api';
import { Alert, Table, Spinner } from 'react-bootstrap';

const ClientDetail = () => {
  const { id } = useParams();
  const [client, setClient] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchClient = async () => {
    setLoading(true);
    try {
      const res = await API.get(`/clients/${id}`);
      setClient(res.data.client);
      setTasks(res.data.tasks);
      setInvoices(res.data.invoices);
    } catch (err) {
      setError('Failed to load client details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClient();
  }, [id]);

  if (error) {
    return (
      <div className="container mt-5">
        <Alert variant="danger">{error}</Alert>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="container mt-5">
        <Spinner animation="border" />
      </div>
    );
  }

  if (!client) {
    return (
      <div className="container mt-5">
        <p>No client data found.</p>
      </div>
    );
  }

  return (
    <div className="container mt-5">
      <h2>{client.name} Details</h2>
      <p><strong>Email:</strong> {client.email}</p>
      <p><strong>Phone:</strong> {client.phone}</p>

      <h3 className="mt-4">Associated Tasks</h3>
      {tasks.length === 0 ? (
        <p>No tasks found</p>
      ) : (
        <Table bordered hover responsive>
          <thead>
            <tr>
              <th>Title</th>
              <th>Due Date</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((t) => (
              <tr key={t._id}>
                <td>{t.title}</td>
                <td>{t.dueDate ? new Date(t.dueDate).toLocaleDateString() : 'N/A'}</td>
                <td>{t.completed ? 'Completed' : 'Pending'}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}

      <h3 className="mt-4">Associated Invoices</h3>
      {invoices.length === 0 ? (
        <p>No invoices found</p>
      ) : (
        <Table bordered hover responsive>
          <thead>
            <tr>
              <th>Amount</th>
              <th>Due Date</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((inv) => (
              <tr key={inv._id}>
                <td>${inv.amount}</td>
                <td>{new Date(inv.dueDate).toLocaleDateString()}</td>
                <td>{inv.status}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
};

export default ClientDetail;
