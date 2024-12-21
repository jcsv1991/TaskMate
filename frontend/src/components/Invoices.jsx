import React, { useEffect, useState } from 'react';
import API from '../services/api';
import { Spinner, Alert, Button } from 'react-bootstrap';

const Invoices = () => {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [filters, setFilters] = useState({
    clientName: '',
    status: '',
    sortBy: '',
    order: 'asc'
  });

  const fetchInvoices = async () => {
    setLoading(true);
    try {
      const { clientName, status, sortBy, order } = filters;
      const params = { clientName, status, sortBy, order };
      const res = await API.get('/invoices', { params });
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

  const handleFilterChange = (e) => {
    setFilters({...filters, [e.target.name]: e.target.value});
  };

  const applyFilters = () => {
    fetchInvoices();
  };

  const handleStatusChange = async (id, status) => {
    try {
      await API.put(`/invoices/${id}`, { status });
      fetchInvoices();
    } catch (err) {
      setError('Failed to update invoice status');
    }
  };

  const deleteInvoice = async (id) => {
    try {
      await API.delete(`/invoices/${id}`);
      fetchInvoices();
    } catch (err) {
      setError('Failed to delete invoice');
    }
  };

  return (
    <div className="container mt-4" style={{paddingTop:'60px'}}>
      <h2>Invoices</h2>
      {error && <Alert variant="danger">{error}</Alert>}

      <div className="row g-2 mb-3">
        <div className="col">
          <input className="form-control" name="clientName" placeholder="Client Name" value={filters.clientName} onChange={handleFilterChange} />
        </div>
        <div className="col">
          <select className="form-select" name="status" value={filters.status} onChange={handleFilterChange}>
            <option value="">All Statuses</option>
            <option value="unpaid">Unpaid</option>
            <option value="paid">Paid</option>
            <option value="overdue">Overdue</option>
          </select>
        </div>
        <div className="col">
          <select className="form-select" name="sortBy" value={filters.sortBy} onChange={handleFilterChange}>
            <option value="">No Sort</option>
            <option value="dueDate">Due Date</option>
          </select>
        </div>
        <div className="col">
          <select className="form-select" name="order" value={filters.order} onChange={handleFilterChange}>
            <option value="asc">Asc</option>
            <option value="desc">Desc</option>
          </select>
        </div>
        <div className="col">
          <button className="btn btn-primary w-100" onClick={applyFilters}>Apply</button>
        </div>
      </div>

      {loading ? <Spinner animation="border" /> : (
        <table className="table mt-3">
          <thead>
            <tr>
              <th>Client</th>
              <th>Amount</th>
              <th>Due Date</th>
              <th>Status</th>
              <th>Update Status</th>
              <th>Delete</th>
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
                <td><Button variant="danger" size="sm" onClick={() => deleteInvoice(invoice._id)}>Delete</Button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default Invoices;
