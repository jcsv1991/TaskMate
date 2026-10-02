const mongoose = require('mongoose');

const ClientSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254 },
    phone: { type: String, trim: true, maxlength: 40, default: '' },
    company: { type: String, trim: true, maxlength: 100, default: '' },
    notes: { type: String, trim: true, maxlength: 2000, default: '' },
    expiresAt: { type: Date, default: undefined },
  },
  // Keep the legacy `createdAt` field name used by existing documents.
  { timestamps: true }
);

ClientSchema.index({ userId: 1, name: 1 });
ClientSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('Client', ClientSchema);
