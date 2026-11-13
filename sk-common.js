// 白崎堂 Partner Portal — shared helpers
(function () {
  const cfg = window.SK || {};
  let client = null;
  try {
    client = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
  } catch (e) {
    console.error('Supabase not loaded', e);
  }
  window.sb = client;

  window.yen = n => '¥' + Math.round(Number(n) || 0).toLocaleString('ja-JP');
  window.esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  window.$ = (sel, root) => (root || document).querySelector(sel);
  window.$$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  window.fmtDate = d => d ? new Date(d).toLocaleDateString('ja-JP') : '';
  window.fmtMonth = d => { if (!d) return ''; const [y, m] = String(d).split('-'); return `${y}年${Number(m)}月`; };

  window.toast = msg => {
    const t = document.createElement('div');
    t.className = 'toast'; t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2800);
  };

  window.showNote = (el, kind, msg) => {
    el.className = 'note ' + kind; el.textContent = msg; el.classList.remove('hidden');
  };

  // Tabs: <div class="tabs"><button data-tab="x">…</button></div> + <section class="pane" id="pane-x">
  window.initTabs = (onChange) => {
    const tabs = $$('.tabs button');
    const open = name => {
      tabs.forEach(b => b.classList.toggle('on', b.dataset.tab === name));
      $$('.pane').forEach(p => p.classList.toggle('on', p.id === 'pane-' + name));
      try { localStorage.setItem('sk-tab-' + location.pathname, name); } catch (e) {}
      if (onChange) onChange(name);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    tabs.forEach(b => b.addEventListener('click', () => open(b.dataset.tab)));
    let saved = null;
    try { saved = localStorage.getItem('sk-tab-' + location.pathname); } catch (e) {}
    open(tabs.some(b => b.dataset.tab === saved) ? saved : tabs[0].dataset.tab);
    return open;
  };

  // Friendly error text (JA + EN)
  window.errText = e => {
    const m = (e && (e.message || e.error_description)) || String(e);
    const map = {
      'Invalid login credentials': 'メールアドレスまたはパスワードが違います / Wrong e-mail or password',
      'Email not confirmed': 'メール認証が完了していません。受信メールのリンクを開いてください / Please confirm your e-mail first',
      'User already registered': 'このメールアドレスは登録済みです / This e-mail is already registered',
      'Account not approved yet': 'アカウントは審査中です / Account not approved yet',
      'Report for this month already sent': 'この月の報告は送信済みです / Report for this month already sent',
      'Cart is empty': 'カートが空です / Cart is empty'
    };
    for (const k in map) if (m.includes(k)) return map[k];
    if (m.startsWith('More than in stock')) return '在庫数を超えています / More than in stock: ' + m.split(':').pop();
    return m;
  };

  window.monthOptions = (count = 6) => {
    const out = []; const d = new Date(); d.setDate(1);
    for (let i = 0; i < count; i++) {
      const y = d.getFullYear(), m = d.getMonth() + 1;
      out.push({ value: `${y}-${String(m).padStart(2, '0')}-01`, label: `${y}年${m}月` });
      d.setMonth(d.getMonth() - 1);
    }
    return out;
  };
})();
