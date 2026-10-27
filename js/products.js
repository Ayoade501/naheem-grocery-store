/* products.js: the products an admin adds (plain JavaScript, no libraries).

   Load AFTER auth.js. It creates one global object called Products.
   Reading products is open to everyone. Adding and removing is checked against the
   signed-in user's role INSIDE these functions, so hiding a button is not the only guard.
   (This is still browser-only code: see the warning at the top of auth.js.) */
(function () {
  'use strict';

  const KEY = 'organicProducts';
  const CATEGORIES = ['Fruits', 'Vegetables', 'Dairy', 'Bakery', 'Drinks', 'Snacks', 'Other'];

  /* ---------- money, kept as whole cents ---------- */
  // "12.50" or "$1,234.5" -> cents. Returns null when the text is not a valid amount.
  function toCents(text) {
    const cleaned = String(text).replace(/[$,]/g, '').trim();
    if (!/^\d{1,7}(\.\d{1,2})?$/.test(cleaned)) return null;
    const parts = cleaned.split('.');
    const fraction = ((parts[1] || '') + '00').slice(0, 2);
    return parseInt(parts[0], 10) * 100 + parseInt(fraction, 10);
  }

  // 1250 -> "$12.50" (same format the cart expects when it reads a price)
  function formatCents(cents) {
    const whole = Math.floor(cents / 100);
    const fraction = String(cents % 100).padStart(2, '0');
    return '$' + whole.toLocaleString('en-US') + '.' + fraction;
  }

  /* ---------- storage ---------- */
  function isValidProduct(p) {
    return !!p && typeof p === 'object' &&
      typeof p.id === 'string' && p.id !== '' &&
      typeof p.name === 'string' && p.name.trim() !== '' &&
      Number.isInteger(p.priceCents) && p.priceCents > 0 &&
      typeof p.category === 'string' &&
      typeof p.image === 'string';
  }

  function read() {
    try {
      const data = JSON.parse(window.localStorage.getItem(KEY));
      return Array.isArray(data) ? data.filter(isValidProduct) : [];
    } catch (e) {
      return [];
    }
  }

  function write(list) {
    try { window.localStorage.setItem(KEY, JSON.stringify(list)); return true; } catch (e) { return false; }
  }

  function getAll() {
    return read().sort((a, b) => (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0));   // newest first
  }

  /* ---------- permission check ---------- */
  function adminOnly() {
    const me = window.Auth && window.Auth.currentUser ? window.Auth.currentUser() : null;
    return me && me.role === 'admin' ? me : null;
  }

  /* ---------- add ---------- */
  // input: { name, price, category, image }
  // returns { ok: true, product } or { ok: false, errors: { fieldName: 'message' } }
  function add(input) {
    const admin = adminOnly();
    if (!admin) return { ok: false, errors: { form: 'Only an admin can add products.' } };

    const data = input || {};
    const errors = {};
    const list = read();

    const name = String(data.name || '').trim().replace(/\s+/g, ' ');
    if (name.length < 2 || name.length > 60) {
      errors.name = 'Enter a product name between 2 and 60 characters.';
    } else if (list.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
      errors.name = 'A product with this name already exists.';
    }

    const priceCents = toCents(data.price);
    if (priceCents === null || priceCents < 1) {
      errors.price = 'Enter a price such as 12.50.';
    }

    const category = String(data.category || '');
    if (CATEGORIES.indexOf(category) === -1) errors.category = 'Choose a category.';

    const image = String(data.image || '').trim();
    if (image !== '' && (image.length > 300 || !/^(https?:\/\/|images\/)[^\s"'<>]+$/i.test(image))) {
      errors.image = 'Use a link starting with https:// (or leave this empty).';
    }

    if (Object.keys(errors).length > 0) return { ok: false, errors: errors };

    const product = {
      id: 'p-' + Date.now().toString(36) + '-' + Math.floor(Math.random() * 1e6).toString(36),
      name: name,
      priceCents: priceCents,
      category: category,
      image: image,
      addedBy: admin.id,
      createdAt: Date.now()
    };
    list.push(product);
    if (!write(list)) return { ok: false, errors: { form: 'Could not save the product. Storage may be blocked.' } };
    return { ok: true, product: product };
  }

  /* ---------- remove ---------- */
  function remove(id) {
    if (!adminOnly()) return false;
    const list = read();
    const next = list.filter((p) => p.id !== id);
    if (next.length === list.length) return false;
    return write(next);
  }

  window.Products = Object.freeze({
    CATEGORIES: CATEGORIES,
    getAll: getAll,
    add: add,
    remove: remove,
    toCents: toCents,
    formatCents: formatCents
  });
})();
