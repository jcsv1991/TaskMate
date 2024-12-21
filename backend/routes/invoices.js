const express = require('express');
const router = express.Router();
const Invoice = require('../models/Invoice');
const auth = require('../middleware/auth');

// GET all invoices for the logged-in user with optional filters
// Added query parameters for filtering: clientId, status, dueDate, amount
// Sorting can also be implemented by query parameters like sortBy=field&order=asc/desc
router.get('/', auth, async (req, res) => {
  try {
    const { clientId, status, sortBy, order, minAmount, maxAmount, dueBefore, dueAfter } = req.query;
    const filter = { userId: req.user };

    if (clientId) filter.clientId = clientId;
    if (status) filter.status = status;
    if (minAmount) filter.amount = { ...filter.amount, $gte: Number(minAmount) };
    if (maxAmount) filter.amount = { ...filter.amount, $lte: Number(maxAmount) };
    if (dueBefore) filter.dueDate = { ...filter.dueDate, $lt: new Date(dueBefore) };
    if (dueAfter) filter.dueDate = { ...filter.dueDate, $gt: new Date(dueAfter) };

    let query = Invoice.find(filter).populate('clientId');
    if (sortBy) {
      const sortOrder = order === 'desc' ? -1 : 1;
      query = query.sort({ [sortBy]: sortOrder });
    }

    const invoices = await query.exec();
    res.json(invoices);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch invoices' });
  }
});

// CREATE a new invoice
router.post('/', auth, async (req, res) => {
  const { clientId, amount, dueDate } = req.body;
  try {
    const invoice = new Invoice({ userId: req.user, clientId, amount, dueDate });
    await invoice.save();
    res.json(invoice);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create invoice' });
  }
});

// UPDATE an invoice (can update amount, dueDate, status)
router.put('/:id', auth, async (req, res) => {
  const { amount, dueDate, status } = req.body;
  try {
    const invoice = await Invoice.findOneAndUpdate(
      { _id: req.params.id, userId: req.user },
      { amount, dueDate, status },
      { new: true }
    );
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
    res.json(invoice);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update invoice' });
  }
});

// DELETE an invoice
router.delete('/:id', auth, async (req, res) => {
  try {
    const invoice = await Invoice.findOneAndDelete({ _id: req.params.id, userId: req.user });
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
    res.json({ message: 'Invoice deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete invoice' });
  }
});

module.exports = router;
