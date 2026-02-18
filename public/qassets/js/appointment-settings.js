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

  // reset dropdown
  dd.innerHTML = `<option value="">-- Choose Business --</option>`;

  const rendered = [];

  (items || []).forEach((row) => {
    const v = row?.values || row || {};
    const id = String(row?._id || row?.id || v?._id || "").trim();
    if (!id) return;

    // ✅ prefer your helper if it exists, fallback to common name fields
    let name = "";
    try {
      name = typeof getBusinessName === "function" ? getBusinessName(row) : "";
    } catch {}

    if (!name || !String(name).trim()) {
      name =
        String(v?.Name || "").trim() ||
        String(v?.["Business Name"] || "").trim() ||
        String(v?.businessName || "").trim() ||
        String(v?.title || "").trim() ||
        "Business";
    }

    const opt = document.createElement("option");
    opt.value = id;
    opt.textContent = name;
    dd.appendChild(opt);

    rendered.push({ id, name });
  });

  // ✅ preselect last edited business if it exists
  const lastId = localStorage.getItem("lastBusinessId");
  if (lastId && dd.querySelector(`option[value="${lastId}"]`)) {
    dd.value = lastId;
    dd.dispatchEvent(new Event("change")); // triggers calendars/categories/services loaders
  }

  // ✅ log what’s actually in the dropdown now
  console.log("[dropdown] options rendered:", rendered);
  console.log("[dropdown] business names:", rendered.map((x) => x.name));
}


async function loadMyBusinesses() {
  const path = `/api/records/Business?limit=200`;

  const { res, data } = await apiJSON(path, { method: "GET" });
  console.log("[business] RAW response from", path, "status:", res.status, data);

  if (!res.ok) {
    console.warn("[business] load failed", res.status, data);
    MY_BUSINESSES = [];
    renderBusinessDropdown([]);
    renderBusinessSection([]);
    renderCalendarBusinessDropdown([]);
    return [];
  }

  const items = normalizeItems(data);

  // ✅ cache globally
  MY_BUSINESSES = items;
if (!items.length) {
  lockAppUntilBusinessCreated();
} else {
  unlockAppAfterBusinessCreated();
}

  console.log("[business] items count:", items.length);
  console.log("[business] names:", items.map(getBusinessName));

  // ✅ render ONCE
  renderBusinessDropdown(items);
  renderBusinessSection(items);
  renderCalendarBusinessDropdown(items);
renderCategoryBusinessDropdown(items); 

  return items;
}


function wireBusinessDropdownUI() {
  const dd = document.getElementById("business-dropdown");
  if (!dd) return;

  dd.addEventListener("change", async (e) => {
    const selectedId = String(e.target.value || "").trim();
    SELECTED_BUSINESS_ID = selectedId;

    const selectedText = dd?.options?.[dd.selectedIndex]?.textContent || "";
    const title = document.getElementById("selected-business-name");
    if (title) title.textContent = selectedText ? selectedText : "Choose business to manage";

    // ✅ whenever business changes, reload calendars for that business
    await loadCalendarsForSelectedBusiness();
    await loadCategoriesForSelectedBusiness();      // uses CALENDAR_CACHE + filters categories
    await loadServicesForSelectedBusiness(); 
  
  });
}
//Image Helper 
function normalizeImageUrl(raw) {
  const s = String(raw || "").trim();
  if (!s) return "";

  // already absolute (Cloudinary, etc.)
  if (s.startsWith("http://") || s.startsWith("https://")) return s;

  // "/uploads/xyz.png" -> "https://api.suiteseat.io/uploads/xyz.png"
  if (s.startsWith("/uploads/")) return `${API_BASE}${s}`;

  // "uploads/xyz.png" -> "https://api.suiteseat.io/uploads/xyz.png"
  if (s.startsWith("uploads/")) return `${API_BASE}/${s}`;

  // bare filename "xyz.png" -> "https://api.suiteseat.io/uploads/xyz.png"
  if (/\.(png|jpg|jpeg|webp|gif)$/i.test(s)) return `${API_BASE}/uploads/${s}`;

  // fallback
  return s;
}


/////////////////////////////////////////////////
                 // Calendar Section 
/////////////////////////////////////////////////
//helper
function getCalendarBusinessId(row) {
  const v = row?.values || row || {};
  if (!v || typeof v !== "object") return "";

  // Try the most common names first
  const candidates = ["Business", "business", "businessId", "Business Id", "Parent Business"];

  for (const key of candidates) {
    if (!(key in v)) continue;
    const raw = v[key];

    if (typeof raw === "string") return raw.trim();
    if (raw && typeof raw === "object") {
      const id = raw._id || raw.id;
      if (id) return String(id).trim();
    }
    if (Array.isArray(raw) && raw.length) {
      const first = raw[0];
      if (typeof first === "string") return first.trim();
      if (first && typeof first === "object") {
        const id = first._id || first.id;
        if (id) return String(id).trim();
      }
    }
  }

  // If your field is named something else, detect any key containing "business"
  const autoKey = Object.keys(v).find((k) => k.toLowerCase().includes("business"));
  if (autoKey) {
    const raw = v[autoKey];
    if (typeof raw === "string") return raw.trim();
    if (raw && typeof raw === "object") {
      const id = raw._id || raw.id;
      if (id) return String(id).trim();
    }
  }

  return "";
}



async function loadCalendarsForSelectedBusiness() {
  const businessId = String(SELECTED_BUSINESS_ID || "").trim();

  if (!businessId) {
    renderCalendarSection([]);
    return [];
  }

  // ✅ pull all calendars (for this user/session) then filter client-side
  const path = `/api/records/Calendar?limit=200`;
  const { res, data } = await apiJSON(path, { method: "GET" });

  console.log("[calendar] RAW response from", path, "status:", res.status, data);

  if (!res.ok) {
    renderCalendarSection([]);
    return [];
  }

  const items = normalizeItems(data);

  // 🔍 debug: see what keys exist in values
  if (items[0]?.values) {
    console.log("[calendar] sample keys:", Object.keys(items[0].values));
    console.log("[calendar] sample businessId:", getCalendarBusinessId(items[0]));
  }

  const filtered = items.filter((row) => getCalendarBusinessId(row) === businessId);

  console.log("[calendar-section] filtered count:", filtered.length);

  CALENDAR_CACHE = filtered;
  renderCalendarSection(filtered);
  return filtered;
}

function getCalendarName(row) {
  const v = row?.values || row || {};
  return (
    (typeof v["Name"] === "string" && v["Name"].trim()) ||
    (typeof v["Calendar Name"] === "string" && v["Calendar Name"].trim()) ||
    (typeof v.name === "string" && v.name.trim()) ||
    "(Untitled)"
  );
}

function renderCalendarSection(items) {
  const nameCol = document.getElementById("calendar-name-column");
  const defCol  = document.getElementById("calendar-default-column");
  if (!nameCol || !defCol) return;

  nameCol.innerHTML = "";
  defCol.innerHTML = "";

  if (!items || !items.length) {
    nameCol.innerHTML = `<div class="business-result">(no calendars yet)</div>`;
    defCol.innerHTML  = `<div class="business-result">—</div>`;
    return;
  }

  // newest first (optional)
  const rows = [...items].sort((a, b) => {
    const ad = new Date(a?.createdAt || a?.updatedAt || 0).getTime();
    const bd = new Date(b?.createdAt || b?.updatedAt || 0).getTime();
    return bd - ad;
  });

  rows.forEach((row) => {
    const v = row?.values || row || {};
    const id = String(row?._id || row?.id || "").trim();
    if (!id) return;

    const name = getCalendarName(row);

    // "Default" field could be: v["Default"] or v["isDefault"] etc.
    const isDefault =
      Boolean(v?.["Default"]) ||
      Boolean(v?.isDefault) ||
      Boolean(v?.["Is Default"]);

    // Name cell (click later for edit mode)
    const nameDiv = document.createElement("div");
    nameDiv.className = "business-result clickable-item";
    nameDiv.textContent = name;
    nameDiv.dataset.id = id;

nameDiv.addEventListener("click", () => {
  renderCalendarBusinessDropdown(MY_BUSINESSES); // build options FIRST
  openAddCalendarPopup();                        // show popup
  setCalendarPopupEditMode(row);                 // fill + select business LAST
});


    // Default cell (simple indicator for now)
    const defDiv = document.createElement("div");
    defDiv.className = "business-result";
    defDiv.textContent = isDefault ? "✓" : "";

    nameCol.appendChild(nameDiv);
    defCol.appendChild(defDiv);
  });

  console.log("[calendar-section] rendered calendars:", rows.map(getCalendarName));
}

//Open Add Calendar Popup
function openAddCalendarPopup() {
  const popup = document.getElementById("popup-add-calendar");
  const overlay = document.getElementById("popup-overlay"); // reuse same overlay

    // ✅ make sure it has the latest businesses
  renderCalendarBusinessDropdown(MY_BUSINESSES);

  if (popup) popup.style.display = "block";
  if (overlay) overlay.style.display = "block";
}

function closeAddCalendarPopup() {
  const popup = document.getElementById("popup-add-calendar");
  const overlay = document.getElementById("popup-overlay");

  if (popup) popup.style.display = "none";
  if (overlay) overlay.style.display = "none";
}


document
  .getElementById("close-add-calendar-popup-btn")
  ?.addEventListener("click", closeAddCalendarPopup);

//load dropdown in popup
function renderCalendarBusinessDropdown(items) {
  const dd = document.getElementById("dropdown-calendar-business");
  if (!dd) return;

  dd.innerHTML = `<option value="">-- Select --</option>`;

  const rendered = [];

  (items || []).forEach((row) => {
    const v = row?.values || row || {};
    const id = String(row?._id || row?.id || v?._id || "").trim();
    if (!id) return;

    const name = typeof getBusinessName === "function" ? getBusinessName(row) : (v.Name || "Business");

    const opt = document.createElement("option");
    opt.value = id;
    opt.textContent = name;
    dd.appendChild(opt);

    rendered.push({ id, name });
  });

  console.log("[calendar-dd] options rendered:", rendered);
  console.log("[calendar-dd] business names:", rendered.map(x => x.name));
}


/////////////////////////////////////////////////
//  Save Calendar
/////////////////////////////////////////////////
// ------------------------------
// Calendar: create record
// ------------------------------
async function createCalendarRecord({ businessId }) {
  const name = document.getElementById("popup-calendar-name-input")?.value?.trim();
  if (!businessId) throw new Error("Please choose a business.");
  if (!name) throw new Error("Calendar name is required.");

  // IMPORTANT: these keys must match your Calendar DataType field names exactly.
  // Most likely you have: "Name" and "Business" as a Reference → Business
  const values = {
    "Name": name,
    "Business": businessId, // reference field to Business
  };

  const { res, data } = await apiJSON("/api/records/Calendar", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ values }),
  });

  console.log("[calendar] POST /api/records/Calendar", res.status, data);

  if (!res.ok) throw new Error(data?.message || data?.error || "Failed to save calendar");

  const created =
    (Array.isArray(data?.items) && data.items[0]) ||
    data?.item ||
    data;

  const createdId = created?._id || created?.id;
  if (!createdId) throw new Error("Calendar saved but missing id");

  if (!created._id) created._id = createdId;
  return created;
}

// ------------------------------
// Calendar: wire Save button
// ------------------------------
function initCalendarSave() {
  const btn = document.getElementById("save-calendar-button");
  if (!btn) return;

  btn.addEventListener("click", async (e) => {
    e.preventDefault();

    try {
      // must be logged in
      const auth = await initHeaderAuth();
      if (!auth.loggedIn) {
        alert("Please log in first.");
        return;
      }

      const businessId = document.getElementById("dropdown-calendar-business")?.value?.trim();
      const created = await createCalendarRecord({ businessId });

      alert("Calendar saved!");
      closeAddCalendarPopup();

      // ✅ IMPORTANT: sync the main dropdown to the business selected in the calendar popup
      const mainDD = document.getElementById("business-dropdown");
      if (mainDD && businessId) {
        mainDD.value = businessId;
        mainDD.dispatchEvent(new Event("change")); // triggers your handler + reloadCalendars
      } else {
        // fallback if dropdown not found for some reason
        SELECTED_BUSINESS_ID = businessId || "";
        await loadCalendarsForSelectedBusiness();
      }

      console.log("[calendar] created:", created);
    } catch (err) {
      console.error("[calendar] save failed", err);
      alert(err?.message || "Calendar save failed");
    }
  });
}

/////////////////////////////////////////////////
//  Update Calendar
/////////////////////////////////////////////////
let CURRENT_CALENDAR = null;
let CURRENT_CALENDAR_ID = null;

function setCalendarPopupCreateMode() {
  CURRENT_CALENDAR = null;
  CURRENT_CALENDAR_ID = null;

  // clear inputs
  const nameEl = document.getElementById("popup-calendar-name-input");
  if (nameEl) nameEl.value = "";

  // default business dropdown in popup = currently selected business (nice UX)
  const bizDD = document.getElementById("dropdown-calendar-business");
  if (bizDD && SELECTED_BUSINESS_ID) bizDD.value = SELECTED_BUSINESS_ID;

  // buttons
  document.getElementById("save-calendar-button")?.style.setProperty("display", "inline-block");
  document.getElementById("update-calendar-button")?.style.setProperty("display", "none");
  document.getElementById("delete-calendar-button")?.style.setProperty("display", "none");
}

function setCalendarPopupEditMode(calendarRow) {
  const row = calendarRow || {};
  const v = row?.values || row || {};

  CURRENT_CALENDAR = row;
  CURRENT_CALENDAR_ID = String(row?._id || row?.id || "").trim();

  // Fill calendar name
  const nameEl = document.getElementById("popup-calendar-name-input");
  if (nameEl) nameEl.value = String(v["Name"] || v["Calendar Name"] || "").trim();

  // ✅ Use your helper so it works no matter how "Business" is stored
  const businessId = String(getCalendarBusinessId(row) || "").trim();

  // ✅ Select it in dropdown (assumes options were rendered already)
  const bizDD = document.getElementById("dropdown-calendar-business");
  if (bizDD) bizDD.value = businessId || "";

  // Buttons (edit mode)
  document
    .getElementById("save-calendar-button")
    ?.style.setProperty("display", "none");
  document
    .getElementById("update-calendar-button")
    ?.style.setProperty("display", "inline-block");
  document
    .getElementById("delete-calendar-button")
    ?.style.setProperty("display", "inline-block");
}


document.getElementById("open-calendar-button")?.addEventListener("click", () => {
  renderCalendarBusinessDropdown(MY_BUSINESSES);
  setCalendarPopupCreateMode();
  openAddCalendarPopup();
});

async function updateCalendarRecord() {
  if (!CURRENT_CALENDAR_ID) throw new Error("No calendar selected.");

  const businessId = document.getElementById("dropdown-calendar-business")?.value?.trim();
  const name = document.getElementById("popup-calendar-name-input")?.value?.trim();

  if (!businessId) throw new Error("Choose a business.");
  if (!name) throw new Error("Calendar name is required.");

  const values = { Name: name, Business: businessId };

  const { res, data } = await apiJSON(`/api/records/Calendar/${encodeURIComponent(CURRENT_CALENDAR_ID)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ values }),
  });

  console.log("[calendar] PATCH", res.status, data);
  if (!res.ok) throw new Error(data?.message || data?.error || "Update failed");
}

document.getElementById("update-calendar-button")?.addEventListener("click", async () => {
  try {
    await updateCalendarRecord();
    closeAddCalendarPopup();

    // refresh list for selected business
    await loadCalendarsForSelectedBusiness();
  } catch (e) {
    console.error(e);
    alert(e?.message || "Update failed");
  }
});


/////////////////////////////////////////////////
//  Delete Calendar
/////////////////////////////////////////////////
document.getElementById("delete-calendar-button")?.addEventListener("click", async () => {
  try {
    if (!CURRENT_CALENDAR_ID) return;
    if (!confirm("Delete this calendar?")) return;

    const { res, data } = await apiJSON(`/api/records/Calendar/${encodeURIComponent(CURRENT_CALENDAR_ID)}`, {
      method: "DELETE",
    });

    console.log("[calendar] DELETE", res.status, data);
    if (!res.ok) throw new Error(data?.message || data?.error || "Delete failed");

    closeAddCalendarPopup();
    setCalendarPopupCreateMode();
    await loadCalendarsForSelectedBusiness();
  } catch (e) {
    console.error(e);
    alert(e?.message || "Delete failed");
  }
});


              /////////////////////////////////////////////////
                   // Category Section
             /////////////////////////////////////////////////  

//////////////////////////
//  Fill Category Section  
//////////////////////////
function getCategoryName(row) {
  const v = row?.values || row || {};
  return (
    String(v["Name"] || "").trim() ||
    String(v["Category Name"] || "").trim() ||
    String(v.name || "").trim() ||
    "(Untitled)"
  );
}

function getCategoryBusinessId(row) {
  const v = row?.values || row || {};
  const raw = v["Business"] ?? v.business ?? v.businessId ?? v["Business Id"];

  if (typeof raw === "string") return raw.trim();
  if (raw && typeof raw === "object") return String(raw._id || raw.id || "").trim();
  if (Array.isArray(raw) && raw.length) {
    const first = raw[0];
    if (typeof first === "string") return first.trim();
    if (first && typeof first === "object") return String(first._id || first.id || "").trim();
  }
  return "";
}

function getCategoryCalendarId(row) {
  const v = row?.values || row || {};
  const raw = v["Calendar"] ?? v.calendar ?? v.calendarId ?? v["Calendar Id"];

  if (typeof raw === "string") return raw.trim();
  if (raw && typeof raw === "object") return String(raw._id || raw.id || "").trim();
  if (Array.isArray(raw) && raw.length) {
    const first = raw[0];
    if (typeof first === "string") return first.trim();
    if (first && typeof first === "object") return String(first._id || first.id || "").trim();
  }
  return "";
}
function renderCategoryCalendarFilterDropdown(calendars) {
  const wrap = document.getElementById("calendar-dropdown-wrapper");
  const dd = document.getElementById("category-calendar-dropdown");
  if (!wrap || !dd) return;

  dd.innerHTML = `<option value="">-- Choose a Calendar --</option>`;

  (calendars || []).forEach((row) => {
    const v = row?.values || row || {};
    const id = String(row?._id || row?.id || "").trim();
    if (!id) return;

    const name = String(v["Name"] || v["Calendar Name"] || v.name || "").trim() || "(Untitled)";

    const opt = document.createElement("option");
    opt.value = id;
    opt.textContent = name;
    dd.appendChild(opt);
  });

  // show only if there are calendars for this business
  wrap.style.display = calendars && calendars.length ? "block" : "none";
}

let CATEGORY_CACHE = [];

async function loadCategoriesForSelectedBusiness() {
  const businessId = String(SELECTED_BUSINESS_ID || "").trim();

  if (!businessId) {
    CATEGORY_CACHE = [];
    renderCategorySection([]);
    renderCategoryCalendarFilterDropdown([]);
    return [];
  }

  const path = `/api/records/Category?limit=500`;
  const { res, data } = await apiJSON(path, { method: "GET" });
  console.log("[category] RAW response", res.status, data);

  if (!res.ok) {
    CATEGORY_CACHE = [];
    renderCategorySection([]);
    renderCategoryCalendarFilterDropdown([]);
    return [];
  }

  const items = normalizeItems(data);

  // ✅ filter to selected business
  const byBiz = items.filter((row) => getCategoryBusinessId(row) === businessId);
  CATEGORY_CACHE = byBiz;

  // ✅ preserve currently selected calendar before re-rendering dropdown
  const calDD = document.getElementById("category-calendar-dropdown");
  const prevSelected = String(calDD?.value || "").trim();

  // ✅ Fill calendar filter dropdown using business calendars
  renderCategoryCalendarFilterDropdown(CALENDAR_CACHE);

  // ✅ restore selection if still present
  if (prevSelected) {
    const stillExists = document.querySelector(
      `#category-calendar-dropdown option[value="${prevSelected}"]`
    );
    if (stillExists) document.getElementById("category-calendar-dropdown").value = prevSelected;
  }

  // ✅ now apply calendar filter
  const selectedCalId = String(document.getElementById("category-calendar-dropdown")?.value || "").trim();

  const finalRows = selectedCalId
    ? byBiz.filter((row) => getCategoryCalendarId(row) === selectedCalId)
    : byBiz;

  renderCategorySection(finalRows);
  return finalRows;
}

function renderCategorySection(items) {
  const nameCol = document.getElementById("category-name-column");
  const calCol = document.getElementById("category-calendar-column");
  if (!nameCol || !calCol) return;

  nameCol.innerHTML = "";
  calCol.innerHTML = "";

  if (!items || !items.length) {
    nameCol.innerHTML = `<div class="business-result">(no categories yet)</div>`;
    calCol.innerHTML = `<div class="business-result">—</div>`;
    return;
  }

  // quick map calendarId -> calendarName (so we can display it)
  const calNameById = new Map(
    (CALENDAR_CACHE || []).map((c) => {
      const v = c?.values || c || {};
      const id = String(c?._id || c?.id || "").trim();
      const name = String(v["Name"] || v["Calendar Name"] || v.name || "").trim() || "(Untitled)";
      return [id, name];
    })
  );

  const rows = [...items].sort((a, b) => {
    const ad = new Date(a?.createdAt || a?.updatedAt || 0).getTime();
    const bd = new Date(b?.createdAt || b?.updatedAt || 0).getTime();
    return bd - ad;
  });

  rows.forEach((row) => {
    const id = String(row?._id || row?.id || "").trim();
    if (!id) return;

    const catName = getCategoryName(row);
    const calId = getCategoryCalendarId(row);
    const calName = calNameById.get(calId) || "—";

    const nameDiv = document.createElement("div");
    nameDiv.className = "business-result clickable-item";
    nameDiv.textContent = catName;
    nameDiv.dataset.id = id;

nameDiv.addEventListener("click", async () => {
  renderCategoryBusinessDropdown(MY_BUSINESSES);
  openCategoryPopup();
  await setCategoryPopupEditMode(row);
});


    const calDiv = document.createElement("div");
    calDiv.className = "business-result";
    calDiv.textContent = calName;

    nameCol.appendChild(nameDiv);
    calCol.appendChild(calDiv);
  });

  console.log("[category-section] rendered:", rows.map(getCategoryName));
}

 //Open Add Category Section             
function openCategoryPopup() {
  const popup = document.getElementById("popup-add-category");
  const overlay = document.getElementById("popup-overlay");

  if (popup) popup.style.display = "block";
  if (overlay) overlay.style.display = "block";
}

function closeCategoryPopup() {
  const popup = document.getElementById("popup-add-category");
  const overlay = document.getElementById("popup-overlay");

  if (popup) popup.style.display = "none";
  if (overlay) overlay.style.display = "none";
}


/////////////////////////////////////////////////
//  Fill Business Dropdown  
/////////////////////////////////////////////////
function renderCategoryBusinessDropdown(items) {
  const dd = document.getElementById("dropdown-category-business");
  if (!dd) return;

  dd.innerHTML = `<option value="">-- Select --</option>`;

  (items || []).forEach((row) => {
    const v = row?.values || row || {};
    const id = String(row?._id || row?.id || v?._id || "").trim();
    if (!id) return;

    const name =
      (typeof getBusinessName === "function" ? getBusinessName(row) : "") ||
      String(v?.Name || v?.["Business Name"] || v?.businessName || "Business").trim();

    const opt = document.createElement("option");
    opt.value = id;
    opt.textContent = name;
    dd.appendChild(opt);
  });
}

/////////////////////////////////////////////////
//  Fill Calendar Dropdown  
/////////////////////////////////////////////////
function renderCategoryCalendarDropdown(calendars) {
  const dd = document.getElementById("dropdown-business-calendar");
  if (!dd) return;

  dd.innerHTML = `<option value="">-- Select --</option>`;

  (calendars || []).forEach((row) => {
    const v = row?.values || row || {};
    const id = String(row?._id || row?.id || "").trim();
    if (!id) return;

    const name =
      String(v["Name"] || v["Calendar Name"] || v.name || "").trim() || "(Untitled)";

    const opt = document.createElement("option");
    opt.value = id;
    opt.textContent = name;
    dd.appendChild(opt);
  });

  // ✅ enable only if we have calendars
  dd.disabled = !(calendars && calendars.length > 0);
}


async function loadCalendarsForBusiness(businessId) {
  const id = String(businessId || "").trim();
  if (!id) return [];

  // ✅ Load all then filter (same pattern as your calendar section)
  const path = `/api/records/Calendar?limit=200`;
  const { res, data } = await apiJSON(path, { method: "GET" });

  console.log("[category-popup] calendars RAW", res.status, data);

  if (!res.ok) return [];

  const items = normalizeItems(data);

  // ✅ Use your helper so it works for string/object/array ref shapes
  const filtered = items.filter((row) => String(getCalendarBusinessId(row) || "").trim() === id);

  console.log("[category-popup] filtered calendars count:", filtered.length);

  return filtered;
}

function wireCategoryPopupDropdowns() {
  const bizDD = document.getElementById("dropdown-category-business");
  const calDD = document.getElementById("dropdown-business-calendar");
  if (!bizDD || !calDD) return;

  renderCategoryCalendarDropdown([]); // starts disabled

  bizDD.addEventListener("change", async () => {
    const businessId = bizDD.value.trim();

    renderCategoryCalendarDropdown([]); // clear + disable

    if (!businessId) return;

    const calendars = await loadCalendarsForBusiness(businessId);
    renderCategoryCalendarDropdown(calendars); // fills + enables if any
  });
}

/////////////////////////////////////////////////
// Save Category  
/////////////////////////////////////////////////
async function createCategoryRecord({ businessId, calendarId }) {
  const name = document.getElementById("popup-category-name-input")?.value?.trim();

  if (!businessId) throw new Error("Please choose a business.");
  if (!calendarId) throw new Error("Please choose a calendar.");
  if (!name) throw new Error("Category name is required.");

  // ⚠️ These keys must match your Category DataType field names EXACTLY
  // Most likely:
  //   Name (text)
  //   Business (ref -> Business)
  //   Calendar (ref -> Calendar)
  const values = {
    "Name": name,
    "Business": businessId,
    "Calendar": calendarId,
  };

  const { res, data } = await apiJSON("/api/records/Category", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ values }),
  });

  console.log("[category] POST /api/records/Category", res.status, data);

  if (!res.ok) throw new Error(data?.message || data?.error || "Failed to save category");

  const created =
    (Array.isArray(data?.items) && data.items[0]) ||
    data?.item ||
    data;

  const createdId = created?._id || created?.id;
  if (!createdId) throw new Error("Category saved but missing id");

  if (!created._id) created._id = createdId;
  return created;
}

function initCategorySave() {
  const btn = document.getElementById("save-category-button");
  if (!btn) return;

  btn.addEventListener("click", async (e) => {
    e.preventDefault();

    try {
      // must be logged in
      const auth = await initHeaderAuth();
      if (!auth.loggedIn) {
        alert("Please log in first.");
        return;
      }

      const businessId = document.getElementById("dropdown-category-business")?.value?.trim();
      const calendarId = document.getElementById("dropdown-business-calendar")?.value?.trim();

      const created = await createCategoryRecord({ businessId, calendarId });
alert("Category saved!");
closeCategoryPopup();

// ✅ just sync dropdown ONCE (this will trigger loadCategories...)
const mainDD = document.getElementById("business-dropdown");
if (mainDD && businessId) {
  mainDD.value = businessId;
  mainDD.dispatchEvent(new Event("change"));
} else {
  SELECTED_BUSINESS_ID = businessId || "";
  await loadCategoriesForSelectedBusiness();
}

 

      console.log("[category] created:", created);

      // If you already have a loadCategoriesForSelectedBusiness(), call it here:
      // await loadCategoriesForSelectedBusiness();

    } catch (err) {
      console.error("[category] save failed", err);
      alert(err?.message || "Category save failed");
    }
  });
}

/////////////////////////////////////////////////
// Open Category in Edit Mode  
/////////////////////////////////////////////////
let CURRENT_CATEGORY = null;
let CURRENT_CATEGORY_ID = null;

// handles string id OR object OR array (because you have Allow multiple)
function firstRefId(raw) {
  if (!raw) return "";
  if (typeof raw === "string") return raw.trim();
  if (Array.isArray(raw) && raw.length) return firstRefId(raw[0]);
  if (typeof raw === "object") return String(raw._id || raw.id || "").trim();
  return "";
}

function getCategoryBusinessId(row) {
  const v = row?.values || row || {};
  return firstRefId(v["Business"] ?? v.business ?? v.businessId);
}

function getCategoryCalendarId(row) {
  const v = row?.values || row || {};
  return firstRefId(v["Calendar"] ?? v.calendar ?? v.calendarId);
}

function getCategoryName(row) {
  const v = row?.values || row || {};
  return String(v["Name"] || v["Category Name"] || v.name || "").trim();
}

async function setCategoryPopupEditMode(categoryRow) {
  const row = categoryRow || {};
  const v = row?.values || row || {};

  CURRENT_CATEGORY = row;
  CURRENT_CATEGORY_ID = String(row?._id || row?.id || "").trim();

  // 1) fill name
  const nameEl = document.getElementById("popup-category-name-input");
  if (nameEl) nameEl.value = getCategoryName(row);

  // 2) set business dropdown
  const bizId = getCategoryBusinessId(row);
  const bizDD = document.getElementById("dropdown-category-business");

  // IMPORTANT: options must exist first
  renderCategoryBusinessDropdown(MY_BUSINESSES);

  if (bizDD) {
    bizDD.value = bizId || "";
  }

  // 3) load calendars for that business + set calendar dropdown
  const calDD = document.getElementById("dropdown-business-calendar");
  renderCategoryCalendarDropdown([]); // clears + disables while loading

  if (bizId) {
    const calendars = await loadCalendarsForBusiness(bizId);
    renderCategoryCalendarDropdown(calendars);

    const calId = getCategoryCalendarId(row);
    if (calDD) calDD.value = calId || "";
  }

  // 4) buttons (edit mode)
  document.getElementById("save-category-button")?.style.setProperty("display", "none");
  document.getElementById("update-category-button")?.style.setProperty("display", "inline-block");
  document.getElementById("delete-category-button")?.style.setProperty("display", "inline-block");
}


function setCategoryPopupCreateMode() {
  CURRENT_CATEGORY = null;
  CURRENT_CATEGORY_ID = null;

  // clear inputs
  const nameEl = document.getElementById("popup-category-name-input");
  if (nameEl) nameEl.value = "";

  // fill business dropdown + default to selected business
  renderCategoryBusinessDropdown(MY_BUSINESSES);

  const bizDD = document.getElementById("dropdown-category-business");
  if (bizDD && SELECTED_BUSINESS_ID) {
    bizDD.value = SELECTED_BUSINESS_ID;
    bizDD.dispatchEvent(new Event("change")); // loads calendars
  } else {
    renderCategoryCalendarDropdown([]); // disables calendar dropdown
  }

  // buttons (create mode)
  document.getElementById("save-category-button")?.style.setProperty("display", "inline-block");
  document.getElementById("update-category-button")?.style.setProperty("display", "none");
  document.getElementById("delete-category-button")?.style.setProperty("display", "none");
}


/////////////////////////////////////////////////
// Update Category 
/////////////////////////////////////////////////
async function updateCategoryRecord() {
  if (!CURRENT_CATEGORY_ID) throw new Error("No category selected.");

  const businessId = document.getElementById("dropdown-category-business")?.value?.trim();
  const calendarId = document.getElementById("dropdown-business-calendar")?.value?.trim();
  const name = document.getElementById("popup-category-name-input")?.value?.trim();

  if (!businessId) throw new Error("Please choose a business.");
  if (!calendarId) throw new Error("Please choose a calendar.");
  if (!name) throw new Error("Category name is required.");

  const values = { Name: name, Business: businessId, Calendar: calendarId };

  const { res, data } = await apiJSON(`/api/records/Category/${encodeURIComponent(CURRENT_CATEGORY_ID)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ values }),
  });

  console.log("[category] PATCH", res.status, data);
  if (!res.ok) throw new Error(data?.message || data?.error || "Update failed");
}

document.getElementById("update-category-button")?.addEventListener("click", async () => {
  try {
    await updateCategoryRecord();
    closeCategoryPopup();

    // ✅ refresh list
    await loadCategoriesForSelectedBusiness();
  } catch (e) {
    console.error(e);
    alert(e?.message || "Update failed");
  }
});


/////////////////////////////////////////////////
// Delete Category 
/////////////////////////////////////////////////
document.getElementById("delete-category-button")?.addEventListener("click", async () => {
  try {
    if (!CURRENT_CATEGORY_ID) return;
    if (!confirm("Delete this category?")) return;

    const { res, data } = await apiJSON(`/api/records/Category/${encodeURIComponent(CURRENT_CATEGORY_ID)}`, {
      method: "DELETE",
    });

    console.log("[category] DELETE", res.status, data);
    if (!res.ok) throw new Error(data?.message || data?.error || "Delete failed");

    closeCategoryPopup();
    setCategoryPopupCreateMode();
    await loadCategoriesForSelectedBusiness();
    // refresh your category list
    // await loadCategoriesForSelectedBusiness();
  } catch (e) {
    console.error(e);
    alert(e?.message || "Delete failed");
  }
});
















              /////////////////////////////////////////////////
                   // Service Section
             /////////////////////////////////////////////////  
 //Fill Service Section 
function getServiceBusinessId(row) {
  const v = row?.values || row || {};
  return firstRefId(v["Business"] ?? v.business ?? v.businessId);
}

function getServiceCalendarId(row) {
  const v = row?.values || row || {};
  return firstRefId(v["Calendar"] ?? v.calendar ?? v.calendarId);
}

function getServiceCategoryId(row) {
  const v = row?.values || row || {};
  return firstRefId(v["Category"] ?? v.category ?? v.categoryId);
}

let SERVICE_CACHE = [];

async function loadServicesForSelectedBusiness() {
  const businessId = String(SELECTED_BUSINESS_ID || "").trim();

  if (!businessId) {
    SERVICE_CACHE = [];
    renderServiceSection([]);
    renderServiceSectionCalendarDropdown([]); // clear filter
    return [];
  }

  // pull all services then filter client-side (safe with your dynamic shapes)
  const path = `/api/records/Service?limit=500`;
  const { res, data } = await apiJSON(path, { method: "GET" });

  console.log("[service] RAW response", res.status, data);

  if (!res.ok) {
    SERVICE_CACHE = [];
    renderServiceSection([]);
    return [];
  }

  const items = normalizeItems(data);

  // filter by business
  let filtered = items.filter((row) => getServiceBusinessId(row) === businessId);

  // optional calendar filter from dropdown
  const calDD = document.getElementById("service-section-calendar-dropdown");
  const selectedCalendarId = String(calDD?.value || "").trim();
  if (selectedCalendarId) {
    filtered = filtered.filter((row) => getServiceCalendarId(row) === selectedCalendarId);
  }

  SERVICE_CACHE = filtered;
  renderServiceSection(filtered);

  // populate calendar filter dropdown using calendars for this business
  await loadServiceSectionCalendarsForBusiness(businessId);

  return filtered;
}

async function loadServiceSectionCalendarsForBusiness(businessId) {
  const wrapper = document.getElementById("service-section-calendar-dropdown-wrapper");
  const dd = document.getElementById("service-section-calendar-dropdown");
  if (!wrapper || !dd) return;

  const calendars = await loadCalendarsForBusiness(businessId); // you already have this helper
  renderServiceSectionCalendarDropdown(calendars);

  wrapper.style.display = calendars.length ? "block" : "none";
}

function renderServiceSectionCalendarDropdown(calendars) {
  const dd = document.getElementById("service-section-calendar-dropdown");
  if (!dd) return;

  dd.innerHTML = `<option value="">-- Choose a Calendar --</option>`;

  (calendars || []).forEach((row) => {
    const v = row?.values || row || {};
    const id = String(row?._id || row?.id || "").trim();
    if (!id) return;

    const name = String(v["Name"] || v["Calendar Name"] || v.name || "(Untitled)").trim();

    const opt = document.createElement("option");
    opt.value = id;
    opt.textContent = name;
    dd.appendChild(opt);
  });
}

function wireServiceSectionCalendarFilter() {
  const dd = document.getElementById("service-section-calendar-dropdown");
  if (!dd) return;

  dd.addEventListener("change", async () => {
    await loadServicesForSelectedBusiness();
  });
}

function getServiceName(row) {
  const v = row?.values || row || {};
  return String(v["Name"] || v.name || "").trim() || "(Untitled)";
}

function getServicePrice(row) {
  const v = row?.values || row || {};
  const p = v["Price"] ?? v.price;
  const n = Number(p);
  if (!Number.isFinite(n)) return "";
  return `$${n.toFixed(2)}`;
}

function makeNameMap(items, getIdFn, getNameFn) {
  const map = {};
  (items || []).forEach((row) => {
    const id = String(getIdFn(row) || "").trim();
    if (!id) return;
    map[id] = getNameFn(row);
  });
  return map;
}

function getCalendarNameFromRow(row) {
  const v = row?.values || row || {};
  return String(v["Name"] || v["Calendar Name"] || v.name || "(Untitled)").trim();
}

function getCategoryNameFromRow(row) {
  const v = row?.values || row || {};
  return String(v["Name"] || v["Category Name"] || v.name || "(Untitled)").trim();
}

function renderServiceSection(items) {
  const nameCol = document.getElementById("service-name-column");
  const calCol  = document.getElementById("service-calendar-column");
  const catCol  = document.getElementById("service-category-column");
  const priceCol= document.getElementById("service-price-column");
  if (!nameCol || !calCol || !catCol || !priceCol) return;

  nameCol.innerHTML = "";
  calCol.innerHTML = "";
  catCol.innerHTML = "";
  priceCol.innerHTML = "";

  if (!items || !items.length) {
    nameCol.innerHTML = `<div class="business-result">(no services yet)</div>`;
    calCol.innerHTML  = `<div class="business-result">—</div>`;
    catCol.innerHTML  = `<div class="business-result">—</div>`;
    priceCol.innerHTML= `<div class="business-result">—</div>`;
    return;
  }

  // Build name maps (uses caches if you have them)
  // If you don’t have CATEGORY_CACHE yet, you can still render ids.
  const calendarMap = makeNameMap(CALENDAR_CACHE, (r) => String(r?._id || r?.id || ""), getCalendarNameFromRow);
const categoryMap = makeNameMap(CATEGORY_CACHE || [], (r) => String(r?._id || r?.id || ""), getCategoryNameFromRow);


  // newest first
  const rows = [...items].sort((a, b) => {
    const ad = new Date(a?.createdAt || a?.updatedAt || 0).getTime();
    const bd = new Date(b?.createdAt || b?.updatedAt || 0).getTime();
    return bd - ad;
  });

  rows.forEach((row) => {
    const id = String(row?._id || row?.id || "").trim();
    if (!id) return;

    const sName = getServiceName(row);
    const calId = getServiceCalendarId(row);
    const catId = getServiceCategoryId(row);

    const calName = calendarMap[calId] || "(Calendar)";
    const catName = categoryMap[catId] || "(Category)";
    const price = getServicePrice(row);

    const nameDiv = document.createElement("div");
    nameDiv.className = "business-result clickable-item";
    nameDiv.textContent = sName;
    nameDiv.dataset.id = id;


    // (Optional) click to open popup edit mode later
  nameDiv.addEventListener("click", async () => {
  openServicePopup();
  await setServicePopupEditMode(row);
});


    const calDiv = document.createElement("div");
    calDiv.className = "business-result";
    calDiv.textContent = calName;

    const catDiv = document.createElement("div");
    catDiv.className = "business-result";
    catDiv.textContent = catName;

    const priceDiv = document.createElement("div");
    priceDiv.className = "business-result";
    priceDiv.textContent = price;

    nameCol.appendChild(nameDiv);
    calCol.appendChild(calDiv);
    catCol.appendChild(catDiv);
    priceCol.appendChild(priceDiv);
  });

  console.log("[service-section] rendered:", rows.map(getServiceName));
}


//Open Add Service Popup 
function openServicePopup() {
  document.getElementById("popup-add-service")?.style.setProperty("display", "block");
  document.getElementById("popup-overlay")?.style.setProperty("display", "block");
}

function closeServicePopup() {
  document.getElementById("popup-add-service")?.style.setProperty("display", "none");
  document.getElementById("popup-overlay")?.style.setProperty("display", "none");
}

//Fill dropdowns 
function renderServiceBusinessDropdown(items) {
  const dd = document.getElementById("dropdown-service-business");
  if (!dd) return;

  dd.innerHTML = `<option value="">-- Select --</option>`;

  (items || []).forEach((row) => {
    const v = row?.values || row || {};
    const id = String(row?._id || row?.id || v?._id || "").trim();
    if (!id) return;

    const name =
      (typeof getBusinessName === "function" ? getBusinessName(row) : "") ||
      String(v?.Name || v?.["Business Name"] || v?.businessName || "Business").trim();

    const opt = document.createElement("option");
    opt.value = id;
    opt.textContent = name;
    dd.appendChild(opt);
  });
}

function renderServiceCalendarDropdown(calendars) {
  const dd = document.getElementById("dropdown-service-calendar");
  if (!dd) return;

  dd.innerHTML = `<option value="">-- Select --</option>`;

  (calendars || []).forEach((row) => {
    const v = row?.values || row || {};
    const id = String(row?._id || row?.id || "").trim();
    if (!id) return;

    const name = String(v["Name"] || v["Calendar Name"] || v.name || "").trim() || "(Untitled)";
    const opt = document.createElement("option");
    opt.value = id;
    opt.textContent = name;
    dd.appendChild(opt);
  });

  dd.disabled = !(calendars && calendars.length);
}

function renderServiceCategoryDropdown(categories) {
  const dd = document.getElementById("dropdown-service-category");
  if (!dd) return;

  dd.innerHTML = `<option value="">-- Select --</option>`;

  (categories || []).forEach((row) => {
    const v = row?.values || row || {};
    const id = String(row?._id || row?.id || "").trim();
    if (!id) return;

    const name = String(v["Name"] || v["Category Name"] || v.name || "").trim() || "(Untitled)";
    const opt = document.createElement("option");
    opt.value = id;
    opt.textContent = name;
    dd.appendChild(opt);
  });

  dd.disabled = !(categories && categories.length);
}
async function loadCalendarsForBusiness(businessId) {
  const id = String(businessId || "").trim();
  if (!id) return [];

  const path = `/api/records/Calendar?limit=500`;
  const { res, data } = await apiJSON(path, { method: "GET" });
  if (!res.ok) return [];

  const items = normalizeItems(data);
  return items.filter((row) => String(getCalendarBusinessId(row) || "").trim() === id);
}
async function loadCategoriesForBusiness(businessId) {
  const id = String(businessId || "").trim();
  if (!id) return [];

  const path = `/api/records/Category?limit=500`;
  const { res, data } = await apiJSON(path, { method: "GET" });
  if (!res.ok) return [];

  const items = normalizeItems(data);
  return items.filter((row) => String(getCategoryBusinessId(row) || "").trim() === id);
}

let SERVICE_CALENDAR_CACHE = [];
let SERVICE_CATEGORY_CACHE = [];

let SERVICE_POPUP_LOADING_PROMISE = Promise.resolve();

function wireServicePopupDropdowns() {
  const bizDD = document.getElementById("dropdown-service-business");
  const calDD = document.getElementById("dropdown-service-calendar");
  const catDD = document.getElementById("dropdown-service-category");
  if (!bizDD || !calDD || !catDD) return;

  renderServiceCalendarDropdown([]);
  renderServiceCategoryDropdown([]);

  bizDD.addEventListener("change", () => {
    const businessId = bizDD.value.trim();

    // clear immediately
    renderServiceCalendarDropdown([]);
    renderServiceCategoryDropdown([]);
    SERVICE_CALENDAR_CACHE = [];
    SERVICE_CATEGORY_CACHE = [];

    if (!businessId) {
      SERVICE_POPUP_LOADING_PROMISE = Promise.resolve();
      return;
    }

    // ✅ store a promise we can await from edit mode
    SERVICE_POPUP_LOADING_PROMISE = (async () => {
      const [calendars, categories] = await Promise.all([
        loadCalendarsForBusiness(businessId),
        loadCategoriesForBusiness(businessId),
      ]);

      SERVICE_CALENDAR_CACHE = calendars;
      SERVICE_CATEGORY_CACHE = categories;

      renderServiceCalendarDropdown(calendars);
      renderServiceCategoryDropdown(categories);
    })();
  });

  // calendar -> filter categories
  calDD.addEventListener("change", () => {
    const calendarId = calDD.value.trim();
    if (!calendarId) {
      renderServiceCategoryDropdown(SERVICE_CATEGORY_CACHE);
      return;
    }

    const filtered = (SERVICE_CATEGORY_CACHE || []).filter((row) => {
      const v = row?.values || row || {};
      return firstRefId(v["Calendar"] ?? v.calendar ?? v.calendarId) === calendarId;
    });

    renderServiceCategoryDropdown(filtered);
  });
}


   /////////////////////////////////////////////////
//Save Service 
/////////////////////////////////////////////////  
async function uploadServiceImageIfAny() {
  const file = document.getElementById("popup-service-image-input")?.files?.[0];
  if (!file) return "";

  const fd = new FormData();
  fd.append("file", file);

  const url = `${API_BASE}/api/upload`;
  const res = await fetch(url, { method: "POST", body: fd, credentials: "include" });
  const data = await res.json().catch(() => ({}));

  console.log("[service-upload] /api/upload", res.status, data);
  if (!res.ok) throw new Error(data?.error || "Service image upload failed");

  return String(data?.url || "");
}


async function createServiceRecord({ userId, businessId, calendarId, categoryId, imageUrl }) {
  const name = document.getElementById("popup-service-name-input")?.value?.trim();
  const priceRaw = document.getElementById("popup-service-price-input")?.value;
  const description = document.getElementById("popup-service-description-input")?.value?.trim() || "";
  const durationRaw = document.getElementById("dropdown-duration")?.value;

  const price = Number(priceRaw);
  const duration = Number(durationRaw);

  if (!businessId) throw new Error("Please choose a business.");
  if (!calendarId) throw new Error("Please choose a calendar.");
  if (!categoryId) throw new Error("Please choose a category.");
  if (!name) throw new Error("Service name is required.");
  if (!Number.isFinite(price)) throw new Error("Price must be a number.");
  if (!Number.isFinite(duration)) throw new Error("Duration is required.");

  // ✅ Your Service DataType fields are set to "Allow multiple"
  // so safest is to store references as arrays.
  const values = {
    "Business": [businessId],
    "Calendar": [calendarId],
    "Category": [categoryId],
    "Created By": [userId],

    "Name": name,
    "Price": price,
    "Description": description,
    "duration": duration,
    "Image": imageUrl || "",
  };

  const { res, data } = await apiJSON("/api/records/Service", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ values }),
  });

  console.log("[service] POST /api/records/Service", res.status, data);
  if (!res.ok) throw new Error(data?.message || data?.error || "Failed to save service");

  const created =
    (Array.isArray(data?.items) && data.items[0]) ||
    data?.item ||
    data;

  const createdId = created?._id || created?.id;
  if (!createdId) throw new Error("Service saved but missing id");

  if (!created._id) created._id = createdId;
  return created;
}


function closeServicePopup() {
  document.getElementById("popup-add-service")?.style.setProperty("display", "none");
  document.getElementById("popup-overlay")?.style.setProperty("display", "none");
}

function initServiceSave() {
  const form = document.getElementById("add-service-form");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    try {
      const auth = await initHeaderAuth();
      const userId = auth?.user?._id || auth?.user?.id;
      if (!auth.loggedIn || !userId) {
        alert("Please log in first.");
        return;
      }

      const businessId = document.getElementById("dropdown-service-business")?.value?.trim();
      const calendarId = document.getElementById("dropdown-service-calendar")?.value?.trim();
      const categoryId = document.getElementById("dropdown-service-category")?.value?.trim();

      const imageUrl = await uploadServiceImageIfAny().catch(() => "");

      const created = await createServiceRecord({
        userId,
        businessId,
        calendarId,
        categoryId,
        imageUrl,
      });

      alert("Service saved!");
      closeServicePopup();

      // ✅ Sync main business dropdown so your page is "on" the right business after save
      const mainDD = document.getElementById("business-dropdown");
      if (mainDD && businessId) {
        mainDD.value = businessId;
        mainDD.dispatchEvent(new Event("change"));
      }

      console.log("[service] created:", created);

      // If you already have a loader, call it:
      // await loadServicesForSelectedBusiness();

      // reset form (optional)
      form.reset();
      document.getElementById("dropdown-service-calendar") && (document.getElementById("dropdown-service-calendar").disabled = true);
      document.getElementById("dropdown-service-category") && (document.getElementById("dropdown-service-category").disabled = true);

    } catch (err) {
      console.error("[service] save failed", err);
      alert(err?.message || "Service save failed");
    }
  });
}

function wireServiceImagePreview() {
  const input = document.getElementById("popup-service-image-input");
  const img = document.getElementById("service-image-preview");
  if (!input || !img) return;

  input.addEventListener("change", () => {
    const file = input.files?.[0];
    if (!file) {
      img.src = "";
      img.style.display = "none";
      return;
    }
    const url = URL.createObjectURL(file);
    img.src = url;
    img.style.display = "block";
  });
}

///////////////////
//Edit Service
///////////////////////////
let CURRENT_SERVICE = null;
let CURRENT_SERVICE_ID = null;

function setServicePopupCreateMode() {
  CURRENT_SERVICE = null;
  CURRENT_SERVICE_ID = null;

  document.getElementById("add-service-form")?.reset();

  // reset dropdowns
  renderServiceBusinessDropdown(MY_BUSINESSES);

  const bizDD = document.getElementById("dropdown-service-business");
  if (bizDD && SELECTED_BUSINESS_ID) {
    bizDD.value = SELECTED_BUSINESS_ID;
    bizDD.dispatchEvent(new Event("change")); // loads calendars + categories
  } else {
    renderServiceCalendarDropdown([]);
    renderServiceCategoryDropdown([]);
  }

  // buttons (you must have these ids in HTML)
  document.getElementById("save-service-button")?.style.setProperty("display", "inline-block");
  document.getElementById("update-service-button")?.style.setProperty("display", "none");
  document.getElementById("delete-service-button")?.style.setProperty("display", "none");
}

async function setServicePopupEditMode(serviceRow) {
  const row = serviceRow || {};
  const v = row?.values || row || {};

  CURRENT_SERVICE = row;
  CURRENT_SERVICE_ID = String(row?._id || row?.id || "").trim();

  // inputs
  document.getElementById("popup-service-name-input").value = String(v["Name"] || "").trim();
  document.getElementById("popup-service-price-input").value = String(v["Price"] ?? "").trim();
  document.getElementById("popup-service-description-input").value = String(v["Description"] || "").trim();
  document.getElementById("dropdown-duration").value = String(v["duration"] ?? v["Duration"] ?? "").trim();

  // ids
  const bizId = firstRefId(v["Business"] ?? v.business ?? v.businessId);
  const calId = firstRefId(v["Calendar"] ?? v.calendar ?? v.calendarId);
  const catId = firstRefId(v["Category"] ?? v.category ?? v.categoryId);

  // ensure business options exist
  renderServiceBusinessDropdown(MY_BUSINESSES);

  const bizDD = document.getElementById("dropdown-service-business");
  const calDD = document.getElementById("dropdown-service-calendar");
  const catDD = document.getElementById("dropdown-service-category");

  // set business + trigger async load
  if (bizDD) {
    bizDD.value = bizId || "";
    bizDD.dispatchEvent(new Event("change"));
  }

  // ✅ WAIT until calendars/categories finish loading
  await SERVICE_POPUP_LOADING_PROMISE;

  // now set calendar
  if (calDD) {
    calDD.value = calId || "";
    calDD.dispatchEvent(new Event("change")); // filters category list
  }

  // ✅ after calendar change filters categories, wait one microtask then set category
  await Promise.resolve();
  if (catDD) catDD.value = catId || "";

  // buttons
  document.getElementById("save-service-button")?.style.setProperty("display", "none");
  document.getElementById("update-service-button")?.style.setProperty("display", "inline-block");
  document.getElementById("delete-service-button")?.style.setProperty("display", "inline-block");

  // image preview (see URL fix below)
const img = document.getElementById("service-image-preview");
const raw = String(v["Image"] || "").trim();
const imageUrl = normalizeImageUrl(raw);

if (img && imageUrl) {
  img.src = imageUrl;
  img.style.display = "block";
} else if (img) {
  img.src = "";
  img.style.display = "none";
}


}

async function updateServiceRecord({ serviceId, userId, imageUrl }) {
  if (!serviceId) throw new Error("Missing service id");

  const name = document.getElementById("popup-service-name-input")?.value?.trim();
  const priceRaw = document.getElementById("popup-service-price-input")?.value;
  const description = document.getElementById("popup-service-description-input")?.value?.trim() || "";
  const durationRaw = document.getElementById("dropdown-duration")?.value;

  const businessId = document.getElementById("dropdown-service-business")?.value?.trim();
  const calendarId = document.getElementById("dropdown-service-calendar")?.value?.trim();
  const categoryId = document.getElementById("dropdown-service-category")?.value?.trim();

  const price = Number(priceRaw);
  const duration = Number(durationRaw);

  if (!businessId) throw new Error("Please choose a business.");
  if (!calendarId) throw new Error("Please choose a calendar.");
  if (!categoryId) throw new Error("Please choose a category.");
  if (!name) throw new Error("Service name is required.");
  if (!Number.isFinite(price)) throw new Error("Price must be a number.");
  if (!Number.isFinite(duration)) throw new Error("Duration is required.");

  // keep existing image if no new upload
  const existing = String((CURRENT_SERVICE?.values || CURRENT_SERVICE || {})["Image"] || "").trim();
  const finalImage = imageUrl || existing || "";

  const values = {
    "Business": [businessId],
    "Calendar": [calendarId],
    "Category": [categoryId],
    "Created By": [userId],

    "Name": name,
    "Price": price,
    "Description": description,
    "duration": duration,
    "Image": finalImage,
  };

  const { res, data } = await apiJSON(
    `/api/records/Service/${encodeURIComponent(serviceId)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ values }),
    }
  );

  console.log("[service] PATCH", res.status, data);
  if (!res.ok) throw new Error(data?.message || data?.error || "Failed to update service");

  return data?.item || (Array.isArray(data?.items) ? data.items[0] : data);
}

async function deleteServiceRecord(serviceId) {
  if (!serviceId) throw new Error("Missing service id");

  const { res, data } = await apiJSON(
    `/api/records/Service/${encodeURIComponent(serviceId)}`,
    { method: "DELETE" }
  );

  console.log("[service] DELETE", res.status, data);
  if (!res.ok) throw new Error(data?.message || data?.error || "Failed to delete service");
}

function initServiceUpdateDelete() {
  // Update
  document.getElementById("update-service-button")?.addEventListener("click", async (e) => {
    e.preventDefault();

    try {
      if (!CURRENT_SERVICE_ID) return alert("No service selected.");

      const auth = await initHeaderAuth();
      const userId = auth?.user?._id || auth?.user?.id;
      if (!auth.loggedIn || !userId) return alert("Please log in first.");

      // optional: upload new image (if none selected, this returns "" in your code)
      const imageUrl = await uploadServiceImageIfAny().catch(() => "");

      await updateServiceRecord({
        serviceId: CURRENT_SERVICE_ID,
        userId,
        imageUrl,
      });

      alert("Service updated!");
      closeServicePopup();

      // refresh list
      await loadServicesForSelectedBusiness();
    } catch (err) {
      console.error("[service] update failed", err);
      alert(err?.message || "Service update failed");
    }
  });

  // Delete
  document.getElementById("delete-service-button")?.addEventListener("click", async (e) => {
    e.preventDefault();

    try {
      if (!CURRENT_SERVICE_ID) return alert("No service selected.");
      if (!confirm("Delete this service?")) return;

      await deleteServiceRecord(CURRENT_SERVICE_ID);

      alert("Service deleted!");
      closeServicePopup();

      // refresh list
      await loadServicesForSelectedBusiness();
    } catch (err) {
      console.error("[service] delete failed", err);
      alert(err?.message || "Service delete failed");
    }
  });
}

///////////////////
//Delete  Service
///////////////////////////




/////////////////////////////End DOM


/////////////////////////////////////////////////
// 3) INIT (SINGLE DOMContentLoaded)
/////////////////////////////////////////////////
document.addEventListener("DOMContentLoaded", async () => {
  // --- Header auth (top of page) ---
  const auth = await initHeaderAuth();

  // --- Menu section / business UI (below) ---
  wireBusinessDropdownUI();

  // Always wire save handler (works even if user logs in later)
  initBusinessSave();

  initCalendarSave();

wireCategoryPopupDropdowns();
initCategorySave();

wireServicePopupDropdowns();
  initServiceSave();
  wireServiceSectionCalendarFilter();

  wireServiceImagePreview();
initServiceUpdateDelete();

  // ✅ Business popup: Add button → CREATE MODE
  document.getElementById("open-business-popup-button")?.addEventListener("click", () => {
    setBusinessPopupCreateMode();
    openAddBusinessPopup();
  });

  // ✅ Business popup close
  document.getElementById("close-add-business-popup-btn")?.addEventListener("click", closeAddBusinessPopup);

  // ✅ Calendar popup open
  document.getElementById("open-calendar-button")?.addEventListener("click", () => {
    // make sure calendar dropdown has latest businesses
    renderCalendarBusinessDropdown(MY_BUSINESSES);
    openAddCalendarPopup();
  });

  // ✅ Calendar popup close (make sure your X button has an id in HTML)
  document.getElementById("close-add-calendar-popup-btn")?.addEventListener("click", closeAddCalendarPopup);

  // ✅ Overlay click closes whichever popups are open
document.getElementById("popup-overlay")?.addEventListener("click", () => {
  const overlay = document.getElementById("popup-overlay");
  if (overlay?.dataset.locked === "1") return; // locked: do nothing

  closeAddBusinessPopup();
  closeAddCalendarPopup();
  closeCategoryPopup();
  closeServicePopup();
  closeLoginPopup();
  });

  // ✅ ESC closes whichever popups are open
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;

  const overlay = document.getElementById("popup-overlay");
  if (overlay?.dataset.locked === "1") return; // locked: do nothing

  closeAddBusinessPopup();
  closeAddCalendarPopup();
  closeCategoryPopup();
  closeServicePopup();
  closeLoginPopup();
    
  });

  // --- Login popup wiring ---
  document.getElementById("open-login-popup-btn")?.addEventListener("click", openLoginPopup);
  document.getElementById("close-login-popup-btn")?.addEventListener("click", closeLoginPopup);

  // --- Logout ---
  document.getElementById("logout-btn")?.addEventListener("click", async () => {
    await apiFetch("/api/logout", { method: "POST" }).catch(() => {});
    setHeaderLoggedOut();
    renderBusinessDropdown([]);
    renderBusinessSection([]);
    renderCalendarBusinessDropdown([]);
    MY_BUSINESSES = [];
    const title = document.getElementById("selected-business-name");
    if (title) title.textContent = "Choose business to manage";
  });

  // Tabs
  initTopTabs();

  // ✅ If logged in on load, populate businesses
  if (auth.loggedIn && auth.user?._id) {
    await loadMyBusinesses();
  }

  // --- Login submit ---
 const LOGIN_PATH = "/api/login";

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

    const auth2 = await initHeaderAuth();
    if (auth2.loggedIn && auth2.user?._id) {
      await loadMyBusinesses(); // ✅ this sets MY_BUSINESSES
    }

    closeLoginPopup();
    const pw = document.getElementById("login-password");
    if (pw) pw.value = "";
  });
});


/////////////////////////////////////////////////
// Tab Switching
/////////////////////////////////////////////////
function initTopTabs() {
  const tabs = Array.from(document.querySelectorAll(".option-bar .option"));
  if (!tabs.length) return;

  const SECTION_MAP = {
    business: "business-section",
    calendar: "calendar-section",
    category: "category-section",
    service: "service-section",
    booking: "booking-section",
  };

function showSection(tabId) {
  // 1) set active tab style
  tabs.forEach((t) => t.classList.toggle("active", t.dataset.id === tabId));

  // 2) show/hide sections
  Object.entries(SECTION_MAP).forEach(([key, sectionId]) => {
    const el = document.getElementById(sectionId);
    if (!el) return;
    el.style.display = key === tabId ? "block" : "none";
  });

  // ✅ 3) run section-specific loaders AFTER it's visible
  if (tabId === "calendar") {
    loadCalendarsForSelectedBusiness();
  }
  if (tabId === "category") {
  loadCategoriesForSelectedBusiness();
}

if (tabId === "service") {
  loadServicesForSelectedBusiness();
}

}

  // click handlers
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const tabId = tab.dataset.id;
      if (!tabId) return;
      showSection(tabId);
    });
  });

  // default tab on page load
  showSection("business");
}






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

const url = `${API_BASE}/api/upload?folder=${encodeURIComponent("suiteseat/business-heroes")}`;


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

  // ✅ DEBUG: log what you're about to save
  console.log("[business] saving heroUrl:", heroUrl);

  // ✅ Guard: never allow local /uploads paths in production DB
  if (heroUrl && String(heroUrl).startsWith("/uploads/")) {
    throw new Error("Hero Image is still local. /api/upload must return Cloudinary secure_url.");
  }

  const values = {
    "Name": businessName,
    "Pro Name": proName,
    "Phone Number": phoneNumber || "",
    "Location Name": locationName || "",
    "Location Address": locationAddress || "",
    "Email": email || "",
    "Hero Image": heroUrl || "",
    "slug": slug,
    "Pro": userId,
    "Created By": userId,
  };

  const { res, data } = await apiJSON("/api/records/Business", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ values }),
  });

  console.log("[business] POST /api/records/Business", res.status, data);

  if (!res.ok) throw new Error(data?.message || data?.error || "Failed to save business");

  const created =
    (Array.isArray(data?.items) && data.items[0]) ||
    data?.item ||
    data;

  const createdId = created?._id || created?.id;
  if (!createdId) throw new Error("Business saved but missing id");

  if (!created._id) created._id = createdId;
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
     await loadMyBusinesses();
unlockAppAfterBusinessCreated();


      // auto-select the new business
      const dd = document.getElementById("business-dropdown");
      if (dd) {
       const newId = created?._id || created?.id;
      dd.value = String(newId || "");
  
        dd.dispatchEvent(new Event("change"));
      }
    } catch (err) {
      console.error("[business] save failed", err);
      alert(err?.message || "Business save failed");
    }
  });
}

////////////////
//Open Add Business Popup when Business is clicked 
/////////////////////
// EDIT state
let CURRENT_BUSINESS = null;     // full record
let CURRENT_BUSINESS_ID = null;  // string id
let BUSINESS_CACHE = [];         // last loaded list
let MY_BUSINESSES = [];
let SELECTED_BUSINESS_ID = "";   // the business currently selected in the main dropdown
let CALENDAR_CACHE = [];         // last loaded calendars list (optional)


//Helpers to read/write your Business "values"
function getVal(row, fieldName) {
  // Record stores fields in row.values
  const v = row?.values || {};
  return v?.[fieldName];
}

function setHeroPreview(url) {
  const img = document.getElementById("current-hero-image");
  const txt = document.getElementById("no-image-text");
  if (!img || !txt) return;

  const fixed = normalizeImageUrl(url);

  if (fixed) {
    img.src = fixed;
    img.style.display = "block";
    txt.style.display = "none";
  } else {
    img.src = "";
    img.style.display = "none";
    txt.style.display = "block";
  }
}


const setVal = (id, val) => {
  const el = document.getElementById(id);
  if (el) el.value = val;
};

function setBusinessPopupCreateMode() {
  CURRENT_BUSINESS = null;
  CURRENT_BUSINESS_ID = null;

  const title = document.getElementById("popup-title");
  if (title) title.textContent = "Add Business";

  document.getElementById("save-button")?.style.setProperty("display", "inline-block");
  document.getElementById("update-button")?.style.setProperty("display", "none");
  document.getElementById("delete-button")?.style.setProperty("display", "none");

  document.getElementById("popup-add-business-form")?.reset();
  setHeroPreview("");
  document.getElementById("business-name-warning")?.style.setProperty("display", "none");
}

function setBusinessPopupEditMode(businessRow) {
  const row = businessRow || {};
  const v = row?.values || row || {};

  CURRENT_BUSINESS = row;
  CURRENT_BUSINESS_ID = String(row?._id || row?.id || "").trim();

    // ✅ remember last edited
  if (CURRENT_BUSINESS_ID) {
    localStorage.setItem("lastBusinessId", CURRENT_BUSINESS_ID);
  }

  const title = document.getElementById("popup-title");
  if (title) title.textContent = "Edit Business";

  document.getElementById("save-button")?.style.setProperty("display", "none");
  document.getElementById("update-button")?.style.setProperty("display", "inline-block");
  document.getElementById("delete-button")?.style.setProperty("display", "inline-block");

  setVal("popup-business-name-input", String(v["Name"] || "").trim());
  setVal("popup-your-name-input", String(v["Pro Name"] || "").trim());
  setVal("popup-business-phone-number-input", String(v["Phone Number"] || "").trim());
  setVal("popup-business-location-name-input", String(v["Location Name"] || "").trim());
  setVal("popup-business-address-input", String(v["Location Address"] || "").trim());
  setVal("popup-business-email-input", String(v["Email"] || "").trim());

  const heroUrl = String(v["Hero Image"] || "").trim();
  setHeroPreview(heroUrl);
if (heroUrl.startsWith("/uploads/")) {
  console.warn("[hero] This business is still using local uploads. Re-upload to move to Cloudinary.", heroUrl);
}

  document.getElementById("business-name-warning")?.style.setProperty("display", "none");
}


////////////////
//Update + Delete buttons (edit mode actions)
/////////////////////
async function updateBusinessRecord({ heroUrl }) {
  if (!CURRENT_BUSINESS_ID) throw new Error("No business selected.");

  const businessName = document.getElementById("popup-business-name-input")?.value?.trim();
  const proName = document.getElementById("popup-your-name-input")?.value?.trim();
  const phoneNumber = document.getElementById("popup-business-phone-number-input")?.value?.trim();
  const locationName = document.getElementById("popup-business-location-name-input")?.value?.trim();
  const locationAddress = document.getElementById("popup-business-address-input")?.value?.trim();
  const email = document.getElementById("popup-business-email-input")?.value?.trim();

  // If they didn’t upload a new image, keep existing
  const existingHero = String(getVal(CURRENT_BUSINESS, "Hero Image") || "").trim();
  const finalHero = heroUrl || existingHero;

  const values = {
    "Name": businessName || "",
    "Pro Name": proName || "",
    "Phone Number": phoneNumber || "",
    "Location Name": locationName || "",
    "Location Address": locationAddress || "",
    "Email": email || "",
    "Hero Image": finalHero || "",
    "slug": slugify(businessName || ""), // or generateBusinessSlug(...)
  };

  const { res, data } = await apiJSON(`/api/records/Business/${encodeURIComponent(CURRENT_BUSINESS_ID)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ values }),
  });

  console.log("[business] PATCH", res.status, data);
  if (!res.ok) throw new Error(data?.message || data?.error || "Update failed");
}

document.getElementById("update-button")?.addEventListener("click", async () => {
  try {
    const heroUrl = await uploadHeroImageIfAny().catch(() => "");
    await updateBusinessRecord({ heroUrl });

    await loadMyBusinesses();  // re-render dropdown + section
    closeAddBusinessPopup();
  } catch (e) {
    console.error(e);
    alert(e?.message || "Update failed");
  }
});



////////////////
//Delete Business 
/////////////////////
document.getElementById("delete-button")?.addEventListener("click", async () => {
  try {
    if (!CURRENT_BUSINESS_ID) return;
    if (!confirm("Delete this business?")) return;

    const { res, data } = await apiJSON(`/api/records/Business/${encodeURIComponent(CURRENT_BUSINESS_ID)}`, {
      method: "DELETE",
    });

    console.log("[business] DELETE", res.status, data);
    if (!res.ok) throw new Error(data?.message || data?.error || "Delete failed");

    await loadMyBusinesses();
    closeAddBusinessPopup();
    setBusinessPopupCreateMode();
  } catch (e) {
    console.error(e);
    alert(e?.message || "Delete failed");
  }
});




////////////////
//Fill COlumns in Business Section 
/////////////////////
function getBusinessSlug(row) {
  const v = row?.values || row || {};
  return String(v["slug"] || v.slug || "").trim();
}

function toPublicBusinessUrl(row) {
  const slug = getBusinessSlug(row);

  // best case: you already store slug
  if (slug) return `https://www.suiteseat.io/${encodeURIComponent(slug)}`;

  // fallback: generate from business name (not ideal if duplicates, but works)
  const name = getBusinessName(row);
  const fallback = slugify(name);
  return `https://www.suiteseat.io/${encodeURIComponent(fallback)}`;
}

function renderBusinessSection(items) {
  const nameCol = document.getElementById("business-name-column");
  const servicesCol = document.getElementById("services-column");
  const clientsCol = document.getElementById("clients-column");
  const gotoCol = document.getElementById("goto-column");

  if (!nameCol || !servicesCol || !clientsCol || !gotoCol) return;

  // Clear existing
  nameCol.innerHTML = "";
  servicesCol.innerHTML = "";
  clientsCol.innerHTML = "";
  gotoCol.innerHTML = "";

  if (!items || !items.length) {
    nameCol.innerHTML = `<div class="business-result">(no businesses yet)</div>`;
    servicesCol.innerHTML = `<div class="business-result">—</div>`;
    clientsCol.innerHTML = `<div class="business-result">—</div>`;
    gotoCol.innerHTML = `<div class="business-result">—</div>`;
    return;
  }

  // Most recent first (your API already sorts newest first, but we’ll keep it safe)
  const rows = [...items].sort((a, b) => {
    const ad = new Date(a?.createdAt || a?.updatedAt || 0).getTime();
    const bd = new Date(b?.createdAt || b?.updatedAt || 0).getTime();
    return bd - ad;
  });

  rows.forEach((row) => {
    const v = row?.values || row || {};
    const id = String(row?._id || row?.id || "").trim();
    if (!id) return;

    const name = getBusinessName(row); // ✅ uses your helper

    // If your business record stores arrays of refs, this will work:
    const servicesCount = Array.isArray(v?.["Service(s)"]) ? v["Service(s)"].length : (Number(v?.servicesCount) || 0);
    const clientsCount = Array.isArray(v?.["Client(s)"]) ? v["Client(s)"].length : (Number(v?.clientsCount) || 0);

    // Name cell (clickable if you want later)
    const nameDiv = document.createElement("div");
    nameDiv.className = "business-result clickable-item";
    nameDiv.textContent = name;
    nameDiv.dataset.id = id;

    // ✅ Click business name -> open popup in EDIT mode
nameDiv.addEventListener("click", () => {
  setBusinessPopupEditMode(row);   // fills the popup
  openAddBusinessPopup();          // shows popup
});

    // Services count cell
    const servicesDiv = document.createElement("div");
    servicesDiv.className = "business-result";
    servicesDiv.textContent = String(servicesCount);

    // Clients count cell
    const clientsDiv = document.createElement("div");
    clientsDiv.className = "business-result";
    clientsDiv.textContent = String(clientsCount);

    // Go to cell (arrow)
    const goDiv = document.createElement("div");
    goDiv.className = "business-result goto-arrow";
    goDiv.textContent = "➜";
    goDiv.title = "Open business";
    goDiv.dataset.id = id;

goDiv.addEventListener("click", () => {
  const url = toPublicBusinessUrl(row);
  window.location.href = url; // redirect same tab
  // or: window.open(url, "_blank"); // open new tab
});


    // Append to each column
    nameCol.appendChild(nameDiv);
    servicesCol.appendChild(servicesDiv);
    clientsCol.appendChild(clientsDiv);
    gotoCol.appendChild(goDiv);
  });

  console.log("[business-section] rendered businesses:", rows.map(getBusinessName));
}

//Redirect to business Slug 
  function lockAppUntilBusinessCreated() {
  // open popup + show overlay
  setBusinessPopupCreateMode();
  openAddBusinessPopup();

  // hide the X so they can’t close it
  const closeBtn = document.getElementById("close-add-business-popup-btn");
  if (closeBtn) closeBtn.style.display = "none";

  // prevent overlay click from closing anything
  const overlay = document.getElementById("popup-overlay");
  if (overlay) overlay.dataset.locked = "1";

  // disable background interactions
  document.body.classList.add("app-locked");
}

function unlockAppAfterBusinessCreated() {
  const closeBtn = document.getElementById("close-add-business-popup-btn");
  if (closeBtn) closeBtn.style.display = "inline-block";

  const overlay = document.getElementById("popup-overlay");
  if (overlay) overlay.dataset.locked = "0";

  document.body.classList.remove("app-locked");
  closeAddBusinessPopup();
}
     
              /////////////////////////////////////////////////
                   // Category Section
             /////////////////////////////////////////////////   
document.getElementById("open-category-popup-button")?.addEventListener("click", () => {
  setCategoryPopupCreateMode(); // ✅ reset everything for a new category

  renderCategoryBusinessDropdown(MY_BUSINESSES);

  const bizDD = document.getElementById("dropdown-category-business");
  if (bizDD && SELECTED_BUSINESS_ID) {
    bizDD.value = SELECTED_BUSINESS_ID;
    bizDD.dispatchEvent(new Event("change")); // ✅ loads calendars
  }

  openCategoryPopup();
});

document.getElementById("category-calendar-dropdown")?.addEventListener("change", () => {
  // just re-render categories using the selected calendar filter
  loadCategoriesForSelectedBusiness();
});

document.getElementById("close-add-category-popup-btn")
  ?.addEventListener("click", closeCategoryPopup);


              /////////////////////////////////////////////////
                   // Service Section
             ///////////////////////////////////////////////// 
document.getElementById("open-service-popup-button")?.addEventListener("click", () => {
  setServicePopupCreateMode();          // ✅ add this
  renderServiceBusinessDropdown(MY_BUSINESSES);

  const bizDD = document.getElementById("dropdown-service-business");
  if (bizDD && SELECTED_BUSINESS_ID) {
    bizDD.value = SELECTED_BUSINESS_ID;
    bizDD.dispatchEvent(new Event("change"));
  }

  openServicePopup();
});


document.getElementById("close-add-service-popup-btn")?.addEventListener("click", closeServicePopup);
