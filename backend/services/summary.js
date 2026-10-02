const Task = require('../models/Task');
const Invoice = require('../models/Invoice');
const Client = require('../models/Client');
const { effectiveStatus } = require('../models/Invoice');
const { toDateKey, addDays, monthKey, startOfDay } = require('../utils/dates');

const MAX_DOCS = 5000;
const round2 = (n) => Math.round(n * 100) / 100;

// ["2026-05", ..., "2026-10"] ending with the month of `todayKey`.
function lastMonths(todayKey, count) {
  const [year, month] = todayKey.split('-').map(Number);
  const months = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    const d = new Date(Date.UTC(year, month - 1 - i, 1));
    months.push(d.toISOString().slice(0, 7));
  }
  return months;
}

/**
 * Everything the dashboard needs in one round trip.
 *
 * The three collections are read once and summarised in memory. That is the
 * right trade-off for a freelancer's workspace (hundreds of rows, not millions):
 * it keeps the maths readable and testable. If volume grew, the sums here map
 * directly onto $group stages.
 */
async function buildSummary(userId, todayKey) {
  const [tasks, invoices, clients] = await Promise.all([
    Task.find({ userId }).select('title dueDate priority completed completedAt clientId').limit(MAX_DOCS).lean(),
    Invoice.find({ userId }).select('number amount status dueDate paidAt clientId').limit(MAX_DOCS).lean(),
    Client.find({ userId }).select('name').limit(MAX_DOCS).lean(),
  ]);

  const clientName = new Map(clients.map((c) => [String(c._id), c.name]));
  const weekEnd = addDays(todayKey, 7);

  // ---- tasks
  const open = tasks.filter((t) => !t.completed);
  const dueKey = (t) => (t.dueDate ? toDateKey(t.dueDate) : null);
  const taskStats = {
    total: tasks.length,
    open: open.length,
    completed: tasks.length - open.length,
    overdue: open.filter((t) => dueKey(t) && dueKey(t) < todayKey).length,
    dueToday: open.filter((t) => dueKey(t) === todayKey).length,
    dueThisWeek: open.filter((t) => dueKey(t) && dueKey(t) >= todayKey && dueKey(t) <= weekEnd).length,
    completionRate: tasks.length ? round2((tasks.length - open.length) / tasks.length) : null,
  };

  const focusTasks = open
    .filter((t) => dueKey(t) && dueKey(t) <= weekEnd)
    .sort((a, b) => dueKey(a).localeCompare(dueKey(b)))
    .slice(0, 8)
    .map((t) => ({
      _id: String(t._id),
      title: t.title,
      dueDate: t.dueDate,
      priority: t.priority,
      overdue: dueKey(t) < todayKey,
      clientName: t.clientId ? clientName.get(String(t.clientId)) || null : null,
    }));

  // ---- invoices
  let outstanding = 0;
  let overdueAmount = 0;
  let overdueCount = 0;
  let paidTotal = 0;
  let paidThisMonth = 0;
  const thisMonth = monthKey(startOfDay(todayKey));
  const months = lastMonths(todayKey, 6);
  const byMonth = new Map(months.map((m) => [m, { month: m, paid: 0, outstanding: 0 }]));
  const perClient = new Map();

  const overdueInvoices = [];
  for (const inv of invoices) {
    const status = effectiveStatus(inv, todayKey);
    const key = String(inv.clientId);
    const entry = perClient.get(key) || { clientId: key, name: clientName.get(key) || 'Unknown client', billed: 0, outstanding: 0 };
    entry.billed += inv.amount;

    if (status === 'paid') {
      paidTotal += inv.amount;
      // Invoices marked paid before `paidAt` existed fall back to their due date.
      const paidMonth = monthKey(inv.paidAt || inv.dueDate);
      if (paidMonth === thisMonth) paidThisMonth += inv.amount;
      if (byMonth.has(paidMonth)) byMonth.get(paidMonth).paid += inv.amount;
    } else {
      outstanding += inv.amount;
      entry.outstanding += inv.amount;
      const dueMonth = monthKey(inv.dueDate);
      if (byMonth.has(dueMonth)) byMonth.get(dueMonth).outstanding += inv.amount;
      if (status === 'overdue') {
        overdueAmount += inv.amount;
        overdueCount += 1;
        overdueInvoices.push({
          _id: String(inv._id),
          number: inv.number || null,
          amount: inv.amount,
          dueDate: inv.dueDate,
          clientName: entry.name,
          daysOverdue: Math.round((startOfDay(todayKey) - startOfDay(toDateKey(inv.dueDate))) / 86400000),
        });
      }
    }
    perClient.set(key, entry);
  }

  overdueInvoices.sort((a, b) => b.daysOverdue - a.daysOverdue);

  const topClients = [...perClient.values()]
    .sort((a, b) => b.billed - a.billed)
    .slice(0, 5)
    .map((c) => ({ ...c, billed: round2(c.billed), outstanding: round2(c.outstanding) }));

  return {
    today: todayKey,
    tasks: taskStats,
    clients: { total: clients.length },
    invoices: {
      total: invoices.length,
      outstandingAmount: round2(outstanding),
      overdueAmount: round2(overdueAmount),
      overdueCount,
      paidAmount: round2(paidTotal),
      paidThisMonth: round2(paidThisMonth),
    },
    revenueByMonth: months.map((m) => {
      const row = byMonth.get(m);
      return { month: m, paid: round2(row.paid), outstanding: round2(row.outstanding) };
    }),
    focusTasks,
    overdueInvoices: overdueInvoices.slice(0, 5),
    topClients,
  };
}

module.exports = { buildSummary, lastMonths };
