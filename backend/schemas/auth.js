const { z } = require('./common');

const email = z.string().trim().toLowerCase().email('Enter a valid email address').max(254);

const signup = z.object({
  email,
  // bcrypt only uses the first 72 bytes, so longer passwords add no security.
  password: z.string().min(8, 'Password must be at least 8 characters').max(72, 'Password must be at most 72 characters'),
  name: z.string().trim().max(80).optional(),
});

// Login deliberately does not enforce the signup rules, so accounts created
// under the old 6 character minimum can still sign in.
const login = z.object({
  email: z.string().trim().min(1, 'Please provide an email address').max(254),
  password: z.string().min(1, 'Please provide a password').max(200),
});

const updateProfile = z.object({
  name: z.string().trim().max(80),
});

module.exports = { signup, login, updateProfile };
