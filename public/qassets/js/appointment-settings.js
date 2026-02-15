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

function getBusinessName(row) {
  const v = row?.values || row || {};
  return (
    (typeof v["Business Name"] === "string" && v["Business Name"].trim()) ||
    (typeof v["Name"] === "string" && v["Name"].trim()) ||
    (typeof v.businessName === "string" && v.businessName.trim()) ||
    (typeof v.title === "string" && v.title.trim()) ||
    "(Untitled)"
  );
}

// Render dropdown
// Render dropdown + log what got rendered
function renderBusinessDropdown(items) {
  const dd = document.getElementById("business-dropdown");
  if (!dd) return;

  dd.innerHTML = `<option value="">-- Choose Business --</option>`;

  const rendered = [];

  items.forEach((row) => {
    const v = row?.values || row || {};
    const id = String(row?._id || row?.id || v?._id || "");
    if (!id) return;

    const name = getBusinessName(row);

    const opt = document.createElement("option");
    opt.value = id;
    opt.textContent = name;
    dd.appendChild(opt);

    rendered.push({ id, name });
  });

  // ✅ log what’s actually in the dropdown now
  console.log("[dropdown] options rendered:", rendered);
  console.log("[dropdown] business names:", rendered.map((x) => x.name));
}

async function loadMyBusinesses(userId) {
  const where = encodeURIComponent(JSON.stringify({ createdBy: String(userId) }));

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
    if (!res) continue;

    // ✅ log the raw response (this is “what comes back”)
    console.log("[business] RAW response from", path, "status:", res.status, data);

    if (!res.ok) continue;

    const items = normalizeItems(data);

    // ✅ log business names current user has (from the API payload)
    console.log("[business] items count:", items.length);
    console.log("[business] names:", items.map(getBusinessName));

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

      initBusinessSave();
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






/////////////////////////////////////////////////
//Business Section 
/////////////////////////////////////////////////
//Open Add Business Popup when Add Business button is pressed 
function openAddBusinessPopup() {
  const popup = document.getElementById("popup-add-business");
  const overlay = document.getElementById("popup-overlay");

  if (popup) popup.style.display = "block";
  if (overlay) overlay.style.display = "block";
}

function closeAddBusinessPopup() {
  const popup = document.getElementById("popup-add-business");
  const overlay = document.getElementById("popup-overlay");

  if (popup) popup.style.display = "none";
  if (overlay) overlay.style.display = "none";
}

document.addEventListener("DOMContentLoaded", () => {
  // open
  document
    .getElementById("open-business-popup-button")
    ?.addEventListener("click", openAddBusinessPopup);

  // close via X
  document
    .getElementById("close-add-business-popup-btn")
    ?.addEventListener("click", closeAddBusinessPopup);

  // optional: close by clicking overlay
  document
    .getElementById("popup-overlay")
    ?.addEventListener("click", closeAddBusinessPopup);

  // optional: close with ESC
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeAddBusinessPopup();
  });
});

// ------------------------------
// Slug helpers
// ------------------------------
function getFileFromInput(id) {
  const el = document.getElementById(id);
  return el?.files?.[0] || null;
}

// If you DON'T have a server slug generator yet, use this.
// (Collision risk if two businesses have same name.)
function slugify(str = "") {
  return String(str)
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

// If you already have a server slug route, use it. (Best)
// POST /api/slug/Business  { base, excludeId? } -> { slug }
async function generateBusinessSlug(name, excludeId = null) {
  const base = slugify(name);
  const { res, data } = await apiJSON(`/api/slug/${encodeURIComponent("Business")}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ base, excludeId }),
  });

  if (!res.ok) {
    console.warn("[slug] fallback to base slug (slug route failed)", res.status, data);
    return base;
  }
  return data?.slug || base;
}


////////////////
//Save Business
/////////////////////
// Upload image -> returns Cloudinary URL (or "" if none)
async function uploadHeroImageIfAny() {
  const file = getFileFromInput("image-upload");
  if (!file) return "";

  const fd = new FormData();
  fd.append("file", file);

  const url = `${API_BASE}/api/upload`;
  const res = await fetch(url, { method: "POST", body: fd, credentials: "include" });
  const data = await res.json().catch(() => ({}));

  console.log("[upload] /api/upload", res.status, data);

  if (!res.ok) throw new Error(data?.error || "Upload failed");
  return String(data?.url || "");
}

// Save business record via generic records route
async function createBusinessRecord({ userId, heroUrl }) {
  const businessName = document.getElementById("popup-business-name-input")?.value?.trim();
  const proName = document.getElementById("popup-your-name-input")?.value?.trim();
  const phoneNumber = document.getElementById("popup-business-phone-number-input")?.value?.trim();
  const locationName = document.getElementById("popup-business-location-name-input")?.value?.trim();
  const locationAddress = document.getElementById("popup-business-address-input")?.value?.trim();
  const email = document.getElementById("popup-business-email-input")?.value?.trim();

  if (!businessName) throw new Error("Business name is required.");
  if (!proName) throw new Error("Your name is required.");

  const slug = slugify(businessName);

  // 👇 IMPORTANT: match your Field names EXACTLY as they exist in your DataType editor
  // From your list:
  // Name, Pro Name, Phone Number, Location Name, Location Address, Email, Hero Image, slug, Pro, Created By
  const values = {
    "Name": businessName,
    "Pro Name": proName,
    "Phone Number": phoneNumber || "",
    "Location Name": locationName || "",
    "Location Address": locationAddress || "",
    "Email": email || "",
    "Hero Image": heroUrl || "",
    "slug": slug,

    // Reference fields:
    // Your system matches ref fields in many shapes. These are safe:
    "Pro": userId,
    "Created By": userId,
  };

  const { res, data } = await apiJSON("/api/records/Business", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ values }),
  });

  console.log("[business] POST /api/records/Business", res.status, data);

  if (!res.ok) throw new Error("Failed to save business");

  const created = Array.isArray(data?.items) ? data.items[0] : null;
  if (!created?._id) throw new Error("Business saved but missing _id.");

  return created;
}

// Wire the Save button (form submit)
function initBusinessSave() {
  const form = document.getElementById("popup-add-business-form");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    try {
      // 1) make sure logged in (session)
      const auth = await initHeaderAuth();
      const userId = auth?.user?._id || auth?.user?.id;

      if (!auth.loggedIn || !userId) {
        alert("Please log in first.");
        return;
      }

      // 2) upload image (optional)
      const heroUrl = await uploadHeroImageIfAny();

      // 3) create record
      const created = await createBusinessRecord({ userId, heroUrl });

      alert("Business saved!");

      // 4) close popup + refresh dropdown
      closeAddBusinessPopup();
      await loadMyBusinesses(userId);

      // auto-select the new business
      const dd = document.getElementById("business-dropdown");
      if (dd) {
        dd.value = String(created._id);
        dd.dispatchEvent(new Event("change"));
      }
    } catch (err) {
      console.error("[business] save failed", err);
      alert(err?.message || "Business save failed");
    }
  });
}