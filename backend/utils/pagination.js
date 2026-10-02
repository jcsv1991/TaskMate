/**
 * Pagination metadata travels in response headers so list endpoints can keep
 * returning plain JSON arrays (backwards compatible with existing clients).
 */
function setPaginationHeaders(res, { total, page, limit }) {
  res.set({
    'X-Total-Count': String(total),
    'X-Page': String(page),
    'X-Per-Page': String(limit),
    'X-Total-Pages': String(Math.max(1, Math.ceil(total / limit))),
  });
}

module.exports = { setPaginationHeaders };
