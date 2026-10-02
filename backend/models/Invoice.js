const mongoose = require('mongoose');
const { toDateKey } = require('../utils/dates');

const STATUSES = ['unpaid', 'paid', 'overdue'];

const InvoiceSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true },
    // INV-0001 style reference. Invoices created before this field existed simply have none.
    number: { type: String, trim: true },
    description: { type: String, trim: true, maxlength: 500, default: '' },
    amount: { type: Number, required: true, min: 0 },
    dueDate: { type: Date, required: true },
    status: { type: String, enum: STATUSES, default: 'unpaid' },
    paidAt: { type: Date, default: null },
    expiresAt: { type: Date, default: undefined },
  },
  { timestamps: true }
);

InvoiceSchema.index({ userId: 1, status: 1, dueDate: 1 });
InvoiceSchema.index({ userId: 1, clientId: 1 });
InvoiceSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

/**
 * "overdue" should not depend on somebody remembering to flip a dropdown. The
 * effective status is derived: anything not paid whose due date is before today
 * is overdue, everything else not paid is unpaid.
 */
function effectiveStatus(invoice, todayKey) {
  if (invoice.status === 'paid') return 'paid';
  return toDateKey(invoice.dueDate) < todayKey ? 'overdue' : 'unpaid';
}

InvoiceSchema.statics.effectiveStatus = effectiveStatus;

module.exports = mongoose.model('Invoice', InvoiceSchema);
module.exports.STATUSES = STATUSES;
module.exports.effectiveStatus = effectiveStatus;
