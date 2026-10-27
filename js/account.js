/* account.js: the "My account" page for any signed-in user (plain JavaScript).
   Needs js/auth.js loaded first. */
(function () {
  'use strict';

  const user = Auth.requireLogin();
  if (!user) return;
  document.body.classList.remove('guarded');

  /* ---------- profile ---------- */
  document.getElementById('acc-name').textContent = user.name;
  document.getElementById('acc-email').textContent = user.email;

  const roleBadge = document.getElementById('acc-role');
  roleBadge.textContent = user.role;
  if (user.role === 'admin') roleBadge.classList.add('badge-admin');

  document.getElementById('acc-since').textContent = user.createdAt
    ? new Date(user.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    : '-';

  document.getElementById('role-note').textContent = user.role === 'admin'
    ? 'You can add and delete products from the admin panel.'
    : 'You can browse the store, fill your cart and use the test checkout.';

  // Only admins see the link to the admin panel.
  document.getElementById('admin-link').hidden = user.role !== 'admin';

  document.getElementById('logout-btn').addEventListener('click', () => Auth.logout('signin.html'));

  /* ---------- change password ---------- */
  const form = document.getElementById('password-form');
  const fields = {
    current: document.getElementById('current'),
    next: document.getElementById('next'),
    confirm: document.getElementById('confirm')
  };
  const message = document.getElementById('password-message');

  function setError(field, text) {
    const box = document.getElementById(field + '-error');
    if (box) box.textContent = text;
    if (fields[field]) fields[field].classList.toggle('invalid', text !== '');
  }

  function showMessage(text, kind) {
    message.textContent = text;
    message.className = 'msg msg-' + kind;
    message.hidden = false;
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    Object.keys(fields).forEach((field) => setError(field, ''));
    message.hidden = true;

    const current = fields.current.value;
    const next = fields.next.value;
    const confirm = fields.confirm.value;

    if (current === '') { setError('current', 'Enter your current password.'); fields.current.focus(); return; }
    const problem = Auth.passwordProblem(next);
    if (problem) { setError('next', problem); fields.next.focus(); return; }
    if (next !== confirm) { setError('confirm', 'The two passwords do not match.'); fields.confirm.focus(); return; }

    const result = Auth.changePassword(current, next);
    if (!result.ok) {
      if (fields[result.field]) setError(result.field, result.error);
      else showMessage(result.error, 'error');
      return;
    }

    form.reset();
    showMessage('Your password was updated.', 'success');
  });
})();
