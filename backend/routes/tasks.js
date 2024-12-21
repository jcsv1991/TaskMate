const express = require('express');
const router = express.Router();
const Task = require('../models/Task');
const auth = require('../middleware/auth');
const Client = require('../models/Client');

// GET all tasks with filtering by client name and completed state
router.get('/', auth, async (req, res) => {
  try {
    const { completed, clientName, sortBy, order } = req.query;
    const filter = { userId: req.user };

    if (completed === 'true') filter.completed = true;
    if (completed === 'false') filter.completed = false;

    // If clientName provided, find corresponding client IDs
    if (clientName && clientName.trim() !== '') {
      const regex = new RegExp(clientName, 'i');
      const clients = await Client.find({ userId: req.user, name: { $regex: regex } }, '_id');
      const clientIds = clients.map(c => c._id);
      filter.clientId = { $in: clientIds.length > 0 ? clientIds : [] };
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
    res.status(500).json({ error: 'Server error' });
  }
});

// Toggle task completion state via PUT (allows switching back and forth)
router.put('/:id/toggle', auth, async (req, res) => {
  try {
    const task = await Task.findOne({ _id: req.params.id, userId: req.user });
    if (!task) return res.status(404).json({ error: 'Task not found' });

    task.completed = !task.completed;
    await task.save();
    res.json(task);
  } catch (err) {
    res.status(500).json({ error: 'Failed to toggle task completion state' });
  }
});

// GET a task by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const task = await Task.findOne({ _id: req.params.id, userId: req.user });
    if (!task) return res.status(404).json({ error: 'Task not found' });
    res.json(task);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// UPDATE task by ID
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

// MARK a task as completed (existing route, kept for backward compatibility)
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

// DELETE task by ID
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
