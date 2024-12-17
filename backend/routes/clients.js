const express = require('express');
const router = express.Router();
const Client = require('../models/Client');
const auth = require('../middleware/auth');

router.get('/', auth, async (req, res) => {
  const clients = await Client.find({ userId: req.user.userId });
  res.json(clients);
});

router.post('/', auth, async (req, res) => {
  const { name, email, notes } = req.body;
  const newClient = new Client({ userId: req.user.userId, name, email, notes });
  await newClient.save();
  res.json(newClient);
});

module.exports = router;
