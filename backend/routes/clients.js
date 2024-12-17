const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth'); // Middleware for JWT verification
const Client = require('../models/Client'); // Client model

// POST: Add a new client
router.post('/', auth, async (req, res) => {
  try {
    console.log('Request User ID:', req.user); // Debugging line
    const { name, email, phone } = req.body;

    // Get userId from the decoded token (auth middleware sets req.user)
    const userId = req.user;

    // Create new client
    const newClient = new Client({
      name,
      email,
      phone,
      userId, // Attach userId to the client
    });

    // Save to database
    await newClient.save();

    res.status(201).json({ msg: 'Client added successfully', client: newClient });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server Error' });
  }
});

module.exports = router;
