/* auth.js: sign-up, sign-in, sessions and roles (plain JavaScript, no libraries).

   IMPORTANT: this all runs inside the visitor's browser. That makes it a good
   LEARNING SIMULATION of accounts and roles, but NOT real security: anyone can open
   DevTools and edit localStorage. Real login checks must happen on a server.

   Load this file in the <head> of every page that uses accounts.
   It creates one global object called Auth. */
(function () {
  'use strict';

  /* ---------- settings you can change ---------- */
  const USERS_KEY = 'organicUsers';       // localStorage key for the list of accounts
  const SESSION_KEY = 'organicSession';   // key for "who is signed in right now"
  const LOCK_KEY = 'organicLock';         // key for the failed-login counter
  const SESSION_STORE = 'session';        // 'session' = sign-in ends when the tab closes
                                          // 'local'   = sign-in survives closing the browser
  const MAX_FAILS = 5;                    // wrong passwords allowed before a short lock
  const LOCK_SECONDS = 30;                // how long the lock lasts

  // The first admin account. It is created automatically if no admin exists.
  // Change these values (and delete the stored data) to use your own admin.
  const SEED_ADMIN = { name: 'Store Admin', email: 'admin@organic.test', password: 'Admin@12345' };

  /* ---------- safe storage helpers ---------- */
  // Reading window.localStorage can throw an error when the browser blocks storage.
  function getStore(kind) {
    try { return kind === 'local' ? window.localStorage : window.sessionStorage; } catch (e) { return null; }
  }

  function readJson(store, key, fallback) {
    if (!store) return fallback;
    try {
      const raw = store.getItem(key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch (e) {
      return fallback;                    // missing or corrupted data
    }
  }

  function writeJson(store, key, value) {
    if (!store) return false;
    try { store.setItem(key, JSON.stringify(value)); return true; } catch (e) { return false; }
  }

  /* ---------- SHA-256 (pure JavaScript, works on every page type) ----------
     The browser's built-in crypto.subtle only works on https or localhost, so this
     small implementation is used instead. It turns any text into 64 hex characters. */
  const K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];

  function rotr(x, n) { return (x >>> n) | (x << (32 - n)); }

  function sha256(message) {
    const bytes = new TextEncoder().encode(String(message));
    const length = bytes.length;
    const padded = new Uint8Array(Math.ceil((length + 9) / 64) * 64);
    padded.set(bytes);
    padded[length] = 0x80;
    const view = new DataView(padded.buffer);
    view.setUint32(padded.length - 8, Math.floor((length * 8) / 0x100000000), false);
    view.setUint32(padded.length - 4, (length * 8) >>> 0, false);

    const H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
    const w = new Uint32Array(64);

    for (let offset = 0; offset < padded.length; offset += 64) {
      for (let i = 0; i < 16; i++) w[i] = view.getUint32(offset + i * 4, false);
      for (let i = 16; i < 64; i++) {
        const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
        const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
        w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
      }

      let a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
      for (let i = 0; i < 64; i++) {
        const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
        const ch = (e & f) ^ (~e & g);
        const t1 = (h + S1 + ch + K[i] + w[i]) | 0;
        const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
        const maj = (a & b) ^ (a & c) ^ (b & c);
        const t2 = (S0 + maj) | 0;
        h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
      }
      H[0] = (H[0] + a) | 0; H[1] = (H[1] + b) | 0; H[2] = (H[2] + c) | 0; H[3] = (H[3] + d) | 0;
      H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0; H[6] = (H[6] + g) | 0; H[7] = (H[7] + h) | 0;
    }
    return H.map((n) => (n >>> 0).toString(16).padStart(8, '0')).join('');
  }

  /* ---------- small helpers ---------- */
  function randomHex(byteCount) {
    const arr = new Uint8Array(byteCount);
    if (window.crypto && window.crypto.getRandomValues) {
      window.crypto.getRandomValues(arr);
    } else {
      for (let i = 0; i < arr.length; i++) arr[i] = Math.floor(Math.random() * 256);
    }
    return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('');
  }

  function makeId() { return Date.now().toString(36) + '-' + randomHex(4); }

  // salt + password -> 64 hex characters. The salt makes two equal passwords look different.
  function hashPassword(password, salt) { return sha256(salt + ':' + password); }

  /* ---------- validation (used by the forms) ---------- */
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  function normalizeEmail(value) { return String(value || '').trim().toLowerCase(); }
  function cleanName(value) { return String(value || '').trim().replace(/\s+/g, ' '); }

  function nameProblem(value) {
    const name = cleanName(value);
    if (name.length < 2) return 'Enter your full name (at least 2 characters).';
    if (name.length > 60) return 'Your name must be 60 characters or fewer.';
    return '';
  }

  // first name or last name on its own (label is used in the message, e.g. "first name")
  function namePartProblem(value, label) {
    const part = cleanName(value);
    if (part.length < 1) return 'Enter your ' + label + '.';
    if (part.length > 30) return 'Your ' + label + ' must be 30 characters or fewer.';
    return '';
  }

  function emailProblem(value) {
    const email = normalizeEmail(value);
    if (!email) return 'Enter your email address.';
    if (email.length > 254 || !EMAIL_RE.test(email)) return 'Enter a valid email address.';
    return '';
  }

  function passwordProblem(value) {
    const password = String(value || '');
    if (password.length < 8) return 'Your password must be at least 8 characters.';
    if (password.length > 128) return 'Your password must be 128 characters or fewer.';
    if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return 'Your password needs at least one letter and one number.';
    return '';
  }

  /* ---------- the list of accounts ---------- */
  function isValidUser(u) {
    return !!u && typeof u === 'object' &&
      typeof u.id === 'string' && u.id !== '' &&
      typeof u.name === 'string' && typeof u.email === 'string' &&
      typeof u.salt === 'string' && typeof u.hash === 'string' &&
      (u.role === 'admin' || u.role === 'user');
  }

  function loadUsers() {
    const data = readJson(getStore('local'), USERS_KEY, []);
    return Array.isArray(data) ? data.filter(isValidUser) : [];
  }

  function saveUsers(users) { return writeJson(getStore('local'), USERS_KEY, users); }

  // A copy that is safe to show on a page: no salt and no password hash.
  function publicUser(u) {
    return { id: u.id, name: u.name, email: u.email, role: u.role, createdAt: Number(u.createdAt) || 0 };
  }

  /* ---------- sessions ---------- */
  function sessionStore() { return getStore(SESSION_STORE); }

  function startSession(userId) {
    return writeJson(sessionStore(), SESSION_KEY, { userId: userId, at: Date.now() });
  }

  // The session only remembers an id. The role is always read from the account list.
  function currentUser() {
    const session = readJson(sessionStore(), SESSION_KEY, null);
    if (!session || typeof session.userId !== 'string') return null;
    const user = loadUsers().find((u) => u.id === session.userId);
    return user ? publicUser(user) : null;
  }

  function go(url) { window.location.replace(url); }

  function logout(to) {
    try {
      const store = sessionStore();
      if (store) store.removeItem(SESSION_KEY);
    } catch (e) { /* ignore */ }
    go(to || 'signin.html');
  }

  function homeFor(user) { return user && user.role === 'admin' ? 'admin.html' : 'index.html'; }

  /* ---------- page guards ---------- */
  function requireLogin() {
    const user = currentUser();
    if (!user) { go('signin.html'); return null; }
    return user;
  }

  function requireRole(role) {
    const user = currentUser();
    if (!user) { go('signin.html'); return null; }
    if (user.role !== role) { go('index.html'); return null; }
    return user;
  }

  function redirectIfLoggedIn() {
    const user = currentUser();
    if (user) { go(homeFor(user)); return true; }
    return false;
  }

  /* ---------- sign up ---------- */
  // The role is ALWAYS 'user' here. A sign-up form can never create an admin.
  function register(firstName, lastName, email, password) {
    let problem = namePartProblem(firstName, 'first name');
    if (problem) return { ok: false, field: 'firstName', error: problem };
    problem = namePartProblem(lastName, 'last name');
    if (problem) return { ok: false, field: 'lastName', error: problem };
    problem = emailProblem(email);
    if (problem) return { ok: false, field: 'email', error: problem };
    problem = passwordProblem(password);
    if (problem) return { ok: false, field: 'password', error: problem };

    const users = loadUsers();
    const cleanEmail = normalizeEmail(email);
    if (users.some((u) => u.email === cleanEmail)) {
      return { ok: false, field: 'email', error: 'An account with this email already exists. Try signing in.' };
    }

    const salt = randomHex(16);
    const user = {
      id: makeId(),
      name: cleanName(firstName) + ' ' + cleanName(lastName),
      email: cleanEmail,
      salt: salt,
      hash: hashPassword(String(password), salt),
      role: 'user',
      createdAt: Date.now()
    };
    users.push(user);
    if (!saveUsers(users)) {
      return { ok: false, field: 'form', error: 'Could not save your account. Your browser may be blocking storage.' };
    }
    return { ok: true, user: publicUser(user) };
  }

  /* ---------- sign in (with a short lock after too many wrong tries) ---------- */
  function readLock() {
    const saved = readJson(getStore('local'), LOCK_KEY, null);
    return { fails: Number(saved && saved.fails) || 0, until: Number(saved && saved.until) || 0 };
  }

  function writeLock(state) { writeJson(getStore('local'), LOCK_KEY, state); }

  function lockSecondsLeft() { return Math.max(0, Math.ceil((readLock().until - Date.now()) / 1000)); }

  function login(email, password) {
    const left = lockSecondsLeft();
    if (left > 0) return { ok: false, reason: 'locked', seconds: left };

    const cleanEmail = normalizeEmail(email);
    const record = loadUsers().find((u) => u.email === cleanEmail);
    const good = !!record && record.hash === hashPassword(String(password || ''), record.salt);

    if (!good) {
      const state = readLock();
      state.fails += 1;
      if (state.fails >= MAX_FAILS) {
        writeLock({ fails: 0, until: Date.now() + LOCK_SECONDS * 1000 });
        return { ok: false, reason: 'locked', seconds: LOCK_SECONDS };
      }
      writeLock(state);
      return { ok: false, reason: 'invalid' };       // never say WHICH part was wrong
    }

    writeLock({ fails: 0, until: 0 });
    return { ok: true, user: publicUser(record) };
  }

  /* ---------- change password (for the signed-in user) ---------- */
  function changePassword(currentPassword, newPassword) {
    const me = currentUser();
    if (!me) return { ok: false, field: 'form', error: 'You are not signed in.' };

    const users = loadUsers();
    const record = users.find((u) => u.id === me.id);
    if (!record || record.hash !== hashPassword(String(currentPassword || ''), record.salt)) {
      return { ok: false, field: 'current', error: 'Your current password is not correct.' };
    }
    const problem = passwordProblem(newPassword);
    if (problem) return { ok: false, field: 'next', error: problem };

    record.salt = randomHex(16);
    record.hash = hashPassword(String(newPassword), record.salt);
    if (!saveUsers(users)) return { ok: false, field: 'form', error: 'Could not save the new password.' };
    return { ok: true };
  }

  // Only an admin may see the account list.
  function listUsers() {
    const me = currentUser();
    if (!me || me.role !== 'admin') return [];
    return loadUsers().map(publicUser);
  }

  /* ---------- first admin ---------- */
  function ensureSeedAdmin() {
    const users = loadUsers();
    if (users.some((u) => u.role === 'admin')) return;
    const salt = randomHex(16);
    users.push({
      id: makeId(),
      name: SEED_ADMIN.name,
      email: normalizeEmail(SEED_ADMIN.email),
      salt: salt,
      hash: hashPassword(SEED_ADMIN.password, salt),
      role: 'admin',
      createdAt: Date.now()
    });
    saveUsers(users);
  }

  try { ensureSeedAdmin(); } catch (e) { /* storage blocked: sign-up will show a message */ }

  /* ---------- the public API ---------- */
  window.Auth = Object.freeze({
    register: register,
    login: login,
    logout: logout,
    startSession: startSession,
    currentUser: currentUser,
    requireLogin: requireLogin,
    requireRole: requireRole,
    redirectIfLoggedIn: redirectIfLoggedIn,
    changePassword: changePassword,
    listUsers: listUsers,
    homeFor: homeFor,
    nameProblem: nameProblem,
    namePartProblem: namePartProblem,
    emailProblem: emailProblem,
    passwordProblem: passwordProblem,
    cleanName: cleanName,
    normalizeEmail: normalizeEmail,
    lockSecondsLeft: lockSecondsLeft,
    seedAdminEmail: SEED_ADMIN.email,
    _sha256: sha256                       // exposed only so it can be tested
  });
})();
