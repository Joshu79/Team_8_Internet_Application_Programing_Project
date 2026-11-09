# Security Audit: Week 9

**Status: DRAFT.** Written from reading `server/index.js` and the tests. Items marked **[TEAM TO CONFIRM]** need a check or a decision from the team before submission.

## 1. What I checked (Part D checklist)

| Check | What I looked at | Result |
|---|---|---|
| Sensitive fields | `toBudget()` and `toTransaction()` in `server/index.js` build each response from a fixed list of fields. | Nothing internal is returned. The budget's database `id` is not sent. Transactions use a formatted `txn_` id. Nothing to fix. |
| Other people's data | Routes take the user id from the URL, e.g. `/v1/users/:id/budget`. | **Open risk.** Any valid key can read or change any user's budget by changing the id. See section 4. |
| Error messages | The app's last error handler (`app.use((err, req, res, next) => ...)`) | Unexpected errors return `{"code":"INTERNAL_ERROR","message":"Something went wrong on the server."}`. Stack traces are printed to the server log only. Nothing to fix. |
| Write endpoints and extra fields | `POST /transactions` reads only `orderId`, `amount`, `items`, `currency`, `placedAt`. `PATCH /budget` reads only `action`, `amount`, `currency`. | Extra fields such as `isAdmin` or `id` are ignored, never saved. Checked by reading the code, not by a test. |
| Keys in the wrong place | `server/.gitignore` lists `.env`, and `.env` is not tracked in git. `server/.env.example` has placeholders only. The server logs only the **number** of keys loaded. A search of tracked files for 40+ character hex strings found nothing. | Nothing committed. See section 5 for keys that were pasted during development. |

## 2. Auth and rate limiting

- Every route below `app.use(requireApiKey)` needs a valid `X-API-Key` header. A missing or wrong key returns `401 UNAUTHORIZED`.
- Each consumer has its own key in `API_KEYS` (comma-separated in `server/.env`).
- Rate limit: **60 requests per minute per key** (`RATE_LIMIT_PER_MIN` can change it). Over the limit, the API returns `429 RATE_LIMITED` with a `Retry-After` header.
- Why 60: A normal user makes only a few requests per minute, so 60 leaves plenty of room. It’s still low enough to stop a runaway loop from flooding the server.
- The limiter counts in memory, so it resets when the server restarts, and it doesn't work across several server copies. That's acceptable for this course.
- **Demo output:** `200 200 200 429 429`, from a real run with the limit temporarily set to 3 (`RATE_LIMIT_PER_MIN=3`), then reset to 60.

## 3. What I found and what I fixed

| # | Finding | Action |
|---|---|---|
| 1 | `PATCH /budget` `deduct` could overdraw. The balance was checked and changed in two separate steps. | **Fixed** in commit `4c4315c`. The check and the change now run in one transaction with `FOR UPDATE`. |
| 2 | The partner summary route is public (by design, see section 4). | Left as is, as the team decided. |
| 3 | `INTEGRATION_LOG.md` table didn't render. | **Fixed** in commit `4c4315c`. |

No other code changes were needed in this audit.

## 4. Accepted risks (not fixed)

1. **Any valid key can access any user.** The key identifies a consumer, not a user, so there's no per-user permission check. A proper fix would tie each key to the users it may access. This is out of scope for this course.
2. **`GET /v1/partner/expenses/summary` is public.** It doesn't need a key, and it isn't rate-limited, because it sits above the limiter. It returns the spending summary for the one user in `PARTNER_USER_ID`. This was the team's decision, so the summary route is exempt from the "every endpoint needs a key" rule.
3. **CORS is open to every website** (`app.use(cors())`). This lets Swagger and the team's pages call the API from a browser. A key is still required for everything except the public routes above.
4. The `/` and `/v1` health check is public, which is allowed by the Week 9 rule.

## 5. Keys

- Keys were pasted into terminals and chat during development. **Treat them as exposed and rotate them** (generate new ones, update `server/.env` and your partner's key) if you're not sure where they went.
- Keys are never printed by the server, only counted at startup.

## 6. Tests

- `server/__tests__/budget.test.js`: a request without a key gets `401`.
- `server/__tests__/security.test.js`:
  - "a valid key gets 200 on a protected route"
  - "returns 429 with Retry-After and a JSON body once the limit is passed". This checks the `Retry-After` header and the `RATE_LIMITED` body.
- Result: all 23 tests pass (`npx jest` in `server/`).
