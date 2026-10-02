const escapeRegex = require('../../utils/escapeRegex');
const { toCsv, cell } = require('../../utils/csv');
const { setPaginationHeaders } = require('../../utils/pagination');
const { HttpError, badRequest, unauthorized, notFound, conflict } = require('../../utils/httpError');
const asyncHandler = require('../../utils/asyncHandler');
const { effectiveStatus } = require('../../models/Invoice');
const { lastMonths } = require('../../services/summary');
const { taskJSON, invoiceJSON, clientJSON } = require('../../utils/serializers');

describe('escapeRegex', () => {
  test('neutralises regex metacharacters', () => {
    const input = '.*+?^${}()|[]\\';
    expect(() => new RegExp(escapeRegex(input))).not.toThrow();
    expect(new RegExp(escapeRegex('a.c')).test('abc')).toBe(false);
    expect(new RegExp(escapeRegex('a.c')).test('a.c')).toBe(true);
  });

  test('a ReDoS style pattern is matched literally and fast', () => {
    const evil = '(a+)+$';
    const start = Date.now();
    expect(new RegExp(escapeRegex(evil)).test('a'.repeat(40) + '!')).toBe(false);
    expect(Date.now() - start).toBeLessThan(200);
  });
});

describe('csv', () => {
  test('quotes commas, quotes and newlines', () => {
    expect(cell('plain')).toBe('plain');
    expect(cell('a,b')).toBe('"a,b"');
    expect(cell('say "hi"')).toBe('"say ""hi"""');
    expect(cell('line1\nline2')).toBe('"line1\nline2"');
  });

  test('prevents formula injection', () => {
    expect(cell('=SUM(A1:A9)')).toBe("'=SUM(A1:A9)");
    expect(cell('+1-555')).toBe("'+1-555");
    expect(cell('-2+3')).toBe("'-2+3");
    expect(cell('@cmd')).toBe("'@cmd");
    expect(cell('\tTAB')).toBe("'\tTAB");
    // a quoted result must still be CSV-escaped
    expect(cell('=HYPERLINK("x","y")')).toBe('"\'=HYPERLINK(""x"",""y"")"');
  });

  test('numbers (including negatives) are not treated as formulas', () => {
    expect(cell(-5)).toBe('-5');
    expect(cell(12.5)).toBe('12.5');
  });

  test('null, undefined and dates', () => {
    expect(cell(null)).toBe('');
    expect(cell(undefined)).toBe('');
    expect(cell(new Date('2026-01-02T00:00:00Z'))).toBe('2026-01-02');
  });

  test('toCsv adds a BOM, header and CRLF rows', () => {
    const csv = toCsv([{ header: 'A', value: (r) => r.a }, { header: 'B', value: (r) => r.b }], [{ a: 1, b: 'x,y' }]);
    expect(csv).toBe('\uFEFFA,B\r\n1,"x,y"\r\n');
  });
});

describe('pagination headers', () => {
  test('sets counts and computes total pages (min 1)', () => {
    const headers = {};
    const res = { set: (h) => Object.assign(headers, h) };
    setPaginationHeaders(res, { total: 101, page: 2, limit: 50 });
    expect(headers).toEqual({ 'X-Total-Count': '101', 'X-Page': '2', 'X-Per-Page': '50', 'X-Total-Pages': '3' });
    setPaginationHeaders(res, { total: 0, page: 1, limit: 50 });
    expect(headers['X-Total-Pages']).toBe('1');
  });
});

describe('http errors', () => {
  test('factories set status codes', () => {
    expect(badRequest('x')).toBeInstanceOf(HttpError);
    expect(badRequest('x').status).toBe(400);
    expect(unauthorized().status).toBe(401);
    expect(unauthorized().message).toBe('Not authorized');
    expect(notFound().status).toBe(404);
    expect(conflict('x', { n: 1 }).details).toEqual({ n: 1 });
  });

  test('asyncHandler forwards rejections to next()', async () => {
    const boom = new Error('boom');
    const next = jest.fn();
    await asyncHandler(async () => {
      throw boom;
    })({}, {}, next);
    expect(next).toHaveBeenCalledWith(boom);
  });
});

describe('invoice effective status', () => {
  const inv = (status, dueDate) => ({ status, dueDate: new Date(`${dueDate}T00:00:00Z`) });
  test('paid stays paid, even when long past due', () => {
    expect(effectiveStatus(inv('paid', '2020-01-01'), '2026-10-02')).toBe('paid');
  });
  test('unpaid becomes overdue only after the due date has passed', () => {
    expect(effectiveStatus(inv('unpaid', '2026-10-02'), '2026-10-02')).toBe('unpaid'); // due today is not late yet
    expect(effectiveStatus(inv('unpaid', '2026-10-01'), '2026-10-02')).toBe('overdue');
  });
  test('a manually "overdue" invoice due in the future is not overdue', () => {
    expect(effectiveStatus(inv('overdue', '2026-12-01'), '2026-10-02')).toBe('unpaid');
  });
});

describe('summary helpers', () => {
  test('lastMonths returns n months ending at the current one, across years', () => {
    expect(lastMonths('2026-10-15', 6)).toEqual(['2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10']);
    expect(lastMonths('2026-02-01', 4)).toEqual(['2025-11', '2025-12', '2026-01', '2026-02']);
  });
});

describe('serializers', () => {
  const populatedClient = { _id: 'c1', name: 'Acme', email: 'a@x.com', company: 'Acme Inc' };

  test('taskJSON strips internals and flattens the client', () => {
    const out = taskJSON(
      { _id: 't1', userId: 'u', __v: 0, expiresAt: new Date(), title: 'T', completed: false, dueDate: new Date('2026-10-01T00:00:00Z'), clientId: populatedClient },
      '2026-10-02'
    );
    expect(out).toMatchObject({ _id: 't1', title: 'T', clientId: 'c1', overdue: true, client: { _id: 'c1', name: 'Acme' } });
    expect(out).not.toHaveProperty('userId');
    expect(out).not.toHaveProperty('__v');
    expect(out).not.toHaveProperty('expiresAt');
  });

  test('taskJSON without a client or due date', () => {
    const out = taskJSON({ _id: 't2', title: 'T', completed: false, dueDate: null, clientId: null }, '2026-10-02');
    expect(out).toMatchObject({ clientId: null, client: null, overdue: false });
  });

  test('a completed task is never overdue', () => {
    expect(taskJSON({ _id: 't3', completed: true, dueDate: new Date('2020-01-01'), clientId: null }, '2026-10-02').overdue).toBe(false);
  });

  test('bare ObjectId-like clientId yields an id but no client object', () => {
    const out = taskJSON({ _id: 't4', completed: false, clientId: { toString: () => 'abc123' } }, '2026-10-02');
    expect(out.clientId).toBe('abc123');
    expect(out.client).toBeNull();
  });

  test('invoiceJSON adds effective status', () => {
    const out = invoiceJSON({ _id: 'i1', userId: 'u', status: 'unpaid', dueDate: new Date('2026-09-01T00:00:00Z'), amount: 5, clientId: populatedClient }, '2026-10-02');
    expect(out).toMatchObject({ effectiveStatus: 'overdue', overdue: true, clientId: 'c1' });
  });

  test('clientJSON strips internals', () => {
    expect(clientJSON({ _id: 'c', userId: 'u', __v: 1, expiresAt: 1, name: 'N' })).toEqual({ _id: 'c', name: 'N' });
  });
});
