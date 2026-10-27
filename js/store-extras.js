/* store-extras.js: connects the store page (index.html) to accounts and admin products.
   Load it LAST on index.html, after js/auth.js, js/products.js and js/cart.js.

   It does three things:
   1. shows a small bar at the top: "Signed in as ..." with My account / Admin panel / Sign out
   2. draws the products the admin added, using the same markup the template uses,
      so the existing "Add to Cart" button in cart.js works on them without any change
   3. redraws those products if the admin changes them in another tab */
(function () {
  'use strict';

  if (!window.Auth) return;
  const user = Auth.currentUser();
  if (!user) return;                         // the guard in <head> already redirects

  /* ---------- the styles for the new bar and cards (all start with "ua-") ---------- */
  const css = [
    '.ua-bar{display:flex;flex-wrap:wrap;gap:10px 16px;align-items:center;justify-content:flex-end;padding:8px 16px;background:#eef6e9;border-bottom:1px solid #dfe6d9;font:14px/1.4 system-ui,Arial,sans-serif;color:#26301f}',
    '.ua-bar a,.ua-bar button{font:inherit;color:#3d7a2d;background:none;border:0;padding:0;cursor:pointer;text-decoration:underline}',
    '.ua-role{display:inline-block;margin-left:6px;padding:1px 8px;border-radius:999px;background:#fff4d6;color:#8a5a00;font-size:12px;font-weight:700;text-transform:uppercase}',
    '.ua-section{padding:32px 0}',
    '.ua-section h2{margin:0 0 16px}',
    '.ua-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:20px}',
    '.ua-card{background:#fff;border:1px solid #eee;border-radius:16px;padding:16px;margin-bottom:0}',
    '.ua-media{height:150px;border-radius:12px;background:#eef6e9;display:flex;align-items:center;justify-content:center;font-size:42px;font-weight:700;color:#6bb252;overflow:hidden;margin-bottom:12px}',
    '.ua-media img{width:100%;height:100%;object-fit:cover}',
    '.ua-cat{font-size:13px;color:#747474;margin-bottom:4px}',
    '.ua-price{margin:6px 0 12px}',
    '.ua-row{display:flex;gap:8px;align-items:center}',
    '.ua-row input{width:64px;padding:6px;border:1px solid #ccc;border-radius:6px}',
    '.ua-add{flex:1;display:block;text-align:center;padding:9px 10px;background:#6bb252;color:#fff;border-radius:8px;text-decoration:none;font-weight:600}',
    '.ua-add:hover{background:#4f9a3a;color:#fff}'
  ].join('\n');

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  /* ---------- 1. the bar at the top ---------- */
  function buildBar() {
    const bar = el('div', 'ua-bar');

    const hello = el('span', '', 'Signed in as ' + user.name);
    if (user.role === 'admin') hello.append(el('span', 'ua-role', 'admin'));
    bar.append(hello);

    const account = el('a', '', 'My account');
    account.href = 'account.html';
    bar.append(account);

    // The Admin link is only added for admins. Hiding it is a convenience, not security:
    // admin.html and Products.add() check the role again.
    if (user.role === 'admin') {
      const admin = el('a', '', 'Admin panel');
      admin.href = 'admin.html';
      bar.append(admin);
    }

    const out = el('button', '', 'Sign out');
    out.type = 'button';
    out.addEventListener('click', () => Auth.logout('signin.html'));
    bar.append(out);

    document.body.prepend(bar);
  }

  /* ---------- 2. products added by the admin ---------- */
  // These class names are the ones cart.js looks for:
  //   .product-item, h3.fs-6.fw-normal, span.text-dark.fw-semibold, input.input-number.quantity, a.btn-cart
  function buildCard(product) {
    const card = el('div', 'product-item ua-card');

    const media = el('div', 'ua-media');
    if (product.image) {
      const img = document.createElement('img');
      img.src = product.image;
      img.alt = product.name;
      img.loading = 'lazy';
      media.append(img);
    } else {
      media.textContent = product.name.charAt(0).toUpperCase();
    }

    const price = el('div', 'ua-price');
    price.append(el('span', 'text-dark fw-semibold', Products.formatCents(product.priceCents)));

    const qty = el('input', 'input-number quantity');
    qty.type = 'number';
    qty.min = '1';
    qty.value = '1';
    qty.setAttribute('aria-label', 'Quantity of ' + product.name);

    const add = el('a', 'btn-cart ua-add', 'Add to Cart');
    add.href = '#';

    const row = el('div', 'ua-row');
    row.append(qty, add);

    card.append(media, el('div', 'ua-cat', product.category), el('h3', 'fs-6 fw-normal', product.name), price, row);
    return card;
  }

  function findMount() {
    let mount = document.getElementById('admin-products');
    if (mount) return mount;

    // No placeholder in the HTML: create one just before the footer (or at the end of the page).
    mount = el('div');
    mount.id = 'admin-products';
    const footer = document.querySelector('footer');
    if (footer && footer.parentNode) footer.parentNode.insertBefore(mount, footer);
    else document.body.append(mount);
    return mount;
  }

  function renderProducts() {
    if (!window.Products) return;
    const mount = findMount();
    mount.textContent = '';

    const list = Products.getAll();
    if (list.length === 0) return;               // nothing added yet: show nothing

    const section = el('section', 'ua-section');
    const wrap = el('div', 'container-lg');
    const grid = el('div', 'ua-grid');
    list.forEach((product) => grid.append(buildCard(product)));
    wrap.append(el('h2', '', 'New in store'), grid);
    section.append(wrap);
    mount.append(section);
  }

  /* ---------- start ---------- */
  function start() {
    const style = document.createElement('style');
    style.textContent = css;
    document.head.append(style);

    buildBar();
    renderProducts();

    // another tab (the admin) changed the product list
    window.addEventListener('storage', (event) => {
      if (event.key === 'organicProducts' || event.key === null) renderProducts();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
