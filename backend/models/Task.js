const mongoose = require('mongoose');

const PRIORITIES = ['low', 'medium', 'high'];

const TaskSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, trim: true, maxlength: 2000, default: '' },
    dueDate: { type: Date, default: null },
    priority: { type: String, enum: PRIORITIES, default: 'medium' },
    completed: { type: Boolean, default: false },
    completedAt: { type: Date, default: null },
    // A task can optionally be linked to one of the user's clients.
    clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', default: null },
    expiresAt: { type: Date, default: undefined },
  },
  { timestamps: true }
);

TaskSchema.index({ userId: 1, completed: 1, dueDate: 1 });
TaskSchema.index({ userId: 1, clientId: 1 });
TaskSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('Task', TaskSchema);
module.exports.PRIORITIES = PRIORITIES;
