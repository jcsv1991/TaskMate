import React, { useEffect, useState } from 'react';
import API from '../services/api';
import { Spinner, Alert } from 'react-bootstrap';

// Changes:
// - Added sorting and filtering UI for invoices

const Invoices = () => {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [filters, setFilters] = useState({
    clientId: '',
    status: '',
    sortBy: '',
    order: 'asc',
    dueBefore: '',
    dueAfter: '',
    minAmount: '',
    maxAmount: ''
  });

  const fetchInvoices = async () => {
    setLoading(true);
    try {
      const res = await API.get('/invoices', { params: { ...filters } });
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  return (
    <div className="container mt-4">
      <h2>Invoices</h2>
      {error && <Alert variant="danger">{error}</Alert>}

      <div className="row g-2 mb-3">
        <div className="col">
          <input className="form-control" name="clientId" placeholder="Client ID" value={filters.clientId} onChange={handleFilterChange} />
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
          <input className="form-control" name="dueBefore" placeholder="Due Before (YYYY-MM-DD)" value={filters.dueBefore} onChange={handleFilterChange} />
        </div>
        <div className="col">
          <input className="form-control" name="dueAfter" placeholder="Due After (YYYY-MM-DD)" value={filters.dueAfter} onChange={handleFilterChange} />
        </div>
        <div className="col">
          <input className="form-control" name="minAmount" placeholder="Min Amount" value={filters.minAmount} onChange={handleFilterChange} />
        </div>
        <div className="col">
          <input className="form-control" name="maxAmount" placeholder="Max Amount" value={filters.maxAmount} onChange={handleFilterChange} />
        </div>
        <div className="col">
          <select className="form-select" name="sortBy" value={filters.sortBy} onChange={handleFilterChange}>
            <option value="">No Sort</option>
            <option value="dueDate">Due Date</option>
            <option value="amount">Amount</option>
            <option value="status">Status</option>
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
