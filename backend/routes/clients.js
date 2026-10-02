const express = require('express');
const Client = require('../models/Client');
const Task = require('../models/Task');
const Invoice = require('../models/Invoice');
const asyncHandler = require('../utils/asyncHandler');
const escapeRegex = require('../utils/escapeRegex');
const { notFound, conflict } = require('../utils/httpError');
const { resolveToday } = require('../utils/dates');
const { setPaginationHeaders } = require('../utils/pagination');
const { clientJSON, taskJSON, invoiceJSON } = require('../utils/serializers');
const validate = require('../middleware/validate');
const makeAuth = require('../middleware/auth');
const schemas = require('../schemas/clients');

const round2 = (n) => Math.round(n * 100) / 100;

// Per-client numbers shown on the Clients page and the client detail page.
function summarise(tasks, invoices, todayKey) {
  const stats = { openTasks: 0, invoiceCount: invoices.length, outstandingAmount: 0, overdueAmount: 0, paidAmount: 0 };
  for (const t of tasks) if (!t.completed) stats.openTasks += 1;
  for (const inv of invoices) {
    const status = Invoice.effectiveStatus(inv, todayKey);
    if (status === 'paid') stats.paidAmount += inv.amount;
    else {
      stats.outstandingAmount += inv.amount;
      if (status === 'overdue') stats.overdueAmount += inv.amount;
    }
  }
  stats.outstandingAmount = round2(stats.outstandingAmount);
  stats.overdueAmount = round2(stats.overdueAmount);
  stats.paidAmount = round2(stats.paidAmount);
  return stats;
}

module.exports = (config) => {
  const router = express.Router();
  router.use(makeAuth(config));

  const findOwned = async (req) => {
    const client = await Client.findOne({ _id: req.params.id, userId: req.user }).lean();
    if (!client) throw notFound('Client not found');
    return client;
  };

  // GET /api/clients?search=&sortBy=&order=&page=&limit=
  router.get(
    '/',
    validate(schemas.list, 'query'),
    asyncHandler(async (req, res) => {
      const { search, sortBy, order, page, limit } = req.valid.query;
      const todayKey = resolveToday(req);
      const filter = { userId: req.user };
      if (search) {
        const rx = new RegExp(escapeRegex(search), 'i');
        filter.$or = [{ name: rx }, { email: rx }, { company: rx }];
      }
      const sort = sortBy === 'createdAt' ? { createdAt: order === 'desc' ? -1 : 1, _id: 1 } : { name: order === 'desc' ? -1 : 1, _id: 1 };

      const [clients, total] = await Promise.all([
        Client.find(filter)
          .sort(sort)
          .skip((page - 1) * limit)
          .limit(limit)
          .lean(),
        Client.countDocuments(filter),
      ]);

      const ids = clients.map((c) => c._id);
      const [tasks, invoices] = ids.length
        ? await Promise.all([
            Task.find({ userId: req.user, clientId: { $in: ids } }).select('clientId completed').lean(),
            Invoice.find({ userId: req.user, clientId: { $in: ids } }).select('clientId amount status dueDate').lean(),
          ])
        : [[], []];

      const result = clients.map((c) => {
        const mine = (x) => String(x.clientId) === String(c._id);
        return { ...clientJSON(c), stats: summarise(tasks.filter(mine), invoices.filter(mine), todayKey) };
      });

      setPaginationHeaders(res, { total, page, limit });
      res.json(result);
    })
  );

  // GET /api/clients/:id  => { client, tasks, invoices, stats }
  router.get(
    '/:id',
    asyncHandler(async (req, res) => {
      const todayKey = resolveToday(req);
      const client = await findOwned(req);
      const [tasks, invoices] = await Promise.all([
        Task.find({ userId: req.user, clientId: client._id }).sort({ completed: 1, dueDate: 1, _id: 1 }).lean(),
        Invoice.find({ userId: req.user, clientId: client._id }).sort({ dueDate: -1, _id: 1 }).lean(),
      ]);
      res.json({
        client: clientJSON(client),
        tasks: tasks.map((t) => taskJSON(t, todayKey)),
        invoices: invoices.map((i) => invoiceJSON(i, todayKey)),
        stats: summarise(tasks, invoices, todayKey),
      });
    })
  );

  // POST /api/clients
  router.post(
    '/',
    validate(schemas.create),
    asyncHandler(async (req, res) => {
      const client = await Client.create({ ...req.valid.body, userId: req.user });
      res.status(201).json({ msg: 'Client added successfully', client: clientJSON(client.toObject()) });
    })
  );

  // PUT|PATCH /api/clients/:id  (partial update)
  const update = asyncHandler(async (req, res) => {
    await findOwned(req);
    const client = await Client.findOneAndUpdate(
      { _id: req.params.id, userId: req.user },
      { $set: req.valid.body },
      { new: true, runValidators: true }
    ).lean();
    res.json({ msg: 'Client updated successfully', client: clientJSON(client) });
  });
  router.put('/:id', validate(schemas.update), update);
  router.patch('/:id', validate(schemas.update), update);

  // DELETE /api/clients/:id[?cascade=true]
  // A client with invoices is protected: invoices are financial records, so
  // they are only removed when the caller explicitly asks for a cascade.
  router.delete(
    '/:id',
    validate(schemas.remove, 'query'),
    asyncHandler(async (req, res) => {
      const client = await findOwned(req);
      const invoiceCount = await Invoice.countDocuments({ userId: req.user, clientId: client._id });
      const cascade = req.valid.query.cascade === 'true';

      if (invoiceCount > 0 && !cascade) {
        throw conflict(`This client has ${invoiceCount} invoice${invoiceCount === 1 ? '' : 's'}. Delete them first or confirm deleting everything.`, {
          invoiceCount,
        });
      }

      if (cascade) await Invoice.deleteMany({ userId: req.user, clientId: client._id });
      // Tasks outlive the client: they are unlinked rather than deleted.
      await Task.updateMany({ userId: req.user, clientId: client._id }, { $set: { clientId: null } });
      await Client.deleteOne({ _id: client._id, userId: req.user });

      res.json({ msg: 'Client deleted successfully' });
    })
  );

  return router;
};
