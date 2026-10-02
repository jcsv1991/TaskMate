const { effectiveStatus } = require('../models/Invoice');
const { toDateKey } = require('./dates');

const idOf = (value) => (value && value._id ? String(value._id) : value ? String(value) : null);

// A populated client reference ({ _id, name, ... }) vs a bare ObjectId.
const clientRef = (ref) =>
  ref && ref._id && ref.name !== undefined
    ? { _id: String(ref._id), name: ref.name, email: ref.email, company: ref.company }
    : null;

/** Strip internal fields and flatten the populated client into `client`. */
function taskJSON(task, todayKey) {
  const { userId, __v, expiresAt, clientId, ...rest } = task;
  const overdue = !task.completed && !!task.dueDate && toDateKey(task.dueDate) < todayKey;
  return { ...rest, clientId: idOf(clientId), client: clientRef(clientId), overdue };
}

function invoiceJSON(invoice, todayKey) {
  const { userId, __v, expiresAt, clientId, ...rest } = invoice;
  const status = effectiveStatus(invoice, todayKey);
  return {
    ...rest,
    clientId: idOf(clientId),
    client: clientRef(clientId),
    effectiveStatus: status,
    overdue: status === 'overdue',
  };
}

function clientJSON(client) {
  const { userId, __v, expiresAt, ...rest } = client;
  return rest;
}

module.exports = { taskJSON, invoiceJSON, clientJSON, idOf };
