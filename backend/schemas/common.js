const { z } = require('zod');
const { startOfDay, toDateKey } = require('../utils/dates');

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');

// Optional free text. HTML forms submit "" for empty fields, which we keep as "".
const optionalText = (max) => z.string().trim().max(max).optional();

/**
 * Calendar date. Accepts "YYYY-MM-DD" or a full ISO string, rejects impossible
 * dates like 2025-02-31 and normalises to midnight UTC.
 */
const calendarDate = z
  .string()
  .trim()
  .refine((value) => /^\d{4}-\d{2}-\d{2}/.test(value), 'Use the format YYYY-MM-DD')
  .transform((value) => value.slice(0, 10))
  .refine((key) => toDateKey(startOfDay(key)) === key, 'Not a real calendar date')
  .refine((key) => key >= '1970-01-01' && key <= '2100-12-31', 'Date is out of range')
  .transform((key) => startOfDay(key));

// "" and null both mean "no value".
const emptyToNull = (schema) => z.preprocess((value) => (value === '' ? null : value), schema);

const page = z.coerce.number().int().min(1).default(1);
const limit = (max = 100, fallback = 50) => z.coerce.number().int().min(1).max(max).default(fallback);
const order = z.enum(['asc', 'desc']).default('asc');
const booleanString = z.enum(['true', 'false']);

// Query strings sent by forms contain "" for "no filter". Treat that as absent.
const blankToUndefined = (value) => (value === '' || value === null ? undefined : value);
const queryField = (schema) => z.preprocess(blankToUndefined, schema.optional());

module.exports = {
  z,
  objectId,
  optionalText,
  calendarDate,
  emptyToNull,
  page,
  limit,
  order,
  booleanString,
  queryField,
};
