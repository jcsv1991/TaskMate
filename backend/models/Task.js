const mongoose = require('mongoose');

const TaskSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: String,
  description: String,
  dueDate: Date,
  completed: { type: Boolean, default: false },
  // Added clientId to associate tasks with a client
  clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', default: null }
});

module.exports = mongoose.model('Task', TaskSchema);
