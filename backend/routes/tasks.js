const express = require('express');
const Task = require('../models/Task');
const Client = require('../models/Client');
const asyncHandler = require('../utils/asyncHandler');
const escapeRegex = require('../utils/escapeRegex');
const findNullsLast = require('../utils/nullsLast');
const { badRequest, notFound } = require('../utils/httpError');
const { resolveToday, startOfDay } = require('../utils/dates');
const { setPaginationHeaders } = require('../utils/pagination');
const { taskJSON } = require('../utils/serializers');
const validate = require('../middleware/validate');
const makeAuth = require('../middleware/auth');
const schemas = require('../schemas/tasks');

const POPULATE = { path: 'clientId', select: 'name' };

module.exports = (config) => {
  const router = express.Router();
  router.use(makeAuth(config));

  // A task may only point at one of the caller's own clients.
  async function assertOwnClient(userId, clientId) {
    if (!clientId) return;
    const exists = await Client.exists({ _id: clientId, userId });
    if (!exists) throw badRequest('Client not found');
  }

  const loadOne = async (userId, id, todayKey) => {
    const task = await Task.findOne({ _id: id, userId }).populate(POPULATE).lean();
    if (!task) throw notFound('Task not found');
    return taskJSON(task, todayKey);
  };

  // GET /api/tasks
  router.get(
    '/',
    validate(schemas.list, 'query'),
    asyncHandler(async (req, res) => {
      const q = req.valid.query;
      const todayKey = resolveToday(req);
      const filter = { userId: req.user };

      if (q.completed) filter.completed = q.completed === 'true';
      if (q.priority) filter.priority = q.priority;
      if (q.clientId) filter.clientId = q.clientId;

      // `clientName` is the original filter, kept for backwards compatibility.
      if (q.clientName) {
        const matched = await Client.find({ userId: req.user, name: new RegExp(escapeRegex(q.clientName), 'i') }, '_id').lean();
        filter.clientId = { $in: matched.map((c) => c._id) };
      }
      if (q.search) {
        const rx = new RegExp(escapeRegex(q.search), 'i');
        filter.$or = [{ title: rx }, { description: rx }];
      }

      const due = {};
      if (q.dueAfter) due.$gte = q.dueAfter;
      if (q.dueBefore) due.$lte = q.dueBefore;
      if (q.overdue === 'true') {
        filter.completed = false;
        due.$lt = startOfDay(todayKey);
      }
      if (Object.keys(due).length) filter.dueDate = due;

      const skip = (q.page - 1) * q.limit;
      let items;
      let total;

      if (!q.sortBy || q.sortBy === 'dueDate') {
        ({ items, total } = await findNullsLast(Task, filter, { field: 'dueDate', order: q.order, skip, limit: q.limit, populate: POPULATE }));
      } else {
        const dir = q.order === 'desc' ? -1 : 1;
        [items, total] = await Promise.all([
          Task.find(filter)
            .populate(POPULATE)
            .sort({ [q.sortBy]: dir, _id: 1 })
            .skip(skip)
            .limit(q.limit)
            .lean(),
          Task.countDocuments(filter),
        ]);
      }

      setPaginationHeaders(res, { total, page: q.page, limit: q.limit });
      res.json(items.map((t) => taskJSON(t, todayKey)));
    })
  );

  // GET /api/tasks/:id
  router.get(
    '/:id',
    asyncHandler(async (req, res) => {
      res.json(await loadOne(req.user, req.params.id, resolveToday(req)));
    })
  );

  // POST /api/tasks
  router.post(
    '/',
    validate(schemas.create),
    asyncHandler(async (req, res) => {
      const body = req.valid.body;
      await assertOwnClient(req.user, body.clientId);
      const task = await Task.create({ ...body, userId: req.user });
      res.status(201).json(await loadOne(req.user, task._id, resolveToday(req)));
    })
  );

  // PUT|PATCH /api/tasks/:id  (partial update; completing a task stamps completedAt)
  const update = asyncHandler(async (req, res) => {
    const body = { ...req.valid.body };
    await assertOwnClient(req.user, body.clientId);

    const existing = await Task.findOne({ _id: req.params.id, userId: req.user }).select('completed').lean();
    if (!existing) throw notFound('Task not found');

    if (body.completed === true && !existing.completed) body.completedAt = new Date();
    if (body.completed === false) body.completedAt = null;

    await Task.updateOne({ _id: req.params.id, userId: req.user }, { $set: body }, { runValidators: true });
    res.json(await loadOne(req.user, req.params.id, resolveToday(req)));
  });
  router.put('/:id', validate(schemas.update), update);
  router.patch('/:id', validate(schemas.update), update);

  // PATCH /api/tasks/:id/completed  (original endpoint: mark as done)
  router.patch(
    '/:id/completed',
    asyncHandler(async (req, res) => {
      const existing = await Task.findOne({ _id: req.params.id, userId: req.user }).select('completed').lean();
      if (!existing) throw notFound('Task not found');
      if (!existing.completed) {
        await Task.updateOne({ _id: req.params.id, userId: req.user }, { $set: { completed: true, completedAt: new Date() } });
      }
      res.json(await loadOne(req.user, req.params.id, resolveToday(req)));
    })
  );

  // DELETE /api/tasks/:id
  router.delete(
    '/:id',
    asyncHandler(async (req, res) => {
      const deleted = await Task.findOneAndDelete({ _id: req.params.id, userId: req.user });
      if (!deleted) throw notFound('Task not found');
      res.json({ msg: 'Task deleted successfully' });
    })
  );

  return router;
};
