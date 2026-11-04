require('dotenv').config();
const express = require('express');
const cors = require('cors');
const db = require('./db');
const { fetchWithRetry } = require('./resilientFetch'); // your existing MySQL connection
const { rateLimit } = require('express-rate-limit');

const app = express();
app.use(cors());          // lets Swagger (a different website) talk to this server
app.use(express.json());
// Keys come from .env (API_KEYS), never from the code.
const VALID_KEYS = (process.env.API_KEYS || '')
  .split(',')
  .map((k) => k.trim())   // ignore stray spaces or newlines around a key
  .filter(Boolean);
console.log(`Loaded ${VALID_KEYS.length} API keys`); // prints the count only, never the keys

function requireApiKey(req, res, next) {
  const key = req.get('X-API-Key');
  if (!key || !VALID_KEYS.includes(key)) {
    return res.status(401).json({
      code: 'UNAUTHORIZED',
      message: 'Missing or invalid API key.',
    });
  }
  req.apiKey = key;
  next();
}

// Health check: open http://localhost:5000/ or /v1 in a browser to see the server is up
app.get(['/', '/v1'], (req, res) => {
  res.json({
    status: 'ok',
    message: 'Pesa Tracker API is running',
    docs: 'See README.md for how to call the endpoints',
  });
});

//app.use(requireApiKey); // runs before every route below, including the partner one

// Read-only integration with the partner's monthly expenditure summary.
// The partner URL and user ID are configured in server/.env.
// Keeps the last good partner summary for each month, so we can fall back to it.
const lastGoodByMonth = new Map();

app.get('/v1/partner/expenses/summary', async (req, res) => {
  const partnerUrl = process.env.PARTNER_API_URL?.replace(/\/$/, '');
  const partnerUserId = process.env.PARTNER_USER_ID;
  const month = req.query.month;

  if (!partnerUrl || !partnerUserId) {
    return res.status(503).json({ message: 'Partner spending is not configured yet.' });
  }
  if (typeof month !== 'string' || !/^\d{4}-\d{2}$/.test(month)) {
    return res.status(400).json({ message: 'month must use YYYY-MM format.' });
  }

  // If the partner fails, send the saved copy (marked stale) or a friendly message.
  const sendFallback = (reason) => {
    console.error('Partner spending unavailable:', reason);
    const saved = lastGoodByMonth.get(month);
    if (saved) return res.json({ ...saved, stale: true });
    return res.status(502).json({ message: 'Partner spending is unavailable right now.' });
  };

  try {
    const url = `${partnerUrl}/users/${encodeURIComponent(partnerUserId)}/expenses/summary?month=${encodeURIComponent(month)}`;
    const response = await fetchWithRetry(url, { headers: { Accept: 'application/json' } }, { timeoutMs: 1500, retries: 2, delayMs: 200 });
    if (!response.ok) return sendFallback(`partner returned ${response.status}`);

    const summary = await response.json();
    const requiredFields = ['userId', 'month', 'totalSpent', 'monthlyAllowance', 'remaining'];
    const validSummary = summary && requiredFields.every((field) => field in summary) &&
      ['totalSpent', 'monthlyAllowance', 'remaining'].every((field) => Number.isFinite(summary[field]));
    if (!validSummary) return sendFallback('response did not match the documented shape');

    const good = {
      userId: summary.userId,
      month: summary.month,
      totalSpent: summary.totalSpent,
      monthlyAllowance: summary.monthlyAllowance,
      remaining: summary.remaining,
      stale: false,
      asOf: new Date().toISOString(),
    };
    lastGoodByMonth.set(month, good);
    return res.json(good);
  } catch (err) {
    const reason = err.name === 'TimeoutError' ? 'timeout' : (err.cause?.code || err.message);
    return sendFallback(reason);
  }
});

app.use(requireApiKey);
// Rate limit: each API key gets N requests per minute (default 60).
const limiter = rateLimit({
  windowMs: 60 * 1000,
  limit: Number(process.env.RATE_LIMIT_PER_MIN) || 60,
  keyGenerator: (req) => req.apiKey,   // count per consumer key, set by requireApiKey
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: (req, res) => {
    const seconds = Math.max(1, Math.ceil((req.rateLimit.resetTime - Date.now()) / 1000));
    res.set('Retry-After', String(seconds));
    res.status(429).json({
      code: 'RATE_LIMITED',
      message: `Too many requests. Try again in ${seconds} seconds.`,
    });
  },
});
app.use(limiter);

// THE MAPPING STEP: database row -> exactly the Budget schema in openapi.yaml
function toBudget(row) {
  return {
    //user_id: row.user_id,
    userId: row.user_id,                     // rename snake_case -> camelCase
    monthlyLimit: Number(row.monthly_limit), // MySQL DECIMAL comes back as a string; make it a number
    remaining: Number(row.remaining),
    currency: row.currency,
    updatedAt: new Date(row.updated_at).toISOString().replace(/\.\d{3}Z$/, 'Z'), // ISO date-time
  };
}


// GET /users/{id}/budget  (operationId: getUserBudget)
app.get('/v1/users/:id/budget',         async (req, res) => {
  // 1. Fetch real data. Selecting only these columns keeps internal ones (like id) out.
  const [rows] = await db.query(
    'SELECT user_id, monthly_limit, remaining, currency, updated_at FROM budgets WHERE user_id = ?',
    [req.params.id]
  );

  // 2. Not found -> 404 with the contract's Error shape
  if (rows.length === 0) {
    return res.status(404).json({
      code: 'NOT_FOUND',
      message: `No budget found for user ${req.params.id}.`,
    });
  }

  // 3. Found -> 200 with the shaped Budget
  return res.status(200).json(toBudget(rows[0]));
});

app.patch('/v1/users/:id/budget', async (req, res) => {
  const { action, amount, currency } = req.body || {};

  // ---------- VALIDATION (your checks from before) ----------
  if (action !== 'update' && action !== 'deduct') {
    return res.status(400).json({ code: 'VALIDATION_ERROR', message: "action must be 'update' or 'deduct'." });
  }
  if (typeof amount !== 'number' || amount <= 0) {
    return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'amount must be a positive number above 0.' });
  }
  if (currency !== 'KES') {
    return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'currency must be KES.' });
  }

  // ---------- STEP 1: does this budget exist? ----------
  const [rows] = await db.query('SELECT * FROM budgets WHERE user_id = ?', [req.params.id]);
  if (rows.length === 0) {
    return res.status(404).json({ code: 'NOT_FOUND', message: `No budget found for user ${req.params.id}.` });
  }
  const budget = rows[0];
  const now = new Date();

  // ---------- STEP 2: make the change ----------
  if (action === 'update') {
    await db.query(
      'UPDATE budgets SET monthly_limit = ?, updated_at = ? WHERE user_id = ?',
      [amount, now, req.params.id]
    );
  } else {
    if (amount > Number(budget.remaining)) {
      return res.status(422).json({ code: 'BUDGET_EXCEEDED', message: "This deduction would put the user's budget below zero." });
    }
    await db.query(
      'UPDATE budgets SET remaining = remaining - ?, updated_at = ? WHERE user_id = ?',
      [amount, now, req.params.id]
    );
  }

  // ---------- STEP 3: read it back and send it ----------
  const [updated] = await db.query(
    'SELECT user_id, monthly_limit, remaining, currency, updated_at FROM budgets WHERE user_id = ?',
    [req.params.id]
  );
  return res.status(200).json(toBudget(updated[0]));
});

app.delete('/v1/users/:id/budget',         async (req, res) => {
  const [result] = await db.query(
    'DELETE FROM budgets WHERE user_id = ?',
    [req.params.id]
  );

  // affectedRows = how many rows MySQL really deleted
  if (result.affectedRows === 0) {
    return res.status(404).json({
      code: 'NOT_FOUND',
      message: `No budget found for user ${req.params.id}.`,
    });
  }

  return res.status(204).end(); // 204 = deleted, nothing to send back
});

// MAPPING STEP: transactions row -> Transaction schema in the contract
function toTransaction(row) {
  return {
    id: `txn_${String(row.id).padStart(8, '0')}`, // DB id 1 -> "txn_00000001"
    userId: row.user_id,
    orderId: row.order_id,
    amount: Number(row.amount),
    items: typeof row.items === 'string' ? JSON.parse(row.items) : row.items,
    currency: row.currency,
    createdAt: new Date(row.created_at).toISOString().replace(/\.\d{3}Z$/, 'Z'),
  };
}

app.post('/v1/users/:id/transactions',         async (req, res) => {
  const { orderId, amount, items, currency, placedAt } = req.body || {};

  // ---------- VALIDATION (from the TransactionInput schema) ----------
  if (typeof orderId !== 'string' || orderId.trim() === '') {
    return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'orderId must be a non-empty string.' });
  }
  if (typeof amount !== 'number' || amount <= 0) {
    return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'amount must be a positive number above 0.' });
  }
  if (!Array.isArray(items) || items.length === 0 ||
      !items.every((item) => typeof item === 'string' && item.trim() !== '')) {
    return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'items must be a list of at least one item name.' });
  }
  if (currency !== 'KES') {
    return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'currency must be KES.' });
  }
  // placedAt is optional, but if it's sent it must be a real date
  if (placedAt !== undefined && (typeof placedAt !== 'string' || isNaN(Date.parse(placedAt)))) {
    return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'placedAt must be a date-time like 2026-09-07T13:05:00Z.' });
  }

  // ---------- SAVE ORDER + DEDUCT, together or not at all ----------
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // Does the budget exist? (FOR UPDATE stops two orders clashing at the same moment)
    const [rows] = await conn.query(
      'SELECT remaining FROM budgets WHERE user_id = ? FOR UPDATE',
      [req.params.id]
    );
    if (rows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ code: 'NOT_FOUND', message: `No budget found for user ${req.params.id}.` });
    }
    if (amount > Number(rows[0].remaining)) {
      await conn.rollback();
      return res.status(422).json({ code: 'BUDGET_EXCEEDED', message: "This transaction would put the user's budget below zero." });
    }

    const now = new Date();
    const [insert] = await conn.query(
      `INSERT INTO transactions (user_id, order_id, amount, items, currency, placed_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [req.params.id, orderId, amount, JSON.stringify(items), currency,
       placedAt ? new Date(placedAt) : now, now]
    );
    await conn.query(
      'UPDATE budgets SET remaining = remaining - ?, updated_at = ? WHERE user_id = ?',
      [amount, now, req.params.id]
    );

    await conn.commit(); // both changes become permanent here

    const [created] = await conn.query('SELECT * FROM transactions WHERE id = ?', [insert.insertId]);
    return res.status(201).json(toTransaction(created[0])); // 201 = created
  } catch (err) {
    await conn.rollback(); // something failed, so undo everything
    throw err;
  } finally {
    conn.release(); // give the connection back to the pool
  }
});
// GET /users/{id}/transactions  (operationId: listTransactions)
app.get('/v1/users/:id/transactions', async (req, res) => {
  // 404 if the user has no budget (same rule as GET /budget)
  const [budgets] = await db.query(
    'SELECT 1 FROM budgets WHERE user_id = ?',
    [req.params.id]
  );
  if (budgets.length === 0) {
    return res.status(404).json({
      code: 'NOT_FOUND',
      message: `No budget found for user ${req.params.id}.`,
    });
  }

  const [rows] = await db.query(
    'SELECT * FROM transactions WHERE user_id = ? ORDER BY created_at DESC, id DESC',
    [req.params.id]
  );

  // Reuse the existing mapping step so the shape matches POST exactly
  return res.status(200).json(rows.map(toTransaction));
});

app.get('/v1/fitcoach/users/:id/summary', async (req, res) => {
  try {
    const r = await fetch(`${process.env.FITCOACH_URL}/users/${req.params.id}/expenses/summary`, {
      headers: { 'X-API-Key': process.env.FITCOACH_API_KEY }, // header name from their README
    });
    if (!r.ok) {
      console.error('fitcoach returned', r.status); // log the status, never the key
      return res.status(502).json({ code: 'UPSTREAM_ERROR', message: 'FitCoach data unavailable' });
    }
    const s = await r.json();
    res.json({ userId: req.params.id, totalSpent: s.totalSpent, remaining: s.remaining });
  } catch (err) {
    console.error('fitcoach call failed:', err.cause?.code || err.message);
    res.status(502).json({ code: 'UPSTREAM_ERROR', message: 'FitCoach data unavailable' });
  }
});

// Any route that doesn't exist -> 404 in the same Error shape
app.use((req, res) => {
  res.status(404).json({ code: 'NOT_FOUND', message: `No route for ${req.method} ${req.path}.` });
});

// If something crashes (e.g. database is off), reply cleanly instead of hanging
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Something went wrong on the server.' });
});

// Only start the server when you run "npm run dev", not when tests load this file
if (require.main === module) {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`Pesa Tracker API running at http://localhost:${PORT}/v1`);
  });
}

module.exports = app; // lets the test files use the app
