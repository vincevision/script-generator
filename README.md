# PRO STOCKS — Premium Simulated Investment Platform (Demo)

A highly professional, modern **stock-investment web platform demo** with an institutional-grade
fintech UI: dashboard, markets, 100+ simulated investor profiles, portfolio analytics,
watchlist, and a TradingView-powered pro terminal.

> **DEMO — SIMULATED INVESTMENT DATA.** PRO STOCKS is a demonstration platform. All investor
> profiles, portfolio balances, returns, and performance figures shown in this interface are
> simulated and do not represent actual investments, accounts, or investment results.

## Features

- **Dashboard** — auto-calculated totals (investors, capital, value, avg. growth), featured
  demo profiles (Vincent Omondi +300%, Dylan Wayne +60%), market overview, aggregate
  performance chart, top performers, activity feed
- **Investors directory** — 104 fictional profiles (min. KES 7,000), global + local search,
  sort by investment / value / growth, filter by stock & growth band, table/card views,
  CSV export, individual profile pages with allocation donut, timeframe performance chart,
  timeline and monthly history
- **Markets** — reference quotes for AAPL, TSLA, MSFT, AMZN, NVDA, GOOGL, META, NFLX, AMD, KO
  with sparklines and simulated Buy actions
- **Portfolios** — community allocation, growth distribution, largest demo portfolios
- **Watchlist** — starred stocks + followed investors, persisted in localStorage
- **Charts** — live TradingView advanced terminal (candles, timeframes, volume, indicators,
  crosshair, zoom, fullscreen, symbol switching), clearly separated from simulated data
- **About / Help** — methodology, formulas, FAQ, disclaimers
- Fully **responsive** (desktop → mobile with bottom nav + drawer), toasts, skeletons,
  empty states, notifications, command-search (`/`), live clock & market-status indicator

## Run

No build step — static site. Serve the folder:

```bash
cd script-generator
python3 -m http.server 8080
# open http://localhost:8080
```

Internet access enables the TradingView terminal and CDN fonts/Tailwind; all simulated
portfolio charts work offline.

## Structure

```
index.html        App shell (topbar, sidebar, main, footer, modals)
css/styles.css    Design system
js/data.js        Seeded simulated dataset + aggregates + formatting
js/charts.js      Canvas chart engine (sparklines, area, donut, bars)
js/app.js         Router, pages, interactions
```
