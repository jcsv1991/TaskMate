const express = require('express');
const router = express.Router();
const Invoice = require('../models/Invoice');
const auth = require('../middleware/auth');

// GET all invoices for the logged-in user
router.get('/', auth, async (req, res) => {
  try {
    const invoices = await Invoice.find({ userId: req.user }).populate('clientId');
    res.json(invoices);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch invoices' });
  }
});

// CREATE a new invoice
// Remember: clientId must be the _id of a Client that you have created. 
// First, create a client via POST /api/clients, then use that client's _id here.
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

// UPDATE an invoice
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
