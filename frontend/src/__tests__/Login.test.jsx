import React from 'react';
import { render, screen } from '@testing-library/react';
import Login from '../components/Login';
import '@testing-library/jest-dom';

test('renders login form and checks inputs', () => {
  render(<Login />);
  
  const emailInput = screen.getByPlaceholderText('Email');
  const passwordInput = screen.getByPlaceholderText('Password');
  const loginButton = screen.getByText('Login');
  
  expect(emailInput).toBeInTheDocument();
  expect(passwordInput).toBeInTheDocument();
  expect(loginButton).toBeInTheDocument();
});
