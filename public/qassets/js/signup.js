//C:\Users\tiffa\OneDrive\Desktop\suiteseat-web\public\qassets\js\signup.js 
//at top of signup.js

// ---- Simple API helper: always call Next.js API on the same origin ----
async function apiJSON(path, init) {
  const url = path.startsWith('/') ? path : `/${path}`;
  console.log('[apiJSON] calling', url); // debug so we can see the URL

  const res = await fetch(url, {
    credentials: 'include', // send/receive cookies
    ...(init || {}),
  });

  const ct = res.headers.get('content-type') || '';
  const text = await res.text();

  if (!ct.includes('application/json')) {
    throw new Error(
      `Expected JSON from ${url}, got ${ct || 'unknown'}: ${text.slice(0, 200)}`
    );
  }

  const data = JSON.parse(text || '{}');

  if (!res.ok || data.ok === false) {
    throw new Error(data.error || data.message || `HTTP ${res.status}`);
  }

  return data;
}

document.addEventListener('DOMContentLoaded', () => {
  // --- helpers
  const $ = (id) => document.getElementById(id);
  const show = (el) => el && (el.style.display = 'block');
  const hide = (el) => el && (el.style.display = 'none');

  const params = new URLSearchParams(location.search);
  const next = params.get('next');

  // --- top toggles
  const clientToggle = $('clientToggle');
  const proToggle = $('proToggle');
  const clientSection = $('clientSection');
  const proSection = $('proSection');

  show(clientSection);
  hide(proSection);
  clientToggle?.classList.add('active');
  proToggle?.classList.remove('active');

  clientToggle?.addEventListener('click', () => {
    show(clientSection);
    hide(proSection);
    clientToggle.classList.add('active');
    proToggle.classList.remove('active');
  });

  proToggle?.addEventListener('click', () => {
    show(proSection);
    hide(clientSection);
    proToggle.classList.add('active');
    clientToggle.classList.remove('active');
  });

  // --- client login/signup card toggles
  const clientSignUpCard = $('clientSignUpCard');
  const clientLoginCard = $('clientLoginCard');
  $('showClientLogin')?.addEventListener('click', (e) => {
    e.preventDefault();
    hide(clientSignUpCard);
    show(clientLoginCard);
  });
  $('showClientSignup')?.addEventListener('click', (e) => {
    e.preventDefault();
    hide(clientLoginCard);
    show(clientSignUpCard);
  });

  // --- pro login/signup card toggles
  const proSignUpCard = $('proSignUpCard');
  const proLoginCard = $('proLoginCard');
  $('showProLogin')?.addEventListener('click', (e) => {
    e.preventDefault();
    hide(proSignUpCard);
    show(proLoginCard);
  });
  $('showProSignup')?.addEventListener('click', (e) => {
    e.preventDefault();
    hide(proLoginCard);
    show(proSignUpCard);
  });

  // ========= PRO SIGN UP =========
  $('proSignUpForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const firstName = $('pro-first-name')?.value.trim();
    const lastName = $('pro-last-name')?.value.trim();
    const email = $('pro-signup-email')?.value.trim().toLowerCase();
    const phone = $('signup-phone-number')?.value.trim();
    const password = $('pro-signup-password')?.value;
    const confirm = $('signup-reenter-pro-password')?.value;

    if (!firstName || !lastName || !email || !password)
      return alert('Please fill in all required fields.');
    if (password !== confirm) return alert('Passwords do not match');
    if (password.length < 8 || password.length > 64)
      return alert('Password must be 8–64 characters.');

    try {
      const data = await apiJSON('/api/signup/pro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firstName, lastName, email, password, phone }),
      });
      location.href = data.redirect || next || '/appointment-settings.html';
    } catch (err) {
      console.error(err);
      alert(`Sign up failed: ${err.message}`);
    }
  });

  // ========= PRO LOGIN =========
  $('proLoginForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = $('pro-log-in-email')?.value.trim();
    const password = $('pro-log-in-password')?.value;
    if (!email || !password) return alert('Enter email and password.');

    try {
      const data = await apiJSON('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      location.href = data.redirect || next || '/appointment-settings.html';
    } catch (err) {
      console.error(err);
      alert(`Login failed: ${err.message}`);
    }
  });

  // ========= CLIENT SIGN UP =========
  $('clientSignUpForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const firstName = $('client-first-name')?.value.trim();
    const lastName = $('client-last-name')?.value.trim();
    const email = $('client-signup-email')?.value.trim().toLowerCase();
    const phone = $('client-signup-phone-number')?.value.trim();
    const password = $('client-signup-password')?.value;
    const confirm = $('client-signup-reenter-password')?.value;

    if (!firstName || !lastName || !email || !password)
      return alert('Please fill in all required fields.');
    if (password !== confirm) return alert('Passwords do not match');
    if (password.length < 8 || password.length > 64)
      return alert('Password must be 8–64 characters.');

    try {
      const data = await apiJSON('/api/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firstName, lastName, email, password, phone }),
      });
      location.href = next || '/client-dashboard';
    } catch (err) {
      console.error(err);
      alert(`Signup failed: ${err.message}`);
    }
  });

  // ========= CLIENT LOGIN =========
  $('clientLoginForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = $('client-log-in-email')?.value.trim();
    const password = $('client-log-in-password')?.value;
    if (!email || !password) return alert('Enter email and password.');

    try {
      const data = await apiJSON('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      location.href = data.redirect || next || '/client-dashboard';
    } catch (err) {
      console.error(err);
      alert(`Login failed: ${err.message}`);
    }
  });

  // ====== show/hide password buttons ======
  $('toggleClientSignupPassword')?.addEventListener('click', () => {
    const input = $('client-signup-password');
    if (!input) return;
    input.type = input.type === 'password' ? 'text' : 'password';
  });

  $('toggleClientPassword')?.addEventListener('click', () => {
    const input = $('client-log-in-password');
    if (!input) return;
    input.type = input.type === 'password' ? 'text' : 'password';
    const eye = $('toggleClientPassword');
    if (eye) eye.textContent = input.type === 'password' ? '👁️' : '🙈';
  });

  $('toggleProSignupPassword')?.addEventListener('click', function () {
    const input = $('pro-signup-password');
    if (!input) return;
    const isHidden = input.type === 'password';
    input.type = isHidden ? 'text' : 'password';
    this.textContent = isHidden ? '🙈' : '👁️';
  });

  $('toggleProPassword')?.addEventListener('click', function () {
    const input = $('pro-log-in-password');
    if (!input) return;
    const isHidden = input.type === 'password';
    input.type = isHidden ? 'text' : 'password';
    this.textContent = isHidden ? '🙈' : '👁️';
  });
});
