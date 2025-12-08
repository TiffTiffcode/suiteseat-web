 //* linkpage-settings.js  

// Use API server in dev, same-origin in prod
const API_ORIGIN =
  location.hostname === "localhost" ? "http://localhost:8400" : "";

// Build full URL for API
function apiUrl(path) {
  const base = path.startsWith("/api") ? path : `/api${path.startsWith("/") ? path : `/${path}`}`;
  return `${API_ORIGIN}${base}`;
}

// Low-level fetch wrapper
async function apiFetch(path, opts = {}) {
  return fetch(apiUrl(path), {
    credentials: "include", // send cookie
    headers: { Accept: "application/json", ...(opts.headers || {}) },
    ...opts,
  });
}

// JSON helper
window.fetchJSON = async function fetchJSON(path, opts = {}) {
  const res  = await apiFetch(path, {
    headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
    ...opts,
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { error: text }; }
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
};

/* ============== GLOBAL STATE ============== */

window.STATE = window.STATE || {
  user: { loggedIn: false, userId: null, email: "", firstName: "" },
};

/* ============== AUTH MODULE ============== */
(function authModule () {
  const loginBtn  = document.getElementById('open-login-popup-btn');
  const logoutBtn = document.getElementById('logout-btn');
  const statusEl  = document.getElementById('login-status-text');

  const modal   = document.getElementById('authModal');
  const form    = document.getElementById('authForm');
  const emailEl = document.getElementById('authEmail');
  const passEl  = document.getElementById('authPass');
  const errEl   = document.getElementById('authError');
  const closeX  = document.getElementById('authClose');
  const submit  = document.getElementById('authSubmit');
  const idleTxt = submit?.querySelector('.when-idle');
  const busyTxt = submit?.querySelector('.when-busy');

  function setBusy(on) {
    if (!submit) return;
    submit.disabled = !!on;
    if (idleTxt) idleTxt.hidden = !!on;
    if (busyTxt) busyTxt.hidden = !on;
  }

  function openAuth () {
    if (!modal) return;
    modal.hidden = false;
    modal.setAttribute('aria-hidden', 'false');
    emailEl?.focus();
  }

  function closeAuth () {
    if (!modal) return;
    modal.hidden = true;
    modal.setAttribute('aria-hidden', 'true');
  }

  function setAuthUI () {
    const u = window.STATE?.user || {};
    if (u.loggedIn) {
      statusEl && (statusEl.textContent = u.firstName
        ? `Hi, ${u.firstName}`
        : (u.email || 'Signed in'));
      loginBtn && (loginBtn.style.display = 'none');
      logoutBtn && (logoutBtn.style.display = '');
    } else {
      statusEl && (statusEl.textContent = 'Not signed in');
      loginBtn && (loginBtn.style.display = '');
      logoutBtn && (logoutBtn.style.display = 'none');
    }
  }

  async function hydrateUser () {
    try {
      const res  = await apiFetch('/api/me', { headers: { Accept: 'application/json' } });
      const text = await res.text();
      let data; try { data = JSON.parse(text); } catch { data = {}; }

      const user = data?.user || data?.data?.user || (data?.ok && data?.session?.user) || null;
      console.log('[auth] /api/me payload:', data);

      if (user && (user._id || user.id)) {
        window.STATE.user = {
          loggedIn: true,
          userId:   user._id || user.id,
          email:    user.email || '',
          firstName: user.firstName || user.name || '',
        };
      } else {
        window.STATE.user = { loggedIn: false, userId: null, email: '', firstName: '' };
      }
    } catch (e) {
      console.warn('[auth] hydrateUser failed:', e);
      window.STATE.user = { loggedIn: false, userId: null, email: '', firstName: '' };
    }
    console.log('[auth] STATE.user ->', window.STATE.user);
    setAuthUI();
  }

  // Guard to require a logged-in user before privileged actions
  async function requireUser () {
    await hydrateUser();
    if (!window.STATE.user.loggedIn) {
      openAuth();
      throw new Error('Login required');
    }
    return window.STATE.user.userId;
  }
  window.requireUser = requireUser;

  // Events
  loginBtn && loginBtn.addEventListener('click', openAuth);
  closeX   && closeX.addEventListener('click', closeAuth);
  modal    && modal.addEventListener('click', (e) => {
    if (e.target === modal) closeAuth();
  });

  logoutBtn && logoutBtn.addEventListener('click', async () => {
    try { await window.fetchJSON('/api/logout', { method: 'POST' }); } catch {}
    window.STATE.user = { loggedIn: false, userId: null, email: '', firstName: '' };
    setAuthUI();
  });

  form && form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errEl && (errEl.textContent = '');
    setBusy(true);
    try {
      const r = await apiFetch('/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          email:    emailEl.value.trim(),
          password: passEl.value,
        }),
      });

      const t = await r.text();
      let d; try { d = JSON.parse(t); } catch { d = { error: t }; }
      if (!r.ok || d.error) throw new Error(d.error || `HTTP ${r.status}`);

      await hydrateUser();
      closeAuth();
    } catch (err) {
      console.error('[auth] login failed:', err);
      errEl && (errEl.textContent = err.message || 'Login failed');
    } finally {
      setBusy(false);
    }
  });

  // Initial session check → announce ready
  hydrateUser()
    .catch(() => {})
    .finally(() => {
      document.dispatchEvent(new Event('auth:ready'));
    });
})();





                        ////////////////////////////////////////////////////////////////////
                                                             //sidebar
                          ////////////////////////////////////////////////////////////////////


(() => {
  const app      = document.getElementById("app");
  const nav      = document.getElementById("nav");
  const sections = Array.from(document.querySelectorAll(".section"));
  const greeting = document.getElementById("lp-user-greeting");

  // 🔹 Collapse / expand sidebar
  document.getElementById("collapseBtn")?.addEventListener("click", () => {
    app?.classList.toggle("collapsed");
  });

  // 🔹 Click nav → switch visible section
  nav?.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-target]");
    if (!btn) return;

    const targetId = btn.dataset.target;

    // highlight active button
    nav.querySelectorAll("button").forEach((b) =>
      b.classList.remove("active")
    );
    btn.classList.add("active");

    // show matching section, hide others
    sections.forEach((sec) => {
      sec.classList.toggle("active", sec.id === targetId);
    });
  });

  // 🔹 Keyboard up/down navigation (optional)
  nav?.addEventListener("keydown", (e) => {
    const buttons = Array.from(nav.querySelectorAll("button"));
    const i = buttons.findIndex((b) => b.classList.contains("active"));
    if (i < 0) return;

    if (e.key === "ArrowDown") {
      const next = buttons[(i + 1) % buttons.length];
      next.focus();
      next.click();
      e.preventDefault();
    } else if (e.key === "ArrowUp") {
      const prev = buttons[(i - 1 + buttons.length) % buttons.length];
      prev.focus();
      prev.click();
      e.preventDefault();
    }
  });

  // 🔹 Update topbar greeting when auth is ready
  document.addEventListener("auth:ready", () => {
    const u = window.STATE?.user || {};
    if (greeting) {
      if (u.loggedIn && (u.firstName || u.email)) {
        greeting.textContent = u.firstName
          ? `Hi, ${u.firstName}`
          : `Hi, ${u.email}`;
      } else {
        greeting.textContent = "Hi there";
      }
    }
  });
})();





                        ////////////////////////////////////////////////////////////////////
                                                             //Dashboard Section
                          ////////////////////////////////////////////////////////////////////

const lpTotalLinksEl    = document.getElementById("lp-total-links");
const lpTotalProductsEl = document.getElementById("lp-total-products");
const lpTotalOrdersEl   = document.getElementById("lp-total-orders");


function setDashboardTotals({ links = 0, products = 0, orders = 0 } = {}) {
  if (lpTotalLinksEl)    lpTotalLinksEl.textContent    = String(links);
  if (lpTotalProductsEl) lpTotalProductsEl.textContent = String(products);
  if (lpTotalOrdersEl)   lpTotalOrdersEl.textContent   = String(orders);
}

// Generic: count records for THIS user, by DataType
async function countRecordsForUser(dataType, extraParams = {}) {
  const uid =
    window.STATE?.user?.userId ||
    window.STATE?.userId ||
    window.STATE?.user?.id ||
    "";

  if (!uid) return 0;

  const params = new URLSearchParams();
  params.set("dataType", dataType);
  params.set("limit", "500");
  params.set("Created By", uid);

  // allow adding extra filters in the future
  Object.entries(extraParams).forEach(([key, value]) => {
    if (value != null && value !== "") params.set(key, String(value));
  });

  const res = await fetch(`${API_ORIGIN}/public/records?${params.toString()}`, {
    credentials: "include",
    headers: { Accept: "application/json" },
  });

  if (!res.ok) {
    console.warn("[dashboard] countRecordsForUser HTTP", res.status, dataType);
    return 0;
  }

  const data = await res.json();
  const rows = Array.isArray(data) ? data : data.records || data.items || [];
  return rows.length;
}

// Main: refresh all three dashboard numbers
async function refreshDashboardTotals() {
  // if user not ready yet, just clear
  const uid =
    window.STATE?.user?.userId ||
    window.STATE?.userId ||
    window.STATE?.user?.id ||
    "";
  if (!uid) {
    setDashboardTotals({ links: 0, products: 0, orders: 0 });
    return;
  }

  try {
    const [linksCount, productsCount, ordersCount] = await Promise.all([
      // ⚠️ adjust DataType names if needed
      countRecordsForUser("Link"),     // all Links by this user
      countRecordsForUser("Product"),  // all Products by this user
      countRecordsForUser("Order"),    // all Orders by this user
    ]);

    setDashboardTotals({
      links:    linksCount,
      products: productsCount,
      orders:   ordersCount,
    });
  } catch (err) {
    console.error("[dashboard] refreshDashboardTotals error:", err);
    setDashboardTotals({ links: 0, products: 0, orders: 0 });
  }
}

//Open sections when buttons are pressed 
document.addEventListener("DOMContentLoaded", () => {
  const nav = document.getElementById("nav");
  const sections = document.querySelectorAll(".section");
  const navButtons = nav ? nav.querySelectorAll("button[data-target]") : [];

  if (!nav) return;

  function showSection(targetId) {
    // Sidebar buttons
    navButtons.forEach((b) => {
      const btnTarget = b.getAttribute("data-target");
      b.classList.toggle("active", btnTarget === targetId);
    });

    // Sections
    sections.forEach((sec) => {
      sec.classList.toggle("active", sec.id === targetId);
    });
  }

  // Sidebar buttons → switch sections
  nav.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-target]");
    if (!btn) return;

    const targetId = btn.getAttribute("data-target");
    if (!targetId) return;

    showSection(targetId);
  });

  // 🔹 Dashboard cards → switch sections
  document
    .querySelectorAll(".dashboard-card")
    .forEach((card) => {
      card.addEventListener("click", () => {
        const targetId = card.getAttribute("data-target");
        if (targetId) showSection(targetId);
      });
    });
});













////////////////////////////////////////////////////////////////////
// Linkpage: "Add new link page" editor
////////////////////////////////////////////////////////////////////

document.addEventListener("DOMContentLoaded", () => {
  const addBtn     = document.getElementById("lp-add-linkpage-btn");
  const editor     = document.getElementById("lp-linkpage-editor");
  const nameInput  = document.getElementById("lp-linkpage-name");
  const slugInput  = document.getElementById("lp-linkpage-slug");
  const previewEl  = document.getElementById("lp-linkpage-url-preview");
  const cancelBtn  = document.getElementById("lp-linkpage-cancel");
  const saveBtn    = document.getElementById("lp-linkpage-save");

 
  // The base URL we're showing to the user
  const BASE_URL = "https://suiteseat.io/";

  // Turn "My Link Page!!" → "my-link-page"
  function sanitizeSlug(raw) {
    return (raw || "")
      .toLowerCase()
      .trim()
      .replace(/\s+/g, "-")        // spaces → dashes
      .replace(/[^a-z0-9\-]/g, "") // only letters, numbers, dashes
      .replace(/\-+/g, "-");       // collapse multiple dashes
  }

  function updatePreview() {
    if (!slugInput || !previewEl) return;
    const clean = sanitizeSlug(slugInput.value);
    slugInput.value = clean;
    previewEl.textContent = BASE_URL + clean;
  }

  // 🔹 Open editor when button is clicked
  if (addBtn && editor) {
    addBtn.addEventListener("click", async () => {
      try {
        // make sure user is logged in
        await window.requireUser();
      } catch {
        // requireUser already opened the login modal
        return;
      }

      editor.style.display = "block";
      if (nameInput) nameInput.value = "";
      if (slugInput) slugInput.value = "";
      if (previewEl) previewEl.textContent = BASE_URL;

      nameInput?.focus();
    });
  }

  // 🔹 Auto-generate slug from name if slug is empty
  nameInput?.addEventListener("blur", () => {
    if (!slugInput) return;
    if (slugInput.value.trim()) return; // user already typed something

    const fromName = sanitizeSlug(nameInput.value);
    slugInput.value = fromName;
    updatePreview();
  });

  // 🔹 Keep preview in sync as they type slug
  slugInput?.addEventListener("input", updatePreview);

  // 🔹 Cancel → hide editor
  cancelBtn?.addEventListener("click", () => {
    if (editor) editor.style.display = "none";
  });

// 🔹 Save → REAL save to "Link Page" DataType
saveBtn?.addEventListener("click", async () => {
  if (!nameInput || !slugInput) return;

  const nameRaw = nameInput.value.trim();
  let slug      = sanitizeSlug(slugInput.value);

  if (!nameRaw) {
    alert("Please enter a link page name.");
    nameInput.focus();
    return;
  }

  // if slug empty, default from name
  if (!slug) {
    slug = sanitizeSlug(nameRaw);
    slugInput.value = slug;
    if (typeof updatePreview === "function") {
      updatePreview();
    }
  }

  if (!slug) {
    alert("Please enter a URL ending.");
    slugInput.focus();
    return;
  }

  // 👤 Make sure user is logged in + get their id
  let uid;
  try {
    uid = await window.requireUser();
  } catch (err) {
    // requireUser already opened login modal if needed
    console.warn("[linkpage] requireUser failed:", err);
    return;
  }

  // 🧱 Build values object that matches your "Link Page" fields
  const values = {
    "Page Name": nameRaw,   // Text field
     slug,              // Text field

    // Optional starter defaults
    "Page Background Color": "#ffffff",
    "Link Background Color": "#ffffff",
    "Link Text Color": "#000000",
    "Link Button Color": "#000000",
    "Link Button Text Color": "#ffffff",
    "Link Border Color": "#000000",

    "Created By": { _id: uid },
    "Deleted At": null,
    // "Link(s)" will be attached later
  };

  console.log("[linkpage] creating Link Page with values:", values);

  try {
    const saved = await window.fetchJSON("/api/records/Link Page", {
      method: "POST",
      body: JSON.stringify({ values }),
    });

    console.log("[linkpage] saved Link Page:", saved);

    alert(`Link page created:\nhttps://suiteseat.io/${slug}`);

    // 🔁 Refresh dropdown and auto-select the new page
    if (typeof hydrateLinkpageDropdown === "function") {
      const newId = saved._id || saved.id;
      await hydrateLinkpageDropdown(newId);
    }

    // Hide editor after save
    if (editor) editor.style.display = "none";
  } catch (err) {
    console.error("[linkpage] failed to save Link Page:", err);
    alert("Could not save link page: " + (err.message || err));
  }
});

// ======================= LINK PAGE LISTING =======================

// 1. Fetch all "Link Page" records created by the current user
async function listLinkPagesForCurrentUser() {
  const uid = window.STATE?.user?.userId;
  if (!uid) return [];

  const params = new URLSearchParams();
  params.set("dataType", "Link Page");   // DataType name
  params.set("limit", "200");
  params.set("Created By", uid);         // Reference → User

  const res = await fetch(
    `${API_ORIGIN}/public/records?${params.toString()}`,
    {
      credentials: "include",
      headers: { Accept: "application/json" },
    }
  );

  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const data = await res.json();
  const rows = Array.isArray(data)
    ? data
    : data.records || data.items || [];

  // 🔹 Cache the full Link Page records by id
  window.__LINKPAGE_CACHE = window.__LINKPAGE_CACHE || {};
  const cache = window.__LINKPAGE_CACHE;
  rows.forEach((row) => {
    const id = row._id || row.id;
    if (id) cache[id] = row;
  });

  // normalize for dropdown
  return rows.map((row) => {
    const v = row.values || row;

    const rawName =
      v["Page Name"] ||
      v["Link Page Name"] ||
      v.Name ||
      "";

    const name = (rawName || "").toString().trim() || "(Untitled link page)";
    const slug = (v.slug || v["Slug"] || "").toString().trim();

    return {
      id: row._id || row.id || "",
      name,
      slug,
    };
  });
}


// 2. Populate <select id="linkpage-select">
// 2. Populate <select id="linkpage-select"> AND <select id="shop-linkpage-select">
async function hydrateLinkpageDropdown(selectedId) {
  const mainSelect = document.getElementById("linkpage-select");
  const shopSelect = document.getElementById("shop-linkpage-select");

  // If neither select exists, nothing to do
  if (!mainSelect && !shopSelect) return;

  const selects = [mainSelect, shopSelect].filter(Boolean);

  // Show "loading" in all selects
  selects.forEach((sel) => {
    sel.innerHTML = `<option value="">Loading your link pages…</option>`;
  });

  try {
    // make sure auth is hydrated
    await window.requireUser().catch(() => null);

    const pages = await listLinkPagesForCurrentUser();

    if (!pages.length) {
      selects.forEach((sel) => {
        sel.innerHTML = `<option value="">No link pages yet</option>`;
      });
      return;
    }

    selects.forEach((sel) => {
      sel.innerHTML = `<option value="">Select a link page…</option>`;

      pages.forEach((p) => {
        const opt = document.createElement("option");
        opt.value = p.id;
        opt.textContent = p.slug
          ? `${p.name} — /${p.slug}`
          : p.name;

        // Only auto-select on the main Links dropdown
        if (sel === mainSelect && selectedId && selectedId === p.id) {
          opt.selected = true;
        }

        sel.appendChild(opt);
      });
    });
  } catch (err) {
    console.error("[linkpage] hydrateLinkpageDropdown failed:", err);
    selects.forEach((sel) => {
      sel.innerHTML = `<option value="">Couldn’t load link pages</option>`;
    });
  }
}


///////Link list 
const addLinkBtn     = document.getElementById("links-add-link-btn");
const previewBtn     = document.getElementById("links-preview-btn");
const linkpageSelect = document.getElementById("linkpage-select");
const linksListEl      = document.getElementById("links-list");
const linksEmptyState  = document.getElementById("links-empty-state");

// The whole right-hand editor (phone + instructions)
const linksPanel = document.getElementById("links-editor-panel");

// Hide the right side until a link page is selected
function updateEditorVisibility() {
  if (!linksPanel || !linkpageSelect) return;
  const hasPageSelected = !!linkpageSelect.value;
  linksPanel.style.display = hasPageSelected ? "" : "none";
}


// Hide/show the "No links yet" message
function updateLinksEmptyState() {
  if (!linksEmptyState || !linksListEl) return;
  const hasCards = !!linksListEl.querySelector(".link-card-row");
  linksEmptyState.style.display = hasCards ? "none" : "";
}

// 🔸 Upload a single image file → returns "/uploads/..."
async function uploadLinkImage(file) {
  const fd = new FormData();
  fd.append("file", file); // /api/upload expects "file"

  const res = await fetch("/api/upload", {
    method: "POST",
    credentials: "include",
    body: fd,
  });

  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const err = await res.json();
      if (err?.error) msg += ` – ${err.error}`;
    } catch (_) {}
    throw new Error("Image upload failed: " + msg);
  }

  const data = await res.json(); // { url: "/uploads/..." }
  return data.url;
}

// 🔸 NEW: upload generic file(s) for Result Files
async function uploadLinkFile(file) {
  const fd = new FormData();
  fd.append("file", file); // same /api/upload route

  const res = await fetch("/api/upload", {
    method: "POST",
    credentials: "include",
    body: fd,
  });

  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const err = await res.json();
      if (err?.error) msg += ` – ${err.error}`;
    } catch (_) {}
    throw new Error("File upload failed: " + msg);
  }

  const data = await res.json(); // { url: "/uploads/...", name?: string }
  return {
    url: data.url || data.path || "",
    name: data.name || file.name,
  };
}
// 🔸 mark a Link as deleted (soft delete)
async function softDeleteLink(linkId) {
  if (!linkId) return;
  await window.fetchJSON(`/api/records/Link/${linkId}`, {
    method: "PATCH",
    body: JSON.stringify({
      values: {
        "Deleted At": new Date().toISOString(),
      },
    }),
  });
}

// 🔸 remove a Link ref from a Link Page's "Link(s)" array
async function detachLinkFromPage(pageId, linkId) {
  if (!pageId || !linkId) return;

  window.__LINKPAGE_CACHE = window.__LINKPAGE_CACHE || {};
  const cache = window.__LINKPAGE_CACHE;

  let existing;
  try {
    existing = await window.fetchJSON(`/api/records/Link Page/${pageId}`);
  } catch (err) {
    console.warn("[linkpage] could not load page for detach; using cache only", err);
    existing = cache[pageId];
  }

  const v = (existing && (existing.values || existing)) || {};
  const currentRefs = Array.isArray(v["Link(s)"]) ? v["Link(s)"] : [];

  const newRefs = currentRefs.filter((r) => {
    const id = r && (r._id || r.id || r);
    return String(id) !== String(linkId);
  });

  const savedPage = await window.fetchJSON(`/api/records/Link Page/${pageId}`, {
    method: "PATCH",
    body: JSON.stringify({ values: { "Link(s)": newRefs } }),
  });

  cache[pageId] = savedPage;
}

function createLinkCard(options = {}) {
  const {
    title       = "",
    url         = "",
    clicks      = 0,
    linkId      = null,
    isSaved     = false,

    subtitle    = "",
    description = "",
    price       = "",
    salePrice   = "",
    imageUrl    = "",

    // NEW: any existing downloads from DB
    downloads   = [],
  } = options;

  // 🔹 keep this link’s downloads in memory
  const currentDownloads = Array.isArray(downloads) ? [...downloads] : [];

  const row = document.createElement("div");
  row.className = "link-card-row";
  row.draggable = true;
  if (linkId) row.dataset.linkId = linkId;

  // ===== Left rail =====
  const rail = document.createElement("div");
  rail.className = "link-card-rail";

  const railInner = document.createElement("div");
  railInner.className = "link-card-rail-inner";

  for (let i = 0; i < 3; i++) {
    const dotRow = document.createElement("div");
    dotRow.className = "link-card-dot-row";
    for (let j = 0; j < 2; j++) {
      const dot = document.createElement("div");
      dot.className = "link-card-dot";
      dotRow.appendChild(dot);
    }
    railInner.appendChild(dotRow);
  }
  rail.appendChild(railInner);

  // ===== Right “pill” card =====
  const card = document.createElement("div");
  card.className = "link-card";

  const main = document.createElement("div");
  main.className = "link-card-main";

  // --- Title row ---
  const titleLabel = document.createElement("div");
  titleLabel.textContent = "Link Title";
  titleLabel.className = "link-card-label";

  const titleInput = document.createElement("input");
  titleInput.type = "text";
  titleInput.className = "link-card-input-title";
  titleInput.placeholder = "Add a title…";
  titleInput.value = title || "";

  // --- URL row ---
  const urlLabel = document.createElement("div");
  urlLabel.textContent = "Url";
  urlLabel.className = "link-card-label";

  const urlInput = document.createElement("input");
  urlInput.type = "url";
  urlInput.className = "link-card-input-url";
  urlInput.placeholder = "https://yourlink.com";
  urlInput.value = url || "";

  // --- Meta row (Details + clicks) ---
  const metaRow = document.createElement("div");
  metaRow.className = "link-card-meta-row";

  const detailsSpan = document.createElement("span");
  detailsSpan.textContent = "Details";
  detailsSpan.style.cursor = "pointer";

  const clicksSpan = document.createElement("span");
  clicksSpan.textContent = `# of Clicks: ${clicks}`;

  metaRow.appendChild(detailsSpan);
  metaRow.appendChild(clicksSpan);

  main.appendChild(titleLabel);
  main.appendChild(titleInput);
  main.appendChild(urlLabel);
  main.appendChild(urlInput);
  main.appendChild(metaRow);

  // ===== Details panel under meta row =====
  const detailsPanel = document.createElement("div");
  detailsPanel.className = "link-card-details";
  detailsPanel.style.display = "none";

  // Subtitle
  const subtitleLabel = document.createElement("div");
  subtitleLabel.textContent = "Subtitle";
  subtitleLabel.className = "link-card-label";

  const subtitleInput = document.createElement("input");
  subtitleInput.type = "text";
  subtitleInput.className = "link-card-input-subtitle";
  subtitleInput.placeholder = "Short subtitle for this link…";
  subtitleInput.value = subtitle || "";

  const subtitleRow = document.createElement("div");
  subtitleRow.className = "link-card-details-row";
  subtitleRow.appendChild(subtitleLabel);
  subtitleRow.appendChild(subtitleInput);

  // Long description
  const descLabel = document.createElement("div");
  descLabel.textContent = "Long description";
  descLabel.className = "link-card-label";

  const descTextarea = document.createElement("textarea");
  descTextarea.className = "link-card-textarea-desc";
  descTextarea.placeholder = "Add more details about this link…";
  descTextarea.rows = 3;
  descTextarea.value = description || "";

  const longDescRow = document.createElement("div");
  longDescRow.className = "link-card-details-row";
  longDescRow.appendChild(descLabel);
  longDescRow.appendChild(descTextarea);

  // Price + Sale Price
  const priceRow = document.createElement("div");
  priceRow.className = "link-card-details-row link-card-price-row";

  const priceGroup = document.createElement("div");
  priceGroup.className = "link-card-price-group";

  const priceLabel = document.createElement("div");
  priceLabel.textContent = "Price";
  priceLabel.className = "link-card-label";

  const priceInput = document.createElement("input");
  priceInput.type = "number";
  priceInput.step = "0.01";
  priceInput.min = "0";
  priceInput.className = "link-card-input-price";
  priceInput.placeholder = "0.00";
  priceInput.value =
    price !== null && price !== undefined && price !== ""
      ? String(price)
      : "";

  priceGroup.appendChild(priceLabel);
  priceGroup.appendChild(priceInput);

  const saleGroup = document.createElement("div");
  saleGroup.className = "link-card-price-group";

  const saleLabel = document.createElement("div");
  saleLabel.textContent = "Sale price";
  saleLabel.className = "link-card-label";

  const saleInput = document.createElement("input");
  saleInput.type = "number";
  saleInput.step = "0.01";
  saleInput.min = "0";
  saleInput.className = "link-card-input-sale-price";
  saleInput.placeholder = "0.00";
  saleInput.value =
    salePrice !== null && salePrice !== undefined && salePrice !== ""
      ? String(salePrice)
      : "";

  saleGroup.appendChild(saleLabel);
  saleGroup.appendChild(saleInput);

  priceRow.appendChild(priceGroup);
  priceRow.appendChild(saleGroup);

  // 🔹 Image (thumbnail)
  const imgRow = document.createElement("div");
  imgRow.className = "link-card-details-row";

  const imgLabel = document.createElement("div");
  imgLabel.textContent = "Link image";
  imgLabel.className = "link-card-label";

  const imgControls = document.createElement("div");
  imgControls.className = "link-card-image-controls";

  const imgInput = document.createElement("input");
  imgInput.type = "file";
  imgInput.accept = "image/*";
  imgInput.className = "link-card-input-image";

  const imgPreview = document.createElement("img");
  imgPreview.className = "link-card-image-preview";
  imgPreview.style.maxWidth = "64px";
  imgPreview.style.maxHeight = "64px";
  imgPreview.style.borderRadius = "8px";
  imgPreview.style.display = "none";

  if (imageUrl) {
    imgPreview.src = imageUrl;
    imgPreview.style.display = "block";
    row.dataset.imageUrl = imageUrl;
  }

  imgControls.appendChild(imgInput);
  imgControls.appendChild(imgPreview);

  imgRow.appendChild(imgLabel);
  imgRow.appendChild(imgControls);

  imgInput.addEventListener("change", async () => {
    const file = imgInput.files && imgInput.files[0];
    if (!file) return;
    try {
      const url = await uploadLinkImage(file);
      row.dataset.imageUrl = url;
      imgPreview.src = url;
      imgPreview.style.display = "block";
      renderPhoneFromLinks();
    } catch (err) {
      console.error("[links] image upload failed:", err);
      alert("Could not upload image: " + (err.message || err));
    }
  });

  // 🔹 Downloads (Result Files)
  const downloadsRow = document.createElement("div");
  downloadsRow.className = "link-card-details-row";

  const downloadsLabel = document.createElement("div");
  downloadsLabel.textContent = "Digital downloads";
  downloadsLabel.className = "link-card-label";

  const downloadsWrap = document.createElement("div");
  downloadsWrap.className = "link-card-downloads-wrap";

  const downloadsInput = document.createElement("input");
  downloadsInput.type = "file";
  downloadsInput.multiple = true;
  downloadsInput.className = "link-card-input-downloads";

  const downloadsList = document.createElement("ul");
  downloadsList.className = "link-card-downloads-list";

 function renderDownloadsList() {
  downloadsList.innerHTML = "";
  if (!currentDownloads.length) return;

  currentDownloads.forEach((f, idx) => {
    const li = document.createElement("li");
    const label = f.name || f.url || `File ${idx + 1}`;

    if (f.url) {
      const a = document.createElement("a");
      a.textContent = label;
      a.href = f.url;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      li.appendChild(a);
    } else {
      li.textContent = label;
    }

    downloadsList.appendChild(li);
  });
}


  // initial render from DB
  renderDownloadsList();

  downloadsInput.addEventListener("change", async () => {
    const files = Array.from(downloadsInput.files || []);
    if (!files.length) return;

    try {
      for (const file of files) {
        const meta = await uploadLinkFile(file);
        if (meta.url) {
          currentDownloads.push(meta);
        }
      }
      renderDownloadsList();
      downloadsInput.value = "";
    } catch (err) {
      console.error("[links] download upload failed:", err);
      alert("Could not upload files: " + (err.message || err));
    }
  });

  downloadsWrap.appendChild(downloadsInput);
  downloadsWrap.appendChild(downloadsList);

  downloadsRow.appendChild(downloadsLabel);
  downloadsRow.appendChild(downloadsWrap);

  // Actions at bottom of details
  const detailsActions = document.createElement("div");
  detailsActions.className = "link-card-details-actions";

  const cancelDetailsBtn = document.createElement("button");
  cancelDetailsBtn.type = "button";
  cancelDetailsBtn.className = "btn btn-sm";
  cancelDetailsBtn.textContent = "Cancel";

  detailsActions.appendChild(cancelDetailsBtn);

  // Assemble details panel
  detailsPanel.appendChild(subtitleRow);
  detailsPanel.appendChild(longDescRow);
  detailsPanel.appendChild(priceRow);
  detailsPanel.appendChild(imgRow);
  detailsPanel.appendChild(downloadsRow);   // ⬅️ downloads here
  detailsPanel.appendChild(detailsActions);

  cancelDetailsBtn.addEventListener("click", () => {
    detailsPanel.style.display = "none";
  });

  main.appendChild(detailsPanel);

  // 🔹 click “Details” to toggle panel
  detailsSpan.addEventListener("click", (e) => {
    e.stopPropagation();
    const isHidden =
      !detailsPanel.style.display || detailsPanel.style.display === "none";
    detailsPanel.style.display = isHidden ? "block" : "none";
  });

  // clicking the rail also toggles details
  rail.addEventListener("click", (e) => {
    e.stopPropagation();
    const isHidden =
      !detailsPanel.style.display || detailsPanel.style.display === "none";
    detailsPanel.style.display = isHidden ? "block" : "none";
  });

  // ===== Right-side actions (delete + save / menu) =====
  const actions = document.createElement("div");
  actions.className = "link-card-actions";

  const deleteBtn = document.createElement("button");
  deleteBtn.type = "button";
  deleteBtn.className = "link-card-icon-btn";
  deleteBtn.title = "Delete link";
  deleteBtn.textContent = "🗑️";

  const saveBtn = document.createElement("button");
  saveBtn.type = "button";
  saveBtn.className = "btn peach btn-sm";
  saveBtn.textContent = "Save";

  const menuBtn = document.createElement("button");
  menuBtn.type = "button";
  menuBtn.className = "link-card-icon-btn link-card-menu-btn";
  menuBtn.title = "More options";
  menuBtn.textContent = "⋯";
  menuBtn.style.display = "none";

  // Delete
  deleteBtn.addEventListener("click", async (e) => {
    e.stopPropagation();

    const pageId = linkpageSelect?.value || "";
    const existingId = row.dataset.linkId || linkId || null;

    const ok = window.confirm("Delete this link from the page?");
    if (!ok) return;

    try {
      if (existingId) {
        await softDeleteLink(existingId);
        if (pageId) {
          await detachLinkFromPage(pageId, existingId);
        }
      }
      row.remove();
      updateLinksEmptyState();
      renderPhoneFromLinks();
    } catch (err) {
      console.error("[links] delete failed:", err);
      alert("Could not delete link: " + (err.message || err));
    }
  });

  // Save
  saveBtn.addEventListener("click", async (e) => {
    e.stopPropagation();

    const pageId = linkpageSelect?.value || "";
    if (!pageId) {
      alert("Select a link page first.");
      return;
    }

    const titleVal    = titleInput.value.trim();
    const urlVal      = urlInput.value.trim();
    const subtitleVal = subtitleInput.value.trim();
    const descVal     = descTextarea.value.trim();
    const priceNum    = parseFloat(priceInput.value || "0");
    const saleNum     = parseFloat(saleInput.value || "0");

    if (!titleVal) {
      alert("Please enter a link title.");
      titleInput.focus();
      return;
    }
    if (!urlVal) {
      alert("Please enter a URL.");
      urlInput.focus();
      return;
    }

    let uid;
    try {
      uid = await window.requireUser();
    } catch (err) {
      console.warn("[links] requireUser failed:", err);
      return;
    }

    const values = {
      "Title":      titleVal,
      "URL":        urlVal,
      "Clicks":     clicks || 0,
      "Created By": { _id: uid },
      "Deleted At": null,

      "Subtitle":         subtitleVal || null,
      "Long Description": descVal || null,
      "Price":            !isNaN(priceNum) ? priceNum : null,
      "Sale Price":       !isNaN(saleNum) ? saleNum : null,
    };

    const thumbUrl = row.dataset.imageUrl || "";
    if (thumbUrl) {
      values["Thumbnail Image"] = thumbUrl;
    }

    // 🔹 save Result Files
    if (currentDownloads.length) {
      values["Result Files"] = currentDownloads;
    }

    const existingId = row.dataset.linkId || linkId || null;

    try {
      let savedLink;

      if (existingId) {
        savedLink = await window.fetchJSON(`/api/records/Link/${existingId}`, {
          method: "PATCH",
          body: JSON.stringify({ values }),
        });
      } else {
        savedLink = await window.fetchJSON("/api/records/Link", {
          method: "POST",
          body: JSON.stringify({ values }),
        });

        const newId = savedLink._id || savedLink.id;
        row.dataset.linkId = newId;
        await attachLinkToPage(pageId, newId);
      }

      switchToViewMode();
      detailsPanel.style.display = "none";

      alert("Link saved!");
      renderPhoneFromLinks();
    } catch (err) {
      console.error("[links] failed to save link:", err);
      alert("Could not save link: " + (err.message || err));
    }
  });

  // Menu → back to edit mode
  menuBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    switchToEditMode();
    detailsPanel.style.display = "block";
  });

  actions.appendChild(deleteBtn);
  actions.appendChild(saveBtn);
  actions.appendChild(menuBtn);

  card.appendChild(main);
  card.appendChild(actions);

  row.appendChild(rail);
  row.appendChild(card);

  // ===== View/Edit mode helpers =====
  function setReadonly(on) {
    [titleInput, urlInput, subtitleInput, descTextarea, priceInput, saleInput].forEach(
      (el) => {
        if (!el) return;
        if ("readOnly" in el) el.readOnly = !!on;
        el.classList.toggle("is-static", !!on);
      }
    );
  }

  function switchToViewMode() {
    row.classList.add("is-view");
    setReadonly(true);

    saveBtn.style.display = "none";
    menuBtn.style.display = "";
  }

  function switchToEditMode() {
    row.classList.remove("is-view");
    setReadonly(false);

    if (!titleInput.value)    titleInput.placeholder    = "Add a title…";
    if (!urlInput.value)      urlInput.placeholder      = "https://yourlink.com";
    if (!subtitleInput.value) subtitleInput.placeholder = "Short subtitle for this link…";
    if (!descTextarea.value)  descTextarea.placeholder  = "Add more details about this link…";
    if (!priceInput.value)    priceInput.placeholder    = "0.00";
    if (!saleInput.value)     saleInput.placeholder     = "0.00";

    saveBtn.style.display = "";
    menuBtn.style.display = "none";
  }

  if (isSaved || linkId) {
    switchToViewMode();
  } else {
    switchToEditMode();
    detailsPanel.style.display = "block";
  }

  renderPhoneFromLinks();

  return row;
}



addLinkBtn?.addEventListener("click", async () => {
  const pageId = linkpageSelect?.value || "";

  if (!pageId) {
    alert("Select or create a link page first.");
    return;
  }
  if (!linksListEl) return;

const card = createLinkCard({
  title: "",
  url: "https://",
  clicks: 0,
  isSaved: false,    // start in edit mode
});

 linksListEl.appendChild(card);
updateLinksEmptyState();
renderPhoneFromLinks();

});

// Attach a Link record to a Link Page's "Link(s)" field
// Attach a Link record to a Link Page's "Link(s)" field
async function attachLinkToPage(pageId, linkId) {
  if (!pageId || !linkId) return;

  window.__LINKPAGE_CACHE = window.__LINKPAGE_CACHE || {};
  const cache = window.__LINKPAGE_CACHE;

  // 1️⃣ Load the current Link Page (to get existing Link(s))
  let existing;
  try {
    existing = await window.fetchJSON(`/api/records/Link Page/${pageId}`);
  } catch (err) {
    console.warn("[linkpage] could not load page for attach; using cache only", err);
    existing = cache[pageId];
  }

  const v = (existing && (existing.values || existing)) || {};
  const currentRefs = Array.isArray(v["Link(s)"]) ? v["Link(s)"] : [];

  // avoid duplicates
  const already = currentRefs.some((r) => (r._id || r.id) === linkId);
  const newRefs  = already ? currentRefs : [...currentRefs, { _id: linkId }];

  // 2️⃣ PATCH the Link Page record to update only "Link(s)"
  const savedPage = await window.fetchJSON(`/api/records/Link Page/${pageId}`, {
    method: "PATCH",
    body: JSON.stringify({
      values: {
        "Link(s)": newRefs,
      },
    }),
  });

  // 3️⃣ Update cache
  cache[pageId] = savedPage;
}


//fetches links for the selected page
// Load all Link records for the currently selected Link Page
async function loadLinksForSelectedPage() {
  if (!linksListEl) return;

  const pageId = linkpageSelect?.value || "";

  // Clear current list
  linksListEl.innerHTML = "";
  updateLinksEmptyState();

  if (!pageId) return;

  // Ensure cache exists
  window.__LINKPAGE_CACHE = window.__LINKPAGE_CACHE || {};
  const cache = window.__LINKPAGE_CACHE;

  let pageRec = cache[pageId];

  // If not cached (or cache is stale), fetch it once
  if (!pageRec) {
    try {
      pageRec = await window.fetchJSON(`/api/records/Link Page/${pageId}`);
      cache[pageId] = pageRec;
    } catch (err) {
      console.error("[links] failed to fetch Link Page", pageId, err);
      return;
    }
  }

  const v = (pageRec && (pageRec.values || pageRec)) || {};
  const linkRefs = Array.isArray(v["Link(s)"]) ? v["Link(s)"] : [];

    // Populate the Page Style form from this Link Page
  populateStyleFormFromPage(pageRec);

  if (!linkRefs.length) {
    updateLinksEmptyState();
    return;
  }

  // For each reference, fetch its Link record and render a card in view mode
  for (const ref of linkRefs) {
    const linkId = (ref && (ref._id || ref.id)) || ref;
    if (!linkId) continue;

    try {
const linkRec = await window.fetchJSON(`/api/records/Link/${linkId}`);
const lv = linkRec.values || {};

// skip soft-deleted links
if (lv["Deleted At"]) {
  continue;
}

const titleFromDB =
  lv["Title"] ||
  lv["Link Title"] ||
  "";

const urlFromDB =
  lv["URL"] ||
  lv["Url"] ||
  lv["Link URL"] ||
  "";

const clicksFromDB   = Number(lv["Clicks"] || 0);

// 🔹 NEW: pull details if they exist
const subtitleFromDB =
  lv["Subtitle"] ||
  lv["Sub Title"] ||
  "";

const descFromDB =
  lv["Long Description"] ||
  lv["Description"] ||
  "";

const priceFromDB =
  lv["Price"] !== undefined && lv["Price"] !== null
    ? lv["Price"]
    : "";

const saleFromDB =
  lv["Sale Price"] !== undefined && lv["Sale Price"] !== null
    ? lv["Sale Price"]
    : "";
const thumbFromDB =
  lv["Thumbnail Image"] ||
  lv["Link Image"] ||
  "";

 const downloadsFromDB =
  lv["Result Files"] ||
  lv["Downloads"] ||
  [];

const card = createLinkCard({
  title:      titleFromDB,
  url:        urlFromDB,
  clicks:     clicksFromDB,
  linkId:     linkId,
  isSaved:    true,

  subtitle:   subtitleFromDB,
  description: descFromDB,
  price:      priceFromDB,
  salePrice:  saleFromDB,
  imageUrl:    thumbFromDB, 
  downloads:   downloadsFromDB, 
});

linksListEl.appendChild(card);

    } catch (err) {
      console.error("[links] failed to load link", linkId, err);
    }
  }

  updateLinksEmptyState();
}

// 🔁 When a link page is selected from dropdown, load its links
linkpageSelect?.addEventListener("change", () => {
  updateEditorVisibility();

  loadCurrentLinkPageRecord()      // loads + populates styles (incl. images)
    .then(() => loadLinksForSelectedPage())
    .then(() => renderPhoneFromLinks())
    .catch((err) => {
      console.error("[links] change handler error:", err);
    });
});



// 🔁 On auth ready, hydrate dropdown and then load links (if something is selected)
document.addEventListener("auth:ready", () => {
  hydrateLinkpageDropdown()
    .then(() => {
      updateEditorVisibility();
      return loadCurrentLinkPageRecord();  // ⬅️ populate styles+images
    })
    .then(() => loadLinksForSelectedPage())
    .then(() => {
      renderPhoneFromLinks();
    })
     .then(refreshDashboardTotals)  
    .catch((err) => {
      console.error("[links] initial load error:", err);
    });
});

















//make links draggable
let draggedLinkRow = null;

// Save the current order of links to the Link Page's "Link(s)" field
async function saveCurrentLinkOrder() {
  if (!linksListEl || !linkpageSelect) return;

  const pageId = linkpageSelect.value.trim();
  if (!pageId) return;

  // Read the visible order from the DOM
  const rows = Array.from(linksListEl.querySelectorAll(".link-card-row"));
  const orderedIds = rows
    .map((row) => row.dataset.linkId)
    .filter(Boolean);

  if (!orderedIds.length) {
    console.log("[links] no link ids found to save order");
    return;
  }

  // Build references array for the "Link(s)" field
  const newRefs = orderedIds.map((id) => ({ _id: id }));

  try {
    const savedPage = await window.fetchJSON(`/api/records/Link Page/${pageId}`, {
      method: "PATCH",
      body: JSON.stringify({
        values: {
          "Link(s)": newRefs,
        },
      }),
    });

    // keep cache in sync
    window.__LINKPAGE_CACHE = window.__LINKPAGE_CACHE || {};
    window.__LINKPAGE_CACHE[pageId] = savedPage;

    console.log("[links] link order saved:", orderedIds);
  } catch (err) {
    console.error("[links] failed to save link order:", err);
    alert("Could not save link order: " + (err.message || err));
  }
}
// Helper to find where to insert the dragged row
function getDragAfterElement(container, y) {
  const draggableElements = [
    ...container.querySelectorAll(".link-card-row:not(.is-dragging)")
  ];

  let closest = { offset: Number.NEGATIVE_INFINITY, element: null };

  draggableElements.forEach((child) => {
    const box = child.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;

    // we want the element with the smallest negative offset (closest above cursor)
    if (offset < 0 && offset > closest.offset) {
      closest = { offset, element: child };
    }
  });

  return closest.element;
}

// Wire up drag events on the list container
if (linksListEl) {
  // start dragging
  linksListEl.addEventListener("dragstart", (e) => {
    const row = e.target.closest(".link-card-row");
    if (!row) return;

    draggedLinkRow = row;
    row.classList.add("is-dragging");

    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = "move";
      // required in some browsers to make drag work
      e.dataTransfer.setData("text/plain", row.dataset.linkId || "");
    }
  });

  // end dragging
  linksListEl.addEventListener("dragend", () => {
    if (draggedLinkRow) {
      draggedLinkRow.classList.remove("is-dragging");
      draggedLinkRow = null;
    }
  });

  // while dragging over the list
  linksListEl.addEventListener("dragover", (e) => {
    e.preventDefault(); // allow drop

    if (!draggedLinkRow) return;

    const afterElement = getDragAfterElement(linksListEl, e.clientY);
    if (!afterElement) {
      // drop at end
      linksListEl.appendChild(draggedLinkRow);
    } else {
      // insert before the closest element
      linksListEl.insertBefore(draggedLinkRow, afterElement);
    }
  });

  // drop → save new order
// drop → save new order + refresh phone preview
linksListEl.addEventListener("drop", (e) => {
  e.preventDefault();

  // we already repositioned in dragover, now just persist order
  saveCurrentLinkOrder()
    .catch((err) => {
      console.error("[links] saveCurrentLinkOrder on drop failed:", err);
    })
    .finally(() => {
      // rebuild the phone using the current DOM order
      renderPhoneFromLinks();
    });
});

}

                          ///////////////////////////////////////////////////
                                         //Link Details Section
    
                                     ////////////////////////////////////////////////////

const styleOpenBtn = document.getElementById("lp-open-style-btn");

styleOpenBtn?.addEventListener("click", (e) => {
  e.preventDefault();
  openStylePanel(); // same function you used before
});
///////////////////////////////////////////////////
                // Link Details Section
///////////////////////////////////////////////////

// Right-side "Link details" body
const linkDetailBody  = document.getElementById("link-detail-body");
// Page style panel + inputs
const linkStylePanel  = document.getElementById("link-style-panel");

// 🔹 Style inputs (keep your current IDs)
const styleInputs = {
  linkBtnText: document.getElementById("style-link-btn-text"),
  linkBtnBg:   document.getElementById("style-link-btn-bg"),
  linkText:    document.getElementById("style-link-text"),
  linkBorder:  document.getElementById("style-link-border"),
  linkBg:      document.getElementById("style-link-bg"),
  pageBgImg:   document.getElementById("style-page-bg-img"),
  pageBg:      document.getElementById("style-page-bg"),
  headerImg:   document.getElementById("style-header-img"),
};

// ⭐ new small previews in the form
const pageBgPreviewEl = document.getElementById("page-bg-preview");
const headerPreviewEl = document.getElementById("header-img-preview");
const pageBgClearBtn   = document.getElementById("page-bg-clear");
const headerClearBtn   = document.getElementById("header-img-clear");

// track current images
let currentPageBgImage = null;
let currentHeaderImage = null;

// track if user explicitly removed them
let pageBgDeleted   = false;
let headerImgDeleted = false;

async function handleStyleSaveClick() {
  console.log("[links] 🔘 Save styles clicked");

  const pageId = linkpageSelect?.value || "";
  if (!pageId) {
    alert("Select a link page first.");
    return;
  }

  const values = {
    "Link Button Text Color": getInputTrim(styleInputs.linkBtnText),
    "Link Button Color":      getInputTrim(styleInputs.linkBtnBg),
    "Link Text Color":        getInputTrim(styleInputs.linkText),
    "Link Border Color":      getInputTrim(styleInputs.linkBorder),
    "Link Background Color":  getInputTrim(styleInputs.linkBg),
    "Page Background Color":  getInputTrim(styleInputs.pageBg),
  };

  // 🔹 read image URLs from preview <img>s, fall back to current* vars
  const pageBgUrl =
    (pageBgPreviewEl && pageBgPreviewEl.src) || currentPageBgImage || null;
  const headerUrl =
    (headerPreviewEl && headerPreviewEl.src) || currentHeaderImage || null;

  if (pageBgUrl) {
    values["Page Background Image"] = pageBgUrl;
  }
  if (headerUrl) {
    values["Header Image"] = headerUrl;
  }

    // 🔻 NEW: respect delete flags
  if (pageBgDeleted) {
    values["Page Background Image"] = null;      // clear in DB
  } else if (pageBgUrl) {
    values["Page Background Image"] = pageBgUrl; // save/update in DB
  }

  if (headerImgDeleted) {
    values["Header Image"] = null;
  } else if (headerUrl) {
    values["Header Image"] = headerUrl;
  }

  console.log("[links] style values about to PATCH:", values);

  try {
    const url = `/api/records/Link Page/${pageId}`;
    const savedPage = await window.fetchJSON(url, {
      method: "PATCH",
      body: JSON.stringify({ values }),
    });

    window.__LINKPAGE_CACHE = window.__LINKPAGE_CACHE || {};
    window.__LINKPAGE_CACHE[pageId] = savedPage;

    if (typeof renderPhoneFromLinks === "function") {
      renderPhoneFromLinks();
    }

    alert("Page styles saved!");
  } catch (err) {
    console.error("[linkpage] ❌ save styles failed:", err);
    alert("Could not save page styles: " + (err.message || err));
  }
}



// Attach the click handler AFTER DOM is ready
const styleSaveBtn = document.getElementById("link-style-save");
if (!styleSaveBtn) {
  console.warn("[links] styleSaveBtn not found in DOM");
} else {
  console.log("[links] wiring styleSaveBtn");
  styleSaveBtn.addEventListener("click", handleStyleSaveClick);
}


function initImageUploaders() {
  const phoneScreen = linkDetailBody?.querySelector(".lp-phone-screen");
  const pagePreview = document.getElementById("page-preview");

  async function uploadTo(file) {
    const fd = new FormData();
    fd.append("file", file); // matches /api/upload

    const res = await fetch("/api/upload", {
      method: "POST",
      credentials: "include",
      body: fd,
    });

    if (!res.ok) {
      let msg = `HTTP ${res.status}`;
      try {
        const data = await res.json();
        if (data?.error) msg += ` – ${data.error}`;
      } catch (_) {}
      throw new Error("Upload failed: " + msg);
    }

    const data = await res.json();   // { url: "/uploads/..." }
    return data.url;
  }

  function hookImageInput(inputEl, onUploaded) {
    if (!inputEl) return;

    inputEl.addEventListener("change", async () => {
      const file = inputEl.files && inputEl.files[0];
      if (!file) return;

      try {
        await onUploaded?.(file);
      } catch (err) {
        console.error("[linkpage] upload error", err);
        alert("Could not upload image: " + (err.message || err));
      }
    });
  }

  // Header image
  hookImageInput(styleInputs.headerImg, async (file) => {
    const url = await uploadTo(file);
    currentHeaderImage = url;

 // header upload
if (headerPreviewEl) {
  headerPreviewEl.src = url;
  headerPreviewEl.style.display = "block";
}
if (headerClearBtn) {
  headerClearBtn.style.display = "inline-block";
}
 renderPhoneFromLinks();
  });

  // Page background image
  hookImageInput(styleInputs.pageBgImg, async (file) => {
    const url = await uploadTo(file);
    currentPageBgImage = url;

// page bg upload
if (pageBgPreviewEl) {
  pageBgPreviewEl.src = url;
  pageBgPreviewEl.style.display = "block";
}
if (pageBgClearBtn) {
  pageBgClearBtn.style.display = "inline-block";
}

    const phoneScreenNow = linkDetailBody?.querySelector(".lp-phone-screen");
    if (phoneScreenNow) {
      phoneScreenNow.style.backgroundImage    = `url("${url}")`;
      phoneScreenNow.style.backgroundSize     = "cover";
      phoneScreenNow.style.backgroundPosition = "center";
    }
    if (pagePreview) {
      pagePreview.style.backgroundImage    = `url("${url}")`;
      pagePreview.style.backgroundSize     = "cover";
      pagePreview.style.backgroundPosition = "center";
    }
  });
}


function initImageClearButtons() {
  // remove Page Background Image
  if (pageBgClearBtn) {
    pageBgClearBtn.addEventListener("click", () => {
      currentPageBgImage = null;
      pageBgDeleted = true;

      if (pageBgPreviewEl) {
        pageBgPreviewEl.removeAttribute("src");
        pageBgPreviewEl.style.display = "none";
      }

      const phoneScreen = linkDetailBody?.querySelector(".lp-phone-screen");
      if (phoneScreen) {
        phoneScreen.style.backgroundImage = "";
      }

      const pagePreview = document.getElementById("page-preview");
      if (pagePreview) {
        pagePreview.style.backgroundImage = "";
      }
    });
  }

  // remove Header Image
  if (headerClearBtn) {
    headerClearBtn.addEventListener("click", () => {
      currentHeaderImage = null;
      headerImgDeleted = true;

      if (headerPreviewEl) {
        headerPreviewEl.removeAttribute("src");
        headerPreviewEl.style.display = "none";
      }
      // (if you ever draw the header image on the phone preview,
      // clear that here too)
    });
  }
}

// Example: the element you’re styling
const previewLink = document.getElementById("link-preview");     // button or full link block
const previewPage = document.getElementById("page-preview");     // whole page/container

function initStyleColorPickers() {
  if (!styleInputs) return;

  const watchInputs = [
    styleInputs.linkBtnText,
    styleInputs.linkBtnBg,
    styleInputs.linkText,
    styleInputs.linkBorder,
    styleInputs.linkBg,
    styleInputs.pageBg,
  ].filter(Boolean);

  watchInputs.forEach((input) => {
    input.addEventListener("input", applyStylesToPhonePreview);
    input.addEventListener("change", applyStylesToPhonePreview);
  });
}





function openStylePanel() {
  if (!linkStylePanel) return;
  linkStylePanel.style.display = "";
}
function hideStylePanel() {
  if (!linkStylePanel) return;
  linkStylePanel.style.display = "none";
}


// Fill the style form from a Link Page record
// Fill the style form from a Link Page record
function populateStyleFormFromPage(pageRec) { 
  if (!pageRec) return;
  const v = pageRec.values || pageRec;

  // only override if DB has a value
  if (styleInputs.linkBtnText && v["Link Button Text Color"]) {
    styleInputs.linkBtnText.value = v["Link Button Text Color"];
  }
  if (styleInputs.linkBtnBg && v["Link Button Color"]) {
    styleInputs.linkBtnBg.value = v["Link Button Color"];
  }
  if (styleInputs.linkText && v["Link Text Color"]) {
    styleInputs.linkText.value = v["Link Text Color"];
  }
  if (styleInputs.linkBorder && v["Link Border Color"]) {
    styleInputs.linkBorder.value = v["Link Border Color"];
  }
  if (styleInputs.linkBg && v["Link Background Color"]) {
    styleInputs.linkBg.value = v["Link Background Color"];
  }
  if (styleInputs.pageBg && v["Page Background Color"]) {
    styleInputs.pageBg.value = v["Page Background Color"];
  }

  // file inputs must stay empty
  if (styleInputs.pageBgImg) styleInputs.pageBgImg.value = "";
  if (styleInputs.headerImg) styleInputs.headerImg.value = "";

  // restore image URLs from DB
  currentPageBgImage = v["Page Background Image"] || null;
  currentHeaderImage = v["Header Image"] || null;

  // 🔹 reset deleted flags when loading from DB
  pageBgDeleted    = false;
  headerImgDeleted = false;

  // 🔹 page bg preview + clear btn
  if (pageBgPreviewEl) {
    if (currentPageBgImage) {
      pageBgPreviewEl.src = currentPageBgImage;
      pageBgPreviewEl.style.display = "block";
      if (pageBgClearBtn) pageBgClearBtn.style.display = "inline-block";
    } else {
      pageBgPreviewEl.removeAttribute("src");
      pageBgPreviewEl.style.display = "none";
      if (pageBgClearBtn) pageBgClearBtn.style.display = "none";
    }
  }

  // 🔹 header preview + clear btn
  if (headerPreviewEl) {
    if (currentHeaderImage) {
      headerPreviewEl.src = currentHeaderImage;
      headerPreviewEl.style.display = "block";
      if (headerClearBtn) headerClearBtn.style.display = "inline-block";
    } else {
      headerPreviewEl.removeAttribute("src");
      headerPreviewEl.style.display = "none";
      if (headerClearBtn) headerClearBtn.style.display = "none";
    }
  }

  // keep the big phone + page preview in sync
  const phoneScreen = linkDetailBody?.querySelector(".lp-phone-screen");
  const pagePreview = document.getElementById("page-preview");

  if (phoneScreen) {
    if (currentPageBgImage) {
      phoneScreen.style.backgroundImage    = `url("${currentPageBgImage}")`;
      phoneScreen.style.backgroundSize     = "cover";
      phoneScreen.style.backgroundPosition = "center";
    } else if (v["Page Background Color"]) {
      phoneScreen.style.backgroundImage = "";
      phoneScreen.style.backgroundColor = v["Page Background Color"];
    }
  }

  if (pagePreview) {
    if (currentPageBgImage) {
      pagePreview.style.backgroundImage    = `url("${currentPageBgImage}")`;
      pagePreview.style.backgroundSize     = "cover";
      pagePreview.style.backgroundPosition = "center";
    } else if (v["Page Background Color"]) {
      pagePreview.style.backgroundImage = "";
      pagePreview.style.backgroundColor = v["Page Background Color"];
    }
  }

  if (typeof applyStylesToPhonePreview === "function") {
    applyStylesToPhonePreview();
  }
}


async function loadCurrentLinkPageRecord() {
  const pageId = linkpageSelect?.value;
  if (!pageId) return null;

  const page = await window.fetchJSON(`/api/records/Link Page/${pageId}`);
  populateStyleFormFromPage(page);   // ⬅️ this restores colors + images
  return page;
}



function getInputTrim(el) {
  return el && typeof el.value === "string" ? el.value.trim() || null : null;
}
/////change iphone 
function getCurrentStyleValues() {
  return {
    linkBtnText: getInputTrim(styleInputs.linkBtnText),
    linkBtnBg:   getInputTrim(styleInputs.linkBtnBg),
    linkText:    getInputTrim(styleInputs.linkText),
    linkBorder:  getInputTrim(styleInputs.linkBorder),
    linkBg:      getInputTrim(styleInputs.linkBg),
    pageBg:      getInputTrim(styleInputs.pageBg),
    // we’re ignoring images here for now in the preview
  };
}

function applyStylesToPhonePreview() {
  if (!linkDetailBody) return;

  const styles = getCurrentStyleValues();

  const phonePreview = linkDetailBody.querySelector(".lp-phone-preview");
  const phoneScreen  = linkDetailBody.querySelector(".lp-phone-screen");
  const items        = linkDetailBody.querySelectorAll(".lp-phone-item");
  const buttons      = linkDetailBody.querySelectorAll(".lp-phone-item-button");
  const titles       = linkDetailBody.querySelectorAll(".lp-phone-item-title");
  const subtitles    = linkDetailBody.querySelectorAll(".lp-phone-item-subtitle");
  const descs        = linkDetailBody.querySelectorAll(".lp-phone-item-desc");
  const prices       = linkDetailBody.querySelectorAll(".lp-phone-item-price");
  const headerTitle  = linkDetailBody.querySelector(".lp-phone-header-title");

  if (phonePreview) {
    phonePreview.style.backgroundColor = "";
  }

  if (phoneScreen) {
    phoneScreen.style.backgroundColor = styles.pageBg || "";
  }

  items.forEach((item) => {
    item.style.backgroundColor = styles.linkBg || "";

    if (styles.linkBorder) {
      item.style.borderColor = styles.linkBorder;
      item.style.borderWidth = "1px";
      item.style.borderStyle = "solid";
    } else {
      item.style.borderColor = "";
      item.style.borderWidth = "";
      item.style.borderStyle = "";
    }
  });

  [...titles, ...subtitles, ...descs, ...prices].forEach((el) => {
    el.style.color = styles.linkText || "";
  });

  // 🔹 page name color
  if (headerTitle) {
    headerTitle.style.color = styles.linkText || "";
  }

  buttons.forEach((btn) => {
    btn.style.backgroundColor = styles.linkBtnBg   || "";
    btn.style.color           = styles.linkBtnText || "";
  });
}





// Build iPhone preview showing ALL links as tiles
// Build iPhone preview showing ALL links as tiles
function renderPhoneFromLinks() {
  if (!linkDetailBody || !linksListEl) return;

  // Clear any previous content
  linkDetailBody.innerHTML = "";

  // Outer phone frame
  const phonePreview = document.createElement("div");
  phonePreview.className = "lp-phone-preview";

  const phoneScreen = document.createElement("div");
  phoneScreen.className = "lp-phone-screen";

  // 🔁 Apply saved background image / color to the new phone screen
  if (currentPageBgImage) {
    phoneScreen.style.backgroundImage    = `url("${currentPageBgImage}")`;
    phoneScreen.style.backgroundSize     = "cover";
    phoneScreen.style.backgroundPosition = "center";
  } else {
    const bgColor =
      (styleInputs.pageBg && styleInputs.pageBg.value) || "";
    if (bgColor) {
      phoneScreen.style.backgroundImage = "";
      phoneScreen.style.backgroundColor = bgColor;
    }
  }

  // 🔹 HEADER IMAGE + PAGE NAME
    const pageId = linkpageSelect?.value || "";
  let pageTitle = "Link Page";

  if (pageId && window.__LINKPAGE_CACHE && window.__LINKPAGE_CACHE[pageId]) {
    const rec = window.__LINKPAGE_CACHE[pageId];
    const v   = rec.values || rec;
    pageTitle =
      v["Link Page Name"] ||
      v["Name"] ||
      (linkpageSelect.selectedOptions[0]?.textContent || "Link Page").trim();
  } else if (linkpageSelect && linkpageSelect.selectedOptions.length) {
    pageTitle = (linkpageSelect.selectedOptions[0].textContent || "Link Page").trim();
  }

  // ✅ strip slug part like " — /loclov" if it exists
  const dashIndex = pageTitle.indexOf("—");
  if (dashIndex !== -1) {
    pageTitle = pageTitle.slice(0, dashIndex).trim();
  }

  if (currentHeaderImage || pageTitle) {
    const headerWrap = document.createElement("div");
    headerWrap.className = "lp-phone-header";

    if (currentHeaderImage) {
      const img = document.createElement("img");
      img.className = "lp-phone-header-img";
      img.src = currentHeaderImage;
      img.alt = pageTitle;
      headerWrap.appendChild(img);
    }

    if (pageTitle) {
      const titleEl = document.createElement("div");
      titleEl.className = "lp-phone-header-title";
      titleEl.textContent = pageTitle;
      headerWrap.appendChild(titleEl);
    }

    phoneScreen.appendChild(headerWrap);
  }

  // Container for the list of link tiles
  const list = document.createElement("div");
  list.className = "lp-phone-list";

  // Read all link cards from the left side
  const rows = Array.from(linksListEl.querySelectorAll(".link-card-row"));

  if (!rows.length) {
    const empty = document.createElement("div");
    empty.style.fontSize = "12px";
    empty.style.textAlign = "center";
    empty.style.opacity = "0.8";
    empty.textContent = "Links you add will show up here.";
    list.appendChild(empty);

    phoneScreen.appendChild(list);
    phonePreview.appendChild(phoneScreen);
    linkDetailBody.appendChild(phonePreview);
    return;
  }

  rows.forEach((row) => {
    const titleInput    = row.querySelector(".link-card-input-title");
    const subtitleInput = row.querySelector(".link-card-input-subtitle");
    const descTextarea  = row.querySelector(".link-card-textarea-desc");
    const priceInput    = row.querySelector(".link-card-input-price");

    const title    = (titleInput?.value || "Link Title").trim();
    const subtitle = (subtitleInput?.value || "Link Subtitle").trim();
    const desc     = (descTextarea?.value || "").trim();
    const price    = (priceInput?.value || "").trim();

    const item = document.createElement("div");
    item.className = "lp-phone-item";

    const thumb = document.createElement("div");
    thumb.className = "lp-phone-thumb";

        const thumbUrl = row.dataset.imageUrl || "";

    if (thumbUrl) {
      const img = document.createElement("img");
      img.src = thumbUrl;
      img.alt = title;
      img.style.width = "100%";
      img.style.height = "100%";
      img.style.objectFit = "cover";
      img.style.borderRadius = "inherit";
      thumb.appendChild(img);
    }

    const textCol = document.createElement("div");
    textCol.className = "lp-phone-text";

    const titleEl = document.createElement("div");
    titleEl.className = "lp-phone-item-title";
    titleEl.textContent = title;

    const subtitleEl = document.createElement("div");
    subtitleEl.className = "lp-phone-item-subtitle";
    subtitleEl.textContent = subtitle;

    const descEl = document.createElement("div");
    descEl.className = "lp-phone-item-desc";
    descEl.textContent = desc;

    const priceEl = document.createElement("div");
    priceEl.className = "lp-phone-item-price";
    priceEl.textContent = price ? `Price: ${price}` : "Price";

    const button = document.createElement("div");
    button.className = "lp-phone-item-button";
    button.textContent = "Buy Now";

    textCol.appendChild(titleEl);
    textCol.appendChild(subtitleEl);
    textCol.appendChild(descEl);
    textCol.appendChild(priceEl);
    textCol.appendChild(button);

    item.appendChild(thumb);
    item.appendChild(textCol);

    list.appendChild(item);
  });

  phoneScreen.appendChild(list);
  phonePreview.appendChild(phoneScreen);
  linkDetailBody.appendChild(phonePreview);

  applyStylesToPhonePreview();
}

initStyleColorPickers();
 initImageUploaders();
initImageClearButtons();























//////////////////////////////////////////////////
              //Shop Section
//////////////////////////////////////////////////

const shopLinkpageSelect  = document.getElementById("shop-linkpage-select");
const shopAddProductBtn      = document.getElementById("shop-add-product-btn");
const shopProductEditor      = document.getElementById("shop-product-editor");
const shopProductCancelBtn   = document.getElementById("shop-product-cancel-btn");
const shopProductSaveBtn     = document.getElementById("shop-product-save-btn");

const shopProductTitleEl     = document.getElementById("shop-product-title");
const shopProductQtyEl       = document.getElementById("shop-product-qty");
const shopProductDefaultImg  = document.getElementById("shop-product-default-img");
const shopProductDefaultPrev = document.getElementById("shop-product-default-preview");
const shopProductGallery     = document.getElementById("shop-product-gallery");
const shopProductGalleryList = document.getElementById("shop-product-gallery-list");
const shopProductPriceEl     = document.getElementById("shop-product-price");
const shopProductSaleEl      = document.getElementById("shop-product-sale-price");
const shopProductDescEl      = document.getElementById("shop-product-description");

const shopProductsTbody    = document.getElementById("shop-products-tbody");
const shopProductsEmptyRow = document.getElementById("shop-products-empty-row");

const shopProductFiles     = document.getElementById("shop-product-files");
const shopProductFilesList = document.getElementById("shop-product-files-list");

let allShopProducts = [];   // <- ALL products by this user (any link page)
let currentEditingProduct= null;
let currentGalleryFiles = [];   // <- hold ALL gallery files for this product
let currentDownloadFiles  = [];

// Open editor
shopAddProductBtn?.addEventListener("click", async () => {
  if (!shopLinkpageSelect?.value) {
    alert("Select which link page this shop belongs to first.");
    return;
  }

    currentEditingProduct = null;      // ⬅️ NEW: we're creating, not editing
  resetProductEditorFields();        // ⬅️ NEW: clear the form
currentGalleryFiles = [];
currentDownloadFiles = [];

  if (shopProductEditor) {
    shopProductEditor.style.display = "block";
  }

  // make sure user is logged in
  try {
    await window.requireUser();
  } catch {
    return; // login modal already shown
  }

  // reset fields each time
  if (shopProductTitleEl) shopProductTitleEl.value = "";
  if (shopProductQtyEl)   shopProductQtyEl.value   = "";
  if (shopProductPriceEl) shopProductPriceEl.value = "";
  if (shopProductSaleEl)  shopProductSaleEl.value  = "";
  if (shopProductDescEl)  shopProductDescEl.value  = "";

  if (shopProductDefaultImg) shopProductDefaultImg.value = "";
  if (shopProductGallery)    shopProductGallery.value    = "";
  if (shopProductDefaultPrev) {
    shopProductDefaultPrev.src = "";
    shopProductDefaultPrev.style.display = "none";
  }
  if (shopProductGalleryList) shopProductGalleryList.innerHTML = "";

  if (shopProductEditor) {
    shopProductEditor.style.display = "block";
  }
});

// Cancel → hide editor
shopProductCancelBtn?.addEventListener("click", () => {
  if (shopProductEditor) {
    shopProductEditor.style.display = "none";
  }
});

// Default image preview (just like your other uploaders)
shopProductDefaultImg?.addEventListener("change", () => {
  const file = shopProductDefaultImg.files && shopProductDefaultImg.files[0];
  if (!file || !shopProductDefaultPrev) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    const url = e.target?.result;
    if (typeof url === "string") {
      shopProductDefaultPrev.src = url;
      shopProductDefaultPrev.style.display = "block";
    }
  };
  reader.readAsDataURL(file);
});

// Gallery: allow picking multiple times and ADD previews
// Gallery: allow picking multiple times and ADD previews
shopProductGallery?.addEventListener("change", () => {
  if (!shopProductGallery || !shopProductGalleryList) return;

  const newlySelected = Array.from(shopProductGallery.files || []);
  if (!newlySelected.length) return;

  newlySelected.forEach((file) => {
    // 1️⃣ Track this file in our "new files" array
    currentGalleryFiles.push(file);

    // 2️⃣ Build a wrapper card
    const wrapper = document.createElement("div");
    wrapper.className = "shop-gallery-item";

    const img = document.createElement("img");
    img.className = "shop-gallery-thumb";

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "shop-gallery-remove";
    removeBtn.textContent = "×";

    // Preview the image
    const reader = new FileReader();
    reader.onload = (e) => {
      const url = e.target?.result;
      if (typeof url === "string") {
        img.src = url;
      }
    };
    reader.readAsDataURL(file);

    // Remove handler for NEW file
    removeBtn.addEventListener("click", () => {
      // Remove this file from currentGalleryFiles
      currentGalleryFiles = currentGalleryFiles.filter((f) => f !== file);
      // Remove from DOM
      wrapper.remove();
    });

    wrapper.appendChild(img);
    wrapper.appendChild(removeBtn);
    shopProductGalleryList.appendChild(wrapper);
  });

  // 3️⃣ Clear input so user can pick another batch
  shopProductGallery.value = "";
});



// Save (for now just log the values — we'll hook backend next)
shopProductSaveBtn?.addEventListener("click", async () => {
  const pageId = shopLinkpageSelect?.value || "";
  if (!pageId) {
    alert("Select a link page first.");
    return;
  }

  const title       = shopProductTitleEl?.value.trim() || "";
  const qtyNum      = Number(shopProductQtyEl?.value || "0");
  const priceNum    = Number(shopProductPriceEl?.value || "0");
  const saleNumRaw  = shopProductSaleEl?.value || "";
  const saleNum     = saleNumRaw ? Number(saleNumRaw) : NaN;
  const description = shopProductDescEl?.value.trim() || "";

  if (!title) {
    alert("Please enter a product title.");
    shopProductTitleEl?.focus();
    return;
  }

  if (!shopProductPriceEl?.value) {
    const ok = confirm("No price entered. Save as 0.00?");
    if (!ok) {
      shopProductPriceEl?.focus();
      return;
    }
  }

  // must be logged in
  let uid;
  try {
    uid = await window.requireUser();
  } catch (err) {
    console.warn("[shop] requireUser failed:", err);
    return;
  }

  try {
    // 1️⃣ Upload default image (if any)
    let defaultImageUrl = null;
    if (shopProductDefaultImg?.files?.[0]) {
      defaultImageUrl = await uploadLinkImage(shopProductDefaultImg.files[0]);
    }

  // 2️⃣ Upload gallery images (new ones only) — use SAME helper as links image
const galleryUrls = [];
const galleryFilesToUpload =
  currentGalleryFiles.length
    ? currentGalleryFiles
    : Array.from(shopProductGallery?.files || []);

if (galleryFilesToUpload.length) {
  for (const file of galleryFilesToUpload) {
    const url = await uploadLinkImage(file);   // ✅ images → image uploader
    if (url) {
      galleryUrls.push({ url, name: file.name });
    }
  }
}



// 2.5️⃣ Upload downloadable files — use SAME helper you used for Link "Result Files"
const downloadUrls = [];
const downloadFilesToUpload =
  currentDownloadFiles.length
    ? currentDownloadFiles
    : Array.from(shopProductFiles?.files || []);

if (downloadFilesToUpload.length) {
  for (const file of downloadFilesToUpload) {
    const meta = await uploadLinkFile(file);   // ✅ files → file uploader
    if (meta && meta.url) {
      // keep same shape as you used on the Link side
      downloadUrls.push({ url: meta.url, name: meta.name || file.name });
    }
  }
}



    // 3️⃣ Build Product values

    // Existing gallery / downloads (already saved in DB)
    const existingGallery = Array.isArray(currentEditingProduct?.gallery)
      ? currentEditingProduct.gallery
      : [];

    const existingDownloads = Array.isArray(currentEditingProduct?.downloads)
      ? currentEditingProduct.downloads
      : [];

    // Combine existing (minus removed ones) + new uploads
    const finalGallery   = existingGallery.concat(galleryUrls);
    const finalDownloads = existingDownloads.concat(downloadUrls);

    const values = {
      "Product Name": title,
      "Name":         title,
      "Quantity":     isNaN(qtyNum) ? null : qtyNum,
      "Price":        isNaN(priceNum) ? null : priceNum,
      "Sale Price":   isNaN(saleNum) ? null : saleNum,
      "Description":  description || null,

      "Default Image":   defaultImageUrl ?? currentEditingProduct?.image ?? null,
      "Gallery Images":  finalGallery.length   ? finalGallery   : null,
      "Download Files":  finalDownloads.length ? finalDownloads : null,

      "Link Page":   { _id: pageId },
      "Created By":  { _id: uid },
      "Deleted At":  null,
    };

    console.log("[shop] saving Product with values:", values);

    let savedProduct;
    const editingId = currentEditingProduct?.id || null;

    if (editingId) {
      // 🔁 EDIT EXISTING PRODUCT
      savedProduct = await window.fetchJSON(`/api/records/Product/${editingId}`, {
        method: "PATCH",
        body: JSON.stringify({ values }),
      });
    } else {
      // 🆕 CREATE NEW PRODUCT
      savedProduct = await window.fetchJSON("/api/records/Product", {
        method: "POST",
        body: JSON.stringify({ values }),
      });

      const productId = savedProduct._id || savedProduct.id;
      console.log("[shop] saved Product:", savedProduct);

      if (productId) {
        await attachProductToPage(pageId, productId);
      }
    }

    alert("Product saved!");

    currentEditingProduct = null;
    currentGalleryFiles   = [];
    currentDownloadFiles  = [];
    if (shopProductEditor) shopProductEditor.style.display = "none";

    await loadAllProductsForCurrentUser();
    applyShopFilterByPage();

  } catch (err) {
    console.error("[shop] failed to save product:", err);
    alert("Could not save product: " + (err.message || err));
  }
});

//Save Product
// Attach a Product record to a Link Page's "Product(s)" field
async function attachProductToPage(pageId, productId) {
  if (!pageId || !productId) return;

  window.__LINKPAGE_CACHE = window.__LINKPAGE_CACHE || {};
  const cache = window.__LINKPAGE_CACHE;

  // 1️⃣ Load current Link Page (for existing Product(s))
  let existing;
  try {
    existing = await window.fetchJSON(`/api/records/Link Page/${pageId}`);
  } catch (err) {
    console.warn("[shop] could not load page for attachProduct; using cache only", err);
    existing = cache[pageId];
  }

  const v = (existing && (existing.values || existing)) || {};
  const currentRefs = Array.isArray(v["Product(s)"]) ? v["Product(s)"] : [];

  // avoid duplicates
  const already = currentRefs.some((r) => (r._id || r.id) === productId);
  const newRefs  = already ? currentRefs : [...currentRefs, { _id: productId }];

  // 2️⃣ PATCH just Product(s)
  const savedPage = await window.fetchJSON(`/api/records/Link Page/${pageId}`, {
    method: "PATCH",
    body: JSON.stringify({
      values: { "Product(s)": newRefs },
    }),
  });

  // 3️⃣ update cache
  cache[pageId] = savedPage;
}

// Fill the Shop dropdown with the same link pages
async function hydrateShopLinkpageDropdown(selectedId) {
  if (!shopLinkpageSelect) return;

  shopLinkpageSelect.innerHTML = `<option value="">Loading your link pages…</option>`;

  try {
    await window.requireUser().catch(() => null);
    const pages = await listLinkPagesForCurrentUser();

    if (!pages.length) {
      shopLinkpageSelect.innerHTML = `<option value="">No link pages yet</option>`;
      return;
    }

    shopLinkpageSelect.innerHTML = `<option value="">Select a link page…</option>`;

    pages.forEach((p) => {
      const opt = document.createElement("option");
      opt.value = p.id;
      opt.textContent = p.slug ? `${p.name} — /${p.slug}` : p.name;
      if (selectedId && selectedId === p.id) {
        opt.selected = true;
      }
      shopLinkpageSelect.appendChild(opt);
    });
  } catch (err) {
    console.error("[shop] hydrateShopLinkpageDropdown failed:", err);
    shopLinkpageSelect.innerHTML = `<option value="">Couldn’t load link pages</option>`;
  }
}




// Get ALL products created by this user (any link page)
async function loadAllProductsForCurrentUser() {
  const uid =
    window.STATE?.user?.userId ||
    window.STATE?.userId ||
    window.STATE?.user?.id ||
    "";

  if (!uid) {
    allShopProducts = [];
    renderShopProductsTable([]);
    return;
  }

  const params = new URLSearchParams();
  params.set("dataType", "Product");
  params.set("limit", "500");
  params.set("Created By", uid);

  const res = await fetch(`${API_ORIGIN}/public/records?${params.toString()}`, {
    credentials: "include",
    headers: { Accept: "application/json" },
  });

  if (!res.ok) {
    console.error("[shop] loadAllProductsForCurrentUser HTTP", res.status);
    allShopProducts = [];
    renderShopProductsTable([]);
    return;
  }

  const data = await res.json();
  const rows = Array.isArray(data) ? data : data.records || data.items || [];

  const products = rows
    .map((row) => {
      const v = row.values || row;          // 👈 v is defined HERE

      // Skip soft-deleted products
      if (v["Deleted At"]) return null;

      const lpRef      = v["Link Page"];
      const linkPageId = lpRef && (lpRef._id || lpRef.id);

      const name = v["Product Name"] || v["Name"] || "";

      const description =
        v["Description"] ||
        v["Product Description"] ||
        "";

      const galleryRaw = v["Gallery Images"];
        const downloadsRaw = v["Download Files"];
  const downloads = Array.isArray(downloadsRaw) ? downloadsRaw : [];

      const gallery = Array.isArray(galleryRaw) ? galleryRaw : [];

      
      const image =
        v["Default Image"] ||
        (gallery[0] && gallery[0].url) ||
        "";

      return {
        id:        row._id || row.id,
        title:     name,
        name, // for renderShopProductsTable(p.name)
        qty:       v["Quantity"] ?? null,
        price:     v["Price"] ?? null,
        salePrice: v["Sale Price"] ?? null,
        image,
        description,
        gallery,
           downloads, 
        linkPageId,
      };
    })
    .filter(Boolean); // remove nulls

  allShopProducts = products;
  console.log("[shop] loaded products:", allShopProducts);

  // Re-draw table using current dropdown filter
  applyShopFilterByPage();
}


// Apply current dropdown filter to allShopProducts
// Apply current dropdown filter to allShopProducts
async function applyShopFilterByPage() {
  const pageId = shopLinkpageSelect?.value || "";

  // No page selected → show ALL products by this user
  if (!pageId) {
    renderShopProductsTable(allShopProducts);
    return;
  }

  // Only products that belong to this page
  const filtered = allShopProducts.filter(
    (p) => p.linkPageId && String(p.linkPageId) === String(pageId)
  );

  // Try to order them using the Link Page's "Product(s)" array
  try {
    const page = await window.fetchJSON(`/api/records/Link Page/${pageId}`);
    const v = (page && (page.values || page)) || {};
    const refs = Array.isArray(v["Product(s)"]) ? v["Product(s)"] : [];

    // Build an array of product ids in the saved order
    const idOrder = refs.map((r) => String(r._id || r.id || r));

    // Sort the filtered products to match that order
    filtered.sort((a, b) => {
      const ai = idOrder.indexOf(String(a.id));
      const bi = idOrder.indexOf(String(b.id));

      if (ai === -1 && bi === -1) return 0;
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });
  } catch (err) {
    console.warn("[shop] could not load page for order:", err);
    // if this fails we just fall back to whatever order `filtered` already had
  }

  renderShopProductsTable(filtered);
}

// When dropdown changes → JUST re-filter
shopLinkpageSelect?.addEventListener("change", () => {
  applyShopFilterByPage();
});

// On auth ready: hydrate dropdown, then load all products once
document.addEventListener("auth:ready", () => {
  (typeof hydrateShopLinkpageDropdown === "function"
    ? hydrateShopLinkpageDropdown()
    : Promise.resolve())
    .then(loadAllProductsForCurrentUser)   // fills allShopProducts
    .then(refreshDashboardTotals)          // updates counts on dashboard
    .then(hydrateOrdersFilterDropdown)     // 🔹 now fills Orders dropdown
    .catch((err) => console.error("[lp] init error:", err));
});




function resetProductEditorFields() {
  if (shopProductTitleEl)     shopProductTitleEl.value = "";
  if (shopProductQtyEl)       shopProductQtyEl.value   = "";
  if (shopProductPriceEl)     shopProductPriceEl.value = "";
  if (shopProductSaleEl)      shopProductSaleEl.value  = "";
  if (shopProductDescEl)      shopProductDescEl.value  = "";

  if (shopProductDefaultImg)  shopProductDefaultImg.value = "";
  if (shopProductDefaultPrev) {
    shopProductDefaultPrev.src = "";
    shopProductDefaultPrev.style.display = "none";
  }

  if (shopProductGallery)     shopProductGallery.value = "";
  if (shopProductGalleryList) shopProductGalleryList.innerHTML = "";

  if (shopProductFiles)       shopProductFiles.value = "";
  if (shopProductFilesList)   shopProductFilesList.innerHTML = "";

  currentGalleryFiles  = [];
  currentDownloadFiles = [];
}


// Open editor for an existing product
function openProductEditorFor(product) {
  currentEditingProduct = product || null;
currentGalleryFiles = []; 

  // 🔹 NEW: preselect the link page this product belongs to
  if (product && product.linkPageId) {
    const lpId = String(product.linkPageId);

    if (shopLinkpageSelect) {
      shopLinkpageSelect.value = lpId;

      // optional: re-filter table so you're "inside" that page's shop
      applyShopFilterByPage();
    }

    // OPTIONAL: keep your main linkpageSelect in sync too
    if (typeof linkpageSelect !== "undefined" && linkpageSelect) {
      linkpageSelect.value = lpId;
      // if other logic listens to "change" on this dropdown:
      linkpageSelect.dispatchEvent(new Event("change"));
    }
  }

  if (!shopProductEditor) return;
  shopProductEditor.style.display = "block";

  // Fill fields
  if (shopProductTitleEl) shopProductTitleEl.value = product.title || "";
  if (shopProductQtyEl)   shopProductQtyEl.value   = product.qty ?? "";

  if (shopProductPriceEl)
    shopProductPriceEl.value = product.price != null ? product.price : "";

  if (shopProductSaleEl)
    shopProductSaleEl.value = product.salePrice != null ? product.salePrice : "";

  if (shopProductDescEl)
    shopProductDescEl.value = product.description || "";

  // Default image preview (keep file input empty)
  if (shopProductDefaultImg) shopProductDefaultImg.value = "";
  if (shopProductDefaultPrev) {
    if (product.image) {
      shopProductDefaultPrev.src = product.image;
      shopProductDefaultPrev.style.display = "block";
    } else {
      shopProductDefaultPrev.src = "";
      shopProductDefaultPrev.style.display = "none";
    }
  }

  // Gallery list
// Gallery list – show existing saved images
if (shopProductGallery) shopProductGallery.value = "";
if (shopProductGalleryList) {
  shopProductGalleryList.innerHTML = "";
  currentGalleryFiles = [];  // no new files yet

  if (Array.isArray(product.gallery)) {
   product.gallery.forEach((g) => {
  const wrapper = document.createElement("div");
  wrapper.className = "shop-gallery-item";

  const img = document.createElement("img");
  img.className = "shop-gallery-thumb";
  img.src = g.url || "";
  img.alt = g.name || product.title || "Gallery image";

  const removeBtn = document.createElement("button");
  removeBtn.type = "button";
  removeBtn.className = "shop-gallery-remove";
  removeBtn.textContent = "×";

  removeBtn.addEventListener("click", () => {
    if (
      currentEditingProduct &&
      Array.isArray(currentEditingProduct.gallery)
    ) {
      currentEditingProduct.gallery =
        currentEditingProduct.gallery.filter((gg) => gg !== g);
    }
    wrapper.remove();
  });

  wrapper.appendChild(img);
  wrapper.appendChild(removeBtn);
  shopProductGalleryList.appendChild(wrapper);
});

  }
}
  // Files list – show existing saved files
  if (shopProductFiles) shopProductFiles.value = "";
  if (shopProductFilesList) {
    shopProductFilesList.innerHTML = "";
    currentDownloadFiles = [];  // no new files yet

   // Existing files when editing
if (Array.isArray(product.downloads)) {
  product.downloads.forEach((d) => {
    const wrapper = document.createElement("div");
    wrapper.className = "shop-file-item";

    const nameLink = document.createElement("a");
    nameLink.className = "shop-file-name";
    nameLink.textContent = d.name || d.url || "Download";
    nameLink.href = d.url || "#";
    nameLink.target = "_blank";
    nameLink.rel = "noopener noreferrer";

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "shop-file-remove";
    removeBtn.textContent = "×";

    removeBtn.addEventListener("click", () => {
      if (
        currentEditingProduct &&
        Array.isArray(currentEditingProduct.downloads)
      ) {
        currentEditingProduct.downloads =
          currentEditingProduct.downloads.filter((dd) => dd !== d);
      }
      wrapper.remove();
    });

    wrapper.appendChild(nameLink);
    wrapper.appendChild(removeBtn);
    shopProductFilesList.appendChild(wrapper);
  });
}
  }
}

// Files customer receives: allow multiple picks and show with remove button
shopProductFiles?.addEventListener("change", () => {
  if (!shopProductFiles || !shopProductFilesList) return;

  const newlySelected = Array.from(shopProductFiles.files || []);
  if (!newlySelected.length) return;

  newlySelected.forEach((file) => {
    // ✅ track in download files array, NOT gallery
    currentDownloadFiles.push(file);

    // ✅ wrapper for each file "pill"
    const wrapper = document.createElement("div");
    wrapper.className = "shop-file-item";

    // ✅ file name text
    const nameSpan = document.createElement("span");
    nameSpan.className = "shop-file-name";
    nameSpan.textContent = file.name;

    // ✅ remove button
    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "shop-file-remove";
    removeBtn.textContent = "×";

    removeBtn.addEventListener("click", () => {
      // remove this file from the list of new files
      currentDownloadFiles = currentDownloadFiles.filter((f) => f !== file);
      wrapper.remove();
    });

    wrapper.appendChild(nameSpan);
    wrapper.appendChild(removeBtn);
    shopProductFilesList.appendChild(wrapper);
  });

  // allow user to pick another batch
  shopProductFiles.value = "";
});



//Delete Product 
// Soft delete a Product record
// 🔄 REPLACE your existing softDeleteProduct with this
async function softDeleteProduct(productId) {
  if (!productId) return;

  await window.fetchJSON(`/api/records/Product/${productId}`, {
    method: "DELETE",
  });
}
// 🔹 Remove a Product from a Link Page's "Product(s)" array
async function detachProductFromPage(pageId, productId) {
  if (!pageId || !productId) return;

  window.__LINKPAGE_CACHE = window.__LINKPAGE_CACHE || {};
  const cache = window.__LINKPAGE_CACHE;

  let existing;
  try {
    existing = await window.fetchJSON(`/api/records/Link Page/${pageId}`);
  } catch (err) {
    console.warn("[shop] could not load page for detachProduct; using cache only", err);
    existing = cache[pageId];
  }

  const v = (existing && (existing.values || existing)) || {};
  const currentRefs = Array.isArray(v["Product(s)"]) ? v["Product(s)"] : [];

  const newRefs = currentRefs.filter((r) => {
    const id = r && (r._id || r.id || r);
    return String(id) !== String(productId);
  });

  const savedPage = await window.fetchJSON(`/api/records/Link Page/${pageId}`, {
    method: "PATCH",
    body: JSON.stringify({
      values: { "Product(s)": newRefs },
    }),
  });

  cache[pageId] = savedPage;
}

function renderShopProductsTable(products) {
  if (!shopProductsTbody) return;
  shopProductsTbody.innerHTML = "";

  products.forEach((p) => {
    const tr = document.createElement("tr");
    tr.className = "shop-product-row";
    tr.dataset.productId = p.id;
    tr.draggable = true; // row is draggable

    // 🔹 SINGLE grabber cell (the middle one you like)
    const grabTd = document.createElement("td");
    grabTd.className = "grab-col";
    grabTd.innerHTML = `
      <div class="drag-handle">
        <span></span><span></span><span></span>
        <span></span><span></span><span></span>
      </div>
    `;
    tr.appendChild(grabTd);

    // 🔹 Image cell
    const imgTd = document.createElement("td");
    const img = document.createElement("img");
    img.className = "shop-product-thumb";
    img.src =
      p.image || p.defaultImageUrl || "/qassets/img/product-placeholder.png";
    img.alt = p.title || p.name || "Product";
    imgTd.appendChild(img);

    // Title cell
    const titleTd = document.createElement("td");
    titleTd.textContent = p.name || "";

    // Qty
    const qtyTd = document.createElement("td");
    qtyTd.textContent = (p.qty ?? "") + "";

    // Price
    const priceTd = document.createElement("td");
    priceTd.textContent =
      typeof p.price === "number" ? `$${p.price.toFixed(2)}` : "";

    // Sale price
    const saleTd = document.createElement("td");
    saleTd.textContent =
      typeof p.salePrice === "number" ? `$${p.salePrice.toFixed(2)}` : "";

    // 🔹 Actions cell with Delete button
    const actionsTd = document.createElement("td");
    const delBtn = document.createElement("button");
    delBtn.type = "button";
    delBtn.textContent = "Delete";
    delBtn.className = "btn btn-sm danger";

    delBtn.addEventListener("click", async (e) => {
      e.stopPropagation(); // don’t open editor

      const ok = window.confirm("Delete this product from your shop?");
      if (!ok) return;

      try {
        await softDeleteProduct(p.id);

        const pageId = shopLinkpageSelect?.value || "";
        if (pageId) {
          await detachProductFromPage(pageId, p.id);
        }

        await loadAllProductsForCurrentUser();
        applyShopFilterByPage();
      } catch (err) {
        console.error("[shop] row delete failed:", err);
        alert("Could not delete product: " + (err.message || err));
      }
    });

    actionsTd.appendChild(delBtn);

    // Append remaining cells
    tr.appendChild(imgTd);
    tr.appendChild(titleTd);
    tr.appendChild(qtyTd);
    tr.appendChild(priceTd);
    tr.appendChild(saleTd);
    tr.appendChild(actionsTd);

    // Row click → open editor
    tr.addEventListener("click", () => {
      openProductEditorFor(p);
    });

    shopProductsTbody.appendChild(tr);
  });
}


// =======================
// Product row reordering
// =======================
let draggingProductRow = null;

function getDragAfterProduct(container, y) {
  const rows = Array.from(
    container.querySelectorAll(".shop-product-row:not(.is-dragging)")
  );

  let closest = { offset: Number.NEGATIVE_INFINITY, element: null };

  rows.forEach((row) => {
    const box = row.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;
    if (offset < 0 && offset > closest.offset) {
      closest = { offset, element: row };
    }
  });

  return closest.element;
}

if (shopProductsTbody) {
  shopProductsTbody.addEventListener("dragstart", (e) => {
    const row = e.target.closest(".shop-product-row");
    if (!row) return;
    draggingProductRow = row;
    row.classList.add("is-dragging");
    e.dataTransfer.effectAllowed = "move";
  });

  shopProductsTbody.addEventListener("dragover", (e) => {
    e.preventDefault();
    if (!draggingProductRow) return;

    const afterElement = getDragAfterProduct(shopProductsTbody, e.clientY);
    if (afterElement == null) {
      shopProductsTbody.appendChild(draggingProductRow);
    } else {
      shopProductsTbody.insertBefore(draggingProductRow, afterElement);
    }
  });

shopProductsTbody.addEventListener("dragend", async () => {
  if (!draggingProductRow) return;

  draggingProductRow.classList.remove("is-dragging");
  draggingProductRow = null;

  const orderedIds = Array.from(
    shopProductsTbody.querySelectorAll(".shop-product-row")
  ).map((row) => row.dataset.productId);

  const pageId = shopLinkpageSelect?.value || "";

  console.log("[shop] dragend, orderedIds =", orderedIds, "pageId =", pageId);

  if (!pageId) {
    alert("Select a link page at the top of the Shop panel before re-ordering.");
    return;
  }

  try {
    await saveProductOrderOnPage(pageId, orderedIds);
    console.log("[shop] order saved for page", pageId);
  } catch (err) {
    console.error("[shop] save order failed:", err);
  }
});
}



// 🔄 Save the order of Product(s) on a Link Page,
// based on the array of product ids in DOM order.
async function saveProductOrderOnPage(pageId, orderedIds) {
  if (!pageId || !Array.isArray(orderedIds)) return;

  window.__LINKPAGE_CACHE = window.__LINKPAGE_CACHE || {};
  const cache = window.__LINKPAGE_CACHE;

  let existing;
  try {
    existing = await window.fetchJSON(`/api/records/Link Page/${pageId}`);
  } catch (err) {
    console.warn("[shop] could not load page for saveProductOrder; using cache only", err);
    existing = cache[pageId];
  }

  const v = (existing && (existing.values || existing)) || {};
  const currentRefs = Array.isArray(v["Product(s)"]) ? v["Product(s)"] : [];

  // Map current refs by id so we can reorder them safely
  const byId = {};
  currentRefs.forEach((r) => {
    const id = r && (r._id || r.id || r);
    if (!id) return;
    byId[String(id)] = r;
  });

  const newRefs = [];
  orderedIds.forEach((id) => {
    const ref = byId[String(id)];
    if (ref) newRefs.push(ref);
  });

  // If for some reason there are refs not currently in the table,
  // keep them at the end.
  currentRefs.forEach((r) => {
    const id = r && (r._id || r.id || r);
    if (!id) return;
    if (!orderedIds.includes(String(id))) {
      newRefs.push(r);
    }
  });

  const savedPage = await window.fetchJSON(`/api/records/Link Page/${pageId}`, {
    method: "PATCH",
    body: JSON.stringify({
      values: { "Product(s)": newRefs },
    }),
  });

  cache[pageId] = savedPage;
}













                        ////////////////////////////////////////////////////////////////////
                                                             //Orders Section
                          ////////////////////////////////////////////////////////////////////

// DOM
const ordersFilterSelect = document.getElementById("orders-filter-select");
const ordersTbody        = document.getElementById("orders-tbody");
const ordersEmptyRow     = document.getElementById("orders-empty-row");

// ---------- Helper to get current user id ----------
function getCurrentUserId() {
  return (
    window.STATE?.user?.userId ||
    window.STATE?.userId ||
    window.STATE?.user?.id ||
    ""
  );
}

// ---------- Normalize a single Order row ----------
function normalizeOrder(row) {
  const v = row.values || row;

  // log once so we can see shape
  if (!normalizeOrder._loggedOnce) {
    console.log("[orders] sample Order values:", v);
    normalizeOrder._loggedOnce = true;
  }

  // Items (array or JSON string)
  let itemsRaw = v["Items"] || v["Order Items"] || [];
  let items = [];
  if (Array.isArray(itemsRaw)) {
    items = itemsRaw;
  } else if (typeof itemsRaw === "string") {
    try {
      items = JSON.parse(itemsRaw);
    } catch {
      items = [];
    }
  }
  const firstItem = items[0] || {};

  // Product title
  const productTitle =
    firstItem.title ||
    firstItem.name ||
    v["Product Title"] ||
    v["Product Name"] ||
    "—";

  // Product image
  const productImage =
    firstItem.image ||
    firstItem.defaultImage ||
    (Array.isArray(firstItem.gallery) && firstItem.gallery[0]?.url) ||
    "";

  // ---------- CUSTOMER LABEL ----------
  // start with any simple string fields on the Order
  // ---------- CUSTOMER LABEL ----------
  // 1️⃣ Prefer snapshot fields saved directly on the Order
  let customerLabel =
    v["Customer Name"] ||
    v["Client Name"] ||
    v["Customer Full Name"] ||
    [v["Customer First Name"], v["Customer Last Name"]]
      .filter(Boolean)
      .join(" ")
      .trim() ||
    v["Customer Email"] ||
    v["Email"] ||
    "—";

  const customerRef = v["Customer"] || v["Client"] || v["Customer Ref"];

  console.log("[orders] raw Customer field:", v["Customer"]);
  console.log("[orders] resolved customerRef:", customerRef);

  let refId = "";

  // 2️⃣ Use the referenced Customer record *only* if it has a real name/email
  if (customerRef && typeof customerRef === "object") {
    const cv = customerRef.values || customerRef;
    console.log("[orders] customer values:", cv);

    refId = String(cv._id || cv.id || "");

    const first =
      cv["First Name"] ||
      cv["Firstname"] ||
      cv["First"] ||
      cv.firstName ||
      cv.firstname ||
      cv.first ||
      "";
    const last =
      cv["Last Name"] ||
      cv["Lastname"] ||
      cv["Last"] ||
      cv.lastName ||
      cv.lastname ||
      cv.last ||
      "";

    const nameFromRef =
      cv["Name"] ||
      cv["Full Name"] ||
      [first, last].filter(Boolean).join(" ").trim();

    const emailFromRef =
      cv["Email"] ||
      cv["Email Address"] ||
      cv.email ||
      "";

    const refLabel = nameFromRef || emailFromRef || "";

    // only override if snapshot label is empty / placeholder
    const isSnapshotMissing =
      !customerLabel || customerLabel === "—" ||
      /^User \d{4}$/.test(customerLabel);

    if (refLabel && isSnapshotMissing) {
      customerLabel = refLabel;
    }
  }

  // 3️⃣ Final fallback – only if we STILL have nothing
  if ((!customerLabel || customerLabel === "—") && (v["Customer"] || refId)) {
    const id =
      refId ||
      String(
        (v["Customer"] && (v["Customer"]._id || v["Customer"].id || v["Customer"])) ||
        ""
      );
    if (id) {
      const short = String(id).slice(-4);
      customerLabel = `User ${short}`;
    }
  }

  // Items count
  const itemsCount =
    v["Items Count"] ??
    v["Quantity"] ??
    (items.length || 1);

  // Totals
  const totalNum =
    v["Total"] ??
    v["Order Total"] ??
    v["Subtotal"] ??
    null;

  // Status fields
  const status        = v["Status"] || "saved";
  const paymentStatus = v["Payment Status"] || v["PaymentStatus"] || "—";

  return {
    id:           row._id || row.id,
    productTitle,
    productImage,
    customerLabel,
    itemsCount,
    totalNum,
    status,
    paymentStatus,
  };
}

// ---------- Render rows using normalizeOrder ----------
function renderOrdersTable(rows) {
  if (!ordersTbody) return;
  ordersTbody.innerHTML = "";

  if (!rows || rows.length === 0) {
    if (ordersEmptyRow) ordersEmptyRow.style.display = "";
    return;
  }
  if (ordersEmptyRow) ordersEmptyRow.style.display = "none";

  rows.forEach((row) => {
    const o = normalizeOrder(row);      // 👈 flatten everything here

    const tr = document.createElement("tr");

    // Image
// Image
const imgTd = document.createElement("td");
const img = document.createElement("img");
img.className = "shop-product-thumb";

// main src
img.src = o.productImage || "/qassets/img/product-placeholder.png";

// ✅ if the URL 404s, fall back to placeholder
img.onerror = () => {
  img.onerror = null; // avoid infinite loop
  img.src = "/qassets/img/product-placeholder.png";
};

img.alt = o.productTitle || "Product";
imgTd.appendChild(img);


    // Product title
    const productTd = document.createElement("td");
    productTd.textContent = o.productTitle || "—";

    // Customer
    const customerTd = document.createElement("td");
    customerTd.textContent = o.customerLabel || "—";

    // Items
    const itemsTd = document.createElement("td");
    itemsTd.textContent = String(o.itemsCount || 1);

    // Total
    const totalTd = document.createElement("td");
   const totalText =
  typeof o.totalNum === "number" && !isNaN(o.totalNum)
    ? `$${o.totalNum.toFixed(2)}`
    : "—";

    totalTd.textContent = totalText;

    // Status
    const statusTd = document.createElement("td");
    statusTd.textContent = o.status || "—";

    // Payment Status
    const payStatusTd = document.createElement("td");
    payStatusTd.textContent = o.paymentStatus || "—";

    tr.appendChild(imgTd);
    tr.appendChild(productTd);
    tr.appendChild(customerTd);
    tr.appendChild(itemsTd);
    tr.appendChild(totalTd);
    tr.appendChild(statusTd);
    tr.appendChild(payStatusTd);

    ordersTbody.appendChild(tr);
  });
}

// ---------- Load orders for this user (optionally filtered by link page) ----------
// Load orders for this user (optionally filtered by link page)
async function loadOrdersForCurrentUser(filterPageId = "") {
  const uid = getCurrentUserId();
  if (!uid) {
    renderOrdersTable([]);
    return;
  }

  const params = new URLSearchParams();
  params.set("dataType", "Order");
  params.set("limit", "200");
  // let the server scope to "me", but still include metadata + refs
  params.set("includeCreatedBy", "1");
  params.set("includeRefField", "1");

  // If you store a Link Page reference on Order, filter by it:
  if (filterPageId) {
    params.set("Link Page", filterPageId);
  }

  const res = await fetch(
    `${API_ORIGIN}/api/me/records?${params.toString()}`,
    {
      credentials: "include",
      headers: { Accept: "application/json" },
    }
  );

  if (!res.ok) {
    console.warn("[orders] HTTP", res.status);
    renderOrdersTable([]);
    return;
  }

  const body = await res.json().catch(() => ({}));
  const rows =
    Array.isArray(body.data)    ? body.data :
    Array.isArray(body.records) ? body.records :
    Array.isArray(body.items)   ? body.items :
    [];

  renderOrdersTable(rows);
}


// ---------- Simple filter dropdown: list of link pages ----------
async function hydrateOrdersFilterDropdown() {
  if (!ordersFilterSelect) {
    // no dropdown in DOM; just load all orders
    await loadOrdersForCurrentUser();
    return;
  }

  ordersFilterSelect.innerHTML =
    `<option value="">All orders (all link pages)</option>`;

  try {
    await window.requireUser().catch(() => null);
    const pages = await listLinkPagesForCurrentUser();

    pages.forEach((p) => {
      const opt = document.createElement("option");
      opt.value = p.id; // treat this as Link Page id
      opt.textContent = p.slug ? `${p.name} — /${p.slug}` : p.name;
      ordersFilterSelect.appendChild(opt);
    });
  } catch (err) {
    console.error("[orders] hydrateOrdersFilterDropdown failed:", err);
  }

  ordersFilterSelect.addEventListener("change", () => {
    const pageId = ordersFilterSelect.value || "";
    loadOrdersForCurrentUser(pageId);
  });
}

// ---------- Init (after auth) ----------
document.addEventListener("auth:ready", () => {
  hydrateOrdersFilterDropdown();
  loadOrdersForCurrentUser(); // all orders by default
});






});

