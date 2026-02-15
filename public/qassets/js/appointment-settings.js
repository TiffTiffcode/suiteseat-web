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

/////////////////////////////////////////////////
// 1) LOGIN / HEADER (TOP OF FILE)
/////////////////////////////////////////////////

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

// GET /api/me can return:
// A) { ok:true, user:{...} }  OR
// B) { _id/id/email/firstName/lastName } OR
// C) { ok:false, user:null }
async function initHeaderAuth() {
  try {
    const res = await apiFetch("/api/me", { method: "GET", cache: "no-store" });
    const data = await res.json().catch(() => ({}));

    console.log("[auth] GET /api/me", res.status, data);

    if (data?.ok && data?.user) {
      setHeaderLoggedIn(data.user);
      return { loggedIn: true, user: data.user };
    }

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

// Login popup
function openLoginPopup() {
  document.getElementById("login-popup")?.style.setProperty("display", "block");
  document.getElementById("popup-overlay")?.style.setProperty("display", "block");
}
function closeLoginPopup() {
  document.getElementById("login-popup")?.style.setProperty("display", "none");
  document.getElementById("popup-overlay")?.style.setProperty("display", "none");
}

/////////////////////////////////////////////////
// 2) MENU SECTION + BUSINESS DROPDOWN (BELOW LOGIN)
/////////////////////////////////////////////////

function pickText(obj, keys = []) {
  for (const k of keys) {
    const v = obj?.[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

function normalizeItems(out) {
  // supports: array OR {items:[...]} OR { ok:true, items:[...] }
  if (Array.isArray(out)) return out;
  if (Array.isArray(out?.items)) return out.items;
  return [];
}

// Render dropdown
function renderBusinessDropdown(items) {
  const dd = document.getElementById("business-dropdown");
  if (!dd) return;

  dd.innerHTML = `<option value="">-- Choose Business --</option>`;

  items.forEach((row) => {
    const v = row?.values || row || {};
    const id = String(row?._id || row?.id || v?._id || "");
    const name =
      pickText(v, ["Business Name", "Name", "businessName", "title"]) || "Business";

    if (!id) return;

    const opt = document.createElement("option");
    opt.value = id;
    opt.textContent = name;
    dd.appendChild(opt);
  });
}

async function loadMyBusinesses(userId) {
  const where = encodeURIComponent(JSON.stringify({ createdBy: String(userId) }));

  // Try a few common endpoints (first one that works will populate)
  const candidates = [
    `/api/records/Business?where=${where}&limit=200`,
    `/api/records/Business?createdBy=${encodeURIComponent(String(userId))}&limit=200`,
    `/api/records?type=Business&where=${where}&limit=200`,
  ];

  for (const path of candidates) {
    const { res, data } = await apiJSON(path, { method: "GET" }).catch(() => ({
      res: null,
      data: null,
    }));
    if (!res || !res.ok) continue;

    const items = normalizeItems(data);
    console.log("[business] loaded", path, items.length);
    renderBusinessDropdown(items);
    return items;
  }

  console.warn("[business] could not load businesses (no matching endpoint worked)");
  renderBusinessDropdown([]);
  return [];
}

function wireBusinessDropdownUI() {
  document.getElementById("business-dropdown")?.addEventListener("change", (e) => {
    const dd = e.target;
    const selectedText = dd?.options?.[dd.selectedIndex]?.textContent || "";
    const title = document.getElementById("selected-business-name");
    if (title) title.textContent = selectedText ? selectedText : "Choose business to manage";
  });
}

/////////////////////////////////////////////////
// 3) INIT (SINGLE DOMContentLoaded)
/////////////////////////////////////////////////

document.addEventListener("DOMContentLoaded", async () => {
  // --- Header auth (top of page) ---
  const auth = await initHeaderAuth();

  // --- Menu section / business UI (below) ---
  wireBusinessDropdownUI();

  // If already logged in on load, populate businesses
  if (auth.loggedIn && auth.user?._id) {
    await loadMyBusinesses(auth.user._id);
  }

  // --- Login popup wiring ---
  document.getElementById("open-login-popup-btn")?.addEventListener("click", openLoginPopup);
  document.getElementById("popup-overlay")?.addEventListener("click", closeLoginPopup);
  document.getElementById("close-login-popup-btn")?.addEventListener("click", closeLoginPopup);

  // --- Login submit ---
  const LOGIN_PATH = "/login"; // your server route
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

    // Re-check session (source of truth)
    const auth2 = await initHeaderAuth();

    // Populate businesses immediately after login
    if (auth2.loggedIn && auth2.user?._id) {
      await loadMyBusinesses(auth2.user._id);
    }

    closeLoginPopup();
    const pw = document.getElementById("login-password");
    if (pw) pw.value = "";
  });

  // --- Logout ---
  document.getElementById("logout-btn")?.addEventListener("click", async () => {
    await apiFetch("/api/logout", { method: "POST" }).catch(() => {});
    setHeaderLoggedOut();

    // clear businesses UI
    renderBusinessDropdown([]);
    const title = document.getElementById("selected-business-name");
    if (title) title.textContent = "Choose business to manage";
  });
});
