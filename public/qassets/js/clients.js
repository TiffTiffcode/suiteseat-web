// keep these at top as you already have:
let editingClientId = null;
let fullClientList = [];

// ---- LOGIN WIRING (drop-in replacement) ----
document.addEventListener("DOMContentLoaded", () => {
  const loginStatus  = document.getElementById("login-status-text");
  const openLoginBtn = document.getElementById("open-login-popup-btn");
  const logoutBtn    = document.getElementById("logout-btn");
  const loginForm    = document.getElementById("login-form");

  // helper: build a friendly name
  function displayNameFrom(d) {
    const first = d?.firstName || d?.first_name || d?.user?.firstName || d?.user?.first_name;
    const last  = d?.lastName  || d?.last_name  || d?.user?.lastName  || d?.user?.last_name;
    if (first && last) return `${first} ${last}`;
    const candidates = [d?.name, d?.user?.name, d?.displayName, d?.fullName, first, d?.email?.split("@")[0]];
    return candidates.find(Boolean) || "";
  }

  // helper: close the login popup (prevents the “not defined” error)
  function closeLoginPopup() {
    document.getElementById("popup-login")?.style?.setProperty("display", "none");
    document.getElementById("popup-overlay")?.style?.setProperty("display", "none");
    document.body.classList.remove("popup-open");
  }
  // expose if other code wants it
  window.closeLoginPopup = closeLoginPopup;

  // check login and update header
  async function checkLogin() {
    try {
      const res  = await fetch("/check-login", { credentials: "include", cache: "no-store" });
      const data = await res.json();
      if (data.loggedIn) {
        const name = displayNameFrom(data) || (data.email ? data.email.split("@")[0] : "");
        if (loginStatus) loginStatus.textContent = name ? `Hi, ${name} 👋` : "Hi 👋";
        if (logoutBtn)   logoutBtn.style.display = "inline-block";
        if (openLoginBtn) openLoginBtn.style.display = "none";
        window.currentUserId = data.userId;
      } else {
        if (loginStatus)  loginStatus.textContent = "Not logged in";
        if (logoutBtn)    logoutBtn.style.display = "none";
        if (openLoginBtn) openLoginBtn.style.display = "inline-block";
      }
    } catch (err) {
      console.error("Login check failed:", err);
      if (loginStatus) loginStatus.textContent = "Not logged in";
    }
  }

  // open popup
  openLoginBtn?.addEventListener("click", () => {
    document.getElementById("popup-login")?.style?.setProperty("display", "block");
    document.getElementById("popup-overlay")?.style?.setProperty("display", "block");
    document.body.classList.add("popup-open");
  });

  // logout
  logoutBtn?.addEventListener("click", async () => {
    try {
      const res = await fetch("/logout", { credentials: "include" });
      const result = await res.json().catch(() => ({}));
      if (res.ok) {
        alert("👋 Logged out!");
        window.location.href = "signup.html";
      } else {
        alert(result.message || "Logout failed.");
      }
    } catch (err) {
      console.error("Logout error:", err);
      alert("Something went wrong during logout.");
    }
  });

  // login submit
  loginForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("login-email")?.value.trim();
    const password = document.getElementById("login-password")?.value.trim();
    if (!email || !password) return alert("Please enter both email and password.");

    try {
      const res = await fetch("/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        cache: "no-store",
        body: JSON.stringify({ email, password }),
      });
      const result = await res.json().catch(() => ({}));
      if (res.ok) {
        alert("✅ Logged in!");
        window.closeLoginPopup?.();
        location.reload();
      } else {
        alert(result.message || "Login failed.");
      }
    } catch (err) {
      console.error("Login error:", err);
      alert("Something went wrong.");
    }
  });

  // run once
  checkLogin();
});


  // DONE Load all clients associated with the user (created + booked)
// Utility: tolerant getter
// === Clients Page Module ===
(() => {
  const $ = (s) => document.querySelector(s);

  // ---------- helpers ----------
  function vget(v, ...keys) { for (const k of keys) if (v && v[k] != null) return v[k]; }

  async function populateClientBusinessDropdown() {
    const dropdown = $("#client-business");
    if (!dropdown) return;

    dropdown.innerHTML = `<option value="">Loading…</option>`;
    dropdown.disabled = true;

    const bizLabel = (v = {}) =>
      vget(v, "Business Name", "businessName", "Name", "name") || "(Untitled Business)";

    try {
      const params = new URLSearchParams({
        limit: "500",
        sort: JSON.stringify({ "Business Name": 1, "Name": 1, createdAt: 1 }),
        ts: Date.now().toString()
      });

      const res = await fetch(`/api/records/Business?${params}`, {
        credentials: "include",
        cache: "no-store"
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const rows = (await res.json())
        .filter(r => !r.deletedAt && !vget(r.values, "is Deleted", "isDeleted"))
        .sort((a, b) => bizLabel(a.values).localeCompare(bizLabel(b.values)));

      dropdown.innerHTML = `<option value="">-- Choose Business --</option>`;
      for (const r of rows) dropdown.appendChild(new Option(bizLabel(r.values), String(r._id)));

      // preselect from main filter if not "all"
      const main = $("#business-filter") || $("#business-dropdown");
      const preferred = (main && main.value && main.value !== "all") ? main.value : null;
      if (preferred && dropdown.querySelector(`option[value="${preferred}"]`)) dropdown.value = preferred;
    } catch (err) {
      console.error("❌ Error loading businesses:", err);
      dropdown.innerHTML = `<option value="">-- Choose Business --</option>`;
    } finally {
      dropdown.disabled = false;
    }
  }

  function recordMatchesBusiness(rec, bizId) {
    if (!bizId || bizId === "all") return true;
    const v = rec?.values || {};
    const b = v["Business"] ?? v["businessId"] ?? v["Business Id"];
    if (!b) return false;
    if (typeof b === "string") return String(b) === String(bizId);
    if (typeof b === "object" && (b._id || b.id)) return String(b._id || b.id) === String(bizId);
    return false;
  }

  async function fetchClientsWhere(whereObj, limit = 500, sortObj = { _id: -1, createdAt: -1 }) {
    const qs = new URLSearchParams({
      where: JSON.stringify(whereObj || {}),
      limit: String(limit),
      sort:  JSON.stringify(sortObj),
      ts:    Date.now().toString()
    });
    const res = await fetch(`/api/records/Client?${qs}`, { credentials: "include", cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  }

  async function loadAllClients(businessId = "all") {
    try {
      let rows = [];
      if (businessId && businessId !== "all") {
        // try server-side filter then fall back
        rows = await fetchClientsWhere({ "Business._id": businessId });
        if (!rows.length) rows = await fetchClientsWhere({});
        rows = rows.filter(r => recordMatchesBusiness(r, businessId));
      } else {
        rows = await fetchClientsWhere({});
      }

      const clients = rows
        .filter(r => !r.deletedAt && !vget(r.values, "is Deleted", "isDeleted"))
        .map(r => {
          const v = r.values || {};
          const biz = v["Business"];
          const businessId = typeof biz === "string" ? biz : (biz && biz._id) || "";
          return {
            _id:        r._id,
            businessId,
            firstName:  vget(v, "First Name", "firstName") || "",
            lastName:   vget(v, "Last Name",  "lastName")  || "",
            email:      vget(v, "Email", "email") || "",
            phone:      vget(v, "Phone Number", "phoneNumber", "phone") || "",
            raw: r
          };
        })
        .sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`));

      if (typeof renderClientList === "function") renderClientList(clients);
      else console.log("Rendered clients (stub):", clients.length);

      window.fullClientList = clients;
      return clients;
    } catch (err) {
      console.error("Error loading clients:", err);
      if (typeof renderClientList === "function") renderClientList([]);
      return [];
    }
  }
  window.loadAllClients = loadAllClients;

async function openEditClientPopup(clientId) {
  const res = await fetch(`/api/records/Client/${encodeURIComponent(clientId)}?ts=${Date.now()}`, {
    credentials: "include",
    cache: "no-store"
  });
  const rec = await res.json();

  // fill fields...
  const v = rec.values || {};
  document.getElementById("client-name").value      = v["First Name"]   || "";
  document.getElementById("client-last-name").value = v["Last Name"]    || "";
  document.getElementById("client-email").value     = v["Email"]        || "";
  document.getElementById("client-phone").value     = v["Phone Number"] || v["Phone"] || "";

  window.editingClientId = rec._id;

  // show popup, then populate with preferredId
  const popup = document.getElementById("popup-add-client");
  popup.style.display = "block";
  document.body.classList.add("popup-open");

  const bizId = getClientBusinessId(rec);
  await populateClientBusinessDropdown(bizId);

  // (optional) if still missing, append that single business and select it
  const sel = document.getElementById("client-business");
  if (bizId && !sel.querySelector(`option[value="${bizId}"]`)) {
    try {
      const rb = await fetch(`/api/records/Business/${encodeURIComponent(bizId)}?ts=${Date.now()}`, {
        credentials: "include", cache: "no-store"
      });
      if (rb.ok) {
        const biz = await rb.json();
        const label = biz?.values?.["Business Name"] || biz?.values?.["Name"] || "Business";
        sel.appendChild(new Option(label, String(bizId)));
      }
      sel.value = String(bizId);
    } catch {}
  }
}


  // One canonical version — accepts a preferredId to preselect
async function populateClientBusinessDropdown(preferredId = "") {
  const dropdown = document.getElementById("client-business");
  if (!dropdown) { console.warn("⚠️ #client-business not found"); return; }

  dropdown.innerHTML = `<option value="">Loading…</option>`;
  dropdown.disabled = true;

  const bizLabel = (v = {}) =>
    vget(v, "Business Name", "businessName", "Name", "name") || "(Untitled Business)";

  try {
    const params = new URLSearchParams({
      limit: "500",
      sort: JSON.stringify({ "Business Name": 1, "Name": 1, createdAt: 1 }),
      ts: Date.now().toString()
    });

    const res = await fetch(`/api/records/Business?${params}`, {
      credentials: "include",
      cache: "no-store"
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const rows = (await res.json())
      .filter(r => !r.deletedAt && !vget(r.values, "is Deleted", "isDeleted"))
      .sort((a, b) => bizLabel(a.values).localeCompare(bizLabel(b.values)));

    dropdown.innerHTML = `<option value="">-- Choose Business --</option>`;
    for (const r of rows) dropdown.appendChild(new Option(bizLabel(r.values), String(r._id)));

    // determine what to select
    const main = document.getElementById("business-filter") || document.getElementById("business-dropdown");
    const fallback = (main && main.value && main.value !== "all") ? main.value : (window.lastEditedBusinessId || "");
    const toSelect = String(preferredId || fallback || "");

    if (toSelect && dropdown.querySelector(`option[value="${toSelect}"]`)) {
      dropdown.value = toSelect;
    }
  } catch (err) {
    console.error("❌ Error loading businesses:", err);
    dropdown.innerHTML = `<option value="">-- Choose Business --</option>`;
  } finally {
    dropdown.disabled = false;
  }
}

function getClientBusinessId(clientRecord) {
  const v = clientRecord?.values || {};
  const b = v["Business"] ?? v["businessId"] ?? v["Business Id"];
  if (!b) return "";
  if (typeof b === "string") return b;
  if (typeof b === "object") return String(b._id || b.id || "");
  return "";
}

  // ---------- SAVE (submit) ----------
  async function onSaveClient(e) {
    e.preventDefault();
    console.log("[Clients] submit fired");

    const businessId = $("#client-business")?.value || "";
    const firstName  = ($("#client-name")?.value || "").trim();
    const lastName   = ($("#client-last-name")?.value || "").trim();
    const email      = ($("#client-email")?.value || "").trim();
    const phone      = ($("#client-phone")?.value || "").trim();

    if (!businessId || !firstName) {
      alert("Please choose a Business and enter at least First Name.");
      return;
    }

    // Use the labels your server already accepts
    const values = {
      "Business":     { _id: businessId },
      "First Name":   firstName,
      "Last Name":    lastName,
      "Email":        email,
      "Phone Number": phone,
      "is Deleted":   false
    };

    try {
      const isEdit = !!window.editingClientId;
      const url    = isEdit
        ? `/api/records/Client/${encodeURIComponent(window.editingClientId)}`
        : `/api/records/Client`;
      const method = isEdit ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ values })
      });

      const text = await res.text();
      let result = null;
      try { result = text ? JSON.parse(text) : null; } catch { result = text; }
      console.log("[Clients] save status:", res.status, "result:", result);

      if (!res.ok) {
        const msg = (result && (result.error || result.message)) || `HTTP ${res.status}`;
        throw new Error(msg);
      }

      alert(isEdit ? "✅ Client updated" : "✅ Client created");

      window.editingClientId = null;
      if (typeof closeClientPopup === "function") closeClientPopup();
      $("#add-client-form")?.reset();

      const selectedBiz = $("#business-filter")?.value || "all";
      await loadAllClients(selectedBiz);
    } catch (err) {
      console.error("❌ Failed to save client:", err);
      alert(err.message || "Failed to save client");
    }
  }

  // ---------- business filter ----------
  async function populateBusinessDropdown() {
    const dropdown = $("#business-filter");
    if (!dropdown) return;

    dropdown.innerHTML = '<option value="">Loading…</option>';
    dropdown.disabled = true;

    const bizLabel = (v = {}) =>
      vget(v, "Business Name", "businessName", "Name", "name") || "(Untitled Business)";

    try {
      const params = new URLSearchParams({
        limit: "500",
        sort: JSON.stringify({ "Business Name": 1, "Name": 1, createdAt: 1 }),
        ts: Date.now().toString()
      });

      const res = await fetch(`/api/records/Business?${params}`, {
        credentials: "include",
        cache: "no-store"
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const rows = (await res.json())
        .filter(r => !r.deletedAt && !vget(r.values, "is Deleted", "isDeleted"))
        .sort((a, b) => bizLabel(a.values).localeCompare(bizLabel(b.values)));

      dropdown.innerHTML = "";
      dropdown.appendChild(new Option("All Businesses", "all"));
      for (const r of rows) dropdown.appendChild(new Option(bizLabel(r.values), String(r._id)));

      const remembered = sessionStorage.getItem("clients_business_filter") || "all";
      dropdown.value = dropdown.querySelector(`option[value="${remembered}"]`) ? remembered : "all";
    } catch (err) {
      console.error("[populateBusinessDropdown] error:", err);
      dropdown.innerHTML = "";
      dropdown.appendChild(new Option("All Businesses", "all"));
      dropdown.value = "all";
    } finally {
      dropdown.disabled = false;
    }
  }

  // ---------- init (bind once) ----------
  function initClients() {
    console.log("[Clients] init");

    const form  = $("#add-client-form");
    if (form && !form.dataset.bound) {
      form.addEventListener("submit", onSaveClient);
      form.dataset.bound = "1";
    }

    // + Add Client button(s)
    const addBtn1 = $("#add-client-btn");
    const addBtn2 = $("#open-add-client-popup-btn");
    [addBtn1, addBtn2].forEach(btn => {
      if (btn && !btn.dataset.bound) {
        btn.addEventListener("click", openClientPopup);
        btn.dataset.bound = "1";
      }
    });

    // Populate left filter + initial list
    populateBusinessDropdown().then(async () => {
      const bf = $("#business-filter");
      if (bf && !bf.dataset.bound) {
        bf.addEventListener("change", () => loadAllClients(bf.value || "all"));
        bf.dataset.bound = "1";
      }
      await loadAllClients(bf?.value || "all");
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initClients);
  } else {
    initClients();
  }
})();
// ====================== Save Client (corrected) ======================

// Helper: tolerant getter
function vget(v, ...keys) {
  for (const k of keys) if (v && v[k] != null) return v[k];
  return undefined;
}

// Fill the <select id="client-business"> with the user's businesses
async function populateClientBusinessDropdown() {
  const dropdown = document.getElementById("client-business");
  if (!dropdown) {
    console.warn("⚠️ #client-business not found");
    return;
  }

  dropdown.innerHTML = `<option value="">Loading…</option>`;
  dropdown.disabled = true;

  const bizLabel = (v = {}) =>
    vget(v, "Business Name", "businessName", "Name", "name") || "(Untitled Business)";

  try {
    const params = new URLSearchParams({
      limit: "500",
      sort: JSON.stringify({ "Business Name": 1, "Name": 1, createdAt: 1 }),
      ts: Date.now().toString()
    });

    const res = await fetch(`/api/records/Business?${params}`, {
      credentials: "include",
      cache: "no-store"
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const rows = (await res.json())
      .filter(r => !r.deletedAt && !vget(r.values, "is Deleted", "isDeleted"))
      .sort((a, b) => bizLabel(a.values).localeCompare(bizLabel(b.values)));

    dropdown.innerHTML = `<option value="">-- Choose Business --</option>`;
    for (const r of rows) {
      dropdown.appendChild(new Option(bizLabel(r.values), String(r._id)));
    }

    // Preselect from the main filter if present (and not "all")
    const main = document.getElementById("business-dropdown") ||
                 document.getElementById("business-filter");
    const preferred =
      (main && main.value && main.value !== "all" && main.value) ||
      (window.lastEditedBusinessId || "");

    if (preferred && dropdown.querySelector(`option[value="${preferred}"]`)) {
      dropdown.value = preferred;
    }

    console.log(`✅ Populated #client-business with ${rows.length} businesses`);
  } catch (err) {
    console.error("❌ Error loading businesses for #client-business:", err);
    dropdown.innerHTML = `<option value="">-- Choose Business --</option>`;
  } finally {
    dropdown.disabled = false;
  }
}

// Detect the real Client field labels + Business reference shape from existing docs
function normalizeKey(s = "") {
  return String(s).toLowerCase().replace(/[\s_-]+/g, " ").trim();
}

async function detectClientFieldMap() {
  const url = `/api/records/Client?limit=5&sort=${encodeURIComponent(JSON.stringify({ _id: -1, createdAt: -1 }))}&ts=${Date.now()}`;
  const res = await fetch(url, { credentials: "include", cache: "no-store" });
  const rows = res.ok ? await res.json() : [];

  const map = {
    firstName: "First Name",
    lastName:  "Last Name",
    email:     "Email",
    phone:     "Phone Number",
    business:  "Business",
    isDeleted: "is Deleted",
    businessShape: "object", // "object" ({_id}) or "string"
  };

  if (!Array.isArray(rows) || rows.length === 0) return map;

  const keys = new Set();
  for (const r of rows) {
    const v = r?.values || {};
    Object.keys(v).forEach(k => keys.add(k));
    // detect how Business is stored
    if (v["Business"] !== undefined) {
      const b = v["Business"];
      if (typeof b === "string") map.businessShape = "string";
      else if (b && typeof b === "object" && b._id) map.businessShape = "object";
    }
  }

  const candidates = [...keys].reduce((acc, k) => (acc[normalizeKey(k)] = k, acc), {});
  const pick = (...alts) => {
    for (const a of alts) {
      const n = normalizeKey(a);
      if (candidates[n]) return candidates[n];
    }
    return null;
  };

  map.firstName = pick("First Name","first name","firstname","first_name") || map.firstName;
  map.lastName  = pick("Last Name","last name","lastname","last_name")     || map.lastName;
  map.email     = pick("Email","e-mail")                                    || map.email;
  map.phone     = pick("Phone Number","phone","mobile")                     || map.phone;
  map.business  = pick("Business","business id","business_id")              || map.business;
  map.isDeleted = pick("is Deleted","is deleted","isdeleted","deleted")     || map.isDeleted;

  return map;
}

// Safe JSON (so bad responses don't crash the handler)
async function safeJson(res) {
  const text = await res.text();
  try { return text ? JSON.parse(text) : null; } catch { return text; }
}

// --------- Bind once when DOM is ready ---------
document.addEventListener("DOMContentLoaded", () => {
  const form   = document.getElementById("add-client-form");
  const addBtn1 = document.getElementById("add-client-btn");
  const addBtn2 = document.getElementById("open-add-client-popup-btn");

  // Submit (Create/Update)
  if (form && !form.dataset.bound) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      console.log("[Create Client] submit fired");

      const businessId = document.getElementById("client-business")?.value || "";
      const firstName  = (document.getElementById("client-name")?.value || "").trim();
      const lastName   = (document.getElementById("client-last-name")?.value || "").trim();
      const email      = (document.getElementById("client-email")?.value || "").trim();
      const phone      = (document.getElementById("client-phone")?.value || "").trim();

      if (!businessId || !firstName) {
        alert("Please choose a Business and enter at least First Name.");
        return;
      }

      // Detect labels + business shape from existing records
      const map = await detectClientFieldMap();

      // Build values using detected labels
      const values = {
        [map.firstName]: firstName,
        [map.lastName]:  lastName,
        [map.email]:     email,
        [map.phone]:     phone,
        [map.isDeleted]: false
      };

      // Business reference shape per detection
      if (map.businessShape === "object") {
        values[map.business] = { _id: businessId };
      } else {
        values[map.business] = businessId; // string id
      }

      console.log("[Create Client] using field map:", map, "values:", values);

      try {
        const isEdit = !!window.editingClientId;
        const url    = isEdit
          ? `/api/records/Client/${encodeURIComponent(window.editingClientId)}`
          : `/api/records/Client`;
        const method = isEdit ? "PATCH" : "POST";

        const res = await fetch(url, {
          method,
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
          body: JSON.stringify({ values })
        });

        const result = await safeJson(res);
        console.log("[Create Client] server result:", result);

        if (!res.ok) {
          const msg = (result && (result.error || result.message)) || `HTTP ${res.status}`;
          throw new Error(msg);
        }

        alert(isEdit ? "✅ Client updated" : "✅ Client created");

        // Reset edit state & close popup (if you have these functions)
        window.editingClientId = null;
        if (typeof closeClientPopup === "function") closeClientPopup();
        if (typeof resetClientForm === "function") resetClientForm();
        else form.reset();

        // Reload list using current filter (if present), else show all
        const selectedBiz = document.getElementById("business-filter")?.value || "all";
        if (typeof loadAllClients === "function") {
          await loadAllClients(selectedBiz);
        }
      } catch (err) {
        console.error("❌ Failed to save client:", err);
        alert(err.message || "Failed to save client");
      }
    });
    form.dataset.bound = "1";
    console.log("[Create Client] submit handler bound");
  }

  // “Add Client” buttons → open popup in CREATE mode
  function prepareCreateClientPopup() {
    window.editingClientId = null;  // ensure we're in create mode
    (typeof resetClientForm === "function" ? resetClientForm() : document.getElementById("add-client-form")?.reset());

    // Show popup first, then populate dropdown
    const popup = document.getElementById("popup-add-client");
    if (popup) {
      popup.style.display = "block";
      document.body.classList.add("popup-open");
    }

    // Populate and then preselect from main filter
    populateClientBusinessDropdown().then(() => {
      const main = document.getElementById("business-dropdown") ||
                   document.getElementById("business-filter");
      const sel = document.getElementById("client-business");
      if (main?.value && main.value !== "all" && sel?.querySelector(`option[value="${main.value}"]`)) {
        sel.value = main.value;
      }
    });
  }

  addBtn1?.addEventListener("click", prepareCreateClientPopup);
  addBtn2?.addEventListener("click", prepareCreateClientPopup);
});


//Delete Client 
// ---- Delete Client (hard delete if supported; else soft delete) ----
document.addEventListener("DOMContentLoaded", () => {
  const delBtn = document.getElementById("delete-client-btn");
  if (!delBtn || delBtn.dataset.bound) return;

  delBtn.addEventListener("click", async () => {
    if (!window.editingClientId) return;
    if (!confirm("Are you sure you want to delete this client?")) return;

    const id = encodeURIComponent(window.editingClientId);

    // local safe JSON
    async function safeJson(res) {
      const txt = await res.text();
      try { return txt ? JSON.parse(txt) : null; } catch { return txt; }
    }

    try {
      // 1) Try HARD delete
      let res = await fetch(`/api/records/Client/${id}?ts=${Date.now()}`, {
        method: "DELETE",
        credentials: "include",
        cache: "no-store"
      });

      // 2) If not allowed (405/404), do SOFT delete with the right label
      if (!res.ok && (res.status === 405 || res.status === 404)) {
        const map = await detectClientFieldMap(); // uses your helper above
        const softValues = { [map.isDeleted]: true };
        res = await fetch(`/api/records/Client/${id}`, {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
          body: JSON.stringify({ values: softValues })
        });
      }

      const result = await safeJson(res);
      if (!res.ok) {
        const msg = (result && (result.error || result.message)) || `HTTP ${res.status}`;
        throw new Error(msg);
      }

      alert("🗑️ Client deleted");
      window.editingClientId = null;

      if (typeof closeClientPopup === "function") closeClientPopup();

      // reload list (preserve current Business filter)
      const selectedBiz = document.getElementById("business-filter")?.value || "all";
      if (typeof loadAllClients === "function") {
        await loadAllClients(selectedBiz);
      }
    } catch (err) {
      console.error("Delete error:", err);
      alert("❌ Failed to delete client: " + (err.message || "Unknown error"));
    }
  });

  delBtn.dataset.bound = "1";
});


/* 
  Optional alternative (mark your custom fields too):
  await fetch(`/api/records/Client/${id}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ values: { "is Deleted": true, "Deleted At": new Date().toISOString() } })
  });
*/

// ---- Search Bar ----
// Ensure the global exists
window.fullClientList = window.fullClientList || [];

// Simple debounce
function debounce(fn, ms = 200) {
  let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

const searchEl = document.getElementById("client-search");
if (searchEl) {
  const onSearch = debounce(() => {
    const q = (searchEl.value || "").toLowerCase().trim();

    const list = window.fullClientList || [];
    const filtered = !q ? list : list.filter(client => {
      const fullName = `${client.firstName || ""} ${client.lastName || ""}`.toLowerCase();
      const email    = (client.email || "").toLowerCase();
      const phone    = (client.phone || "").toLowerCase();
      // If you later include businessLabel in your client objects, this will start working automatically.
      const bizLabel = (client.businessLabel || "").toLowerCase();
      return (
        fullName.includes(q) ||
        email.includes(q) ||
        phone.includes(q) ||
        bizLabel.includes(q)
      );
    });

    if (typeof renderClientList === "function") {
      renderClientList(filtered);
    }
  }, 180);

  searchEl.addEventListener("input", onSearch);
}




//End Dom???????????????

// 🔴 You already have this in your HTML, but here's the CLOSE function for reference
function closeClientPopup({ reset = false } = {}) {
  const popup   = document.getElementById("popup-add-client");
  const overlay = document.getElementById("popup-overlay"); // if you use one globally

  if (popup) popup.style.display = "none";
  if (overlay) overlay.style.display = "none";
  document.body.classList.remove("popup-open");

  // clear current editing id
  window.editingClientId = null;

  // optional: reset the form when closing
  if (reset) document.getElementById("add-client-form")?.reset();
}

// Load Businesses into #client-business (for add/edit client forms)
// Load Businesses into #client-business (for add/edit client forms)
async function loadBusinessOptions() {
  const dropdown = document.getElementById("client-business");
  if (!dropdown) return;

  const prev = dropdown.value || "";
  dropdown.innerHTML = `<option value="">-- Choose Business --</option>`;
  dropdown.disabled = true;

  const bizNameOf = (v = {}) =>
    v["Business Name"] ?? v.businessName ?? v["Name"] ?? v.name ?? "(Untitled Business)";

  try {
    const qs = new URLSearchParams({
      limit: "500",
      sort : JSON.stringify({ "Business Name": 1, "Name": 1, createdAt: 1 }),
      ts   : Date.now()
    });

    const res = await fetch(`/api/records/Business?${qs}`, {
      credentials: "include",
      cache: "no-store"
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const rows = (await res.json())
      .filter(r => !r.deletedAt && !(r?.values?.["is Deleted"] || r?.values?.isDeleted))
      .sort((a, b) => bizNameOf(a.values).localeCompare(bizNameOf(b.values)));

    for (const r of rows) {
      const opt = document.createElement("option");
      opt.value = r._id;
      opt.textContent = bizNameOf(r.values);
      dropdown.appendChild(opt);
    }

    // Prefer a main page filter if present and not "all"
    const main = document.getElementById("business-dropdown") ||
                 document.getElementById("business-filter");
    const preferred = (main && main.value && main.value !== "all") ? main.value : prev;

    if (preferred && dropdown.querySelector(`option[value="${preferred}"]`)) {
      dropdown.value = preferred;
    }
  } catch (err) {
    console.error("❌ Failed to load businesses:", err);
    // keep placeholder
  } finally {
    dropdown.disabled = false;
  }
}


//change?
document.addEventListener('DOMContentLoaded', () => {
  const list = document.getElementById('client-list-container');
  if (list && !list.dataset.bound) {
    list.addEventListener('click', async (e) => {
      const btn = e.target.closest('.add-info-btn');
      if (!btn) return;
      const clientId = btn.dataset.clientId;
      await openClientInfo(clientId);
    });
    list.dataset.bound = '1'; // prevent duplicate binding if this code runs twice
  }

  // kick off initial data load (optional)
  loadAllClients(); 
});




// Render clients (expects flat objects like { _id, firstName, lastName, ... })
function renderClientList(clients) {
  const container = document.getElementById("client-list-container");
  if (!container) return;

  container.innerHTML = "";

  if (!Array.isArray(clients) || clients.length === 0) {
    container.innerHTML = `<div class="client-row">No clients found</div>`;
    return;
  }

  // Sort A–Z by First + Last
  const sorted = [...clients].sort((a, b) => {
    const A = `${a.firstName || ""} ${a.lastName || ""}`.trim().toLowerCase();
    const B = `${b.firstName || ""} ${b.lastName || ""}`.trim().toLowerCase();
    return A.localeCompare(B);
  });

  for (const client of sorted) {
    const row = document.createElement("div");
    row.className = "client-row";
    row.innerHTML = `
      <div class="client-name">${(client.firstName || "")} ${(client.lastName || "")}</div>
      <button class="white-button add-info-btn" data-client-id="${client._id}">Add Info</button>
    `;
    container.appendChild(row);
  }

  // Delegate click for “Add Info” (bind once)
  if (!container.dataset.bound) {
    container.addEventListener("click", (e) => {
      const btn = e.target.closest(".add-info-btn");
      if (!btn) return;
      const id = btn.getAttribute("data-client-id");
      // TODO: open your client edit popup here
      // openClientPopupWithId(id);  // ← your function, if you have one
    });
    container.dataset.bound = "1";
  }
}


//Reload Client List after saving 
// ✅ New: Load clients via /api/records
// Helper to normalize a reference (string or {_id})
function _refId(x) {
  if (!x) return "";
  if (typeof x === "object") return String(x._id || x.id || "");
  return String(x);
}

// Main loader
async function loadAllClients(businessId = "all") {
  try {
    // Build WHERE: if "all", don’t filter on the server (we’ll filter client-side if needed)
    const where = {};
    if (businessId && businessId !== "all") {
      // Try to match either plain id or object {_id} on the server
      // (Your server already supports tolerant queries, but we’ll still guard client-side)
      where["Business"] = businessId;
    }

    const qs = new URLSearchParams({
      where: JSON.stringify(where),
      limit: "1000",
      sort: JSON.stringify({ "First Name": 1, "Last Name": 1, "createdAt": 1 }),
      ts: Date.now().toString()
    });

    let res = await fetch(`/api/records/Client?${qs.toString()}`, {
      credentials: "include",
      cache: "no-store"
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    let rows = await res.json();
    rows = Array.isArray(rows) ? rows : [];

    // Defensive filter by Business (works for string or {_id})
    const filtered = (businessId && businessId !== "all")
      ? rows.filter(r => _refId(r?.values?.["Business"]) === String(businessId))
      : rows;

    // Map to flat UI objects & skip soft-deleted
    const clients = filtered
      .filter(r => !r.deletedAt && !(r?.values?.["is Deleted"] || r?.values?.isDeleted))
      .map(r => {
        const v = r.values || {};
        return {
          _id:        r._id,
          firstName:  v["First Name"]   ?? v.firstName ?? "",
          lastName:   v["Last Name"]    ?? v.lastName  ?? "",
          email:      v["Email"]        ?? v.email     ?? "",
          phone:      v["Phone Number"] ?? v.phoneNumber ?? v.phone ?? "",
          businessId: _refId(v["Business"])
        };
      });

    // Save globally for search
    window.fullClientList = clients;

    // Render
    if (typeof renderClientList === "function") renderClientList(clients);
  } catch (err) {
    console.error("Error loading clients:", err);
    // Keep UI reasonable
    window.fullClientList = [];
    if (typeof renderClientList === "function") renderClientList([]);
  }
}



document.querySelectorAll(".add-info-btn").forEach((btn) => {
  btn.addEventListener("click", async (e) => {
    const clientId = e.target.dataset.clientId;
    await openClientInfo(clientId);  // ⬅️ this function opens the popup in edit mode
  });
});

//Open add new Client popup when add new client button is clicked 
 document.addEventListener("DOMContentLoaded", () => {
    const openBtn = document.getElementById("open-add-client-popup-btn");
    const popup = document.getElementById("popup-add-client");

    openBtn.addEventListener("click", () => {
      popup.style.display = "block";
      document.body.classList.add("popup-open"); // optional: lock scroll
    });
  });

  async function ensureClientBusinessOptions(preferredId = "") {
  const popup = document.getElementById("popup-add-client");
  if (!popup) return;

  const selectEl = popup.querySelector("#client-business");
  if (!selectEl) return;

  // Loading state
  selectEl.innerHTML = `<option value="">Loading…</option>`;
  selectEl.disabled = true;

  const bizLabel = (v = {}) =>
    vget(v, "Business Name", "businessName", "Name", "name") || "(Untitled Business)";

  try {
    // 1) Try to clone from the already-populated Business filter
    const filter = document.getElementById("business-filter");
    const filterHasOptions = filter && filter.options && filter.options.length > 1;

    if (filterHasOptions) {
      // Rebuild from the filter (skip "all")
      selectEl.innerHTML = `<option value="">-- Choose Business --</option>`;
      for (const opt of filter.options) {
        if (opt.value === "all") continue;
        selectEl.appendChild(new Option(opt.text, opt.value));
      }
      console.log(`✅ Copied ${selectEl.options.length - 1} businesses from #business-filter`);
    } else {
      // 2) Fallback: fetch from API
      const params = new URLSearchParams({
        limit: "500",
        sort: JSON.stringify({ "Business Name": 1, "Name": 1, createdAt: 1 }),
        ts: Date.now().toString()
      });

      const res = await fetch(`/api/records/Business?${params}`, {
        credentials: "include",
        cache: "no-store"
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const rows = (await res.json())
        .filter(r => !r.deletedAt && !vget(r.values, "is Deleted", "isDeleted"))
        .sort((a, b) => bizLabel(a.values).localeCompare(bizLabel(b.values)));

      selectEl.innerHTML = `<option value="">-- Choose Business --</option>`;
      for (const r of rows) {
        selectEl.appendChild(new Option(bizLabel(r.values), String(r._id)));
      }
      console.log(`✅ Loaded ${rows.length} businesses from API`);
    }

    // Preselect logic: prefer main filter (not "all"), then preferredId
    const main = document.getElementById("business-filter") ||
                 document.getElementById("business-dropdown");
    const preferred =
      (main && main.value && main.value !== "all" && main.value) ||
      preferredId ||
      window.lastEditedBusinessId ||
      "";

    if (preferred && selectEl.querySelector(`option[value="${preferred}"]`)) {
      selectEl.value = preferred;
    }
  } catch (err) {
    console.error("❌ ensureClientBusinessOptions error:", err);
    selectEl.innerHTML = `<option value="">-- Choose Business --</option>`;
  } finally {
    selectEl.disabled = false;
  }
}

  // Close popup function (you already have a button that calls this)
  function closeClientPopup() {
    const popup = document.getElementById("popup-add-client");
    popup.style.display = "none";
    document.body.classList.remove("popup-open"); // optional
  }

  //Open Add Client popup in edit mode when edit info button is clicked 
// v2 API version — expects /api/clients/:id and JSON
// tiny helpers
function _refId(x) {
  if (!x) return "";
  if (typeof x === "object") return String(x._id || x.id || "");
  return String(x);
}
function vget(v, ...keys) {
  for (const k of keys) if (v && v[k] != null) return v[k];
  return "";
}

async function openClientInfo(clientId) {
  window.editingClientId = clientId;

  try {
    // Use unified records API
    const res = await fetch(`/api/records/Client/${encodeURIComponent(clientId)}`, {
      method: "GET",
      headers: { "Accept": "application/json" },
      credentials: "include",
      cache: "no-store"
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
    }
    const rec = await res.json();               // a single Record
    const v   = rec?.values || {};

    // Make sure business options exist before setting the value
    await loadBusinessOptions();

    // Business can be a string id or {_id}
    const businessId = _refId(v["Business"]);

    // Populate fields (exact labels + tolerant fallbacks)
    const first = vget(v, "First Name", "firstName");
    const last  = vget(v, "Last Name",  "lastName");
    const email = vget(v, "Email",      "email");
    const phone = vget(v, "Phone Number","phone","phoneNumber");

    const bizSel = document.getElementById("client-business");
    if (bizSel && businessId && bizSel.querySelector(`option[value="${businessId}"]`)) {
      bizSel.value = businessId;
    } else if (bizSel) {
      // if the exact business isn’t in the list, leave as default
      bizSel.value = "";
    }

    document.getElementById("client-name").value       = first || "";
    document.getElementById("client-last-name").value  = last  || "";
    document.getElementById("client-email").value      = email || "";
    document.getElementById("client-phone").value      = phone || "";

    // UI chrome
    document.getElementById("client-popup-title").textContent = "Update Client";
    document.getElementById("save-client-btn").textContent    = "Update Client";
    const delBtn = document.getElementById("delete-client-btn");
    if (delBtn) delBtn.style.display = "inline-block";

    openClientPopup();
  } catch (err) {
    console.error("Failed to load client:", err);
    alert("❌ Could not load client info");
  }
}
function vget(v, ...keys) {
  for (const k of keys) if (v && v[k] != null) return v[k];
  return undefined;
}

async function populateBusinessSelect(selectEl, preferredId = "") {
  if (!selectEl) {
    console.warn("⚠️ populateBusinessSelect: no select element provided");
    return;
  }

  selectEl.innerHTML = `<option value="">Loading…</option>`;
  selectEl.disabled = true;

  const bizLabel = (v = {}) =>
    vget(v, "Business Name", "businessName", "Name", "name") || "(Untitled Business)";

  try {
    const params = new URLSearchParams({
      limit: "500",
      sort: JSON.stringify({ "Business Name": 1, "Name": 1, createdAt: 1 }),
      ts: Date.now().toString()
    });

    const res = await fetch(`/api/records/Business?${params}`, {
      credentials: "include",
      cache: "no-store"
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const rows = (await res.json())
      .filter(r => !r.deletedAt && !vget(r.values, "is Deleted", "isDeleted"))
      .sort((a, b) => bizLabel(a.values).localeCompare(bizLabel(b.values)));

    selectEl.innerHTML = `<option value="">-- Choose Business --</option>`;
    for (const r of rows) {
      selectEl.appendChild(new Option(bizLabel(r.values), String(r._id)));
    }

    // prefer main filter if set (and not 'all'), then preferredId
    const main = document.getElementById("business-filter") ||
                 document.getElementById("business-dropdown");
    const preferred = (main && main.value && main.value !== "all" && main.value) ||
                      preferredId || window.lastEditedBusinessId || "";

    if (preferred && selectEl.querySelector(`option[value="${preferred}"]`)) {
      selectEl.value = preferred;
    }

    console.log(`✅ Populated business select with ${rows.length} businesses`);
  } catch (err) {
    console.error("❌ populateBusinessSelect error:", err);
    selectEl.innerHTML = `<option value="">-- Choose Business --</option>`;
  } finally {
    selectEl.disabled = false;
  }
}
// Make sure the filler is global for easy calling
window.ensureClientBusinessOptions = async function ensureClientBusinessOptions(preferredId = "") {
  const popup = document.getElementById("popup-add-client");
  const selectEl = popup?.querySelector("#client-business");
  if (!selectEl) { console.warn("⚠️ #client-business not found in popup"); return; }

  // loading UI
  selectEl.innerHTML = `<option value="">Loading…</option>`;
  selectEl.disabled = true;

  const bizLabel = (v = {}) =>
    vget(v, "Business Name", "businessName", "Name", "name") || "(Untitled Business)";

  try {
    // If the left filter is already filled, clone from it (fast path)
    const filter = document.getElementById("business-filter");
    const cloned = filter && filter.options && filter.options.length > 1;
    if (cloned) {
      selectEl.innerHTML = `<option value="">-- Choose Business --</option>`;
      for (const opt of filter.options) {
        if (opt.value === "all") continue;
        selectEl.appendChild(new Option(opt.text, opt.value));
      }
      console.log(`✅ Copied ${selectEl.options.length - 1} businesses from #business-filter`);
    } else {
      // Fallback: fetch from API
      const params = new URLSearchParams({
        limit: "500",
        sort: JSON.stringify({ "Business Name": 1, "Name": 1, createdAt: 1 }),
        ts: Date.now().toString()
      });
      const res = await fetch(`/api/records/Business?${params}`, {
        credentials: "include",
        cache: "no-store"
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const rows = (await res.json())
        .filter(r => !r.deletedAt && !(r?.values?.["is Deleted"] || r?.values?.isDeleted))
        .sort((a, b) => bizLabel(a.values).localeCompare(bizLabel(b.values)));

      selectEl.innerHTML = `<option value="">-- Choose Business --</option>`;
      for (const r of rows) {
        selectEl.appendChild(new Option(bizLabel(r.values), String(r._id)));
      }
      console.log(`✅ Loaded ${rows.length} businesses from API`);
    }

    // Preselect current business if possible
    const main = document.getElementById("business-filter") || document.getElementById("business-dropdown");
    const preferred = (main && main.value && main.value !== "all" && main.value) ||
                      preferredId || window.selectedBusinessId || window.lastEditedBusinessId || "";
    if (preferred && selectEl.querySelector(`option[value="${preferred}"]`)) {
      selectEl.value = preferred;
    }
  } catch (err) {
    console.error("❌ ensureClientBusinessOptions error:", err);
    selectEl.innerHTML = `<option value="">-- Choose Business --</option>`;
  } finally {
    selectEl.disabled = false;
  }
};



async function loadBusinessOptionsInto(selectId, preferredId = "") {
  const originalId = "client-business"; // what your current function targets

  // Temporarily point your function at another select
  const target = document.getElementById(selectId);
  if (!target) return;

  // Monkey-patch: run your loader against the target select
  const saved = document.getElementById(originalId);
  if (saved !== target) {
    target.id = originalId;
    await loadBusinessOptions();
    target.id = selectId; // restore
  } else {
    await loadBusinessOptions();
  }

  if (preferredId && target.querySelector(`option[value="${preferredId}"]`)) {
    target.value = preferredId;
  }
}

const bf = document.getElementById("business-filter");
if (bf && !bf.dataset.boundToClientPopup) {
  bf.addEventListener("change", () => {
    const popupVisible = document.getElementById("popup-add-client")?.style.display !== "none";
    if (popupVisible) ensureClientBusinessOptions(bf.value);
  });
  bf.dataset.boundToClientPopup = "1";
}

//Reset add client popup 
async function openNewClientPopup() {
  // 1) clear fields + UI for create mode
  if (typeof resetClientForm === "function") resetClientForm();

  // 2) show the popup
  const popup = document.getElementById("popup-add-client");
  if (!popup) return;
  popup.style.display = "block";
  document.body.classList.add("popup-open");

  // 3) ensure business options are loaded
  if (typeof loadBusinessOptions === "function") {
    await loadBusinessOptions();
  } else if (typeof window.ensureClientBusinessOptions === "function") {
    await window.ensureClientBusinessOptions("");
  }

  // 4) preselect the main filter (if not "all"), else keep placeholder
  const main = document.getElementById("business-filter") || document.getElementById("business-dropdown");
  const sel  = document.getElementById("client-business");
  if (sel) {
    if (main?.value && main.value !== "all" && sel.querySelector(`option[value="${main.value}"]`)) {
      sel.value = main.value;
    } else if (sel.querySelector('option[value=""]')) {
      sel.value = ""; // force placeholder if nothing to preselect
    }
  }

  // 5) focus first input
  document.getElementById("client-name")?.focus();
}


// Call this when opening the Add Client popup
// Keep this for EDIT mode (called by openClientInfo) – do NOT reset here
function openClientPopup() {
  const popup = document.getElementById("popup-add-client");
  if (!popup) return;
  popup.style.display = "block";
  document.body.classList.add("popup-open");
}
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("open-add-client-popup-btn")
    ?.addEventListener("click", openNewClientPopup);

  // if you also have a second button (e.g., a "+" icon)
  document.getElementById("add-client-btn")
    ?.addEventListener("click", openNewClientPopup);
});


function resetClientForm() {
  editingClientId = null;
  document.getElementById("add-client-form").reset();
  document.getElementById("client-popup-title").textContent = "Add New Client";
  document.getElementById("save-client-btn").textContent = "Save Client";
  document.getElementById("delete-client-btn").style.display = "none";
}
