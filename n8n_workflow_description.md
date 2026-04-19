# n8n Workflow: Daily Portfolio Snapshot

## Overview
This workflow runs daily at 10pm to snapshot portfolio positions from Google Sheets, fetch live prices from Twelve Data, calculate P&L, and store in Supabase.

## Node Configuration

### 1. Schedule Trigger
- **Type**: n8n-nodes-base.scheduleTrigger
- **Configuration**:
  - Rule: `0 22 * * *` (daily at 22:00 UTC)
  - Timezone: Your local timezone
  - Activate on save: true

### 2. Google Sheets Reader
- **Type**: n8n-nodes-base.googleSheets
- **Configuration**:
  - Operation: Read Rows
  - Document URL: [Your Google Sheets URL]
  - Sheet Name: n8n_export
  - Range: A:Z (or specify exact range)
  - Options:
    - First Row Contains Headers: true
    - Read All Rows: true
  - Authentication: Service Account or OAuth

### 3. Code: Deduplicate Tickers
- **Type**: n8n-nodes-base.code
- **Configuration**:
  - Mode: Run Once for All Items
  - Language: JavaScript
  - Code:
    ```javascript
    const allRows = $input.all();
    const uniqueTickers = [...new Set(
      allRows
        .map(row => row.json.Ticker)
        .filter(ticker => ticker && !ticker.includes('CASH'))
    )];
    
    return uniqueTickers.map(ticker => ({ ticker }));
    ```

### 4. HTTP Request: Fetch FX Rate
- **Type**: n8n-nodes-base.httpRequest
- **Configuration**:
  - Method: GET
  - URL: https://api.twelvedata.com/exchange_rate?symbol=GBP/USD&apikey={{$credentials.twelveDataApiKey}}
  - Send Body: false
  - Response Format: JSON

### 5. HTTP Request: Fetch Prices
- **Type**: n8n-nodes-base.httpRequest
- **Configuration**:
  - Method: GET
  - URL: https://api.twelvedata.com/price?symbol={{$node["Code"].json.ticker.join(',')}}&apikey={{$credentials.twelveDataApiKey}}
  - Send Body: false
  - Response Format: JSON
  - Note: This assumes batch request; if API limits, loop with Split In Batches

### 6. Code: Process and Join Data
- **Type**: n8n-nodes-base.code
- **Configuration**:
  - Mode: Run Once for All Items
  - Language: JavaScript
  - Code:
    ```javascript
    const originalRows = $node["Google Sheets"].all();
    const fxRate = $node["HTTP Request"].json.rate;
    const prices = $node["HTTP Request1"].json; // Adjust node name
    
    const processedRows = originalRows.map(row => {
      const ticker = row.json.Ticker;
      const currency = row.json.Currency;
      const sharePrice = parseFloat(row.json['Share Price']);
      const shareCount = parseFloat(row.json['Share Count']);
      const avgCost = parseFloat(row.json['Avg Cost']);
      const gbpValueSheet = parseFloat(row.json.GBP) || 0;
      
      let livePrice = prices[ticker]?.price ? parseFloat(prices[ticker].price) : sharePrice;
      let gbpValue = gbpValueSheet;
      
      if (currency === 'USD') {
        livePrice = livePrice * fxRate;
        gbpValue = livePrice * shareCount;
      } else {
        gbpValue = livePrice * shareCount;
      }
      
      const invested = avgCost * shareCount;
      const unrealisedPl = gbpValue - invested;
      const unrealisedPlPct = invested > 0 ? (unrealisedPl / invested) * 100 : 0;
      
      return {
        snapshot_date: new Date().toISOString().split('T')[0],
        brokerage: row.json.Brokerage,
        exchange: row.json.Exchange,
        ticker: ticker,
        category: row.json.Category,
        sector: row.json.Sector,
        region: row.json.Region,
        currency: currency,
        share_price: livePrice,
        share_count: shareCount,
        gbp_value: gbpValue,
        avg_cost: avgCost,
        fx_rate: fxRate,
        unrealised_pl: unrealisedPl,
        unrealised_pl_pct: unrealisedPlPct,
        dividend: parseFloat(row.json.Dividend) || 0,
        dividend_pct: parseFloat(row.json['Dividend %']) || 0,
        dividend_return: parseFloat(row.json['Dividend Return']) || 0
      };
    });
    
    return processedRows;
    ```

### 7. Supabase: Insert Position Snapshots
- **Type**: n8n-nodes-base.supabase
- **Configuration**:
  - Operation: Insert
  - Table: position_snapshots
  - Data: Use expression to map from Code node output
  - Authentication: Supabase credentials

### 8. Aggregate: Calculate Portfolio Summary
- **Type**: n8n-nodes-base.aggregate
- **Configuration**:
  - Aggregate: Sum
  - Fields: gbp_value, unrealised_pl (for invested), and separate for cash
  - Group By: None (global aggregate)
  - Note: Use two aggregates or Code for cash vs invested separation

### 9. Code: Prepare Portfolio Daily
- **Type**: n8n-nodes-base.code
- **Configuration**:
  - Mode: Run Once for All Items
  - Code:
    ```javascript
    const positions = $node["Supabase"].all();
    const cashRows = positions.filter(p => p.json.ticker.includes('CASH'));
    const investedRows = positions.filter(p => !p.json.ticker.includes('CASH'));
    
    const cashGbp = cashRows.reduce((sum, p) => sum + p.json.gbp_value, 0);
    const investedGbp = investedRows.reduce((sum, p) => sum + p.json.gbp_value, 0);
    const totalUnrealisedPl = investedRows.reduce((sum, p) => sum + p.json.unrealised_pl, 0);
    const totalUnrealisedPlPct = investedGbp > 0 ? (totalUnrealisedPl / investedGbp) * 100 : 0;
    
    return [{
      snapshot_date: new Date().toISOString().split('T')[0],
      total_gbp_value: cashGbp + investedGbp,
      total_unrealised_pl: totalUnrealisedPl,
      total_unrealised_pl_pct: totalUnrealisedPlPct,
      cash_gbp: cashGbp,
      invested_gbp: investedGbp
    }];
    ```

### 10. Supabase: Insert Portfolio Daily
- **Type**: n8n-nodes-base.supabase
- **Configuration**:
  - Operation: Insert
  - Table: portfolio_daily
  - Data: From Code node
  - Authentication: Supabase credentials

## Connections
- Schedule Trigger → Google Sheets
- Google Sheets → Code (Deduplicate)
- Code → HTTP Request (FX)
- HTTP Request (FX) → HTTP Request (Prices)
- HTTP Request (Prices) → Code (Process)
- Code (Process) → Supabase (Positions)
- Supabase (Positions) → Aggregate
- Aggregate → Code (Portfolio)
- Code (Portfolio) → Supabase (Daily)

## Notes
- Handle API rate limits for Twelve Data (free tier: 800/day)
- Add error handling with IF nodes for failed API calls
- Test with sample data before scheduling
- For restricted tickers, add visual flag in future frontend, but store all data