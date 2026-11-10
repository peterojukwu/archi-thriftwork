(function () {
  var themeButton = document.getElementById('theme-toggle');
  var themeColor = document.getElementById('theme-color');
  var themeKey = 'archi-theme';
  var listings = [];
  var currency = '₦';
  var currentUser = null;
  var authReason = 'signin';
  var pendingContactId = null;
  var grid = document.getElementById('listing-grid');
  var count = document.getElementById('catalog-count');
  var emptyState = document.getElementById('empty-state');
  var loadError = document.getElementById('load-error');
  var searchInput = document.getElementById('search-input');
  var categoryFilter = document.getElementById('category-filter');
  var listingDialog = document.getElementById('listing-dialog');
  var listingDetail = document.getElementById('listing-detail');
  var authDialog = document.getElementById('auth-dialog');
  var authTitle = document.getElementById('auth-title');
  var authDescription = document.getElementById('auth-description');
  var authMessage = document.getElementById('form-message');
  var headerActions = document.getElementById('header-actions');
  var mainNav = document.getElementById('main-nav');

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

  async function api(path, options) {
    options = options || {};
    var headers = Object.assign({ Accept: 'application/json' }, options.headers || {});
    if (options.body && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
    var response = await fetch(path, Object.assign({}, options, { credentials: 'same-origin', headers: headers }));
    var data = await response.json().catch(function () { return {}; });
    if (!response.ok) {
      var error = new Error(data.error || 'The request could not be completed.');
      error.status = response.status;
      throw error;
    }
    return data;
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (character) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character];
    });
  }

  function safeImageUrl(value) {
    if (typeof value !== 'string') return null;
    try {
      var url = new URL(value);
      return url.protocol === 'https:' ? url.href : null;
    } catch (error) {
      return null;
    }
  }

  function formatPrice(price) {
    return escapeHtml(currency) + Number(price || 0).toLocaleString('en-NG');
  }

  function setAuthMessage(text, isError) {
    authMessage.textContent = text || '';
    authMessage.classList.toggle('is-error', !!isError);
    authMessage.hidden = !text;
  }

  function createAuthButton(mode, reason, label, className) {
    var button = document.createElement('button');
    button.type = 'button';
    button.className = className;
    button.textContent = label;
    button.setAttribute('data-auth-open', '');
    button.setAttribute('data-auth-mode', mode);
    button.setAttribute('data-auth-reason', reason);
    return button;
  }

  function updateHeader(user) {
    currentUser = user || null;
    headerActions.querySelectorAll('.user-greeting, .user-items-link, [data-signout], .sign-in-link, .join-button').forEach(function (element) {
      element.remove();
    });
    mainNav.querySelectorAll('[data-user-nav]').forEach(function (element) {
      element.remove();
    });

    var sellButton = mainNav.querySelector('.nav-link');
    if (currentUser) {
      var greeting = document.createElement('span');
      greeting.className = 'user-greeting';
      greeting.textContent = 'Hi, ' + (currentUser.name || '').trim().split(/\s+/)[0];

      var listingsLink = document.createElement('a');
      listingsLink.href = '/my-items';
      listingsLink.textContent = 'My listings';
      listingsLink.setAttribute('data-user-nav', '');

      var signOut = document.createElement('button');
      signOut.type = 'button';
      signOut.className = 'join-button';
      signOut.setAttribute('data-signout', '');
      signOut.textContent = 'Log out';

      if (currentUser.role === 'admin') {
        var adminLink = document.createElement('a');
        adminLink.href = '/admin';
        adminLink.textContent = 'Admin';
        adminLink.setAttribute('data-user-nav', '');
        mainNav.append(listingsLink, adminLink);
      } else {
        mainNav.append(listingsLink);
      }
      headerActions.append(greeting, signOut);
      if (sellButton) sellButton.textContent = 'Sell an item';
    } else {
      headerActions.append(
        createAuthButton('login', 'signin', 'Sign in', 'sign-in-link'),
        createAuthButton('register', 'register', 'Create account', 'join-button'),
      );
      if (sellButton) sellButton.textContent = 'Sell an item';
    }
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
      var image = safeImageUrl(item.image);
      var photo = image ? '<img class="listing-photo" src="' + escapeHtml(image) + '" alt="" loading="lazy">' : '';
      var status = item.status === 'sold' ? '<span class="listing-badge">Sold</span>' : '';
      return '<article class="listing-card">' +
        '<button class="artwork art-' + (entry.index % 4) + (image ? ' has-photo' : '') + '" type="button" data-view-listing="' + entry.index + '" aria-label="View ' + escapeHtml(item.title) + ' details">' +
          photo + '<span class="artwork-mark" aria-hidden="true"></span><span class="artwork-category">' + escapeHtml(item.category) + '</span>' + status +
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
    authReason = reason;
    authTitle.textContent = copy[0];
    authDescription.textContent = copy[1];
    showAuthPanel(mode);
    setAuthMessage('', false);
    authDialog.showModal();
  }

  function openListing(index) {
    var item = listings[index];
    if (!item) return;
    var image = safeImageUrl(item.image);
    var photo = image ? '<img class="listing-photo" src="' + escapeHtml(image) + '" alt="' + escapeHtml(item.title) + '">' : '';
    listingDetail.innerHTML = '<div class="listing-detail"><div class="detail-artwork art-' + (index % 4) + (image ? ' has-photo' : '') + '">' + photo + '<span class="artwork-mark" aria-hidden="true"></span><span class="artwork-category">' + escapeHtml(item.category) + '</span></div>' +
      '<div class="detail-copy"><p class="section-kicker">' + escapeHtml(item.category) + (item.status === 'sold' ? ' · Sold' : '') + '</p>' +
      '<h2 id="listing-title">' + escapeHtml(item.title) + '</h2><p class="detail-price">' + formatPrice(item.price) + '</p>' +
      '<p class="detail-description">' + escapeHtml(item.description) + '</p>' +
      '<dl class="detail-facts"><div><dt>Condition</dt><dd>' + escapeHtml(item.condition) + '</dd></div><div><dt>Pickup</dt><dd>' + escapeHtml(item.location) + '</dd></div><div><dt>Listed by</dt><dd>' + escapeHtml(item.seller) + '</dd></div></dl>' +
      (item.status === 'sold' ? '<p class="sold-message">This listing has been marked sold.</p>' : '<button class="submit-button contact-button" type="button" data-protected-action="contact" data-listing-id="' + Number(item.id) + '">Contact seller <span aria-hidden="true">&#8594;</span></button>') + '</div></div>';
    listingDialog.showModal();
  }

  async function contactSeller(id) {
    try {
      var data = await api('/api/listings/' + encodeURIComponent(id) + '/contact');
      var url = new URL(data.url);
      if (url.protocol !== 'https:') throw new Error('The seller contact link is invalid.');
      window.open(url.href, '_blank', 'noopener');
    } catch (error) {
      if (error.status === 401) {
        updateHeader(null);
        pendingContactId = id;
        if (listingDialog.open) listingDialog.close();
        openAuth('login', 'contact');
        return;
      }
      openAuth('login', 'contact');
      setAuthMessage(error.message, true);
    }
  }

  function navigateForSignedInAction(reason) {
    if (reason === 'sell') window.location.assign('/sell');
    else if (currentUser.role === 'admin') window.location.assign('/admin');
    else window.location.assign('/my-items');
  }

  async function finishAuthentication(user) {
    updateHeader(user);
    authDialog.close();
    if (pendingContactId !== null) {
      var listingId = pendingContactId;
      pendingContactId = null;
      await contactSeller(listingId);
      return;
    }
    if (authReason === 'sell') {
      window.location.assign(user.role === 'admin' ? '/admin' : '/sell');
    } else if (user.role === 'admin') {
      window.location.assign('/admin');
    }
  }

  async function submitAuthForm(form, mode) {
    if (!form.reportValidity()) return;
    var submitButton = form.querySelector('[type="submit"]');
    submitButton.disabled = true;
    setAuthMessage('', false);
    try {
      var payload = Object.fromEntries(new FormData(form).entries());
      var response = await api(mode === 'register' ? '/api/auth/register' : '/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      await finishAuthentication(response.user);
    } catch (error) {
      setAuthMessage(error.message, true);
    } finally {
      submitButton.disabled = false;
    }
  }

  searchInput.addEventListener('input', renderListings);
  categoryFilter.addEventListener('change', renderListings);
  document.getElementById('catalog-tools').addEventListener('submit', function (event) {
    event.preventDefault();
    renderListings();
  });

  document.addEventListener('click', function (event) {
    var signOut = event.target.closest('[data-signout]');
    if (signOut) {
      api('/api/auth/logout', { method: 'POST' }).then(function () {
        pendingContactId = null;
        updateHeader(null);
      }).catch(function (error) {
        openAuth('login', 'signin');
        setAuthMessage(error.message, true);
      });
      return;
    }
    var authButton = event.target.closest('[data-auth-open]');
    if (authButton) {
      var reason = authButton.getAttribute('data-auth-reason');
      if (currentUser) {
        navigateForSignedInAction(reason);
      } else {
        openAuth(authButton.getAttribute('data-auth-mode'), reason);
      }
      return;
    }
    var viewButton = event.target.closest('[data-view-listing]');
    if (viewButton) {
      openListing(Number(viewButton.getAttribute('data-view-listing')));
      return;
    }
    var contactButton = event.target.closest('[data-protected-action="contact"]');
    if (contactButton) {
      var listingId = Number(contactButton.getAttribute('data-listing-id'));
      listingDialog.close();
      if (!currentUser) {
        pendingContactId = listingId;
        openAuth('login', 'contact');
      } else {
        contactSeller(listingId);
      }
      return;
    }
    var closeButton = event.target.closest('[data-close-dialog]');
    if (closeButton) closeButton.closest('dialog').close();
  });

  document.querySelectorAll('[data-auth-tab]').forEach(function (tab) {
    tab.addEventListener('click', function () {
      showAuthPanel(tab.getAttribute('data-auth-tab'));
      setAuthMessage('', false);
    });
  });

  document.getElementById('login-form').addEventListener('submit', function (event) {
    event.preventDefault();
    submitAuthForm(event.currentTarget, 'login');
  });

  document.getElementById('register-form').addEventListener('submit', function (event) {
    event.preventDefault();
    var form = event.currentTarget;
    if (form.elements.password.value !== form.elements.confirm.value) {
      form.elements.confirm.setCustomValidity('Passwords do not match.');
      form.elements.confirm.reportValidity();
      return;
    }
    form.elements.confirm.setCustomValidity('');
    submitAuthForm(form, 'register');
  });

  document.querySelector('#register-form [name="confirm"]').addEventListener('input', function (event) {
    event.currentTarget.setCustomValidity('');
  });

  api('/api/session').then(function (data) {
    updateHeader(data.user);
  }).catch(function () { updateHeader(null); });

  api('/api/listings').then(function (data) {
    listings = Array.isArray(data.listings) ? data.listings : [];
    currency = data.currency || '₦';
    loadError.hidden = true;
    renderListings();
  }).catch(function (error) {
    grid.replaceChildren();
    count.textContent = '';
    emptyState.hidden = true;
    loadError.textContent = error.message || 'Listings could not be loaded. Please try again later.';
    loadError.hidden = false;
  });
})();
