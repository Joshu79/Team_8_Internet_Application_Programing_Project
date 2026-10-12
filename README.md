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
curl -H "Authorization: Bearer test" http://localhost:5000/v1/users/usr_7f2a9c1e/budget
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

```
Authorization: Bearer <token>
```

For now, **any non-empty token works**, e.g. `Bearer test`. Real token
checking is coming later. Without the header you get a `401`.

---

## Endpoints

All paths start with `http://localhost:5000/v1`. The test user
`usr_7f2a9c1e` exists in a fresh setup.

### Get a budget: `GET /users/{id}/budget`

```
curl -H "Authorization: Bearer test" http://localhost:5000/v1/users/usr_7f2a9c1e/budget
```

→ `200` with the budget (same as the Quickstart above).

### Change a budget: `PATCH /users/{id}/budget`

`action` must be `"update"` (set a new monthly limit) or `"deduct"`
(subtract from what's left). `amount` must be a number above 0, and
`currency` must be `"KES"`.

```
curl -X PATCH -H "Authorization: Bearer test" -H "Content-Type: application/json" -d "{\"action\":\"update\",\"amount\":15000,\"currency\":\"KES\"}" http://localhost:5000/v1/users/usr_7f2a9c1e/budget
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
curl -X POST -H "Authorization: Bearer test" -H "Content-Type: application/json" -d "{\"orderId\":\"ord_1001\",\"amount\":450,\"items\":[\"Shawarma\"],\"currency\":\"KES\"}" http://localhost:5000/v1/users/usr_7f2a9c1e/transactions
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
curl -X DELETE -H "Authorization: Bearer test" http://localhost:5000/v1/users/usr_7f2a9c1e/budget
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
| 400 | `VALIDATION_ERROR` | A field is missing, the wrong type, or not allowed (e.g. `"amount": "450"` in quotes, empty `items`, currency other than KES) |
| 401 | `UNAUTHORIZED` | No `Authorization: Bearer ...` header |
| 404 | `NOT_FOUND` | That user has no budget, or the URL doesn't exist |
| 422 | `BUDGET_EXCEEDED` | The amount is more than the budget has left |
| 500 | `INTERNAL_ERROR` | Something broke on the server (usually the database is off) |

---

## Run it locally (from a fresh clone)

You need **Node.js 18+** and **MySQL 8**.

**1. Get the code and install packages**

```
git clone https://github.com/Joshu79/Team_8_Internet_Application_Programing_Project.git
cd Team_8_Internet_Application_Programing_Project\server
npm install
```

**2. Create a file called `.env` inside the `server` folder** with your own
MySQL details:

```
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=pesa_tracker
```

**3. Create the database, tables, and test user.** Log in to MySQL
(`mysql -u root -p`) and paste:

```sql
CREATE DATABASE IF NOT EXISTS pesa_tracker;
USE pesa_tracker;

CREATE TABLE IF NOT EXISTS budgets (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  user_id       VARCHAR(50)   NOT NULL UNIQUE,
  monthly_limit DECIMAL(10,2) NOT NULL,
  remaining     DECIMAL(10,2) NOT NULL,
  currency      CHAR(3)       NOT NULL DEFAULT 'KES',
  updated_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS transactions (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  user_id    VARCHAR(50)   NOT NULL,
  order_id   VARCHAR(50)   NOT NULL,
  amount     DECIMAL(10,2) NOT NULL,
  items      JSON          NOT NULL,
  currency   CHAR(3)       NOT NULL,
  placed_at  DATETIME      NOT NULL,
  created_at DATETIME      NOT NULL
);

INSERT IGNORE INTO budgets (user_id, monthly_limit, remaining, currency, updated_at)
VALUES ('usr_7f2a9c1e', 13000.00, 8700.00, 'KES', '2026-09-07 14:32:00');
```

**4. Start the server** (still inside `server`):

```
npm run dev
```

You should see `Pesa Tracker API running at http://localhost:5000/v1`.
Now try the Quickstart command in a second terminal.

**Run the automated tests:** `npx jest` (inside `server`)