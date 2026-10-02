const { z, objectId, optionalText, calendarDate, page, limit, order, queryField } = require('./common');
const { STATUSES } = require('../models/Invoice');

// Money is stored as a number rounded to cents.
const amount = z
  .number({ invalid_type_error: 'Amount must be a number', required_error: 'Amount is required' })
  .positive('Amount must be greater than 0')
  .max(1_000_000_000, 'Amount is too large')
  .transform((value) => Math.round(value * 100) / 100);

const create = z.object({
  clientId: objectId,
  amount,
  dueDate: calendarDate,
  description: optionalText(500),
});

const update = z
  .object({
    clientId: objectId,
    amount,
    dueDate: calendarDate,
    description: optionalText(500),
    status: z.enum(STATUSES),
  })
  .partial()
  .refine((body) => Object.keys(body).length > 0, 'Nothing to update');

const list = z.object({
  status: queryField(z.enum(STATUSES)),
  clientId: queryField(objectId),
  clientName: queryField(z.string().trim().max(100)),
  search: queryField(z.string().trim().max(100)),
  sortBy: queryField(z.enum(['dueDate', 'amount', 'createdAt'])),
  order,
  page,
  limit: limit(100, 50),
});

module.exports = { create, update, list };
