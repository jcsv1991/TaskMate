// src/components/Clients.jsx
import React, { useEffect, useState } from 'react';
import API from '../services/api';
import { Spinner, Alert } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';

const Clients = () => {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', phone: '' });
  const [search, setSearch] = useState('');
  const [autocompleteSuggestions, setAutocompleteSuggestions] = useState([]);

  const navigate = useNavigate();

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

  useEffect(() => {
    const filtered = clients.filter((c) =>
      c.name.toLowerCase().includes(search.toLowerCase())
    );
    setAutocompleteSuggestions(filtered.slice(0, 5));
  }, [search, clients]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleAddClient = async (e) => {
    e.preventDefault();
    setAdding(true);
    setError('');
    try {
      await API.post('/clients', formData);
      await fetchClients();
      setFormData({ name: '', email: '', phone: '' });
    } catch (err) {
      setError('Failed to add client. Check all fields.');
    } finally {
      setAdding(false);
    }
  };

  const handleClientClick = (id) => {
    navigate(`/client/${id}`);
  };

  const handleSuggestionClick = (id, name) => {
    setSearch(name);
    setAutocompleteSuggestions([]);
    navigate(`/client/${id}`);
  };

  return (
    <div className="container mt-4" style={{ paddingTop: '60px' }}>
      <h2>Clients</h2>
      {error && <Alert variant="danger">{error}</Alert>}

      <div className="position-relative mb-3">
        <input
          type="text"
          className="form-control"
          placeholder="Search clients by name"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {search && autocompleteSuggestions.length > 0 && (
          <ul
            className="list-group position-absolute"
            style={{ zIndex: 10, width: '100%' }}
          >
            {autocompleteSuggestions.map((s) => (
              <li
                key={s._id}
                className="list-group-item"
                style={{ cursor: 'pointer' }}
                onMouseDown={() => handleSuggestionClick(s._id, s.name)}
              >
                {s.name}
              </li>
            ))}
          </ul>
        )}
      </div>

      {loading ? (
        <Spinner animation="border" />
      ) : (
        <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
          <ul className="list-group mt-3">
            {clients.map((client) => (
              <li
                className="list-group-item"
                key={client._id}
                style={{ cursor: 'pointer' }}
                onClick={() => handleClientClick(client._id)}
              >
                {client.name}
              </li>
            ))}
          </ul>
        </div>
      )}

      <hr />
      <h3>Add a New Client</h3>
      <form onSubmit={handleAddClient} className="mb-4">
        <input
          className="form-control my-2"
          name="name"
          placeholder="Client Name"
          value={formData.name}
          onChange={handleChange}
          required
        />
        <input
          className="form-control my-2"
          type="email"
          name="email"
          placeholder="Email"
          value={formData.email}
          onChange={handleChange}
          required
        />
        <input
          className="form-control my-2"
          name="phone"
          placeholder="Phone Number"
          value={formData.phone}
          onChange={handleChange}
          required
        />
        <button type="submit" className="btn btn-primary" disabled={adding}>
          Add Client
        </button>
      </form>
    </div>
  );
};

export default Clients;
