require('dotenv').config();
const express = require('express');
const cors = require('cors');
const db = require('./db');
const { fetchWithRetry } = require('./resilientFetch'); // your existing MySQL connection
const { rateLimit } = require('express-rate-limit');
const { createHash, randomBytes, randomUUID, scrypt, timingSafeEqual } = require('node:crypto');
const { promisify } = require('node:util');
const { monitor, statsHandler } = require('./monitoring');

const app = express();
app.use(monitor); // first so rejected requests are logged too
app.use(cors());          // lets Swagger (a different website) talk to this server
app.use(express.json());
// Keys come from .env (API_KEYS), never from the code.
const VALID_KEYS = (process.env.API_KEYS || '')
  .split(',')
  .map((k) => k.trim())   // ignore stray spaces or newlines around a key
  .filter(Boolean);
console.log(`Loaded ${VALID_KEYS.length} API keys`); // prints the count only, never the keys

const scryptAsync = promisify(scrypt);
const SESSION_COOKIE = 'pesa_tracker_session';
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;
const EXPENSE_CATEGORIES = new Set([
  'Food', 'Transport', 'Airtime', 'Entertainment', 'Rent',
  'Education', 'Health', 'Shopping', 'Other', 'Campus & supplies',
  'Subscriptions', 'Fitness', 'Utilities', 'Personal care',
  'Family & support', 'Savings', 'Travel',
]);

function readCookie(req, name) {
  const prefix = `${name}=`;
  const cookie = (req.headers.cookie || '').split(';').map((part) => part.trim()).find((part) => part.startsWith(prefix));
  if (!cookie) return null;
  try {
    return decodeURIComponent(cookie.slice(prefix.length));
  } catch {
    return null;
  }
}

function setSessionCookie(res, token) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_DURATION_MS / 1000}${secure}`);
}

function clearSessionCookie(res) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure}`);
}

function safeUser(row) {
  return { id: row.user_id, name: row.display_name, email: row.email, phone: row.phone || '' };
}

async function createAppSession(userId, res) {
  const token = randomBytes(32).toString('hex');
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS).toISOString().slice(0, 19).replace('T', ' ');
  await db.query(
    'INSERT INTO app_sessions (session_hash, user_id, expires_at) VALUES (?, ?, ?)',
    [tokenHash, userId, expiresAt]
  );
  setSessionCookie(res, token);
}

async function requireSession(req, res, next) {
  try {
    const token = readCookie(req, SESSION_COOKIE);
    if (!token) return res.status(401).json({ code: 'UNAUTHORIZED', message: 'Please sign in to continue.' });
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const [rows] = await db.query(
      `SELECT u.user_id, u.display_name, u.email, u.phone
       FROM app_sessions s JOIN app_users u ON u.user_id = s.user_id
       WHERE s.session_hash = ? AND s.expires_at > UTC_TIMESTAMP()`,
      [tokenHash]
    );
    if (!rows.length) {
      clearSessionCookie(res);
      return res.status(401).json({ code: 'UNAUTHORIZED', message: 'Your session has expired. Please sign in again.' });
    }
    req.appUser = safeUser(rows[0]);
    req.sessionHash = tokenHash;
    return next();
  } catch (error) {
    return next(error);
  }
}

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { code: 'RATE_LIMITED', message: 'Too many sign-in attempts. Please try again later.' },
});

function monthBounds(month) {
  if (typeof month !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return null;
  const [year, monthNumber] = month.split('-').map(Number);
  const nextMonth = new Date(Date.UTC(year, monthNumber, 1)).toISOString().slice(0, 10);
  return { start: `${month}-01`, end: nextMonth };
}

function isValidDate(date) {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const parsed = new Date(`${date}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date;
}

function currentLocalMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function transactionDescription(row) {
  const items = typeof row.items === 'string' ? JSON.parse(row.items) : row.items;
  return Array.isArray(items) && items.length ? items.join(', ') : 'Expense';
}

function appExpense(row) {
  return {
    id: `txn_${String(row.id).padStart(8, '0')}`,
    amount: Number(row.amount),
    description: transactionDescription(row),
    category: row.category || 'Other',
    date: new Date(row.placed_at).toISOString().slice(0, 10),
    currency: row.currency,
  };
}

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

// First-party web app account routes use an HttpOnly server-side session.
// Partner API keys are never exposed to browser JavaScript.
app.post('/v1/app/auth/register', authLimiter, async (req, res) => {
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  const phone = typeof req.body?.phone === 'string' && req.body.phone.trim() ? req.body.phone.trim() : null;

  if (!name || name.length > 80) {
    return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Name must be between 1 and 80 characters.' });
  }
  if (email.length > 255 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Enter a valid email address.' });
  }
  if (password.length < 8 || password.length > 200) {
    return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Password must be at least 8 characters.' });
  }
  if (phone && phone.length > 30) {
    return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Phone number must be 30 characters or fewer.' });
  }

  const salt = randomBytes(16);
  const passwordHash = (await scryptAsync(password, salt, 64)).toString('hex');
  const userId = `usr_${randomBytes(8).toString('hex')}`;
  try {
    await db.query(
      'INSERT INTO app_users (user_id, display_name, email, phone, password_hash) VALUES (?, ?, ?, ?, ?)',
      [userId, name, email, phone, `${salt.toString('hex')}:${passwordHash}`]
    );
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ code: 'EMAIL_IN_USE', message: 'An account with that email already exists.' });
    }
    throw error;
  }

  const user = { id: userId, name, email, phone: phone || '' };
  await createAppSession(userId, res);
  res.set('Cache-Control', 'no-store');
  return res.status(201).json({ user });
});

app.post('/v1/app/auth/login', authLimiter, async (req, res) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  const [rows] = await db.query(
    'SELECT user_id, display_name, email, phone, password_hash FROM app_users WHERE email = ?',
    [email]
  );
  if (!password) {
    return res.status(401).json({ code: 'UNAUTHORIZED', message: 'Email or password is incorrect.' });
  }

  const [saltHex, expectedHex] = rows.length
    ? rows[0].password_hash.split(':')
    : ['00'.repeat(16), '00'.repeat(64)];
  const expected = Buffer.from(expectedHex || '', 'hex');
  const actual = await scryptAsync(password, Buffer.from(saltHex, 'hex'), expected.length || 64);
  if (!rows.length || expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return res.status(401).json({ code: 'UNAUTHORIZED', message: 'Email or password is incorrect.' });
  }

  await createAppSession(rows[0].user_id, res);
  res.set('Cache-Control', 'no-store');
  return res.json({ user: safeUser(rows[0]) });
});

app.get('/v1/app/auth/me', requireSession, (req, res) => {
  res.set('Cache-Control', 'no-store');
  return res.json({ user: req.appUser });
});

app.post('/v1/app/auth/logout', requireSession, async (req, res) => {
  await db.query('DELETE FROM app_sessions WHERE session_hash = ?', [req.sessionHash]);
  clearSessionCookie(res);
  return res.status(204).end();
});

// These UI routes derive the user ID from the signed-in session. They do not
// replace or change the API-key-protected routes used by partner applications.
app.use('/v1/app', requireSession);

app.get('/v1/app/dashboard', async (req, res) => {
  const month = req.query.month || currentLocalMonth();
  const bounds = monthBounds(month);
  if (!bounds) return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'month must be a valid YYYY-MM value.' });

  const [budgetRows] = await db.query(
    'SELECT monthly_limit FROM app_monthly_budgets WHERE user_id = ? AND month = ?',
    [req.appUser.id, month]
  );
  const [rows] = await db.query(
    `SELECT id, amount, items, currency, placed_at, category
     FROM transactions
     WHERE user_id = ? AND placed_at >= ? AND placed_at < ?
     ORDER BY placed_at DESC, id DESC`,
    [req.appUser.id, bounds.start, bounds.end]
  );

  const expenses = rows.map(appExpense);
  const totalSpent = expenses.reduce((total, expense) => total + expense.amount, 0);
  const monthlyBudget = budgetRows.length ? Number(budgetRows[0].monthly_limit) : null;
  const categories = {};
  for (const expense of expenses) categories[expense.category] = (categories[expense.category] || 0) + expense.amount;

  res.set('Cache-Control', 'no-store');
  return res.json({
    month,
    monthlyBudget,
    totalSpent,
    remaining: monthlyBudget === null ? null : monthlyBudget - totalSpent,
    categories,
    expenses,
  });
});

app.put('/v1/app/budget', async (req, res) => {
  const { month, monthlyBudget } = req.body || {};
  const bounds = monthBounds(month);
  if (!bounds) return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'month must be a valid YYYY-MM value.' });
  if (typeof monthlyBudget !== 'number' || !Number.isFinite(monthlyBudget) || monthlyBudget <= 0 || monthlyBudget > 99999999.99) {
    return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'monthlyBudget must be a positive amount up to KES 99,999,999.99.' });
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query('SELECT user_id FROM app_users WHERE user_id = ? FOR UPDATE', [req.appUser.id]);
    const [spentRows] = await conn.query(
      `SELECT COALESCE(SUM(amount), 0) AS total_spent
       FROM transactions WHERE user_id = ? AND placed_at >= ? AND placed_at < ?`,
      [req.appUser.id, bounds.start, bounds.end]
    );
    const totalSpent = Number(spentRows[0].total_spent);
    await conn.query(
      `INSERT INTO app_monthly_budgets (user_id, month, monthly_limit, updated_at)
       VALUES (?, ?, ?, UTC_TIMESTAMP())
       ON DUPLICATE KEY UPDATE monthly_limit = VALUES(monthly_limit), updated_at = UTC_TIMESTAMP()`,
      [req.appUser.id, month, monthlyBudget]
    );

    // Mirror the current-month budget into the existing partner-facing budget
    // resource so its route and response contract remain compatible.
    if (month === currentLocalMonth()) {
      await conn.query(
        `INSERT INTO budgets (user_id, monthly_limit, remaining, currency, updated_at)
         VALUES (?, ?, ?, 'KES', UTC_TIMESTAMP())
         ON DUPLICATE KEY UPDATE monthly_limit = VALUES(monthly_limit), remaining = VALUES(remaining), updated_at = UTC_TIMESTAMP()`,
        [req.appUser.id, monthlyBudget, monthlyBudget - totalSpent]
      );
    }
    await conn.commit();
    return res.json({ month, monthlyBudget, totalSpent, remaining: monthlyBudget - totalSpent });
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
});

app.post('/v1/app/budget/adjust', async (req, res) => {
  const { month, action, amount } = req.body || {};
  const bounds = monthBounds(month);
  if (!bounds) return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'month must be a valid YYYY-MM value.' });
  if (action !== 'add' && action !== 'subtract') {
    return res.status(400).json({ code: 'VALIDATION_ERROR', message: "action must be 'add' or 'subtract'." });
  }
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0 || amount > 99999999.99) {
    return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Adjustment must be a positive amount up to KES 99,999,999.99.' });
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query('SELECT user_id FROM app_users WHERE user_id = ? FOR UPDATE', [req.appUser.id]);
    const [appBudgets] = await conn.query(
      'SELECT monthly_limit FROM app_monthly_budgets WHERE user_id = ? AND month = ? FOR UPDATE',
      [req.appUser.id, month]
    );
    let currentBudget = appBudgets.length ? Number(appBudgets[0].monthly_limit) : null;

    // Preserve budgets originally created through the partner-facing API.
    if (currentBudget === null && month === currentLocalMonth()) {
      const [legacyBudgets] = await conn.query(
        'SELECT monthly_limit FROM budgets WHERE user_id = ? FOR UPDATE',
        [req.appUser.id]
      );
      if (legacyBudgets.length) currentBudget = Number(legacyBudgets[0].monthly_limit);
    }
    if (currentBudget === null) currentBudget = 0;
    if (action === 'subtract' && currentBudget === 0) {
      await conn.rollback();
      return res.status(409).json({ code: 'BUDGET_NOT_SET', message: 'Set a budget before reducing it.' });
    }

    const adjustedBudget = Math.round((currentBudget + (action === 'add' ? amount : -amount) + Number.EPSILON) * 100) / 100;
    if (adjustedBudget < 0) {
      await conn.rollback();
      return res.status(422).json({ code: 'BUDGET_TOO_LOW', message: 'The reduction cannot make the budget less than zero.' });
    }
    if (adjustedBudget > 99999999.99) {
      await conn.rollback();
      return res.status(422).json({ code: 'BUDGET_TOO_HIGH', message: 'The adjusted budget cannot exceed KES 99,999,999.99.' });
    }

    const [spentRows] = await conn.query(
      `SELECT COALESCE(SUM(amount), 0) AS total_spent
       FROM transactions WHERE user_id = ? AND placed_at >= ? AND placed_at < ?`,
      [req.appUser.id, bounds.start, bounds.end]
    );
    const totalSpent = Number(spentRows[0].total_spent);
    await conn.query(
      `INSERT INTO app_monthly_budgets (user_id, month, monthly_limit, updated_at)
       VALUES (?, ?, ?, UTC_TIMESTAMP())
       ON DUPLICATE KEY UPDATE monthly_limit = VALUES(monthly_limit), updated_at = UTC_TIMESTAMP()`,
      [req.appUser.id, month, adjustedBudget]
    );

    if (month === currentLocalMonth()) {
      await conn.query(
        `INSERT INTO budgets (user_id, monthly_limit, remaining, currency, updated_at)
         VALUES (?, ?, ?, 'KES', UTC_TIMESTAMP())
         ON DUPLICATE KEY UPDATE monthly_limit = VALUES(monthly_limit), remaining = VALUES(remaining), updated_at = UTC_TIMESTAMP()`,
        [req.appUser.id, adjustedBudget, adjustedBudget - totalSpent]
      );
    }

    await conn.commit();
    return res.json({ month, monthlyBudget: adjustedBudget, totalSpent, remaining: adjustedBudget - totalSpent });
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
});

app.post('/v1/app/expenses', async (req, res) => {
  const { amount, category, description, date } = req.body || {};
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0 || amount > 10000000) {
    return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'amount must be a positive amount up to KES 10,000,000.' });
  }
  if (typeof category !== 'string' || !EXPENSE_CATEGORIES.has(category)) {
    return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Choose a valid expense category.' });
  }
  if (typeof description !== 'string' || !description.trim() || description.trim().length > 180) {
    return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Description must be between 1 and 180 characters.' });
  }
  if (!isValidDate(date)) {
    return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'date must be a real date in YYYY-MM-DD format.' });
  }

  const placedAt = new Date(`${date}T12:00:00.000Z`);
  const orderId = `manual_${randomUUID()}`;
  const entryMonth = date.slice(0, 7);
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [insert] = await conn.query(
      `INSERT INTO transactions (user_id, order_id, amount, items, currency, placed_at, created_at, category)
       VALUES (?, ?, ?, ?, 'KES', ?, UTC_TIMESTAMP(), ?)`,
      [req.appUser.id, orderId, amount, JSON.stringify([description.trim()]), placedAt, category]
    );

    if (entryMonth === currentLocalMonth()) {
      const [budgetRows] = await conn.query(
        'SELECT monthly_limit FROM app_monthly_budgets WHERE user_id = ? AND month = ?',
        [req.appUser.id, entryMonth]
      );
      if (budgetRows.length) {
        const [spentRows] = await conn.query(
          `SELECT COALESCE(SUM(amount), 0) AS total_spent
           FROM transactions WHERE user_id = ? AND placed_at >= ? AND placed_at < ?`,
          [req.appUser.id, `${entryMonth}-01`, monthBounds(entryMonth).end]
        );
        await conn.query(
          'UPDATE budgets SET remaining = ?, updated_at = UTC_TIMESTAMP() WHERE user_id = ?',
          [Number(budgetRows[0].monthly_limit) - Number(spentRows[0].total_spent), req.appUser.id]
        );
      }
    }

    const [createdRows] = await conn.query(
      'SELECT id, amount, items, currency, placed_at, category FROM transactions WHERE id = ?',
      [insert.insertId]
    );
    await conn.commit();
    return res.status(201).json({ expense: appExpense(createdRows[0]) });
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
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
app.get(['/stats', '/v1/stats'], statsHandler);

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
    await db.query(
      'UPDATE app_monthly_budgets SET monthly_limit = ?, updated_at = UTC_TIMESTAMP() WHERE user_id = ? AND month = ?',
      [amount, req.params.id, currentLocalMonth()]
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
  const server = app.listen(PORT);
  server.on('listening', () => {
    console.log(`Pesa Tracker API running at http://localhost:${PORT}/v1`);
  });
  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`Port ${PORT} is already in use. Stop the other process using it, then restart the API.`);
      return;
    }
    console.error('Pesa Tracker API failed to start:', error.message);
  });
}

module.exports = app; // lets the test files use the app
