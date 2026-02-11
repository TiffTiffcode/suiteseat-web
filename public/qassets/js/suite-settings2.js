console.log("[suite-settings2] loaded");

window.STATE = window.STATE || { locations: [] };

// ✅ Live API (Express) server
const API_BASE = "http://localhost:8400";

// ✅ Helper to force calls to the Live API server
function apiUrl(path) {
  return `${API_BASE}${path.startsWith("/") ? "" : "/"}${path}`;
}

/**
 * ✅ IMPORTANT:
 * - On localhost, your auth routes live on 8400 (Express).
 * - On production (suiteseat.io), auth is same-origin.
 */
const AUTH_BASE =
  window.location.hostname === "localhost" ? API_BASE : "";

let currentUser = null;

async function readJsonSafe(res) {
  const text = await res.text().catch(() => "");
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

// ---- Get signed-in user via /check-login ----
async function getSignedInUser() {
  try {
    const res = await fetch(`${AUTH_BASE}/api/me`, {
      method: "GET",
      credentials: "include",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.ok || !data?.user?._id) return null;

    return {
      id: data.user._id,
      email: data.user.email || "",
      firstName: data.user.firstName || "",
      lastName: data.user.lastName || "",
      roles: data.user.roles || [],
    };
  } catch (err) {
    console.warn("[suite-settings2] getSignedInUser error", err);
    return null;
  }
}



function setLoggedInUI(user) {
  const loginBtn = document.getElementById("open-login-popup-btn");
  const logoutBtn = document.getElementById("logout-btn");

  const loginText = document.getElementById("login-status-text"); // header
  const topbarGreeting = document.getElementById("topbar-greeting"); // topbar

  const loggedIn = !!(user && user.id);

  if (loggedIn) {
    const name =
      user.firstName || (user.email ? user.email.split("@")[0] : "") || "there";

    if (loginText) loginText.textContent = `Hi, ${name}`;
    if (topbarGreeting) topbarGreeting.textContent = `Hi, ${name}`;

    if (loginBtn) loginBtn.style.display = "none";
    if (logoutBtn) logoutBtn.style.display = "inline-block";
  } else {
    if (loginText) loginText.textContent = "Not logged in";
    if (topbarGreeting) topbarGreeting.textContent = "Not logged in";

    if (loginBtn) loginBtn.style.display = "inline-block";
    if (logoutBtn) logoutBtn.style.display = "none";
  }
}


function lockApp(locked) {
  const app = document.getElementById("app");
  if (!app) return;

  if (locked) {
    app.style.pointerEvents = "none";
    app.style.opacity = "0.5";
  } else {
    app.style.pointerEvents = "";
    app.style.opacity = "";
  }
}

// ================================
// AUTH UI (header + popup)
// ================================
function initAuthUI() {
  const loginBtn = document.getElementById("open-login-popup-btn");
  const logoutBtn = document.getElementById("logout-btn");

  const modal = document.getElementById("authModal");
  const closeBtn = document.getElementById("authClose");
  const form = document.getElementById("authForm");
  const emailEl = document.getElementById("authEmail");
  const passEl = document.getElementById("authPass");
  const errorEl = document.getElementById("authError");
  const submitBtn = document.getElementById("authSubmit");

  function openModal() {
    if (!modal) return;
    modal.hidden = false;
    modal.setAttribute("aria-hidden", "false");
    if (errorEl) errorEl.textContent = "";
    if (emailEl) emailEl.focus();
  }

  function closeModal() {
    if (!modal) return;
    modal.hidden = true;
    modal.setAttribute("aria-hidden", "true");
    if (errorEl) errorEl.textContent = "";
  }

  loginBtn?.addEventListener("click", openModal);
  closeBtn?.addEventListener("click", closeModal);

  modal?.addEventListener("click", (e) => {
    if (e.target === modal) closeModal();
  });

  form?.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!emailEl || !passEl || !submitBtn) return;

  const email = emailEl.value.trim();
  const password = passEl.value.trim();

  if (!email || !password) {
    if (errorEl) errorEl.textContent = "Enter email and password.";
    return;
  }

  const idleSpan = submitBtn.querySelector(".when-idle");
  const busySpan = submitBtn.querySelector(".when-busy");

  submitBtn.disabled = true;
  if (idleSpan) idleSpan.hidden = true;
  if (busySpan) busySpan.hidden = false;
  if (errorEl) errorEl.textContent = "";

  try {
    // ✅ login route is same-origin
  const res = await fetch(`${AUTH_BASE}/api/login`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  credentials: "include",
  body: JSON.stringify({ email, password }),
});


    const body = await res.json().catch(() => ({}));

    // ✅ your /api/login returns { ok: true, user: {...} }
    if (!res.ok || !body.ok) {
      if (errorEl) errorEl.textContent = body.message || "Login failed.";
      return;
    }

   currentUser = body.user
  ? {
      id: body.user._id,
      email: body.user.email,
      firstName: body.user.firstName || "",
      lastName: body.user.lastName || "",
      roles: body.user.roles || [],
    }
  : await getSignedInUser();

    setLoggedInUI(currentUser);
    lockApp(false);
    closeModal();

    bootAppAfterLogin();
  } catch (err) {
    console.error("[auth] login error", err);
    if (errorEl) errorEl.textContent = "Something went wrong. Try again.";
  } finally {
    submitBtn.disabled = false;
    if (idleSpan) idleSpan.hidden = false;
    if (busySpan) busySpan.hidden = true;
  }
});


  logoutBtn?.addEventListener("click", async () => {
    try {
 await fetch(`${AUTH_BASE}/api/logout`, {
  method: "POST",
  credentials: "include",
});

    } catch {}
    location.reload();
  });
}

// ================================
// Sidebar collapse
// ================================
function initSidebarCollapse() {
  const app = document.getElementById("app");
  const collapseBtn = document.getElementById("collapseBtn");

  collapseBtn?.addEventListener("click", () => {
    app?.classList.toggle("collapsed");
  });
}

// ================================
// Tab switching
// ================================
function initTabSwitching() {
  const app = document.getElementById("app");
  const nav = document.getElementById("nav");
  const navButtons = nav
    ? Array.from(nav.querySelectorAll("button[data-target]"))
    : [];
  const sections = Array.from(document.querySelectorAll("main .section"));

  function showSection(id) {
    sections.forEach((sec) => {
      const match = sec.id === id;
      sec.classList.toggle("active", match);
      if (sec.hasAttribute("hidden")) sec.hidden = !match;
    });

    navButtons.forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.target === id);
    });

    try { localStorage.setItem("suiteSettingsActiveTab", id); } catch {}

    if (window.innerWidth <= 900) app?.classList.add("collapsed");
  }

  // ✅ expose so other functions can use the same switcher if needed
  window.showSuiteSettingsSection = showSection;

navButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    const target = btn.dataset.target;
    if (!target) return;

    // ✅ ADD THIS BLOCK RIGHT HERE (before showSection)
    const currentActive = document.querySelector("main .section.active")?.id;

    // ✅ leaving suities, reset it
    if (currentActive === "suities" && target !== "suities") {
      resetSuitiesUI();
    }
   // ✅ leaving locations
    if (currentActive === "locations" && target !== "locations") {
      resetLocationsUI();
    }
 // ✅ leaving applications
if (currentActive === "suites" && target !== "suites") {
 if (typeof resetSuitesUI === "function") resetSuitesUI();

}

//leaving settings
if (currentActive === "settings" && target !== "settings") {
  resetSettingsUI?.();
}

showSection(target);

if (target === "invoices") {
  loadInvoiceSuitieDropdown();
}

if (target === "locations") {
  resetLocationsUI();
  ensureLocationsTabDefaultView();
}

if (target === "invoices") {
  closeInvoiceCreatePanel();   // show list by default
  loadInvoiceSuitieDropdown(); // your dropdown loader
}

  });
});


  // ✅ ALWAYS land on dashboard on initial page load
  showSection("dashboard");
}






                  // ================================
                         // Dashboard Section
                  // ================================

//Load number of locations 
function updateDashboardCounts() {
  // Locations
  const locCountEl = document.getElementById("dash-locations-count");
  if (locCountEl) {
    const locations = Array.isArray(window.STATE.locations) ? window.STATE.locations : [];
    locCountEl.textContent = String(locations.length);
  }

  // Suities (if you still want this card elsewhere)
  const suitiesCountEl = document.getElementById("dash-suities-count");
  if (suitiesCountEl) {
    const suities = Array.isArray(window.STATE.suities) ? window.STATE.suities : [];
    suitiesCountEl.textContent = String(suities.length);
  }

  // ✅ Applications (dashboard card)
  const appsCountEl = document.getElementById("dash-applications-count");
  if (appsCountEl) {
    const apps = Array.isArray(window.STATE.applications) ? window.STATE.applications : [];
    appsCountEl.textContent = String(apps.length);
  }
}
//open tabs 
function openTab(tabId) {
  document.querySelectorAll(".section").forEach((sec) => {
    sec.classList.remove("active");
    sec.hidden = true;
  });

  const target = document.getElementById(tabId);
  if (target) {
    target.hidden = false;
    target.classList.add("active");
  }

  document.querySelectorAll("#nav button[data-target]").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.target === tabId);
  });

  // ✅ FIX: when opening Locations, default to list if they have locations
  if (tabId === "locations") {
    ensureLocationsTabDefaultView();
  }
}



function initDashboardCardNav() {
  const locCard  = document.getElementById("dash-card-locations");
  const appsCard = document.getElementById("dash-card-applications");

  locCard?.addEventListener("click", () => openTab("locations"));

  // ✅ Applications card should open Suites section
  appsCard?.addEventListener("click", () => openTab("suites")); // <-- must match your section id
}

//Disable Tabs if the user does not have a location
function userHasAnyLocation() {
  const locs = Array.isArray(window.STATE?.locations) ? window.STATE.locations : [];
  return locs.length > 0;
}

function setNavLockedState(isLocked) {
  const nav = document.getElementById("nav");
  if (!nav) return;

  // Tabs that should remain usable even when locked
  const allowedWhenLocked = new Set(["locations"]); // keep only Locations clickable

  nav.querySelectorAll("button[data-target]").forEach((btn) => {
    const target = btn.getAttribute("data-target");

    const lockThis = isLocked && !allowedWhenLocked.has(target);

    btn.classList.toggle("is-locked", lockThis);
    btn.dataset.locked = lockThis ? "1" : "0";

    // true disable prevents click + focus; we can also intercept click below
    btn.disabled = lockThis;
  });
}

/**
 * Intercepts clicks when locked and shows alert.
 * (Even though disabled blocks clicks, this also covers any future changes
 * where you don't want to set disabled=true.)
 */
/**function initNavLocationGuard() {
  const nav = document.getElementById("nav");
  if (!nav) return;

  nav.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-target]");
    if (!btn) return;

    const target = btn.getAttribute("data-target");
    const locked = btn.dataset.locked === "1";

    if (locked) {
      e.preventDefault();
      e.stopPropagation();

      alert("Please create a location first.");

      // send them to Locations + open the create form
      openTab("locations");
      if (typeof window.openLocationCreateForm === "function") {
        window.openLocationCreateForm();
      }
 

/**
 * Call this after locations load.
 * If no locations: force Locations tab open + open form + lock other tabs.
 * If locations exist: unlock everything.
 */
function enforceLocationGate() {
  const hasLoc = userHasAnyLocation();

  setNavLockedState(!hasLoc);

  if (!hasLoc) {
    openTab("locations");
    if (typeof window.openLocationCreateForm === "function") {
      window.openLocationCreateForm();
    }
  }
}








                                 // ================================
                                          // Locations Section
                                 // ================================
let hasForcedFirstLocationFlow = false;

//scroll to Add Suite Section when Suite is clicked 
document.getElementById("location-scroll-suites-btn")?.addEventListener("click", () => {
  const target = document.getElementById("location-suites-section");
  if (!target) return;

  target.scrollIntoView({ behavior: "smooth", block: "start" });
});

// ================================
// Locations: render helpers
// ================================
function ensureLocationsTabDefaultView() {
  const hasLoc = userHasAnyLocation();

  const formCard   = document.getElementById("location-form-card");
  const listEl     = document.getElementById("locations-list");
  const detailsCard = document.getElementById("location-details-card");
  const header     = document.querySelector("#locations .section-head");
  const addBtn     = document.getElementById("locations-add-btn");

  if (hasLoc) {
    // ✅ show list, hide form + hide details
    if (formCard) formCard.hidden = true;
    if (detailsCard) detailsCard.style.display = "none";
    if (header) header.style.display = "";
    if (listEl) listEl.style.display = "block";
    if (addBtn) addBtn.style.display = ""; // show add button
  } else {
    // ✅ no locations → force create flow
    if (typeof window.openLocationCreateForm === "function") {
      window.openLocationCreateForm();
    } else if (formCard) {
      formCard.hidden = false;
      if (listEl) listEl.style.display = "none";
    }
  }
}

function safe(v) {
  return (v ?? "").toString();
}

function getLocValue(row, keyList) {
  const v = row?.values || row || {};
  for (const k of keyList) {
    if (v[k] != null && String(v[k]).trim() !== "") return v[k];
  }
  return "";
}

function resolveImg(raw) {
  if (!raw) return "";

  // If DB stored an object like { url: "..." }
  if (typeof raw === "object" && raw.url) raw = raw.url;

  // If DB stored an array, use first
  if (Array.isArray(raw)) raw = raw[0];

  const s = String(raw).trim();
  if (!s) return "";

  // already absolute
  if (/^https?:\/\//i.test(s)) return s;

  // ✅ if it starts with "/" (ex: /uploads/xyz.png), it MUST come from API server (8400)
  if (s.startsWith("/")) return apiUrl(s);

  // relative without slash
  return apiUrl("/" + s);
}


function renderLocations() {
  const listEl = document.getElementById("locations-list");
  if (!listEl) return;

  const locations = (window.STATE?.locations || []).slice();

  if (!locations.length) {
    listEl.innerHTML = `<p class="muted">No locations yet. Click “Add location”.</p>`;
    return;
  }

  listEl.innerHTML = locations
    .map((loc) => {
      const name = safe(getLocValue(loc, ["Location Name", "name", "Name"]));
      const address = safe(getLocValue(loc, ["Address", "address", "Location Address"]));
      const phone = safe(getLocValue(loc, ["Phone Number", "phone", "Phone"]));

      // ✅ match your DataType: Default Image
      const imgRaw = getLocValue(loc, [
        "Default Image",
        "Default Photo",
        "defaultPhoto",
        "photoUrl",
        "heroImageUrl",
        "heroImage",
        "image",
      ]);

      const img = resolveImg(imgRaw);
      const id = loc?._id || loc?.id || "";

      return `
        <button class="location-card-row" type="button" data-location-id="${id}">
          <div class="location-card-thumb">
            ${
              img
                ? `<img src="${img}" alt="${name}" />`
                : `<div class="location-card-thumb--empty"></div>`
            }
          </div>

          <div class="location-card-info">
            <div class="location-card-title">${name || "Untitled location"}</div>
            <div class="location-card-line">${address}</div>
            <div class="location-card-line muted">${phone}</div>
          </div>
        </button>
      `;
    })
    .join("");

      listEl.querySelectorAll("[data-location-id]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-location-id");
      const loc = (window.STATE?.locations || []).find((x) => (x._id || x.id) === id);
      if (!loc) return;
      showLocationDetails(loc);
    });
  });
}

//Show Add Location Section when the user does not have any locations 
function maybeForceCreateFirstLocation() {
  // ✅ prevent re-triggering
  if (hasForcedFirstLocationFlow) return;

  const locations = Array.isArray(window.STATE.locations)
    ? window.STATE.locations
    : [];

  // ✅ if they already have locations → DO NOTHING
  if (locations.length > 0) return;

  hasForcedFirstLocationFlow = true;

  // ✅ go to Locations tab
  openTab("locations");

  // ✅ open create form
  if (typeof window.openLocationCreateForm === "function") {
    window.openLocationCreateForm();
  } else {
    document.getElementById("location-form-card")?.removeAttribute("hidden");
    document.getElementById("locations-list")?.style &&
      (document.getElementById("locations-list").style.display = "none");
  }

  // ✅ scroll to top so form is visible
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function handleInitialLandingTab() {
  const locations = Array.isArray(window.STATE.locations)
    ? window.STATE.locations
    : [];

  if (locations.length > 0) {
    // ✅ normal users go to dashboard
    openTab("dashboard");
    try { localStorage.setItem("suiteSettingsActiveTab", "dashboard"); } catch {}
  } else {
    // ✅ first-time users go to add location + lock tabs
    try { localStorage.removeItem("suiteSettingsActiveTab"); } catch {}
    enforceLocationGate(); // this opens locations + create form
  }
}


async function loadLocations() {
  console.log("[locations] currentUser.id =", currentUser?.id);
  if (!currentUser?.id) {
    

    console.warn("[locations] no currentUser yet");
    window.STATE.locations = [];
    renderLocations();
enforceLocationGate();
handleInitialLandingTab();
    populateSuitiesLocationFilter(window.STATE.locations);
    return;
  }

const url = apiUrl(`/api/records/Location?limit=200`);
console.log("[locations] fetch url =", url);
console.log("[locations] currentUser.id =", currentUser?.id);


  try {
    const res = await fetch(url, {
      credentials: "include",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });

    if (!res.ok) {
      const errBody = await readJsonSafe(res);
      console.warn("[locations] load failed", res.status, errBody);

      window.STATE.locations = [];
      renderLocations();
      populateSuitiesLocationFilter(window.STATE.locations);
      return;
    }

    const data = await res.json().catch(() => ({}));
    const rows = Array.isArray(data)
      ? data
      : data.records || data.items || data.data || [];

       console.log("[locations] rows count =", rows.length);
    console.log(
      "[locations] first row ownerUserId =",
      rows?.[0]?.values?.ownerUserId || rows?.[0]?.ownerUserId
    );
    window.STATE.locations = rows;
    renderLocations();
    

enforceLocationGate();
// ✅ decide where to land AFTER data is loaded
handleInitialLandingTab();

    // ✅ populate dropdowns
    populateSuitiesLocationFilter(rows);
    populateSuitieLocationSelect(rows);
    populateSuitesLocationFilter(rows); // Suites section filter dropdown

    
    // ✅ update dashboard
    updateDashboardCounts();

    // ✅ NOW load applications table (needs currentUser to be set already)
    await loadSuiteApplications();

  } catch (err) {
    console.error("[locations] load error", err);

    window.STATE.locations = [];
    renderLocations();
    populateSuitiesLocationFilter(window.STATE.locations);
    updateDashboardCounts();

  }
}



// ================================
// Locations: Add button -> show form / hide cards
// ================================
function initLocationsUI() {
  const addBtn   = document.getElementById("locations-add-btn");
  const formCard = document.getElementById("location-form-card");
  const listEl   = document.getElementById("locations-list");
  const form     = document.getElementById("location-form");
  const idInput  = document.getElementById("loc-id");
  const cancelBtn = document.getElementById("location-cancel-btn");

  const locCurrentPhoto   = document.getElementById("loc-current-photo");
  const locCurrentGallery = document.getElementById("loc-current-gallery");
  const locNewGalleryPrev = document.getElementById("loc-new-gallery-preview");
  const photoFileInput    = document.getElementById("loc-photo-file");
  const galleryInput      = document.getElementById("loc-gallery-files");

  function openCreateForm() {
     locationFormReturnTo = "list"; // ✅ add mode returns to list

    // ✅ HIDE Add Location button while form is open
  if (addBtn) addBtn.style.display = "none";

    if (idInput) idInput.value = "";
    form?.reset();

    if (formCard) formCard.hidden = false;
    if (listEl) listEl.style.display = "none";

    if (locCurrentPhoto) locCurrentPhoto.textContent = "No photo uploaded yet.";
    if (locCurrentGallery) locCurrentGallery.innerHTML = "";
    if (locNewGalleryPrev) locNewGalleryPrev.innerHTML = "";
    if (photoFileInput) photoFileInput.value = "";
    if (galleryInput) galleryInput.value = "";
  }

  function closeFormBackToList() {
    if (formCard) formCard.hidden = true;
    if (listEl) listEl.style.display = "block";

      // ✅ SHOW Add Location button again
  if (addBtn) addBtn.style.display = "";

    form?.reset();
    if (idInput) idInput.value = "";
  }

  addBtn?.addEventListener("click", openCreateForm);
 cancelBtn?.addEventListener("click", closeLocationForm);


  window.openLocationCreateForm = openCreateForm;
  window.closeLocationForm = closeFormBackToList;

  window._clearLocationMainPreview?.();
window._clearLocationGalleryPreview?.();
window.closeLocationForm = closeLocationForm;

}




//Add X and Remove location preview images 
// ------------------------------
// Pending files (new uploads)
// ------------------------------
let pendingMainPhotoFile = null;
let pendingGalleryFiles = [];
// 🆕 existing images for the record (edit mode)
let existingMainPhotoUrl = "";
let existingGalleryUrls = [];
let galleryRemoveSet = new Set(); // urls to remove when saving
// ------------------------------
// Main photo preview + remove X
// ------------------------------
function initMainPhotoPreview() {
  const input = document.getElementById("loc-photo-file");
  const holder = document.getElementById("loc-current-photo");
  if (!input || !holder) return;

  function render() {
    if (!pendingMainPhotoFile) {
      holder.innerHTML = `<span class="muted">No photo uploaded yet.</span>`;
      return;
    }

    const url = URL.createObjectURL(pendingMainPhotoFile);

    holder.innerHTML = `
      <div class="gallery-thumb-wrapper">
        <button type="button" class="gallery-thumb-remove" aria-label="Remove photo">×</button>
        <img src="${url}" alt="Default photo preview" />
      </div>
    `;

    // cleanup blob url
    holder.querySelector("img")?.addEventListener("load", (e) => {
      try { URL.revokeObjectURL(url); } catch {}
    });

    holder.querySelector(".gallery-thumb-remove")?.addEventListener("click", () => {
      pendingMainPhotoFile = null;
      input.value = "";
      render();
    });
  }

  input.addEventListener("change", () => {
    const file = input.files && input.files[0];
    pendingMainPhotoFile = file || null;
    render();
  });

  // initial
  render();

  // optional expose for your openCreateForm reset
  window._resetMainPhotoPreview = () => {
    pendingMainPhotoFile = null;
    input.value = "";
    render();
  };
}

// ------------------------------
// Gallery preview + remove X
// ------------------------------

function initGalleryPreview() {
  const input = document.getElementById("loc-gallery-files");
  const holder = document.getElementById("loc-new-gallery-preview");
  if (!input || !holder) return;

  function render() {
    if (!pendingGalleryFiles.length) {
      holder.innerHTML = "";
      return;
    }

    holder.innerHTML = pendingGalleryFiles
      .map((file, idx) => {
        const url = URL.createObjectURL(file);
        return `
          <div class="gallery-thumb-wrapper" data-idx="${idx}">
            <button type="button"
              class="gallery-thumb-remove"
              data-remove="${idx}"
              aria-label="Remove image">×</button>
            <img src="${url}" alt="${file.name}" />
          </div>
        `;
      })
      .join("");

    // cleanup blob URLs after load
    holder.querySelectorAll("img").forEach((img) => {
      img.addEventListener("load", () => {
        try { URL.revokeObjectURL(img.src); } catch {}
      });
    });

    // X buttons
    holder.querySelectorAll("[data-remove]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = Number(btn.getAttribute("data-remove"));
        if (!Number.isFinite(idx)) return;

        // remove just that one image from the pending list
        pendingGalleryFiles.splice(idx, 1);
        render();
      });
    });
  }

  input.addEventListener("change", () => {
    const newFiles = input.files ? Array.from(input.files) : [];
    if (!newFiles.length) return;

    // ✅ APPEND (do not replace)
    pendingGalleryFiles.push(...newFiles);

    // ✅ allow selecting same file again later
    input.value = "";

    render();
  });

  // optional: reset helper for your "Add Location" button
  window._resetGalleryPreview = () => {
    pendingGalleryFiles = [];
    input.value = "";
    render();
  };

  render();
}


///////// ================================
/////////////// Save Location
//// ///================================
function slugify(str) {
  return String(str || "")
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}



// ✅ Try your Live endpoint first, then fallback
// ✅ CREATE Location (your server does NOT support POST /public/records)
async function createLocationRecord(values) {
  const res = await fetch(apiUrl(`/api/records/Location`), {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ values }),
  });

  const data = await readJsonSafe(res);
  if (!res.ok) {
    console.warn("[locations] create failed", res.status, data);
    throw new Error(data?.message || "Failed to create location");
  }
  return data;
}


function closeLocationForm() {
  const formCard = document.getElementById("location-form-card");
  const listEl = document.getElementById("locations-list");
  const form = document.getElementById("location-form");
  const idInput = document.getElementById("loc-id");
  const detailsCard = document.getElementById("location-details-card");
  const header = document.querySelector("#locations .section-head");

  if (formCard) formCard.hidden = true;
  form?.reset();
  if (idInput) idInput.value = "";

  if (locationFormReturnTo === "details" && selectedLocation) {
    // ✅ go back to details view
    if (listEl) listEl.style.display = "none";
    if (header) header.style.display = "none";
    if (detailsCard) detailsCard.style.display = "block";

    // optional: re-render details so it’s fresh
    showLocationDetails(selectedLocation);
      // ✅ scroll to top of page
  window.scrollTo({ top: 0, behavior: "smooth" });
  } else {
    // ✅ default behavior: back to list
    if (detailsCard) detailsCard.style.display = "none";
    if (header) header.style.display = "";
    if (listEl) listEl.style.display = "block";
  }
}

//Upload image helper
async function uploadOneImage(file) {
  const fd = new FormData();
  fd.append("file", file);

  // ✅ MUST hit the live server upload route
  const res = await fetch(apiUrl(`/api/upload`), {
    method: "POST",
    credentials: "include",
    body: fd,
  });

  const data = await readJsonSafe(res);
  if (!res.ok || !data?.url) {
    console.warn("[upload] failed", res.status, data);
    throw new Error(data?.message || "Image upload failed");
  }

  return data.url;
}


function initLocationSave() {
  const form = document.getElementById("location-form");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    if (!currentUser?.id) return alert("You must be logged in.");

    const nameEl = document.getElementById("loc-name");
    const addrEl = document.getElementById("loc-address");
    const phoneEl = document.getElementById("loc-phone");
    const detailsEl = document.getElementById("loc-details");
    const aboutEl = document.getElementById("loc-about");

    const locationName = nameEl?.value?.trim() || "";
    const address = addrEl?.value?.trim() || "";
    const phone = phoneEl?.value?.trim() || "";
    const details = detailsEl?.value?.trim() || "";
    const about = aboutEl?.value?.trim() || "";

const locId = document.getElementById("loc-id")?.value?.trim();
const isEditing = !!locId;

    if (!locationName) return alert("Location name is required.");
    if (!address) return alert("Address is required.");

    const baseSlug = slugify(locationName);
    const slug =
      baseSlug || `location-${Math.random().toString(36).slice(2, 8)}`;

    // ✅ MATCH your DataType field names
    const values = {
      "Location Name": locationName,
      "Address": address,
      "Phone Number": phone,
      "Details": details,
      "About Me": about,

      // ✅ slug for dynamic page
      slug,

      // ✅ ownership
      ownerUserId: currentUser.id,
      "Created By": currentUser.id, // if your API expects { _id: id } we can swap later
    };

    try {
      // =========================================================
      // ✅ MAIN PHOTO UPLOAD (Default Image)
      // =========================================================
    if (pendingMainPhotoFile) {
  const mainUrl = await uploadOneImage(pendingMainPhotoFile);
  values["Default Image"] = mainUrl;
} else {
  // keep existing (or empty if removed)
  values["Default Image"] = existingMainPhotoUrl || "";
}

      // =========================================================
      // ✅ GALLERY UPLOAD (Gallery Images)
      // =========================================================
      // ✅ THIS is where it goes:
       const keptOldGallery = (existingGalleryUrls || []).filter(
      (url) => !galleryRemoveSet.has(url)
    );

    const newGalleryUrls = [];
    for (const file of pendingGalleryFiles) {
      const url = await uploadOneImage(file);
      newGalleryUrls.push(url);
    }

    values["Gallery Images"] = [...keptOldGallery, ...newGalleryUrls];


      // =========================================================
      // ✅ CREATE SAVE LOCATION RECORD
      // =========================================================
    if (isEditing) {
  await updateLocationRecord(locId, values);
} else {
  await createLocationRecord(values);
}


      // refresh list
      await loadLocations();
handleInitialLandingTab();


  // reset state
pendingMainPhotoFile = null;
pendingGalleryFiles = [];
existingMainPhotoUrl = "";
existingGalleryUrls = [];
galleryRemoveSet = new Set();

const idEl = document.getElementById("loc-id");
if (idEl) idEl.value = "";


      // hide form
      closeLocationFormBackToList();
    } catch (err) {
      console.error("[locations] save error", err);
      alert(err?.message || "Failed to save location");
    }
  });
}



///////// ================================
/////////////// Edit Location
//// ///================================

//Render existing main photo (with optional remove)
function renderExistingMainPhoto() {
  const holder = document.getElementById("loc-current-photo");
  const input  = document.getElementById("loc-photo-file");
  if (!holder) return;

  // If user picked a NEW file, let the "pending main photo preview" handle it
  if (pendingMainPhotoFile) return;

  if (!existingMainPhotoUrl) {
    holder.innerHTML = `<span class="muted">No photo uploaded yet.</span>`;
    return;
  }

  holder.innerHTML = `
    <div class="gallery-thumb-wrapper">
      <button type="button" class="gallery-thumb-remove" aria-label="Remove photo">×</button>
      <img src="${existingMainPhotoUrl}" alt="Current default photo" />
    </div>
  `;

  holder.querySelector(".gallery-thumb-remove")?.addEventListener("click", () => {
    // “remove existing” means: clear url (and we simply won’t save it)
    existingMainPhotoUrl = "";
    if (input) input.value = "";
    renderExistingMainPhoto();
  });
}
//Render existing gallery (with X buttons)
function renderExistingGallery() {
  const holder = document.getElementById("loc-current-gallery");
  if (!holder) return;

  if (!existingGalleryUrls.length) {
    holder.innerHTML = `<span class="muted">No gallery images yet.</span>`;
    return;
  }

  holder.innerHTML = existingGalleryUrls
    .map((url) => {
      const removed = galleryRemoveSet.has(url);
      return `
        <div class="gallery-thumb-wrapper" data-url="${url}" style="${removed ? "opacity:.35;" : ""}">
          <button type="button" class="gallery-thumb-remove" aria-label="Remove image">×</button>
          <img src="${url}" alt="Gallery image" />
        </div>
      `;
    })
    .join("");

  holder.querySelectorAll(".gallery-thumb-wrapper").forEach((wrap) => {
    const url = wrap.getAttribute("data-url");
    const btn = wrap.querySelector(".gallery-thumb-remove");
    btn?.addEventListener("click", () => {
      if (!url) return;
      // mark for removal (toggle)
      if (galleryRemoveSet.has(url)) galleryRemoveSet.delete(url);
      else galleryRemoveSet.add(url);

      renderExistingGallery();
    });
  });
}
//opens the location form in edit mode
function openEditLocationForm(loc) {
    // ✅ hide Add Location button while editing
  document.getElementById("locations-add-btn")?.style && (document.getElementById("locations-add-btn").style.display = "none");

  selectedLocation = loc;

  locationFormReturnTo = "details"; // ✅ return here on cancel

  const formCard = document.getElementById("location-form-card");
  const listEl   = document.getElementById("locations-list");
  const form     = document.getElementById("location-form");

  // if you have a details wrapper/card, hide it here:
  const detailsCard = document.getElementById("location-details-card"); 
  // ^ if your details section has a different id, change it

  // inputs
  const idInput     = document.getElementById("loc-id");
  const nameEl      = document.getElementById("loc-name");
  const addrEl      = document.getElementById("loc-address");
  const phoneEl     = document.getElementById("loc-phone");
  const detailsEl   = document.getElementById("loc-details");
  const aboutEl     = document.getElementById("loc-about");

  // ✅ put ID in hidden field so save knows it’s an edit later
  const locId = loc?._id || loc?.id || "";
  if (idInput) idInput.value = locId;

  // pull values (works whether it’s {values:{}} or top-level)
  const v = loc?.values || loc || {};

  // ✅ prefill text fields
  if (nameEl)    nameEl.value    = v["Location Name"] || v.name || "";
  if (addrEl)    addrEl.value    = v["Address"] || v.address || "";
  if (phoneEl)   phoneEl.value   = v["Phone Number"] || v.phone || "";
  if (detailsEl) detailsEl.value = v["Details"] || "";
  if (aboutEl)   aboutEl.value   = v["About Me"] || v["About"] || "";

  // ✅ reset pending new uploads (fresh start for this edit session)
  pendingMainPhotoFile = null;
  pendingGalleryFiles = [];

  // ✅ load existing images into “existing” variables
  existingMainPhotoUrl =
    v["Default Image"] ||
    v["Default Photo"] ||
    v.photoUrl ||
    v.heroImageUrl ||
    v.heroImage ||
    "";

  existingGalleryUrls =
    v["Gallery Images"] ||
    v["Location Gallery"] ||
    [];

  if (!Array.isArray(existingGalleryUrls)) existingGalleryUrls = [];

  galleryRemoveSet = new Set(); // clear removals for new edit session

  // ✅ show form / hide list + details
  if (formCard) formCard.hidden = false;
  if (listEl) listEl.style.display = "none";
  if (detailsCard) detailsCard.style.display = "none";

  // ✅ render existing previews
  renderExistingMainPhoto();
  renderExistingGallery();

  // ✅ clear “new gallery preview” area (new picks will appear there)
  const newPrev = document.getElementById("loc-new-gallery-preview");
  if (newPrev) newPrev.innerHTML = "";

  // optional: scroll to form
  formCard?.scrollIntoView({ behavior: "smooth", block: "start" });
}

//open modal in edit mode 
function initLocationEditButton() {
  const editBtn = document.getElementById("location-edit-btn");
  if (!editBtn) return;

  editBtn.addEventListener("click", () => {
    if (!selectedLocation) return alert("Open a location first.");
    openEditLocationForm(selectedLocation);
  });
}

//update location
async function updateLocationRecord(id, values) {
  const res = await fetch(apiUrl(`/api/records/Location/${encodeURIComponent(id)}`), {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ values }),
  });

  const data = await readJsonSafe(res);
  if (!res.ok) throw new Error(data?.message || "Failed to update location");
  return data;
}



///////// ================================
/////////////// Delete Location
//// ///================================
//delete location helper 
async function deleteLocationRecord(id) {
  let res = await fetch(apiUrl(`/api/records/Location/${encodeURIComponent(id)}`), {
    method: "DELETE",
    credentials: "include",
    headers: { Accept: "application/json" },
  });

  if (res.status === 404) {
    res = await fetch(apiUrl(`/api/records/Location?id=${encodeURIComponent(id)}`), {
      method: "DELETE",
      credentials: "include",
      headers: { Accept: "application/json" },
    });
  }

  const data = await readJsonSafe(res);
  if (!res.ok) throw new Error(data?.message || "Failed to delete location");
  return data;
}


function initLocationDeleteButton() {
  const delBtn = document.getElementById("location-delete-btn");
  if (!delBtn) return;

  delBtn.addEventListener("click", async () => {
    if (!selectedLocation) return alert("Open a location first.");

    const id = selectedLocation?._id || selectedLocation?.id;
    if (!id) return alert("Missing location id.");

    const v = selectedLocation?.values || selectedLocation || {};
    const name = v["Location Name"] || v.name || "this location";

    const ok = window.confirm(`Are you sure you want to delete "${name}"?`);
    if (!ok) return;

    try {
      await deleteLocationRecord(id);

      // ✅ refresh + back to list UI
      await loadLocations();
      backToLocationsList();

      alert("Location deleted.");
    } catch (err) {
      console.error("[locations] delete error", err);
      alert(err?.message || "Failed to delete location");
    }
  });
}

///////// ================================
/////////////// Style Location
//// ///================================

// background image state
let pendingBgImageFile = null;
let existingBgImageUrl = "";

// Open modal + preload values
function openLocationStyleModal() {
  const modal = document.getElementById("location-style-modal");
  const bgColorEl = document.getElementById("location-style-bg-color");
  const textColorEl = document.getElementById("location-style-text-color");
  const bgFileEl = document.getElementById("location-style-bg-image");
  const previewEl = document.getElementById("location-style-bg-preview");

  if (!selectedLocation) return alert("Open a location first.");
  const v = selectedLocation.values || selectedLocation || {};

  // preload fields (these match your DataType fields)
  const bgColor = v["Background Color"] || "#ffffff";
  const textColor = v["Text Color"] || "#111111";

  if (bgColorEl) bgColorEl.value = bgColor;
  if (textColorEl) textColorEl.value = textColor;

  // preload existing bg image url
  existingBgImageUrl = v["Background Image"] || "";
  pendingBgImageFile = null;

  if (bgFileEl) bgFileEl.value = "";

  if (previewEl) {
    previewEl.innerHTML = existingBgImageUrl
      ? `<img src="${existingBgImageUrl}" style="width:100%; max-height:140px; object-fit:cover; border-radius:12px;" />`
      : `<p class="muted">No background image yet.</p>`;
  }

  if (modal) {
    modal.hidden = false;
    modal.setAttribute("aria-hidden", "false");
  }
}

// close modal safely (avoid aria-hidden focus warning)
function closeLocationStyleModal() {
  const modal = document.getElementById("location-style-modal");
  if (!modal) return;

  // ✅ remove focus from anything inside the modal first
  if (document.activeElement && modal.contains(document.activeElement)) {
    document.activeElement.blur();
  }

  modal.hidden = true;
  modal.setAttribute("aria-hidden", "true");
}

function initLocationStyleModal() {
  const openBtn = document.getElementById("location-style-btn");
  const modal = document.getElementById("location-style-modal");
  const closeBtn = document.getElementById("location-style-close-btn");
  const cancelBtn = document.getElementById("location-style-cancel-btn");
  const saveBtn = document.getElementById("location-style-save-btn");

  const bgFileEl = document.getElementById("location-style-bg-image");
  const previewEl = document.getElementById("location-style-bg-preview");

  const bgColorEl = document.getElementById("location-style-bg-color");
  const textColorEl = document.getElementById("location-style-text-color");

  // open
  openBtn?.addEventListener("click", openLocationStyleModal);

  // close
  closeBtn?.addEventListener("click", closeLocationStyleModal);
  cancelBtn?.addEventListener("click", closeLocationStyleModal);

  // click backdrop
  modal?.addEventListener("click", (e) => {
    if (e.target === modal) closeLocationStyleModal();
  });

  // Esc
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal && !modal.hidden) closeLocationStyleModal();
  });

  // background preview
  bgFileEl?.addEventListener("change", () => {
    const file = bgFileEl.files?.[0];
    if (!file) return;

    pendingBgImageFile = file;

    const url = URL.createObjectURL(file);
    if (previewEl) {
      previewEl.innerHTML = `
        <img src="${url}" style="width:100%; max-height:140px; object-fit:cover; border-radius:12px;" />
        <div class="muted" style="margin-top:6px;">${file.name}</div>
      `;
    }
  });

  // ✅ SAVE (this is the only save listener)
  saveBtn?.addEventListener("click", async () => {
    try {
      if (!selectedLocation) return alert("Open a location first.");

      const locId = selectedLocation._id || selectedLocation.id;
      if (!locId) return alert("Missing location id.");

      const values = {
        "Background Color": bgColorEl?.value || "#ffffff",
        "Text Color": textColorEl?.value || "#111111",
      };

      // upload new bg image if selected, else keep existing
      if (pendingBgImageFile) {
        const url = await uploadOneImage(pendingBgImageFile);
        values["Background Image"] = url;
        existingBgImageUrl = url;
        pendingBgImageFile = null;
      } else {
        values["Background Image"] = existingBgImageUrl || "";
      }

      await updateLocationRecord(locId, values);

      // update selectedLocation locally
      const v = selectedLocation.values || {};
      selectedLocation = { ...selectedLocation, values: { ...v, ...values } };

      // update in STATE list too
      window.STATE.locations = (window.STATE.locations || []).map((x) => {
        const id = x._id || x.id;
        if (id !== locId) return x;
        const xv = x.values || {};
        return { ...x, values: { ...xv, ...values } };
      });

      alert("Style saved!");
      closeLocationStyleModal();

      // optional: refresh details view if open
      // showLocationDetails(selectedLocation);
    } catch (err) {
      console.error("[style] save error", err);
      alert(err?.message || "Failed to save style.");
    }
  });
}


function initLocationStyleSave(closeModalFn) {
  const saveBtn = document.getElementById("location-style-save-btn");
  const bgColorEl = document.getElementById("location-style-bg-color");
  const textColorEl = document.getElementById("location-style-text-color");

  saveBtn?.addEventListener("click", async () => {
    try {
      if (!selectedLocation) return alert("Open a location first.");

      const locId = selectedLocation._id || selectedLocation.id;
      if (!locId) return alert("Missing location id.");

      const values = {
        "Background Color": bgColorEl?.value || "#ffffff",
        "Text Color": textColorEl?.value || "#111111",
      };

      // background image: upload if new file chosen, else keep existing
      if (pendingBgImageFile) {
        const url = await uploadOneImage(pendingBgImageFile);
        values["Background Image"] = url;
        existingBgImageUrl = url;
        pendingBgImageFile = null;
      } else {
        values["Background Image"] = existingBgImageUrl || "";
      }

      await updateLocationRecord(locId, values);

      // ✅ update selectedLocation locally
      const v = selectedLocation.values || {};
      selectedLocation = { ...selectedLocation, values: { ...v, ...values } };

      // ✅ update in STATE list too
      window.STATE.locations = (window.STATE.locations || []).map((x) => {
        const id = x._id || x.id;
        if (id !== locId) return x;
        const xv = x.values || {};
        return { ...x, values: { ...xv, ...values } };
      });

      alert("Style saved!");
      closeModalFn?.();

      // optional: refresh details view if you're showing it
      // showLocationDetails(selectedLocation);

    } catch (err) {
      console.error("[style] save error", err);
      alert(err?.message || "Failed to save style.");
    }
  });
}

  // =========================================================
      // ✅ SHOW LOCATION DETAILS SECTION
      // =========================================================
let selectedLocation = null;
let locationFormReturnTo = "list"; // "list" | "details"

function resolveAnyImg(raw) {
  if (!raw) return "";
  const s = String(raw).trim();
  if (/^https?:\/\//i.test(s)) return s;
  if (s.startsWith("/")) return s;
  return `/${s}`;
}

function showLocationDetails(loc) {
  selectedLocation = loc;

  const listEl = document.getElementById("locations-list");
  const detailsCard = document.getElementById("location-details-card");
  const header = document.querySelector("#locations .section-head"); // your header row

  // ✅ hide list + header
  if (listEl) listEl.style.display = "none";
  if (header) header.style.display = "none";

  // ✅ show details
  if (detailsCard) detailsCard.style.display = "block";

  // --- pull values safely ---
  const v = loc?.values || loc || {};
  const name =
    v["Location Name"] || v.name || v.Name || "Location";
  const address =
    v["Address"] || v.address || "";
  const phone =
    v["Phone Number"] || v.phone || "";
  const details =
    v["Details"] || "";
  const about =
    v["About Me"] || v["About"] || "";
  const slug =
    v["slug"] || v["Slug"] || "";

  // Default image field
  const defaultImgRaw =
    v["Default Image"] || v["Default Photo"] || v.photoUrl || "";
  const defaultImg = resolveAnyImg(defaultImgRaw);

  // Gallery field
  const galleryRaw =
    v["Gallery Images"] || v["Location Gallery"] || [];
  const gallery = Array.isArray(galleryRaw) ? galleryRaw : [];

  // --- fill UI ---
  const setText = (id, text) => {
    const el = document.getElementById(id);
    if (el) el.textContent = text || "—";
  };

  setText("location-details-name", name);
  setText("location-details-address", address);
  setText("location-details-address-full", address);
  setText("location-details-phone", phone);
  setText("location-details-desc", details);
  setText("location-details-about", about);

  // Set the "Go to Location ↗" button label
  const pubName = document.getElementById("location-view-public-name");
  if (pubName) pubName.textContent = name;

  // Photo
  const photoEl = document.getElementById("location-details-photo");
  if (photoEl) {
    if (defaultImg) {
      photoEl.src = defaultImg;
      photoEl.style.display = "block";
    } else {
      photoEl.src = "";
      photoEl.style.display = "none";
    }
  }

  // Gallery
  const galEl = document.getElementById("location-details-gallery");
  if (galEl) {
    if (!gallery.length) {
      galEl.innerHTML = `<p class="muted">No gallery images yet.</p>`;
    } else {
      galEl.innerHTML = gallery
        .map((url) => {
          const u = resolveAnyImg(url);
          return `<img class="location-gallery-thumb" src="${u}" alt="Gallery image" />`;
        })
        .join("");
    }
  }

  // Public page button
  const publicBtn = document.getElementById("location-view-public-btn");
  publicBtn?.addEventListener("click", () => {
    if (!slug) return alert("This location doesn’t have a slug yet.");
    window.open(`/${encodeURIComponent(slug)}`, "_blank");
  }, { once: true }); // prevents stacking listeners each time
  
  const locId = loc?._id || loc?.id;
if (locId) loadSuitesForLocation(locId);

}

function backToLocationsList() {
  const listEl = document.getElementById("locations-list");
  const detailsCard = document.getElementById("location-details-card");
  const header = document.querySelector("#locations .section-head");

  if (detailsCard) detailsCard.style.display = "none";
  if (header) header.style.display = ""; // let CSS handle it
  if (listEl) listEl.style.display = "block";

    // ✅ SHOW Add Location button again when returning to list
  const addBtn = document.getElementById("locations-add-btn");
  if (addBtn) addBtn.style.display = "";

  selectedLocation = null;
}

function initLocationDetailsUI() {
  document
    .getElementById("location-back-btn")
    ?.addEventListener("click", backToLocationsList);
}

//Reset Locations When another tab is clicked 
function resetLocationsUI() {
  // If you have edit state vars, clear them (optional)
  if (typeof editingLocationId !== "undefined") editingLocationId = null;

  // hide form, show list/cards
  const formCard = document.getElementById("locations-form-card");
  const list = document.getElementById("locations-list") || document.getElementById("location-cards");
  if (formCard) formCard.hidden = true;
  if (list) list.style.display = "block";

  // show top controls again (optional helpers)
  if (typeof setLocationsTopControlsHidden === "function") {
    setLocationsTopControlsHidden(false);
  }

  // reset form
  document.getElementById("location-form")?.reset?.();

  // hide delete button if it’s edit-only
  const delBtn = document.getElementById("location-delete-btn");
  if (delBtn) delBtn.style.display = "none";

  // restore subtitle/filter row if you have them
  const sub = document.getElementById("locations-subtitle");
  const row = document.getElementById("locations-filter-row");
  if (sub) sub.style.display = "";
  if (row) row.style.display = "";
}

































                   // ------------------------------
                              //Suites Card
                // ------------------------------
//Helper to only show suites in that specific Location 
function getSuiteLocationId(suite) {
  const v = suite?.values || suite || {};

  // most common: you save it as values["Location"] = locationId
  let loc = v["Location"] ?? v.locationId ?? v.suiteLocationId ?? v.parentLocationId ?? "";

  // sometimes APIs store refs as objects
  if (loc && typeof loc === "object") {
    loc = loc._id || loc.id || loc.value || "";
  }

  return String(loc || "").trim();
}

// Show suites in Location Details section
async function loadSuitesForLocation(locationId) {
  const listEl = document.getElementById("location-suites-list");
  if (!listEl) return;

  if (!currentUser?.id) {
    listEl.innerHTML = `<p class="muted">Log in to view suites.</p>`;
    return;
  }

  listEl.innerHTML = `<p class="muted">Loading suites…</p>`;

  // ✅ AUTH endpoint (server enforces visibility)
  const url = apiUrl(`/api/records/Suite?limit=500`);

  try {
    const res = await fetch(url, {
      credentials: "include",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });

    if (!res.ok) {
      const errBody = await readJsonSafe(res);
      console.warn("[suites] load failed", res.status, errBody);
      listEl.innerHTML = `<p class="muted">Failed to load suites.</p>`;
      return;
    }

    const data = await res.json().catch(() => ({}));
    const rows = Array.isArray(data) ? data : data.records || data.items || data.data || [];

    const locIdStr = String(locationId || "").trim();

    // ✅ filter suites that belong to THIS location
    const filtered = rows.filter((s) => getSuiteLocationId(s) === locIdStr);

    // optional: keep them in STATE if you want (helps other parts of UI)
    window.STATE.suites = rows;

    renderSuitesList(filtered);
  } catch (err) {
    console.error("[suites] load error", err);
    listEl.innerHTML = `<p class="muted">Error loading suites.</p>`;
  }
}




//helper for available in suite card 
function fmtDateNice(val) {
  if (!val) return "";
  const s = String(val).trim();
  if (!s) return "";

  // If it's an ISO date or "2025-12-25", format to "Dec 25, 2025"
  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    return d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  // Otherwise return as-is
  return s;
}


function renderSuitesList(suites) {
  const listEl = document.getElementById("location-suites-list");
  if (!listEl) return;

  if (!Array.isArray(suites) || !suites.length) {
    listEl.innerHTML = `<p class="muted">No suites added yet for this location.</p>`;
    return;
  }

  listEl.innerHTML = suites
    .map((suite) => {
      const v = suite.values || suite || {};
      const id = suite._id || suite.id || "";

      const name =
        v["Suite Name"] || v.name || v.Name || "Untitled suite";

     const availRaw =
  v["Date Available"] ||
  v["Available Date"] ||
  v["Availability Date"] ||
  v.availableDate ||
  v.dateAvailable ||
  "";

const avail = fmtDateNice(availRaw);

      const rate =
        v["Suite Rent"] || v["Rate"] || v.rate || "";

      const freq =
        v["Rate Frequency"] || v["Frequency"] || v.frequency || "";

   const imgRaw = getLocValue(suite, [
  "Default Image",
  "Default Photo",
  "Suite Default Image",
  "Suite Default Photo",
  "Photo",
  "Image",
  "photoUrl",
  "heroImageUrl",
  "heroImage",
]);

const img = resolveImg(imgRaw);



      return `
        <button class="suite-card" type="button" data-suite-id="${id}">
          <div class="suite-card-thumb">
            ${
              img
                ? `<img src="${img}" alt="${name}" />`
                : `<div class="suite-card-thumb--empty"></div>`
            }
          </div>

          <div class="suite-card-info">
            <div class="suite-card-title">${name}</div>

            ${
              avail
                ? `<div class="suite-card-line muted">Available: ${avail}</div>`
                : `<div class="suite-card-line muted">Available: —</div>`
            }

         
          </div>
        </button>
      `;
    })
    .join("");

  // Optional: click -> open edit suite popup later
listEl.querySelectorAll("[data-suite-id]").forEach((btn) => {
  btn.addEventListener("click", async () => {
    const id = btn.getAttribute("data-suite-id");
    const suite = suites.find((s) => (s._id || s.id) === id);
    if (!suite) return;

    await showSuiteDetails(suite); // ✅ now showSuiteDetails can be async
  });
});


}


// ------------------------------
//Open Suite Section when the suite is clicked
// ------------------------------

//helpers to hide location details section 
// helpers to hide location details section when suite details opens
function enterSuiteDetailsMode() {
  const detailsCard = document.getElementById("location-details-card");
  const suiteDetailsCard = document.getElementById("location-suite-details-card");
  if (!detailsCard || !suiteDetailsCard) return;

  // show suite details
  suiteDetailsCard.style.display = "block";

  // hide everything else inside location details card
  Array.from(detailsCard.children).forEach((child) => {
    if (child === suiteDetailsCard) return;
    child.dataset.prevDisplay = child.style.display || "";
    child.style.display = "none";
  });
}

function exitSuiteDetailsMode() {
  const detailsCard = document.getElementById("location-details-card");
  const suiteDetailsCard = document.getElementById("location-suite-details-card");
  if (!detailsCard || !suiteDetailsCard) return;

  // hide suite details
  suiteDetailsCard.style.display = "none";

  // restore everything else
  Array.from(detailsCard.children).forEach((child) => {
    if (child === suiteDetailsCard) return;
    child.style.display = child.dataset.prevDisplay ?? "";
    delete child.dataset.prevDisplay;
  });
}


//Back / Close buttons to restore the location details
function initSuiteDetailsBackButtons() {
  document
    .getElementById("location-suite-details-back-btn")
    ?.addEventListener("click", exitSuiteDetailsMode);

  document
    .getElementById("location-suite-details-close")
    ?.addEventListener("click", exitSuiteDetailsMode);
}

let selectedSuite = null;

//helper to show suite details 
function unwrapRecord(payload) {
  if (!payload) return null;

  // already a record
  if (payload._id || payload.id) return payload;

  // common wrappers
  if (payload.record) return payload.record;
  if (payload.item) return payload.item;
  if (payload.data) return payload.data;
  if (payload.result) return payload.result;

  // sometimes list wrappers
  if (Array.isArray(payload.records) && payload.records[0]) return payload.records[0];
  if (Array.isArray(payload.items) && payload.items[0]) return payload.items[0];

  return null;
}

function getRecordId(payload) {
  const rec = unwrapRecord(payload);
  return rec?._id || rec?.id || "";
}


async function showSuiteDetails(suite) {
  enterSuiteDetailsMode();

  const id = suite?._id || suite?.id;
  if (!id) return;

  const fresh = await fetchSuiteById(id);
  selectedSuite = fresh;

  // ✅ ADD THESE:
  window.selectedSuite = fresh;
  window.activeSuite = fresh;

  const v = fresh?.values || fresh || {};

  console.log("[suite details] suiteId:", fresh._id || fresh.id);
  console.log("[suite details] v keys:", Object.keys(v));

  const name = v["Suite Name"] || v.name || v.Name || "Suite";

  // Availability
  const availableRaw =
    v["Date Available"] || v["Available Date"] || v.availableDate || "";

  const available = fmtDateNice(availableRaw);

  setText(
    "location-suite-details-availability",
    available ? `Available: ${available}` : "—"
  );

  // Rent + frequency
  const rentRaw =
    v["Rent Amount"] ?? v["Suite Rent"] ?? v["Rate"] ?? v.rate ?? "";

  const freqRaw =
    v["Rent Frequency"] ??
    v["Rate Frequency"] ??
    v["Frequency"] ??
    v.frequency ??
    "";

  const rent = String(rentRaw ?? "").trim();
  const freq = String(freqRaw ?? "").trim();

  setText(
    "location-suite-details-rate",
    rent ? `$${rent}${freq ? ` / ${freq}` : ""}` : "Contact for rate"
  );

  // Default image
  const defaultImgRaw =
    v["Default Photo"] || v["Default Image"] || v.photoUrl || "";

  const defaultImg = resolveImg(defaultImgRaw);

  const defaultImgHolder = document.getElementById("location-suite-default-img");
  if (!defaultImgHolder) {
    console.warn("[suite details] missing element: location-suite-default-img");
  } else {
    defaultImgHolder.innerHTML = defaultImg
      ? `<img src="${defaultImg}" alt="${name}" style="width:140px;height:140px;object-fit:cover;border-radius:14px;" />`
      : `<span class="muted">No default image.</span>`;
  }

  // Gallery
  const galleryRaw = v["Gallery Images"] || v["Suite Gallery"] || v.gallery || [];
  const gallery = Array.isArray(galleryRaw) ? galleryRaw : [];

  const galEl = document.getElementById("location-suite-details-gallery");
  if (!galEl) {
    console.warn("[suite details] missing element: location-suite-details-gallery");
  } else {
    galEl.innerHTML = gallery.length
      ? gallery
          .map((url) => {
            const u = resolveAnyImg(url);
            return `<img src="${u}" alt="Gallery image" style="width:90px;height:90px;object-fit:cover;border-radius:12px;" />`;
          })
          .join("")
      : `<p class="muted">No gallery images.</p>`;
  }

  // Details (rich text)
  const detailsEl = document.getElementById("suite-details-details");
  if (!detailsEl) {
    console.warn("[suite details] missing element: suite-details-details");
  } else {
    const html = v["Details"] || v.details || "";
    detailsEl.innerHTML = html || `<span class="muted">No details added yet.</span>`;
  }

  // Application
  renderSuiteApplicationStatus(selectedSuite);
  renderSuiteApplicationLink(selectedSuite);

  // Back label
  const locName =
    (selectedLocation?.values || selectedLocation || {})["Location Name"] ||
    selectedLocation?.name ||
    "";

  const locNameSpan = document.getElementById("location-suite-details-location-name");
  if (locNameSpan) locNameSpan.textContent = locName || "location";
}





function initSuiteDetailsUI() {
  document
    .getElementById("location-suite-details-back-btn")
    ?.addEventListener("click", exitSuiteDetailsMode);

  document
    .getElementById("location-suite-details-close")
    ?.addEventListener("click", exitSuiteDetailsMode);
}





//Edit and Delete Suite 


document.getElementById("location-suite-edit-btn")?.addEventListener("click", () => {
  if (!selectedSuite) return;

  // ✅ just use the suite object you already have
  activeSuite = selectedSuite;

  openSuiteEditModeFromDetails();
});


document.getElementById("location-suite-delete-btn")?.addEventListener("click", async () => {
  if (!selectedSuite) return;
  // deleteSuiteRecord(selectedSuite._id || selectedSuite.id)
});

function openSuiteEditForm(suite) {
  console.log("Edit suite:", suite);
  // later: open your suite popup + prefill fields
}


           // =========================================================
             // ✅ suites section
            // =========================================================
//Helper to show suite details 
function setText(id, text) {
  const el = document.getElementById(id);
  if (!el) {
    console.warn("[suite details] missing element:", id);
    return false;
  }
  el.textContent = text;
  return true;
}
async function fetchSuiteById(id) {
  const base = getApiBase();

  const res = await fetch(`${base}/api/records/Suite/${encodeURIComponent(id)}`, {
    credentials: "include",
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  const data = await readJsonSafe(res);
  if (!res.ok) throw new Error(data?.error || data?.message || "Fetch suite failed");

  const rec = unwrapRecord(data);
  if (!rec) throw new Error("Suite not found (empty response).");

  return rec;
}


 //Helper to hide location details section 
function enterSuiteMode() {
  const detailsCard = document.getElementById("location-details-card");
  const suiteFormCard = document.getElementById("location-suite-form-card");
  if (!detailsCard || !suiteFormCard) return;

  // ✅ show the form
  suiteFormCard.style.display = "block";

  // ✅ hide everything else INSIDE location-details-card
  Array.from(detailsCard.children).forEach((child) => {
    if (child === suiteFormCard) return;
    child.dataset.prevDisplay = child.style.display || "";
    child.style.display = "none";
  });
}

function exitSuiteMode() {
  const detailsCard = document.getElementById("location-details-card");
  const suiteFormCard = document.getElementById("location-suite-form-card");
  if (!detailsCard || !suiteFormCard) return;

  // ✅ hide the form
  suiteFormCard.style.display = "none";

  // ✅ restore everything else
  Array.from(detailsCard.children).forEach((child) => {
    if (child === suiteFormCard) return;
    child.style.display = child.dataset.prevDisplay ?? "";
    delete child.dataset.prevDisplay;
  });
}

//go back to location
function backToLocationDetailsFromSuite() {
  const suiteCard = document.getElementById("location-suite-form-card");
  if (suiteCard) suiteCard.style.display = "none";

  // show the location details pieces again
  const detailsHeader =
    document.querySelector("#location-details-card .location-details-header") ||
    document.getElementById("location-details-header");

  const detailsGrid = document.getElementById("location-details-grid");
  const detailsActions = document.getElementById("location-details-actions");
  const suitesHeader = document.getElementById("location-suites-header");
  const suitesList = document.getElementById("location-suites-list");
  const suiteDetailsCard = document.getElementById("location-suite-details-card");

  if (detailsHeader) detailsHeader.style.display = "";
  if (detailsGrid) detailsGrid.style.display = "";
  if (detailsActions) detailsActions.style.display = "";
  if (suitesHeader) suitesHeader.style.display = "";
  if (suitesList) suitesList.style.display = "";
  if (suiteDetailsCard) suiteDetailsCard.style.display = "none";

  // IMPORTANT: keep list hidden (we are still inside this location)
  const listEl = document.getElementById("locations-list");
  if (listEl) listEl.style.display = "none";

  // Make sure details card is visible
  const detailsCard = document.getElementById("location-details-card");
  if (detailsCard) detailsCard.style.display = "block";
}

//helper for rich text editor
let suiteDetailsQuill = null;

function initSuiteDetailsEditor() {
  const editorEl  = document.getElementById("loc-suite-details-editor");
  const toolbarEl = document.getElementById("suite-details-toolbar");
  const hiddenEl  = document.getElementById("loc-suite-details");

  console.log("[quill] init called", {
    editorEl: !!editorEl,
    toolbarEl: !!toolbarEl,
    hiddenEl: !!hiddenEl,
    quillType: typeof Quill,
    already: !!suiteDetailsQuill
  });

  if (!editorEl || !toolbarEl || !hiddenEl) return;
  if (typeof Quill !== "function") return;

  // ✅ If already initialized, just enable + return
  if (suiteDetailsQuill) {
    suiteDetailsQuill.enable(true);
    return;
  }

  suiteDetailsQuill = new Quill(editorEl, {
    theme: "snow",
    modules: { toolbar: toolbarEl },
  });

  suiteDetailsQuill.enable(true);

  suiteDetailsQuill.on("text-change", () => {
    hiddenEl.value = suiteDetailsQuill.root.innerHTML;
  });

  // start empty
  hiddenEl.value = "";
  suiteDetailsQuill.root.innerHTML = "";

  console.log("[quill] initialized OK");
}

function setSuiteDetailsHTML(html) {
  const hiddenEl = document.getElementById("loc-suite-details");
  if (hiddenEl) hiddenEl.value = html || "";
  if (suiteDetailsQuill) suiteDetailsQuill.root.innerHTML = html || "";
}


//show add suite section 
         function initLocationAddSuiteButton() {
  const btn = document.getElementById("location-add-suite-btn");
  const suiteCard = document.getElementById("location-suite-form-card");
  const suiteForm = document.getElementById("location-suite-form");

  const backBtn = document.getElementById("location-suite-back-btn");
  const cancelBtn = document.getElementById("loc-suite-cancel-btn");
  const locNameLabel = document.getElementById("loc-suite-location-name");

  // ✅ these are the parts INSIDE location-details-card that we hide
  const detailsHeader = document.querySelector("#location-details-card .location-details-header")
    || document.getElementById("location-details-header");

  const detailsGrid = document.getElementById("location-details-grid"); // if you have it
  const detailsActions = document.getElementById("location-details-actions"); // if you have it
  const suitesHeader = document.getElementById("location-suites-header"); // if you have it
  const suitesList = document.getElementById("location-suites-list"); // if you have it
  const suiteDetailsCard = document.getElementById("location-suite-details-card");

  if (!btn || !suiteCard || !suiteForm) return;

function openSuiteCreateForm() {
  if (!selectedLocation) return alert("Open a location first, then add a suite.");

  enterSuiteMode();
  suiteCard.style.display = "block";
suiteForm.reset();

  // ✅ reset suite photo preview (create mode = no existing photo)
  window._resetSuiteMainPhotoPreview?.("");

  // ✅ reset gallery preview too if you have a reset helper (optional)
  // window._resetSuiteGalleryPreview?.([], new Set());

  // ✅ Initialize Quill AFTER the form is visible
  initSuiteDetailsEditor();
  setSuiteDetailsHTML("");


  suiteForm.reset();
  document.getElementById("loc-suite-name")?.focus();

}


  function closeSuiteFormBackToDetails() {
    // hide suite form
    suiteCard.style.display = "none";

    // show details pieces back
    if (detailsHeader) detailsHeader.style.display = "";
    if (detailsGrid) detailsGrid.style.display = "";
    if (detailsActions) detailsActions.style.display = "";
    if (suitesHeader) suitesHeader.style.display = "";
    if (suitesList) suitesList.style.display = "";
  }

btn.addEventListener("click", openSuiteCreateForm);

backBtn?.addEventListener("click", () => {
  exitSuiteMode();               // ✅ show location details again
  // DO NOT call backToLocationsList()
});

cancelBtn?.addEventListener("click", () => {
  exitSuiteMode();               // ✅ same behavior
});

}

//Add suite default image preview 
let pendingSuiteMainPhotoFile = null;   // new file chosen
let existingSuiteMainPhotoUrl = "";     // already saved url
let suitePhotoMarkedForRemoval = false; // user clicked X on existing photo

function initSuiteMainPhotoPreview() {
  const input = document.getElementById("loc-suite-photo-file");
  const holder = document.getElementById("loc-suite-current-photo");
  if (!input || !holder) return;

  function render() {
    // If user marked existing photo for removal
    if (suitePhotoMarkedForRemoval) {
      holder.innerHTML = `<span class="muted">Photo will be removed when you save.</span>`;
      return;
    }

    // If user picked a new file
    if (pendingSuiteMainPhotoFile) {
      const url = URL.createObjectURL(pendingSuiteMainPhotoFile);

      holder.innerHTML = `
        <div class="gallery-thumb-wrapper">
          <button type="button" class="gallery-thumb-remove" aria-label="Remove photo">×</button>
          <img src="${url}" alt="Suite default photo preview" />
        </div>
      `;

      holder.querySelector("img")?.addEventListener("load", () => {
        try { URL.revokeObjectURL(url); } catch {}
      });

      holder.querySelector(".gallery-thumb-remove")?.addEventListener("click", () => {
        pendingSuiteMainPhotoFile = null;
        input.value = "";
        render();
      });

      return;
    }

    // Otherwise show existing saved url (if any)
    if (existingSuiteMainPhotoUrl) {
      holder.innerHTML = `
        <div class="gallery-thumb-wrapper">
          <button type="button" class="gallery-thumb-remove" aria-label="Remove photo">×</button>
          <img src="${existingSuiteMainPhotoUrl}" alt="Current suite default photo" />
        </div>
      `;

      holder.querySelector(".gallery-thumb-remove")?.addEventListener("click", () => {
        suitePhotoMarkedForRemoval = true;
        existingSuiteMainPhotoUrl = "";  // clear it locally
        input.value = "";
        render();
      });

      return;
    }

    // No photo
    holder.innerHTML = `<span class="muted">No photo uploaded yet.</span>`;
  }

  input.addEventListener("change", () => {
    const file = input.files?.[0] || null;
    pendingSuiteMainPhotoFile = file;
    suitePhotoMarkedForRemoval = false; // they picked a new photo, so not removing now
    render();
  });

  // Expose a reset helper for when opening the form
  window._resetSuiteMainPhotoPreview = (existingUrl = "") => {
    pendingSuiteMainPhotoFile = null;
    existingSuiteMainPhotoUrl = existingUrl || "";
    suitePhotoMarkedForRemoval = false;
    input.value = "";
    render();
  };

  render();
}

//Add suite gallery image preview 
let pendingSuiteGalleryFiles = [];
let existingSuiteGalleryUrls = [];
let suiteGalleryRemoveSet = new Set();

function initSuiteGalleryPreview() {
  const input  = document.getElementById("loc-suite-gallery-files");
  const holder = document.getElementById("loc-suite-new-gallery-preview");
  if (!input || !holder) return;

  function render() {
    if (!pendingSuiteGalleryFiles.length) {
      holder.innerHTML = "";
      return;
    }

    holder.innerHTML = pendingSuiteGalleryFiles
      .map((file, idx) => {
        const url = URL.createObjectURL(file);
        return `
          <div class="gallery-thumb-wrapper" data-idx="${idx}">
            <button type="button"
              class="gallery-thumb-remove"
              data-remove="${idx}"
              aria-label="Remove image">×</button>
            <img src="${url}" alt="${file.name}" />
          </div>
        `;
      })
      .join("");

    holder.querySelectorAll("img").forEach((img) => {
      img.addEventListener("load", () => {
        try { URL.revokeObjectURL(img.src); } catch {}
      });
    });

    holder.querySelectorAll("[data-remove]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = Number(btn.getAttribute("data-remove"));
        if (!Number.isFinite(idx)) return;
        pendingSuiteGalleryFiles.splice(idx, 1);
        render();
      });
    });
  }

  input.addEventListener("change", () => {
    const newFiles = input.files ? Array.from(input.files) : [];
    if (!newFiles.length) return;

    // ✅ append (don’t replace)
    pendingSuiteGalleryFiles.push(...newFiles);

    // ✅ allow re-picking same file later
    input.value = "";

    render();
  });

  // expose reset helper so create/edit mode can re-init cleanly
  window._resetSuiteGalleryPreview = (existingUrls = [], removeSet = new Set()) => {
    pendingSuiteGalleryFiles = [];
    input.value = "";

    // existing gallery state
    existingSuiteGalleryUrls = Array.isArray(existingUrls) ? existingUrls : [];
    suiteGalleryRemoveSet = removeSet instanceof Set ? removeSet : new Set();

    render();                 // refresh “new uploads” preview area
    renderExistingSuiteGallery(); // refresh “existing gallery” area
  };

  render();
}
function renderExistingSuiteGallery() {
  const holder = document.getElementById("loc-suite-current-gallery");
  if (!holder) return;

  if (!existingSuiteGalleryUrls.length) {
    holder.innerHTML = `<span class="muted">No gallery images uploaded yet.</span>`;
    return;
  }

  holder.innerHTML = existingSuiteGalleryUrls
    .map((url) => {
      const removed = suiteGalleryRemoveSet.has(url);
      return `
        <div class="gallery-thumb-wrapper" data-url="${url}" style="${removed ? "opacity:.35;" : ""}">
          <button type="button" class="gallery-thumb-remove" aria-label="Remove image">×</button>
          <img src="${url}" alt="Gallery image" />
        </div>
      `;
    })
    .join("");

  holder.querySelectorAll(".gallery-thumb-wrapper").forEach((wrap) => {
    const url = wrap.getAttribute("data-url");
    const btn = wrap.querySelector(".gallery-thumb-remove");

    btn?.addEventListener("click", () => {
      if (!url) return;

      // toggle remove
      if (suiteGalleryRemoveSet.has(url)) suiteGalleryRemoveSet.delete(url);
      else suiteGalleryRemoveSet.add(url);

      renderExistingSuiteGallery();
    });
  });
}


///////// ================================
/////////////// Suite Application 
//// ///================================

//Open Application Template Builder
function openSuiteAppBuilderModal() {
  const modal = document.getElementById("suite-app-builder");
  if (!modal) {
    console.warn("[app builder] #suite-app-builder not found");
    return;
  }

  modal.hidden = false;
  modal.setAttribute("aria-hidden", "false");
  console.log("[app builder] modal opened");
// ✅ hydrate from the currently opened suite
  const suite = window.selectedSuite || window.activeSuite || null;
  const v = suite?.values || suite || {};

  const tplStr =
    v["Application Template"] ||
    v.applicationTemplate ||
    document.getElementById("loc-suite-application-template")?.value ||
    "";

  const tplJson = safeParseJson(tplStr);

  if (tplJson) {
    applySuiteAppTemplateToBuilder(tplJson);
    console.log("[app builder] hydrated from saved template");
  } else {
    console.log("[app builder] no template to hydrate");
  }
}

//Close Application Builder
function closeSuiteAppBuilderModal() {
  const modal = document.getElementById("suite-app-builder");
  if (!modal) return;

  // avoid “aria-hidden focus” warnings
  if (document.activeElement && modal.contains(document.activeElement)) {
    document.activeElement.blur();
  }

  modal.hidden = true;
  modal.setAttribute("aria-hidden", "true");
  console.log("[app builder] modal closed");
}


function initSuiteAppBuilderCloseButtons() {
  document
    .getElementById("suite-app-builder-close")
    ?.addEventListener("click", closeSuiteAppBuilderModal);

  document
    .getElementById("suite-app-builder-cancel")
    ?.addEventListener("click", closeSuiteAppBuilderModal);

  // optional: Esc key closes it
  document.addEventListener("keydown", (e) => {
    const modal = document.getElementById("suite-app-builder");
    if (e.key === "Escape" && modal && !modal.hidden) {
      closeSuiteAppBuilderModal();
    }
  });

  // optional: click outside card closes it (only if you want)
  const modal = document.getElementById("suite-app-builder");
  modal?.addEventListener("click", (e) => {
    if (e.target === modal) closeSuiteAppBuilderModal();
  });
}

function applySuiteAppTemplateToBuilder(templateJson) {
  const data = templateJson?.sections ? templateJson : null;
  if (!data) return;

  // ✅ restore section titles
  const applicantTitleEl = document.querySelector(
    '#suite-app-section-applicant [data-app-field="sectionApplicant"]'
  );
  const experienceTitleEl = document.querySelector(
    '#suite-app-section-experience [data-app-field="sectionExperience"]'
  );

  if (applicantTitleEl) {
    applicantTitleEl.textContent =
      data.sections.applicantTitle || "Applicant information";
  }

  if (experienceTitleEl) {
    experienceTitleEl.textContent =
      data.sections.experienceTitle || "Professional experience";
  }

  // ✅ rebuild rows from config so edited labels persist
  rebuildSectionFromConfig(
    "suite-app-section-applicant",
    data.sections.applicant || []
  );

  rebuildSectionFromConfig(
    "suite-app-section-experience",
    data.sections.experience || []
  );

  rebuildCustomSections(data.sections.custom || []);

  // ✅ OPTIONAL: if you still want "applyRows" behavior, keep it INSIDE:
  // applyRows("suite-app-section-applicant", data.sections.applicant || []);
  // applyRows("suite-app-section-experience", data.sections.experience || []);
}




//Suite Application
function initSuiteAppBuilder() {
  const appModal     = document.getElementById("suite-app-builder");
  const openAppBtn   = document.getElementById("open-suite-app-builder");
  const closeAppBtn  = document.getElementById("suite-app-builder-close");
  const cancelAppBtn = document.getElementById("suite-app-builder-cancel");
  const saveAppBtn   = document.getElementById("suite-app-builder-save");
  const templateInput = document.getElementById("loc-suite-application-template"); // hidden input

    // =====================
  // "Add question" for Applicant + Experience sections
  // =====================
  function wireQuestionAdder(sectionId, buttonId, keyPrefix) {
    const section = document.getElementById(sectionId);
    const button  = document.getElementById(buttonId);
    if (!section || !button) return;

    let counter = 0;

    button.addEventListener("click", () => {
      counter += 1;

      const row = document.createElement("div");
      row.className = "suite-app-row";
      row.innerHTML = `
        <div class="suite-app-bullet suite-app-drag-handle"></div>
        <div class="suite-app-label"
             contenteditable="true"
             data-app-field="${keyPrefix}${counter}">
          New question
        </div>
        <div class="suite-app-input-box">[text input]</div>
      `;

      section.insertBefore(row, button);
    });
  }

  wireQuestionAdder(
    "suite-app-section-applicant",
    "suite-app-add-applicant-question",
    "customApplicantQ_"
  );

  wireQuestionAdder(
    "suite-app-section-experience",
    "suite-app-add-experience-question",
    "experienceCustomQ_"
  );

  // =====================
  // Professional Experience – Add rows
  // =====================
  const experienceSection = document.getElementById("suite-app-section-experience");
  const addExperienceBtn  = document.getElementById("suite-app-add-experience");
  let experienceCounter = 0;

  if (experienceSection && addExperienceBtn) {
    addExperienceBtn.addEventListener("click", () => {
      experienceCounter += 1;

      const row = document.createElement("div");
      row.className = "suite-app-row";
      row.innerHTML = `
        <div class="suite-app-bullet suite-app-drag-handle"></div>
        <div class="suite-app-label"
             contenteditable="true"
             data-app-field="experienceCustom_${experienceCounter}">
          New experience question
        </div>
        <div class="suite-app-input-box">[text input]</div>
      `;

      experienceSection.insertBefore(row, addExperienceBtn);
    });
  }

  // =====================
  // "Add new section" – whole custom block
  // =====================
  const addSectionBtn = document.getElementById("suite-app-add-section");
  let customSectionCount = 0;

  if (addSectionBtn) {
    addSectionBtn.addEventListener("click", () => {
      customSectionCount += 1;
      const sectionKey = `customSection_${customSectionCount}`;

      const section = document.createElement("div");
      section.className = "suite-app-section suite-app-section-custom";
      section.dataset.sectionKey = sectionKey;

      section.innerHTML = `
        <div class="suite-app-section-title">
          <span contenteditable="true" data-app-field="${sectionKey}_title">
            New section
          </span>
        </div>

        <div class="suite-app-row">
          <div class="suite-app-bullet suite-app-drag-handle"></div>
          <div class="suite-app-label"
               contenteditable="true"
               data-app-field="${sectionKey}_q1">
            New question
          </div>
          <div class="suite-app-input-box">[text input]</div>
        </div>

        <button type="button"
                class="btn ghost suite-app-add-more"
                data-add-question-for="${sectionKey}">
          + Add question
        </button>
      `;

      // insert after experience section if possible
      const expSec = document.getElementById("suite-app-section-experience");
      if (expSec && expSec.parentNode) {
        expSec.parentNode.insertBefore(section, expSec.nextSibling);
      } else {
        addSectionBtn.parentNode.insertBefore(section, addSectionBtn.nextSibling);
      }

      // wire "+ Add question" inside this new section
      const sectionAddBtn = section.querySelector(
        `button[data-add-question-for="${sectionKey}"]`
      );

      if (sectionAddBtn) {
        let qCounter = 1;

        sectionAddBtn.addEventListener("click", () => {
          qCounter += 1;

          const row = document.createElement("div");
          row.className = "suite-app-row";
          row.innerHTML = `
            <div class="suite-app-bullet suite-app-drag-handle"></div>
            <div class="suite-app-label"
                 contenteditable="true"
                 data-app-field="${sectionKey}_q${qCounter}">
              New question
            </div>
            <div class="suite-app-input-box">[text input]</div>
          `;

          section.insertBefore(row, sectionAddBtn);
        });
      }

      // make the custom section sortable too
      if (window.Sortable) {
        new Sortable(section, {
          animation: 150,
          handle: ".suite-app-drag-handle",
          draggable: ".suite-app-row",
        });
      }
    });
  }

  if (!appModal || !openAppBtn) {
    console.warn("[suite-app] modal/button missing");
    return;
  }

  // ---------- helpers ----------
function collectTemplateFromBuilder() {
  function collectRows(sectionEl, fallbackPrefix) {
    if (!sectionEl) return [];

    const rows = Array.from(sectionEl.querySelectorAll(".suite-app-row"));
    return rows.map((row, idx) => {
      const labelEl = row.querySelector(".suite-app-label");
      const inputEl = row.querySelector(".suite-app-input-box");

      const key = labelEl?.dataset.appField || `${fallbackPrefix}_${idx + 1}`;

      return {
        key,
        label: (labelEl?.textContent || "").trim(),
        inputType: (inputEl?.textContent || "").trim(),
      };
    });
  }

  const applicantSection = document.getElementById("suite-app-section-applicant");
  const experienceSection = document.getElementById("suite-app-section-experience");

  // ✅ capture editable section titles
  const applicantTitleEl = document.querySelector(
    '#suite-app-section-applicant [data-app-field="sectionApplicant"]'
  );
  const experienceTitleEl = document.querySelector(
    '#suite-app-section-experience [data-app-field="sectionExperience"]'
  );

  const applicantTitle = (applicantTitleEl?.textContent || "").trim() || "Applicant information";
  const experienceTitle = (experienceTitleEl?.textContent || "").trim() || "Professional experience";

  // custom sections
  const customSections = Array.from(
    document.querySelectorAll("#suite-app-builder .suite-app-section-custom")
  ).map((sec) => {
    const sectionKey = sec.dataset.sectionKey || "";
    const titleSpan = sec.querySelector(".suite-app-section-title [data-app-field]");
    const titleKey = titleSpan?.getAttribute("data-app-field") || `${sectionKey}_title`;

    return {
      sectionKey,
      titleKey,
      title: (titleSpan?.textContent || "").trim(),
      rows: collectRows(sec, sectionKey || "customSection"),
    };
  });

  return {
    sections: {
      applicantTitle,          // ✅ NEW
      experienceTitle,         // ✅ NEW
      applicant: collectRows(applicantSection, "applicant"),
      experience: collectRows(experienceSection, "experience"),
      custom: customSections,
    },
  };
}

function applyTemplateToBuilder(jsonStr) {
  if (!jsonStr) return;

  let data;
  try {
    data = JSON.parse(jsonStr);
  } catch (e) {
    console.warn("[suite-app] bad template JSON", e);
    return;
  }

  // ✅ New structured format
  if (data?.sections) {
    rebuildSectionFromConfig(
      "suite-app-section-applicant",
      data.sections.applicant || []
    );

    rebuildSectionFromConfig(
      "suite-app-section-experience",
      data.sections.experience || []
    );

    rebuildCustomSections(data.sections.custom || []);
    return;
  }
if (data?.sections) {
  // ✅ restore section titles
  const applicantTitleEl = document.querySelector(
    '#suite-app-section-applicant [data-app-field="sectionApplicant"]'
  );
  const experienceTitleEl = document.querySelector(
    '#suite-app-section-experience [data-app-field="sectionExperience"]'
  );

  if (applicantTitleEl) applicantTitleEl.textContent =
    data.sections.applicantTitle || "Applicant information";

  if (experienceTitleEl) experienceTitleEl.textContent =
    data.sections.experienceTitle || "Professional experience";

  rebuildSectionFromConfig(
    "suite-app-section-applicant",
    data.sections.applicant || []
  );

  rebuildSectionFromConfig(
    "suite-app-section-experience",
    data.sections.experience || []
  );

  rebuildCustomSections(data.sections.custom || []);
  return;
}

  // 🔙 fallback: old key/value format
  appModal.querySelectorAll("[data-app-field]").forEach((el) => {
    const key = el.getAttribute("data-app-field");
    if (key && data[key] != null) el.textContent = String(data[key]);
  });
}

// ---------- Builder rebuild helpers (MUST be top-level / global scope) ----------
function rebuildSectionFromConfig(sectionId, configs) {
  const section = document.getElementById(sectionId);
  if (!section) return;

  // keep the existing buttons (add question, etc.)
  const buttons = Array.from(section.querySelectorAll("button"));

  // remove existing rows
  section.querySelectorAll(".suite-app-row").forEach((row) => row.remove());

  // recreate rows
  (configs || []).forEach((cfg) => {
    const row = document.createElement("div");
    row.className = "suite-app-row";
    row.innerHTML = `
      <div class="suite-app-bullet suite-app-drag-handle"></div>
      <div class="suite-app-label"
           contenteditable="true"
           data-app-field="${cfg.key}">
        ${cfg.label || ""}
      </div>
      <div class="suite-app-input-box">
        ${cfg.inputType || "[text input]"}
      </div>
    `;

    // insert rows before the first button if exists
    if (buttons[0]) section.insertBefore(row, buttons[0]);
    else section.appendChild(row);
  });
}

function rebuildCustomSections(customConfigs) {
  const appModal = document.getElementById("suite-app-builder");
  if (!appModal) return;

  // remove old custom sections
  appModal.querySelectorAll(".suite-app-section-custom").forEach((sec) => sec.remove());

  const addSectionBtn = document.getElementById("suite-app-add-section");
  if (!addSectionBtn) return;

  (customConfigs || []).forEach((cfg, idx) => {
    const sectionKey = cfg.sectionKey || `customSection_${idx + 1}`;
    const titleKey = cfg.titleKey || `${sectionKey}_title`;

    const section = document.createElement("div");
    section.className = "suite-app-section suite-app-section-custom";
    section.dataset.sectionKey = sectionKey;

    section.innerHTML = `
      <div class="suite-app-section-title">
        <span contenteditable="true" data-app-field="${titleKey}">
          ${cfg.title || "New section"}
        </span>
      </div>
    `;

    (cfg.rows || []).forEach((rowCfg, i) => {
      const row = document.createElement("div");
      row.className = "suite-app-row";
      row.innerHTML = `
        <div class="suite-app-bullet suite-app-drag-handle"></div>
        <div class="suite-app-label"
             contenteditable="true"
             data-app-field="${rowCfg.key || `${sectionKey}_q${i + 1}`}">
          ${rowCfg.label || "New question"}
        </div>
        <div class="suite-app-input-box">
          ${rowCfg.inputType || "[text input]"}
        </div>
      `;
      section.appendChild(row);
    });

    // add "+ Add question"
    const addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.className = "btn ghost suite-app-add-more";
    addBtn.dataset.addQuestionFor = sectionKey;
    addBtn.textContent = "+ Add question";
    section.appendChild(addBtn);

    // insert after experience section if possible
    const expSec = document.getElementById("suite-app-section-experience");
    if (expSec?.parentNode) expSec.parentNode.insertBefore(section, expSec.nextSibling);
    else addSectionBtn.parentNode.insertBefore(section, addSectionBtn.nextSibling);

    // wire add question button
    let qCounter = (cfg.rows || []).length || 1;
    addBtn.addEventListener("click", () => {
      qCounter += 1;
      const row = document.createElement("div");
      row.className = "suite-app-row";
      row.innerHTML = `
        <div class="suite-app-bullet suite-app-drag-handle"></div>
        <div class="suite-app-label"
             contenteditable="true"
             data-app-field="${sectionKey}_q${qCounter}">
          New question
        </div>
        <div class="suite-app-input-box">[text input]</div>
      `;
      section.insertBefore(row, addBtn);
    });

    // sortable
    if (window.Sortable) {
      new Sortable(section, {
        animation: 150,
        handle: ".suite-app-drag-handle",
        draggable: ".suite-app-row",
      });
    }
  });
}


function openAppBuilder() {
  const suite = window.selectedSuite || window.activeSuite || null;
  if (!suite) return alert("Open a suite first.");

  // Make sure we have the modal
  const appModal = document.getElementById("suite-app-builder");
  if (!appModal) return console.warn("[suite-app] #suite-app-builder not found");

  // (optional) fill header names
  const locName =
    (window.selectedLocation?.values || window.selectedLocation || {})["Location Name"] ||
    window.selectedLocation?.name ||
    "Location Name";

  const left = appModal.querySelector('[data-app-field="locationName"]');
  const right = appModal.querySelector('[data-app-field="locationNameRight"]');
  if (left) left.textContent = locName;
  if (right) right.textContent = locName;

  const v = suite.values || suite || {};
  const suiteName = v["Suite Name"] || v.name || "Suite Name";
  const subtitle = appModal.querySelector(".suite-app-subtitle");
  if (subtitle) subtitle.textContent = suiteName;

  // load template json (hidden input -> suite values)
  const templateInput = document.getElementById("loc-suite-application-template");
  const fromHidden = (templateInput?.value || "").trim();
  const fromSuite = String(v["Application Template"] || "").trim();
  const jsonToUse = fromHidden || fromSuite;

  if (templateInput && jsonToUse) templateInput.value = jsonToUse;
  if (jsonToUse) applyTemplateToBuilder(jsonToUse);

  // ✅ OPEN: do NOT rely only on `hidden`
  appModal.hidden = false;
  appModal.removeAttribute("hidden");
  appModal.setAttribute("aria-hidden", "false");
  appModal.classList.add("is-open");

  // optional: prevent background scroll
  document.body.classList.add("modal-open");

  console.log("[suite-app] opened", {
    hidden: appModal.hidden,
    display: getComputedStyle(appModal).display,
    z: getComputedStyle(appModal).zIndex,
  });
}

function closeAppBuilder() {
  const appModal = document.getElementById("suite-app-builder");
  if (!appModal) return;

  if (document.activeElement && appModal.contains(document.activeElement)) {
    document.activeElement.blur();
  }

  appModal.classList.remove("is-open");
  appModal.hidden = true;
  appModal.setAttribute("aria-hidden", "true");

  document.body.classList.remove("modal-open");
  console.log("[suite-app] closed");
}


  // ---------- wire buttons ----------
  openAppBtn.addEventListener("click", openAppBuilder);
  closeAppBtn?.addEventListener("click", closeAppBuilder);
  cancelAppBtn?.addEventListener("click", closeAppBuilder);

  // Save template -> hidden input (so Suite save can store it)
 saveAppBtn?.addEventListener("click", () => {
  if (!templateInput) {
    alert("Missing hidden template input.");
    return;
  }

  // ✅ use ONE collector everywhere
  const tplObj = collectSuiteAppTemplateFromBuilder();
  const json = JSON.stringify(tplObj);

  templateInput.value = json;

  // ✅ also update the in-memory suite so preview/status uses latest immediately
  const suite = window.selectedSuite || window.activeSuite;
  if (suite) {
    suite.values = suite.values || {};
    suite.values["Application Template"] = json;
  }

  console.log("[suite-app] saved template JSON:", tplObj);

  renderSuiteApplicationStatus(suite);
  renderSuiteApplicationLink(suite);

  closeAppBuilder(); // or closeSuiteAppBuilderModal — pick ONE close function
});

}

///////// ================================
/////////////// Save Suite 
//// ///================================

//helpers
//helpers
function getApiBase() {
  return (window.API_BASE || window.API || "http://localhost:8400").replace(/\/$/, "");
}

async function createSuiteRecord(values) {
  const base = getApiBase();

  const res = await fetch(`${base}/api/records/Suite`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ values }),
  });

  const data = await readJsonSafe(res);
  if (!res.ok) throw new Error(data?.error || data?.message || "Failed to create suite");
  return data;
}

async function updateSuiteRecord(id, values) {
  const base = getApiBase();

  const res = await fetch(`${base}/api/records/Suite/${encodeURIComponent(id)}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ values }),
  });

  const data = await readJsonSafe(res);
  if (!res.ok) throw new Error(data?.error || data?.message || "Failed to update suite");
  return data;
}



//Save Suite
function initSuiteSave() {
  const suiteForm = document.getElementById("location-suite-form");
  if (!suiteForm) return;

  suiteForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    if (!currentUser?.id) return alert("You must be logged in.");
    if (!selectedLocation) return alert("Open a location first.");

    const locationId = selectedLocation._id || selectedLocation.id;
    if (!locationId) return alert("Missing location id.");

    // detect create vs edit
    const suiteId = document.getElementById("loc-suite-id")?.value?.trim();
    const isEditing = !!suiteId;

// read inputs
const name = document.getElementById("loc-suite-name")?.value?.trim() || "";

// ✅ FIX: use the REAL input id from your HTML
const rent = document.getElementById("suite-rent-amount")?.value?.trim() || "";
const freq = document.getElementById("suite-rent-frequency")?.value?.trim() || "";

const detailsHtml = document.getElementById("loc-suite-details")?.value || "";
const availableDate =
  document.getElementById("loc-suite-available")?.value?.trim() || "";

if (!name) return alert("Suite name is required.");

// ✅ ADD THIS RIGHT HERE
const rentNum = rent === "" ? null : Number(rent);

// ✅ build values AFTER rent+freq exist
const values = {
  "Suite Name": name,
  "Date Available": availableDate,
  "Details": detailsHtml,

  // ✅ REAL fields (your DataType fields)
  "Rent Amount": Number.isFinite(rentNum) ? rentNum : null,
  "Rent Frequency": freq || "",

  // ✅ compatibility fields (older code paths)
  "Suite Rent": rent,
  "Rate": rent,
  "Rate Frequency": freq,
  "Frequency": freq,

  // ✅ link suite -> location
  "Location": locationId,

  ownerUserId: currentUser.id,
  "Created By": currentUser.id,
};
// ✅ Application template JSON (saved from the builder modal)
const tpl =
  document.getElementById("loc-suite-application-template")?.value?.trim() || "";

console.log("[suite save] tpl len:", tpl.length, "tpl preview:", tpl.slice(0, 80));

values["Application Template"] = tpl; // pick ONE field name and keep it consistent


console.log("[suite save] isEditing:", isEditing);
console.log("[suite save] suiteId:", suiteId);
console.log("[suite save] locationId:", locationId);
console.log("[suite save] values BEFORE uploads:", JSON.parse(JSON.stringify(values)));


    try {
      // ✅ save images (if you’re doing default photo + gallery)
      // Example for gallery (you already have this pattern):
      // values["Gallery Images"] = [...keptOld, ...newUrls];
      // values["Default Photo"] = mainUrl;

// default photo
if (pendingSuiteMainPhotoFile) {
  const url = await uploadOneImage(pendingSuiteMainPhotoFile);
  values["Default Photo"] = url;
} else if (suitePhotoMarkedForRemoval) {
  values["Default Photo"] = "";
} else {
  values["Default Photo"] = existingSuiteMainPhotoUrl || "";
}

// gallery
const keptOld = (existingSuiteGalleryUrls || []).filter(
  (u) => !suiteGalleryRemoveSet.has(u)
);

const newUrls = [];
for (const file of pendingSuiteGalleryFiles) {
  const url = await uploadOneImage(file);
  newUrls.push(url);
}

values["Gallery Images"] = [...keptOld, ...newUrls];
console.log("[suite save] values AFTER uploads:", JSON.parse(JSON.stringify(values)));

    let saved;
if (isEditing) {
  saved = await updateSuiteRecord(suiteId, values);
} else {
  saved = await createSuiteRecord(values);
}

console.log("[suite save] server returned:", saved);
console.log("[suite save] server returned values:", saved?.values || saved?.record?.values);

const savedId =
  saved?._id ||
  saved?.id ||
  saved?.record?._id ||
  saved?.record?.id ||
  suiteId;

if (savedId) {
  const fresh = await fetchSuiteById(savedId);
  console.log("[suite save] fresh from DB:", fresh);
  console.log("[suite save] fresh values:", fresh?.values || fresh?.record?.values);
}


      // ✅ refresh the location details view & suites list
      // If you have loadSuitesForLocation:
      if (typeof loadSuitesForLocation === "function") {
        await loadSuitesForLocation(locationId);
      }

      // ✅ go back to location details (NOT the locations list)
      exitSuiteMode();
      if (selectedLocation) showLocationDetails(selectedLocation);

      alert("Suite saved!");
    } catch (err) {
      console.error("[suite] save error", err);
      alert(err?.message || "Failed to save suite.");
    }
  });
}



///////// ================================
/////////////// Edit Suite 
//// ///================================

function openSuiteCreateForm(location) {
  selectedSuite = null;

  const popup = document.getElementById("popup-add-suite"); // change to your popup id
  const form  = document.getElementById("popup-add-suite-form"); // change to your form id

  // hidden fields
  document.getElementById("suite-id").value = "";
  document.getElementById("suite-location-id").value = location?._id || location?.id || "";

  // reset fields
  form?.reset();

  // UI labels/buttons
  document.getElementById("suite-form-title").textContent = "Add suite";
  document.getElementById("suite-save-btn").textContent = "Save suite";
  document.getElementById("suite-delete-btn")?.classList.add("hidden"); // hide delete in create

  popup.style.display = "block";
}


function openSuiteEditForm(suite) {
  selectedSuite = suite;

  const popup = document.getElementById("popup-add-suite");      // change to your popup id
  const form  = document.getElementById("popup-add-suite-form"); // change to your form id
  if (!popup || !form) return;

  const v = suite?.values || suite || {};
const suiteId =
  selectedSuite?._id ||
  selectedSuite?.id ||
  document.getElementById("loc-suite-id")?.value?.trim();


  // IMPORTANT: store location reference too (whatever your field is)
  const locId =
    v.locationId ||
    v.suiteLocationId ||
    v.parentLocationId ||
    v["locationId"] ||
    v["Location"] || // if you store Location field as an id
    "";

  document.getElementById("suite-location-id").value = locId || "";

  // prefill inputs (match your exact input ids)
  document.getElementById("suite-name").value =
    v["Suite Name"] || v.name || "";

  document.getElementById("suite-available-date").value =
    v["Date Available"] || v.availableDate || "";

  document.getElementById("suite-rent").value =
    v["Suite Rent"] || v.rate || "";

  document.getElementById("suite-frequency").value =
    v["Rate Frequency"] || v.frequency || "weekly";

  // UI labels/buttons
  document.getElementById("suite-form-title").textContent = "Edit suite";
  document.getElementById("suite-save-btn").textContent = "Update suite";
  document.getElementById("suite-delete-btn")?.classList.remove("hidden");

  popup.style.display = "block";
}




function openSuiteEditModeFromDetails() {
  const suite = selectedSuite;
  if (!suite) return;

  // ✅ make suite available globally
  window.selectedSuite = suite;
  window.activeSuite = suite;

  enterSuiteMode();
  const v = suite.values || suite || {};

  const locationSuiteFormCard    = document.getElementById("location-suite-form-card");
  const locationSuiteDetailsCard = document.getElementById("location-suite-details-card");
  const locationDetailsHeader    =
    document.querySelector("#location-details-card .location-details-header") ||
    document.getElementById("location-details-header");
  const locationDetailsGrid      = document.getElementById("location-details-grid");
  const locationSuitesHeader     = document.getElementById("location-suites-header");
  const locationSuitesList       = document.getElementById("location-suites-list");

  const locSuiteIdInput        = document.getElementById("loc-suite-id");
  const locSuiteNameInput      = document.getElementById("loc-suite-name");
  const locSuiteAvailableInput = document.getElementById("loc-suite-available"); // ✅ your id
 const locSuiteRentInput = document.getElementById("suite-rent-amount");       // ✅ if you have it
const locSuiteFreqInput = document.getElementById("suite-rent-frequency");

  // show form / hide details
  if (locationSuiteFormCard) locationSuiteFormCard.style.display = "block";
  if (locationSuiteDetailsCard) locationSuiteDetailsCard.style.display = "none";

  // hide rest of location UI while editing
  if (locationDetailsHeader) locationDetailsHeader.style.display = "none";
  if (locationDetailsGrid) locationDetailsGrid.style.display = "none";
  if (locationSuitesHeader) locationSuitesHeader.style.display = "none";
  if (locationSuitesList) locationSuitesList.style.display = "none";

  // mark edit mode
  const suiteId = suite._id || suite.id || "";
  if (locSuiteIdInput) locSuiteIdInput.value = suiteId;

  // prefill inputs
  if (locSuiteNameInput) locSuiteNameInput.value = v["Suite Name"] || v.name || "";

  if (locSuiteAvailableInput)
    locSuiteAvailableInput.value = v["Date Available"] || v["Available Date"] || v.availableDate || "";

// ---- prefill rent + freq ----
if (locSuiteRentInput)
  locSuiteRentInput.value =
    v["Rent Amount"] ??
    v["Suite Rent"] ??
    v["Rate"] ??
    v.rent ??
    v.rate ??
    "";

if (locSuiteFreqInput)
  locSuiteFreqInput.value =
    v["Rent Frequency"] ??
    v["Rate Frequency"] ??
    v["Frequency"] ??
    v.frequency ??
    "";


// ---- restore existing images into the preview system ----
const existingMain =
  v["Default Photo"] ||
  v["Default Image"] ||
  v.photoUrl ||
  v.heroImageUrl ||
  v.heroImage ||
  "";

const existingGalleryRaw =
  v["Gallery Images"] ||
  v["Suite Gallery"] ||
  v.gallery ||
  [];

const existingGallery = Array.isArray(existingGalleryRaw) ? existingGalleryRaw : [];

// reset preview state using your helpers
window._resetSuiteMainPhotoPreview?.(existingMain);
window._resetSuiteGalleryPreview?.(existingGallery, new Set());

// also make sure your globals match (so Save works correctly)
existingSuiteMainPhotoUrl = existingMain || "";
existingSuiteGalleryUrls = existingGallery;
suiteGalleryRemoveSet = new Set();
pendingSuiteMainPhotoFile = null;
pendingSuiteGalleryFiles = [];
suitePhotoMarkedForRemoval = false;

// re-render existing gallery area
renderExistingSuiteGallery?.();


  // quill details
  initSuiteDetailsEditor();
  setSuiteDetailsHTML(v["Details"] || "");

  // switch UI mode (if you have this helper)
  if (typeof setSuiteFormMode === "function") setSuiteFormMode(true);

  locationSuiteFormCard?.scrollIntoView({ behavior: "smooth", block: "start" });
}




///////// ================================
/////////////// Delete Suite 
//// ///================================
async function deleteSuiteRecord(id) {
  const base = (window.API_BASE || API_BASE || "http://localhost:8400").replace(/\/$/, "");

  // IMPORTANT: this "Suite" must match your DataType name in Mongo
  const typeName = "Suite";

  const res = await fetch(
    `${base}/api/records/${encodeURIComponent(typeName)}/${encodeURIComponent(id)}`,
    {
      method: "DELETE",
      credentials: "include",
      headers: { Accept: "application/json" },
    }
  );

const data = await readJsonSafe(res);
if (!res.ok) throw new Error(data?.error || data?.message || `Failed (${res.status})`);

  return data;
}


function initSuiteDeleteButton() {
  const delBtn = document.getElementById("location-suite-delete-btn");
  if (!delBtn) return;

  delBtn.addEventListener("click", async () => {
    const suiteId =
  selectedSuite?._id ||
  selectedSuite?.id ||
  document.getElementById("loc-suite-id")?.value?.trim();

    if (!suiteId) return alert("No suite selected to delete.");

    const v = selectedSuite?.values || selectedSuite || {};
    const name = v["Suite Name"] || v.name || "this suite";

    const ok = window.confirm(`Delete "${name}"? This cannot be undone.`);
    if (!ok) return;

    try {
        console.log("[delete] suiteId from hidden input:", suiteId);
console.log("[delete] selectedSuite:", selectedSuite);

      await deleteSuiteRecord(suiteId);

      // refresh list
      const locationId = selectedLocation?._id || selectedLocation?.id;
      if (locationId) await loadSuitesForLocation(locationId);

      // close suite form and return to location details
      exitSuiteMode();
      if (selectedLocation) showLocationDetails(selectedLocation);

      // clear selection
      selectedSuite = null;
      document.getElementById("loc-suite-id").value = "";
setSuiteFormMode(false);

      alert("Suite deleted.");
    } catch (err) {
      console.error("[suite] delete error", err);
      alert(err?.message || "Failed to delete suite.");
    }
  });
}

function setSuiteFormMode(isEditing) {
  const delBtn = document.getElementById("location-suite-delete-btn");
  if (delBtn) delBtn.style.display = isEditing ? "inline-flex" : "none";
}


///////// ================================
/////////////// Show if there is a application in suite details section 
//// ///================================


function getSuiteTemplateJson(suite) {
  const v = suite?.values || suite || {};

  const fromSuite =
    (v["Application Template"] ||
      v["Application Template JSON"] ||
      v["Template Json"] ||
      suite?.applicationTemplate ||
      "") + "";

  console.log("[app status] fromSuite:", {
    suiteId: suite?._id || suite?.id,
    fromSuiteLen: fromSuite.length,
    fromSuitePreview: fromSuite.slice(0, 120),
    keys: Object.keys(v || {}).slice(0, 30),
  });

  return fromSuite.trim();
}


function suiteHasTemplate(suite) {
  const raw = getSuiteTemplateJson(suite);
  if (!raw) return false;

  try {
    const obj = JSON.parse(raw);

    // structured format
    if (obj?.sections) {
      const a = obj.sections.applicant?.length || 0;
      const e = obj.sections.experience?.length || 0;
      const c = obj.sections.custom?.length || 0;
      console.log("[app status] sections counts:", { a, e, c });
      return a + e + c > 0;
    }

    // simple key/value format
    const count = obj ? Object.keys(obj).length : 0;
    console.log("[app status] simple object keys:", count);
    return count > 0;
  } catch (err) {
    console.warn("[app status] JSON parse failed, treating as text:", err);
    return raw.length > 2;
  }
}

function renderSuiteApplicationStatus(suite) {
  const el = document.getElementById("location-suite-details-application");

  console.log("[app status] renderSuiteApplicationStatus called:", {
    hasEl: !!el,
    suiteId: suite?._id || suite?.id,
    suiteName: (suite?.values || suite || {})["Suite Name"] || suite?.name,
  });

  if (!el) return;

  const has = suiteHasTemplate(suite);

  el.textContent = has ? "Application template saved." : "No application added yet.";
  el.classList.toggle("muted", !has);

  console.log("[app status] final:", { has, text: el.textContent });
}

// =========================================================
// ✅ Suite Application Template Preview (Modal Renderer)
// =========================================================

function closeSuiteTemplatePreview() {
  const modal = document.getElementById("suite-template-preview-modal");
  if (!modal) return;
  modal.hidden = true;
  modal.setAttribute("aria-hidden", "true");
}

function openSuiteTemplatePreview(rawJson) {
  const modal = document.getElementById("suite-template-preview-modal");
  const body  = document.getElementById("suite-template-preview-body");

  if (!modal || !body) {
    console.warn("[template preview] modal/body missing", { modal: !!modal, body: !!body });
    return;
  }

  body.innerHTML = "";

  let data = null;
  try {
    data = rawJson ? JSON.parse(rawJson) : null;
  } catch (e) {
    body.innerHTML = `<p class="muted">Invalid template JSON.</p>`;
    // show modal even for error
    modal.hidden = false;
    modal.style.display = "flex";
    modal.setAttribute("aria-hidden", "false");
    return;
  }

  if (!data) {
    body.innerHTML = `<p class="muted">No template data.</p>`;
    modal.hidden = false;
    modal.style.display = "flex";
    modal.setAttribute("aria-hidden", "false");
    return;
  }

  // ✅ TOP HEADER
  const loc = window.selectedLocation || {};
  const locV = loc.values || loc || {};
  const locationName =
    locV["Location Name"] || locV.name || loc.name || "Location Name";

  const suite = window.selectedSuite || window.activeSuite || {};
  const suiteV = suite.values || suite || {};
  const suiteName =
    suiteV["Suite Name"] || suiteV.name || suite.name || "Suite Name";

  body.innerHTML += `
    <div class="suite-template-top">
      <div class="suite-template-top-left">
        <div class="suite-template-avatar">LN</div>
        <div class="suite-template-locname">${escapeHtml(locationName)}</div>
      </div>

      <div class="suite-template-top-right">
        <div class="suite-template-locname">${escapeHtml(locationName)}</div>
      </div>

      <div class="suite-template-titleblock">
        <div class="suite-template-title">Application for Lease</div>
        <div class="suite-template-subtitle">${escapeHtml(suiteName)}</div>
      </div>

      <div class="suite-template-divider"></div>
    </div>
  `;

  function renderSectionBar(title) {
    return `<div class="suite-template-sectionbar">${escapeHtml(title)}</div>`;
  }

  function renderRows(rows) {
    if (!rows || !rows.length) return "";
    return rows.map((r) => `
      <div class="suite-template-row">
        <div class="suite-template-row-left">
          <span class="suite-template-bullet"></span>
          <span class="suite-template-label">${escapeHtml(r.label || "")}</span>
        </div>
        <div class="suite-template-input">${escapeHtml(r.inputType || "")}</div>
      </div>
    `).join("");
  }

  // ✅ STRUCTURED FORMAT
 if (data.sections) {
  const applicantTitle  = data.sections.applicantTitle  || "Applicant information";
  const experienceTitle = data.sections.experienceTitle || "Professional experience";

  const applicant  = data.sections.applicant  || [];
  const experience = data.sections.experience || [];
  const custom     = data.sections.custom     || [];

  body.innerHTML += renderSectionBar(applicantTitle);
  body.innerHTML += renderRows(applicant);

  body.innerHTML += `<button type="button" class="suite-template-add" disabled>+ Add question</button>`;

  body.innerHTML += renderSectionBar(experienceTitle);
  body.innerHTML += renderRows(experience);

  (custom || []).forEach((sec) => {
    body.innerHTML += renderSectionBar(sec.title || "New section");
    body.innerHTML += renderRows(sec.rows || []);
  });
}
 else {
    // fallback
    const keys = Object.keys(data || {});
    if (!keys.length) {
      body.innerHTML += `<p class="muted">Template is empty.</p>`;
    } else {
      body.innerHTML += renderSectionBar("TEMPLATE");
      body.innerHTML += keys.map((k) => `
        <div class="suite-template-row">
          <div class="suite-template-row-left">
            <span class="suite-template-bullet"></span>
            <span class="suite-template-label">${escapeHtml(k)}</span>
          </div>
          <div class="suite-template-input">${escapeHtml(String(data[k] ?? ""))}</div>
        </div>
      `).join("");
    }
  }

  // ✅ show modal (force-visible regardless of CSS) — MUST be inside the function
  modal.hidden = false;
  modal.style.display = "flex";
  modal.style.visibility = "visible";
  modal.style.opacity = "1";
  modal.style.zIndex = "99999";
  modal.setAttribute("aria-hidden", "false");

  console.log("[template preview] opened", {
    hidden: modal.hidden,
    display: getComputedStyle(modal).display,
    bodyHTMLLen: body.innerHTML.length,
  });
}



// tiny helper (prevents HTML injection + broken layout)
function escapeHtml(str) {
  return String(str || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalizeRentFrequency(v) {
  const s = String(v || "").trim().toLowerCase();
  if (!s) return "";

  if (["weekly", "biweekly", "monthly", "quarterly", "yearly"].includes(s)) return s;

  if (s.includes("bi") && s.includes("week")) return "biweekly";
  if (s.includes("week")) return "weekly";
  if (s.includes("month")) return "monthly";
  if (s.includes("quarter")) return "quarterly";
  if (s.includes("year") || s.includes("annual")) return "yearly";

  return "";
}


///////// ================================
/////////////// show application template preview 
//// ///================================
function renderSuiteApplicationLink(suite) {
  const el = document.getElementById("location-suite-details-application");
  if (!el) return;

  const raw = getSuiteTemplateJson(suite); // ✅ you already have this helper
  const has = suiteHasTemplate(suite);     // ✅ you already have this helper

  if (!has) {
    el.textContent = "No application added yet.";
    el.classList.add("suite-app-muted");
    return;
  }

  // render as a clickable link button
  el.classList.remove("suite-app-muted");
  el.innerHTML = `
    <button type="button" class="suite-app-link" id="suite-app-preview-link">
      Template saved — click to preview
    </button>
  `;

el.querySelector("#suite-app-preview-link")?.addEventListener("click", () => {
  console.log("[preview click] clicked", {
    suiteId: suite?._id || suite?.id,
    rawLen: raw?.length || 0,
    rawPreview: (raw || "").slice(0, 120),
    modalExists: !!document.getElementById("suite-template-preview-modal"),
    bodyExists: !!document.getElementById("suite-template-preview-body"),
  });

  openSuiteTemplatePreview(raw);
});

}


function initSuiteTemplatePreviewModal() {
  const modal = document.getElementById("suite-template-preview-modal");
  const close = document.getElementById("suite-template-preview-close");
  if (!modal) return;

function hide() {
  if (document.activeElement && modal.contains(document.activeElement)) {
    document.activeElement.blur();
  }
  modal.hidden = true;
  modal.style.display = "none";            // ✅ add this
  modal.setAttribute("aria-hidden", "true");
}


  close?.addEventListener("click", hide);

  modal.addEventListener("click", (e) => {
    if (e.target === modal) hide();
  });
}














                  // ================================
                         // Applications Section
                  // ================================
//helper to delete application 
async function softDeleteApplication(appId) {
  const url = apiUrl(`/api/records/Application/${encodeURIComponent(appId)}`);

  const values = {
    "Is Deleted": true,
    "Deleted At": new Date().toISOString(),
    "Deleted By": currentUser?.id || "",
  };

  const res = await fetch(url, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    cache: "no-store",
    body: JSON.stringify({ values }),
  });

  const data = await readJsonSafe(res);
  if (!res.ok) throw new Error(data?.error || data?.message || "Soft delete failed");

  return data;
}

function collectSuiteAppTemplateFromBuilder() {
  const applicantTitleEl = document.querySelector(
    '#suite-app-section-applicant [data-app-field="sectionApplicant"]'
  );
  const experienceTitleEl = document.querySelector(
    '#suite-app-section-experience [data-app-field="sectionExperience"]'
  );

  const applicantTitle = (applicantTitleEl?.textContent || "").trim();
  const experienceTitle = (experienceTitleEl?.textContent || "").trim();

  function collectRows(sectionEl, fallbackPrefix) {
    if (!sectionEl) return [];
    return Array.from(sectionEl.querySelectorAll(".suite-app-row")).map((row, idx) => {
      const labelEl = row.querySelector(".suite-app-label");
      const inputEl = row.querySelector(".suite-app-input-box");
      const key = labelEl?.dataset.appField || `${fallbackPrefix}_${idx + 1}`;

      return {
        key,
        label: (labelEl?.textContent || "").trim(),
        inputType: (inputEl?.textContent || "").trim(),
      };
    });
  }

  const applicantSection = document.getElementById("suite-app-section-applicant");
  const experienceSection = document.getElementById("suite-app-section-experience");

  // if you have custom sections, keep them (basic support)
  const customSections = Array.from(
    document.querySelectorAll("#suite-app-builder .suite-app-section-custom")
  ).map((sec) => {
    const sectionKey = sec.dataset.sectionKey || "";
    const titleSpan = sec.querySelector(".suite-app-section-title [data-app-field]");
    return {
      sectionKey,
      titleKey: titleSpan?.getAttribute("data-app-field") || "",
      title: (titleSpan?.textContent || "").trim(),
      rows: collectRows(sec, sectionKey || "custom"),
    };
  });

  return {
    sections: {
      applicantTitle: applicantTitle || "Applicant information",
      experienceTitle: experienceTitle || "Professional experience",
      applicant: collectRows(applicantSection, "applicant"),
      experience: collectRows(experienceSection, "experience"),
      custom: customSections,
    },
  };
}

//Load Locations List 
function populateSuitesLocationFilter(locationsList) {
  const sel = document.getElementById("suites-location-filter");
  if (!sel) return;

  sel.innerHTML = `<option value="">All Locations</option>`;

  (locationsList || []).forEach((loc) => {
    const v = loc.values || loc || {};
    const id = loc._id || loc.id;
    const name =
      v["Location Name"] ||
      v.LocationName ||
      v.name ||
      loc.name ||
      "Untitled location";

    if (!id) return;

    const opt = document.createElement("option");
    opt.value = String(id);
    opt.textContent = name;
    sel.appendChild(opt);
  });
}

function initSuitesLocationFilter() {
  const sel = document.getElementById("suites-location-filter");
  if (!sel) return;

  sel.addEventListener("change", () => {
    window.selectedSuiteLocationId = sel.value || "";
    console.log("[suites] filter changed:", window.selectedSuiteLocationId);

    // ✅ later: call your suites render here
    // renderSuites();
  });
}

function initSuitesWithLocations() {
  const locs = window.STATE?.locations || [];
  populateSuitesLocationFilter(locs);
}

//Change Applications Table based on what location is selected 
const suitesLocationFilter = document.getElementById("suites-location-filter");

if (suitesLocationFilter) {
  suitesLocationFilter.addEventListener("change", async () => {
    // save selected location globally if you want
    window.STATE.selectedLocationId = suitesLocationFilter.value || "";
    await loadSuiteApplications(); // re-render table
  });
}


//Applications Table 
function fmtDateTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString();
}

function pickVal(v, keys) {
  for (const k of keys) {
    const val = v?.[k];
    if (val != null && String(val).trim() !== "") return val;
  }
  return "";
}

async function loadSuiteApplications() {
  const tbody = document.getElementById("suite-applications-tbody");
  const countEl = document.getElementById("suite-applications-count");
  if (!tbody) return;

  // must be logged in
  if (!currentUser?.id) {
    tbody.innerHTML = `<tr><td colspan="6" class="muted">Log in to view applications.</td></tr>`;
    if (countEl) countEl.textContent = `0 applications`;
    return;
  }

  // selected location from dropdown
  const selectedLocationId =
    document.getElementById("suites-location-filter")?.value || "";

  tbody.innerHTML = `<tr><td colspan="6" class="muted">Loading…</td></tr>`;

  // ✅ IMPORTANT: use AUTH route so server enforces visibility
  const appsUrl = apiUrl(`/api/records/Application?limit=500`);

  console.log("[apps] fetch url =", appsUrl);

  let apps = [];
  try {
    const res = await fetch(appsUrl, {
      credentials: "include",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });

    if (!res.ok) {
      const errBody = await readJsonSafe(res);
      console.warn("[apps] load failed", res.status, errBody);
      tbody.innerHTML = `<tr><td colspan="6" class="muted">No applications found.</td></tr>`;
      if (countEl) countEl.textContent = `0 applications`;
      return;
    }

    const data = await res.json().catch(() => ({}));
    apps = Array.isArray(data) ? data : data.records || data.items || data.data || [];

  } catch (err) {
    console.error("[apps] load error", err);
    tbody.innerHTML = `<tr><td colspan="6" class="muted">Failed to load applications.</td></tr>`;
    if (countEl) countEl.textContent = `0 applications`;
    return;
  }
  apps = apps.filter((app) => {
    const v = app.values || app;
    return !(
      v["Is Deleted"] === true ||
      v.isDeleted === true ||
      v.deleted === true ||
      v["Deleted At"]
    );
  });
  // ✅ build a lookup: suiteId -> locationId (based on suites you already loaded)
  const suites = window.STATE.suites || [];
  const suiteIdToLocationId = new Map();

  suites.forEach((s) => {
    const v = s.values || s;
    const suiteId = String(s._id || s.id || "");

    const locRef = v.Location || v["Location"] || null;
    let locId = "";
    if (typeof locRef === "string") locId = locRef;
    else if (locRef && typeof locRef === "object") locId = String(locRef._id || locRef.id || "");

    if (suiteId && locId) suiteIdToLocationId.set(suiteId, locId);
  });

  // ✅ filter apps by location (optional)
  const filtered = apps.filter((app) => {
    if (!selectedLocationId) return true;

    const av = app.values || app;
    const suiteRef = av.Suite || av["Suite"] || null;

    const suiteId =
      typeof suiteRef === "string"
        ? suiteRef
        : suiteRef && typeof suiteRef === "object"
        ? String(suiteRef._id || suiteRef.id || "")
        : "";

    const locId = suiteIdToLocationId.get(suiteId) || "";
    return locId === selectedLocationId;
  });

  // counts
  if (countEl) countEl.textContent = `${filtered.length} applications`;

  // ✅ store counts for dashboard
  window.STATE.applications = apps;
  window.STATE.filteredApplications = filtered;
  updateDashboardCounts();

  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="muted">No applications for this location.</td></tr>`;
    return;
  }

  // render rows
  tbody.innerHTML = filtered
    .map((app) => {
      const v = app.values || app;

      const applicant = v["Applicant Name"] || v.ApplicantName || "—";
      const email = v["Applicant Email"] || v.ApplicantEmail || "—";
      const status = v.Status || "—";
      const submitted = v["Submitted At"]
        ? new Date(v["Submitted At"]).toLocaleString()
        : "—";

      // suite column
      const suiteRef = v.Suite || null;
      const suiteId =
        typeof suiteRef === "string"
          ? suiteRef
          : suiteRef && typeof suiteRef === "object"
          ? String(suiteRef._id || suiteRef.id || "")
          : "";

      const suite = (window.STATE.suites || []).find(
        (s) => String(s._id || s.id) === suiteId
      );

      const suiteName =
        (suite?.values?.["Suite Name"] ||
          suite?.values?.Name ||
          suite?.values?.["Suite Number/Name"] ||
          suite?.values?.name ||
          suite?.Name ||
          suite?.name ||
          suiteId ||
          "—");

    const id = app._id || app.id;

return `
  <tr data-app-row="${id}">
    <td>${escapeHtml(applicant)}</td>
    <td>${escapeHtml(email)}</td>
    <td>${escapeHtml(suiteName)}</td>
    <td><span class="pill">${escapeHtml(status)}</span></td>
    <td>${escapeHtml(submitted)}</td>
    <td class="apps-actions">
      <button class="btn-small" data-app-view="${id}">View</button>

      <button
        class="btn-icon danger"
        type="button"
        title="Delete application"
        aria-label="Delete application"
        data-app-trash="${id}"
      >
        🗑️
      </button>
    </td>
  </tr>
`;

    })
    .join("");


}
(function initAppsTableActions() {
  const tbody = document.getElementById("suite-applications-tbody");
  if (!tbody) return;

  tbody.addEventListener("click", async (e) => {
    // View
    const viewBtn = e.target.closest("[data-app-view]");
    if (viewBtn) {
      const id = viewBtn.getAttribute("data-app-view");
      const row = (window.STATE.filteredApplications || []).find(
        (a) => String(a._id || a.id) === String(id)
      );
      if (row) openSuiteApplicationModal(row);
      return;
    }

    // Trash (soft delete)
    const trashBtn = e.target.closest("[data-app-trash]");
    if (trashBtn) {
      const id = trashBtn.getAttribute("data-app-trash");
      if (!id) return;

      const ok = window.confirm("Soft delete this application?");
      if (!ok) return;

      try {
        trashBtn.disabled = true;
        await softDeleteApplication(id);

        // quick UI remove (optional)
        const tr = trashBtn.closest("tr");
        tr?.remove();

        // reload to refresh count + filter
        await loadSuiteApplications();
      } catch (err) {
        console.error("[apps] soft delete failed", err);
        alert(err?.message || "Failed to delete application.");
      } finally {
        trashBtn.disabled = false;
      }
    }
  });
})();




// ================================
// Application View Modal (shared)
// ================================
//Application Answer helper
function humanizeKey(key) {
  // dateOfApplication -> Date of application
  // customApplicantQ_1 -> Custom applicant q 1 (fallback)
  const s = String(key || "").trim();
  if (!s) return "";

  const withSpaces = s
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")     // camelCase
    .replace(/[_\-]+/g, " ")                    // snake_case / kebab-case
    .replace(/\s+/g, " ")
    .trim();

  return withSpaces.charAt(0).toUpperCase() + withSpaces.slice(1);
}

function normalizeKey(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "") // remove spaces/punct
    .trim();
}

function getAnswerSmart(answersObj, q) {
  if (!answersObj) return "";

  const id = q?.id ? String(q.id) : "";
  const label = q?.label ? String(q.label) : "";

  // 1) exact id
  if (id && answersObj[id] != null) return answersObj[id];

  // 2) exact label
  if (label && answersObj[label] != null) return answersObj[label];

  // 3) normalized match (handles "Date of application" vs "dateOfApplication")
  const nid = normalizeKey(id);
  const nlabel = normalizeKey(label);

  for (const [k, v] of Object.entries(answersObj)) {
    const nk = normalizeKey(k);
    if ((nid && nk === nid) || (nlabel && nk === nlabel)) return v;
  }

  return "";
}

const suiteTemplatePreviewModal = document.getElementById("suite-template-preview-modal");
const suiteTemplatePreviewBody  = document.getElementById("suite-template-preview-body");
const suiteTemplatePreviewClose = document.getElementById("suite-template-preview-close");
const suiteTemplatePreviewOverlay = document.getElementById("suite-template-preview-overlay");

function openPreviewModal() {
  if (!suiteTemplatePreviewModal) return;
  suiteTemplatePreviewModal.style.display = "flex"; // ✅ center + full height overlay
  suiteTemplatePreviewModal.hidden = false;
  suiteTemplatePreviewModal.setAttribute("aria-hidden", "false");
}

function closePreviewModal() {
  if (!suiteTemplatePreviewModal) return;
  suiteTemplatePreviewModal.style.display = "none";
  suiteTemplatePreviewModal.hidden = true;
  suiteTemplatePreviewModal.setAttribute("aria-hidden", "true");
}

suiteTemplatePreviewOverlay?.addEventListener("click", closePreviewModal);

suiteTemplatePreviewClose?.addEventListener("click", closePreviewModal);

// ✅ THIS is what your click handler is calling
// ✅ UPDATED: no duplicates + “extras” only shows when a real template exists
// ---------- helper: fetch ONE record by id (tries a couple common filter styles) ----------
async function fetchOneById(dataType, id) {
  if (!id) return null;

  const tries = [
    `/public/records?dataType=${encodeURIComponent(dataType)}&limit=1&_id=${encodeURIComponent(id)}`,
    `/public/records?dataType=${encodeURIComponent(dataType)}&limit=1&id=${encodeURIComponent(id)}`,
  ];

  for (const path of tries) {
    try {
      const res = await fetch(apiUrl(path), {
        credentials: "include",
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
      if (!res.ok) continue;

      const raw = await res.json().catch(() => ({}));
      const rows = Array.isArray(raw) ? raw : raw.records || raw.items || [];
      if (rows[0]) return rows[0];
    } catch (e) {
      // keep trying
    }
  }
  return null;
}

// ✅ THIS is what your click handler is calling
async function openSuiteApplicationModal(appRow) {
  if (!suiteTemplatePreviewModal || !suiteTemplatePreviewBody) {
    console.warn("[apps] modal missing");
    return;
  }

  const v = appRow.values || appRow;

  const applicantName =
    v["Applicant Name"] || v.applicantName || "Unknown applicant";

  const applicantEmail =
    v["Applicant Email"] || v.applicantEmail || v["Email"] || v.email || "";

  // answers JSON
  const answersObj =
    safeParseJson(v["Answers Json"] || v["Answers JSON"] || v.answersJson) || {};

  // ✅ Auto "Your details"
  const autoName =
    v["Applicant Name"] ||
    v.applicantName ||
    getAnswerSmart(answersObj, { id: "applicantName", label: "Full name" }) ||
    getAnswerSmart(answersObj, { id: "fullName", label: "Full name" }) ||
    getAnswerSmart(answersObj, { id: "name", label: "Full name" }) ||
    "";

  const autoEmail =
    v["Applicant Email"] ||
    v.applicantEmail ||
    getAnswerSmart(answersObj, { id: "applicantEmail", label: "Email address" }) ||
    getAnswerSmart(answersObj, { id: "email", label: "Email address" }) ||
    "";

  // ---------- find suite id ----------
  const suiteRef = v.Suite || v["Suite"] || null;
  const suiteId =
    typeof suiteRef === "string"
      ? suiteRef
      : suiteRef && typeof suiteRef === "object"
      ? String(suiteRef._id || suiteRef.id || "")
      : "";

  // ---------- IMPORTANT: fetch suite fresh so we definitely get Application Template ----------
  const suiteRowFresh = await fetchOneById("Suite", suiteId);
  const suiteFreshV = suiteRowFresh?.values || suiteRowFresh || {};

  // fallback to whatever you already had in STATE (if fresh fetch fails)
  const suiteFromState = (window.STATE.suites || []).find(
    (s) => String(s._id || s.id) === String(suiteId)
  );
  const suiteStateV = suiteFromState?.values || suiteFromState || {};

  const suiteV = Object.keys(suiteFreshV).length ? suiteFreshV : suiteStateV;

  const suiteNameFromRecord =
    suiteV["Suite Name"] ||
    suiteV["Suite Number/Name"] ||
    suiteV.Name ||
    suiteV.name ||
    "Suite";

  // ---------- template: try Suite.Application Template first ----------
  const suiteTemplateStr =
    suiteV["Application Template"] ||
    suiteV.applicationTemplate ||
    "";

  let templateJson = safeParseJson(suiteTemplateStr);

  // ---------- fallback: shared Application template ----------
  if (!templateJson) {
    try {
   const res = await fetch(apiUrl(`/api/records/Application?limit=1`), {
  credentials: "include",
  headers: { Accept: "application/json" },
  cache: "no-store",
});


      if (res.ok) {
        const raw = await res.json().catch(() => ({}));
        const rows = Array.isArray(raw) ? raw : raw.records || raw.items || [];
        const first = rows[0];
        const vals = first?.values || first || {};
        templateJson = safeParseJson(
          vals["Template Json"] || vals["Sections Json"] || vals["Application Json"] || ""
        );
      }
    } catch (e) {
      console.warn("[apps] template fallback failed", e);
    }
  }

  const sections = normalizeTemplateToSections(templateJson);

  // track keys already shown
  const usedKeys = new Set();
  ["full name", "email address", "name", "email", "applicantname", "applicantemail"].forEach((k) =>
    usedKeys.add(normalizeKey(k))
  );

  // ---------- template sections html ----------
  const sectionsHtml = sections.length
    ? sections
        .map((sec) => {
          const qHtml = (sec.questions || [])
            .map((q) => {
              const rawVal = getAnswerSmart(answersObj, q);

              usedKeys.add(normalizeKey(q.id));
              usedKeys.add(normalizeKey(q.label));

              const value = rawVal == null ? "" : String(rawVal);

              const inputType = String(q.inputType || "").toLowerCase();
              const isTextarea = inputType.includes("textarea");
              const isDate = inputType.includes("date");

              const inputHtml = isTextarea
                ? `<textarea class="suite-app-input suite-app-textarea" disabled>${escapeHtml(value)}</textarea>`
                : `<input class="suite-app-input" type="${isDate ? "date" : "text"}" value="${escapeHtml(value)}" disabled />`;

              return `
                <div class="suite-app-question-row">
                  <div class="suite-app-question-label">${escapeHtml(q.label)}</div>
                  <div class="suite-app-question-input">${inputHtml}</div>
                </div>
              `;
            })
            .join("");

          return `
            <div class="suite-app-section">
              <div class="suite-app-section-title">${escapeHtml(sec.title)}</div>
              ${qHtml || `<div class="muted">No questions in this section.</div>`}
            </div>
          `;
        })
        .join("")
    : "";

  // ✅ ONLY show raw answers if there is truly NO template
  const rawAnswersHtml = !sections.length
    ? `
      <div class="suite-app-section">
        <div class="muted">No template found for this suite, showing raw answers:</div>
        <div class="suite-app-section-body">
          ${Object.entries(answersObj)
            .map(
              ([k, val]) => `
                <div class="suite-app-question-row">
                  <div class="suite-app-question-label">${escapeHtml(humanizeKey(k))}</div>
                  <div class="suite-app-question-input">
                    <input class="suite-app-input" value="${escapeHtml(String(val ?? ""))}" disabled />
                  </div>
                </div>
              `
            )
            .join("")}
        </div>
      </div>
    `
    : "";

  const detailsSectionHtml = `
    <div class="suite-app-section">
      <div class="suite-app-section-title">Your details</div>

      <div class="suite-app-question-row">
        <div class="suite-app-question-label">Full name</div>
        <div class="suite-app-question-input">
          <input class="suite-app-input" value="${escapeHtml(String(autoName || ""))}" disabled />
        </div>
      </div>

      <div class="suite-app-question-row">
        <div class="suite-app-question-label">Email address</div>
        <div class="suite-app-question-input">
          <input class="suite-app-input" value="${escapeHtml(String(autoEmail || ""))}" disabled />
        </div>
      </div>
    </div>
  `;

  suiteTemplatePreviewBody.innerHTML = `
    <div class="suite-app-modal suite-app-preview">
      <div class="suite-app-header">
        <div class="suite-app-header-main">
          <div class="suite-app-header-top">
            <div class="suite-app-avatar">${escapeHtml((applicantName || "A")[0])}</div>
            <div class="suite-app-header-text">
              <div class="suite-app-location-name">${escapeHtml("Application")}</div>
              <div class="suite-app-suite-name">Application for Lease – ${escapeHtml(suiteNameFromRecord)}</div>
            </div>
          </div>
          <p class="suite-app-header-sub">Viewing submitted answers (read-only).</p>
          <div class="suite-app-meta-email">${escapeHtml(applicantEmail)}</div>
        </div>
      </div>

      <div class="suite-app-body">
        ${detailsSectionHtml}
        ${sectionsHtml}
        ${rawAnswersHtml}
      </div>

      <div class="suite-app-footer">
        <div class="suite-app-footer-buttons">
          <button type="button" class="suite-app-secondary-btn" id="apps-preview-close-btn">Close</button>
        </div>
      </div>
    </div>
  `;
requestAnimationFrame(() => {
  const scroller = suiteTemplatePreviewModal.querySelector(".suite-app-body");
  if (scroller) scroller.scrollTop = 0;
});

  document
    .getElementById("apps-preview-close-btn")
    ?.addEventListener("click", closePreviewModal);

  openPreviewModal();
}




     function safeParseJson(x) {
  if (!x) return null;
  try { return typeof x === "string" ? JSON.parse(x) : x; }
  catch { return null; }
}

// Convert your template JSON into sections like the public page does
function rowsToQuestions(rows, prefix) {
  if (!Array.isArray(rows)) return [];

  return rows.map((row, idx) => {
    const id = row.key || row.id || `${prefix}_${idx + 1}`;

    // ✅ try multiple possible label fields from your builder
    const label =
      (row.label && String(row.label).trim()) ||
      (row.question && String(row.question).trim()) ||
      (row.prompt && String(row.prompt).trim()) ||
      (row.text && String(row.text).trim()) ||
      (row.title && String(row.title).trim()) ||
      (row.name && String(row.name).trim()) ||
      // fallback: turn key into nice text
      humanizeKey(id);

    const inputType = String(row.inputType || row.type || "text").toLowerCase();

    return {
      id,
      label,
      inputType,
      placeholder: row.placeholder || "",
    };
  });
}

function normalizeTemplateToSections(raw) {
  if (!raw) return [];

  // Already array format
  if (Array.isArray(raw)) {
    return raw.map((sec, i) => ({
      id: sec.id || `section_${i + 1}`,
      title: sec.title || `Section ${i + 1}`,
      questions: rowsToQuestions(sec.questions || sec.rows || [], sec.id || `section_${i + 1}`),
    }));
  }

  // Builder format: { sections: { applicant, experience, custom, applicantTitle, experienceTitle } }
  if (raw.sections) {
    const out = [];

    const applicantRows = raw.sections.applicant || [];
    if (applicantRows.length) {
      out.push({
        id: "applicant",
        title: raw.sections.applicantTitle || "Applicant"
,
        questions: rowsToQuestions(applicantRows, "applicant"),
      });
    }

    const experienceRows = raw.sections.experience || [];
    if (experienceRows.length) {
      out.push({
        id: "experience",
      title: raw.sections.experienceTitle || "Professional Experience",
        questions: rowsToQuestions(experienceRows, "experience"),
      });
    }

    const custom = Array.isArray(raw.sections.custom) ? raw.sections.custom : [];
    custom.forEach((sec, idx) => {
      const sid = sec.sectionKey || sec.titleKey || `custom_${idx + 1}`;
      out.push({
        id: sid,
        title: sec.title || "New section",
        questions: rowsToQuestions(sec.rows || [], sid),
      });
    });

    return out;
  }

  return [];
}

function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// Find answer by exact key OR a friendlier match
function getAnswer(answersObj, questionId, label) {
  if (!answersObj) return "";

  // exact key first
  if (answersObj[questionId] != null) return answersObj[questionId];

  // try label-based (some of your keys are label-ish)
  const target = String(label || "").toLowerCase().trim();
  if (target) {
    for (const [k, v] of Object.entries(answersObj)) {
      if (String(k).toLowerCase().trim() === target) return v;
    }
  }

  return "";
}
    //Application Helper 
    // ✅ Always catch the Create/Edit Application click even if init runs early
document.addEventListener("click", (e) => {
  const btn = e.target.closest("#open-suite-app-builder");
  if (!btn) return;

  console.log("[suite-app] button clicked");

  // ✅ open suite must exist
  const suite = window.selectedSuite || window.activeSuite || null;
  if (!suite) {
    alert("Open a suite first.");
    return;
  }

  // ✅ open the builder modal
  openSuiteAppBuilderModal();
});


//resetApplication
function resetApplicationsUI() {
  // reset filter dropdown
  const filter = document.getElementById("suites-location-filter");
  if (filter) filter.value = "";

  // reset table + count
  const tbody = document.getElementById("suite-applications-tbody");
  const countEl = document.getElementById("suite-applications-count");

  if (tbody) {
    tbody.innerHTML = `<tr><td colspan="6" class="muted">Loading…</td></tr>`;
  }
  if (countEl) countEl.textContent = `0 applications`;

  // close modal if open
  try {
    closePreviewModal?.();
  } catch {}
}









































































































                   // ================================
                         // Suities Section
                  // ================================

// ================================
// Suities Section (CLEANED)
// ================================

// --------------------------------------------------
// 1) LOCATIONS FILTER DROPDOWN (top of section)
// --------------------------------------------------
function populateSuitiesLocationFilter(locationsList) {
  const sel = document.getElementById("suities-location-filter");
  if (!sel) return;

  sel.innerHTML = `<option value="">All locations</option>`;

  (locationsList || []).forEach((loc) => {
    const v = loc.values || loc || {};
    const id = loc._id || loc.id;
    const name = v["Location Name"] || v.name || loc.name || "Untitled location";
    if (!id) return;

    const opt = document.createElement("option");
    opt.value = id;
    opt.textContent = name;
    sel.appendChild(opt);
  });
}

function initSuitiesLocationFilter() {
  const sel = document.getElementById("suities-location-filter");
  if (!sel) return;

  sel.addEventListener("change", () => {
    window.selectedSuitieLocationId = sel.value || "";
    console.log("[suities] filter changed:", window.selectedSuitieLocationId);

    // later: filter your suitie list here:
    // renderSuitiesList();
  });
}





// ================================
// Suities Card list 
// ================================
// -------- Suities: filter + card list --------
let ALL_SUITIES = [];
let ALL_LOCATIONS = [];


// Helpers


function escapeHtml(s = "") {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
function money(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "";
  return n.toLocaleString(undefined, { style: "currency", currency: "USD" });
}
function getId(row) {
  return row?._id || row?.id || row?.values?._id || "";
}
function getValues(row) {
  return row?.values || row || {};
}
function apiUrl(path) {
  const base = String(API_BASE || "").replace(/\/$/, "");
  return `${base}${path}`;
}

// 1) Load Locations into the filter dropdown
async function loadSuitiesLocationFilter() {
  const select = document.getElementById("suities-location-filter");
  if (!select) return;

  if (!currentUser?.id) {
    ALL_LOCATIONS = [];
    select.innerHTML = `<option value="">All locations</option>`;
    return;
  }

  // ✅ AUTH endpoint (server enforces ownership)
  const url = apiUrl(`/api/records/Location?limit=200`);

  const res = await fetch(url, {
    credentials: "include",
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  if (!res.ok) {
    ALL_LOCATIONS = [];
    select.innerHTML = `<option value="">All locations</option>`;
    return;
  }

  const data = await res.json().catch(() => ({}));
  const rows = Array.isArray(data) ? data : data.records || data.items || data.data || [];

  ALL_LOCATIONS = rows;

  select.innerHTML = `<option value="">All locations</option>`;

  rows.forEach((loc) => {
    const v = getValues(loc);
    const id = getId(loc);
    const name =
      v["Location Name"] ||
      v.LocationName ||
      v.name ||
      v.title ||
      "Untitled location";

    if (!id) return;

    select.insertAdjacentHTML(
      "beforeend",
      `<option value="${escapeHtml(String(id))}">${escapeHtml(String(name))}</option>`
    );
  });
}


// 2) Load all suities once
async function loadSuities() {
  if (!currentUser?.id) {
    ALL_SUITIES = [];
    window.STATE.suities = [];
    renderSuities();
    updateDashboardCounts();
    return;
  }

  // ✅ AUTH endpoint (server enforces ownership)
  const url = apiUrl(`/api/records/Suitie?limit=500`);

  try {
    const res = await fetch(url, {
      credentials: "include",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });

    if (!res.ok) {
      ALL_SUITIES = [];
      window.STATE.suities = [];
      renderSuities();
      updateDashboardCounts();
      return;
    }

    const data = await res.json().catch(() => ({}));
    const rows = Array.isArray(data) ? data : data.records || data.items || data.data || [];

    ALL_SUITIES = rows;
    window.STATE.suities = rows;

    renderSuities();
    updateDashboardCounts();

    console.log("[suities] loaded count:", ALL_SUITIES.length);
  } catch (err) {
    console.error("[suities] load error", err);
    ALL_SUITIES = [];
    window.STATE.suities = [];
    renderSuities();
    updateDashboardCounts();
  }
}



async function initSuitiesSection() {
  initSuitiesFilterEvents();
  initSuitieDelete();
   initSuitieEdit(); 
  await loadSuities();
}


// 3) Render card list based on selected location filter
function getLocationIdFromSuitieRow(row) {
  const v = getValues(row);

  let c = v.Location ?? v["Location"] ?? v.locationId ?? v.location;
  if (!c) return "";

  // handle "Allow multiple"
  if (Array.isArray(c)) c = c[0];

  // handle populated object
  if (typeof c === "object" && (c._id || c.id)) {
    return String(c._id || c.id);
  }

  // handle string id
  return String(c);
}



function renderSuities() {
  const holder = document.getElementById("suities-list");
  const select = document.getElementById("suities-location-filter");
  if (!holder) return;

  holder.style.display = "block"; // 🔥 THIS FIXES IT

  const selectedLocationId = select?.value || "";

  const filtered = ALL_SUITIES.filter((row) => {
    if (!selectedLocationId) return true;
    const suitieLocId = getLocationIdFromSuitieRow(row);
    return String(suitieLocId) === String(selectedLocationId);
  });

  if (!filtered.length) {
    holder.innerHTML = `<p class="muted">No suities yet. Click “Add suitie” to create one.</p>`;
    return;
  }

  console.log("[suities] selectedLocationId:", selectedLocationId);
console.log("[suities] filtered count:", filtered.length);

  holder.innerHTML = filtered.map((row) => {
    const v = getValues(row);
    const id = getId(row);

    // ✅ use your actual field names
    const first = v["First Name"] || v.firstName || "";
    const last  = v["Last Name"] || v.lastName || "";
    const name  = `${first} ${last}`.trim() || "Unnamed suitie";

    const email = v["Email"] || v.Email || v.email || "";
    const phone = v["Phone Number"] || v.phone || "";
    const suiteName = v["Suite Number/Name"] || "";

  return `
  <div class="suitie-card" data-id="${escapeHtml(id)}">
    <div class="suitie-main-row">

      <!-- LEFT: avatar + text -->
      <div class="suitie-main-left">
        <div class="suitie-main-left-inner">

          ${(() => {
            const photo =
              v["Suitie Photo"] ||
              v.suitiePhoto ||
              v.photoUrl ||
              v.photo ||
              v.imageUrl ||
              v.image ||
              "";

            const firstLetter = (first || "S").slice(0, 1).toUpperCase();
            const lastLetter = (last || "").slice(0, 1).toUpperCase();
            const initials = `${firstLetter}${lastLetter}`.trim() || "S";

            if (photo) {
              return `
                <div class="suitie-avatar">
                  <img src="${escapeHtml(photo)}" alt="Suitie photo" />
                </div>
              `;
            }

            return `
              <div class="suitie-avatar suitie-avatar--placeholder">
                <span>${escapeHtml(initials)}</span>
              </div>
            `;
          })()}

          <div class="suitie-text">
            <h3>${escapeHtml(name)}</h3>
            ${suiteName ? `<p class="suitie-meta">${escapeHtml(suiteName)}</p>` : ""}
            ${email ? `<p class="suitie-meta">${escapeHtml(email)}</p>` : ""}
            ${phone ? `<p class="suitie-meta">${escapeHtml(phone)}</p>` : ""}
          </div>

        </div>
      </div>

      <!-- RIGHT: actions -->
      <div class="suitie-main-right">
        <button class="ss-btn ss-btn-outline btn-edit-suitie" type="button">Edit</button>
        <button class="ss-btn ss-btn-danger btn-delete-suitie" type="button">Delete</button>
      </div>

    </div>
  </div>
`;

  }).join("");
  console.log("[suities] rendered cards:", holder.children.length);

}

// Hook up filter change
function initSuitiesFilterEvents() {
  const select = document.getElementById("suities-location-filter");
  if (!select) return;

select.addEventListener("change", () => {
  console.log("[suities] dropdown changed to:", select.value);
  console.log("[suities] sample suitie location values:", ALL_SUITIES.slice(0,5).map(s => (s.values||s).Location));
  renderSuities();
});

}

// --------------------------------------------------
// 2) ADD SUITIE BUTTON opens/closes the FORM
//    and hides subtitle + filter row
// --------------------------------------------------
function initSuitiesAddButton() {
  const addBtn = document.getElementById("suities-add-btn");
  const formCard = document.getElementById("suities-form-card");
  const list = document.getElementById("suities-list");

  // ✅ these must exist in your HTML
  const subtitle = document.getElementById("suities-subtitle");
  const filterRow = document.getElementById("suities-filter-row");

  const cancelBtn = document.getElementById("suitie-cancel-btn");

addBtn?.addEventListener("click", () => {
  if (formCard) formCard.hidden = false;
  if (list) list.style.display = "none";

  setSuitiesTopControlsHidden(true); // ✅ hide Add + Filter

  if (subtitle) subtitle.style.display = "none";

  formCard?.scrollIntoView({ behavior: "smooth", block: "start" });
});

cancelBtn?.addEventListener("click", () => {
  if (formCard) formCard.hidden = true;
  if (list) list.style.display = "block";

  setSuitiesTopControlsHidden(false); // ✅ show Add + Filter again

  if (subtitle) subtitle.style.display = "";
});

}


// --------------------------------------------------
// 3) LOCATION DROPDOWN INSIDE THE FORM
// --------------------------------------------------
function populateSuitieLocationSelect(locationsList) {
  const sel = document.getElementById("suitie-location-select");
  if (!sel) return;

  sel.innerHTML = `<option value="">Select a location…</option>`;

  (locationsList || []).forEach((loc) => {
    const v = loc.values || loc || {};
    const id = loc._id || loc.id;
    const name = v["Location Name"] || v.name || loc.name || "Untitled location";
    if (!id) return;

    const opt = document.createElement("option");
    opt.value = id;
    opt.textContent = name;
    sel.appendChild(opt);
  });
}


// --------------------------------------------------
// 4) WHEN LOCATION CHANGES → LOAD SUITES → FILL SUITE SELECT
// --------------------------------------------------
function initSuitieLocationSelect() {
  const locSel = document.getElementById("suitie-location-select");
  const suiteSel = document.getElementById("suitie-suite-select");
  if (!locSel || !suiteSel) return;

  locSel.addEventListener("change", async () => {
    const locationId = locSel.value || "";

    suiteSel.innerHTML = `<option value="">Select a suite…</option>`;
    window.STATE = window.STATE || {};
    window.STATE.suitesForSuitieForm = []; // reset

    if (!locationId) return;

    try {
      const suites = await fetchSuitesForLocation(locationId);

      // ✅ save them so we can lookup defaults on suite change
      window.STATE.suitesForSuitieForm = suites;

      populateSuitieSuiteSelect(suites);
    } catch (err) {
      console.error("[suitie form] load suites error", err);
      suiteSel.innerHTML = `<option value="">Failed to load suites</option>`;
    }
  });
}

//Auto fill suite rent 
function initSuitieSuiteAutoFill() {
  const suiteSel = document.getElementById("suitie-suite-select");
  const rentEl = document.getElementById("suitie-rent");
  const freqEl = document.getElementById("suitie-rent-frequency");
  if (!suiteSel || !rentEl || !freqEl) return;

  suiteSel.addEventListener("change", () => {
    const suiteId = suiteSel.value || "";
    const suites = window.STATE?.suitesForSuitieForm || [];

    const suite = suites.find((s) => String(s._id || s.id) === String(suiteId));
    const v = suite?.values || suite || {};

    // ✅ try multiple possible field names (because your DB keys vary)
    const baseRent =
      v["Base Rent"] ??
      v["Suite Rent (base)"] ??
      v["Suite Rent"] ??
      v["Rent"] ??
      v.baseRent ??
      "";

    const interval =
      v["Preferred Interval"] ??
      v["Rent Frequency"] ??
      v["Interval"] ??
      v.interval ??
      v.frequency ??
      "";

    // Fill the form fields
    rentEl.value = baseRent !== "" && baseRent != null ? String(baseRent) : "";

    // normalize interval if needed (example: "Monthly" -> "monthly")
    const normalized = String(interval || "").trim().toLowerCase();
    freqEl.value = normalized; // must match option values (weekly/monthly/etc.)

    console.log("[suitie] autofill from suite", { suiteId, baseRent, interval });
  });
}


// --------------------------------------------------
// 5) FETCH SUITES (then filter to selected location)
// --------------------------------------------------
async function fetchSuitesForLocation(locationId) {
  const SUITE_DATATYPE = "Suite";

  if (!currentUser?.id) return [];

  // ✅ AUTH endpoint (server enforces ownership)
  const url = apiUrl(`/api/records/${encodeURIComponent(SUITE_DATATYPE)}?limit=500`);

  const res = await fetch(url, {
    credentials: "include",
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  if (!res.ok) return [];

  const data = await res.json().catch(() => ({}));
  const rows = Array.isArray(data) ? data : data.records || data.items || data.data || [];

  return rows.filter((s) => suiteBelongsToLocation(s, locationId));
}



// --------------------------------------------------
// 6) MATCH a suite to a location (handles many field names)
// --------------------------------------------------
function suiteBelongsToLocation(suite, locationId) {
  const v = suite?.values || suite || {};

  const candidates = [
    v.locationId,
    v.LocationId,
    v["Location Id"],
    v["locationId"],
    v["Location"],
    v.location,
    v["Parent Location"],
    v.parentLocationId,
    v["parentLocationId"],
    v.locationRecordId,
    v["Location Record Id"],
  ];

  for (const c of candidates) {
    if (!c) continue;

    // object ref
    if (typeof c === "object" && (c._id || c.id)) {
      return String(c._id || c.id) === String(locationId);
    }

    // plain string/id
    if (String(c) === String(locationId)) return true;
  }

  return false;
}


// --------------------------------------------------
// 7) POPULATE SUITE SELECT
// --------------------------------------------------
//Hide add suitie header 
function hideSuitiesTopControls() {
  const addBtn = document.getElementById("suities-add-btn");
  const filterRow = document.getElementById("suities-filter-row");

  if (addBtn) addBtn.style.display = "none";

}

function showSuitiesTopControls() {
  const addBtn = document.getElementById("suities-add-btn");
  const filterRow = document.getElementById("suities-filter-row");

  if (addBtn) addBtn.style.display = "";
  if (filterRow) filterRow.style.display = "";
}

function populateSuitieSuiteSelect(suites) {
  const sel = document.getElementById("suitie-suite-select");
  if (!sel) return;

  sel.innerHTML = `<option value="">Select a suite…</option>`;

  (suites || []).forEach((s) => {
    const v = s.values || s || {};
    const id = s._id || s.id;

    const name =
      v["Suite Name"] ||
      v["Suite"] ||
      v.name ||
      v["Name"] ||
      "Untitled suite";

    if (!id) return;

    const opt = document.createElement("option");
    opt.value = id;
    opt.textContent = name;
    sel.appendChild(opt);
  });

  if (!suites || !suites.length) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "No suites found for this location";
    opt.disabled = true;
    sel.appendChild(opt);
  }
}


// --------------------------------------------------
// 8) CALL THIS after locations load
//    Put this right after: window.STATE.locations = rows;
// --------------------------------------------------
function initSuitiesWithLocations() {
  const locs = window.STATE?.locations || [];

  // top filter
  populateSuitiesLocationFilter(locs);

  // form location dropdown
  populateSuitieLocationSelect(locs);
}

//Show image preview
function initSuitiePhotoPreview() {
  const input = document.getElementById("suitie-photo-file");
  const holder = document.getElementById("suitie-photo-preview");
  if (!input || !holder) return;

  let pendingSuitiePhotoFile = null;

  function render() {
    if (!pendingSuitiePhotoFile) {
      holder.innerHTML = `<span class="muted">No photo selected.</span>`;
      return;
    }

    const url = URL.createObjectURL(pendingSuitiePhotoFile);

    holder.innerHTML = `
      <div class="gallery-thumb-wrapper">
        <button type="button" class="gallery-thumb-remove" aria-label="Remove photo">×</button>
        <img src="${url}" alt="Suitie photo preview" />
      </div>
    `;

    // cleanup blob url after load
    holder.querySelector("img")?.addEventListener("load", () => {
      try { URL.revokeObjectURL(url); } catch {}
    });

    holder.querySelector(".gallery-thumb-remove")?.addEventListener("click", () => {
      pendingSuitiePhotoFile = null;
      input.value = "";
      render();
    });
  }

  input.addEventListener("change", () => {
    const file = input.files?.[0] || null;
    pendingSuitiePhotoFile = file;
    render();
  });

  // optional helpers so you can reset when canceling the form
  window._getPendingSuitiePhotoFile = () => pendingSuitiePhotoFile;
  window._clearSuitiePhotoPreview = () => {
    pendingSuitiePhotoFile = null;
    input.value = "";
    render();
  };

  render();
}









///////// ================================
/////////////// Save a Suitie
//// ///================================
//helper
function unwrapRecord(payload) {
  if (!payload) return null;

  if (payload._id || payload.id) return payload;

  if (payload.record) return payload.record;
  if (payload.item) return payload.item;
  if (payload.data) return payload.data;
  if (payload.result) return payload.result;

  if (Array.isArray(payload.records) && payload.records[0]) return payload.records[0];
  if (Array.isArray(payload.items) && payload.items[0]) return payload.items[0];

  return null;
}

function getRecordId(payload) {
  const rec = unwrapRecord(payload);
  return rec?._id || rec?.id || "";
}



async function createRecord(dataTypeName, values) {
  const res = await fetch(apiUrl(`/api/records/${encodeURIComponent(dataTypeName)}`), {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ values }),
  });

  const payload = await readJsonSafe(res);
  if (!res.ok) throw new Error(payload?.message || `Failed to create ${dataTypeName}`);

  const rec = unwrapRecord(payload);
  if (!rec) throw new Error(`${dataTypeName} saved but response did not include record`);

  return rec;
}




function initSuitieSave() {
  const form = document.getElementById("suitie-form");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!currentUser?.id) return alert("You must be logged in.");

    // ---------- form values ----------
    const locationId =
      document.getElementById("suitie-location-select")?.value || "";
    const suiteId = document.getElementById("suitie-suite-select")?.value || "";

    const first = document.getElementById("suitie-first")?.value?.trim() || "";
    const last = document.getElementById("suitie-last")?.value?.trim() || "";
    const email = document.getElementById("suitie-email")?.value?.trim() || "";
    const phone = document.getElementById("suitie-phone")?.value?.trim() || "";
    const note = document.getElementById("suitie-note")?.value?.trim() || "";

    const rentAmountRaw = document.getElementById("suitie-rent")?.value || "";
    const dueDate = document.getElementById("suitie-rent-due")?.value || ""; // yyyy-mm-dd
    const rentAmount = rentAmountRaw === "" ? null : Number(rentAmountRaw);

const freqEl = document.getElementById("suitie-rent-frequency");
const freqValue = (freqEl?.value || "").trim().toLowerCase();


    if (!suiteId) return alert("Please select a suite.");
    if (!first) return alert("First name is required.");

    try {
      // -------------------------------------------------------
      // ✅ 0) Upload suitie photo FIRST (optional)
      // -------------------------------------------------------
// ✅ 0) Upload suitie photo FIRST (optional)
// ✅ keep existing photo unless user picks a new one
let suitiePhotoUrl = existingSuitiePhotoUrl || "";

const file = window._getPendingSuitiePhotoFile?.(); // your existing helper
if (file) {
  suitiePhotoUrl = await uploadOneImage(file);
}


      // -------------------------------------------------------
      // ✅ 1) CREATE SUITIE (NOW we can use suitiePhotoUrl)
      // -------------------------------------------------------
      const suitieValues = {
        ownerUserId: currentUser.id,
        "Created By": currentUser.id,

        "First Name": first,
        "Last Name": last,
        Email: email,
        "Phone Number": phone,

        // Reference → Location
        Location: locationId ? [locationId] : [],

        // Reference → Suite
        Suite: suiteId,

        "Suite Number/Name": getSelectedText("suitie-suite-select"),
        Note: note,

        "Suitie Photo": suitiePhotoUrl,
      };

      let suitieRec;

if (editingSuitieId) {
  // ✅ UPDATE existing suitie
  suitieRec = await updateRecord("Suitie", editingSuitieId, suitieValues);
} else {
  // ✅ CREATE new suitie
  suitieRec = await createRecord("Suitie", suitieValues);
}

      console.log("[suitie] created response:", suitieRec);
      console.log("[suitie] saved values:", suitieValues);

const suitieId = editingSuitieId || getRecordId(suitieRec);
if (!suitieId) throw new Error("Suitie saved but id was missing.");

 // -------------------------------------------------------
// 2) CREATE or UPDATE SUITE RENT
// -------------------------------------------------------
let suiteRentId = "";

// ✅ if suitie already has a Suite Rent linked, update it
let existingRentRef = "";
if (editingSuitieId) {
  const suitieRecFresh = await fetchRecordById("Suitie", suitieId);
  const sv = suitieRecFresh?.values || suitieRecFresh || {};
  existingRentRef = sv["Suite Rent"] || sv.SuiteRent || "";
  if (Array.isArray(existingRentRef)) existingRentRef = existingRentRef[0];
  if (typeof existingRentRef === "object" && existingRentRef) {
    existingRentRef = existingRentRef._id || existingRentRef.id || "";
  }
  existingRentRef = String(existingRentRef || "");
}



if (rentAmount != null || dueDate || freqValue) {
const suiteRentValues = {
  ownerUserId: currentUser.id,
  "Created By": currentUser.id,

  Amount: rentAmount != null ? rentAmount : 0,

  // ✅ support both
  "Due Date": dueDate || "",
  "Next Due Date": dueDate || "",

  // ✅ support both spellings
  "Perferred Interval": freqValue,
  "Preferred Interval": freqValue,

  // reference
  Suitie: suitieId,
};

  console.log("[rent save] existingRentRef:", existingRentRef);
  console.log("[rent save] sending:", suiteRentValues);

  let rentSaved;

  if (existingRentRef) {
    rentSaved = await updateRecord("Suite Rent", existingRentRef, suiteRentValues);
    suiteRentId = existingRentRef;
  } else {
    rentSaved = await createRecord("Suite Rent", suiteRentValues);
    suiteRentId = rentSaved?._id || rentSaved?.id || rentSaved?.record?._id || rentSaved?.record?.id || "";
  }

  console.log("[rent save] saved response:", rentSaved);
}

// -------------------------------------------------------
// 3) Ensure Suitie points to Suite Rent (only if newly created)
// -------------------------------------------------------
if (suiteRentId && !existingRentRef) {
  await updateRecord("Suitie", suitieId, { "Suite Rent": suiteRentId });
}


editingSuitieId = null;
existingSuitiePhotoUrl = "";

      alert("Suitie saved!");

      // reset UI
      form.reset();
      window._clearSuitiePhotoPreview?.();

      // optionally return to list view
      const formCard = document.getElementById("suities-form-card");
      const list = document.getElementById("suities-list");
      if (formCard) formCard.hidden = true;
      if (list) list.style.display = "block";
setSuitiesTopControlsHidden(false);


      // show subtitle/filter back on:
      const sub = document.getElementById("suities-subtitle");
      const row = document.getElementById("suities-filter-row");
      if (sub) sub.style.display = "";
      if (row) row.style.display = "";

      // reload list
      await loadSuities();
    } catch (err) {
      console.error("[suities] save error", err);
      alert(err?.message || "Failed to save suitie");
    }
  });
}



///////// ================================
/////////////// Update Suitie
//// ///================================
//hide top of add suitie
function setSuitiesTopControlsHidden(hidden) {
  const addBtn = document.getElementById("suities-add-btn");
  const filterRow = document.getElementById("suities-filter-row");

  if (addBtn) addBtn.classList.toggle("is-hidden", hidden);
  if (filterRow) filterRow.classList.toggle("is-hidden", hidden);
}

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

let editingSuitieId = null;
let existingSuitiePhotoUrl = "";

function initSuitieEdit() {
  const holder = document.getElementById("suities-list");
  console.log("[initSuitieEdit] holder:", holder);

  if (!holder) return;

  holder.addEventListener("click", (e) => {
    const editBtn = e.target.closest(".btn-edit-suitie");
    if (!editBtn) return;

    const card = editBtn.closest(".suitie-card");
    const id = card?.dataset?.id;

    console.log("[edit click] id:", id, "card:", card);

    if (!id) return;
    openSuitieEditMode(id);
  });
}

async function openSuitieEditMode(id) {
  editingSuitieId = id;

  setSuitiesTopControlsHidden(true);

  const delBtn = document.getElementById("suitie-delete-btn");
if (delBtn) delBtn.style.display = "inline-flex";

  const row = ALL_SUITIES.find((r) => String(getId(r)) === String(id));
  if (!row) {
    console.warn("[suitie edit] not found in ALL_SUITIES", { id, count: ALL_SUITIES.length });
    return;
  }

  const v = getValues(row);

  console.log("[suitie edit] opening edit mode", {
    id,
    row,          // full record
    values: v,    // just the values
    suiteRef: v.Suite,
    locationRef: v.Location,
    suiteRentRef: v["Suite Rent"] || v.SuiteRent,
    photo: v["Suitie Photo"] || v.photoUrl || v.photo || v.imageUrl || v.image
  });

  // ✅ current saved photo (file inputs cannot be prefilled)
const photoUrl =
  v["Suitie Photo"] ||
  v.suitiePhoto ||
  v.photoUrl ||
  v.photo ||
  v.imageUrl ||
  v.image ||
  "";

existingSuitiePhotoUrl = photoUrl || "";

const preview = document.getElementById("suitie-photo-preview");
if (preview) {
  preview.innerHTML = photoUrl
    ? `
      <div style="display:flex; gap:12px; align-items:center;">
        <img src="${escapeHtml(photoUrl)}"
             alt="Current suitie photo"
             style="width:72px;height:72px;border-radius:12px;object-fit:cover;border:1px solid rgba(0,0,0,.08);" />
        <div class="muted">Current photo (choose a new file to replace)</div>
      </div>
    `
    : `<span class="muted">No photo saved yet.</span>`;
}

// ✅ clear the file input visually (browser security)
const fileInput = document.getElementById("suitie-photo-file");
if (fileInput) fileInput.value = "";

  // show form, hide list...
  const formCard = document.getElementById("suities-form-card");
  const list = document.getElementById("suities-list");
  if (formCard) formCard.hidden = false;
  if (list) list.style.display = "none";

  // inputs you already have
  document.getElementById("suitie-first").value = v["First Name"] || "";
  document.getElementById("suitie-last").value  = v["Last Name"] || "";
  document.getElementById("suitie-email").value = v.Email || v["Email"] || "";
  document.getElementById("suitie-phone").value = v["Phone Number"] || "";
  document.getElementById("suitie-note").value  = v.Note || "";

  const locSelect = document.getElementById("suitie-location-select");
  const suiteSelect = document.getElementById("suitie-suite-select");

  // ---- LOCATION ----
  let loc = v.Location ?? "";
  if (Array.isArray(loc)) loc = loc[0];
  if (typeof loc === "object") loc = loc._id || loc.id || "";
  if (locSelect && loc) {
    locSelect.value = String(loc);

    // ✅ trigger whatever code you already have that loads suites for that location
    locSelect.dispatchEvent(new Event("change", { bubbles: true }));
  }

  // ---- SUITE ----
  let suite = v.Suite ?? "";
  if (Array.isArray(suite)) suite = suite[0];
  if (typeof suite === "object") suite = suite._id || suite.id || "";

  // ✅ wait for suite options to populate, then set
  await wait(150);            // small delay
  for (let i = 0; i < 10; i++) {
    if (suiteSelect?.options?.length > 1) break;  // options loaded
    await wait(100);
  }
  if (suiteSelect && suite) suiteSelect.value = String(suite);

  // ✅ now load Suite Rent fields too (next section)
  await fillSuiteRentFieldsFromSuitie(v);
}
async function fetchRecordById(dataType, id) {
  const url = apiUrl(`/api/records/${encodeURIComponent(dataType)}/${encodeURIComponent(id)}`);

  const res = await fetch(url, {
    credentials: "include",
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  const payload = await readJsonSafe(res);
  if (!res.ok) return null;

  return unwrapRecord(payload) || null;
}


async function fillSuiteRentFieldsFromSuitie(suitieValues) {
  // ✅ declare FIRST
  let rentRef = suitieValues["Suite Rent"] || suitieValues.SuiteRent || "";

  // ✅ safe log AFTER declaration
  console.log("[rent] suitieValues Suite Rent raw:", rentRef);

  if (!rentRef) return;

  if (Array.isArray(rentRef)) rentRef = rentRef[0];
  if (typeof rentRef === "object" && rentRef) rentRef = rentRef._id || rentRef.id || "";

  rentRef = String(rentRef || "");
  console.log("[rent] normalized rentRef:", rentRef);

  if (!rentRef) return;

  const rentRec = await fetchRecordById("Suite Rent", rentRef);

  console.log("[rent] fetched rentRec:", rentRec);

  if (!rentRec) return;

  const rv = rentRec.values || rentRec || {};
  console.log("[rent] rentRec values:", rv);

  const rentInput  = document.getElementById("suitie-rent");
  const freqSelect = document.getElementById("suitie-rent-frequency");
  const dueInput   = document.getElementById("suitie-rent-due");

  if (rentInput) rentInput.value = rv.Amount != null ? String(rv.Amount) : "";
  if (dueInput)  dueInput.value  = rv["Due Date"] || rv.DueDate || "";

  const raw =
    rv["Perferred Interval"] ||
    rv["Preferred Interval"] ||
    rv["Rent Frequency"] ||
    rv.Interval ||
    rv.frequency ||
    "";

  const norm = normalizeRentFrequency(raw);

  console.log("[rent] freq mapping:", {
    raw,
    norm,
    dropdownOptions: freqSelect ? Array.from(freqSelect.options).map(o => o.value) : null
  });

  if (freqSelect) freqSelect.value = norm || "";
}

function normalizeRentFrequency(raw) {
  const s = String(raw || "").trim().toLowerCase();
  if (!s) return "";

  if (s.includes("bi")) return "biweekly";
  if (s.includes("week")) return "weekly";
  if (s.includes("month")) return "monthly";
  if (s.includes("quart")) return "quarterly";
  if (s.includes("year") || s.includes("annual")) return "yearly";

  const allowed = ["weekly", "biweekly", "monthly", "quarterly", "yearly"];
  return allowed.includes(s) ? s : "";
}

async function saveSuitie(values) {
  if (editingSuitieId) {
    // ✅ EDIT MODE (PATCH)
    const res = await fetch(
      apiUrl(`/api/records/${encodeURIComponent("Suitie")}/${encodeURIComponent(editingSuitieId)}`),
      {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ values }),
      }
    );

    const data = await readJsonSafe(res);
    if (!res.ok) throw new Error(data?.message || "Failed to update suitie.");

    // update local cache
    ALL_SUITIES = ALL_SUITIES.map((r) =>
      String(getId(r)) === String(editingSuitieId) ? data : r
    );

    editingSuitieId = null; // clear edit mode
    renderSuities();
    return data;
  } else {
    // ✅ CREATE MODE (POST)
    const res = await fetch(apiUrl(`/api/records/${encodeURIComponent("Suitie")}`), {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ values }),
    });

    const data = await readJsonSafe(res);
    if (!res.ok) throw new Error(data?.message || "Failed to create suitie.");

    ALL_SUITIES.unshift(data);
    renderSuities();
    return data;
  }
}

function openSuitieCreateMode() {
  editingSuitieId = null;

  const form = document.getElementById("popup-add-suitie-form");
  form?.reset?.();

  const title = document.getElementById("suitie-popup-title");
  if (title) title.textContent = "Add Suitie";

  existingSuitiePhotoUrl = "";
const preview = document.getElementById("suitie-photo-preview");
if (preview) preview.innerHTML = `<span class="muted">No photo selected.</span>`;

const fileInput = document.getElementById("suitie-photo-file");
if (fileInput) fileInput.value = "";

  const saveBtn = document.getElementById("save-suitie-btn");
  if (saveBtn) saveBtn.textContent = "Save Suitie";

  const popup = document.getElementById("popup-add-suitie");
  if (popup) popup.classList.add("is-open");
}

//update Suitie
async function updateRecord(dataTypeName, id, values) {
  const res = await fetch(
    apiUrl(`/api/records/${encodeURIComponent(dataTypeName)}/${encodeURIComponent(id)}`),
    {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ values }),
    }
  );

  const payload = await readJsonSafe(res);
  if (!res.ok) throw new Error(payload?.message || `Failed to update ${dataTypeName}`);

  const rec = unwrapRecord(payload);
  if (!rec) throw new Error(`${dataTypeName} updated but response did not include record`);

  return rec;
}



///////// ================================
/////////////// Delete Suitie 
//// ///================================
//Delete from Card
function initSuitieDelete() {
  const holder = document.getElementById("suities-list");
  if (!holder) return;

  holder.addEventListener("click", async (e) => {
    const delBtn = e.target.closest(".btn-delete-suitie");
    if (!delBtn) return;

    const card = delBtn.closest(".suitie-card");
    const id = card?.dataset?.id;

    if (!id) {
      alert("Couldn’t find this suitie’s id.");
      return;
    }

    const ok = confirm("Delete this suitie? This can’t be undone.");
    if (!ok) return;

    try {
      // ✅ delete from your API
      const res = await fetch(
        apiUrl(`/api/records/${encodeURIComponent("Suitie")}/${encodeURIComponent(id)}`),
        { method: "DELETE", credentials: "include", headers: { Accept: "application/json" } }
      );

      const data = await readJsonSafe(res);
      if (!res.ok) throw new Error(data?.message || "Failed to delete suitie.");

      // ✅ remove locally + re-render so it disappears immediately
      ALL_SUITIES = ALL_SUITIES.filter((r) => String(getId(r)) !== String(id));
      renderSuities();
    } catch (err) {
      console.error(err);
      alert(err?.message || "Failed to delete suitie.");
    }
  });
}

//Delete inside add suitie 
function initSuitieDeleteFromForm() {
  const btn = document.getElementById("suitie-delete-btn");
  if (!btn) return;

  btn.addEventListener("click", async () => {
    if (!editingSuitieId) return; // only valid in edit mode

    const ok = confirm("Delete this suitie? This can’t be undone.");
    if (!ok) return;

    try {
      const res = await fetch(
        apiUrl(`/api/records/${encodeURIComponent("Suitie")}/${encodeURIComponent(editingSuitieId)}`),
        { method: "DELETE", credentials: "include", headers: { Accept: "application/json" } }
      );

      const data = await readJsonSafe(res);
      if (!res.ok) throw new Error(data?.message || "Failed to delete suitie.");

      // remove locally and reset UI
      ALL_SUITIES = ALL_SUITIES.filter((r) => String(getId(r)) !== String(editingSuitieId));
      editingSuitieId = null;
      existingSuitiePhotoUrl = "";

      // hide form / show list
      document.getElementById("suities-form-card")?.setAttribute("hidden", "true");
      const list = document.getElementById("suities-list");
      if (list) list.style.display = "block";

      // show top controls back
      setSuitiesTopControlsHidden(false);
      document.getElementById("suities-subtitle").style.display = "";

      renderSuities();
      alert("Suitie deleted.");
    } catch (err) {
      console.error(err);
      alert(err?.message || "Failed to delete suitie.");
    }
  });
}


// helper: get the visible label of selected option
function getSelectedText(selectId) {
  const sel = document.getElementById(selectId);
  if (!sel) return "";
  const opt = sel.options?.[sel.selectedIndex];
  return opt?.textContent?.trim() || "";
}


//Reset Suities section when clicking outside of tab 
function resetSuitiesUI() {
  // clear edit state
  editingSuitieId = null;
  existingSuitiePhotoUrl = "";

  // hide form, show list
  const formCard = document.getElementById("suities-form-card");
  const list = document.getElementById("suities-list");
  if (formCard) formCard.hidden = true;
  if (list) list.style.display = "block";

  // show top controls again
  setSuitiesTopControlsHidden(false);

  // restore subtitle/filter row (only if you use these IDs)
  document.getElementById("suities-subtitle")?.style && (document.getElementById("suities-subtitle").style.display = "");
  document.getElementById("suities-filter-row")?.style && (document.getElementById("suities-filter-row").style.display = "");

  // reset form fields + photo preview
  document.getElementById("suitie-form")?.reset?.();
  window._clearSuitiePhotoPreview?.();

  // hide delete button in form (only shows in edit mode)
  const delBtn = document.getElementById("suitie-delete-btn");
  if (delBtn) delBtn.style.display = "none";
}









                   // ================================
                         // Invoice Section
                  // ================================
//show all suities in dropdown
async function fetchJSON(url, opts = {}) {
  const res = await fetch(url, { credentials: "include", ...opts });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || data?.message || "Request failed");
  return data;
}

// Try to get current user id from your existing auth endpoint.
// If you already have window.currentUser.userId somewhere, use that instead.
async function getMe() {
  const out = await fetchJSON("/api/auth/me"); // <-- if yours is different, tell me
  // expecting: { ok:true, user:{ userId: "...", ... } } OR similar
  return out?.user || out?.me || out;
}

function pickSuitieLabel(row) {
  const v = row?.values || row || {};
  const first = v["First Name"] || v.firstName || "";
  const last  = v["Last Name"] || v.lastName || "";
  const suite = v["Suite Number/Name"] || v.suiteName || "";
  const email = v["Email"] || v.email || "";

  const name = `${first} ${last}`.trim();
  const left = name || suite || email || "Suitie";
  const right = suite && name ? ` • ${suite}` : (email && left !== email ? ` • ${email}` : "");
  return `${left}${right}`.trim();
}

async function loadInvoiceSuitieDropdown() {
  const select = document.getElementById("invoice-suitie-select");
  const hint = document.getElementById("invoice-suitie-hint");
  if (!select) return;

  // must be logged in
  if (!currentUser?.id) {
    select.innerHTML = `<option value="">Please log in</option>`;
    if (hint) hint.textContent = "";
    return;
  }

  select.innerHTML = `<option value="">Loading suities...</option>`;
  if (hint) hint.textContent = "";

  try {
    const res = await fetch(apiUrl(`/api/records/${encodeURIComponent("Suitie")}?limit=2000`), {
      method: "GET",
      credentials: "include",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });

    const data = await res.json().catch(() => ({}));
    const rows = Array.isArray(data?.items) ? data.items : [];

    // Filter suities where ownerUserId == current user (your universal stamp)
    const mine = rows.filter((r) => {
      const v = r?.values || {};
      const owner = String(v.ownerUserId || "");
      return owner && owner === String(currentUser.id);
    });

    if (!mine.length) {
      select.innerHTML = `<option value="">No suities yet</option>`;
      if (hint) hint.textContent = "Add/accept a suitie first, then you can create an invoice.";
      return;
    }

    select.innerHTML =
      `<option value="">Select a suitie...</option>` +
      mine
        .map((r) => {
          const v = r.values || {};
          const first = v["First Name"] || "";
          const last = v["Last Name"] || "";
          const suite = v["Suite Number/Name"] || "";
          const email = v["Email"] || "";
          const label = `${(first + " " + last).trim() || suite || email || "Suitie"}${suite && (first || last) ? " • " + suite : ""}`;
          return `<option value="${String(r._id)}">${escapeHtml(label)}</option>`;
        })
        .join("");

  } catch (err) {
    console.error("[invoices] loadInvoiceSuitieDropdown failed:", err);
    select.innerHTML = `<option value="">Failed to load suities</option>`;
    if (hint) hint.textContent = "Check console + server logs.";
  }
}

function escapeHtml(str) {
  return String(str || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


///////
function openInvoiceCreatePanel() {
  const panel = document.getElementById("invoice-create-panel");
  const list = document.getElementById("invoices-list");
  if (panel) panel.hidden = false;
  if (list) list.style.display = "none";
}

function closeInvoiceCreatePanel() {
  const panel = document.getElementById("invoice-create-panel");
  const list = document.getElementById("invoices-list");
  if (panel) panel.hidden = true;
  if (list) list.style.display = "";
}

function initInvoicesUI() {
  const addBtn = document.getElementById("add-invoice-btn");
  const cancelBtn = document.getElementById("invoice-cancel-create-btn");
  const suitieSelect = document.getElementById("invoice-suitie-select");
  const totalEl = document.getElementById("invoice-total-display");

  addBtn?.addEventListener("click", () => {
    openInvoiceCreatePanel();
  });

  cancelBtn?.addEventListener("click", () => {
    closeInvoiceCreatePanel();
  });

 
}

//add suite amount when the suitie dropdwon is clicked 
function money(n) {
  const num = Number(n || 0);
  return num.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

function normalizeRef(ref) {
  if (!ref) return "";
  if (Array.isArray(ref)) ref = ref[0];
  if (typeof ref === "object") return String(ref._id || ref.id || "");
  return String(ref);
}
function initInvoiceSuitieRentAutofill() {
  const suitieSelect = document.getElementById("invoice-suitie-select");
  const totalEl = document.getElementById("invoice-total-display");
  const nameEl = document.getElementById("invoice-suitie-name");

  const dueEl = document.getElementById("invoice-due-date"); // ✅ new

  if (!suitieSelect || !totalEl) {
    console.warn("[invoices] missing elements", { suitieSelect, totalEl });
    return;
  }

  if (suitieSelect.dataset.rentBound === "1") return;
  suitieSelect.dataset.rentBound = "1";

  suitieSelect.addEventListener("change", async () => {
    const suitieId = suitieSelect.value || "";

    // reset when nothing selected
    if (!suitieId) {
      if (nameEl) nameEl.textContent = "—";
      if (dueEl) dueEl.textContent = "—";
      totalEl.dataset.overridden = "0";
      totalEl.textContent = formatCurrency(0);
      return;
    }

    const suities = Array.isArray(window.STATE?.suities) ? window.STATE.suities : [];
    const suitie = suities.find((s) => String(s._id || s.id) === String(suitieId));
    const sv = suitie?.values || suitie || {};

    // ✅ Suitie name
    const first = sv["First Name"] || sv.firstName || "";
    const last  = sv["Last Name"] || sv.lastName || "";
    const email = sv["Email"] || sv.email || "";
    const suite = sv["Suite Number/Name"] || sv.suiteName || "";
    const baseName = `${first} ${last}`.trim() || email || "Suitie";
    const displayName = suite ? `${baseName} • ${suite}` : baseName;
    if (nameEl) nameEl.textContent = displayName;

    // ✅ Suite Rent ref
    let rentRef = normalizeRef(sv["Suite Rent"] || sv.SuiteRent);

    // fallback if no rent ref
    if (!rentRef) {
      const direct =
        sv["Suite rent (base)"] ??
        sv["Suite Rent (base)"] ??
        sv["Suite Rent"] ??
        sv["Rent"] ??
        sv.rent ??
        0;

      if (totalEl.dataset.overridden !== "1") {
        totalEl.textContent = formatCurrency(direct);
      }

      // try to show due date if you ever stored it directly on suitie
      const suitieDue = sv["Due Date"] || sv["Next Due Date"] || sv.dueDate || "";
      if (dueEl) dueEl.textContent = formatDueDate(suitieDue);

      return;
    }

    // ✅ fetch Suite Rent record
    const rentRec = await fetchRecordById("Suite Rent", rentRef);
    const rv = rentRec?.values || rentRec || {};

    const amount = Number(rv.Amount || 0);

    // due date can be stored in a few keys — we support multiple
    const dueRaw =
      rv["Next Due Date"] ||
      rv["Due Date"] ||
      rv.DueDate ||
      rv.dueDate ||
      "";

  if (dueEl && dueEl.dataset.overridden !== "1") {
  dueEl.textContent = formatDueDate(dueRaw);
  window.STATE.invoiceDraft = window.STATE.invoiceDraft || {};
  window.STATE.invoiceDraft.dueDateYmd = dueRaw ? String(dueRaw).slice(0,10) : "";
}

    if (totalEl.dataset.overridden !== "1") {
      totalEl.textContent = formatCurrency(amount);
    }
  });
}



function getSuitieRent(suitie) {
  // because your records sometimes are {values:{...}} or flat
  const v = (suitie && (suitie.values || suitie)) || {};

  // ✅ check a few likely keys — add yours if different
  const rent =
    v.rent ??
    v.suiteRent ??
    v.rentAmount ??
    v["Suite rent (base)"] ??
    0;

  return Number(rent || 0);
}

//allow changes to suite rent 
function parseCurrency(text) {
  // Keep digits + dot only
  const cleaned = String(text || "").replace(/[^0-9.]/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function formatCurrency(n) {
  const num = Number(n);
  const safe = Number.isFinite(num) ? num : 0;
  return safe.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

function initEditableInvoiceAmount() {
  const totalEl = document.getElementById("invoice-total-display");
  if (!totalEl) return;

   enforceNumericCurrencyEditing(totalEl);
  // ✅ When they click, make it easy to type (remove $ and commas temporarily)
  totalEl.addEventListener("focus", () => {
    const val = parseCurrency(totalEl.textContent);
    totalEl.textContent = String(val || 0); // plain number while editing
    placeCaretAtEnd(totalEl);
  });

  // ✅ Live typing: optional (you can remove if you only want blur formatting)
  totalEl.addEventListener("input", () => {
    totalEl.dataset.overridden = "1"; // user manually changed it
  });

  // ✅ When they leave the field, re-format to $X,XXX.XX
  totalEl.addEventListener("blur", () => {
    const val = parseCurrency(totalEl.textContent);
    totalEl.textContent = formatCurrency(val);
  });

  // ✅ Press Enter = done (prevents new line)
  totalEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      totalEl.blur();
    }
  });
}

// caret helper
function placeCaretAtEnd(el) {
  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(false);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
}

//helper to only add numbers
function enforceNumericCurrencyEditing(el) {
  if (!el) return;

  // Block non-numeric keys (allow navigation + shortcuts)
  el.addEventListener("keydown", (e) => {
    const allowedKeys = new Set([
      "Backspace", "Delete", "Tab", "Escape", "Enter",
      "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown",
      "Home", "End"
    ]);

    // allow copy/paste/select all
    if (e.ctrlKey || e.metaKey) return;

    if (allowedKeys.has(e.key)) {
      if (e.key === "Enter") e.preventDefault(); // no new line
      return;
    }

    const isDigit = /^[0-9]$/.test(e.key);
    const isDot = e.key === ".";

    if (isDigit) return;

    // only allow ONE decimal point
    if (isDot) {
      const txt = el.textContent || "";
      if (txt.includes(".")) e.preventDefault();
      return;
    }

    // block everything else
    e.preventDefault();
  });

  // Clean pasted content
  el.addEventListener("paste", (e) => {
    e.preventDefault();
    const text = (e.clipboardData || window.clipboardData).getData("text") || "";
    const cleaned = text.replace(/[^0-9.]/g, "");

    // keep only first dot
    const parts = cleaned.split(".");
    const safe = parts.length <= 1 ? cleaned : `${parts[0]}.${parts.slice(1).join("")}`;

    document.execCommand("insertText", false, safe);
  });

  // Final cleanup if something slips through
  el.addEventListener("input", () => {
    let t = el.textContent || "";
    t = t.replace(/[^0-9.]/g, "");

    // keep only first dot
    const parts = t.split(".");
    t = parts.length <= 1 ? t : `${parts[0]}.${parts.slice(1).join("")}`;

    if (el.textContent !== t) el.textContent = t;
  });
}

//Payment Schedule 
function formatDueDate(dateStr) {
  if (!dateStr) return "—";
  // supports "YYYY-MM-DD" or ISO
  const d = new Date(dateStr.includes("T") ? dateStr : `${dateStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}


//Add Due Date 
function initInvoiceDueDatePicker() {
  const btn = document.getElementById("invoice-due-date-btn");
  const input = document.getElementById("invoice-due-date-input");
  const dueEl = document.getElementById("invoice-due-date");
  if (!btn || !input || !dueEl) return;

  // If you want to remember it for saving later:
  window.STATE = window.STATE || {};
  window.STATE.invoiceDraft = window.STATE.invoiceDraft || {};

  // Open calendar when icon clicked
  btn.addEventListener("click", () => {
    // set the input value to current shown date (if we have a stored ymd)
    const currentYmd = window.STATE.invoiceDraft.dueDateYmd || "";
    if (currentYmd) input.value = currentYmd;

    // open the native date picker
    if (typeof input.showPicker === "function") input.showPicker();
    else input.click();
  });

  // When a date is picked, update the display
  input.addEventListener("change", () => {
    const ymd = input.value; // "YYYY-MM-DD"
    if (!ymd) return;

    // store draft value so autofill won’t overwrite it
    window.STATE.invoiceDraft.dueDateYmd = ymd;
    dueEl.dataset.overridden = "1";

    // display nice formatted date
    dueEl.textContent = formatDueDate(ymd);

    console.log("[invoice] due date set:", ymd);
  });
}












//Save Invoice 
async function handleCreateInvoiceSubmit() {
  // ✅ THIS is where it goes:
  const amount = parseCurrency(
    document.getElementById("invoice-total-display")?.textContent
  );

  // now use amount in your invoice record
  console.log("[invoice] amount to save:", amount);

  // example payload:
  // await createRecord("Invoice", { Amount: amount, Suitie: suitieId, ... })
}

//Create Invoice 
async function createInvoiceFromUI() {
  const suitieId = document.getElementById("invoice-suitie-select")?.value || "";
  const amount = parseCurrency(document.getElementById("invoice-total-display")?.textContent);
  const dueDate = window.STATE?.invoiceDraft?.dueDateYmd || "";

  const res = await fetch(apiUrl("/api/invoices"), {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ suitieId, amount, dueDate }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) throw new Error(data.message || "Failed to create invoice");

  console.log("[invoice] created:", data.item);
  console.log("[invoice] pay link:", data.payUrl);

  // you can show the link in your UI for now
  return data;
}




















// ================================
// Boot after login
// ================================
async function bootAppAfterLogin() {
  console.log("[suite-settings2] bootAppAfterLogin");

  // ✅ Ensure currentUser is actually set
  if (!currentUser?.id) {
    currentUser = await getSignedInUser();
    console.log("[suite-settings2] currentUser:", currentUser);
  }

  if (!currentUser?.id) {
    console.warn("[suite-settings2] still no currentUser after login check");
    lockApp(true);
    return;
  }

  lockApp(false);

  // ✅ now safe to load data
  await loadLocations();
}
// ================================
// ONE DOMContentLoaded (in order)
// ================================
document.addEventListener("DOMContentLoaded", async () => {
  initAuthUI();
  initSidebarCollapse();
  initTabSwitching();

  initLocationsUI();
  initLocationSave();
initMainPhotoPreview();
initGalleryPreview();

await loadLocations();

initLocationDetailsUI();
initLocationEditButton();
initLocationDeleteButton();
initLocationStyleModal();
initLocationAddSuiteButton();
initSuiteMainPhotoPreview();
initSuiteGalleryPreview();
initSuiteSave();
initSuiteDetailsUI();
initSuiteDetailsBackButtons();
initSuiteDeleteButton();

 
initSuiteAppBuilderCloseButtons();
initSuiteAppBuilder();
initSuiteTemplatePreviewModal();

initSuitiesLocationFilter();
initSuitiesAddButton();
initSuitieLocationSelect();
initSuitiePhotoPreview();
initSuitieSave();
initSuitieSuiteAutoFill();

  initSuitieEdit();
initSuitieDeleteFromForm();

initSuitesLocationFilter();

  initDashboardCardNav();
initNavLocationGuard();
loadInvoiceSuitieDropdown()
initInvoicesUI();
initInvoiceSuitieRentAutofill();
initEditableInvoiceAmount();
initInvoiceDueDatePicker();





  currentUser = await getSignedInUser();
  console.log("[suite-settings2] currentUser:", currentUser);

  setLoggedInUI(currentUser);




  if (!currentUser?.id) {
    lockApp(true);
    const modal = document.getElementById("authModal");
    if (modal) {
      modal.hidden = false;
      modal.setAttribute("aria-hidden", "false");
    }
    return;
  }

  lockApp(false);
  await bootAppAfterLogin();
  await initSuitiesSection();

  await loadSuities();
updateDashboardCounts();
});
