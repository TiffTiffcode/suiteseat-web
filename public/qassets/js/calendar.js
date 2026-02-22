//C:\Users\tiffa\OneDrive\Desktop\suiteseat-web\public\qassets\js\calendar.js
// ==============================
// ✅ AUTH + HEADER (fresh rebuild)
// ==============================

console.log("[calendar] auth rebuild v1");
window.STATE = window.STATE || {};
window.STATE.refreshToken = 0; // ✅ MUST exist before any refresh calls
// On calendar3.html (pro/admin scheduler) allow overlaps
const ALLOW_OVERLAPS_FOR_PRO = true;

// ---- API ORIGIN (single source of truth) ----
const API_BASE = location.hostname.includes("localhost")
  ? "http://localhost:8400"
  : "https://api2.suiteseat.io";

async function api(path, init = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    cache: "no-store",
    headers: { Accept: "application/json", ...(init.headers || {}) },
    ...init,
  });
  return res;
}


// ---- popup helpers (match your HTML ids) ----
function openLoginPopup() {
  const pop = document.getElementById("popup-login");
  const ovl = document.getElementById("popup-overlay");
  if (pop) pop.style.display = "block";
  if (ovl) ovl.style.display = "block";
  document.body.classList.add("popup-open");
}

function closeLoginPopup() {
  const pop = document.getElementById("popup-login");
  const ovl = document.getElementById("popup-overlay");
  if (pop) pop.style.display = "none";
  if (ovl) ovl.style.display = "none";
  document.body.classList.remove("popup-open");
}

// make them callable from HTML onclick if needed
window.closeLoginPopup = closeLoginPopup;

// ---- render header every time (reattach listeners) ----
function renderHeader({ loggedIn, displayName }) {
  const headerRight = document.querySelector(".right-group");
  if (!headerRight) return;

  if (loggedIn) {
    headerRight.innerHTML = `
      <span class="greeting">Hi, ${displayName} 👋</span>
      <button class="blk-btn" id="logout-btn">Logout</button>
    `;

    document.getElementById("logout-btn")?.addEventListener("click", async () => {
      const out = await api("/api/logout", { method: "POST" }).catch(() => null);
      if (out && out.ok) location.reload();
    });
  } else {
    headerRight.innerHTML = `
      <button class="blk-btn" id="open-login-popup-btn">Login</button>
    `;

    document
      .getElementById("open-login-popup-btn")
      ?.addEventListener("click", openLoginPopup);
  }
}

// ---- check-login bootstrap ----
async function bootAuth() {
  window.STATE = window.STATE || {};

  try {
 const res = await api("/api/me");

    const data = await res.json().catch(() => ({}));


const userId = String(data?.user?._id || data?.user?.id || "").trim();

const loggedIn = !!data?.ok;

    if (loggedIn) {
      window.STATE.userId = userId;
      window.STATE.user = data.user || data;

      const display =
        (data.firstName && data.firstName.trim()) ||
        (data.user?.firstName && String(data.user.firstName).trim()) ||
        (data.name && data.name.trim().split(" ")[0]) ||
        (data.user?.name && String(data.user.name).trim().split(" ")[0]) ||
        (data.email && data.email.split("@")[0]) ||
        "there";

      renderHeader({ loggedIn: true, displayName: display });

      // ✅ load page data after auth
      try { await loadUserBusinesses?.(); } catch {}
const tryRefresh = () => {
  if (Array.isArray(window.currentWeekDates) && window.currentWeekDates.length === 7) {
    window.refreshCalendarAppointments?.(window.currentWeekDates);
  }
};




      try { await loadAppointmentBusinessDropdown?.(); } catch {}
      // (optional) refresh calendar if you want:
      // try { window.refreshCalendarAppointments?.(window.currentWeekDates || []); } catch {}
    } else {
      renderHeader({ loggedIn: false, displayName: "" });
    }
  } catch (err) {
    console.error("[auth] bootAuth failed:", err);
    renderHeader({ loggedIn: false, displayName: "" });
  }
}

// ---- login form submit ----
function wireLoginForm() {
  const form = document.getElementById("login-form");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = document.getElementById("login-email")?.value?.trim();
    const password = document.getElementById("login-password")?.value;

    if (!email || !password) return;

    try {
      const res = await api("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        alert(data?.message || "Login failed.");
        return;
      }

      closeLoginPopup();
      await bootAuth(); // re-check + render header + load businesses
    } catch (err) {
      console.error("[auth] login error:", err);
      alert("Login error. Check console.");
    }
  });
}

// ---- overlay click to close (optional) ----
function wireOverlayClose() {
  document.getElementById("popup-overlay")?.addEventListener("click", () => {
    closeLoginPopup?.();
    closeAppointmentPopup?.();
    closeClientPopup?.();
    closeClientListPopup?.(); // ✅ add
  });
}




















////////////////////////////////////////////////////
                  // View All Clients Popup
function openClientListPopup() {
  const pop = document.getElementById("popup-view-clients");
  const ovl = document.getElementById("popup-overlay");

  if (pop) pop.style.display = "block";
  if (ovl) ovl.style.display = "block";
  document.body.classList.add("popup-open");

  // reset views
  const detail = document.getElementById("client-detail-section");
  const addSec = document.getElementById("inline-add-client-section");
  const list   = document.getElementById("client-list-container");

  if (detail) detail.style.display = "none";
  if (addSec) addSec.style.display = "none";
  if (list)   list.style.display   = "block";

  loadAllClientsList();

  // ✅ reset + focus search (MUST be inside)
  const search = document.getElementById("client-search-input");
  if (search) {
    search.value = "";
    search.focus();
  }
}

function closeClientListPopup() {
  const pop = document.getElementById("popup-view-clients");
  const ovl = document.getElementById("popup-overlay");

  if (pop) pop.style.display = "none";
  if (ovl) ovl.style.display = "none";
  document.body.classList.remove("popup-open");
}

// ✅ make onclick="openClientListPopup()" work
window.openClientListPopup = openClientListPopup;
window.closeClientListPopup = closeClientListPopup;

// ------------------------------
// ✅ All Clients list popup render
// ------------------------------

// Use your existing readJsonSafe if you want; otherwise this works:
async function fetchAllClients() {
  const res = await api(`/api/records/Client?limit=5000&ts=${Date.now()}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || "Failed to load clients");
  return toItems(data);
}

// OPTIONAL: if you store "Pro" on client records, we can filter to the logged-in pro.
// If you DON'T store proUserId on Client records yet, just return true here.
function clientBelongsToMe(client) {
  const myId = String(window.STATE?.userId || "").trim();
  if (!myId) return false;

  const v = client?.values || {};

  // common shapes
  const pro =
    v.Pro || v.proUserId || v.proId || v.createdBy || v.ownerUserId || null;

  const proId =
    typeof pro === "string"
      ? pro
      : (pro && (pro._id || pro.id || pro.value)) || "";

  // If you don't have any of these fields on Client, comment this filter out.
  return !proId ? true : String(proId) === myId;
}

function getClientName(c) {
  const v = c?.values || {};
  const first = String(v.firstName || v.FirstName || "").trim();
  const last  = String(v.lastName || v.LastName || "").trim();
  const full  = `${first} ${last}`.trim();
  return full || String(v.email || v.Email || "").trim() || "(Client)";
}

function getClientEmail(c) {
  const v = c?.values || {};
  return String(v.email || v.Email || "").trim();
}

function getClientPhone(c) {
  const v = c?.values || {};
  return String(v.phone || v.Phone || "").trim();
}

function showClientDetail(client) {
    
  const detail = document.getElementById("client-detail-section");
  const list   = document.getElementById("client-list-container");

  if (detail) detail.style.display = "block";
  if (list)   list.style.display   = "none";

  const name  = getClientName(client);
  const email = getClientEmail(client);
  const phone = getClientPhone(client);

  const id = String(client?._id || client?.id || "").trim();
  window.STATE = window.STATE || {};
  window.STATE.selectedClientId = id;

  // ✅ Edit Client button → open quick edit mode
const editBtn = document.getElementById("btn-client-edit");
if (editBtn) {
  editBtn.onclick = () => {
    setClientsPopupView("quickEdit");  // show detail + quick edit form
    showQuickEditForm();              // prefill the form from selected client
  };
}

  // Save the selected client + their business so the appt popup can preselect both
const v = client?.values || {};
const clientBizId = String(
  v.businessId ||
  v.BusinessId ||
  (v.Business && (v.Business._id || v.Business.id || v.Business.value)) ||
  (Array.isArray(v.Business) ? v.Business[0] : "") ||
  ""
).trim();

window.STATE.selectedClientBusinessId = clientBizId;

  const nameEl  = document.getElementById("detail-name");
  const emailEl = document.getElementById("detail-email");
  const phoneEl = document.getElementById("detail-phone");

  if (nameEl)  nameEl.textContent  = name;
  if (emailEl) emailEl.textContent = email ? `Email: ${email}` : "";
  if (phoneEl) phoneEl.textContent = phone ? `Phone: ${phone}` : "";

// ✅ Add Appointment: close clients popup → open appointment popup + preselect biz/client
const addApptBtn = document.getElementById("btn-client-add-appt");
if (addApptBtn) {
  addApptBtn.onclick = async () => {
    try {
      // store selection for the appointment popup to use
      window.STATE = window.STATE || {};
      window.STATE.selectedClientId = id;
      window.STATE.selectedClientBusinessId = String(clientBizId || "").trim();

      // ✅ close the "View Clients" popup first
      closeClientListPopup();

      // ✅ then open appointment popup on next frame (prevents overlay flicker)
      requestAnimationFrame(async () => {
        await openAppointmentPopup?.();

        const preferredBiz = String(window.STATE?.selectedClientBusinessId || "").trim();

        // set business first
        const bizDD = document.getElementById("appointment-business");
        if (bizDD && preferredBiz) {
          bizDD.value = preferredBiz;
          await loadServicesForSelectedBusiness?.();
          await loadClientsForSelectedBusiness?.();
        }

        // then select client
        const cliDD = document.getElementById("appointment-client");
        if (cliDD) cliDD.value = String(window.STATE?.selectedClientId || "").trim();
      });
    } catch (e) {
      console.error("[client → appt] failed:", e);
    }
  };
}

const delBtn = document.getElementById("btn-client-delete");
if (delBtn) {
  delBtn.onclick = async () => {
    const id = String(window.STATE?.selectedClientId || "").trim();
    if (!id) return alert("No client selected.");

    if (!confirm("Soft delete this client? (You can restore later)")) return;

    try {
      await softDeleteClientById(id);

      // ✅ Remove from local list so it disappears immediately
      window.STATE.allClients = (window.STATE.allClients || []).filter(c => {
        const cid = String(c._id || c.id || "").trim();
        return cid !== id;
      });

      // ✅ Refresh list + go back
      renderClientsList(window.STATE.allClients || []);
      backToClientList();
    } catch (err) {
      console.error("[client] soft delete failed:", err);
      alert(err?.message || "Could not delete client");
    }
  };
}

}

function backToClientList() {
  document.getElementById("client-detail-section")?.style && (document.getElementById("client-detail-section").style.display = "none");
  document.getElementById("client-list-container")?.style && (document.getElementById("client-list-container").style.display = "block");
}
window.backToClientList = backToClientList;

async function loadAllClientsList() {
  const holder = document.getElementById("client-list-container");
  if (!holder) return;

  holder.innerHTML = `<div style="padding:10px;">Loading clients...</div>`;

  let rows = [];
  try {
    rows = await fetchAllClients();
  } catch (e) {
    console.error("[clients] list load failed:", e);
    holder.innerHTML = `<div style="padding:10px;">Failed to load clients.</div>`;
    return;
  }

  rows = rows.filter(clientBelongsToMe);
  rows.sort((a, b) => getClientName(a).localeCompare(getClientName(b)));
rows = rows.filter(c => !(c?.deletedAt || c?.values?.deletedAt || c?.values?.isDeleted));

  window.STATE = window.STATE || {};
  window.STATE.allClients = rows;

  if (!rows.length) {
    holder.innerHTML = `<div style="padding:10px;">No clients yet.</div>`;
    return;
  }

  // ✅ only render ONE way (the searchable way)
  renderClientsList(rows);
  wireClientSearch();
}


// make callable from openClientListPopup()
window.loadAllClientsList = loadAllClientsList;

// ==============================
// ✅ add new client
// ==============================
function showQuickEditForm() {
  const listEl   = document.getElementById("client-list-container");
  const detailEl = document.getElementById("client-detail-section");
  const formEl   = document.getElementById("client-quick-edit-form");

  if (listEl)   listEl.style.display = "none";     // ✅ hide list
  if (detailEl) detailEl.style.display = "block";  // ✅ show detail
  if (formEl)   formEl.style.display = "block";    // ✅ show quick edit

  // ✅ Prefill inputs from selected client (stored when you click a client row)
  const selectedId = String(window.STATE?.selectedClientId || "").trim();
  const clients = window.STATE?.allClients || [];
  const client = clients.find(c => String(c._id || c.id || "") === selectedId);

if (client) {
  const v = client.values || {};

  const first = String(v.firstName || v.FirstName || "").trim();
  const last  = String(v.lastName  || v.LastName  || "").trim();

  const email = getClientEmail(client); // ✅ use helper
  const phone = getClientPhone(client); // ✅ use helper

  const firstEl = document.getElementById("qe-first");
  const lastEl  = document.getElementById("qe-last");
  const emailEl = document.getElementById("qe-email");
  const phoneEl = document.getElementById("qe-phone");

  if (firstEl) firstEl.value = first;
  if (lastEl)  lastEl.value  = last;
  if (emailEl) emailEl.value = email || "";
  if (phoneEl) phoneEl.value = phone || "";
}

}


function hideQuickEditFormBackToList() {
  document.getElementById("client-quick-edit-form").style.display = "none";
  document.getElementById("client-detail-section").style.display = "none";
  document.getElementById("client-list-container").style.display = "block";
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("qe-cancel")?.addEventListener("click", hideQuickEditFormBackToList);
});

function showAddClientSection() {
  const addBtn  = document.getElementById("toggle-add-client-btn");
  const section = document.getElementById("inline-add-client-section");

  // show the add-client section
  if (section) section.style.display = "block";

  // hide the button while open
  if (addBtn) addBtn.style.display = "none";

  // (optional) hide the list while adding
  const list = document.getElementById("client-list-container");
  if (list) list.style.display = "none";
}

// make sure onclick works
window.showAddClientSection = showAddClientSection;

function hideAddClientSection() {
  const addBtn  = document.getElementById("toggle-add-client-btn");
  const section = document.getElementById("inline-add-client-section");
  const list    = document.getElementById("client-list-container");

  if (section) section.style.display = "none";
  if (addBtn)  addBtn.style.display = "inline-flex"; // or "block"
  if (list)    list.style.display = "block";
}

window.hideAddClientSection = hideAddClientSection;

// ==============================
// ✅ Update  Client 
// ==============================





// ==============================
// ✅ Delete Client 
// ==============================
async function softDeleteClientById(clientId) {
  const res = await api(`/api/records/Client/${encodeURIComponent(clientId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      values: {
        deletedAt: new Date().toISOString(),
        isDeleted: true, // optional but helpful
      },
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || "Soft delete failed");
  return data?.item || data?.record || data;
}



// ==============================
// ✅ Clients Popup View Controller
// ==============================

function setClientsPopupView(view) {
   const summary = document.getElementById("client-detail-summary"); 
  const actionsTop = document.getElementById("client-detail-actions"); // ✅ top 3 buttons container
  const qeDelete   = document.getElementById("qe-delete");            // ✅ bottom delete button

  const addBtn   = document.getElementById("toggle-add-client-btn");
  const addSec   = document.getElementById("inline-add-client-section");
  const list     = document.getElementById("client-list-container");
  const detail   = document.getElementById("client-detail-section");
  const quick    = document.getElementById("client-quick-edit-form");

  // safety hide
  if (addBtn) addBtn.style.display = "none";
  if (addSec) addSec.style.display = "none";
  if (list)   list.style.display   = "none";
  if (detail) detail.style.display = "none";
  if (quick)  quick.style.display  = "none";
   if (summary) summary.style.display = "block";

  // default show/hide for these
  if (actionsTop) actionsTop.style.display = "none";   // ✅ default hidden
  if (qeDelete)   qeDelete.style.display   = "none";   // ✅ default hidden

  if (view === "list") {
    if (addBtn) addBtn.style.display = "inline-flex";
    if (list)   list.style.display   = "block";
  }

  if (view === "detail") {
    if (detail) detail.style.display = "block";
    if (actionsTop) actionsTop.style.display = "flex"; // ✅ show top buttons ONLY in detail mode
   if (summary) summary.style.display = "block"; // ✅ show email/phone in detail mode
   }

  if (view === "add") {
    if (addSec) addSec.style.display = "block";
  }

  if (view === "quickEdit") {
    if (detail) detail.style.display = "block";
    if (quick)  quick.style.display  = "block";

    if (actionsTop) actionsTop.style.display = "none"; // ✅ hide top buttons in edit mode
    if (qeDelete)   qeDelete.style.display   = "inline-flex"; // ✅ show bottom delete
     if (summary) summary.style.display = "none"; // ✅ HIDE email/phone at top in edit mode
     }
}

document.addEventListener("DOMContentLoaded", () => {
  const qeDelete = document.getElementById("qe-delete");
  if (!qeDelete) return;

  qeDelete.addEventListener("click", async () => {
    const id = String(window.STATE?.selectedClientId || "").trim();
    if (!id) return alert("No client selected.");

    if (!confirm("Soft delete this client? (You can restore later)")) return;

    try {
      await softDeleteClientById(id);

      window.STATE.allClients = (window.STATE.allClients || []).filter(c => {
        const cid = String(c._id || c.id || "").trim();
        return cid !== id;
      });

      // go back to list after delete
      renderClientsList(window.STATE.allClients || []);
      setClientsPopupView("list");
    } catch (err) {
      console.error("[client] soft delete failed:", err);
      alert(err?.message || "Could not delete client");
    }
  });
});

function showAddClientSection() {
  setClientsPopupView("add");         // ✅ hides the button automatically
}
window.showAddClientSection = showAddClientSection;

function backToClientList() {
  setClientsPopupView("list");
}
window.backToClientList = backToClientList;

// ==============================
// ✅ Client Search Bar
// ==============================
function renderClientsList(rows) {
  const holder = document.getElementById("client-list-container");
  if (!holder) return;

  if (!rows || !rows.length) {
    holder.innerHTML = `<div style="padding:10px;">No matches.</div>`;
    return;
  }

  holder.innerHTML = rows
    .map((c) => {
      const id = String(c._id || c.id || "").trim();
      const name = getClientName(c);
      const email = getClientEmail(c);
      const phone = getClientPhone(c);

      return `
        <div class="client-row" data-client-id="${id}"
             style="padding:12px;border:1px solid #eee;border-radius:10px;margin-bottom:10px;cursor:pointer;">
          <div style="font-weight:700;">${name}</div>
          <div style="opacity:.8;font-size:13px;">
            ${email ? email : ""}${email && phone ? " • " : ""}${phone ? phone : ""}
          </div>
        </div>
      `;
    })
    .join("");

  // click → detail view
  holder.querySelectorAll(".client-row").forEach((rowEl) => {
    rowEl.addEventListener("click", () => {
      const id = rowEl.getAttribute("data-client-id");
      const all = window.STATE?.allClients || [];
      const client = all.find((x) => String(x._id || x.id || "") === String(id));
      if (client) showClientDetail(client);
    });
  });
}

function wireClientSearch() {
  const input = document.getElementById("client-search-input");
  const meta  = document.getElementById("client-search-meta");
  if (!input) return;

  // prevent double-binding if popup opens multiple times
  if (input.dataset.wired === "1") return;
  input.dataset.wired = "1";

  const apply = () => {
    const q = String(input.value || "").trim().toLowerCase();
    const all = window.STATE?.allClients || [];

    let filtered = all;

    if (q) {
      // "A" → starts-with behavior, "Al" → starts-with too
      filtered = all.filter((c) => {
        const name = getClientName(c).toLowerCase();
        const email = getClientEmail(c).toLowerCase();
        const phone = getClientPhone(c).toLowerCase();

        // starts-with priority, but allow contains as backup
        return (
          name.startsWith(q) ||
          email.startsWith(q) ||
          phone.startsWith(q) ||
          name.includes(q) ||
          email.includes(q) ||
          phone.includes(q)
        );
      });
    }

    renderClientsList(filtered);

    if (meta) {
      meta.textContent = q
        ? `${filtered.length} match(es) for “${input.value}”`
        : `${all.length} total clients`;
    }
  };

  input.addEventListener("input", apply);

  // optional: quick clear with Escape
  input.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      input.value = "";
      apply();
    }
  });

  // initial meta
  apply();
}


































                                                ////////////////////////////////////////////////////
                                                      // New Client Popup
function openClientPopup() {
  const pop = document.getElementById("popup-create-client");
  const ovl = document.getElementById("popup-overlay");

  if (pop) pop.style.display = "block";
  if (ovl) ovl.style.display = "block";
  document.body.classList.add("popup-open");

  // ✅ load businesses into the client-business dropdown
  // (this uses your existing loadUserBusinesses() that fills #client-business too)
  try { loadUserBusinesses?.(); } catch {}

  // ✅ optional: preselect business from appointment popup (if it’s open)
  const apptBiz = document.getElementById("appointment-business")?.value || "";
  const clientBiz = document.getElementById("client-business");
  if (clientBiz && apptBiz) clientBiz.value = apptBiz;
}

function closeClientPopup() {
  const pop = document.getElementById("popup-create-client");
  const ovl = document.getElementById("popup-overlay");

  if (pop) pop.style.display = "none";
  // only hide overlay if NO other popup is open (optional safety)
  if (ovl) ovl.style.display = "none";

  document.body.classList.remove("popup-open");

  // optional: reset the form
  document.getElementById("create-client-form")?.reset?.();
}

// ✅ make onclick="" work
window.openClientPopup = openClientPopup;
window.closeClientPopup = closeClientPopup;


//Save Client 
function wireCreateClientForm() {
  const form = document.getElementById("create-client-form");
  if (!form) return;
  if (form.dataset.wired === "1") return;
  form.dataset.wired = "1";

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    try {
      const myId = String(window.STATE?.userId || "").trim();
      if (!myId) return alert("Please login first.");

      const bizId = String(document.getElementById("client-business")?.value || "").trim();
      if (!bizId) return alert("Select a business.");

      const first = String(document.getElementById("client-name")?.value || "").trim();
      const last  = String(document.getElementById("client-last-name")?.value || "").trim();
      const email = String(document.getElementById("client-email")?.value || "").trim();
      const phone = String(document.getElementById("client-phone")?.value || "").trim();

      if (!first && !last && !email) return alert("Enter at least a name or email.");

      const values = {
        // ✅ client fields
        firstName: first,
        lastName: last,
        email,
        phone,

        // ✅ link to business
        businessId: bizId,
        BusinessId: bizId,

        // ✅ link to pro (owner)
        Pro: { _id: myId },
        proUserId: myId,
        createdByProId: myId, // optional extra alias (safe)
      };

      const res = await api(`/api/records/${encodeURIComponent("Client")}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ values }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || "Failed to save client");

      // ✅ unwrap + grab id
      const created = data?.item || data?.record || data;
      const newId = String(created?._id || created?.id || "").trim();

      // ✅ close popup
      closeClientPopup();

      // ✅ refresh the appointment popup dropdown
      // If appointment popup is open, keep same selected business + select the new client
      if (typeof loadClientsForSelectedBusiness === "function") {
        await loadClientsForSelectedBusiness();
        if (newId) {
          const dd = document.getElementById("appointment-client");
          if (dd) dd.value = newId;
        }
      }

    } catch (err) {
      console.error("[client] save failed:", err);
      alert(err?.message || "Failed to save client");
    }
  });
}

// expose if needed
window.wireCreateClientForm = wireCreateClientForm;





                                              ////////////////////////////////////////////////////
                                                             // Add Appointment
function wireAppointmentBusinessChange() {
  const bizDD = document.getElementById("appointment-business");
  if (!bizDD) return;

  if (bizDD.dataset.wired === "1") return;
  bizDD.dataset.wired = "1";

bizDD.addEventListener("change", async () => {
  console.log("[appt popup] business changed:", bizDD.value);
  await loadServicesForSelectedBusiness();
  if (!window.STATE?.showAllClients) {
    await loadClientsForSelectedBusiness();
  }
});

}

                 
 //Open add appointment popup 
      // ==============================
// ✅ Appointment Popup open/close
// ==============================

async function openAppointmentPopup() {
  const pop = document.getElementById("popup-create-appointment");
  const ovl = document.getElementById("popup-overlay");
  if (pop) pop.style.display = "block";
  if (ovl) ovl.style.display = "block";
  document.body.classList.add("popup-open");

  // ✅ make sure the change listener exists (only wires once)
  wireAppointmentBusinessChange();
wireAppointmentServiceChange();
wireInlineClientButtons();
wireShowAllClientsToggle();

wireCreateAppointmentForm(); // ✅ IMPORTANT: lets Save submit run

  // ✅ load businesses into the popup dropdown
  await loadUserBusinesses();

  // ✅ optionally preselect same business as main dropdown
// ✅ prefer business coming from client-detail click
const preferredBiz =
  String(window.STATE?.preselectBusinessId || "").trim() ||
  String(document.getElementById("business-dropdown")?.value || "").trim();

const apptBiz = document.getElementById("appointment-business");
if (apptBiz && preferredBiz) apptBiz.value = preferredBiz;


  // ✅ after setting the value, manually load dependent dropdowns once
  await loadServicesForSelectedBusiness();
  await loadClientsForSelectedBusiness();
}

function closeAppointmentPopup() {
  const pop = document.getElementById("popup-create-appointment");
  const ovl = document.getElementById("popup-overlay");
  if (pop) pop.style.display = "none";
  if (ovl) ovl.style.display = "none";
  document.body.classList.remove("popup-open");

  // Optional: reset form + hide inline new-client fields
  document.getElementById("create-appointment-form")?.reset?.();
  const newClient = document.getElementById("new-client-fields");
  if (newClient) newClient.style.display = "none";

  // ✅ ADD THESE TWO LINES:
  window.STATE = window.STATE || {};
  window.STATE.editingAppointmentId = null;
  setAppointmentPopupMode("create");
}

// 👇 this makes inline onclick="" work even when code is module-scoped
window.openAppointmentPopup = openAppointmentPopup;
window.closeAppointmentPopup = closeAppointmentPopup;
            
// ==============================
// ✅ Services dropdown (depends on selected business)
// ==============================
// cache so we can look up a service after dropdown selection
window.STATE = window.STATE || {};
window.STATE.servicesByBiz = window.STATE.servicesByBiz || {}; // { [bizId]: [services] }

function getServiceDurationMin(service) {
  const v = service?.values || service || {};

  const candidates = [
    v.durationMinutes, 
    v.DurationMin,
    v["DurationMin"],
    v["Duration (min)"],
    v["Duration (mins)"],
    v["Service Duration"],
    v.Minutes,
    v.Duration,
    v.duration,
  ];

  for (const c of candidates) {
    if (c == null) continue;

    const num = Number(c);
    if (Number.isFinite(num) && num > 0) return Math.round(num);

    if (typeof c === "string") {
      const s = c.toLowerCase().trim();
      const h = /(\d+(\.\d+)?)\s*h/.exec(s)?.[1];
      const m = /(\d+)\s*m/.exec(s)?.[1];
      if (h || m) return Math.round((h ? Number(h) * 60 : 0) + (m ? Number(m) : 0));

      const digits = Number(s.replace(/[^\d.]/g, ""));
      if (Number.isFinite(digits) && digits > 0) return Math.round(digits);
    }
  }
  return 30; // fallback default
}

async function fetchServicesForBusiness(businessId) {
  if (!businessId) return [];

  const url = `/api/records/Service?limit=5000&ts=${Date.now()}`;
  const res = await api(url);

  const raw = await res.text().catch(() => "");
  let data = null;
  try { data = raw ? JSON.parse(raw) : null; } catch {}

  console.log("[services] url:", url);
  console.log("[services] status:", res.status);
  console.log("[services] raw:", raw);
  console.log("[services] parsed:", data);

  if (!res.ok) throw new Error((data && data.message) || "Failed to load services");

  const rows = toItems(data);

  // filter client-side by business id (handles any field name weirdness)
const filtered = rows.filter((s) => {
  const v = s.values || {};

  // handle Business stored as:
  // 1) ["bizId"]
  // 2) "bizId"
  // 3) { _id: "bizId" }
  // 4) businessId / BusinessId
  const b = v.Business ?? v.business ?? null;

  let biz =
    v.businessId ||
    v.BusinessId ||
    v["Business Id"] ||
    v["BusinessID"] ||
    "";

  // If Business is array: ["id"]
  if (!biz && Array.isArray(b) && b[0]) biz = b[0];

  // If Business is object: {_id:"id"}
  if (!biz && b && typeof b === "object") biz = b._id || b.id || b.value || "";

  // If Business is string
  if (!biz && typeof b === "string") biz = b;

  return String(biz).trim() === String(businessId).trim();
});


  console.log("[services] total:", rows.length, "filtered:", filtered.length);
  
  if (!filtered.length) {
  const ids = Array.from(
    new Set(
      rows.map(s => {
        const v = s.values || {};
        return String(
          (v.Business && (v.Business._id || v.Business.id)) ||
          v.businessId ||
          v.BusinessId ||
          ""
        ).trim();
      }).filter(Boolean)
    )
  );

  console.warn("[services] NO matches for bizId:", businessId);
  console.warn("[services] services belong to businessIds:", ids);
  console.warn("[services] selected bizId:", businessId);
}

  return filtered;
}


function getServiceName(s) {
  const v = s?.values || s || {};
  return String(
    v.Name ||
    v.name ||
    v.serviceName ||
    v.ServiceName ||
    v["Service Name"] ||
    v.title ||
    "(Unnamed service)"
  ).trim() || "(Unnamed service)";
}


async function loadServicesForSelectedBusiness() {
  const bizId = String(document.getElementById("appointment-business")?.value || "").trim();
  const serviceDD = document.getElementById("appointment-service");
  const durInput  = document.getElementById("appointment-duration"); // <-- your duration input
  if (!serviceDD) return;

  serviceDD.innerHTML = `<option value="">-- Select Service --</option>`;
const editingId = String(window.STATE?.editingAppointmentId || "").trim();
if (durInput && !editingId) durInput.value = ""; // reset only in create mode

  if (!bizId) return;

  serviceDD.innerHTML = `<option value="">Loading...</option>`;

  try {
    const rows = await fetchServicesForBusiness(bizId);
console.log("[services] rows for biz", bizId, rows);

    // ✅ cache for later lookup when user changes dropdown
    window.STATE.servicesByBiz[bizId] = rows;

    serviceDD.innerHTML =
      `<option value="">-- Select Service --</option>` +
      rows.map((s) => {
        const id = String(s._id || s.id || "");
        const name = getServiceName(s);
        return `<option value="${id}">${name}</option>`;
      }).join("");

    // ✅ optional: if there’s already a selected service, prefill duration now
    const selectedId = String(serviceDD.value || "").trim();
    if (selectedId && durInput) {
      const svc = rows.find(r => String(r._id || r.id || "") === selectedId);
      if (svc) durInput.value = getServiceDurationMin(svc);
    }
  } catch (err) {
    console.error("[services] load failed:", err);
    serviceDD.innerHTML = `<option value="">Failed to load services</option>`;
  }
}

function wireAppointmentServiceChange() {
  const dd = document.getElementById("appointment-service");
  if (!dd) return;
  if (dd.dataset.wired === "1") return;
  dd.dataset.wired = "1";

  dd.addEventListener("change", () => {
    const bizId = String(document.getElementById("appointment-business")?.value || "").trim();
    const services = window.STATE?.servicesByBiz?.[bizId] || [];
    const id = String(dd.value || "").trim();

    const svc = services.find(s => String(s._id || s.id || "") === id);

    // ✅ set duration
    const durInput = document.getElementById("appointment-duration");
    if (durInput) durInput.value = svc ? getServiceDurationMin(svc) : "";

    // ✅ detect calendarId from service
    const calId = svc ? getServiceCalendarId(svc) : "";
    window.STATE.selectedCalendarIdForAppt = calId;
    console.log("[appt] selected service calendarId =", calId);
  });
}




// ==============================
// ✅ Inline Add Client (MATCHES YOUR HTML IDS)
// ==============================



async function readJsonSafe(res) {
  try {
    return await res.json();
  } catch {
    return {};
  }
}

function toggleInlineClientFields(show) {
  const box = document.getElementById("new-client-fields");
  if (!box) return;
  box.style.display = show ? "block" : "none";
}

function clearInlineClientInputs() {
  const ids = [
    "new-client-first-name",
    "new-client-last-name",
    "new-client-email",
    "new-client-phone",
  ];
  ids.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
}

async function createClientForSelectedBusiness(payload) {
  const res = await api(`/api/records/${encodeURIComponent("Client")}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ values: payload }),
  });

  const data = await readJsonSafe(res);
  if (!res.ok) throw new Error(data?.message || "Failed to create client");

  return (
    data?.item ||
    data?.record ||
    (Array.isArray(data?.items) ? data.items[0] : null) ||
    data
  );
}


// IMPORTANT: this function must already exist in your code.
// If your function has a different name, change it below.
async function reloadClientsAndKeepSelection(selectIdToSet) {
  if (typeof loadClientsForSelectedBusiness !== "function") {
    console.warn("Missing function: loadClientsForSelectedBusiness()");
    return;
  }

  await loadClientsForSelectedBusiness();

  // select the new client
  const dd = document.getElementById("appointment-client");
  if (dd && selectIdToSet) dd.value = selectIdToSet;
}

function extractIdFromCreateResponse(created) {
  // supports lots of shapes
  const id =
    created?._id ||
    created?.id ||
    created?.item?._id ||
    created?.item?.id ||
    created?.record?._id ||
    created?.record?.id ||
    created?.data?._id ||
    created?.data?.id;

  return id ? String(id).trim() : "";
}
 
function wireInlineClientButtons() {
  const plusBtn = document.getElementById("btn-new-client");
  const cancelBtn = document.getElementById("cancel-new-client-btn");
  const saveBtn = document.getElementById("save-inline-client-btn");

  // input elements
  const firstEl = document.getElementById("new-client-first-name");
  const lastEl  = document.getElementById("new-client-last-name");
  const emailEl = document.getElementById("new-client-email");
  const phoneEl = document.getElementById("new-client-phone");

  if (plusBtn && plusBtn.dataset.wired !== "1") {
    plusBtn.dataset.wired = "1";
    plusBtn.addEventListener("click", () => {
      toggleInlineClientFields(true);
      firstEl?.focus();
    });
  }

  if (cancelBtn && cancelBtn.dataset.wired !== "1") {
    cancelBtn.dataset.wired = "1";
    cancelBtn.addEventListener("click", () => {
      toggleInlineClientFields(false);
      clearInlineClientInputs();
    });
  }

  if (saveBtn && saveBtn.dataset.wired !== "1") {
    saveBtn.dataset.wired = "1";
    saveBtn.addEventListener("click", async () => {
      try {
        const bizId = String(
          document.getElementById("appointment-business")?.value || ""
        ).trim();

        if (!bizId) {
          alert("Select a business first.");
          return;
        }

        const first = (firstEl?.value || "").trim();
        const last  = (lastEl?.value || "").trim();
        const email = (emailEl?.value || "").trim();
        const phone = (phoneEl?.value || "").trim();

        if (!first && !last && !email) {
          alert("Enter at least a name or email.");
          return;
        }

        const values = {
          firstName: first,
          lastName: last,
          email,
          phone,
          businessId: bizId,   // ✅ link client to business
          BusinessId: bizId,   // optional alias if your data uses it sometimes
        };

  const created = await createClientForSelectedBusiness(values);

// LOG IT so we see the real server response
console.log("[create client] created =", created);

const newId = extractIdFromCreateResponse(created);
if (!newId) throw new Error("Client saved but no id returned. Check console log.");

await reloadClientsAndKeepSelection(newId);

// ✅ Collapse + clear
collapseInlineClientBox();     // or toggleInlineClientFields(false)
clearInlineClientInputs();

      } catch (err) {
        console.error("[inline client] save failed:", err);
        alert(err?.message || "Failed to save client");
      }
    });
  }
}

//Save Client 
async function saveInlineClientAndCollapse() {
  const bizId = String(document.getElementById("appointment-business")?.value || "").trim();
  if (!bizId) return alert("Select a business first.");

  const first = (document.getElementById("new-client-first-name")?.value || "").trim();
  const last  = (document.getElementById("new-client-last-name")?.value || "").trim();
  const email = (document.getElementById("new-client-email")?.value || "").trim();
  const phone = (document.getElementById("new-client-phone")?.value || "").trim();

  const values = { firstName: first, lastName: last, email, phone, businessId: bizId };

  const res = await api(`/api/records/${encodeURIComponent("Client")}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ values }),
  });

  const data = await readJsonSafe(res);
  console.log("[create client] response:", data); // 👈 this will show you the real shape
  if (!res.ok) throw new Error(data?.message || "Failed to save client");

  // ✅ Try to get id from any shape
  let newClientId = extractIdFromCreateResponse(data);

  // ✅ Fallback: reload clients and select by email/phone if no id returned
  if (typeof loadClientsForSelectedBusiness === "function") {
    await loadClientsForSelectedBusiness();
  }

  if (!newClientId) {
    // try to find in cached clients if you store them
    const list = window.STATE?.clients || window.clients || [];
    const found = Array.isArray(list)
      ? list.find(c => {
          const v = c.values || c;
          return (email && String(v.email || "").toLowerCase() === email.toLowerCase()) ||
                 (phone && String(v.phone || "") === phone);
        })
      : null;

    newClientId = String(found?._id || found?.id || "").trim();
  }

  // ✅ Select in dropdown if we have it
  if (newClientId) {
    const dd = document.getElementById("appointment-client");
    if (dd) dd.value = newClientId;
  }

  // ✅ Minimize/close the add-client section no matter what
  collapseInlineClientBox();
  clearInlineClientInputs();
}


function collapseInlineClientBox() {
  const box = document.getElementById("new-client-fields");
  if (!box) return;

  box.style.overflow = "hidden";
  box.style.transition = "max-height 200ms ease, opacity 200ms ease";
  box.style.maxHeight = box.scrollHeight + "px";

  requestAnimationFrame(() => {
    box.style.maxHeight = "0px";
    box.style.opacity = "0";
  });

  setTimeout(() => {
    box.style.display = "none";
    box.style.maxHeight = "";
    box.style.opacity = "";
    box.style.transition = "";
    box.style.overflow = "";
  }, 220);
}



document.getElementById("cancel-new-client-btn")?.addEventListener("click", () => {
  collapseInlineClientBox();
  clearInlineClientInputs();
});

function extractIdFromCreateResponse(data) {
  const tryGet = (x) => (x && (x._id || x.id || x.itemId || x.recordId)) ? String(x._id || x.id || x.itemId || x.recordId) : "";

  // common shapes
  let id =
    tryGet(data) ||
    tryGet(data?.item) ||
    tryGet(data?.record) ||
    tryGet(data?.data) ||
    tryGet(data?.result) ||
    tryGet(data?.created);

  // arrays
  if (!id && Array.isArray(data?.items) && data.items[0]) id = tryGet(data.items[0]);
  if (!id && Array.isArray(data?.records) && data.records[0]) id = tryGet(data.records[0]);

  return id || "";
}

// ==============================
// ✅ Clients dropdown (from appointments for selected business)
// ==============================

function extractBizIdFromAppt(a) {
  const v = a?.values || {};
  const b = v.Business || v.business || null;

  // Business stored as object in your appt ✅
  if (b && typeof b === "object") {
    return String(b._id || b.id || b.value || "");
  }

  // fallback shapes
  return String(v.businessId || v.BusinessId || v["Business Id"] || "");
}

function extractClientFromAppt(a) {
  const v = a?.values || {};

  // 1) BEST: appointment already stores the name somewhere
  const apptName =
    v["Client Name"] ||
    v.ClientName ||
    v.clientName ||
    [v.ClientFirstName || v.clientFirstName || "", v.ClientLastName || v.clientLastName || ""]
      .filter(Boolean)
      .join(" ")
      .trim() ||
    v.ClientEmail ||
    v.clientEmail ||
    "";

  // 2) Client reference object (may not include a name)
  const c = v.Client || v.client || null;
  if (c && typeof c === "object") {
    const id = c._id || c.id || c.value || c.recordId || "";
    const refName =
      c.name ||
      c.fullName ||
      [c.firstName || "", c.lastName || ""].filter(Boolean).join(" ").trim() ||
      c.email ||
      "";

    return { id: String(id), name: String(apptName || refName || "") };
  }

  // 3) fallback if stored as id string
  const id = v.clientId || v.ClientId || v["Client Id"] || "";
  return { id: String(id), name: String(apptName || "") };
}

async function loadClientsForSelectedBusiness() {
  const bizId = String(document.getElementById("appointment-business")?.value || "").trim();
  const dd = document.getElementById("appointment-client");
  if (!dd) return;

  window.STATE = window.STATE || {};
  const showAll = !!window.STATE.showAllClients;

  dd.innerHTML = `<option value="">Loading...</option>`;

  // If NOT showing all, you need a business selected to filter
  if (!showAll && !bizId) {
    dd.innerHTML = `<option value="">-- Select Client --</option>`;
    return;
  }

  const url = `/api/records/Client?limit=5000&ts=${Date.now()}`;
  let res, raw, data;

  try {
    res = await api(url);
    raw = await res.text().catch(() => "");
    try { data = raw ? JSON.parse(raw) : {}; } catch { data = {}; }

    console.log("[clients] url:", url);
    console.log("[clients] status:", res.status);
    console.log("[clients] raw:", raw);

    if (!res.ok) {
      dd.innerHTML = `<option value="">(Clients failed to load)</option>`;
      return; // ✅ do NOT throw
    }
  } catch (e) {
    console.error("[clients] fetch failed:", e);
    dd.innerHTML = `<option value="">(Clients failed to load)</option>`;
    return;
  }

const rows = toItems(data);
const aliveRows = rows.filter(c => !(c?.deletedAt || c?.values?.deletedAt || c?.values?.isDeleted));

  // ✅ handle business saved as array OR string OR object (same issue as Services)
 const clients = showAll
 ? aliveRows
  : aliveRows.filter((c) =>  {
      const v = c.values || {};

      // possible storage shapes:
      // v.businessId = "..."
      // v.BusinessId = "..."
      // v.Business = ["..."]
      // v.Business = { _id: "..." }

      let bid =
        v.businessId ||
        v.BusinessId ||
        v["Business Id"] ||
        v["BusinessID"] ||
        "";

      const b = v.Business ?? v.business ?? null;

      if (!bid && Array.isArray(b) && b[0]) bid = b[0];
      if (!bid && b && typeof b === "object") bid = b._id || b.id || b.value || "";
      if (!bid && typeof b === "string") bid = b;

      return String(bid).trim() === String(bizId).trim();
    });


  dd.innerHTML =
    `<option value="">-- Select Client --</option>` +
    clients.map((c) => {
      const id = String(c._id || c.id || "");
      const v = c.values || {};
const name =
  String(
    `${v.firstName || v.FirstName || ""} ${v.lastName || v.LastName || ""}`.trim() ||
    v.Name ||
    v["Client Name"] ||
    v.fullName ||
    v.email ||
    v.Email ||
    v.phone ||
    v.Phone ||
    ""
  ).trim() || "(Client)";

      return `<option value="${id}">${name}</option>`;
    }).join("");

  window.STATE.clients = clients;
}


// ==============================
// ✅ Save appointment 
// ==============================
//helper
async function createAppointment(values) {
  const res = await api(`/api/records/${encodeURIComponent("Appointment")}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ values }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || "Failed to create appointment");

  return data?.item || data?.record || data;
}

async function appointmentOverlapsExisting({ calendarId, dateStr, timeStr, durationMin }) {
  const newStart = new Date(`${dateStr}T${timeStr}:00`).getTime();
  const newEnd = newStart + durationMin * 60000;

  const appts = await fetchAppointmentsWhereImPro();

  return appts.some(a => {
    const v = a.values || {};
    const cal = String(
      v.calendarId ||
      v.CalendarId ||
      (v.Calendar && (v.Calendar._id || v.Calendar.id)) ||
      ""
    ).trim();

    if (cal !== calendarId) return false;

    const dt = getApptStartDateTime(a);
    if (!dt) return false;

    const start = dt.getTime();
    const dur = Number(v.DurationMin || v.Duration || v.duration || 30) || 30;
    const end = start + dur * 60000;

    return newStart < end && start < newEnd; // overlap
  });
}


function wireCreateAppointmentForm() {
  const form = document.getElementById("create-appointment-form");
  if (!form) return;

  if (form.dataset.wired === "1") return;
  form.dataset.wired = "1";

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    try {
      const bizDD = document.getElementById("appointment-business");
      const svcDD = document.getElementById("appointment-service");
      const cliDD = document.getElementById("appointment-client");

      const businessId = String(bizDD?.value || "").trim();
      const serviceId  = String(svcDD?.value || "").trim();
      const clientId   = String(cliDD?.value || "").trim();

      const businessName = bizDD?.selectedOptions?.[0]?.textContent?.trim() || "";
      const serviceName  = svcDD?.selectedOptions?.[0]?.textContent?.trim() || "";
      const clientName   = cliDD?.selectedOptions?.[0]?.textContent?.trim() || "";

      const dateStr = String(document.getElementById("appointment-date")?.value || "").trim();
      const timeStr = String(document.getElementById("appointment-time")?.value || "").trim();
      const durationMin = Number(document.getElementById("appointment-duration")?.value || 0);
const calendarId = String(window.STATE?.selectedCalendarIdForAppt || "").trim();
if (!calendarId) {
  alert("This service is not linked to a calendar. Pick a service that belongs to a calendar.");
  return;
}
const hasOverlap = await appointmentOverlapsExisting({ calendarId, dateStr, timeStr, durationMin });

const role = String(window.STATE?.role || window.currentUser?.role || "pro").toLowerCase();
// On this page you can even force: const role = "pro";

if (hasOverlap && role === "client") {
  alert("That time overlaps an existing appointment for this calendar.");
  return;
}

// ✅ pro/admin: allow it
if (hasOverlap) console.warn("[overlap] allowed for pro/admin");


      if (!businessId) return alert("Select a business.");
      if (!serviceId)  return alert("Select a service.");
      if (!clientId)   return alert("Select a client.");
      if (!dateStr)    return alert("Select a date.");
      if (!timeStr)    return alert("Select a time.");
      if (!Number.isFinite(durationMin) || durationMin <= 0) return alert("Enter a valid duration.");

      const startLocal = new Date(`${dateStr}T${timeStr}:00`);
      if (isNaN(startLocal.getTime())) return alert("Invalid date/time.");

      const myId = String(window.STATE?.userId || "").trim();

      const values = {
        // ✅ link/filter fields
        BusinessId: businessId,
        businessId: businessId,
        Business: { _id: businessId, name: businessName },
  calendarId,
  CalendarId: calendarId,
  Calendar: { _id: calendarId }, // optional
        ServiceId: serviceId,
        serviceId: serviceId,
        Service: { _id: serviceId, name: serviceName },

        ClientId: clientId,
        clientId: clientId,
        Client: { _id: clientId, name: clientName },

        // ✅ time fields your painter reads
        Date: dateStr,
        Time: timeStr,
        DurationMin: durationMin,
        startDateTime: startLocal.toISOString(),

        // ✅ pro link (matches your fetchAppointmentsWhereImPro filter)
        Pro: { _id: myId },
        proUserId: myId,
      };

      const editingId = String(window.STATE?.editingAppointmentId || "").trim();

let saved;
if (editingId) {
  saved = await updateAppointment(editingId, values);
} else {
  saved = await createAppointment(values);
}
console.log("[appointment] saved:", saved);

     console.log("[appointment] saved:", saved);


      // ✅ close once + refresh once
    closeAppointmentPopup();

// 1) repaint the calendar
window.refreshCalendarAppointments?.(window.currentWeekDates || []);
// if you have selected date UI, re-run load slots for that date + calendar
window.loadSlotsForCalendarDate?.(calendarId, dateStr);
// 2) refresh availability timeslots if your UI has them
// (call whatever function renders available slots)
window.refreshAvailability?.(); 
// OR if you have selected date context:
window.renderTimeSlotsForSelectedDate?.();

    } catch (err) {
      console.error("[appointment] save failed:", err);
      alert(err?.message || "Failed to save appointment");
    }
  });
}

function overlaps(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd; // true if overlap
}
function layoutAllOverlaps() {
  document.querySelectorAll(".time-column").forEach(col => {
    // reset first
    col.querySelectorAll(".appointment-card").forEach(card => {
      card.style.left = "0px";
      card.style.width = "100%";
    });
    layoutOverlapsInColumn(col);
  });
}
window.layoutAllOverlaps = layoutAllOverlaps;

async function getBookedRangesForDay({ bizId, dateStr }) {
  const appts = await fetchAppointmentsWhereImPro();

  return appts
    .filter((a) => {
      // match business
      const v = a.values || {};
      const b =
        (v.Business && (v.Business._id || v.Business.id)) ||
        v.businessId || v.BusinessId || "";
      if (String(b) !== String(bizId)) return false;

      // match day
      const dt = getApptStartDateTime(a);
      if (!dt) return false;
      const d = dt.toISOString().slice(0, 10); // "YYYY-MM-DD"
      return d === dateStr;
    })
    .map((a) => {
      const v = a.values || {};
      const dt = getApptStartDateTime(a);
      const dur =
        Number(v.DurationMin || v.Duration || v.duration || 30) || 30;

      const start = dt.getTime();
      const end = start + dur * 60000;
      return { start, end };
    });
}

function slotIsFree(slotStartMs, serviceDurationMin, bookedRanges) {
  const slotEndMs = slotStartMs + serviceDurationMin * 60000;
  return !bookedRanges.some(r => slotStartMs < r.end && r.start < slotEndMs);
}

async function renderAvailabilityForDay({ bizId, dateStr, slots, serviceDurationMin }) {
  const booked = await getBookedRangesForDay({ bizId, dateStr });

  const freeSlots = slots.filter(s =>
    slotIsFree(s.start.getTime(), serviceDurationMin, booked)
  );

  // Now draw freeSlots in your UI
  // Example:
  const holder = document.getElementById("timeslots");
  if (!holder) return;

  holder.innerHTML = freeSlots.map(s => `
    <button class="slot-btn" data-time="${s.start.toISOString()}">${s.label}</button>
  `).join("");
}
function getServiceCalendarId(service) {
  const v = service?.values || service || {};
  const cal =
    v.Calendar || v.calendar || null;

    if (Array.isArray(cal) && cal[0]) return String(cal[0]).trim();

  // if stored as object
  if (cal && typeof cal === "object") {
    return String(cal._id || cal.id || cal.value || "").trim();
  }

  // if stored as id
  return String(
    v.calendarId ||
    v.CalendarId ||
    v["Calendar Id"] ||
    v["calendarId"] ||
    ""
  ).trim();
}

window.STATE = window.STATE || {};
window.STATE.selectedCalendarIdForAppt = "";

// ==============================
// ✅ Show all clients in dropdown
// ==============================
function wireShowAllClientsToggle() {
  const cb = document.getElementById("show-all-clients");
  if (!cb) return;

  if (cb.dataset.wired === "1") return;
  cb.dataset.wired = "1";

  window.STATE = window.STATE || {};
  window.STATE.showAllClients = !!cb.checked;

  cb.addEventListener("change", async () => {
    window.STATE.showAllClients = !!cb.checked;

    // reload client dropdown using new mode
    await loadClientsForSelectedBusiness();

    // optional: clear selection when switching modes
    const dd = document.getElementById("appointment-client");
    if (dd) dd.value = "";
  });
}








// ==============================
// ✅ Open Add Appointment popup in edit mode when appointmnet is clicked 
// ==============================
window.STATE = window.STATE || {};
window.STATE.editingAppointmentId = null;

//Fetch the appointment by id + open popup in edit mode
async function fetchAppointmentById(apptId) {
  const res = await api(`/api/records/Appointment/${encodeURIComponent(apptId)}?ts=${Date.now()}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || "Failed to load appointment");

  // ✅ unwrap all common shapes
  if (data?.item) return data.item;
  if (data?.record) return data.record;
  if (Array.isArray(data?.items)) return data.items[0];     // ✅ YOUR CASE
  if (Array.isArray(data?.records)) return data.records[0];
  if (Array.isArray(data)) return data[0];

  return data; // fallback
}

async function openAppointmentPopupEditById(apptId) {
  setLastBusinessId(businessId);

  try {
    const appt = await fetchAppointmentById(apptId);

    console.log("loaded appt", appt); // ✅ HERE

    await openAppointmentPopupEdit(appt);
  } catch (err) {
    console.error("[appt] open edit failed:", err);
    alert(err?.message || "Could not open appointment");
  }
}



//Put the popup into edit mode + fill fields
function setAppointmentPopupMode(mode) {
  const title = document.getElementById("appointment-popup-title");
  const delBtn = document.getElementById("delete-appointment-btn");
  const cancelBtn = document.getElementById("cancel-appointment-btn");

  if (mode === "edit") {
    if (title) title.textContent = "Edit Appointment";
    if (delBtn) delBtn.style.display = "inline-flex";
    if (cancelBtn) cancelBtn.style.display = "inline-flex";
  } else {
    if (title) title.textContent = "Add Appointment";
    if (delBtn) delBtn.style.display = "none";
    if (cancelBtn) cancelBtn.style.display = "none";
  }
}

function extractId(x) {
  if (!x) return "";
  if (typeof x === "string") return x.trim();
  return String(x._id || x.id || x.value || x.recordId || "").trim();
}

function fillAppointmentFormFromRecord(appt) {
  const v = appt?.values || appt || {};

  const bizId =
    extractId(v.Business) ||
    String(v.businessId || v.BusinessId || "").trim();

  const svcId =
    extractId(v.Service) ||
    String(v.serviceId || v.ServiceId || "").trim();

  const clientId =
    extractId(v.Client) ||
    String(v.clientId || v.ClientId || "").trim();

  const dateStr =
    String(v.Date || v["Date"] || v.AppointmentDate || "").slice(0, 10);

  const timeStr =
    String(v.Time || v["Time"] || v.StartTime || "").slice(0, 5);

  const dur =
    Number(v.DurationMin || v.Duration || v.duration || 30) || 30;

  document.getElementById("appointment-business").value = bizId || "";
  document.getElementById("appointment-date").value = dateStr || "";
  document.getElementById("appointment-time").value = timeStr || "";
  document.getElementById("appointment-duration").value = String(dur);

  // service + client are dependent on business, so we load them after business is set
}

async function openAppointmentPopupEdit(appt) {
  // open popup shell
  const pop = document.getElementById("popup-create-appointment");
  const ovl = document.getElementById("popup-overlay");
  if (pop) pop.style.display = "block";
  if (ovl) ovl.style.display = "block";
  document.body.classList.add("popup-open");

  // wire once
  wireAppointmentBusinessChange();
  wireAppointmentServiceChange();
  wireInlineClientButtons();
  wireCreateAppointmentForm();
 wireCancelAppointmentButton();
wireShowAllClientsToggle();


  // set edit mode
  window.STATE = window.STATE || {};
  window.STATE.editingAppointmentId = String(appt?._id || appt?.id || "").trim();
  setAppointmentPopupMode("edit");

  // --- pull ids/fields from record ---
  const v = appt?.values || appt || {};
console.log("[edit] appt keys:", Object.keys(appt || {}));
console.log("[edit] values keys:", Object.keys(v || {}));

  const bizId =
    extractId(v.Business) ||
    String(v.businessId || v.BusinessId || "").trim();

  const svcId =
    extractId(v.Service) ||
    String(v.serviceId || v.ServiceId || "").trim();

  const clientId =
    extractId(v.Client) ||
    String(v.clientId || v.ClientId || "").trim();

    console.log("[edit] ids", { bizId, svcId, clientId });

  const dateStr = String(v.Date || v["Date"] || "").slice(0, 10);
  const timeStr = String(v.Time || v["Time"] || "").slice(0, 5);

  const dur = Number(v.DurationMin || v.Duration || v.duration || 30) || 30;

  // ✅ STEP 1: load businesses list first (so biz dropdown has options)
  await loadUserBusinesses();

  // ✅ STEP 2: set business value
  const bizDD = document.getElementById("appointment-business");
  if (bizDD) bizDD.value = bizId || "";

  // ✅ STEP 3: load dependent dropdown options
  // ✅ STEP 3: load dependent dropdown options
  await loadServicesForSelectedBusiness();

  console.log(
    "service options count",
    document.querySelectorAll("#appointment-service option").length
  ); // ✅ HERE

  await loadClientsForSelectedBusiness();

  // ✅ STEP 4: now set service + client values (options exist now)
  const svcDD = document.getElementById("appointment-service");
  if (svcDD) svcDD.value = svcId || "";

  const cliDD = document.getElementById("appointment-client");
  if (cliDD) cliDD.value = clientId || "";

  // ✅ STEP 5: set date/time/duration inputs
  const dateEl = document.getElementById("appointment-date");
  if (dateEl) dateEl.value = dateStr || "";

  const timeEl = document.getElementById("appointment-time");
  if (timeEl) timeEl.value = timeStr || "";

  const durEl = document.getElementById("appointment-duration");
  if (durEl) durEl.value = String(dur || "");

  // ✅ STEP 6: ensure calendarId is set from selected service (used by overlap + save)
  const bizIdNow = String(bizDD?.value || "").trim();
  const services = window.STATE?.servicesByBiz?.[bizIdNow] || [];
  const svc = services.find(s => String(s._id || s.id || "") === String(svcId));
  window.STATE.selectedCalendarIdForAppt = svc ? getServiceCalendarId(svc) : "";
}



async function updateAppointment(id, values) {
  const res = await api(`/api/records/Appointment/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ values }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || "Failed to update appointment");
  return data?.item || data?.record || data;
}


// ==============================
// ✅ Delete Appointment
// ==============================
async function deleteAppointmentById(id) {
  const res = await api(`/api/records/Appointment/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: { Accept: "application/json" },
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || "Delete failed");
  return data;
}


function wireCancelAppointmentButton() {
  const btn = document.getElementById("cancel-appointment-btn");
  if (!btn) return;
  if (btn.dataset.wired === "1") return;
  btn.dataset.wired = "1";

  btn.addEventListener("click", async () => {
    const id = String(window.STATE?.editingAppointmentId || "").trim();
    if (!id) {
      // not in edit mode, just close
      closeAppointmentPopup();
      return;
    }

    if (!confirm("Cancel this appointment and free the time slot?")) return;

    try {
      await deleteAppointmentById(id);

      // ✅ close + reset mode
      closeAppointmentPopup();

      // ✅ repaint calendar cards
      window.refreshCalendarAppointments?.(window.currentWeekDates || []);

      // ✅ if your availability/timeslot UI depends on selected date/calendar, re-render it
      const dateStr = String(document.getElementById("appointment-date")?.value || "").trim();
      const calId = String(window.STATE?.selectedCalendarIdForAppt || "").trim();

      // call whichever one your page actually uses (leave both—only existing ones run)
      window.loadSlotsForCalendarDate?.(calId, dateStr);
      window.refreshAvailability?.();
      window.renderTimeSlotsForSelectedDate?.();

    } catch (err) {
      console.error("[appt] cancel delete failed:", err);
      alert(err?.message || "Could not cancel appointment");
    }
  });
}



// Open appointment popup from inside the VIEW CLIENTS popup (closes that popup first)
window.openAppointmentFromClientPopup = async function () {
  const clientId = String(window.STATE?.selectedClientId || "").trim();
  const clientBizId = String(window.STATE?.selectedClientBusinessId || "").trim();

  // close the View Clients popup (this is the one on screen)
  closeClientListPopup();

  requestAnimationFrame(async () => {
    // open appointment popup (loads businesses + default stuff)
    await openAppointmentPopup();

    // ✅ force business dropdown to the client’s business
    if (clientBizId) {
      const bizDD = document.getElementById("appointment-business");
      if (bizDD) bizDD.value = clientBizId;

      // now reload dependent dropdowns for THAT business
      await loadServicesForSelectedBusiness();
      await loadClientsForSelectedBusiness();
    }

    // ✅ finally select the client
    if (clientId) {
      const cliDD = document.getElementById("appointment-client");
      if (cliDD) cliDD.value = clientId;
    }
  });
};
















































/////////////////////////////////////////////////////
                  // Menu Section 

/////////////////////////
    //Business Dropdown
////////////////////////////
// ==============================
// ✅ Load Businesses into dropdowns
// ==============================

function toItems(data) {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.items)) return data.items;     // ✅ preferred shape
  if (Array.isArray(data.records)) return data.records;
  return [];
}

function getBizName(b) {
  const v = b?.values || b || {};

  const name =
    v.businessName ||
    v.BusinessName ||
    v["Business Name"] ||
    v["Business name"] ||
    v.name ||
    v.Name ||
    v.title ||
    v.Title ||
    v.displayName ||
    v.DisplayName ||
    "";

  return String(name).trim() || "(Unnamed business)";
}

async function loadUserBusinesses() {
  // If your API enforces session + returns only the logged-in user's businesses,
  // you don't need any ownerUserId filter here.
  const res = await api(`/api/records/Business?limit=5000&ts=${Date.now()}`);
  const data = await res.json().catch(() => ({}));
  const businesses = toItems(data);

  // store globally if you want
  window.STATE = window.STATE || {};
  window.STATE.businesses = businesses;

  // Fill these dropdowns if they exist on the page
  const selects = [
    document.getElementById("business-dropdown"),
    document.getElementById("client-business"),
    document.getElementById("appointment-business"),
  ].filter(Boolean);

  for (const sel of selects) {
    const keep = sel.id === "business-dropdown"
      ? `<option value="">-- Choose Business --</option>`
      : `<option value="">-- Select Business --</option>`;

    sel.innerHTML =
      keep +
      businesses
        .map((b) => {
          const id = String(b._id || b.id || "");
          const name = getBizName(b);
          return `<option value="${id}">${name}</option>`;
        })
        .join("");
  }
console.log("[biz] first record:", businesses[0]);
console.log("[biz] first record values:", businesses[0]?.values);

  console.log("[biz] loaded:", businesses.length);
}

//Preselect last edited business in dropdown 
// ==============================
// ✅ Remember last edited business
// ==============================
const LAST_BIZ_KEY = "suiteseat:lastBusinessId";

function setLastBusinessId(bizId) {
  const id = String(bizId || "").trim();
  if (!id) return;
  localStorage.setItem(LAST_BIZ_KEY, id);
}

function getLastBusinessId() {
  return String(localStorage.getItem(LAST_BIZ_KEY) || "").trim();
}






















/////////////////////////////////////////////////////
                  // Create Calendar


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

// ✅ Better month label (handles weeks spanning months/years)
function monthLabel(weekStart){
  const weekEnd = addDays(weekStart, 6);

  const sameMonth =
    weekStart.getMonth() === weekEnd.getMonth() &&
    weekStart.getFullYear() === weekEnd.getFullYear();

  const fmtMonthYear = (dt) =>
    dt.toLocaleString(undefined, { month: "long", year: "numeric" });

  const fmtMonthOnly = (dt) =>
    dt.toLocaleString(undefined, { month: "long" });

  // Example:
  // same month: "January 2026"
  // spans months same year: "January – February 2026"
  // spans years: "December 2025 – January 2026"
  if (sameMonth) return fmtMonthYear(weekStart);

  const sameYear = weekStart.getFullYear() === weekEnd.getFullYear();
  if (sameYear) {
    return `${fmtMonthOnly(weekStart)} – ${fmtMonthYear(weekEnd)}`;
  }
  return `${fmtMonthYear(weekStart)} – ${fmtMonthYear(weekEnd)}`;
}

// ✅ "Jan 5 – Jan 11" sublabel (or "Dec 28 – Jan 3")
function weekRangeLabel(weekStart){
  const weekEnd = addDays(weekStart, 6);

  const fmt = (dt) =>
    dt.toLocaleString(undefined, { month: "short", day: "numeric" });

  return `${fmt(weekStart)} – ${fmt(weekEnd)}`;
}

function fmt12h(h){
  const ampm = h>=12 ? "PM" : "AM";
  let H = h%12; if (H===0) H=12;
  return `${H}:00 ${ampm}`;
}

function getWeekDates(weekStart){
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}

document.addEventListener("DOMContentLoaded", () => {
  const hdrMonth    = $("#month-year");
  const subLabel    = $("#week-offset-label"); // ✅ you already have this element
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
    // ✅ Month title changes as you move weeks
    hdrMonth.textContent = monthLabel(weekStart);

    // ✅ Date range label under it
    if (subLabel) subLabel.textContent = weekRangeLabel(weekStart);

    // day numbers + (optional) highlight today
    const today = new Date(); today.setHours(0,0,0,0);

    weekDatesEl.forEach((el) => {
      const idx = Number(el.dataset.day || 0);
      const d = addDays(weekStart, idx);
      el.textContent = d.getDate();

      // OPTIONAL: highlight today
      el.classList.toggle("is-today", d.getTime() === today.getTime());
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

  function setWeek(newStart){
    weekStart = startOfWeek(newStart);
    renderHeader();
    buildHourLabels();
    buildDayColumns();

    currentWeekDates = getWeekDates(weekStart);      // [Sun..Sat] LOCAL
    window.currentWeekDates = currentWeekDates;

    // paint appointments (if your function exists)
    window.refreshCalendarAppointments?.(currentWeekDates);
  }

  // initial paint
  setWeek(weekStart);

  // listeners
  const repaint = () => window.refreshCalendarAppointments?.(window.currentWeekDates || []);
  document.getElementById("business-dropdown")?.addEventListener("change", repaint);

  btnPrev?.addEventListener("click", () => setWeek(addDays(weekStart, -7)));
  btnNext?.addEventListener("click", () => setWeek(addDays(weekStart,  7)));
  btnToday?.addEventListener("click", () => setWeek(new Date()));
});

//Make appointments stack horizontally 
function px(n) { return `${Math.round(n)}px`; }

function layoutOverlapsInColumn(colEl) {
  const cards = Array.from(colEl.querySelectorAll(".appointment-card"));

  // Read top/height from styles
  const items = cards.map(el => {
    const top = parseFloat(el.style.top || "0");
    const height = parseFloat(el.style.height || "0");
    return {
      el,
      top,
      bottom: top + height
    };
  }).filter(x => x.bottom > x.top);

  if (!items.length) return;

  // Sort by start time (top)
  items.sort((a, b) => a.top - b.top || a.bottom - b.bottom);

  // Build overlap groups
  let group = [];
  let groupEnd = -Infinity;

  function flushGroup(g) {
    if (!g.length) return;

    // Assign "lanes" within the group (classic interval graph coloring)
    const lanes = []; // each lane stores the latest bottom
    g.forEach(item => {
      let laneIndex = lanes.findIndex(end => end <= item.top);
      if (laneIndex === -1) {
        lanes.push(item.bottom);
        laneIndex = lanes.length - 1;
      } else {
        lanes[laneIndex] = item.bottom;
      }
      item.lane = laneIndex;
      item.laneCount = lanes.length; // temp, will finalize later
    });

    const laneCount = lanes.length;
    const colW = colEl.clientWidth;

    const gap = 2; // px gap between side-by-side cards
    const laneW = (colW - gap * (laneCount - 1)) / laneCount;

    g.forEach(item => {
      const left = item.lane * (laneW + gap);
      item.el.style.width = px(laneW);
      item.el.style.left  = px(left);
    });
  }

  for (const item of items) {
    // If it overlaps current group
    if (item.top < groupEnd) {
      group.push(item);
      groupEnd = Math.max(groupEnd, item.bottom);
    } else {
      // Flush previous group
      flushGroup(group);
      // Start new group
      group = [item];
      groupEnd = item.bottom;
    }
  }
  flushGroup(group);
}


document.querySelectorAll(".time-column").forEach(col => {
  layoutOverlapsInColumn(col);
});

window.addEventListener("resize", () => {
      window.layoutAllOverlaps?.();
  document.querySelectorAll(".time-column").forEach(col => {
    // Reset defaults first (optional)
    col.querySelectorAll(".appointment-card").forEach(card => {
      card.style.left = "0px";
      card.style.width = "100%";
    });
    layoutOverlapsInColumn(col);
  });
});
















 /////////////////////////////////////////////////////
                  // Appointment Card
async function fetchAppointmentsWhereImPro() {
  const res = await api(`/api/records/Appointment?limit=5000&ts=${Date.now()}`);
  const data = await res.json().catch(() => ({}));
  const rows = toItems(data);

  // Safety filter (optional)
  const myId = String(window.STATE?.userId || "").trim();
  if (!myId) return [];

  return rows.filter(a => {
    const v = a?.values || {};
    const pro =
      v.proUserId ||
      (v.Pro && (v.Pro._id || v.Pro.id)) ||
      "";
    return String(pro) === myId;
  });
}



// ==============================
// ✅ Appointment painter (DEFINE THIS)
// ==============================

// helper: parse appointment date/time safely
function parseTimeTo24h(timeStr) {
  if (!timeStr) return null;

  const s = String(timeStr).trim().toLowerCase();

  // "18:30" or "6:30"
  const m = s.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
  if (!m) return null;

  let h = Number(m[1]);
  let min = Number(m[2] ?? "0");
  const ampm = m[3] ? m[3].toLowerCase() : null;

  if (!Number.isFinite(h) || !Number.isFinite(min)) return null;
  if (min < 0 || min > 59) return null;

  // handle AM/PM
  if (ampm) {
    if (h < 1 || h > 12) return null;
    if (ampm === "pm" && h !== 12) h += 12;
    if (ampm === "am" && h === 12) h = 0;
  } else {
    // no am/pm: treat as 24h if 0-23, else invalid
    if (h < 0 || h > 23) return null;
  }

  return { h, min };
}
function getApptStartDateTime(appt) {
  const v = appt?.values || {};

  // 1) Prefer Date + Time fields (local-safe)
  const dateOnly =
    v.Date ||
    v["Date"] ||
    v.AppointmentDate ||
    v["Appointment Date"] ||
    appt?.Date ||
    null;

  const timeOnly =
    v.Time ||
    v["Time"] ||
    v.StartTime ||
    v["Start Time"] ||
    appt?.Time ||
    null;

  // If dateOnly is already a full ISO date-time, try it
  if (dateOnly && typeof dateOnly === "string" && dateOnly.includes("T")) {
    const d = new Date(dateOnly);
    if (!isNaN(d.getTime())) return d;
  }

  if (dateOnly) {
    const base = new Date(`${String(dateOnly).slice(0, 10)}T00:00:00`);
    if (isNaN(base.getTime())) return null;

    if (timeOnly) {
      const t = parseTimeTo24h(timeOnly);
      if (t) {
        base.setHours(t.h, t.min, 0, 0);
      }
    }
    return base;
  }

  // 2) Fallback to ISO candidates (can be UTC and shift)
  const iso =
    v.startDateTime ||
    v.StartDateTime ||
    v["Start DateTime"] ||
    v["Start Date"] ||
    appt?.startDateTime ||
    appt?.Start ||
    null;

  if (iso) {
    const d = new Date(iso);
    if (!isNaN(d.getTime())) return d;
  }

  return null;
}



function inRange(dt, start, end) {
  if (!dt) return false;
  const t = dt.getTime();
  return t >= start.getTime() && t <= end.getTime();
}

// helper: find which day column to use
function dayIndexInWeekByDate(dt, weekStartDate) {
  const w0 = new Date(weekStartDate);
  w0.setHours(0, 0, 0, 0);

  const d0 = new Date(dt);
  d0.setHours(0, 0, 0, 0);

  const diffDays = Math.round((d0 - w0) / 86400000);
  return diffDays >= 0 && diffDays <= 6 ? diffDays : -1;
}

// helper: 12h time label
function to12hLabel(h, m) {
  const ampm = h >= 12 ? "PM" : "AM";
  let H = h % 12;
  if (H === 0) H = 12;
  return `${H}:${String(m).padStart(2, "0")} ${ampm}`;
}

// helper: paint card into the correct day column
function paintApptCard({ dayIndex, startMin, durationMin, label, sublabel, apptId }) {
  const cols = document.querySelectorAll(".time-column");
  const col = cols[dayIndex];
  if (!col) return;

  const card = document.createElement("div");
  card.className = "appointment-card";
  card.dataset.apptId = apptId; // ✅ ADD THIS

  card.style.position = "absolute";
  card.style.left = "8px";
  card.style.right = "8px";
  card.style.top = `${startMin}px`;
  card.style.height = `${Math.max(18, durationMin)}px`;

  card.innerHTML = `
    <div class="appt-time">${label}</div>
    <div class="appt-sub">${sublabel}</div>
  `;

  // ✅ click to edit
card.addEventListener("click", (e) => {
  e.stopPropagation();

  console.log("clicked apptId", apptId); 

  openAppointmentPopupEditById(apptId);
});

  col.appendChild(card);
}



async function refreshCalendarAppointments(weekDates) {
  window.STATE = window.STATE || {};
  if (typeof window.STATE.refreshToken !== "number") window.STATE.refreshToken = 0;
  const token = ++window.STATE.refreshToken;

  // clear old cards
  document.querySelectorAll(".appointment-card").forEach((el) => el.remove());

  const me = String(window.STATE?.userId || "").trim();
  if (!me) return;

  if (!Array.isArray(weekDates) || weekDates.length < 7) return;

  const weekStart = new Date(weekDates[0]);
  weekStart.setHours(0, 0, 0, 0);

  const weekEnd = new Date(weekDates[6]);
  weekEnd.setHours(23, 59, 59, 999);

  const bizId = String(document.getElementById("business-dropdown")?.value || "").trim();

  let rows = [];
  try {
    rows = await fetchAppointmentsWhereImPro();
  } catch (e) {
    console.error("[appts] fetch failed:", e);
    return;
  }

  // ✅ if another refresh started while we were waiting, stop
  if (token !== window.STATE.refreshToken) return;

  // filter into this visible week
  let weekRows = rows.filter((a) => {
    const dt = getApptStartDateTime(a);
    return inRange(dt, weekStart, weekEnd);
  });

  // optional: filter by selected business
  if (bizId) {
    weekRows = weekRows.filter((a) => {
      const v = a.values || {};
      const b =
        (v.Business && (v.Business._id || v.Business.id)) ||
        (a.Business && (a.Business._id || a.Business.id)) ||
        v.businessId ||
        v.BusinessId ||
        v["Business Id"] ||
        v["BusinessID"] ||
        "";
      return String(b) === String(bizId);
    });
  }

  console.log("[appts] rows:", rows.length, "weekRows:", weekRows.length);

  // paint
  weekRows.forEach((a) => {
    const v = a.values || {};
    const dt = getApptStartDateTime(a);
    if (!dt) return;

    const dayIndex = dayIndexInWeekByDate(dt, weekDates[0]);
    if (dayIndex < 0) return;

    const startMin = dt.getHours() * 60 + dt.getMinutes();

    let duration = Number(
      v.DurationMin ||
      v["DurationMin"] ||
      v["Duration (min)"] ||
      v.Duration ||
      v.duration ||
      30
    );
    if (!Number.isFinite(duration) || duration <= 0) duration = 30;

    const endMin = startMin + duration;

    const label = `${to12hLabel(dt.getHours(), dt.getMinutes())} – ${to12hLabel(
      Math.floor(endMin / 60),
      endMin % 60
    )}`;

    const clientName =
      v["Client Name"] ||
      v.ClientName ||
      (v.Client && (v.Client.name || v.Client.firstName)) ||
      "(Client)";

    const serviceLine =
      v["Service Name"] ||
      v.ServiceName ||
      v.ServiceNames ||
      (v.Service && (v.Service.name || v.Service.title)) ||
      "(Service)";

    const sublabel = `${clientName} • ${serviceLine}`;

    paintApptCard({
      apptId: String(a._id || a.id || ""),
      dayIndex,
      startMin,
      durationMin: duration,
      label,
      sublabel,
    });
  });

  // ✅ IMPORTANT: run AFTER painting, and after DOM is updated
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      window.layoutAllOverlaps?.();
    });
  });
}

window.refreshCalendarAppointments = refreshCalendarAppointments;


















//anywhere above DOMContentLoaded
                  // ---- init ----
document.addEventListener("DOMContentLoaded", () => {
  wireLoginForm();
  wireOverlayClose();
  wireAppointmentBusinessChange();
  wireCreateAppointmentForm();
  wireCancelAppointmentButton();
  wireCreateClientForm();
  bootAuth();
});

