console.log('[settings] loaded');

// ---- Get signed-in user via /api/me ----
const API_BASE = location.hostname.includes("localhost")
  ? "http://localhost:8400"
  : "https://api2.suiteseat.io";

function apiFetch(path, options = {}) {
  const url = `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;
  return fetch(url, {
    credentials: "include",
    cache: "no-store",
    ...options,
  });
}

async function getSignedInUser() {
  try {
    const res = await apiFetch('/api/me', { method: 'GET' });
    const data = await res.json().catch(() => ({}));

    console.log('[settings] GET /api/me', res.status, data);

    if (data?.ok && data?.user) return data.user;
    return null;
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
    const loggedIn = !!(user && (user._id || user.id));
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
 const res = await apiFetch('/api/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
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
await apiFetch('/api/logout', {
  method: 'POST',
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
  initProModeUI(user);

  // Card buttons navigation
  document
    .getElementById('btn-appointments')
    ?.addEventListener('click', () => {
      window.location.href = '/appointment-settings';
    });

  document
    .getElementById('btn-suites')
    ?.addEventListener('click', () => {
      window.location.href = '/suite-settings';
    });

  document
    .getElementById('btn-course')
    ?.addEventListener('click', () => {
      window.location.href = '/course-settings';
    });

  document
    .getElementById('btn-links')
    ?.addEventListener('click', () => {
      window.location.href = '/linkpage-settings';
    });

  document
    .getElementById('btn-store')
    ?.addEventListener('click', () => {
      window.location.href = '/store-settings';
    });


//Builder Mode 
function openProModeModal() {
  const modal = document.getElementById("proModeModal");
  if (!modal) return;
  modal.hidden = false;
  modal.setAttribute("aria-hidden", "false");
}

function closeProModeModal() {
  const modal = document.getElementById("proModeModal");
  if (!modal) return;
  modal.hidden = true;
  modal.setAttribute("aria-hidden", "true");
}

async function saveProMode(mode) {
  const res = await apiFetch("/api/me/pro-mode", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ proMode: mode }),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok || data.ok === false) {
    throw new Error(data.error || data.message || "Failed to save mode.");
  }

  return data;
}

function initProModeUI(currentUser) {
  const selfBtn = document.getElementById("proModeSelfBtn");
  const builderBtn = document.getElementById("proModeBuilderBtn");
  const errorEl = document.getElementById("proModeError");

  if (!selfBtn || !builderBtn) return;

  async function chooseMode(mode) {
    try {
      if (errorEl) errorEl.textContent = "";

      selfBtn.disabled = true;
      builderBtn.disabled = true;

      await saveProMode(mode);

      closeProModeModal();
      location.reload();
    } catch (err) {
      console.error("[settings] saveProMode error", err);
      if (errorEl) {
        errorEl.textContent = err.message || "Could not save selection.";
      }
    } finally {
      selfBtn.disabled = false;
      builderBtn.disabled = false;
    }
  }

  selfBtn.addEventListener("click", () => chooseMode("self"));
  builderBtn.addEventListener("click", () => chooseMode("builder"));

  const isPro =
    currentUser?.role === "pro" ||
    currentUser?.accountType === "pro" ||
    currentUser?.userType === "pro";

  const hasMode = !!currentUser?.proMode;

  if (isPro && !hasMode) {
    openProModeModal();
  }
}



});
