// appointment-settings.js
console.log("[Appointment-settings] web loaded");

const API_BASE = location.hostname.includes("localhost")
  ? "http://localhost:8400"
  : "https://api.suiteseat.io"; // ✅ production MUST be api.suiteseat.io for cookies

// Always call backend through this helper (cookies included)
function apiFetch(path, options = {}) {
  const url = `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;
  return fetch(url, { credentials: "include", ...options });
}

async function fetchJSON(path, options = {}) {
  const res = await apiFetch(path, {
    headers: { Accept: "application/json", ...(options.headers || {}) },
    cache: "no-store",
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

// ------------------------------
// Header auth
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

  const first = (user?.firstName || "").trim();
  const last = (user?.lastName || "").trim();
  const name = [first, last].filter(Boolean).join(" ").trim();

  if (status) status.textContent = name ? `Hey, ${name}` : "Logged in";
  if (loginBtn) loginBtn.style.display = "none";
  if (logoutBtn) logoutBtn.style.display = "inline-block";
}

// returns { loggedIn, user }
async function getAuthState() {
  const { res, data } = await fetchJSON("/api/me", { method: "GET" });

  // Your /api/me returns { ok: false, user: null } when not logged in (NOT always 401)
  const ok = res.ok && !!data?.ok && !!data?.user;
  return { loggedIn: ok, user: ok ? data.user : null, raw: data };
}

async function initHeaderAuth() {
  try {
    const state = await getAuthState();
    console.log("[auth] /api/me ->", state.raw);
    if (state.loggedIn) setHeaderLoggedIn(state.user);
    else setHeaderLoggedOut();
    return state;
  } catch (e) {
    console.error("[auth header] failed:", e);
    setHeaderLoggedOut();
    return { loggedIn: false, user: null };
  }
}

// ------------------------------
// Tabs
// ------------------------------
function initTabs() {
  const optionTabs = document.querySelectorAll(".option");
  const tabSections = document.querySelectorAll("[id$='-section']");

  optionTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      optionTabs.forEach((t) => t.classList.remove("active"));
      tabSections.forEach((section) => (section.style.display = "none"));
      tab.classList.add("active");

      const targetId = `${tab.dataset.id}-section`;
      const section = document.getElementById(targetId);
      if (section) section.style.display = "block";

      if (targetId === "booking-section") attachSaveTemplateLogic?.();
    });
  });
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
// Businesses dropdown
// ------------------------------
async function fetchMyBusinesses() {
  const { res, data } = await fetchJSON(`/api/records/Business?ts=${Date.now()}`, {
    method: "GET",
  });
  // ✅ your list endpoints should be { items: rows }
  const items = Array.isArray(data?.items) ? data.items : [];
  return { res, items, raw: data };
}

function bizLabel(biz) {
  const v = biz?.values || biz || {};
  return v.businessName || v.Name || v.name || "(Untitled)";
}

function setSelectedBusinessNameFromSelect() {
  const dropdown = document.getElementById("business-dropdown");
  const header = document.getElementById("selected-business-name");
  if (!dropdown || !header) return;

  const opt = dropdown.options[dropdown.selectedIndex];
  header.textContent = opt?.value ? opt.textContent : "Choose business to manage";
}

async function loadBusinessDropdown({ preserve = true } = {}) {
  const dropdown = document.getElementById("business-dropdown");
  const header = document.getElementById("selected-business-name");
  if (!dropdown) return;

  dropdown.disabled = true;
  dropdown.innerHTML = `<option value="">Loading…</option>`;
  if (header) header.textContent = "Choose business to manage";

  // must be logged in
  const auth = await getAuthState();
  if (!auth.loggedIn) {
    dropdown.innerHTML = `<option value="">-- Please log in --</option>`;
    dropdown.disabled = true;
    if (header) header.textContent = "Not logged in";
    return;
  }

  // fetch businesses
  const { res, items, raw } = await fetchMyBusinesses();
  console.log("[biz] /api/records/Business ->", raw);

  if (!res.ok) {
    dropdown.innerHTML = `<option value="">-- Could not load businesses --</option>`;
    dropdown.disabled = false;
    return;
  }

  const visible = items.filter((b) => !b?.deletedAt);

  dropdown.innerHTML = `<option value="">-- Choose Business --</option>`;
  for (const biz of visible) {
    const opt = document.createElement("option");
    opt.value = biz?._id || "";
    opt.textContent = bizLabel(biz);
    dropdown.appendChild(opt);
  }

  if (preserve) {
    const saved = sessionStorage.getItem("selectedBusinessId");
    if (saved && dropdown.querySelector(`option[value="${saved}"]`)) {
      dropdown.value = saved;
    }
  }

  setSelectedBusinessNameFromSelect();
  dropdown.disabled = false;

  if (!dropdown.dataset.bound) {
    dropdown.addEventListener("change", () => {
      sessionStorage.setItem("selectedBusinessId", dropdown.value || "");
      setSelectedBusinessNameFromSelect();
      // later: trigger calendar/category/service loads here
    });
    dropdown.dataset.bound = "1";
  }
}

// ------------------------------
// Auth actions
// ------------------------------
async function doLogin(email, password) {
  const { res, data } = await fetchJSON("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  return { res, data };
}

async function doLogout() {
  // you have multiple logout routes in server; this is the one you showed:
  await apiFetch("/api/logout", { method: "POST" }).catch(() => {});
}

// ------------------------------
// Init (ONE DOMContentLoaded)
// ------------------------------
document.addEventListener("DOMContentLoaded", async () => {
  initTabs();

  // popup open/close
  document.getElementById("open-login-popup-btn")?.addEventListener("click", openLoginPopup);
  document.getElementById("popup-overlay")?.addEventListener("click", closeLoginPopup);
  document.getElementById("close-login-popup-btn")?.addEventListener("click", closeLoginPopup);

  // login submit (ONE handler)
  document.getElementById("login-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = document.getElementById("login-email")?.value?.trim();
    const password = document.getElementById("login-password")?.value;

    if (!email || !password) return alert("Please enter email and password.");

    const { res, data } = await doLogin(email, password);

    if (!res.ok) {
      alert(data?.message || data?.error || "Login failed");
      return;
    }

    // ✅ refresh header & dropdown after login
    await initHeaderAuth();
    closeLoginPopup();
    const pw = document.getElementById("login-password");
    if (pw) pw.value = "";
    await loadBusinessDropdown({ preserve: true });
  });

  // logout
  document.getElementById("logout-btn")?.addEventListener("click", async () => {
    await doLogout();
    setHeaderLoggedOut();
    sessionStorage.removeItem("selectedBusinessId");
    location.reload();
  });

  // initial boot
  const state = await initHeaderAuth();
  if (state.loggedIn) {
    await loadBusinessDropdown({ preserve: true });
  } else {
    // show dropdown logged-out state
    await loadBusinessDropdown({ preserve: true }).catch(() => {});
  }
});
