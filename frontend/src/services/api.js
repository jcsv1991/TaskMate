import axios from 'axios';

const API = axios.create({
  baseURL: 'https://taskmate-2njo.onrender.com/api', //  backend URL
});

// Attach Authorization header if a token exists
API.interceptors.request.use((req) => {
  const token = localStorage.getItem('taskmate_token');
  if (token) req.headers['x-auth-token'] = token;
  return req;
});

export default API;
