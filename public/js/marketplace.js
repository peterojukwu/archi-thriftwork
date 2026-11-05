(function () {
  var themeButton = document.getElementById('theme-toggle');
  var themeColor = document.getElementById('theme-color');
  var themeKey = 'archi-theme';

  function applyTheme(theme) {
    var dark = theme === 'dark';
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    themeButton.textContent = dark ? '☀️' : '🌙';
    themeButton.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
    themeButton.setAttribute('title', dark ? 'Switch to light mode' : 'Switch to dark mode');
    themeButton.setAttribute('aria-pressed', String(dark));
    themeColor.setAttribute('content', dark ? '#171c19' : '#f6f3ed');
  }

  var initialTheme = 'light';
  try {
    var savedTheme = localStorage.getItem(themeKey);
    if (savedTheme === 'dark' || savedTheme === 'light') initialTheme = savedTheme;
    else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) initialTheme = 'dark';
  } catch (error) {}
  applyTheme(initialTheme);
  themeButton.addEventListener('click', function () {
    var nextTheme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    applyTheme(nextTheme);
    try { localStorage.setItem(themeKey, nextTheme); } catch (error) {}
  });

  var listings = window.ARCHI_LISTINGS || [];
  var currency = window.ARCHI_CURRENCY || '₦';
  var grid = document.getElementById('listing-grid');
  var count = document.getElementById('catalog-count');
  var emptyState = document.getElementById('empty-state');
  var searchInput = document.getElementById('search-input');
  var categoryFilter = document.getElementById('category-filter');
  var listingDialog = document.getElementById('listing-dialog');
  var listingDetail = document.getElementById('listing-detail');
  var authDialog = document.getElementById('auth-dialog');
  var authTitle = document.getElementById('auth-title');
  var authDescription = document.getElementById('auth-description');
  var authMessage = document.getElementById('form-message');

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, function (character) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character];
    });
  }

  function formatPrice(price) {
    return escapeHtml(currency) + Number(price || 0).toLocaleString('en-NG');
  }

  function renderListings() {
    var query = searchInput.value.trim().toLowerCase();
    var category = categoryFilter.value;
    var matches = listings.map(function (item, index) {
      return { item: item, index: index };
    }).filter(function (entry) {
      var item = entry.item;
      var searchable = [item.title, item.description, item.category, item.condition, item.location, item.seller].join(' ').toLowerCase();
      return (!query || searchable.includes(query)) && (category === 'all' || item.category === category);
    });

    count.textContent = matches.length + (matches.length === 1 ? ' listing' : ' listings');
    emptyState.hidden = matches.length > 0;
    grid.innerHTML = matches.map(function (entry) {
      var item = entry.item;
      var status = item.status === 'sold' ? '<span class="listing-badge">Sold</span>' : '';
      return '<article class="listing-card">' +
        '<button class="artwork art-' + (entry.index % 4) + '" type="button" data-view-listing="' + entry.index + '" aria-label="View ' + escapeHtml(item.title) + ' details" style="--art-tone:' + escapeHtml(item.tone || '#d5c7ad') + '">' +
          '<span class="artwork-mark" aria-hidden="true"></span><span class="artwork-category">' + escapeHtml(item.category) + '</span>' + status +
        '</button>' +
        '<div class="listing-info"><div class="listing-title-row"><h3>' + escapeHtml(item.title) + '</h3><span class="listing-price">' + formatPrice(item.price) + '</span></div>' +
        '<p class="listing-meta">' + escapeHtml(item.condition) + '<span aria-hidden="true">·</span>' + escapeHtml(item.location) + '</p>' +
        '<div class="listing-bottom"><span class="seller-name">by ' + escapeHtml(item.seller) + '</span><button class="text-action" type="button" data-view-listing="' + entry.index + '">View details <span aria-hidden="true">&#8594;</span></button></div></div></article>';
    }).join('');
  }

  function showAuthPanel(mode) {
    var selectedPanel = mode === 'register' ? 'register-panel' : 'login-panel';
    document.querySelectorAll('[data-auth-tab]').forEach(function (tab) {
      var selected = tab.getAttribute('data-auth-tab') === mode;
      tab.classList.toggle('is-active', selected);
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
    });
    document.querySelectorAll('.auth-panel').forEach(function (panel) {
      panel.hidden = panel.id !== selectedPanel;
    });
  }

  function openAuth(mode, reason) {
    var copy = {
      signin: ['Welcome back', 'Sign in to your account.'],
      register: ['Join the exchange', 'Create an account to continue.'],
      sell: ['Ready to list an item?', 'Sign in or create an account to start a listing.'],
      contact: ['Interested in this listing?', 'Sign in or create an account to contact the seller.'],
    }[reason] || ['Join the exchange', 'Create an account to continue.'];
    authTitle.textContent = copy[0];
    authDescription.textContent = copy[1];
    showAuthPanel(mode);
    authMessage.hidden = true;
    authDialog.showModal();
  }

  function openListing(index) {
    var item = listings[index];
    if (!item) return;
    listingDetail.innerHTML = '<div class="listing-detail"><div class="detail-artwork art-' + (index % 4) + '" style="--art-tone:' + escapeHtml(item.tone || '#d5c7ad') + '"><span class="artwork-mark" aria-hidden="true"></span><span class="artwork-category">' + escapeHtml(item.category) + '</span></div>' +
      '<div class="detail-copy"><p class="section-kicker">' + escapeHtml(item.category) + (item.status === 'sold' ? ' · Sold' : '') + '</p>' +
      '<h2 id="listing-title">' + escapeHtml(item.title) + '</h2><p class="detail-price">' + formatPrice(item.price) + '</p>' +
      '<p class="detail-description">' + escapeHtml(item.description) + '</p>' +
      '<dl class="detail-facts"><div><dt>Condition</dt><dd>' + escapeHtml(item.condition) + '</dd></div><div><dt>Pickup</dt><dd>' + escapeHtml(item.location) + '</dd></div><div><dt>Listed by</dt><dd>' + escapeHtml(item.seller) + '</dd></div></dl>' +
      (item.status === 'sold' ? '<p class="sold-message">This listing has been marked sold.</p>' : '<button class="submit-button contact-button" type="button" data-protected-action="contact">Contact seller <span aria-hidden="true">&#8594;</span></button>') + '</div></div>';
    listingDialog.showModal();
  }

  searchInput.addEventListener('input', renderListings);
  categoryFilter.addEventListener('change', renderListings);
  document.getElementById('catalog-tools').addEventListener('submit', function (event) {
    event.preventDefault();
    renderListings();
  });

  document.addEventListener('click', function (event) {
    var authButton = event.target.closest('[data-auth-open]');
    if (authButton) {
      openAuth(authButton.getAttribute('data-auth-mode'), authButton.getAttribute('data-auth-reason'));
      return;
    }
    var viewButton = event.target.closest('[data-view-listing]');
    if (viewButton) {
      openListing(Number(viewButton.getAttribute('data-view-listing')));
      return;
    }
    if (event.target.closest('[data-protected-action="contact"]')) {
      listingDialog.close();
      openAuth('register', 'contact');
      return;
    }
    var closeButton = event.target.closest('[data-close-dialog]');
    if (closeButton) closeButton.closest('dialog').close();
  });

  document.querySelectorAll('[data-auth-tab]').forEach(function (tab) {
    tab.addEventListener('click', function () {
      showAuthPanel(tab.getAttribute('data-auth-tab'));
      authMessage.hidden = true;
    });
  });

  document.getElementById('login-form').addEventListener('submit', function (event) {
    event.preventDefault();
    if (!event.currentTarget.reportValidity()) return;
    authMessage.textContent = 'Sign-in is a preview; account access will be connected when the backend is ready.';
    authMessage.hidden = false;
  });

  document.getElementById('register-form').addEventListener('submit', function (event) {
    event.preventDefault();
    if (!event.currentTarget.reportValidity()) return;
    var password = event.currentTarget.elements.password.value;
    var confirmation = event.currentTarget.elements.confirm.value;
    if (password !== confirmation) {
      event.currentTarget.elements.confirm.setCustomValidity('Passwords do not match.');
      event.currentTarget.elements.confirm.reportValidity();
      return;
    }
    event.currentTarget.elements.confirm.setCustomValidity('');
    authMessage.textContent = 'Account creation is a preview; registration will be connected when the backend is ready.';
    authMessage.hidden = false;
  });

  document.querySelector('#register-form [name="confirm"]').addEventListener('input', function (event) {
    event.currentTarget.setCustomValidity('');
  });

  renderListings();
})();