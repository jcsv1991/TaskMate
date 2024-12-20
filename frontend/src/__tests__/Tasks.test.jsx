import React from 'react';
import { render, screen } from '@testing-library/react';
import Tasks from '../components/Tasks';
import '@testing-library/jest-dom';

jest.mock('../services/api', () => ({
  get: jest.fn().mockResolvedValue({ data: [{ _id:'t1', title:'Sample Task', completed:false }] }),
  post: jest.fn().mockResolvedValue({ data: { _id:'t2', title:'New Task', completed:false } })
}));

test('renders tasks and shows a sample task', async () => {
  render(<Tasks />);
  expect(await screen.findByText('Sample Task')).toBeInTheDocument();
});
