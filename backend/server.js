require('dotenv').config(); // Load environment variables
const express = require('express');
const connectDB = require('./config/db'); // Database connection file
const cors = require('cors');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Connect to MongoDB Atlas
connectDB();

// Route Imports
const authRoute = require('./routes/auth');
const clientsRoute = require('./routes/clients');
const tasksRoute = require('./routes/tasks');
const testRoute = require('./routes/test'); // Import test route

// Routes
app.use('/api/auth', authRoute);
app.use('/api/clients', clientsRoute);
app.use('/api/tasks', tasksRoute);
app.use('/api', testRoute); // Register test route here

// Server Port
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
