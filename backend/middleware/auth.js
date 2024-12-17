const jwt = require('jsonwebtoken');

module.exports = function (req, res, next) {
  const token = req.header('Authorization');

  // Check if no token exists
  if (!token) {
    return res.status(401).json({ msg: 'No token, authorization denied' });
  }

  try {
    // Extract Bearer token value
    const splitToken = token.split(' ')[1];
    if (!splitToken) {
      return res.status(401).json({ msg: 'Malformed token, authorization denied' });
    }

    // Verify token
    const decoded = jwt.verify(splitToken, process.env.JWT_SECRET);

    // Attach userId to the request object
    req.user = decoded.userId;
    console.log('Decoded User ID:', req.user);

    next();
  } catch (err) {
    res.status(401).json({ msg: 'Token is not valid' });
  }
};
