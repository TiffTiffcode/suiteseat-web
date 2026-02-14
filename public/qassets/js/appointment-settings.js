console.log("[Appointment-settings] web loaded");

const API_BASE =
  location.hostname.includes("localhost")
    ? "http://localhost:8400"
    : "https://api.suiteseat.io";

// ✅ Your server routes
const ME_PATH = "/api/me";
const LOGIN_PATH = "/api/login";
const LOGOUT_PATH = "/api/logout";

// Always call backend through this helper
function apiFetch(path, options = {}) {
  const url = `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;
  return fetch(url, {
    credentials: "include",
    ...options,
  });
}

// ------------------------------
// Header auth
// ------------------------------
async function fetchMe() {
  const res = await apiFetch(ME_PATH, {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

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

async function initHeaderAuth() {
  try {
    const { res, data } = await fetchMe();

    // Logged out is normal; don’t treat as a hard error
    if (!res.ok || !(data?.ok || data?.loggedIn)) {
      setHeaderLoggedOut();
      return { ok: false, user: null };
    }

    if (data?.user) setHeaderLoggedIn(data.user);
    else setHeaderLoggedOut();

    return { ok: true, user: data.user || null };
  } catch (e) {
    console.error("[auth header] failed:", e);
    setHeaderLoggedOut();
    return { ok: false, user: null };
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
// Login popup helpers
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
  const res = await apiFetch(`/api/records/Business?ts=${Date.now()}`, {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  const data = await res.json().catch(() => ({}));
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

  // confirm auth
  const { ok } = await initHeaderAuth();
  if (!ok) {
    dropdown.innerHTML = `<option value="">-- Please log in --</option>`;
    dropdown.disabled = true;
    if (header) header.textContent = "Not logged in";
    return;
  }

  // fetch businesses
  const { res, items } = await fetchMyBusinesses();
  if (!res.ok) {
    dropdown.innerHTML = `<option value="">-- Could not load businesses --</option>`;
    dropdown.disabled = false;
    return;
  }

  const visible = items.filter((b) => !b?.deletedAt);

  dropdown.innerHTML = `<option value="">-- Choose Business --</option>`;

  for (const biz of visible) {
    const opt = document.createElement("option");
    opt.value = biz._id;
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
    });
    dropdown.dataset.bound = "1";
  }
}

// ------------------------------
// Init
// ------------------------------
document.addEventListener("DOMContentLoaded", () => {
  initTabs();

  // Popup buttons
  document.getElementById("open-login-popup-btn")?.addEventListener("click", openLoginPopup);
  document.getElementById("popup-overlay")?.addEventListener("click", closeLoginPopup);
  document.getElementById("close-login-popup-btn")?.addEventListener("click", closeLoginPopup);

  // Login submit (single handler)
  document.getElementById("login-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = document.getElementById("login-email")?.value?.trim();
    const password = document.getElementById("login-password")?.value;

    if (!email || !password) return alert("Please enter email and password.");

    const res = await apiFetch(LOGIN_PATH, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const out = await res.json().catch(() => ({}));
    if (!res.ok) return alert(out?.message || out?.error || "Login failed");

    closeLoginPopup();
    const pw = document.getElementById("login-password");
    if (pw) pw.value = "";

    // refresh header + businesses now that session exists
    await initHeaderAuth();
    await loadBusinessDropdown({ preserve: true });
  });

  // Logout
  document.getElementById("logout-btn")?.addEventListener("click", async () => {
    try {
      await apiFetch(LOGOUT_PATH, { method: "POST" });
    } catch {}
    setHeaderLoggedOut();
    sessionStorage.removeItem("selectedBusinessId");
    location.reload();
  });

  // Initial load (shows "Please log in" until logged in)
  loadBusinessDropdown({ preserve: true }).catch(console.error);
});
