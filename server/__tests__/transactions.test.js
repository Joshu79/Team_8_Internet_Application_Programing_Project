const request = require('supertest');
const app = require('../index');
const db = require('../db');

const TEST_USER = 'usr_test_jest_txn';
const AUTH = { Authorization: 'Bearer test' };
const validOrder = { orderId: 'ord_test_1', amount: 450, items: ['Shawarma'], currency: 'KES' };

// ARRANGE: fresh test student with 8700 remaining, and no old transactions
beforeEach(async () => {
  await db.query('DELETE FROM transactions WHERE user_id = ?', [TEST_USER]);
  await db.query('DELETE FROM budgets WHERE user_id = ?', [TEST_USER]);
  await db.query(
    `INSERT INTO budgets (user_id, monthly_limit, remaining, currency, updated_at)
     VALUES (?, 13000.00, 8700.00, 'KES', '2026-09-07 14:32:00')`,
    [TEST_USER]
  );
});

afterAll(async () => {
  await db.query('DELETE FROM transactions WHERE user_id = ?', [TEST_USER]);
  await db.query('DELETE FROM budgets WHERE user_id = ?', [TEST_USER]);
  await db.end();
});

// Small helper: what's the student's remaining balance right now?
async function remaining() {
  const res = await request(app).get(`/v1/users/${TEST_USER}/budget`).set(AUTH);
  return res.body.remaining;
}

describe('POST /users/{id}/transactions', () => {
  it('returns 201 and a transaction that matches the contract exactly', async () => {
    const res = await request(app)
      .post(`/v1/users/${TEST_USER}/transactions`).set(AUTH).send(validOrder);

    expect(res.status).toBe(201);
    expect(Object.keys(res.body).sort()).toEqual(
      ['amount', 'createdAt', 'currency', 'id', 'items', 'orderId', 'userId']
    );
    expect(res.body.id).toMatch(/^txn_\d{8}$/);   // e.g. txn_00000001
    expect(res.body.userId).toBe(TEST_USER);
    expect(res.body.orderId).toBe('ord_test_1');
    expect(res.body.amount).toBe(450);            // a number, not "450.00"
    expect(res.body.items).toEqual(['Shawarma']);
    expect(res.body.currency).toBe('KES');
    expect(res.body.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
  });

  it('deducts the amount from the budget (side effect)', async () => {
    await request(app).post(`/v1/users/${TEST_USER}/transactions`).set(AUTH).send(validOrder);
    expect(await remaining()).toBe(8250);
  });

  it('rejects empty items with 400, and deducts nothing', async () => {
    const res = await request(app)
      .post(`/v1/users/${TEST_USER}/transactions`).set(AUTH)
      .send({ ...validOrder, items: [] });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
    expect(await remaining()).toBe(8700);
  });

  it('rejects amount sent as text with 400', async () => {
    const res = await request(app)
      .post(`/v1/users/${TEST_USER}/transactions`).set(AUTH)
      .send({ ...validOrder, amount: '450' });
    expect(res.status).toBe(400);
  });

  it('rejects a missing orderId with 400', async () => {
    const { orderId, ...noOrderId } = validOrder;
    const res = await request(app)
      .post(`/v1/users/${TEST_USER}/transactions`).set(AUTH).send(noOrderId);
    expect(res.status).toBe(400);
  });

  it('rejects an invalid placedAt with 400', async () => {
    const res = await request(app)
      .post(`/v1/users/${TEST_USER}/transactions`).set(AUTH)
      .send({ ...validOrder, placedAt: 'yesterday' });
    expect(res.status).toBe(400);
  });

  it('returns 422 when the order costs more than what is left, and deducts nothing', async () => {
    const res = await request(app)
      .post(`/v1/users/${TEST_USER}/transactions`).set(AUTH)
      .send({ ...validOrder, amount: 8701 });

    expect(res.status).toBe(422);
    expect(res.body.code).toBe('BUDGET_EXCEEDED');
    expect(await remaining()).toBe(8700);
  });

  it('returns 404 for a user that does not exist', async () => {
    const res = await request(app)
      .post('/v1/users/usr_nobody/transactions').set(AUTH).send(validOrder);
    expect(res.status).toBe(404);
  });
});