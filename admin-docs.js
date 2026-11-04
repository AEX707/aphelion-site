// Admin: ask a partner or an agency for documents, and open what they uploaded.
// Used by admin.html ("Docs" button on each partner / agency).
// Files live in the private storage folder verification/<account id>/.
// Needs verification.sql to have been run once in Supabase.

(function () {
  const DOC_ITEMS = [
    'Company registration (登記簿謄本 or equivalent)',
    'Business licence (旅行業 / 旅行サービス手配業 / other)',
    'Liability insurance certificate',
    'Photo ID of the representative',
    'Travel agency registration or IATA number',
    'Other (see note)'
  ];
  let reqCache = null;
  const e = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // Text placed inside onclick="...('here')": escaped for JavaScript first, then for HTML.
  const jsq = v => String(v == null ? '' : v).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

  async function api(path, opts) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, Object.assign({}, opts, {
      headers: Object.assign({ apikey: SUPABASE_KEY, Authorization: `Bearer ${await getAccessToken()}`, 'Content-Type': 'application/json' }, (opts && opts.headers) || {})
    }));
    const text = await res.text();
    if (!res.ok) throw new Error(text || ('Status ' + res.status));
    // "return=minimal" answers have an empty body.
    return text ? JSON.parse(text) : null;
  }

  async function loadRequests() {
    try { reqCache = await api('doc_requests?select=*&order=created_at.desc'); }
    catch (err) { reqCache = null; }
    return reqCache;
  }

  // Small label on each partner / agency row: "Docs requested" / "Docs received".
  window.decorateDocBadges = async function () {
    const reqs = await loadRequests();
    if (!reqs) return;
    document.querySelectorAll('.doc-badge[data-acc]').forEach(el => {
      const mine = reqs.filter(r => r.account_id === el.dataset.acc);
      if (!mine.length) { el.innerHTML = ''; return; }
      const last = mine[0];
      const label = last.status === 'submitted' ? '📎 Documents received — check' : last.status === 'requested' ? '⏳ Documents requested' : 'Documents checked';
      const color = last.status === 'submitted' ? '#1d4ed8' : last.status === 'requested' ? '#b45309' : 'var(--muted)';
      el.innerHTML = `<span style="display:inline-block; margin-top:4px; font-size:12px; font-weight:700; color:${color};">${label}</span>`;
    });
  };

  function modal(html) {
    let m = document.getElementById('docModal');
    if (!m) {
      m = document.createElement('div');
      m.id = 'docModal';
      m.style.cssText = 'position:fixed; inset:0; background:rgba(21,33,61,.55); z-index:200; display:flex; align-items:center; justify-content:center; padding:16px;';
      m.addEventListener('click', ev => { if (ev.target === m) m.remove(); });
      document.body.appendChild(m);
    }
    m.innerHTML = `<div style="background:#fff; border-radius:18px; width:min(620px,100%); max-height:90vh; overflow:auto; padding:24px 26px;">${html}</div>`;
    return m;
  }
  window.closeDocModal = () => { const m = document.getElementById('docModal'); if (m) m.remove(); };

  window.openDocRequest = async function (accountId, type, email, name) {
    const reqs = (await loadRequests()) || [];
    const mine = reqs.filter(r => r.account_id === accountId);
    let filesHtml = '<p style="color:var(--muted); font-size:13px;">No files uploaded yet.</p>';
    try {
      const { data } = await supabaseClient.storage.from('verification').list(accountId, { limit: 100, sortBy: { column: 'created_at', order: 'desc' } });
      const files = (data || []).filter(f => f.name && !f.name.startsWith('.'));
      if (files.length) {
        filesHtml = '<ul style="list-style:none; padding:0; margin:0;">' + files.map(f =>
          `<li style="padding:6px 0; border-bottom:1px solid #eee; font-size:14px;">📄 <a href="#" onclick="openDocFile('${jsq(accountId + '/' + f.name)}'); return false;" style="color:var(--wood); text-decoration:underline;">${e(f.name.replace(/^\d+-\d+-/, ''))}</a> <span style="color:var(--muted); font-size:12px;">${f.created_at ? new Date(f.created_at).toLocaleDateString('en-GB') : ''}</span></li>`).join('') + '</ul>';
      }
    } catch (err) { filesHtml = '<p style="color:#b42318; font-size:13px;">Could not list files: ' + e(err.message) + '</p>'; }

    const history = mine.length
      ? '<ul style="margin:0 0 0 18px; font-size:13px;">' + mine.map(r => `<li>${new Date(r.created_at).toLocaleDateString('en-GB')} · <b>${e(r.status)}</b> · ${e((r.items || []).join('; '))}${r.status === 'submitted' ? ` · <a href="#" onclick="closeDocRequest(${r.id}, '${accountId}', '${type}', '${jsq(email)}', '${jsq(name)}'); return false;" style="color:var(--wood);">mark as checked</a>` : ''}</li>`).join('') + '</ul>'
      : '<p style="color:var(--muted); font-size:13px;">No requests yet.</p>';

    modal(`
      <div style="display:flex; justify-content:space-between; align-items:center; gap:12px;">
        <h3 style="margin:0; font-size:24px;">Documents · ${e(name)}</h3>
        <button type="button" onclick="closeDocModal()" style="font-size:24px; line-height:1;">×</button>
      </div>
      <p style="color:var(--muted); font-size:13px; margin:4px 0 16px;">${type === 'agency' ? 'Travel agency' : 'Partner'} · ${e(email)}</p>
      <h4 style="font:600 17px var(--serif); margin:0 0 8px;">Uploaded files</h4>
      ${filesHtml}
      <h4 style="font:600 17px var(--serif); margin:18px 0 8px;">Requests</h4>
      ${history}
      <h4 style="font:600 17px var(--serif); margin:18px 0 8px;">Ask for documents</h4>
      ${DOC_ITEMS.map((it, i) => `<label style="display:flex; gap:8px; align-items:flex-start; font-size:14px; text-transform:none; letter-spacing:0; font-weight:500; margin:6px 0; color:var(--wood);"><input type="checkbox" class="docItem" value="${e(it)}" style="width:auto; margin-top:3px;"> <span>${e(it)}</span></label>`).join('')}
      <textarea id="docNote" rows="3" placeholder="Note for the company (optional), e.g. why you need it" style="margin-top:8px;"></textarea>
      <p id="docErr" style="color:#b42318; font-size:13px; display:none; margin-top:8px;"></p>
      <div style="display:flex; gap:10px; justify-content:flex-end; margin-top:14px;">
        <button type="button" class="btn btn-outline" onclick="closeDocModal()">Close</button>
        <button type="button" class="btn btn-primary" id="docSend" onclick="sendDocRequest('${accountId}', '${type}', '${jsq(email)}', '${jsq(name)}')">Send request</button>
      </div>`);
  };

  window.openDocFile = async function (path) {
    const { data, error } = await supabaseClient.storage.from('verification').createSignedUrl(path, 600);
    if (error || !data) { alert('Could not open the file: ' + (error ? error.message : '')); return; }
    window.open(data.signedUrl, '_blank', 'noopener');
  };

  window.sendDocRequest = async function (accountId, type, email, name) {
    const items = [...document.querySelectorAll('.docItem:checked')].map(x => x.value);
    const note = document.getElementById('docNote').value.trim();
    const err = document.getElementById('docErr');
    if (!items.length) { err.textContent = 'Tick at least one document.'; err.style.display = 'block'; return; }
    const btn = document.getElementById('docSend');
    btn.disabled = true; btn.textContent = 'Sending…';
    try {
      await api('doc_requests', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ account_id: accountId, account_type: type, items, note: note || null }) });
      if (email) {
        const html = mailLayout('VERIFICATION', 'A few documents, please',
          `<p>Dear ${e(name)},</p>
           <p>Thank you for registering with Aphelion Expeditions. To complete the review of your ${type === 'agency' ? 'agency' : 'partner'} account, please upload the following:</p>
           <ul>${items.map(i => '<li>' + e(i) + '</li>').join('')}</ul>
           ${note ? '<p><i>' + e(note) + '</i></p>' : ''}
           <p style="margin:18px 0;"><a href="https://aphelionexpeditions.com/docs.html" style="display:inline-block; background:${AEX_MAIL.navy}; color:#fff; text-decoration:none; padding:12px 22px; border-radius:24px; font-size:13px; font-weight:700; letter-spacing:1px;">UPLOAD DOCUMENTS</a></p>
           <p>The files are stored privately and are only seen by our team.</p>
           <p>Kind regards,<br>Aphelion Expeditions</p>`, '');
        sendNotificationEmail(email, 'Aphelion Expeditions — documents for your account', html);
      }
      closeDocModal();
      decorateDocBadges();
      alert('Request sent to ' + name + '.');
    } catch (ex) {
      err.textContent = 'Could not send: ' + ex.message + (/doc_requests/.test(ex.message) ? ' — run verification.sql in Supabase first.' : '');
      err.style.display = 'block';
      btn.disabled = false; btn.textContent = 'Send request';
    }
  };

  window.closeDocRequest = async function (id, accountId, type, email, name) {
    try {
      await api(`doc_requests?id=eq.${id}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ status: 'closed' }) });
      await decorateDocBadges();
      openDocRequest(accountId, type, email, name);
    } catch (ex) { alert('Could not update: ' + ex.message); }
  };
})();
