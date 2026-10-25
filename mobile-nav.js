// Shared mobile hamburger menu toggle — used on all public pages.
document.addEventListener('DOMContentLoaded', function () {
  const btn = document.getElementById('menuToggle');
  const nav = document.querySelector('header nav');
  if (!btn || !nav) return;
  btn.addEventListener('click', function () {
    nav.classList.toggle('nav-open');
  });
  // close the menu after tapping a link
  nav.querySelectorAll('a').forEach(function (link) {
    link.addEventListener('click', function () {
      nav.classList.remove('nav-open');
    });
  });
});

// Same menu on every page: photo strip at the top, page colour + shadow after scrolling.
// (The homepage has its own version of this in index.html.)
(function () {
  if (document.body && document.body.classList.contains('home')) return;
  function init() {
    var header = document.querySelector('header');
    if (!header || document.body.classList.contains('home')) return;
    var topbar = document.querySelector('.topbar');
    function onScroll() {
      var limit = topbar ? topbar.offsetHeight + 4 : 4;
      header.classList.toggle('scrolled', window.scrollY > limit);
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();

// Every action shows its result: when a confirmation or error message appears
// (booking sent, partner account created, login error, reset link sent...),
// glide to it if it is off screen. Pages opened for one tour scroll to the form.
(function () {
  function headerOffset() {
    var h = document.querySelector('header');
    return (h ? h.offsetHeight : 0) + 16;
  }
  function reveal(el) {
    if (!el) return;
    var r = el.getBoundingClientRect();
    var visible = r.top >= headerOffset() && r.bottom <= window.innerHeight;
    if (visible) return;
    var y = r.top + window.scrollY - headerOffset() - Math.max(0, (window.innerHeight - headerOffset() - r.height) / 3);
    window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
  }
  window.AEX_reveal = reveal;
  function init() {
    var watched = document.querySelectorAll('.success-message, .error-message, #forgotMsg, #doneMsg');
    if (window.MutationObserver) {
      var obs = new MutationObserver(function (list) {
        list.forEach(function (m) {
          var el = m.target;
          if (el.offsetParent !== null && getComputedStyle(el).display !== 'none') reveal(el);
        });
      });
      watched.forEach(function (el) { obs.observe(el, { attributes: true, attributeFilter: ['style', 'class'] }); });
    }
    // Booking page opened from a tour ("Request This Tour"): go straight to the form.
    var bookingForm = document.getElementById('bookingForm');
    if (bookingForm && /[?&]id=/.test(location.search)) {
      setTimeout(function () { reveal(bookingForm.closest('.form-card') || bookingForm); }, 300);
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
