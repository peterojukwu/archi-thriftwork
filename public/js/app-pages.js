(function () {
  var form = document.querySelector('[data-listing-form]');
  if (!form) return;

  var titleInput = form.querySelector('[data-preview-title]');
  var priceInput = form.querySelector('[data-preview-price]');
  var categoryInput = form.querySelector('[data-preview-category]');
  var locationInput = form.querySelector('[data-preview-location]');
  var conditionInput = form.querySelector('[name="condition"]');
  var imageInput = form.querySelector('[data-preview-image-input]');
  var titleLabel = document.querySelector('[data-preview-title-label]');
  var priceLabel = document.querySelector('[data-preview-price-label]');
  var categoryLabel = document.querySelector('[data-preview-category-label]');
  var locationLabel = document.querySelector('[data-preview-location-label]');
  var conditionLabel = document.querySelector('[data-preview-condition-label]');
  var artwork = document.querySelector('[data-preview-art]');
  var image = document.querySelector('[data-preview-image]');
  var currency = priceLabel ? priceLabel.getAttribute('data-currency') || '' : '';
  var objectUrl = null;

  function updateText() {
    var title = titleInput.value.trim();
    var price = Number(priceInput.value);
    var selectedCategory = categoryInput.options[categoryInput.selectedIndex];
    titleLabel.textContent = title || 'Listing title';
    categoryLabel.textContent = selectedCategory && selectedCategory.value ? selectedCategory.textContent : 'Category';
    locationLabel.textContent = locationInput.value.trim() || 'Location';
    conditionLabel.textContent = conditionInput.value || 'Condition';
    priceLabel.textContent = currency + (Number.isFinite(price) && price >= 0
      ? price.toLocaleString('en-NG', { maximumFractionDigits: 2 })
      : '0');
  }

  function updateImage() {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = null;
    var file = imageInput.files && imageInput.files[0];
    if (!file || !file.type || file.type.indexOf('image/') !== 0) {
      image.removeAttribute('src');
      image.hidden = true;
      artwork.classList.remove('has-photo');
      return;
    }
    objectUrl = URL.createObjectURL(file);
    image.src = objectUrl;
    image.hidden = false;
    artwork.classList.add('has-photo');
  }

  [titleInput, priceInput, categoryInput, locationInput, conditionInput].forEach(function (input) {
    input.addEventListener('input', updateText);
    input.addEventListener('change', updateText);
  });
  imageInput.addEventListener('change', updateImage);
  window.addEventListener('pagehide', function () {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  });
  updateText();
})();