import React, { useEffect, useState } from 'react';
import API from '../services/api';

const Invoices = () => {
  const [invoices, setInvoices] = useState([]);

  useEffect(() => {
    const fetchInvoices = async () => {
      try {
        const res = await API.get('/invoices');
        setInvoices(res.data);
      } catch (err) {
        console.error('Error fetching invoices:', err);
      }
    };

    fetchInvoices();
  }, []);

  return (
    <div className="container mt-4">
      <h2>Your Invoices</h2>
      <ul>
        {invoices.map((invoice) => (
          <li key={invoice._id}>
            Client: {invoice.clientId?.name || 'Unknown'} - Amount: ${invoice.amount}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default Invoices;
