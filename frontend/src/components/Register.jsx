import React, { useState } from 'react';
import API from '../services/api';
import { Alert } from 'react-bootstrap';

const Register = () => {
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [error,setError] = useState('');
  const [success,setSuccess] = useState('');

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError('');
    setSuccess('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if(formData.password.length<6){
      setError('Password should be at least 6 characters.');
      return;
    }
    try {
      await API.post('/auth/signup', formData);
      setSuccess('Registration successful! Please login.');
    } catch (err) {
      setError(err.response?.data?.msg || 'Failed to register');
    }
  };

  return (
    <div className="mt-3">
      {error && <Alert variant="danger">{error}</Alert>}
      {success && <Alert variant="success">{success}</Alert>}
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
          placeholder="Password (min 6 chars)"
          onChange={handleChange}
          value={formData.password}
          required
        />
        <button type="submit" className="btn btn-success">Register</button>
      </form>
    </div>
  );
};

export default Register;
