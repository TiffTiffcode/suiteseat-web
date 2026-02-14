// /qassets/js/appointment-settings.js
console.log("[appointment-settings] loaded");

const API_BASE = location.hostname.includes("localhost")
  ? "http://localhost:8400"
  : "https://api.suiteseat.io";

// ALWAYS include cookies
function apiFetch(path, options = {}) {
  const url = `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;
  return fetch(url, { credentials: "include", ...options });
}

async function apiJSON(path, options = {}) {
  const res = await apiFetch(path, {
    cache: "no-store",
    headers: { Accept: "application/json", ...(options.headers || {}) },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

// ------------------------------
// Header UI
// ------------------------------
function setHeaderLoggedOut() {
  const status = document.getElementById("login-status-text");
  const loginBtn = document.getElementById("open-login-popup-btn");
  const logoutBtn = document.getElementById("logout-btn");

  if (status) status.textContent = "Not logged in";
  if (loginBtn) loginBtn.style.display = "inline-block";
  if (logoutBtn) logoutBtn.style.display = "none";
}

function setHeaderLoggedIn(user) {
  const status = document.getElementById("login-status-text");
  const loginBtn = document.getElementById("open-login-popup-btn");
  const logoutBtn = document.getElementById("logout-btn");

  const first = (user?.firstName || user?.first_name || "").trim();
  const last = (user?.lastName || user?.last_name || "").trim();
  const name = [first, last].filter(Boolean).join(" ").trim();

  if (status) status.textContent = name ? `Hey, ${name}` : "Logged in";
  if (loginBtn) loginBtn.style.display = "none";
  if (logoutBtn) logoutBtn.style.display = "inline-block";
}

// Your server route: GET /api/me can return either:
// A) { ok:true, user:{...} }  OR  B) { _id/id/email/firstName/lastName }  OR  C) { ok:false, user:null }
async function initHeaderAuth() {
  try {
    const res = await apiFetch("/api/me", { method: "GET", cache: "no-store" });
    const data = await res.json().catch(() => ({}));

    console.log("[auth] GET /api/me", res.status, data);

    // Shape A
    if (data?.ok && data?.user) {
      setHeaderLoggedIn(data.user);
      return { loggedIn: true, user: data.user };
    }

    // Shape B
    if (data?._id || data?.id) {
      setHeaderLoggedIn(data);
      return { loggedIn: true, user: data };
    }

    setHeaderLoggedOut();
    return { loggedIn: false, user: null };
  } catch (e) {
    console.error("[auth] initHeaderAuth failed", e);
    setHeaderLoggedOut();
    return { loggedIn: false, user: null };
  }
}

// ------------------------------
// Login popup
// ------------------------------
function openLoginPopup() {
  document.getElementById("login-popup")?.style.setProperty("display", "block");
  document.getElementById("popup-overlay")?.style.setProperty("display", "block");
}

function closeLoginPopup() {
  document.getElementById("login-popup")?.style.setProperty("display", "none");
  document.getElementById("popup-overlay")?.style.setProperty("display", "none");
}

// ------------------------------
// Init
// ------------------------------
document.addEventListener("DOMContentLoaded", async () => {
  await initHeaderAuth();

  document.getElementById("open-login-popup-btn")?.addEventListener("click", openLoginPopup);
  document.getElementById("popup-overlay")?.addEventListener("click", closeLoginPopup);
  document.getElementById("close-login-popup-btn")?.addEventListener("click", closeLoginPopup);

  // IMPORTANT: your server has POST /login working (not /api/login)
  const LOGIN_PATH = "/login";

  document.getElementById("login-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = document.getElementById("login-email")?.value?.trim();
    const password = document.getElementById("login-password")?.value;

    if (!email || !password) return alert("Enter email + password");

    const { res, data } = await apiJSON(LOGIN_PATH, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    console.log(`[login] POST ${LOGIN_PATH}`, res.status, data);

    if (!res.ok) return alert(data?.message || data?.error || "Login failed");

    // ✅ Update header immediately from login response (supports multiple shapes)
    const user =
      data?.user ||
      (data?.loggedIn ? data : null);

    if (user && (user._id || user.id)) {
      setHeaderLoggedIn(user);
    }

    // ✅ Then re-check session (source of truth)
    await initHeaderAuth();

    closeLoginPopup();
    const pw = document.getElementById("login-password");
    if (pw) pw.value = "";
  });

  // Logout: your clean one is POST /api/logout
  document.getElementById("logout-btn")?.addEventListener("click", async () => {
    await apiFetch("/api/logout", { method: "POST" }).catch(() => {});
    setHeaderLoggedOut();
  });
});
