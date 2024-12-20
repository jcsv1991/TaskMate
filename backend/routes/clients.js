const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth'); // JWT Middleware
const Client = require('../models/Client'); // Client model

// GET: Fetch all clients
router.get('/', auth, async (req, res) => {
  try {
    const clients = await Client.find({ userId: req.user });
    res.json(clients);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// GET: Fetch a single client by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const client = await Client.findById(req.params.id);

    if (!client) {
      return res.status(404).json({ msg: 'Client not found' });
    }

    res.json(client);
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(400).json({ msg: 'Invalid client ID' });
    }
    res.status(500).send('Server Error');
  }
});

// PUT: Update a client by ID
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

// DELETE: Delete a client by ID
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

// POST: Add a new client
router.post('/', auth, async (req, res) => {
  try {
    const { name, email, phone } = req.body;

    if (!name || !email || !phone) {
      return res.status(400).json({ msg: 'Please provide name, email, and phone' });
    }

    const userId = req.user;

    const newClient = new Client({
      name,
      email,
      phone,
      userId,
    });

    await newClient.save();

    res.status(201).json({ msg: 'Client added successfully', client: newClient });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server Error' });
  }
});

module.exports = router;
