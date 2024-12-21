// InvoiceDetail.jsx
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import API from '../services/api';
import { Alert } from 'react-bootstrap';

const InvoiceDetail = () => {
  const { id } = useParams();
  const [invoice, setInvoice] = useState(null);
  const [error, setError] = useState('');

  const fetchInvoice = async () => {
    try {
      const res = await API.get(`/invoices`);
      const inv = res.data.find(i => i._id === id);
      if (!inv) {
        setError('Invoice not found');
      } else {
        setInvoice(inv);
      }
    } catch (err) {
      setError('Failed to load invoice details');
    }
  };

  useEffect(() => {
    fetchInvoice();
  }, [id]);

  if (error) return <div className="container mt-5"><Alert variant="danger">{error}</Alert></div>;
  if (!invoice) return <div className="container mt-5">Loading...</div>;

  return (
    <div className="container mt-5">
      <h2>Invoice Details</h2>
      <p><strong>Client:</strong> {invoice.clientId?.name}</p>
      <p><strong>Amount:</strong> ${invoice.amount}</p>
      <p><strong>Due Date:</strong> {new Date(invoice.dueDate).toLocaleDateString()}</p>
      <p><strong>Status:</strong> {invoice.status}</p>
    </div>
  );
};

export default InvoiceDetail;
