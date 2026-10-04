   # Contract Deviations

   ## Week 5: GET endpoints

   **No deviations.** `GET /users/{id}/budget` was verified field by field in
   Swagger UI against the `Budget` and `Error` schemas. No fields, types, or
   status codes in `openapi.yaml` were changed.

   Drift found and fixed in code (not the contract): `updatedAt` came back
   3 hours early because mysql2 read DATETIME values as local time (UTC+3).
   Fixed by setting `timezone: 'Z'` in `db.js`.

   Note: a `http://localhost:5000/v1` entry was added to `servers` so
   "Try it out" can reach the local server. This doesn't change the API.