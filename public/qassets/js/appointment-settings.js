// appointment-settings.js
console.log("[Appointment-settings] web loaded");

const API_BASE =
  location.hostname.includes("localhost")
    ? "http://localhost:8400"
    : "https://api.suiteseat.io";

// Always call backend through this helper
function apiFetch(path, options = {}) {
  const url = `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;
  return fetch(url, {
    credentials: "include",
    ...options,
  });
}

// ------------------------------
// Header auth
// ------------------------------
async function fetchMe() {
  const res = await apiFetch("/api/me");
  const data = await res.json().catch(() => ({}));
  return data; // { ok, user } OR { loggedIn: false } depending on your backend
}

function setHeaderLoggedOut() {
  const status = document.getElementById("login-status-text");
  const loginBtn = document.getElementById("open-login-popup-btn");
  const logoutBtn = document.getElementById("logout-btn");

  if (status) status.textContent = "Not logged in";
  if (loginBtn) loginBtn.style.display = "inline-block";
  if (logoutBtn) logoutBtn.style.display = "none";
}

function setHeaderLoggedIn(user) {
  const status = document.getElementById("login-status-text");
  const loginBtn = document.getElementById("open-login-popup-btn");
  const logoutBtn = document.getElementById("logout-btn");

  const first = (user?.firstName || "").trim();
  const last = (user?.lastName || "").trim();
  const name = [first, last].filter(Boolean).join(" ").trim();

  if (status) status.textContent = name ? `Hey, ${name}` : "Logged in";
  if (loginBtn) loginBtn.style.display = "none";
  if (logoutBtn) logoutBtn.style.display = "inline-block";
}

async function initHeaderAuth() {
  try {
    const data = await fetchMe();

    // support either shape:
    // (A) { ok:true, user:{} }
    // (B) { loggedIn:true, user:{} }
    const ok = !!data?.ok || !!data?.loggedIn;

    if (ok && data?.user) setHeaderLoggedIn(data.user);
    else setHeaderLoggedOut();
  } catch (e) {
    console.error("[auth header] failed:", e);
    setHeaderLoggedOut();
  }
}

// ------------------------------
// Tabs
// ------------------------------
function initTabs() {
  const optionTabs = document.querySelectorAll(".option");
  const tabSections = document.querySelectorAll("[id$='-section']");

  optionTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      optionTabs.forEach((t) => t.classList.remove("active"));
      tabSections.forEach((section) => (section.style.display = "none"));
      tab.classList.add("active");

      const targetId = `${tab.dataset.id}-section`;
      const section = document.getElementById(targetId);
      if (section) section.style.display = "block";
      if (targetId === "booking-section") attachSaveTemplateLogic?.();
    });
  });
}

// ------------------------------
// Business helpers
// ------------------------------
function slugify(str = "") {
  return String(str)
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

// GLOBAL slug check (all users) using your existing public route
async function isSlugTakenGlobal(typeName, slug) {
  const where = encodeURIComponent(JSON.stringify({ slug }));
  const path = `/public/records?dataType=${encodeURIComponent(typeName)}&where=${where}&limit=2`;

  const res = await apiFetch(path, { cache: "no-store" });
  // Some of your public endpoints return an array directly, others return {items:[]}
  const out = await res.json().catch(() => ({}));

  const items = Array.isArray(out) ? out : (out?.items || []);
  return items.length > 0;
}

async function uploadOneImage(file) {
  const fd = new FormData();
  fd.append("file", file);

  const resp = await apiFetch("/api/upload", { method: "POST", body: fd });
  const out = await resp.json().catch(() => ({}));
  return out?.url || "";
}
// ------------------------------
// DOMContentLoaded init
// ------------------------------
document.addEventListener("DOMContentLoaded", () => {
  // init header + tabs
  initHeaderAuth();
  initTabs();

  // ✅ LOGIN submit
  document.getElementById("login-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = document.getElementById("login-email")?.value?.trim();
    const password = document.getElementById("login-password")?.value;

    const payload = { email, password };

    const res = await apiFetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const out = await res.json().catch(() => ({}));

    if (!res.ok) {
      alert(out?.error || out?.message || "Login failed");
      return;
    }

    // ✅ refresh header state
    await initHeaderAuth();
  });

  // ✅ LOGOUT
  document.getElementById("logout-btn")?.addEventListener("click", async () => {
    try {
      await apiFetch("/api/logout", { method: "POST" });
    } catch {}
    setHeaderLoggedOut();
    location.reload();
  });

  // ✅ SAVE BUSINESS
  const form = document.getElementById("popup-add-business-form");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    try {
      const businessName = String(
        document.getElementById("popup-business-name-input")?.value || ""
      ).trim();

      const yourName = String(
        document.getElementById("popup-your-name-input")?.value || ""
      ).trim();

      const phone = String(
        document.getElementById("popup-business-phone-number-input")?.value || ""
      ).trim();

      const locationName = String(
        document.getElementById("popup-business-location-name-input")?.value || ""
      ).trim();

      const address = String(
        document.getElementById("popup-business-address-input")?.value || ""
      ).trim();

      const email = String(
        document.getElementById("popup-business-email-input")?.value || ""
      ).trim();

      if (!businessName) return alert("Business Name is required");

      const slug = slugify(businessName);
      if (!slug) return alert("Please enter a business name to create a slug.");

      const taken = await isSlugTakenGlobal("Business", slug);
      if (taken) {
        alert(`That booking link is not available: "${slug}". Try a different business name.`);
        return;
      }

      const fileInput = document.getElementById("image-upload");
      const file = fileInput?.files?.[0] || null;

      let heroUrl = "";
      if (file) heroUrl = await uploadOneImage(file);

      const resp = await apiFetch("/api/records/Business", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          values: {
            businessName,
            yourName,
            phoneNumber: phone,
            locationName,
            businessAddress: address,
            businessEmail: email,
            slug,
            heroImageUrl: heroUrl,
          },
        }),
      });

      const out = await resp.json().catch(() => ({}));

      if (!resp.ok) {
        console.log("Create business failed:", resp.status, out);
        alert(out?.error || out?.message || "Could not create business");
        return;
      }

      const created = out?.items?.[0];
      if (!created?._id) {
        console.log("Create business failed:", out);
        alert("Could not create business");
        return;
      }

      console.log("✅ Business created:", created);

      if (typeof loadBusinesses === "function") await loadBusinesses();
      if (typeof closeAddBusinessPopup === "function") closeAddBusinessPopup();
    } catch (err) {
      console.error("Save business error:", err);
      alert("Error saving business");
    }
  });
});
