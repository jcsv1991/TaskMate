const { z, objectId, optionalText, calendarDate, emptyToNull, page, limit, order, queryField, booleanString } = require('./common');
const { PRIORITIES } = require('../models/Task');

const nullableClient = emptyToNull(objectId.nullable().optional());
const nullableDate = emptyToNull(calendarDate.nullable().optional());

const create = z.object({
  title: z.string().trim().min(1, 'Title is required').max(120),
  description: optionalText(2000),
  dueDate: nullableDate,
  priority: z.enum(PRIORITIES).optional(),
  clientId: nullableClient,
});

const update = z
  .object({
    title: z.string().trim().min(1, 'Title cannot be empty').max(120),
    description: optionalText(2000),
    dueDate: nullableDate,
    priority: z.enum(PRIORITIES),
    completed: z.boolean(),
    clientId: nullableClient,
  })
  .partial()
  .refine((body) => Object.keys(body).length > 0, 'Nothing to update');

const list = z.object({
  completed: queryField(booleanString),
  overdue: queryField(booleanString),
  priority: queryField(z.enum(PRIORITIES)),
  clientId: queryField(objectId),
  clientName: queryField(z.string().trim().max(100)),
  search: queryField(z.string().trim().max(100)),
  dueBefore: queryField(calendarDate),
  dueAfter: queryField(calendarDate),
  sortBy: queryField(z.enum(['dueDate', 'title', 'createdAt'])),
  order,
  page,
  limit: limit(100, 50),
});

module.exports = { create, update, list };
