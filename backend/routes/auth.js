const express = require('express');
const router = express.Router();
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Signup route
router.post('/signup', async (req, res) => {
  const { email, password } = req.body;
  // Basic validation
  if(!email || !password) {
    return res.status(400).json({ msg: 'Please provide an email and password' });
  }
  if(password.length < 6) {
    return res.status(400).json({ msg: 'Password should be at least 6 characters long' });
  }

  try {
    let user = await User.findOne({ email });
    if (user) return res.status(400).json({ msg: 'User already exists' });

    const hashed = await bcrypt.hash(password, 10);
    user = new User({ email, password: hashed });
    await user.save();
    return res.json({ msg: 'User created successfully' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Login route
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if(!email || !password){
    return res.status(400).json({ msg: 'Please provide email and password' });
  }
  try {
    let user = await User.findOne({ email });
    if (!user) return res.status(400).json({ msg: 'Invalid credentials' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ msg: 'Invalid credentials' });

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '1d' });
    return res.json({ token });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
