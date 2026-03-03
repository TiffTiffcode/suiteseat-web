console.log("[clients] loaded");

// ✅ MUST use api2 in production so cookies persist
// ✅ Default to api2 (same data as production)
// If you want local API sometimes, open: http://localhost:3000/clients.html?api=local
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
await loadMyBusinessesList();
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
  await loadMyBusinessesList();
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


  // ✅ OPEN popup from BOTH buttons
  document.getElementById("add-client-btn")
    ?.addEventListener("click", openClientPopup);

  document.getElementById("open-add-client-popup-btn")
    ?.addEventListener("click", openClientPopup);

  // ✅ CLOSE popup when overlay clicked
  document.getElementById("popup-overlay")
    ?.addEventListener("click", closeClientPopup);





//////////////////////////////////////////////////////////////
});







async function loadMyBusinessesList() {
  const el = document.getElementById("my-businesses-list");
  if (!el) return;

  el.textContent = "Loading…";

  // must be logged in
  const userId = window.currentUserId;
  if (!userId) {
    el.textContent = "Please log in to see your businesses.";
    return;
  }

  try {
    const qs = new URLSearchParams({ limit: "500", ts: String(Date.now()) });
    const res = await apiFetch(`/api/records/Business?${qs.toString()}`);

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`HTTP ${res.status} ${text.slice(0, 200)}`);
    }

    const payload = await res.json().catch(() => ({}));
    const rows = Array.isArray(payload?.items) ? payload.items : [];

    // --- helpers ---
    const vget = (v, ...keys) => {
      for (const k of keys) if (v && v[k] != null) return v[k];
      return undefined;
    };

    const refId = (x) => {
      if (!x) return "";
      if (typeof x === "string") return x;
      if (typeof x === "object") return String(x._id || x.id || "");
      return "";
    };

    const ownedByUser = (row, userId) => {
      const v = row?.values || row || {};
      const createdBy = refId(v["Created By"] || v.createdBy || v.createdById);
      const pro = refId(v["Pro"] || v.pro || v.proId);
      const owner = refId(v["Owner"] || v.owner || v.user || v.userId);

      return (
        (createdBy && String(createdBy) === String(userId)) ||
        (pro && String(pro) === String(userId)) ||
        (owner && String(owner) === String(userId))
      );
    };

    const bizLabel = (row) => {
      const v = row?.values || row || {};
      const name =
        vget(v, "Business Name", "businessName", "Name", "name") ||
        (row?._id ? `Business (${String(row._id).slice(-6)})` : "Business");
      return String(name).trim();
    };

    // --- filter to current user's businesses ---
    const mine = rows.filter((row) => ownedByUser(row, userId));

    if (!mine.length) {
      el.innerHTML = `<div style="opacity:.7;">No businesses found for this user.</div>`;
      console.log("[my-businesses] total:", rows.length, "mine:", mine.length, "userId:", userId);
      return;
    }

    // --- render ---
    el.innerHTML = `
      <ul style="margin:0; padding-left: 18px;">
        ${mine
          .map((row) => `<li data-id="${row._id}">${bizLabel(row)}</li>`)
          .join("")}
      </ul>
    `;

    console.log("[my-businesses] total:", rows.length, "mine:", mine.length);
  } catch (err) {
    console.error("[my-businesses] load error:", err);
    el.textContent = "Error loading businesses.";
  }
}



























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

    renderClients(mine);
  } catch (err) {
    console.error("❌ loadMyClients error:", err);
    if (container) container.innerHTML = `<div style="opacity:.7; padding: 12px 0;">Error loading clients.</div>`;
  }
}





//Add Client Popup 
function openClientPopup() {
  const popup = document.getElementById("popup-add-client");
  const overlay = document.getElementById("popup-overlay");

  if (popup) popup.style.display = "block";
  if (overlay) overlay.style.display = "block";

  document.body.classList.add("popup-open");
}

function closeClientPopup() {
  const popup = document.getElementById("popup-add-client");
  const overlay = document.getElementById("popup-overlay");

  if (popup) popup.style.display = "none";
  if (overlay) overlay.style.display = "none";

  document.body.classList.remove("popup-open");
}

// make close function global for your HTML onclick
window.closeClientPopup = closeClientPopup;

