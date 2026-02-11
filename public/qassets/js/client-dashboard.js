// ✅ MUST be first (before any API_BASE usage)
const host = window.location.hostname;
const isProdHost = host === "suiteseat.io" || host === "www.suiteseat.io";

const API_BASE = isProdHost
  ? "https://suiteseat-app1.onrender.com"
  : "http://localhost:8400";

console.log("[client-dashboard] API_BASE:", API_BASE);

// ✅ init caches used later
window.serviceCache = window.serviceCache || new Map();
window._serviceCacheLoadedPromise = window._serviceCacheLoadedPromise || null;



// ---- detect if user came from link page ----
const urlParams = new URLSearchParams(window.location.search);
const fromLinkPage = urlParams.get("from") === "link";

// ---- flags for what this user actually has ----
let hasAnyAppointments = false;
let hasAnyOrders = false;
let userSelectedMainTab = null; // "appointments-tab" | "orders-tab" | null

function pickServiceNameFromAny(obj) {
  const v = (obj && (obj.values || obj)) || {};

  const name =
    v.serviceName ||
    v["Service Name"] ||
    v["Name"] ||
    v.Name ||
    v.title ||
    v.Title ||
    v.name ||
    "";

  // guard against weird accidental strings
  if (!name) return "";
  if (String(name).toLowerCase() === "values") return ""; // <-- stops "values"
  return String(name);
}
function pickServiceNameFromRecord(rec) {
  const v = (rec && (rec.values || rec)) || {};
  return String(
    v.Name || v.name || v["Service Name"] || v.serviceName || v.title || ""
  ).trim();
}

function idVal(x) {
  if (!x) return "";
  if (typeof x === "string") return x;
  return String(x.recordId || x.refId || x._id || x.id || x.value || "").trim();
}

function extractServiceIdsFromAppt(appt) {
  const v = appt?.values || {};
  const out = [];

  const multi = v["Service(s)"] || v.Services || v.services;
  if (Array.isArray(multi)) {
    for (const s of multi) {
      const sid = idVal(s);
      if (sid) out.push(sid);
    }
  }

  // just in case single service exists in some older appts
  const single = v.Service || v.serviceId || v["Service Id"];
  const sid = idVal(single);
  if (sid) out.push(sid);

  return Array.from(new Set(out)).filter(Boolean);
}

function firstRecordFromResponse(data) {
  if (!data) return null;

  // your API sometimes returns { items: [...] } or { records: [...] }
  if (Array.isArray(data.items) && data.items.length) return data.items[0];
  if (Array.isArray(data.records) && data.records.length) return data.records[0];

  // sometimes direct array
  if (Array.isArray(data) && data.length) return data[0];

  // sometimes { data: [...] }
  if (Array.isArray(data.data) && data.data.length) return data.data[0];

  // sometimes single record
  if (data._id || data.id || data.values) return data;

  return null;
}


// Fetch a single Service by id and cache it
async function fetchServiceById(serviceId) {
  const id = String(serviceId || "").trim();
  if (!id) return null;

  if (window.serviceCache.has(id)) return window.serviceCache.get(id);

  // Use where JSON so server ALWAYS treats _id as a real record filter
  const where = encodeURIComponent(JSON.stringify({ _id: id }));
  const url = `${API_BASE}/public/records?dataType=Service&where=${where}&limit=1&ts=${Date.now()}`;

  console.log("[svc] fetching:", url);

  const r = await fetch(url, {
    credentials: "include",
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  const data = await r.json().catch(() => null);
  const rec = (data && (data.items?.[0] || data.records?.[0])) || (Array.isArray(data) ? data[0] : null);

  window.serviceCache.set(id, rec || null);
  return rec || null;
}


// ================================
// Service cache loader (define it!)
// ================================
// ================================
// Service cache loader (SAFE for your server)
// ================================
window._serviceCacheLoadedPromise = window._serviceCacheLoadedPromise || null;

async function loadServiceCache() {
  // Your server.js doesn't expose /api/me/records, so preloading can't work reliably here.
  // We'll lazy-load services by id with fetchServiceById() instead.
  if (!window._serviceCacheLoadedPromise) {
    window._serviceCacheLoadedPromise = Promise.resolve();
  }
  return window._serviceCacheLoadedPromise;
}




// Default avatar served by the backend (or move file to Next /public)
const DEFAULT_AVATAR =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
      <rect width="100%" height="100%" fill="#eee"/>
      <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle"
            font-family="sans-serif" font-size="18" fill="#999">
        No Photo
      </text>
    </svg>
  `);


function pickDateISO(appt) {
  const v = appt?.values || appt || {};
  const raw =
    v.Date ||
    v.date ||
    v.dateISO ||
    v["Date (ISO)"] ||
    null;

  return raw ? String(raw).slice(0, 10) : null;
}

function pickStartHHMM(appt) {
  const v = appt?.values || appt || {};
  return (
    v.StartTime ||
    v["Start Time"] ||
    v.Time ||
    v.time ||
    v.start ||
    v.Start ||
    null
  );
}

function pickDurationMin(appt) {
  const v = appt?.values || appt || {};
  const raw =
    v.DurationMin ||
    v["Duration (min)"] ||
    v.Duration ||
    v.duration ||
    v.Minutes ||
    0;

  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
}

function resolveImageUrl(img) {
  if (!img) return "";

  // If it's already a string, prepend API_BASE if it's a relative path
  if (typeof img === "string") {
    if (img.startsWith("http://") || img.startsWith("https://")) {
      return img;
    }
    return `${API_BASE}${img}`; // e.g. "/uploads/..." -> "http://localhost:8400/uploads/..."
  }

  // If it's an object { url, name }
  if (img.url) {
    if (img.url.startsWith("http://") || img.url.startsWith("https://")) {
      return img.url;
    }
    return `${API_BASE}${img.url}`;
  }

  return "";
}

// helpers
const $  = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

function escapeHtml(s) {
  return String(s || "")
    .replace(/&/g,"&amp;").replace(/</g,"&lt;")
    .replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");
}

// ---- UI hooks you already have in HTML ----
const els = {
  headerRight: $(".right-group"),
  loginBtn:    $("#open-login-popup-btn"),
  logoutBtn:   $("#logout-btn"),            // in #auth-controls
  loginText:   $("#login-status-text"),
  profileImg:  $("#client-profile-photo"),
};

// ================================
// Main tabs: Appointments vs Orders
// ================================

const mainTabButtons = Array.from(document.querySelectorAll(".tab-button"));

function showMainTab(tabId) {
  mainTabButtons.forEach((btn) => {
    const id = btn.dataset.tab;
    const isActive = id === tabId;
    btn.classList.toggle("active", isActive);
    const content = document.getElementById(id);
    if (content) content.style.display = isActive ? "block" : "none";
  });
}

// click to switch manually
mainTabButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    showMainTab(btn.dataset.tab);
  });
});

// decide which tabs to show + which is active
function updateMainTabs() {
  const apptBtn = document.querySelector(
    '.tab-button[data-tab="appointments-tab"]'
  );
  const ordersBtn = document.querySelector(
    '.tab-button[data-tab="orders-tab"]'
  );

  if (!apptBtn || !ordersBtn) return;

  // ✅ Always show both buttons
  apptBtn.style.display = "inline-block";
  ordersBtn.style.display = "inline-block";

  let activeTabId = null;

  // 1️⃣ If the user clicked a tab, respect that choice
  if (userSelectedMainTab) {
    activeTabId = userSelectedMainTab;
  }
  // 2️⃣ Otherwise, auto-decide like before
  else if (hasAnyAppointments && hasAnyOrders) {
    activeTabId = fromLinkPage ? "orders-tab" : "appointments-tab";
  } else if (hasAnyOrders) {
    activeTabId = "orders-tab";
  } else if (hasAnyAppointments) {
    activeTabId = "appointments-tab";
  } else {
    activeTabId = "appointments-tab";
  }

  showMainTab(activeTabId);
}



// open/close login popup (you already have the HTML)
function openLoginPopup() {
  $("#popup-login").style.display = "block";
  $("#popup-overlay").style.display = "block";
  document.body.classList.add("popup-open");
}
function closeLoginPopup() {
  $("#popup-login").style.display = "none";
  $("#popup-overlay").style.display = "none";
  document.body.classList.remove("popup-open");
}
window.closeLoginPopup = closeLoginPopup;

async function checkLogin() {
  try {
    const res = await fetch(`${API_BASE}/api/whoami`, {
      method: "GET",
      credentials: "include",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });

    if (!res.ok) return { loggedIn: false };
    const data = await res.json().catch(() => ({}));

    const userId = data.userId || data.user?._id || null;
    if (!userId) return { loggedIn: false };

    return {
      loggedIn: true,
      userId,
      email: data.user?.email,
      firstName: data.user?.firstName,
      user: data.user,
    };
  } catch (e) {
    console.error("[client-dashboard] checkLogin failed:", e);
    return { loggedIn: false };
  }
}


 
function renderAuthUI(data) {
  const loggedIn = !!data?.loggedIn;

  // header text + buttons
  if (loggedIn) {
    const displayName =
      data.firstName ||
      data.first_name ||
      data?.user?.firstName ||
      (data.email ? String(data.email).split("@")[0] : "") ||
      "there";

    if (els.headerRight) {
      els.headerRight.innerHTML = `
        Hi, ${escapeHtml(displayName)} 👋
        <button id="logout-inline-btn">Logout</button>
      `;
      $("#logout-inline-btn")?.addEventListener("click", doLogout);
    }

    if (els.loginText) els.loginText.textContent = `Hey, ${displayName}`;
    if (els.loginBtn)  els.loginBtn.style.display = "none";
    if (els.logoutBtn) els.logoutBtn.style.display = "inline-block";
  } else {
    if (els.headerRight) {
      els.headerRight.innerHTML = `<button id="open-login-popup-btn-2">Login</button>`;
      $("#open-login-popup-btn-2")?.addEventListener("click", openLoginPopup);
    }
    if (els.loginText) els.loginText.textContent = "";
    if (els.loginBtn)  els.loginBtn.style.display = "inline-block";
    if (els.logoutBtn) els.logoutBtn.style.display = "none";
  }

  // profile photo (optional)
// profile photo (optional)
if (els.profileImg) {
  const raw = loggedIn && (data.profilePhoto || data?.user?.profilePhoto);
  const resolved = raw ? resolveImageUrl(raw) : "";

  els.profileImg.onerror = () => { els.profileImg.src = DEFAULT_AVATAR; };
  els.profileImg.src = resolved
    ? `${resolved}${resolved.includes("?") ? "&" : "?"}t=${Date.now()}`
    : DEFAULT_AVATAR;
}

}

async function doLogout() {
  const tries = ["/api/logout", "/auth/logout", "/logout"];
  for (const path of tries) {
    try {
      const r = await fetch(`${API_BASE}${path}`, { method: "POST", credentials: "include" });
      if (r.ok) break;
    } catch {}
  }
  location.reload();
}


// login form submit (uses your existing /login route)
$("#login-form")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email    = $("#login-email").value.trim();
  const password = $("#login-password").value.trim();
  if (!email || !password) return alert("Please enter both email and password.");

  const tries = ["/api/login", "/login"];

  let res, body;
  for (const path of tries) {
    try {
      res = await fetch(`${API_BASE}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });
      body = await res.json().catch(() => ({}));
      if (res.ok) break;
    } catch (e) {}
  }

  if (res && res.ok) {
    closeLoginPopup();
    location.reload();
  } else {
    alert(body?.message || "Login failed.");
  }
});


// wire top-right Login button (if present)
els.loginBtn?.addEventListener("click", openLoginPopup);

// on load, detect user and render
document.addEventListener("DOMContentLoaded", async () => {
  const me = await checkLogin();
  renderAuthUI(me);
});


// ---- Sub-tab switching ----
document.addEventListener('DOMContentLoaded', () => {
  const btns = Array.from(document.querySelectorAll('.sub-tab-btn'));
  const sections = {
    all:       document.getElementById('all-appointments'),
    upcoming:  document.getElementById('upcoming-appointments'),
    past:      document.getElementById('past-appointments'),
  };

  function showSubTab(tab) {
    // toggle button active state
    btns.forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    // toggle sections
    Object.entries(sections).forEach(([key, el]) => {
      if (!el) return;
      el.style.display = key === tab ? 'block' : 'none';
    });

    // OPTIONAL: re-fetch per tab
    // if (typeof fetchAndRenderClientAppointments === 'function') {
    //   fetchAndRenderClientAppointments({ filter: tab }); // 'all' | 'upcoming' | 'past'
    // }
  }

  // click handling
  btns.forEach(b => {
    b.addEventListener('click', () => showSubTab(b.dataset.tab));
  });

  // initial state (ensure Upcoming by default)
  showSubTab('upcoming');
});






















// ================================
// Client Appointments – renderer
// ================================

//appointment helper created by



const APPT_SECTIONS = {
  all:      document.getElementById('all-appointments'),
  upcoming: document.getElementById('upcoming-appointments'),
  past:     document.getElementById('past-appointments'),
};
const ORDERS_SECTION = document.getElementById('orders-list');

// Small helpers
const fmt2 = (n) => String(n).padStart(2,'0');
function fmtDateTime(dt) {
  if (!dt) return '';
  const d = new Date(dt);
  const y = d.getFullYear();
  const m = fmt2(d.getMonth()+1);
  const day = fmt2(d.getDate());
  let h = d.getHours(), ampm = h>=12 ? 'PM':'AM';
  h = h%12 || 12;
  const min = fmt2(d.getMinutes());
  return `${m}/${day}/${y} • ${h}:${min} ${ampm}`;
}
function safe(v, fb='') { return v ?? fb; }

// ---- get current user (client) via your /check-login
async function getSignedInUser() {
  try {
    const r = await fetch(`${API_BASE}/api/whoami`, {
      credentials: "include",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!r.ok) return null;

    const d = await r.json().catch(() => ({}));
    const id = d.userId || d?.user?._id || d?.user?.id || null;
    if (!id) return null;

    return {
      id,
      email: d?.user?.email || "",
      firstName: d?.user?.firstName || "",
    };
  } catch {
    return null;
  }
}


// Try to find the right key automatically and remember it
let _apptClientKey = null;   // e.g., "Client", "clientId", "clientUserId", "Email", "clientEmail"



/**
 * Fetch appointments and filter by the signed-in client.
 * We do ONE request by name (dataType=Appointment) and filter locally.
 * When we learn your exact field, we can switch to a precise server-side filter.
 */
// replace your fetchClientAppointments with this temporary name-based filter
// fetch ONLY the current client's appointments
function rowsFromAnyPayload(data) {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.items)) return data.items;
  if (Array.isArray(data.records)) return data.records;
  if (Array.isArray(data.data)) return data.data;
  return [];
}

// Pull an id out of many ref shapes
function refIdAny(x) {
  if (!x) return "";
  if (typeof x === "string") return x.trim();
  if (Array.isArray(x)) return refIdAny(x[0]);
  if (typeof x === "object") {
    return String(
      x.recordId || x.refId || x._id || x.id || x.value ||
      x.values?._id || x.values?.id || ""
    ).trim();
  }
  return "";
}

// Pull an email out of many shapes
function emailAny(x) {
  if (!x) return "";
  if (typeof x === "string" && x.includes("@")) return x.trim().toLowerCase();
  if (Array.isArray(x)) return emailAny(x[0]);
  if (typeof x === "object") {
    const v = x.values || x;
    const e = v.email || v.Email || v["Client Email"] || v.clientEmail || "";
    return String(e || "").trim().toLowerCase();
  }
  return "";
}

function appointmentMatchesClient(row, myId, myEmailLow) {
  const v = row?.values || row || {};

  // Check MANY possible client fields (string id, ref object, etc.)
  const idCandidates = [
    v.clientUserId,
    v.clientUser,
    v.clientId,
    v["Client User Id"],
    v["ClientUserId"],
    v["Client User"],
    v["Client"],
    v["Client Ref"],
    v.Client,
    v.client,
    v.Customer,
    v.customer,
  ]
    .map(refIdAny)
    .filter(Boolean)
    .map(String);

  const emailCandidates = [
    v.clientEmail,
    v["Client Email"],
    v.email,
    v.Email,
    v.ClientEmail,
    v.Client && emailAny(v.Client),
    v.client && emailAny(v.client),
    v["Client"] && emailAny(v["Client"]),
  ]
    .map(x => String(x || "").trim().toLowerCase())
    .filter(Boolean);

  // If appointments store AuthUser id anywhere, match it
  if (myId && idCandidates.includes(String(myId))) return true;

  // If appointments store client email anywhere, match it
  if (myEmailLow && emailCandidates.includes(myEmailLow)) return true;

  return false;
}

// Fetch ONLY the current client's appointments (server-compatible)
async function fetchClientAppointments(clientId, clientEmail) {
  const myId = String(clientId || "").trim();
  const myEmailLow = String(clientEmail || "").trim().toLowerCase();

  // Try authenticated endpoint first (if session works)
  const urls = [
    `${API_BASE}/api/records/Appointment?limit=500&ts=${Date.now()}`,
    `${API_BASE}/public/records?dataType=Appointment&limit=500&ts=${Date.now()}`,
  ];

  let rows = [];
  for (const url of urls) {
    try {
      const r = await fetch(url, {
        credentials: "include",
        headers: { Accept: "application/json" },
        cache: "no-store",
      });

      if (!r.ok) continue;

      const data = await r.json().catch(() => ({}));
      rows = rowsFromAnyPayload(data);
      if (rows.length) break;
    } catch (e) {
      console.warn("[appt] fetch failed:", url, e);
    }
  }

  if (!rows.length) {
    console.log("[appt] no rows returned from API");
    return [];
  }

  const filtered = rows.filter(row => appointmentMatchesClient(row, myId, myEmailLow));

  console.log("[appt] filtered →", filtered.length, "of", rows.length);
  if (!filtered.length) {
    console.log("[appt] sample values keys:", Object.keys((rows[0]?.values) || {}));
    console.log("[appt] sample values:", rows[0]?.values);
  }

  return filtered;
}


//appointment card helper
// Turn strings/objects/arrays into a readable name
function nameOf(x) {
  if (!x) return "";
  if (typeof x === "string") return x;
  if (Array.isArray(x)) return x.map(nameOf).filter(Boolean).join(", ");
  if (typeof x === "object") {
    // common places a name might live
    return (
      x.name || x.title || x.label ||
      x.values?.name || x.values?.Name ||
      x.businessName || x.calendarName || x.serviceName ||
      // last resort: show short id
      (x._id ? `#${String(x._id).slice(-5)}` : "")
    );
  }
  return String(x);
}

//Fetch Business Name helper
// Resolve the Business display name from the API once if not already known
// Fetch Business Name helper (PLAIN JS — no type annotations)
// ---- Business name cache (avoid refetching the same id)
const BizNameCache = new Map();

async function getBusinessNameById(bizId) {
  if (!bizId) return "";
  if (BizNameCache.has(bizId)) return BizNameCache.get(bizId);

  const ORIGIN = API_BASE;

  const url =
    `${ORIGIN}/public/records?dataType=Business&_id=${encodeURIComponent(bizId)}&limit=1`;

  try {
    const r = await fetch(url, {
      credentials: "include",
      headers: { Accept: "application/json" },
    });
    if (!r.ok) {
      BizNameCache.set(bizId, "");
      return "";
    }

    const data = await r.json().catch(() => ({}));
    const rec =
      Array.isArray(data) ? data[0] :
      (data && (data.items?.[0] || data.records?.[0])) || null;

    const v = rec?.values || rec || {};
    const name = v.Name || v.name || v.title || v.businessName || v.displayName || "";

    BizNameCache.set(bizId, name ? String(name) : "");
    return BizNameCache.get(bizId);
  } catch {
    BizNameCache.set(bizId, "");
    return "";
  }
}

function getServiceLineFromApptRow(row) {
  const v = row?.values || row || {};

  // ✅ BEST: already stored on the appointment at booking time
  const direct =
    v.ServiceNames ||
    v["Service Names"] ||
    v.ServiceName ||
    v["Service Name"] ||
    v.serviceName;

  if (direct) return String(direct);

  // Try embedded service refs (if any)
  const embedded = extractServicesLabel(v);
  if (embedded) return embedded;

  // Last resort: if only IDs exist, try cache-based resolve
  const ids = extractServiceIdsFromAppt(row);
  return ids.length ? "" : "";
}



// helper: prefer provided strings, fall back to nested obj.name, else ""
// REPLACE your old nameOf / pickName with this:
function pickName(str, ref) {
  if (str) return str;
  if (!ref) return "";
  if (Array.isArray(ref)) {
    return ref.map(r => pickName("", r)).filter(Boolean).join(", ");
  }
  const v = (ref && (ref.values || ref)) || {};
  return v.Name || v.name || v.title || "";
}

// Normalize one Appointment helper
function extractServicesLabel(v) {
  const raw =
    v["Service(s)"] ||
    v["Services"] ||
    v["Service"] ||
    v.services ||
    v.service ||
    v.Service;

  if (!raw) return "";

  const arr = Array.isArray(raw) ? raw : [raw];

  const names = arr.map((item) => {
    // If we have an id, check cache
    const id =
      typeof item === "string"
        ? item
        : item?.recordId || item?.refId || item?._id || item?.id || "";

    if (id && window.serviceCache?.has(String(id))) {
      const svc = window.serviceCache.get(String(id));
      const nm = pickServiceNameFromAny(svc);
      if (nm) return nm;
    }

    // Otherwise try to read embedded name on the ref object itself
    const nm = pickServiceNameFromAny(item);
    return nm || "";
  });

  return names.filter(Boolean).join(", ");
}



// Normalize one Appointment row to a uniform shape
// ✅ helper (you referenced extractRefId but didn’t define it here)
function extractRefId(ref) {
  if (!ref) return "";
  if (typeof ref === "string") return ref;
  if (Array.isArray(ref)) return extractRefId(ref[0]);
  return String(ref.recordId || ref.refId || ref._id || ref.id || "").trim();
}

function buildStartISOFromAppt(v) {
  const dateISO =
    v.Date || v.date || v.dateISO || v["Date (ISO)"] || v["Appointment Date"] || "";

  const timeRaw =
    v.StartTime || v["Start Time"] || v.Time || v.time || v.start || v.Start || "";

  if (!dateISO) return null;

  if (!timeRaw) return `${String(dateISO).slice(0, 10)}T00:00`;

  const dStr = String(dateISO).slice(0, 10);
  const tStr = String(timeRaw).trim();

  if (/am|pm/i.test(tStr)) {
    const d = new Date(`${dStr} ${tStr}`);
    return isNaN(d.getTime()) ? `${dStr}T00:00` : d.toISOString();
  }

  const hhmm = tStr.match(/^\d{1,2}:\d{2}/)?.[0];
  if (hhmm) return `${dStr}T${hhmm}`;

  return `${dStr}T00:00`;
}

// Normalize one Appointment row to a uniform shape
function normalizeAppointment(a) {
  const v = (a && (a.values || a)) || {};

  // ---- Business / Location reference (flexible)
  const bizRef = v.Business || v.business || v.Location || v.location || null;

  const businessId =
    (typeof extractRefId === "function" ? extractRefId(bizRef) : "") ||
    String(v.businessId || v.BusinessId || v.locationId || v.LocationId || "");

  // ---- Service ids
  const serviceIds = extractServiceIdsFromAppt(a);

  console.log("[appt] extracted serviceIds:", serviceIds);
  console.log("[appt] raw service value:", v["Service(s)"] || v.Services || v.Service || v.services);

  console.log("[appt] business ref raw:", bizRef);
  console.log("[appt] businessId:", businessId);
  console.log("[appt] service ids:", serviceIds);

  console.log("[appt] service fields:",
    v["Service(s)"], v["Services"], v["Service"], v.services, v.service, v.Service
  );

  const businessName =
    v.businessName ||
    v["Business Name"] ||
    v.locationName ||
    (bizRef && (bizRef.values?.["Business Name"] || bizRef.values?.Name || bizRef.name)) ||
    "";

  const businessSlug =
    v.businessSlug ||
    v.slug ||
    v.bookingSlug ||
    (bizRef && (bizRef.values?.slug || bizRef.slug?.current || bizRef.slug)) ||
    "";

  const calendarName =
    v.calendarName || v.Calendar?.name || v.Calendar?.values?.Name || "";

  // ✅ service line (make sure this helper exists)
  const serviceName = getServiceLineFromApptRow(a);

  const canceled = Boolean(v["is Canceled"] ?? v.isCanceled ?? v.canceled ?? false);
  const hold     = Boolean(v.Hold ?? v.hold ?? false);

  // ✅ KEY FIX: compute start reliably
  const start =
    buildStartISOFromAppt(v) ||
    v.start ||
    v.startTime ||
    v.dateTime ||
    v.date ||
    null;

  // ✅ log BEFORE return
  console.log("[normalize] start:", start, "id:", a._id || a.id);

  return {
    id: a._id || a.id || "",
    businessId,
    businessSlug,
    businessName,
    calendarName,
    serviceName,
    serviceIds,
    durationMin: v.durationMin ?? v.Duration ?? v.duration ?? "",
    price: v.price ?? v.amount ?? "",
    start,
    canceled,
    hold,
  };
}

// ---- Render one card (uses your CSS classes)
//Date Helper
function formatDate(dateStr) {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const options = { month: "short", day: "numeric", year: "numeric" }; // e.g. Oct 31, 2025
  return date.toLocaleDateString("en-US", options);
}
function formatDateTimeLocal(isoLike) {
  if (!isoLike) return ["", ""];
  const d = new Date(isoLike);
  const date = d.toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric"
  });
  const time = d.toLocaleTimeString("en-US", {
    hour: "numeric", minute: "2-digit"
  });
  return [date, time];
}

function renderAppointmentCard(appt) {
  const [datePart, timePart] = formatDateTimeLocal(appt.start);
  const when  = [datePart, timePart].filter(Boolean).join(" • ");
  const price = appt.price !== '' ? `$${Number(appt.price).toFixed(2)}` : '';
  const dur   = appt.durationMin ? `${appt.durationMin} min` : '';

    // 🟩 create the ROW WRAPPER (main + info)
  const row = document.createElement('div');
  row.className = 'appt-row'; // new wrapper

  const el = document.createElement('div');
  el.className = 'appointment-card';
  if (appt.businessSlug) el.dataset.businessSlug = appt.businessSlug;

  el.innerHTML = `
 <div class="pro-card">
  <div class="biz-name" data-biz-label>${escapeHtml(appt.businessName || "—")}</div>
</div>


    <div class="appointment-info">
   <h3 data-services-title>
  ${appt.serviceName ? `Services: ${escapeHtml(appt.serviceName)}` : "Services: …"}
</h3>


      <p>${when}${dur ? ' • ' + dur : ''}${price ? ' • ' + price : ''}</p>
    </div>

    <div class="appointment-actions">
      <button type="button" class="btn-reschedule">Reschedule</button>
      <button type="button" class="btn-cancel">Cancel</button>
    </div>
  `;
// ✅ Fill services title after render (handles service refs that are only {_id})
const titleEl = el.querySelector("[data-services-title]");
if (titleEl) {
  titleEl.textContent = `Services: ${appt.serviceName || "—"}`;
}


  // prevent card navigation when clicking actions
  el.querySelector('.appointment-actions')?.addEventListener('click', e => {
    e.stopPropagation();
  });

  // RESCHEDULE handler (open your modal/flow)
  const resBtn = el.querySelector('.btn-reschedule');
  resBtn?.addEventListener('click', async (e) => {
    e.preventDefault();
 e.stopPropagation();

  if (appt.businessSlug) {
    // deep link: booking page will detect & lock service/calendar
    location.href = `/${appt.businessSlug}?reschedule=${encodeURIComponent(appt.id)}`;
  } else if (appt.businessId) {
    // resolve slug then navigate (fallback)
    getBusinessSlugById(appt.businessId).then(slug => {
      if (slug) location.href = `/${slug}?reschedule=${encodeURIComponent(appt.id)}`;
    });
  }
});

   
  // CANCEL handler (your existing code)
  const cancelBtn = el.querySelector('.btn-cancel');
  cancelBtn?.addEventListener('click', async (e) => {
    e.preventDefault();
    if (!confirm('Cancel this appointment?')) return;
    cancelBtn.disabled = true;
    const old = cancelBtn.textContent;
    cancelBtn.textContent = 'Canceling…';
    const ok = await cancelAppointment(appt.id);
    if (ok) el.remove();
    else { cancelBtn.disabled = false; cancelBtn.textContent = old; }
  });

  // Fill missing business name asynchronously
  if ((!appt.businessName || appt.businessName === '—') && appt.businessId) {
    getBusinessNameById(appt.businessId).then(name => {
      if (!name) return;
      const nameEl = el.querySelector('[data-biz-label]');
      if (nameEl) nameEl.textContent = name;
    });
  }

  // Card click -> go to booking page
  el.addEventListener('click', async (e) => {
    if (e.target.closest('.appointment-actions')) return;
    if (appt.businessSlug) { location.href = `/${appt.businessSlug}`; return; }
    if (appt.businessId) {
      const slug = await getBusinessSlugById(appt.businessId);
      if (slug) location.href = `/${slug}`;
    }
  });


  
  return el;
}



async function resolveServiceNamesByIds(ids) {
  const uniq = Array.from(new Set((ids || []).map(String))).filter(Boolean);
  if (!uniq.length) return "";

  await Promise.all(uniq.map((id) => fetchServiceById(id)));

  const names = uniq
    .map((id) => pickServiceNameFromRecord(window.serviceCache.get(id)))
    .filter(Boolean);

  return names.join(", ");
}


// ---- Filter and paint
// Helpers
const toMillis = (d) => (d instanceof Date ? d : new Date(d)).getTime();
const isValid  = (t) => Number.isFinite(t);

// Split + sort with options
function splitByTab(list){
  const now = Date.now();
 const norm = list
  .map((row, i) => {
    // ✅ log raw appointment once
    console.groupCollapsed(`[appt raw #${i}] id=${row?._id || row?.id}`);
    console.log("ROW:", row);
    console.log("VALUES:", row?.values);
    console.log("keys(values):", Object.keys(row?.values || {}));
    console.log("Service(s) field:", row?.values?.["Service(s)"]);
    console.log("Services field:", row?.values?.Services);
    console.log("Service field:", row?.values?.Service);
    console.log("business fields:", {
      Business: row?.values?.Business,
      business: row?.values?.business,
      Location: row?.values?.Location,
      businessId: row?.values?.businessId,
    });
    console.groupEnd();

    return normalizeAppointment(row);
  })
  .filter(a => a.start);


  // drop canceled from “active” views
  const active = norm.filter(a => !a.canceled);

  const upcoming = active
    .filter(a => new Date(a.start).getTime() >= now)
    .sort((a,b)=> new Date(a.start) - new Date(b.start));

  const past = active
    .filter(a => new Date(a.start).getTime() < now)
    .sort((a,b)=> new Date(b.start) - new Date(a.start));

  const all = [...upcoming, ...past];
  return { all, upcoming, past };
}

function mountList(targetEl, items) {
  if (!targetEl) return;
  targetEl.innerHTML = '';
  if (!items.length) {
    targetEl.innerHTML = `<p style="color:#666;">No appointments yet.</p>`;
    return;
  }
  const grid = document.createElement('div');
  grid.className = 'appointments-grid';
  items.forEach(a => grid.appendChild(renderAppointmentCard(a)));
  targetEl.appendChild(grid);
}

// ---- Public function you can call after switching sub-tabs
window.fetchAndRenderClientAppointments = async function ({ filter = "upcoming" } = {}) {
  const user = await getSignedInUser();
  if (!user) {
    mountList(APPT_SECTIONS.all, []);
    mountList(APPT_SECTIONS.upcoming, []);
    mountList(APPT_SECTIONS.past, []);
    hasAnyAppointments = false;
    updateMainTabs();
    return;
  }

  // ✅ LOAD SERVICES FIRST so normalizeAppointment can resolve names
  await loadServiceCache();
console.log("[dashboard] window.serviceCache size:", window.serviceCache.size);
console.log("[dashboard] first cached service:", window.serviceCache.values().next().value);
console.log("[serviceCache] size:", window.serviceCache.size);
const firstKey = window.serviceCache.keys().next().value;
console.log("[serviceCache] first key:", firstKey);
console.log("[serviceCache] first value:", window.serviceCache.get(firstKey));
console.log("[serviceCache] first name:", pickServiceNameFromRecord(window.serviceCache.get(firstKey)));

  const raw = await fetchClientAppointments(user.id, user.email);
  const buckets = splitByTab(raw, {
    includeCanceled: true,
    includeHolds: true,
  });

  hasAnyAppointments = buckets.all.length > 0;

  mountList(APPT_SECTIONS.all, buckets.all);
  mountList(APPT_SECTIONS.upcoming, buckets.upcoming);
  mountList(APPT_SECTIONS.past, buckets.past);

  updateMainTabs();
};



// Initial paint: load appointments + orders, then decide tabs
document.addEventListener("DOMContentLoaded", () => {
  // 1) Initial data load
  window.fetchAndRenderClientAppointments({ filter: "upcoming" });
  window.fetchAndRenderClientOrders();

  // 2) Wire the Orders tab to refresh orders when clicked
  const ordersTab = document.querySelector(
    '.tab-button[data-tab="orders-tab"]'
  );
  if (ordersTab) {
    ordersTab.addEventListener("click", () => {
      userSelectedMainTab = "orders-tab";
      // updateMainTabs will show the correct tab
      window.fetchAndRenderClientOrders();
      updateMainTabs();
    });
  }

  const apptTab = document.querySelector(
    '.tab-button[data-tab="appointments-tab"]'
  );
  if (apptTab) {
    apptTab.addEventListener("click", () => {
      userSelectedMainTab = "appointments-tab";
      window.fetchAndRenderClientAppointments({ filter: "upcoming" });
      updateMainTabs();
    });
  }
});
















//Navigate to booking page helper
const BizSlugCache = new Map();

async function getBusinessSlugById(bizId) {
  if (!bizId) return "";
  if (BizSlugCache.has(bizId)) return BizSlugCache.get(bizId);

  const ORIGIN = API_BASE;

  const url =
    `${ORIGIN}/public/records?dataType=Business&_id=${encodeURIComponent(bizId)}&limit=1`;

  try {
    const r = await fetch(url, {
      credentials: "include",
      headers: { Accept: "application/json" },
    });
    if (!r.ok) {
      BizSlugCache.set(bizId, "");
      return "";
    }

    const data = await r.json().catch(() => ({}));
    const rec =
      Array.isArray(data) ? data[0] :
      (data && (data.items?.[0] || data.records?.[0])) || null;

    const v = rec?.values || rec || {};
    const slug = v.slug?.current || v.slug || v.Slug?.current || v.Slug || "";

    BizSlugCache.set(bizId, slug ? String(slug) : "");
    return BizSlugCache.get(bizId);
  } catch {
    BizSlugCache.set(bizId, "");
    return "";
  }
}

// ================================
// Cancel Appointment
// ================================
async function cancelAppointment(id) {
  if (!id) return false;

  const ORIGIN =
    (typeof API_BASE !== "undefined" && API_BASE) ||
    (typeof API !== "undefined" && API) || "";

  const urls = [
    // 1) what you're using now (may 404)
    `${ORIGIN}/api/records/Appointment/${encodeURIComponent(id)}`,
    // 2) fallback: plain /api/records/:id (very common pattern)
    `${ORIGIN}/api/records/${encodeURIComponent(id)}`,
  ];

  for (const url of urls) {
    try {
      const res = await fetch(url, {
        method: "PATCH",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ values: { "is Canceled": true } }),
      });

      if (res.ok) {
        console.log("[cancel] ok via", url);
        return true;
      }

      const txt = await res.text().catch(() => "");
      console.warn("[cancel] failed at", url, res.status, txt);

      // if it was a 404 on the first URL, loop will try the next URL
      if (res.status === 404) continue;

      // some other error: don't keep trying
      return false;
    } catch (e) {
      console.error("[cancel] error at", url, e);
      // go try next URL
    }
  }

  return false;
}



// ================================
// Reschedule soft-hold helper
// ================================
async function holdAppointment(id, on = true) {
  if (!id) return false;

  const ORIGIN =
    (typeof API_BASE !== "undefined" && API_BASE) ||
    (typeof API !== "undefined" && API) || "";

  const urls = [
    `${ORIGIN}/api/records/Appointment/${encodeURIComponent(id)}`,
    `${ORIGIN}/api/records/${encodeURIComponent(id)}`,
  ];

  for (const url of urls) {
    try {
      const r = await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ values: { Hold: !!on } }),
      });
      if (r.ok) {
        console.log("[hold] ok via", url);
        return true;
      }
      const txt = await r.text().catch(() => "");
      console.warn("[hold] failed at", url, r.status, txt);
      if (r.status === 404) continue;
      return false;
    } catch (e) {
      console.error("[hold] error at", url, e);
    }
  }

  return false;
}




















// ================================
// Orders – real Order DataType
// ================================
async function fetchClientOrders() {
  try {
    const user = await getSignedInUser();
    if (!user) {
      console.warn("[orders] not logged in");
      return [];
    }

    // Use /api/me/records scoped to this user, with myRefField=Customer
   const params = new URLSearchParams({
  dataType: "Order",
  includeCreatedBy: "1",
  includeRefField: "1",  // ✅ this is the important one
  myRefField: "Customer",
  limit: "100",
});


    const r = await fetch(`${API_BASE}/api/me/records?` + params.toString(), {
      credentials: "include",
      headers: { Accept: "application/json" },
    });

    if (!r.ok) {
      console.warn("[orders] HTTP", r.status);
      return [];
    }

    const body = await r.json().catch(() => ({}));
    const rows = Array.isArray(body.data) ? body.data : (Array.isArray(body.items) ? body.items : []);
    console.log("[orders] rows:", rows);

    // 🔍 log the latest order's values to inspect Thumbnail
if (rows.length) {
  const last = rows[rows.length - 1];
  console.log("[orders] last order values:", last.values || last);
}

    return rows;
  } catch (e) {
    console.error("[orders] error", e);
    return [];
  }
}

// Try very hard to find a Link Page slug for this order
// Try very hard to find the Link Page slug for an Order, Link, or Link Page
function resolveLinkPageSlug(v) {
  if (!v || typeof v !== "object") return "";

  // Direct references on the Order
  const linkPageRef = v["Link Page"] || v.linkPage || null;
  const linkRef     = v.Link || v.link || null;
  const productRef  = v.Product || v.product || null;

  // 1️⃣ Direct slug fields on THIS object
  const directSlug =
    v["Link Page Slug"] ||
    v["linkPageSlug"] ||
    v["Page Slug"] ||
    v["Slug"] ||          // <– handle Link Page / Link values directly
    v["slug"] ||
    "";
  if (directSlug) return String(directSlug);

  // Helper: pull slug off any ref object
  function extractSlugFromRef(ref) {
    if (!ref) return "";

    // simple string slug
    if (typeof ref === "string" && ref.trim() && !ref.includes(" ")) {
      return ref.trim();
    }

    const obj = (ref && (ref.values || ref)) || {};
    if (typeof obj !== "object") return "";

    // common patterns
    if (obj.slug && typeof obj.slug === "object") {
      return obj.slug.current || obj.slug.slug || "";
    }
    if (typeof obj.slug === "string") return obj.slug;

    if (obj.Slug && typeof obj.Slug === "object") {
      return obj.Slug.current || obj.Slug.slug || "";
    }
    if (typeof obj.Slug === "string") return obj.Slug;

    if (obj["Link Page Slug"]) return obj["Link Page Slug"];

    // also allow plain "Slug"/"slug" on the nested value
    if (obj["Slug"]) return obj["Slug"];
    if (obj["slug"]) return obj["slug"];

    return "";
  }

  // 2️⃣ Prefer the Link Page ref directly on the Order
  const fromLinkPage = extractSlugFromRef(linkPageRef);
  if (fromLinkPage) return fromLinkPage;

  // 3️⃣ Try nested Link → Link Page
  let nestedLinkPage = null;
  if (linkRef && typeof linkRef === "object") {
    const lv = linkRef.values || linkRef;
    nestedLinkPage = lv["Link Page"] || lv.linkPage || null;
  }
  const fromNested = extractSlugFromRef(nestedLinkPage);
  if (fromNested) return fromNested;

  // 4️⃣ Try the Link record itself
  const fromLink = extractSlugFromRef(linkRef);
  if (fromLink) return fromLink;

  // 5️⃣ OPTIONAL: Product (for store pages later)
  const fromProduct = extractSlugFromRef(productRef);
  if (fromProduct) return fromProduct;

  return "";
}



// Read fields from Order (not Product)
// Read fields from Order (not Product)
function renderOrderCard(order) {
  const v = order.values || order;

  const productRef  = v.Product || v.product || null;
  const linkRef     = v.Link || v.link || null;
  const linkPageRef = v["Link Page"] || v.linkPage || null;

  // MAIN title: prefer Product Name saved on Order, else Product/Link titles
  const productTitle =
    v["Product Name"] ||
    productRef?.values?.Title ||
    productRef?.Title ||
    linkRef?.values?.["Link Title"] ||
    linkRef?.values?.Title ||
    linkRef?.Title ||
    "Order";

  const linkPageName =
    v["Link Page Name"] ||
    linkPageRef?.values?.["Link Page Name"] ||
    linkPageRef?.values?.Title ||
    linkPageRef?.Title ||
    "";

  const price     = v["Sale Price"] ?? v["Price"] ?? "";
  const priceText =
    price !== "" && price != null ? `$${Number(price).toFixed(2)}` : "";

  const purchasedDate = v["Purchased Date"] || "";
  const when = purchasedDate ? formatDate(purchasedDate) : "";

  // 🔹 Image: try Order.Thumbnail → Product.Default Image
  const productImgObj =
    v["Thumbnail"] ||
    productRef?.values?.["Default Image"] ||
    productRef?.["Default Image"] ||
    null;

  const thumbUrl = resolveImageUrl(productImgObj);

  // First, try to resolve a slug from whatever we already have
  let slug = resolveLinkPageSlug(v);
  console.log("[orders] resolved slug for card (initial):", slug);

  const hasLinkish = !!(linkPageRef || linkRef); // only link-based orders get the button

  const card = document.createElement("div");
  card.className = "order-card";

  card.innerHTML = `
    <div class="order-main">
      <div class="order-left">
        ${
          thumbUrl
            ? `<div class="order-thumb-sm">
                 <img src="${escapeHtml(thumbUrl)}" alt="${escapeHtml(
                 productTitle
               )}" />
               </div>`
            : ""
        }
        <div class="order-text">
          <h3 class="order-title">${escapeHtml(productTitle)}</h3>
          ${
            linkPageName
              ? `<p class="order-link-page">from ${escapeHtml(
                  linkPageName
                )}</p>`
              : ""
          }
          ${
            when
              ? `<p class="order-date">Purchased: ${escapeHtml(when)}</p>`
              : ""
          }
          ${
            priceText
              ? `<p class="order-price">${escapeHtml(priceText)}</p>`
              : ""
          }
      
        </div>
      </div>

      <div class="order-right">
        <button type="button" class="order-details-btn">Details</button>
        ${
          hasLinkish
            ? `<button type="button" class="order-open-link-btn">Source</button>`
            : ""
        }
      </div>
    </div>
  `;

  // DETAILS → open popup
  const detailsBtn = card.querySelector(".order-details-btn");
  if (detailsBtn) {
    detailsBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      openOrderDetailsModal(order);
    });
  }

  const openBtn  = card.querySelector(".order-open-link-btn");
  const slugSpan = card.querySelector(".order-slug-value");

  if (openBtn) {
    openBtn.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();

      // 1️⃣ Try whatever we already know
      let currentSlug = resolveLinkPageSlug(v);

      // 2️⃣ If still empty, fetch the Link, then Link Page
      if (!currentSlug && linkRef && linkRef._id) {
        const fullLink = await fetchLinkById(linkRef._id);
        if (fullLink) {
          currentSlug = resolveLinkPageSlug(fullLink.values || fullLink || {});
        }
      }

      if (!currentSlug && linkPageRef && linkPageRef._id) {
        const fullLP = await fetchLinkPageById(linkPageRef._id);
        if (fullLP) {
          currentSlug = resolveLinkPageSlug(fullLP.values || fullLP || {});
        }
      }

      if (currentSlug) {
        // update the debug text if it was "(none)"
        if (slugSpan) slugSpan.textContent = currentSlug;
        window.location.href = `/${currentSlug}`;
      } else {
        alert("We couldn’t find the link page for this order yet.");
      }
    });
  }

  return card;
}



function mountOrdersList(items) {
  if (!ORDERS_SECTION) return;
  ORDERS_SECTION.innerHTML = "";

  if (!items.length) {
    ORDERS_SECTION.innerHTML =
      `<p style="color:#666;">No orders yet.</p>`;
    return;
  }

  const grid = document.createElement("div");
  grid.className = "orders-grid";
  items.forEach((o) => grid.appendChild(renderOrderCard(o)));
  ORDERS_SECTION.appendChild(grid);
}

// Single public function used everywhere
window.fetchAndRenderClientOrders = async function () {
  if (!ORDERS_SECTION) return;

  ORDERS_SECTION.innerHTML = "<p>Loading your orders…</p>";

  const orders = await fetchClientOrders();
  hasAnyOrders = orders.length > 0;
  mountOrdersList(orders);
  updateMainTabs();
};


// ===== Order Details Modal =====
const orderOverlay   = document.getElementById("order-details-overlay");
const odTitle        = document.getElementById("od-title");
const odLinkPage     = document.getElementById("od-link-page");
const odDate         = document.getElementById("od-date");
const odPrice        = document.getElementById("od-price");
const odDesc         = document.getElementById("od-desc");
const odOpenLink     = document.getElementById("od-open-link");
const odCloseBtn     = document.getElementById("order-details-close");
const odThumb        = document.getElementById("od-thumb");
const odThumbImg     = document.getElementById("od-thumb-img");

const odDownloads    = document.getElementById("od-downloads");

if (odCloseBtn) {
  odCloseBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    closeOrderDetailsModal();
  });
}

// Optional: click outside to close
if (orderOverlay) {
  orderOverlay.addEventListener("click", (e) => {
    if (e.target === orderOverlay) {
      closeOrderDetailsModal();
    }
  });
}

// Optional: Esc key closes modal
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    closeOrderDetailsModal();
  }
});

function closeOrderDetailsModal() {
  if (!orderOverlay) return;
  orderOverlay.style.display = "none";
  document.body.classList.remove("popup-open");
}

// Fetch a single Link record by _id so we can read its Result Files / Digital downloads
async function fetchLinkById(linkId) {
  if (!linkId) return null;

  const params = new URLSearchParams({
    dataType: "Link",
    _id: linkId,
    includeRefField: "1",
    limit: "1",
  });

  const urls = [
    `${API_BASE}/api/records?${params.toString()}`,
    `${API_BASE}/public/records?${params.toString()}`,
  ];

  for (const url of urls) {
    try {
      const r = await fetch(url, {
        credentials: "include",
        headers: { Accept: "application/json" },
      });
      if (!r.ok) continue;

      const data = await r.json().catch(() => null);
      console.log("[orders] link query raw:", data);

      const rec =
        Array.isArray(data) ? data[0] :
        (data && (data.records?.[0] || data.items?.[0])) ||
        null;

      if (rec) {
        console.log("[orders] link query link.values:", rec.values || rec);
        return rec;
      }
    } catch (e) {
      console.warn("[orders] link query error", e);
    }
  }

  return null;
}

// Fetch a single Product record by _id so we can read Digital downloads
async function fetchProductById(productId) {
  if (!productId) return null;

  // 🔹 Use ONLY the query-style endpoints (avoid /api/records/:id so we don't get 404s)
  const params = new URLSearchParams({
    dataType: "Product",
    _id: productId,
    includeRefField: "1",
    limit: "1",
  });

  const urls = [
    `${API_BASE}/api/records?${params.toString()}`,
    `${API_BASE}/public/records?${params.toString()}`,
  ];

  for (const url of urls) {
    try {
      const r = await fetch(url, {
        credentials: "include",
        headers: { Accept: "application/json" },
      });
      if (!r.ok) continue;

      const data = await r.json().catch(() => null);
      console.log("[orders] product query raw:", data);

      const rec =
        Array.isArray(data) ? data[0] :
        (data && (data.records?.[0] || data.items?.[0])) ||
        null;

      if (rec) {
        console.log(
          "[orders] product query product.values:",
          rec.values || rec
        );
        return rec;
      }
    } catch (e) {
      console.warn("[orders] product query error", e);
    }
  }

  return null;
}

// Fetch a single Link Page record by _id so we can read its Slug
async function fetchLinkPageById(linkPageId) {
  if (!linkPageId) return null;

  const params = new URLSearchParams({
    dataType: "Link Page",
    _id: linkPageId,
    includeRefField: "1",
    limit: "1",
  });

  const urls = [
    `${API_BASE}/api/records?${params.toString()}`,
    `${API_BASE}/public/records?${params.toString()}`,
  ];

  for (const url of urls) {
    try {
      const r = await fetch(url, {
        credentials: "include",
        headers: { Accept: "application/json" },
      });
      if (!r.ok) continue;

      const data = await r.json().catch(() => null);
      console.log("[orders] link page query raw:", data);

      const rec =
        Array.isArray(data) ? data[0] :
        (data && (data.records?.[0] || data.items?.[0])) ||
        null;

      if (rec) {
        console.log("[orders] link page.values:", rec.values || rec);
        return rec;
      }
    } catch (e) {
      console.warn("[orders] link page query error", e);
    }
  }

  return null;
}

async function openOrderDetailsModal(order) {
  if (!orderOverlay) return;

  const v = order.values || order;

  console.log("[order modal] values:", v);

  const productRef  = v.Product || v.product || null;
  const linkRef     = v.Link || v.link || null;
  const linkPageRef = v["Link Page"] || v.linkPage || null;

  // 🧾 Title
  const title =
    v["Product Name"] ||
    productRef?.values?.Title ||
    productRef?.Title ||
    linkRef?.values?.["Link Title"] ||
    linkRef?.values?.Title ||
    linkRef?.Title ||
    "Order";

  const linkPageName =
    v["Link Page Name"] ||
    linkPageRef?.values?.["Link Page Name"] ||
    linkPageRef?.values?.Title ||
    linkPageRef?.Title ||
    "";

  const price    = v["Sale Price"] ?? v["Price"] ?? "";
  const priceStr =
    price !== "" && price != null ? `$${Number(price).toFixed(2)}` : "";

  const purchasedDate = v["Purchased Date"] || "";
  const dateStr = purchasedDate ? `Purchased: ${formatDate(purchasedDate)}` : "";

  const desc =
    productRef?.values?.Description ||
    productRef?.Description ||
    v.Description ||
    "";

  const slug =
    v["Link Page Slug"] ||
    // 🔹 Try Link Page first (this is probably where yours lives)
    linkPageRef?.values?.Slug?.current ||
    linkPageRef?.values?.Slug ||
    linkPageRef?.slug?.current ||
    linkPageRef?.slug ||
    linkPageRef?.Slug ||
    // 🔹 Then try Link itself
    linkRef?.values?.Slug?.current ||
    linkRef?.values?.Slug ||
    linkRef?.slug?.current ||
    linkRef?.slug ||
    linkRef?.Slug ||
    "";


  // 🖼 Image: use Thumbnail on Order, else Product.Default Image
  const productImgObj =
    v["Thumbnail"] ||
    productRef?.values?.["Default Image"] ||
    productRef?.["Default Image"] ||
    null;

  const thumbUrl = resolveImageUrl(productImgObj);

  // 🔹 Fill in text fields
  if (odTitle)    odTitle.textContent = title;
  if (odLinkPage) odLinkPage.textContent = linkPageName
    ? `from ${linkPageName}`
    : "";
  if (odDate)     odDate.textContent = dateStr;
  if (odPrice)    odPrice.textContent = priceStr ? `Price: ${priceStr}` : "";
  if (odDesc)     odDesc.textContent = desc || "";

  // 🔹 Set image visibility
  if (odThumb && odThumbImg) {
    if (thumbUrl) {
      odThumb.style.display = "flex";
      odThumbImg.setAttribute("src", thumbUrl);
      odThumbImg.setAttribute("alt", title);
    } else {
      odThumb.style.display = "none";
      odThumbImg.removeAttribute("src");
      odThumbImg.removeAttribute("alt");
    }
  }

  // 🔹 Open link button
  if (odOpenLink) {
    if (slug) {
      odOpenLink.style.display = "";
      odOpenLink.href = `/${slug}`;
    } else {
      odOpenLink.style.display = "none";
    }
  }
console.log("[order modal] RAW order values:", v);
console.log("[order modal] RAW Product ref:", productRef);
console.log("[order modal] RAW Link ref:", linkRef);

console.log(
  "[order modal] order downloads fields:",
  v["Digital downloads"],
  v["Result Files"]
);

if (productRef?.values) {
  console.log(
    "[order modal] productRef download fields:",
    productRef.values["Digital downloads"],
    productRef.values["Result Files"]
  );
}

if (linkRef?.values) {
  console.log(
    "[order modal] linkRef download fields:",
    linkRef.values["Digital downloads"],
    linkRef.values["Result Files"]
  );
}

// 🔹 Downloads section
// 🔹 Downloads section (merge from Order, Product, and Link)
if (odDownloads) {
  odDownloads.innerHTML = ""; // clear each time

  const collected = [];

  function addFromRaw(raw) {
    if (!raw) return;

    if (Array.isArray(raw)) {
      raw.forEach((f) => addFromRaw(f));
      return;
    }

    if (typeof raw === "string") {
      collected.push({ url: raw, name: "Download" });
      return;
    }

    if (typeof raw === "object") {
      const url = raw.url || raw.path || "";
      const name = raw.name || raw.filename || raw.originalname || "";
      if (!url) return;
      collected.push({ url, name });
    }
  }

  // 1️⃣ From the Order itself
  addFromRaw(v["Downloads"]);
  addFromRaw(v["Digital downloads"]);
  addFromRaw(v["Digital Downloads"]);
  addFromRaw(v["Result Files"]);
  addFromRaw(v["Result File"]);

  // 2️⃣ From the Product reference on the order (if it came populated)
  if (productRef && productRef.values) {
    const pv = productRef.values;
    addFromRaw(pv["Digital downloads"]);
    addFromRaw(pv["Digital Downloads"]);
    addFromRaw(pv["Downloads"]);
    addFromRaw(pv["Result Files"]);
    addFromRaw(pv["Result File"]);
  }

  // 3️⃣ From the Link reference on the order (if it came populated)
  if (linkRef && linkRef.values) {
    const lv = linkRef.values;
    addFromRaw(lv["Digital downloads"]);
    addFromRaw(lv["Digital Downloads"]);
    addFromRaw(lv["Downloads"]);
    addFromRaw(lv["Result Files"]);
    addFromRaw(lv["Result File"]);
  }

  // 4️⃣ If still nothing, try fetching the Product by id
  // 4️⃣ Also fetch Product + Link by id to pull any files stored there
  (async () => {
    // 🔹 Product files
    if (productRef?._id) {
      const prod = await fetchProductById(productRef._id);
      if (prod) {
        const pv = prod.values || prod;
        console.log("[order modal] product.values for downloads:", pv);
        addFromRaw(pv["Digital downloads"]);
        addFromRaw(pv["Digital Downloads"]);
        addFromRaw(pv["Downloads"]);
        addFromRaw(pv["Result Files"]);
        addFromRaw(pv["Result File"]);
      }
    }

    // 🔹 Link files (this is where your 2 digital downloads live)
    if (linkRef?._id) {
      const linkRec = await fetchLinkById(linkRef._id);
      if (linkRec) {
        const lv = linkRec.values || linkRec;
        console.log("[order modal] link.values for downloads:", lv);
        addFromRaw(lv["Digital downloads"]);
        addFromRaw(lv["Digital Downloads"]);
        addFromRaw(lv["Downloads"]);
        addFromRaw(lv["Result Files"]);
        addFromRaw(lv["Result File"]);
      }
    }

    // 🔹 De-dupe by url+name so the same file doesn’t appear twice
    const seen = new Set();
    const deduped = [];
    collected.forEach((f) => {
      const key = `${f.url}::${f.name || ""}`;
      if (f.url && !seen.has(key)) {
        seen.add(key);
        deduped.push(f);
      }
    });

    console.log("[order modal] collected downloads:", deduped);

    if (deduped.length) {
      const wrapper = document.createElement("div");
      wrapper.className = "order-downloads-wrapper";

      const heading = document.createElement("h4");
      heading.textContent = "Downloads";
      wrapper.appendChild(heading);

      const list = document.createElement("ul");
      list.className = "order-downloads";

      deduped.forEach((f, idx) => {
        const url = f.url || "";
        if (!url) return;

        const fullUrl = url.startsWith("http") ? url : `${API_BASE}${url}`;
        const label = f.name || `File ${idx + 1}`;

        const li = document.createElement("li");
        const a = document.createElement("a");
        a.href = fullUrl;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        a.textContent = label;
        a.download = "";

        li.appendChild(a);
        list.appendChild(li);
      });

      wrapper.appendChild(list);
      odDownloads.appendChild(wrapper);
      odDownloads.style.display = "";
    } else {
      odDownloads.style.display = "none";
    }
  })();
}


  // 🔹 Show overlay
  orderOverlay.style.display = "flex";
  document.body.classList.add("popup-open");
}
