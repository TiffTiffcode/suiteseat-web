// C:\Users\tiffa\OneDrive\Desktop\suiteseat-web\public\qassets\js\booking-page2.js
 // Logs live *inside* the wrapper
  console.log('[booking] booking-page.js suiteseat-web loaded');
(function () {
  // ---- decide if this file should run on this page ----
  const slug = (window.BOOKING_PAGE && window.BOOKING_PAGE.slug) || null;
  const hasMarker = !!document.getElementById('booking-root');

  const segs = location.pathname.split('/').filter(Boolean);
  const reserved = new Set([
    'store-settings', 'availability', 'login', 'signup',
    'dashboard', 'api', 'public', '_next', 'qassets'
  ]);
  const isSingleSlug = segs.length === 1 && !reserved.has(segs[0]) && !segs[0].includes('.');

  const SHOULD_RUN = !!slug || hasMarker || isSingleSlug;

  if (!SHOULD_RUN) {
    console.debug('[booking] skipped on non-booking route:', location.pathname);
    return; // ⛔ stop — nothing below executes
  }

const $  = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

// ---- ensure a logged-in user id (from cookie-backed /api/users/me) ----
async function ensureUserId() {
  // 1) already have a user id in STATE?
  const st = (window.BookingApp && window.BookingApp.STATE) || {};
  if (st.user?.userId) return st.user.userId;

  // 2) try hydrating from server
  try {
    const r = await fetch('/api/users/me?ts=' + Date.now(), { credentials: 'include' });
    if (!r.ok) return null;
    const data = await r.json().catch(() => ({}));
    const u = data?.user;
    if (u?._id) {
      window.BookingApp = window.BookingApp || {};
      window.BookingApp.STATE = { ...(st || {}), user: { ...(st.user||{}), loggedIn:true, hydrated:true, userId:u._id, email:u.email||'' } };
      return u._id;
    }
  } catch {}
  return null;
}

// ---- guard that forces login if needed ----
async function requireUserIdOrLogin() {
  await hydrateUser();
  const uid = STATE?.user?.userId;
  if (uid) return uid;

  // not logged in → open modal and stop flow
  STATE.user = { ...(STATE.user||{}), continueAfterLogin: true };
  openAuth();
  throw new Error('Login required'); // caller should catch and pause
}


// ----- HARD CONFIG: type ids your API needs -----
window.CONFIG ??= {};
window.CONFIG.dataTypeIds ??= {};
// paste YOUR ids
window.CONFIG.dataTypeIds.Appointment = '68aec5009f8cc70218a927f7';
window.CONFIG.dataTypeIds.Client      = '68aec5439f8cc70218a9280c';


// ===== Canonical STATE (single source of truth) =====
window.BookingApp = window.BookingApp || {};
window.BookingApp.STATE = window.BookingApp.STATE || {
  businessId: null,
  selected: { calendarId:null, categoryId:null, serviceIds:[], dateISO:null, timeHHMM:null, durationMin:0 },
  mode: { multiService: false },
  user: { loggedIn:false, hydrated:false, userId:null, email:'', firstName:'', lastName:'', phone:'' },
  ownerUserId: null,
  calendars: [],
  calById: null,
};
// Always use the same reference everywhere:
window.STATE = window.BookingApp.STATE;




// Ensure a single global API bag exists
// One global API bag
window.API = window.API || {};
const API = window.API; // alias

// ===== AUTH MODAL =====
window.openAuth = function openAuth() {
  const m = document.getElementById('authModal');
  if (!m) return;
  m.classList.add('is-open');

  // Ensure the Sign In button is wired even if the modal is created later
  const btn = document.getElementById('btn-login');
  if (btn && !btn.__wiredLogin) {
    btn.__wiredLogin = true;
    btn.addEventListener('click', window.onLoginClick);
  }
};

window.closeAuth = function closeAuth() {
  const m = document.getElementById('authModal');
  if (m) m.classList.remove('is-open');
};

// Simple helper
async function logout() {
  try {
    await fetch('/api/logout', { method: 'POST', credentials: 'include' });
  } catch (_) {}
  // Clear client state
  STATE.user = { loggedIn:false, hydrated:true };
  // (optional) clear any safety local storage
  try { localStorage.removeItem('lastBooked'); } catch {}

  // Update UI pieces
  setAuthUI();
  // If confirm modal was open, close it
  try { closeConfirm(); } catch {}
  // Optionally force a lightweight refresh of slots so “Book Now” requires login again
  try {
    const iso = STATE?.selected?.dateISO;
    if (iso) {
      const slots = await computeTimeslotsForDate(iso);
      renderTimeslots(slots);
    }
  } catch {}
}

function setAuthUI() {
  const span = document.getElementById('login-status-text');
  const btn  = document.getElementById('logout-btn');
  const u    = STATE.user || {};

  if (u.loggedIn) {
    span.textContent = u.firstName ? `Hey, ${u.firstName}` : (u.email || 'Signed in');
    if (btn) btn.style.display = '';
  } else {
    span.textContent = 'Not signed in';
    if (btn) btn.style.display = 'none';
  }
}

// wire the button once
document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('logout-btn');
  if (btn && !btn.__wired) {
    btn.__wired = true;
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      logout();
    });
  }
  // reflect current state at load
  setAuthUI();
});

function showSuccess({ dateISO, timeHHMM, durationMin }) {
  $("#success-details").innerHTML = `
    <div><strong>Date:</strong> ${formatDatePretty(dateISO)}</div>
    <div><strong>Time:</strong> ${to12h(timeHHMM)}</div>
    <div><strong>Duration:</strong> ${durationMin} min</div>
  `;
  closeConfirm();                 // hide confirm modal
  $("#successModal").classList.add("is-open");  // show success modal
}

function requireFreshLogin() {
  return new Promise((resolve, reject) => {
    // open modal every time (require re-auth)
    openAuth();

    const onOk = (e) => {
      document.removeEventListener('auth:ok', onOk, { once: true });
      resolve(e.detail?.userId || null);
    };
    document.addEventListener('auth:ok', onOk, { once: true });

    // optional: timeout so the Promise doesn’t hang forever
    setTimeout(() => {
      document.removeEventListener('auth:ok', onOk, { once: true });
      reject(new Error('LOGIN_TIMEOUT'));
    }, 2 * 60 * 1000); // 2 mins
  });
}

function $val(id) {
  const el = document.getElementById(id);
  return (el ? String(el.value || '') : '').trim();
}

// ---- API.login already defined to POST /api/login with credentials: 'include' ----
// Ensure yours looks like this (keep only ONE definition):
API.login = async (email, password) => {
  async function post(path) {
    return fetch(path, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ email, password })
    });
  }
  // Try the working route first
  let res = await post('/api/login');
  if (res.status === 404 || res.status === 405) res = await post('/api/users/login');

  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`Login failed: ${res.status} ${res.statusText} — ${txt}`);
  }
  return res.json().catch(() => ({}));
};


// Hydrate the logged-in user (make global so others can call it)
// Helper: always get a valid STATE object
function getSTATE() {
  // Ensure the container exists
  window.BookingApp = window.BookingApp || {};
  window.BookingApp.STATE = window.BookingApp.STATE || {
    businessId: null,
    selected: { calendarId:null, categoryId:null, serviceIds:[], dateISO:null, timeHHMM:null, durationMin:0 },
    mode: { multiService:false },
    user: { loggedIn:false, userId:null, role:null, email:'', firstName:'', lastName:'', phone:'' },
    ownerUserId: null,
    calendars: null,
    calById: null,
  };
  return window.BookingApp.STATE;
}

// Hydrate the logged-in user (make global so others can call it)
// Hydrate the logged-in user (make global so others can call it)
window.hydrateUser = async function hydrateUser() {
  try {
    if (STATE.user?.hydrated) return;
    const r = await fetch('/api/users/me?ts=' + Date.now(), { credentials: 'include' });
    if (r.status === 401) { STATE.user = { loggedIn:false, hydrated:true }; setAuthUI(); return; }
    const { user } = await r.json();
    STATE.user = {
      ...(STATE.user || {}),
      loggedIn: true,
      hydrated: true,
      userId:    user._id,
      email:     (user.email || '').trim(),
      firstName: (user.firstName || '').trim(),
      lastName:  (user.lastName  || '').trim(),
      phone:     (user.phone || user.phoneNumber || '').trim(),
      profilePhoto: user.profilePhoto || ''
    };
  } catch {
    // leave STATE.user as-is
  } finally {
    setAuthUI();
  }
};


// ---- Sign-in click handler (GLOBAL) ----
// ---- AUTH ----
window.onLoginClick = async function onLoginClick() {
  try {
    const email = $("#auth-email").value.trim();
    const pass  = $("#auth-pass").value.trim();
    if (!email || !pass) return;

    const res = await API.login(email, pass);

    // hydrate STATE.user
    STATE.user = {
      ...(STATE.user || {}),
      loggedIn: true,
      hydrated: true,
      userId:    res.userId || res._id || res.id || null,
      email:     (res.email || email || '').trim(),
      firstName: (res.firstName || '').trim(),
      lastName:  (res.lastName || '').trim(),
      phone:     (res.phone || res.phoneNumber || '').trim(),
      lastAuthAt: Date.now()
    };

    closeAuth();

    // 🔔 tell the app a fresh login just happened
    document.dispatchEvent(new CustomEvent('auth:ok', { detail: { userId: STATE.user.userId } }));

  } catch (e) {
    alert("Login failed. Please check your credentials.");
    console.error(e);
  }
};

// ---- Wire the Sign In button ONCE ----
(function wireLoginOnce(){
  if (window.__LOGIN_WIRED__) return;
  window.__LOGIN_WIRED__ = true;
  const btn = document.getElementById('btn-login');
  if (btn && !btn.__wiredLogin) {
    btn.__wiredLogin = true;
    btn.addEventListener('click', window.onLoginClick);
  }
})();


// === CAL singleton getter (global, no TDZ) ===
// CAPS (capability cache) — one global, never re-declared
window.BookingApp ??= {};
window.BookingApp.CAPS ??= Object.create(null);

// Ensure app bag exists
window.BookingApp = window.BookingApp || {};

// ✅ Single calendar singleton used everywhere
function getCAL() {
  // create or reuse the global singleton
  window.__CAL = window.__CAL || {
    year: null,
    month: null,
    selectedISO: null,
    todayISO: null,
    available: new Set(),
    inited: false,
    els: {}
  };

  // keep BookingApp.CAL as an alias to the same object (back-compat)
  window.BookingApp.CAL = window.__CAL;

  return window.__CAL;
}

// --- compatibility alias for any legacy code that says "cal" ---
if (!('cal' in window)) {
  Object.defineProperty(window, 'cal', {
    get: () => getCAL(),
    configurable: true
  });
}

(function BOOT(){
  // prevent duplicate side-effects, but DO NOT return
  if (window.__BOOKING_BOOT_DONE__) {
    console.warn('[booking-js] duplicate load detected (continuing safely)');
  }
  window.__BOOKING_BOOT_DONE__ = true;


   // Make sure CAL exists early (no const binding)
  getCAL();

 

  // ---- SINGLETONS (must come first) ----
  window.BookingApp = window.BookingApp || {};

  // One canonical STATE object
  window.BookingApp.STATE = window.BookingApp.STATE || {
    businessId: null,
    selected: { calendarId:null, categoryId:null, serviceIds:[], dateISO:null, timeHHMM:null, durationMin:0 },
    mode: { multiService:false },
    user: { loggedIn:false, userId:null, role:null, email:'', firstName:'', lastName:'', phone:'' },
    ownerUserId: null,
    calendars: null,
    calById: null,
  };
  const STATE = window.BookingApp.STATE;

  // Arrays that handlers read/write — never reassign, only mutate
  window.BookingApp.CURRENT_SERVICES   = window.BookingApp.CURRENT_SERVICES   || [];
  window.BookingApp.CURRENT_CATEGORIES = window.BookingApp.CURRENT_CATEGORIES || [];
  const CURRENT_SERVICES   = window.BookingApp.CURRENT_SERVICES;
  const CURRENT_CATEGORIES = window.BookingApp.CURRENT_CATEGORIES;

  // helper to replace array contents without changing the reference
  function replaceArrayContents(targetArr, nextArr){
    targetArr.length = 0;
    if (Array.isArray(nextArr)) targetArr.push(...nextArr);
  }

  // ---- helpers that must exist before any handler uses them ----

  // Local date helpers (no timezone drift)
  function parseYMDLocal(ymd){ const [y,m,d]=(ymd||"").split("-").map(Number); return new Date(y,(m||1)-1,d||1,0,0,0,0); }
  function toYMDLocal(date){ const y=date.getFullYear(); const m=String(date.getMonth()+1).padStart(2,"0"); const d=String(date.getDate()).padStart(2,"0"); return `${y}-${m}-${d}`; }
  function addDaysLocal(date,days){ return new Date(date.getFullYear(),date.getMonth(),date.getDate()+(days||0)); }

  // URL helper (single definition)
  window.toUrl = window.toUrl || function toUrl(v){
    if (!v) return "";
    if (Array.isArray(v)) v = v[0];
    if (typeof v === "object") v = v.url || v.path || v.src || v.filename || v.name || "";
    v = String(v);
    return (/^https?:\/\//i.test(v) || v.startsWith("/")) ? v : `/uploads/${v.replace(/^\/+/, "")}`;
  };

  // id helpers
  function idOf(x){ if (!x) return ""; return (typeof x === "object") ? (x._id || x.id || "") : String(x); }
  const refId = (x) => (x && typeof x === "object") ? (x._id || x.id || "") : (x || "");

  // calendar helpers
  function extractProUserId(calendarRow) {
    const v = calendarRow?.values || calendarRow || {};
    const proLike =
      v.Pro || v['Pro Ref'] ||
      v.Staff || v['Staff Ref'] ||
      v.Professional || v.Provider || v.Owner ||
      v['Pro User Id'] || v.proUserId;
    const id = refId(proLike);
    return id || "";
  }
  function setSelectedCalendar(calId) {
    STATE.selected.calendarId = calId;
    const row = window.CALENDAR_BY_ID?.[String(calId)];
    STATE.selected.proUserId  = row ? extractProUserId(row) : "";
    console.log("[booking] selected calendar", { calId, proUserId: STATE.selected.proUserId });
  }

  function getClientName(row) {
    const v = row?.values || row || {};
    const dn = (v["Client Name"] || "").trim();
    if (dn) return dn;
    const fn = (v["Client First Name"] || "").trim();
    const ln = (v["Client Last Name"]  || "").trim();
    if (fn || ln) return `${fn} ${ln}`.trim();
    const c  = v.Client || v["Client"];
    const cv = c?.values || {};
    const efn = (cv?.["First Name"] || cv?.firstName || "").trim();
    const eln = (cv?.["Last Name"]  || cv?.lastName  || "").trim();
    if (efn || eln) return `${efn} ${eln}`.trim();
    const em = (v["Client Email"] || cv?.Email || "").trim();
    return em || "(No client)";
  }

  // ---- query helpers (define EARLY, once) ----
  if (!window.$)  window.$  = (sel, root) => (root || document).querySelector(sel);
  if (!window.$$) window.$$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const $  = window.$;   // local aliases (do not redeclare later)
  const $$ = window.$$;

  // ---- BOOTSTRAP: fetch Business by slug ----
  document.addEventListener("DOMContentLoaded", async () => {
    const slug = location.pathname.replace(/^\/+/, "").split("/")[0];
    if (!slug) { showError("No business slug in URL."); return; }

    try {
      // fetch business by slug (API first, then legacy .json, then public records)
      let resp = await fetch(`/api/public/${encodeURIComponent(slug)}`, {
        headers: { Accept: "application/json" },
        credentials: "same-origin",
      });
      if (!resp.ok) {
        resp = await fetch(`/${encodeURIComponent(slug)}.json`, {
          headers: { Accept: "application/json" },
          credentials: "same-origin",
        });
      }
      if (!resp.ok) {
        resp = await fetch(
          `/public/records?dataType=Business&slug=${encodeURIComponent(slug)}`,
          { headers: { Accept: "application/json" }, credentials: "same-origin" }
        );
      }

      if (!resp.ok) throw new Error(`Business fetch ${resp.status}`);

      const data = await resp.json();
      const biz  = Array.isArray(data) ? data[0] : data;
      if (!biz) throw new Error("No business doc returned");

      const v = biz.values || {};
      window.businessData       = { _id: biz._id, ...v };
      window.selectedBusinessId = biz._id;
      STATE.businessId          = biz._id;

      // Resolve owner/creator id
      STATE.ownerUserId =
        idOf(biz.createdBy) ||
        idOf(v["Created By"]) ||
        idOf(v.createdBy)     ||
        idOf(v.Owner)         || idOf(v["Owner"]) ||
        idOf(v.User)          || idOf(v["User"])  ||
        idOf(v["Pro User"])   || idOf(v.Pro)      ||
        null;

      // If missing, try a private fetch that includes createdBy
      if (!STATE.ownerUserId) {
        try {
          const r = await fetch(`/api/records/Business/${encodeURIComponent(biz._id)}?includeCreatedBy=1`, {
            credentials: 'include',
            headers: { Accept: 'application/json' },
            cache: 'no-store'
          });
          if (r.ok) {
            const full = await r.json();
            const fv = full.values || {};
            STATE.ownerUserId =
              idOf(full.createdBy) ||
              idOf(fv["Created By"]) || idOf(fv.createdBy) ||
              idOf(fv.Owner) || idOf(fv["Owner"]) ||
              idOf(fv.User)  || idOf(fv["User"])  ||
              null;
          }
        } catch (e) {
          console.debug('[biz owner lookup]', e);
        }
      }

      console.log('[booking] biz/owner', { bizId: STATE.businessId, ownerUserId: STATE.ownerUserId });

    // title + subtitle
    const bizName = v.businessName || v.name || v["Business Name"] || "Business";
    const subline = v.tagline || v.subtitle || "";
    document.title = bizName;
    const nameEl = document.getElementById("bizName");
    const subEl  = document.getElementById("bizSub");
    if (nameEl) nameEl.textContent = bizName;
    if (subEl)  subEl.textContent  = subline;

    // HERO: image if present, otherwise show the text block
    const heroUrl = toUrl(v.heroImageUrl ?? v.heroImage ?? v["Hero Image"] ?? v.hero_image ?? "");
    const hero    = document.getElementById("hero");
    const heroImg = document.getElementById("heroImg");
    const meta    = hero ? hero.querySelector(".hero__meta") : null;

    function showImageMode(url){
      if (!hero || !heroImg) return;
      hero.classList.add("hero--img", "hero--bleed");
      if (meta) meta.style.display = "none";
      heroImg.style.display = "block";
      heroImg.src = url;
    }
    function showTextMode(){
      if (!hero || !heroImg) return;
      hero.classList.remove("hero--img", "hero--bleed");
      heroImg.removeAttribute("src");
      heroImg.style.display = "none";
      if (meta) meta.style.display = ""; // show name/subtitle
    }

    if (heroUrl) {
      heroImg.onload  = () => showImageMode(heroUrl);
      heroImg.onerror = showTextMode;
      heroImg.src     = heroUrl; // triggers onload/onerror
    } else {
      showTextMode();
    }

    // ---- CALENDAR SINGLETON (must be created early) ----
window.BookingApp = window.BookingApp || {};

 // ---- Calendars load with auto-advance when there is exactly one ----
// ---- Calendars load with auto-advance when there is exactly one ----
let calendars = await loadCalendarsForBusiness(biz._id);
if (!Array.isArray(calendars)) calendars = [];

// index calendars so setSelectedCalendar can look up the pro
window.CALENDAR_BY_ID = Object.create(null);
calendars.forEach(c => {
  const id = String(c._id || c.id || c.calendarId);
      const name = pickCalendarName(c);  
      window.CALENDAR_BY_ID[id] = c;
});


if (calendars.length === 1) {
  const onlyCal = calendars[0];
  const calId = onlyCal._id || onlyCal.id || onlyCal.calendarId;

  hide(getCalendarSectionEl());

  // ✅ this is the line you were looking for
  setSelectedCalendar(calId);

  const categories = await getCategoriesForCalendar(biz._id, calId);
  if (typeof renderCategories === 'function') {
    renderCategories(categories);
    show(document.getElementById('section-cats'));
  } else {
    simpleRenderCategories(categories);
  }
} else {
  show(getCalendarSectionEl());
  // (if you have a UI control where the user picks a calendar,
  // call setSelectedCalendar(chosenId) in that change/click handler)
}


    const avail = document.getElementById("section-availability") ||
                  document.getElementById("availability-section");
    if (avail) avail.scrollIntoView({ behavior: "smooth", block: "start" });

  } catch (err) {
    console.error("Business fetch error:", err);
    showError("Business not found. Check your URL slug (e.g., /thebusinessname).");
    const h = document.getElementById("bizName") || document.getElementById("business-title");
    if (h) h.textContent = "Business not found";
  }
});







// ---- helpers ----
async function quietGetCap(url, opts, capKey) {
  const CAPS = window.BookingApp.CAPS;   // ← local alias (safe)
  if (capKey && CAPS[capKey] === false) return [];
  try {
    const r = await fetch(url, opts);
    if (r.status === 404 || r.status === 405) {
      if (capKey) CAPS[capKey] = false; // remember: endpoint not available
      return [];
    }
    if (!r.ok) return [];
    const data = await r.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

async function openAvailability() {
  const CAL = getCAL();
  initCalState();

  if (!STATE.selected.dateISO) {
    STATE.selected.dateISO = CAL.selectedISO || CAL.todayISO;
  }

  if (typeof buildAndRenderMonth === 'function') {
    await buildAndRenderMonth();
  }

  const slots = await computeTimeslotsForDate(STATE.selected.dateISO);
  renderTimeslots(slots);
  await refreshDayDot(STATE.selected.dateISO);
  document.getElementById('section-availability')
    ?.scrollIntoView({ behavior: 'smooth' });
}

function onPickDate(ymd) {
  const CAL = getCAL();
  CAL.selectedISO        = String(ymd);
  STATE.selected.dateISO = CAL.selectedISO;
  openAvailability();
}


// Try a series of filter key/value pairs against /public/records until one returns rows
async function tryPublicList(dataType, attemptPairs) {
  for (const pairs of attemptPairs) {
    const params = new URLSearchParams({ dataType });
    for (const [k, v] of pairs) {
      if (v == null || v === "") continue;
      params.append(k, String(v));
    }
    const url = `/public/records?${params.toString()}`;
    console.log('➡️ fetch', dataType, url);
    try {
      const r = await fetch(url, { headers: { Accept: 'application/json' }, credentials: 'same-origin' });
      if (!r.ok) continue;
      const rows = await r.json();
      if (Array.isArray(rows) && rows.length) return rows;
    } catch (_) {}
  }
  return [];
}

function clearNode(selOrEl) {
  const el = typeof selOrEl === 'string' ? document.querySelector(selOrEl) : selOrEl;
  if (el) el.innerHTML = '';
}

function showError(msg) {
  const el = document.getElementById("page-error");
  if (el) { el.textContent = msg; el.style.display = "block"; } else { alert(msg); }
}

function coerceText(val) {
  if (val == null) return "";
  if (typeof val === "string") return val.trim();
  if (typeof val === "number") return String(val);
  if (typeof val === "object") {
    // common shapes: { label: "..." }, { text: "..." }, { name: "..." }
    for (const k of ["label", "text", "name", "title", "value"]) {
      if (typeof val[k] === "string" && val[k].trim()) return val[k].trim();
    }
  }
  return "";
}

function pickTitleLike(obj = {}) {
  const v = obj.values || {};
  const tryKeys = [
    // flat
    "name","Name","calendarName","Calendar Name","Calendar name",
    "title","Title","displayName","Display Name","label","Label",
    // nested candidates
    ["name"],["Name"],["title"],["Title"],["displayName"],["Display Name"]
  ];

  // 1) preferred direct hits (flat or in values)
  for (const k of tryKeys) {
    const key = Array.isArray(k) ? k[0] : k;
    const val = obj[key] ?? v[key];
    const t = coerceText(val);
    if (t) return t;
  }

  // 2) heuristic: any key containing "name" or "title"
  const scan = (o) => {
    for (const [k, val] of Object.entries(o)) {
      if (/name|title/i.test(k)) {
        const t = coerceText(val);
        if (t) return t;
      }
    }
    return "";
  };
  const h1 = scan(obj);
  if (h1) return h1;
  const h2 = scan(v);
  if (h2) return h2;

  return "Calendar";
}

// case-insensitive value picker with a few common aliases
function pick(v = {}, ...keys) {
  for (const k of keys) {
    const val = v?.[k];
    if (val != null && String(val).trim() !== "") return val;
  }
  // final case-insensitive sweep
  const lower = Object.fromEntries(
    Object.entries(v).map(([k, val]) => [k.toLowerCase(), val])
  );
  return (
    lower["name"] ??
    lower["calendar name"] ??
    lower["calendarname"] ??
    lower["title"] ??
    lower["label"] ??
    null
  );
}

function calendarTitle(cal) {
  return (
    pick(
      cal,
      "name",
      "Name",
      "calendarName",
      "Calendar Name",
      "Calendar name",
      "title",
      "Title",
      "label",
      "Label"
    ) || "Calendar"
  );
}

function calendarDesc(cal) {
  return pick(cal, "description", "Description", "details", "Details", "note", "Note");
}

// --- tiny helpers ---
function toText(v) {
  if (v == null) return '';
  if (typeof v === 'string') return v.trim();
  if (typeof v === 'number') return String(v);
  if (typeof v === 'object') {
    for (const k of ['label','text','name','title','value']) {
      if (typeof v[k] === 'string' && v[k].trim()) return v[k].trim();
    }
    // asset-like shapes: {url|path|src|filename|name}
    for (const k of ['url','path','src','filename','name']) {
      if (typeof v[k] === 'string' && v[k].trim()) return v[k].trim();
    }
  }
  return '';
}
function firstText(...cands) {
  for (const c of cands) {
    const t = toText(c);
    if (t) return t;
  }
  return '';
}
function imageUrlFrom(v = {}) {
  const picks = [
    v.imageUrl, v['Image URL'], v.image, v.Image,
    v.photo, v.Photo, v.picture, v.Picture,
    v.thumbnail, v.Thumbnail, v.cover, v.Cover,
    v.heroImage, v['Hero Image']
  ];
  for (const p of picks) {
    const url = window.toUrl ? window.toUrl(p) : toText(p);
    if (url) return url;
  }
  if (Array.isArray(v.images) && v.images.length) {
    const url = window.toUrl ? window.toUrl(v.images[0]) : toText(v.images[0]);
    if (url) return url;
  }
  return '';
}
function escapeHtml(s='') {
  return String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;')
    .replace(/'/g,'&#39;');
}

/////////////////////////////////////////////////////////////////////////////////////////////////

async function requireUserIdOrLogin() {
  const uid = await ensureUserId();
  if (uid) return uid;
  window.BookingApp ??= {}; window.BookingApp.STATE ??= {};
  window.BookingApp.STATE.user = { ...(window.BookingApp.STATE.user||{}), continueAfterLogin: true };
  if (typeof window.openAuth === 'function') window.openAuth();
  throw new Error('LOGIN_REQUIRED');
}

function pickCalendarName(doc = {}) {
  const v = doc.values || doc;

  // direct/common keys
  const keys = [
    "name","Name","calendarName","Calendar Name","Calendar name",
    "title","Title","displayName","Display Name","label","Label"
  ];
  for (const k of keys) {
    const t = toText(doc[k] ?? v[k]);
    if (t) return t;
  }

  // heuristic: any key that contains name/title
  for (const [k, val] of Object.entries(v)) {
    if (/name|title/i.test(k)) {
      const t = toText(val);
      if (t) return t;
    }
  }
  return "Calendar";
}

// Resolve the dataTypeId for a given type name (e.g., "Appointment")
// ---- CONFIG: set your real Client dataTypeId once you know it
window.CONFIG = window.CONFIG || {};
window.CONFIG.dataTypeIds = window.CONFIG.dataTypeIds || {};
// If you know it, set it (24-hex string). If not, the resolver will try to find it.


// Try to resolve a dataTypeId by name if not configured
async function resolveDataTypeId(typeName) {
  const tryPaths = [
    '/api/records/DataType',
    '/api/records/RecordType',
    '/api/records/Schema',
  ];
  for (const p of tryPaths) {
    try {
      const r = await fetch(`${p}?where=${encodeURIComponent(JSON.stringify({ Name: typeName }))}&limit=1`, {
        credentials: 'include',
        headers: { Accept: 'application/json' }
      });
      if (!r.ok) continue;
      const rows = await r.json();
      const id = rows?.[0]?._id || rows?.data?.[0]?._id;
      if (id) return String(id);
    } catch {}
  }
  return null;
}

// Find existing client by email (public read)
async function findClientId({ businessId, email }) {
  if (!email) return null;
  const attempts = [
    [['Business', businessId], ['Email', email]],
    [['businessId', businessId], ['Email', email]],
    [['Business', businessId], ['email', email]],
    [['businessId', businessId], ['email', email]],
    [['Client Email', email]], // last resort without business
  ];
  for (const pairs of attempts) {
    const qs = new URLSearchParams({ dataType: 'Client' });
    for (const [k, v] of pairs) v != null && qs.append(k, String(v));
    const r = await fetch(`/public/records?${qs}`, {
      headers: { Accept: 'application/json' },
      credentials: 'same-origin',
      cache: 'no-store'
    });
    if (!r.ok) continue;
    const rows = await r.json();
    const id = Array.isArray(rows) && rows[0]?._id;
    if (id) return String(id);
  }
  return null;
}

// Create client via generic /api/records
async function createClient({ businessId, email, firstName, lastName, phone }) {
  const createdBy = await requireUserIdOrLogin();       // <— add
  const dataTypeId = window.CONFIG?.dataTypeIds?.Client; // you pasted this in the HTML
  if (!dataTypeId) throw new Error('Missing Client dataTypeId');

  const values = {
    Business: businessId ? { _id: businessId } : undefined,
    "First Name": firstName || undefined,
    "Last Name":  lastName  || undefined,
    Email:        email     || undefined,
    Phone:        phone     || undefined,
    firstName, lastName, email, phone // tolerate either casing
  };

  const res = await fetch('/api/records', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({ dataTypeId, createdBy, values })
  });

  if (!res.ok) {
    const t = await res.text().catch(()=> '');
    throw new Error(`Client create failed: ${res.status} ${t}`);
  }
  const doc = await res.json().catch(()=> ({}));
  return doc?._id || doc?.id || null;
}


// ------- CONFIG / STATE -------
const API = {
  list: (dataType, filters = {}) => {
    const params = new URLSearchParams({ dataType });
    for (const [k, v] of Object.entries(filters)) {
      params.append(k, v);
    }
    return fetch(`/public/records?${params.toString()}`, {
      headers: { Accept: "application/json" },
    }).then((r) => r.json());
  },

  // Try per-type route first; if it's missing (404/405), fall back to generic
create: async (dataType, values) => {
  const headers = { 'Content-Type': 'application/json', Accept: 'application/json' };

  // 1) Try per-type endpoint first (if you later add one)
  try {
    const r1 = await fetch(`/api/records/${encodeURIComponent(dataType)}`, {
      method: 'POST',
      credentials: 'include',
      headers,
      body: JSON.stringify({ values })
    });
    if (r1.ok) return r1.json();
    if (r1.status !== 404 && r1.status !== 405) {
      const body = await r1.text();
      console.error(`[API.create] ${dataType} → ${r1.status}`, body);
      throw new Error(body || `HTTP ${r1.status}`);
    }
  } catch (_) {
    // ignore and fall through to generic
  }

  // 2) Generic endpoint: /api/records  (requires dataTypeId and createdBy)
  // Resolve dataTypeId:
  let dataTypeId = window.CONFIG?.dataTypeIds?.[dataType] || null;
  if (!dataTypeId && typeof resolveDataTypeId === 'function') {
    dataTypeId = await resolveDataTypeId(dataType);
  }
  if (!dataTypeId) {
    throw new Error(`No dataTypeId for ${dataType} (cannot create)`);
  }

  // Ensure user is logged in so we have createdBy:
  const createdBy = window.BookingApp?.STATE?.user?.userId || null;
  if (!createdBy) {
    if (typeof window.openAuth === 'function') window.openAuth();
    throw new Error('LOGIN_REQUIRED'); // caller should catch and stop flow
  }

  const r2 = await fetch('/api/records', {
    method: 'POST',
    credentials: 'include',
    headers,
    body: JSON.stringify({ dataTypeId, createdBy, values })
  });

  if (!r2.ok) {
    const body = await r2.text();
    console.error(`[API.create] ${dataType} → ${r2.status}`, body);
    throw new Error(body || `HTTP ${r2.status}`);
  }
  return r2.json();
},

login: async (email, password) => {
  const res = await fetch('/api/login', {
    method: 'POST',
    credentials: 'include',                 // <-- REQUIRED so the Set-Cookie sticks
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`Login failed: ${res.status} ${res.statusText} — ${txt}`);
  }
  return res.json().catch(() => ({}));
}
};

// ---- booking-page.js (around line 622) ----
const API_BASE = (window.__BASE_PATH__ || ''); // if you use basePath like '/wesafeswa', set window.__BASE_PATH__ = '/wesafeswa'

// Always use generic endpoint with dataTypeId (avoid /api/records/Appointment)
async function getUserId(){
  try {
    const r = await fetch('/api/users/me?ts='+Date.now(), { credentials:'include' });
    if (!r.ok) return null;
    const j = await r.json().catch(()=> ({}));
    return j?.user?._id || null;
  } catch { return null; }
}


function openAuth() {
  // shows your Sign In modal
  document.getElementById('authModal')?.classList.add('is-open');
  // mark intent to resume
  window.BookingApp ??= {}; window.BookingApp.STATE ??= {};
  window.BookingApp.STATE.user = { ...(window.BookingApp.STATE.user||{}), continueAfterLogin: true };
}
// booking-page.js
async function createAppointment(values){
  const API = (window.CONFIG?.API_BASE) || 'http://localhost:8400';
  console.log('[createAppointment] sending', { dataTypeId: window.CONFIG?.dataTypeIds?.Appointment, createdBy: STATE?.user?.userId, values });
  const res = await fetch(`${API}/api/records`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({
      dataTypeId: window.CONFIG.dataTypeIds.Appointment,
      createdBy: STATE.user.userId,      // belt & suspenders
      values
    })
  });
  if (!res.ok) throw new Error(`POST /api/records ${res.status} ${res.statusText} — ${await res.text()}`);
  return res.json();
}



// Use /public/records with plain query keys (no filters[...])
async function publicList(dataType, filters = {}) {
  const params = new URLSearchParams({ dataType });
  for (const [k, v] of Object.entries(filters)) {
    if (v !== undefined && v !== null && v !== "") params.append(k, v);
  }
  const r = await fetch(`/public/records?${params.toString()}`, {
    headers: { Accept: "application/json" },
    credentials: "same-origin",
    cache: "no-store",
  });
  if (!r.ok) {
    console.warn(`[publicList] ${dataType} HTTP ${r.status}`);
    return [];
  }
  const rows = await r.json();
  return Array.isArray(rows) ? rows : [];
}



// tolerant value getter: tries a bunch of possible label spellings (incl. trailing space)
function pick(v, keys) {
  for (const k of keys) {
    if (v[k] !== undefined) return v[k];
    // also try trimmed version (handles accidental trailing spaces in labels)
    const t = Object.keys(v).find(kk => kk.trim() === k);
    if (t && v[t] !== undefined) return v[t];
  }
  return undefined;
}

// find YYYY-MM-DD in values regardless of label; normalize to YYYY-MM-DD
// Normalize any "date-ish" value to "YYYY-MM-DD"
function toISODateOnly(x) {
  if (!x) return "";
  if (x instanceof Date) {
    const y = x.getFullYear();
    const m = String(x.getMonth() + 1).padStart(2, "0");
    const d = String(x.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  const s = String(x).trim();

  // Already YYYY-MM-DD (optionally followed by time)
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (m) return m[1];

  // ISO with T
  if (s.includes("T")) return s.split("T")[0];

  // Last resort: try Date parsing (handles things like "8/20/2025")
  const dt = new Date(s);
  return isNaN(dt) ? "" : toISODateOnly(dt);
}

// Pull a YYYY-MM-DD date out of various shapes stored in the DB
function pickISODate(v) {
  // Try common labels first
  const cand =
    v?.Date ??
    v?.date ??
    v?.dateISO ??
    v?.["Date "] ?? // (sometimes people add a space)
    v?.startISO;     // e.g., "2025-08-20T09:00:00Z"

  return toISODateOnly(cand);
}


// Try public query in a few ways, then fallback to _compat, then fetch-all and filter client-side
// Simple public query — your /public/records already normalizes labels
// REPLACE with this robust version
async function getUpcomingHoursRows(businessId, calendarId) {
  // Try exact filter first (fast path)
  let rows = await publicList("Upcoming Hours", {
    Business: businessId,
    Calendar: calendarId,
    "is Available": true
  });
  if (Array.isArray(rows) && rows.length) return rows;

  // Fallback: fetch all and filter client-side (handles refs stored as objects)
  rows = await publicList("Upcoming Hours");
  return (rows || []).filter(r => {
    const v = r.values || r;
    const bizRef = refId(v.Business ?? v.business ?? v.businessId ?? v["Business Id"]);
    const calRef = refId(v.Calendar ?? v.calendar ?? v.calendarId ?? v["Calendar Id"]);
    const avail  = v["is Available"] ?? v.available ?? v.Available;
    return String(bizRef) === String(businessId) &&
           String(calRef) === String(calendarId) &&
           (avail === true || String(avail) === "true" || avail === 1);
  });
}



// ------- UTIL -------

function fmtMoney(n) {
  const num = Number(n);
  if (Number.isNaN(num)) return "";
  return `$${num.toFixed(2)}`;
}
function minutesBetween(hhmmStart, hhmmEnd) {
  const [h1, m1] = hhmmStart.split(":").map(Number);
  const [h2, m2] = hhmmEnd.split(":").map(Number);
  return h2 * 60 + m2 - (h1 * 60 + m1);
}
function addMinutesHHMM(hhmm, mins) {
  const [h, m] = hhmm.split(":").map(Number);
  const total = h * 60 + m + mins;
  const hh = Math.floor(total / 60) % 24;
  const mm = total % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}
function timeLT(a, b) {
  const [ah, am] = a.split(":").map(Number);
  const [bh, bm] = b.split(":").map(Number);
  return ah < bh || (ah === bh && am < bm);
}
function timeLTE(a, b) {
  const [ah, am] = a.split(":").map(Number);
  const [bh, bm] = b.split(":").map(Number);
  return ah < bh || (ah === bh && am <= bm);
}
function overlap(startA, endA, startB, endB) {
  return timeLT(startA, endB) && timeLT(startB, endA);
}
function slugFromPath() {
  const p = location.pathname.replace(/^\/+/, "").split("/")[0];
  return decodeURIComponent(p || "");
}
function show(el) {
  if (typeof el === "string") el = $(el);
  el.style.display = "block";
}
function hide(el) {
  if (typeof el === "string") el = $(el);
  el.style.display = "none";
}
function formatDatePretty(yyyy_mm_dd) {
  const [y, m, d] = yyyy_mm_dd.split("-").map(Number);
  const dt = new Date(y, m - 1, d);  // ⬅️ local, not UTC
  return dt.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function scrollToTimeslots() {
  const el = document.getElementById('timeslots');
  if (!el) return;

  // If it's already on-screen, do nothing
  const r = el.getBoundingClientRect();
  const vh = window.innerHeight || document.documentElement.clientHeight;
  const visible = r.top >= 0 && r.top < vh * 0.6;
  if (visible) return;

  // Let layout update, then smooth scroll
  requestAnimationFrame(() => {
    el.scrollIntoView({ behavior: 'smooth', block: 'start', inline: 'nearest' });
  });
}




// ------- RENDERERS -------

// ---- CALENDAR HELPERS ----
async function loadCalendarsForBusiness(businessId) {
  // Try values.Business first, then values.businessId
  let calendars = await fetchCalendars("Business", businessId);
  if (!calendars.length) {
    calendars = await fetchCalendars("businessId", businessId);
  }
  console.log("📅 calendars loaded:", calendars.length);

  // ✅ Build the cache BEFORE render/return (use `calendars`, not `rows`)
  STATE.calendars = (calendars || []).map(r => ({
    _id: String(r._id || r.id),
    values: r.values || r
  }));
  STATE.calById = Object.fromEntries(
    STATE.calendars.map(c => [String(c._id), c])
  );

  // If your renderer expects the same shape, pass STATE.calendars
  renderCalendars(STATE.calendars);
  return STATE.calendars;
}

// -------- FETCH CALENDARS (robust + debug) --------
async function fetchCalendars(key, val) {
  const pairs = [
    ['Business',    val],
    ['businessId',  val],
    ['ownerId',     STATE?.ownerUserId || null],  // just in case
  ].filter(([_, v]) => v);

  const headers = { Accept: 'application/json' };
  for (const [k, v] of pairs) {
    const url = api(`/public/records?dataType=Calendar&${encodeURIComponent(k)}=${encodeURIComponent(v)}&ts=${Date.now()}`);
    console.log('➡️ calendar fetch:', url);
    try {
      const r = await fetch(url, { headers, credentials: 'same-origin', cache: 'no-store' });
      if (!r.ok) continue;
      const rows = await r.json();

      // Keep raw + flattened for debugging
      window.__calsRaw = rows;

      if (Array.isArray(rows) && rows.length) {
        const out = rows.map(doc => ({
          _id: doc._id,
          values: doc.values || {},
          ...(doc.values || {}) // flatten for convenience
        }));

        // expose flattened array to devtools
        window.__cals = out;

        console.log('[cal debug] count:', out.length);
        const first = out[0] || {};
        console.log('[cal debug] first keys:', Object.keys(first));
        console.log('[cal debug] first.values keys:', Object.keys(first.values || {}));
        console.table(out.map(c => ({
          id: c._id,
          calendarName: c.calendarName,
          calName_spaced: c['Calendar Name'],
          name: c.name
        })));

        return out;
      }
    } catch (e) {
      console.debug('[cal fetch error]', e);
    }
  }
  // nothing found
  window.__cals = [];
  return [];
}


// -------- RENDER CALENDARS (uses pickKey) --------
// -------- RENDER CALENDARS (safe + id-based) --------
function renderCalendars(calendars = []) {
  // keep available in console for debugging
  window.__cals = calendars;

  const wrap = document.getElementById('calendars');
  if (!wrap) return;
  wrap.innerHTML = '';

  if (!Array.isArray(calendars) || calendars.length === 0) {
    wrap.innerHTML = `<div class="muted" style="grid-column:1/-1;">No calendars found.</div>`;
    return;
  }

  // keep an index handy (some code paths rely on it)
  window.CALENDAR_BY_ID = Object.create(null);
  calendars.forEach((c) => {
    const id = String(c._id || c.id || c.calendarId);
    window.CALENDAR_BY_ID[id] = c;
  });

  calendars.forEach((c) => {
    const id    = String(c._id || c.id || c.calendarId);
    const v     = c.values || c;
    // choose a nice label using your helpers (use whichever you have)
   const label =
  (typeof pickCalendarName === 'function' && pickCalendarName(c)) ||
  (typeof pickTitleLike   === 'function' && pickTitleLike(c)) ||
  'Calendar';


    const desc =
      v.description || v.Description || v.details || v.Details || v.note || v.Note || '';

    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'card card--select';
    el.style.textAlign = 'left';
    el.setAttribute('data-cal-id', id);
    el.innerHTML = `
      <div class="card__title">${String(label)}</div>
      <div class="card__sub muted">${desc ? String(desc) : ''}</div>
    `;

    // ✅ Pass the *id* (or pass `c`; your onSelectCalendar handles both)
    el.addEventListener('click', () => onSelectCalendar(id));

    wrap.appendChild(el);
  });
}

async function onSelectCalendar(calOrObj) {
  // Accept either an id or a calendar object
  const calId = typeof calOrObj === 'object'
    ? String(calOrObj._id || calOrObj.id || calOrObj.calendarId)
    : String(calOrObj);

  // ✅ mark calendar selection and cache pro id
  setSelectedCalendar(calId);

  // advance UI
  hide(getCalendarSectionEl());

  // Load data needed for the next steps
  const [categories, services] = await Promise.all([
    getCategoriesForCalendar(STATE.businessId, calId),
    // if you don't have services yet, leave this as an empty array
    (typeof getServicesForCalendar === 'function'
      ? getServicesForCalendar(STATE.businessId, calId)
      : Promise.resolve([]))
  ]);

  // ⛔️ DO NOT reassign these const references:
  //    CURRENT_CATEGORIES = categories;   // ❌ will crash
  //    CURRENT_SERVICES   = services;     // ❌ will crash
  // ✅ Instead, mutate contents in-place:
  replaceArrayContents(CURRENT_CATEGORIES, categories || []);
  replaceArrayContents(CURRENT_SERVICES,   services   || []);

  // Render categories (and services if you show them here)
  if (typeof renderCategories === 'function') {
    renderCategories(CURRENT_CATEGORIES);
  } else {
    simpleRenderCategories(CURRENT_CATEGORIES);
  }
  show(document.getElementById('section-cats'));

  // Clear downstream selections
  STATE.selected.categoryId = null;
  STATE.selected.serviceIds = [];
  STATE.selected.dateISO    = null;
  STATE.selected.timeHHMM   = null;

  console.log("[booking] calendar chosen", {
    calId,
    proUserId: STATE.selected.proUserId
  });
}

///Back Button 
// --- Section helpers (you already have show/hide) ---
function getCalendarSectionEl() {
  return document.getElementById('calendars')?.closest('.section') || null;
}

// Inject a back button at the start of a section title
function injectBackBtn(sectionSelector, backTarget, label = "Back") {
  const sec = document.querySelector(sectionSelector);
  if (!sec) return;
  const h = sec.querySelector('.section__title');
  if (!h || h.querySelector('.back-btn')) return; // already added
  h.insertAdjacentHTML(
    'afterbegin',
    `<button type="button" class="back-btn" data-back="${backTarget}">← ${label}</button>`
  );
}

// Add buttons to each step
injectBackBtn('#section-cats', 'calendars');      // From Categories -> Calendars
injectBackBtn('#section-services', 'categories'); // From Services -> Categories
injectBackBtn('#section-availability', 'services'); // Availability -> Services
injectBackBtn('#section-confirm', 'availability');  // Confirm -> Availability

// --- Back navigation handlers ---
function backToCalendars() {
  // reset downstream
  STATE.selected.calendarId = null;
  STATE.selected.categoryId = null;
  STATE.selected.serviceIds = [];
  show(getCalendarSectionEl());
  hide('#section-cats');
  hide('#section-services');
  hide('#section-availability');
  hide('#section-confirm');
}

function backToCategories() {
  STATE.selected.categoryId = null;
  STATE.selected.serviceIds = [];
  show('#section-cats');
  hide('#section-services');
  hide('#section-availability');
  hide('#section-confirm');
}

function backToServices() {
  STATE.selected.dateISO = null;
  STATE.selected.timeHHMM = null;
  show('#section-services');
  hide('#section-availability');
  hide('#section-confirm');
}

function backToAvailability() {
  show('#section-availability');
  hide('#section-confirm');
}

// One delegated click listener for all back buttons
document.addEventListener('click', (e) => {
  const btn = e.target.closest('.back-btn');
  if (!btn) return;

  switch (btn.dataset.back) {
    case 'calendars':     backToCalendars();   break;
    case 'categories':    backToCategories();  break;
    case 'services':      backToServices();    break;
    case 'availability':  backToAvailability();break;
  }
});


////////////////// ---- CATEGORIES: ////////////////////////////////////////////////
// fetch using many possible field names, with fallbacks ----
async function loadCategoriesForCalendar(businessId, calendarId) {
  // Most specific first
  let rows = await fetchCombo("Category", { Business: businessId, Calendar: calendarId });
  if (!rows.length) rows = await fetchCombo("Category", { Calendar: calendarId });
  if (!rows.length) rows = await fetchCombo("Category", { Business: businessId });
  if (!rows.length) rows = await fetchAll("Category");

  // Strict client-side filter to avoid bleed-through
  rows = rows.filter(doc => {
    const v = doc.values || {};
    const calRef = refId(v.calendarId ?? v.Calendar ?? v.calendar ?? v.calendarRef ?? v.CalendarId);
    const bizRef = refId(v.businessId ?? v.Business ?? v.business ?? v.businessRef ?? v.BusinessId ?? v["Business Id"]);
    return (!calendarId || String(calRef) === String(calendarId)) &&
           (!businessId || String(bizRef) === String(businessId));
  });

  // Flatten for renderer
  return rows.map(d => ({ _id: d._id, ...(d.values || {}) }));
}

//Show Categories if Pro only has 1 Calendar 


// ✅ Unified category fetcher (no name conflict)
// Use this everywhere to get categories for a given business + calendar.
async function getCategoriesForCalendar(businessId, calendarId) {
  // Prefer stable public endpoint first
  const params = new URLSearchParams({ dataType: 'Category' });
  if (businessId) params.append('businessId', businessId);
  if (calendarId) params.append('calendarId', calendarId);

  let rows = [];
  try {
    const r = await fetch(`/public/records?${params.toString()}`, {
      headers: { Accept: 'application/json' },
      credentials: 'same-origin'
    });
    rows = await r.json();
  } catch {}

  if (!Array.isArray(rows) || !rows.length) {
    // Optional: try your app loader if it exists (and won’t throw)
    if (typeof loadCategoriesForCalendar === 'function') {
      try { rows = await loadCategoriesForCalendar(businessId, calendarId); } catch {}
    } else if (typeof loadCategories === 'function') {
      try { rows = await loadCategories(calendarId); } catch {}
    }
  }

  return Array.isArray(rows) ? rows : [];
}

//////////////////////////////////////////////////////////////////////////////////////////////////////
// Minimal renderer (only used if you don’t already have one)
function simpleRenderCategories(categories) {
  const wrap = document.getElementById('categories');
  if (!wrap) return;
  wrap.innerHTML = '';

  // helpful debug
  window.__cats = categories;

  categories.forEach(cat => {
    // support both flattened ({...values}) and nested ({values:{...}})
    const v = cat.values || cat;

    const label = pickKey(v, [
      "categoryName","Category Name","name","Name","title","Title","label","Label"
    ]) || "Category";

    const desc  = pickKey(v, ["description","Description","details","Details","subTitle","Subtitle"]);

    const id = cat._id || cat.id || v._id;

    const div = document.createElement('div');
    div.className = 'card';
    div.dataset.id = id;
    div.innerHTML = `
      <div class="card__title">${escapeHtml(String(label))}</div>
      ${desc ? `<div class="card__desc">${escapeHtml(String(desc))}</div>` : ''}
    `;
    div.addEventListener('click', () => {
      window.STATE = window.STATE || {};
      window.STATE.selected = window.STATE.selected || {};
      window.STATE.selected.categoryId = id;

      // proceed to services (adjust to your app’s flow)
      if (typeof onCategorySelected === 'function') {
        onCategorySelected(id);
      }
      show('#section-services');   // guarded show()
    });
    wrap.appendChild(div);
  });

  show('#section-cats');           // guarded show()
}



///////////////////// ---- SERVICES: ///////////////////////////////////
// fetch using many possible field names, with fallbacks ----

// generic helper: try multiple key=value queries against /public/records
async function fetchByKeys(dataType, pairs) {
  for (const [key, val] of pairs) {
    const url = `/public/records?dataType=${encodeURIComponent(dataType)}&${encodeURIComponent(key)}=${encodeURIComponent(val)}`;
    console.log("➡️", dataType, "fetch:", url);
    try {
      const r = await fetch(url, { headers: { Accept: "application/json" }, credentials: "same-origin" });
      if (!r.ok) continue;
      const rows = await r.json();
      if (Array.isArray(rows) && rows.length) {
        return rows.map(doc => ({ _id: doc._id, ...(doc.values || {}) }));
      }
    } catch {}
  }
  return [];
}

function pickKey(obj, keys) {
  if (!obj) return undefined;
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null && obj[k] !== '') return obj[k];
    // also try keys with stray spaces
    const t = Object.keys(obj).find(kk => kk.trim() === k);
    if (t && obj[t] !== undefined && obj[t] !== null && obj[t] !== '') return obj[t];
  }
  return undefined;
}
function escapeHtml(s = "") {
  return String(s)
    .replace(/&/g,"&amp;").replace(/</g,"&lt;")
    .replace(/>/g,"&gt;").replace(/"/g,"&quot;")
    .replace(/'/g,"&#039;");
}


async function onSelectCategory(categoryIdOrObj) {
  // 1) Resolve the selected category id
  const catId = typeof categoryIdOrObj === 'object'
    ? String(categoryIdOrObj._id || categoryIdOrObj.id)
    : String(categoryIdOrObj);

  STATE.selected.categoryId = catId;

  // 2) Show the Services section (with a quick loading placeholder)
  const sec = document.getElementById('section-services');
  const host = document.getElementById('services');
  if (sec)  sec.style.display  = '';
  if (host) host.innerHTML     = '<div class="muted">Loading services…</div>';

  // 3) Fetch services (supports either helper name)
  let services = [];
  try {
    if (typeof getServicesForCategory === 'function') {
      services = await getServicesForCategory(
        STATE.businessId,
        STATE.selected.calendarId,
        catId
      );
    } else if (typeof loadServicesForCategory === 'function') {
      // alias support if your function is named loadServicesForCategory
      services = await loadServicesForCategory(
        STATE.businessId,
        STATE.selected.calendarId,
        catId
      );
    } else {
      console.error('[onSelectCategory] No service loader found (getServicesForCategory / loadServicesForCategory).');
      services = [];
    }
  } catch (e) {
    console.error('[onSelectCategory] service fetch failed:', e);
    services = [];
  }

  // 4) Mutate the singleton array (do NOT reassign)
  replaceArrayContents(CURRENT_SERVICES, Array.isArray(services) ? services : []);

  // 5) Clear downstream selections
  STATE.selected.serviceIds = [];
  STATE.selected.dateISO    = null;
  STATE.selected.timeHHMM   = null;

  // 6) Render list (use your renderer if present, else a simple fallback)
  const doRender =
    (typeof renderServices === 'function' && renderServices) ||
    (typeof simpleRenderServices === 'function' && simpleRenderServices) ||
    function fallbackRender(list = []) {
      const el = document.getElementById('services');
      if (!el) return;
      el.innerHTML = '';
      if (!list.length) {
        el.innerHTML = '<div class="muted">No services for this category.</div>';
        return;
      }
      list.forEach(svc => {
        const id    = String(svc._id || svc.id || '');
        const name  = svc.name || (svc.values && (svc.values.Name || svc.values['Service Name'])) || 'Service';
        const mins  = svc.duration != null ? `${svc.duration} min` : '';
        const price = svc.price    != null ? `$${Number(svc.price).toFixed(2)}` : '';
        const meta  = [mins, price].filter(Boolean).join(' · ');

        const btn  = document.createElement('button');
        btn.type   = 'button';
        btn.className = 'card card--select';
        btn.dataset.serviceId = id;
        btn.innerHTML = `
          <div class="card__title">${name}</div>
          <div class="card__sub muted">${meta}</div>
        `;
        btn.addEventListener('click', () => onSelectService(id));
        el.appendChild(btn);
      });
    };

  doRender(CURRENT_SERVICES);

  // 7) Advance UI
  show('#section-services');
  hide('#section-availability');
  hide('#section-confirm');

  // 8) Scroll into view
  document.getElementById('section-services')?.scrollIntoView({ behavior: 'smooth' });

  // 9) Helpful debug
  console.log('[category → services]', {
    businessId: STATE.businessId,
    calendarId: STATE.selected.calendarId,
    categoryId: catId,
    count: CURRENT_SERVICES.length,
    sample: CURRENT_SERVICES.slice(0, 3)
  });
}

// Build one URL with a specific set of key/value pairs and fetch it
async function fetchOnce(dataType, pairs) {
  const params = new URLSearchParams({ dataType });
  for (const [key, val] of pairs) {
    if (val == null || val === '') continue;
    // allow {_id}/object or raw strings
    const v = typeof val === 'object' ? (val._id || val.id || val.value || '') : val;
    if (v !== '') params.append(key, String(v));
  }
  const url = `/public/records?${params.toString()}`;
  console.log('➡️ fetch', dataType, url);
  try {
    const r = await fetch(url, { headers: { Accept: 'application/json' }, credentials: 'same-origin' });
    if (!r.ok) return [];
    const rows = await r.json();
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

// Try multiple *separate* attempts; return the first non-empty result
async function tryPublicList(dataType, attempts /* array of [ [key,val], ... ] */) {
  for (const pairs of attempts) {
    const rows = await fetchOnce(dataType, pairs);
    if (rows.length) return rows;
  }
  return [];
}

function renderCategories(categories) {
  const box = document.getElementById("categories");
  if (!box) return;
  box.innerHTML = "";

  if (!Array.isArray(categories) || !categories.length) {
    box.innerHTML = `<div class="muted" style="grid-column:1/-1;">No categories found.</div>`;
    return;
  }

  // handy to inspect the actual shape in DevTools
  window.__cats = categories;

  categories.forEach(cat => {
    // support both shapes: { _id, values:{...} } OR already flattened
    const v  = cat.values || cat;
    const id = cat._id || cat.id || v._id;

    // robust label picking (covers "Category Name", "name", etc., incl. stray spaces)
    const name = pickKey(v, [
      "categoryName","Category Name","name","Name","title","Title","label","Label","Category"
    ]) || "Category";

    const desc = pickKey(v, [
      "description","Description","details","Details","subTitle","Subtitle"
    ]);

    const el = document.createElement("button");
    el.className = "card card--select";
    el.style.textAlign = "left";
    el.innerHTML = `
      <div class="card__title">${escapeHtml(String(name))}</div>
      ${desc ? `<div class="card__sub muted">${escapeHtml(String(desc))}</div>` : ""}
    `;
     // ⬇️ HERE
    el.addEventListener("click", () => {
      hide("#section-cats");           // hide categories section
      onSelectCategory(id);            // proceed
    });

    box.appendChild(el);
  });
  show("#section-cats");  // guarded show()
}
// Load Services for a given Business + Calendar + Category (with many key aliases)
async function getServicesForCategory(businessId, calendarId, categoryId) {
  const B = String(businessId || '');
  const C = String(calendarId || '');
  const K = String(categoryId || '');

  // Build attempts from most-specific → least-specific
  const attempts = [
    // refs by id (preferred)
    [
      ['Business',   B], ['businessId', B], ['Business Id', B],
      ['Calendar',   C], ['calendarId', C], ['Calendar Id', C],
      ['Category',   K], ['categoryId', K], ['Category Id', K],
      ['Service Category', K], ['Category Ref', K]
    ],

    // Business + Category only
    [
      ['Business',   B], ['businessId', B], ['Business Id', B],
      ['Category',   K], ['categoryId', K], ['Category Id', K],
      ['Service Category', K], ['Category Ref', K]
    ],

    // Calendar + Category only
    [
      ['Calendar',   C], ['calendarId', C], ['Calendar Id', C],
      ['Category',   K], ['categoryId', K], ['Category Id', K],
      ['Service Category', K], ['Category Ref', K]
    ],

    // Category only
    [
      ['Category',   K], ['categoryId', K], ['Category Id', K],
      ['Service Category', K], ['Category Ref', K]
    ],
  ];

  // Run attempts; the helper returns the first non-empty result
  const rows = await tryPublicList('Service', attempts);

  // Normalize: keep _id and values; provide a couple of convenience fields
  return rows.map(doc => {
    const v = doc.values || {};
    return {
      _id: doc._id,
      id: doc._id,
      values: v,
      name: v['Name'] || v.name || 'Service',
      duration: v['Duration'] || v.duration || null,
      price: v['Price'] || v.price || null,
    };
  });
}






// Load services for a calendar/category using many possible field names.
function refIdsOf(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val.flatMap(refIdsOf);
  if (typeof val === 'object') {
    const id = val._id || val.id || val.value || null;
    return id ? [String(id)] : [];
  }
  return [String(val)];
}

async function loadServicesForCategory(businessId, calendarId, categoryId) {
  const B = businessId ? String(businessId) : '';
  const C = calendarId ? String(calendarId) : '';
  const K = categoryId ? String(categoryId) : '';

  // IMPORTANT: each inner array is one request; keys are not combined across attempts
  const attempts = [
    // Most specific (Business + Calendar + Category), using one alias per key
    [['Business', B], ['Calendar', C], ['Category', K]],
    [['businessId', B], ['calendarId', C], ['categoryId', K]],
    [['Business Id', B], ['Calendar Id', C], ['Category Id', K]],
    [['Business', B], ['Calendar', C], ['Service Category', K]],

    // Business + Category
    [['Business', B], ['Category', K]],
    [['businessId', B], ['categoryId', K]],
    [['Business Id', B], ['Category Id', K]],
    [['Business', B], ['Service Category', K]],

    // Calendar + Category
    [['Calendar', C], ['Category', K]],
    [['calendarId', C], ['categoryId', K]],
    [['Calendar Id', C], ['Category Id', K]],
    [['Calendar', C], ['Service Category', K]],

    // Category only
    [['Category', K]],
    [['categoryId', K]],
    [['Category Id', K]],
    [['Service Category', K]],
  ];

  // fetch first non-empty batch
  let rows = await tryPublicList('Service', attempts);
  const before = rows.length;

  // If still empty, last-resort: fetch everything and filter locally
  if (!rows.length) {
    rows = await fetchOnce('Service', []); // no filters
  }

  // Local, tolerant filter (only enforce Category; add Business/Calendar once confirmed)
  rows = rows.filter(doc => {
    const v = doc?.values || {};
    const deleted = !!(v.isDeleted ?? v['is Deleted']);

    const catIds = [
      ...refIdsOf(v.categoryId),
      ...refIdsOf(v.Category),
      ...refIdsOf(v.category),
      ...refIdsOf(v['Service Category']),
      ...refIdsOf(v['Category Ref']),
      ...refIdsOf(v.CategoryId),
    ].map(String);

    const matchCategory = K ? catIds.includes(K) : true;
    return !deleted && matchCategory;
  });

  const after = rows.length;
  console.log('[svc] rows before filter:', before, 'after filter:', after);

  const normalized = rows.map(doc => {
  const v = doc.values || {};

  const name = firstText(
    v['Service Name'], v.serviceName,
    v['Name'], v.name,
    v['Title'], v.title,
    v['Label'], v.label,
    v['Service'] // sometimes people literally store "Service"
  ) || 'Service';

  const durRaw = v.duration ?? v.durationMinutes ?? v['Duration'] ?? v['Minutes'] ?? v.length ?? v['Service Duration'];
  const duration = durRaw != null ? Number(String(durRaw).replace(/[^\d.]/g, '')) : null;

  const priceRaw = v.price ?? v.Price ?? v['Service Price'] ?? v.amount ?? v.cost ?? v.rate;
  const price = priceRaw != null ? Number(String(priceRaw).replace(/[^\d.]/g, '')) : null;

  const imageUrl = imageUrlFrom(v);

  return { _id: doc._id, id: doc._id, values: v, name, duration, price, imageUrl };
});


  console.log('[svc] normalized sample:', normalized.slice(0, 3));
  return normalized;
}

// If other code calls getServicesForCategory, provide an alias:
async function getServicesForCategory(...args) {
  return loadServicesForCategory(...args);
}

function onSelectService(serviceId) {
  const id = String(serviceId);

  if (!STATE.mode.multiService) STATE.selected.serviceIds = [];
  if (!STATE.selected.serviceIds.includes(id)) {
    STATE.selected.serviceIds.push(id);
  }
if (!window.BookingApp.STATE.user?.userId && typeof window.openAuth === 'function') {
  window.openAuth();
}

  const svc = CURRENT_SERVICES.find(s => String(s._id || s.id) === id) || {};
  const v   = svc.values || svc || {};
  const durRaw =
    svc.duration ?? v.duration ?? v.durationMinutes ??
    v['Duration'] ?? v['Minutes'] ?? v.length ?? v['Service Duration'];
  const dur = Number(String(durRaw || '').replace(/[^\d.]/g, '')) || 60;

  STATE.selected.durationMin = dur;

  show('#section-availability');
  openAvailability();
}


async function fetchCombo(dataType, kv) {
  const qs = new URLSearchParams({ dataType });
  for (const [k, v] of Object.entries(kv)) {
    if (v != null && v !== "") qs.append(k, v);
  }
  const r = await fetch(`/public/records?${qs.toString()}`, {
    headers: { Accept: "application/json" },
    credentials: "same-origin",
  });
  if (!r.ok) return [];
  const rows = await r.json();
  return Array.isArray(rows) ? rows : [];
}

async function fetchAll(dataType) {
  const r = await fetch(`/public/records?dataType=${encodeURIComponent(dataType)}`, {
    headers: { Accept: "application/json" },
    credentials: "same-origin",
  });
  if (!r.ok) return [];
  const rows = await r.json();
  return Array.isArray(rows) ? rows : [];
}


function renderServices(services) {
  const wrap = $("#services");
  wrap.innerHTML = "";
  const multi = $("#toggle-multi")?.checked;

  services.forEach((svc) => {
    const v = svc.values || svc;                 // support both shapes
    const id   = svc._id;
    const name = svc.serviceName || v["Service Name"] || v.name || v.Name || "Service";

    // duration + price through helpers (below)
    const dur   = svcDuration(svc);
    const price = svcPrice(svc);

    const img   = toUrl(
      svc.imageUrl || v["Image URL"] || v.image || v.Image || v.heroImage || ""
    );

    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <div class="service">
        ${img ? `<img class="service__img" src="${img}" alt="">` : ""}
        <div class="service__meta">
          <div class="service__name">${escapeHtml(name)}</div>
          <div class="service__sub">${dur} min${
            Number.isFinite(price) && price > 0 ? ` • ${fmtMoney(price)}` : ""
          }</div>
        </div>
        ${
          multi
            ? `<input type="checkbox" class="svc-check" data-id="${id}" style="margin-left:auto;margin-top:6px;">`
            : `<button class="btn btn--pill svc-pick" data-id="${id}" style="margin-left:auto;">Select</button>`
        }
      </div>
    `;
    wrap.appendChild(card);
  });
//Add Pro Name 
// ---- Pro name helpers (drop-in) ----
function getProNameForUI() {
  const cal = (window.selectedCalendar || {});
  const biz = (window.businessData || {});

  const fromCal =
    cal.proName || cal["Pro Name"] ||
    cal.staffName || cal["Staff Name"] ||
    cal.calendarName || cal["Calendar Name"] ||
    cal.name || cal.Name;

  const fromBiz =
    biz.proName || biz["Pro Name"] ||
    biz.ownerName || biz["Owner Name"] ||
    biz.businessName || biz["Business Name"] ||
    biz.name || biz.Name;

  return String(fromCal || fromBiz || "Your Pro");
}

// Put "Pro:" on top of the confirm summary card
function injectProIntoConfirm() {
  const box = document.getElementById("confirm-summary");
  if (!box) return;

  const pro = getProNameForUI();
  let line = box.querySelector('[data-proline]');
  if (!line) {
    line = document.createElement('div');
    line.setAttribute('data-proline','');
    box.insertBefore(line, box.firstChild);     // at the very top
  }
  line.innerHTML = `<strong>Pro:</strong> ${escapeHtml(pro)}`;
}

// Add "With {Pro}" under the success title + "Pro:" as the first detail row
function injectProIntoSuccess() {
  const pro = getProNameForUI();

  // Under the title
  const panel = document.querySelector('#successModal .modal__panel');
  if (panel) {
    let proline = panel.querySelector('#success-proline');
    if (!proline) {
      proline = document.createElement('div');
      proline.id = 'success-proline';
      proline.className = 'modal__proline';
      const title = panel.querySelector('.modal__title');
      title?.insertAdjacentElement('afterend', proline);
    }
    proline.textContent = `With ${pro}`;
  }

  // As first row inside the details list
  const details = document.getElementById('success-details');
  if (details) {
    let first = details.querySelector('[data-proline]');
    if (!first) {
      first = document.createElement('div');
      first.setAttribute('data-proline','');
      details.insertBefore(first, details.firstChild);
    }
    first.innerHTML = `<strong>Pro:</strong> ${escapeHtml(pro)}`;
  }
}

  // single-select (show availability immediately)
  wrap.onclick = (e) => {
    const btn = e.target.closest(".svc-pick");
    if (!btn) return;
    const id = btn.dataset.id;
    const svc = services.find(s => String(s._id) === String(id));
    if (!svc) return;

    STATE.selected.serviceIds = [id];
    window.selectedService = svc;

    const v = svc.values || svc;
    const calRef = svc.calendarId ?? v.Calendar ?? v.calendar ?? v.calendarRef ?? v.CalendarId;
    const bizRef = svc.businessId ?? v.Business ?? v.business ?? v.businessRef ?? v.BusinessId ?? v["Business Id"];
    if (!STATE.selected.calendarId && calRef) STATE.selected.calendarId = calRef;
    if (!STATE.businessId && bizRef) STATE.businessId = bizRef;

    recomputeDuration();
    if (!STATE.selected.durationMin || STATE.selected.durationMin <= 0) {
      STATE.selected.durationMin = svcDuration(svc) || 30; // sensible default
    }

    updateSummary();
    openAvailability(true);
  };

  // multi-select
  wrap.onchange = (e) => {
    const cb = e.target.closest(".svc-check");
    if (!cb) return;
    const id = cb.dataset.id;
    if (cb.checked) {
      if (!STATE.selected.serviceIds.includes(id)) STATE.selected.serviceIds.push(id);
    } else {
      STATE.selected.serviceIds = STATE.selected.serviceIds.filter((x) => x !== id);
    }
    recomputeDuration();
    updateSummary();
  };
}

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////// 
function recomputeDuration() {
  const idSet = new Set(STATE.selected.serviceIds);
  let total = 0;
  for (const svc of CURRENT_SERVICES) {
    if (idSet.has(String(svc._id))) total += svcDuration(svc);
  }
  STATE.selected.durationMin = total;
}


function numeric(val) {
  if (val == null) return NaN;
  const n = Number(String(val).replace(/[^\d.]/g, ''));
  return Number.isFinite(n) ? n : NaN;
}
function firstFinite(...vals) {
  for (const v of vals) {
    const n = numeric(v);
    if (Number.isFinite(n)) return n;
  }
  return NaN;
}
function svcDuration(svc) {
  const v = svc.values || svc;
  const n = firstFinite(
    svc.duration,
    v.duration, v.durationMinutes,
    v['Duration'], v['Minutes'], v.length, v['Service Duration']
  );
  return Number.isFinite(n) ? Math.round(n) : 0;
}
function svcPrice(svc) {
  const v = svc.values || svc;
  const n = firstFinite(
    svc.price,
    v.price, v.Price, v['Service Price'], v.cost, v.amount, v.rate, v.fee
  );
  return Number.isFinite(n) ? n : 0;
}


function updateSummary() {
  const has = STATE.selected.serviceIds.length > 0 && STATE.selected.durationMin > 0;
  const chip = $("#summary");
  if (!has) {
    chip.style.display = "none";
    return;
  }
  chip.textContent = `${STATE.selected.serviceIds.length} service(s) • ${STATE.selected.durationMin} min`;
  chip.style.display = "inline-flex";
}



// ===== MONTH CALENDAR (single source of truth) =====


function initCalState() {
  const CAL = getCAL();
  if (CAL.inited) return;

  CAL.els = CAL.els || {};
  CAL.els.datePicker = CAL.els.datePicker || document.getElementById('datePicker');
  CAL.els.timeslots  = CAL.els.timeslots  || document.getElementById('timeslots');

  const today = new Date();
  CAL.todayISO    = toYMDLocal(today);
  CAL.selectedISO = CAL.selectedISO || CAL.todayISO;

  CAL.inited = true;
}


// ---------- helpers used by the calendar ----------
function toISODate(year, monthZeroBased, day) {
  const y = Number(year);
  const m = Number(monthZeroBased) + 1; // 0-based -> 1-based
  const d = Number(day);
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}
function monthLabel(year, monthZeroBased) {
  return new Date(year, monthZeroBased, 1)
    .toLocaleString(undefined, { month: 'long', year: 'numeric' });
}

async function buildAndRenderMonth() {
  const CAL = getCAL();

  // Pick a base date: selected date or today
 const baseISO = STATE.selected?.dateISO || toYMDLocal(new Date());
  const base = parseYMDLocal(baseISO);

  // Initialize CAL.year/month once, or keep what user navigated to
  if (typeof CAL.year !== 'number' || typeof CAL.month !== 'number') {
    CAL.year  = base.getFullYear();
    CAL.month = base.getMonth(); // 0-based
  }

  // Ask server for available days in this month for the current business+calendar
  const availSet = await getAvailableDatesForMonth(CAL.year, CAL.month);

  // Draw the calendar grid
  renderMonthCalendar(CAL.year, CAL.month, availSet);
}
async function openAvailability(hideServicesAndScroll = false) {
  const CAL = getCAL(); // ← always get the singleton

  if (STATE.selected.durationMin <= 0) return;

  if (hideServicesAndScroll) {
    hide("#section-services");
    show("#section-availability");
    document.getElementById("section-availability")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  } else {
    show("#section-availability");
  }
  hide("#section-confirm");
  $("#timeslots").innerHTML = "";

  initCalState();              // sets CAL.todayISO / CAL.selectedISO
  await buildAndRenderMonth(); // computes and renders the month
}
async function getAvailableDatesForMonth(year, month) {
  const set = new Set();

  const bId = STATE.businessId;
  const cId = STATE.selected.calendarId;
  const dur = STATE.selected.durationMin;
  if (!bId || !cId || !dur) return set;

// Robust fetch that works even if fields are refs or labels differ
const rows = await getUpcomingHoursRows(bId, cId);
console.log("[booking] UH rows:", rows.length, { bId, cId, year, month });
if (rows.length) console.log("[booking] UH sample:", rows[0]);


const monthDates = new Set();
for (const r of rows) {
  const v = r.values || r;
  const iso = pickISODate(v);          // "YYYY-MM-DD"
  if (!iso) continue;
  const d = parseYMDLocal(iso);        // ⬅️ local parse, no UTC shift
  if (d.getFullYear() === year && d.getMonth() === month) {
    monthDates.add(iso);               // keep the original string
  }
}


  // Validate each candidate date by actually computing slots
  for (const iso of monthDates) {
    try {
      const slots = await computeTimeslotsForDate(iso);
      if (Array.isArray(slots) && slots.length) set.add(iso);
    } catch (e) {
      console.warn("slot calc failed for", iso, e);
    }
  }
  return set;
}

// ---------- month calendar (wire prev/next using CAL) ----------
function renderMonthCalendar(year, month, availableSet) {
  const CAL = getCAL();
  const wrap = document.getElementById('datePicker');
  if (!wrap) return; 

  wrap.innerHTML = "";

  const root = document.createElement("div");
  root.className = "cal";
  // keep centered even if other CSS changes
  root.style.width = "max-content";
  root.style.margin = "0 auto";
  wrap.appendChild(root);

  root.innerHTML = `
    <div class="cal-head">
      <div class="cal-nav"><button id="cal-prev" class="cal-btn" aria-label="Prev month">‹</button></div>
      <div class="cal-title">${monthLabel(year, month)}</div>
      <div class="cal-nav"><button id="cal-next" class="cal-btn" aria-label="Next month">›</button></div>
    </div>
    <div class="cal-grid"></div>
  `;

  const grid = root.querySelector(".cal-grid");

  // DOW header
  ["S","M","T","W","T","F","S"].forEach(d => {
    const el = document.createElement("div");
    el.className = "cal-dow";
    el.textContent = d;
    grid.appendChild(el);
  });

  const first = new Date(year, month, 1);
  const last  = new Date(year, month + 1, 0);
  const leading = first.getDay();
  const daysInMonth = last.getDate();
  const today = new Date();
  const todayMid = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  // leading blanks
  for (let i = 0; i < leading; i++) grid.appendChild(document.createElement("div"));

  // days
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d);
    const iso  = toISODate(year, month, d);
    const isPast  = date < todayMid;
    const isToday = date.getFullYear() === today.getFullYear()
                 && date.getMonth() === today.getMonth()
                 && date.getDate() === today.getDate();
    const isAvail = availableSet.has(iso) && !isPast;

    const cell = document.createElement("button");
    cell.type = "button";
    cell.className = "cal-cell";
    if (isAvail) cell.classList.add("cal-cell--available");
    if (isToday) cell.classList.add("cal-cell--today");
    if (isPast)  cell.classList.add("cal-cell--disabled");

    const num = document.createElement("div");
    num.className = "num";
    num.textContent = d;
    cell.appendChild(num);

    if (availableSet.has(iso)) {
      const dot = document.createElement("span");
      dot.className = "cal-dot";
      cell.appendChild(dot);
    }

    if (isAvail) {
      cell.addEventListener("click", () => onSelectDate(iso, cell));
    } else {
      cell.disabled = true;
    }

    grid.appendChild(cell);
  }

  // month navigation uses CAL (singleton), then rebuilds
  document.getElementById("cal-prev").onclick = () => {
    CAL.month--;
    if (CAL.month < 0) { CAL.month = 11; CAL.year--; }
    buildAndRenderMonth();
  };
  document.getElementById("cal-next").onclick = () => {
    CAL.month++;
    if (CAL.month > 11) { CAL.month = 0; CAL.year++; }
    buildAndRenderMonth();
  };
}

// ---------- when a date is clicked ----------
async function onSelectDate(dateISO, cell) {
  const CAL = getCAL(); // not strictly required here, but safe/consistent

  document.querySelectorAll("#datePicker .cal-cell")
    .forEach(c => c.classList.remove("cal-cell--selected"));
  cell.classList.add("cal-cell--selected");

  CAL.selectedISO        = dateISO;
  STATE.selected.dateISO = dateISO;

  const slots = await computeTimeslotsForDate(dateISO);
  renderTimeslots(slots);
  scrollToTimeslots();
}

// Local-safe date-only helpers
function parseYMDLocal(ymd) {
  // ymd: "YYYY-MM-DD"
  const [y, m, d] = String(ymd).split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1, 0, 0, 0, 0); // LOCAL midnight
}

function toYMDLocal(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}


//Change time to regular time
function to12h(hhmm = '00:00') {
  const [H, M='0'] = String(hhmm).split(':');
  let h = parseInt(H, 10), m = parseInt(M, 10);
  const ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12; if (h === 0) h = 12;
  return `${h}:${String(m).padStart(2,'0')} ${ap}`;
}

// Pull a YYYY-MM-DD date out of various shapes stored in the DB

function isCanceled(v) {
  const flag = v?.["is Canceled"] ?? v?.isCanceled ?? v?.cancelled ?? v?.canceled;
  return flag === true || flag === "true";
}

// ====== PATCH: ensureClientIdForBooking (REPLACE WHOLE FUNCTION) ======
async function ensureClientIdForBooking({ businessId, email, firstName, lastName, phone }) {
  if (!businessId || !email) return { clientId: null, createdNew: false };

  async function query(where) {
    const qs = new URLSearchParams({
      where: JSON.stringify(where),
      limit: '5',
      ts: Date.now().toString()
    });
    const r = await fetch(`/api/records/Client?${qs}`, {
      credentials: 'include',
      cache: 'no-store'
    });
    if (!r.ok) return [];
    return r.json();
  }

  // Try both shapes for the Business reference
  let rows = await query({ "Email": email, "Business": businessId });
  if (!rows.length) rows = await query({ "Email": email, "Business": { _id: businessId } });

  // Pin the one that truly matches this business
  const found = rows.find(r => {
    const b = r?.values?.["Business"];
    return typeof b === 'string'
      ? b === businessId
      : String(b?._id) === String(businessId);
  });

  if (found) {
// inside `if (found) { ... }` block
const v = found.values || {};
const norm = s => (s || '').trim();

const needsFirst = norm(firstName) && norm(v["First Name"]) !== norm(firstName);
const needsLast  = norm(lastName)  && norm(v["Last Name"])  !== norm(lastName);
const needsPhone = norm(phone)     && norm(v["Phone Number"]) !== norm(phone);

if (needsFirst || needsLast || needsPhone) {
  try {
    await fetch(`getRecordById('Client', id)${encodeURIComponent(found._id)}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        values: {
          ...(needsFirst ? { "First Name": firstName } : {}),
          ...(needsLast  ? { "Last Name":  lastName  } : {}),
          ...(needsPhone ? { "Phone Number": phone }  : {})
        }
      })
    });
  } catch (_) {}
}

    return { clientId: found._id, createdNew: false };
  }

  // 🆕 Create a new Client for this business (with names)
  const values = {
    "Business":     { _id: businessId },
    "First Name":   firstName || (email.split('@')[0]),
    "Last Name":    lastName || "",
    "Email":        email,
    "Phone Number": phone || "",
    "is Deleted":   false
  };

  const createRes = await fetch(`/api/records/Client`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ values })
  });
  const data = await createRes.json().catch(() => null);
  if (!createRes.ok) throw new Error(data?.message || 'Client create failed');

  return { clientId: data?._id || data?.data?._id, createdNew: true };
}
// ====== /PATCH ======


// Robust public fetch for Appointments by business/calendar (no date filter here)
// Robust public fetch for Appointments (uses the same API.list helper)
// Pull all appointments for a calendar publicly; filter by date + canceled on the client
// Pull all appointments for a calendar publicly; filter by this day + not cancelled
async function getAppointmentsRows(calendarId, dateISO = null) {
  const rows = await publicList("Appointment", { Calendar: calendarId });

  return (rows || []).filter((r) => {
    const v = r.values || r;

    // Normalize day: accept Date, date, startISO, start
    const raw = (v.Date || v.date || v.startISO || v.start || "").toString();
    const day = raw.includes("T") ? raw.slice(0, 10) : raw;

    // Normalize canceled flag
    const canceled =
      v["is Canceled"] === true ||
      String(v["is Canceled"]).toLowerCase() === "true" ||
      String(v["Appointment Status"] || v.Status || "").toLowerCase() === "cancelled";

    return !canceled && (!dateISO || day === dateISO);
  });
}



// Try private list first (includes newly created appts), then fall back to public
// Try private list first (includes newly created appts), then fall back to generic records
async function listAppointmentsForCalendarDay(calendarId, dateISO) {
  const calId = refId(calendarId);
  const day = String(dateISO);

  const isSameDay = (v) => {
    const raw = (v.Date || v.date || v.startISO || v.start || "").toString();
    const d = raw.includes("T") ? raw.slice(0, 10) : raw;
    return d === day;
  };
  const notCanceled = (v) => {
    const s = String(v["Appointment Status"] || v.Status || "").toLowerCase();
    return v["is Canceled"] !== true && !s.includes("cancel");
  };
  const byCal = (v) => {
    const c = v.Calendar || v.calendar || v["Calendar"];
    const id = refId(c);
    return String(id) === String(calId);
  };
  const dedupe = (rows) => {
    const seen = new Set();
    return rows.filter(r => {
      const id = r._id || r.id || (r.values && r.values._id);
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  };

  const headers = { Accept: "application/json" };
  const results = [];

  // --- 1) PRIVATE (optional, if your API exposes /api/records/Appointment) ---
  const CAPS = window.BookingApp.CAPS || Object.create(null);
  const capKey = 'recordsGET_Appointment';

  if (CAPS[capKey] !== false) {
    for (const where of [{ Calendar: calId }, { Calendar: { _id: calId } }]) {
      const qs = new URLSearchParams({
        where: JSON.stringify(where),
        limit: "500",
        includeRefField: "0",
        ts: Date.now().toString()
      });
 const url = `/api/records?dataType=Appointment&${qs.toString()}`;

      const arr = await quietGetCap(url, { credentials: "include", cache: "no-store", headers }, capKey);
      if (arr.length) results.push(...arr);
    }
  }

  // --- 2) GENERIC RECORDS (no /api/me/records – avoids 401 for anonymous users) ---
  {
    const where = { Calendar: { _id: calId } };
    const qs = new URLSearchParams({
      dataType: "Appointment",
      where: JSON.stringify(where),
      limit: "500",
      ts: Date.now().toString()
    });

    // try /api/... then fall back to non-/api route
    let arr = await quietGetCap(`/api/records?${qs}`, { credentials: "include", cache: "no-store", headers }, 'recordsGET_list');
    if (!arr.length) {
      arr = await quietGetCap(`/records?${qs}`, { credentials: "include", cache: "no-store", headers }, 'recordsGET_list_fallback');
    }
    if (arr.length) results.push(...arr);
  }

  // Final filter for the exact day + not canceled + by calendar
  const filtered = dedupe(results)
    .map(r => r.values || r)
    .filter(v => byCal(v) && notCanceled(v) && isSameDay(v));

  return filtered;
}



async function computeTimeslotsForDate(dateISO) {
  const bId = STATE.businessId;
  const cId = refId(STATE.selected.calendarId);
  const dur = Number(STATE.selected.durationMin || 0);

  if (!bId || !cId || !dateISO || !dur) {
    console.debug('[booking] computeTimeslotsForDate: missing bId/cId/date/dur', { bId, cId, dateISO, dur });
    return [];
  }

  // Upcoming Hours for this business/calendar/date (PUBLIC)
  // pull all UH for this biz+cal, then filter to this day client-side
  let uhAll = await getUpcomingHoursRows(bId, cId);
  let uh = uhAll.filter(row => pickISODate(row.values || row) === dateISO);

  // Existing appointments (merged private/me/public), same day, same calendar, not cancelled
  const appts = await listAppointmentsForCalendarDay(cId, dateISO);
  console.log("[booking] Appts for", dateISO, "=>", appts.length);

  const booked = appts
    .map((r) => {
      const v = r.values || r;
      const start =
        v.Time ||
        v["Start Time"] ||
        (v.startISO || v.start || "").slice(11, 16);  // "HH:MM"
      const dmin = Number(v.Duration ?? v.duration ?? 0);
      if (!start || !dmin) return null;
      return { start, end: addMinutesHHMM(start, dmin) };
    })
    .filter(Boolean);

  // 🛟 safety-net: include a very-recent locally-booked block if server hasn’t surfaced it yet


  // Build free slots by subtracting booked from Upcoming Hours
  const slots = [];
  uh.forEach((row) => {
    const v = row.values || row;

    // prefer your admin labels; fall back to Start/End if needed
    const enabled   = v.Enabled !== false && v.Enabled !== "false";
    const available = v["is Available"] !== false && v["is Available"] !== "false";
    const startOpen = v.Start || v["Start Time"];
    const endOpen   = v.End   || v["End Time"];
    if (!startOpen || !endOpen || !enabled || !available) return;

    let cursor = startOpen;
    while (timeLTE(addMinutesHHMM(cursor, dur), endOpen)) {
      const candidateStart = cursor;
      const candidateEnd   = addMinutesHHMM(cursor, dur);
      const clash = booked.some(b => overlap(candidateStart, candidateEnd, b.start, b.end));
      if (!clash) slots.push({ start: candidateStart, end: candidateEnd });
      cursor = addMinutesHHMM(cursor, 15);
    }
  });

  slots.sort((a, b) => (timeLT(a.start, b.start) ? -1 : 1));
  console.debug("[booking] slots after merge", { dateISO, cId, count: slots.length });
  return slots;
}


// include a very-recent locally-booked block if server hasn’t surfaced it yet
try {
  const jb = JSON.parse(localStorage.getItem("lastBooked") || "null");
  if (jb &&
      String(jb.calId) === String(cId) &&
      jb.date === dateISO &&
      (Date.now() - jb.ts) < 5 * 60 * 1000 // 5 minutes
  ) {
    const already = booked.some(b => b.start === jb.start && b.end === addMinutesHHMM(jb.start, jb.duration));
    if (!already) booked.push({ start: jb.start, end: addMinutesHHMM(jb.start, jb.duration) });
  }
} catch {}
///////////////////////////////////////////////////////////////////////////////////////////
function bucketFor(hhmm) {
  const [h] = hhmm.split(":").map(Number);
  // tweak ranges if you like
  if (h >= 5 && h < 12)  return "Morning";    // 5:00–11:59
  if (h >= 12 && h < 17) return "Afternoon";  // 12:00–16:59
  return "Night";                              // 17:00–23:59 and 00:00–04:59
}

function renderTimeslots(slots) {
  const wrap = $("#timeslots");
  wrap.innerHTML = "";
  if (!Array.isArray(slots) || !slots.length) {
    wrap.innerHTML = `<div class="muted">No times available for this date.</div>`;
    hide("#section-confirm");
    return;
  }

  // group
  const groups = { Morning: [], Afternoon: [], Night: [] };
  slots.forEach(s => groups[bucketFor(s.start)].push(s));

  // render groups in fixed order
  ["Morning","Afternoon","Night"].forEach(label => {
    const list = groups[label];
    if (!list.length) return;

    const group = document.createElement("div");
    group.className = "times-group";

    const title = document.createElement("div");
    title.className = "times-group__title";
    title.textContent = label;
    group.appendChild(title);

    const grid = document.createElement("div");
    grid.className = "times-grid";
    list.forEach(s => {
      const btn = document.createElement("button");
      btn.className = "timeslot";
      btn.textContent   = to12h(s.start); // 12h label
      btn.dataset.start = s.start;        // keep 24h for logic
      btn.dataset.end   = s.end;
      btn.onclick = () => onSelectTimeslot(s.start);
      grid.appendChild(btn);
    });

    group.appendChild(grid);
    wrap.appendChild(group);
  });

  // (optional) style hook
  wrap.classList.add("is-grouped");
}

function onSelectTimeslot(timeHHMM) {
  STATE.selected.timeHHMM = timeHHMM;

  $$(".timeslot").forEach((b) => b.classList.remove("timeslot--selected"));
  const match = $$(".timeslot").find((b) => b.dataset.start === timeHHMM);
  match?.classList.add("timeslot--selected");

  const svcNames = STATE.selected.serviceIds
    .map((id) => {
      const s = CURRENT_SERVICES.find((x) => String(x._id) === String(id));
      const v = s?.values || s || {};
      return v.serviceName || v["Service Name"] || v.name || v.Name;
    })
    .filter(Boolean);

  $("#confirm-summary").innerHTML = `
    <div><strong>Date:</strong> ${formatDatePretty(STATE.selected.dateISO)}</div>
    <div><strong>Time:</strong> ${to12h(STATE.selected.timeHHMM)}</div>
    <div><strong>Services:</strong> ${svcNames.join(", ") || "—"}</div>
    <div><strong>Duration:</strong> ${STATE.selected.durationMin} min</div>
  `;

  openConfirm();   // <- just this, no extra show()
}


// ===== Modal wiring (single source of truth) =====

function openConfirm() {
  const el = document.getElementById('section-confirm');
  if (!el) return;

  el.style.display = 'flex';
  document.body.classList.add('modal-open');

  // Make sure X closes even if it uses different classes
  const xBtn =
    el.querySelector('[data-close]') ||
    el.querySelector('.close') ||
    el.querySelector('.modal__close') ||
    el.querySelector('button[aria-label="Close"]');

  if (xBtn && !xBtn.__wiredClose) {
    xBtn.__wiredClose = true;
    xBtn.addEventListener('click', (e) => { e.preventDefault(); closeConfirm(); });
  }

  // Scrim click closes
  const scrim = el.querySelector('.modal__scrim');
  if (scrim && !scrim.__wiredClose) {
    scrim.__wiredClose = true;
    scrim.addEventListener('click', (e) => { e.preventDefault(); closeConfirm(); });
  }

  // Focus the modal panel if present
  const pnl = el.querySelector('.modal__panel') || el.querySelector('[role="dialog"]');
  if (pnl) setTimeout(() => pnl.focus?.(), 0);
}

function closeConfirm() {
  const el = document.getElementById('section-confirm');
  if (!el) return;
  el.style.display = 'none';
  document.body.classList.remove('modal-open');
}

// Delegated listeners, wired once
(function wireModalOnce(){
  if (window.__BOOKING_MODAL_WIRED__) return;
  window.__BOOKING_MODAL_WIRED__ = true;

  function logState(prefix = '[confirm] state') {
    console.log(prefix, {
      calendarId: STATE?.selected?.calendarId,
      serviceIds: STATE?.selected?.serviceIds,
      dateISO:    STATE?.selected?.dateISO,
      timeHHMM:   STATE?.selected?.timeHHMM,
      duration:   STATE?.selected?.durationMin
    });
  }

  const btn = document.getElementById('btn-confirm') ||
              document.querySelector('[data-role="book-now"]');
  if (btn) btn.setAttribute('type','button');

  document.addEventListener('click', (e) => {
    const t = e.target;
    if (t.matches('#btn-confirm, [data-role="book-now"]')) {
      e.preventDefault();
      e.stopPropagation();
      console.log('[confirm] click');
      logState();

      const miss = [];
      if (!STATE?.selected?.calendarId)  miss.push('calendar');
      if (!STATE?.selected?.serviceIds?.length) miss.push('service');
      if (!STATE?.selected?.dateISO)     miss.push('date');
      if (!STATE?.selected?.timeHHMM)    miss.push('time');
      if (!STATE?.selected?.durationMin) miss.push('duration');

      if (miss.length) {
        alert(`Please select: ${miss.join(', ')}`);
        return;
      }

      Promise.resolve(confirmBookNow())
        .catch(err => {
          console.error('[confirm] booking error', err);
          alert('That time may have just been taken. Please pick another slot.');
        });
    }

    // Close (X or scrim)
    if (t.matches('[data-close], .modal__scrim')) {
      e.preventDefault();
      closeConfirm();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const el = document.getElementById('section-confirm');
      if (el && el.style.display !== 'none') closeConfirm();
    }
  });
})();


//If a day became fully booked, remove the dot on the month calendar without a page refresh:
async function refreshDayDot(dateISO) {
  // Recompute availability for the whole month and redraw once
  await buildAndRenderMonth();

  // Keep the clicked date visually selected (optional nicety)
  if (dateISO) {
    const d = new Date(dateISO);
    const dayNum = d.getDate();
    const cells = document.querySelectorAll('#datePicker .cal-cell .num');
    for (const num of cells) {
      if (Number(num.textContent) === dayNum) {
        num.parentElement.classList.add('cal-cell--selected');
        break;
      }
    }
  }
}

// ------- AUTH -------
function openAuth() {
  $("#authModal").classList.add("is-open");
}
function closeAuth() {
  $("#authModal").classList.remove("is-open");
}
async function onLoginClick() {
  try {
    const email = $("#auth-email").value.trim();
    const pass  = $("#auth-pass").value.trim();
    if (!email || !pass) return;

    const res = await API.login(email, pass);

    // mark user as logged in
    STATE.user.loggedIn = true;
    STATE.user.userId   = res.userId || res._id || res.id || null;
    STATE.user.role     = res.role || "client";
STATE.user.email     = res.email || email;           // keep the login email
STATE.user.firstName = res.firstName || '';
STATE.user.lastName  = res.lastName  || '';
STATE.user.phone     = res.phone || res.phoneNumber || '';

    // NEW: continue flow if we came here from "Book Now"
    const shouldContinue = !!STATE.user.continueAfterLogin;
    STATE.user.continueAfterLogin = false;

    closeAuth();

    if (shouldContinue) {
         confirmBookNow(); 
    }
  } catch (e) {
    alert("Login failed. Please check your credentials.");
    console.error(e);
  }
}

// make it global if needed elsewhere
window.confirmBookNow = async function confirmBookNow() {
  // basic guard
  if (
    !STATE?.selected?.calendarId ||
    !STATE?.selected?.serviceIds?.length ||
    !STATE?.selected?.dateISO ||
    !STATE?.selected?.timeHHMM ||
    !STATE?.selected?.durationMin
  ) {
    alert("Please choose calendar, service(s), date, and time.");
    return;
  }

  const btn = document.getElementById('btn-confirm');
  const restoreBtn = () => { if (btn) { btn.disabled = false; btn.textContent = 'Book Now'; } };

  try {
    if (btn) { btn.disabled = true; btn.textContent = 'Booking…'; }

    // 🔐 ALWAYS require a fresh login before proceeding
    await requireFreshLogin();

    // build payload
    const { clientId } = await ensureClientIdForBooking({
      businessId: STATE.businessId,
      email:      STATE.user.email,
      firstName:  STATE.user.firstName,
      lastName:   STATE.user.lastName,
      phone:      STATE.user.phone
    });

    const values = {
      Business:   { _id: STATE.businessId },
      Calendar:   { _id: STATE.selected.calendarId },
      Date:       STATE.selected.dateISO,
      Time:       STATE.selected.timeHHMM,
      Duration:   STATE.selected.durationMin,
      "Service(s)": (STATE.selected.serviceIds || []).map(id => ({ _id: id })),
      Client:     clientId ? { _id: clientId } : undefined,
      Name:       'Appointment',
      "Appointment Status": "booked",
      "is Canceled": false
    };

    const created = await createAppointment(values);

    // local safety hold so slot disappears immediately
    try {
      localStorage.setItem("lastBooked", JSON.stringify({
        calId: STATE.selected.calendarId,
        date:  STATE.selected.dateISO,
        start: STATE.selected.timeHHMM,
        duration: STATE.selected.durationMin,
        ts: Date.now()
      }));
    } catch {}

    // (optional) non-blocking notify; ignore errors
    try {
      await fetch(`${window.CONFIG?.API_BASE || ''}/api/booking/notify`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appointmentId: created?._id,
          businessId: STATE.businessId,
          calendarId: STATE.selected.calendarId,
          dateISO: STATE.selected.dateISO,
          timeHHMM: STATE.selected.timeHHMM,
          durationMin: STATE.selected.durationMin,
          client: {
            email: STATE.user.email,
            firstName: STATE.user.firstName,
            lastName: STATE.user.lastName,
            phone: STATE.user.phone
          }
        })
      });
    } catch {}

    // ✅ UI: show success, then refresh the day’s slots and the month dot
    showSuccess({
      dateISO: STATE.selected.dateISO,
      timeHHMM: STATE.selected.timeHHMM,
      durationMin: STATE.selected.durationMin
    });

    // Recompute available times for the selected day, re-render
    try {
      const slots = await computeTimeslotsForDate(STATE.selected.dateISO);
      renderTimeslots(slots);
    } catch {}

    // Update the dot on the month grid
    try { await refreshDayDot(STATE.selected.dateISO); } catch {}

  } catch (e) {
    const msg = String(e?.message || '');
    if (msg === 'LOGIN_TIMEOUT') {
      alert('Login timed out. Please try again.');
    } else if (!/LOGIN_REQUIRED/.test(msg)) {
      console.error('[confirm] create failed', e);
      alert(`Booking failed:\n${msg}`);
    }
  } finally {
    restoreBtn();
  }
};

// Resolve the pro/staff reference from the selected calendar
async function getProRefForSelectedCalendar() {
  const calId = (STATE?.selected?.calendarId && (STATE.selected.calendarId._id || STATE.selected.calendarId)) || null;
    console.log('DEBUG calId=', String(calId));
  console.log('DEBUG cacheKeys=', Object.keys(STATE.calById || {}));
  if (!calId) return null;

  // 🔧 Fallback: if calById missing, build it from STATE.calendars on the fly
  if (!STATE.calById && Array.isArray(STATE.calendars) && STATE.calendars.length) {
    STATE.calById = Object.fromEntries(
      STATE.calendars.map(c => [String(c._id || c.id), c])
    );
  }

  // Try cache first
  let cal = STATE.calById?.[String(calId)] || null;

  // Final fallback: scan the array
  if (!cal && Array.isArray(STATE.calendars)) {
    cal = STATE.calendars.find(c => String(c._id || c.id) === String(calId)) || null;
  }

  if (!cal) {
    console.warn('[booking] selected calendar not in cache; skipping pro lookup');
    return null;
  }

  const v = cal.values || {};
  const proLike =
    v.Pro || v['Pro Ref'] ||
    v.Staff || v['Staff Ref'] ||
    v.Professional || v.Provider || v.Owner;

  if (!proLike) return null;

  const id = proLike._id || proLike.id || (typeof proLike === 'string' ? proLike : null);
  return id ? { _id: String(id) } : null;
}

// Make sure hydrateUser is defined on window so any handler can call it
window.hydrateUser = async function hydrateUser() {
  try {
    if (STATE.user?.hydrated) return;
    const r = await fetch('/api/users/me?ts=' + Date.now(), { credentials: 'include' });
    if (r.status === 401) { STATE.user = { loggedIn:false, hydrated:true }; return; }
    const { user } = await r.json();
    STATE.user = {
      ...(STATE.user || {}),
      loggedIn: true,
      hydrated: true,
      userId:    user._id,
      email:     (user.email || '').trim(),
      firstName: (user.firstName || '').trim(),
      lastName:  (user.lastName || '').trim(),
      phone:     (user.phone || '').trim(),
      profilePhoto: user.profilePhoto || ''
    };
  } catch {
    // leave STATE.user as-is
  }
};

// prime as soon as page loads
document.addEventListener('DOMContentLoaded', () => { window.hydrateUser(); });

// ------- BOOKING -------
// Make it globally visible to the page & DevTools
// Remove other confirmBookNow definitions above/below.
// Keep exactly this one:
window.confirmBookNow = async function confirmBookNow() {
  try {
    // Guard: ensure selections exist
    if (
      !STATE?.selected?.calendarId ||
      !STATE?.selected?.serviceIds?.length ||
      !STATE?.selected?.dateISO ||
      !STATE?.selected?.timeHHMM ||
      !STATE?.selected?.durationMin
    ) {
      alert("Please choose calendar, service(s), date, and time.");
      return;
    }

    // Require login
   await hydrateUser();
if (!STATE.user?.loggedIn) {
  STATE.user.continueAfterLogin = true; // so we resume
  openAuth();                           // show modal
  return;                               
}

    // Build appointment payload (yours unchanged)
    const svcNames = (STATE.selected.serviceIds || [])
      .map(id => CURRENT_SERVICES.find(s => String(s._id||s.id) === String(id))?.values?.Name)
      .filter(Boolean);
    const appointmentName = svcNames.join(' + ');

    const { clientId } = await ensureClientIdForBooking({
      businessId: STATE.businessId,
      email:      STATE.user.email,
      firstName:  STATE.user.firstName,
      lastName:   STATE.user.lastName,
      phone:      STATE.user.phone
    });

    const values = {
      Business:   { _id: STATE.businessId },
      Calendar:   { _id: STATE.selected.calendarId },
      Date:       STATE.selected.dateISO,
      Time:       STATE.selected.timeHHMM,
      Duration:   STATE.selected.durationMin,
      "Service(s)": (STATE.selected.serviceIds || []).map(id => ({ _id: id })),
      Client:     clientId ? { _id: clientId } : undefined,
      Name:       appointmentName || "Appointment",
      "Appointment Status": "booked",
      "is Canceled": false
    };

    // 🔴 Actually create it (this throws if 4xx/5xx)
    const created = await createAppointment(values);

    // Optional: local safety hold so slot disappears immediately
try {
  localStorage.setItem("lastBooked", JSON.stringify({
    calId: STATE.selected.calendarId,
    date:  STATE.selected.dateISO,
    start: STATE.selected.timeHHMM,
    duration: STATE.selected.durationMin,
    ts: Date.now()
  }));
} catch {}

try {
await fetch(`${window.CONFIG.API_BASE}/api/booking/notify`, {
  method: 'POST',
  credentials: 'include',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    appointmentId: created?._id,
    businessId: STATE.businessId,
    calendarId: STATE.selected.calendarId,
    dateISO: STATE.selected.dateISO,
    timeHHMM: STATE.selected.timeHHMM,
    durationMin: STATE.selected.durationMin,
    client: {
      email: STATE.user.email,
      firstName: STATE.user.firstName,
      lastName: STATE.user.lastName,
      phone: STATE.user.phone
    }
  })
});

} catch (e) {
  console.warn('Notify email failed (non-blocking)', e);
}

await refreshDayDot(STATE.selected.dateISO);


  } catch (err) {
    console.error('[confirm] create failed', err);
    alert(`Booking failed:\n${err.message}`);
  }
};

(function wireBookNowOnce(){
  if (window.__BOOK_NOW_WIRED__) return;
  window.__BOOK_NOW_WIRED__ = true;

  function attach(){
    const btn = document.getElementById('btn-confirm') ||
                document.querySelector('[data-role="book-now"]');
    if (!btn) return;
    btn.type = 'button';
    if (btn.__wiredConfirm) return;
    btn.__wiredConfirm = true;

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();

      console.group('[confirm] #btn-confirm clicked');
      console.log('STATE.selected:', {
        calendarId: STATE?.selected?.calendarId,
        serviceIds: STATE?.selected?.serviceIds,
        dateISO:    STATE?.selected?.dateISO,
        timeHHMM:   STATE?.selected?.timeHHMM,
        duration:   STATE?.selected?.durationMin
      });

      const miss = [];
      if (!STATE?.selected?.calendarId)  miss.push('calendar');
      if (!STATE?.selected?.serviceIds?.length) miss.push('service');
      if (!STATE?.selected?.dateISO)     miss.push('date');
      if (!STATE?.selected?.timeHHMM)    miss.push('time');
      if (!STATE?.selected?.durationMin) miss.push('duration');
      if (miss.length) {
        console.warn('Missing:', miss);
        alert(`Please select: ${miss.join(', ')}`);
        console.groupEnd();
        return;
      }

      Promise.resolve(window.confirmBookNow())
        .catch(err => console.error('confirmBookNow error:', err))
        .finally(() => console.groupEnd());
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', attach, { once: true });
  } else {
    attach();
  }
})();




function prettyDate(ymd = '2025-01-01') {
  try {
    const d = new Date(`${ymd}T00:00:00`);
    return d.toLocaleDateString(undefined, { weekday:'short', month:'short', day:'numeric', year:'numeric' });
  } catch { return ymd; }
}


// ------- SUCCESS -------
function closeSuccess() {
  $("#successModal").classList.remove("is-open");
}



})();
})();