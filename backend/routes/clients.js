const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Client = require('../models/Client');
const Task = require('../models/Task');
const Invoice = require('../models/Invoice');

// GET /api/clients?search=...
router.get('/', auth, async (req, res) => {
  try {
    const searchQuery = req.query.search || '';
    const regex = new RegExp(searchQuery, 'i');
    const clients = await Client.find({ userId: req.user, name: { $regex: regex } });
    res.json(clients);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// GET /api/clients/:id => returns client + tasks + invoices
router.get('/:id', auth, async (req, res) => {
  try {
    const client = await Client.findById(req.params.id);
    if (!client || client.userId.toString() !== req.user) {
      return res.status(404).json({ msg: 'Client not found' });
    }
    const tasks = await Task.find({ userId: req.user, clientId: client._id });
    const invoices = await Invoice.find({ userId: req.user, clientId: client._id }).populate('clientId');
    res.json({ client, tasks, invoices });
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(400).json({ msg: 'Invalid client ID' });
    }
    res.status(500).send('Server Error');
  }
});

// POST /api/clients
router.post('/', auth, async (req, res) => {
  try {
    const { name, email, phone } = req.body;
    if (!name || !email || !phone) {
      return res.status(400).json({ msg: 'Please provide name, email, and phone' });
    }
    const newClient = new Client({
      name,
      email,
      phone,
      userId: req.user
    });
    await newClient.save();
    res.status(201).json({ msg: 'Client added successfully', client: newClient });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server Error' });
  }
});

// PUT /api/clients/:id
router.put('/:id', auth, async (req, res) => {
  try {
    const { name, email, phone } = req.body;
    const updatedFields = {};
    if (name) updatedFields.name = name;
    if (email) updatedFields.email = email;
    if (phone) updatedFields.phone = phone;

    let client = await Client.findById(req.params.id);
    if (!client) {
      return res.status(404).json({ msg: 'Client not found' });
    }
    if (client.userId.toString() !== req.user) {
      return res.status(401).json({ msg: 'Unauthorized' });
    }

    client = await Client.findByIdAndUpdate(
      req.params.id,
      { $set: updatedFields },
      { new: true }
    );

    res.json({ msg: 'Client updated successfully', client });
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(400).json({ msg: 'Invalid client ID' });
    }
    res.status(500).send('Server Error');
  }
});

// DELETE /api/clients/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    const client = await Client.findById(req.params.id);
    if (!client) {
      return res.status(404).json({ msg: 'Client not found' });
    }
    if (client.userId.toString() !== req.user) {
      return res.status(401).json({ msg: 'Unauthorized' });
    }

    await Client.findByIdAndDelete(req.params.id);
    res.json({ msg: 'Client deleted successfully' });
  } catch (err) {
    console.error('Error occurred:', err.message);
    if (err.kind === 'ObjectId') {
      return res.status(400).json({ msg: 'Invalid client ID' });
    }
    res.status(500).send('Server Error');
  }
});

module.exports = router;
