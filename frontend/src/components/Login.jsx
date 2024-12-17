import React, { useState } from 'react';
import API from '../services/api';

const Login = () => {
  const [formData, setFormData] = useState({ email: '', password: '' });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await API.post('/auth/login', formData);
      localStorage.setItem('taskmate_token', res.data.token);
      alert('Login successful!');
      window.location.href = '/'; // Redirect to Dashboard
    } catch (error) {
      console.error('Login failed:', error.response?.data?.msg);
      alert('Invalid credentials');
    }
  };

  return (
    <div className="container mt-5">
      <h2>Login to TaskMate</h2>
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
        <button type="submit" className="btn btn-primary">Login</button>
      </form>
    </div>
  );
};

export default Login;
