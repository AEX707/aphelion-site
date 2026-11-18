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
      const label = last.status === 'submitted' ? '📎 Documents received' : last.status === 'requested' ? '⏳ Documents requested — waiting for the company' : '✓ Documents checked';
      const color = last.status === 'submitted' ? '#1d4ed8' : last.status === 'requested' ? '#b45309' : '#2E7D5B';
      const btn = last.status === 'submitted'
        ? ` <button type="button" onclick="acceptDocs('${jsq(el.dataset.acc)}')" style="margin-left:8px; padding:3px 10px; border-radius:12px; border:1px solid #2E7D5B; background:#2E7D5B; color:#fff; font-size:11px; font-weight:700; cursor:pointer;">✓ Accept</button>`
        : '';
      el.innerHTML = `<span style="display:inline-block; margin-top:4px; font-size:12px; font-weight:700; color:${color};">${label}</span>${btn}`;
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
    let fileCount = {};   // request id -> number of files uploaded for it
    try {
      const { data, error } = await supabaseClient.storage.from('verification').list(accountId, { limit: 100, sortBy: { column: 'created_at', order: 'desc' } });
      if (error) throw error;
      const files = (data || []).filter(f => f.name && !f.name.startsWith('.') && f.id);
      files.forEach(f => { const m = /^(\d+)-/.exec(f.name); if (m) fileCount[m[1]] = (fileCount[m[1]] || 0) + 1; });
      if (files.length) {
        // Signed links made up front (valid 1 hour): photos are shown right
        // here as previews, other files (PDF…) open with a plain link, so
        // the browser's pop-up blocker never gets in the way.
        const paths = files.map(f => accountId + '/' + f.name);
        let urls = {};
        try {
          const { data: signed } = await supabaseClient.storage.from('verification').createSignedUrls(paths, 3600);
          (signed || []).forEach(x => { if (x && x.signedUrl) urls[x.path] = x.signedUrl; });
        } catch (er) {}
        const isImg = n => /\.(jpe?g|png|gif|webp|heic|heif|bmp)$/i.test(n);
        const isPdf = n => /\.pdf$/i.test(n);
        filesHtml = `<p style="font-size:13px; color:var(--muted); margin:0 0 8px;">${files.length} file${files.length > 1 ? 's' : ''} in total</p>` + '<div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(160px, 1fr)); gap:12px;">' + files.map(f => {
          const path = accountId + '/' + f.name;
          const url = urls[path];
          const label = e(f.name.replace(/^\d+-\d+-/, ''));
          const date = f.created_at ? new Date(f.created_at).toLocaleDateString('en-GB') : '';
          const preview = url && isImg(f.name)
            ? `<img src="${e(url)}" alt="${label}" style="width:100%; height:130px; object-fit:cover; border-radius:10px; display:block; background:#f3f3f3;">`
            : `<div style="height:130px; border-radius:10px; background:#f3f1ea; display:flex; align-items:center; justify-content:center; font-size:40px;">${isPdf(f.name) ? '📕' : '📄'}</div>`;
          return `<a href="${url ? e(url) : '#'}" ${url ? 'target="_blank" rel="noopener"' : `onclick="openDocFile('${jsq(path)}'); return false;"`} style="text-decoration:none; color:var(--wood); border:1px solid #eee; border-radius:12px; padding:8px; display:block;">
              ${preview}
              <div style="font-size:12px; margin-top:6px; word-break:break-all;">${label}</div>
              <div style="font-size:11px; color:var(--muted);">${date} · ${isPdf(f.name) ? 'PDF' : isImg(f.name) ? 'Photo' : 'File'} · open ↗</div>
            </a>`;
        }).join('') + '</div>';
      }
    } catch (err) { filesHtml = '<p style="color:#b42318; font-size:13px;">Could not list files: ' + e(err.message) + '</p>'; }

    const history = mine.length
      ? '<ul style="margin:0 0 0 18px; font-size:13px;">' + mine.map(r => `<li>${new Date(r.created_at).toLocaleDateString('en-GB')} · <b>${e(r.status === 'closed' ? 'checked' : r.status)}</b> · ${e((r.items || []).join('; '))}${r.status !== 'requested' ? ` · <span style="color:${fileCount[r.id] ? '#2E7D5B' : '#b42318'};">${fileCount[r.id] || 0} file(s)</span>` : ''}${r.status === 'submitted' ? ` · <a href="#" onclick="closeDocRequest(${r.id}, '${accountId}', '${type}', '${jsq(email)}', '${jsq(name)}'); return false;" style="color:var(--wood);">mark as checked</a>` : ''}</li>`).join('') + '</ul>'
      : '<p style="color:var(--muted); font-size:13px;">No requests yet.</p>';

    modal(`
      <div style="display:flex; justify-content:space-between; align-items:center; gap:12px;">
        <h3 style="margin:0; font-size:24px;">Documents · ${e(name)}</h3>
        <button type="button" onclick="closeDocModal()" style="font-size:24px; line-height:1;">×</button>
      </div>
      <p style="color:var(--muted); font-size:13px; margin:4px 0 16px;">${type === 'agency' ? 'Travel agency' : 'Partner'} · ${e(email)}</p>
      ${mine.some(r => r.status === 'submitted') ? `
      <div style="display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap; padding:12px 14px; margin:0 0 16px; border-radius:12px; background:rgba(29,78,216,.07); border:1px solid rgba(29,78,216,.25);">
        <span style="font-size:14px; font-weight:700; color:#1d4ed8;">📎 New documents received — check the files below</span>
        <button type="button" class="btn btn-primary" style="padding:9px 16px;" onclick="acceptDocs('${jsq(accountId)}', () => openDocRequest('${jsq(accountId)}', '${type}', '${jsq(email)}', '${jsq(name)}'))">✓ Accept documents</button>
      </div>` : ''}
      <h4 style="font:600 17px var(--serif); margin:0 0 8px;">Uploaded files</h4>
      ${filesHtml}
      <h4 style="font:600 17px var(--serif); margin:18px 0 8px;">Requests</h4>
      ${history}
      <h4 style="font:600 17px var(--serif); margin:18px 0 8px;">${mine.length ? 'Need something else? Ask again' : 'Ask for documents'}</h4>
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
    // Same tab if the pop-up blocker stops the new one.
    const w = window.open(data.signedUrl, '_blank');
    if (!w) window.location.href = data.signedUrl;
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

  // "✓ Accept": every received (submitted) request of this account → checked.
  window.acceptDocs = async function (accountId, reopen) {
    try {
      const rows = await api(`doc_requests?account_id=eq.${accountId}&status=eq.submitted`, {
        method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ status: 'closed' })
      });
      if (!rows || !rows.length) throw new Error('nothing was changed (no permission to update doc_requests?)');
      await decorateDocBadges();
      if (reopen) reopen();
    } catch (ex) { alert('Could not mark as checked: ' + ex.message); }
  };

  window.closeDocRequest = async function (id, accountId, type, email, name) {
    try {
      await api(`doc_requests?id=eq.${id}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ status: 'closed' }) });
      await decorateDocBadges();
      openDocRequest(accountId, type, email, name);
    } catch (ex) { alert('Could not update: ' + ex.message); }
  };
})();
