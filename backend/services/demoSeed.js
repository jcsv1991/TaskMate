const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Client = require('../models/Client');
const Task = require('../models/Task');
const Invoice = require('../models/Invoice');
const Counter = require('../models/Counter');
const { addDays, startOfDay } = require('../utils/dates');

const CLIENTS = [
  { name: 'Northwind Studio', company: 'Northwind Design Co.', email: 'hello@northwind.example', phone: '604-555-0142', notes: 'Prefers async updates. Net 15 terms.' },
  { name: 'Harbourview Realty', company: 'Harbourview Realty Group', email: 'accounts@harbourview.example', phone: '604-555-0178', notes: 'Monthly listing-page updates.' },
  { name: 'Cedar & Pine Cafe', company: 'Cedar & Pine Hospitality', email: 'owner@cedarpine.example', phone: '778-555-0113', notes: 'Online ordering project, phase 2.' },
  { name: 'Lumen Fitness', company: 'Lumen Fitness Inc.', email: 'ops@lumenfit.example', phone: '250-555-0190', notes: 'Booking widget + email automations.' },
  { name: 'Brightpath Dental', company: 'Brightpath Dental Clinic', email: 'frontdesk@brightpath.example', phone: '604-555-0127', notes: 'Website refresh. Slow to pay, send reminders.' },
];

// [title, client index | null, dueOffsetDays | null, priority, completedDaysAgo | null]
const TASKS = [
  ['Send revised homepage mockups', 0, -3, 'high', null],
  ['Fix mobile menu bug on listings page', 1, 0, 'high', null],
  ['Kick-off call: online ordering phase 2', 2, 1, 'medium', null],
  ['Set up booking widget staging site', 3, 3, 'medium', null],
  ['Draft email automation sequence', 3, 6, 'low', null],
  ['Collect photos and copy from clinic', 4, 9, 'medium', null],
  ['Quarterly SEO report for Harbourview', 1, 14, 'low', null],
  ['Renew domain and hosting (own site)', null, 21, 'medium', null],
  ['Update portfolio with latest case study', null, null, 'low', null],
  ['Deliver brand style guide', 0, -10, 'high', 9],
  ['Implement contact form + spam protection', 4, -6, 'medium', 6],
  ['Menu page content import', 2, -2, 'low', 2],
];

// [client index, amount, description, due offset days, paid days ago | null]
const INVOICES = [
  [0, 3200, 'Brand identity - milestone 1', -150, 152],
  [1, 1800, 'Listing page template build', -120, 118],
  [2, 2400, 'Online ordering - phase 1', -92, 90],
  [0, 2750, 'Website design - milestone 2', -62, 60],
  [3, 1500, 'Booking widget discovery', -40, 38],
  [1, 950, 'Monthly updates - September', -18, 15],
  [3, 1200, 'Booking widget - discovery workshop', -9, 1],
  [4, 4200, 'Website refresh - deposit', -21, null], // overdue
  [2, 1850, 'Online ordering - phase 2 deposit', -5, null], // overdue
  [3, 2200, 'Booking widget build', 12, null],
  [0, 1600, 'Brand style guide', 20, null],
];

const randomHex = (bytes) => crypto.randomBytes(bytes).toString('hex');

/**
 * Create a throwaway workspace with realistic sample data, so anyone (for
 * example a prospective client reviewing a portfolio) can explore the whole
 * app in one click without registering. Everything carries an `expiresAt` so
 * MongoDB's TTL monitor cleans it up automatically.
 */
async function createDemoWorkspace({ todayKey, ttlHours = 24, now = new Date() }) {
  const expiresAt = new Date(now.getTime() + ttlHours * 60 * 60 * 1000);
  const password = await bcrypt.hash(randomHex(16), 8); // never revealed, nobody signs in with it

  const user = await User.create({
    email: `demo-${randomHex(6)}@demo.taskmate.app`,
    password,
    name: 'Demo User',
    isDemo: true,
    expiresAt,
  });

  const clients = await Client.insertMany(CLIENTS.map((c) => ({ ...c, userId: user._id, expiresAt })));

  const at = (offset) => startOfDay(addDays(todayKey, offset));

  await Task.insertMany(
    TASKS.map(([title, clientIdx, dueOffset, priority, doneAgo]) => ({
      userId: user._id,
      title,
      clientId: clientIdx === null ? null : clients[clientIdx]._id,
      dueDate: dueOffset === null ? null : at(dueOffset),
      priority,
      completed: doneAgo !== null,
      completedAt: doneAgo === null ? null : at(-doneAgo),
      description: '',
      expiresAt,
    }))
  );

  const docs = [];
  for (const [clientIdx, amount, description, dueOffset, paidAgo] of INVOICES) {
    const seq = await Counter.next(`invoice:${user._id}`, expiresAt);
    docs.push({
      userId: user._id,
      clientId: clients[clientIdx]._id,
      number: `INV-${String(seq).padStart(4, '0')}`,
      description,
      amount,
      dueDate: at(dueOffset),
      status: paidAgo === null ? 'unpaid' : 'paid',
      paidAt: paidAgo === null ? null : at(-paidAgo),
      expiresAt,
    });
  }
  await Invoice.insertMany(docs);

  return user;
}

module.exports = { createDemoWorkspace };
