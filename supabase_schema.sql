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

-- Create a view for the latest snapshot per ticker
CREATE VIEW latest_position_snapshots AS
SELECT DISTINCT ON (ticker) *
FROM position_snapshots
ORDER BY ticker, snapshot_date DESC;

-- Create a view for total portfolio value by date
CREATE VIEW portfolio_value_over_time AS
SELECT snapshot_date, total_gbp_value
FROM portfolio_daily
ORDER BY snapshot_date;