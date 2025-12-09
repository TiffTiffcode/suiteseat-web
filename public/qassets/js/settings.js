console.log('[settings] loaded');

// ---- Get signed-in user via /api/check-login ----
async function getSignedInUser() {
  try {
    const res = await fetch('/api/check-login', {
      credentials: 'include',
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.user || null;
  } catch (err) {
    console.warn('[settings] getSignedInUser error', err);
    return null;
  }
}

// ================================
// AUTH UI (header + popup)
// ================================
function initAuthUI(currentUser) {
  const loginBtn  = document.getElementById('open-login-popup-btn');
  const logoutBtn = document.getElementById('logout-btn');
  const loginText = document.getElementById('login-status-text');

  const modal     = document.getElementById('authModal');
  const closeBtn  = document.getElementById('authClose');
  const form      = document.getElementById('authForm');
  const emailEl   = document.getElementById('authEmail');
  const passEl    = document.getElementById('authPass');
  const errorEl   = document.getElementById('authError');
  const submitBtn = document.getElementById('authSubmit');

  function setLoggedInUI(user) {
    const loggedIn = !!(user && user.id);
    if (loggedIn) {
      const name =
        user.firstName ||
        (user.email ? user.email.split('@')[0] : '') ||
        'there';

      if (loginText) loginText.textContent = `Hi, ${name}`;
      if (loginBtn)  loginBtn.style.display  = 'none';
      if (logoutBtn) logoutBtn.style.display = 'inline-block';
    } else {
      if (loginText) loginText.textContent = 'Not logged in';
      if (loginBtn)  loginBtn.style.display  = 'inline-block';
      if (logoutBtn) logoutBtn.style.display = 'none';
    }
  }

  function openModal() {
    if (!modal) return;
    modal.hidden = false;
    modal.setAttribute('aria-hidden', 'false');
    if (emailEl) emailEl.focus();
  }

  function closeModal() {
    if (!modal) return;
    modal.hidden = true;
    modal.setAttribute('aria-hidden', 'true');
    if (errorEl) errorEl.textContent = '';
  }

  loginBtn?.addEventListener('click', openModal);
  closeBtn?.addEventListener('click', closeModal);
  modal?.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  // login submit
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    console.log('[settings] login submit clicked');
    if (!emailEl || !passEl || !submitBtn) return;

    const email = emailEl.value.trim();
    const password = passEl.value.trim();
    if (!email || !password) {
      if (errorEl) errorEl.textContent = 'Enter email and password.';
      return;
    }

    const idleSpan = submitBtn.querySelector('.when-idle');
    const busySpan = submitBtn.querySelector('.when-busy');
    submitBtn.disabled = true;
    if (idleSpan) idleSpan.hidden = true;
    if (busySpan) busySpan.hidden = false;
    if (errorEl) errorEl.textContent = '';

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });
      const body = await res.json().catch(() => ({}));

      if (!res.ok || body.ok === false) {
        if (errorEl) {
          errorEl.textContent =
            body.error || body.message || 'Login failed.';
        }
      } else {
        closeModal();
        location.reload();
      }
    } catch (err) {
      console.error('[auth] login error', err);
      if (errorEl) errorEl.textContent = 'Something went wrong. Try again.';
    } finally {
      submitBtn.disabled = false;
      if (idleSpan) idleSpan.hidden = false;
      if (busySpan) busySpan.hidden = true;
    }
  });

  // logout
  logoutBtn?.addEventListener('click', async () => {
    try {
      await fetch('/api/logout', {
        method: 'POST',
        credentials: 'include',
      });
    } catch {}
    location.reload();
  });

  // initial paint
  setLoggedInUI(currentUser);
}

// ================================
// Page Nav
// ================================
document.addEventListener('DOMContentLoaded', async () => {
  const user = await getSignedInUser();
  console.log('[settings] currentUser:', user);
  initAuthUI(user);

  // Card buttons navigation
  document
    .getElementById('btn-appointments')
    ?.addEventListener('click', () => {
      window.location.href = '/appointment-settings.html';
    });

  document
    .getElementById('btn-suites')
    ?.addEventListener('click', () => {
      window.location.href = '/suite-settings.html';
    });

  document
    .getElementById('btn-course')
    ?.addEventListener('click', () => {
      window.location.href = '/course-settings.html';
    });

  document
    .getElementById('btn-links')
    ?.addEventListener('click', () => {
      window.location.href = '/linkpage-settings.html';
    });

  document
    .getElementById('btn-store')
    ?.addEventListener('click', () => {
      window.location.href = '/store-settings.html';
    });




});
