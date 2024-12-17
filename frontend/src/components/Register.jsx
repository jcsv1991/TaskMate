import React, { useState } from 'react';
import API from '../services/api';

const Register = () => {
  const [formData, setFormData] = useState({ email: '', password: '' });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await API.post('/auth/signup', formData);
      alert('Registration successful! Please login.');
    } catch (error) {
      console.error('Registration failed:', error.response?.data?.msg);
      alert('Failed to register');
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        className="form-control my-2"
        type="email"
        name="email"
        placeholder="Email"
        onChange={handleChange}
        required
      />
      <input
        className="form-control my-2"
        type="password"
        name="password"
        placeholder="Password"
        onChange={handleChange}
        required
      />
      <button type="submit" className="btn btn-success">Register</button>
    </form>
  );
};

export default Register;
