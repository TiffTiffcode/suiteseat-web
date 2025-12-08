//C:\Users\tiffa\OneDrive\Desktop\suiteseat-web\public\qassets\js\calendar.js
// ==== Auth bootstrap: detect user and paint header ====

console.log("[calendar] fresh build v1");
///////////////////////////
// --- pick the right API origin in dev ---
const API_ORIGIN =
  window.API_BASE ||                               // allow override
  (location.port === "3000" ? "http://localhost:8400" : ""); // Next dev → Express

async function api(path, init = {}) {
  return fetch(`${API_ORIGIN}${path}`, {
    credentials: "include",
    cache: "no-store",
    headers: { Accept: "application/json", ...(init.headers || {}) },
    ...init,
  });
}
console.log("[api] using origin:", API_ORIGIN || "(same origin)");

// ---- Single ID helper (global) ----
window.asId = window.asId || function asId(x) {
  if (!x) return "";
  if (typeof x === "string") return x;
  return String(x._id || x.id || "");
};

// (keep these tiny aliases if other code calls them)
const _asId = (ref) => window.asId(ref);
const c_asId = (x)   => window.asId(x);

// Returns the first non-empty string found under any of the provided keys.
function getFirst(v, keys = []) {
  for (const k of keys) {
    const val = (v?.[k] ?? "").toString().trim();
    if (val) return val;
  }
  return "";
}

// Find which key currently holds the phone value on this record; default to "Phone".
function detectPhoneKey(v) {
  const candidates = ["Phone", "Phone Number", "Phone #", "PhoneNumber", "Mobile", "Cell", "phone"];
  for (const k of candidates) {
    if (v && Object.prototype.hasOwnProperty.call(v, k)) return k;
  }
  return "Phone";
}

// Hide-per-pro helper
function isHiddenForMe(client) {
  const me = String(window.STATE?.userId || "");
  if (!me) return false;
  const arr = client?.values?.HiddenFor;
  if (!arr) return false;
  if (Array.isArray(arr)) return arr.map(String).includes(me);
  if (typeof arr === "string") {
    return arr.split(",").map(s => s.trim()).filter(Boolean).includes(me);
  }
  return false;
}


////////////////////////
//Log In
(async function initAuthHeader() {
  // where the Login button lives in your HTML
  const headerRight = document.querySelector(".right-group");
  if (!headerRight) return;

  try {
    const res  = await fetch("/check-login", { credentials: "include", cache: "no-store" });
    const data = await res.json().catch(() => ({}));

    if (data && data.loggedIn) {
      // keep some auth info handy
      window.STATE = window.STATE || {};
      window.STATE.userId = String(data.userId || "");
      window.STATE.user   = data;

      // pick a friendly display name
      const display =
        (data.firstName && data.firstName.trim()) ||
        (data.name && data.name.trim().split(" ")[0]) ||
        (data.email && data.email.split("@")[0]) ||
        "there";

      // replace the Login button with greeting + Logout
      headerRight.innerHTML = `
        Hi, ${display} 👋 
        <button class="blk-btn" id="logout-btn">Logout</button>
      `;

      // wire logout
      document.getElementById("logout-btn")?.addEventListener("click", async () => {
        const out = await fetch("/logout", { credentials: "include" });
        if (out.ok) location.reload();
      });
    } else {
      // user not logged in — keep the Login button working
      document.getElementById("open-login-popup-btn")?.addEventListener("click", () => {
        // minimal popup open helper if you don't already have one
        const pop = document.getElementById("popup-login");
        const ovl = document.getElementById("popup-overlay");
        if (pop) pop.style.display = "block";
        if (ovl) ovl.style.display = "block";
        document.body.classList.add("popup-open");
      });
    }
  } catch (err) {
    console.error("[auth] /check-login failed:", err);
  }
})();

/////////////////////////////////////////////////////
      //Business Dropdown
      // === Load my Businesses into #business-dropdown (server clamps by session) ===
async function loadUserBusinesses() {
  const dd = document.getElementById("business-dropdown");
  if (!dd) return;

  // Reset
  dd.innerHTML = `
    <option value="">-- Choose Business --</option>
    <option value="all">🧾 All Businesses</option>
  `;

  try {
    // (Optional) log who we are
    const me = await fetch("/check-login", { credentials: "include", cache: "no-store" }).then(r=>r.json()).catch(()=>null);
    console.log("[biz] /check-login:", me);

    // ✅ No WHERE here — your server middleware already clamps to this user
    const qs = new URLSearchParams({
      limit: "1000",
      sort: JSON.stringify({ createdAt: -1 }),
      ts: Date.now().toString()
    });

    const res = await api(`/api/records/Business?${qs}`, {
      credentials: "include",
      cache: "no-store",
      headers: { Accept: "application/json" }
    });

    if (res.status === 401) {
      console.warn("[biz] not logged in");
      return; // leave the defaults
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const rows = await res.json();
    console.log("[biz] rows:", rows?.length, rows);

    const nameOf = (v) =>
      v?.["Business Name"] ?? v?.Name ?? v?.businessName ?? v?.name ?? "(Untitled)";

    const items = (rows || [])
      .filter(r => !r.deletedAt)
      .map(r => ({ id: String(r._id), name: nameOf(r.values || {}) }))
      .sort((a,b) => a.name.localeCompare(b.name));

    for (const { id, name } of items) {
      const opt = document.createElement("option");
      opt.value = id;
      opt.textContent = name;
      dd.appendChild(opt);
    }

    // Restore last selection or default
    const saved = sessionStorage.getItem("appointmentsBusinessId");
    if (saved && dd.querySelector(`option[value="${CSS.escape(saved)}"]`)) {
      dd.value = saved;
    } else if (items.length === 1) {
      dd.value = items[0].id; // auto-select if there’s only one
    } else {
      dd.value = "all";
    }

    // Remember future changes
    if (!dd.dataset.bound) {
      dd.addEventListener("change", () => {
        sessionStorage.setItem("appointmentsBusinessId", dd.value || "");
      });
      dd.dataset.bound = "1";
    }
  } catch (e) {
    console.error("[biz] failed to load businesses:", e);
  }
}

// Run on load
document.addEventListener("DOMContentLoaded", loadUserBusinesses);
window.loadUserBusinesses = loadUserBusinesses;


//////////////////////////////////////////////////
                                //Create Calendar
// --- Weekly calendar skeleton (NO data, NO appointments) ---

// helpers
const $  = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

function startOfWeek(d){
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - x.getDay()); // Sunday
  x.setHours(0,0,0,0);
  return x;
}
function addDays(d, n){ const x = new Date(d); x.setDate(x.getDate()+n); return x; }
function monthLabel(d){
  const end = addDays(d, 6);
  const same = d.getMonth()===end.getMonth() && d.getFullYear()===end.getFullYear();
  const fmt=(dt)=>dt.toLocaleString(undefined,{month:"long",year:"numeric"});
  return same ? fmt(d) : `${d.toLocaleString(undefined,{month:"long"})} – ${fmt(end)}`;
}
function fmt12h(h){
  const ampm = h>=12 ? "PM" : "AM";
  let H = h%12; if (H===0) H=12;
  return `${H}:00 ${ampm}`;
}

function getWeekDates(weekStart){
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}

// helpers assumed: $, $$, startOfWeek, addDays, getWeekDates, monthLabel, fmt12h,
// refreshCalendarAppointments (defined elsewhere in the same file)

document.addEventListener("DOMContentLoaded", () => {
  const hdrMonth    = $("#month-year");
  const weekDatesEl = $$(".day-date");
  const hoursCol    = $(".hour-column");
  const slotsWrap   = $(".time-slots-container");
  const btnPrev     = $("#prev-week");
  const btnNext     = $("#next-week");
  const btnToday    = $("#today-btn");

  const CAL_HEIGHT_PX = 1440; // 24h * 60px

  let weekStart = startOfWeek(new Date());
  let currentWeekDates = [];

  function renderHeader(){
    hdrMonth.textContent = monthLabel(weekStart);
    weekDatesEl.forEach((el) => {
      const idx = Number(el.dataset.day || 0);
      const d = addDays(weekStart, idx);
      el.textContent = d.getDate();
    });
  }

  function buildHourLabels(){
    hoursCol.innerHTML = "";
    for (let h=0; h<24; h++){
      const lab = document.createElement("div");
      lab.className = "hour-label";
      lab.style.height = "60px";
      lab.textContent = fmt12h(h);
      hoursCol.appendChild(lab);
    }
  }

  function buildDayColumns(){
    slotsWrap.innerHTML = "";
    for (let d=0; d<7; d++){
      const col = document.createElement("div");
      col.className = "time-column";
      col.dataset.dayIndex = String(d);
      col.style.height = CAL_HEIGHT_PX + "px";
      col.style.position = "relative";
      for (let i=0; i<96; i++){
        const slot = document.createElement("div");
        slot.className = "time-slot";
        slot.style.height = "15px";
        const quarter = (i % 4) * 15;
        if (quarter === 0)      slot.classList.add("hour-start");
        else if (quarter === 15) slot.classList.add("slot-15");
        else if (quarter === 30) slot.classList.add("slot-30");
        else if (quarter === 45) slot.classList.add("slot-45");
        col.appendChild(slot);
      }
      slotsWrap.appendChild(col);
    }
  }

  // updates the visible week AND paints appointments
  function setWeek(newStart){
    weekStart = startOfWeek(newStart);
    renderHeader();
    buildHourLabels();
    buildDayColumns();
    currentWeekDates = getWeekDates(weekStart);      // [Sun..Sat] LOCAL
    window.currentWeekDates = currentWeekDates;      // expose
    refreshCalendarAppointments(currentWeekDates);   // paint
  }

  // initial paint FIRST (so currentWeekDates is defined)
  setWeek(weekStart);

  // expose the painter AFTER setWeek
  window.refreshCalendarAppointments = refreshCalendarAppointments;

  // single set of listeners (no duplicates)
  const repaint = () => window.refreshCalendarAppointments?.(window.currentWeekDates || []);

  document.getElementById("business-dropdown")?.addEventListener("change", repaint);
  document.getElementById("appointment-business")?.addEventListener("change", repaint);

  btnPrev?.addEventListener("click", () => setWeek(addDays(weekStart, -7)));
  btnNext?.addEventListener("click", () => setWeek(addDays(weekStart,  7)));
  btnToday?.addEventListener("click", () => setWeek(new Date()));
});


///////////////////////////////////////Popups
//New Client Popup

// === Open / Close "Create Client" popup (minimal) ===
function openClientPopup() {
  const pop = document.getElementById("popup-create-client");
  const ovl = document.getElementById("popup-overlay"); // optional overlay div
  if (!pop) return;

  // reset the form so old input doesn't linger
  const form = document.getElementById("create-client-form");
  if (form && typeof form.reset === "function") form.reset();

  pop.style.display = "block";
  if (ovl) ovl.style.display = "block";
  document.body.classList.add("popup-open");

  // focus first input if present
  const first = document.getElementById("client-name");
  if (first) first.focus();
}

function closeClientPopup() {
  const pop = document.getElementById("popup-create-client");
  const ovl = document.getElementById("popup-overlay");
  if (!pop) return;

  pop.style.display = "none";
  if (ovl) ovl.style.display = "none";
  document.body.classList.remove("popup-open");
}

// expose for inline handlers like onclick="closeClientPopup()"
window.openClientPopup  = openClientPopup;
window.closeClientPopup = closeClientPopup;

// optional: close on overlay click or ESC
document.addEventListener("DOMContentLoaded", () => {
  const ovl = document.getElementById("popup-overlay");
  if (ovl && !ovl.dataset.bound) {
    ovl.addEventListener("click", closeClientPopup);
    ovl.dataset.bound = "1";
  }
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeClientPopup();
  });
});
// === Load user's businesses into "Add Client" popup dropdown ===
async function loadClientBusinessDropdown() {
  const dd = document.getElementById("client-business");
  if (!dd) return;

  // reset first
  dd.innerHTML = `<option value="">-- Choose Business --</option>`;

  try {
  const res = await api(`/api/records/Business?limit=1000&ts=${Date.now()}`, {
      credentials: "include",
      cache: "no-store",
      headers: { Accept: "application/json" }
    });

    if (!res.ok) return;
    const rows = await res.json();

    const nameOf = (v) =>
      v?.["Business Name"] ??
      v?.Name ??
      v?.businessName ??
      v?.name ??
      "(Untitled)";

    const items = (rows || [])
      .filter(r => !r.deletedAt)
      .map(r => ({
        id: String(r._id),
        name: nameOf(r.values || {})
      }))
      .sort((a,b) => a.name.localeCompare(b.name));

    for (const { id, name } of items) {
      const opt = document.createElement("option");
      opt.value = id;
      opt.textContent = name;
      dd.appendChild(opt);
    }
  } catch (err) {
    console.error("[client business dropdown] load error:", err);
  }
}

// ✅ When opening the Add Client popup, load businesses
window.openClientPopup = function() {
  const pop = document.getElementById("popup-create-client");
  const ovl = document.getElementById("popup-overlay");

  // reset form
  const form = document.getElementById("create-client-form");
  if (form && typeof form.reset === "function") form.reset();

  pop.style.display = "block";
  if (ovl) ovl.style.display = "block";
  document.body.classList.add("popup-open");

  // load the business choices
  loadClientBusinessDropdown();
};

//showAddClientSection
function showAddClientSection() {
  // close the Clients list popup
  const listPop = document.getElementById("popup-view-clients");
  if (listPop) listPop.style.display = "none";

  // open the Add New Client popup (this already loads the business dropdown)
  if (typeof openClientPopup === "function") openClientPopup();

  // (optional) preselect the currently chosen business
  const src = document.getElementById("business-dropdown") || document.getElementById("appointment-business");
  const dst = document.getElementById("client-business");
  if (src && dst) {
    const val = src.value || "";
    const opt = dst.querySelector(`option[value="${CSS.escape(val)}"]`);
    if (opt) dst.value = val;
  }
}

// make it callable from inline HTML
window.showAddClientSection = showAddClientSection;

//Save Client 
// === Save Client (Add New Client popup) ===
document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("create-client-form");
  if (!form || form.dataset.bound) return;

  form.addEventListener("submit", onCreateClientSubmit);
  form.dataset.bound = "1";
});

async function onCreateClientSubmit(e) {
  e.preventDefault();

  // Button UX (works in modern browsers; falls back if undefined)
  const btn = e.submitter || document.querySelector("#create-client-form button[type=submit]");
  if (btn) { btn.disabled = true; btn.textContent = "Saving..."; }

  try {
    // Required fields
    const businessId = document.getElementById("client-business")?.value || "";
    const firstName  = document.getElementById("client-name")?.value?.trim() || "";
    const lastName   = document.getElementById("client-last-name")?.value?.trim() || "";
    const email      = document.getElementById("client-email")?.value?.trim() || "";
    const phone      = document.getElementById("client-phone")?.value?.trim() || "";

    if (!businessId) throw new Error("Please choose a business before saving.");

    // Current user (Pro) from your header bootstrap
    const proUserId = window.STATE?.userId || null;

    // Payload supports both flexible 'values' and top-level fields (to match either schema)
    const recordPayload = {
      Business: businessId,
      Pro: proUserId,
      values: {
        "Business": businessId,
        "Pro": proUserId,
        "First Name": firstName,
        "Last Name": lastName,
        "Email": email,
        "Phone": phone
      }
    };

    // Try POST /api/records/Client first; if 404, fall back to /api/records with dataType
   let res = await api("/api/records/Client", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      credentials: "include",
      body: JSON.stringify(recordPayload)
    });

    if (res.status === 404) {
     res = await api("/api/records", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        credentials: "include",
        body: JSON.stringify({ dataType: "Client", ...recordPayload })
      });
    }

    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`Save failed (${res.status}): ${txt.slice(0, 200)}`);
    }

    const saved = await res.json();
    try {
  const bizSel = document.getElementById("appointment-business");
  const clientSel = document.getElementById("appointment-client");

  const bizId = bizSel?.value || "";
  const label = c_labelFromClient(saved?.values || {});

  // reload the dropdown for the currently selected business
  await loadClientsForSelectedBusiness(bizId, {
    selectClientId: String(saved?._id || ""),
    preselectLabel: label
  });

  // (optional) focus the client select so it’s obvious
  clientSel?.focus();
} catch {}

    console.log("[client] saved", saved);

    // Clean up UI
    const form = document.getElementById("create-client-form");
    if (form && typeof form.reset === "function") form.reset();
    if (typeof closeClientPopup === "function") closeClientPopup();

    // TODO: If you maintain a client list or dropdown elsewhere, refresh it here.
    // e.g., reloadClientsForBusiness(businessId);

  } catch (err) {
    alert(err?.message || "Failed to save client.");
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = "Save Client"; }
  }
}


//////////////////////////////////////////
//All Client Popup Client List
// === View Clients Popup: open / close ===
let CLIENTS_LOAD_TOKEN = 0; // cancels stale renders

function openClientListPopup() {
  const popup   = document.getElementById("popup-view-clients");
  const overlay = document.getElementById("popup-overlay");
  if (!popup || !overlay) return;

  // hard reset UI every time
  resetClientPopupUI();

  // open + scroll to top
  popup.style.display   = "block";
  overlay.style.display = "block";
  document.body.classList.add("popup-open");
  popup.scrollTop = 0;

  // show a loading placeholder
  const list = document.getElementById("client-list-container");
  if (list) list.innerHTML = `<div style="padding:8px;color:#666;">Loading clients…</div>`;

  // kick off fresh load; protect against late responses
  const token = ++CLIENTS_LOAD_TOKEN;
  (async () => {
    try {
      await loadAllClientsAtoZ();                 // your existing loader
      if (token !== CLIENTS_LOAD_TOKEN) return;   // stale response? bail
    } catch (e) {
      if (list) list.innerHTML = `<div style="padding:8px;color:#b00;">Failed to load clients.</div>`;
      console.error(e);
    }
  })();
}

//Reset All Client list popup 
function resetClientPopupUI() {
  // sections
  const list   = document.getElementById("client-list-container");
  const detail = document.getElementById("client-detail-section");
  const inline = document.getElementById("inline-add-client-section");
  const qform  = document.getElementById("client-quick-edit-form");

  // clear globals / state
  window.CURRENT_CLIENT_ID = "";
  window.CLIENTS_BY_ID = Object.create(null);

  // hide detail + inline editor, show list
  if (detail) detail.style.display = "none";
  if (inline) inline.style.display = "none";
  if (list) {
    list.style.display = "block";
    list.innerHTML = "";                 // wipe previous render
  }

  // clear quick-edit form state
  if (qform) {
    qform.style.display = "none";
    qform.dataset.clientId = "";
    qform.reset?.();
  }

  // clear any search / filter UI if you have them
  const search = document.getElementById("clients-search");
  if (search) search.value = "";

  const showAll = document.getElementById("clients-show-all");
  if (showAll) showAll.checked = false;
}

document.addEventListener("DOMContentLoaded", () => {
  const detail = document.getElementById("client-detail-section");
  if (!detail || detail.dataset.delegated) return;

  detail.addEventListener("click", (e) => {
    const t = e.target;
    if (!(t instanceof Element)) return;

    if (t.id === "btn-client-edit") {
      console.log("[client-detail] delegated handler → Edit");
      openClientQuickEdit();
    } else if (t.id === "btn-client-add-appt") {
      console.log("[client-detail] delegated handler → Add Appt");
      // call the same add-appointment code or just click the button programmatically
    } else if (t.id === "btn-client-delete") {
      console.log("[client-detail] delegated handler → Delete");
      // call the same delete logic or just click the button programmatically
    }
  });

  detail.dataset.delegated = "1";
});


//Show Client Detail 
// Keep the selected client id handy
window.CURRENT_CLIENT_ID = null;

// Call this when a client in the list is clicked
function openClientDetail(rec){
  const v  = rec?.values || {};
  const id = String(rec?._id || rec?.id || v._id || "");
  window.CURRENT_CLIENT_ID = id;

  const full = (() => {
    const fn = (v["First Name"] || v.firstName || "").trim();
    const ln = (v["Last Name"]  || v.lastName  || "").trim();
    return [fn, ln].filter(Boolean).join(" ").trim() || v["Full Name"] || v.Name || "(Client)";
  })();

  // email (your old line is fine, but you can make it tolerant too)
  const email = getFirst(v, ["Email", "email", "Email Address"]);

  // ✅ phone from any common key
  const phone = getFirst(v, ["Phone", "Phone Number", "Phone #", "PhoneNumber", "Mobile", "Cell", "phone"]);

  document.getElementById("detail-name").textContent  = full;
  document.getElementById("detail-email").textContent = email || "—";
document.getElementById("detail-phone").textContent =
  getFirst(v, ["Phone", "Phone Number", "Phone #", "PhoneNumber", "Mobile", "Cell", "phone"]) || "—";


  const detail = document.getElementById("client-detail-section");
  detail.dataset.clientId = id; // fallback

  detail.style.display = "block";
  document.getElementById("client-list-container").style.display = "none";

  wireClientDetailButtons();
}


function backToClientList(){
  document.getElementById("client-detail-section").style.display = "none";
  document.getElementById("client-list-container").style.display = "block";
}

// One-time button wiring
// One-time button wiring (with logs + resilient guard)
function wireClientDetailButtons() {
  const addBtn  = document.getElementById("btn-client-add-appt");
  const editBtn = document.getElementById("btn-client-edit");
  const delBtn  = document.getElementById("btn-client-delete");

  if (!addBtn || !editBtn || !delBtn) {
    console.warn("[client-detail] missing buttons:", { addBtn: !!addBtn, editBtn: !!editBtn, delBtn: !!delBtn });
    return;
  }

  // if already wired, skip
  if (addBtn.dataset.bound === "1" && editBtn.dataset.bound === "1" && delBtn.dataset.bound === "1") {
    return;
  }

  console.log("[client-detail] wiring buttons…");

  // Add Appointment
// Add Appointment
// Add Appointment (preselect the client you were viewing)
addBtn.addEventListener("click", async () => {
  const clientId = String(window.CURRENT_CLIENT_ID || "");
  if (!clientId) return;

  // 1) Open the appointment popup
  await window.openAppointmentPopup?.({ title: "Add Appointment" });

  // 2) Close the Clients popup (optional, keeps overlay)
  if (typeof closeClientListPopup === "function") closeClientListPopup();

  // 3) Try to figure out the client's Business to auto-pick it
  //    Prefer the record we just used in the list; fall back to a fetch.
  let rec = (window.CLIENTS_BY_ID && window.CLIENTS_BY_ID[clientId]) || null;
  if (!rec && typeof fetchClientById === "function") {
    try { rec = await fetchClientById(clientId); } catch {}
  }
  const v = (rec && rec.values) || {};
  const asId = window.asId || ((x)=> (typeof x==="string"?x:String(x&&(x._id||x.id)||"")));
  const bizId =
    asId(v.Business) ||
    asId(v["Business"]) ||
    String(v.businessId || v["Business Id"] || "");

  // 4) If we know their business, set the Business dropdown first
  const bizSel = document.getElementById("appointment-business");
  if (bizSel && bizId && bizId !== "all") {
    // set value if option exists, else leave current selection
    if (bizSel.querySelector(`option[value="${CSS.escape(bizId)}"]`)) {
      bizSel.value = bizId;
      // if your code listens to "change" to load services/clients, fire it:
      bizSel.dispatchEvent(new Event("change"));
    }
  }

  // 5) Load clients for the (possibly newly selected) business,
  //    and preselect THIS client.
  const effectiveBizId = (bizSel?.value || "");
  if (typeof loadClientsForSelectedBusiness === "function") {
    await loadClientsForSelectedBusiness(effectiveBizId, {
      selectClientId: clientId,
      // nice label in case the option doesn't exist yet
      preselectLabel: (() => {
        const fn = (v["First Name"] || v.firstName || "").trim();
        const ln = (v["Last Name"]  || v.lastName  || "").trim();
        return [fn, ln].filter(Boolean).join(" ").trim() ||
               v["Client Name"] || v.Name || v.email || "(Client)";
      })(),
    });
  }

  // 6) If for any reason it still didn’t set, force it
  const clientSel = document.getElementById("appointment-client");
  if (clientSel) {
    let opt = clientSel.querySelector(`option[value="${CSS.escape(clientId)}"]`);
    if (!opt) {
      opt = document.createElement("option");
      opt.value = clientId;
      opt.textContent = (v && (v["First Name"] || v.firstName || "")) + " " + (v && (v["Last Name"] || v.lastName || ""));
      clientSel.appendChild(opt);
    }
    clientSel.value = clientId;
    clientSel.focus();
  }
});


  // Edit Client → open quick edit
  editBtn.addEventListener("click", () => {
    console.log("[client-detail] Edit Client clicked. CURRENT_CLIENT_ID =", window.CURRENT_CLIENT_ID);
    openClientQuickEdit();
  });

  // Delete Client
// Delete Client  → soft hide for THIS pro
delBtn.addEventListener("click", async () => {
  const cid = window.CURRENT_CLIENT_ID || "";
  if (!cid) return;

  if (!confirm("Remove this client?")) return;

  try {
    // fetch fresh record
    const rec = await fetchClientById(cid);
    if (!rec) throw new Error("Could not load client.");

    const me = String(window.STATE?.userId || "");
    if (!me) throw new Error("Not logged in.");

    // merge me into values.HiddenFor (tolerate existing shapes)
    const curr = rec.values?.HiddenFor;
    const set  = new Set(
      Array.isArray(curr)
        ? curr.map(String)
        : typeof curr === "string"
          ? curr.split(",").map(s => s.trim()).filter(Boolean)
          : []
    );
    set.add(me);

    const payload = { values: { ...rec.values, HiddenFor: Array.from(set) } };

    // PATCH typed → fallback generic PUT
    let res = await api(`/api/records/Client/${encodeURIComponent(cid)}`, {
      method: "PATCH",
      headers: { "Content-Type":"application/json" },
      body: JSON.stringify(payload),
    });
    if (res.status === 404 || res.status === 405) {
      res = await api(`/api/records`, {
        method: "PUT",
        headers: { "Content-Type":"application/json" },
        body: JSON.stringify({ dataType:"Client", _id: cid, ...payload }),
      });
    }
    if (!res.ok) {
      const t = await res.text().catch(()=> "");
      throw new Error(`Hide failed (${res.status}): ${t.slice(0,200)}`);
    }

    // (Optional) remove the DOM node immediately for snappy UX
    const box  = document.getElementById("client-list-container");
    const node = box?.querySelector(`.clickable-client[data-id="${CSS.escape(String(cid))}"]`);
    if (node) node.remove();

    // Reload list to stay consistent, then go back to list view
    if (typeof loadAllClientsAtoZ === "function") await loadAllClientsAtoZ();
    backToClientList();

    alert("Client Removed");
  } catch (err) {
    alert(err?.message || "Could not hide this client.");
  }
});

  addBtn.dataset.bound  = "1";
  editBtn.dataset.bound = "1";
  delBtn.dataset.bound  = "1";
}


/* ---- Simple editor using your inline add-client section ---- */
async function fetchClientById(id){
    console.log("[clients] fetchClientById start:", id);
  let r = await api(`/api/records/Client/${encodeURIComponent(id)}`, { headers:{Accept:"application/json"} });
  if (r.ok) return await r.json().catch(()=>null);

  // fallback generic
  r = await api(`/api/records/${encodeURIComponent(id)}?dataType=Client`, { headers:{Accept:"application/json"} });
  if (r.ok) return await r.json().catch(()=>null);

  // fallback WHERE
  try{
    const q = new URLSearchParams({ where: JSON.stringify({ $or:[{_id:id},{"values._id":id}] }), limit:"1" });
    r = await api(`/api/records/Client?${q}`);
    if (r.ok){
      const arr = await r.json().catch(()=>[]);
      return Array.isArray(arr)?arr[0]:(arr.items||arr.data||[])[0]||null;
    }
  }catch{}
    console.log("[clients] fetchClientById done");
  return null;
}

async function openClientEditor(clientId){
  const rec = await fetchClientById(clientId);
  if (!rec) return alert("Could not load client.");
  const v = rec.values || {};

  // show inline add-client as editor
  document.getElementById("inline-add-client-section").style.display = "block";
  (document.getElementById("inline-client-first-name")||{}).value = v["First Name"]||v.firstName||"";
  (document.getElementById("inline-client-last-name") ||{}).value = v["Last Name"] ||v.lastName ||"";
  (document.getElementById("inline-client-email")     ||{}).value = v.Email||v.email||"";
  (document.getElementById("inline-client-phone")     ||{}).value = v.Phone||v.phone||"";

  // mark edit mode on the Save button (your submit handler can branch on this)
  const saveBtn = document.querySelector("#inline-add-client-form .orange-sign-up");
  if (saveBtn){
    saveBtn.textContent = "Save Changes";
    saveBtn.dataset.mode = "edit";
    saveBtn.dataset.clientId = String(rec._id || "");
  }
}

//Edit client Details
// helpers to show/hide two modes inside the detail section
function _showDetailReadMode(show){
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.style.display = v; };
  set("detail-name",  show ? "" : "none");
  set("detail-email", show ? "" : "none");
  set("detail-phone", show ? "" : "none");
  const actions = document.querySelector(".client-detail-actions");
  if (actions) actions.style.display = show ? "flex" : "none";
}


// open quick edit using CURRENT_CLIENT_ID (set by openClientDetail)
async function openClientQuickEdit() {
  console.log("[clients] openClientQuickEdit()");
  let cid = window.CURRENT_CLIENT_ID || "";
  if (!cid) {
    // fallback: read from the detail section
    const detail = document.getElementById("client-detail-section");
    cid = detail?.dataset?.clientId || "";
  }
  if (!cid) { console.warn("[clients] no CURRENT_CLIENT_ID (still)"); return; }

  console.log("[clients] fetching client", cid);
  const rec = await fetchClientById(cid);
  if (!rec) { console.error("[clients] fetchClientById returned null"); return alert("Could not load client."); }

  const v = rec.values || {};
  (document.getElementById("qe-first") || {}).value = (v["First Name"] || v.firstName || "").trim();
  (document.getElementById("qe-last")  || {}).value = (v["Last Name"]  || v.lastName  || "").trim();
  (document.getElementById("qe-email") || {}).value = (v.Email        || v.email     || "").trim();
(document.getElementById("qe-phone") || {}).value =
  getFirst(v, ["Phone", "Phone Number", "Phone #", "PhoneNumber", "Mobile", "Cell", "phone"]);


  const form = document.getElementById("client-quick-edit-form");
  if (form) {
    form.style.display = "block";
    form.dataset.clientId = String(rec._id || "");
  }
  _showDetailReadMode(false);
}
window.openClientQuickEdit = openClientQuickEdit; // handy for console testing


// leave edit without saving
function closeClientQuickEdit(){
  const form = document.getElementById("client-quick-edit-form");
  form.style.display = "none";
  form.dataset.clientId = "";
  _showDetailReadMode(true);
}

// one-time listeners
(function wireQuickEditOnce(){
  const form = document.getElementById("client-quick-edit-form");
  if (!form || form.dataset.bound) return;

  // submit/save
  form.addEventListener("submit", async (e)=>{
    e.preventDefault();
    const cid = form.dataset.clientId || "";
    if (!cid) return;

  const first = (document.getElementById("qe-first")?.value || "").trim();
const last  = (document.getElementById("qe-last") ?.value || "").trim();
const email = (document.getElementById("qe-email")?.value || "").trim();
const phone = (document.getElementById("qe-phone")?.value || "").trim();

// get the current record to see which phone key it used
const existing = await fetchClientById(cid);
const vExisting = existing?.values || {};
const phoneKey = detectPhoneKey(vExisting);   // e.g., "Phone Number" or "Phone"
    // disable while saving
    const btn = form.querySelector('button[type="submit"]');
    const old = btn?.textContent;
    if (btn){ btn.disabled = true; btn.textContent = "Saving…"; }

    try{
      // build flexible payload (top-level + values)
  const payload = {
  values: {
    "First Name": first,
    "Last Name":  last,
    Email:        email,
    [phoneKey]:   phone,
  }
};
      // PATCH typed → fallback generic PUT
      let res = await api(`/api/records/Client/${encodeURIComponent(cid)}`, {
        method: "PATCH",
        headers: { "Content-Type":"application/json" },
        body: JSON.stringify(payload)
      });
      if (res.status === 404 || res.status === 405){
        res = await api(`/api/records`, {
          method: "PUT",
          headers: { "Content-Type":"application/json" },
          body: JSON.stringify({ dataType:"Client", _id: cid, ...payload })
        });
      }
      if (!res.ok){
        const txt = await res.text().catch(()=> "");
        throw new Error(`Save failed (${res.status}): ${txt.slice(0,200)}`);
      }

      const saved = await res.json().catch(()=>null);
      const v = saved?.values || {};

      // update read-mode fields
      document.getElementById("detail-name").textContent =
        [v["First Name"]||"", v["Last Name"]||""].filter(Boolean).join(" ").trim() ||
        v["Full Name"] || v.Name || "(Client)";
      document.getElementById("detail-email").textContent = v.Email || "—";
   document.getElementById("detail-phone").textContent =
  getFirst(v, ["Phone", "Phone Number", "Phone #", "PhoneNumber", "Mobile", "Cell", "phone"]) || "—";


      // refresh list (if you have a function)
      if (typeof loadAllClients === "function") { try{ await loadAllClients(); }catch{} }

      // exit edit
      closeClientQuickEdit();
    }catch(err){
      alert(err?.message || "Save failed.");
    }finally{
      if (btn){ btn.disabled = false; btn.textContent = old || "Save Changes"; }
    }
  });

  // cancel
  document.getElementById("qe-cancel")?.addEventListener("click", closeClientQuickEdit);

  form.dataset.bound = "1";
})();



function closeClientListPopup() {
  const popup   = document.getElementById("popup-view-clients");
  const overlay = document.getElementById("popup-overlay");
  if (!popup || !overlay) return;

  popup.style.display = "none";

  const anyOpen = document.querySelector(".popup-add-business[style*='display: block']");
  if (!anyOpen) {
    overlay.style.display = "none";
    document.body.classList.remove("popup-open");
  }

  // optional: reset so next open is fresh even if load is cancelled
  resetClientPopupUI();
}





// Optional: close when clicking overlay or pressing ESC
document.addEventListener("DOMContentLoaded", () => {
  const overlay = document.getElementById("popup-overlay");
  if (overlay && !overlay.dataset.clientsBound) {
    overlay.addEventListener("click", () => {
      // try to close the clients popup; safe if it's not open
      closeClientListPopup();
    });
    overlay.dataset.clientsBound = "1";
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeClientListPopup();
  });
});

// Expose for inline HTML handlers
window.openClientListPopup  = openClientListPopup;
window.closeClientListPopup = closeClientListPopup;

// ===== Clients A–Z loader (created by me OR booked with my businesses) =====

// Small helpers

const fullName = (c) => {
  const v = c.values || {};
  return (
    v["Full Name"] ||
    [v.First || v["First Name"] || "", v.Last || v["Last Name"] || ""]
      .filter(Boolean)
      .join(" ").trim() ||
    v.Name ||
    c.name ||
    "(Unnamed)"
  );
};
const byName = (a, b) => fullName(a).localeCompare(fullName(b));

/** Fetch clients created by the current user (server clamps by session) */
/** Fetch clients created by the current user (server clamps by session) */
async function fetchClientsICreated() {
  try {
    const qs = new URLSearchParams({
      limit: "1000",
      sort: JSON.stringify({ "values.First": 1, "values.Last": 1 }),
      includeRefField: "1",
      ts: Date.now().toString(),
    });

    const res = await api(`/api/records/Client?${qs.toString()}`);
    if (!res.ok) return [];

    const data = await res.json().catch(() => []);
    const list = Array.isArray(data) ? data : (data.items || data.data || []);
    // 🔽 filter out clients you've hidden
    return list.filter(c => !isHiddenForMe(c));
  } catch {
    return [];
  }
}


/** Pull any clients referenced by appointments for my businesses */
// helper if you don’t already have it in this file
const asId = (x) => (typeof x === "string" ? x : (x && (x._id || x.id)) ? String(x._id || x.id) : "");

/** Pull any clients referenced by appointments for my businesses */
async function fetchClientsViaAppointments(myBizIds) {
  if (!myBizIds?.length) return [];

  // appointments where Business matches any of myBizIds
  const where = {
    $or: [
      { "Business":              { $in: myBizIds } },
      { "Business._id":          { $in: myBizIds } },
      { "values.Business":       { $in: myBizIds } },
      { "values.Business._id":   { $in: myBizIds } },
      { "values['Business Id']": { $in: myBizIds } },
      { "values.businessId":     { $in: myBizIds } },
    ]
  };

  const qs = new URLSearchParams({
    where: JSON.stringify(where),
    limit: "2000",
    sort: JSON.stringify({ createdAt: -1 }),
    includeRefField: "1",
    ts: Date.now().toString()
  });

  // ✅ use api()
  const res = await api(`/api/records/Appointment?${qs.toString()}`);
  if (!res.ok) return [];
  const apptsRaw = await res.json().catch(() => []);
  const appts = Array.isArray(apptsRaw) ? apptsRaw : (apptsRaw.items || apptsRaw.data || []);

  // try embedded clients first
  const embeddedClients = [];
  for (const a of appts) {
    const v = a.values || {};
    const c = v.Client || a.Client || v["Client Ref"] || v["Client Object"] || null;
    if (c && typeof c === "object") embeddedClients.push(c);
  }

  // collect bare client IDs too
  const clientIds = new Set();
  for (const a of appts) {
    const v = a.values || {};
    const id = asId(v.Client) || asId(a.Client) || asId(v["Client Id"]) || asId(v.clientId);
    if (id) clientIds.add(id);
  }

  let fetchedById = [];
  if (clientIds.size) {
    const whereClients = {
      $or: [
        { _id: { $in: Array.from(clientIds) } },
        { "values._id": { $in: Array.from(clientIds) } },
      ]
    };
    const qsClients = new URLSearchParams({
      where: JSON.stringify(whereClients),
      limit: "2000",
      includeRefField: "1",
      ts: Date.now().toString()
    });

    // ✅ use api()
    const rc = await api(`/api/records/Client?${qsClients.toString()}`);
    if (rc.ok) {
      const raw = await rc.json().catch(() => []);
      fetchedById = Array.isArray(raw) ? raw : (raw.items || raw.data || []);
    }
  }

  // dedupe by id
  const byId = new Map();
  for (const c of [...embeddedClients, ...fetchedById]) {
    const id = asId(c);
    if (id && !byId.has(id)) byId.set(id, c);
  }
  return Array.from(byId.values());
}

/** Render into #client-list-container */
/** Render into #client-list-container */
function renderClientList(clients) {
  const box = document.getElementById("client-list-container");
  if (!box) return;

  box.innerHTML = "";

  if (!clients?.length) {
    box.innerHTML = `<p style="color:#666;">No clients yet.</p>`;
    return;
  }

  // A–Z
  clients.sort(byName);

  // 🔑 map: id -> full record (for detail view)
  window.CLIENTS_BY_ID = Object.create(null);

  const frag = document.createDocumentFragment();

  clients.forEach((c) => {
    const id = asId(c);
    if (!id) return;
    window.CLIENTS_BY_ID[id] = c;   // <-- store for later lookups

    const v = c.values || {};
    const name  = fullName(c);
    const email = v.Email || v["Email Address"] || "";
    const phone = v.Phone || v["Phone Number"] || "";

    const item = document.createElement("div");
    item.className = "clickable-client";
    item.dataset.id = id;           // <-- we’ll read this on click

    item.innerHTML = `
      <div style="font-weight:600">${name}</div>
      <div style="font-size:12px;color:#666;">
        ${email || ""}${email && phone ? " • " : ""}${phone || ""}
      </div>
    `;

    frag.appendChild(item);
  });

  box.appendChild(frag);
}


(function wireClientListClicks(){
  const list = document.getElementById("client-list-container");
  if (!list || list.dataset.bound) return;

  list.addEventListener("click", (e) => {
    const row = e.target.closest(".clickable-client");
    if (!row) return;

    const id  = row.dataset.id;
    const rec = window.CLIENTS_BY_ID?.[id];
    if (!id || !rec) {
      console.warn("[clients] clicked but no record found", { id, rec });
      return;
    }

    // This sets window.CURRENT_CLIENT_ID inside
    openClientDetail(rec);
  });

  list.dataset.bound = "1";
})();


// === Helper: fetch IDs of businesses owned by the logged-in user ===
async function getMyBusinessIds() {
  try {
    const qs = new URLSearchParams({
      limit: '1000',
      ts: Date.now().toString(),
    });
    const res = await api(`/api/records/Business?${qs}`, {
      credentials: 'include',
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return [];
    const rows = await res.json();
    return (rows || []).map(r => String(r._id)).filter(Boolean);
  } catch {
    return [];
  }
}

// (optional) expose for other scripts
window.getMyBusinessIds = getMyBusinessIds;

/** Public: load everything and render */
async function loadAllClientsAtoZ() {
  try {
    const myBizIds = await getMyBusinessIds();

    // Parallel fetch: (1) clients I created, (2) clients via appts w/ my businesses
    const [mine, viaAppts] = await Promise.all([
      fetchClientsICreated(),
      fetchClientsViaAppointments(myBizIds),
    ]);

    // Dedupe across the two sources
    const byId = new Map();
    for (const c of [...(mine || []), ...(viaAppts || [])]) {
      const id = asId(c);
      if (id && !byId.has(id)) byId.set(id, c);
    }
    const all = Array.from(byId.values());

    renderClientList(all);
  } catch (err) {
    console.error("[clients] loadAllClientsAtoZ failed:", err);
    renderClientList([]);
  }
}

// Expose if you want to call it from inline HTML or from openClientListPopup
window.loadAllClientsAtoZ = loadAllClientsAtoZ;



//////////////////
//new appointment popup 

// === Load user's Businesses into #appointment-business ===
async function loadAppointmentBusinessDropdown() {
  const dd = document.getElementById("appointment-business");
  if (!dd) return;

  // Reset base option
  dd.innerHTML = `<option value="">-- Select Business --</option>`;

  try {
    const qs = new URLSearchParams({
      limit: "1000",
      sort: JSON.stringify({ createdAt: -1 }),
      ts: Date.now().toString(),
    });

    const res = await api(`/api/records/Business?${qs}`, {
      credentials: "include",
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return;

    const rows = await res.json();
    const nameOf = (v) =>
      v?.["Business Name"] ?? v?.Name ?? v?.businessName ?? v?.name ?? "(Untitled)";

    const items = (rows || [])
      .filter(r => !r.deletedAt)
      .map(r => ({ id: String(r._id), name: nameOf(r.values || {}) }))
      .sort((a, b) => a.name.localeCompare(b.name));

    for (const { id, name } of items) {
      const opt = document.createElement("option");
      opt.value = id;
      opt.textContent = name;
      dd.appendChild(opt);
    }

    // Restore last picked business or auto-pick if there's only one
    const saved = sessionStorage.getItem("appointmentBusinessId");
    if (saved && dd.querySelector(`option[value="${CSS.escape(saved)}"]`)) {
      dd.value = saved;
    } else if (items.length === 1) {
      dd.value = items[0].id;
    }

    // Remember future changes (bind once)
    if (!dd.dataset.bound) {
      dd.addEventListener("change", () => {
        sessionStorage.setItem("appointmentBusinessId", dd.value || "");
      });
      dd.dataset.bound = "1";
    }
  } catch (err) {
    console.error("[appointment-business] load error:", err);
  }
}

// Load on page ready
document.addEventListener("DOMContentLoaded", loadAppointmentBusinessDropdown);

// (optional) also refresh whenever you open the appointment popup
// if you used the openAppointmentPopup() from earlier:
const _openAppt = window.openAppointmentPopup;
window.openAppointmentPopup = function(opts = {}) {
  loadAppointmentBusinessDropdown();
  wireServiceDropdown();
  _openAppt ? _openAppt(opts) : null;
};

// ===== Service dropdown stays disabled until Business is chosen =====
document.addEventListener("DOMContentLoaded", () => {
  const bizDD  = document.getElementById("appointment-business");
  const svcDD  = document.getElementById("appointment-service");
  if (!bizDD || !svcDD) return;

  // start disabled + cleared
  resetServiceDD();

  // when Business changes, (re)load services or disable if none
  if (!bizDD.dataset.bound) {
    bizDD.addEventListener("change", async () => {
      const bizId = bizDD.value || "";
      if (!bizId) {
        resetServiceDD();             // no business → keep disabled
        return;
      }
     await loadServicesForSelectedBusiness(); // ✅ this is the function you defined
 
    });
    bizDD.dataset.bound = "1";
  }
  
  function resetServiceDD() {
    svcDD.innerHTML = `<option value="">-- Select Service --</option>`;
    svcDD.disabled = true;
  }
});

// Fetch + populate services for a specific business
// ==== Service dropdown loader (robust Business matching) ====

const SVC_DD_ID = "appointment-service";
const BIZ_DD_ID = "appointment-business";

function disableServiceDD(msg="-- Select Service --") {
  const dd = document.getElementById(SVC_DD_ID);
  if (!dd) return;
  dd.innerHTML = `<option value="">${msg}</option>`;
  dd.disabled = true;
}

function enableServiceDD() {
  const dd = document.getElementById(SVC_DD_ID);
  if (!dd) return;
  dd.disabled = false;
}


function serviceNameOf(row){
  const v = row?.values || {};
  // try your fields first, then fallbacks
  return (
    v.serviceName ||             // ✅ your schema
    v.name ||                    // ✅ many of your records have this too
    v.Name ||
    v["Service Name"] ||
    row?.name ||
    row?.title ||
    "(Untitled Service)"
  );
}



// Single responsibility: get Services that belong to a Business.
// 1) Try direct Business refs on Service
// 2) If none, find Calendars for the Business, then match Services by those Calendar refs
// Keep THIS once (delete any duplicate definitions)
function idOf(x){
  if (!x) return "";
  if (typeof x === "string") return x;
  return String(x._id || x.id || "");
}

function vget(v, ...keys) {
  for (const k of keys) if (v && v[k] != null && v[k] !== '') return v[k];
  return undefined;
}

// Fill the <select> with options
function fillServiceSelect(dropdown, rows) {
  dropdown.innerHTML = `<option value="">-- Select Service --</option>`;
  let count = 0;

  rows.forEach(row => {
    const v = row.values || {};
    const name =
      vget(v, 'Service Name', 'Name', 'serviceName') || '(Unnamed Service)';
    const durationRaw = vget(v, 'duration', 'Duration', 'Duration (minutes)');
    const calRaw      = v['Calendar'] ?? v['calendarId'];

    const opt = document.createElement('option');
    opt.value = row._id;
    opt.textContent = name;

    const dur = Number(durationRaw);
    if (Number.isFinite(dur) && dur > 0) opt.dataset.duration = String(dur);

    const calId = refId(calRaw);
    if (calId) opt.dataset.calendarId = calId;

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


function refId(x) {
  if (!x) return "";
  if (typeof x === "string") return x;
  if (typeof x === "object") return String(x._id || x.id || "");
  return "";
}

function sameBusiness(values = {}, bizId) {
  if (!bizId || bizId === "all") return false;
  const b =
    values.Business ??
    values["Business"] ??
    values.businessId ??
    values["Business Id"] ??
    values.Biz ??
    values.biz;
  return String(refId(b)) === String(bizId);
}

// 👇 MINIMAL: Services filtered by *Business only* (no calendar fallback)
// ---- helpers ----

function svcName(row){
  const v=row?.values||{};
  return v.serviceName || v.name || v["Service Name"] || v["Name"] || "(Unnamed Service)";
}
 function calIdFrom(values = {}) {
   const c = values.Calendar ?? values.calendarId ?? values["Calendar Id"];
   return window.asId(c);
 }

// ---- SERVER-FIRST, with safe fallbacks ----
async function fetchServicesForBusiness(bizId){
  if (!bizId || bizId==="all") return [];

  const tryFetch = async (type, whereObj) => {
    const qs = new URLSearchParams({
      where: JSON.stringify(whereObj || {}),
      limit: "2000",
      includeRefField: "1",
      ts: Date.now().toString()
    });
    const r = await fetch(`/api/records/${encodeURIComponent(type)}?${qs}`, {
      credentials: "include",
      cache: "no-store",
      headers: { Accept: "application/json" }
    });
    if (!r.ok) return [];
    const data = await r.json();
    return Array.isArray(data) ? data : [];
  };

  // 1) Direct Services that reference this Business
  const whereSvcByBiz = {
    $or: [
      { "Business": bizId },
      { "Business._id": bizId },
      { "values.Business": bizId },
      { "values.Business._id": bizId }
    ]
  };
  let services = await tryFetch("Service", whereSvcByBiz);
  if (services.length) return services;

  // 2) Find Calendars for this Business, then Services by Calendar
  const whereCal = {
    $or: [
      { "Business": bizId },
      { "Business._id": bizId },
      { "values.Business": bizId },
      { "values.Business._id": bizId }
    ]
  };
  const calendars = await tryFetch("Calendar", whereCal);
  const calIds = calendars.map(c => asId(c)).filter(Boolean);

  if (calIds.length) {
    const whereSvcByCal = {
      $or: [
        { "Calendar":        { $in: calIds } },
        { "Calendar._id":    { $in: calIds } },
        { "values.Calendar": { $in: calIds } },
        { "values.Calendar._id": { $in: calIds } },
        { "values.calendarId":   { $in: calIds } }
      ]
    };
    services = await tryFetch("Service", whereSvcByCal);
    if (services.length) return services;
  }

  // 3) Final fallback: pull all, filter in the browser
  try {
    const all = await tryFetch("Service", {}); // no where
    const filtered = (all || []).filter(s => {
      const v = s.values || {};
      // match by business on the service…
      const b = v.Business ?? v.businessId ?? v["Business Id"] ?? v.Biz ?? v.biz;
      if (String(asId(b)) === String(bizId)) return true;
      // …or by calendar that belongs to this business
      const calId = calIdFrom(v);
      return calId && calIds.includes(calId);
    });
    return filtered;
  } catch {
    return [];
  }
}
// --- Auto-fill Duration input from selected Service ---
const SVC_SELECT_ID  = "appointment-service";
const DUR_INPUT_ID   = "appointment-duration";

function syncDurationFromService() {
  const svc = document.getElementById(SVC_SELECT_ID);
  const dur = document.getElementById(DUR_INPUT_ID);
  if (!svc || !dur) return;

  const opt = svc.options[svc.selectedIndex];
  if (!opt) return;

  const raw = opt.dataset?.duration;
  const minutes = raw != null ? Number(raw) : NaN;
  if (!Number.isFinite(minutes)) return; // don't touch if service has no duration

  // Respect your input constraints (min=15, step=15)
  const min  = Number(dur.min || 0) || 0;
  const step = Number(dur.step || 1) || 1;

  // Snap to nearest step ≥ min (optional)
  let value = minutes;
  if (value < min) value = min;
  if (step > 1) value = Math.round(value / step) * step;

  dur.value = String(value);
}



// ---- fill the dropdown ----
// ---- fill the dropdown ----
async function loadServicesForSelectedBusiness(bizIdOverride){
  const bizDD = document.getElementById("appointment-business");
  const svcDD = document.getElementById("appointment-service");
  if (!bizDD || !svcDD) return;

  const bizId = String((bizIdOverride ?? bizDD.value) || "");
  if (!bizId || bizId === "all") {
    svcDD.innerHTML = `<option value="">-- Select a business first --</option>`;
    svcDD.disabled = true;
    return;
  }

  // loading state
  svcDD.disabled = true;
  svcDD.innerHTML = `<option value="">Loading services…</option>`;

  const rows = await fetchServicesForBusiness(bizId);

  if (!rows?.length) {
    console.warn("[services] none found for biz:", bizId);
    svcDD.innerHTML = `<option value="">No services for this business</option>`;
    svcDD.disabled = true;
    return;
  }

  // render
  svcDD.innerHTML = `<option value="">-- Select Service --</option>`;
  rows
    .filter(r => !r.deletedAt)
    .sort((a,b)=>svcName(a).localeCompare(svcName(b)))
    .forEach(r=>{
      const v   = r.values || {};
      const opt = document.createElement("option");
      opt.value = asId(r);
      opt.textContent = svcName(r);

      // be generous with key names and coerce to number
      const durRaw =
        v.Duration ??
        v.duration ??
        v["Duration (minutes)"] ??
        v["Duration Minutes"] ??
        v["durationMinutes"] ??
        v["Minutes"];
      const durNum = Number.parseInt(durRaw, 10);
      if (Number.isFinite(durNum) && durNum > 0) {
        opt.dataset.duration = String(durNum);
      }

      const cal = calIdFrom(v);
      if (cal) opt.dataset.calendarId = cal;

      svcDD.appendChild(opt);
    });

  svcDD.disabled = false;

  // 🔗 ensure the duration listener is attached NOW (when the select exists)
  if (!svcDD.dataset.boundDuration) {
    svcDD.addEventListener("change", syncDurationFromService);
    svcDD.dataset.boundDuration = "1";
  }

  // (optional) if there’s only one real service, preselect it
  if (svcDD.options.length === 2 && !svcDD.value) {
    svcDD.selectedIndex = 1;
  }

  // ⏱️ fill the duration immediately for the current selection (or do nothing if none)
  syncDurationFromService();
}


/** Wire the change handler (call once after DOM ready / when popup opens) */
function wireServiceDropdown() {
  const bizDD = document.getElementById(BIZ_DD_ID);
  if (!bizDD) return;

  // initial state
  disableServiceDD("-- Select a business first --");

  // (bind once) when Business changes, refresh Services
  if (!bizDD.dataset.boundServices) {
    bizDD.addEventListener("change", () => loadServicesForSelectedBusiness());
    bizDD.dataset.boundServices = "1";
  }

  // if a business is already selected (e.g., editing), load services now
  if (bizDD.value && bizDD.value !== "all") {
    loadServicesForSelectedBusiness();
  }
}

//Open new Appointment Popup 
/* Ensure a single, final openAppointmentPopup that (1) loads businesses,
   (2) wires the service dropdown, then (3) loads services for the current business. */
window.openAppointmentPopup = async function openAppointmentPopup(opts = {}) {
  const pop = document.getElementById("popup-create-appointment");
  const ovl = document.getElementById("popup-overlay");
  if (!pop) return;

  // optional title
  if (opts.title) {
    const titleEl = document.getElementById("appointment-popup-title");
    if (titleEl) titleEl.textContent = opts.title;
  }

  // show the popup immediately (then fill)
  pop.style.display = "block";
  if (ovl) ovl.style.display = "block";
  document.body.classList.add("popup-open");

  // 1) make sure the Business dropdown is populated
  await loadAppointmentBusinessDropdown();

  // 2) wire the Service dropdown (binds once; can be called repeatedly)
  wireServiceDropdown();

  // 3) if a business is preselected, load its services now
  const bizDD = document.getElementById(BIZ_DD_ID);
  if (bizDD && bizDD.value && bizDD.value !== "all") {
    await loadServicesForSelectedBusiness(bizDD.value);
  }
};

window.closeAppointmentPopup = function(){
  const pop = document.getElementById("popup-create-appointment");
  const ovl = document.getElementById("popup-overlay");
  if (!pop) return;
  pop.style.display = "none";
  if (ovl) ovl.style.display = "none";
  document.body.classList.remove("popup-open");
};

/* ---------- ADAPTERS so old code keeps working ---------- */
async function loadAppointmentBusinesses() {
  await loadAppointmentBusinessDropdown();
}
let _svcReqId = 0; // cancels older, overlapping calls



function _sameBiz(values, bizId) {
  if (!bizId || bizId === "all") return false;
  const b = values?.Business ?? values?.businessId ?? values?.["Business Id"] ?? values?.Biz ?? values?.biz;
  return String(_asId(b)) === String(bizId);
}

function _svcName(v = {}) {
  // Be generous with field names you’ve used across pages
  return (
    v.serviceName ??
    v.name ??
    v["Service Name"] ??
    v["Name"] ??
    v["service name"] ??
    "(Untitled Service)"
  );
}
async function loadAppointmentServices(businessId) {
  const dropdown = document.getElementById("appointment-service");
  if (!dropdown) return [];

  dropdown.innerHTML = `<option value="">-- Select Service --</option>`;
  dropdown.disabled = true;

  if (!businessId || businessId === "all") {
    dropdown.disabled = false;
    return [];
  }

  try {
    const res = await api(`/api/records/Service?limit=2000&ts=${Date.now()}`, {
      credentials: "include",
      cache: "no-store"
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const all = (await res.json()) || [];

    // ✅ only services whose Business matches the selected business
    const filtered = all.filter(r => sameBusiness(r.values || {}, businessId));

    fillServiceSelect(dropdown, filtered);
  } catch (e) {
    console.warn("[Services] load failed:", e);
  } finally {
    dropdown.disabled = false;
  }
}

//show Clients in new appointment dropdown


function c_labelFromClient(values = {}) {
  const first = (values["First Name"] || values.firstName || "").trim();
  const last  = (values["Last Name"]  || values.lastName  || "").trim();
  const full  = [first, last].filter(Boolean).join(" ").trim();
  return full || (values["Client Name"] || values.Name || values.email || "(Client)");
}

async function c_tryFetch(type, whereObj, limit="2000") {
  const qs = new URLSearchParams({
    where: JSON.stringify(whereObj || {}),
    limit,
    includeRefField: "1",
    ts: Date.now().toString()
  });
  const r = await api(`/api/records/${encodeURIComponent(type)}?${qs}`, {
    credentials: "include",
    cache: "no-store",
    headers: { Accept: "application/json" }
  });
  if (!r.ok) return [];
  const data = await r.json();
  return Array.isArray(data) ? data : [];
}
// Returns a de-duped array of Client records for the Business.
// If none exist directly, we look at Appointments for that Business and
// pull the referenced Clients, then fetch those client records.
// --- helpers for client filtering ---
function c_refId(x){ if(!x) return ""; if(typeof x==="string") return x; return String(x._id||x.id||""); }
function c_hasBusiness(rec, bizId){
  const v = rec?.values || {};
  const hits = [
    rec.Business,                 rec?.Business?._id,
    v.Business,                   v?.Business?._id,
    v["Business"],                v?.["Business"]?._id,
    v.businessId,                 v["Business Id"],
    v.Biz,                        v.biz
  ].map(c_refId);
  return hits.includes(String(bizId));
}

// --- server-first, with browser fallback ---
async function fetchClientsForBusiness(bizId, { includeAll = false } = {}) {
  if (includeAll) return c_tryFetch("Client", {});       // "Show all" mode
  if (!bizId || bizId === "all") return [];

  // 1) Try server-side filtering
  const whereClients = {
    $or: [
      { "Business": bizId },
      { "Business._id": bizId },
      { "values.Business": bizId },
      { "values.Business._id": bizId },
      { "values.businessId": bizId },
      { "values['Business Id']": bizId }
    ]
  };
  let rows = await c_tryFetch("Client", whereClients, "2000");
  if (rows?.length) return rows;

  // 2) Fallback: fetch all, filter client-side by any Business shape
  rows = await c_tryFetch("Client", {}, "2000");
  return (rows || []).filter(r => c_hasBusiness(r, bizId));
}

async function loadClientsForSelectedBusiness(
  bizIdOverride,
  { selectClientId = "", preselectLabel = "" } = {}
) {
  const bizDD = document.getElementById("appointment-business");
  const sel   = document.getElementById("appointment-client");
  const showAllChk = document.getElementById("clients-show-all");
  if (!bizDD || !sel) return;

  const bizId = String((bizIdOverride ?? bizDD.value) || "");
  const includeAll = !!(showAllChk && showAllChk.checked);

  sel.disabled = true;
  sel.innerHTML = `<option value="">Loading clients…</option>`;

  // fetch rows
  let rows = await fetchClientsForBusiness(bizId, { includeAll });

  // render
  sel.innerHTML = `<option value="">-- Select Client --</option>`;
  if (!rows.length) {
    sel.innerHTML = `<option value="">— No clients for this business —</option>`;
    sel.disabled = false;
    return;
  }

  rows
    .filter(r => !r.deletedAt)
    .sort((a, b) => c_labelFromClient(a.values || {}).localeCompare(c_labelFromClient(b.values || {})))
    .forEach(r => {
      const v   = r.values || {};
      const opt = document.createElement("option");   // ← make sure it's **opt**, not copt
      opt.value = c_asId(r);
      opt.textContent = c_labelFromClient(v);
      sel.appendChild(opt);
    });

  // try to preselect the requested client
  if (selectClientId) {
    const wanted = String(selectClientId);
    const exists = !!sel.querySelector(`option[value="${CSS.escape(wanted)}"]`);
    if (exists) {
      sel.value = wanted;
    } else {
      // add a temporary option if it isn't in the list yet
      const tmp = document.createElement("option");
      tmp.value = wanted;
      tmp.textContent = preselectLabel || "(Client)";
      tmp.selected = true;
      sel.appendChild(tmp);
      sel.value = wanted;
    }
  }

  sel.disabled = false;
}


// Bind once: refresh Clients whenever Business changes
(function wireClientsOnce(){
  const bizDD = document.getElementById("appointment-business");
  const showAllChk = document.getElementById("clients-show-all"); // optional
  if (!bizDD) return;

  if (!bizDD.dataset.boundClients) {
    bizDD.addEventListener("change", () => loadClientsForSelectedBusiness());
    bizDD.dataset.boundClients = "1";
  }
  if (showAllChk && !showAllChk.dataset.bound) {
    showAllChk.addEventListener("change", () => loadClientsForSelectedBusiness());
    showAllChk.dataset.bound = "1";
  }
})();
// --- helper: JS-side week filter (no server operators) ---
// --- tiny helper to coerce various API shapes into an array ---
function asArray(x){
  if (Array.isArray(x)) return x;
  if (x && Array.isArray(x.items))   return x.items;
  if (x && Array.isArray(x.data))    return x.data;
  if (x && Array.isArray(x.results)) return x.results;
  if (x && Array.isArray(x.records)) return x.records;
  return [];
}

// --- helper: JS-side week filter (no server operators) ---
function inWeekRange(appt, weekStart, weekEnd) {
  const v = appt?.values || {};

  // prefer explicit YYYY-MM-DD
  let dISO = v.Date || appt.Date || "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dISO)) {
    const iso = v.startDateTime || appt.startDateTime || v["Start Time"] || appt.Start;
    if (!iso) return false;
    const dt = new Date(iso);
    dISO = `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,"0")}-${String(dt.getDate()).padStart(2,"0")}`;
  }
  const [y,m,d] = dISO.split("-").map(Number);
  const dt = new Date(y, (m||1)-1, d||1, 0,0,0,0);
  return dt >= weekStart && dt <= weekEnd;
}

// --- tolerant fetch: try operators first; on 404/405/500, do simple query + client filter ---
// --- tiny helpers already in your file ---
// asArray(), inWeekRange(), api()
async function fetchAppointmentsSafe(whereObj, limit = "2000", opts = {}) {
  const qsOp = new URLSearchParams({
    where: JSON.stringify(whereObj || {}),
    limit,
    ts: Date.now().toString(),
  });

  // 1) Try typed route WITH operators
  let res = await api(`/api/records/Appointment?${qsOp.toString()}`, {
    headers: { Accept: "application/json" },
  });

  if (res.ok) {
    const raw = await res.json().catch(() => []);
    const list = asArray(raw);
    console.log("[appts] operator ok, count:", list.length);
    return list;
  }

  console.warn("[appts] operator query failed; status =", res.status, "→ using fallback");

  const { businessId, weekStart, weekEnd } = opts;

  // 2) Try typed route WITHOUT operators (server-side filtering often breaks on custom operators)
  try {
    const qsTypedNoWhere = new URLSearchParams({
      limit,
      ts: Date.now().toString(),
    });
    const r2 = await api(`/api/records/Appointment?${qsTypedNoWhere.toString()}`, {
      headers: { Accept: "application/json" },
    });
    if (r2.ok) {
      const raw2 = await r2.json().catch(() => []);
      const list2 = asArray(raw2);
      // client-side filter by business + week
      let filtered2 = list2;
      if (businessId && businessId !== "all") {
        filtered2 = filtered2.filter(a => {
          const v = a.values || {};
          const hits = [
            a.Business, a?.Business?._id, v.Business, v?.Business?._id,
            v.businessId, v["Business Id"]
          ].map(idVal);
          return hits.includes(String(businessId));
        });
      }
      if (weekStart && weekEnd) filtered2 = filtered2.filter(a => inWeekRange(a, weekStart, weekEnd));
      console.log("[appts] typed no-where returned", filtered2.length, "(raw:", list2.length, ")");
      if (filtered2.length) return filtered2;
    }
  } catch {}

  // 3) Generic route with simple business-only where (no operators)
  const simpleWhere =
    businessId && businessId !== "all"
      ? {
          $or: [
            { "Business": businessId },
            { "Business._id": businessId },
            { "values.Business": businessId },
            { "values.Business._id": businessId },
            { "values.businessId": businessId },
            { "values['Business Id']": businessId },
          ],
        }
      : {};

  const qsSimple = new URLSearchParams({
    where: JSON.stringify(simpleWhere),
    limit,
    dataType: "Appointment",
    ts: Date.now().toString(),
  });

  const res3 = await api(`/api/records?${qsSimple.toString()}`, {
    headers: { Accept: "application/json" },
  });

  if (!res3.ok) {
    const t3 = await res3.text().catch(() => "");
    console.warn("[appts] biz-only generic failed:", res3.status, t3.slice(0, 200));
    return [];
  }

  const raw3 = await res3.json().catch(() => []);
  const list3 = asArray(raw3);
  let filtered3 = list3;
  if (weekStart && weekEnd) filtered3 = filtered3.filter(a => inWeekRange(a, weekStart, weekEnd));
  console.log("[appts] fallback (biz-only) returned", filtered3.length, "(raw:", list3.length, ")");
  if (filtered3.length || (businessId && businessId !== "all")) return filtered3;

  // 4) Final: generic ALL, then client-side filter
  const qsAll = new URLSearchParams({ limit, dataType: "Appointment", ts: Date.now().toString() });
  const res4 = await api(`/api/records?${qsAll.toString()}`, { headers: { Accept: "application/json" } });
  if (!res4.ok) return filtered3;

  const raw4 = await res4.json().catch(() => []);
  const list4 = asArray(raw4);
  const filtered4 = weekStart && weekEnd ? list4.filter(a => inWeekRange(a, weekStart, weekEnd)) : list4;
  console.log("[appts] final all-rows fetch:", list4.length, "→ in-week:", filtered4.length);
  return filtered4;
}

//////////////////////////////////////
// === Inline "New Client" toggles for the appointment popup ===
(function wireInlineNewClient(){
  const btnPlus   = document.getElementById("btn-new-client");
  const box       = document.getElementById("new-client-fields");
  const cancelBtn = document.getElementById("cancel-new-client-btn");
  const clientSel = document.getElementById("appointment-client");

  if (!btnPlus || !box) return;
  if (btnPlus.dataset.bound) return; // bind once

  function openNewClientBox() {
    // clear previous values
    ["new-client-first-name","new-client-last-name","new-client-email","new-client-phone"]
      .forEach(id => { const el = document.getElementById(id); if (el) el.value = ""; });

    // show the section
    box.style.display = "block";

    // optional: disable the select while adding a new client
    if (clientSel) {
      clientSel.dataset.prevDisabled = clientSel.disabled ? "1" : "";
      clientSel.disabled = true;
      clientSel.value = ""; // clear selection
    }

    // focus first input
    document.getElementById("new-client-first-name")?.focus();
  }

  function closeNewClientBox() {
    box.style.display = "none";
    if (clientSel) {
      clientSel.disabled = clientSel.dataset.prevDisabled ? true : false;
      delete clientSel.dataset.prevDisabled;
    }
  }

  btnPlus.addEventListener("click", openNewClientBox);
  cancelBtn?.addEventListener("click", closeNewClientBox);

  btnPlus.dataset.bound = "1";

  // Optionally expose helpers if you’ll save inline and then hide after save
  window._openInlineNewClient  = openNewClientBox;
  window._closeInlineNewClient = closeNewClientBox;
})();

// === Inline "Save Client" for the New Client box ===
(function wireInlineClientSave(){
  const box = document.getElementById("new-client-fields");
  if (!box) return;

  // Find the save button by id OR by the existing class
  const saveBtn = box.querySelector("#save-inline-client-btn, .orange-sign-up");
  if (!saveBtn || saveBtn.dataset.bound) return;

  saveBtn.addEventListener("click", async () => {
    const bizSel   = document.getElementById("appointment-business");
    const clientSel= document.getElementById("appointment-client");
    const bizId    = bizSel?.value || "";

    if (!bizId || bizId === "all") {
      alert("Choose a business first.");
      bizSel?.focus();
      return;
    }

    // Gather inline fields
    const first = (document.getElementById("new-client-first-name")?.value || "").trim();
    const last  = (document.getElementById("new-client-last-name")?.value  || "").trim();
    const email = (document.getElementById("new-client-email")?.value      || "").trim();
    const phone = (document.getElementById("new-client-phone")?.value      || "").trim();

    if (!first && !last && !email && !phone) {
      alert("Enter at least a name, email, or phone.");
      return;
    }

    // Button UX
    const oldLabel = saveBtn.textContent;
    saveBtn.disabled = true;
    saveBtn.textContent = "Saving…";

    try {
      const proUserId = window.STATE?.userId || null;

      // Payload supports both top-level and values.* for your flexible schema
      const payload = {
        Business: bizId,
        Pro: proUserId,
        values: {
          Business: bizId,
          Pro: proUserId,
          "First Name": first,
          "Last Name":  last,
          Email:        email,
          Phone:        phone
        }
      };

      // Try /api/records/Client; fallback to /api/records with dataType
     let res = await api("/api/records/Client", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify(payload)
      });
       if (res.status === 404) {
        res = await api("/api/records", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json", "Accept": "application/json" },
          body: JSON.stringify({ dataType: "Client", ...payload })
        });
      }
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`Save failed (${res.status}): ${txt.slice(0,200)}`);
      }

      const saved = await res.json();

      // Refresh the client dropdown for this business and preselect the new client
      const label = (function c_labelFromClient(values = {}) {
        const first = (values["First Name"] || values.firstName || "").trim();
        const last  = (values["Last Name"]  || values.lastName  || "").trim();
        const full  = [first, last].filter(Boolean).join(" ").trim();
        return full || values["Client Name"] || values.Name || values.email || "(Client)";
      })(saved?.values || {});

      if (typeof loadClientsForSelectedBusiness === "function") {
        await loadClientsForSelectedBusiness(bizId, {
          selectClientId: String(saved?._id || ""),
          preselectLabel: label
        });
      }

      // Hide & clear the inline box
      box.style.display = "none";
      ["new-client-first-name","new-client-last-name","new-client-email","new-client-phone"]
        .forEach(id => { const el = document.getElementById(id); if (el) el.value = ""; });

      // Re-enable the client dropdown if you disabled it earlier
      if (clientSel) clientSel.disabled = false;

      // If you wired helpers earlier, call them (safe if undefined)
      if (typeof window._closeInlineNewClient === "function") {
        window._closeInlineNewClient();
      }
    } catch (err) {
      alert(err?.message || "Failed to save client.");
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = oldLabel;
    }
  });

  saveBtn.dataset.bound = "1";
})();

// ---- Helpers to build ISO times in LOCAL timezone ----
function toLocalISO(dateStr, timeStr){
  // dateStr = "YYYY-MM-DD", timeStr = "HH:MM"
  const [y,m,d] = (dateStr||"").split('-').map(Number);
  const [H,MM]  = (timeStr||"").split(':').map(Number);
  const dt = new Date(y, (m||1)-1, d||1, H||0, MM||0, 0, 0); // local time
  return dt.toISOString();
}
function addMinutesISO(iso, minutes){
  const t = new Date(iso).getTime() + (Number(minutes)||0)*60_000;
  return new Date(t).toISOString();
}

// ---- Save Appointment submit handler ----
// ---- Save Appointment submit handler ----
(function wireSaveAppointment(){
  const form = document.getElementById("create-appointment-form");
  if (!form || form.dataset.bound) return;
  form.dataset.bound = "1";

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const bizSel    = document.getElementById("appointment-business");
    const svcSel    = document.getElementById("appointment-service");
    const clientSel = document.getElementById("appointment-client");
    const dateIn    = document.getElementById("appointment-date");
    const timeIn    = document.getElementById("appointment-time");
    const durIn     = document.getElementById("appointment-duration");

    const businessId = bizSel?.value || "";
    const serviceId  = svcSel?.value || "";
    const clientId   = clientSel?.value || "";
    const dateStr    = dateIn?.value || "";
    const timeStr    = timeIn?.value || "";
    const duration   = Number(durIn?.value || 0);

    if (!businessId) return alert("Choose a Business.");
    if (!serviceId)  return alert("Choose a Service.");
    if (!clientId)   return alert("Choose a Client (or add a new one).");
    if (!dateStr)    return alert("Choose a Date.");
    if (!timeStr)    return alert("Choose a Time.");
    if (!Number.isFinite(duration) || duration <= 0) return alert("Enter a valid duration (minutes).");

    const startISO = toLocalISO(dateStr, timeStr);
    const endISO   = addMinutesISO(startISO, duration);

    // Optional: capture Calendar from the selected Service option
    const svcOpt     = svcSel.options[svcSel.selectedIndex];
    const calendarId = svcOpt?.dataset?.calendarId || null;

    // Logged-in Pro
    const proUserId = window.STATE?.userId || null;

    // Build payload
    const payload = {
      Business: businessId,
      Service:  serviceId,
      Client:   clientId,
      Calendar: calendarId || undefined,
      Pro:      proUserId,
      Start:    startISO,
      End:      endISO,
      Duration: duration,
      values: {
        Business: businessId,
        Service:  serviceId,
        Client:   clientId,
        Calendar: calendarId || undefined,
        Pro:      proUserId,
        "Start Time": startISO,
        "End Time":   endISO,
        Duration:     duration,
        Date:         dateStr,
        Time:         timeStr
      }
    };

    // Button UX
    const submitBtn = form.querySelector('button[type="submit"]');
    const oldLabel  = submitBtn ? submitBtn.textContent : "";
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = "Saving…"; }

    try {
      // 🔽🔽🔽 THE NEW PART GOES RIGHT HERE (replaces your old POST-only block)
      const mode   = form.dataset.mode || "create";
      const apptId = form.dataset.apptId || "";

      let res;
      if (mode === "edit" && apptId) {
        // Update (PATCH typed → fallback generic PUT)
        res = await api(`/api/records/Appointment/${encodeURIComponent(apptId)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (res.status === 404 || res.status === 405) {
          res = await api(`/api/records`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ dataType: "Appointment", _id: apptId, ...payload }),
          });
        }
      } else {
        // Create (typed → fallback generic)
        res = await api("/api/records/Appointment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (res.status === 404 || res.status === 405) {
          res = await api("/api/records", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ dataType: "Appointment", ...payload }),
          });
        }
      }
      // 🔼🔼🔼 END OF NEW PART

      if (!res.ok) {
        const txt = await res.text().catch(()=> "");
        throw new Error(`Save failed (${res.status}): ${txt.slice(0,200)}`);
      }

      const saved = await res.json().catch(()=> null);

      // Close popup + refresh week
      if (typeof closeAppointmentPopup === "function") closeAppointmentPopup();
      if (typeof window.refreshCalendarAppointments === "function") {
        try { await window.refreshCalendarAppointments(window.currentWeekDates); } catch {}
      }
    } catch (err) {
      console.error("[appointment save] error:", err);
      alert(err?.message || "Save failed.");
    } finally {
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = oldLabel || "Save Appointment"; }
    }
  });
})();


//aptc
/////////////////////////////////////////////////////
//Appointment Cards 
//helper // ---- lightweight caches for lookups ----
const _clientCache  = new Map();
const _serviceCache = new Map();

// Try $in. If the server rejects operators, fall back to fetch-all + filter.
// Try multiple patterns: typed + where, typed no-where + filter,
// generic with dataType + where, generic no-where + filter.
async function fetchByIdsSafe(type, ids) {
  const uniq = Array.from(new Set((ids || []).map(String))).filter(Boolean);
  const out = new Map();
  if (!uniq.length) return out;

  const pick = (arr=[]) => {
    for (const r of arr) {
      const id = String(r._id || r.id || "");
      if (id && uniq.includes(id) && !out.has(id)) out.set(id, r);
    }
  };

  const qWhere = new URLSearchParams({
    where: JSON.stringify({ $or: [{ _id: { $in: uniq } }, { "values._id": { $in: uniq } }] }),
    limit: String(Math.max(uniq.length, 50)),
    includeRefField: "1",
    ts: Date.now().toString(),
  });

  // 1) Typed + WHERE (may 500/ignore operators)
  try {
    let r = await api(`/api/records/${encodeURIComponent(type)}?${qWhere}`);
    if (r.ok) {
      const data = await r.json().catch(()=>[]);
      pick(Array.isArray(data) ? data : (data.items||data.data||[]));
    }
  } catch {}

  // 2) Typed, NO where → filter in browser
  if (out.size < uniq.length) {
    try {
      const q = new URLSearchParams({ limit: "2000", includeRefField: "1", ts: Date.now().toString() });
      let r = await api(`/api/records/${encodeURIComponent(type)}?${q}`);
      if (r.ok) {
        const data = await r.json().catch(()=>[]);
        const arr = Array.isArray(data) ? data : (data.items||data.data||[]);
        pick(arr.filter(rec => uniq.includes(String(rec._id || rec.id || ""))));
      }
    } catch {}
  }

  // 3) Generic + dataType + WHERE
  if (out.size < uniq.length) {
    try {
      const q = new URLSearchParams({
        dataType: type,
        where: JSON.stringify({ $or: [{ _id: { $in: uniq } }, { "values._id": { $in: uniq } }] }),
        limit: String(Math.max(uniq.length, 50)),
        includeRefField: "1",
        ts: Date.now().toString(),
      });
      const r = await api(`/api/records?${q}`);
      if (r.ok) {
        const data = await r.json().catch(()=>[]);
        pick(Array.isArray(data) ? data : (data.items||data.data||[]));
      }
    } catch {}
  }

  // 4) Generic + dataType, NO where → filter in browser
  if (out.size < uniq.length) {
    try {
      const q = new URLSearchParams({
        dataType: type,
        limit: "2000",
        includeRefField: "1",
        ts: Date.now().toString(),
      });
      const r = await api(`/api/records?${q}`);
      if (r.ok) {
        const data = await r.json().catch(()=>[]);
        const arr = Array.isArray(data) ? data : (data.items||data.data||[]);
        pick(arr.filter(rec => uniq.includes(String(rec._id || rec.id || ""))));
      }
    } catch {}
  }

  // Debug visibility
  console.log(`[lookup:${type}] asked ${uniq.length} → got ${out.size}`);
  return out;
}

function _nameFromClient(rec) {
  const v = rec?.values || {};
  return (
    v["Full Name"] ||
    [v["First Name"] || v.firstName || "", v["Last Name"] || v.lastName || ""]
      .filter(Boolean).join(" ").trim() ||
    v.Name || rec?.name || "(Client)"
  );
}
function _nameFromService(rec) {
  const v = rec?.values || {};
  return v.serviceName || v["Service Name"] || v.Name || rec?.name || "(Service)";
}

// ====== APPOINTMENT RENDERING ======

// Convert "HH:mm" --> minutes since midnight
function minutesFromHHMM(t){
  if (!t) return null;
  const [hh, mm] = String(t).split(":").map(n=>parseInt(n,10));
  if (Number.isNaN(hh) || Number.isNaN(mm)) return null;
  return hh*60 + mm;
}

// Safely read ID from ref/object/string
function idVal(x){ if(!x) return ""; if (typeof x==="string") return x; return String(x._id||x.id||""); }

// Format time for the card (12h)
function to12h(hh, mm){
  const dt = new Date(2000,0,1,hh,mm||0,0,0);
  return dt.toLocaleTimeString([], {hour:"numeric", minute:"2-digit"});
}

// Given ISO "YYYY-MM-DD", return index 0..6 within visible week; -1 if outside
function dayIndexInWeek(iso, weekStartDate){
  if (!iso) return -1;
  const [y,m,d] = iso.split("-").map(Number);
  const dt = new Date(y, (m||1)-1, d||1, 0,0,0,0);
  const start = startOfWeek(weekStartDate);
  const diff = Math.floor((dt - start) / (1000*60*60*24));
  return (diff>=0 && diff<7) ? diff : -1;
}

// Create the positioned DOM node inside the correct .time-column
function paintApptCard({ dayIndex, startMin, durationMin, label, sublabel, dataset={} }){
  const col = document.querySelector(`.time-column[data-day-index="${dayIndex}"]`) ||
              document.querySelector(`.time-column[data-dayIndex="${dayIndex}"]`);
  if (!col) return;

  const pxPerMin = 60/60; // 60px per hour -> 1px per min
  const top = startMin * pxPerMin;
  const height = Math.max(15, (durationMin||30) * pxPerMin); // min 15px tall

  const div = document.createElement("div");
  div.className = "appointment-card";
  div.style.top = `${top}px`;
  div.style.height = `${height}px`;
  div.style.left = "2px";
  div.style.right = "2px";

  // carry IDs for click/edit later
  Object.entries(dataset).forEach(([k,v])=>div.dataset[k]=String(v));

  div.innerHTML = `
    <div class="appt-time">${label || ""}</div>
    <div class="appt-client">${sublabel || ""}</div>
  `;

  col.appendChild(div);
}
//Fetch + render for the visible week
// Fetch + render for the visible week
async function refreshCalendarAppointments(weekDates){
  // Clear existing cards
  document.querySelectorAll(".appointment-card").forEach(el => el.remove());

  const weekStart = new Date(weekDates[0]); weekStart.setHours(0,0,0,0);
  const weekEnd   = new Date(weekDates[6]); weekEnd.setHours(23,59,59,999);

  const bizId = document.getElementById("business-dropdown")?.value
             || document.getElementById("appointment-business")?.value
             || "";

  // Operator-style WHERE (first attempt)
  const where = {
    $and: [
      {
        $or: [
          { "values.Date":          { $gte: weekStart.toISOString().slice(0,10), $lte: weekEnd.toISOString().slice(0,10) } },
          { "Date":                 { $gte: weekStart.toISOString().slice(0,10), $lte: weekEnd.toISOString().slice(0,10) } },
          { "values.startDateTime": { $gte: weekStart.toISOString(),             $lte: weekEnd.toISOString() } },
          { "startDateTime":        { $gte: weekStart.toISOString(),             $lte: weekEnd.toISOString() } },
        ]
      }
    ]
  };

  if (bizId && bizId !== "all") {
    where.$and.push({
      $or: [
        { "Business": bizId },
        { "Business._id": bizId },
        { "values.Business": bizId },
        { "values.Business._id": bizId },
        { "values.businessId": bizId },
        { "values['Business Id']": bizId },
      ]
    });
  }

  // Pass week bounds + business to the fetcher for fallback filtering
  let rows = await fetchAppointmentsSafe(where, "3000", { weekStart, weekEnd, businessId: bizId });
  console.log("[appts] fetched", Array.isArray(rows) ? rows.length : "(?)", rows);
  window._lastApptRows = rows;  // inspect in console

 // --- normalize to the visible week + (if no biz picked) filter to my appts ---
// --- normalize rows to the visible week (and my appts if biz = all) ---
let weekRows = Array.isArray(rows) ? rows.filter(a => inWeekRange(a, weekStart, weekEnd)) : [];
const me = window.STATE?.userId || "";
if (!bizId || bizId === "all") {
  if (me) {
    weekRows = weekRows.filter(a => {
      const v = a.values || {};
      const pro = a.Pro || v.Pro || v["Pro"] || v["User"] || v["Owner"];
      return String(pro || "").trim() === String(me);
    });
  }
}
rows = weekRows;

// --- collect missing client/service IDs to resolve names ---
const needClientIds  = [];
const needServiceIds = [];
for (const a of rows) {
  const v = a.values || {};
  const clientEmbedded  = (v.Client && typeof v.Client === "object") || (a.Client && typeof a.Client === "object");
  const serviceEmbedded = (v.Service && typeof v.Service === "object") || (a.Service && typeof a.Service === "object");

  if (!clientEmbedded) {
    const cid = idVal(v.Client) || idVal(a.Client) || idVal(v["Client Id"]) || idVal(v.clientId);
    if (cid && !_clientCache.has(cid)) needClientIds.push(cid);
  }
  if (!serviceEmbedded) {
    const sid = idVal(v.Service) || idVal(a.Service) || idVal(v["Service Id"]) || idVal(v.serviceId);
    if (sid && !_serviceCache.has(sid)) needServiceIds.push(sid);
  }
}

// (debug AFTER init)
console.log("[appts] need IDs", { clients: needClientIds, services: needServiceIds });

// fetch & cache once
if (needClientIds.length) {
  const m = await fetchByIdsSafe("Client", needClientIds);
  m.forEach((rec, id) => _clientCache.set(id, rec));
}
if (needServiceIds.length) {
  const m = await fetchByIdsSafe("Service", needServiceIds);
  m.forEach((rec, id) => _serviceCache.set(id, rec));
}
console.log("[appts] cache sizes → clients:", _clientCache.size, "services:", _serviceCache.size);

if (!rows.length) {
  console.warn("[appts] no rows this week. bizId=", bizId, "range=", weekStart.toISOString(), "→", weekEnd.toISOString());
}

// --- mapping/paint logic ---
rows.forEach(a => {
  const v = a.values || {};

  // date -> column index
  let dateISO = v.Date || a.Date || "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateISO)) {
    const iso = v.startDateTime || a.startDateTime || v["Start Time"] || a.Start;
    if (iso) {
      const dt = new Date(iso);
      dateISO = `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,"0")}-${String(dt.getDate()).padStart(2,"0")}`;
    }
  }
  const idx = dayIndexInWeek(dateISO, weekDates[0]);
  if (idx < 0) return;

  // start minutes (prefer HH:MM; else from ISO)
  let minutes = minutesFromHHMM(v.Time || a.Time);
  let startISO = v.startDateTime || a.startDateTime || v["Start Time"] || a.Start || null;
  if (minutes == null && startISO) {
    const dt = new Date(startISO);
    minutes = dt.getHours()*60 + dt.getMinutes();
  }

  // duration (fallback: compute from end; else 30)
  let duration = Number(v.Duration ?? v.duration ?? v["Duration (minutes)"] ?? a.Duration);
  let endISO = v.endDateTime || a.endDateTime || v["End Time"] || a.End || null;
  if (!Number.isFinite(duration) || duration <= 0) {
    if (startISO && endISO) {
      const diffMs = new Date(endISO).getTime() - new Date(startISO).getTime();
      duration = Math.max(15, Math.round(diffMs / 60000));
    } else {
      duration = 30;
    }
  }

  // time label "3:55 AM – 6:25 AM"
  const startH = Math.floor((minutes || 0) / 60);
  const startM = (minutes || 0) % 60;
  const endTotal = (minutes || 0) + duration;
  const endH = Math.floor(endTotal / 60);
  const endM = endTotal % 60;
  const timeLabel = `${to12h(startH, startM)} – ${to12h(endH, endM)}`;

  // --- client name (embedded → cache → fallback) ---
// --- client name (embedded → cache → fields on appt) ---
let clientName = "";
if (v.Client && typeof v.Client === "object") clientName = _nameFromClient(v.Client);
else if (a.Client && typeof a.Client === "object") clientName = _nameFromClient(a.Client);
else {
  const cid = idVal(v.Client) || idVal(a.Client) || idVal(v["Client Id"]) || idVal(v.clientId);
  if (cid && _clientCache.has(cid)) clientName = _nameFromClient(_clientCache.get(cid));
}
// last-ditch: read a name stored directly on the appt
if (!clientName) {
  clientName =
    v["Client Name"] ||
    [v["First Name"] || v.firstName || "", v["Last Name"] || v.lastName || ""]
      .filter(Boolean).join(" ").trim() ||
    v.Name || a.Name || "";
}

// --- service name (embedded → cache → fields on appt) ---
let serviceName = "";
if (v.Service && typeof v.Service === "object") serviceName = _nameFromService(v.Service);
else if (a.Service && typeof a.Service === "object") serviceName = _nameFromService(a.Service);
else {
  const sid = idVal(v.Service) || idVal(a.Service) || idVal(v["Service Id"]) || idVal(v.serviceId);
  if (sid && _serviceCache.has(sid)) serviceName = _nameFromService(_serviceCache.get(sid));
}
if (!serviceName) {
  serviceName = v.serviceName || v["Service Name"] || v.Name || a.Name || "";
}
const sub = [clientName || "(Client)", serviceName || "(Service)"].join(" • ");

  paintApptCard({
    dayIndex: idx,
    startMin: minutes || 0,
    durationMin: duration,
    label: timeLabel,
    sublabel: sub,
    dataset: { id: String(a._id || a.id || "") }
  });
});
}

//Edit appt
 // One-time delegation: click any .appointment-card to edit
document.addEventListener("click", (e) => {
  const card = e.target.closest(".appointment-card");
  if (!card) return;
  const id = card.dataset.id;
  if (id) openAppointmentEditor(id);
});

//Helper: fetch 1 appointment by id (tolerant)
// --- SUPER ROBUST: fetch one Appointment by id (tries 4 shapes)
async function fetchAppointmentById(id) {
  if (!id) return null;
  const enc = encodeURIComponent(id);

  // 1) Typed, direct by-id
  let res = await api(`/api/records/Appointment/${enc}`, {
    headers: { Accept: "application/json" },
  });
  if (res.ok) return await res.json().catch(()=>null);

  // 2) Generic, direct by-id (some backends use this with dataType)
  res = await api(`/api/records/${enc}?dataType=Appointment`, {
    headers: { Accept: "application/json" },
  });
  if (res.ok) return await res.json().catch(()=>null);

  // 3) Typed, WHERE (may 500 on operators)
  try {
    const q1 = new URLSearchParams({
      where: JSON.stringify({ $or: [{ _id: id }, { "values._id": id }] }),
      limit: "1",
      includeRefField: "1",
      ts: Date.now().toString(),
    });
    res = await api(`/api/records/Appointment?${q1.toString()}`, {
      headers: { Accept: "application/json" },
    });
    if (res.ok) {
      const arr = await res.json().catch(()=>[]);
      if (Array.isArray(arr) && arr[0]) return arr[0];
      const boxed = (arr && (arr.items || arr.data)) || [];
      if (Array.isArray(boxed) && boxed[0]) return boxed[0];
    }
  } catch {}

  // 4) Generic + dataType, WHERE
  try {
    const q2 = new URLSearchParams({
      dataType: "Appointment",
      where: JSON.stringify({ $or: [{ _id: id }, { "values._id": id }] }),
      limit: "1",
      includeRefField: "1",
      ts: Date.now().toString(),
    });
    res = await api(`/api/records?${q2.toString()}`, {
      headers: { Accept: "application/json" },
    });
    if (res.ok) {
      const arr = await res.json().catch(()=>[]);
      if (Array.isArray(arr) && arr[0]) return arr[0];
      const boxed = (arr && (arr.items || arr.data)) || [];
      if (Array.isArray(boxed) && boxed[0]) return boxed[0];
    }
  } catch {}

  return null;
}

//Open popup in edit mode and prefill
async function openAppointmentEditor(apptId) {
  const rec = await fetchAppointmentById(apptId);
  if (!rec) return alert("Could not load appointment.");

  const v = rec.values || {};

  // Derive IDs (be generous with shapes)
  const asId = (x) => (typeof x === "string" ? x : (x && (x._id || x.id)) ? String(x._id || x.id) : "");
  const businessId = asId(rec.Business) || asId(v.Business) || v["Business Id"] || v.businessId || "";
  const serviceId  = asId(rec.Service)  || asId(v.Service)  || v["Service Id"]  || v.serviceId  || "";
  const clientId   = asId(rec.Client)   || asId(v.Client)   || v["Client Id"]   || v.clientId   || "";

  // Dates/times
  const dateStr = v.Date || rec.Date || (function () {
    const iso = v.startDateTime || rec.startDateTime || v["Start Time"] || rec.Start;
    if (!iso) return "";
    const d = new Date(iso);
    const y = d.getFullYear(), m = String(d.getMonth()+1).padStart(2,"0"), da = String(d.getDate()).padStart(2,"0");
    return `${y}-${m}-${da}`;
  })();

  const timeStr = v.Time || rec.Time || (function () {
    const iso = v.startDateTime || rec.startDateTime || v["Start Time"] || rec.Start;
    if (!iso) return "";
    const d = new Date(iso);
    return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
  })();

  let duration = Number(v.Duration ?? v.duration ?? v["Duration (minutes)"] ?? rec.Duration);
  if (!Number.isFinite(duration) || duration <= 0) {
    const sISO = v.startDateTime || rec.startDateTime || v["Start Time"] || rec.Start;
    const eISO = v.endDateTime   || rec.endDateTime   || v["End Time"]   || rec.End;
    if (sISO && eISO) duration = Math.max(15, Math.round((new Date(eISO)-new Date(sISO))/60000));
    else duration = 30;
  }

  // Open popup with edit title
  await window.openAppointmentPopup({ title: "Edit Appointment" });

  const form = document.getElementById("create-appointment-form");
  if (!form) return;
  form.dataset.mode  = "edit";
  form.dataset.apptId = String(apptId);

  // Buttons/labels
  const submitBtn = form.querySelector('button[type="submit"]');
  if (submitBtn) submitBtn.textContent = "Save Changes";

  ensureCancelButton(form); // add once (see section 5)

  // Set dropdowns/inputs (respect async loaders)
  const bizDD = document.getElementById("appointment-business");
  const svcDD = document.getElementById("appointment-service");
  const cliDD = document.getElementById("appointment-client");
  const dateIn= document.getElementById("appointment-date");
  const timeIn= document.getElementById("appointment-time");
  const durIn = document.getElementById("appointment-duration");

  // 1) Business → then Services/Clients for that business
  if (bizDD && businessId) {
    bizDD.value = businessId;
    // load services & clients for this business
    await loadServicesForSelectedBusiness(businessId);
    await loadClientsForSelectedBusiness(businessId);
  }

  // 2) Select Service/Client if present
  if (svcDD && serviceId && svcDD.querySelector(`option[value="${CSS.escape(serviceId)}"]`)) {
    svcDD.value = serviceId;
    // also sync duration from service if provided by dataset
    if (!durIn?.value) syncDurationFromService?.();
  }
  if (cliDD && clientId && cliDD.querySelector(`option[value="${CSS.escape(clientId)}"]`)) {
    cliDD.value = clientId;
  }

  // 3) Date/Time/Duration
  if (dateIn) dateIn.value = dateStr || "";
  if (timeIn) timeIn.value = timeStr || "";
  if (durIn)  durIn.value  = String(duration || 30);
}

//Add a Cancel Appointment button (soft cancel + fallback delete)
function ensureCancelButton(form) {
  let cancelBtn = form.querySelector("#cancel-appointment-btn");
  if (cancelBtn) return; // already there

  cancelBtn = document.createElement("button");
  cancelBtn.type = "button";
  cancelBtn.id   = "cancel-appointment-btn";
  cancelBtn.className = "blk-btn"; // or your orange btn class
  cancelBtn.style.marginLeft = "8px";
  cancelBtn.textContent = "Cancel Appointment";
  form.querySelector(".form-actions")?.appendChild(cancelBtn) || form.appendChild(cancelBtn);

  cancelBtn.addEventListener("click", onCancelAppointmentClick);
}

async function onCancelAppointmentClick() {
  const form = document.getElementById("create-appointment-form");
  const apptId = form?.dataset?.apptId || "";
  if (!apptId) return;

  if (!confirm("Cancel this appointment?")) return;

  // Soft-cancel first: set Status=Cancelled and timestamp
  const soft = {
    values: {
      Status: "Cancelled",
      "Cancelled At": new Date().toISOString()
    }
  };

let res = await api(`/api/records/Appointment/${encodeURIComponent(apptId)}`, {
  method: "PATCH",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(soft),
});
if (res.status === 404 || res.status === 405) {
  // generic fallback
  res = await api("/api/records", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dataType: "Appointment", _id: apptId, ...soft }),
  });
}
  // If even that fails, try hard delete (last resort)
  if (!res.ok) {
    const del = await api(`/api/records/Appointment/${encodeURIComponent(apptId)}`, { method: "DELETE" });
    if (!del.ok) {
      const txt = await res.text().catch(()=> "");
      return alert(`Cancel failed: ${txt.slice(0,200)}`);
    }
  }

  // Close & repaint
  if (typeof closeAppointmentPopup === "function") closeAppointmentPopup();
  if (typeof window.refreshCalendarAppointments === "function") {
    try { await window.refreshCalendarAppointments(window.currentWeekDates); } catch {}
  }
  alert("Appointment cancelled.");
}

//When leaving edit mode (optional)
function resetAppointmentFormToCreate() {
  const form = document.getElementById("create-appointment-form");
  if (!form) return;
  form.dataset.mode = "create";
  form.dataset.apptId = "";
  form.reset();
  const title = document.getElementById("appointment-popup-title");
  if (title) title.textContent = "Add Appointment";
  const submitBtn = form.querySelector('button[type="submit"]');
  if (submitBtn) submitBtn.textContent = "Save Appointment";
}
