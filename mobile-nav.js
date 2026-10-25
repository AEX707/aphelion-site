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
