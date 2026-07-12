-- Owner dashboard: metric goals

CREATE TABLE IF NOT EXISTS metric_goals (
  id SERIAL PRIMARY KEY,
  metric_key VARCHAR(40) NOT NULL,
  period_year INTEGER NOT NULL,
  period_month INTEGER,
  target_value DECIMAL(12,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (metric_key, period_year, period_month)
);

CREATE INDEX IF NOT EXISTS idx_metric_goals_period ON metric_goals(period_year, period_month);
