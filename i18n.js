// Language switcher — shared by all public pages.
//
// How it works: the pages are written in English. When a visitor picks
// another language, this script loads lang/<code>.js (a list of
// "English text" → "translation") and swaps every matching piece of text
// on the page, including text that appears later (tour cards loaded from
// the database, "Submitting..." on buttons, error messages).
// Picking English again restores the original text.
//
// To fix or add a translation: edit the matching file in the lang/ folder.
// The English text on the left must match the page text exactly.

(function () {
  const LANGS = [
    ['en', 'English'],
    ['fr', 'Français'],
    ['de', 'Deutsch'],
    ['es', 'Español'],
    ['it', 'Italiano'],
    ['ja', '日本語'],
    ['zh-CN', '简体中文'],
    ['zh-TW', '繁體中文'],
    ['ko', '한국어']
  ];
  const STORE_KEY = 'aex_lang';
  const ATTRS = ['placeholder', 'aria-label', 'title', 'alt'];

  // Messages built in code as "fixed start + changing end", e.g.
  // "Login failed: " + reason. The fixed start is translated, the rest kept.
  const PREFIXES = [
    'Request: ',
    'Could not submit your request. Please try again or email us directly. (',
    'Could not create your account: ',
    'Login failed: '
  ];

  // Every language file adds itself here: window.AEX_I18N['fr'] = {...}
  window.AEX_I18N = window.AEX_I18N || {};

  function safeGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function safeSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

  function detectLanguage() {
    const saved = safeGet(STORE_KEY);
    if (saved && LANGS.some(l => l[0] === saved)) return saved;
    const prefs = (navigator.languages && navigator.languages.length)
      ? navigator.languages : [navigator.language || 'en'];
    for (const raw of prefs) {
      const p = String(raw).toLowerCase();
      if (p.startsWith('zh')) {
        return /(tw|hk|mo|hant)/.test(p) ? 'zh-TW' : 'zh-CN';
      }
      const base = p.split('-')[0];
      const hit = LANGS.find(l => l[0] === base);
      if (hit) return hit[0];
    }
    return 'en';
  }

  let lang = detectLanguage();
  let dict = null;
  let originalTitle = null;

  function norm(s) { return s.replace(/\s+/g, ' ').trim(); }

  function lookup(english) {
    if (!dict) return null;
    if (Object.prototype.hasOwnProperty.call(dict, english)) return dict[english];
    for (const p of PREFIXES) {
      if (english.startsWith(p) && dict[p]) return dict[p] + english.slice(p.length);
    }
    return null;
  }

  function skip(el) {
    return !el || el.closest('script, style, [translate="no"], .lang-wrap, .currency-select');
  }

  // --- text ---
  function translateTextNode(node) {
    const current = node.nodeValue;
    if (node.__aexSrc === undefined || current !== node.__aexOut) {
      // first time we see this text, or the page's own code changed it
      if (!/[A-Za-zÀ-ÿ]/.test(current)) return;
      node.__aexSrc = current;
    }
    const src = node.__aexSrc;
    const key = norm(src);
    if (!key) return;
    const t = lookup(key);
    let out = src;
    if (t != null) {
      const lead = src.match(/^\s*/)[0];
      const trail = src.match(/\s*$/)[0];
      out = lead + t + trail;
    }
    node.__aexOut = out;
    if (current !== out) node.nodeValue = out;
  }

  // --- attributes (placeholder, alt, ...) ---
  function translateAttrs(el) {
    for (const a of ATTRS) {
      if (!el.hasAttribute(a)) continue;
      const store = 'aexSrc' + a.replace(/-(.)/g, (m, c) => c.toUpperCase());
      const current = el.getAttribute(a);
      const lastOut = el['__aexOut_' + a];
      if (el.dataset[store] === undefined || current !== lastOut) el.dataset[store] = current;
      const src = el.dataset[store];
      const t = lookup(norm(src));
      const out = t != null ? t : src;
      el['__aexOut_' + a] = out;
      if (current !== out) el.setAttribute(a, out);
    }
  }

  function translateTree(root) {
    if (root.nodeType === 3) {
      if (!skip(root.parentElement)) translateTextNode(root);
      return;
    }
    if (root.nodeType !== 1 || skip(root)) return;
    translateAttrs(root);
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
      acceptNode(n) {
        const el = n.nodeType === 1 ? n : n.parentElement;
        return skip(el) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
      }
    });
    let n;
    while ((n = walker.nextNode())) {
      if (n.nodeType === 3) translateTextNode(n);
      else translateAttrs(n);
    }
  }

  function translatePage() {
    if (originalTitle === null) originalTitle = document.title;
    const t = lookup(norm(originalTitle));
    document.title = t != null ? t : originalTitle;
    document.documentElement.lang = lang;
    translateTree(document.body);
  }

  function loadLanguage(code, done) {
    if (code === 'en') { dict = null; done(); return; }
    if (window.AEX_I18N[code]) { dict = window.AEX_I18N[code]; done(); return; }
    const s = document.createElement('script');
    s.src = 'lang/' + code + '.js';
    s.onload = () => { dict = window.AEX_I18N[code] || null; done(); };
    s.onerror = () => { console.error('Could not load language file', code); dict = null; done(); };
    document.head.appendChild(s);
  }

  function setLanguage(code) {
    lang = code;
    safeSet(STORE_KEY, code);
    loadLanguage(code, translatePage);
  }

  function addStyles() {
    const css = `
      .topbar-controls { display: flex; align-items: center; gap: 14px; text-transform: none; }
      .topbar-controls .currency-wrap { margin-top: 0; }
      .lang-wrap { display: inline-flex; align-items: center; gap: 6px; }
      .lang-wrap svg { width: 14px; height: 14px; opacity: .8; }
      .lang-select { background: transparent; color: inherit; border: 1px solid rgba(245,243,236,.18);
        border-radius: 6px; padding: 3px 6px; width: auto; min-width: 0; height: auto; font: inherit;
        font-size: 12px; letter-spacing: .5px; cursor: pointer; }
      .lang-select option { background: #0a0a12; color: #f2f0ea; }
      @media (max-width: 760px) {
        .topbar-controls { justify-content: center; flex-wrap: wrap; margin-top: 6px; }
        .topbar-content > span:nth-child(2) { display: none; }
      }`;
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
  }

  // The top bar holds the language and currency pickers side by side.
  function topbarControls() {
    const bar = document.querySelector('.topbar-content');
    if (!bar) return null;
    let box = bar.querySelector('.topbar-controls');
    if (!box) {
      box = document.createElement('div');
      box.className = 'topbar-controls';
      bar.appendChild(box);
    }
    return box;
  }
  window.AEX_topbarControls = topbarControls;

  function addSelector() {
    const box = topbarControls();
    if (!box) return;
    const wrap = document.createElement('label');
    wrap.className = 'lang-wrap';
    wrap.setAttribute('translate', 'no');
    wrap.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">'
      + '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-5.7-3.8-9s1.3-6.3 3.8-9z"/></svg>';
    const select = document.createElement('select');
    select.className = 'lang-select';
    select.setAttribute('aria-label', 'Language');
    LANGS.forEach(([code, name]) => {
      const opt = document.createElement('option');
      opt.value = code; opt.textContent = name;
      if (code === lang) opt.selected = true;
      select.appendChild(opt);
    });
    select.addEventListener('change', () => setLanguage(select.value));
    wrap.appendChild(select);
    box.insertBefore(wrap, box.firstChild);
  }

  document.addEventListener('DOMContentLoaded', () => {
    addStyles();
    addSelector();
    loadLanguage(lang, translatePage);
    // Translate text that appears later (tour cards, messages, buttons).
    new MutationObserver(records => {
      if (lang === 'en') return;
      for (const r of records) {
        if (r.type === 'characterData') translateTree(r.target);
        else r.addedNodes.forEach(translateTree);
      }
    }).observe(document.body, { childList: true, subtree: true, characterData: true });
  });
})();
