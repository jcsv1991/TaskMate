const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Task = require('../models/Task');
const auth = require('../middleware/auth');

// GET all tasks
router.get('/', auth, async (req, res) => {
  try {
    const tasks = await Task.find({ userId: req.user.userId });
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET completed tasks
router.get('/completed', auth, async (req, res) => {
  try {
    console.log('Full req.user:', req.user); // Debug: Log full user object
    const userId = req.user.userId;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      console.error('Invalid userId:', userId); // Check if userId is a valid ObjectId
      return res.status(400).json({ error: 'Invalid user ID format' });
    }

    console.log('Executing query for userId:', userId);
    const completedTasks = await Task.find({ userId: userId, completed: true });

    console.log('Completed Tasks:', completedTasks); // Check the result of the query
    res.json(completedTasks);
  } catch (err) {
    console.error('Error in /completed route:', err); // Log the error
    res.status(500).json({ error: 'Server error', details: err.message });
  }
});

// GET pending tasks
router.get('/pending', auth, async (req, res) => {
  try {
    const pendingTasks = await Task.find({ userId: req.user.userId, completed: false });
    res.json(pendingTasks);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET single task by ID (MUST be after specific routes)
router.get('/:id', auth, async (req, res) => {
  try {
    const task = await Task.findOne({ _id: req.params.id, userId: req.user.userId });
    if (!task) return res.status(404).json({ error: 'Task not found' });
    res.json(task);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// CREATE a new task
router.post('/', auth, async (req, res) => {
  const { title, description, dueDate } = req.body;
  try {
    const task = new Task({ userId: req.user.userId, title, description, dueDate });
    await task.save();
    res.status(201).json(task);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create task' });
  }
});

// UPDATE task by ID
router.put('/:id', auth, async (req, res) => {
  const { title, description, dueDate, completed } = req.body;
  try {
    const updatedTask = await Task.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.userId },
      { title, description, dueDate, completed },
      { new: true }
    );
    if (!updatedTask) return res.status(404).json({ error: 'Task not found' });
    res.json(updatedTask);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update task' });
  }
});

// DELETE task by ID
router.delete('/:id', auth, async (req, res) => {
  try {
    const deletedTask = await Task.findOneAndDelete({ _id: req.params.id, userId: req.user.userId });
    if (!deletedTask) return res.status(404).json({ error: 'Task not found' });
    res.json({ msg: 'Task deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

// MARK task as completed or toggle completion
router.patch('/:id/completed', auth, async (req, res) => {
  try {
    const task = await Task.findOne({ _id: req.params.id, userId: req.user.userId });
    if (!task) return res.status(404).json({ error: 'Task not found' });

    task.completed = !task.completed;
    await task.save();
    res.json(task);
  } catch (err) {
    res.status(500).json({ error: 'Failed to mark task' });
  }
});

module.exports = router;
