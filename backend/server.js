require('dotenv').config();
const express = require('express');
const connectDB = require('./config/db');
const cors = require('cors');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Connect to MongoDB
connectDB();

// Route Imports
const authRoute = require('./routes/auth');
const clientsRoute = require('./routes/clients');
const tasksRoute = require('./routes/tasks');
const invoicesRoute = require('./routes/invoices');

const testRoute = require('./routes/testRoute');

// Routes
app.use('/api/auth', authRoute);
app.use('/api/clients', clientsRoute);
app.use('/api/tasks', tasksRoute);
app.use('/api/invoices', invoicesRoute);
app.use('/api/test', testRoute); 

module.exports = app;

if (process.env.NODE_ENV !== 'test') {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}
