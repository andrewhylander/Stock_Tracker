-- Create the position_snapshots table
CREATE TABLE position_snapshots (
    id SERIAL PRIMARY KEY,
    snapshot_date DATE NOT NULL,
    brokerage VARCHAR(255) NOT NULL,
    exchange VARCHAR(255),
    ticker VARCHAR(255) NOT NULL,
    category VARCHAR(255),
    sector VARCHAR(255),
    region VARCHAR(255),
    currency VARCHAR(10),
    share_price DECIMAL(15,6),
    share_count DECIMAL(15,6),
    gbp_value DECIMAL(15,2),
    avg_cost DECIMAL(15,6),
    fx_rate DECIMAL(10,6),
    unrealised_pl DECIMAL(15,2),
    unrealised_pl_pct DECIMAL(10,4),
    dividend DECIMAL(15,2),
    dividend_pct DECIMAL(10,4),
    dividend_return DECIMAL(15,2)
);

-- Create indexes for performance
CREATE INDEX idx_position_snapshots_snapshot_date ON position_snapshots (snapshot_date);
CREATE INDEX idx_position_snapshots_ticker ON position_snapshots (ticker);
CREATE INDEX idx_position_snapshots_brokerage ON position_snapshots (brokerage);
CREATE INDEX idx_position_snapshots_snapshot_date_ticker ON position_snapshots (snapshot_date, ticker);

-- Create the portfolio_daily table
CREATE TABLE portfolio_daily (
    id SERIAL PRIMARY KEY,
    snapshot_date DATE NOT NULL UNIQUE,
    total_gbp_value DECIMAL(15,2),
    total_unrealised_pl DECIMAL(15,2),
    total_unrealised_pl_pct DECIMAL(10,4),
    cash_gbp DECIMAL(15,2),
    invested_gbp DECIMAL(15,2)
);

-- Create index on snapshot_date
CREATE INDEX idx_portfolio_daily_snapshot_date ON portfolio_daily (snapshot_date);

-- Create a view for the most recent snapshot.
-- This deliberately returns every row from the latest snapshot_date rather than
-- the newest row per ticker: a portfolio snapshot is a set of holdings on a
-- date, so a position that leaves the sheet must leave the dashboard too.
-- (DISTINCT ON (ticker, brokerage) kept sold positions alive indefinitely --
-- eight rows from 2026-05-08 were still inflating totals in Sep 2026.)
CREATE OR REPLACE VIEW latest_position_snapshots AS
SELECT *
FROM position_snapshots
WHERE snapshot_date = (SELECT MAX(snapshot_date) FROM position_snapshots);

-- Create a view for total portfolio value by date
CREATE VIEW portfolio_value_over_time AS
SELECT snapshot_date, total_gbp_value
FROM portfolio_daily
ORDER BY snapshot_date;
-- ---------------------------------------------------------------------------
-- Dividend history
--
-- Populated by the /api/dividends serverless route, not by n8n. Two sources,
-- because no single free API covers both halves of the portfolio:
--   * Alpha Vantage  -- US listings. Has real pay dates, but returns an empty
--                       array for LSE symbols (VWRL.LON, KNOS.LON).
--   * Yahoo Finance  -- LSE listings. Ex-dates only, and no CORS header, which
--                       is why this is fetched server-side.
--
-- Everything is keyed and charted on ex_date. Pay dates are deliberately NOT
-- stored: we can only get them for the ~7% of income that comes from US
-- holdings, and a half-populated column invites the false impression that the
-- chart shows cash landing in the account.
-- ---------------------------------------------------------------------------
CREATE TABLE dividend_payments (
    id SERIAL PRIMARY KEY,
    ticker VARCHAR(255) NOT NULL,
    ex_date DATE NOT NULL,
    amount_per_share DECIMAL(15,6) NOT NULL,  -- in `currency`, as the source reported it
    currency VARCHAR(10) NOT NULL,            -- GBp for KNOS.L, GBP for VWRL.L, USD for US
    amount_per_share_gbp DECIMAL(15,6) NOT NULL,
    source VARCHAR(32) NOT NULL,              -- 'alphavantage' | 'yahoo'
    fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (ticker, ex_date)
);

CREATE INDEX idx_dividend_payments_ticker ON dividend_payments (ticker);
CREATE INDEX idx_dividend_payments_ex_date ON dividend_payments (ex_date);

-- Pay dates, added after the fact.
--
-- Alpha Vantage returns a real payment_date for US listings. Yahoo does not
-- carry one at all, so LSE holdings derive theirs from the ex-date plus a
-- per-ticker lag, which is stable and published: VWRL has paid exactly 13 days
-- after going ex for seven consecutive distributions, KNOS 22 days across both
-- its interim and final.
--
-- pay_date_source records which of the two a row is, so an estimate is never
-- mistaken for a declared date.
ALTER TABLE dividend_payments ADD COLUMN IF NOT EXISTS pay_date DATE;
ALTER TABLE dividend_payments ADD COLUMN IF NOT EXISTS pay_date_source VARCHAR(16);

CREATE INDEX IF NOT EXISTS idx_dividend_payments_pay_date ON dividend_payments (pay_date);
