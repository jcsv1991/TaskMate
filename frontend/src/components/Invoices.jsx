import React, { useEffect, useState } from 'react';
import API from '../services/api';
import { Spinner, Alert } from 'react-bootstrap';

const Invoices = () => {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchInvoices = async () => {
    setLoading(true);
    try {
      const res = await API.get('/invoices');
      setInvoices(res.data);
      setError('');
    } catch (err) {
      setError('Error fetching invoices');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, []);

  const handleStatusChange = async (id, status) => {
    try {
      await API.put(`/invoices/${id}`, { status });
      fetchInvoices();
    } catch (err) {
      setError('Failed to update invoice status');
    }
  }

  return (
    <div className="container mt-4">
      <h2>Your Invoices</h2>
      {error && <Alert variant="danger">{error}</Alert>}
      {loading ? <Spinner animation="border" /> : (
        <table className="table mt-3">
          <thead>
            <tr>
              <th>Client</th>
              <th>Amount</th>
              <th>Due Date</th>
              <th>Status</th>
              <th>Update Status</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((invoice) => (
              <tr key={invoice._id}>
                <td>{invoice.clientId?.name || 'Unknown'}</td>
                <td>${invoice.amount}</td>
                <td>{new Date(invoice.dueDate).toLocaleDateString()}</td>
                <td>{invoice.status}</td>
                <td>
                  <select className="form-select" defaultValue={invoice.status} onChange={(e) => handleStatusChange(invoice._id, e.target.value)}>
                    <option value="unpaid">Unpaid</option>
                    <option value="paid">Paid</option>
                    <option value="overdue">Overdue</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default Invoices;
