import React, { useEffect, useState } from 'react';
import API from '../services/api';

const Clients = () => {
  const [clients, setClients] = useState([]);

  useEffect(() => {
    const fetchClients = async () => {
      try {
        const res = await API.get('/clients');
        setClients(res.data);
      } catch (err) {
        console.error('Error fetching clients:', err);
      }
    };

    fetchClients();
  }, []);

  return (
    <div className="container mt-4">
      <h2>Your Clients</h2>
      <ul>
        {clients.map((client) => (
          <li key={client._id}>{client.name} - {client.email}</li>
        ))}
      </ul>
    </div>
  );
};

export default Clients;
