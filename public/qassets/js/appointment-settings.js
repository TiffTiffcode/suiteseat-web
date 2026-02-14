console.log("[Appointment-settings] web loaded");

const API_BASE =
  location.hostname.includes("localhost")
    ? "http://localhost:8400"
    : "https://api.suiteseat.io";


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
// --------- API helpers ----------
async function fetchMe() {
  const res = await apiFetch("/api/me", {
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
    const data = await fetchMe();
    const ok = !!data?.ok || !!data?.loggedIn;

    if (ok && data?.user) setHeaderLoggedIn(data.user);
    else setHeaderLoggedOut();
  } catch (e) {
    console.error("[auth header] failed:", e);
    setHeaderLoggedOut();
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
// Login popup helpers (ONE version only)
// ------------------------------
function openLoginPopup() {
  document.getElementById("login-popup")?.style.setProperty("display", "block");
  document.getElementById("popup-overlay")?.style.setProperty("display", "block");
}

function closeLoginPopup() {
  document.getElementById("login-popup")?.style.setProperty("display", "none");
  document.getElementById("popup-overlay")?.style.setProperty("display", "none");
}

  // Open login popup
  document.getElementById("open-login-popup-btn")?.addEventListener("click", openLoginPopup);

  // Close popup
  document.getElementById("popup-overlay")?.addEventListener("click", closeLoginPopup);
  document.getElementById("close-login-popup-btn")?.addEventListener("click", closeLoginPopup);

  // Login submit (ONE handler only)
  document.getElementById("login-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = document.getElementById("login-email")?.value?.trim();
    const password = document.getElementById("login-password")?.value;

    if (!email || !password) return alert("Please enter email and password.");

    const res = await apiFetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const out = await res.json().catch(() => ({}));
    if (!res.ok) return alert(out?.error || out?.message || "Login failed");

    await initHeaderAuth();
    closeLoginPopup();
    document.getElementById("login-password").value = "";
  });

  // Logout
  document.getElementById("logout-btn")?.addEventListener("click", async () => {
    try {
      await apiFetch("/api/logout", { method: "POST" });
    } catch {}
    setHeaderLoggedOut();
    location.reload();
  });


  ////////////////////////////////////////////////////////////
                     //Menu Section
  ////////////////////////////////////////////////////////////
  
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
  return (
    v.businessName ||
    v.Name ||
    v.name ||
    "(Untitled)"
  );
}

// --------- UI ----------
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

  // 1) confirm auth (optional but helpful)
  const { res: meRes, data: me } = await fetchMe();
  if (!meRes.ok || !(me?.ok || me?.loggedIn)) {
    dropdown.innerHTML = `<option value="">-- Please log in --</option>`;
    dropdown.disabled = true;
    if (header) header.textContent = "Not logged in";
    return;
  }

  // 2) fetch businesses
  const { res, items } = await fetchMyBusinesses();
  if (!res.ok) {
    dropdown.innerHTML = `<option value="">-- Could not load businesses --</option>`;
    dropdown.disabled = false;
    return;
  }

  // (optional) remove soft-deleted
  const visible = items.filter((b) => !b?.deletedAt);

  dropdown.innerHTML = `<option value="">-- Choose Business --</option>`;

  for (const biz of visible) {
    const opt = document.createElement("option");
    opt.value = biz._id;
    opt.textContent = bizLabel(biz);
    dropdown.appendChild(opt);
  }

  // restore selection
  if (preserve) {
    const saved = sessionStorage.getItem("selectedBusinessId");
    if (saved && dropdown.querySelector(`option[value="${saved}"]`)) {
      dropdown.value = saved;
    }
  }

  setSelectedBusinessNameFromSelect();
  dropdown.disabled = false;

  // bind change once
  if (!dropdown.dataset.bound) {
    dropdown.addEventListener("change", () => {
      sessionStorage.setItem("selectedBusinessId", dropdown.value || "");
      setSelectedBusinessNameFromSelect();
      // later: trigger calendar/category/service loads here
    });
    dropdown.dataset.bound = "1";
  }
}

// --------- init ----------
document.addEventListener("DOMContentLoaded", () => {
  loadBusinessDropdown({ preserve: true }).catch((e) => {
    console.error("[business-dropdown] init error:", e);
  });
});
