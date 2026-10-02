const express = require('express');
const Invoice = require('../models/Invoice');
const Client = require('../models/Client');
const Counter = require('../models/Counter');
const asyncHandler = require('../utils/asyncHandler');
const escapeRegex = require('../utils/escapeRegex');
const { badRequest, notFound } = require('../utils/httpError');
const { resolveToday, startOfDay } = require('../utils/dates');
const { setPaginationHeaders } = require('../utils/pagination');
const { invoiceJSON } = require('../utils/serializers');
const validate = require('../middleware/validate');
const makeAuth = require('../middleware/auth');
const schemas = require('../schemas/invoices');

const POPULATE = { path: 'clientId', select: 'name email company' };

module.exports = (config) => {
  const router = express.Router();
  router.use(makeAuth(config));

  async function assertOwnClient(userId, clientId) {
    const exists = await Client.exists({ _id: clientId, userId });
    if (!exists) throw badRequest('Client not found');
  }

  const loadOne = async (userId, id, todayKey) => {
    const invoice = await Invoice.findOne({ _id: id, userId }).populate(POPULATE).lean();
    if (!invoice) throw notFound('Invoice not found');
    return invoiceJSON(invoice, todayKey);
  };

  // GET /api/invoices?status=&clientId=&clientName=&search=&sortBy=&order=&page=&limit=
  router.get(
    '/',
    validate(schemas.list, 'query'),
    asyncHandler(async (req, res) => {
      const q = req.valid.query;
      const todayKey = resolveToday(req);
      const today = startOfDay(todayKey);
      const filter = { userId: req.user };

      // Status filters use the *effective* status, so "overdue" includes every
      // unpaid invoice past its due date even if nobody flipped the status.
      if (q.status === 'paid') filter.status = 'paid';
      if (q.status === 'overdue') Object.assign(filter, { status: { $ne: 'paid' }, dueDate: { $lt: today } });
      if (q.status === 'outstanding') filter.status = { $ne: 'paid' };
      if (q.status === 'unpaid') Object.assign(filter, { status: { $ne: 'paid' }, dueDate: { $gte: today } });

      if (q.clientId) filter.clientId = q.clientId;

      const clientTerm = q.clientName || null;
      if (clientTerm) {
        const matched = await Client.find({ userId: req.user, name: new RegExp(escapeRegex(clientTerm), 'i') }, '_id').lean();
        filter.clientId = { $in: matched.map((c) => c._id) };
      }
      if (q.search) {
        const rx = new RegExp(escapeRegex(q.search), 'i');
        const matched = await Client.find({ userId: req.user, name: rx }, '_id').lean();
        filter.$or = [{ number: rx }, { description: rx }, { clientId: { $in: matched.map((c) => c._id) } }];
      }

      const sort = q.sortBy ? { [q.sortBy]: q.order === 'desc' ? -1 : 1, _id: 1 } : { createdAt: -1, _id: 1 };

      const [items, total, amounts] = await Promise.all([
        Invoice.find(filter)
          .populate(POPULATE)
          .sort(sort)
          .skip((q.page - 1) * q.limit)
          .limit(q.limit)
          .lean(),
        Invoice.countDocuments(filter),
        Invoice.find(filter).select('amount').lean(),
      ]);

      const totalAmount = Math.round(amounts.reduce((sum, i) => sum + i.amount, 0) * 100) / 100;
      setPaginationHeaders(res, { total, page: q.page, limit: q.limit });
      res.set('X-Total-Amount', String(totalAmount));
      res.json(items.map((i) => invoiceJSON(i, todayKey)));
    })
  );

  // GET /api/invoices/:id
  router.get(
    '/:id',
    asyncHandler(async (req, res) => {
      res.json(await loadOne(req.user, req.params.id, resolveToday(req)));
    })
  );

  // POST /api/invoices
  router.post(
    '/',
    validate(schemas.create),
    asyncHandler(async (req, res) => {
      const body = req.valid.body;
      await assertOwnClient(req.user, body.clientId);
      const seq = await Counter.next(`invoice:${req.user}`);
      const invoice = await Invoice.create({ ...body, userId: req.user, number: `INV-${String(seq).padStart(4, '0')}` });
      res.status(201).json(await loadOne(req.user, invoice._id, resolveToday(req)));
    })
  );

  // PUT|PATCH /api/invoices/:id  (partial update; paying stamps paidAt)
  const update = asyncHandler(async (req, res) => {
    const body = { ...req.valid.body };
    if (body.clientId) await assertOwnClient(req.user, body.clientId);

    const existing = await Invoice.findOne({ _id: req.params.id, userId: req.user }).select('status paidAt').lean();
    if (!existing) throw notFound('Invoice not found');

    if (body.status === 'paid' && existing.status !== 'paid') body.paidAt = new Date();
    if (body.status && body.status !== 'paid') body.paidAt = null;

    await Invoice.updateOne({ _id: req.params.id, userId: req.user }, { $set: body }, { runValidators: true });
    res.json(await loadOne(req.user, req.params.id, resolveToday(req)));
  });
  router.put('/:id', validate(schemas.update), update);
  router.patch('/:id', validate(schemas.update), update);

  // DELETE /api/invoices/:id
  router.delete(
    '/:id',
    asyncHandler(async (req, res) => {
      const deleted = await Invoice.findOneAndDelete({ _id: req.params.id, userId: req.user });
      if (!deleted) throw notFound('Invoice not found');
      res.json({ message: 'Invoice deleted successfully', msg: 'Invoice deleted successfully' });
    })
  );

  return router;
};
