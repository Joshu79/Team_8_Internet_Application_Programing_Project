const request = require('supertest');
// These must be set BEFORE the app loads, because the rate limit reads them at startup.
process.env.API_KEYS = 'test-key'; // test-only key
process.env.RATE_LIMIT_PER_MIN = '5'; // small limit so the test can reach 429 quickly
const app = require('../index');
const db = require('../db');

const TEST_USER = 'usr_test_security';
const AUTH = { 'X-API-Key': 'test-key' };

beforeAll(async () => {
  await db.query('DELETE FROM budgets WHERE user_id = ?', [TEST_USER]);
  await db.query(
    `INSERT INTO budgets (user_id, monthly_limit, remaining, currency, updated_at)
     VALUES (?, 13000.00, 8700.00, 'KES', '2026-09-07 14:32:00')`,
    [TEST_USER]
  );
});

afterAll(async () => {
  await db.query('DELETE FROM budgets WHERE user_id = ?', [TEST_USER]);
  await db.end();
});

describe('API key', () => {
  it('a valid key gets 200 on a protected route', async () => {
    const res = await request(app).get(`/v1/users/${TEST_USER}/budget`).set(AUTH);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('remaining', 8700);
  });
});

describe('rate limiting', () => {
  it('returns 429 with Retry-After and a JSON body once the limit is passed', async () => {
    let limited = null;
    // The limit is 5 per minute, so 10 requests must hit it.
    for (let i = 0; i < 10 && !limited; i++) {
      const res = await request(app).get(`/v1/users/${TEST_USER}/budget`).set(AUTH);
      if (res.status === 429) limited = res;
    }
    expect(limited).not.toBeNull();
    expect(limited.headers['retry-after']).toBeDefined();
    expect(limited.body).toHaveProperty('code', 'RATE_LIMITED');
  });
});
