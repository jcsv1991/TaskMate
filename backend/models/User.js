const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    name: { type: String, trim: true, maxlength: 80, default: '' },
    isDemo: { type: Boolean, default: false },
    // Only set for demo workspaces: MongoDB's TTL monitor deletes the document
    // at this time. Real accounts never get the field, so they are never expired.
    expiresAt: { type: Date, default: undefined },
  },
  { timestamps: true }
);

UserSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

UserSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret.password;
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('User', UserSchema);
