let currentWeekDates = [];
let currentEditAppointmentId = null;
let lastEditedBusinessId = null;

// Global cache of normalized appointments
window.__appts = window.__appts || [];

///////////logs out if logged out
(function(){
  const CH_NAME = 'suite_auth_channel';
  const bc = ('BroadcastChannel' in window) ? new BroadcastChannel(CH_NAME) : null;

  // Emit an auth event to other tabs/pages
  function emitAuth(type, payload = {}) {
    const evt = { type, payload, ts: Date.now() };
    try { localStorage.setItem('__auth_evt__', JSON.stringify(evt)); } catch {}
    if (bc) bc.postMessage(evt);
  }

  // Handle incoming auth events
  async function handleAuthEvent(evt) {
    if (!evt || !evt.type) return;
    // Cheap: just refresh the header + optionally reload
    try {
      const r = await fetch('/check-login', { credentials: 'include', cache: 'no-store' });
      const data = await r.json().catch(() => ({}));
      window.__auth = data;
      // If you want a hard refresh when auth changes:
      location.reload();
      // Or: call your own renderHeader(data) instead of reloading
    } catch {}
  }

  // Listen via BroadcastChannel and localStorage
  if (bc) bc.onmessage = (e) => handleAuthEvent(e.data);
  window.addEventListener('storage', (e) => {
    if (e.key === '__auth_evt__' && e.newValue) {
      try { handleAuthEvent(JSON.parse(e.newValue)); } catch {}
    }
  });

  // Expose small helpers you can call from your existing code:
  window.AUTHBUS = {
    loginHappened(userId){ emitAuth('login', { userId: String(userId || '') }); },
    logoutHappened(){ emitAuth('logout'); }
  };

  // Light heartbeat: revalidate session when tab becomes visible
  document.addEventListener('visibilitychange', async () => {
    if (!document.hidden) {
      try {
        const r = await fetch('/check-login', { credentials: 'include', cache: 'no-store' });
        const data = await r.json().catch(() => ({}));
        // If your UI relies on /check-login, re-render or update header here.
        // Example: if logged out elsewhere, you’ll catch it now too.
        if (!data.loggedIn && window.location.pathname !== '/signup.html') {
          // optional: show login popup or redirect
        }
      } catch {}
    }
  });

  // Optional: periodic re-check (e.g., session expiry)
  setInterval(async () => {
    try {
      await fetch('/check-login', { credentials: 'include', cache: 'no-store' });
    } catch {}
  }, 2 * 60 * 1000);
})();
////////////////////////////////////////////////////

// ---- helpers to normalize ids (place near your other helpers) ----
const _asId = v => !v ? '' : (typeof v === 'string' ? v : String(v._id || v.id || v.value || ''));
const _bizIdFromValues = v => {
  const b = v?.Business ?? v?.['Business Id'] ?? v?.businessId;
  return _asId(b);
};

// ---- fetch ALL businesses for a set of ids (one request) ----
async function fetchBusinessesByIds(ids) {
  if (!ids || !ids.length) return new Map();
  const qs = new URLSearchParams({
    where: JSON.stringify({ _id: { $in: ids } }),
    limit: '1000',
    includeRefField: '1',
    ts: Date.now().toString()
  });
  const r = await fetch(`/api/records/Business?${qs}`, { credentials: 'include', cache: 'no-store' });
  const rows = r.ok ? await r.json() : [];
  const map = new Map();
  (rows || []).forEach(b => {
    const v = b.values || {};
    const label = v['Business Name'] || v['Name'] || v['businessName'] || v['name'] || '(Untitled)';
    const owner = b.Owner || v.Owner || null;
    map.set(String(b._id), { name: label, ownerId: _asId(owner), ownerRaw: owner });
  });
  return map;
}

// ---- main logger (export to window so you can call it) ----
async function logClientOwnership(clientRows) {
  const arr = Array.isArray(clientRows) ? clientRows : [];
  const bizIds = Array.from(new Set(arr.map(r => _bizIdFromValues(r.values || {})).filter(Boolean)));
  const bizMap = await fetchBusinessesByIds(bizIds);

  console.group(`[CLIENT OWNERSHIP] ${arr.length} clients`);
  arr.forEach(c => {
    const v = c.values || {};
    const bizId = _bizIdFromValues(v) || '(none)';
    const bizInfo = bizMap.get(String(bizId)) || {};
    console.log({
      clientId : c._id,
      name     : `${v['First Name']||''} ${v['Last Name']||''}`.trim() || v['Client Name'] || '(Client)',
      businessId: bizId,
      businessName: bizInfo.name || '(Unknown Business)',
      businessOwnerId: bizInfo.ownerId || '(no owner on Business)',
      clientCreatedBy: c.createdBy || '(none)',
      rawBusiness: v['Business']
    });
  });
  console.groupEnd();
}
window.logClientOwnership = logClientOwnership; // <-- so you can call it from DevTools





async function queryRecords(typeName, where = {}, opts = {}) {
  const body = {
    typeName,
    where,
    limit: opts.limit ?? 1000,
    sort:  opts.sort  ?? { "Date": 1, "Time": 1, "createdAt": 1 }
  };
  const r = await fetch('/api/records/query', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!r.ok) throw new Error(`queryRecords ${typeName}: HTTP ${r.status}`);
  return r.json();
}

async function getRecordById(typeName, id) {
  const r = await fetch(`/api/records/${encodeURIComponent(typeName)}/${encodeURIComponent(id)}?ts=${Date.now()}`, {
    credentials: 'include',
    headers: { Accept: 'application/json' }
  });
  if (!r.ok) throw new Error(`getRecordById ${typeName}: HTTP ${r.status}`);
  return r.json();
}







// Global error hooks (so other errors don't silently stop later code)
window.onerror = function (msg, src, line, col, err) {
  console.error("[window.onerror]", { msg, src, line, col, err });
};
window.addEventListener("unhandledrejection", (event) => {
  console.error("[unhandledrejection]", event.reason || event);
});

// globals used across pages
(function () {
  if (!window.API) window.API = (t) => `/api/records/${encodeURIComponent(t)}`;
  if (!window.TYPE_UPCOMING) window.TYPE_UPCOMING = 'Upcoming Hours';
})();


// Login Popup
function openLoginPopup() {
  document.getElementById("popup-login").style.display = "block";
  document.getElementById("popup-overlay").style.display = "block";
  document.body.classList.add("popup-open");
}

function closeLoginPopup() {
  document.getElementById("popup-login").style.display = "none";
  document.getElementById("popup-overlay").style.display = "none";
  document.body.classList.remove("popup-open");
}

window.closeLoginPopup = closeLoginPopup;

const loginBtn = document.getElementById("open-login-popup-btn"); // ✅ Keep this ONE
if (loginBtn) {
  loginBtn.addEventListener("click", () => openLoginPopup());
}

// Handle login form submission
const loginForm = document.getElementById("login-form");
if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    
    const email = document.getElementById("login-email").value.trim();
    const password = document.getElementById("login-password").value.trim();

    if (!email || !password) {
      alert("Please enter both email and password.");
      return;
    }

    try {
      const res = await fetch("/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const result = await res.json();

    if (res.ok) {
  alert("✅ Logged in!");
  closeLoginPopup();

  // 🔔 Tell other tabs/pages about the login
  try { window.AUTHBUS?.loginHappened(result.userId || ''); } catch {}

  // Refresh this page’s UI
  window.location.reload();
}
 else {
        alert(result.message || "Login failed.");
      }
    } catch (err) {
      console.error("Login error:", err);
      alert("Something went wrong during login.");
    }
  });
}


// Show user name after login
document.addEventListener("DOMContentLoaded", async () => {
  const headerRight = document.querySelector(".right-group");
  if (!headerRight) return;

  try {
    const res = await fetch("/check-login", { credentials: "include", cache: "no-store" });
    const data = await res.json();
    console.log("[DEBUG] /check-login response:", data);

    if (!data || !data.loggedIn) return;

    // 🔐 user switch guard — clear caches if account changed
    const uid = String(data.userId || '');
    const lastUid = sessionStorage.getItem('__uid') || '';
    if (uid && lastUid && uid !== lastUid) {
      sessionStorage.clear();
      localStorage.removeItem('appointmentsBusinessId');
      window.__appts = [];
      window.location.reload();
      return;
    }
    if (uid) sessionStorage.setItem('__uid', uid);

    // 👋 display name
    const chosen =
      (data.firstName || "").trim() ||
      (data.name || "").trim() ||
      "there";

    console.log("[DEBUG] chosen display name:", chosen);

    headerRight.innerHTML = `
      Hi, ${chosen} 👋 
      <button class="blk-btn" id="logout-btn">Logout</button>
    `;

  document.getElementById("logout-btn")?.addEventListener("click", async () => {
  const r = await fetch("/logout", { credentials: "include" });
  if (r.ok) {
    // 🔔 Tell other tabs/pages about the logout
    try { window.AUTHBUS?.logoutHappened(); } catch {}

    alert("👋 Logged out!");
    window.location.href = "/signup.html";
  }
});

  } catch (err) {
    console.error("[DEBUG] /check-login fetch failed:", err);
  }
});

async function getMyBusinessIds(myUserId) {
  if (!myUserId) return [];
  // Try owner by id OR nested owner in values — keep both.
  const where = { $or: [
    { Owner: myUserId },               // if you store owner at top-level
    { 'values.Owner': myUserId },      // if you store owner inside values
    { Owner: { _id: myUserId } },      // ref object form
    { 'values.Owner._id': myUserId },
  ]};

  try {
    const rows = await queryRecords('Business', where, { limit: 1000, sort: { createdAt: -1 }});
    return (rows||[])
      .map(b => String(b._id || b.id || b?.values?._id || ''))
      .filter(Boolean);
  } catch (e) {
    console.warn('[getMyBusinessIds] fallback to public list', e);
    try {
    const pub = await publicList('Business', { where, ts: Date.now() });
      return (pub||[])
        .map(b => String(b._id || b.id || b?.values?._id || ''))
        .filter(Boolean);
    } catch {
      return [];
    }
  }
}

  ////////////////////Menu Section/////////////////////
 //show busineesses in dropdown 
  document.addEventListener("DOMContentLoaded", () => {
  loadUserBusinesses(); // Call it on page load

    const dropdown = document.getElementById("business-dropdown");
const addApptBtn = document.getElementById("open-appointment-popup-btn");

if (dropdown && addApptBtn) {
  dropdown.addEventListener("change", () => {
    if (dropdown.value === "all") {
      addApptBtn.disabled = true;
      addApptBtn.title = "Select a specific business to add appointments";
    } else {
      addApptBtn.disabled = false;
      addApptBtn.title = "";
    }
  });

  // ✅ Optional: default to disabled if "all" is default
  if (dropdown.value === "all" || !dropdown.value) {
    addApptBtn.disabled = true;
    addApptBtn.title = "Select a specific business to add appointments";
  }
}

});

//change the name in the menu section 
// Safely update the label next to the business select (if it exists)
// and reload the calendar appointments.
function updateBusinessHeadingAndReload() {
  const dd = document.getElementById('business-dropdown');
  if (!dd) return;

  const heading = document.getElementById('selected-business-name'); // may be null
  const val   = dd.value;
  const label = dd.options[dd.selectedIndex]?.textContent?.trim() || '';

  if (heading) {
    if (!val || val === 'all') {
      heading.textContent = '📅 All Appointments';
    } else {
      heading.textContent = label || 'Choose business to manage';
    }
  }

  // This keeps your calendar in sync; does not affect popup logic.
  loadAppointments();
}

// Change event → update + reload
document.getElementById('business-dropdown')?.addEventListener('change', updateBusinessHeadingAndReload);

// Initial paint on page load so the label/calendar match the current selection
document.addEventListener('DOMContentLoaded', updateBusinessHeadingAndReload);

// DONE Function to fetch and display user's businesses
async function loadUserBusinesses() {
  const dropdown = document.getElementById("business-dropdown");
  if (!dropdown) return;

  // Default option
  dropdown.innerHTML = `<option value="all">📅 All Appointments</option>`;

  try {
    // Optional: sort newest first; tweak if you prefer alpha by name
    const sort = encodeURIComponent(JSON.stringify({ createdAt: -1 }));
    const res = await fetch(`${API('Business')}?limit=500&sort=${sort}&ts=${Date.now()}`, {
      credentials: 'include',
      cache: 'no-store'
    });

    if (res.status === 401) {
      console.warn('Not logged in');
      return; // or show a login prompt
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const rows = await res.json();

    // Helper: tolerate different field labels
    const getName = (v) =>
      v?.['Business Name'] ??
      v?.['Name'] ??
      v?.businessName ??
      v?.name ??
      '(Untitled)';

    // Filter out soft-deleted, map, and sort by name
    const items = (rows || [])
      .filter(r => !r.deletedAt)
      .map(r => ({ id: r._id, name: getName(r.values || {}) }))
      .sort((a, b) => a.name.localeCompare(b.name));

    // Populate dropdown
    for (const { id, name } of items) {
      const opt = document.createElement('option');
      opt.value = id;
      opt.textContent = name;
      dropdown.appendChild(opt);
    }

    // (Optional) restore last selection
    const saved = sessionStorage.getItem('appointmentsBusinessId') || 'all';
    if (dropdown.querySelector(`option[value="${saved}"]`)) {
      dropdown.value = saved;
    }

    // (Optional) remember selection
    if (!dropdown.dataset.bound) {
      dropdown.addEventListener('change', () => {
        sessionStorage.setItem('appointmentsBusinessId', dropdown.value || 'all');
      });
      dropdown.dataset.bound = '1';
    }

  } catch (err) {
    console.error("❌ Failed to load businesses:", err);
    alert("Could not load your businesses.");
  }
}


//////////////////////Calendar/////////////////////////////////
// ---------------- Load Appointments Function ----------------
//DONE
function parseHHMM(time24) {
  // expects "HH:MM" (24h). If not, try Date to parse.
  if (/^\d{2}:\d{2}$/.test(time24)) {
    const [h, m] = time24.split(":").map(n => parseInt(n, 10));
    return { h, m };
  }
  const d = new Date(`1970-01-01 ${time24}`);
  return { h: d.getHours(), m: d.getMinutes() };
}

function addMinutes(h, m, delta) {
  let total = h * 60 + m + (delta || 0);
  total = ((total % (24*60)) + (24*60)) % (24*60); // keep in day
  return { h: Math.floor(total / 60), m: total % 60 };
}

function format12h(h, m) {
  const ampm = h >= 12 ? "PM" : "AM";
  const hh = ((h + 11) % 12) + 1; // 0 -> 12, 13 -> 1, etc
  const mm = String(m).padStart(2, "0");
  return `${hh}:${mm} ${ampm}`;
}

// once, near your helpers
let __slotHeightPx = null;
function getSlotHeightPx() {
  if (__slotHeightPx != null) return __slotHeightPx;
  const a = getTopOffsetFromTime("08:15");
  const b = getTopOffsetFromTime("08:00");
  __slotHeightPx = Math.abs(a - b) || 24; // fallback if measure fails
  return __slotHeightPx;
}
function escapeHtml(s) {
  return String(s || "").replace(/[&<>"']/g, m => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[m]));
}
function getClientName(appt) {
  const v = appt.values || appt || {};
  const dn   = (v['Client Name'] || '').trim();                // server-propagated
  const fn   = (v['Client First Name'] || '').trim();
  const ln   = (v['Client Last Name']  || '').trim();
  const full = [fn, ln].filter(Boolean).join(' ').trim();
  const email= (v['Client Email'] || v.clientEmail || '').trim();
  return dn || full || (email ? email.split('@')[0] : 'Client');
}
// Column measurements based on the actual rendered width
function getColumnMetrics() {
  const grid = document.querySelector('.time-slots-container');
  if (!grid) return { colW: 0, gap: 0 };

  const rect = grid.getBoundingClientRect();
  const cols = 7;

  // If you draw 1px vertical separators, set gap=1. Otherwise leave 0.
  const gap = 1;

  const innerW = Math.floor(rect.width);
  const colW = Math.floor((innerW - gap * (cols - 1)) / cols);
  return { colW, gap };
}

// Reflow card widths/lefts when the window resizes
function reflowAppointmentCards() {
  const grid = document.querySelector('.time-slots-container');
  if (!grid) return;

  const { colW, gap } = getColumnMetrics();
  if (!colW) return;

  document.querySelectorAll('.appointment-card').forEach(card => {
    const dayIndex = Number(card.dataset.dayIndex || 0);
    card.style.left  = `${Math.round(dayIndex * (colW + gap))}px`;
    card.style.width = `${colW}px`;
  });
}

// tiny debounce
function debounce(fn, ms=100) {
  let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}
window.addEventListener('resize', debounce(reflowAppointmentCards, 120));

// ONE canonical version — works with both raw records and normalized appts
// Single source of truth
function getClientName(rec) {
  const v = rec?.values || rec || {};

  // A) denormalized
  const dn = (v.clientName || v["Client Name"] || "").trim();
  if (dn) return dn;

  // B) expanded Client ref
  const cref = v.Client || v["Client"];
  if (cref) {
    const cv = cref.values || cref;
    const fn = (cv["First Name"] || cv.firstName || "").trim();
    const ln = (cv["Last Name"]  || cv.lastName  || "").trim();
    const nm = (cv["Name"] || cv.name || cv["Client Name"] || `${fn} ${ln}`.trim()).trim();
    if (nm) return nm;
  }

  // C) map fallback
  const cid = v.clientId || (v.Client && (v.Client._id || v.Client.id)) || "";
  if (cid && window.__clientMap && window.__clientMap[cid]) return window.__clientMap[cid];

  // D) email
  return (v["Client Email"] || v.clientEmail || "").trim() || "(No client)";
}

function getApptId(a) {
  return String(
    (a && (a._id || a.id)) ||
    (a && a.values && (a.values._id || a.values.id)) ||
    ''
  );
}


function renderAppointmentsOnGrid(appts, maps = {}) {
  const container =
    document.getElementById("appointments-grid") ||
    document.getElementById("calendar-grid") ||
    document.getElementById("appointments-list");
  if (!container) return;

  container.innerHTML = "";

  const serviceMap = maps.serviceMap || window.__serviceMap || {};

  appts.forEach(appt => {
    const card = document.createElement("div");
  card.className = "appt-card";
 const apptId = getApptId(appt);
 card.dataset.id = apptId;
 console.debug('[card bind id][appt-card]', apptId, appt);
    card.innerHTML = buildApptCardContent(appt, serviceMap);
 card.addEventListener('click', () => {
   if (!apptId) return console.warn('no id on card click', appt);
   openAppointmentEditor(apptId);
 });
    // ✅ height = exact number of 15-minute slots
    const minutes  = Number(appt.duration) || 0;        // <-- use appt.duration
    const blocks   = Math.max(1, Math.ceil(minutes / 15)); // 15→1, 30→2, 45→3, 60→4
    const slotPx   = getSlotHeightPx();
    const heightPx = blocks * slotPx - 1; // -1 so it doesn’t touch next slot border

    card.style.height    = `${heightPx}px`;
    card.style.boxSizing = "border-box";
    card.style.overflow  = "hidden";
    card.style.margin    = "0";
    card.style.padding   = "4px 6px";

    container.appendChild(card);
  });
}



function buildApptCardContent(appt, serviceMap) {
  // times
  const { h, m } = parseHHMM(appt.time || "00:00");
  const dur = Number(appt.duration) || 0;
  const end = addMinutes(h, m, dur);
  const startLabel = format12h(h, m);
  const endLabel   = format12h(end.h, end.m);

  // client
const clientLabel = getClientName(appt);


  // services list
const serviceNames = (appt.serviceIds || [])
  .map(id => lookupName(serviceMap, id))
  .filter(Boolean);



  const servicesHtml = serviceNames.length
    ? `<ul class="appt-services">${serviceNames.map(n => `<li>${n}</li>`).join("")}</ul>`
    : `<ul class="appt-services"><li>(No service)</li></ul>`;

return `
  <div class="appt-time">${startLabel} – ${endLabel}</div>
  <div class="appt-client">${escapeHtml(clientLabel || "(No client)")}</div>
  ${servicesHtml}
`;
}



// tiny helper to read values by multiple possible labels
function getV(v, ...keys) {
  for (const k of keys) {
    if (v?.[k] !== undefined && v[k] !== null) return v[k];
  }
  return undefined;
}

// optional: if your page has a current month view, set these somewhere:
//   window.apptYear = 2025
//   window.apptMonth = 7   // 0=Jan
function ymd(d) {
  const p = n => String(n).padStart(2,'0');
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`;
}
function lookupName(map, id) {
  if (!map) return undefined;
  const key = String(id);
  if (map instanceof Map) return map.get(key) ?? map.get(id);
  if (typeof map === "object") return map[key] ?? map[id];
  return undefined;
}

// Small helpers you can place near the top of your file once
function getId(ref) {
  if (!ref) return "";
  if (typeof ref === "string") return ref;
  if (typeof ref === "object") return String(ref._id || ref.id || "");
  return "";
}
function normalizeRefArray(val) {
  if (!val) return [];
  const arr = Array.isArray(val) ? val : [val];
  return arr
    .map(x => (typeof x === 'object' ? (x._id || x.id) : x))
    .filter(Boolean)
    .map(String);
}
function recordMatchesBusiness(rec, bizId) {
  if (!bizId || bizId === "all") return true;
  const b = rec?.values?.["Business"];
  if (!b) return false;
  if (typeof b === "string") return b === bizId;
  if (typeof b === "object" && b._id) return String(b._id) === String(bizId);
  return false;
}
function getColumnMetrics() {
  const grid = document.querySelector('.time-slots-container');
  if (!grid) return { colW: 0, gap: 0 };

  const rect = grid.getBoundingClientRect();
  const cols = 7;
  const gap  = 1; // set to 1 if you draw 1px vertical grid lines, else 0
  const innerW = Math.floor(rect.width);
  const colW = Math.floor((innerW - gap * (cols - 1)) / cols);
  return { colW, gap };
}

// one helper near the top
function is405(e){ return /HTTP 405/i.test(String(e && e.message)); }

async function fetchAppointments(whereObj, limit = 1000, sortObj = { "Date": 1, "Time": 1, "createdAt": 1 }) {
  return queryRecords('Appointment', whereObj || {}, {
    limit,
    sort: sortObj,
    includeRefField: 1
  });
}


function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}


// ---- Load & render appointments (robust to ref shapes)
// Helper: local Y-M-D for safe week matching
function ymdLocal(d){
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

// Helper: is a record cancelled?
function isCanceled(v){
  const flag = v?.["is Canceled"] ?? v?.isCanceled ?? v?.cancelled ?? v?.canceled;
  if (flag === true || String(flag).toLowerCase() === "true") return true;
  const status = String(v?.["Appointment Status"] ?? v?.Status ?? "").toLowerCase();
  return status === "cancelled" || status === "canceled";
}

// Normalize one record -> appt object your grid expects
function normalizeAppt(r, clientMap = {}) {
  const v = r.values || r;
  const rid = r._id || r.id || v?._id;
  const clientId = getId(v["Client"]);
  const rawSvc =
    v["Service(s)"] ?? v["Services"] ?? v["Service"] ??
    v["Selected Services"] ?? v["Service Ids"] ?? v["Service Id"] ??
    v["serviceIds"] ?? v["serviceId"];

  return {
    _id:      String(rid || ""),
    date:     toYMD(v["Date"] || v["date"] || v["startISO"] || v["start"] || ""),
    time:     toHHMM(v["Time"] || v["time"] || v["Start Time"] || v["startTime"] || ""),
    duration: v["Duration"] ?? v["duration"] ?? 0,
    clientId,
    serviceIds: normalizeRefArray(rawSvc),
    // ✅ keep a denormalized name for fast UI
    clientName: clientMap[String(clientId)] || v["Client Name"] || v.clientName || "",
    businessId: getId(v["Business"]) || v["businessId"] || "",
    calendarId: getId(v["Calendar"]) || v["calendarId"] || "",
    note: v["Note"] || ""
  };
}


async function fetchCalendarsForBusiness(businessId) {
  const out = new Set();
  // try both shapes for Business filter
  for (const where of [{ "Business": businessId }, { "Business": { _id: businessId } }]) {
    try {
      const qs = new URLSearchParams({
        where: JSON.stringify(where),
        limit: "1000",
        ts: Date.now().toString()
      });
      const r = await fetch(`/api/records/Calendar?${qs}`, {
        credentials: "include",
        cache: "no-store",
        headers: { Accept: "application/json" }
      });
      if (r.ok) {
        const arr = await r.json();
        (arr || []).forEach(row => {
          const id = row?._id || row?.id || row?.values?._id;
          if (id) out.add(String(id));
        });
      }
    } catch {}
  }
  return [...out];
}

// ---- Load & render appointments with PUBLIC fallback ----
async function loadAppointments() {
  try {
    // 👤 who am I?
    const loginMeta = await fetch("/check-login", { credentials: "include", cache: "no-store" })
      .then(r => r.json())
      .catch(() => null);
    const myId = loginMeta?.userId ? String(loginMeta.userId) : "";

    // 🧭 current business filter
    const businessId = document.getElementById("business-dropdown")?.value || "all";

    // If "all", limit to MY businesses only
    let allowedBizIds = [];
    if (businessId === "all") {
      allowedBizIds = await getMyBusinessIds(myId);
      if (!allowedBizIds.length) {
        // Friendly empty state if user owns nothing
        window.__appts = [];
        renderAppointmentsOnGrid([]);
        console.log("[debug] no owned businesses; showing empty list");
        return;
      }
    }

    // ---- Build date window (week preferred) ----
    let whereBase = {};
    const ymdLocal = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    if (Array.isArray(window.currentWeekDates) && window.currentWeekDates.length === 7) {
      const start = ymdLocal(window.currentWeekDates[0]);
      const end   = ymdLocal(window.currentWeekDates[6]);
      whereBase["Date"] = { "$gte": start, "$lte": end };
    } else if (Number.isInteger(window.apptYear) && Number.isInteger(window.apptMonth)) {
      const s = new Date(window.apptYear, window.apptMonth, 1);
      const e = new Date(window.apptYear, window.apptMonth + 1, 0);
      whereBase["Date"] = { "$gte": ymdLocal(s), "$lte": ymdLocal(e) };
    }

    const filterByWindowAndBiz = (rows) => (rows || []).filter(r => {
      const v = r.values || r;
      if (isCanceled(v)) return false;

      // date window
      const raw = (v.Date || v.date || v.startISO || v.start || "").toString();
      const day = raw.includes("T") ? raw.slice(0,10) : raw;
      const gte = whereBase?.Date?.["$gte"];
      const lte = whereBase?.Date?.["$lte"];
      if (gte && day < gte) return false;
      if (lte && day > lte) return false;

      // business restriction
      if (businessId !== "all") {
        return recordMatchesBusiness({ values: v }, businessId);
      } else {
        // When "all", only include appts if they belong to my owned businesses
        return recordMatchesAnyBusiness({ values: v }, allowedBizIds);
      }
    });

    // Convenient matcher for many businesses
    function recordMatchesAnyBusiness(rec, ids) {
      try {
        const v = rec?.values || rec || {};
        const bid = v?.Business?._id || v?.Business || v?.businessId || v?.business?._id;
        if (!bid) return false;
        return ids.includes(String(bid));
      } catch {
        return false;
      }
    }

    // ---- 1) PRIVATE by Business (try both "Date" and "date") ----
    let privateRows = [];
    const dateFilter = whereBase.Date ? whereBase.Date : null;

    const privateWheres = [];
    if (businessId !== "all") {
      if (dateFilter) {
        privateWheres.push({ Business: businessId,                  Date: dateFilter });
        privateWheres.push({ Business: businessId,                  date: dateFilter });
        privateWheres.push({ Business: { _id: businessId },         Date: dateFilter });
        privateWheres.push({ Business: { _id: businessId },         date: dateFilter });
      } else {
        privateWheres.push({ Business: businessId });
        privateWheres.push({ Business: { _id: businessId } });
      }
    } else {
      // "All" → query each allowed business id
      const bizIds = allowedBizIds;
      if (bizIds.length) {
        for (const bid of bizIds) {
          if (dateFilter) {
            privateWheres.push({ Business: bid,             Date: dateFilter });
            privateWheres.push({ Business: bid,             date: dateFilter });
            privateWheres.push({ Business: { _id: bid },    Date: dateFilter });
            privateWheres.push({ Business: { _id: bid },    date: dateFilter });
          } else {
            privateWheres.push({ Business: bid });
            privateWheres.push({ Business: { _id: bid } });
          }
        }
      } else {
        // should not happen due to early return, but keep a safe guard
        privateWheres.push({ Date: dateFilter });// harmless no-op
      }
    }

    for (const w of privateWheres) {
      try {
        const rows = await fetchAppointments(w).catch(() => []);
        if (rows && rows.length) privateRows.push(...rows);
      } catch {}
    }

    // ---- 2) PRIVATE by Calendar (fallback if ACL limits Business list) ----
    let extraPriv = [];
    if (businessId !== "all") {
      const calIds = await fetchCalendarsForBusiness(businessId);
      if (calIds.length) {
        const chunks = [];
        for (const calId of calIds) {
          chunks.push(
            fetchAppointments({ ...whereBase, "Calendar": calId }).catch(() => []),
            fetchAppointments({ ...whereBase, "Calendar": { _id: calId } }).catch(() => [])
          );
        }
        const nested = await Promise.all(chunks);
        extraPriv = nested.flat().filter(Boolean);
      }
    } else {
      // For "all", expand calendars of *my* businesses only
      const allCalIdSets = await Promise.all(allowedBizIds.map(fetchCalendarsForBusiness));
      const allCalIds = [...new Set(allCalIdSets.flat())];
      if (allCalIds.length) {
        const chunks = [];
        for (const calId of allCalIds) {
          chunks.push(
            fetchAppointments({ ...whereBase, "Calendar": calId }).catch(() => []),
            fetchAppointments({ ...whereBase, "Calendar": { _id: calId } }).catch(() => [])
          );
        }
        const nested = await Promise.all(chunks);
        extraPriv = nested.flat().filter(Boolean);
      }
    }

    // ---- 3) PUBLIC fallback (by Business + by Calendar) ----
    let publicRows = [];

    if (businessId !== "all") {
      try {
        const pubByBiz = await publicList("Appointment", { Business: businessId, ts: Date.now() });
        publicRows.push(...filterByWindowAndBiz(pubByBiz));
      } catch {}
      try {
        const calIds = await fetchCalendarsForBusiness(businessId);
        for (const calId of calIds) {
          try {
            const pubByCal = await publicList("Appointment", { Calendar: calId, ts: Date.now() });
            publicRows.push(...filterByWindowAndBiz(pubByCal));
          } catch {}
        }
      } catch {}
    } else {
      // "All" → only calendars from my businesses
      const calIdSets = await Promise.all(allowedBizIds.map(fetchCalendarsForBusiness));
      const allCalIds = [...new Set(calIdSets.flat())];

      const chunks = [];
      for (const calId of allCalIds) {
        // you already try private via extraPriv; add public too
        chunks.push(publicList("Appointment", { Calendar: calId, ts: Date.now() }).catch(() => []));
      }
      const nested = await Promise.all(chunks);
      publicRows.push(...filterByWindowAndBiz(nested.flat().filter(Boolean)));
    }

    // ---- 4) merge + dedupe ----
    const byId = new Map();
    [ ...(privateRows||[]), ...(extraPriv||[]), ...(publicRows||[]) ].forEach(r => {
      const id = String(r._id || r.id || (r.values && r.values._id) || "");
      if (!id) return;
      if (!byId.has(id)) byId.set(id, r);
    });
    const rows = Array.from(byId.values());

    // ---- 5) maps ----
    const includeAll = (businessId === "all");
    const [clientMap, serviceMap] = await Promise.all([
      buildClientMap(businessId === "all" ? allowedBizIds : businessId, includeAll),
      buildServiceMap(businessId === "all" ? allowedBizIds : businessId, includeAll),
    ]);
    if (rows.length) console.log("[debug] raw row values", rows[0].values || rows[0]);

    // ---- 6) normalize + render ----
    const appts = rows
      .filter(r => !isCanceled(r.values || r))
      .map(r => normalizeAppt(r, clientMap));

    if (appts.length) {
      console.log("[debug] sample appt", appts[0], "→ name:", getClientName(appts[0]));
    } else {
      console.log("[debug] no appts in window");
    }

    window.__serviceMap = serviceMap;
    window.__clientMap  = clientMap;
    window.__appts      = appts;

    renderAppointmentsOnGrid(window.__appts, { serviceMap, clientMap });
  } catch (err) {
    console.error("❌ Failed to load appointments:", err);
  }
}



//Buid Calendar ////////
 // render months  
function updateMonthYear() {
  const monthYearDisplay = document.getElementById("month-year");
  if (!monthYearDisplay) return;

  const options = { month: 'long', year: 'numeric' };
  const formattedDate = currentWeekStart.toLocaleDateString(undefined, options);
  monthYearDisplay.textContent = formattedDate;
}


 //  Add the functions to build the grid 
function generateHourColumn() {
  const hourColumn = document.querySelector(".hour-column");
  if (!hourColumn) return;

  hourColumn.innerHTML = ""; // Clear old content

  for (let i = 0; i < 24; i++) {
    const label = document.createElement("div");
    label.classList.add("hour-label");
    label.textContent = i === 0 ? "12 AM" :
                        i < 12 ? `${i} AM` :
                        i === 12 ? "12 PM" :
                        `${i - 12} PM`;
    label.style.height = "60px"; // 4 x 15 min
    hourColumn.appendChild(label);
  }
}
 //  Add the functions to build the grid 
function generateTimeGrid() {
  const container = document.querySelector(".time-slots-container");
  if (!container) return;

  container.innerHTML = ""; // Clear previous

  for (let d = 0; d < 7; d++) {
    const column = document.createElement("div");
    column.classList.add("time-column");

    for (let t = 0; t < 96; t++) {
      const slot = document.createElement("div");
      slot.classList.add("time-slot");

      // Optional: add a border for horizontal lines
      slot.style.borderBottom = "1px solid #eee";
      slot.style.height = "15px";
      
      column.appendChild(slot);
    }

    // Optional: vertical line between day columns
    column.style.borderRight = "1px solid #ddd";

    container.appendChild(column);
  }
}

 //  let arrows change week in calendar
document.getElementById("prev-week").addEventListener("click", () => {
  currentWeekStart.setDate(currentWeekStart.getDate() - 7);
  updateWeekDates(currentWeekStart);
  loadAppointments(); // ✅
  updateWeekOffsetLabel(); 
});

document.getElementById("next-week").addEventListener("click", () => {
  currentWeekStart.setDate(currentWeekStart.getDate() + 7);
  updateWeekDates(currentWeekStart);  // ✅ FIXED
   loadAppointments();
    updateWeekOffsetLabel();
});

document.getElementById("today-btn").addEventListener("click", () => {
  currentWeekStart = new Date();
  updateWeekDates(currentWeekStart);  // ✅ FIXED
   loadAppointments();
    updateWeekOffsetLabel();
});

let currentWeekStart = new Date(); // Tracks which week you're on

function updateWeekDates(startDate) {
  currentWeekDates = [];

  const baseDate = new Date(startDate);
  const dayOfWeek = baseDate.getDay(); // 0 (Sun) - 6 (Sat)
  baseDate.setDate(baseDate.getDate() - dayOfWeek); // Back up to Sunday
  baseDate.setHours(0, 0, 0, 0); // Normalize time

  for (let i = 0; i < 7; i++) {
    const d = new Date(baseDate);
    d.setDate(baseDate.getDate() + i);
    d.setHours(0, 0, 0, 0); // Normalize time again

    currentWeekDates.push(d);

    const dayCell = document.querySelector(`.day-date[data-day="${i}"]`);
    if (dayCell) {
      dayCell.textContent = d.getDate();
    }
  }

  // 🧠 Update the label after updating week
  updateMonthYear();
}
//add 1 week or weeks out under months 
function updateWeekOffsetLabel() {
  const label = document.getElementById("week-offset-label");

  const today = new Date();
  const startOfThisWeek = getStartOfWeek(today);
  const startOfViewedWeek = getStartOfWeek(currentWeekDates[0]);

  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  const weekDiff = Math.round((startOfViewedWeek - startOfThisWeek) / msPerWeek);

  if (weekDiff === 0) {
    label.textContent = ""; // current week, no label
  } else if (weekDiff > 0) {
    label.textContent = `${weekDiff} Week${weekDiff > 1 ? "s" : ""} Out`;
  } else {
    const absDiff = Math.abs(weekDiff);
    label.textContent = `${absDiff} Week${absDiff > 1 ? "s" : ""} Ago`;
  }
}

// Helper: Get the start of the week (Sunday)
function getStartOfWeek(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0 = Sunday
  d.setDate(d.getDate() - day);
  return d;
}

//
function buildHourLabels() {
  const hourCol = document.querySelector(".hour-column");
  if (!hourCol) return;

  hourCol.innerHTML = ""; // Clear old labels

  for (let hour = 0; hour < 24; hour++) {
    const label = document.createElement("div");
    label.className = "hour-label";
    label.textContent = formatHourLabel(hour); // e.g., 12 AM, 1 AM, etc.
    hourCol.appendChild(label);
  }
}

function formatHourLabel(hour) {
  const period = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${displayHour} ${period}`;
}

function buildTimeGrid() {
  const container = document.querySelector(".time-slots-container");
  if (!container) return;

  container.innerHTML = ""; // Clear old grid

  for (let day = 0; day < 7; day++) {
    const column = document.createElement("div");
    column.className = "time-column";

for (let i = 0; i < 96; i++) {
  const slot = document.createElement("div");
  slot.className = "time-slot";

  if (i % 4 === 0) {
    slot.classList.add("hour-start");
  } else if (i % 4 === 1) {
    slot.classList.add("slot-15");
  } else if (i % 4 === 2) {
    slot.classList.add("slot-30");
  } else if (i % 4 === 3) {
    slot.classList.add("slot-45");
  }

  column.appendChild(slot);
}

    container.appendChild(column);
  }
}

/* ---------- TIME HELPERS (paste once) ---------- */
function parseTimeLoose(input) {
  if (input == null) return { h: 0, m: 0 };
  let s = String(input).trim();
  const ampmMatch = s.match(/\b(am|pm)\b/i);
  const hasAMPM = !!ampmMatch;
  const isPM = hasAMPM && /pm/i.test(ampmMatch[1]);
  s = s.replace(/[^0-9:]/g, '');
  const m = s.match(/^(\d{1,2})(?::?(\d{2}))?$/);
  if (!m) return { h: 0, m: 0 };
  let h = parseInt(m[1], 10);
  let min = m[2] ? parseInt(m[2], 10) : 0;
  if (hasAMPM) {
    if (isPM && h !== 12) h += 12;
    if (!isPM && h === 12) h = 0;
  }
  h = Math.max(0, Math.min(23, h));
  min = Math.max(0, Math.min(59, min));
  return { h, m: min };
}

function format12h(h, m) {
  const ap = h >= 12 ? 'PM' : 'AM';
  const hh = ((h + 11) % 12) + 1;
  const mm = String(m).padStart(2, '0');
  return `${hh}:${mm} ${ap}`;
}

function addMinutes(h, m, mins) {
  const total = h * 60 + m + (Number(mins) || 0);
  const H = Math.floor(((total % (24 * 60)) + (24 * 60)) % (24 * 60) / 60);
  const M = ((total % 60) + 60) % 60;
  return { h: H, m: M };
}

function getTopOffsetFromTimeLoose(timeStr, slotHeight = 15) {
  const { h, m } = parseTimeLoose(timeStr);
  const minutesFromMidnight = h * 60 + m;
  // your grid uses 15-min slots at 15px → 1px/minute
  return (minutesFromMidnight / 15) * slotHeight;
}

/* ---------- tiny utilities (paste once) ---------- */
function getDayIndexFromDate(dateStr) {
  // Compare using LOCAL y-m-d so timezones don’t shift the day
  if (Array.isArray(window.currentWeekDates) && window.currentWeekDates.length === 7) {
    const ymdLocal = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    const want = String(dateStr).slice(0,10);
    const idx = window.currentWeekDates.findIndex(d => ymdLocal(d) === want);
    if (idx >= 0) return idx;
  }
  const d = new Date(`${dateStr}T00:00`); // local midnight
  return isNaN(d) ? 0 : d.getDay();
}

function lookupName(map, id) {
  const v = map && map[id];
  if (!v) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'object') {
    return v.name || v['Service Name'] || v.values?.['Service Name'] || v.values?.Name || '';
  }
  return '';
}

async function fetchCalendarsForBusiness(bizId) {
  const ids = new Set();
  const headers = { Accept: "application/json" };

  // Private: try both shapes
  for (const where of [{ Business: bizId }, { Business: { _id: bizId } }]) {
    try {
      const qs = new URLSearchParams({
        where: JSON.stringify(where),
        fields: JSON.stringify(["_id"]),
        limit: "1000",
        ts: Date.now().toString()
      });
      const r = await fetch(`/api/records/Calendar?${qs}`, {
        credentials: "include",
        cache: "no-store",
        headers
      });
      if (r.ok) {
        const arr = await r.json();
        (arr || []).forEach(row => {
          const id = row._id || row.id || row.values?._id;
          if (id) ids.add(String(id));
        });
      }
    } catch {}
  }

  // Public fallback
  try {
    const pub = await publicList("Calendar", { Business: bizId, ts: Date.now() });
    (pub || []).forEach(row => {
      const id = row._id || row.id || row.values?._id;
      if (id) ids.add(String(id));
    });
  } catch {}

  return Array.from(ids);
}
function ymdLocal(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function toYMD(input) {
  if (!input) return "";
  const s = String(input);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10); // already Y-M-D
  const d = new Date(s);
  return isNaN(d) ? "" : ymdLocal(d);
}

function toHHMM(input) {
  const { h, m } = parseTimeLoose(input);
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
}

// --- time helpers (robust) ---
function parseTimeLoose(input) {
  if (input == null) return { h: 0, m: 0 };
  let s = String(input).trim();

  // normalize AM/PM
  const ampmMatch = s.match(/\b(am|pm)\b/i);
  const hasAMPM = !!ampmMatch;
  const isPM = hasAMPM && /pm/i.test(ampmMatch[1]);

  // strip everything except digits, colon, space, am/pm remains in hasAMPM
  s = s.replace(/[^0-9:]/g, '');

  // match H or HH or H:MM / HH:MM
  const m = s.match(/^(\d{1,2})(?::?(\d{2}))?$/);
  if (!m) return { h: 0, m: 0 };

  let h = parseInt(m[1], 10);
  let min = m[2] ? parseInt(m[2], 10) : 0;

  if (hasAMPM) {
    if (isPM && h !== 12) h += 12;
    if (!isPM && h === 12) h = 0;
  }
  h = Math.max(0, Math.min(23, h));
  min = Math.max(0, Math.min(59, min));
  return { h, m: min };
}

function format12h(h, m) {
  const ap = h >= 12 ? 'PM' : 'AM';
  const hh = ((h + 11) % 12) + 1;
  const mm = String(m).padStart(2, '0');
  return `${hh}:${mm} ${ap}`;
}

function addMinutes(h, m, mins) {
  const total = h * 60 + m + (Number(mins) || 0);
  const H = Math.floor(((total % (24 * 60)) + (24 * 60)) % (24 * 60) / 60);
  const M = ((total % 60) + 60) % 60;
  return { h: H, m: M };
}

function getTopOffsetFromTimeLoose(timeStr, slotHeight = 15) {
  const { h, m } = parseTimeLoose(timeStr);
  const minutesFromMidnight = h * 60 + m;
  // your grid uses 15-min slots at 15px each → 1px per minute
  return (minutesFromMidnight / 15) * slotHeight;
}

  /////////////////////Render Appointments as Cards on the Grid//////////
function renderAppointmentsOnGrid(appointments, maps = {}) {
  const grid = document.querySelector(".time-slots-container");
  if (!grid) return;

  // remove previous cards
  document.querySelectorAll(".appointment-card").forEach(el => el.remove());

const currentWeekDatesStr = (currentWeekDates || []).map(d => ymdLocal(new Date(d)));

  const serviceMap = maps.serviceMap || window.__serviceMap || {};

  appointments.forEach(appt => {
   const { _id, date, time, duration } = appt;
    const serviceIds = Array.isArray(appt.serviceIds) ? appt.serviceIds : (appt.serviceIds ? [appt.serviceIds] : []);
    if (!date || !time) return;
    if (!currentWeekDatesStr.includes(date)) return;

    const dayIndex  = getDayIndexFromDate(date);
    

    // compute end time
 

    // service names from map
    const services = serviceIds.map(id => lookupName(serviceMap, id)).filter(Boolean);
    const servicesHtml = services.length
      ? `<ul class="appt-services">${services.map(s => `<li>${s}</li>`).join("")}</ul>`
      : `<ul class="appt-services"><li>(No service)</li></ul>`;

const card = document.createElement("div");
card.className = "appointment-card";
 const apptId = getApptId(appt);
 card.dataset.id = apptId;
 console.debug('[card bind id][appointment-card]', apptId, appt);

card.style.position = "absolute";

// position within the week grid
const topOffset = getTopOffsetFromTimeLoose(
  appt.time ||
  appt.Time ||
  appt.startTime ||
  (appt.values && (appt.values.Time || appt.values['Start Time'])) ||
  ''
);
card.style.top  = `${Math.round(topOffset)}px`;
// compute column width/left in *pixels*
const { colW, gap } = getColumnMetrics();
card.dataset.dayIndex = String(dayIndex);
card.style.left  = `${Math.round(dayIndex * (colW + gap))}px`;
card.style.width = `${colW}px`;


// compute labels (robust parsing)
const timeRaw =
  appt.time ||
  appt.Time ||
  appt.startTime ||
  (appt.values && (appt.values.Time || appt.values['Start Time'])) ||
  '';
const { h, m }  = parseTimeLoose(timeRaw);
const endHM     = addMinutes(h, m,
  Number(appt.duration ?? appt.Duration ?? (appt.values && (appt.values.Duration || appt.values['Service Duration']))) || 0
);
const startLabel = format12h(h, m);
const endLabel   = format12h(endHM.h, endHM.m);

// service names list you already built as `servicesHtml`
 const clientDisplay = getClientName(appt);
 card.innerHTML = `
  <div class="appt-time"><strong>${startLabel} – ${endLabel}</strong></div>
  <div class="appt-client">${escapeHtml(clientDisplay || "(No client)")}</div>
  ${servicesHtml}
`;

card.addEventListener("click", () => {
  if (typeof openAppointmentEditor === "function") {
    openAppointmentEditor(String(_id));
  } else {
    openAppointmentPopup();
  }
});

grid.appendChild(card);


  });
}




                                   // Popup
                                    // Add Client                                   
async function openClientPopup() {
  await populateClientBusinessDropdown();
  document.getElementById("popup-create-client").style.display = "block";
  document.getElementById("popup-overlay").style.display = "block";
  document.body.classList.add("popup-open");
}


function closeClientPopup() {
  document.getElementById("popup-create-client").style.display = "none";
  document.getElementById("popup-overlay").style.display = "none";
  document.body.classList.remove("popup-open");
}

// DONE Show businesses in dropdown 
async function populateClientBusinessDropdown() {
  const dropdown = document.getElementById("client-business");
  if (!dropdown) return;

  // Show a placeholder while loading
  dropdown.innerHTML = `<option value="">-- Choose Business --</option>`;
  dropdown.disabled = true;

  // If you want to mirror the selection from the main business filter
  const selectedOutside = document.getElementById("business-dropdown")?.value || "";

  // helper to read a value by several possible labels
  const getV = (v, ...keys) => {
    for (const k of keys) {
      if (v?.[k] !== undefined && v[k] !== null) return v[k];
    }
    return undefined;
  };

  try {
    const params = new URLSearchParams({
      // sort by name-ish labels if you like
      sort: JSON.stringify({ "Business Name": 1, "Name": 1, createdAt: 1 }),
      limit: "500",
      ts: Date.now().toString()
    });

    const res = await fetch(`/api/records/Business?${params.toString()}`, {
      credentials: "include",
      cache: "no-store"
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const rows = await res.json();

    // Clear and repopulate
    dropdown.innerHTML = `<option value="">-- Choose Business --</option>`;

    (rows || [])
      // hide soft-deleted
      .filter(r => {
        const v = r.values || {};
        const isDeleted = !!getV(v, "is Deleted", "isDeleted");
        return !isDeleted && !r.deletedAt;
      })
      // derive display label
      .map(r => ({
        id: r._id,
        label:
          getV(r.values, "Business Name", "businessName", "Name", "name") ||
          "(Untitled)"
      }))
      // sort client-side as a fallback
      .sort((a, b) => a.label.localeCompare(b.label))
      // build <option>s
      .forEach(biz => {
        const opt = document.createElement("option");
        opt.value = biz.id;
        opt.textContent = biz.label;

        // preselect to match the outside dropdown if it’s set
        if (selectedOutside && selectedOutside === biz.id) {
          opt.selected = true;
        }
        dropdown.appendChild(opt);
      });

  } catch (err) {
    console.error("❌ Failed to load businesses:", err);
    // keep the placeholder; optionally show a toast/alert
  } finally {
    dropdown.disabled = false;
  }
}

// === Prefill duration/calendar from selected service ===
(function () {
  function applyServiceSelectionDefaults() {
    const svcSel   = document.getElementById("appointment-service");
    const durInput = document.getElementById("appointment-duration"); // <input type="number">
    const calSel   = document.getElementById("appointment-calendar"); // optional

    if (!svcSel || !durInput) return;

    const opt = svcSel.selectedOptions?.[0];
    if (!opt || !opt.value) return; // ignore placeholder like "-- Select Service --"

    // Duration
    const mins = parseInt(opt.dataset.duration || "", 10);
    if (Number.isFinite(mins) && mins > 0) {
      const step = parseInt(durInput.step || "15", 10);
      const min  = parseInt(durInput.min  || "15", 10);
      const snapped = Math.max(min, Math.round(mins / step) * step);
      durInput.value = String(snapped);
    }

    // Calendar (optional)
    if (calSel && opt.dataset.calendarId) {
      const id = opt.dataset.calendarId;
      if ([...calSel.options].some(o => o.value === id)) calSel.value = id;
    }
  }

  // expose so you can call it after populating services
  window.applyServiceSelectionDefaults = applyServiceSelectionDefaults;

  document.addEventListener("DOMContentLoaded", () => {
    const svcSel = document.getElementById("appointment-service");
    if (!svcSel) return;
    svcSel.addEventListener("change", applyServiceSelectionDefaults);
  });
})();

                            ////////////////Save Client
// Save Client (uses /api/records/Client)
// Save Client (uses /api/records/Client)
const createClientForm = document.getElementById("create-client-form");
if (createClientForm) {
  createClientForm.addEventListener("submit", async function (e) {
    e.preventDefault();

    const businessId = document.getElementById("client-business").value || "";
    const firstName  = (document.getElementById("client-name").value || "").trim();
    const lastName   = (document.getElementById("client-last-name").value || "").trim();
    const phone      = (document.getElementById("client-phone").value || "").trim();
    const email      = (document.getElementById("client-email").value || "").trim();

    if (!businessId || !firstName) {
      alert("Please enter First Name and choose a Business.");
      return;
    }

    const API_URL =
      (window.API || ((t) => `/api/records/${encodeURIComponent(t)}`))("Client");

    // --- helper to safely fetch JSON with logs ---
    async function safeFetchJSON(url, opts) {
      const res = await fetch(url, opts);
      const txt = await res.text();
      try {
        const json = txt ? JSON.parse(txt) : null;
        if (!res.ok) {
          console.error("[Create Client] HTTP", res.status, url, json || txt);
          throw new Error(`HTTP ${res.status}`);
        }
        return json;
      } catch (e) {
        console.error("[Create Client] Bad JSON from", url, txt);
        throw e;
      }
    }

    // --- helper: does record belong to this business? ---
    function recordMatchesBusiness(rec, bizId) {
      const v = rec?.values || {};
      const b = v["Business"];
      if (!b) return false;
      // Business might be a string id OR an object {_id: "..."}
      if (typeof b === "string") return b === bizId;
      if (typeof b === "object" && b._id) return String(b._id) === String(bizId);
      return false;
    }

    try {
      // ---------- (1) Optional: existence check ----------
      // Because reference fields can be stored as objects, we query by a unique field
      // (Email, Phone) and then filter by Business in JS.
      let exists = false;

      if (email) {
        const url = `${API_URL}?where=${encodeURIComponent(JSON.stringify({ "Email": email }))}&limit=5&ts=${Date.now()}`;
        const list = await safeFetchJSON(url, { credentials: "include", cache: "no-store" });
        exists = Array.isArray(list) && list.some(r => recordMatchesBusiness(r, businessId));
      } else if (phone) {
        const url = `${API_URL}?where=${encodeURIComponent(JSON.stringify({ "Phone Number": phone }))}&limit=5&ts=${Date.now()}`;
        const list = await safeFetchJSON(url, { credentials: "include", cache: "no-store" });
        exists = Array.isArray(list) && list.some(r => recordMatchesBusiness(r, businessId));
      } else {
        // fallback: same first/last name within the business
        const url = `${API_URL}?where=${encodeURIComponent(JSON.stringify({ "First Name": firstName }))}&limit=10&ts=${Date.now()}`;
        const list = await safeFetchJSON(url, { credentials: "include", cache: "no-store" });
        exists = Array.isArray(list) && list.some(r => {
          if (!recordMatchesBusiness(r, businessId)) return false;
          const v = r.values || {};
          const ln = (v["Last Name"] || "").trim().toLowerCase();
          return !lastName || ln === lastName.trim().toLowerCase();
        });
      }

      if (exists) {
        alert("ℹ️ This client is already in your list.");
        return;
      }

      // ---------- (2) Create the Client ----------
      const values = {
        "Business":     { _id: businessId },   // Reference as object (safer with your server)
        "First Name":   firstName,
        "Last Name":    lastName,
        "Phone Number": phone,
        "Email":        email,
        "is Deleted":   false
      };

      console.log("[Create Client] creating with values:", values);

      const createRes = await fetch(API_URL, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ values })
      });

      const result = await createRes.json().catch(() => null);

      if (createRes.ok) {
        alert("✅ Client added successfully!");
        createClientForm.reset();
        if (typeof loadAllClients === "function") loadAllClients();
        if (typeof closeClientPopup === "function") closeClientPopup();
      } else {
        console.error("[Create Client] create failed:", result);
        alert((result && (result.message || result.error)) || "❌ Failed to add client.");
      }

    } catch (err) {
      console.error("❌ Error saving client:", err);
      alert("Something went wrong.");
    }
  });
}

function toTimeValue(raw) {
  if (!raw) return '';
  const { h, m } = parseTimeLoose(raw); // your robust parser
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
}


//DONE// ---------- one-time constants ----------
// ---------- one-time constants ----------
window.TYPE_SERVICE ??= 'Service'; // <- change to 'Services' if that's your exact DataType name

// ---------- one-time: bind business -> load services/clients ----------
(function bindApptBusinessChangeOnce() {
  const sel = document.getElementById("appointment-business");
  if (!sel || sel.dataset.bound) return;

  sel.addEventListener("change", async (e) => {
    const businessId = e.target.value;
    await loadAppointmentServices(businessId);
    if (typeof loadAppointmentClients === 'function') {
      await loadAppointmentClients(businessId);
    }
  });

  sel.dataset.bound = "1";
})();

// ---------- helpers (top-level, reusable) ----------


// Robust value getter
function vget(v, ...keys) {
  for (const k of keys) {
    if (v && v[k] != null && v[k] !== '') return v[k];
  }
  return undefined;
}

// Fill the <select> with options
function fillServiceSelect(dropdown, rows) {
  dropdown.innerHTML = `<option value="">-- Select Service --</option>`;
  let count = 0;

  rows.forEach(row => {
    const v   = row.values || {};
    const name =
      vget(v, 'Service Name', 'Name', 'serviceName') || '(Unnamed Service)';
    const duration = vget(v, 'duration', 'Duration');
    const calendar = vget(v, 'Calendar', 'calendarId');

    const opt = document.createElement('option');
    opt.value = row._id;
    opt.textContent = name;
    if (duration) opt.dataset.duration = duration;
    if (calendar) opt.dataset.calendarId = calendar;
    dropdown.appendChild(opt);
    count++;
  });

  if (!count) {
    const empty = document.createElement('option');
    empty.value = '';
    empty.disabled = true;
    empty.textContent = '— No services for this business —';
    dropdown.appendChild(empty);
  }
}

// Try both "Service" and "Services". Fetch all and filter client-side by Business.
async function loadAppointmentServices(businessId) {
  const dropdown = document.getElementById('appointment-service');
  if (!dropdown) return;

  dropdown.innerHTML = `<option value="">-- Select Service --</option>`;
  if (!businessId || businessId === 'all') return [];

  const url = `/api/records/Service?limit=1000&ts=${Date.now()}`;
  try {
    const res = await fetch(url, { credentials:'include', cache:'no-store' });
    if (!res.ok) return;
    const all = await res.json();

    const rows = (all || []).filter(r => {
      const v = r.values || {};
      const b = v['Business'] ?? v['businessId'] ?? v['Business Id'] ?? v['Biz'] ?? v['biz'];
      const id = (b && typeof b === 'object') ? (b._id || b.id) : b;
      return String(id || '') === String(businessId);
    });

    rows.forEach(row => {
      const v = row.values || {};
     const name = v['Service Name'] || v['Name'] || v.serviceName || '(Unnamed Service)';
const opt  = document.createElement('option');
opt.value  = row._id;
opt.textContent = name;

// 👇 grab duration from whatever your schema uses
const durationRaw =
  v['Duration'] ??
  v['duration'] ??
  v['durationMinutes'] ??
  v['Service Duration'] ??
  v['Extra Time']; // only if you stored service time that way

const durationNum = Number(durationRaw);
if (Number.isFinite(durationNum) && durationNum > 0) {
  opt.dataset.duration = String(durationNum);
} else {
  console.warn('[service] missing duration:', { id: row._id, name, values: v });
}

const calVal = v['Calendar'] ?? v['calendarId'];
const calId  = (calVal && typeof calVal === 'object') ? (calVal._id || calVal.id) : calVal;
if (calId) opt.dataset.calendarId = String(calId);

dropdown.appendChild(opt);

    });
  } catch {/* ignore */}
}

//Open Popup in edit mode 


// ---------- popup ----------
// ---------- popup ----------


function closeAppointmentPopup() {
  const popup   = document.getElementById("popup-create-appointment");
  const overlay = document.getElementById("popup-overlay");
  if (popup)   popup.style.display = "none";
  if (overlay) overlay.style.display = "none";
  document.body.classList.remove("popup-open");
}
// ===== helpers to avoid race conditions when opening in edit mode =====
async function waitFor(predicateFn, timeout = 2000, interval = 50) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    try { if (predicateFn()) return true; } catch {}
    await new Promise(r => setTimeout(r, interval));
  }
  return false;
}
async function waitForOptions(selectEl, min = 2, timeout = 2000) {
  return waitFor(() => selectEl && selectEl.options && selectEl.options.length >= min, timeout);
}

// ====== EDIT APPOINTMENT (click card → open popup prefilled) ======

// 1) Delegate clicks on dynamically-rendered appointment cards
document.addEventListener('click', (e) => {
  const card = e.target.closest('.appointment-card[data-id]');
  if (!card) return;
  e.preventDefault();
  openAppointmentEditor(card.dataset.id, card); // ← pass the element
});


// 2) Open the popup in EDIT mode and prefill fields
async function openAppointmentEditor(apptId, elFromClick = null) {
  if (!apptId) return;

  const accept = { Accept: 'application/json' };
  const ts = Date.now();

  // 1) Private GET-by-id
  try {
    const res = await fetch(`${API_URL('Appointment')}/${encodeURIComponent(apptId)}?includeRefField=1&ts=${ts}`, {
      credentials:'include', cache:'no-store', headers: accept
    });
    if (res.ok) {
      const rec = await res.json();
      return showAppointmentEditor(rec); // will call openAppointmentPopup(rec)
    }
  } catch {}

  // 2) Private list fallback
  try {
    const qs = new URLSearchParams({
      where: JSON.stringify({ _id: apptId }),
      limit: '1',
      includeRefField: '1',
      ts: String(ts)
    });
    const r2 = await fetch(`${API_URL('Appointment')}?${qs}`, {
      credentials:'include', cache:'no-store', headers: accept
    });
    if (r2.ok) {
      const arr = await r2.json();
      if (arr?.[0]) return showAppointmentEditor(arr[0]);
    }
  } catch {}

  // 3) Public fallback using the card’s data-* (so Business is known)
  try {
    const el = elFromClick || document.querySelector(`.appointment-card[data-id="${apptId}"]`);
    const { bizId, calId, date, time } = (el && el.dataset) || {};
    if (bizId && calId && date && time) {
      const pub = await publicList('Appointment', {
        Business: bizId, Calendar: calId, Date: date, Time: time, ts: Date.now()
      });
      if (Array.isArray(pub) && pub[0]) return showAppointmentEditor(pub[0]);
    }
  } catch {}

  alert('Could not load that appointment.');
}

function showAppointmentEditor(rec) {
  return openAppointmentPopup(rec); // your existing function
}




// 3) helper: convert "HH:MM" (24h) → "h:MM AM/PM" for your time input
function to12h(hhmm) {
  if (!hhmm) return '';
  const [hStr, mStr='0'] = String(hhmm).split(':');
  let h = parseInt(hStr, 10), m = parseInt(mStr, 10);
  if (Number.isNaN(h)) return hhmm;
  const ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12; if (h === 0) h = 12;
  return `${h}:${String(m).padStart(2,'0')} ${ap}`;
}
 async function fetchCalendarsForBusiness(businessId) {
  if (!businessId || businessId === 'all') return [];
  const headers = { Accept: 'application/json' };

  async function get(where) {
    const qs = new URLSearchParams({
      where: JSON.stringify(where),
      limit: '500',
      ts: Date.now().toString()
    });
    const r = await fetch(`/api/records/Calendar?${qs}`, {
      credentials: 'include',
      cache: 'no-store',
      headers
    });
    return r.ok ? (await r.json()) : [];
  }

  // Try both shapes for the Business reference
  let rows = await get({ "Business": businessId });
  if (!rows.length) rows = await get({ "Business": { _id: businessId } });

  return rows
    .map(r => r._id || r.id || (r.values && r.values._id))
    .filter(Boolean)
    .map(String);
}

// Public fetch helper for /public/records
async function publicList(dataType, filters = {}) {
  const params = new URLSearchParams({ dataType });
  for (const [k, v] of Object.entries(filters)) {
    if (v === undefined || v === null || v === "") continue;
    // accept primitive or {_id: "..."} or object id-ish
    let val = v;
    if (typeof v === "object") {
      if (v._id) val = v._id;
      else if (v.id) val = v.id;
      else val = String(v); // last resort
    }
    params.append(k, String(val));
  }

  const res = await fetch(`/public/records?${params.toString()}`, {
    headers: { Accept: "application/json" },
    credentials: "same-origin",
    cache: "no-store"
  });

  if (!res.ok) {
    console.warn(`[publicList] ${dataType} HTTP ${res.status}`);
    return [];
  }
  const data = await res.json();
  return Array.isArray(data) ? data : (data.data || []);
}

//DONE // ── Businesses for the "Create Appointment" form ─────────────────────────────
// ---- Business dropdown (idempotent + deduped) ----
// -------- records-client.js (drop this near the top of your main JS) --------

// Safely stringify params
// ---------- records helpers (drop-in) ----------
function _encJSON(o){ return encodeURIComponent(JSON.stringify(o)); }

async function _GET(url){
  const r = await fetch(url, { credentials:'include', cache:'no-store' });
  if (!r.ok) throw new Error(`GET ${url} -> ${r.status}`);
  return r.json();
}
async function _POST(url, body) {
  const r = await fetch(url, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify(body || {})
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

function cleanWhere(obj){ return obj && typeof obj==='object' ? obj : {}; }

// LIST/QUERY
async function queryRecords(dataType, where = {}, opts = {}) {
 return _POST('/api/records/query', {
   typeName: dataType,
   where: cleanWhere(where),
   limit: opts.limit ?? 1000,
   sort: opts.sort ?? { createdAt: 1 },
   includeRefField: opts.includeRefField ? 1 : 0
 });
}

// GET BY ID
async function getRecordById(dataType, id) {
  return _POST('/api/records', { action: 'get', dataType, id });
}

// CREATE
async function createRecord(dataType, values) {
  return _POST('/api/records', { action: 'create', dataType, values });
}

// UPDATE
async function updateRecord(dataType, id, values) {
  return _POST('/api/records', { action: 'update', dataType, id, values });
}



let __BIZ_CACHE = null;
let __BIZ_FILLED_ONCE = false;

function fillBusinessSelect(sel, items) {
  sel.innerHTML = `<option value="">-- Select Business --</option>`;
  items.forEach(({ id, label }) => {
    const opt = document.createElement('option');
    opt.value = id;
    opt.textContent = label || '(Untitled)';
    sel.appendChild(opt);
  });
}

async function loadAppointmentBusinesses({ force = false } = {}) {
  const sel = document.getElementById("appointment-business");
  if (!sel) return;

  // reuse the cache if we already loaded it
  if (__BIZ_CACHE && !force) {
    fillBusinessSelect(sel, __BIZ_CACHE);
    __BIZ_FILLED_ONCE = true;
    return;
  }

  sel.innerHTML = `<option value="">-- Select Business --</option>`;

  try {
    const r = await fetch(`/api/records/Business?limit=1000&ts=${Date.now()}`, {
      credentials: 'include',
      cache: 'no-store'
    });
    const rows = r.ok ? await r.json() : [];

    // dedupe by _id and pick a robust label
    const map = new Map();
    (rows || []).forEach(b => {
      const id = String(b._id || '');
      const v = b.values || {};
      const label =
        (v['Business Name'] || v.businessName || v.Name || v.name || '').trim() || '(Untitled)';
      if (id && !map.has(id)) map.set(id, { id, label });
    });

    __BIZ_CACHE = Array.from(map.values());
    fillBusinessSelect(sel, __BIZ_CACHE);
    __BIZ_FILLED_ONCE = true;
  } catch (e) {
    console.error('[businesses] load failed', e);
    sel.innerHTML = `<option value="">⚠️ Failed to load</option>`;
  }
}


// Change handlers (guarded)
document.getElementById("appointment-business")?.addEventListener("change", async function () {
  const businessId = this.value || "";
  const showAll = document.getElementById("show-all-clients")?.checked;

  try {
    if (showAll) {
      // implement to load every client you own
      await (typeof loadAllClientsForAppointments === "function" && loadAllClientsForAppointments());
    } else if (businessId) {
      // implement to load clients scoped to a business
      await (typeof loadAppointmentClients === "function" && loadAppointmentClients(businessId));
    } else {
      // optional: clear clients UI if no business selected
      if (typeof clearAppointmentClients === "function") clearAppointmentClients();
    }

    // services tied to business
    if (typeof loadAppointmentServices === "function") {
      await loadAppointmentServices(businessId);
    }
  } catch (e) {
    console.error(e);
  }
});

document.getElementById("show-all-clients")?.addEventListener("change", async function () {
  const businessId = document.getElementById("appointment-business")?.value || "";
  try {
    if (this.checked) {
      await (typeof loadAllClientsForAppointments === "function" && loadAllClientsForAppointments());
    } else if (businessId) {
      await (typeof loadAppointmentClients === "function" && loadAppointmentClients(businessId));
    }
  } catch (e) {
    console.error(e);
  }
});

//Done
// helpers you already have above:
// - vget, buildClientLabel, normalizeRefId, labelFromAppt
// - clientsReqId (number)
// ✅ Single canonical version
async function loadAllClientsForAppointments() {
  const sel = document.getElementById("appointment-client");
  if (!sel) return;

  sel.disabled = true;
  const myReq = ++clientsReqId;

  // if we're editing an appt, reuse its id/label when showing "All"
  let selectClientId = sel.dataset.editId    || "";
  let preselectLabel = sel.dataset.editLabel || "";

  sel.innerHTML = `<option value="">-- Select Client --</option>`;

  try {
    const byId = new Map();

    // 1) All real Client records I can see (A–Z by First/Last)
 // 1) All real Client records for my Businesses (A–Z by First/Last)
let clientRows = [];
try {
  // You already have a helper like getMyBusinessIds() elsewhere (used in your logs/errors).
  // If you don't, you can skip this whole client-side filter since the server clamp now enforces it.
  const myUserId  = window.currentUserId || (window.STATE && window.STATE.userId) || '';
  const myBizIds  = await getMyBusinessIds(myUserId);  // <-- your existing helper

// after you computed `myBizIds` above
const publicWhere = myBizIds && myBizIds.length ? {
  $or: [
    { "Business":            { $in: myBizIds } },
    { "Business._id":        { $in: myBizIds } },
    { "values.Business":     { $in: myBizIds } },
    { "values.Business._id": { $in: myBizIds } },
  ]
} : { _id: { $in: [] } };

try {
  const qs = {
    where: JSON.stringify(publicWhere),
    limit: 1000,
    includeRefField: 1,
    ts: Date.now()
  };
  const publicAppts = await publicList("Appointment", qs);
  if (publicAppts?.length) addFromAppts(publicAppts);
} catch {}

clientRows = await queryRecords('Client', whereAll, {
  limit: 1000,
  sort : { "First Name": 1, "Last Name": 1 }
});

console.log('[CLIENT FETCH] count=', (clientRows||[]).length, (clientRows||[]).map(r => ({
  id: r._id,
  name:
    `${(r.values?.['First Name']||'').trim()} ${(r.values?.['Last Name']||'').trim()}`.trim() ||
    r.values?.['Client Name'] || '',
  bizRaw: r.values?.Business,
  bizId: (typeof r.values?.Business === 'object')
           ? (r.values.Business._id || r.values.Business.id)
           : (r.values?.Business || r.values?.['Business Id'] || r.values?.businessId || '')
})));

// 👇 add this line right here
await logClientOwnership(clientRows);

} catch {
  clientRows = []; // safe fallback
}

if (myReq !== clientsReqId) return;

    (clientRows || []).forEach(doc => {
      const v  = doc.values || {};
      const id = String(doc._id || v._id || "");
      if (!id) return;
      byId.set(id, { id, label: buildClientLabel(v) });
    });

    // 2) Add clients derived from Appointments (private + public), no biz filter
   // 2) Add clients derived from Appointments (private only, and only my businesses)
const addFromAppts = (arr) => {
  (arr || []).forEach(a => {
    const v = a.values || a;

    // keep only appts that belong to *my* businesses
    const rawBiz = v["Business"];
    const apptBizId = typeof rawBiz === 'object' ? String(rawBiz._id || rawBiz.id || '') : String(rawBiz || '');
    if (!apptBizId || !myBizIds.includes(apptBizId)) return;

    let cid = normalizeRefId(v["Client"]);
    if (!cid) {
      const em = (v["Client Email"] || "").trim().toLowerCase();
      if (!em) return;
      cid = `virtual:${em}`;
    }
    if (byId.has(cid)) return;
    byId.set(cid, { id: cid, label: labelFromAppt(v) });
  });
};

    // 2a) private appts I can access (no where filter)
// 2a) private appts I can access – but only for my businesses
try {
  const whereAppt = {
    $or: [
      { "Business":            { $in: myBizIds } },
      { "Business._id":        { $in: myBizIds } },
      { "values.Business":     { $in: myBizIds } },
      { "values.Business._id": { $in: myBizIds } },
    ]
  };
  const apptRows = await queryRecords('Appointment', whereAppt, {
    limit: 1000,
    sort : { Date:1, Time:1, createdAt:1 },
    includeRefField: 1
  });
  if (apptRows?.length) addFromAppts(apptRows);
} catch {}

// 2b) OPTIONAL public: usually REMOVE this to avoid leakage.
// If you *must* keep it, gate by myBizIds like above:
/// try {
///   const pub = await publicList("Appointment", { ts: Date.now() }) || [];
///   addFromAppts(pub);
/// } catch {}

    // 2b) public appts (self-bookings that aren’t in my private list)
   // try {
      //addFromAppts(await publicList("Appointment", { ts: Date.now() }));
   // } catch {}

    // 3) Hydrate any “(Client)” label from the Client doc if it exists (safe helper)
    const toHydrate = Array.from(byId.values()).filter(c => !c.label || c.label === "(Client)");
    await Promise.all(toHydrate.map(async (c) => {
      if (String(c.id).startsWith("virtual:")) return; // skip virtual ids
      try {
        const rec = await getRecordById('Client', c.id);
        const better = buildClientLabel(rec?.values || {});
        if (better && better !== "(Client)") byId.set(c.id, { id: c.id, label: better });
      } catch {}
    }));

    // 4) Render A–Z
    const list = Array.from(byId.values()).sort((a,b) => a.label.localeCompare(b.label));
    sel.innerHTML = `<option value="">-- Select Client --</option>`;
    for (const c of list) {
      const opt = document.createElement("option");
      opt.value = c.id;
      opt.textContent = c.label;
      sel.appendChild(opt);
    }

    // 5) Preselect the current editing client if we have one
    if (selectClientId) {
      const exists = !!sel.querySelector(`option[value="${CSS.escape(String(selectClientId))}"]`);
      if (!exists) {
        const opt = document.createElement("option");
        opt.value = String(selectClientId);
        opt.textContent = preselectLabel || "(Client)";
        opt.selected = true;
        sel.appendChild(opt);
      } else {
        sel.value = String(selectClientId);
      }
    }
  } catch (err) {
    console.error("❌ Failed to load all clients for appointments:", err);
  } finally {
    if (myReq === clientsReqId) sel.disabled = false;
  }
}

function _asId(v){
  if (!v) return '';
  if (typeof v === 'string') return v;
  return String(v._id || v.id || '');
}
function _bizId(v){
  const b = v?.Business ?? v?.['Business Id'] ?? v?.businessId;
  return _asId(b);
}
function _createdBy(row){
  return row.createdBy || row.values?.createdBy || row.Owner || row.values?.Owner || null;
}

function debugClientRow(row) {
  const v = row.values || {};
  console.log('[CLIENT]',
    {
      id: row._id,
      name: `${v['First Name']||''} ${v['Last Name']||''}`.trim() || v['Client Name'] || '',
      businessId: _bizId(v),
      createdBy: _createdBy(row),
      rawBusiness: v['Business'],
      rawOwner: row.Owner || v.Owner,
    }
  );
}


// Render Services
// -------- helpers (keep near top of file) --------
function vget(v, ...keys) {
  for (const k of keys) if (v && v[k] != null && v[k] !== '') return v[k];
  return undefined;
}

// -------- Services loader (SINGLE SOURCE OF TRUTH) --------
async function loadAppointmentServices(businessId) {
  const dropdown = document.getElementById('appointment-service');
  if (!dropdown) return [];

  // reset once
  dropdown.innerHTML = `<option value="">-- Select Service --</option>`;

  if (!businessId || businessId === 'all') {
    console.warn('[Services] no business selected');
    return [];
  }

  const getId = (b) => (b && typeof b === 'object') ? (b._id || b.id) : b;

  let rows = [];
  try {
    const url = `/api/records/Service?limit=1000&ts=${Date.now()}`;
    const res = await fetch(url, { credentials: 'include', cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const all = await res.json();

    // Filter by Business robustly
    rows = (all || []).filter(row => {
      const v = row.values || {};
      const biz = v['Business'] ?? v['businessId'] ?? v['Business Id'] ?? v['Biz'] ?? v['biz'];
      return String(getId(biz) || '') === String(businessId);
    });
  } catch (e) {
    console.warn('[Services] fetch error:', e);
    rows = [];
  }

  // Build options with duration/calendar data
  for (const row of rows) {
    const v = row.values || {};
    const name =
      v['Service Name'] || v['Name'] || v.serviceName || '(Unnamed Service)';

    const durationRaw =
      v['Duration'] ??
      v['duration'] ??
      v['Duration (minutes)'] ??
      v['Service Duration'] ??
      v['durationMinutes'];

    const opt = document.createElement('option');
    opt.value = row._id;
    opt.textContent = name;

    const durationNum = Number(durationRaw);
    if (Number.isFinite(durationNum) && durationNum > 0) {
      opt.dataset.duration = String(durationNum);
    } else {
      // optional: helpful once while wiring up
      // console.warn('[service] missing duration:', { id: row._id, name, values: v });
    }

    const calVal = v['Calendar'] ?? v['calendarId'];
    const calId  = getId(calVal);
    if (calId) opt.dataset.calendarId = String(calId);

    dropdown.appendChild(opt);
  }

  // Auto-select first real service & prefill duration/calendar



  return rows;
}

// Ensure the global points to this version:
window.loadAppointmentServices = loadAppointmentServices;

/* If you must try both names, swap the fetch try/catch above for:

  const TYPES = ['Service', 'Services'];
  for (const type of TYPES) {
    try {
      const url = `/api/records/${encodeURIComponent(type)}?limit=1000&ts=${Date.now()}`;
      const res = await fetch(url, { credentials: 'include', cache: 'no-store' });
      if (!res.ok) {
        if (res.status === 404) continue; // swallow plural 404
        throw new Error(`HTTP ${res.status}`);
      }
      const all = await res.json();
      rows = (all || []).filter(row => {
        const v = row.values || {};
        const biz = v['Business'] ?? v['businessId'] ?? v['Business Id'] ?? v['Biz'] ?? v['biz'];
        return String(getId(biz) || '') === String(businessId);
      });
      break; // got one
    } catch (e) {
      if ((e.message || '').includes('404')) continue;
      console.warn('[Services] fetch error for', type, e);
    }
  }

*/



// Render Clients
let clientsReqId = 0;

function vget(v, ...keys) {
  for (const k of keys) if (v && v[k] != null && String(v[k]).trim() !== '') return String(v[k]).trim();
  return '';
}
function buildClientLabel(v = {}) {
  const first = (v['First Name'] || '').trim();
  const last  = (v['Last Name']  || '').trim();
  const email = (v['Email']      || '').trim();
  const phone = (v['Phone']      || '').trim();

  const name = [first, last].filter(Boolean).join(' ').trim();
  return name || email || phone || '(Client)';
}

// ------- helpers (put near the top of the file once) -------
function normalizeRefId(ref) {
  if (!ref) return "";
  if (typeof ref === "string") return ref;
  return String(ref._id || ref.id || "");
}

function matchesBusiness(values, bizId) {
  if (!bizId || bizId === "all") return true;
  const b = values?.["Business"];
  if (!b) return false;
  if (typeof b === "string") return String(b) === String(bizId);
  return String(b._id || b.id || "") === String(bizId);
}

function labelFromRecord(v = {}) {
  const fn = (v["First Name"] || v.firstName || "").trim();
  const ln = (v["Last Name"]  || v.lastName  || "").trim();
  const cn = (v["Client Name"] || "").trim();
  const em = (v["Email"] || v.email || "").trim();
  const full = [fn, ln].filter(Boolean).join(" ").trim();
  return cn || full || em || "(Client)";
}

function labelFromAppt(v = {}) {
  const cn = (v["Client Name"] || "").trim();
  const fn = (v["Client First Name"] || "").trim();
  const ln = (v["Client Last Name"]  || "").trim();
  const em = (v["Client Email"] || "").trim();
  const full = [fn, ln].filter(Boolean).join(" ").trim();
  return cn || full || em || "(Client)";
}

async function loadAppointmentClients(
  businessId,
  { selectClientId = "", preselectLabel = "" } = {}
) {
  const sel = document.getElementById("appointment-client");
  if (!sel) return;

  sel.disabled = true;
  const myReq = ++clientsReqId;

  // reuse stored edit metadata when switching biz back to the editing one
  if (!selectClientId && String(sel.dataset.editBizId || '') === String(businessId || '')) {
    selectClientId = sel.dataset.editId    || "";
    preselectLabel = sel.dataset.editLabel || "";
  }

  // reset UI
  sel.innerHTML = `<option value="">-- Select Client --</option>`;
  if (!businessId || businessId === "all") { sel.disabled = false; return; }

  try {
    // 1) real Client records for this Business (both ref shapes)
    const qs = new URLSearchParams({
      where: JSON.stringify({
        $or: [{ "Business": businessId }, { "Business": { _id: businessId } }]
      }),
      limit: "1000",
      sort: JSON.stringify({ "First Name": 1, "Last Name": 1 }),
      ts: Date.now().toString()
    });

    const res = await fetch(`/api/records/Client?${qs}`, {
      credentials: "include",
      cache: "no-store"
    });
    if (myReq !== clientsReqId) return; // a newer call started

    const byId = new Map();
    const rows = res.ok ? (await res.json()) : [];

    (rows || []).forEach(r => {
      const v  = r.values || {};
      const id = String(r._id || v._id || '');
      if (!id) return;
      byId.set(id, { id, label: buildClientLabel(v) });
    });

    // 2) add clients derived from Appointments (private + public)
    const addFromAppts = (arr) => {
      (arr || []).forEach(r => {
        const v = r.values || r;
        let cid = normalizeRefId(v['Client']);
        if (!cid) {
          const em = vget(v, 'Client Email').toLowerCase();
          if (!em) return;               // nothing stable to key by
          cid = `virtual:${em}`;         // virtual id so it shows in list
        }
        if (byId.has(cid)) return;
        byId.set(cid, { id: cid, label: labelFromAppt(v) });
      });
    };

   try {
  const rows = await queryRecords('Appointment', {}, {
    limit: 1000,
    sort: { Date:1, Time:1, createdAt:1 },
    includeRefField: 1
  });
  if (rows?.length) addFromAppts(rows);
} catch {}

// public appts (self-bookings)
try {
  addFromAppts(await publicList("Appointment", { ts: Date.now() }));
} catch {}

    // 3) hydrate any “(Client)” entries now that the map is populated
    const toHydrate = Array.from(byId.values()).filter(c => !c.label || c.label === '(Client)');
    await Promise.all(toHydrate.map(async (c) => {
      try {
        const r = await fetch(`getRecordById('Client', id)${encodeURIComponent(c.id)}?ts=${Date.now()}`, {
          credentials: 'include',
          headers: { Accept: 'application/json' }
        });
        if (!r.ok) return;
        const rec = await r.json();
        const better = buildClientLabel(rec?.values || {});
        if (better && better !== '(Client)') byId.set(c.id, { id: c.id, label: better });
      } catch {}
    }));

    // 4) render A–Z
    const list = Array.from(byId.values()).sort((a,b) => a.label.localeCompare(b.label));
    sel.innerHTML = `<option value="">-- Select Client --</option>`;
    for (const c of list) {
      const opt = document.createElement("option");
      opt.value = c.id;
      opt.textContent = c.label;
      sel.appendChild(opt);
    }

    // 5) preselect (or synthesize) the editing client
    if (selectClientId) {
      const exists = !!sel.querySelector(`option[value="${CSS.escape(String(selectClientId))}"]`);
      if (!exists) {
        const opt = document.createElement("option");
        opt.value = String(selectClientId);
        opt.textContent = preselectLabel || "(Client)";
        opt.selected = true;
        sel.appendChild(opt);
      } else {
        sel.value = String(selectClientId);
      }
    }
  } catch (e) {
    console.error("[loadAppointmentClients] failed:", e);
  } finally {
    if (myReq === clientsReqId) sel.disabled = false; // always re-enable for the latest call
  }
}





// auto-fill the duration
document.getElementById("appointment-service").addEventListener("change", function () {
  const selectedOption = this.options[this.selectedIndex];
  const duration = selectedOption.getAttribute("data-duration");

  if (duration) {
    document.getElementById("appointment-duration").value = duration;
  }
});

// New client section in add appointment popup 
document.addEventListener("DOMContentLoaded", () => {
  // Support either of your "Add New Client" buttons
  const newClientButtons = document.querySelectorAll("#btn-new-client, #toggle-new-client-btn");

  // Use the IDs that exist in your HTML
  const cancelNewClientBtn = document.getElementById("cancel-new-client-btn");
  const newClientFields = document.getElementById("new-client-fields");          // was "new-client-section" in your JS
  const existingClientSection = document.getElementById("existing-client-section");

  const showNewClientForm = () => {
    if (newClientFields) newClientFields.style.display = "block";
    if (existingClientSection) existingClientSection.style.display = "none";
    newClientButtons.forEach(btn => { if (btn) btn.style.display = "none"; });
  };

  const hideNewClientForm = () => {
    if (newClientFields) newClientFields.style.display = "none";
    if (existingClientSection) existingClientSection.style.display = "block";
    newClientButtons.forEach(btn => { if (btn) btn.style.display = "inline-block"; });

    // Clear inputs
    ["new-client-first-name","new-client-last-name","new-client-email","new-client-phone"]
      .forEach(id => { const el = document.getElementById(id); if (el) el.value = ""; });
  };

  // Wire up listeners (with null-guards so nothing crashes)
  newClientButtons.forEach(btn => {
    if (btn) btn.addEventListener("click", showNewClientForm);
  });
  if (cancelNewClientBtn) cancelNewClientBtn.addEventListener("click", hideNewClientForm);
});


// DONE //Save Appointment
// ---- helpers ----
const API_URL = (t) => `/api/records/${encodeURIComponent(t)}`;

// Normalize "9:30 AM" or "09:30" into 24h "HH:MM" (safe to store either; this keeps it consistent)
function to24h(hhmm) {
  if (!hhmm) return '';
  const ampm = /\b(AM|PM)\b/i.exec(hhmm);
  if (!ampm) return hhmm; // assume already "HH:MM"
  let [h, m] = hhmm.replace(/\s?(AM|PM)/i, '').split(':').map(Number);
  const isPM = /PM/i.test(ampm[1]);
  if (isPM && h !== 12) h += 12;
  if (!isPM && h === 12) h = 0;
  return `${String(h).padStart(2,'0')}:${String(m||0).padStart(2,'0')}`;
}
function upsertAppointmentCard(appt) {
  const grid = document.querySelector(".time-slots-container");
  if (!grid) return;

  // --- Which day column should this appointment be in? ---
  // Prefer the precomputed week (Sunday..Saturday) in local time.
  let weekIdx = -1;
  if (Array.isArray(window.currentWeekDates) && window.currentWeekDates.length === 7) {
    const ymdLocal = (d) =>
      `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    const target = String(appt.date).slice(0, 10);
    weekIdx = window.currentWeekDates.findIndex(d => ymdLocal(d) === target);
  } else if (window.currentWeekStart instanceof Date) {
    // Fallback: compute day offset from the current week's Sunday (local)
    const s = new Date(
      window.currentWeekStart.getFullYear(),
      window.currentWeekStart.getMonth(),
      window.currentWeekStart.getDate()
    );
    const [Y, M, D] = String(appt.date).split("-").map(Number);
    const t = new Date(Y, (M || 1) - 1, D || 1);
    const diffDays = Math.floor((t - s) / 86400000);
    if (diffDays >= 0 && diffDays < 7) weekIdx = diffDays;
  }

  // If this appt isn’t in the visible week, remove any existing card and bail.
  if (weekIdx === -1) {
    const old = grid.querySelector(`.appointment-card[data-id="${appt._id}"]`);
    if (old) old.remove();
    return;
  }

  // --- size/position calculations ---
  const slotWidthPercent = 100 / 7;
  const { h, m } = parseTimeLoose(appt.time);
  const endHM      = addMinutes(h, m, Number(appt.duration) || 0);
  const startLabel = format12h(h, m);
  const endLabel   = format12h(endHM.h, endHM.m);

  const topPx  = Math.round(getTopOffsetFromTimeLoose(appt.time));   // 1px per minute with your grid
  const height = Math.max(1, Math.ceil((Number(appt.duration) || 0) / 15)) * 15 - 1;

  // --- content ---
 const clientLabel  = getClientName(appt);

  const serviceNames = (appt.serviceIds || [])
    .map(id => lookupName(window.__serviceMap, String(id)))
    .filter(Boolean);
  const servicesHtml = serviceNames.length
    ? `<ul class="appt-services">${serviceNames.map(s => `<li>${s}</li>`).join("")}</ul>`
    : "";

  // --- ensure a card exists ---
 // --- ensure a card exists ---
let card = grid.querySelector(`.appointment-card[data-id="${appt._id}"]`);
if (!card) {
  card = document.createElement("div");
  card.className = "appointment-card";
  grid.appendChild(card);
}

// always keep dataset in sync (even if card already existed)
card.dataset.id = String(appt._id);

// bind click once; read the id from dataset at click time
if (!card.dataset.bound) {
 card.addEventListener("click", () => {
   if (!apptId) return console.warn('no id on card click', appt);
   if (typeof openAppointmentEditor === "function") {
     openAppointmentEditor(apptId);
   } else {
     openAppointmentPopup();
   }
 });
  card.dataset.bound = "1";
}

  // --- position & size ---
  card.style.position  = "absolute";
card.dataset.dayIndex = String(weekIdx);
const { colW, gap } = getColumnMetrics();
card.style.left  = `${Math.round(weekIdx * (colW + gap))}px`;
card.style.width = `${colW}px`;

  card.style.top       = `${topPx}px`;
  card.style.height    = `${height}px`;
  card.style.boxSizing = "border-box";
  card.style.overflow  = "hidden";
  card.style.margin    = "0";
  card.style.padding   = "4px 6px";

  // --- content ---
 const clientDisplay = getClientName(appt);
card.innerHTML = `
  <div class="appt-time"><strong>${startLabel} – ${endLabel}</strong></div>
  <div class="appt-client">${escapeHtml(clientDisplay || "(No client)")}</div>
  ${servicesHtml}
`;


  // Optional debug
  // console.log('[upsert]', { date: appt.date, weekIdx, topPx, height });
}

//Cancel Handler one time bind
(function bindCancelOnce(){
  const btn = document.getElementById('cancel-appointment-btn');
  if (!btn || btn.dataset.bound) return;
  btn.addEventListener('click', handleCancelAppointmentClick);
  btn.dataset.bound = '1';
})();
(function bindCancelButtonOnce(){
  const btn = document.getElementById('cancel-appointment-btn');
  if (!btn || btn.dataset.bound) return;

  btn.addEventListener('click', async () => {
    const apptId = btn.dataset.apptId;
    if (!apptId) return;
    if (!confirm('Cancel this appointment?')) return;

    try {
      const res = await fetch(`/api/records/Appointment/${encodeURIComponent(apptId)}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ values: { 'is Canceled': true, 'Appointment Status': 'cancelled' } })
      });
      const payload = await res.json().catch(()=>null);
      if (!res.ok) throw new Error(payload?.message || 'Cancel failed');

      alert('✅ Appointment canceled.');

      // Close popup
      if (typeof closeAppointmentPopup === 'function') closeAppointmentPopup();

      // Optimistic UI: remove card from grid
      const card = document.querySelector(`.appointment-card[data-id="${apptId}"]`);
      if (card) card.remove();

      // Optional: full refresh to stay in sync
      if (typeof loadAppointments === 'function') loadAppointments();

    } catch (err) {
      console.error('cancel failed', err);
      alert(err.message || 'Could not cancel.');
    }
  });

  btn.dataset.bound = '1';
})();

//Cancel Appointment
async function handleCancelAppointmentClick() {
  const btn = document.getElementById('cancel-appointment-btn');
  const apptId = btn?.dataset.apptId || window.currentEditAppointmentId;
  if (!apptId) return;

  if (!confirm('Cancel this appointment?')) return;

  try {
    const url = `/api/records/${encodeURIComponent('Appointment')}/${encodeURIComponent(apptId)}`;
    const res = await fetch(url, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        values: {
          'is Canceled': true,
          'Appointment Status': 'cancelled'
          // Optional, if your schema supports it:
          // 'Canceled By': { _id: window.currentUserId }
        }
      })
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      alert(`❌ ${data?.message || data?.error || 'Failed to cancel appointment.'}`);
      return;
    }

    // ✅ Remove from grid instantly
    removeAppointmentCard(apptId);

    // Optional: keep your local cache in sync if you keep one
    // if (Array.isArray(window.__appts)) {
    //   window.__appts = window.__appts.filter(a => a._id !== apptId);
    // }

    // Close the editor
    if (typeof closeAppointmentPopup === 'function') closeAppointmentPopup();
    window.currentEditAppointmentId = null;

    alert('✅ Appointment canceled.');
  } catch (err) {
    console.error('Error cancelling appointment:', err);
    alert('Failed to cancel appointment. Please try again.');
  }
}
//Remove appointment card 
function removeAppointmentCard(id) {
  const grid = document.querySelector('.time-slots-container') ||
               document.getElementById('appointments-grid') ||
               document.getElementById('calendar-grid');
  if (!grid) return;

  // try both historical class names
  const el =
    grid.querySelector(`.appointment-card[data-id="${id}"]`) ||
    grid.querySelector(`.appt-card[data-id="${id}"]`);

  if (el) el.remove();
}


// Find-or-create Client for a Business; returns {clientId, createdNew}
async function ensureClientId({ businessId, firstName, lastName, email, phone }) {
  const where = { "Business": businessId };
  if (email) where["Email"] = email;
  else if (phone) where["Phone Number"] = phone;
  else {
    where["First Name"] = firstName;
    if (lastName) where["Last Name"] = lastName;
  }

  // check existing
  const existsRes = await fetch(`${API_URL('Client')}?where=${encodeURIComponent(JSON.stringify(where))}&limit=1&ts=${Date.now()}`, {
    credentials: 'include',
    cache: 'no-store'
  });
  if (!existsRes.ok) throw new Error(`Client exists check HTTP ${existsRes.status}`);
  const existing = await existsRes.json();
  if (Array.isArray(existing) && existing.length) {
    return { clientId: existing[0]._id, createdNew: false };
  }

  // create new
// inside ensureClientId() when you POST the new Client:
const clientName =
  [firstName, lastName].filter(Boolean).join(' ').trim() ||
  email || phone || 'Client';

const createRes = await fetch(API_URL('Client'), {
  method: 'POST',
  credentials: 'include',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    values: {
      "Business":     businessId,
      "First Name":   firstName || '',
      "Last Name":    lastName  || '',
      "Email":        email     || '',
      "Phone Number": phone     || '',
      "Client Name":  clientName,    // 👈 add this
      "is Deleted":   false
    }
  })
});

  const created = await createRes.json();
  if (!createRes.ok) throw new Error(created?.message || `Create client HTTP ${createRes.status}`);
  return { clientId: created._id, createdNew: true };
}
// ---- Save / Update Appointment ----
document.getElementById("create-appointment-form").addEventListener("submit", async function (e) {
  e.preventDefault();

  const businessId = document.getElementById("appointment-business").value;
  const serviceId  = document.getElementById("appointment-service").value;
  const date       = document.getElementById("appointment-date").value;  // YYYY-MM-DD
  const timeInput  = document.getElementById("appointment-time").value;  // e.g., "9:30 AM"
  const duration   = document.getElementById("appointment-duration").value;

  // existing client (dropdown)
  const selectedClientId = document.getElementById("appointment-client").value;

  // potential new client
  const clientFirstName = document.getElementById("new-client-first-name").value.trim();
  const clientLastName  = document.getElementById("new-client-last-name").value.trim();
  const clientEmail     = document.getElementById("new-client-email").value.trim();
  const clientPhone     = document.getElementById("new-client-phone").value.trim();
  const isCreatingNewClient = clientFirstName || clientLastName || clientEmail || clientPhone;

  const selectedServiceOption = document.getElementById("appointment-service").selectedOptions[0];
  const calendarId  = selectedServiceOption?.getAttribute("data-calendar-id");
  const serviceName = selectedServiceOption?.textContent?.trim() || "";
  const note        = document.getElementById("appointment-note")?.value || "";

  if (!businessId || !serviceId || !calendarId || !date || !timeInput || !duration || (!selectedClientId && !isCreatingNewClient)) {
    alert("Please fill in all required fields.");
    return;
  }

  // Helper to 24h (keep your existing version if you already have it)
  function to24h(str) {
    try {
      const d = new Date(`1970-01-01 ${str}`);
      const hh = String(d.getHours()).padStart(2, "0");
      const mm = String(d.getMinutes()).padStart(2, "0");
      return `${hh}:${mm}`;
    } catch { return str; }
  }

  // Use your API helper if present
  const API_URL = (t) => (window.API ? window.API(t) : `/api/records/${encodeURIComponent(t)}`);

  try {
    // 1) Ensure we have (or create) a Client
   // 1) Ensure we have (or create) a Client
let clientId = selectedClientId || null;
let createdNew = false;

if (!clientId) {
  const res = await ensureClientId({
    businessId,
    firstName: clientFirstName,
    lastName:  clientLastName,
    email:     clientEmail,
    phone:     clientPhone
  });
  clientId   = res.clientId;
  createdNew = res.createdNew;

  // 🔁 refresh the dropdown so all clients (old + new) are present,
  // and auto-select the newly created client
  await loadAppointmentClients(businessId, { selectClientId: clientId });
}

    // 2) Build Appointment values using OBJECT refs (server normalizer + enrichment expects these)
    const time24 = to24h(timeInput);
   // --- Denormalize client name/email from the Client record (don’t trust dropdown label) ---
let dnFirst = (clientFirstName || '').trim();
let dnLast  = (clientLastName  || '').trim();
let dnEmail = (clientEmail     || '').trim();

try {
  if (clientId) {
    const r = await fetch(`getRecordById('Client', id)${encodeURIComponent(clientId)}?ts=${Date.now()}`, {
      credentials: 'include',
      headers: { Accept: 'application/json' }
    });
    if (r.ok) {
      const rec = await r.json();
      const cv  = rec?.values || {};
      dnFirst = (cv['First Name'] || dnFirst).trim();
      dnLast  = (cv['Last Name']  || dnLast ).trim();
      dnEmail = (cv['Email']      || dnEmail).trim();
    }
  }
} catch {}

const dnFull = [dnFirst, dnLast].filter(Boolean).join(' ').trim();

// Use this everywhere for display + storage
const prettyClient = dnFull || dnEmail || 'Client';


    const values = {
      // 🔴 send references as {_id} so your POST route (and enrichment) can resolve them
      "Business":   { _id: businessId },
      "Calendar":   { _id: calendarId },
      // If your "Service(s)" field allows multiple, keep it as an array
      "Service(s)": [{ _id: serviceId }],
      "Client":     { _id: clientId },

      // plain scalars
      "Date":          date,       // "YYYY-MM-DD"
      "Time":          time24,     // store consistently in 24h
      "Duration":      Number(duration) || 0,   // ⬅️ use the exact label your DataType uses (likely "Duration")
      "Name":          `${serviceName} with ${prettyClient} — ${date} ${timeInput}`,
      "Note":          note,
      "is New Client": !!createdNew,
      "is Canceled":   false,
      "Hold":          false
    };
// Denormalize client info so UI (and public queries) can show it without expanding refs
values["Client Name"]       = prettyClient;
values["Client First Name"] = clientFirstName || values["Client First Name"] || "";
values["Client Last Name"]  = clientLastName  || values["Client Last Name"]  || "";
// If you have the email in this context, store it too (optional)
values["Client Email"]      = clientEmail || values["Client Email"] || "";

    // 3) Create or Update
    const isEdit = !!window.currentEditAppointmentId;
    const url    = isEdit
      ? `${API_URL('Appointment')}/${window.currentEditAppointmentId}`
      : API_URL('Appointment');
    const method = isEdit ? 'PATCH' : 'POST';

    const res = await fetch(url, {
      method,
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ values })
    });

    const data = await res.json().catch(() => null);
if (res.ok) {
  // figure out the saved id and construct a minimal appt object
  const savedId = data?._id || data?.data?._id || window.currentEditAppointmentId;
  const appt = {
    _id: savedId,
    date,
    time: toTimeValue(time24 || timeInput), // ensure "HH:mm"
    duration: Number(duration) || 0,
    clientName: (clientFirstName || clientLastName)
      ? `${clientFirstName} ${clientLastName}`.trim()
      : (document.querySelector('#appointment-client option:checked')?.textContent?.trim() || 'Client'),
    serviceIds: [serviceId]
  };

  // Optimistic UI: patch just this card
  // ✅ Upsert a single card — instant UI update, no flicker
  console.log("[save] upserting", appt);
  upsertAppointmentCard(appt);

  // Close dialog & clear edit flag
  if (typeof closeAppointmentPopup === 'function') closeAppointmentPopup();
  window.currentEditAppointmentId = null;

  // Optional: do a silent full refresh later to stay in sync
  // setTimeout(() => { typeof loadAppointments === 'function' && loadAppointments(); }, 1500);
} else {
  alert(`❌ ${data?.message || data?.error || 'Failed to save appointment.'}`);
}
  } catch (err) {
    console.error("❌ Failed to save appointment:", err);
    alert("Something went wrong saving the appointment.");
  }
});



document.addEventListener("DOMContentLoaded", async () => {
  console.log("✅ DOM fully loaded");

  updateMonthYear();
  updateWeekDates(currentWeekStart);   // <-- only this call
  generateHourColumn();
  generateTimeGrid();
  buildHourLabels();
  buildTimeGrid();

  await loadAppointments();

  // 🕗 Auto-scroll to 8AM
  setTimeout(() => {
    const wrapper = document.querySelector(".calendar-wrapper");
    if (wrapper) {
      const slotHeight = 15;
      const eightAMOffset = 8 * 4 * slotHeight; // = 480px
      wrapper.scrollTop = eightAMOffset;
      console.log("🔃 Scrolled to 8AM:", eightAMOffset);
    }
  }, 100);

  // Re-fetch when the business changes
  document.getElementById("business-dropdown")?.addEventListener("change", () => {
    loadAppointments();
  });
});

//Prevent appointment from submitting if new client is not selected and dropdown is not selected 
document.addEventListener("DOMContentLoaded", () => {
  const newClientBtn = document.getElementById("btn-new-client");
  const cancelNewClientBtn = document.getElementById("cancel-new-client-btn");
  const newClientFields = document.getElementById("new-client-fields");
  const clientDropdown = document.getElementById("appointment-client");
  const appointmentForm = document.getElementById("create-appointment-form");

  // ✚ Show new client form
  newClientBtn.addEventListener("click", () => {
    newClientFields.style.display = "block";
    clientDropdown.closest(".form-group").style.display = "none";
  });

  // ❌ Cancel new client form
  cancelNewClientBtn.addEventListener("click", () => {
    newClientFields.style.display = "none";
    clientDropdown.closest(".form-group").style.display = "block";
  });

  // 🧠 Prevent submission if no valid client info
  appointmentForm.addEventListener("submit", (e) => {
    const isNewClientVisible = newClientFields.style.display !== "none";

    const selectedClient = clientDropdown.value;
    const firstName = document.getElementById("new-client-first-name").value.trim();
    const lastName = document.getElementById("new-client-last-name").value.trim();
    const email = document.getElementById("new-client-email").value.trim();
    const phone = document.getElementById("new-client-phone").value.trim();

    if (!isNewClientVisible && !selectedClient) {
      alert("Please select an existing client or add a new one.");
      e.preventDefault();
      return;
    }

    if (isNewClientVisible && (!firstName || !email || !phone)) {
      alert("Please fill out at least first name, email, and phone to create a new client.");
      e.preventDefault();
      return;
    }

    // Optionally: auto-generate full name or validate formats
  });
});



// tolerant value getter
function vget(v, ...keys) {
  for (const k of keys) if (v && v[k] != null && String(v[k]).trim() !== '') return String(v[k]).trim();
  return '';
}

async function fetchRecords(type, where = {}, limit = 1000) {
  const qs = new URLSearchParams({
   where: JSON.stringify(where),
   limit: "500",
   includeRefField: "1",   // ⬅️ expand refs (Client, Service(s), etc.)
   ts: Date.now().toString()
 });
  const res = await fetch(`/api/records/${encodeURIComponent(type)}?${qs}`, {
    credentials: 'include', cache: 'no-store'
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// Build { clientId -> "First Last" }
// Build { clientId -> "First Last" } — merge both Business ref shapes
async function buildClientMap(businessId, includeAll = false) {
  const TYPE = "Client";

  const getId = (x) => (x && typeof x === "object") ? String(x._id || x.id || "") : String(x || "");
  const recordMatchesBusiness = (rec, bizId) => {
    if (includeAll || !bizId || bizId === "all") return true;
    return getId(rec?.values?.["Business"]) === String(bizId);
  };

  async function fetchClients(whereObj) {
    const qs = new URLSearchParams({
      where: JSON.stringify(whereObj || {}),
      limit: "2000",
      ts: Date.now().toString()
    });
    const res = await fetch(`/api/records/${TYPE}?${qs}`, { credentials: "include", cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  }

  // Merge both shapes
  const merged = new Map();
  if (!includeAll && businessId && businessId !== "all") {
    const [byId, byObj] = await Promise.all([
      fetchClients({ "Business": businessId }).catch(() => []),
      fetchClients({ "Business": { _id: businessId } }).catch(() => []),
    ]);
    [...byId, ...byObj].forEach(r => {
      if (recordMatchesBusiness(r, businessId)) merged.set(String(r._id), r);
    });

    // If still empty, fetch all and filter client-side
    if (merged.size === 0) {
      const all = await fetchClients({}).catch(() => []);
      all.forEach(r => { if (recordMatchesBusiness(r, businessId)) merged.set(String(r._id), r); });
    }
  } else {
    const all = await fetchClients({}).catch(() => []);
    all.forEach(r => merged.set(String(r._id), r));
  }

  const map = {};
  [...merged.values()].forEach(r => {
    const v = r.values || {};
    const first = (v["First Name"] || v.firstName || "").trim();
    const last  = (v["Last Name"]  || v.lastName  || "").trim();
    const label = (first || last) ? `${first} ${last}`.trim()
                 : (v["Email"] || v.email || "(Client)");
    map[String(r._id)] = label;
  });

  window.__clientMap = map; // optional global
  return map;
}


// Build { serviceId -> "Service Name" } – try both "Service"/"Services"
// Build { serviceId -> "Service Name" } — robust to Business ref shape
// Build { serviceId -> "Service Name" } — lenient & business-aware
// Build { serviceId -> "Service Name" } — merge both "Service" and "Services"
 function sameBiz(rec, bizId) {
    if (includeAll || !bizId || bizId === 'all') return true;
    const v = rec?.values || {};
    const b = v['Business'] ?? v['businessId'] ?? v['Business Id'] ?? v['Biz'] ?? v['biz'];
    const id = (b && typeof b === 'object') ? (b._id || b.id) : b;
    return String(id || '') === String(bizId);
  }

// Build { serviceId -> "Service Name" } — singular only, filter by Business
async function buildServiceMap(businessId, includeAll = false) {
  function sameBiz(rec, bizId) {
    if (includeAll || !bizId || bizId === 'all') return true;
    const v = rec?.values || {};
    const b = v['Business'] ?? v['businessId'] ?? v['Business Id'] ?? v['Biz'] ?? v['biz'];
    const id = (b && typeof b === 'object') ? (b._id || b.id) : b;
    return String(id || '') === String(bizId);
  }

  const rows = await fetchRecords('Service', {}, 2000).catch(() => []);
  const map = {};
  (rows || []).forEach(r => {
    if (!sameBiz(r, businessId)) return;
    const v = r.values || {};
    const name = v['Name'] || v['Service Name'] || v.serviceName || '(Service)';
    map[String(r._id)] = name;
  });

  window.__serviceMap = map; // optional global
  return map;
}


//DONE new appointment
// ✅ Canonical popup (CREATE vs EDIT based on `appointment` param)
// ✅ Canonical popup (CREATE vs EDIT based on `appointment` param)
async function openAppointmentPopup(appointment = null) {
  // helpers
  const getV = (v, ...keys) => { for (const k of keys) if (v && v[k] != null) return v[k]; };
  const firstId = (val) => {
    if (Array.isArray(val)) return firstId(val[0]);
    if (val && typeof val === 'object') return val._id || val.id || val.value || '';
    return val || '';
  };

  // Load businesses ONCE
  if (!window.__bizLoadedOnce) {
    await loadAppointmentBusinesses();
    window.__bizLoadedOnce = true;
  }

  const form       = document.getElementById("create-appointment-form");
  const popup      = document.getElementById("popup-create-appointment");
  const overlay    = document.getElementById("popup-overlay");
  const titleEl    = document.getElementById("appointment-popup-title");
  const deleteBtn  = document.getElementById("delete-appointment-btn");
  const cancelBtn  = document.getElementById("cancel-appointment-btn");

  const bizSel     = document.getElementById("appointment-business");
  const svcSel     = document.getElementById("appointment-service");
  const clientSel  = document.getElementById("appointment-client");
  const dateInp    = document.getElementById("appointment-date");
  const timeInp    = document.getElementById("appointment-time");
  const durInp     = document.getElementById("appointment-duration");

  // expose a global flag you already use
  window.currentEditAppointmentId = appointment ? (appointment._id || appointment.id) : null;

  if (titleEl)  titleEl.textContent = window.currentEditAppointmentId ? "Edit Appointment" : "Add Appointment";
  if (deleteBtn) deleteBtn.style.display = window.currentEditAppointmentId ? "inline-block" : "none";

  if (cancelBtn) {
    if (window.currentEditAppointmentId) {
      cancelBtn.style.display = "inline-block";
      cancelBtn.dataset.apptId = String(window.currentEditAppointmentId);
    } else {
      cancelBtn.style.display = "none";
      cancelBtn.dataset.apptId = "";
    }
  }

  // reset base UI when creating — DO NOT clear the business select here
  if (form && !appointment) form.reset();
  if (svcSel)    svcSel.innerHTML    = `<option value="">-- Select Service --</option>`;
  if (clientSel) clientSel.innerHTML = `<option value="">-- Select Client --</option>`;
  // ❌ do NOT do: if (bizSel) bizSel.innerHTML = `...`

  if (!appointment) {
    // ===== CREATE MODE =====
    const mainBusiness = document.getElementById("business-dropdown")?.value || "";
    if (bizSel && mainBusiness) {
      bizSel.value = mainBusiness;
      await loadAppointmentServices(mainBusiness);
      await loadAppointmentClients(mainBusiness);
    }
    if (dateInp) dateInp.value = "";
    if (timeInp) timeInp.value = "";
    if (durInp)  durInp.value  = "";
  } else {
// ===== EDIT MODE =====
const v = appointment.values || {};
const businessId = String(firstId(getV(v, "Business","businessId","Business Id")) || "");
const clientId   = String(firstId(getV(v, "Client","clientId")) || "");
const preselectLabel =
  (v["Client Name"]
   || [v["Client First Name"], v["Client Last Name"]].filter(Boolean).join(" ").trim()
   || v["Client Email"]
   || "").trim();

// 👇 remember which client we’re editing, so we can re-insert it after switches
if (clientSel) {
  clientSel.dataset.editId    = clientId;        // real client id (if there is one)
  clientSel.dataset.editLabel = preselectLabel;  // denormalized name/email
  clientSel.dataset.editBizId = businessId;      // only auto-insert when this biz is selected
}

if (bizSel && businessId) bizSel.value = businessId;

if (businessId) {
  await loadAppointmentServices(businessId);
  await loadAppointmentClients(businessId, { selectClientId: clientId, preselectLabel });
}

    const serviceRaw = getV(v, "Service(s)", "Service", "serviceId", "service");
    const serviceId  = firstId(serviceRaw) || "";
    if (svcSel && serviceId) svcSel.value = serviceId;

    if (clientSel && clientId) clientSel.value = clientId;
// after: const businessId = ...; const clientId = ...; const preselectLabel = ...;
if (clientSel) {
  clientSel.dataset.editId    = clientId;         // remember which client we're editing
  clientSel.dataset.editLabel = preselectLabel;   // label to show if not in the fetched list
  clientSel.dataset.editBizId = businessId;       // only auto-insert when this biz is selected
}

    const dateVal = getV(v, "Date", "date") || "";
    if (dateInp) dateInp.value = String(dateVal).split("T")[0] || "";

    const timeVal = getV(v, "Time", "time", "Start Time") || "";
    if (timeInp) timeInp.value = toTimeValue(timeVal);

    const duration = getV(v, "duration", "Duration", "Length", "length");
    if (durInp && duration != null) durInp.value = duration;
  }

  // show popup
  if (popup)   popup.style.display = "block";
  if (overlay) overlay.style.display = "block";
  document.body.classList.add("popup-open");
}

 

//DONE Delete appointment

// Soft delete Appointment (sets deletedAt on the record)
document.getElementById("delete-appointment-btn")?.addEventListener("click", async () => {
  if (!window.currentEditAppointmentId) return;

  if (!confirm("Are you sure you want to delete this appointment?")) return;

  // optional: UI disable while working
  const btn = document.getElementById("delete-appointment-btn");
  if (btn) btn.disabled = true;

  try {
    const res = await fetch(`${API_URL('Appointment')}/${window.currentEditAppointmentId}`, {
      method: 'DELETE',
      credentials: 'include',
      cache: 'no-store'
    });

    const result = await res.json().catch(() => ({}));

  if (res.ok) {
  // Use what the API returned (fall back to the fields we just submitted)
  const rec = data?.data || data?.record || data || {};
  const v   = rec.values || {};

  // helpers you already have:
  // - getId(ref)
  // - normalizeRefArray(val)
  // - to24h(str)   (defined earlier in your submit handler)
  // - upsertAppointmentCard(appt)

  const appt = {
    _id:       rec._id || window.currentEditAppointmentId,           // keep the real id so edits overwrite
    date:      v["Date"]      || date,                               // YYYY-MM-DD
    time:      v["Time"]      || to24h(timeInput),                   // 24h, works with your grid math
    duration:  Number(v["Duration"] ?? duration) || 0,
    clientId:  getId(v["Client"]) || selectedClientId || "",
    serviceIds: normalizeRefArray(v["Service(s)"] ?? serviceId),
    clientName:
      // prefer the selected option’s label (existing client),
      document.querySelector('#appointment-client option:checked')?.textContent?.trim()
      // else freshly created client from the inline fields,
      || `${clientFirstName} ${clientLastName}`.trim()
      || ""
  };

  // 🔁 insert/update just this one card in the visible week
  upsertAppointmentCard(appt);

  // Optional: keep a local cache array in sync (if you keep one)
  // window.__appts = (window.__appts || []).filter(a => a._id !== appt._id).concat(appt);

  // Close and reset UI
  closeAppointmentPopup?.();
  window.currentEditAppointmentId = null;

  // No full reload needed anymore 🚀
  // await loadAppointments();  // ← leave this commented/removed
}

    else {
      alert(`❌ Failed to delete: ${result?.message || `HTTP ${res.status}`}`);
    }
  } catch (err) {
    console.error("❌ Error deleting appointment:", err);
    alert("Something went wrong.");
  } finally {
    if (btn) btn.disabled = false;
  }
});





////////helper functions 
function getDayIndexFromDate(dateStr) {
  const [targetYear, targetMonth, targetDay] = dateStr.split("-").map(Number);

  for (let i = 0; i < currentWeekDates.length; i++) {
    const date = new Date(currentWeekDates[i]);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();

    if (
      year === targetYear &&
      month === targetMonth &&
      day === targetDay
    ) {
      return i;
    }
  }

  return -1; // Not found
}



function getCurrentWeekStartDate() {
  const today = new Date();
  const dayOfWeek = today.getDay(); // Sunday = 0
  const sunday = new Date(today);
  sunday.setDate(today.getDate() - dayOfWeek);
  sunday.setHours(0, 0, 0, 0);
  return sunday;
}

function getTopOffsetFromTime(timeStr) {
  const [hourStr, minuteStr] = timeStr.split(":");
  const hour = parseInt(hourStr, 10);
  const minute = parseInt(minuteStr, 10);

  // 15px per 15-minute block
  return (hour * 4 + minute / 15) * 15;
}


function formatTimeTo12Hour(timeStr) {
  const [hour, minute] = timeStr.split(":").map(Number);
  const ampm = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minute.toString().padStart(2, "0")} ${ampm}`;
}

function getWeekDifferenceFromToday(dateStr) {
  const currentWeekStart = getCurrentWeekStartDate();
  const targetDate = new Date(dateStr);
  const targetWeekStart = getStartOfWeek(targetDate);

  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  const weekDiff = Math.round((targetWeekStart - currentWeekStart) / msPerWeek);
  return weekDiff;
}

function getStartOfWeek(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // Sunday = 0
  d.setDate(d.getDate() - day);
  return d;
}

//////////////////////Sidebar////////////
//All Clients popup
//DONE
// Open the inline client list popup and load businesses + clients
async function openClientListPopup() {
  const sel = document.getElementById("inline-client-business");
  if (!sel) return;

  // Base UI
  sel.innerHTML = `<option value="all">📅 All Businesses</option>`;

  try {
    // Pull businesses via unified API
    const res = await fetch(`${API('Business')}?limit=1000&ts=${Date.now()}`, {
      credentials: 'include',
      cache: 'no-store'
    });
    const rows = res.ok ? await res.json() : [];

    // Sort & render
    rows
      .filter(r => !r.deletedAt)
      .sort((a, b) =>
        (a?.values?.businessName || a?.values?.Name || '')
          .localeCompare(b?.values?.businessName || b?.values?.Name || '')
      )
      .forEach(biz => {
        const opt = document.createElement("option");
        opt.value = biz._id;
        opt.textContent = biz.values?.businessName || biz.values?.Name || "Unnamed Business";
        sel.appendChild(opt);
      });

    // Preselect current/last business if present
    const current = document.getElementById("business-dropdown")?.value || '';
    const last    = window.lastEditedBusinessId || '';

    if (current && sel.querySelector(`option[value="${current}"]`)) {
      sel.value = current;
    } else if (last && sel.querySelector(`option[value="${last}"]`)) {
      sel.value = last;
    } else {
      // keep "All" by default
      sel.value = "all";
    }
  } catch (err) {
    console.error("Failed to load businesses for client popup:", err);
    // fall back to All
    sel.value = "all";
  }

  // Load clients for the selected business (or all)
  await loadClientList(sel.value === "all" ? null : sel.value);

  // Re-load clients when the inline dropdown changes
  if (!sel.dataset.bound) {
    sel.addEventListener("change", () => {
      loadClientList(sel.value === "all" ? null : sel.value);
    });
    sel.dataset.bound = "1";
  }



  // Show the popup
  document.getElementById("popup-view-clients").style.display = "block";
  document.getElementById("popup-overlay").style.display = "block";
  document.body.classList.add("popup-open");
}

function closeClientListPopup() {
  document.getElementById("popup-view-clients").style.display = "none";
  document.getElementById("popup-overlay").style.display = "none";
  document.body.classList.remove("popup-open");
}

// render client list
function getV(v, ...keys) {
  for (const k of keys) {
    if (v?.[k] !== undefined && v[k] !== null) return v[k];
  }
  return '';
}

/**
/**
 * Load and render the client list.
 * @param {string} businessId - pass a Business _id to filter, or 'all' / '' for all.
 */
// ------- ALL CLIENTS POPUP LIST -------
// Shows real Client records + self-booked clients derived from Appointments
async function loadClientList(businessId = 'all') {
  const container = document.getElementById("client-list-container");
  if (!container) return;
  container.innerHTML = "<p>Loading...</p>";

  async function fetchJSON(url) {
    const r = await fetch(url, { credentials: 'include', cache: 'no-store', headers:{Accept:'application/json'} });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  }

  // build a single index for dedupe
  const byId = new Map();

  try {
    // ---------- A) REAL CLIENT RECORDS ----------
    {
      const where = { "is Deleted": false };
      if (businessId && businessId !== "all") {
        // try both shapes
        const qs1 = new URLSearchParams({
          where: JSON.stringify({ ...where, "Business": businessId }),
          limit: "1000",
          ts: Date.now().toString()
        });
        let rows = await fetchJSON(`/api/records/Client?${qs1}`);

        if (!rows?.length) {
          const qs2 = new URLSearchParams({
            where: JSON.stringify({ ...where, "Business": { _id: businessId } }),
            limit: "1000",
            ts: Date.now().toString()
          });
          rows = await fetchJSON(`/api/records/Client?${qs2}`);
        }

        // defensive filter anyway
        for (const r of rows || []) {
          const v = r.values || {};
          if (!matchesBusiness(v, businessId)) continue;
          if (r.deletedAt || v["is Deleted"]) continue;
          byId.set(String(r._id), {
            id: String(r._id),
            label: labelFromRecord(v),
            email: (v["Email"] || v.email || "").trim()
          });
        }
      } else {
        // ALL businesses
        const qs = new URLSearchParams({
          where: JSON.stringify(where),
          limit: "1000",
          ts: Date.now().toString()
        });
        const rows = await fetchJSON(`/api/records/Client?${qs}`);
        for (const r of rows || []) {
          const v = r.values || {};
          if (r.deletedAt || v["is Deleted"]) continue;
          byId.set(String(r._id), {
            id: String(r._id),
            label: labelFromRecord(v),
            email: (v["Email"] || v.email || "").trim()
          });
        }
      }
    }

    // ---------- B) CLIENTS DERIVED FROM APPOINTMENTS ----------
    // private appointments (support both Business shapes) + public appointments
    const addFromAppts = (arr = []) => {
      for (const row of arr) {
        const v   = row.values || row;
        if (businessId !== 'all' && !matchesBusiness(v, businessId)) continue;

        // prefer the true Client ref id; otherwise synthesize a stable virtual id
        let key = normalizeRefId(v["Client"]);
        if (!key) {
          const em = (v["Client Email"] || "").trim().toLowerCase();
          if (!em) continue; // no dedupe key available
          key = `virtual:${em}`;
        }

        if (!byId.has(key)) {
          byId.set(key, {
            id: key,
            label: labelFromAppt(v),
            email: (v["Client Email"] || "").trim()
          });
        }
      }
    };

    // private appts
    if (businessId && businessId !== "all") {
      for (const where of [{ "Business": businessId }, { "Business": { _id: businessId } }]) {
        const qs = new URLSearchParams({
          where: JSON.stringify(where),
          limit: "1000",
          ts: Date.now().toString()
        });
        try { addFromAppts(await fetchJSON(`queryRecords('Appointment', WHERE_OBJ, OPTIONS)${qs}`)); } catch {}
      }
    } else {
      try {
        addFromAppts(await fetchJSON(`queryRecords('Appointment', WHERE_OBJ, OPTIONS)limit=1000&ts=${Date.now()}`));
      } catch {}
    }

    // public appts (read-only list)
    try {
      const params = new URLSearchParams({ dataType: 'Appointment', ts: Date.now().toString() });
      if (businessId && businessId !== 'all') params.append('Business', businessId);
      const pub = await fetchJSON(`/public/records?${params}`);
      addFromAppts(pub);
    } catch {}

    // ---------- C) Render ----------
    const list = Array.from(byId.values())
      .sort((a, b) => a.label.localeCompare(b.label));

    container.innerHTML = "";
    if (!list.length) {
      container.innerHTML = `<p>No clients yet.</p>`;
      return;
    }

    for (const c of list) {
      const div = document.createElement("div");
      div.className = "clickable-client";
      div.style.padding = "8px 0";
      div.textContent = c.label || "(Client)";
      // turn a "virtual:*" into a lightweight detail
      div.addEventListener("click", () => {
        const [first, ...rest] = (c.label || "").split(" ");
        showClientDetail({
          _id: c.id,
          firstName: first || "",
          lastName: rest.join(" ") || "",
          email: c.email || "",
          phone: "",
          businessId: businessId === 'all' ? '' : businessId
        });
      });
      container.appendChild(div);
    }
  } catch (err) {
    console.error("❌ Failed to load clients:", err);
    container.innerHTML = "<p>Error loading clients.</p>";
  }
}


//DONE Show Client Detail 
function showClientDetail(client) {
  // Hide list + inline add section
  const listEl = document.getElementById("client-list-container");
  const addEl  = document.getElementById("inline-add-client-section");
  if (listEl) listEl.style.display = "none";
  if (addEl)  addEl.style.display  = "none";

  // Show detail section
  const detailSection = document.getElementById("client-detail-section");
  if (detailSection) detailSection.style.display = "block";

  // Fill data
  const name   = `${client.firstName} ${client.lastName || ""}`.trim() || "(No name)";
  const email  = client.email ? `📧 ${client.email}` : "❌ No email";
  const phone  = client.phone ? `📞 ${client.phone}` : "❌ No phone";

  const nameEl  = document.getElementById("detail-name");
  const emailEl = document.getElementById("detail-email");
  const phoneEl = document.getElementById("detail-phone");

  if (nameEl)  nameEl.textContent  = name;
  if (emailEl) emailEl.textContent = email;
  if (phoneEl) phoneEl.textContent = phone;

  // Placeholder stats (replace with real counts later if desired)
  const statsEl = document.getElementById("detail-stats");
  if (statsEl) {
    statsEl.innerHTML = `
      <strong>Appointments:</strong> 0<br>
      <strong>Cancellations:</strong> 0<br>
      <strong>No Shows:</strong> 0
    `;
  }

  // Make the toggle button neutral in detail mode (optional)
  const toggleBtn = document.getElementById("toggle-add-client-btn");
  if (toggleBtn) {
    toggleBtn.textContent = "Add New Client";
    toggleBtn.classList.add("no-background");
  }
}



function backToClientList() {
  document.getElementById("client-detail-section").style.display = "none";
  document.getElementById("client-list-container").style.display = "block";
}
//Show add client section 
function showAddClientSection() {
  const addSection = document.getElementById("inline-add-client-section");
  const clientList = document.getElementById("client-list-container");
  const clientDetail = document.getElementById("client-detail-section");
  const toggleBtn = document.getElementById("toggle-add-client-btn");

  const isHidden = addSection.style.display === "none";

  // Toggle visibility
  addSection.style.display = isHidden ? "block" : "none";
  clientList.style.display = isHidden ? "none" : "block";
  clientDetail.style.display = "none";

  // Change button text
  toggleBtn.textContent = isHidden ? "View All Clients" : "Add New Client";

  // Always reset background when toggling
  toggleBtn.classList.remove("no-background");
}