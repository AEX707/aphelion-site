// Admin panel menu: splits the long admin page into tabs
// (Analytics · Tours · Invites · Partners · Agencies · Bookings · Reviews).
// Each section stays exactly as it was — this only groups and shows one at a time.
// Red numbers on a tab = things waiting for you (pending / documents received).
(function () {
  const wrap = document.querySelector('.admin-wrap');
  if (!wrap) return;

  const TABS = [
    { id: 'analytics', icon: '📊', label: 'Analytics' },
    { id: 'tours',     icon: '🗾', label: 'Tours' },
    { id: 'invites',   icon: '✉️', label: 'Invites' },
    { id: 'partners',  icon: '🤝', label: 'Partners' },
    { id: 'agencies',  icon: '🏢', label: 'Agencies' },
    { id: 'bookings',  icon: '📅', label: 'Bookings' },
    { id: 'reviews',   icon: '⭐', label: 'Reviews' }
  ];

  // ---- group the page into panes (the <hr class="section-divider"> lines separate them) ----
  const nodes = Array.from(wrap.childNodes);
  const panes = [];
  let cur = null;
  const newPane = () => { cur = document.createElement('div'); cur.className = 'admin-pane'; panes.push(cur); };
  newPane();
  nodes.forEach(n => {
    if (n.nodeType === 1 && n.matches('hr.section-divider')) { n.remove(); newPane(); return; }
    cur.appendChild(n);
  });
  panes.forEach((p, i) => {
    const t = TABS[i] || { id: 'section' + i, icon: '•', label: (p.querySelector('h1') || {}).textContent || 'Section ' + (i + 1) };
    if (!TABS[i]) TABS[i] = t;
    p.dataset.tab = t.id;
    wrap.appendChild(p);
  });

  // ---- styles ----
  const css = document.createElement('style');
  css.textContent = `
    .admin-tabs { position: sticky; top: 0; z-index: 60; display: flex; gap: 6px; overflow-x: auto; -webkit-overflow-scrolling: touch;
      padding: 10px 0 12px; margin: -30px 0 26px; background: var(--void, #F8F7F3); border-bottom: 1px solid var(--border-soft, rgba(0,0,0,.08)); scrollbar-width: none; }
    .admin-tabs::-webkit-scrollbar { display: none; }
    .admin-tab { flex: 0 0 auto; display: inline-flex; align-items: center; gap: 7px; padding: 10px 16px; border-radius: 999px;
      border: 1px solid var(--border-soft, rgba(0,0,0,.12)); background: transparent; color: inherit; font: 600 14px var(--sans, system-ui);
      cursor: pointer; white-space: nowrap; transition: background .15s, border-color .15s; }
    .admin-tab:hover { border-color: var(--gold, #C9A24A); }
    .admin-tab.active { background: var(--wood, #15213D); border-color: var(--wood, #15213D); color: #fff; }
    .admin-tab .badge { min-width: 20px; height: 20px; padding: 0 6px; border-radius: 10px; background: #dc2626; color: #fff;
      font-size: 11px; font-weight: 800; display: inline-flex; align-items: center; justify-content: center; }
    .admin-tab .badge:empty { display: none; }
    .admin-pane { display: none; }
    .admin-pane.active { display: block; animation: aexPaneIn .18s ease; }
    @keyframes aexPaneIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
    @media (max-width: 640px) { .admin-tab { padding: 9px 13px; font-size: 13px; } }
  `;
  document.head.appendChild(css);

  // ---- tab bar ----
  const bar = document.createElement('div');
  bar.className = 'admin-tabs';
  bar.setAttribute('role', 'tablist');
  bar.innerHTML = TABS.slice(0, panes.length).map(t =>
    `<button type="button" class="admin-tab" role="tab" data-tab="${t.id}"><span>${t.icon}</span><span>${t.label}</span><span class="badge"></span></button>`
  ).join('');
  wrap.insertBefore(bar, wrap.firstChild);

  // Stick right under the site's sticky header.
  const header = document.querySelector('header');
  const headH = () => (header && getComputedStyle(header).position === 'sticky') ? header.offsetHeight : 0;
  const placeBar = () => { bar.style.top = headH() + 'px'; };
  placeBar();
  window.addEventListener('resize', placeBar);
  if (window.ResizeObserver && header) new ResizeObserver(placeBar).observe(header);

  // Keep the active tab visible on narrow screens (also once the admin
  // panel appears after sign-in — it is hidden until then).
  function centerActive() {
    const a = bar.querySelector('.admin-tab.active');
    if (a && bar.clientWidth) bar.scrollLeft = Math.max(0, a.offsetLeft - bar.offsetLeft - 24);
  }
  if (window.IntersectionObserver) new IntersectionObserver(en => { if (en.some(x => x.isIntersecting)) centerActive(); }).observe(bar);

  function show(id, scroll) {
    if (!panes.some(p => p.dataset.tab === id)) id = TABS[0].id;
    panes.forEach(p => p.classList.toggle('active', p.dataset.tab === id));
    bar.querySelectorAll('.admin-tab').forEach(b => {
      const on = b.dataset.tab === id;
      b.classList.toggle('active', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
      if (on) requestAnimationFrame(centerActive);
    });
    try { localStorage.setItem('aex_admin_tab', id); } catch (e) {}
    if (location.hash !== '#' + id) history.replaceState(null, '', '#' + id);
    if (scroll) window.scrollTo({ top: Math.max(0, wrap.getBoundingClientRect().top + window.scrollY + 30 - headH()), behavior: 'smooth' });
  }
  window.showAdminTab = show;
  bar.addEventListener('click', ev => {
    const b = ev.target.closest('.admin-tab');
    if (b) show(b.dataset.tab, true);
  });

  // Anything that scrolls to a form/element in another tab (e.g. "+ Add tour"
  // from Invites, "Edit" on a tour) switches to that tab first.
  const origScroll = Element.prototype.scrollIntoView;
  Element.prototype.scrollIntoView = function () {
    const pane = this.closest && this.closest('.admin-pane');
    if (pane && !pane.classList.contains('active')) show(pane.dataset.tab, false);
    return origScroll.apply(this, arguments);
  };

  let start = (location.hash || '').replace('#', '');
  if (!start) { try { start = localStorage.getItem('aex_admin_tab') || ''; } catch (e) {} }
  show(start || TABS[0].id, false);

  // ---- red counters: what is waiting for you in each tab ----
  function count(pane) {
    let n = pane.querySelectorAll('.admin-list .status-pill.pending, .admin-list .status-pill.edited').length;
    pane.querySelectorAll('.doc-badge').forEach(b => { if (/received/i.test(b.textContent)) n++; });
    return n;
  }
  let timer = null;
  function refreshBadges() {
    clearTimeout(timer);
    timer = setTimeout(() => {
      panes.forEach(p => {
        if (p.dataset.tab === 'analytics' || p.dataset.tab === 'invites') return;
        const b = bar.querySelector(`.admin-tab[data-tab="${p.dataset.tab}"] .badge`);
        const n = count(p);
        const txt = n ? String(n) : '';
        if (b && b.textContent !== txt) b.textContent = txt;
      });
    }, 150);
  }
  new MutationObserver(refreshBadges).observe(wrap, { childList: true, subtree: true, characterData: true });
  refreshBadges();
})();
