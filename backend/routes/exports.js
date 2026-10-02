const express = require('express');
const Task = require('../models/Task');
const Client = require('../models/Client');
const Invoice = require('../models/Invoice');
const asyncHandler = require('../utils/asyncHandler');
const { notFound } = require('../utils/httpError');
const { resolveToday, toDateKey } = require('../utils/dates');
const { toCsv } = require('../utils/csv');
const makeAuth = require('../middleware/auth');

const LIMIT = 10000;
const day = (d) => (d ? toDateKey(d) : '');

module.exports = (config) => {
  const router = express.Router();
  router.use(makeAuth(config));

  const exporters = {
    invoices: async (userId, todayKey) => {
      const rows = await Invoice.find({ userId }).populate({ path: 'clientId', select: 'name' }).sort({ createdAt: 1 }).limit(LIMIT).lean();
      return toCsv(
        [
          { header: 'Number', value: (r) => r.number },
          { header: 'Client', value: (r) => r.clientId && r.clientId.name },
          { header: 'Description', value: (r) => r.description },
          { header: 'Amount', value: (r) => r.amount.toFixed(2) },
          { header: 'Due date', value: (r) => day(r.dueDate) },
          { header: 'Status', value: (r) => Invoice.effectiveStatus(r, todayKey) },
          { header: 'Paid on', value: (r) => day(r.paidAt) },
        ],
        rows
      );
    },
    tasks: async (userId) => {
      const rows = await Task.find({ userId }).populate({ path: 'clientId', select: 'name' }).sort({ createdAt: 1 }).limit(LIMIT).lean();
      return toCsv(
        [
          { header: 'Title', value: (r) => r.title },
          { header: 'Description', value: (r) => r.description },
          { header: 'Client', value: (r) => r.clientId && r.clientId.name },
          { header: 'Priority', value: (r) => r.priority },
          { header: 'Due date', value: (r) => day(r.dueDate) },
          { header: 'Status', value: (r) => (r.completed ? 'completed' : 'open') },
          { header: 'Completed on', value: (r) => day(r.completedAt) },
        ],
        rows
      );
    },
    clients: async (userId) => {
      const rows = await Client.find({ userId }).sort({ name: 1 }).limit(LIMIT).lean();
      return toCsv(
        [
          { header: 'Name', value: (r) => r.name },
          { header: 'Company', value: (r) => r.company },
          { header: 'Email', value: (r) => r.email },
          { header: 'Phone', value: (r) => r.phone },
          { header: 'Notes', value: (r) => r.notes },
        ],
        rows
      );
    },
  };

  // GET /api/export/invoices.csv | tasks.csv | clients.csv
  router.get(
    '/:resource',
    asyncHandler(async (req, res) => {
      const name = req.params.resource.replace(/\.csv$/i, '');
      if (!Object.prototype.hasOwnProperty.call(exporters, name)) throw notFound('Unknown export');
      const todayKey = resolveToday(req);
      const csv = await exporters[name](req.user, todayKey);
      res.set({
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="taskmate-${name}-${todayKey}.csv"`,
        'Cache-Control': 'no-store',
      });
      res.send(csv);
    })
  );

  return router;
};
