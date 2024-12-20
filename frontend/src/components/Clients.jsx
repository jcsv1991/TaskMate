import React, { useEffect, useState } from 'react';
import API from '../services/api';
import { Spinner, Alert } from 'react-bootstrap';

const Clients = () => {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({ name:'', email:'', phone:'' });
  const [adding, setAdding] = useState(false);

  const fetchClients = async () => {
    setLoading(true);
    try {
      const res = await API.get('/clients');
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
  }, []);

  const handleChange = (e) => {
    setFormData({...formData, [e.target.name]: e.target.value});
  }

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
  }

  return (
    <div className="container mt-4">
      <h2>Your Clients</h2>
      {error && <Alert variant="danger">{error}</Alert>}
      {loading ? <Spinner animation="border" /> : (
        <ul className="list-group mt-3">
          {clients.map((client) => (
            <li className="list-group-item" key={client._id}>{client.name} - {client.email} - {client.phone}</li>
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
    </div>
  );
};

export default Clients;
