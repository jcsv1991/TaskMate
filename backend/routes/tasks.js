const express = require('express');
const router = express.Router();
const Task = require('../models/Task');
const auth = require('../middleware/auth');

// GET all tasks with optional filtering/sorting
// Added query params: completed, clientId, dueBefore, dueAfter, sortBy, order
router.get('/', auth, async (req, res) => {
  try {
    const { completed, clientId, dueBefore, dueAfter, sortBy, order } = req.query;
    const filter = { userId: req.user };
    if (completed === 'true') filter.completed = true;
    if (completed === 'false') filter.completed = false;
    if (clientId) filter.clientId = clientId;
    if (dueBefore) filter.dueDate = { ...filter.dueDate, $lt: new Date(dueBefore) };
    if (dueAfter) filter.dueDate = { ...filter.dueDate, $gt: new Date(dueAfter) };

    let query = Task.find(filter);
    if (sortBy) {
      const sortOrder = order === 'desc' ? -1 : 1;
      query = query.sort({ [sortBy]: sortOrder });
    }

    const tasks = await query.exec();
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// CREATE a new task with optional clientId
router.post('/', auth, async (req, res) => {
  const { title, description, dueDate, clientId } = req.body;
  try {
    const task = new Task({ userId: req.user, title, description, dueDate, clientId });
    await task.save();
    res.status(201).json(task);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create task' });
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
