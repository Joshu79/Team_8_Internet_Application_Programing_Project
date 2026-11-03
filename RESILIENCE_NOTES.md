# Resilience Notes: Week 11

Partner: Team 7 (FitCoach). Stand-in partner used for testing: `flaky-partner.js` on port 4000, modes `ok`, `slow`, `flaky`, `error`.

## 1. What I tested

| Partner state | What the user saw | What the server log said | Time |
|---|---|---|---|
| Normal (`ok`) | Live FitCoach numbers, no banner | Nothing | 0.03 s |
| Slow, no timeout (before change) | Spinner for 10.1 s, then numbers | Nothing | 10.1 s |
| Slow, with 1.5 s timeout | Friendly message (or saved data with banner) | `Partner spending request failed: timeout` | 1.52 s |
| Flaky (fails twice, then works) | Live numbers, no error shown | `partner attempt 1 failed, retrying in 200 ms` and `attempt 2 failed, retrying in 400 ms` | 0.75 s |
| Always failing (`error`), saved copy exists | Saved numbers with banner "Showing saved data from [time]" | Two retry lines, then `partner returned 500` | 0.67 s |
| Always failing, server just restarted (no saved copy) | "FitCoach spending is unavailable right now" with Try again button; rest of dashboard loads | Same as above | 0.67 s |

The server stayed running in every case.

## 2. My numbers and why

- **Timeout: 1.5 seconds.** A normal call takes 0.03 seconds, so 1.5 seconds leaves plenty of room. It also stops a slow partner from holding the page for 10 seconds.
- **Retries: 2, for GET only.** Covers short blips such as a restart or dropped connection. Writes are never retried, so an order can't be recorded twice.
- **Delays: 200 ms, then 400 ms.** Gives the partner a moment to recover without making the user wait long.
- **Worst-case wait before the fallback: 5.1 seconds** ((2 + 1) × 1.5 s + 0.2 s + 0.4 s). That's the longest a user waits before seeing saved data or the friendly message.

## 3. What a real user would experience without this code

A student opens the Dashboard. If the partner is slow, the FitCoach section shows "Loading partner spending…" for as long as the partner takes, possibly indefinitely. If the partner is down, the numbers vanish completely, even though the student's own Pesa Tracker figures are fine. A single short blip would show an error even though a second try would have worked. With the new code, the wait is at most about 5 seconds, a short blip is invisible, and during an outage the student still sees the last FitCoach numbers with the time they were saved.

## 4. What I did not build

A **circuit breaker** is a switch that stops calling a partner after it has been failing for a while, then tries again now and then. Ours doesn't have one, so during a long outage every dashboard load still makes up to three calls and waits up to 5 seconds. With a circuit breaker, the server would skip the calls and show the saved data straight away, and only test the partner occasionally.

## 5. Real partner drill (Part E)

Status: **pending**. Team 7's tunnel was returning Cloudflare errors (502, then 1033) when last checked. When it's back, record here:

- [ ] Normal: live data shown
- [ ] Partner stopped: saved data shown with banner (or friendly message if no saved copy)
- [ ] Partner restarted: live data returns, no code change
