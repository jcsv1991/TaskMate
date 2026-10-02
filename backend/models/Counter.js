const mongoose = require('mongoose');

// Atomic per-user sequence used for human friendly invoice numbers (INV-0001).
const CounterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 },
  expiresAt: { type: Date, default: undefined },
});

CounterSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

/**
 * Atomically take the next number for `key`.
 *
 * When two requests race to create the very first counter document, both
 * upserts try to insert the same _id and the loser gets a duplicate key error
 * (E11000). That is expected and harmless, because the document now exists, so
 * the retry simply increments it. Without the retry the loser would fail with a
 * confusing 409 even though nothing is wrong.
 */
CounterSchema.statics.next = async function next(key, expiresAt, attempt = 0) {
  const update = { $inc: { seq: 1 } };
  if (expiresAt) update.$set = { expiresAt };
  try {
    const counter = await this.findOneAndUpdate({ _id: key }, update, { new: true, upsert: true });
    return counter.seq;
  } catch (err) {
    if (err.code === 11000 && attempt < 5) return this.next(key, expiresAt, attempt + 1);
    throw err;
  }
};

module.exports = mongoose.model('Counter', CounterSchema);
