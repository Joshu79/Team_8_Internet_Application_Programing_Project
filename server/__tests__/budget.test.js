const request = require('supertest');
const app = require('../index');
const db = require('../db');

const TEST_USER = 'usr_test_jest';
const AUTH = { Authorization: 'Bearer test' };

// ARRANGE (runs before EVERY test): give the test student a fresh, known budget
beforeEach(async () => {
  await db.query('DELETE FROM transactions WHERE user_id = ?', [TEST_USER]);
  await db.query('DELETE FROM budgets WHERE user_id = ?', [TEST_USER]);
  await db.query(
    `INSERT INTO budgets (user_id, monthly_limit, remaining, currency, updated_at)
     VALUES (?, 13000.00, 8700.00, 'KES', '2026-09-07 14:32:00')`,
    [TEST_USER]
  );
});

// After ALL tests: clean up and close the database, so Jest can finish
afterAll(async () => {
  await db.query('DELETE FROM transactions WHERE user_id = ?', [TEST_USER]);
  await db.query('DELETE FROM budgets WHERE user_id = ?', [TEST_USER]);
  await db.end();
});

describe('GET /users/{id}/budget', () => {
  it('returns 200 and a budget that matches the contract exactly', async () => {
    // ACT
    const res = await request(app).get(`/v1/users/${TEST_USER}/budget`).set(AUTH);

    // ASSERT: status
    expect(res.status).toBe(200);
    // ASSERT: exactly these 5 fields, no extras, none missing
    expect(Object.keys(res.body).sort()).toEqual(
      ['currency', 'monthlyLimit', 'remaining', 'updatedAt', 'userId']
    );
    // ASSERT: right types and values
    expect(res.body.userId).toBe(TEST_USER);
    expect(res.body.monthlyLimit).toBe(13000);         // a number, not "13000.00"
    expect(res.body.remaining).toBe(8700);
    expect(res.body.currency).toBe('KES');
    expect(res.body.updatedAt).toBe('2026-09-07T14:32:00Z'); // catches the timezone bug
  });

  it('returns 404 with an Error body for a user that does not exist', async () => {
    const res = await request(app).get('/v1/users/usr_nobody/budget').set(AUTH);

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('NOT_FOUND');
    expect(typeof res.body.message).toBe('string');
  });

  it('returns 401 when there is no token', async () => {
    const res = await request(app).get(`/v1/users/${TEST_USER}/budget`); // no .set(AUTH)

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHORIZED');
  });
});

describe('PATCH /users/{id}/budget', () => {
  it('update sets a new monthly limit (happy path)', async () => {
    const res = await request(app)
      .patch(`/v1/users/${TEST_USER}/budget`).set(AUTH)
      .send({ action: 'update', amount: 15000, currency: 'KES' });

    expect(res.status).toBe(200);
    expect(res.body.monthlyLimit).toBe(15000);
    expect(res.body.remaining).toBe(8700); // update must not touch remaining
  });

  it('sending the same update twice gives the same result (idempotent)', async () => {
    const body = { action: 'update', amount: 15000, currency: 'KES' };
    const first = await request(app).patch(`/v1/users/${TEST_USER}/budget`).set(AUTH).send(body);
    const second = await request(app).patch(`/v1/users/${TEST_USER}/budget`).set(AUTH).send(body);

    expect(second.body.monthlyLimit).toBe(first.body.monthlyLimit);
    expect(second.body.remaining).toBe(first.body.remaining);
  });

  it('deduct subtracts from remaining', async () => {
    const res = await request(app)
      .patch(`/v1/users/${TEST_USER}/budget`).set(AUTH)
      .send({ action: 'deduct', amount: 450, currency: 'KES' });

    expect(res.status).toBe(200);
    expect(res.body.remaining).toBe(8250);
  });

  it('rejects amount sent as text with 400, and changes nothing', async () => {
    const res = await request(app)
      .patch(`/v1/users/${TEST_USER}/budget`).set(AUTH)
      .send({ action: 'deduct', amount: '450', currency: 'KES' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');

    const check = await request(app).get(`/v1/users/${TEST_USER}/budget`).set(AUTH);
    expect(check.body.remaining).toBe(8700); // nothing was written
  });

  it('rejects a missing action with 400', async () => {
    const res = await request(app)
      .patch(`/v1/users/${TEST_USER}/budget`).set(AUTH)
      .send({ amount: 450, currency: 'KES' });
    expect(res.status).toBe(400);
  });

  it('edge case: deducting exactly the remaining balance is allowed (leaves 0)', async () => {
    const res = await request(app)
      .patch(`/v1/users/${TEST_USER}/budget`).set(AUTH)
      .send({ action: 'deduct', amount: 8700, currency: 'KES' });

    expect(res.status).toBe(200);
    expect(res.body.remaining).toBe(0);
  });

  it('edge case: deducting 1 shilling more than remaining returns 422', async () => {
    const res = await request(app)
      .patch(`/v1/users/${TEST_USER}/budget`).set(AUTH)
      .send({ action: 'deduct', amount: 8701, currency: 'KES' });

    expect(res.status).toBe(422);
    expect(res.body.code).toBe('BUDGET_EXCEEDED');
  });

  it('returns 404 for a user that does not exist', async () => {
    const res = await request(app)
      .patch('/v1/users/usr_nobody/budget').set(AUTH)
      .send({ action: 'update', amount: 15000, currency: 'KES' });
    expect(res.status).toBe(404);
  });
});

describe('DELETE /users/{id}/budget', () => {
  it('returns 204, and the budget is really gone afterwards', async () => {
    const res = await request(app).delete(`/v1/users/${TEST_USER}/budget`).set(AUTH);
    expect(res.status).toBe(204);
    expect(res.body).toEqual({}); // 204 has no body

    const check = await request(app).get(`/v1/users/${TEST_USER}/budget`).set(AUTH);
    expect(check.status).toBe(404);
  });

  it('returns 404 for a user that does not exist', async () => {
    const res = await request(app).delete('/v1/users/usr_nobody/budget').set(AUTH);
    expect(res.status).toBe(404);
  });
});