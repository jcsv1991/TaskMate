/** A readable message for any failed request. */
export function getErrorMessage(err, fallback = 'Something went wrong. Please try again.') {
  if (!err) return fallback;
  if (err.code === 'ECONNABORTED' || err.code === 'ERR_CANCELED') {
    return 'The server took too long to respond. If it was asleep it should be awake now, so try again.';
  }
  if (err.response) {
    const { status, data } = err.response;
    if (data && typeof data.msg === 'string') return data.msg;
    if (status === 429) return 'Too many requests. Please wait a moment and try again.';
    if (status >= 500) return 'The server had a problem. Please try again in a moment.';
    return fallback;
  }
  if (err.request) return "Can't reach the server. Check your connection and try again.";
  return err.message || fallback;
}

/** Map the API's validation errors ([{ path, message }]) onto form fields. */
export function getFieldErrors(err) {
  const list = err && err.response && err.response.data && err.response.data.errors;
  if (!Array.isArray(list)) return {};
  return list.reduce((acc, { path, message }) => {
    if (path && !acc[path]) acc[path] = message;
    return acc;
  }, {});
}
