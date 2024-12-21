const express = require('express');
const router = express.Router();
const Task = require('../models/Task');
const auth = require('../middleware/auth');
const Client = require('../models/Client');

// GET /api/tasks with query params
router.get('/', auth, async (req, res) => {
  try {
    const { completed, clientName, sortBy, order, dueBefore, dueAfter } = req.query;
    const filter = { userId: req.user };

    if (completed === 'true') filter.completed = true;
    else if (completed === 'false') filter.completed = false;

    if (clientName && clientName.trim() !== '') {
      const regex = new RegExp(clientName, 'i');
      const matchedClients = await Client.find({ userId: req.user, name: { $regex: regex } }, '_id');
      const clientIds = matchedClients.map(c => c._id);
      filter.clientId = { $in: clientIds.length ? clientIds : [] };
    }

    if (dueBefore) {
      filter.dueDate = { ...filter.dueDate, $lt: new Date(dueBefore) };
    }
    if (dueAfter) {
      filter.dueDate = { ...filter.dueDate, $gt: new Date(dueAfter) };
    }

    let query = Task.find(filter);

    if (sortBy === 'dueDate') {
      const sortOrder = order === 'desc' ? -1 : 1;
      query = query.sort({ dueDate: sortOrder });
    } else if (sortBy === 'title') {
      const sortOrder = order === 'desc' ? -1 : 1;
      query = query.sort({ title: sortOrder });
    }

    const tasks = await query.exec();
    res.json(tasks);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/tasks
router.post('/', auth, async (req, res) => {
  const { title, description, dueDate, clientId } = req.body;
  try {
    const task = new Task({
      userId: req.user,
      title,
      description,
      dueDate,
      clientId
    });
    await task.save();
    res.status(201).json(task);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create task' });
  }
});

// GET /api/tasks/completed
router.get('/completed', auth, async (req, res) => {
  try {
    const tasks = await Task.find({ userId: req.user, completed: true });
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/tasks/pending
router.get('/pending', auth, async (req, res) => {
  try {
    const tasks = await Task.find({ userId: req.user, completed: false });
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/tasks/:id
router.get('/:id', auth, async (req, res) => {
  try {
    const task = await Task.findOne({ _id: req.params.id, userId: req.user });
    if (!task) return res.status(404).json({ error: 'Task not found' });
    res.json(task);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/tasks/:id
router.put('/:id', auth, async (req, res) => {
  const { title, description, dueDate, completed, clientId } = req.body;
  try {
    const updatedTask = await Task.findOneAndUpdate(
      { _id: req.params.id, userId: req.user },
      { title, description, dueDate, completed, clientId },
      { new: true }
    );
    if (!updatedTask) return res.status(404).json({ error: 'Task not found' });
    res.json(updatedTask);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update task' });
  }
});

// PATCH /api/tasks/:id/completed
router.patch('/:id/completed', auth, async (req, res) => {
  try {
    const updatedTask = await Task.findOneAndUpdate(
      { _id: req.params.id, userId: req.user },
      { completed: true },
      { new: true }
    );
    if (!updatedTask) return res.status(404).json({ error: 'Task not found' });
    res.json(updatedTask);
  } catch (err) {
    res.status(500).json({ error: 'Failed to mark task as completed' });
  }
});

// DELETE /api/tasks/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    const deletedTask = await Task.findOneAndDelete({ _id: req.params.id, userId: req.user });
    if (!deletedTask) return res.status(404).json({ error: 'Task not found' });
    res.json({ msg: 'Task deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

module.exports = router;
