/* admin.js: the admin page (plain JavaScript).
   Needs js/auth.js and js/products.js loaded first. */
(function () {
  'use strict';

  // Only an admin gets past this line. Anyone else is sent away and the page stays hidden.
  const admin = Auth.requireRole('admin');
  if (!admin) return;
  document.body.classList.remove('guarded');

  const form = document.getElementById('product-form');
  const message = document.getElementById('product-message');
  const fields = {
    name: document.getElementById('p-name'),
    price: document.getElementById('p-price'),
    category: document.getElementById('p-category'),
    image: document.getElementById('p-image')
  };

  document.getElementById('admin-name').textContent = admin.name;
  document.getElementById('logout-btn').addEventListener('click', () => Auth.logout('signin.html'));

  /* ---------- small helpers ---------- */
  function cell(text) {
    const td = document.createElement('td');
    td.textContent = text;
    return td;
  }

  function formatDate(timestamp) {
    if (!timestamp) return '-';
    return new Date(timestamp).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function setError(field, text) {
    const box = document.getElementById('p-' + field + '-error');
    if (box) box.textContent = text;
    if (fields[field]) fields[field].classList.toggle('invalid', text !== '');
  }

  function clearErrors() {
    Object.keys(fields).forEach((field) => setError(field, ''));
    message.hidden = true;
  }

  function showMessage(text, kind) {
    message.textContent = text;
    message.className = 'msg msg-' + kind;
    message.hidden = false;
  }

  /* ---------- category list ---------- */
  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = 'Choose a category';
  fields.category.append(placeholder);
  Products.CATEGORIES.forEach((name) => {
    const option = document.createElement('option');
    option.value = name;
    option.textContent = name;
    fields.category.append(option);
  });

  /* ---------- draw the two tables ---------- */
  function renderProducts() {
    const rows = document.getElementById('product-rows');
    const list = Products.getAll();
    rows.textContent = '';

    document.getElementById('products-empty').hidden = list.length > 0;
    document.getElementById('products-wrap').hidden = list.length === 0;

    list.forEach((product) => {
      const tr = document.createElement('tr');
      tr.append(cell(product.name), cell(product.category), cell(Products.formatCents(product.priceCents)),
        cell(formatDate(product.createdAt)));

      const actions = document.createElement('td');
      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'btn btn-danger btn-small';
      del.textContent = 'Delete';
      del.dataset.id = product.id;
      del.setAttribute('aria-label', 'Delete ' + product.name);
      actions.append(del);
      tr.append(actions);
      rows.append(tr);
    });
  }

  function renderUsers() {
    const rows = document.getElementById('user-rows');
    rows.textContent = '';
    Auth.listUsers().forEach((user) => {
      const tr = document.createElement('tr');
      tr.append(cell(user.name), cell(user.email), cell(user.role), cell(formatDate(user.createdAt)));
      rows.append(tr);
    });
  }

  /* ---------- add a product ---------- */
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    clearErrors();

    const result = Products.add({
      name: fields.name.value,
      price: fields.price.value,
      category: fields.category.value,
      image: fields.image.value
    });

    if (!result.ok) {
      Object.keys(result.errors).forEach((key) => {
        if (fields[key]) setError(key, result.errors[key]);
        else showMessage(result.errors[key], 'error');
      });
      return;
    }

    form.reset();
    showMessage('"' + result.product.name + '" was added to the store.', 'success');
    renderProducts();
    fields.name.focus();
  });

  /* ---------- delete a product (one listener for every Delete button) ---------- */
  document.getElementById('product-rows').addEventListener('click', (event) => {
    const button = event.target.closest('button[data-id]');
    if (!button) return;
    if (!window.confirm('Delete this product from the store?')) return;

    if (Products.remove(button.dataset.id)) {
      showMessage('Product deleted.', 'success');
    } else {
      showMessage('Could not delete that product.', 'error');
    }
    renderProducts();
  });

  renderProducts();
  renderUsers();
})();
