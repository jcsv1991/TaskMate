import API from './api';

const data = (res) => res.data;

/** List endpoints return a plain array; paging info arrives in headers. */
const list = (res) => {
  const h = res.headers || {};
  return {
    items: res.data,
    total: Number(h['x-total-count'] ?? res.data.length),
    page: Number(h['x-page'] ?? 1),
    perPage: Number(h['x-per-page'] ?? res.data.length),
    totalPages: Number(h['x-total-pages'] ?? 1),
    totalAmount: h['x-total-amount'] !== undefined ? Number(h['x-total-amount']) : undefined,
  };
};

export const auth = {
  login: (body) => API.post('/auth/login', body).then(data),
  signup: (body) => API.post('/auth/signup', body).then(data),
  demo: () => API.post('/auth/demo').then(data),
  me: () => API.get('/auth/me').then(data),
  updateProfile: (body) => API.patch('/auth/me', body).then(data),
  deleteAccount: () => API.delete('/auth/me').then(data),
};

export const dashboard = {
  summary: () => API.get('/dashboard/summary').then(data),
};

export const tasks = {
  list: (params) => API.get('/tasks', { params }).then(list),
  get: (id) => API.get(`/tasks/${id}`).then(data),
  create: (body) => API.post('/tasks', body).then(data),
  update: (id, body) => API.patch(`/tasks/${id}`, body).then(data),
  remove: (id) => API.delete(`/tasks/${id}`).then(data),
};

export const clients = {
  list: (params) => API.get('/clients', { params }).then(list),
  get: (id) => API.get(`/clients/${id}`).then(data),
  create: (body) => API.post('/clients', body).then((r) => r.data.client),
  update: (id, body) => API.patch(`/clients/${id}`, body).then((r) => r.data.client),
  remove: (id, { cascade = false } = {}) => API.delete(`/clients/${id}`, { params: cascade ? { cascade: 'true' } : {} }).then(data),
};

export const invoices = {
  list: (params) => API.get('/invoices', { params }).then(list),
  get: (id) => API.get(`/invoices/${id}`).then(data),
  create: (body) => API.post('/invoices', body).then(data),
  update: (id, body) => API.patch(`/invoices/${id}`, body).then(data),
  remove: (id) => API.delete(`/invoices/${id}`).then(data),
};

export const health = () => API.get('/health', { timeout: 8000 }).then(data);

/** Download a CSV export (needs the auth header, so a plain link will not do). */
export async function downloadCsv(resource) {
  const res = await API.get(`/export/${resource}.csv`, { responseType: 'blob' });
  const disposition = res.headers['content-disposition'] || '';
  const match = /filename="?([^";]+)"?/.exec(disposition);
  const filename = match ? match[1] : `taskmate-${resource}.csv`;
  const url = URL.createObjectURL(res.data);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return filename;
}
