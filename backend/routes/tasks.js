const express = require('express');
const router = express.Router();
const Task = require('../models/Task');
const auth = require('../middleware/auth');

router.get('/', auth, async (req, res) => {
  const tasks = await Task.find({ userId: req.user.userId });
  res.json(tasks);
});

router.post('/', auth, async (req, res) => {
  const { title, description, dueDate } = req.body;
  const task = new Task({ userId: req.user.userId, title, description, dueDate });
  await task.save();
  res.json(task);
});

module.exports = router;
