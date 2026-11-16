// Admin — "Invite a partner" (Founding Partner onboarding).
//
// 1. "+ Invite a partner": company + email → an invite is created.
// 2. "+ Add tour for them": the normal tour form opens; the tour is saved as a
//    hidden draft for this partner (never shown in the catalogue).
// 3. "Send invitation": the partner gets a personal sign-up link by email.
// 4. The partner registers (ticks "I agree" themselves), the prepared tours
//    appear in their dashboard, they check prices and click "Publish".
//
// Automatic reminders (sent when the admin panel is opened, once each):
//  - invitation sent 3+ days ago and still not registered;
//  - registered 3+ days ago but prepared tours still not published.
// Needs partner-invites.sql to be run once in Supabase.

(function () {
  const SITE = 'https://aphelionexpeditions.com';
  const DAY = 864e5;
  let INV = [];            // invites
  let INV_TOURS = [];      // tours linked to invites (id, title, price, invite_id, awaiting_partner)
  let reminding = false;

  async function api(path, opts = {}) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      ...opts,
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${await getAccessToken()}`,
        'Content-Type': 'application/json',
        ...(opts.headers || {})
      }
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error('Status ' + res.status + (t ? ' — ' + t.slice(0, 200) : ''));
    }
    const txt = await res.text();
    return txt ? JSON.parse(txt) : null;
  }

  function msg(text, ok) {
    const el = document.getElementById('inviteStatusMsg');
    if (!el) return;
    el.textContent = text;
    el.className = 'status-msg ' + (ok ? 'ok' : 'err');
    setTimeout(() => { el.className = 'status-msg'; }, 6000);
  }

  const inviteLink = inv => `${SITE}/partner.html?invite=${inv.id}`;
  const shortDate = d => d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '';
  const daysSince = d => d ? (Date.now() - new Date(d)) / DAY : 0;

  // ---------- Emails ----------
  function tourListHtml(tours) {
    if (!tours.length) return '';
    return `<table style="width:100%; border-collapse:collapse; margin-top:6px;">` + tours.map(t =>
      `<tr><td style="padding:9px 0; font-size:14px; font-weight:600; color:${AEX_MAIL.text}; border-bottom:1px solid ${AEX_MAIL.line};">${esc(t.title)}</td>
       <td style="padding:9px 0; font-size:14px; color:${AEX_MAIL.muted}; text-align:right; border-bottom:1px solid ${AEX_MAIL.line}; white-space:nowrap;">${t.price ? '¥' + Number(t.price).toLocaleString('ja-JP') : ''}</td></tr>`
    ).join('') + `</table>`;
  }

  function benefitsHtml(inv) {
    if (!inv.founding) return '';
    return mailSection('Your Founding Partner benefits', `<ul style="margin:6px 0 0; padding-left:18px;">
        <li style="margin:3px 0;"><b>Listings set up for you</b> — we prepared your pages from your own catalog, free of charge.</li>
        <li style="margin:3px 0;"><b>Founding Partner badge</b> on your profile and listings.</li>
        <li style="margin:3px 0;"><b>15% commission fixed for 24 months</b> — included in your price, never added on top. No listing, sign-up or monthly fees.</li>
      </ul>`);
  }

  function invitationMail(inv, tours) {
    const name = esc(inv.contact_person || inv.company_name);
    const n = tours.length;
    return mailLayout('PARTNER INVITATION ・ ご招待', `${esc(inv.company_name)} on Aphelion Expeditions`,
      `<p>Dear ${name},</p>
       <p>Thank you for your interest in working with us. To save your time, we have ${n ? `already prepared <b>${n} listing${n > 1 ? 's' : ''}</b>` : 'prepared your partner account'} on Aphelion Expeditions, based on your own catalog.</p>
       <p>All that is left: create your account with the button below (about 2 minutes), accept the Partner Terms, then check the content and prices and click <b>Publish</b>. Nothing goes live without your approval, and you can edit everything at any time.</p>
       <p style="color:${AEX_MAIL.muted}; font-size:13px;">${name} 様<br>御社のカタログをもとに、Aphelion Expeditions の掲載ページを${n ? n + '件' : ''}作成いたしました。下のボタンからアカウントを作成し（約2分）、パートナー規約にご同意のうえ、内容と料金をご確認いただき「公開」を押してください。ご承認なしに公開されることはありません。</p>`,
      (n ? mailSection('Prepared for you', tourListHtml(tours)) : '') +
      `<p style="margin:22px 0 4px;">${mailButton(inviteLink(inv), 'CREATE MY ACCOUNT', true)}</p>
       <p style="font-size:12px; color:${AEX_MAIL.muted}; margin:0 0 6px;">Please register with this email address: <b>${esc(inv.email)}</b> — your listings are linked to it.</p>` +
      benefitsHtml(inv) +
      mailSection('How it works', `<ul style="margin:6px 0 0; padding-left:18px;">
          <li style="margin:3px 0;">Registered travel agencies book your experiences on the platform and pay in advance.</li>
          <li style="margin:3px 0;">You set your own prices. Aphelion's 15% commission is already inside the price.</li>
          <li style="margin:3px 0;">Payouts are monthly by bank transfer; we pay the transfer fees.</li>
        </ul>
        <p style="margin:12px 0 0;">Partner Terms: <a href="${SITE}/partner-terms.html" style="color:${AEX_MAIL.navy};">${SITE.replace('https://', '')}/partner-terms.html</a></p>`) +
      `<p style="margin-top:22px;">If you have any questions, simply reply to this email.</p>
       <p>Kind regards,<br>Aphelion Expeditions</p>`);
  }

  function reminderJoinMail(inv, tours) {
    const name = esc(inv.contact_person || inv.company_name);
    return mailLayout('REMINDER ・ ご案内', 'Your listings are ready and waiting',
      `<p>Dear ${name},</p>
       <p>Just a friendly reminder: your ${tours.length ? tours.length + ' prepared listing' + (tours.length > 1 ? 's are' : ' is') : 'partner account is'} ready on Aphelion Expeditions. Create your account and click <b>Publish</b> when you are happy with the content and prices — it takes about 2 minutes.</p>
       <p style="color:${AEX_MAIL.muted}; font-size:13px;">${name} 様<br>掲載ページの準備ができております。アカウントを作成し、内容をご確認のうえ「公開」を押してください（約2分）。</p>`,
      `<p style="margin:20px 0 4px;">${mailButton(inviteLink(inv), 'CREATE MY ACCOUNT', true)}</p>
       <p style="font-size:12px; color:${AEX_MAIL.muted};">Register with: <b>${esc(inv.email)}</b></p>
       <p style="margin-top:20px;">Kind regards,<br>Aphelion Expeditions</p>`);
  }

  function reminderPublishMail(inv, tours) {
    const name = esc(inv.contact_person || inv.company_name);
    return mailLayout('REMINDER ・ ご案内', 'One click left: publish your listings',
      `<p>Dear ${name},</p>
       <p>Thank you for registering. Your prepared listings are waiting for your check. Open your dashboard, review the content and prices and click <b>Publish</b> — travel agencies will see them right away.</p>
       <p style="color:${AEX_MAIL.muted}; font-size:13px;">${name} 様<br>ご登録ありがとうございます。管理画面で内容と料金をご確認のうえ「公開」を押してください。</p>`,
      mailSection('Waiting for your review', tourListHtml(tours)) +
      `<p style="margin:20px 0 4px;">${mailButton(SITE + '/partner-dashboard.html#tours', 'OPEN DASHBOARD', true)}</p>
       <p style="margin-top:20px;">Kind regards,<br>Aphelion Expeditions</p>`);
  }

  // ---------- Data ----------
  async function load() {
    const list = document.getElementById('inviteList');
    if (!list) return;
    try {
      INV = await api('partner_invites?select=*&order=created_at.desc');
      INV_TOURS = await api('tours?select=id,title,price,invite_id,awaiting_partner,partner_id&invite_id=not.is.null');
    } catch (e) {
      list.innerHTML = `<p style="color:#f19a9a;">Could not load invites: ${esc(e.message)}<br><span style="color:var(--muted);">If this is the first time — run <b>partner-invites.sql</b> once in Supabase → SQL Editor.</span></p>`;
      return;
    }
    render();
    autoReminders();
  }

  const toursOf = inv => INV_TOURS.filter(t => t.invite_id === inv.id);

  function render() {
    const list = document.getElementById('inviteList');
    if (!INV.length) {
      list.innerHTML = '<p style="color:var(--muted);">No invites yet. Click "+ Invite a partner" to prepare a partner\'s listings for them.</p>';
      return;
    }
    list.innerHTML = INV.map(inv => {
      const tours = toursOf(inv);
      const waiting = tours.filter(t => t.awaiting_partner).length;
      let state;
      if (inv.status === 'joined') {
        state = waiting
          ? `<span class="status-pill awaiting">joined · ${waiting} to publish</span>`
          : `<span class="status-pill approved">joined · live</span>`;
      } else {
        state = inv.invited_email_at
          ? `<span class="status-pill pending">invited ${shortDate(inv.invited_email_at)}</span>`
          : `<span class="status-pill awaiting">draft · not sent</span>`;
      }
      const reminders = [
        inv.reminder_sent_at ? 'reminder sent ' + shortDate(inv.reminder_sent_at) : '',
        inv.publish_reminder_at ? 'publish reminder sent ' + shortDate(inv.publish_reminder_at) : ''
      ].filter(Boolean).join(' · ');
      const tourLines = tours.length
        ? tours.map(t => `<div>• <a href="tour.html?id=${t.id}" target="_blank" rel="noopener" style="color:var(--wood);">${esc(t.title)} ↗</a> — ¥${Number(t.price || 0).toLocaleString('ja-JP')} · ${t.awaiting_partner ? 'waiting for partner' : 'published'}</div>`).join('')
        : '<div style="color:var(--muted);">No tours prepared yet.</div>';
      const open = inv.status === 'invited';
      return `
        <div class="admin-row" style="flex-wrap:wrap;">
          <div class="info">
            <h4>${esc(inv.company_name)} ${inv.founding ? '<span class="an-tag">Founding</span>' : ''} ${state}</h4>
            <span>${esc(inv.contact_person || '')}${inv.contact_person ? ' · ' : ''}${esc(inv.email)} · created ${shortDate(inv.created_at)}${reminders ? ' · ' + reminders : ''}</span>
            ${inv.note ? `<span style="display:block; margin-top:4px; font-size:12px;">📝 ${esc(inv.note)}</span>` : ''}
          </div>
          <div class="actions">
            ${open ? `<button class="btn-edit" onclick="inviteAddTour('${inv.id}')">+ Add tour</button>` : ''}
            ${open ? `<button class="btn-go" onclick="inviteSend('${inv.id}')">${inv.invited_email_at ? 'Resend' : 'Send invitation'}</button>` : ''}
            ${open ? `<button class="btn-edit" onclick="inviteCopyLink('${inv.id}')">Copy link</button>` : ''}
            ${open ? `<button class="btn-delete" onclick="inviteCancel('${inv.id}')">Cancel</button>` : ''}
          </div>
          <div style="flex-basis:100%; margin-top:10px; font-size:13px; line-height:1.7;">${tourLines}</div>
        </div>`;
    }).join('');
  }

  // ---------- Actions ----------
  window.inviteToggleForm = function (show) {
    const card = document.getElementById('inviteFormCard');
    card.style.display = show ? 'block' : 'none';
    if (show) { document.getElementById('inviteForm').reset(); document.getElementById('inv_founding').checked = true; card.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
  };

  window.inviteCreate = async function (e) {
    e.preventDefault();
    const body = {
      company_name: document.getElementById('inv_company').value.trim(),
      contact_person: document.getElementById('inv_contact').value.trim() || null,
      email: document.getElementById('inv_email').value.trim().toLowerCase(),
      note: document.getElementById('inv_note').value.trim() || null,
      founding: document.getElementById('inv_founding').checked
    };
    if (!body.company_name || !body.email) { msg('Company and email are required.', false); return; }
    try {
      const [inv] = await api('partner_invites', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(body) });
      inviteToggleForm(false);
      msg(`Invite for ${body.company_name} created. Now add their tours, then click "Send invitation".`, true);
      await load();
      if (inv && confirm(`Add the first tour for ${body.company_name} now?`)) inviteAddTour(inv.id);
    } catch (err) { msg('Could not create the invite: ' + err.message, false); }
  };

  window.inviteAddTour = function (id) {
    const inv = INV.find(i => i.id === id);
    if (!inv) return;
    openForm();
    setInviteOnForm(inv.id, inv.company_name);
  };

  window.inviteSend = async function (id) {
    const inv = INV.find(i => i.id === id);
    if (!inv) return;
    const tours = toursOf(inv);
    if (!tours.length && !confirm('No tours are prepared for this partner yet. Send the invitation anyway?')) return;
    if (!confirm(`Send the invitation email to ${inv.email}?`)) return;
    try {
      await sendNotificationEmail(inv.email, `${inv.company_name} — your listings on Aphelion Expeditions are ready`, invitationMail(inv, tours));
      await api(`partner_invites?id=eq.${inv.id}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ invited_email_at: new Date().toISOString(), reminder_sent_at: null }) });
      msg('Invitation sent to ' + inv.email + '. A reminder goes out automatically after 3 days if they don\'t register.', true);
      load();
    } catch (err) { msg('Could not send: ' + err.message, false); }
  };

  window.inviteCopyLink = async function (id) {
    const inv = INV.find(i => i.id === id);
    if (!inv) return;
    try { await navigator.clipboard.writeText(inviteLink(inv)); msg('Link copied — you can also send it by LINE or WhatsApp.', true); }
    catch (e) { prompt('Copy this link:', inviteLink(inv)); }
  };

  window.inviteCancel = async function (id) {
    const inv = INV.find(i => i.id === id);
    if (!inv) return;
    const n = toursOf(inv).filter(t => !t.partner_id).length;
    if (!confirm(`Cancel the invite for ${inv.company_name}?${n ? `\n\nThe ${n} prepared tour(s) will be deleted too.` : ''}\nThis cannot be undone.`)) return;
    try {
      if (n) await api(`tours?invite_id=eq.${inv.id}&partner_id=is.null`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
      await api(`partner_invites?id=eq.${inv.id}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
      _toursCache = null;
      msg('Invite cancelled.', true);
      load();
      loadList();
    } catch (err) { msg('Could not cancel: ' + err.message, false); }
  };

  // Automatic reminders — each one is sent only once per invite.
  async function autoReminders() {
    if (reminding) return;
    reminding = true;
    try {
      for (const inv of INV) {
        const tours = toursOf(inv);
        if (inv.status === 'invited' && inv.invited_email_at && !inv.reminder_sent_at && daysSince(inv.invited_email_at) >= 3) {
          await sendNotificationEmail(inv.email, `Reminder: your listings on Aphelion Expeditions are ready`, reminderJoinMail(inv, tours));
          await api(`partner_invites?id=eq.${inv.id}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ reminder_sent_at: new Date().toISOString() }) });
          inv.reminder_sent_at = new Date().toISOString();
        }
        const waiting = tours.filter(t => t.awaiting_partner);
        if (inv.status === 'joined' && waiting.length && !inv.publish_reminder_at && daysSince(inv.joined_at) >= 3) {
          await sendNotificationEmail(inv.email, `One click left: publish your listings on Aphelion Expeditions`, reminderPublishMail(inv, waiting));
          await api(`partner_invites?id=eq.${inv.id}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ publish_reminder_at: new Date().toISOString() }) });
          inv.publish_reminder_at = new Date().toISOString();
        }
      }
    } catch (e) { console.error('Invite reminders:', e); }
    reminding = false;
  }

  // Shown on the tour form while preparing a tour for an invited partner.
  window.setInviteOnForm = function (inviteId, company) {
    document.getElementById('f_invite_id').value = inviteId || '';
    const note = document.getElementById('f_invite_note');
    if (inviteId) {
      note.innerHTML = `Preparing for <b>${esc(company || '')}</b> — saved as a hidden draft. It goes live only after the partner checks it and clicks “Publish”.`;
      note.style.display = 'block';
      document.getElementById('formTitle').textContent = 'Add Tour for ' + (company || 'partner');
    } else {
      note.style.display = 'none';
    }
  };

  window.inviteCompanyFor = function (inviteId) {
    const inv = INV.find(i => i.id === inviteId);
    return inv ? inv.company_name : null;
  };

  window.loadInvites = load;
})();
