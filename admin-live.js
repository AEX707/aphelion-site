// Admin panel — live updates (like Gmail): new bookings, agencies, partners,
// documents, tours and reviews appear by themselves, without pressing F5.
// Uses Supabase Realtime (run realtime.sql once in Supabase).
// Also refreshes whenever you come back to the browser tab, so nothing is
// ever stale even if the live connection drops.
(function () {
  if (typeof supabaseClient === 'undefined') return;

  // What to reload for each table (only what that table affects).
  const RELOAD = {
    bookings:        ['loadBookings', 'loadAnalytics'],
    agencies:        ['loadAgencies'],
    partners:        ['loadPartners'],
    tours:           ['loadList', 'loadInvites'],
    partner_invites: ['loadInvites'],
    tour_reviews:    ['loadReviewsAdmin'],
    doc_requests:    ['decorateDocBadges']
  };
  // Which events deserve a ping (sound + pop-up + number in the browser tab).
  function pingFor(table, ev, row, old) {
    if (table === 'bookings' && ev === 'INSERT') return { tab: 'bookings', text: '📅 New booking request' + (row.company ? ' — ' + row.company : '') };
    if (table === 'agencies' && ev === 'INSERT') return { tab: 'agencies', text: row.source === 'partner' ? '🛒 Partner asks for buyer access — ' + (row.company_name || '') : '🏢 New agency registered — ' + (row.company_name || '') };
    if (table === 'partners' && ev === 'INSERT') return { tab: 'partners', text: '🤝 New partner registered — ' + (row.company_name || '') };
    if (table === 'doc_requests' && row.status === 'submitted' && (!old || old.status !== 'submitted')) return { tab: 'partners', text: '📎 Documents received' };
    if (table === 'tours' && (ev === 'INSERT' || (row.status === 'pending' && old && old.status !== 'pending')) && !row.awaiting_partner && row.status === 'pending') return { tab: 'tours', text: '🗾 Tour waiting for review — ' + (row.title || '') };
    if (table === 'tours' && old && old.awaiting_partner && !row.awaiting_partner) return { tab: 'tours', text: '✅ Partner published a tour — ' + (row.title || '') };
    if (table === 'tour_reviews' && ev === 'INSERT') return { tab: 'reviews', text: '⭐ New review' + (row.rating ? ' (' + row.rating + '★)' : '') };
    return null;
  }

  // ---- debounced reloads ----
  const pending = new Set();
  let timer = null;
  function reload(names) {
    names.forEach(n => pending.add(n));
    clearTimeout(timer);
    timer = setTimeout(() => {
      const list = Array.from(pending); pending.clear();
      if (typeof adminUnlocked !== 'undefined' && !adminUnlocked) return;
      list.forEach(n => { try { if (typeof window[n] === 'function') window[n](); } catch (e) {} });
    }, 600);
  }
  const ALL = Array.from(new Set([].concat(...Object.values(RELOAD))));

  // ---- styles: live dot, toasts ----
  const css = document.createElement('style');
  css.textContent = `
    .aex-live { flex: 0 0 auto; margin-left: auto; align-self: center; display: inline-flex; align-items: center; gap: 6px; font: 600 12px var(--sans, system-ui); color: var(--muted, #555); padding: 0 6px; white-space: nowrap; }
    .aex-live i { width: 8px; height: 8px; border-radius: 50%; background: #9ca3af; display: inline-block; }
    .aex-live.on i { background: #22c55e; box-shadow: 0 0 0 0 rgba(34,197,94,.6); animation: aexPulse 2s infinite; }
    @keyframes aexPulse { 0% { box-shadow: 0 0 0 0 rgba(34,197,94,.55); } 70% { box-shadow: 0 0 0 7px rgba(34,197,94,0); } 100% { box-shadow: 0 0 0 0 rgba(34,197,94,0); } }
    .aex-toasts { position: fixed; right: 16px; bottom: 16px; z-index: 300; display: flex; flex-direction: column; gap: 10px; max-width: min(360px, calc(100vw - 32px)); }
    .aex-toast { background: var(--wood, #15213D); color: #fff; border-radius: 14px; padding: 13px 16px; font: 600 14px var(--sans, system-ui);
      box-shadow: 0 10px 30px rgba(0,0,0,.25); cursor: pointer; animation: aexToastIn .25s ease; }
    .aex-toast small { display: block; font-weight: 400; opacity: .7; margin-top: 3px; font-size: 12px; }
    @keyframes aexToastIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
  `;
  document.head.appendChild(css);

  const toasts = document.createElement('div');
  toasts.className = 'aex-toasts';
  document.body.appendChild(toasts);

  function toast(p) {
    const t = document.createElement('div');
    t.className = 'aex-toast';
    t.innerHTML = '';
    t.textContent = p.text;
    const s = document.createElement('small'); s.textContent = 'Click to open'; t.appendChild(s);
    t.onclick = () => { if (window.showAdminTab) window.showAdminTab(p.tab, true); t.remove(); };
    toasts.appendChild(t);
    setTimeout(() => t.remove(), 12000);
  }

  // Short soft chime (no sound file needed).
  let audio = null;
  function chime() {
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      [880, 1320].forEach((f, i) => {
        const o = audio.createOscillator(), g = audio.createGain();
        o.frequency.value = f; o.type = 'sine';
        const t0 = audio.currentTime + i * 0.14;
        g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.18, t0 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.35);
        o.connect(g); g.connect(audio.destination); o.start(t0); o.stop(t0 + 0.4);
      });
    } catch (e) {}
  }
  // Browsers allow sound only after the first click on the page.
  document.addEventListener('click', () => { try { audio = audio || new (window.AudioContext || window.webkitAudioContext)(); audio.resume(); } catch (e) {} }, { once: true });

  // "(2) Tour Admin" in the browser tab while you are elsewhere.
  const baseTitle = document.title;
  let unseen = 0;
  function bumpTitle() { if (document.hidden) { unseen++; document.title = '(' + unseen + ') ' + baseTitle; } }
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      unseen = 0; document.title = baseTitle;
      reload(ALL);                        // came back → make sure everything is fresh
    }
  });

  // Desktop notification when the admin tab is in the background (asks once).
  function desktopNote(p) {
    try {
      if (!('Notification' in window) || Notification.permission !== 'granted' || !document.hidden) return;
      const n = new Notification('Aphelion Admin', { body: p.text, icon: 'favicon-48.png' });
      n.onclick = () => { window.focus(); if (window.showAdminTab) window.showAdminTab(p.tab, true); n.close(); };
    } catch (e) {}
  }
  document.addEventListener('click', () => { try { if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission(); } catch (e) {} }, { once: true });

  // ---- live dot in the admin menu ----
  let dot = null;
  function setDot(on) {
    if (!dot) {
      const bar = document.querySelector('.admin-tabs');
      if (!bar) return;
      dot = document.createElement('span');
      dot.className = 'aex-live';
      dot.innerHTML = '<i></i><span>Live</span>';
      bar.appendChild(dot);
    }
    dot.classList.toggle('on', !!on);
    dot.title = on ? 'Live: new items appear automatically' : 'Reconnecting… (updates when you return to this tab)';
  }

  // ---- connect (after sign-in) ----
  let channel = null;
  async function connect() {
    if (channel) return;
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) return;
    try { supabaseClient.realtime.setAuth(session.access_token); } catch (e) {}
    channel = supabaseClient.channel('admin-live');
    Object.keys(RELOAD).forEach(table => {
      channel.on('postgres_changes', { event: '*', schema: 'public', table }, payload => {
        const row = payload.new || {}, old = payload.old || null;
        reload(RELOAD[table]);
        const p = pingFor(table, payload.eventType, row, old && Object.keys(old).length > 1 ? old : null);
        if (p) { toast(p); chime(); bumpTitle(); desktopNote(p); }
      });
    });
    channel.subscribe(status => {
      setDot(status === 'SUBSCRIBED');
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        // try again a bit later
        const c = channel; channel = null;
        try { supabaseClient.removeChannel(c); } catch (e) {}
        setTimeout(connect, 15000);
      }
    });
  }
  supabaseClient.auth.onAuthStateChange((ev, session) => {
    if (session) { try { supabaseClient.realtime.setAuth(session.access_token); } catch (e) {} connect(); }
    else if (channel) { supabaseClient.removeChannel(channel); channel = null; setDot(false); }
  });
  connect();
  // Safety net: quiet refresh every 2 minutes while the tab is open and visible.
  setInterval(() => { if (!document.hidden) reload(ALL); }, 120000);
})();
