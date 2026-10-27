# cart.js explained, command by command

This file explains **everything** in `cart.js`, written for someone who does not yet understand every line.
Read Part 1 first. It answers the three big questions. Then use Part 3 as a reference whenever you meet a command you do not know.

---

## Part 1. The three big questions

### 1. What makes the cart open?

There are **two** ways, and only one of them is in `cart.js`.

**A. The bag icon in the page header (this is how you normally open it).**
In `index.html` the icon is a link that looks like this:

```html
<a href="#" data-bs-toggle="offcanvas" data-bs-target="#offcanvasCart" aria-controls="offcanvasCart">
```

- `data-bs-toggle="offcanvas"` tells **Bootstrap's own JavaScript**: "clicking me should open an off-canvas panel (a drawer that slides in from the side)".
- `data-bs-target="#offcanvasCart"` tells it **which** panel to open: the element with `id="offcanvasCart"`.

So clicking the icon opens the cart because of Bootstrap, not because of anything you wrote. This is why you can open the cart at any time and edit your items.

**B. Opening it from code (optional, inside `cart.js`).**

```js
function openCart() {
  const drawer = document.getElementById('offcanvasCart');
  if (drawer && window.bootstrap && window.bootstrap.Offcanvas) {
    window.bootstrap.Offcanvas.getOrCreateInstance(drawer).show();
  }
}
```

The command that actually opens the drawer is `.show()`. It is only called when you set `AUTO_OPEN = true` at the top of the file. With the default (`false`) the cart does **not** pop open by itself after "Add to Cart"; you open it with the icon.

### 2. What makes the selected item appear in the cart?

It is a chain of five steps:

```
You click "Add to Cart"
   |
   v
(1) the click listener on the document notices it         -> document.addEventListener('click', ...)
   |
   v
(2) it reads the name, price and quantity from the card   -> card.querySelector(...)
   |
   v
(3) addToCart() puts the item into the cart array         -> cart.push({...})   (or raises qty if it exists)
   |
   v
(4) commit() saves it and calls render()                  -> localStorage.setItem(...)  then  render()
   |
   v
(5) render() draws one row per item on the screen         -> els.list.append(buildRow(line, index))
```

**The single command that puts the row on screen is in step 5:**

```js
cart.forEach((line, index) => els.list.append(buildRow(line, index)));
```

`buildRow()` builds the row (name, price, `-` `+` buttons, Remove). `.append(...)` places it inside the cart list.

### 3. What lets one item become more than one (and changes the price)?

Two things:

**A. Clicking "Add to Cart" again on the same product.**

```js
const existing = cart.find((line) => line.name === name);
if (existing) {
  existing.qty = Math.min(existing.qty + qty, MAX_QTY);
}
```

If a line with that name is already in the cart, it does **not** add a second row. It just raises that line's `qty`.

**B. The `+` and `-` buttons inside the cart.**
Each row has buttons marked with `data-action="inc"` (plus) or `data-action="dec"` (minus). One listener on the cart list notices the click and calls:

```js
changeQty(index, 1);    // plus
changeQty(index, -1);   // minus
```

and `changeQty` does:

```js
line.qty = Math.min(Math.max(line.qty + delta, 1), MAX_QTY);
commit();
```

**Why the price changes automatically.** Prices are never stored per row on screen. The program stores only the **unit price** and the **quantity**, and every time anything changes, `render()` **redraws the whole cart from that data**:

```js
const lineCents = (line) => line.unitCents * line.qty;   // line price = unit price x quantity
const totalCents = () => cart.reduce((sum, line) => sum + lineCents(line), 0);   // all lines added up
```

So when the quantity goes up or down, the line price, the total and the badge are all recalculated. This idea is the most important in the file:

> **Change the data, then redraw the screen from the data.** Never edit the screen by hand.

---

## Part 2. The data the whole file works on

```js
let cart = [
  { name: "Whole Wheat Sandwich Bread", unitCents: 1800, qty: 2 },
  { name: "Whole Grain Oatmeal",        unitCents: 5000, qty: 1 }
];
```

The cart is an **array of objects**. Each object is one line in the cart:

| Property | Meaning |
|---|---|
| `name` | the product name, read from the page |
| `unitCents` | the price of ONE item, in **cents** (`$18.00` is stored as `1800`) |
| `qty` | how many of that item |

**Why cents?** Computers store decimals imperfectly. For example `0.1 + 0.2` gives `0.30000000000000004`. If prices are whole numbers of cents, the maths is always exact. We only turn cents back into `$18.00` when displaying.

**The ids the file needs in your HTML.** If one is missing, the console tells you which.

| id | Where | Used for |
|---|---|---|
| `cart-count` | the badge | total number of items |
| `cart-items` | the `<ul>` | the rows |
| `cart-total` | the total | the money total |
| `checkout-btn` | the checkout button | opens the test payment panel |
| `offcanvasCart` | the drawer (already exists) | used for opening and closing |

---

## Part 3. The code, section by section

### 3.1 The wrapper

```js
(function () {
  'use strict';
  ...
})();
```

- `(function () { ... })();` is a function that **runs immediately**. Everything inside is private. Variables like `cart` cannot clash with variables in `script.js` or the template's other scripts.
- `'use strict';` turns on stricter rules. For example, using a variable you never declared becomes an error instead of silently working. That catches typos early.

### 3.2 Settings

```js
const STORAGE_KEY = 'organicCart';
const MAX_QTY = 99;
const AUTO_OPEN = false;
```

- `const` makes a name that **cannot be reassigned**.
- `STORAGE_KEY` is the label used to save the cart in the browser. It is like the name on a drawer.
- `MAX_QTY` stops one product going above 99.
- `AUTO_OPEN` decides whether the drawer slides open after each add.

### 3.3 State (the things that change)

```js
let cart = [];
const els = {};
```

- `let` makes a name that **can** be reassigned. `cart` needs this because `clearCart()` sets it to a new empty array.
- `els` is an empty object that `init()` fills with the page elements (badge, list, total, button). The name is short for "elements". They are looked up once and reused.

### 3.4 Money helpers

#### `toCents(text)`, turning "$1,234.50" into 123450

```js
function toCents(text) {
  const cleaned = String(text).replace(/[$,]/g, '').trim();
  if (!/^\d{1,9}(\.\d{1,2})?$/.test(cleaned)) return null;
  const parts = cleaned.split('.');
  const fraction = ((parts[1] || '') + '00').slice(0, 2);
  return parseInt(parts[0], 10) * 100 + parseInt(fraction, 10);
}
```

Line by line:

1. `String(text)` makes sure we are working with text, even if a number was passed in.
2. `.replace(/[$,]/g, '')` removes every `$` and `,`. In the pattern `/[$,]/g`, the square brackets mean "any one of these characters", and the `g` flag means "every match, not just the first".
3. `.trim()` removes spaces at the start and end.
4. The `if` line checks the shape of the text using a **regular expression** (regex):
   - `^` the start of the text
   - `\d{1,9}` one to nine digits
   - `(\.\d{1,2})?` an **optional** group: a dot followed by one or two digits
   - `$` the end of the text
   - `.test(cleaned)` gives `true` or `false`, and the `!` flips it. So "if it does NOT match, return `null`". This rejects `abc`, `-5`, `1e5`, `18.001`, and empty text.
5. `cleaned.split('.')` cuts the text at the dot: `"18.5"` becomes `["18", "5"]`.
6. `(parts[1] || '')` means "the part after the dot, or an empty string if there is none". Then `+ '00'` and `.slice(0, 2)` take the first two characters, so `"5"` becomes `"50"` and `""` becomes `"00"`.
7. `parseInt(x, 10)` turns text into a whole number (the `10` means normal base-10 counting).
8. The result is dollars x 100 + cents.

#### `formatCents(cents)`, turning 3600 into "$36.00"

```js
function formatCents(cents) {
  const whole = Math.floor(cents / 100);
  const fraction = String(cents % 100).padStart(2, '0');
  return '$' + whole.toLocaleString('en-US') + '.' + fraction;
}
```

- `Math.floor(cents / 100)` divides by 100 and rounds down: the whole dollars.
- `cents % 100` is the **remainder** after dividing by 100: the cents part.
- `String(...).padStart(2, '0')` makes sure it has two digits: `7` becomes `"07"`.
- `whole.toLocaleString('en-US')` adds thousands commas: `1234` becomes `"1,234"`.

#### `readQty(input)`, reading the quantity box

```js
function readQty(input) {
  const n = input ? parseInt(input.value, 10) : NaN;
  return Number.isFinite(n) && n >= 1 ? Math.min(n, MAX_QTY) : 1;
}
```

- `input ? A : B` is the **ternary operator**, a short `if/else`: if the input exists use A, otherwise B.
- `NaN` means "not a number". Empty or non-numeric text gives `NaN`.
- `Number.isFinite(n)` is `true` only for real numbers.
- The last line says: if it is a real number **and** at least 1, use it (but no more than `MAX_QTY`); otherwise use 1. So empty, `NaN`, `0` or negative all become 1.

### 3.4b Cart maths

```js
const lineCents  = (line) => line.unitCents * line.qty;
const totalCents = () => cart.reduce((sum, line) => sum + lineCents(line), 0);
const totalQty   = () => cart.reduce((sum, line) => sum + line.qty, 0);
```

- `(line) => ...` is an **arrow function**, a shorter way to write a function.
- `.reduce(function, startValue)` goes through the array and **combines** it into one value. Here `sum` starts at `0` and each line is added in. `totalCents` adds up prices; `totalQty` adds up quantities (that is why the badge shows items, not rows).

### 3.5 Storage (saving and restoring)

```js
function isValidLine(line) {
  return !!line &&
    typeof line.name === 'string' && line.name.trim() !== '' &&
    Number.isInteger(line.unitCents) && line.unitCents > 0 &&
    Number.isInteger(line.qty) && line.qty >= 1;
}
```

Checks that a saved line is sane before trusting it. Anyone can edit `localStorage` in DevTools, so saved data is never trusted blindly.

- `!!line` turns anything into `true`/`false`. It is `false` for `null` or `undefined`.
- `typeof line.name === 'string'` checks the type.
- `Number.isInteger(...)` checks it is a whole number.

```js
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
    return [];
  }
}
```

- `localStorage.getItem(KEY)` reads the saved **text** (or `null` if nothing was saved).
- `JSON.parse(...)` turns that text back into a real array/object.
- `Array.isArray(data)` checks that it really is an array. If not, start with an empty cart.
- `.filter(isValidLine)` keeps only the good lines.
- `.map(...)` builds clean copies. The extra `( { ... } )` brackets are needed so JavaScript reads `{` as an object, not as the start of a code block.
- `try { ... } catch (error) { ... }` means "attempt this, and if anything breaks (corrupted text, blocked storage), run the catch part instead of crashing". Here it returns an empty cart.

```js
function save() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(cart)); } catch (error) { /* ignore */ }
}
```

- `JSON.stringify(cart)` turns the array into text (storage can only hold text).
- `localStorage.setItem(key, text)` saves it under the key.

### 3.6 Cart actions

```js
function commit() { clearStatus(); save(); render(); }
```

`commit` is the "I changed the cart" routine: hide any old payment message, save, and redraw. **Every change goes through it**, so you never forget a step.

```js
function addToCart(name, unitCents, qty) {
  const existing = cart.find((line) => line.name === name);
  if (existing) {
    existing.qty = Math.min(existing.qty + qty, MAX_QTY);
  } else {
    cart.push({ name: name, unitCents: unitCents, qty: Math.min(qty, MAX_QTY) });
  }
  commit();
}
```

- `.find(...)` returns the first line whose name matches, or `undefined` if none does.
- `if (existing)`: a found object counts as "true", so we **merge** by raising its qty.
- `.push({...})` adds a brand-new line at the end of the array.
- `Math.min(a, b)` returns the smaller number. It keeps quantity from passing the limit.

```js
function changeQty(index, delta) {
  const line = cart[index];
  if (!line) return;
  line.qty = Math.min(Math.max(line.qty + delta, 1), MAX_QTY);
  commit();
}
```

- `cart[index]` picks the line by its position.
- `if (!line) return;` is a **guard**: if there is no such line, stop.
- `Math.max(x, 1)` makes sure it is at least 1; `Math.min(..., MAX_QTY)` makes sure it is at most the limit. Together they **clamp** the number between 1 and 99.
- `delta` is `+1` or `-1`.

```js
function removeLine(index) {
  cart.splice(index, 1);
  commit();
}
```

`.splice(index, 1)` deletes one item at that position.

```js
function clearCart() {
  cart = [];
  try { localStorage.removeItem(STORAGE_KEY); } catch (error) { /* ignore */ }
  render();
}
```

Empties the array, deletes the saved copy, and redraws. (This is why `cart` is declared with `let`.)

### 3.7 Rendering (drawing the cart on the page)

```js
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
```

A small helper that builds an HTML element.

- `document.createElement('div')` makes a new, empty element in memory (not on the page yet).
- `.className = '...'` sets its CSS classes.
- `.textContent = '...'` sets its text. **This is safe**: the text is shown as plain text and never read as HTML, so a product name like `<img onerror=...>` cannot run code. (This is the habit that protects against XSS.)

```js
function button(label, className, action, ariaLabel) {
  const b = el('button', className, label);
  b.type = 'button';
  b.dataset.action = action;
  b.setAttribute('aria-label', ariaLabel);
  return b;
}
```

- `b.type = 'button'` stops it acting like a form submit button.
- `b.dataset.action = 'inc'` writes the attribute `data-action="inc"`. This is how the listener later knows **which** button was clicked.
- `setAttribute('aria-label', ...)` gives screen readers a spoken name such as "Increase quantity of Whole Wheat Sandwich Bread".

```js
function buildRow(line, index) {
  const li = el('li', 'list-group-item');
  li.dataset.index = String(index);
  ...
  minus.disabled = line.qty <= 1;
  plus.disabled = line.qty >= MAX_QTY;
  ...
  li.append(top, controls);
  return li;
}
```

Builds **one row** (a `<li>`) for one line:

- `li.dataset.index` writes `data-index="0"`. The row remembers its position in the array, which the button listener needs.
- `.append(a, b, c)` puts one or more children inside an element. It also accepts plain text.
- `'\u2212'` is the typographic minus sign (`-`).
- `minus.disabled = line.qty <= 1;` grays out the minus button at quantity 1 (use Remove to delete the item instead).
- `formatCents(lineCents(line))` shows the **line total** (unit price x qty).
- Bootstrap classes such as `d-flex`, `justify-content-between`, `btn-outline-danger` handle the styling, so no CSS file is needed.

```js
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
```

The "draw everything" function:

1. Set the badge to the total quantity.
2. Set the total to the money total.
3. `els.list.textContent = ''` **empties** the list. This prevents duplicate rows (the same trap that was in your book system code).
4. If the cart is empty show a message; otherwise `.forEach` goes through every line and appends a row.
5. Update the total inside the payment panel.

### 3.8 The test payment panel

This is a **simulation**. No server, no Paystack, no money. It only compares numbers.

```js
function updatePanelTotal() {
  const out = document.getElementById('payment-total');
  if (out) out.textContent = formatCents(totalCents());
}
```

Keeps the "Cart total" shown in the panel correct. `if (out)` guards against the panel not existing yet.

```js
function buildPaymentPanel() { ... }
```

Builds the panel once with JavaScript: a heading with a **TEST MODE** badge, a note, the cart total, an amount box, a Pay button, and the **message box**.

- `label.htmlFor = 'payment-amount'` links the label to the input (clicking the label focuses the input).
- `input.inputMode = 'decimal'` shows a number keyboard on phones.
- `input.autocomplete = 'off'` stops the browser suggesting old values.
- The class `d-none` (Bootstrap) means `display: none`. The panel starts hidden.
- The **message box**:

```js
const status = el('div', 'alert d-none mt-3 mb-0 py-2');
status.id = 'payment-status';
status.setAttribute('role', 'status');
status.setAttribute('aria-live', 'polite');
```

It starts hidden (`d-none`). `role="status"` and `aria-live="polite"` make screen readers announce the message when it appears.

```js
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
```

- `showStatus('Payment successful', 'success')` removes `d-none` (so it shows) and sets the Bootstrap color class: `alert-success` (green), `alert-danger` (red), `alert-warning` (yellow).
- `clearStatus()` hides it again and empties the text.

```js
function showPanel() {
  const panel = document.getElementById('payment-panel');
  if (!panel) return;
  panel.classList.remove('d-none');
  updatePanelTotal();
  document.getElementById('payment-amount').focus();
  panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
```

- `.classList.remove('d-none')` shows the panel. (`classList` has `.add`, `.remove` and `.toggle`.)
- `.focus()` puts the blinking cursor in the amount box.
- `.scrollIntoView(...)` scrolls the drawer just enough so the panel is visible.

```js
function hidePanel() {
  const panel = document.getElementById('payment-panel');
  const input = document.getElementById('payment-amount');
  if (panel) panel.classList.add('d-none');
  if (input) input.value = '';
  clearStatus();
}
```

Hides the panel, empties the amount box, and hides the message.

```js
function pay() {
  if (cart.length === 0) {
    showStatus('Your cart is empty', 'warning');
    return;
  }
  const amountInput = document.getElementById('payment-amount');
  const entered = toCents(amountInput.value);

  if (entered !== null && entered === totalCents()) {
    clearCart();
    amountInput.value = '';
    showStatus('Payment successful', 'success');
  } else {
    showStatus('Payment unsuccessful', 'danger');
  }
}
```

1. Empty cart: show the yellow message and stop (`return`).
2. Convert what was typed into cents (`null` if it is not a valid amount).
3. If it is valid **and** exactly equals the cart total: clear the cart, empty the amount box, show the green message.
4. Anything else (too much, too little, empty, text): red message, and the cart is **not** touched.

Because comparing is done in whole cents, `18.00` equals `18` and `$18.00`, and there is no rounding error.

### 3.9 `openCart()`

Covered in Part 1. Detail: `getOrCreateInstance(drawer)` gets Bootstrap's controller for that drawer (creating it if needed), and `.show()` slides it open. The `if (drawer && window.bootstrap && ...)` check makes sure nothing breaks if Bootstrap is not loaded.

### 3.10 `init()`, connecting everything

`init()` runs once, when the page is ready.

```js
els.count = document.getElementById('cart-count');
els.list = document.getElementById('cart-items');
els.total = document.getElementById('cart-total');
els.checkout = document.getElementById('checkout-btn');
```

`document.getElementById('x')` finds the element with that id, or gives `null` if there is none.

```js
const missing = Object.keys(els).filter((key) => !els[key]);
if (missing.length) {
  console.error('[cart.js] Missing HTML elements for: ' + missing.join(', ') + '...');
  return;
}
```

- `Object.keys(els)` gives the names `['count', 'list', 'total', 'checkout']`.
- `.filter(key => !els[key])` keeps the names whose element was **not** found.
- If any are missing, print a red error in the console naming them, and `return` (stop). This is why a forgotten id gives you a clear message instead of a silent failure.

```js
cart = load();
```

Restores the saved cart from `localStorage` (this is why the cart survives a refresh).

```js
els.checkout.insertAdjacentElement('afterend', buildPaymentPanel());
```

Creates the payment panel and places it **right after** the checkout button.

```js
document.getElementById('pay-btn').addEventListener('click', pay);
```

`addEventListener('click', pay)` means "when this is clicked, run `pay`". Note it is `pay`, **not** `pay()`. Adding the brackets would run it immediately. It is the same mistake as bug 6 in the workbook's debugging exercise.

```js
document.getElementById('payment-amount').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); pay(); }
});
document.getElementById('payment-amount').addEventListener('input', clearStatus);
els.checkout.addEventListener('click', (e) => { e.preventDefault(); showPanel(); });
```

- `keydown` fires for every key. `e.key === 'Enter'` lets Enter act like pressing Pay.
- `input` fires whenever the text changes. Typing a new amount hides the old message.
- The checkout button opens the panel. `e.preventDefault()` cancels the button's default action.
- `e` is the **event object**, holding details about what happened.

#### The "Add to Cart" listener (event delegation)

```js
document.addEventListener('click', (e) => {
  const addBtn = e.target.closest('a.btn-cart');
  if (!addBtn) return;
  e.preventDefault();
  ...
});
```

**Event delegation** means one listener on a big parent instead of one on every button. There are 37 product buttons, and Swiper slides may be created later, so one listener on `document` covers all of them.

- `e.target` is the exact thing clicked (it might be the little icon inside the button).
- `.closest('a.btn-cart')` starts at that element and goes **up through its parents** until it finds a match. If nothing matches, the result is `null`, and `if (!addBtn) return;` ignores the click.
- `e.preventDefault()` stops the link (`href="#"`) from jumping to the top of the page.

```js
const card = addBtn.closest('.product-item');
if (!card) return;
const nameEl  = card.querySelector('h3.fs-6.fw-normal');
const priceEl = card.querySelector('span.text-dark.fw-semibold');
const qtyEl   = card.querySelector('input.input-number.quantity');
```

- `.closest('.product-item')` climbs up to the card the button belongs to.
- `card.querySelector(...)` searches **only inside that card**, so you get that product's name, price and quantity, not another product's.
- `span.text-dark.fw-semibold` is the **sale price** (the original price is in a `<del>` tag and is ignored).

```js
const name = nameEl ? nameEl.textContent.trim() : '';
const unitCents = priceEl ? toCents(priceEl.textContent) : null;
if (!name || unitCents === null || unitCents <= 0) {
  console.warn('[cart.js] Could not read name/price for this product, nothing added.');
  return;
}
addToCart(name, unitCents, readQty(qtyEl));
if (AUTO_OPEN) openCart();
```

- Read the text, tidy it, and convert the price to cents.
- The `if` is a safety check: if the name or price could not be read, warn in the console and add nothing.
- `addToCart(...)` is the moment the item enters the cart. `readQty(qtyEl)` supplies the quantity from the product's box at click time.
- `if (AUTO_OPEN) openCart();` opens the drawer only if you turned that setting on.

#### The `+`, `-` and Remove listener

```js
els.list.addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-action]');
  const row = btn && btn.closest('li[data-index]');
  if (!row) return;
  const index = Number(row.dataset.index);

  if (btn.dataset.action === 'inc') changeQty(index, 1);
  else if (btn.dataset.action === 'dec') changeQty(index, -1);
  else if (btn.dataset.action === 'remove') removeLine(index);
});
```

Again delegation: one listener on the **whole list**, which works for rows created later.

- `closest('button[data-action]')` finds the button (any button that has a `data-action`).
- `btn && btn.closest(...)`: if `btn` is `null`, `&&` stops and `row` becomes `null`. Otherwise `row` is the `<li>` containing the button.
- `Number(row.dataset.index)` turns the saved position (text) back into a number.
- Then it checks `data-action` to see **which** button it was and calls the matching function.

#### Keeping tabs in sync, and closing the drawer

```js
window.addEventListener('storage', (e) => {
  if (e.key === STORAGE_KEY || e.key === null) { cart = load(); render(); }
});
```

The `storage` event fires in **other** open tabs when `localStorage` changes. `e.key === null` means "everything was cleared". This keeps two tabs showing the same cart.

```js
const drawer = document.getElementById('offcanvasCart');
if (drawer) drawer.addEventListener('hidden.bs.offcanvas', hidePanel);
```

`hidden.bs.offcanvas` is an event Bootstrap fires after the drawer finishes closing. We use it to tidy the payment panel (hide it, empty the amount, hide the message).

```js
render();
```

The last line of `init()` draws the cart for the first time, so a restored cart shows up immediately.

### 3.11 Starting up

```js
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
```

- `document.readyState` tells you whether the page is still being read (`'loading'`) or is finished.
- `DOMContentLoaded` is the event for "the HTML is fully read".
- So: if the page is still loading, wait for that event; otherwise run `init()` now. This guarantees the elements exist before `init()` looks for them.

---

## Part 4. A walk-through of one session

1. **Page loads.** `init()` runs. `load()` finds nothing, so `cart = []`. `render()` shows "Your cart is empty", badge `0`, total `$0.00`.
2. **You click Add to Cart on Whole Wheat Sandwich Bread ($18.00).** The delegated listener finds the card, reads `name`, `unitCents = 1800`, `qty = 1`. `addToCart` finds no match, so it `push`es `{ name, unitCents: 1800, qty: 1 }`. `commit()` saves it and `render()` draws one row. Badge `1`, total `$18.00`.
3. **You click it again.** `find` now matches, so `qty` becomes 2. The row shows `$36.00`. Badge `2`.
4. **You open the cart with the bag icon** (Bootstrap does this) and click `+`. The list listener sees `data-action="inc"` and calls `changeQty(0, 1)`. `qty` is 3, line `$54.00`, total `$54.00`.
5. **You refresh the page.** `load()` reads the saved text, `JSON.parse` turns it back into an array, and the cart reappears.
6. **You click Continue to checkout.** The panel appears. You type `54` and press Pay (or Enter). `toCents('54')` is `5400`, which equals `totalCents()`, so the cart is cleared and the green **Payment successful** message appears inside the panel.
7. **You type a wrong amount next time.** The red **Payment unsuccessful** message appears and the cart stays.

---

## Part 5. Glossary of every command used

### Language basics

| Command | What it does |
|---|---|
| `const` / `let` | declare a name that cannot / can be reassigned |
| `function name() {}` | define a function |
| `(x) => ...` | arrow function, a shorter function |
| `(function () { ... })();` | a function that runs immediately (private scope) |
| `'use strict'` | stricter rules that catch mistakes |
| `if / else if / else` | choose between paths |
| `a ? b : c` | ternary: short `if/else` |
| `&&`, `\|\|`, `!` | and, or, not |
| `===`, `!==` | strict equal, strict not equal |
| `return` | give a value back and stop the function |
| `try { } catch (error) { }` | attempt something; handle failure |
| `typeof x` | the type of a value |

### Numbers and text

| Command | What it does |
|---|---|
| `parseInt(text, 10)` | text to whole number |
| `Number(x)` | convert to a number |
| `String(x)` | convert to text |
| `Number.isFinite(n)` | true only for real numbers |
| `Number.isInteger(n)` | true only for whole numbers |
| `NaN` | "not a number" |
| `Math.floor(n)` | round down |
| `Math.min(a, b)` / `Math.max(a, b)` | smaller / larger number |
| `n % m` | remainder after dividing |
| `.trim()` | remove spaces at both ends |
| `.replace(pattern, text)` | replace matching text |
| `.split('.')` | cut text into an array |
| `.slice(0, 2)` | take part of text |
| `.padStart(2, '0')` | pad the start with zeros |
| `.toLocaleString('en-US')` | format a number with commas |
| `/pattern/.test(text)` | does the text match the regex? |

### Arrays and objects

| Command | What it does |
|---|---|
| `.push(item)` | add to the end |
| `.splice(i, 1)` | delete one item at position `i` |
| `.find(fn)` | first item that matches, or `undefined` |
| `.filter(fn)` | keep only matching items (new array) |
| `.map(fn)` | build a new array by changing each item |
| `.reduce(fn, start)` | combine all items into one value |
| `.forEach(fn)` | run something for each item |
| `Array.isArray(x)` | is it an array? |
| `Object.keys(obj)` | list an object's property names |
| `.join(', ')` | glue array items into text |

### Storage and JSON

| Command | What it does |
|---|---|
| `localStorage.setItem(k, v)` | save text under a key |
| `localStorage.getItem(k)` | read it (or `null`) |
| `localStorage.removeItem(k)` | delete it |
| `JSON.stringify(x)` | data to text |
| `JSON.parse(text)` | text to data |

### The page (DOM) and events

| Command | What it does |
|---|---|
| `document.getElementById('id')` | find one element by id |
| `el.querySelector('css')` | find the first match inside `el` |
| `el.closest('css')` | find `el` or its nearest matching parent |
| `document.createElement('div')` | make a new element in memory |
| `el.append(a, b)` | put children inside `el` |
| `el.insertAdjacentElement('afterend', x)` | place `x` right after `el` |
| `el.textContent = '...'` | set plain, safe text |
| `el.className = '...'` | set CSS classes |
| `el.classList.add/remove/toggle` | change one class |
| `el.dataset.action = 'inc'` | writes `data-action="inc"` |
| `el.setAttribute(name, value)` | set any attribute |
| `el.disabled = true` | grey out a button |
| `el.focus()` | put the cursor in it |
| `el.scrollIntoView({...})` | scroll until it is visible |
| `el.addEventListener('click', fn)` | run `fn` when clicked |
| `e.target` | what was actually clicked |
| `e.key` | which key was pressed |
| `e.preventDefault()` | cancel the default browser action |
| `document.readyState` | is the page still loading? |
| `DOMContentLoaded` | event: HTML fully read |
| `storage` | event: localStorage changed in another tab |
| `hidden.bs.offcanvas` | Bootstrap event: drawer finished closing |
| `bootstrap.Offcanvas.getOrCreateInstance(el).show()` | open the drawer from code |
| `console.error / console.warn` | print messages in DevTools |

### Bootstrap classes seen in the file

| Class | Meaning |
|---|---|
| `d-none` | hidden (`display: none`) |
| `d-flex` | lay children out in a row |
| `justify-content-between` | spread them to both ends |
| `alert alert-success / danger / warning` | green / red / yellow message box |
| `btn btn-sm btn-outline-secondary` | small outlined button |
| `list-group-item` | one row in a list group |
| `badge text-bg-warning` | small yellow label |
| `mt-3`, `mb-0`, `py-2`, `px-1` | margin and padding utilities |

---

## Part 6. When something goes wrong

| Symptom | Likely cause and fix |
|---|---|
| Nothing happens when you click Add to Cart | `cart.js` is not loaded. Check the `<script src="js/cart.js">` line and that the file is in the `js` folder. Look at the Console for errors. |
| Console says `Missing HTML elements for: ...` | One of the four ids is missing. Re-check the HTML changes. |
| The old sample items still show | The static `<ul>` was not replaced by the empty `<ul id="cart-items">`. |
| The badge or total never changes | The ids `cart-count` or `cart-total` are missing or misspelled. |
| The cart is empty after a refresh | The browser blocks storage (private mode) or you opened the page from a different address. |
| Adding twice makes two rows | The product names differ slightly. Merging is by exact name. |
| Payment is "unsuccessful" when it looks right | The amount must equal the total exactly: `54` or `54.00` for `$54.00`. |

To **see the saved cart**, open DevTools, then Application, then Local Storage. The key `organicCart` holds your array of objects.

---

## Part 7. Settings you can change (top of the file)

```js
const STORAGE_KEY = 'organicCart';  // the name the cart is saved under
const MAX_QTY = 99;                 // the highest quantity per product
const AUTO_OPEN = false;            // true = open the cart after every Add to Cart
```
