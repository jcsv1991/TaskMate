const { z, optionalText, page, limit, order, queryField } = require('./common');

const email = z.string().trim().toLowerCase().email('Enter a valid email address').max(254);

const create = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100),
  email,
  phone: optionalText(40),
  company: optionalText(100),
  notes: optionalText(2000),
});

// Partial update: only the fields that are present are changed.
const update = create.partial().refine((body) => Object.keys(body).length > 0, 'Nothing to update');

const list = z.object({
  search: queryField(z.string().trim().max(100)),
  sortBy: queryField(z.enum(['name', 'createdAt'])),
  order,
  page,
  limit: limit(100, 50),
});

const remove = z.object({
  // Also delete the client's invoices (tasks are always just unlinked).
  cascade: queryField(z.enum(['true', 'false'])),
});

module.exports = { create, update, list, remove };
