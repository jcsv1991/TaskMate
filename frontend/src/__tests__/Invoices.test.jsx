import React from 'react';
import { render, screen } from '@testing-library/react';
import Invoices from '../components/Invoices';
import '@testing-library/jest-dom';

jest.mock('../services/api', () => ({
  get: jest.fn().mockResolvedValue({ data: [{ _id:'i1', amount:500, status:'unpaid', clientId:{ name:'Invoice Client' }, dueDate:'2025-03-01T00:00:00.000Z' }] }),
  put: jest.fn().mockResolvedValue({ data: { status:'paid' } })
}));

test('renders invoices and shows an invoice', async () => {
  render(<Invoices />);
  expect(await screen.findByText('Invoice Client')).toBeInTheDocument();
  expect(await screen.findByText('$500')).toBeInTheDocument();
});
