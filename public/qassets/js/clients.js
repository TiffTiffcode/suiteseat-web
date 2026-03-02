console.log("[clients] loaded");

// ✅ MUST use api2 in production so cookies persist
// ✅ Default to api2 (same data as production)
// If you want local API sometimes, open: http://localhost:3000/clients.html?api=local

// If you want local API sometimes, open: http://localhost:3000/clients.html?api=local
const urlApi = new URLSearchParams(window.location.search).get("api");

const API_ORIGIN =
  urlApi === "local"
    ? "http://localhost:8400"
    : "https://api2.suiteseat.io"; // default

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
  } else {
    // optional: you can still show dropdown placeholder
    const bf = document.getElementById("business-filter");
    if (bf) bf.innerHTML = `<option value="all">All Businesses</option>`;
  }
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

  const normalizeItems = (payload) => {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.items)) return payload.items;
    return [];
  };

  const bizLabel = (row) => {
    const v = row?.values || row || {};
    const name =
      vget(v, "Business Name", "businessName", "Name", "name") ||
      vget(row, "Business Name", "businessName", "Name", "name");

    return (
      (name && String(name).trim()) ||
      (row?._id ? `Business (${String(row._id).slice(-6)})` : "Business")
    );
  };

  try {
    const qs = new URLSearchParams({
      limit: "500",
      sort: JSON.stringify({ createdAt: -1 }),
      ts: String(Date.now()),
    });

    const path = `${apiRecords("Business")}?${qs.toString()}`;
    const res = await apiFetch(path);

    console.log("[business-filter] GET", `${API_ORIGIN}${path}`, "status:", res.status);

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
    }

    const payload = await res.json().catch(() => ({}));
    console.log("[business-filter] me currentUserId:", window.currentUserId);
console.log("[business-filter] raw payload:", payload);
    const rows = normalizeItems(payload);

    const cleaned = rows
      .filter((row) => {
        const v = row?.values || row || {};
        const softDeleted = !!(v["is Deleted"] || v.isDeleted);
        const hardDeleted = !!row?.deletedAt;
        return !softDeleted && !hardDeleted;
      })
      .sort((a, b) => bizLabel(a).localeCompare(bizLabel(b)));

    dropdown.innerHTML = "";
    dropdown.appendChild(new Option("All Businesses", "all"));

    for (const row of cleaned) {
      dropdown.appendChild(new Option(bizLabel(row), String(row._id)));
    }

    console.log("[business-filter] rows:", rows.length, "cleaned:", cleaned.length);
  } catch (err) {
    console.error("❌ populateBusinessFilterDropdown error:", err);
    dropdown.innerHTML = "";
    dropdown.appendChild(new Option("All Businesses", "all"));
  } finally {
    dropdown.disabled = false;
  }
}