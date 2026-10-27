/* cart.js: shopping cart for the Organic template (vanilla JS, no jQuery).
   Load AFTER js/script.js, just before </body>.
   Money is handled as integer cents so 18.00 + 18.00 is always exactly 36.00.
   All page text is written with textContent (never innerHTML), so product names
   or saved data can never be interpreted as HTML. */
(function () {
  'use strict';

  /* ---------- settings you can change ---------- */
  // One cart per signed-in user. Without accounts it falls back to the shared key.
  const STORAGE_KEY = (function () {
    const user = window.Auth && window.Auth.currentUser ? window.Auth.currentUser() : null;
    return user ? 'organicCart:' + user.id : 'organicCart';
  })();
  const MAX_QTY = 99;        // highest quantity allowed for one product
  const AUTO_OPEN = false;   // true = slide the cart open after every "Add to Cart"

  /* ---------- state ---------- */
  let cart = [];             // [{ name, unitCents, qty }]
  const els = {};            // drawer elements, filled in by init()

  /* ---------- money helpers (integer cents only) ---------- */

  // "$1,234.50" -> 123450. Returns null if the text is not a valid amount.
  function toCents(text) {
    const cleaned = String(text).replace(/[$,]/g, '').trim();
    if (!/^\d{1,9}(\.\d{1,2})?$/.test(cleaned)) return null;
    const parts = cleaned.split('.');
    const fraction = ((parts[1] || '') + '00').slice(0, 2);
    return parseInt(parts[0], 10) * 100 + parseInt(fraction, 10);
  }

  // 3600 -> "$36.00" (no floating-point maths involved)
  function formatCents(cents) {
    const whole = Math.floor(cents / 100);
    const fraction = String(cents % 100).padStart(2, '0');
    return '$' + whole.toLocaleString('en-US') + '.' + fraction;
  }

  // Quantity from the product's input: empty, NaN or < 1 becomes 1.
  function readQty(input) {
    const n = input ? parseInt(input.value, 10) : NaN;
    return Number.isFinite(n) && n >= 1 ? Math.min(n, MAX_QTY) : 1;
  }

  /* ---------- cart maths ---------- */
  const lineCents = (line) => line.unitCents * line.qty;
  const totalCents = () => cart.reduce((sum, line) => sum + lineCents(line), 0);
  const totalQty = () => cart.reduce((sum, line) => sum + line.qty, 0);

  /* ---------- storage ---------- */
  function isValidLine(line) {
    return !!line &&
      typeof line.name === 'string' && line.name.trim() !== '' &&
      Number.isInteger(line.unitCents) && line.unitCents > 0 &&
      Number.isInteger(line.qty) && line.qty >= 1;
  }

  function load() {
    try {
      const data = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (!Array.isArray(data)) return [];
      return data.filter(isValidLine).map((line) => ({
        name: line.name,
        unitCents: line.unitCents,
        qty: Math.min(line.qty, MAX_QTY)
      }));
    } catch (error) {
      return [];             // missing, corrupted or blocked storage
    }
  }

  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(cart)); } catch (error) { /* ignore */ }
  }

  /* ---------- cart actions ---------- */
  function commit() { clearStatus(); save(); render(); }

  function addToCart(name, unitCents, qty) {
    const existing = cart.find((line) => line.name === name);
    if (existing) {
      // same name merges; the stored unit price is kept
      existing.qty = Math.min(existing.qty + qty, MAX_QTY);
    } else {
      cart.push({ name: name, unitCents: unitCents, qty: Math.min(qty, MAX_QTY) });
    }
    commit();
  }

  function changeQty(index, delta) {
    const line = cart[index];
    if (!line) return;
    line.qty = Math.min(Math.max(line.qty + delta, 1), MAX_QTY);
    commit();
  }

  function removeLine(index) {
    cart.splice(index, 1);
    commit();
  }

  function clearCart() {
    cart = [];
    try { localStorage.removeItem(STORAGE_KEY); } catch (error) { /* ignore */ }
    render();
  }

  /* ---------- rendering ---------- */
  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function button(label, className, action, ariaLabel) {
    const b = el('button', className, label);
    b.type = 'button';
    b.dataset.action = action;
    b.setAttribute('aria-label', ariaLabel);
    return b;
  }

  function buildRow(line, index) {
    const li = el('li', 'list-group-item');
    li.dataset.index = String(index);

    const top = el('div', 'd-flex justify-content-between align-items-start');
    const info = el('div');
    info.append(el('h6', 'my-0', line.name), el('small', 'text-body-secondary', formatCents(line.unitCents) + ' each'));
    top.append(info, el('strong', 'ms-2 text-nowrap', formatCents(lineCents(line))));

    const controls = el('div', 'd-flex justify-content-between align-items-center mt-2');
    const stepper = el('div', 'd-flex align-items-center gap-2');

    const minus = button('\u2212', 'btn btn-sm btn-outline-secondary', 'dec', 'Decrease quantity of ' + line.name);
    minus.disabled = line.qty <= 1;
    const plus = button('+', 'btn btn-sm btn-outline-secondary', 'inc', 'Increase quantity of ' + line.name);
    plus.disabled = line.qty >= MAX_QTY;

    stepper.append(minus, el('span', 'fw-semibold px-1', String(line.qty)), plus);
    controls.append(stepper, button('Remove', 'btn btn-sm btn-outline-danger', 'remove', 'Remove ' + line.name + ' from cart'));

    li.append(top, controls);
    return li;
  }

  function render() {
    els.count.textContent = String(totalQty());
    els.total.textContent = formatCents(totalCents());

    els.list.textContent = '';
    if (cart.length === 0) {
      els.list.append(el('li', 'list-group-item text-center text-body-secondary', 'Your cart is empty'));
    } else {
      cart.forEach((line, index) => els.list.append(buildRow(line, index)));
    }
    updatePanelTotal();
  }

  /* ---------- test checkout panel (no server, no real charge) ---------- */
  function updatePanelTotal() {
    const out = document.getElementById('payment-total');
    if (out) out.textContent = formatCents(totalCents());
  }

  function buildPaymentPanel() {
    const panel = el('div', 'border rounded p-3 mt-3 d-none');
    panel.id = 'payment-panel';

    const head = el('div', 'd-flex justify-content-between align-items-center mb-2');
    head.append(el('h6', 'my-0', 'Test checkout'), el('span', 'badge text-bg-warning', 'TEST MODE'));

    const note = el('p', 'small text-body-secondary mb-2',
      'Simulated payment only. This is not a live Paystack charge and no money moves.');

    const due = el('p', 'mb-2');
    const dueValue = el('strong', '', formatCents(totalCents()));
    dueValue.id = 'payment-total';
    due.append('Cart total: ', dueValue);

    const label = el('label', 'form-label small mb-1', 'Amount to pay (USD)');
    label.htmlFor = 'payment-amount';

    const input = el('input', 'form-control mb-2');
    input.id = 'payment-amount';
    input.type = 'text';
    input.inputMode = 'decimal';
    input.autocomplete = 'off';
    input.placeholder = 'e.g. 18.00';

    const pay = el('button', 'btn btn-success w-100', 'Pay');
    pay.id = 'pay-btn';
    pay.type = 'button';

    const status = el('div', 'alert d-none mt-3 mb-0 py-2');   // the success / failure message box
    status.id = 'payment-status';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');

    panel.append(head, note, due, label, input, pay, status);
    return panel;
  }

  // type: 'success' (green), 'danger' (red) or 'warning' (yellow)
  function showStatus(message, type) {
    const box = document.getElementById('payment-status');
    if (!box) return;
    box.className = 'alert alert-' + type + ' mt-3 mb-0 py-2';
    box.textContent = message;
  }

  function clearStatus() {
    const box = document.getElementById('payment-status');
    if (!box) return;
    box.className = 'alert d-none mt-3 mb-0 py-2';
    box.textContent = '';
  }

  function showPanel() {
    const panel = document.getElementById('payment-panel');
    if (!panel) return;
    panel.classList.remove('d-none');
    updatePanelTotal();
    document.getElementById('payment-amount').focus();
    panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function hidePanel() {
    const panel = document.getElementById('payment-panel');
    const input = document.getElementById('payment-amount');
    if (panel) panel.classList.add('d-none');
    if (input) input.value = '';
    clearStatus();
  }

  function pay() {
    if (cart.length === 0) {
      showStatus('Your cart is empty', 'warning');
      return;
    }
    const amountInput = document.getElementById('payment-amount');
    const entered = toCents(amountInput.value);

    if (entered !== null && entered === totalCents()) {
      clearCart();                       // cart, localStorage, list, badge, total
      amountInput.value = '';            // empty the amount field
      showStatus('Payment successful', 'success');
    } else {
      showStatus('Payment unsuccessful', 'danger');   // cart is left untouched
    }
  }

  /* ---------- opening the drawer from code (optional) ---------- */
  function openCart() {
    const drawer = document.getElementById('offcanvasCart');
    if (drawer && window.bootstrap && window.bootstrap.Offcanvas) {
      window.bootstrap.Offcanvas.getOrCreateInstance(drawer).show();
    }
  }

  /* ---------- wiring ---------- */
  function init() {
    els.count = document.getElementById('cart-count');
    els.list = document.getElementById('cart-items');
    els.total = document.getElementById('cart-total');
    els.checkout = document.getElementById('checkout-btn');

    const missing = Object.keys(els).filter((key) => !els[key]);
    if (missing.length) {
      console.error('[cart.js] Missing HTML elements for: ' + missing.join(', ') +
        '. Add the ids listed in the HTML changes (cart-count, cart-items, cart-total, checkout-btn).');
      return;
    }

    cart = load();

    // payment panel, created once and placed under the checkout button
    els.checkout.insertAdjacentElement('afterend', buildPaymentPanel());
    document.getElementById('pay-btn').addEventListener('click', pay);
    document.getElementById('payment-amount').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); pay(); }
    });
    document.getElementById('payment-amount').addEventListener('input', clearStatus);
    els.checkout.addEventListener('click', (e) => { e.preventDefault(); showPanel(); });

    // "Add to Cart": one delegated listener covers the grid and every Swiper slide
    document.addEventListener('click', (e) => {
      const addBtn = e.target.closest('a.btn-cart');
      if (!addBtn) return;
      e.preventDefault();

      const card = addBtn.closest('.product-item');
      if (!card) return;

      const nameEl = card.querySelector('h3.fs-6.fw-normal');
      const priceEl = card.querySelector('span.text-dark.fw-semibold');   // sale price, not the <del>
      const qtyEl = card.querySelector('input.input-number.quantity');

      const name = nameEl ? nameEl.textContent.trim() : '';
      const unitCents = priceEl ? toCents(priceEl.textContent) : null;
      if (!name || unitCents === null || unitCents <= 0) {
        console.warn('[cart.js] Could not read name/price for this product, nothing added.');
        return;
      }

      addToCart(name, unitCents, readQty(qtyEl));
      if (AUTO_OPEN) openCart();
    });

    // + / - / Remove buttons inside the drawer (one listener on the list)
    els.list.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-action]');
      const row = btn && btn.closest('li[data-index]');
      if (!row) return;
      const index = Number(row.dataset.index);

      if (btn.dataset.action === 'inc') changeQty(index, 1);
      else if (btn.dataset.action === 'dec') changeQty(index, -1);
      else if (btn.dataset.action === 'remove') removeLine(index);
    });

    // keep other open tabs in sync
    window.addEventListener('storage', (e) => {
      if (e.key === STORAGE_KEY || e.key === null) { cart = load(); render(); }
    });

    // hide the payment panel whenever the drawer closes
    const drawer = document.getElementById('offcanvasCart');
    if (drawer) drawer.addEventListener('hidden.bs.offcanvas', hidePanel);

    render();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();