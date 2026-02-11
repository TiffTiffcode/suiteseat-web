console.log('[appointmenttest] web loaded');

const host = window.location.hostname;
const isProdHost =
  host === "suiteseat.io" ||
  host === "www.suiteseat.io";   // 👈 add this

const API_BASE = isProdHost
  ? "https://suiteseat-app1.onrender.com"
  : "http://localhost:8400";

function openLoginPopup() {
  document.getElementById("popup-login")?.style?.setProperty("display", "block");
  document.getElementById("popup-overlay")?.style?.setProperty("display", "block");
  document.body.classList.add("popup-open");
}

function closeLoginPopup() {
  document.getElementById("popup-login")?.style?.setProperty("display", "none");
  document.getElementById("popup-overlay")?.style?.setProperty("display", "none");
  document.body.classList.remove("popup-open");
}

// ---------- API helpers ----------
async function login(email, password) {
  const res  = await fetch(`${API_BASE}/api/login`, {
    method: 'POST',
    credentials: 'include',               // 👈 always include
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const ct   = res.headers.get('content-type') || '';
  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status} – ${text.slice(0,200)}`);
  if (!ct.includes('application/json')) throw new Error(`Expected JSON, got ${ct || 'unknown'}: ${text.slice(0,200)}`);
  return JSON.parse(text);
}

async function me() {
  const res = await fetch(`${API_BASE}/api/me`, {
    credentials: 'include', // send cookies
    cache: 'no-store',
  });

  const text = await res.text();

  if (!res.ok) {
    console.warn('[me] HTTP error', res.status, text.slice(0, 200));
    throw new Error(`HTTP ${res.status}`);
  }

  try {
    return JSON.parse(text);
  } catch (err) {
    console.error('[me] JSON parse failed', err, text.slice(0, 200));
    return { ok: false };
  }
}

async function loadMe() {
  const data = await me();
  const el = document.querySelector('#login-status-text');
  if (el) {
    el.textContent = data?.ok
      ? `Hey, ${data.user.firstName || 'User'}`
      : 'Not logged in';
  }
  return data;
}


// ---------- boot ----------

document.addEventListener("DOMContentLoaded", () => {
  console.log("[appointmenttest] DOMContentLoaded");

  const loginStatus  = document.getElementById("login-status-text");
  const openLoginBtn = document.getElementById("open-login-popup-btn");
  const logoutBtn    = document.getElementById("logout-btn");

  const form    = document.getElementById("login-form");
  const emailEl = document.getElementById("login-email");
  const passEl  = document.getElementById("login-password");

  function setLoggedOutUI() {
    if (loginStatus)  loginStatus.textContent = "Not logged in";
    if (logoutBtn)    logoutBtn.style.display = "none";
    if (openLoginBtn) openLoginBtn.style.display = "inline-block";
  }

  function setLoggedInUI(user) {
    const name = user?.firstName || "User";
    if (loginStatus)  loginStatus.textContent = `Hi, ${name} 👋`;
    if (logoutBtn)    logoutBtn.style.display = "inline-block";
    if (openLoginBtn) openLoginBtn.style.display = "none";
  }

  // 1) Login button ALWAYS works
  if (openLoginBtn) {
    openLoginBtn.addEventListener("click", openLoginPopup);
  }

  // overlay click closes popup
  const overlay = document.getElementById("popup-overlay");
  if (overlay) {
    overlay.addEventListener("click", closeLoginPopup);
  }

  // 2) Logout handler
  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      const res = await fetch(`${API_BASE}/api/logout`, {
        method: "POST",
        credentials: "include",
      });

      const text = await res.text();
      let out = {};
      try { out = JSON.parse(text); } catch {}

      if (res.ok && out.ok) {
        alert("👋 Logged out!");
        setLoggedOutUI();
        closeLoginPopup();
      } else {
        alert(out.error || "Logout failed.");
      }
    });
  }

  // 3) On load, check session
(async () => {
  try {
    const data = await me();

 if (data?.ok) {
  setLoggedInUI(data.user);
  await loadBusinessDropdown();
  await loadMyAppointments();   // ✅ ADD THIS
} else {
  setLoggedOutUI();
}


  } catch (e) {
    console.warn("[me] failed", e);
    setLoggedOutUI();
  }
})();


  // 4) Login submit
  if (form && emailEl && passEl) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      const email = emailEl.value.trim();
      const password = passEl.value;

      try {
        const out = await login(email, password);

        if (out?.ok) {
          // confirm session really exists
          const data = await me();
          if (data?.ok) {
            setLoggedInUI(data.user);
               await loadBusinessDropdown();
               await loadMyAppointments();

            closeLoginPopup();
            alert("Logged in!");
          } else {
            alert("Login succeeded but session not found. Check cookies/CORS.");
          }
        } else {
          alert(out?.error || "Login failed.");
        }
      } catch (err) {
        alert(err.message || "Login failed.");
      }
    });
  }
});

//Helpers 
//helper for services 
let services = [];
let servicesById = {}; // { "serviceId": { ...service } }

let clients = [];
let clientsById = {}; // { "clientId": clientRecord }

function extractProIdFromAppt(a) {
  const v = a?.values || {};

  // Try all common keys (string OR object ref)
  const cand =
    v.proId ||
    v.proUserId ||
    v.ProUserId ||
    v["Pro User Id"] ||
    v.Pro ||          // ✅ this is the important one now
    a.proId ||
    a.proUserId;

  if (!cand) return "";

  if (typeof cand === "string") return cand.trim();

  // if it's a ref object { _id } or { id } etc.
  return String(cand._id || cand.id || cand.value || "").trim();
}

async function fetchMyClients() {
  const res = await fetch(`${API_BASE}/api/records/Client?limit=5000&ts=${Date.now()}`, {
    credentials: "include",
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  const text = await res.text();
  if (!res.ok) throw new Error(`Clients HTTP ${res.status}: ${text.slice(0, 200)}`);

  let data;
  try { data = JSON.parse(text); } catch { data = null; }
  return toArr(data);
}

async function loadMyClientsIntoMap() {
  const rows = await fetchMyClients();

  clients = rows;
  clientsById = {};

  for (const c of rows) {
    const id = String(c._id || c.id || "");
    if (!id) continue;
    clientsById[id] = c;
  }

  console.log("[clients] loaded:", rows.length);
  console.log("[clients] sample:", rows[0]);
}
function extractClientIdFromAppt(a) {
  const v = a?.values || {};

  const cand =
    v.clientId ||                 // ✅ your current create uses this
    v.Client?._id || v.Client?.id ||
    (typeof v.Client === "string" ? v.Client : "") ||
    v.ownerUserId ||              // ✅ often equals client user for bookings
    a.clientId;

  return String(cand || "").trim();
}

async function fetchMyAppointmentsAsClient() {
  const meData = await me();
  if (!meData?.ok) return [];

  const myId = String(meData.user?._id || meData.user?.id || "").trim();
  if (!myId) return [];

  const all = await fetchAllAppointments();

  // ✅ filter: appointment belongs to me as the CLIENT
  return all.filter(a => extractClientIdFromAppt(a) === myId);
}

async function fetchMyServices() {
  const res = await fetch(`${API_BASE}/api/records/Service?limit=5000&ts=${Date.now()}`, {
    credentials: "include",
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  const text = await res.text();
  if (!res.ok) throw new Error(`Services HTTP ${res.status}: ${text.slice(0, 200)}`);

  let data;
  try { data = JSON.parse(text); } catch { data = null; }

  return toArr(data);
}

async function loadMyServicesIntoMap() {
  const rows = await fetchMyServices();

  services = rows;
  servicesById = {};

  for (const s of rows) {
    const id = String(s._id || s.id || "");
    if (!id) continue;
    servicesById[id] = s;
  }

  console.log("[services] loaded:", rows.length);
  console.log("[services] sample:", rows[0]);
}

function getServiceName(serviceId) {
  const s = servicesById[serviceId];
  const v = s?.values || s || {};
  return (
    v.serviceName ||
    v.name ||
    v["Service Name"] ||
    v.title ||
    "Unknown service"
  );
}

function renderServiceNames(serviceIds) {
  if (!Array.isArray(serviceIds) || !serviceIds.length) return "—";

  return serviceIds.map((id) => {
    const name = getServiceName(id);
    if (name === "Unknown service") console.log("[missing serviceId]", id, servicesById[id]);
    return name;
  }).join(", ");
}


//business dropdown
function toArr(data) {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.items)) return data.items;
  if (data && Array.isArray(data.records)) return data.records;
  if (data && Array.isArray(data.data)) return data.data;
  return [];
}

function getBizName(rec) {
  const v = rec?.values || {};
  return (
    v.businessName ||
    v["Business Name"] ||
    v.name ||
    v.Name ||
    rec?.name ||
    "(Unnamed Business)"
  );
}

async function fetchMyBusinesses() {
  // Must be logged in (session cookie)
  const res = await fetch(`${API_BASE}/api/records/Business?limit=2000&ts=${Date.now()}`, {
    credentials: "include",
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  const text = await res.text();
  if (!res.ok) throw new Error(`Businesses HTTP ${res.status}: ${text.slice(0, 200)}`);

  let data;
  try { data = JSON.parse(text); } catch { data = null; }

  return toArr(data);
}

async function loadBusinessDropdown() {
  const dd = document.getElementById("business-dropdown");
  if (!dd) return;

  dd.innerHTML = `<option value="">Loading...</option>`;

  try {
    const meData = await me(); // uses /api/me
    if (!meData?.ok) {
      dd.innerHTML = `<option value="">Log in to load businesses</option>`;
      return;
    }

    const rows = await fetchMyBusinesses();
console.log("[biz] total fetched:", rows.length);
console.log("[biz] sample row:", rows[0]);

    // Filter to ONLY my businesses (handles a few common shapes)
    const myId = String(meData.user?._id || meData.user?.id || "");
  const mine = rows.filter((r) => {
  const v = r?.values || {};

  const owner =
    r.createdBy ||                // ✅ YOUR server uses this (seen in sample row)
    v.createdBy ||                // ✅ sometimes nested
    r.ownerUserId ||
    v.ownerUserId ||
    v.userId ||
    v["Owner User Id"] ||
    v.Owner ||
    v["Owner"] ||
    "";

  return myId && String(owner) === myId;
});


    if (!mine.length) {
      dd.innerHTML = `<option value="">No businesses found</option>`;
      return;
    }

    dd.innerHTML = `<option value="all">All Businesses</option>` + mine
      .map((b) => {
        const id = String(b._id || b.id || "");
        const name = getBizName(b);
        return `<option value="${id}">${name}</option>`;
      })
      .join("");

    // default selection (optional)
    dd.value = "all";

    // listen for changes (optional)
  dd.addEventListener("change", async () => {
  console.log("[business-dropdown] selected:", dd.value);
  await loadMyAppointments(); // ✅ refresh
});


  } catch (err) {
    console.error("[loadBusinessDropdown] failed:", err);
    dd.innerHTML = `<option value="">Failed to load businesses</option>`;
  }
}

//Service Name helper 
function getServiceLineFromAppt(a) {
  const v = a?.values || {};

  // ✅ BEST: already stored on the appointment during booking
  const direct =
    v.ServiceNames ||
    v["Service Names"] ||
    v.ServiceName ||
    v["Service Name"] ||
    v.serviceName;

  if (direct) return String(direct);

  // 2) If embedded service objects exist
  const svc = getServicesChosen(a);
  if (svc.names.length) return svc.names.join(", ");

  // 3) If we only have IDs, try your cache (may be empty for clients)
  if (svc.ids.length) {
    const resolved = renderServiceNames(svc.ids);
    if (resolved && resolved !== "Unknown service") return resolved;
  }

  return "—";
}

//Load appointments in list 
function getApptDateISO(a) {
  const v = a?.values || {};
  // Prefer stored Date "YYYY-MM-DD"
  const d = v.Date || a.Date;
  if (d && /^\d{4}-\d{2}-\d{2}$/.test(String(d))) return String(d);

  // Fall back to startDateTime ISO
  const iso = v.startDateTime || a.startDateTime || v["Start Time"] || a.Start;
  if (!iso) return "";
  const dt = new Date(iso);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const da = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${da}`;
}

function getApptTimeHHMM(a) {
  const v = a?.values || {};

  // ✅ Your Appointment uses StartTime like "13:30"
  const t =
    v.StartTime ||
    v["Start Time"] ||
    v.startTime ||
    v.Time ||
    a.StartTime ||
    a.Time;

  if (t && /^\d{2}:\d{2}$/.test(String(t))) return String(t);

  // Fall back to ISO startDateTime if present
  const iso =
    v.startDateTime ||
    a.startDateTime ||
    v["Start DateTime"] ||
    a["Start DateTime"] ||
    v["Start Time"] ||   // (kept for backward compat)
    a.Start;

  if (!iso) return "";
  const dt = new Date(iso);
  return `${String(dt.getHours()).padStart(2, "0")}:${String(dt.getMinutes()).padStart(2, "0")}`;
}


function fmt12hFromHHMM(hhmm) {
  if (!hhmm) return "";
  const [hh, mm] = hhmm.split(":").map(Number);
  const dt = new Date(2000, 0, 1, hh || 0, mm || 0);
  return dt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function getClientLabel(a) {
  const v = a?.values || {};

  // 1) If name was stored directly on appointment, use it
  const direct =
    v.ClientName ||
    v["Client Name"] ||
    [v.ClientFirstName || v["Client First Name"] || "", v.ClientLastName || v["Client Last Name"] || ""]
      .filter(Boolean)
      .join(" ")
      .trim();

  if (direct) return direct;

  // 2) Otherwise look up client record by id
  const clientId = extractClientIdFromAppt(a);
  if (clientId && clientsById[clientId]) {
    const c = clientsById[clientId];
    const cv = c.values || c;

    const name =
      cv.ClientName ||
      cv["Client Name"] ||
      cv.fullName ||
      [cv.firstName || cv["First Name"] || "", cv.lastName || cv["Last Name"] || ""]
        .filter(Boolean)
        .join(" ")
        .trim() ||
      cv.name ||
      cv.email;

    if (name) return name;
  }

  return "(Client)";
}


function getServiceLabel(a) {
  const v = a?.values || {};
  return v.serviceName || v["Service Name"] || v.ServiceName || "(Service)";
}

async function fetchAppointmentsForBusiness(bizId) {
  if (!bizId) return [];

  const url =
    `/api/me/records?dataType=Appointment` +
    `&myRefField=Business&myRefId=${encodeURIComponent(bizId)}` +
    `&limit=5000&ts=${Date.now()}`;

  const res = await api(url);
  const data = await res.json().catch(() => ({}));
  return Array.isArray(data?.data) ? data.data : (data.items || data.records || []);
}



function idVal(x){ if(!x) return ""; if (typeof x==="string") return x; return String(x._id||x.id||""); }

function toServiceName(x){
  if (!x) return "";
  if (typeof x === "string") return "";              // id only (name not embedded)
  const v = x.values || x;
  return v.serviceName || v["Service Name"] || v.Name || x.name || "";
}

function extractServiceIdsFromAppt(a){
  const v = a?.values || {};
  const out = [];

  // multi
  const multi = v["Service(s)"] || v.services || v.Services;
  if (Array.isArray(multi)) {
    for (const s of multi) {
      const sid = idVal(s);
      if (sid) out.push(sid);
    }
  }

  // single
  const single =
    v.Service || a.Service ||
    v["Service Id"] || v.serviceId ||
    a.serviceId || a["Service Id"];

  const sid = idVal(single);
  if (sid) out.push(sid);

  // uniq
  return Array.from(new Set(out)).filter(Boolean);
}

/**
 * Returns:
 * { names: string[], ids: string[] }
 * names will be filled if embedded objects exist OR if you use _serviceCache later.
 */
function getServicesChosen(a){
  const v = a?.values || {};
  const names = [];

  // If embedded service objects exist in multi field:
  const multi = v["Service(s)"] || v.services || v.Services;
  if (Array.isArray(multi)) {
    for (const s of multi) {
      const nm = toServiceName(s);
      if (nm) names.push(nm);
    }
  }

  // If embedded single service object:
  const singleObj = (v.Service && typeof v.Service === "object") ? v.Service
                  : (a.Service && typeof a.Service === "object") ? a.Service
                  : null;
  if (singleObj) {
    const nm = toServiceName(singleObj);
    if (nm) names.push(nm);
  }

  const ids = extractServiceIdsFromAppt(a);
  return { names: Array.from(new Set(names)).filter(Boolean), ids };
}

function renderAppointmentsList(rows) {
  const status = document.getElementById("appts-status");
  const holder = document.getElementById("appts-list");
  if (!holder) return;

  if (!rows.length) {
    if (status) status.textContent = "No appointments found.";
    holder.innerHTML = "";
    return;
  }

  if (status) status.textContent = `Showing ${rows.length} appointment(s)`;

  holder.innerHTML = rows.map((a) => {
    const id = String(a._id || a.id || "");
    const dateISO = getApptDateISO(a);
    const timeHHMM = getApptTimeHHMM(a);
    const time12 = fmt12hFromHHMM(timeHHMM);

    const client = getClientLabel(a);

const serviceLine = getServiceLineFromAppt(a);



 return `
  <div class="appt-card" data-id="${id}">
    <div class="appt-row">
      <div class="appt-time">${dateISO} • ${time12 || "(no time)"}</div>

      <button class="appt-del-btn" type="button" data-del-id="${id}">
        Delete
      </button>
    </div>

    <div class="appt-client">${client}</div>
    <div class="appt-services">${serviceLine}</div>
  </div>
`;

  }).join("");
}

async function fetchAllAppointments() {
  const res = await fetch(`${API_BASE}/api/records/Appointment?limit=5000&ts=${Date.now()}`, {
    credentials: "include",
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  const text = await res.text();
  let data = {};
  try { data = JSON.parse(text); } catch {}

  if (!res.ok) {
    throw new Error(data?.message || data?.error || `Appointments HTTP ${res.status}: ${text.slice(0,200)}`);
  }

  return toArr(data);
}

async function fetchMyAppointmentsAsPro() {
  const meData = await me();
  if (!meData?.ok) return [];

  const myId = String(meData.user?._id || meData.user?.id || "").trim();
  if (!myId) return [];

  const all = await fetchAllAppointments();

  // ✅ filter: appointment "belongs to me as the pro"
  return all.filter(a => extractProIdFromAppt(a) === myId);
}


async function loadMyAppointments() {
  const status = document.getElementById("appts-status");
  if (status) status.textContent = "Loading appointments...";

  const meData = await me();
  if (!meData?.ok) {
    if (status) status.textContent = "Log in to load appointments";
    renderAppointmentsList([]);
    return;
  }

  // ✅ Load maps first so we can convert ids -> names
  await loadMyServicesIntoMap();
  await loadMyClientsIntoMap();

  const rows = await fetchMyAppointmentsAsClient();


  // ✅ Filter by selected business (if not "all")
  const dd = document.getElementById("business-dropdown");
  const selected = dd?.value || "all";

  const filtered =
    selected === "all"
      ? rows
      : rows.filter(a => {
          const v = a?.values || {};
          const bid =
            v.businessId ||
            v.Business?._id ||
            v.Business?.id ||
            v.Business ||
            "";
          return String(bid) === String(selected);
        });

  renderAppointmentsList(filtered);
}

function idVal(x){
  if (!x) return "";
  if (typeof x === "string") return x;
  return String(x._id || x.id || x.value || "");
}


async function loadServicesForBusiness(businessId) {
  if (!businessId) {
    services = [];
    servicesById = {};
    return;
  }

  // ✅ Pick the route you actually have:
  // Option A (your public records pattern):
  const url =
    `${API_BASE}/public/records?dataType=Service&businessId=${encodeURIComponent(businessId)}&limit=500`;

  // Option B (if you have something like /api/services):
  // const url = `${API_BASE}/api/services?businessId=${encodeURIComponent(businessId)}`;

  const res = await fetch(url, {
    credentials: "include",
    headers: { Accept: "application/json" },
  });

  const data = await res.json();
  const rows = Array.isArray(data) ? data : (data.items || data.records || []);

  services = rows;

  // ✅ map id -> service object
  servicesById = {};
  for (const s of services) {
    const id = s._id || s.id;
    if (!id) continue;
    servicesById[id] = s;
  }

  console.log("[services] loaded:", services.length);
}


//Delete appointment
async function deleteAppointmentById(apptId) {
  if (!apptId) throw new Error("Missing apptId");

  const res = await fetch(
    `${API_BASE}/api/records/${encodeURIComponent("Appointment")}/${encodeURIComponent(apptId)}`,
    {
      method: "DELETE",
      credentials: "include",
      headers: { Accept: "application/json" },
      cache: "no-store",
    }
  );

  const text = await res.text();
  let data = {};
  try { data = JSON.parse(text); } catch {}

  if (!res.ok) {
    throw new Error(data?.message || data?.error || `Delete failed (${res.status}): ${text.slice(0,200)}`);
  }

  return data;
}

document.addEventListener("click", async (e) => {
  const btn = e.target.closest(".appt-del-btn");
  if (!btn) return;

  const apptId = btn.getAttribute("data-del-id");
  if (!apptId) return;

  const ok = confirm("Delete this appointment?");
  if (!ok) return;

  btn.disabled = true;
  btn.textContent = "Deleting...";

  try {
    await deleteAppointmentById(apptId);
    await loadMyAppointments(); // ✅ refresh list
  } catch (err) {
    console.error("[delete appt] failed:", err);
    alert(err.message || "Delete failed");
  } finally {
    btn.disabled = false;
    btn.textContent = "Delete";
  }
});
