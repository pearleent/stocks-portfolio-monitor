// Portfolio Monitor
// Positions are persisted in localStorage. Prices come from Yahoo Finance's
// public chart endpoint, routed through a CORS proxy since browsers block
// direct cross-origin requests to it. See README.md for swapping providers.

const STORAGE_KEY = "portfolio-monitor.positions";
const UNGROUPED = "Ungrouped";

const DEFAULT_POSITIONS = [
  { ticker: "MA", group: "Moo 11/9/26 18%/55%/100%", strike: 280.77, initial: 509.94, knockout: 509.94 },
  { ticker: "V", group: "Moo 11/9/26 18%/55%/100%", strike: 171.20, initial: 310.94, knockout: 310.94 },
  { ticker: "CRCL", group: "Moo 11/9/26 18%/55%/100%", strike: 51.44, initial: 93.43, knockout: 93.42 },

  { ticker: "INTC", group: "Moo 8/11/27 18.54%/50%/100%", strike: 48.25, initial: 96.50, knockout: 96.50 },
  { ticker: "AVGO", group: "Moo 8/11/27 18.54%/50%/100%", strike: 197.41, initial: 394.81, knockout: 394.81 },

  { ticker: "AMZN", group: "DBS 8/13/27 13.11%/75%/105%", strike: 184.69, initial: 230.86, knockout: 242.40 },
  { ticker: "GOOGL", group: "DBS 8/13/27 13.11%/75%/105%", strike: 266.97, initial: 333.71, knockout: 350.40 },
  { ticker: "MSFT", group: "DBS 8/13/27 13.11%/75%/105%", strike: 314.68, initial: 393.35, knockout: 413.02 },
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
    if (raw) {
      const parsed = JSON.parse(raw);
      return parsed.map(p => ({
        ticker: p.ticker,
        group: p.group || "",
        strike: p.strike ?? null,
        initial: p.initial ?? null,
        knockout: p.knockout ?? null,
      }));
    }
  } catch (e) { /* fall through to defaults */ }
  return DEFAULT_POSITIONS.map(p => ({ ...p }));
}

function savePositions() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(positions));
}

function fmtMoney(n) {
  if (!isFinite(n)) return "—";
  const sign = n < 0 ? "-" : "";
  return sign + "$" + Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtNum(n) {
  if (n === null || n === undefined || !isFinite(n)) return "";
  return n;
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

function groupKey(g) {
  return g && g.trim() ? g.trim() : UNGROUPED;
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

function sortedOrder() {
  return positions
    .map((_, i) => i)
    .sort((a, b) => {
      const ga = groupKey(positions[a].group);
      const gb = groupKey(positions[b].group);
      if (ga === gb) return 0; // stable sort keeps insertion order within a group
      if (ga === UNGROUPED) return 1;
      if (gb === UNGROUPED) return -1;
      return ga.localeCompare(gb);
    });
}

function updateGroupList() {
  const groups = [...new Set(positions.map(p => groupKey(p.group)).filter(g => g !== UNGROUPED))];
  const datalist = document.getElementById("groupList");
  datalist.innerHTML = groups.map(g => `<option value="${g}"></option>`).join("");
}

function render() {
  const tbody = document.getElementById("portfolioBody");
  tbody.innerHTML = "";

  const order = sortedOrder();
  let lastGroup = null;

  order.forEach((index) => {
    const p = positions[index];
    const g = groupKey(p.group);

    if (g !== lastGroup) {
      const count = positions.filter(pp => groupKey(pp.group) === g).length;
      const headerRow = document.createElement("tr");
      headerRow.className = "group-header";
      headerRow.innerHTML = `<td colspan="8">${g} <span class="group-count">(${count})</span></td>`;
      tbody.appendChild(headerRow);
      lastGroup = g;
    }

    const q = quoteCache[p.ticker];
    const price = q ? q.price : NaN;
    const dayPct = q ? q.changePct : NaN;

    const strikeBreached = isFinite(price) && isFinite(p.strike) && price < p.strike;
    const knockoutBreached = isFinite(price) && isFinite(p.knockout) && price > p.knockout;
    const pctFromInitial = isFinite(price) && isFinite(p.initial) && p.initial !== 0
      ? ((price - p.initial) / p.initial) * 100
      : NaN;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="ticker-cell">${p.ticker}</td>
      <td class="${strikeBreached ? "cell-below-strike" : ""}"><input class="editable" type="number" step="any" value="${fmtNum(p.strike)}" placeholder="—" data-field="strike" data-index="${index}"></td>
      <td><input class="editable" type="number" step="any" value="${fmtNum(p.initial)}" placeholder="—" data-field="initial" data-index="${index}"></td>
      <td class="${gainClass(pctFromInitial)}">${fmtPct(pctFromInitial)}</td>
      <td class="${knockoutBreached ? "cell-above-knockout" : ""}"><input class="editable" type="number" step="any" value="${fmtNum(p.knockout)}" placeholder="—" data-field="knockout" data-index="${index}"></td>
      <td>${isFinite(price) ? fmtMoney(price) : "—"}</td>
      <td class="${gainClass(dayPct)}">${fmtPct(dayPct)}</td>
      <td><button class="remove-btn" data-index="${index}" title="Remove ticker">✕</button></td>
    `;
    tbody.appendChild(tr);
  });

  document.getElementById("totalTickers").textContent = positions.length;
  document.getElementById("totalGroups").textContent = new Set(positions.map(p => groupKey(p.group))).size;

  updateGroupList();
  attachRowHandlers();
}

function attachRowHandlers() {
  document.querySelectorAll(".editable").forEach(input => {
    input.addEventListener("change", (e) => {
      const index = Number(e.target.dataset.index);
      const field = e.target.dataset.field;
      const value = parseFloat(e.target.value);
      positions[index][field] = isFinite(value) ? value : null;
      savePositions();
      render();
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
  const groupInput = document.getElementById("newGroup");
  const strikeInput = document.getElementById("newStrike");
  const initialInput = document.getElementById("newInitial");
  const knockoutInput = document.getElementById("newKnockout");

  const ticker = tickerInput.value.trim().toUpperCase();
  const group = groupInput.value.trim();
  const strike = parseFloat(strikeInput.value);
  const initial = parseFloat(initialInput.value);
  const knockout = parseFloat(knockoutInput.value);

  if (!ticker) {
    document.getElementById("statusMsg").textContent = "Enter a ticker to add it.";
    return;
  }

  positions.push({
    ticker,
    group,
    strike: isFinite(strike) ? strike : null,
    initial: isFinite(initial) ? initial : null,
    knockout: isFinite(knockout) ? knockout : null,
  });
  savePositions();
  tickerInput.value = "";
  groupInput.value = "";
  strikeInput.value = "";
  initialInput.value = "";
  knockoutInput.value = "";
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
