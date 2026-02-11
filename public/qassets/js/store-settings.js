
 //* store-settings.js  

/* ===================== API HELPERS (MUST BE FIRST) ===================== */
// use API server in dev, same-origin in prod
/* ===================== API HELPERS (MUST BE FIRST) ===================== */
// use API server in dev, same-origin in prod
const API_ORIGIN = (location.hostname === "localhost")
  ? "http://localhost:8400"
  : ""; // same origin in prod

// ✅ aliases so older code still works
const API_BASE = API_ORIGIN;
window.API_ORIGIN = API_ORIGIN;
window.API_BASE = API_BASE;


const apiUrl = (path) =>
  `${API_ORIGIN}${path.startsWith("/api") ? path : `/api${path.startsWith("/") ? path : `/${path}`}`}`;

async function apiFetch(path, opts = {}) {
  return fetch(apiUrl(path), {
    credentials: "include", // send connect.sid
    headers: { Accept: "application/json", ...(opts.headers || {}) },
    ...opts,
  });
}

window.fetchJSON = async function fetchJSON(path, opts = {}) {
  const res = await apiFetch(path, {
    headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
    ...opts,
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { error: text }; }
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
};



/* ===================== GLOBAL STATE + HELPERS ===================== */

window.getCurrentStoreId = function () {
  return window.STATE?.storeId || "";
};

window.setCurrentStoreId = function (id) {
  window.STATE.storeId = id || "";
  document.dispatchEvent(new CustomEvent("store:change", { detail: { id: id || "" } }));
};



/* ===================== GLOBAL STATE + HELPERS ===================== */

// Cache DataType ids by name (global so all modules use the same one)
window.__DTYPE_CACHE = window.__DTYPE_CACHE || {};
window.getTypeId = window.getTypeId || async function getTypeId(name) {
  const cache = window.__DTYPE_CACHE;
  if (cache[name]) return cache[name];
  const list = await window.fetchJSON('/api/datatypes');
  const canon = (s) => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
  const hit = (list || []).find(
    (dt) => canon(dt.name) === canon(name) || canon(dt.nameCanonical) === canon(name)
  );
  if (!hit) throw new Error(`DataType not found: ${name}`);
  cache[name] = hit._id;
  return hit._id;
};

/* ===================== AUTH MODULE ===================== */
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
      statusEl && (statusEl.textContent = u.firstName ? `Hi, ${u.firstName}` : (u.email || 'Signed in'));
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
      const res = await apiFetch('/api/me', { headers: { 'Accept': 'application/json' } });
      const text = await res.text();
      let data; try { data = JSON.parse(text); } catch { data = {}; }

      // { ok:true, user:{...} } OR { user:{...} } OR { ok, session:{ user } }
      const user = data?.user || data?.data?.user || (data?.ok && data?.session?.user) || null;
      console.log('[auth] /api/me payload:', data);

      if (user && (user._id || user.id)) {
        window.STATE.user = {
          loggedIn: true,
          userId: user._id || user.id,
          email: user.email || '',
          firstName: user.firstName || user.name || ''
        };
      } else {
        window.STATE.user = { loggedIn: false, userId: null, email: '' };
      }
    } catch (e) {
      console.warn('[auth] hydrateUser failed:', e);
      window.STATE.user = { loggedIn: false, userId: null, email: '' };
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
  modal    && modal.addEventListener('click', (e) => { if (e.target === modal) closeAuth(); });

  logoutBtn && logoutBtn.addEventListener('click', async () => {
    try { await window.fetchJSON('/api/logout', { method: 'POST' }); } catch {}
    window.STATE.user = { loggedIn: false, userId: null, email: '' };
    setAuthUI();
  });

  form && form.addEventListener('submit', async (e) => {
    e.preventDefault();
    console.log('[auth] submit clicked');
    errEl && (errEl.textContent = '');
    setBusy(true);
    try {
      const r = await apiFetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ email: emailEl.value.trim(), password: passEl.value })
      });
      const t = await r.text();
      let d; try { d = JSON.parse(t); } catch { d = { error: t }; }
      if (!r.ok || d.error) throw new Error(d.error || `HTTP ${r.status}`);

      await hydrateUser();
      closeAuth();
    } catch (err) {
      errEl && (errEl.textContent = err.message || 'Login failed');
    } finally {
      setBusy(false);
    }
  });

  // Initial session check → announce ready
  hydrateUser()
    .catch(() => {})
    .finally(() => { document.dispatchEvent(new Event('auth:ready')); });
})();


// Theme Section (global)
window.selectedThemeId = null;



/* ===================== //////////////////////////////// ===================== */
                       //BASIC SIDEBAR / NAV (unchanged)
//////////////////////////////////////////////////////////////////////////////////

(() => {
  const app = document.getElementById('app');
  const nav = document.getElementById('nav');
  const sections = Array.from(document.querySelectorAll('.section'));

  document.getElementById('collapseBtn')?.addEventListener('click', () => {
    app?.classList.toggle('collapsed');
  });

  nav?.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-target]');
    if (!btn) return;
    const targetId = btn.dataset.target;

    nav.querySelectorAll('button').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');

    sections.forEach((sec) => { sec.classList.toggle('active', sec.id === targetId); });
  });

  nav?.addEventListener('keydown', (e) => {
    const buttons = Array.from(nav.querySelectorAll('button'));
    const i = buttons.findIndex((b) => b.classList.contains('active'));
    if (e.key === 'ArrowDown') {
      const next = buttons[(i + 1) % buttons.length];
      next.focus(); next.click(); e.preventDefault();
    } else if (e.key === 'ArrowUp') {
      const prev = buttons[(i - 1 + buttons.length) % buttons.length];
      prev.focus(); prev.click(); e.preventDefault();
    }
  });
})();






//show the elements of the theme inside the card












































































////////////////////////////////////////////////////////////////////////////////////
                                // STORE SECTION
////////////////////////////////////////////////////////////////////////////////////
//Temporarily make the store section open automatically 
(() => {
  const nav = document.getElementById("nav");
  if (!nav) return;

  // set active button
  nav.querySelectorAll("button").forEach((b) => b.classList.remove("active"));
  nav.querySelector('button[data-target="store"]')?.classList.add("active");

  // show store section
  document.querySelectorAll(".section").forEach((sec) => {
    sec.classList.toggle("active", sec.id === "store");
  });
})();
///////////////////////////////////////////////////////////

//Store Dropdown
(() => {
  const dd = document.getElementById("store-dd");
  if (!dd) return;

  const STORE_LS_KEY = "ss_current_store_id";

  const escapeHtml = (s) =>
    (s || "").replace(/[&<>"']/g, (m) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[m]));

async function listMyStores() {
  // ensure user is logged in and STATE.user is hydrated
  await window.requireUser();
  const uid = window.STATE?.user?.userId;

  const res = await fetch(
    `${API_ORIGIN}/api/records/${encodeURIComponent("Store")}?limit=200&ts=${Date.now()}`,
    { credentials: "include", headers: { Accept: "application/json" }, cache: "no-store" }
  );

  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  // ✅ NEW: normalize response shape
  const payload = await res.json();
  const rows = Array.isArray(payload) ? payload : (payload.items || payload.records || []);

  // ✅ NEW: remove soft-deleted
  const visible = rows.filter(r => !r?.deletedAt);

  // ✅ keep your "mine" logic (if your server doesn't already filter by createdBy)
  const mine = visible.filter((r) => {
    const rootCreated = r?.createdBy && String(r.createdBy) === String(uid);
    const valCreated =
      r?.values?.["Created By"]?._id &&
      String(r.values["Created By"]._id) === String(uid);
    return rootCreated || valCreated;
  });

  return mine.length ? mine : visible;
}



async function setCurrentStore(id) {
  window.STATE = window.STATE || {};
  window.STATE.storeId = id || "";
  window.setCurrentStoreId(id || "");

  // ✅ remember last used store (local)
  try { localStorage.setItem(STORE_LS_KEY, id || ""); } catch {}

  // ✅ optional (your DB preference logic)
  // await setCurrentStoreIdInDB(id || "");

  document.dispatchEvent(new CustomEvent("store:change", { detail: { id: id || "" } }));
}


async function hydrateStoreDropdown() {
  const stores = await listMyStores();

  dd.innerHTML =
    `<option value="">Select a Store…</option>` +
    stores.map((s) => {
      const name = s?.values?.Name || s?.values?.slug || "(untitled store)";
      return `<option value="${s._id}">${escapeHtml(name)}</option>`;
    }).join("");

  // ✅ try DB first, then fallback to localStorage
  let saved = window.STATE?.storeId || "";
  if (!saved) {
    try { saved = localStorage.getItem(STORE_LS_KEY) || ""; } catch {}
  }

  if (saved && stores.some((s) => String(s._id) === String(saved))) {
    dd.value = saved;
    window.setCurrentStoreId(saved);
  } else {
    dd.value = "";
    window.setCurrentStoreId("");
  }
}


  // change handler
dd.addEventListener("change", async () => {
  await setCurrentStore(dd.value || "");
});


  // hydrate after login check
  document.addEventListener("auth:ready", () => {
    hydrateStoreDropdown().catch((e) => console.error("[store-dd] hydrate failed:", e));
  });

  // expose for refresh after creating a store
  window.hydrateStoreDropdown = hydrateStoreDropdown;
})();
 


//Open add Store section when add store button is clicked 
document.getElementById("store-add-btn")?.addEventListener("click", () => {
 
});
(() => {
  const addBtn = document.getElementById("store-add-btn");
  const cancelBtn = document.getElementById("store-cancel-btn");

  const view = document.getElementById("store-view");
  const form = document.getElementById("store-form");

  const nameInput = document.getElementById("store-name-input");
  const errEl = document.getElementById("store-form-error");

  function openForm() {
    if (errEl) errEl.textContent = "";
    if (nameInput) nameInput.value = "";
    if (view) view.hidden = true;
    if (form) form.hidden = false;
    nameInput?.focus();
  }

  function closeForm() {
    if (errEl) errEl.textContent = "";
    if (form) form.hidden = true;
    if (view) view.hidden = false;
  }

  addBtn?.addEventListener("click", openForm);
  cancelBtn?.addEventListener("click", closeForm);
})();

//Add Store name next to Store Label 
(function storeHeaderTitleModule() {
  const suffixEl = document.getElementById("store-title-suffix");
  const dd = document.getElementById("store-dd");
  if (!suffixEl || !dd) return;

  function updateTitle() {
    const opt = dd.options[dd.selectedIndex];
    const name = opt && opt.value ? (opt.textContent || "").trim() : "";
   suffixEl.textContent = name ? ` - ${name}` : "";

  }

  // update when dropdown changes
  dd.addEventListener("change", updateTitle);

  // update when store is changed programmatically (setCurrentStoreId dispatches store:change)
  document.addEventListener("store:change", updateTitle);

  // initial render
  updateTitle();
})();


//Save Store 
//helper 
// ------------------------------
// Current Store preference (DB)
//getMyPreferenceRecord( DataType: "User Preference"
// Field: "Current Store" (Reference -> Store)
// ------------------------------
async function getMyPreferenceRecord() {
  const res = await fetch(
    `${API_ORIGIN}/api/records/${encodeURIComponent("User Preference")}?limit=1&ts=${Date.now()}`,
    { credentials: "include", headers: { Accept: "application/json" }, cache: "no-store" }
  );

  if (!res.ok) return null;

  const payload = await res.json();
  const rows = Array.isArray(payload) ? payload : (payload.items || payload.records || []);
  const visible = rows.filter(r => !r?.deletedAt);

  return visible[0] || null;
}

function readRefId(v) {
  if (!v) return "";
  if (typeof v === "string") return v;
  if (typeof v === "object") return v._id || v.id || "";
  return "";
}
window.STATE = window.STATE || { user: { loggedIn: false, userId: null, email: "" }, storeId: "" };

async function getCurrentStoreIdFromDB() {
  const pref = await getMyPreferenceRecord();
  const v = pref?.values || {};
  return readRefId(v["Current Store"] || v.currentStoreId || v.storeId);
}

async function setCurrentStoreIdInDB(storeId) {
  const pref = await getMyPreferenceRecord();

  // if you used a Reference field:
  const values = {
    "Current Store": storeId ? { _id: storeId } : null,
  };

  // if you used text instead, swap to:
  // const values = { currentStoreId: storeId || "" };

  if (pref?._id) {
    // UPDATE existing preference
    await fetch(`${API_BASE}/api/records/${encodeURIComponent("User Preference")}/${encodeURIComponent(pref._id)}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ values }),
    });
  } else {
    // CREATE preference
    await fetch(`${API_BASE}/api/records/${encodeURIComponent("User Preference")}`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ values }),
    });
  }
}

(() => {
  const addBtn    = document.getElementById("store-add-btn");
  const cancelBtn = document.getElementById("store-cancel-btn");
  const saveBtn   = document.getElementById("store-save-btn");

  const view = document.getElementById("store-view");
  const form = document.getElementById("store-form");

  const nameInput = document.getElementById("store-name-input");
  const errEl     = document.getElementById("store-form-error");
  const slugPreviewEl = document.getElementById("store-slug-preview"); // optional

  // ---- helpers ----
  const slugify = (s = "") =>
    String(s)
      .trim()
      .toLowerCase()
      .replace(/['"]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80);

  // If you already have generateSlugForType() on this page, we’ll use it.
  // Otherwise we fall back to slugify().
  async function generateStoreSlug(name, excludeId = null) {
    try {
      if (typeof generateSlugForType === "function") {
        return await generateSlugForType("Store", name, excludeId);
      }
    } catch (e) {
      console.warn("[store] generateSlugForType failed, using slugify", e);
    }
    return slugify(name);
  }

  function setBusy(on) {
    if (!saveBtn) return;
    saveBtn.disabled = !!on;
    saveBtn.textContent = on ? "Saving..." : "Save";
  }

  function openForm() {
    if (errEl) errEl.textContent = "";
    if (nameInput) nameInput.value = "";
    if (slugPreviewEl) slugPreviewEl.textContent = "—";
    if (view) view.hidden = true;
    if (form) form.hidden = false;
    nameInput?.focus();
  }

  function closeForm() {
    if (errEl) errEl.textContent = "";
    if (form) form.hidden = true;
    if (view) view.hidden = false;
  }

  // ---- OPTIONAL: live slug preview as user types ----
  nameInput?.addEventListener("input", async () => {
    const name = nameInput.value.trim();
    if (!name) {
      if (slugPreviewEl) slugPreviewEl.textContent = "—";
      return;
    }
    const slug = await generateStoreSlug(name);
    if (slugPreviewEl) slugPreviewEl.textContent = `/store/${slug}`;
  });

  // ---- save store ----
  saveBtn?.addEventListener("click", async () => {
    if (errEl) errEl.textContent = "";

    const name = nameInput?.value.trim() || "";
    if (!name) {
      if (errEl) errEl.textContent = "Enter a store name.";
      nameInput?.focus();
      return;
    }

    setBusy(true);
    try {
      const uid = await window.requireUser();
      const slug = await generateStoreSlug(name);

      const values = {
        Name: name,
        slug: slug,
        "Created By": { _id: uid },
        "Created At": new Date().toISOString(),
      };

      // Create Store record

const out = await window.fetchJSON("/api/records/Store", {
  method: "POST",
  body: JSON.stringify({ values }),
});

// ✅ your API returns { items: [doc] }
const created = out?.items?.[0] || out;
const newId = created?._id || created?.id || "";
if (!newId) throw new Error("Create failed (no record id returned)");

window.STATE = window.STATE || {};
window.STATE.storeId = newId;

// ✅ save current store to DB (User Preference record)
await setCurrentStoreIdInDB(newId);

// ✅ refresh dropdown and select it
if (typeof window.hydrateStoreDropdown === "function") {
  await window.hydrateStoreDropdown();
}
const dd = document.getElementById("store-dd");
if (dd) dd.value = newId;


      // Save current store id (optional, but useful across Products/Orders)
      window.STATE = window.STATE || {};
      

      // Refresh your store list/table if you have a function for it:
      // If you do NOT yet, no worries—we'll add it next.
      if (typeof window.hydrateStoresUI === "function") {
        await window.hydrateStoresUI();
      }

      closeForm();
      alert(`Store saved at  /suiteseat.io/${slug}`);
    } catch (e) {
      console.error("[store] save failed:", e);
      if (errEl) errEl.textContent = e.message || "Save failed";
    } finally {
      setBusy(false);
    }
  });

  addBtn?.addEventListener("click", openForm);
  cancelBtn?.addEventListener("click", closeForm);
})();


































///////////////
//Theme Section 


//Show Themes in theme Section 
/* ===================== THEMES (Store Theme cards) ===================== */
/* ===================== THEMES (DB) ===================== */
(() => {
  const cardsEl = document.getElementById("theme-cards");
  const emptyEl = document.getElementById("theme-empty");
  const selectedLabel = document.getElementById("theme-selected-label");

  const formEl = document.getElementById("theme-form");
  const addBtn = document.getElementById("theme-add-btn");
  const cancelBtn = document.getElementById("theme-cancel-btn");
  const saveBtn = document.getElementById("theme-save-btn");
  const nameEl = document.getElementById("theme-name");
  const tplEl = document.getElementById("theme-template");
  const errEl = document.getElementById("theme-error");

  if (!cardsEl || !emptyEl || !formEl || !addBtn) return;

  const DT_THEME = "Store Theme";
  const DT_STORE = "Store";

  const escapeHtml = (s) =>
    String(s || "").replace(/[&<>"']/g, (m) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[m]));


  function setSelectedLabel(themeName) {
    if (!selectedLabel) return;
    selectedLabel.textContent = themeName ? `Selected Theme: ${themeName}` : "";
  }

  function markSelectedCard(themeId) {
    cardsEl.querySelectorAll("[data-theme-id]").forEach((el) => {
      el.classList.toggle("is-selected", el.getAttribute("data-theme-id") === themeId);
    });
  }

  function showForm(on) {
    formEl.hidden = !on;
    if (on) {
      errEl && (errEl.textContent = "");
      nameEl && (nameEl.value = "");
      tplEl && (tplEl.value = "");
      nameEl?.focus();
    }
  }

async function listStoreThemes() {
  await window.requireUser();

  const res = await fetch(
    `${API_ORIGIN}/api/records/${encodeURIComponent("Store Theme")}?limit=400&ts=${Date.now()}`,
    { credentials: "include", headers: { Accept: "application/json" }, cache: "no-store" }
  );

  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const data = await res.json();
  
  const rows = Array.isArray(data) ? data : (data.items || data.records || []);
  return rows.filter((r) => !r?.deletedAt);
}


  async function getStoreById(storeId) {
    if (!storeId) return null;

    const res = await fetch(
      `${API_ORIGIN}/api/records/${encodeURIComponent(DT_STORE)}/${encodeURIComponent(storeId)}?ts=${Date.now()}`,
      { credentials: "include", headers: { Accept: "application/json" }, cache: "no-store" }
    );
    if (!res.ok) return null;

    const data = await res.json();
    return data?.items?.[0] || data;
  }

  async function setStoreSelectedTheme(storeId, themeId) {
    if (!storeId) throw new Error("No store selected.");
const values = {
  "Store Theme": themeId ? { _id: themeId } : null,
};

    await fetch(`${API_ORIGIN}/api/records/${encodeURIComponent(DT_STORE)}/${encodeURIComponent(storeId)}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ values }),
    });
  }

  async function createTheme(values) {
    await window.requireUser();

    const res = await fetch(`${API_ORIGIN}/api/records/${encodeURIComponent(DT_THEME)}`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ values }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data?.items?.[0] || data;
  }

 ////// 
function readImageUrl(v) {
  const img = v["Preview Image"] || v.previewImage;
  if (!img) return "";

  let url = "";
  if (typeof img === "string") url = img;
  else if (typeof img === "object") url = img.url || img.path || img.src || "";

  // ✅ ignore old hardcoded paths that no longer exist
  if (url.includes("/qassets/img/themes/")) return "";

  return url;
}


function getTemplatePreviewUrl(templateKey) {
  const key = String(templateKey || "").toLowerCase();
  const map = {
    basic: "/store-templates/basic/assets/basicpreview.png",
  };
  return map[key] || "/store-templates/placeholder.png";
}

// Keep latest render data so the ONE click handler can use it
window.__THEMES_UI = window.__THEMES_UI || { themes: [], storeId: "", bound: false };

async function renderThemeCards() {
  const storeId = window.STATE?.storeId || "";
  window.__THEMES_UI.storeId = storeId;

  // ✅ Bind clicks ONCE (not every re-render)
  if (!window.__THEMES_UI.bound) {
    window.__THEMES_UI.bound = true;

    cardsEl.addEventListener("click", async (e) => {
      const actionBtn = e.target.closest(".theme-card__btn");
      const cardBtn   = e.target.closest(".theme-card");

      const themes  = window.__THEMES_UI.themes || [];
      const storeId = window.__THEMES_UI.storeId || "";

      // Edit / Preview buttons
      if (actionBtn) {
        e.preventDefault();
        e.stopPropagation();

        const themeId = actionBtn.getAttribute("data-theme-id") || "";
        const action  = actionBtn.getAttribute("data-action") || "";

        if (action === "edit") {
          const themeRow = themes.find((x) => String(x._id || x.id) === String(themeId));
          openThemeEditor(themeId, themeRow);
          return;
        }

        if (action === "preview") {
          console.log("PREVIEW theme", themeId);
          return;
        }
      }

      // Card click = select theme
      if (cardBtn) {
        const themeId = cardBtn.getAttribute("data-theme-id") || "";
        try {
          await setStoreSelectedTheme(storeId, themeId);
          window.selectedThemeId = themeId;
          await renderThemeCards();
        } catch (err) {
          console.error("[themes] select failed:", err);
          alert(err.message || "Failed to select theme");
        }
      }
    });
  }

  // If no store selected, show empty
  if (!storeId) {
    cardsEl.innerHTML = "";
    emptyEl.hidden = false;
    setSelectedLabel("");
    return;
  }

  const [themes, store] = await Promise.all([
    listStoreThemes(),
    getStoreById(storeId),
  ]);

  // ✅ store latest themes for the ONE click handler
  window.__THEMES_UI.themes = themes || [];

  const storeValues = store?.values || {};
  const selectedThemeId = readRefId(storeValues["Store Theme"]);
  window.selectedThemeId = selectedThemeId;

  if (!themes.length) {
    cardsEl.innerHTML = "";
    emptyEl.hidden = false;
    setSelectedLabel("");
    return;
  }

  emptyEl.hidden = true;

  cardsEl.innerHTML = themes
    .map((t) => {
      const v = t.values || {};
      const id = String(t._id || t.id || "");
      const name = v.Name || v.Title || "Theme";
      const key = v["Template Key"] || v.templateKey || "";

      // ✅ use DB preview image if present, otherwise fallback to template thumbnail
      const preview = readImageUrl(v) || getTemplatePreviewUrl(key);

      return `
        <div class="theme-card" data-theme-id="${escapeHtml(id)}" role="button" tabindex="0">
          <div class="theme-card__preview">
            ${
              preview
                ? `
                  <img class="theme-card__img" src="${escapeHtml(preview)}" alt="${escapeHtml(name)} preview" />
                  <div class="theme-card__overlay">
                    <button type="button" class="theme-card__btn" data-action="edit" data-theme-id="${escapeHtml(id)}">Edit</button>
                    <button type="button" class="theme-card__btn" data-action="preview" data-theme-id="${escapeHtml(id)}">Preview</button>
                  </div>
                `
                : `<div class="theme-card__noimg">No preview</div>`
            }
          </div>

          <div class="theme-card__body">
            <div class="theme-card__name">${escapeHtml(name)}</div>
            <div class="theme-card__meta">${escapeHtml(key)}</div>
            <div class="theme-card__cta">Use theme</div>
          </div>
        </div>
      `;
    })
    .join("");

  markSelectedCard(selectedThemeId);

  const selectedTheme = themes.find((x) => String(x._id || x.id) === String(selectedThemeId));
  setSelectedLabel(selectedTheme?.values?.Name || "");
}

  // ---- Add Theme form wiring ----
  addBtn.addEventListener("click", () => showForm(true));
  cancelBtn?.addEventListener("click", () => showForm(false));

  saveBtn?.addEventListener("click", async () => {
    errEl && (errEl.textContent = "");

    const storeId = window.STATE?.storeId || "";
    if (!storeId) {
      errEl && (errEl.textContent = "Choose a Store first.");
      return;
    }

    const name = (nameEl?.value || "").trim();
    const templateKey = (tplEl?.value || "").trim() || "basic";
    if (!name) {
      errEl && (errEl.textContent = "Theme name is required.");
      nameEl?.focus();
      return;
    }



    try {
      const uid = await window.requireUser();
      await createTheme({
        Name: name,
        "Template Key": templateKey,
        "Created By": { _id: uid },
        "Created At": new Date().toISOString(),
      });

      showForm(false);
      await renderThemeCards();
    } catch (e) {
      console.error("[themes] create failed:", e);
      errEl && (errEl.textContent = e.message || "Failed to save theme.");
    }
  });

  // refresh on store changes + auth
  document.addEventListener("store:change", () => {
    renderThemeCards().catch((e) => console.error("[themes] render failed:", e));
    showForm(false);
  });

  document.addEventListener("auth:ready", () => {
    renderThemeCards().catch((e) => console.error("[themes] render failed:", e));
  });

  window.renderThemeCards = renderThemeCards;
})();


   // ---------- Render right panel ----------
window.renderThemeElementsIntoDropzone = function renderThemeElementsIntoDropzone(elements = [], editorEl = null) {
  const editor =
    editorEl ||
    document.querySelector("#theme-editor:not([hidden])") ||
    document.getElementById("theme-editor");

  const canvas = editor ? editor.querySelector("#theme-dropzone") : null;
  if (!canvas) return;

  const hasItems = Array.isArray(elements) && elements.length > 0;

  canvas.classList.toggle("has-items", hasItems);
  canvas.replaceChildren();

  if (!hasItems) {
    const empty = document.createElement("div");
    empty.className = "theme-dropzone__empty";
    empty.textContent = "Drop Area";
    canvas.appendChild(empty);
    return;
  }

  // ✅ helper: builds ONE node (this is your old forEach code)
  function buildCanvasNode(el) {
    const type = String(el?.type || "");
    const reg = window.THEME_ELEMENT_REGISTRY?.[type] || { label: type || "Element" };

    const p = el?.props || {};
    const x = Number(p.x ?? 24);
    const y = Number(p.y ?? 24);
    const w = Number(p.w ?? 320);
    const h = Number(p.h ?? 140);
    const z = Number(p.z ?? 1);

    const node = document.createElement("div");
    node.className = "canvas-item";
    node.dataset.elId = el.id;
    node.dataset.type = type;

    node.style.left = x + "px";
    node.style.top = y + "px";
    node.style.width = w + "px";
    node.style.height = h + "px";
    node.style.zIndex = String(z);

    const displayName = (p.name || p.title || reg.label || "Element");
    const bg = p.bg || "#ffffff";
    node.style.background = bg;

   const isText = String(type).toLowerCase() === "text";

// inside buildCanvasNode(el) AFTER you set: const type = ... and const p = el.props...
const isImage = String(type).toLowerCase() === "image";

node.innerHTML = `
  <div class="canvas-item__namebar" ...>...</div>
  <button type="button" class="canvas-item__x" ...>×</button>

  ${isImage ? "" : `
    <div class="canvas-item__top">
      <div class="canvas-item__title">${reg.label}</div>
    </div>
  `}

  <div class="canvas-item__content">
    ${isImage ? `
      <div class="canvas-image" data-action="pick-image" data-el-id="${el.id}">
        <img class="canvas-image__img" alt="" />
        <div class="canvas-image__hint">Add image</div>
        <input class="canvas-image__file" type="file" accept="image/*"
          data-action="image-file" data-el-id="${el.id}" />
      </div>
    ` : ``}
  </div>
`;


// ✅ if already has src, show it
if (isImage) {
  const src = String(p.src || p.url || "").trim();
  const imgEl = node.querySelector(".canvas-image__img");
  if (imgEl && src) {
    imgEl.src = src;
    node.querySelector(".canvas-image")?.classList.add("has-src");
  }
}


// ✅ render a real text editor inside the element
// ✅ render editors/content inside the element WITHOUT wiping images
const contentEl = node.querySelector(".canvas-item__content");

if (contentEl) {
  const lower = String(type).toLowerCase();

  if (lower === "text") {
    const current = String(p.text || "");
    contentEl.innerHTML = `
      <textarea
        class="canvas-textarea"
        data-action="text"
        data-el-id="${el.id}"
        placeholder="Type your text…"
      >${current.replace(/</g, "&lt;")}</textarea>
    `;
  }
  // ✅ IMPORTANT: don't overwrite image markup here
  else if (lower === "image") {
    // do nothing — image HTML is already in node.innerHTML
  }
  else {
    // optional: clear other element types
    // contentEl.innerHTML = "";
  }
}

    addResizeHandles(node);
    return node;
  }

  // ✅ 1) render sections first
  const sections = elements.filter(e => String(e?.type || "").toLowerCase() === "section");
  const others   = elements.filter(e => String(e?.type || "").toLowerCase() !== "section");

  // map sectionId -> DOM node
  const sectionDomMap = new Map();

sections.forEach((el) => {
  const node = buildCanvasNode(el);
  node.dataset.type = "section";

  // ✅ Keep namebar (so Color/Layer stays)
  // ✅ Remove only the "Section" label area
  node.querySelector(".canvas-item__top")?.remove();

  const content = node.querySelector(".canvas-item__content");
  if (content) {
    content.style.position = "relative";
    content.style.overflow = "hidden";
    content.style.padding = "12px";
    content.style.minHeight = "60px";
  }

  canvas.appendChild(node);
  sectionDomMap.set(String(el.id), node);
});


  // ✅ 2) render everything else (append into its parent section if parentId exists)
  others.forEach((el) => {
    const node = buildCanvasNode(el);

    const parentId = el.parentId || el?.props?.parentId || null;
    const parentSection = parentId ? sectionDomMap.get(String(parentId)) : null;

 if (parentSection) {
  const content = parentSection.querySelector(".canvas-item__content") || parentSection;

  node.style.position = "absolute";
  content.style.position = content.style.position || "relative";

  // ✅ hide child chrome
 // ✅ keep the namebar for children too (label + color + layer)
// ✅ only remove the big type header if you want
node.classList.add("in-section");
node.querySelector(".canvas-item__top")?.remove(); // optional: keep/remove

  content.appendChild(node);
}
else {
  canvas.appendChild(node);
}

  });
};

//Open Theme Editor when edit on theme is clicked 
async function openThemeEditor(themeId, themeRow) {
  const editor = document.getElementById("theme-editor");
  const closeBtn = document.getElementById("theme-editor-close");
  const nameEl = document.getElementById("theme-editor-name");
  if (!editor) return;

  editor.hidden = false;
  setupUniversalResizeForEditor(editor);

  editor.setAttribute("data-theme-id", themeId);

  const v0 = themeRow?.values || {};
  nameEl && (nameEl.textContent = v0.Name || v0.Title || themeId);

  // ✅ DRAFT MODE: always start blank
  window.__THEME_EDITOR_ELEMENTS = [];
window.renderThemeElementsIntoDropzone(window.__THEME_EDITOR_ELEMENTS, editor);



  closeBtn?.addEventListener("click", () => {
    editor.hidden = true;
    editor.removeAttribute("data-theme-id");
  }, { once: true });
}


/////////////////////////////////////////
//Elements to drag
/////////
// ---------- THEME ELEMENT REGISTRY (what each type "means") ----------
window.THEME_ELEMENT_REGISTRY = {
  section:  { label: "Section",  defaultProps: { title: "New Section" } },
  group:    { label: "Group",    defaultProps: { title: "New Group" } },
  dropdown: { label: "Dropdown", defaultProps: { label: "Choose one", options: ["Option 1","Option 2"] } },

  hero:     { label: "Hero",     defaultProps: { headline: "Headline" } },
  text:     { label: "Text",     defaultProps: { text: "Text block" } },
  image:    { label: "Image",    defaultProps: { src: "" } },
  button:   { label: "Button",   defaultProps: { text: "Click me", href: "#" } },
};

function uid(prefix="el"){
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

// ---------- Fetch theme by id (you referenced this but didn't define it) ----------
async function getThemeById(themeId){
  const res = await fetch(`${API_ORIGIN}/api/records/${encodeURIComponent("Store Theme")}/${encodeURIComponent(themeId)}?ts=${Date.now()}`, {
    credentials: "include",
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Failed to load theme (${res.status})`);
  const data = await res.json();
  return data?.items?.[0] || data;
}

//////////////////////
// Drag set up
/////////
(function themeDragDropWiring() {
  const editor = document.getElementById("theme-editor");
  const sidebar = editor ? editor.querySelector(".theme-editor__sidebar") : null;
  const canvas  = editor ? editor.querySelector("#theme-dropzone") : null;

  if (!sidebar || !canvas) return;

  // ✅ prevent double-binding (this is what causes duplicates)
  if (canvas.dataset.ddBound === "1") return;
  canvas.dataset.ddBound = "1";

  window.__THEME_EDITOR_ELEMENTS = window.__THEME_EDITOR_ELEMENTS || [];

  sidebar.addEventListener("dragstart", (e) => {
    const btn = e.target.closest(".el-item");
    if (!btn) return;
    const type = btn.getAttribute("data-type");
    if (!type) return;
    e.dataTransfer.setData("text/plain", type);
    e.dataTransfer.effectAllowed = "copy";
  });

  canvas.addEventListener("dragover", (e) => {
    e.preventDefault();
    canvas.classList.add("is-over");
    e.dataTransfer.dropEffect = "copy";
  });

  canvas.addEventListener("dragleave", () => {
    canvas.classList.remove("is-over");
  });

 canvas.addEventListener("drop", (e) => {
  e.preventDefault();
  e.stopPropagation();
  canvas.classList.remove("is-over");

  const type = e.dataTransfer.getData("text/plain");
  if (!type) return;

  const defaults = window.THEME_ELEMENT_REGISTRY?.[type]?.defaultProps || {};

  // ✅ is this drop inside a section?
  const sectionNode = getSectionUnderPoint(canvas, e.clientX, e.clientY);

  // compute x,y relative to either the dropzone or the section's content area
  let parentId = null;
  let x = 24, y = 24;

  if (sectionNode) {
    parentId = sectionNode.dataset.elId;
    const content = sectionNode.querySelector(".canvas-item__content") || sectionNode;
    const pt = toLocalXY(content, e.clientX, e.clientY);
 x = Math.max(0, pt.x);
y = Math.max(0, pt.y);

// ✅ nudge away from the top edge inside sections
x += 8;
y += 8;

  } else {
    const rect = canvas.getBoundingClientRect();
    x = Math.max(0, Math.round(e.clientX - rect.left));
    y = Math.max(0, Math.round(e.clientY - rect.top));
  }

  const draftEl = {
    id: uid("draft"),
    type,
    order: (window.__THEME_EDITOR_ELEMENTS?.length || 0) + 1,
    parentId, // ✅ store parent
    props: { ...defaults, x, y, w: 320, h: 140, z: 1 },
  };

  window.__THEME_EDITOR_ELEMENTS = [...(window.__THEME_EDITOR_ELEMENTS || []), draftEl];
  window.renderThemeElementsIntoDropzone(window.__THEME_EDITOR_ELEMENTS, editor);
});


canvas.addEventListener("click", (e) => {
  const btn = e.target.closest('[data-action="remove"]');
  if (!btn) return;

  e.preventDefault();
  e.stopPropagation(); // ✅ important

  const id = btn.getAttribute("data-el-id");
  window.__THEME_EDITOR_ELEMENTS = (window.__THEME_EDITOR_ELEMENTS || []).filter((x) => x.id !== id);

  window.renderThemeElementsIntoDropzone(window.__THEME_EDITOR_ELEMENTS, editor);
});

})();






//When an element is dragged create a record
async function createThemeElement({ themeId, type, order, parentId = null, props = {} }) {
  await window.requireUser();

  const values = {
    Theme: { _id: themeId },
    Type: type,
    Order: Number(order || 0),
    "Parent Element": parentId ? { _id: parentId } : null,

    // If your field is JSON, send object
    Props: props,

    // If your field is Long Text instead, do this:
    // Props: JSON.stringify(props),
  };

  const out = await window.fetchJSON("/api/records/Theme Element", {
    method: "POST",
    body: JSON.stringify({ values }),
  });

  return out?.items?.[0] || out;
}



function parseProps(v){
  // If Props is JSON:
  if (v && typeof v === "object") return v;

  // If Props is stored as string:
  if (typeof v === "string") {
    try { return JSON.parse(v); } catch { return {}; }
  }
  return {};
}

async function listThemeElements(themeId) {
  const res = await fetch(
    `${API_ORIGIN}/api/records/${encodeURIComponent("Theme Element")}?limit=500&ts=${Date.now()}`,
    { credentials: "include", headers: { Accept: "application/json" }, cache: "no-store" }
  );

  const data = await res.json();
  const rows = Array.isArray(data) ? data : (data.items || data.records || []);
  const visible = rows.filter(r => !r?.deletedAt);

  // filter by Theme reference
  return visible.filter(r => {
    const themeRef = r?.values?.Theme;
    const rid = readRefId(themeRef);
    return String(rid) === String(themeId);
  });
}

async function loadThemeElementsIntoRightPanel(themeId) {
  const rows = await listThemeElements(themeId);

  // normalize for renderer
  const els = rows
    .map(r => {
      const v = r.values || {};
      return {
        id: String(r._id || r.id || ""),
        type: String(v.Type || "").toLowerCase(),
        order: Number(v.Order || 0),
        parentId: readRefId(v["Parent Element"]),
        props: parseProps(v.Props),
      };
    })
    .sort((a,b) => a.order - b.order);

  window.__THEME_EDITOR_ELEMENTS = els;
window.renderThemeElementsIntoDropzone(els, document.getElementById("theme-editor"));


}



                             ///////////////////////
                                //Mod Elements

// Resize elements
function addResizeHandles(el) {
  // prevent duplicates
  if (el.querySelector(".resize-handle")) return;

  const handles = ["tl","tr","bl","br","t","r","b","l"];
  for (const h of handles) {
    const d = document.createElement("div");
    d.className = `resize-handle resize-handle--${h}`; // ✅ MUST match CSS
    d.dataset.handle = h;
    el.appendChild(d);
  }
}

//make elements not go outside sections 
function getSectionUnderPoint(dropzone, clientX, clientY) {
  const sections = [...dropzone.querySelectorAll('.canvas-item[data-type="section"]')];

  // topmost first (highest zIndex wins)
  sections.sort((a,b) => (Number(b.style.zIndex||1) - Number(a.style.zIndex||1)));

  return sections.find(sec => {
    const r = sec.getBoundingClientRect();
    return clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom;
  }) || null;
}

function toLocalXY(containerEl, clientX, clientY) {
  const r = containerEl.getBoundingClientRect();
  return {
    x: Math.round(clientX - r.left),
    y: Math.round(clientY - r.top),
  };
}

function setupUniversalResizeForEditor(editor) {
  const dropzone = editor?.querySelector("#theme-dropzone");
  if (!dropzone) return;

  // ✅ prevent double-binding
  if (dropzone.dataset.resizeBound === "1") return;
  dropzone.dataset.resizeBound = "1";

  let active = null;
  dropzone.style.position = dropzone.style.position || "relative";

  function px(n) { return `${Math.round(n)}px`; }

  /* =========================
     1) UNSELECT (click empty canvas)
     ========================= */
  dropzone.addEventListener("mousedown", (e) => {
    // If you clicked inside ANY element/UI, do nothing here
    if (e.target.closest(".canvas-item")) return;

    // Otherwise clear selection
    dropzone.querySelectorAll(".canvas-item").forEach((x) => x.classList.remove("is-selected"));
  });

  /* =========================
     2) IMAGE PICKER
     (use mousedown so drag logic doesn't "eat" the click)
     ========================= */

  dropzone.addEventListener("mousedown", (e) => {
    const wrap = e.target.closest('[data-action="pick-image"]');
    if (!wrap) return;

    // ✅ stop move/resize mousedown listener on the SAME element
    e.preventDefault();
    e.stopImmediatePropagation();

    // ✅ make sure nothing is currently dragging
    active = null;

    const id = wrap.getAttribute("data-el-id");
    const fileInput = wrap.querySelector(
      `input[data-action="image-file"][data-el-id="${CSS.escape(id)}"]`
    );
    fileInput?.click();
  });

  dropzone.addEventListener("change", (e) => {
    const inp = e.target.closest('[data-action="image-file"]');
    if (!inp) return;

    // ✅ clear any drag state (just in case)
    active = null;

    const id = inp.getAttribute("data-el-id");
    const file = inp.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || "");

      const obj = (window.__THEME_EDITOR_ELEMENTS || []).find(
        (x) => String(x.id) === String(id)
      );
      if (obj) {
        obj.props = obj.props || {};
        obj.props.src = dataUrl;
      }

      const item = inp.closest(".canvas-item");
      const img = item?.querySelector(".canvas-image__img");
      if (img) img.src = dataUrl;
      item?.querySelector(".canvas-image")?.classList.add("has-src");
    };

    reader.readAsDataURL(file);

    // ✅ reset file input so picking the same image again still triggers change
    inp.value = "";
  });

  /* =========================
     3) INPUT HANDLERS (rename, text, bg color)
     ========================= */
  dropzone.addEventListener("input", (e) => {
    // rename
    const nameInp = e.target.closest('[data-action="rename"]');
    if (nameInp) {
      const id = nameInp.getAttribute("data-el-id");
      const obj = (window.__THEME_EDITOR_ELEMENTS || []).find(
        (x) => String(x.id) === String(id)
      );
      if (obj) {
        obj.props = obj.props || {};
        obj.props.name = nameInp.value;
      }
      return;
    }

    // text typing + autosize
    const textArea = e.target.closest('[data-action="text"]');
    if (textArea) {
      const id = textArea.getAttribute("data-el-id");
      const obj = (window.__THEME_EDITOR_ELEMENTS || []).find(
        (x) => String(x.id) === String(id)
      );
      if (obj) {
        obj.props = obj.props || {};
        obj.props.text = textArea.value || "";
      }

      // autosize textarea height
      textArea.style.height = "auto";
      textArea.style.height = textArea.scrollHeight + "px";

      // OPTIONAL: also grow the ELEMENT box if needed (won't shrink)
      const item = textArea.closest(".canvas-item");
      if (item && !item.dataset.manualResize) {
        const needed = (textArea.scrollHeight || 0) + 20;
        const current = item.getBoundingClientRect().height;
        if (needed > current) {
          item.style.height = needed + "px";
          commitItemToModel(item);
        }
      }
      return;
    }

    // bg color
    const colorInp = e.target.closest('[data-action="bg"]');
    if (colorInp) {
      const id = colorInp.getAttribute("data-el-id");
      const obj = (window.__THEME_EDITOR_ELEMENTS || []).find(
        (x) => String(x.id) === String(id)
      );
      if (obj) {
        obj.props = obj.props || {};
        obj.props.bg = colorInp.value || "#ffffff";
      }

      const item = dropzone.querySelector(
        `.canvas-item[data-el-id="${CSS.escape(id)}"]`
      );
      if (item) item.style.background = colorInp.value;
    }
  });

  /* =========================
     4) LAYER BUTTONS (click)
     ========================= */
  dropzone.addEventListener("click", (e) => {
    const btn = e.target.closest('[data-action="sendBack"], [data-action="bringFront"]');
    if (!btn) return;

    e.preventDefault();
    e.stopPropagation();

    const id = btn.getAttribute("data-el-id");
    const action = btn.getAttribute("data-action");

    const list = window.__THEME_EDITOR_ELEMENTS || [];
    const obj = list.find((x) => String(x.id) === String(id));
    if (!obj) return;

    obj.props = obj.props || {};
    const maxZ = list.reduce((m, it) => Math.max(m, Number(it?.props?.z ?? 1)), 1);
    const curZ = Number(obj.props.z ?? 1);

    if (action === "bringFront") obj.props.z = maxZ + 1;
    if (action === "sendBack") obj.props.z = Math.max(1, curZ - 1);

    const item = dropzone.querySelector(
      `.canvas-item[data-el-id="${CSS.escape(id)}"]`
    );
    if (item) item.style.zIndex = String(obj.props.z);
  });

  /* =========================
     5) MOVE / RESIZE / SELECT
     ========================= */
  dropzone.addEventListener("mousedown", (e) => {
    // ✅ clicking X should ONLY delete (don't select/drag)
    if (e.target.closest('[data-action="remove"]')) return;

    const handle = e.target.closest(".resize-handle");
    const item = e.target.closest(".canvas-item");

    // allow typing / picking colors / file picker etc.
    if (e.target.closest("input, textarea, select")) return;
    if (e.target.closest("button")) return;

    // if you clicked an inner element, stop parent section from also selecting
    if (item) e.stopPropagation();

    // select
    if (item) {
      dropzone.querySelectorAll(".canvas-item").forEach((x) => x.classList.remove("is-selected"));
      item.classList.add("is-selected");

      // optional: focus text box when selecting a text element
      const ta = item.querySelector(".canvas-textarea");
      if (ta) setTimeout(() => ta.focus(), 0);
    }
    if (!item) return;

    const rect = item.getBoundingClientRect();

    // ✅ measure relative to element’s offsetParent (dropzone OR section content)
    const parent = item.offsetParent || dropzone;
    const parentRect = parent.getBoundingClientRect();

    const startLeft = rect.left - parentRect.left + parent.scrollLeft;
    const startTop  = rect.top  - parentRect.top  + parent.scrollTop;

    const startX = e.clientX;
    const startY = e.clientY;

    // RESIZE
    if (handle) {
      e.preventDefault();
      e.stopPropagation();

      const which = handle.dataset.handle;
      const cs = getComputedStyle(item);
      const minW = parseFloat(cs.minWidth) || 140;
      const minH = parseFloat(cs.minHeight) || 90;

      active = {
        mode: "resize",
        item,
        which,
        parent,
        startX,
        startY,
        startW: rect.width,
        startH: rect.height,
        startLeft,
        startTop,
        minW,
        minH,
      };
      return;
    }

    // MOVE
    e.preventDefault();
    active = { mode: "move", item, startX, startY, startLeft, startTop };
  });

  window.addEventListener("mousemove", (e) => {
    if (!active) return;

    const dx = e.clientX - active.startX;
    const dy = e.clientY - active.startY;

    if (active.mode === "move") {
      active.item.style.left = px(active.startLeft + dx);
      active.item.style.top  = px(active.startTop + dy);
      return;
    }

    if (active.mode === "resize") {
      const { item, which, startW, startH, startLeft, startTop, minW, minH } = active;

      let w = startW, h = startH, left = startLeft, top = startTop;

      if (which.includes("r")) w = startW + dx;
      if (which.includes("l")) { w = startW - dx; left = startLeft + dx; }

      if (which.includes("b")) h = startH + dy;
      if (which.includes("t")) { h = startH - dy; top = startTop + dy; }

      if (w < minW) { if (which.includes("l")) left -= (minW - w); w = minW; }
      if (h < minH) { if (which.includes("t")) top  -= (minH - h); h = minH; }

      item.style.width  = px(w);
      item.style.height = px(h);
      item.style.left   = px(left);
      item.style.top    = px(top);
    }
  });

  window.addEventListener("mouseup", () => {
    if (active?.item) {
      if (active.mode === "resize") {
        active.item.dataset.manualResize = "1"; // ✅ user resized it themselves
      }
      commitItemToModel(active.item);
    }
    active = null;
  });

  // add handles if anything already exists
  dropzone.querySelectorAll(".canvas-item").forEach(addResizeHandles);
}

function numPx(v) {
  const n = parseFloat(String(v || "").replace("px", ""));
  return Number.isFinite(n) ? n : 0;
}

function commitItemToModel(item) {
  const id = item?.dataset?.elId;
  if (!id) return;

  const list = window.__THEME_EDITOR_ELEMENTS || [];
  const obj = list.find(x => String(x.id) === String(id));
  if (!obj) return;

  obj.props = obj.props || {};
  obj.props.x = numPx(item.style.left);
  obj.props.y = numPx(item.style.top);
  obj.props.w = numPx(item.style.width);
  obj.props.h = numPx(item.style.height);
}



















































































////////////////////////////////////////////////////////////////////////
                                    //Orders Section
////////////////////////////////////////////////////////////////////////


/* ===================== ORDERS MODULE: STORE DROPDOWN ===================== */
/* ===================== ORDERS MODULE ===================== */
(function ordersModule () {
  const root = document.getElementById('orders');
  if (!root) return; // section not present

  const storeSelect   = document.getElementById('orders-store-select');
  const statusButtons = root.querySelectorAll('.orders-status-toggle [data-status]');
  const emptyCard     = document.getElementById('orders-empty');
  const listCard      = document.getElementById('orders-list');
  const tableEl       = document.getElementById('orders-table');
  const countEl       = document.getElementById('orders-count');
  const testBtn       = document.getElementById('orders-create-test');

  let allOrders      = [];
  let currentStatus  = '';
  let currentStoreId = '';

  // ---------- helpers ----------

  const escapeHtml = (s) =>
    (s || '').replace(/[&<>"']/g, (m) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }[m]));

function setView() {
  // always show the table card; we’ll show “no orders” inside it
  emptyCard.hidden = true;
  listCard.hidden  = false;
}


  function inferFulfilled(v) {
    const raw =
      (v.Status ||
        v['Fulfillment Status'] ||
        v['Payment Status'] ||
        '')
        .toString()
        .toLowerCase();

    // tweak these rules later to match your exact field values
    if (!raw) return false;
    if (raw.includes('fulfill') || raw.includes('paid') || raw.includes('complete')) {
      return true;
    }
    return false;
  }

function renderOrders() {
  let items = allOrders.slice();

  // filter by status
  if (currentStatus === 'fulfilled') {
    items = items.filter((o) => inferFulfilled(o.values || {}));
  } else if (currentStatus === 'unfulfilled') {
    items = items.filter((o) => !inferFulfilled(o.values || {}));
  }

  countEl.textContent = String(items.length);

  // 🔹 header row like your mock
  const headerHtml = `
    <div class="row row-head">
      <div class="col-order">Order</div>
      <div class="col-date">Date</div>
      <div class="col-customer">Customer</div>
      <div class="col-total">Total</div>
      <div class="col-pay-status">Payment Status</div>
      <div class="col-fulfill-status">Fulfilment Status</div>
      <div class="col-items"># items</div>
    </div>
  `;

  let bodyHtml = '';

  if (!items.length) {
    // 🔹 no orders yet → show message in a full-width row
    bodyHtml = `
      <div class="row">
        <div class="muted" style="grid-column: 1 / -1;">
          No orders yet.
        </div>
      </div>
    `;
  } else {
    bodyHtml = items
      .map((o) => {
        const v = o.values || {};

        const orderId = (o._id || o.id || '').toString();
        const shortId = orderId ? `#${orderId.slice(-6)}` : '—';

        const created =
          v['Created At'] || o.createdAt || o.updatedAt || '';
        const dateStr = created ? new Date(created).toLocaleDateString() : '—';

        const customerName =
          v['Customer Name'] ||
          v.Customer ||
          v['Buyer Name'] ||
          'Guest';

        const email =
          v['Customer Email'] ||
          v.Email ||
          v['Buyer Email'] ||
          '';

        const total = Number(
          v.Total ||
          v['Total Amount'] ||
          v['Grand Total'] ||
          0
        ).toFixed(2);

        const paymentStatus =
          v['Payment Status'] ||
          v['Payment state'] ||
          '';

        const fulfilled = inferFulfilled(v);
        const statusLabel = fulfilled ? 'Fulfilled' : 'Unfulfilled';

        const itemsCount = Array.isArray(v['Items'])
          ? v['Items'].length
          : Array.isArray(v['Line Items'])
          ? v['Line Items'].length
          : Number(v['Item Count'] || v.Quantity || 0) || 0;

        return `
          <div class="row">
            <div class="col-order"><strong>${shortId}</strong></div>
            <div class="col-date">${dateStr}</div>
            <div class="col-customer">
              <strong>${escapeHtml(customerName)}</strong>
              <div class="muted small">${escapeHtml(email || '')}</div>
            </div>
            <div class="col-total">$${total}</div>
            <div class="col-pay-status">${escapeHtml(paymentStatus || '')}</div>
            <div class="col-fulfill-status">
              <span class="badge ${fulfilled ? 'badge-success' : 'badge-warning'}">
                ${statusLabel}
              </span>
            </div>
            <div class="col-items">${itemsCount}</div>
          </div>
        `;
      })
      .join('');
  }

  tableEl.innerHTML = headerHtml + bodyHtml;

  // always show table card
  setView();
}


 
  async function loadOrders() {
    try {
      await window.requireUser();

      const params = new URLSearchParams();
      params.set('dataType', 'Order');
      params.set('limit', '200');
      if (currentStoreId) {
        params.set('Store', currentStoreId);
      }

      const res = await fetch(
        `${API_ORIGIN}/public/records?${params.toString()}`,
        {
          credentials: 'include',
          headers: { Accept: 'application/json' },
        }
      );

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      const rows = Array.isArray(data)
        ? data
        : (data.records || data.items || []);

      console.log('[orders] loaded', rows.length, 'orders');
      allOrders = rows;
      renderOrders();
    } catch (err) {
      console.error('[orders] loadOrders failed:', err);
      allOrders = [];
      renderOrders();
    }
  }

  // ---------- wiring ----------

  // store dropdown changes → reload orders
  storeSelect?.addEventListener('change', () => {
    currentStoreId = storeSelect.value || '';
    console.log(
      '[orders] store filter changed:',
      currentStoreId || 'All stores'
    );
    loadOrders().catch(() => {});
  });

  // status filter buttons
  statusButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      statusButtons.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      currentStatus = btn.dataset.status || '';
      console.log('[orders] status filter:', currentStatus || 'all');
      renderOrders();
    });
  });

  // test order button (we'll wire real creation once the Order DataType is set up)
  testBtn?.addEventListener('click', () => {
    alert(
      'Test order creation is not wired yet. Once your Order data type is ready, we will hook this button to create a sample order in the database.'
    );
  });


})();










////////////////////////////////////////////////////////////////////////
//              // PRODUCTS Section
////////////////////////////////////////////////////////////////////////
(() => {
  const root = document.getElementById("products");
  if (!root) return;

  // ---- CONFIG ----
  const UPLOAD_URL = "/api/upload";

  const $ = (s, el = root) => el.querySelector(s);
  const $$ = (s, el = root) => Array.from(el.querySelectorAll(s));

  // elements...
  const elEmpty = $("#prod-empty");
  const elList  = $("#prod-list");
  const elForm  = $("#prod-form");
  const elTable = $("#prod-table");
  const elCount = $("#prod-count");

  const btnOpen1  = $("#prod-open-form");
  const btnOpen2  = $("#prod-open-form-2");
  const btnCancel = $("#prod-cancel");
  const btnSave   = $("#prod-save");

  const fTitle = $("#p-title");
  const fDesc  = $("#p-desc");
  const fImg   = $("#p-image");
  const prev   = $("#p-imagePreview");
  const galWrap= $("#p-gallery");
  const btnAdd = $("#p-add-thumb");
  const fPrice = $("#p-price");
  const fSale  = $("#p-sale");
  const fQty   = $("#p-qty");
  const fFiles = $("#p-files");

  // ---------- helpers ----------
  const escapeHtml = (s) =>
    (s || "").replace(/[&<>"']/g, (m) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[m]));

  const slugify = (s) =>
    String(s || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

  async function uploadOne(file) {
    const fd = new FormData();
    fd.append("file", file);

    const res = await fetch(apiUrl(UPLOAD_URL), {
      method: "POST",
      body: fd,
      credentials: "include",
    });

    const out = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(out.error || "Upload failed");
    return { url: out.url || out.path || out.location, name: file.name };
  }

  async function uploadMany(files) {
    const r = [];
    for (const f of files) r.push(await uploadOne(f));
    return r;
  }

  function fileToUrl(file) {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result);
      r.onerror = rej;
      r.readAsDataURL(file);
    });
  }

  // ---------- data ----------
  async function createProduct(payloadValues) {
    await window.requireUser();
    return await window.fetchJSON("/api/records/Product", {
      method: "POST",
      body: JSON.stringify({ values: payloadValues }),
    });
  }

  async function listProducts() {
    const res = await fetch(`${API_ORIGIN}/public/records?dataType=Product&limit=300`, {
      credentials: "include",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();
    const rows = Array.isArray(data) ? data : (data.records || data.items || []);

    // ✅ filter by selected store (if chosen)
    const sid = window.STATE?.storeId || "";
    if (!sid) return rows;

    return rows.filter((r) => {
      const storeVal = r?.values?.Store;
      const storeId = (storeVal && typeof storeVal === "object") ? storeVal._id : storeVal;
      return String(storeId || "") === String(sid);
    });
  }

  // ---------- views ----------
  const showEmpty = () => {
    elEmpty.hidden = false;
    elList.hidden  = true;
    elForm.hidden  = true;
  };
  const showList = () => {
    elEmpty.hidden = true;
    elList.hidden  = false;
    elForm.hidden  = true;
  };
  const showForm = () => {
    elEmpty.hidden = true;
    elList.hidden  = true;
    elForm.hidden  = false;
  };

  async function renderList() {
    try {
      const items = await listProducts();
      elCount.textContent = String(items.length);

      if (!items.length) {
        showEmpty();
        return;
      }

      elTable.innerHTML = items
        .map((r) => {
          const v = r.values || {};
          const price = Number((v["Sale Price"] ?? v.Price) || 0).toFixed(2);

          const img =
            (v["Default Image"] && (v["Default Image"].url || v["Default Image"])) ||
            (Array.isArray(v.Gallery) && v.Gallery[0] && (v.Gallery[0].url || v.Gallery[0])) ||
            "";

          return `
            <div class="row">
              <div class="thumb">${img ? `<img src="${img}">` : ""}</div>
              <div>
                <strong>${escapeHtml(v.Title || "(untitled)")}</strong>
                <div class="muted">${escapeHtml(v.Description || "")}</div>
              </div>
              <div>$${price}</div>
              <div class="muted">${Number(v.Quantity || 0)}</div>
            </div>`;
        })
        .join("");

      showList();
    } catch (e) {
      console.error("renderList failed:", e);
      elTable.innerHTML = `
        <div class="row">
          <div class="muted">Failed to load products: ${escapeHtml(e.message)}</div>
        </div>`;
      showList();
    }
  }

  // ✅ expose globally so Store dropdown can refresh products without scope errors
  window.renderProductsList = renderList;

  // ---------- UI wiring ----------
  fImg?.addEventListener("change", async () => {
    const file = fImg.files?.[0];
    if (!file) {
      prev.innerHTML = "";
      return;
    }
    const url = await fileToUrl(file);
    prev.innerHTML = `<img src="${url}">`;
  });

  btnAdd?.addEventListener("click", async () => {
    const input = Object.assign(document.createElement("input"), {
      type: "file",
      accept: "image/*",
      hidden: true,
    });
    document.body.appendChild(input);

    input.addEventListener("change", async () => {
      const file = input.files?.[0];
      if (!file) return;

      const url = await fileToUrl(file);
      const item = document.createElement("div");
      item.className = "thumb";
      item.innerHTML = `<img src="${url}"><button class="x" title="Remove">×</button>`;

      item.querySelector(".x").addEventListener("click", () => item.remove());
      galWrap.insertBefore(item, btnAdd);
      input.remove();
    });

    input.click();
  });

  // ---------- actions ----------
  btnOpen1?.addEventListener("click", async () => {
    try { await window.requireUser(); showForm(); } catch {}
  });

  btnOpen2?.addEventListener("click", async () => {
    try { await window.requireUser(); showForm(); } catch {}
  });

  btnCancel?.addEventListener("click", () => {
    renderList().catch(() => {});
  });

  btnSave?.addEventListener("click", async () => {
    try {
      const uid = await window.requireUser();

      const storeId = window.STATE?.storeId || "";
      if (!storeId) {
        alert("Choose a Store first.");
        return;
      }

      if (!fTitle.value.trim()) {
        alert("Title is required.");
        fTitle.focus();
        return;
      }

      // uploads
      let defaultImage = null;
      if (fImg.files && fImg.files[0]) defaultImage = await uploadOne(fImg.files[0]);

      const downloadFiles = Array.from(fFiles.files || []).slice(0, 5);
      const downloads = downloadFiles.length ? await uploadMany(downloadFiles) : [];

      const values = {
        Title: fTitle.value.trim(),
        Description: fDesc.value.trim(),
        Price: Number(fPrice.value || 0),
        "Sale Price": Number(fSale.value || 0) || null,
        Quantity: Number(fQty.value || 0),
        Slug: slugify(fTitle.value),
        Store: { _id: storeId },
        "Default Image": defaultImage || null,
        Downloads: downloads,
        "Created By": { _id: uid },
        "Created At": new Date().toISOString(),
      };

      await createProduct(values);

      root.querySelector("#prod-create-form")?.reset();
      prev.innerHTML = "";
      $$(".thumb", galWrap).forEach((el) => {
        if (!el.classList.contains("add")) el.remove();
      });

      await renderList();
    } catch (e) {
      console.error("Save product failed:", e);
      alert("Save failed: " + (e.message || "Unknown error"));
    }
  });

  // ✅ refresh list whenever store changes (SAFE: uses global too)
  document.addEventListener("store:change", () => {
    renderList().catch(() => {});
  });

  // ✅ initial load
  renderList().catch(() => {});
})();

///////////////////////////////
//Drag and Drop Section
////
(() => {
  const dropzone = document.getElementById("theme-dropzone");
  if (!dropzone) return;

  let draggedType = null;

  // drag start (from sidebar)
  document.querySelectorAll(".el-item[draggable]").forEach((el) => {
    el.addEventListener("dragstart", (e) => {
      draggedType = el.dataset.type;
      e.dataTransfer.effectAllowed = "copy";
    });
  });

  // drag over canvas
  dropzone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropzone.classList.add("is-over");
  });

  dropzone.addEventListener("dragleave", () => {
    dropzone.classList.remove("is-over");
  });

  
  function renderBlockContent(type){
    switch(type){
      case "hero":
        return `<div class="muted">Hero section placeholder</div>`;
      case "text":
        return `<p>Edit text…</p>`;
      case "image":
        return `<div class="muted">Image placeholder</div>`;
      case "button":
        return `<button class="btn">Button</button>`;
      default:
        return `<div>Element</div>`;
    }
  }
})();

//Helper: fetch a theme by id
async function getThemeById(themeId) {
  if (!themeId) return null;

  const res = await fetch(
    `${API_ORIGIN}/api/records/${encodeURIComponent("Store Theme")}/${encodeURIComponent(themeId)}?ts=${Date.now()}`,
    { credentials: "include", headers: { Accept: "application/json" }, cache: "no-store" }
  );
  if (!res.ok) return null;

  const data = await res.json();
  return data?.items?.[0] || data;
}

function escapeHtml(s){
  return String(s || "").replace(/[&<>"']/g, (m) => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[m]));
}

function renderElementPreview(el){
  const type = String(el?.type || "").toLowerCase();
  const p = el?.props || {};

  if (type === "hero") {
    return `
      <div><strong>${escapeHtml(p.title || "Hero Title")}</strong></div>
      <div class="muted">${escapeHtml(p.subtitle || "Hero subtitle...")}</div>
    `;
  }

  if (type === "text") {
    return `<div>${escapeHtml(p.text || "Text...")}</div>`;
  }

  if (type === "image") {
    const src = p.src || "";
    return src
      ? `<img src="${escapeHtml(src)}" style="width:100%;max-height:160px;object-fit:cover;border-radius:10px;">`
      : `<div class="muted">No image selected</div>`;
  }

  if (type === "button") {
    return `<button class="btn" type="button">${escapeHtml(p.label || "Button")}</button>`;
  }

  return `<div class="muted">Unknown element</div>`;
}

function renderThemeElementsIntoRightPanel(elements){
  const dz = document.getElementById("theme-dropzone");
  if (!dz) return;

  dz.innerHTML = "";

  if (!elements?.length){
    dz.innerHTML = `<div class="theme-dropzone__empty">Drop Area</div>`;
    return;
  }

  for (const el of elements){
    const node = document.createElement("div");
    node.className = "canvas-item";
    node.dataset.id = el.id;
    node.dataset.type = el.type;

    // size defaults (or from el.props)
    node.style.position = "absolute";
    node.style.left = (el.props?.x ?? 20) + "px";
    node.style.top = (el.props?.y ?? 20) + "px";
    node.style.width = (el.props?.w ?? 320) + "px";
    node.style.height = (el.props?.h ?? 180) + "px";

    // content
    node.innerHTML = `
      <div class="canvas-item__content">
        <div style="font-weight:900">${el.type.toUpperCase()}</div>
        <div style="opacity:.7">Element</div>
      </div>
    `;

    // ✅ add resize handles universally
    addResizeHandles(node);

    dz.appendChild(node);
  }
}

