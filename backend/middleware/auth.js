const jwt = require('jsonwebtoken');

module.exports = function (req, res, next) {
  // Extract token from Authorization or x-auth-token
  let token = req.header('x-auth-token');

  // Check Authorization header for Bearer token
  if (!token) {
    const authHeader = req.header('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1]; // Extract Bearer token
    }
  }

  // Return error if no token is provided
  if (!token) {
    return res.status(401).json({ msg: 'No token, authorization denied' });
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Attach the decoded user info to req.user
    req.user = decoded; // Assumes token payload includes userId
    console.log('Decoded User Info:', req.user);

    next();
  } catch (err) {
    res.status(401).json({ msg: 'Token is not valid' });
  }
};
