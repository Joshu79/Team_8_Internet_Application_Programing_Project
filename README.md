# Pesa Tracker API

Pesa Tracker keeps track of a university student's monthly food budget. The
StrathsBites food-ordering app uses it to check how much a student has left,
record each order, and deduct the cost from the budget. All money is in
Kenyan Shillings (KES).

- **Full reference docs:** open [`docs/index.html`](docs/index.html) in a browser (no setup needed)
- **Contract:** [`openapi.yaml`](openapi.yaml)

---

## Quickstart: your first call

If the API is already running (see "Run it locally" below, or use the URL the
team gave you instead of `localhost:5000`), open **Command Prompt (cmd)** and run:

```
curl -H "X-API-Key: <your-api-key>" http://localhost:5000/v1/users/usr_7f2a9c1e/budget
```

You should get back:

```json
{
  "userId": "usr_7f2a9c1e",
  "monthlyLimit": 13000,
  "remaining": 8700,
  "currency": "KES",
  "updatedAt": "2026-09-07T14:32:00Z"
}
```

(If other people have already used this server, `remaining` may be lower.)

> **Windows note:** use Command Prompt, not PowerShell. In PowerShell, `curl`
> is a different command and these examples won't work as written.

---

## Authentication

Every request needs this header:

X-API-Key: <your-api-key>

Each consumer has its own key. Ask the team for yours privately. Without a
valid key you get a `401`.

## Week 10: FitCoach spending summary

The Dashboard can show FitCoach's monthly expense summary. The Pesa Tracker
server calls the partner API so the partner URL and user ID stay out of the
browser. Configure these values in `server/.env` using `server/.env.example`:

```env
PARTNER_API_URL=https://your-partner-host
PARTNER_USER_ID=usr_1042
```

Use the live API root and user ID supplied by the partner. Include `/v1` in
the URL only if the partner's actual endpoint uses that prefix. The integration
calls `GET /users/{userId}/expenses/summary?month=YYYY-MM` and expects the
fields documented in the partner's OpenAPI contract. Start the backend on port
5000 and the Vite frontend; Vite proxies `/v1` requests to the backend. If the
partner is unavailable or not configured, the dashboard shows a clear message
and remains usable.

---

## Endpoints

All paths start with `http://localhost:5000/v1`. The test user
`usr_7f2a9c1e` exists in a fresh setup.

### Get a budget: `GET /users/{id}/budget`

```
curl -H "X-API-Key: <your-api-key>" http://localhost:5000/v1/users/usr_7f2a9c1e/budget
```

→ `200` with the budget (same as the Quickstart above).

### Change a budget: `PATCH /users/{id}/budget`

`action` must be `"update"` (set a new monthly limit) or `"deduct"`
(subtract from what's left). `amount` must be a number above 0, and
`currency` must be `"KES"`.

```
curl -X PATCH -H "X-API-Key: <your-api-key>" -H "Content-Type: application/json" -d "{\"action\":\"update\",\"amount\":15000,\"currency\":\"KES\"}" http://localhost:5000/v1/users/usr_7f2a9c1e/budget
```

→ `200`:

```json
{
  "userId": "usr_7f2a9c1e",
  "monthlyLimit": 15000,
  "remaining": 8700,
  "currency": "KES",
  "updatedAt": "2026-10-04T19:22:32Z"
}
```

(`updatedAt` will be the time of your request.)

### Record an order: `POST /users/{id}/transactions`

Saves the order **and** deducts `amount` from the budget's `remaining`.
`items` must have at least one item. `placedAt` is optional.

```
curl -X POST -H "X-API-Key: <your-api-key>" -H "Content-Type: application/json" -d "{\"orderId\":\"ord_1001\",\"amount\":450,\"items\":[\"Shawarma\"],\"currency\":\"KES\"}" http://localhost:5000/v1/users/usr_7f2a9c1e/transactions
```

→ `201`:

```json
{
  "id": "txn_00000001",
  "userId": "usr_7f2a9c1e",
  "orderId": "ord_1001",
  "amount": 450,
  "items": ["Shawarma"],
  "currency": "KES",
  "createdAt": "2026-10-04T19:40:59Z"
}
```

> Don't also call `PATCH` with `deduct` for the same order: `POST` already
> deducts, so the student would be charged twice.

### Delete a budget: `DELETE /users/{id}/budget`

```
curl -X DELETE -H "X-API-Key: <your-api-key>" http://localhost:5000/v1/users/usr_7f2a9c1e/budget
```

→ `204` with an empty body. This really deletes the test user. To get them
back, re-run the `INSERT` line from step 3 below.

---

## Errors

Every error has the same shape, so check the status code first and then `code`:

```json
{ "code": "NOT_FOUND", "message": "No budget found for user usr_nobody." }
```
| Status | `code` | When |
|---|---|---|
| 400 | `VALIDATION_ERROR` | A field is missing, has the wrong type, or is not allowed. |
| 401 | `UNAUTHORIZED` | The `X-API-Key` header is missing or invalid. |
| 404 | `NOT_FOUND` | The user has no budget, or the URL doesn't exist. |
| 422 | `BUDGET_EXCEEDED` | The requested deduction is greater than the remaining budget. |
| 429 | `RATE_LIMITED` | More than 60 requests in a minute on one key. Wait for `Retry-After` seconds. |
| 500 | `INTERNAL_ERROR` | Something broke on the server, usually because the database is unavailable. |
---

## Run it locally (from a fresh clone)

You need **Node.js 18+** and **MySQL 8**.

**1. Get the code and install packages**

```
git clone https://github.com/Joshu79/Team_8_Internet_Application_Programing_Project.git
cd Team_8_Internet_Application_Programing_Project\server
npm install
```

**2. Configure `server/.env`.** Start from `.env.example` if you do not have a
local `.env` yet. Keep any existing partner settings and add your own MySQL
connection details. Never commit this file.

```
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=pesa_tracker
API_KEYS=your-key-for-team,your-key-for-partner
```

**3. Create the database tables.** Open a MySQL client and run the schema file:

```text
SOURCE C:/path/to/Team_8_Internet_Application_Programing_Project/server/schema.sql;
```

For an existing database, run `server/migrations/001_app_accounts_and_categories.sql`
once instead. It adds the account/session tables and expense category column.
New users register through the app. To seed the sample user used by the
partner API Quickstart, optionally run:

```sql
INSERT IGNORE INTO budgets (user_id, monthly_limit, remaining, currency, updated_at)
VALUES ('usr_7f2a9c1e', 13000.00, 8700.00, 'KES', UTC_TIMESTAMP());
```

**4. Start the server** (still inside `server`):

```
npm run dev
```

You should see `Pesa Tracker API running at http://localhost:5000/v1`.
Then start the frontend from the repository root in a second terminal with
`npm run dev`, open its local URL, and create an account. The dashboard and
manual expense form require the database to be running.

The web app uses database-backed accounts and an HttpOnly session cookie. Its
budget and expense routes are separate from the existing API-key routes used by
partner applications; the partner API request and response contracts remain
unchanged.

The web app uses `GET /v1/app/dashboard?month=YYYY-MM`, `PUT /v1/app/budget`,
`POST /v1/app/budget/adjust`, and `POST /v1/app/expenses` after sign-in.
Monthly remaining balance is calculated from that month's saved transactions
and budget. Budget adjustments accept `add` and `subtract`; reductions cannot
make the budget itself negative. PDF statement parsing is not implemented yet;
the app currently supports manual entries.

**Run the automated tests:** `npx jest` (inside `server`)

## Rate limits

Each API key may make 60 requests per minute. Over the limit you get `429`
with `{"code":"RATE_LIMITED",...}` and a `Retry-After` header (seconds to wait).

## Request monitoring

Every request is written to the server terminal as one JSON line. Logs include
the timestamp, method, path without its query string, status, response time in
milliseconds, and a short API-key fingerprint. Keys, request bodies, and query
strings are not logged. Log files (`*.log`) are ignored by Git.

`GET http://localhost:5000/stats` (also available at `/v1/stats`) returns
in-memory totals since the server started. It requires a valid `X-API-Key` and
is subject to the API rate limit. Counts reset when the server restarts, and a
`/stats` request appears in the totals after its response has finished.

```sh
curl -H "X-API-Key: <your-api-key>" http://localhost:5000/stats
```

Example response:

```json
{
  "startedAt": "2026-11-04T08:00:00.000Z",
  "uptimeSeconds": 120,
  "total": 42,
  "clientErrors": 8,
  "serverErrors": 1,
  "errorRatePercent": 2.4,
  "avgMs": 4.7,
  "routes": {
    "GET /v1/users/:id/budget": {
      "count": 12,
      "clientErrors": 3,
      "serverErrors": 0,
      "avgMs": 5.2,
      "maxMs": 18.1
    }
  }
}
```
