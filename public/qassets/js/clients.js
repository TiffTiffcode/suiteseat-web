console.log("[clients] loaded");

// ✅ MUST use api2 in production so cookies persist
// ✅ Default to api2 (same data as production)
// If you want local API sometimes, open: http://localhost:3000/clients?api=local
// (Production default is api2)
const apiMode = new URLSearchParams(window.location.search).get("api");

const API_ORIGIN =
  apiMode === "local"
    ? "http://localhost:8400"
    : "https://api2.suiteseat.io";

const apiFetch = (path, opts = {}) => {
  const p = path.startsWith("/") ? path : `/${path}`;
  return fetch(`${API_ORIGIN}${p}`, {
    credentials: "include",
    cache: "no-store",
    ...opts,
  });
};

const apiRecords = (type) => `/api/records/${encodeURIComponent(type)}`;

// small helper
function vget(v, ...keys) {
  for (const k of keys) if (v && v[k] != null) return v[k];
  return undefined;
}


// =========================
// AUTH (login/logout/header)
// =========================
function showLoginPopup() {
  document.getElementById("popup-login")?.style?.setProperty("display", "block");
  document.getElementById("popup-overlay")?.style?.setProperty("display", "block");
  document.body.classList.add("popup-open");
}

function closeLoginPopup() {
  document.getElementById("popup-login")?.style?.setProperty("display", "none");
  document.getElementById("popup-overlay")?.style?.setProperty("display", "none");
  document.body.classList.remove("popup-open");
}
window.closeLoginPopup = closeLoginPopup; // your HTML calls this

function displayNameFrom(user) {
  const first = user?.firstName || user?.first_name;
  const last  = user?.lastName  || user?.last_name;
  if (first && last) return `${first} ${last}`;
  if (first) return first;
  if (user?.email) return user.email.split("@")[0];
  return "";
}

async function safeJSON(res) {
  const text = await res.text().catch(() => "");
  try { return text ? JSON.parse(text) : null; } catch { return { _raw: text }; }
}

async function checkLogin() {
  const loginStatus  = document.getElementById("login-status-text");
  const openLoginBtn = document.getElementById("open-login-popup-btn");
  const logoutBtn    = document.getElementById("logout-btn");

  try {
    const res = await apiFetch(`/api/me?ts=${Date.now()}`);
    const data = await safeJSON(res);

    // ✅ support BOTH:
    // A) { ok:true, user:{...} }
    // B) { _id/id/firstName/... } (top-level user)
    const user = data?.user || (data?._id || data?.id ? data : null);

    if (res.ok && user) {
      const name = displayNameFrom(user);
      if (loginStatus) loginStatus.textContent = name ? `Hi, ${name} 👋` : "Hi 👋";
      if (openLoginBtn) openLoginBtn.style.display = "none";
      if (logoutBtn) logoutBtn.style.display = "inline-block";
      window.currentUserId = user._id || user.id || data.userId || null;
      return true;
    }

    // not logged in
    if (loginStatus) loginStatus.textContent = "Not logged in";
    if (openLoginBtn) openLoginBtn.style.display = "inline-block";
    if (logoutBtn) logoutBtn.style.display = "none";
    window.currentUserId = null;
    return false;
  } catch (err) {
    console.error("[checkLogin] error:", err);
    if (loginStatus) loginStatus.textContent = "Not logged in";
    window.currentUserId = null;
    return false;
  }
}

async function doLogin(email, password) {
  const res = await apiFetch("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await safeJSON(res);
  if (!res.ok) throw new Error(data?.message || data?.error || `HTTP ${res.status}`);
  return data;
}

async function doLogout() {
  const res = await apiFetch("/api/logout", { method: "POST" });
  const data = await safeJSON(res);
  if (!res.ok) throw new Error(data?.message || data?.error || `HTTP ${res.status}`);
  return data;
}

// =========================
// DOM WIRING (bind once)
// =========================
document.addEventListener("DOMContentLoaded", async () => {
  // buttons
  const openLoginBtn = document.getElementById("open-login-popup-btn");
  const logoutBtn    = document.getElementById("logout-btn");
  const loginForm    = document.getElementById("login-form");

  openLoginBtn?.addEventListener("click", showLoginPopup);

  loginForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("login-email")?.value.trim();
    const password = document.getElementById("login-password")?.value.trim();
    if (!email || !password) return alert("Please enter both email and password.");

    try {
      await doLogin(email, password);
      closeLoginPopup();
      await checkLogin();

      // now load businesses (you are authenticated)
      await populateBusinessFilterDropdown();
    } catch (err) {
      console.error("[login] error:", err);
      alert(err.message || "Login failed");
    }
  });

  logoutBtn?.addEventListener("click", async () => {
    try {
      await doLogout();
      await checkLogin();

      // reset dropdown when logged out
      const bf = document.getElementById("business-filter");
      if (bf) bf.innerHTML = `<option value="all">All Businesses</option>`;
    } catch (err) {
      console.error("[logout] error:", err);
      alert(err.message || "Logout failed");
    }
  });

  // initial login state + initial dropdown load if logged in
const loggedIn = await checkLogin();
if (loggedIn) {

  await populateBusinessFilterDropdown();
  await loadMyClients();

  document.getElementById("business-filter")?.addEventListener("change", () => {
    loadMyClients();
  });
} else {
    // optional: you can still show dropdown placeholder
    const bf = document.getElementById("business-filter");
    if (bf) bf.innerHTML = `<option value="all">All Businesses</option>`;
  }

window.editingClientId = null;








  // ✅ OPEN popup from BOTH buttons
  document.getElementById("add-client-btn")
    ?.addEventListener("click", openClientPopup);

  document.getElementById("open-add-client-popup-btn")
    ?.addEventListener("click", openClientPopup);

  // ✅ CLOSE popup when overlay clicked
  document.getElementById("popup-overlay")
    ?.addEventListener("click", closeClientPopup);




//Save Client
  const addClientForm = document.getElementById("add-client-form");

  addClientForm?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const userId = window.currentUserId;
    if (!userId) return alert("Please log in first.");

    const businessId = document.getElementById("client-business")?.value || "";
    const firstName  = document.getElementById("client-name")?.value.trim() || "";
    const lastName   = document.getElementById("client-last-name")?.value.trim() || "";
    const email      = document.getElementById("client-email")?.value.trim() || "";
    const phone      = document.getElementById("client-phone")?.value.trim() || "";

    if (!businessId) return alert("Please choose a business.");
    if (!firstName)  return alert("First name is required.");

    try {
      // ✅ build your dynamic Record "values"
      const values = {
        "Business": businessId,        // reference to Business
        "First Name": firstName,
        "Last Name": lastName,
        "Email": email,
        "Phone": phone,
        "Created By": userId           // helps your ownedByUser() filter
      };

    const isEdit = !!window.editingClientId;

    const url = isEdit
      ? `${apiRecords("Client")}/${encodeURIComponent(window.editingClientId)}`
      : apiRecords("Client");

    const method = isEdit ? "PATCH" : "POST";

    const res = await apiFetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ values }),
    });

    const data = await safeJSON(res);
    if (!res.ok) throw new Error(data?.message || data?.error || `HTTP ${res.status}`);

    // ✅ success — clear edit mode HERE
    window.editingClientId = null;

    closeClientPopup();

    const bf = document.getElementById("business-filter");
    if (bf) bf.value = businessId;

    await loadMyClients();
  } catch (err) {
    console.error("[save-client] error:", err);
    alert(err.message || "Failed to save client.");
  }
});

  //Open Add Client Popoup in Edit Mode 

document.getElementById("client-list-container")?.addEventListener("click", (e) => {
  const row = e.target.closest(".client-row");
  if (!row) return;

  const id = row.getAttribute("data-id");
  if (!id) return;

  openClientPopupEditMode(id);
});

// ✅ Delete Client
document.getElementById("delete-client-btn")?.addEventListener("click", async () => {
  const id = window.editingClientId;
  if (!id) return alert("No client selected to delete.");

  const ok = confirm("Delete this client?");
  if (!ok) return;

  try {
    const res = await apiFetch(
      `${apiRecords("Client")}/${encodeURIComponent(id)}`,
      { method: "DELETE" }
    );

    const data = await safeJSON(res);
    if (!res.ok) throw new Error(data?.message || data?.error || `HTTP ${res.status}`);

    // ✅ clear edit mode + close popup
    window.editingClientId = null;
    closeClientPopup();

    // ✅ refresh list
    await loadMyClients();
  } catch (err) {
    console.error("[delete-client] error:", err);
    alert(err.message || "Failed to delete client.");
  }
});

// ✅ Search clients (filters what is already loaded)
document.getElementById("client-search")?.addEventListener("input", applyClientSearch);

document.getElementById("business-filter")?.addEventListener("change", async () => {
  const s = document.getElementById("client-search");
  if (s) s.value = "";
  await loadMyClients(); // this repopulates cache too
});




                   //////////////
                   //Email 
                   //////////////

// ----------------------------
// Email Automations (Tab 7)
// ----------------------------
const emailAutoTbody = document.querySelector('#email-auto-table tbody');
const emailAutoForm  = document.getElementById('email-auto-form');

const eaName    = document.getElementById('ea-name');
const eaEnabled = document.getElementById('ea-enabled');
const eaTrigger = document.getElementById('ea-trigger');
const eaAudience= document.getElementById('ea-audience');
const eaDelay   = document.getElementById('ea-delay');
const eaSubject = document.getElementById('ea-subject');
const eaReplyTo = document.getElementById('ea-replyto');
const eaBody    = document.getElementById('ea-body');

let emailDT = null;
let allEmailAutos = [];

async function getEmailAutomationDataType() {
  if (emailDT) return emailDT;

  const dtRes = await fetch('/api/datatypes', { headers: { 'Accept': 'application/json' } });
  if (!dtRes.ok) throw new Error(`DataTypes HTTP ${dtRes.status}`);
  const dts = await dtRes.json();

  const found = (dts || []).find(dt =>
    dt.name === 'EmailAutomation' ||
    dt.nameCanonical === 'emailautomation' ||
    dt.nameCanonical === 'email_automation'
  );

  if (!found) throw new Error('No "EmailAutomation" DataType found. Create it first in Data Types tab.');

  emailDT = found;
  return found;
}

async function loadEmailAutomations() {
  if (!emailAutoTbody) return;

  emailAutoTbody.innerHTML = `<tr><td colspan="6">Loading…</td></tr>`;

  try {
    const dt = await getEmailAutomationDataType();
    const res = await fetch(`/api/records?dataTypeId=${dt._id}&limit=500&sort=-createdAt`, {
      headers: { 'Accept': 'application/json' }
    });
    if (!res.ok) throw new Error(`Records HTTP ${res.status}`);

    const body = await res.json().catch(() => ({}));
    const rows = Array.isArray(body) ? body : (body.items || body.records || []);
    allEmailAutos = rows;

    renderEmailAutos();
  } catch (err) {
    console.error('[admin] loadEmailAutomations failed:', err);
    emailAutoTbody.innerHTML = `<tr><td colspan="6">Failed: ${err.message}</td></tr>`;
  }
}

function renderEmailAutos() {
  if (!emailAutoTbody) return;

  if (!allEmailAutos.length) {
    emailAutoTbody.innerHTML = `<tr><td colspan="6">No automations yet</td></tr>`;
    return;
  }

  emailAutoTbody.innerHTML = '';

  allEmailAutos.forEach(rec => {
    const v = rec.values || {};
    const name = v.Name || v.name || '';
    const enabled = (v.Enabled ?? v.enabled) ? 'Yes' : 'No';
    const trigger = v.Trigger || v.trigger || '';
    const audience = v.Audience || v.audience || '';
    const delay = v.SendDelayMinutes || v.sendDelayMinutes || 0;

    const tr = document.createElement('tr');

    tr.innerHTML = `
      <td>${name}</td>
      <td>${enabled}</td>
      <td>${trigger}</td>
      <td>${audience}</td>
      <td>${delay}</td>
      <td style="text-align:right;"></td>
    `;

    const actionsTd = tr.querySelector('td:last-child');

    const btnEdit = document.createElement('button');
    btnEdit.textContent = 'Edit';
    btnEdit.style.marginRight = '8px';

    btnEdit.addEventListener('click', () => {
      // fill form with this record (simple edit mode)
      window.editingEmailAutomationId = rec._id;

      eaName.value = name;
      eaEnabled.value = String((v.Enabled ?? v.enabled) ? true : false);
      eaTrigger.value = trigger;
      eaAudience.value = audience;
      eaDelay.value = delay;

      eaSubject.value = v['Subject Template'] || v.SubjectTemplate || v.subjectTemplate || '';
      eaReplyTo.value = v['ReplyToEmail'] || v['ReplyTo'] || v['FromName /ReplyTo'] || '';
      eaBody.value = v.BodyHtmlTemplate || v['BodyHtmlTemplate'] || v.bodyHtmlTemplate || '';

      emailAutoForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    const btnDelete = document.createElement('button');
    btnDelete.textContent = 'Delete';
    btnDelete.style.background = '#d9534f';

    btnDelete.addEventListener('click', async () => {
      if (!confirm(`Delete "${name}"?`)) return;

      const r = await fetch(`/api/records/${rec._id}`, { method: 'DELETE' });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        alert(err.error || 'Delete failed');
        return;
      }

      allEmailAutos = allEmailAutos.filter(x => x._id !== rec._id);
      renderEmailAutos();
    });

    actionsTd.appendChild(btnEdit);
    actionsTd.appendChild(btnDelete);

    emailAutoTbody.appendChild(tr);
  });
}

// create/update
window.editingEmailAutomationId = null;

emailAutoForm?.addEventListener('submit', async (e) => {
  e.preventDefault();

  const name = (eaName.value || '').trim();
  const trigger = (eaTrigger.value || '').trim();
  const audience = (eaAudience.value || '').trim();

  if (!name) return alert('Name required');
  if (!trigger) return alert('Trigger required');
  if (!audience) return alert('Audience required');

  const dt = await getEmailAutomationDataType();

  const values = {
    Name: name,
    Enabled: eaEnabled.value === 'true',
    Trigger: trigger,
    Audience: audience,
    SendDelayMinutes: Number(eaDelay.value || 0),
    "Subject Template": (eaSubject.value || '').trim(),
    BodyHtmlTemplate: eaBody.value || '',
    ReplyToEmail: (eaReplyTo.value || '').trim() || null,
  };

  const isEdit = !!window.editingEmailAutomationId;

  const url = isEdit
    ? `/api/records/${encodeURIComponent(window.editingEmailAutomationId)}`
    : `/api/records`;

  const method = isEdit ? 'PATCH' : 'POST';

  const body = isEdit
    ? { values }
    : { dataTypeId: dt._id, values };

  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    alert(err.error || 'Save failed');
    return;
  }

  window.editingEmailAutomationId = null;
  emailAutoForm.reset();
  eaDelay.value = 0;

  await loadEmailAutomations();
});

// load when tab clicked
document.getElementById('tab7')?.addEventListener('click', () => {
  loadEmailAutomations();
}); 



//////////////////////////////////////////////////////////////End
});



































//Business Dropdown
function refId(x) {
  if (!x) return "";
  if (typeof x === "string") return x;
  if (typeof x === "object") return String(x._id || x.id || "");
  return "";
}

function ownedByUser(row, userId) {
  const v = row?.values || {};
  // try common owner fields you use
  const createdBy = refId(v["Created By"] || v.createdBy || v.createdById);
  const pro       = refId(v["Pro"] || v.pro || v.proId);
  const owner     = refId(v["Owner"] || v.owner || v.user || v.userId);

  return (
    (createdBy && String(createdBy) === String(userId)) ||
    (pro && String(pro) === String(userId)) ||
    (owner && String(owner) === String(userId))
  );
}

//Business Dropdown (ONLY current user's businesses)
async function populateBusinessFilterDropdown() {
  const dropdown = document.getElementById("business-filter");
  if (!dropdown) return;

  dropdown.disabled = true;
  dropdown.innerHTML = `<option value="all">Loading…</option>`;

  try {
    const userId = window.currentUserId;
    if (!userId) throw new Error("No currentUserId (not logged in?)");

    const qs = new URLSearchParams({ limit: "500", ts: String(Date.now()) });
    const path = `${apiRecords("Business")}?${qs.toString()}`;
    const res = await apiFetch(path);

    console.log("[business-filter] GET", `${API_ORIGIN}${path}`, "status:", res.status);

    const payload = await res.json().catch(() => ({}));
    const rows = Array.isArray(payload?.items) ? payload.items : [];

    const bizLabel = (row) => {
      const v = row?.values || row || {};
      return (
        (vget(v, "Business Name", "businessName", "Name", "name") || "").trim() ||
        `Business (${String(row._id).slice(-6)})`
      );
    };

    const mine = rows.filter((row) => ownedByUser(row, userId));

    dropdown.innerHTML = "";
    dropdown.appendChild(new Option("All Businesses", "all"));

    for (const row of mine) {
      dropdown.appendChild(new Option(bizLabel(row), String(row._id)));
    }

    console.log("[business-filter] total:", rows.length, "mine:", mine.length);
  } catch (err) {
    console.error("❌ populateBusinessFilterDropdown error:", err);
    dropdown.innerHTML = "";
    dropdown.appendChild(new Option("All Businesses", "all"));
  } finally {
    dropdown.disabled = false;
  }
}



// =========================
// CLIENTS: load + render
// =========================

function getSelectedBusinessId() {
  const dd = document.getElementById("business-filter");
  const val = String(dd?.value || "all");
  return val && val !== "all" ? val : "all";
}

function clientLabel(row) {
  const v = row?.values || row || {};
  const first = (vget(v, "First Name", "firstName", "first_name", "First") || "").trim();
  const last  = (vget(v, "Last Name", "lastName", "last_name", "Last") || "").trim();
  const name  = `${first} ${last}`.trim();

  const email = (vget(v, "Email", "email") || "").trim();
  const phone = (vget(v, "Phone", "phone") || "").trim();

  return {
    name: name || "(No name)",
    email,
    phone,
  };
}

function getClientBusinessId(row) {
  const v = row?.values || row || {};
  // try common business reference field names
  return (
    refId(v["Business"] || v.business || v.businessId || v["Business Id"] || v["businessId"]) ||
    ""
  );
}

function isDeletedRow(row) {
  const v = row?.values || row || {};
  const softDeleted = !!(v["is Deleted"] || v.isDeleted);
  const hardDeleted = !!row?.deletedAt;
  return softDeleted || hardDeleted;
}

function renderClients(rows) {
  const container = document.getElementById("client-list-container");
  if (!container) return;

  if (!rows.length) {
    container.innerHTML = `<div style="opacity:.7; padding: 12px 0;">No clients yet.</div>`;
    return;
  }

  container.innerHTML = rows
    .map((row) => {
      const { name, email, phone } = clientLabel(row);
      return `
        <div class="client-row" data-id="${row._id}">
          <div class="client-name">${name}</div>
          <div class="client-sub" style="opacity:.8; font-size: 13px;">
            ${email ? `<span>${email}</span>` : ""}
            ${email && phone ? `<span style="margin:0 6px;">•</span>` : ""}
            ${phone ? `<span>${phone}</span>` : ""}
          </div>
        </div>
      `;
    })
    .join("");
}

async function loadMyClients() {
  const container = document.getElementById("client-list-container");
  if (container) container.innerHTML = `<div style="opacity:.7; padding: 12px 0;">Loading…</div>`;

  const userId = window.currentUserId;
  if (!userId) {
    if (container) container.innerHTML = `<div style="opacity:.7; padding: 12px 0;">Please log in.</div>`;
    return;
  }

  const selectedBusinessId = getSelectedBusinessId(); // "all" or business _id

  try {
    const qs = new URLSearchParams({ limit: "500", ts: String(Date.now()) });
    const path = `${apiRecords("Client")}?${qs.toString()}`; // ✅ Data Type name: "Client"
    const res = await apiFetch(path);

    console.log("[clients] GET", `${API_ORIGIN}${path}`, "status:", res.status);

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
    }

    const payload = await res.json().catch(() => ({}));
    const rows = Array.isArray(payload?.items) ? payload.items : [];

    // 1) not deleted
    // 2) owned by current user
    // 3) matches business filter (if not "all")
    const mine = rows
      .filter((row) => !isDeletedRow(row))
      .filter((row) => ownedByUser(row, userId))
      .filter((row) => {
        if (selectedBusinessId === "all") return true;
        return getClientBusinessId(row) === String(selectedBusinessId);
      });

    // Optional: sort by name
    mine.sort((a, b) => clientLabel(a).name.localeCompare(clientLabel(b).name));

    console.log("[clients] total:", rows.length, "mine:", mine.length, "business:", selectedBusinessId);

    window.CLIENTS_CACHE = mine;

    renderClients(mine);
  } catch (err) {
    console.error("❌ loadMyClients error:", err);
    if (container) container.innerHTML = `<div style="opacity:.7; padding: 12px 0;">Error loading clients.</div>`;
  }
}





//Add Client Popup 
function openClientPopup() {
  if (!window.currentUserId) {
    alert("Please log in first.");
    showLoginPopup();
    return;
  }

  window.editingClientId = null;

  const popup = document.getElementById("popup-add-client");
  const overlay = document.getElementById("popup-overlay");
  if (popup) popup.style.display = "block";
  if (overlay) overlay.style.display = "block";
  document.body.classList.add("popup-open");

  const title = document.getElementById("client-popup-title");
  if (title) title.textContent = "Add New Client";

  const delBtn = document.getElementById("delete-client-btn");
  if (delBtn) delBtn.style.display = "none";

  populateClientBusinessDropdown();

  const fn = document.getElementById("client-name");
  const ln = document.getElementById("client-last-name");
  const em = document.getElementById("client-email");
  const ph = document.getElementById("client-phone");
  if (fn) fn.value = "";
  if (ln) ln.value = "";
  if (em) em.value = "";
  if (ph) ph.value = "";
}

function closeClientPopup() {
  const popup = document.getElementById("popup-add-client");
  const overlay = document.getElementById("popup-overlay");

  if (popup) popup.style.display = "none";
  if (overlay) overlay.style.display = "none";

  document.body.classList.remove("popup-open");
  window.editingClientId = null;
}

// make close function global for your HTML onclick
window.closeClientPopup = closeClientPopup;


//Business Dropdown
async function populateClientBusinessDropdown() {
  const dd = document.getElementById("client-business");
  if (!dd) return;

  dd.disabled = true;
  dd.innerHTML = `<option value="">Loading…</option>`;

  try {
    const userId = window.currentUserId;
    if (!userId) throw new Error("Not logged in");

    const qs = new URLSearchParams({ limit: "500", ts: String(Date.now()) });
    const path = `${apiRecords("Business")}?${qs.toString()}`;
    const res = await apiFetch(path);

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
    }

    const payload = await res.json().catch(() => ({}));
    const rows = Array.isArray(payload?.items) ? payload.items : [];
    const mine = rows.filter((row) => ownedByUser(row, userId));

    // render options
    dd.innerHTML = `<option value="">-- Choose Business --</option>`;

    for (const row of mine) {
      const v = row?.values || row || {};
      const name =
        (vget(v, "Business Name", "businessName", "Name", "name") || "").trim() ||
        `Business (${String(row._id).slice(-6)})`;

      dd.appendChild(new Option(name, String(row._id)));
    }

    // ✅ preselect from filter (or pick the only business)
    const selectedFromFilter = getSelectedBusinessId(); // "all" or id
    if (selectedFromFilter !== "all") {
      dd.value = selectedFromFilter;
    } else if (mine.length === 1) {
      dd.value = String(mine[0]._id);
    }
  } catch (err) {
    console.error("[client-business] dropdown error:", err);
    dd.innerHTML = `<option value="">-- Choose Business --</option>`;
  } finally {
    dd.disabled = false;
  }
}


  //Open Add Client Popoup in Edit Mode 
 async function openClientPopupEditMode(clientId) {
  if (!window.currentUserId) {
    alert("Please log in first.");
    showLoginPopup();
    return;
  }

  // open popup UI
  const popup = document.getElementById("popup-add-client");
  const overlay = document.getElementById("popup-overlay");
  if (popup) popup.style.display = "block";
  if (overlay) overlay.style.display = "block";
  document.body.classList.add("popup-open");

  // title + delete button
  const title = document.getElementById("client-popup-title");
  if (title) title.textContent = "Edit Client";
  const delBtn = document.getElementById("delete-client-btn");
  if (delBtn) delBtn.style.display = "inline-block";

  // remember edit id
  window.editingClientId = clientId;

  // ✅ 1) fill business dropdown FIRST so options exist
  await populateClientBusinessDropdown();

  // ✅ 2) load client record
  const res = await apiFetch(
    `${apiRecords("Client")}/${encodeURIComponent(clientId)}?ts=${Date.now()}`
  );
  const data = await safeJSON(res);
  if (!res.ok) throw new Error(data?.message || data?.error || `HTTP ${res.status}`);

  console.log("[edit-client] raw data:", data);

  // ✅ handle BOTH shapes:
  // A) { item: {...} } OR {...}
  // B) { items: [ {...} ] }
  const rec =
    (Array.isArray(data?.items) && data.items[0]) ||
    data?.item?.record ||
    data?.record ||
    data?.item ||
    data;

  if (!rec) {
    throw new Error("Client record not found in response");
  }

  const v = rec?.values || {};

  // ✅ pull business id robustly
  const businessRaw =
    v["Business"] ??
    v["business"] ??
    v["businessId"] ??
    v["Business Id"] ??
    v["BusinessID"] ??
    v["BusinessID (ref)"];

  const businessId = refId(businessRaw);

  console.log("[edit-client] businessId:", businessId);
  console.log(
    "[edit-client] dropdown options:",
    [...document.querySelectorAll("#client-business option")].map(o => o.value)
  );

  // pull other values
  const firstName = (vget(v, "First Name", "firstName", "first_name", "First") || "").trim();
  const lastName  = (vget(v, "Last Name", "lastName", "last_name", "Last") || "").trim();
  const email     = (vget(v, "Email", "email") || "").trim();
  const phone     = (vget(v, "Phone", "phone") || "").trim();

  // set inputs
  const biz = document.getElementById("client-business");
  const fn  = document.getElementById("client-name");
  const ln  = document.getElementById("client-last-name");
  const em  = document.getElementById("client-email");
  const ph  = document.getElementById("client-phone");

  if (fn) fn.value = firstName;
  if (ln) ln.value = lastName;
  if (em) em.value = email;
  if (ph) ph.value = phone;

  // ✅ preselect business AFTER dropdown options exist
  if (biz && businessId) {
    biz.value = String(businessId);

    if (biz.value !== String(businessId)) {
      console.warn("[edit-client] businessId not found in dropdown options:", businessId);
    }
  }
}

//Set Up Search 
// ✅ client cache for searching (store the "mine" list after loading)
window.CLIENTS_CACHE = [];
function applyClientSearch() {
  const q = (document.getElementById("client-search")?.value || "").trim().toLowerCase();

  const rows = Array.isArray(window.CLIENTS_CACHE) ? window.CLIENTS_CACHE : [];

  if (!q) {
    renderClients(rows);
    return;
  }

  const filtered = rows.filter((row) => {
    const v = row?.values || row || {};
    const first = String(vget(v, "First Name", "firstName", "first_name", "First") || "").toLowerCase();
    const last  = String(vget(v, "Last Name", "lastName", "last_name", "Last") || "").toLowerCase();
    const email = String(vget(v, "Email", "email") || "").toLowerCase();
    const phone = String(vget(v, "Phone", "phone") || "").toLowerCase();

    const full = `${first} ${last}`.trim();

    return (
      full.includes(q) ||
      first.includes(q) ||
      last.includes(q) ||
      email.includes(q) ||
      phone.includes(q)
    );
  });

  renderClients(filtered);
}