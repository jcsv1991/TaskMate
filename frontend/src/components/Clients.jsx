import React, { useEffect, useState } from 'react';
import API from '../services/api';
import { Spinner, Alert, Modal, Button } from 'react-bootstrap';

// Changes:
// - Added a search bar for clients
// - Added a modal to view client details (contact, tasks, invoices)
// - Added functionality within modal to toggle tasks and update invoices

const Clients = () => {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({ name:'', email:'', phone:'' });
  const [adding, setAdding] = useState(false);
  const [search, setSearch] = useState('');

  const [showModal, setShowModal] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);
  const [clientTasks, setClientTasks] = useState([]);
  const [clientInvoices, setClientInvoices] = useState([]);

  const [editingInvoice, setEditingInvoice] = useState({});

  const fetchClients = async () => {
    setLoading(true);
    try {
      const res = await API.get('/clients', { params: { search } });
      setClients(res.data);
      setError('');
    } catch (err) {
      setError('Error fetching clients');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();
  }, [search]);

  const handleChange = (e) => {
    setFormData({...formData, [e.target.name]: e.target.value});
  };

  const handleAddClient = async (e) => {
    e.preventDefault();
    setAdding(true);
    setError('');
    try {
      await API.post('/clients', formData);
      await fetchClients();
      setFormData({ name:'', email:'', phone:'' });
    } catch (err) {
      setError('Failed to add client. Check all fields.');
    } finally {
      setAdding(false);
    }
  };

  const openClientDetails = async (clientId) => {
    try {
      const res = await API.get(`/clients/${clientId}/details`);
      setSelectedClient(res.data.client);
      setClientTasks(res.data.tasks);
      setClientInvoices(res.data.invoices);
      setShowModal(true);
    } catch (err) {
      setError('Failed to load client details');
    }
  };

  const toggleTask = async (taskId) => {
    try {
      await API.put(`/tasks/${taskId}/toggle`);
      const updatedTasks = await API.get(`/clients/${selectedClient._id}/details`);
      setClientTasks(updatedTasks.data.tasks);
    } catch (err) {
      setError('Failed to toggle task');
    }
  };

  const handleInvoiceFieldChange = (id, field, value) => {
    setEditingInvoice((prev) => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  };

  const saveInvoiceChanges = async (invoice) => {
    try {
      const { amount, dueDate, status } = editingInvoice[invoice._id] || {};
      await API.put(`/invoices/${invoice._id}`, {
        amount: amount !== undefined ? amount : invoice.amount,
        dueDate: dueDate !== undefined ? dueDate : invoice.dueDate,
        status: status !== undefined ? status : invoice.status
      });
      const updatedDetails = await API.get(`/clients/${selectedClient._id}/details`);
      setClientInvoices(updatedDetails.data.invoices);
      setEditingInvoice((prev) => {
        const updated = { ...prev };
        delete updated[invoice._id];
        return updated;
      });
    } catch (err) {
      setError('Failed to update invoice');
    }
  };

  return (
    <div className="container mt-4">
      <h2>Clients</h2>
      {error && <Alert variant="danger">{error}</Alert>}

      <input 
        type="text" 
        className="form-control my-3" 
        placeholder="Search clients by name" 
        value={search} 
        onChange={(e) => setSearch(e.target.value)} 
      />

      {loading ? <Spinner animation="border" /> : (
        <ul className="list-group mt-3">
          {clients.map((client) => (
            <li 
              className="list-group-item d-flex justify-content-between align-items-center" 
              key={client._id}
              style={{cursor:'pointer'}}
              onClick={() => openClientDetails(client._id)}
            >
              <div>{client.name} - {client.email} - {client.phone}</div>
            </li>
          ))}
        </ul>
      )}

      <hr/>
      <h3>Add a New Client</h3>
      <form onSubmit={handleAddClient} className="mb-4">
        <input className="form-control my-2" name="name" placeholder="Client Name" value={formData.name} onChange={handleChange} required />
        <input className="form-control my-2" type="email" name="email" placeholder="Email" value={formData.email} onChange={handleChange} required />
        <input className="form-control my-2" name="phone" placeholder="Phone Number" value={formData.phone} onChange={handleChange} required />
        <button type="submit" className="btn btn-primary" disabled={adding}>Add Client</button>
      </form>

      {/* Modal for Client Details */}
      <Modal show={showModal} onHide={() => setShowModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Client Details</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedClient && (
            <>
              <h4>Contact Information</h4>
              <p>Name: {selectedClient.name}</p>
              <p>Email: {selectedClient.email}</p>
              <p>Phone: {selectedClient.phone}</p>

              <h4 className="mt-4">Tasks</h4>
              {clientTasks.length === 0 && <p>No tasks found.</p>}
              <ul className="list-group">
                {clientTasks.map(t => (
                  <li className="list-group-item d-flex justify-content-between align-items-center" key={t._id}>
                    <div>
                      <strong>{t.title}</strong> - {t.completed ? "Completed" : "Pending"}
                      <br />
                      <small>{t.description}</small><br />
                      <small>Due: {t.dueDate ? new Date(t.dueDate).toLocaleDateString() : 'N/A'}</small>
                    </div>
                    <Button variant={t.completed ? "warning" : "success"} size="sm" onClick={() => toggleTask(t._id)}>
                      {t.completed ? "Mark Pending" : "Mark Complete"}
                    </Button>
                  </li>
                ))}
              </ul>

              <h4 className="mt-4">Invoices</h4>
              {clientInvoices.length === 0 && <p>No invoices found.</p>}
              <table className="table">
                <thead>
                  <tr>
                    <th>Amount</th>
                    <th>Due Date</th>
                    <th>Status</th>
                    <th>Edit</th>
                  </tr>
                </thead>
                <tbody>
                  {clientInvoices.map(inv => {
                    const editData = editingInvoice[inv._id] || {};
                    return (
                      <tr key={inv._id}>
                        <td>
                          <input 
                            type="number" 
                            className="form-control" 
                            defaultValue={inv.amount} 
                            onChange={(e) => handleInvoiceFieldChange(inv._id, 'amount', e.target.value)} 
                          />
                        </td>
                        <td>
                          <input 
                            type="date" 
                            className="form-control" 
                            defaultValue={new Date(inv.dueDate).toISOString().split('T')[0]} 
                            onChange={(e) => handleInvoiceFieldChange(inv._id, 'dueDate', e.target.value)}
                          />
                        </td>
                        <td>
                          <select 
                            className="form-select"
                            defaultValue={inv.status}
                            onChange={(e) => handleInvoiceFieldChange(inv._id, 'status', e.target.value)}
                          >
                            <option value="unpaid">Unpaid</option>
                            <option value="paid">Paid</option>
                            <option value="overdue">Overdue</option>
                          </select>
                        </td>
                        <td>
                          <Button variant="primary" size="sm" onClick={() => saveInvoiceChanges(inv)}>Save</Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowModal(false)}>Close</Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default Clients;
