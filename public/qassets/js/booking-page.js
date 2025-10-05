console.log('[booking] booking-page.js loaded');
console.log('[booking-js] LIVE v10 loaded');
console.log('[booking-js] LIVE v11 loaded');


// ---- Local date helpers (no timezone drift) ----
function parseYMDLocal(ymd){ const [y,m,d]=(ymd||"").split("-").map(Number); return new Date(y,(m||1)-1,d||1,0,0,0,0); }
function toYMDLocal(date){ const y=date.getFullYear(); const m=String(date.getMonth()+1).padStart(2,"0"); const d=String(date.getDate()).padStart(2,"0"); return `${y}-${m}-${d}`; }
function addDaysLocal(date,days){ return new Date(date.getFullYear(),date.getMonth(),date.getDate()+(days||0)); }

const STATE = {
  businessId: null,
  selected: { calendarId:null, categoryId:null, serviceIds:[], dateISO:null, timeHHMM:null, durationMin:0 },
  mode: { multiService:false },
  user: { loggedIn:false, userId:null, role:null },
};

// URL helper (keep ONE copy of this in the file)
window.toUrl = window.toUrl || function toUrl(v){
  if (!v) return "";
  if (Array.isArray(v)) v = v[0];
  if (typeof v === "object") v = v.url || v.path || v.src || v.filename || v.name || "";
  v = String(v);
  return (/^https?:\/\//i.test(v) || v.startsWith("/")) ? v : `/uploads/${v.replace(/^\/+/, "")}`;
};
// Pull an id out of a string or a {_id} / {id} ref
function idOf(x) {
  if (!x) return "";
  return (typeof x === "object") ? (x._id || x.id || "") : String(x);
}
// normalize ref → id
const refId = (x) => (x && typeof x === "object") ? (x._id || x.id || "") : (x || "");

// read a pro-ish reference from a Calendar row (values or raw)
function extractProUserId(calendarRow) {
  const v = calendarRow?.values || calendarRow || {};
  const proLike =
    v.Pro || v['Pro Ref'] ||
    v.Staff || v['Staff Ref'] ||
    v.Professional || v.Provider || v.Owner ||
    v['Pro User Id'] || v.proUserId;   // if you chose to expose a public id field
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
  // 1) Denormalized on the Appointment
  const dn = (v["Client Name"] || "").trim();
  if (dn) return dn;
  const fn = (v["Client First Name"] || "").trim();
  const ln = (v["Client Last Name"]  || "").trim();
  if (fn || ln) return `${fn} ${ln}`.trim();

  // 2) Expanded Client ref (when includeRefField=1)
  const c = v.Client || v["Client"];
  const cv = c?.values || {};
  const efn = (cv?.["First Name"] || cv?.firstName || "").trim();
  const eln = (cv?.["Last Name"]  || cv?.lastName  || "").trim();
  if (efn || eln) return `${efn} ${eln}`.trim();

  // 3) Email fallback
  const em = (v["Client Email"] || cv?.Email || "").trim();
  if (em) return em;
  return "(No client)";
}

document.addEventListener("DOMContentLoaded", async () => {
  const slug = location.pathname.replace(/^\/+/, "").split("/")[0];
  if (!slug) { showError("No business slug in URL."); return; }

  try {
    // fetch business by slug
    let resp = await fetch(`/${encodeURIComponent(slug)}.json`, {
      headers: { Accept: "application/json" },
      credentials: "same-origin",
    });
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
// Resolve the business owner/creator id from the Business doc we just fetched
STATE.ownerUserId =
  idOf(biz.createdBy) ||
  idOf((v || {})["Created By"]) ||
  idOf((v || {}).createdBy)     ||
  idOf((v || {}).Owner)         || idOf((v || {})["Owner"]) ||
  idOf((v || {}).User)          || idOf((v || {})["User"])  ||
  idOf((v || {})["Pro User"])   || idOf((v || {}).Pro)      ||
  null;

// If the public JSON hides it, try a private fetch that includes createdBy
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

 // ---- Calendars load with auto-advance when there is exactly one ----
// ---- Calendars load with auto-advance when there is exactly one ----
let calendars = await loadCalendarsForBusiness(biz._id);
if (!Array.isArray(calendars)) calendars = [];

// index calendars so setSelectedCalendar can look up the pro
window.CALENDAR_BY_ID = Object.create(null);
calendars.forEach(c => {
  const id = String(c._id || c.id || c.calendarId);
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
function toUrl(val) {
  if (!val) return "";
  if (Array.isArray(val)) val = val[0];
  if (typeof val === "object") val = val.url || val.path || val.src || val.filename || val.name || "";
  if (!val) return "";
  if (/^https?:\/\//i.test(val) || val.startsWith("/")) return val;
  return `/uploads/${String(val).replace(/^\/+/, "")}`;
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

function toText(v) {
  if (v == null) return "";
  if (typeof v === "string") return v.trim();
  if (typeof v === "number") return String(v);
  if (typeof v === "object") {
    for (const k of ["label","text","name","title","value"]) {
      if (typeof v[k] === "string" && v[k].trim()) return v[k].trim();
    }
  }
  return "";
}
function pickCalendarName(obj = {}) {
  const v = obj.values || obj;
  return (
    v.calendarName ??
    v.name ??
    v["Calendar Name"] ??
    v.title ?? v.Title ??
    v.displayName ?? v["Display Name"] ??
    "Calendar"
  );
}




// in renderCalendars(...)
const name = pickCalendarName(cal);

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

// in your CONFIG / STATE API object
create: (dataType, values) => {
  return fetch(`/api/records/${encodeURIComponent(dataType)}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    credentials: "include",
    body: JSON.stringify({ values })
  }).then(async (r) => {
    if (!r.ok) {
      const body = await r.text();
      console.error(`[API.create] ${dataType} → ${r.status}`, body); // ⬅️ keep this
      throw new Error(`${r.status} ${body}`);
    }
    return r.json();
  });
},


  login: (email, password) => {
    return fetch(`/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ email, password }),
    }).then(async (r) => {
      if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
      return r.json();
    });
  },
};

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
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

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


// ------- INIT -------
let CURRENT_SERVICES = [];

// ------- RENDERERS -------
//New 
// Ensure a global STATE exists somewhere near the top
window.STATE = window.STATE || { user:{}, selected:{}, calendars:[], calById:null, businessId:null };

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
    const url = `/public/records?dataType=Calendar&${encodeURIComponent(k)}=${encodeURIComponent(v)}&ts=${Date.now()}`;
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
function renderCalendars(calendars) {
  // keep available in console
  window.__cals = calendars;

  const wrap = document.getElementById('calendars');
  if (!wrap) return;
  wrap.innerHTML = '';

  if (!Array.isArray(calendars) || calendars.length === 0) {
    wrap.innerHTML = `<div class="muted" style="grid-column:1/-1;">No calendars found.</div>`;
    return;
  }

  calendars.forEach(cal => {
    const v = cal.values || cal; // support both shapes
    const label =
      pickKey(v, ['calendarName', 'Calendar Name', 'name', 'Name', 'title', 'Title', 'label', 'Label'])
      || 'Calendar';

    const el = document.createElement('button');
    el.className = 'card card--select';
    el.style.textAlign = 'left';
    el.innerHTML = `
      <div class="card__title">${String(label)}</div>
      <div class="card__sub muted">${v.description ? String(v.description) : ''}</div>
    `;
    el.addEventListener('click', () => onSelectCalendar(cal));
    wrap.appendChild(el);
  });
}
async function onSelectCalendar(cal) {
  const calId = String(cal._id || cal.id || cal.calendarId);

  // ✅ set selected calendar + cache its pro id
  setSelectedCalendar(calId);

  // move to the next step in the flow
  hide(getCalendarSectionEl());

  // load categories for this calendar
  const categories = await getCategoriesForCalendar(STATE.businessId, calId);
  if (typeof renderCategories === 'function') {
    renderCategories(categories);
    show(document.getElementById('section-cats'));
  } else {
    simpleRenderCategories(categories);
  }

  // (optional) clear downstream selections
  STATE.selected.categoryId = null;
  STATE.selected.serviceIds = [];
  STATE.selected.dateISO = null;
  STATE.selected.timeHHMM = null;

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
// --- Helpers to locate sections ---
// --- Section helpers (keep these) ---
function getCalendarSectionEl() {
  return document.getElementById('calendars')?.closest('.section') || null;
}
function show(el) {
  if (typeof el === "string") el = document.querySelector(el);
  if (!el) return;               // <-- guard
  el.style.display = "";          // empty = use stylesheet default
}

function hide(el) {
  if (typeof el === "string") el = document.querySelector(el);
  if (!el) return;               // <-- guard
  el.style.display = "none";
}

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
function onSelectCalendar(cal) {
  // remember the selected calendar
  STATE.selected.calendarId = cal._id || cal.id;

  // 🔑 hide the whole calendars section
  hide(getCalendarSectionEl());

  // reset downstream state/UI
  STATE.selected.categoryId = null;
  STATE.selected.serviceIds = [];
  CURRENT_SERVICES = [];
  $("#categories").innerHTML = "";
  $("#services").innerHTML = "";
  hide("#section-services");
  hide("#section-availability");
  hide("#section-confirm");

  // load categories strictly for this business + calendar
  const bizId = STATE.businessId || window.selectedBusinessId;
  loadCategoriesForCalendar(bizId, STATE.selected.calendarId)
    .then(cats => {
      renderCategories(cats);
      show("#section-cats");
    });
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


async function onSelectCategory(categoryId) {
  STATE.selected.categoryId = categoryId;

  const bizId = STATE.businessId || window.selectedBusinessId;
  const calId = STATE.selected.calendarId;

  // robust fetch (tries many key names + fallback)
  const services = await loadServicesForCategory(bizId, calId, categoryId);

  CURRENT_SERVICES = services;        // store flattened objects
  renderServices(CURRENT_SERVICES);   // draw them

   // ⬇️ hide categories, show services
  hide('#section-cats');
  show('#section-services');
  hide('#section-availability');
  hide('#section-confirm');

  // optional: scroll to services
  document.getElementById('section-services')?.scrollIntoView({ behavior:'smooth' });
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

// Load services for a calendar/category using many possible field names.
async function loadServicesForCategory(businessId, calendarId, categoryId) {
  // Most specific first
  let rows = await fetchCombo("Service", { Business: businessId, Calendar: calendarId, Category: categoryId });
  if (!rows.length) rows = await fetchCombo("Service", { Calendar: calendarId, Category: categoryId });
  if (!rows.length) rows = await fetchCombo("Service", { Business: businessId, Category: categoryId });
  if (!rows.length) rows = await fetchCombo("Service", { Business: businessId, Calendar: calendarId });
  if (!rows.length) rows = await fetchAll("Service");

  // Strict filter
  rows = rows.filter(doc => {
    const v = doc.values || {};
    const catRef = refId(v.categoryId ?? v.Category ?? v.category ?? v.categoryRef ?? v.CategoryId);
    const calRef = refId(v.calendarId ?? v.Calendar ?? v.calendar ?? v.calendarRef ?? v.CalendarId);
    const bizRef = refId(v.businessId ?? v.Business ?? v.business ?? v.businessRef ?? v.BusinessId ?? v["Business Id"]);
    const deleted = !!(v.isDeleted ?? v["is Deleted"]);
    return !deleted &&
           String(catRef) === String(categoryId) &&
           (!calendarId || String(calRef) === String(calendarId)) &&
           (!businessId || String(bizRef) === String(businessId));
  });

  // Normalize shape for your renderer
  return rows.map(doc => {
    const v = doc.values || {};
    return {
      _id: doc._id,
      values: v, // keep original too (in case other code expects it)
      serviceName: v.serviceName || v["Service Name"] || v.title || v.Title || v.name || v.Name || "Service",
      duration:    Number(String(v.duration ?? v.durationMinutes ?? v["Duration"] ?? v["Minutes"] ?? v.length ?? v["Service Duration"]).replace(/[^\d.]/g,"")) || 0,
      price:       Number(String(v.price ?? v.Price ?? v["Service Price"] ?? v.amount ?? v.cost ?? v.rate).replace(/[^\d.]/g,"")) || 0,
      imageUrl:    v.imageUrl || v["Image URL"] || v.image || v.Image || v.heroImage || v.photo || v.picture || "",
      businessId:  refId(v.businessId ?? v.Business ?? v.business ?? v.businessRef ?? v.BusinessId ?? v["Business Id"]),
      calendarId:  refId(v.calendarId ?? v.Calendar ?? v.calendar ?? v.calendarRef ?? v.CalendarId),
      categoryId:  refId(v.categoryId ?? v.Category ?? v.category ?? v.categoryRef ?? v.CategoryId),
    };
  });
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


function recomputeDuration() {
  const idSet = new Set(STATE.selected.serviceIds);
  let total = 0;
  for (const svc of CURRENT_SERVICES) {
    if (idSet.has(svc._id)) total += svcDuration(svc);
  }
  STATE.selected.durationMin = total;
}

function numeric(val) {
  if (val == null) return NaN;
  const n = Number(String(val).replace(/[^\d.]/g, ""));
  return Number.isFinite(n) ? n : NaN;
}
function svcDuration(svc) {
  const v = svc.values || svc;
  return Math.round(
    numeric(svc.duration) ??
    numeric(v.duration) ??
    numeric(v.durationMinutes) ??
    numeric(v["Duration"]) ??
    numeric(v["Minutes"]) ??
    numeric(v.length) ??
    numeric(v["Service Duration"]) ??
    0
  ) || 0;
}
function svcPrice(svc) {
  const v = svc.values || svc;
  return numeric(
    svc.price ?? v.price ?? v.Price ?? v["Service Price"] ?? v.cost ?? v.amount ?? v.rate ?? v.fee
  ) || 0;
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
const CAL = { year: null, month: null, available: new Set() };

function initCalState() {
  const now = new Date();
  if (CAL.year == null)  CAL.year  = now.getFullYear();
  if (CAL.month == null) CAL.month = now.getMonth(); // 0..11
}

function toISODate(year, month0, day) {
  return `${year}-${String(month0+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
}

function monthLabel(year, month0) {
  return new Date(year, month0, 1).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
}

async function buildAndRenderMonth() {
  const availableSet = await getAvailableDatesForMonth(CAL.year, CAL.month);
  CAL.available = availableSet;
  renderMonthCalendar(CAL.year, CAL.month, availableSet);
}

async function openAvailability(hideServicesAndScroll = false) {
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

  initCalState();
  await buildAndRenderMonth();
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

function renderMonthCalendar(year, month, availableSet) {
  const wrap = document.getElementById("datePicker");
  if (!wrap) return;
  wrap.innerHTML = "";

  const root = document.createElement("div");
  root.className = "cal";
  wrap.appendChild(root);

  // force centering in case other styles override
root.style.width = "max-content";
root.style.margin = "0 auto";

  // header
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

  // nav
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

// When a date is clicked, fetch times and show them
async function onSelectDate(dateISO, cell) {
  document.querySelectorAll("#datePicker .cal-cell")
    .forEach(c => c.classList.remove("cal-cell--selected"));
  cell.classList.add("cal-cell--selected");

  STATE.selected.dateISO = dateISO;

  const slots = await computeTimeslotsForDate(dateISO);
  renderTimeslots(slots);

  scrollToTimeslots();  // 👈 scroll down to the slots
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

function toISODateOnly(input) {
  // If it's already "YYYY-MM-DD", keep it (no UTC parse)
  if (typeof input === "string" && /^\d{4}-\d{2}-\d{2}$/.test(input)) return input;
  // Otherwise assume a Date and render as local Y-M-D
  return toYMDLocal(new Date(input));
}
//Change time to regular time
function to12h(hhmm) {
  if (!hhmm) return "";
  const [H, M] = String(hhmm).split(":");
  let h = parseInt(H, 10);
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${M} ${ampm}`;
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
    await fetch(`/api/records/Client/${encodeURIComponent(found._id)}`, {
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
// Pull booked appts for this calendar/day from multiple sources and merge
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

  // 1) PRIVATE: direct REST, two shapes for Calendar filter
  for (const where of [{ Calendar: calId }, { Calendar: { _id: calId } }]) {
    try {
      const qs = new URLSearchParams({
        where: JSON.stringify(where),
        limit: "500",
        includeRefField: "0",
        ts: Date.now().toString() // cache-bust
      });
      const r = await fetch(`/api/records/Appointment?${qs}`, {
        credentials: "include",
        cache: "no-store",
        headers
      });
      if (r.ok) {
        const arr = await r.json();
        if (Array.isArray(arr) && arr.length) results.push(...arr);
      }
    } catch (e) {
      console.debug("[slots] private REST failed", e);
    }
  }

  // 2) "ME" endpoint (client’s appointments). We’ll filter by calendar+day client-side.
  try {
    const qs = new URLSearchParams({
      dataType: "Appointment",
      includeCreatedBy: "1",
      includeRefField: "0",
      myRefField: "Client",
      limit: "500",
      ts: Date.now().toString()
    });
    const r = await fetch(`/api/me/records?${qs}`, {
      credentials: "include",
      cache: "no-store",
      headers
    });
    if (r.ok) {
      const arr = await r.json();
      if (Array.isArray(arr) && arr.length) results.push(...arr);
    }
  } catch (e) {
    console.debug("[slots] /api/me/records failed", e);
  }

  // 3) PUBLIC fallback
  try {
    const arr = await publicList("Appointment", { Calendar: calId, ts: Date.now() });
    if (Array.isArray(arr) && arr.length) results.push(...arr);
  } catch (e) {
    console.debug("[slots] publicList failed", e);
  }

  // Filter (same day, same calendar, not cancelled) + dedupe
  const filtered = dedupe(results).filter(row => {
    const v = row.values || row;
    return isSameDay(v) && byCal(v) && notCanceled(v);
  });

  console.debug("[slots] merged booked count", {
    day,
    calId,
    privateOrMeOrPublic: results.length,
    afterFilter: filtered.length
  });

  return filtered;
}


async function computeTimeslotsForDate(dateISO) {
  const bId = STATE.businessId;
  const cId = refId(STATE.selected.calendarId);   // ← normalize
  const dur = STATE.selected.durationMin;

  if (!bId || !cId || !dateISO || !dur) return [];

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
  try {
    const jb = JSON.parse(localStorage.getItem("lastBooked") || "null");
    if (
      jb &&
      String(jb.calId) === String(cId) &&
      jb.date === dateISO &&
      (Date.now() - jb.ts) < 5 * 60 * 1000 // 5 minutes
    ) {
      const jbEnd = addMinutesHHMM(jb.start, jb.duration);
      const already = booked.some(b => b.start === jb.start && b.end === jbEnd);
      if (!already) {
        booked.push({ start: jb.start, end: jbEnd });
        console.debug("[booking] added local safety block", jb);
      }
    }
  } catch {}

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
  const match = $$(".timeslot").find((b) => b.dataset.start === timeHHMM); // ← changed
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
    <div><strong>Time:</strong> ${to12h(STATE.selected.timeHHMM)}</div>   <!-- ← formatted -->
    <div><strong>Services:</strong> ${svcNames.join(", ") || "—"}</div>
    <div><strong>Duration:</strong> ${STATE.selected.durationMin} min</div>
  `;
  show("#section-confirm");
  openConfirm();

}

function openConfirm() {
  const el = document.getElementById('section-confirm');
  if (!el) return;
  el.style.display = 'flex';     // modal layout
  document.body.classList.add('modal-open');
  setTimeout(() => el.querySelector('.modal__panel')?.focus(), 0);
}

function closeConfirm() {
  const el = document.getElementById('section-confirm');
  if (!el) return;
  el.style.display = 'none';
  document.body.classList.remove('modal-open');
}

// close on scrim / X / Esc
(() => {
  const el = document.getElementById('section-confirm');
  if (!el) return;

  el.addEventListener('click', (e) => {
    if (e.target.matches('[data-close], .modal__scrim')) closeConfirm();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && el.style.display !== 'none') closeConfirm();
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
async function confirmBookNow() {
  try {
    // 0) Validate
    if (
      !STATE.selected.calendarId ||
      !STATE.selected.serviceIds.length ||
      !STATE.selected.dateISO ||
      !STATE.selected.timeHHMM ||
      !STATE.selected.durationMin
    ) {
      alert("Please choose calendar, service(s), date, and time.");
      return;
    }

    // ✅ 1) HYDRATE EARLY
    await hydrateUser();
if (!STATE.calById && Array.isArray(STATE.calendars) && STATE.calendars.length) {
  STATE.calById = Object.fromEntries(
    STATE.calendars.map(c => [String(c._id || c.id), c])
  );
}

    // 2) If still not logged in, go to auth
    if (!STATE.user.loggedIn) {
      STATE.user.continueAfterLogin = true;
      openAuth();
      return;
    }

    // 3) Build appointment name
    const svcNames = STATE.selected.serviceIds
      .map(id => CURRENT_SERVICES.find(s => s._id === id)?.values?.["Name"])
      .filter(Boolean);
    const appointmentName = svcNames.join(" + ");

    // 4) Ensure Client record exists (now STATE.user has real names)
    const { clientId } = await ensureClientIdForBooking({
      businessId: STATE.businessId,
      email:      STATE.user.email,
      firstName:  STATE.user.firstName,
      lastName:   STATE.user.lastName,
      phone:      STATE.user.phone
    });

    // 5) Build values
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

  // 6) Denormalize names (account first; client only if account is missing)
let dnFirst = (STATE.user.firstName || '').trim();
let dnLast  = (STATE.user.lastName  || '').trim();
let dnEmail = (STATE.user.email     || '').trim();

try {
  if (clientId) {
    const r = await fetch(`/api/records/Client/${encodeURIComponent(clientId)}?ts=${Date.now()}`, {
      credentials: "include",
      headers: { Accept: "application/json" }
    });
    if (r.ok) {
      const cv = (await r.json())?.values || {};
      // ⭐ Do NOT overwrite non-empty account values with older client values
      if (!dnFirst) dnFirst = (cv['First Name'] || '').trim();
      if (!dnLast)  dnLast  = (cv['Last Name']  || '').trim();
      if (!dnEmail) dnEmail = (cv['Email']      || '').trim();
    }
  }
} catch {}

const dnFull = [dnFirst, dnLast].filter(Boolean).join(' ').trim();
values['Client Name']       = dnFull || (dnEmail.split('@')[0] || 'Client');
values['Client First Name'] = dnFirst;
values['Client Last Name']  = dnLast;
values['Client Email']      = dnEmail;


  
    // 7) Attach Pro, etc. (unchanged)
    if (STATE.selected.proUserId) {
      values.Pro = { _id: STATE.selected.proUserId };
    } else {
      try {
        const proRef = await getProRefForSelectedCalendar();
        if (proRef && proRef._id) values.Pro = proRef;
      } catch (e) {}
    }
    if (STATE.ownerUserId) values["Business Owner"] = { _id: STATE.ownerUserId };
    try {
      const res = await fetch(`/${encodeURIComponent(slugFromPath())}.json`, { headers: { Accept: "application/json" } });
      if (res.ok) {
        const biz = await res.json();
        const pn = biz?.values?.["Pro Name"] || biz?.values?.proName || biz?.values?.stylistName || "";
        if (pn) values["Pro Name"] = pn;
      }
    } catch {}

    // 8) Save
    await API.create("Appointment", values);
    // ... (rest of your success UI code)
  } catch (e) {
    alert("That time may have just been taken. Please pick another slot.");
    console.error("Book error", e);
  }
}
function to12h(hhmm = '00:00') {
  const [H, M='0'] = String(hhmm).split(':');
  let h = parseInt(H, 10), m = parseInt(M, 10);
  const ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12; if (h === 0) h = 12;
  return `${h}:${String(m).padStart(2,'0')} ${ap}`;
}
function prettyDate(ymd = '2025-01-01') {
  try {
    const d = new Date(`${ymd}T00:00:00`);
    return d.toLocaleDateString(undefined, { weekday:'short', month:'short', day:'numeric', year:'numeric' });
  } catch { return ymd; }
}
function makeIcsBuffer({ title, description='', location='', startISO, durationMin=60, organizerName='', organizerEmail='' }) {
  const d = new Date(startISO);
  return new Promise((resolve, reject) => {
    createEvent({
      start: [d.getFullYear(), d.getMonth()+1, d.getDate(), d.getHours(), d.getMinutes()],
      duration: { minutes: durationMin },
      title,
      description,
      location,
      organizer: organizerEmail ? { name: organizerName || '', email: organizerEmail } : undefined,
      status: 'CONFIRMED',
      busyStatus: 'BUSY'
    }, (err, value) => err ? reject(err) : resolve(Buffer.from(value)));
  });
}
async function sendBookingEmail({ to, subject, html, icsBuffer }) {
  const from = process.env.MAIL_FROM || process.env.SMTP_USER;
  return mailer.sendMail({
    from, to, subject, html,
    attachments: icsBuffer ? [{ filename: 'appointment.ics', content: icsBuffer, contentType: 'text/calendar' }] : []
  });
}






// ------- SUCCESS -------
function closeSuccess() {
  $("#successModal").classList.remove("is-open");
}
// Hook up the buttons once the DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("btn-confirm")?.addEventListener("click", confirmBookNow);
  document.getElementById("btn-login")?.addEventListener("click", onLoginClick);
});

