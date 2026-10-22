/* Archi Thrift — theme toggle + confirm dialogs. No inline handlers. */
(function () {
  var KEY = 'archi-theme';

  // Apply the saved (or system) theme as early as possible to avoid a flash.
  function preferred() {
    try {
      var saved = localStorage.getItem(KEY);
      if (saved === 'dark' || saved === 'light') return saved;
    } catch (e) {}
    var mql = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)');
    return mql && mql.matches ? 'dark' : 'light';
  }
  function apply(theme) {
    document.documentElement.setAttribute('data-theme', theme);
  }
  apply(preferred());

  // Wire up the toggle button and confirm-on-submit forms once the DOM is ready.
  document.addEventListener('DOMContentLoaded', function () {
    var btn = document.getElementById('themeToggle');
    if (btn) {
      var sync = function () {
        var dark = document.documentElement.getAttribute('data-theme') === 'dark';
        btn.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
        btn.textContent = dark ? '☀️' : '🌙';
      };
      sync();
      btn.addEventListener('click', function () {
        var next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
        apply(next);
        try { localStorage.setItem(KEY, next); } catch (e) {}
        sync();
      });
    }

    document.querySelectorAll('form[data-confirm]').forEach(function (form) {
      form.addEventListener('submit', function (e) {
        if (!window.confirm(form.getAttribute('data-confirm'))) e.preventDefault();
      });
    });
  });
})();
