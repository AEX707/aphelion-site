// Currency selector — shared by pages that show tour prices.
// All prices are stored and charged in Japanese yen (JPY). This script only
// adds an *approximate* conversion next to each yen price, e.g. "≈ $102".
// Rates come from a free public service and are refreshed every 12 hours.
//
// How a page uses it: put <span class="price-approx" data-jpy="15000"></span>
// next to a yen price, and include <script src="currency.js"></script>.

(function () {
  const CURRENCIES = [
    ['JPY', '¥ JPY'],
    ['USD', '$ USD'],
    ['EUR', '€ EUR'],
    ['GBP', '£ GBP'],
    ['AUD', 'A$ AUD'],
    ['CAD', 'C$ CAD'],
    ['CNY', '¥ CNY'],
    ['TWD', 'NT$ TWD'],
    ['HKD', 'HK$ HKD'],
    ['KRW', '₩ KRW'],
    ['SGD', 'S$ SGD'],
    ['THB', '฿ THB']
  ];
  const STORE_CHOICE = 'aex_currency';
  const STORE_RATES = 'aex_rates';
  const RATES_MAX_AGE = 12 * 60 * 60 * 1000; // 12 hours

  let rates = null;

  function safeGet(key) { try { return localStorage.getItem(key); } catch (e) { return null; } }
  function safeSet(key, val) { try { localStorage.setItem(key, val); } catch (e) {} }

  let currency = safeGet(STORE_CHOICE) || 'JPY';

  async function loadRates() {
    try {
      const cached = JSON.parse(safeGet(STORE_RATES) || 'null');
      if (cached && Date.now() - cached.time < RATES_MAX_AGE) { rates = cached.rates; return; }
    } catch (e) {}
    try {
      const res = await fetch('https://open.er-api.com/v6/latest/JPY');
      const data = await res.json();
      if (data && data.rates) {
        rates = data.rates;
        safeSet(STORE_RATES, JSON.stringify({ time: Date.now(), rates }));
      }
    } catch (e) {
      console.error('Could not load exchange rates:', e);
    }
  }

  function format(jpy) {
    if (currency === 'JPY' || !rates || !rates[currency]) return '';
    const value = jpy * rates[currency];
    try {
      return '≈ ' + new Intl.NumberFormat('en', {
        style: 'currency', currency, maximumFractionDigits: 0
      }).format(value);
    } catch (e) {
      return '≈ ' + Math.round(value).toLocaleString() + ' ' + currency;
    }
  }

  function updatePrices() {
    document.querySelectorAll('.price-approx[data-jpy]').forEach(el => {
      const text = format(Number(el.dataset.jpy));
      if (el.textContent !== text) el.textContent = text;
      el.style.display = text ? 'block' : 'none';
    });
  }

  function addStyles() {
    const css = `
      .currency-select { background: transparent; color: inherit; border: 1px solid rgba(245,243,236,.18);
        border-radius: 6px; padding: 3px 6px; width: auto; min-width: 0; height: auto; font: inherit; font-size: 12px; letter-spacing: .5px; cursor: pointer; }
      .currency-select option { background: #0a0a12; color: #f2f0ea; }
      .currency-wrap { display: inline-flex; align-items: center; gap: 6px; text-transform: none; }
      .price-approx { display: none; color: var(--muted, #8a889a); font-size: 12px; margin-top: 2px;
        font-family: inherit; letter-spacing: 0; }
      @media (max-width: 760px) {
        .currency-wrap { display: flex; justify-content: center; margin-top: 6px; }
        .topbar-content > span:nth-child(2) { display: none; }
      }`;
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
  }

  function addSelector() {
    const bar = document.querySelector('.topbar-content');
    if (!bar) return;
    const wrap = document.createElement('label');
    wrap.className = 'currency-wrap';
    wrap.innerHTML = '<span>Currency</span>';
    const select = document.createElement('select');
    select.className = 'currency-select';
    select.setAttribute('aria-label', 'Display currency');
    CURRENCIES.forEach(([code, label]) => {
      const opt = document.createElement('option');
      opt.value = code; opt.textContent = label;
      if (code === currency) opt.selected = true;
      select.appendChild(opt);
    });
    select.addEventListener('change', () => {
      currency = select.value;
      safeSet(STORE_CHOICE, currency);
      updatePrices();
    });
    wrap.appendChild(select);
    // Sit next to the language picker when it is on the page (i18n.js).
    const box = window.AEX_topbarControls ? window.AEX_topbarControls() : null;
    (box || bar).appendChild(wrap);
  }

  document.addEventListener('DOMContentLoaded', async () => {
    addStyles();
    addSelector();
    // Tours load from the database after the page opens, so watch for
    // new prices appearing and convert them as they arrive.
    new MutationObserver(updatePrices).observe(document.body, { childList: true, subtree: true });
    await loadRates();
    updatePrices();
  });
})();
