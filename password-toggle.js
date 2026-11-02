// Adds an "eye" button to every password field, so people can see what they type.
// Used on: admin.html, login.html, partner.html, reset-password.html.
(function () {
  var EYE = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>';
  var EYE_OFF = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 19c-7 0-11-7-11-7a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 7 11 7a18.5 18.5 0 0 1-2.16 3.19"/><path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';
  function addToggle(input) {
    if (input.dataset.pwToggle) return;
    input.dataset.pwToggle = '1';
    var wrap = document.createElement('div');
    wrap.style.cssText = 'position:relative; width:100%;';
    input.parentNode.insertBefore(wrap, input);
    wrap.appendChild(input);
    input.style.paddingRight = '46px';
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Show password');
    btn.title = 'Show password';
    btn.innerHTML = EYE;
    btn.style.cssText = 'position:absolute; right:6px; top:50%; transform:translateY(-50%); width:36px; height:36px; display:flex; align-items:center; justify-content:center; background:none; border:0; padding:0; cursor:pointer; color:inherit; opacity:.65;';
    btn.addEventListener('click', function () {
      var show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      btn.innerHTML = show ? EYE_OFF : EYE;
      btn.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
      btn.title = show ? 'Hide password' : 'Show password';
      input.focus();
    });
    wrap.appendChild(btn);
  }
  function init() { document.querySelectorAll('input[type="password"]').forEach(addToggle); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
