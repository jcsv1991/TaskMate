// Where the API lives.
//  - development: "/api", proxied to http://localhost:5000 by the Vite dev server
//  - production:  VITE_API_URL if set at build time, otherwise the original hosted API
export const API_URL =
  import.meta.env.VITE_API_URL || (import.meta.env.DEV ? '/api' : 'https://taskmate-2njo.onrender.com/api');

// ISO 4217 code used when formatting money. Invoices are stored as plain numbers.
export const CURRENCY = import.meta.env.VITE_CURRENCY || 'USD';

// Same key the original app used, so people who were signed in stay signed in.
export const TOKEN_KEY = 'taskmate_token';
export const THEME_KEY = 'taskmate_theme';
