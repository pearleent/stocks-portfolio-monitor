# Portfolio Monitor

A small, dependency-free stock portfolio dashboard. Static HTML/CSS/JS — no build step, no server required.

Ships pre-populated with a starting set of tickers grouped by note (e.g. "DBS 8/13/27 13.11%/75%/105%") with their strike and knock-out levels. Edit or replace any of it with your own — everything is stored in your browser's `localStorage`, never sent anywhere except the price-fetch requests below.

## Run it locally

Two ways to run it:

- **Single file**: open `portfolio-monitor.html` directly (double-click it) — it's the whole app (HTML/CSS/JS) bundled into one file, easiest to share or move around.
- **Multi-file**: `index.html` + `style.css` + `app.js` is the same app split up for easier editing. Opening `index.html` directly via `file://` works in most browsers, but some block `fetch` from `file://` origins, so serving it is more reliable.

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

- Click any **Strike**, **Initial**, or **Knock Out** cell to edit it in place — all free-form numeric fields.
- **% from Initial** is computed automatically as `(price - initial) / initial`. The Strike cell turns red when price drops below it; Knock Out turns green when price rises above it.
- Use the **Add Ticker** row to add a new one, including its **Group** — rows are automatically clustered under a header for each group name in use (existing group names autocomplete as you type). To move a ticker to a different group afterward, remove and re-add it.
- Click **✕** on a row to remove it.
- **Refresh Prices** fetches current quotes; **Auto-refresh** re-fetches every 2 minutes while the tab is open.

## How price data works (and its limitations)

Browsers block direct client-side requests to most finance APIs due to CORS, so `app.js` routes requests through a public CORS proxy in front of Yahoo Finance's chart endpoint, trying a few in order (`r.jina.ai`, `corsproxy.io`, `allorigins.win`) since any single free proxy can go down (I observed `allorigins.win` timing out and `corsproxy.io`'s free tier can reject non-localhost origins during testing).

This is fine for a personal dashboard but **not something to depend on for real trading decisions** — it's unauthenticated, rate-limited, and could break if a provider changes its API or a proxy shuts down.

If you want something sturdier:

- **Add your own API key**: sign up for a free tier at [Alpha Vantage](https://www.alphavantage.co/) or [Twelve Data](https://twelvedata.com/), then swap the `fetchQuote()` function in `app.js` to call their endpoint directly (both set CORS headers, so no proxy needed).
- **Fetch server-side instead of client-side**: add a GitHub Actions workflow that fetches prices on a schedule and commits a `prices.json` file to the repo; have `app.js` read that static file instead of hitting an API live. This avoids CORS and proxy reliability entirely, at the cost of prices only being as fresh as the last workflow run. Ask if you'd like this added.

## Files

- `portfolio-monitor.html` — single-file bundle of everything below, for easy sharing/opening
- `index.html` — page structure
- `style.css` — styling (light/dark aware via `prefers-color-scheme`)
- `app.js` — all portfolio logic: state, price fetching, rendering

The two versions share code by hand, not by build step — if you edit `app.js`/`style.css`/`index.html`, mirror the change into `portfolio-monitor.html` (or ask to have it regenerated).
