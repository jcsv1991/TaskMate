import React, { useState } from 'react';
import API from '../services/api';
import { Alert } from 'react-bootstrap';

const Login = () => {
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [error,setError] = useState('');

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await API.post('/auth/login', formData);
      localStorage.setItem('taskmate_token', res.data.token);
      window.location.href = '/'; // Redirect to Dashboard
    } catch (err) {
      setError(err.response?.data?.msg || 'Login failed');
    }
  };

  return (
    <div className="mt-3">
      {error && <Alert variant="danger">{error}</Alert>}
      <form onSubmit={handleSubmit}>
        <input
          className="form-control my-2"
          type="email"
          name="email"
          placeholder="Email"
          onChange={handleChange}
          value={formData.email}
          required
        />
        <input
          className="form-control my-2"
          type="password"
          name="password"
          placeholder="Password"
          onChange={handleChange}
          value={formData.password}
          required
        />
        <button type="submit" className="btn btn-primary">Login</button>
      </form>
    </div>
  );
};

export default Login;
