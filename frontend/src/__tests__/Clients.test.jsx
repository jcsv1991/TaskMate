// frontend/src/__tests__/Clients.test.jsx
import React from 'react';
import { render, screen } from '@testing-library/react';
import Clients from '../components/Clients';
import '@testing-library/jest-dom';

// Mock the API responses
jest.mock('../services/api', () => ({
  get: jest.fn().mockResolvedValue({
    data: [{ _id: '1', name: 'Test Client', email: 'c@example.com', phone: '1234' }]
  }),
  post: jest.fn().mockResolvedValue({ data: { msg: 'Client added successfully' } })
}));

test('renders clients and shows a client', async () => {
  render(<Clients />);
  // Using a regex matcher to handle spacing/line breaks
  // and make the text search more flexible
  expect(await screen.findByText(/Test Client/i)).toBeInTheDocument();
});
