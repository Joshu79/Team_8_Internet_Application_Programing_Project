# Week 12 Monitoring Notes

## Before collecting traffic: predictions

- **Likely slowest endpoint:** `GET /v1/partner/expenses/summary`, because it waits on an external service and uses a timeout with retries.
- **Likely most errors:** `GET /v1/users/{id}/budget`, because requests for users without a budget return 404, and the route also depends on the database.

## Traffic observations

I ran `traffic.js` with 200 local requests. The mix included health checks,
authorized `/stats` requests, missing routes, wrong keys, and missing keys.
The two keys used for this local run were temporary and were not written to
the repository.

- **Prediction versus measurements:** The partner summary was predicted to be
  slowest, but it was not called in this test. Among the routes exercised,
  `/stats` averaged 0.8 ms (maximum 2.6 ms), the health route averaged 0.6 ms
  (maximum 1.5 ms), and rejected or unknown routes averaged 0.7 ms (maximum
  8.7 ms). The budget endpoint prediction was also not tested because this
  traffic mix intentionally avoided the database.
- **Traffic pattern:** The script received 69 responses with status 200, 75
  with 401, 35 with 404, and 21 with 429. `/stats` counted 200 requests, 131
  client errors, no server errors, a 0% server-error rate, and a 0.7 ms overall
  average. The 401, 404, and 429 responses were expected from the generated
  invalid-key, missing-route, and rate-limit traffic. No query strings
  appeared in the 201 log lines (200 generated requests plus the final stats
  read).
- **Likely cause and next check:** The `(no route)` group had 131 requests
  because key checks, rate limiting, and unknown paths can reject requests
  before an Express route is selected. To measure real budget and FitCoach
  behavior, repeat with a configured database and a live partner endpoint,
  then compare route timings and error counts.
- **Production alert:** Alert the API owner if 5xx errors exceed 5% over a
  rolling five-minute window. While the cause is investigated, keep the app
  available and serve the last saved FitCoach summary when one is available.
  The current `/stats` counters are in-memory totals, so a production alert
  needs a monitor to sample them over time.

## Sample request log

The key fingerprint below represents only a temporary local test key. No API
key or query string is present in either line.

```json
{"time":"2026-11-04T14:55:17.811Z","method":"GET","path":"/v1/no-such-route","status":401,"ms":0.6,"caller":"none"}
{"time":"2026-11-04T14:55:18.517Z","method":"GET","path":"/stats","status":200,"ms":1.4,"caller":"key-8e6a10"}
```

## Partner traffic and `/stats` evidence

Traffic script status counts: `200: 69`, `401: 75`, `404: 35`, `429: 21`.

Sanitized `/stats` snapshot after the generated traffic:

```json
{
  "total": 200,
  "clientErrors": 131,
  "serverErrors": 0,
  "errorRatePercent": 0,
  "avgMs": 0.7,
  "routes": {
    "GET (no route)": {
      "count": 131,
      "clientErrors": 131,
      "serverErrors": 0,
      "avgMs": 0.7,
      "maxMs": 8.7
    },
    "GET / | /v1": {
      "count": 44,
      "clientErrors": 0,
      "serverErrors": 0,
      "avgMs": 0.6,
      "maxMs": 1.5
    },
    "GET /stats | /v1/stats": {
      "count": 25,
      "clientErrors": 0,
      "serverErrors": 0,
      "avgMs": 0.8,
      "maxMs": 2.6
    }
  }
}
```

This was local synthetic traffic. Partner-generated traffic and measurements
from the real database and FitCoach service still need to be collected when
those services are reachable.
