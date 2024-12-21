const express = require('express');
const router = express.Router();
const Invoice = require('../models/Invoice');
const auth = require('../middleware/auth');
const Client = require('../models/Client');

// GET all invoices with filtering by client name and status
router.get('/', auth, async (req, res) => {
  try {
    const { status, clientName, sortBy, order } = req.query;
    const filter = { userId: req.user };

    // If clientName provided, find corresponding client IDs
    if (clientName && clientName.trim() !== '') {
      const regex = new RegExp(clientName, 'i');
      const clients = await Client.find({ userId: req.user, name: { $regex: regex } }, '_id');
      const clientIds = clients.map(c => c._id);
      filter.clientId = { $in: clientIds.length > 0 ? clientIds : [] };
    }

    if (status) filter.status = status;

    let query = Invoice.find(filter).populate('clientId');
    if (sortBy === 'dueDate') {
      const sortOrder = order === 'desc' ? -1 : 1;
      query = query.sort({ dueDate: sortOrder });
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
