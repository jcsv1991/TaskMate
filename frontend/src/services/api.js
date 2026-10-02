import axios from 'axios';
import { API_URL, TOKEN_KEY } from '../config';
import { storage } from '../utils/storage';
import { localDateKey } from '../utils/format';

const API = axios.create({ baseURL: API_URL, timeout: 45000 });

let onUnauthorized = null;
/** Registered by AuthProvider so an expired session logs the user out everywhere. */
export const setUnauthorizedHandler = (fn) => {
  onUnauthorized = fn;
};

API.interceptors.request.use((req) => {
  const token = storage.get(TOKEN_KEY);
  if (token) req.headers.Authorization = `Bearer ${token}`;
  // Tell the server the user's own calendar date, so "overdue" matches their day.
  req.headers['X-Client-Today'] = localDateKey();
  return req;
});

API.interceptors.response.use(
  (res) => res,
  (err) => {
    const url = (err.config && err.config.url) || '';
    const isCredentialCall = /\/auth\/(login|signup|demo)/.test(url);
    // A 401 anywhere else means the session is gone (expired token, deleted account).
    if (err.response && err.response.status === 401 && !isCredentialCall && storage.get(TOKEN_KEY) && onUnauthorized) {
      onUnauthorized(err);
    }
    return Promise.reject(err);
  }
);

export default API;
