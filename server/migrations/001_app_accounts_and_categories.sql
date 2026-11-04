USE pesa_tracker;

CREATE TABLE IF NOT EXISTS app_users (
  user_id VARCHAR(50) PRIMARY KEY,
  display_name VARCHAR(80) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  phone VARCHAR(30) NULL,
  password_hash VARCHAR(180) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS app_sessions (
  session_hash CHAR(64) PRIMARY KEY,
  user_id VARCHAR(50) NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_app_sessions_user (user_id),
  INDEX idx_app_sessions_expiry (expires_at),
  CONSTRAINT fk_app_sessions_user FOREIGN KEY (user_id)
    REFERENCES app_users(user_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS app_monthly_budgets (
  user_id VARCHAR(50) NOT NULL,
  month CHAR(7) NOT NULL,
  monthly_limit DECIMAL(10,2) NOT NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, month),
  CONSTRAINT fk_app_monthly_budget_user FOREIGN KEY (user_id)
    REFERENCES app_users(user_id) ON DELETE CASCADE
);

-- Run this migration once against an existing database.
ALTER TABLE transactions ADD COLUMN category VARCHAR(40) NULL;
CREATE INDEX idx_transactions_user_date ON transactions (user_id, placed_at);
