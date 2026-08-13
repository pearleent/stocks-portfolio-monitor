// Portfolio Monitor
// Positions are persisted in localStorage. Prices come from Yahoo Finance's
// public chart endpoint, routed through a CORS proxy since browsers block
// direct cross-origin requests to it. See README.md for swapping providers.

const STORAGE_KEY = "portfolio-monitor.positions";

const PLACEHOLDER_POSITIONS = [
  { ticker: "AAPL", shares: 10, cost: 180.00 },
  { ticker: "MSFT", shares: 5, cost: 340.00 },
  { ticker: "GOOGL", shares: 8, cost: 130.00 },
  { ticker: "AMZN", shares: 6, cost: 145.00 },
  { ticker: "TSLA", shares: 4, cost: 220.00 },
  { ticker: "NVDA", shares: 12, cost: 90.00 },
];

// Tried in order; first one that returns usable data for a symbol wins.
const PROXIES = [
  (url) => `https://r.jina.ai/${url}`,
  (url) => `https://corsproxy.io/?url=${encodeURIComponent(url)}`,
  (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
];

let positions = loadPositions();
let quoteCache = {}; // ticker -> { price, prevClose, changePct }

function loadPositions() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { /* fall through to defaults */ }
  return PLACEHOLDER_POSITIONS.map(p => ({ ...p }));
}

function savePositions() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(positions));
}

function fmtMoney(n) {
  if (!isFinite(n)) return "—";
  const sign = n < 0 ? "-" : "";
  return sign + "$" + Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtPct(n) {
  if (!isFinite(n)) return "—";
  const sign = n > 0 ? "+" : "";
  return sign + n.toFixed(2) + "%";
}

function gainClass(n) {
  if (!isFinite(n) || n === 0) return "neutral";
  return n > 0 ? "positive" : "negative";
}

async function fetchQuote(ticker) {
  const target = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}`;

  for (const buildProxyUrl of PROXIES) {
    try {
      const res = await fetch(buildProxyUrl(target));
      if (!res.ok) continue;
      const text = await res.text();

      // r.jina.ai wraps the JSON in a markdown-ish text response; extract the JSON body.
      const jsonStart = text.indexOf("{");
      if (jsonStart === -1) continue;
      const data = JSON.parse(text.slice(jsonStart));

      const meta = data?.chart?.result?.[0]?.meta;
      if (!meta || typeof meta.regularMarketPrice !== "number") continue;

      const price = meta.regularMarketPrice;
      const prevClose = meta.previousClose ?? meta.chartPreviousClose ?? price;
      const changePct = prevClose ? ((price - prevClose) / prevClose) * 100 : 0;

      return { price, prevClose, changePct };
    } catch (e) {
      continue; // try next proxy
    }
  }
  return null; // all proxies failed for this ticker
}

async function refreshPrices() {
  const btn = document.getElementById("refreshBtn");
  const status = document.getElementById("statusMsg");
  btn.disabled = true;
  btn.textContent = "Refreshing…";
  status.textContent = "";

  const results = await Promise.all(positions.map(p => fetchQuote(p.ticker)));

  let failures = [];
  positions.forEach((p, i) => {
    if (results[i]) {
      quoteCache[p.ticker] = results[i];
    } else {
      failures.push(p.ticker);
    }
  });

  render();

  btn.disabled = false;
  btn.textContent = "Refresh Prices";
  document.getElementById("lastUpdated").textContent = "Updated " + new Date().toLocaleTimeString();

  status.textContent = failures.length
    ? `Couldn't fetch: ${failures.join(", ")} (proxy or ticker issue — see README).`
    : "";
}

function render() {
  const tbody = document.getElementById("portfolioBody");
  tbody.innerHTML = "";

  let totalValue = 0;
  let totalCost = 0;

  positions.forEach((p, index) => {
    const q = quoteCache[p.ticker];
    const price = q ? q.price : NaN;
    const dayPct = q ? q.changePct : NaN;
    const marketValue = price * p.shares;
    const costBasis = p.cost * p.shares;
    const gain = marketValue - costBasis;
    const returnPct = costBasis ? (gain / costBasis) * 100 : NaN;

    if (isFinite(marketValue)) totalValue += marketValue;
    if (isFinite(costBasis)) totalCost += costBasis;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="ticker-cell">${p.ticker}</td>
      <td><input class="editable" type="number" min="0" step="any" value="${p.shares}" data-field="shares" data-index="${index}"></td>
      <td><input class="editable" type="number" min="0" step="any" value="${p.cost}" data-field="cost" data-index="${index}"></td>
      <td>${isFinite(price) ? fmtMoney(price) : "—"}</td>
      <td class="${gainClass(dayPct)}">${fmtPct(dayPct)}</td>
      <td>${isFinite(marketValue) ? fmtMoney(marketValue) : "—"}</td>
      <td class="${gainClass(gain)}">${isFinite(gain) ? fmtMoney(gain) : "—"}</td>
      <td class="${gainClass(returnPct)}">${fmtPct(returnPct)}</td>
      <td><button class="remove-btn" data-index="${index}" title="Remove position">✕</button></td>
    `;
    tbody.appendChild(tr);
  });

  const totalGain = totalValue - totalCost;
  const totalReturnPct = totalCost ? (totalGain / totalCost) * 100 : NaN;

  document.getElementById("totalValue").textContent = fmtMoney(totalValue);
  document.getElementById("totalCost").textContent = fmtMoney(totalCost);

  const totalGainEl = document.getElementById("totalGain");
  totalGainEl.textContent = fmtMoney(totalGain);
  totalGainEl.className = "card-value " + gainClass(totalGain);

  const totalReturnEl = document.getElementById("totalReturnPct");
  totalReturnEl.textContent = fmtPct(totalReturnPct);
  totalReturnEl.className = "card-value " + gainClass(totalReturnPct);

  attachRowHandlers();
}

function attachRowHandlers() {
  document.querySelectorAll(".editable").forEach(input => {
    input.addEventListener("change", (e) => {
      const index = Number(e.target.dataset.index);
      const field = e.target.dataset.field;
      const value = parseFloat(e.target.value);
      if (isFinite(value) && value >= 0) {
        positions[index][field] = value;
        savePositions();
        render();
      }
    });
  });

  document.querySelectorAll(".remove-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const index = Number(e.currentTarget.dataset.index);
      positions.splice(index, 1);
      savePositions();
      render();
    });
  });
}

function addPosition() {
  const tickerInput = document.getElementById("newTicker");
  const sharesInput = document.getElementById("newShares");
  const costInput = document.getElementById("newCost");

  const ticker = tickerInput.value.trim().toUpperCase();
  const shares = parseFloat(sharesInput.value);
  const cost = parseFloat(costInput.value);

  if (!ticker || !isFinite(shares) || shares <= 0 || !isFinite(cost) || cost < 0) {
    document.getElementById("statusMsg").textContent = "Enter a ticker, share count, and avg cost to add a position.";
    return;
  }

  positions.push({ ticker, shares, cost });
  savePositions();
  tickerInput.value = "";
  sharesInput.value = "";
  costInput.value = "";
  render();
  fetchQuote(ticker).then(q => {
    if (q) { quoteCache[ticker] = q; render(); }
  });
}

let autoRefreshTimer = null;
function setAutoRefresh(enabled) {
  if (autoRefreshTimer) clearInterval(autoRefreshTimer);
  autoRefreshTimer = enabled ? setInterval(refreshPrices, 2 * 60 * 1000) : null;
}

document.getElementById("refreshBtn").addEventListener("click", refreshPrices);
document.getElementById("addBtn").addEventListener("click", addPosition);
document.getElementById("autoRefreshToggle").addEventListener("change", (e) => setAutoRefresh(e.target.checked));

render();
refreshPrices();
