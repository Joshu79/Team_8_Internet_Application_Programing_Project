const express = require('express');
const cors = require('cors');
const db = require('./db'); // your existing MySQL connection

const app = express();
app.use(cors());          // lets Swagger (a different website) talk to this server
app.use(express.json());

// The contract says every request needs "Authorization: Bearer <token>".
// For now this only checks that the header is there; real token checking comes later.
function requireBearer(req, res, next) {
  const header = req.get('Authorization') || '';
  if (!header.startsWith('Bearer ') || header.length <= 'Bearer '.length) {
    return res.status(401).json({
      code: 'UNAUTHORIZED',
      message: 'Missing or invalid authentication token.',
    });
  }
  next();
}

// THE MAPPING STEP: database row -> exactly the Budget schema in openapi.yaml
function toBudget(row) {
  return {
    userId: row.user_id,                     // rename snake_case -> camelCase
    monthlyLimit: Number(row.monthly_limit), // MySQL DECIMAL comes back as a string; make it a number
    remaining: Number(row.remaining),
    currency: row.currency,
    updatedAt: new Date(row.updated_at).toISOString().replace(/\.\d{3}Z$/, 'Z'), // ISO date-time
  };
}

// GET /users/{id}/budget  (operationId: getUserBudget)
app.get('/v1/users/:id/budget', requireBearer, async (req, res) => {
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

// Any route that doesn't exist -> 404 in the same Error shape
app.use((req, res) => {
  res.status(404).json({ code: 'NOT_FOUND', message: `No route for ${req.method} ${req.path}.` });
});

// If something crashes (e.g. database is off), reply cleanly instead of hanging
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Something went wrong on the server.' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Pesa Tracker API running at http://localhost:${PORT}/v1`);
});
