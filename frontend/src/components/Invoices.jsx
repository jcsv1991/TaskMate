import React, { useEffect, useState } from 'react';
import API from '../services/api';
import { Spinner, Alert, Button, Modal } from 'react-bootstrap';

/*
 Changes:
 1. Sorting & filtering logic for invoices. 
 2. Confirmed calls GET /invoices with { clientName, status, sortBy, order } 
 3. "Add Invoice" modal uses clientName suggestions, properly sets clientId.
*/

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

  const [allClients, setAllClients] = useState([]);
  const [clientSuggestions, setClientSuggestions] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [invoiceData, setInvoiceData] = useState({ clientName:'', amount:'', dueDate:'' });

  useEffect(() => {
    applyFilters();
    fetchClients();
  }, []);

  const fetchClients = async () => {
    try {
      const res = await API.get('/clients');
      setAllClients(res.data);
    } catch (err) {
      setError('Error fetching clients for autocomplete');
    }
  };

  const fetchInvoices = async (params) => {
    setLoading(true);
    try {
      const res = await API.get('/invoices', { params });
      setInvoices(res.data);
      setError('');
    } catch (err) {
      setError('Error fetching invoices');
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    const { clientName, status, sortBy, order } = filters;
    const params = { clientName, status, sortBy, order };
    fetchInvoices(params);
  };

  const handleFilterChange = (e) => {
    setFilters({...filters, [e.target.name]: e.target.value});
  };

  // For adding a new invoice
  const openAddModal = () => {
    setInvoiceData({ clientName:'', amount:'', dueDate:'' });
    setShowAddModal(true);
  };
  const closeAddModal = () => setShowAddModal(false);

  // Autocomplete for invoiceData.clientName
  useEffect(() => {
    const filtered = allClients.filter(c => c.name.toLowerCase().includes(invoiceData.clientName.toLowerCase()));
    setClientSuggestions(filtered.slice(0,5));
  }, [invoiceData.clientName, allClients]);

  const selectInvoiceClientSuggestion = (name) => {
    setInvoiceData({...invoiceData, clientName:name});
    setClientSuggestions([]);
  };

  const handleInvoiceDataChange = (e) => {
    setInvoiceData({...invoiceData, [e.target.name]: e.target.value});
  };

  const addInvoice = async (e) => {
    e.preventDefault();
    setError('');

    try {
      const matched = allClients.find(c => c.name.toLowerCase() === invoiceData.clientName.toLowerCase());
      if (!matched) {
        setError('Invalid client name');
        return;
      }
      const payload = {
        clientId: matched._id,
        amount: Number(invoiceData.amount),
        dueDate: invoiceData.dueDate
      };
      await API.post('/invoices', payload);
      closeAddModal();
      applyFilters();
    } catch (err) {
      setError('Failed to add invoice');
    }
  };

  const handleStatusChange = async (id, status) => {
    try {
      await API.put(`/invoices/${id}`, { status });
      applyFilters();
    } catch (err) {
      setError('Failed to update invoice status');
    }
  };

  const deleteInvoice = async (id) => {
    try {
      await API.delete(`/invoices/${id}`);
      applyFilters();
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
          <input 
            className="form-control" 
            name="clientName" 
            placeholder="Client Name" 
            value={filters.clientName} 
            onChange={handleFilterChange} 
          />
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

      <Button className="mb-3" onClick={openAddModal}>Add Invoice</Button>

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
            {invoices.map((inv) => (
              <tr key={inv._id}>
                <td>{inv.clientId?.name || 'Unknown'}</td>
                <td>${inv.amount}</td>
                <td>{new Date(inv.dueDate).toLocaleDateString()}</td>
                <td>{inv.status}</td>
                <td>
                  <select className="form-select" defaultValue={inv.status} onChange={(e) => handleStatusChange(inv._id, e.target.value)}>
                    <option value="unpaid">Unpaid</option>
                    <option value="paid">Paid</option>
                    <option value="overdue">Overdue</option>
                  </select>
                </td>
                <td>
                  <Button variant="danger" size="sm" onClick={() => deleteInvoice(inv._id)}>Delete</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Add Invoice Modal */}
      <Modal show={showAddModal} onHide={closeAddModal}>
        <Modal.Header closeButton>
          <Modal.Title>Add Invoice</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <form onSubmit={addInvoice}>
            <div className="mb-3 position-relative">
              <input
                className="form-control"
                name="clientName"
                placeholder="Client Name"
                value={invoiceData.clientName}
                onChange={handleInvoiceDataChange}
              />
              {invoiceData.clientName && clientSuggestions.length > 0 && (
                <ul className="list-group position-absolute" style={{width:'100%', zIndex:'10'}}>
                  {clientSuggestions.map(c => (
                    <li 
                      key={c._id}
                      className="list-group-item"
                      style={{cursor:'pointer'}}
                      onMouseDown={() => selectInvoiceClientSuggestion(c.name)}
                    >
                      {c.name}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="mb-3">
              <input
                type="number"
                className="form-control"
                name="amount"
                placeholder="Amount"
                value={invoiceData.amount}
                onChange={handleInvoiceDataChange}
                required
              />
            </div>
            <div className="mb-3">
              <input
                type="date"
                className="form-control"
                name="dueDate"
                value={invoiceData.dueDate}
                onChange={handleInvoiceDataChange}
                required
              />
            </div>
            <Button type="submit" variant="primary">
              Add
            </Button>
          </form>
        </Modal.Body>
      </Modal>
    </div>
  );
};

export default Invoices;
