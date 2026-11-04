// Admin analytics — the "Analytics" block at the top of admin.html.
//
// Everything is counted automatically from the database every time the
// admin page opens (bookings, tours, partners, reviews, searches).
// Nothing to fill in by hand.
//
// Money: until online payments are connected, the amount of a booking is
// the amount charged (charge_amount) or, if empty, tour price x guests.
// Prices already include Aphelion's 10% (Partner Terms v2.0).

(function () {
  const AN = { bookings: [], tours: [], partners: [], reviews: [], searches: null, period: 30 };

  const CATEGORY_LABELS = {
    food: 'Food & Drink', culture: 'Culture', crafts: 'Crafts',
    night: 'Tokyo After Dark', nature: 'Nature', other: 'Other'
  };
  const CATEGORY_WORDS = {
    food: ['food', 'drink', 'gourmet', 'culinary', 'sake', 'cooking', 'izakaya', 'market'],
    culture: ['culture', 'cultural', 'temple', 'shrine', 'tea', 'history', 'tradition', 'art'],
    crafts: ['craft', 'workshop', 'knife', 'knives', 'ceramic', 'pottery', 'indigo', 'artisan'],
    night: ['night', 'bar', 'nightlife', 'evening', 'after dark'],
    nature: ['nature', 'hike', 'hiking', 'mountain', 'onsen', 'garden', 'outdoor']
  };

  const e = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const yen = n => '¥' + Math.round(Number(n) || 0).toLocaleString('ja-JP');
  const num = n => (Number(n) || 0).toLocaleString('en-US');
  const day = d => d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
  const pct = (a, b) => b ? Math.round(a / b * 100) + '%' : '—';

  function categoryOf(t) {
    const text = [t.category, t.tag, t.title].map(v => String(v || '').toLowerCase()).join(' ');
    for (const k of Object.keys(CATEGORY_WORDS)) if (CATEGORY_WORDS[k].some(w => text.includes(w))) return k;
    return 'other';
  }

  async function get(path) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${await getAccessToken()}` }
    });
    if (!res.ok) throw new Error(path.split('?')[0] + ': ' + res.status);
    return res.json();
  }

  window.loadAnalytics = async function () {
    const box = document.getElementById('analytics');
    if (!box) return;
    try {
      const [bookings, tours, partners, reviews] = await Promise.all([
        get('bookings?select=*&order=created_at.desc'),
        get('tours?select=*'),
        get('partners?select=id,company_name,email,status'),
        get('tour_reviews?select=*&order=created_at.desc').catch(() => [])
      ]);
      // Searches that found nothing — only after the SQL step has been run.
      let searches = null;
      try { searches = await get('search_log?select=*&order=created_at.desc&limit=2000'); } catch (err) { searches = null; }
      Object.assign(AN, { bookings, tours, partners, reviews, searches });
      render();
    } catch (err) {
      box.innerHTML = '<p style="color:#f19a9a;">Could not load analytics: ' + e(err.message) + '</p>';
    }
  };

  window.setAnalyticsPeriod = function (days) {
    AN.period = days;
    document.querySelectorAll('.an-period').forEach(b => b.classList.toggle('active', Number(b.dataset.days) === days));
    render();
  };

  function inPeriod(dateStr) {
    if (!AN.period) return true;
    return new Date(dateStr) >= new Date(Date.now() - AN.period * 864e5);
  }

  function render() {
    const tourById = {};
    AN.tours.forEach(t => { tourById[t.id] = t; });
    const partnerById = {};
    AN.partners.forEach(p => { partnerById[p.id] = p; });

    const amountOf = b => {
      if (Number(b.charge_amount)) return Number(b.charge_amount);
      const t = tourById[b.tour_id];
      return t ? Number(t.price || 0) * Number(b.travelers || 1) : 0;
    };
    const rows = AN.bookings.filter(b => inPeriod(b.created_at)).map(b => {
      const t = tourById[b.tour_id] || null;
      const p = t && t.partner_id ? partnerById[t.partner_id] : null;
      return {
        b, t, p,
        confirmed: b.status === 'confirmed',
        declined: b.status === 'declined',
        pending: !b.status || b.status === 'pending',
        paid: b.payment_status === 'paid',
        guests: Number(b.travelers || 0),
        amount: amountOf(b),
        region: t ? regionOfTour(t) : '',
        category: t ? categoryOf(t) : 'other'
      };
    });
    const conf = rows.filter(r => r.confirmed);
    const sum = (list, f) => list.reduce((s, r) => s + f(r), 0);
    const turnover = sum(conf, r => r.amount);

    // ---- Key numbers ----
    const kpis = [
      ['Booking requests', num(rows.length), `${num(rows.filter(r => r.pending).length)} waiting`],
      ['Confirmed', num(conf.length), `${pct(conf.length, rows.length)} of requests`],
      ['Declined', num(rows.filter(r => r.declined).length), ''],
      ['Guests (confirmed)', num(sum(conf, r => r.guests)), ''],
      ['Turnover (confirmed)', yen(turnover), `paid: ${yen(sum(conf.filter(r => r.paid), r => r.amount))}`],
      ['Aphelion income · 10%', yen(turnover * 0.10), `partners' 90%: ${yen(turnover * 0.90)}`]
    ];

    // ---- Requests per month, last 12 months ----
    const months = [];
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({ key: d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'), label: d.toLocaleDateString('en-GB', { month: 'short' }), total: 0, confirmed: 0 });
    }
    AN.bookings.forEach(b => {
      const m = months.find(x => x.key === String(b.created_at || '').slice(0, 7));
      if (m) { m.total++; if (b.status === 'confirmed') m.confirmed++; }
    });
    const maxM = Math.max(1, ...months.map(m => m.total));

    // ---- Group helper ----
    function groupBy(list, keyFn, labelFn) {
      const map = {};
      list.forEach(r => {
        const k = keyFn(r);
        if (!map[k]) map[k] = { key: k, label: labelFn(r), requests: 0, confirmed: 0, declined: 0, guests: 0, amount: 0, last: null, rows: [] };
        const g = map[k];
        g.requests++; g.rows.push(r);
        if (r.confirmed) { g.confirmed++; g.guests += r.guests; g.amount += r.amount; }
        if (r.declined) g.declined++;
        if (!g.last || r.b.created_at > g.last) g.last = r.b.created_at;
      });
      return Object.values(map).sort((a, b) => b.amount - a.amount || b.requests - a.requests);
    }

    // By partner company
    const byPartner = groupBy(rows, r => r.p ? r.p.id : (r.t ? 'aex' : 'none'),
      r => r.p ? r.p.company_name : (r.t ? 'Aphelion (own listing)' : 'General inquiry (no tour)'));
    const ratingOfPartner = pid => {
      const tids = AN.tours.filter(t => t.partner_id === pid).map(t => t.id);
      const rv = AN.reviews.filter(x => tids.includes(x.tour_id));
      return rv.length ? (rv.reduce((s, x) => s + Number(x.rating || 0), 0) / rv.length).toFixed(1) + ' (' + rv.length + ')' : '—';
    };
    const toursOfPartner = pid => AN.tours.filter(t => t.partner_id === pid).length;

    // By tour
    const byTour = groupBy(rows.filter(r => r.t), r => r.t.id, r => r.t.title);

    // By agency (buyer)
    const byAgency = groupBy(rows, r => (String(r.b.company || '').trim().toLowerCase() || String(r.b.email || '').toLowerCase()),
      r => r.b.company || r.b.email || 'Unknown');
    const lastEver = {};
    AN.bookings.forEach(b => {
      const k = String(b.company || '').trim().toLowerCase() || String(b.email || '').toLowerCase();
      if (!lastEver[k] || b.created_at > lastEver[k]) lastEver[k] = b.created_at;
    });

    // By region and category
    const byRegion = AEX_REGIONS.map(reg => {
      const list = rows.filter(r => r.region === reg.key);
      return { label: reg.no + '. ' + reg.name, requests: list.length, confirmed: list.filter(r => r.confirmed).length, tours: AN.tours.filter(t => t.status === 'approved' && regionOfTour(t) === reg.key).length };
    });
    const byCategory = Object.keys(CATEGORY_LABELS).map(k => {
      const list = rows.filter(r => r.category === k);
      return { label: CATEGORY_LABELS[k], requests: list.length, confirmed: list.filter(r => r.confirmed).length };
    }).filter(x => x.requests);

    // Low reviews (1–3 stars) in the period
    const low = AN.reviews.filter(r => Number(r.rating) <= 3 && inPeriod(r.created_at)).slice(0, 8);

    // Searches with no result
    let searchHtml;
    if (AN.searches === null) {
      searchHtml = `<p class="an-note">Not switched on yet: run <b>analytics.sql</b> once in Supabase → SQL Editor. After that, every search on the Tours page that finds nothing is counted here.</p>`;
    } else {
      const counts = {};
      AN.searches.filter(s => inPeriod(s.created_at) && Number(s.results) === 0 && s.query).forEach(s => {
        const k = String(s.query).trim().toLowerCase();
        counts[k] = (counts[k] || 0) + 1;
      });
      const top = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 12);
      searchHtml = top.length
        ? `<table class="an-table"><thead><tr><th>Search</th><th class="r">Times</th></tr></thead><tbody>${top.map(([q, n]) => `<tr><td>${e(q)}</td><td class="r">${n}</td></tr>`).join('')}</tbody></table>`
        : '<p class="an-note">No empty searches in this period.</p>';
    }

    const empty = '<p class="an-note">No bookings in this period.</p>';
    const bar = (v, max) => `<span class="an-bar"><i style="width:${max ? Math.max(2, Math.round(v / max * 100)) : 0}%"></i></span>`;
    const maxReg = Math.max(1, ...byRegion.map(x => x.requests));
    const maxCat = Math.max(1, ...byCategory.map(x => x.requests));

    document.getElementById('analytics').innerHTML = `
      <div class="an-kpis">${kpis.map(k => `<div class="an-kpi"><div class="l">${k[0]}</div><div class="v">${k[1]}</div><div class="s">${k[2]}</div></div>`).join('')}</div>

      <div class="an-card">
        <h3>Booking requests per month</h3>
        <p class="an-note">Last 12 months · dark = confirmed, light = not confirmed</p>
        <div class="an-months">${months.map(m => `
          <div class="an-mcol" title="${m.label}: ${m.total} requests, ${m.confirmed} confirmed">
            <span class="an-mval">${m.total || ''}</span>
            <div class="an-mstack" style="height:${Math.round(m.total / maxM * 100)}%">
              <div class="an-mconf" style="height:${m.total ? Math.round(m.confirmed / m.total * 100) : 0}%"></div>
            </div>
            <span class="an-mlab">${m.label}</span>
          </div>`).join('')}</div>
      </div>

      <div class="an-card">
        <h3>By partner company</h3>
        <p class="an-note">Who receives the bookings · sorted by turnover</p>
        ${byPartner.length ? `<div class="an-scroll"><table class="an-table"><thead><tr><th>Company</th><th class="r">Tours</th><th class="r">Requests</th><th class="r">Confirmed</th><th class="r">Declined</th><th class="r">Guests</th><th class="r">Turnover</th><th class="r">Partner 90%</th><th class="r">Rating</th></tr></thead><tbody>
          ${byPartner.map(g => {
            const pid = g.rows[0].p ? g.rows[0].p.id : null;
            return `<tr><td>${e(g.label)}</td><td class="r">${pid ? toursOfPartner(pid) : '—'}</td><td class="r">${g.requests}</td><td class="r">${g.confirmed}</td><td class="r${g.declined ? ' warn' : ''}">${g.declined}</td><td class="r">${g.guests}</td><td class="r">${yen(g.amount)}</td><td class="r">${yen(g.amount * 0.9)}</td><td class="r">${pid ? ratingOfPartner(pid) : '—'}</td></tr>`;
          }).join('')}</tbody></table></div>` : empty}
      </div>

      <div class="an-card">
        <h3>Top tours</h3>
        <p class="an-note">What agencies book most</p>
        ${byTour.length ? `<div class="an-scroll"><table class="an-table"><thead><tr><th>Code</th><th>Tour</th><th>Partner</th><th class="r">Requests</th><th class="r">Confirmed</th><th class="r">Guests</th><th class="r">Turnover</th></tr></thead><tbody>
          ${byTour.slice(0, 10).map(g => { const t = g.rows[0].t; return `<tr><td><span class="tour-code">${tourCode(t)}</span></td><td><a href="tour.html?id=${t.id}" target="_blank" rel="noopener">${e(g.label)}</a></td><td>${e(g.rows[0].p ? g.rows[0].p.company_name : 'Aphelion')}</td><td class="r">${g.requests}</td><td class="r">${g.confirmed}</td><td class="r">${g.guests}</td><td class="r">${yen(g.amount)}</td></tr>`; }).join('')}</tbody></table></div>` : empty}
      </div>

      <div class="an-card">
        <h3>By agency (buyers)</h3>
        <p class="an-note">Who orders · "quiet" = no request for 60+ days, a good moment to get in touch</p>
        ${byAgency.length ? `<div class="an-scroll"><table class="an-table"><thead><tr><th>Agency</th><th class="r">Requests</th><th class="r">Confirmed</th><th class="r">Guests</th><th class="r">Turnover</th><th class="r">Last request</th></tr></thead><tbody>
          ${byAgency.map(g => { const last = lastEver[g.key]; const quiet = last && (Date.now() - new Date(last)) > 60 * 864e5; return `<tr><td>${e(g.label)}${quiet ? ' <span class="an-tag">quiet</span>' : ''}</td><td class="r">${g.requests}</td><td class="r">${g.confirmed}</td><td class="r">${g.guests}</td><td class="r">${yen(g.amount)}</td><td class="r">${day(last)}</td></tr>`; }).join('')}</tbody></table></div>` : empty}
      </div>

      <div class="an-two">
        <div class="an-card">
          <h3>Demand by region</h3>
          <p class="an-note">Requests · approved tours in the region</p>
          <table class="an-table"><tbody>${byRegion.map(x => `<tr><td>${x.label}</td><td class="w">${bar(x.requests, maxReg)}</td><td class="r">${x.requests}</td><td class="r muted">${x.tours} ${x.tours === 1 ? "tour" : "tours"}</td></tr>`).join('')}</tbody></table>
        </div>
        <div class="an-card">
          <h3>Demand by category</h3>
          <p class="an-note">Requests · confirmed</p>
          ${byCategory.length ? `<table class="an-table"><tbody>${byCategory.map(x => `<tr><td>${e(x.label)}</td><td class="w">${bar(x.requests, maxCat)}</td><td class="r">${x.requests}</td><td class="r muted">${x.confirmed} conf.</td></tr>`).join('')}</tbody></table>` : empty}
        </div>
      </div>

      <div class="an-two">
        <div class="an-card">
          <h3>Searches that found nothing</h3>
          <p class="an-note">What agencies look for but we don't have yet — partners to find</p>
          ${searchHtml}
        </div>
        <div class="an-card">
          <h3>Low reviews (1–3★)</h3>
          <p class="an-note">Only the ones that need attention</p>
          ${low.length ? `<table class="an-table"><tbody>${low.map(r => `<tr><td class="warn">${'★'.repeat(Number(r.rating))}</td><td><a href="tour.html?id=${r.tour_id}#reviews" target="_blank" rel="noopener">${e(tourById[r.tour_id] ? tourById[r.tour_id].title : 'Tour #' + r.tour_id)}</a><div class="muted">${e(r.company || 'Agency')} · ${day(r.created_at)}</div></td></tr>`).join('')}</tbody></table>` : '<p class="an-note">No low reviews in this period.</p>'}
        </div>
      </div>`;
  }
})();
