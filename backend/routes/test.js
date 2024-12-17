const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth'); // Import middleware

// Protected Test Route
router.get('/test', auth, (req, res) => {
  res.json({ msg: 'Token is valid', userId: req.user });
});

module.exports = router; // Correct export
