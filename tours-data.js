// Shared tour data loader — fetches tours from the Supabase database.
// Used by index.html, tours.html, tour.html, booking.html.

const SUPABASE_URL = "https://agjmcokrlftutvnddohv.supabase.co";
const SUPABASE_KEY = "sb_publishable_vsbAvQlf9in0HDYZeP8asQ_znoG1onN";

let _toursCache = null;

// Aphelion's commission (Partner Terms v2.0): INCLUDED in the price.
// The partner enters the final price agencies pay; Aphelion keeps 10% of it
// and the partner receives 90%. Nothing is added on top any more.
// Also used by admin.html when it creates the payment link.
const COMMISSION_RATE = 0.10;

// Price the agency pays = the price the partner entered (commission inside).
function publicPrice(price) {
  return Math.round(Number(price));
}

// What the partner receives from a given agency price.
function partnerPayout(price) {
  return Math.round(Number(price) * (1 - COMMISSION_RATE));
}

// ---- Who is signed in (agencies see net prices) ----
// The Supabase login is kept by the browser. On pages that load the
// Supabase library the session is refreshed automatically; otherwise the
// saved token is used while it is still valid.
let _aexAuthClient = null;
async function currentAccessToken() {
  try {
    if (window.supabase && window.supabase.createClient) {
      _aexAuthClient = _aexAuthClient || window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
      const { data } = await _aexAuthClient.auth.getSession();
      return data && data.session ? data.session.access_token : null;
    }
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!/^sb-.*-auth-token$/.test(k)) continue;
      const v = JSON.parse(localStorage.getItem(k) || 'null');
      const s = v && (v.access_token ? v : v.currentSession);
      if (s && s.access_token && (!s.expires_at || s.expires_at * 1000 > Date.now() + 30000)) return s.access_token;
    }
  } catch (e) {}
  return null;
}

// Are net prices visible for this visitor? (false = sign in as an agency)
function pricesVisible(list) {
  return (list || _toursCache || []).some(t => t.price != null);
}

// Price block for tour cards: the price, or "sign in to see net prices".
function priceHtml(t) {
  if (t.price == null) {
    let pending = false;
    try { pending = sessionStorage.getItem('aex_agency_pending') === '1'; } catch (e) {}
    if (pending) return `<div class="price price-locked"><small>Net price</small><span>⏳ Agency approval pending</span></div>`;
    return `<div class="price price-locked"><small>Net price</small><a href="login.html?next=${encodeURIComponent(location.pathname.split('/').pop() + location.search + location.hash)}" onclick="event.stopPropagation()">🔒 Sign in as agency</a></div>`;
  }
  return `<div class="price"><small>From</small><strong>¥${Number(t.price).toLocaleString('ja-JP')}</strong><span class="price-approx" data-jpy="${t.price}"></span></div>`;
}

// Public-facing: only tours that have been approved by an admin.
// This is what the storefront (index/tours/tour/booking/trip pages) uses.
// Net prices are included only for approved agencies (and admins); everyone
// else gets the same tours without prices (database function catalog_tours).
async function getTours() {
  if (_toursCache) return _toursCache;
  try {
    const token = await currentAccessToken();
    const call = auth => fetch(`${SUPABASE_URL}/rest/v1/rpc/catalog_tours`, {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${auth}`, 'Content-Type': 'application/json' },
      body: '{}'
    });
    let res = await call(token || SUPABASE_KEY);
    if (!res.ok && token) res = await call(SUPABASE_KEY);          // expired login -> as a visitor
    let data;
    if (res.ok) {
      data = await res.json();
    } else {
      // Before the agencies SQL step has been run: the old direct read.
      const old = await fetch(`${SUPABASE_URL}/rest/v1/tours?select=*&status=eq.approved&order=id.asc`, {
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
      });
      if (!old.ok) throw new Error('Supabase request failed: ' + res.status + ' / ' + old.status);
      data = await old.json();
    }
    // map group_size (database column name) back to "group" so existing
    // page code (t.group) keeps working unchanged.
    // Agencies see exactly the price the partner entered — Aphelion's 10%
    // commission is already inside it (Partner Terms v2.0).
    _toursCache = data.map(t => ({
      ...t,
      group: t.group_size,
      base_price: t.price,
      price: t.price == null ? null : publicPrice(t.price)
    }));
    registerTourTranslations(_toursCache);
    return _toursCache;
  } catch (err) {
    console.error('Failed to load tours from database:', err);
    return [];
  }
}

// Admin-facing: every tour regardless of status (pending/approved/rejected),
// so the admin panel can review and moderate everything. Never cached.
// Pass the signed-in admin's access token; without it the database only
// returns approved tours (same as the public site).
async function getAllToursAdmin(accessToken) {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/tours?select=*&order=id.asc`, {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${accessToken || SUPABASE_KEY}`
      }
    });
    if (!res.ok) throw new Error('Supabase request failed: ' + res.status);
    const data = await res.json();
    return data.map(t => ({ ...t, group: t.group_size }));
  } catch (err) {
    console.error('Failed to load tours from database:', err);
    return [];
  }
}

// --- Automatic tour translations ---
// When the admin approves a tour, the "translate-tour" function stores
// translations of its text in tours.translations, e.g.
//   { "ja": { "title": "...", "description": "..." }, "fr": {...}, "_lang": "en" }
// Here we hand them to the language switcher (i18n.js), which swaps the
// partner's original text for the visitor's language on the page.
const TOUR_TEXT_FIELDS = ['title', 'description', 'location', 'duration', 'group_size', 'tag'];
// Some fields are shown with an icon in front, e.g. "⏱ 3 hours".
const TOUR_FIELD_PREFIXES = { duration: ['⏱ '], group_size: ['👥 '], location: ['📍 '] };

function registerTourTranslations(tours) {
  const all = window.AEX_TOUR_I18N = window.AEX_TOUR_I18N || {};
  window.AEX_TOUR_TRANSLATED_IDS = window.AEX_TOUR_TRANSLATED_IDS || {};
  tours.forEach(t => {
    const tr = t.translations;
    if (!tr || typeof tr !== 'object') return;
    Object.keys(tr).forEach(lang => {
      if (lang.startsWith('_') || !tr[lang]) return;
      const dict = all[lang] = all[lang] || {};
      TOUR_TEXT_FIELDS.forEach(f => {
        const original = (t[f] == null ? '' : String(t[f])).replace(/\s+/g, ' ').trim();
        const translated = tr[lang][f];
        if (!original || !translated) return;
        dict[original] = translated;
        (TOUR_FIELD_PREFIXES[f] || []).forEach(p => { dict[p + original] = p + translated; });
      });
      (window.AEX_TOUR_TRANSLATED_IDS[lang] = window.AEX_TOUR_TRANSLATED_IDS[lang] || {})[t.id] = true;
    });
  });
  if (window.AEX_refreshTranslations) window.AEX_refreshTranslations();
}
