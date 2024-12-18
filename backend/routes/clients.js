const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth'); // JWT Middleware
const Client = require('../models/Client'); // Client model

// GET: Fetch all clients
router.get('/', auth, async (req, res) => {
  try {
    const clients = await Client.find({ userId: req.user }); // Fetch clients for the logged-in user
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

    // Build update object
    const updatedFields = {};
    if (name) updatedFields.name = name;
    if (email) updatedFields.email = email;
    if (phone) updatedFields.phone = phone;

    // Find and update
    let client = await Client.findById(req.params.id);
    if (!client) {
      return res.status(404).json({ msg: 'Client not found' });
    }

    // Ensure user owns the client
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
    console.log('Delete Request Received'); // Log request start

    const client = await Client.findById(req.params.id);

    if (!client) {
      console.log('Client not found');
      return res.status(404).json({ msg: 'Client not found' });
    }

    console.log('Client found:', client);

    // Ensure user owns the client
    if (client.userId.toString() !== req.user) {
      console.log('Unauthorized access');
      return res.status(401).json({ msg: 'Unauthorized' });
    }

    console.log('User authorized, deleting client...');
    
     // Delete the client using findByIdAndDelete
     await Client.findByIdAndDelete(req.params.id);

    console.log('Client deleted successfully');
    res.json({ msg: 'Client deleted successfully' });
  } catch (err) {
    console.error('Error occurred:', err.message); // Log the error message
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

    // Ensure required fields exist
    if (!name || !email || !phone) {
      return res.status(400).json({ msg: 'Please provide name, email, and phone' });
    }

    // Get userId from the decoded token (set by auth middleware)
    const userId = req.user;

    // Create a new client
    const newClient = new Client({
      name,
      email,
      phone,
      userId, // Associate the client with the logged-in user
    });

    // Save the client to the database
    await newClient.save();

    res.status(201).json({ msg: 'Client added successfully', client: newClient });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server Error' });
  }
});

module.exports = router;
