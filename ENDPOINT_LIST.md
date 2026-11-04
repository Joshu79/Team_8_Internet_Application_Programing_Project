WEEK 3 LAB: API STATEMENTS
218795
220979
223426
221899

| Method | Path | Purpose | Maps to Need |
|--------|------|---------|--------------|
| GET | /users/{id}/budget | Return the user's monthly budget limit and remaining balance. | Needs 1 and 2: "read the student's monthly budget limit" and "read the remaining budget" |
| PATCH | /users/{id}/budget | Set a new monthly limit (`update`) or subtract an amount from the remaining balance (`deduct`). | Needs 4 and 5: "update the budget" and "budget deduction" |
| DELETE | /users/{id}/budget | Permanently remove a user's budget, e.g. when a student graduates. | None. Not from a partner need; retained for account cleanup and flagged to instructor. |
| POST | /users/{id}/transactions | Record an order and deduct its amount from the remaining budget. | Need 5: "budget deduction" |
| GET | /users/{id}/transactions | List all of a user's transactions, newest first. | Need 3: "view budget transactions" |