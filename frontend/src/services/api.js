import axios from 'axios';

const API = axios.create({
  baseURL: 'http://localhost:5000/api', // Update with your backend URL
});

// Attach Authorization header if a token exists
API.interceptors.request.use((req) => {
  const token = localStorage.getItem('taskmate_token');
  if (token) req.headers['x-auth-token'] = token;
  return req;
});

export default API;
