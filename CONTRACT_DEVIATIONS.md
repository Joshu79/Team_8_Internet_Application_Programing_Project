   # Contract Deviations

   ## Week 5: GET endpoints

   **No deviations.** `GET /users/{id}/budget` was verified field by field in
   Swagger UI against the `Budget` and `Error` schemas. No fields, types, or
   status codes in `openapi.yaml` were changed.

   Drift found and fixed in code (not the contract): `updatedAt` came back
   3 hours early because mysql2 read DATETIME values as local time (UTC+3).
   Fixed by setting `timezone: 'Z'` in `db.js`.

   "Try it out" can reach the local server. This doesn't change the API.


   ## Week 6: Write endpoints

**1. Currency limited to KES.** The contract allows any ISO 4217 code, but
PATCH /users/{id}/budget and POST /users/{id}/transactions now reject any
currency other than `KES` with 400. Pesa Tracker only serves Kenyan
students, so other currencies aren't supported yet.

**2. PATCH can return 422.** A `deduct` larger than the remaining balance
returns 422 `BUDGET_EXCEEDED` instead of letting the balance go negative.
The original contract didn't list 422 for PATCH; it has been added to
`openapi.yaml`.

**Note for StrathsBites (ring partner):** POST /transactions already
deducts the order amount from the budget. Do not also call
PATCH with `deduct` for the same order, or the student is charged twice.