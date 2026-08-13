# Portfolio Monitor

A small, dependency-free stock portfolio dashboard. Static HTML/CSS/JS — no build step, no server required.

Ships with **placeholder tickers** (AAPL, MSFT, GOOGL, AMZN, TSLA, NVDA with made-up strike/knock-out levels, grouped into "Tech", "Consumer", and "Watchlist") so you can see it working immediately. Edit or replace them with your own — everything is stored in your browser's `localStorage`, never sent anywhere except the price-fetch requests below.

## Run it locally

No install needed — just serve the folder (opening `index.html` directly via `file://` works in most browsers too, but some block `fetch` from `file://` origins, so serving is more reliable).

If you have Python:

```bash
python -m http.server 8000
```

If you don't (this machine didn't), use the included PowerShell server instead:

```powershell
powershell -ExecutionPolicy Bypass -File serve.ps1
```

Then visit `http://localhost:8934` (or `:8000` for the Python option).

## Host it on GitHub Pages

1. Push this folder to a GitHub repo.
2. Repo Settings → Pages → Deploy from branch → pick `main` and `/root`.
3. Your dashboard will be live at `https://<username>.github.io/<repo>/`.

## Editing your tickers

- Click any **Group**, **Strike**, or **Knock Out** cell to edit it in place. Strike and Knock Out are free-form numeric fields — use them for whatever levels matter to you (e.g. warrant strike/barrier prices).
- Type a **Group** name to file a ticker under it — rows are automatically clustered under a header for each group name in use. Existing group names autocomplete as you type. Leave it blank to fall under "Ungrouped".
- Use the **Add Ticker** row to add a new one (group/strike/knock-out are optional at add time and can be filled in later).
- Click **✕** on a row to remove it.
- **Refresh Prices** fetches current quotes; **Auto-refresh** re-fetches every 2 minutes while the tab is open.

## How price data works (and its limitations)

Browsers block direct client-side requests to most finance APIs due to CORS, so `app.js` routes requests through a public CORS proxy in front of Yahoo Finance's chart endpoint, trying a few in order (`r.jina.ai`, `corsproxy.io`, `allorigins.win`) since any single free proxy can go down (I observed `allorigins.win` timing out and `corsproxy.io`'s free tier can reject non-localhost origins during testing).

This is fine for a personal dashboard but **not something to depend on for real trading decisions** — it's unauthenticated, rate-limited, and could break if a provider changes its API or a proxy shuts down.

If you want something sturdier:

- **Add your own API key**: sign up for a free tier at [Alpha Vantage](https://www.alphavantage.co/) or [Twelve Data](https://twelvedata.com/), then swap the `fetchQuote()` function in `app.js` to call their endpoint directly (both set CORS headers, so no proxy needed).
- **Fetch server-side instead of client-side**: add a GitHub Actions workflow that fetches prices on a schedule and commits a `prices.json` file to the repo; have `app.js` read that static file instead of hitting an API live. This avoids CORS and proxy reliability entirely, at the cost of prices only being as fresh as the last workflow run. Ask if you'd like this added.

## Files

- `index.html` — page structure
- `style.css` — styling (light/dark aware via `prefers-color-scheme`)
- `app.js` — all portfolio logic: state, price fetching, rendering
