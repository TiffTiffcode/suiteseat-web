// appointment-settings.js
console.log("[Appointment-settings] web loaded");

const API_BASE =
  location.hostname.includes("localhost")
    ? "http://localhost:8400"
    : "https://api.suiteseat.io"; // ✅ CHANGE THIS to your custom domain (recommended)

// always call the backend through this helper
function apiFetch(path, options = {}) {
  const url = `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;
  return fetch(url, { credentials: "include", ...options });
}

async function fetchMe() {
  const res = await apiFetch("/api/me");
  const data = await res.json().catch(() => ({}));
  return data;
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
    if (data?.ok && data?.user) setHeaderLoggedIn(data.user);
    else setHeaderLoggedOut();
  } catch (e) {
    console.error("[auth header] failed:", e);
    setHeaderLoggedOut();
  }
}

document.addEventListener("DOMContentLoaded", () => {
  initHeaderAuth();

  document.getElementById("logout-btn")?.addEventListener("click", async () => {
    try {
      await apiFetch("/api/logout", { method: "POST" }); // ✅ use apiFetch
    } catch {}
    setHeaderLoggedOut();
    location.reload();
  });
});

// ------------------------------
// Tab switching
// ------------------------------
document.addEventListener("DOMContentLoaded", () => {
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
});

// ------------------------------
// Business Section
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

// ✅ GLOBAL slug check (all users)
async function isSlugTakenGlobal(typeName, slug) {
  const where = encodeURIComponent(JSON.stringify({ slug }));
  const path = `/public/records?dataType=${encodeURIComponent(typeName)}&where=${where}&limit=2`;
  const res = await apiFetch(path, { cache: "no-store" }); // ✅ use apiFetch
  const out = await res.json().catch(() => ({}));
  return (out?.items || []).length > 0;
}

// upload helper
async function uploadOneImage(file) {
  const fd = new FormData();
  fd.append("file", file);

  const resp = await apiFetch("/api/upload", { method: "POST", body: fd }); // ✅ use apiFetch
  const out = await resp.json().catch(() => ({}));
  return out?.url || "";
}

// CREATE business on submit
document.addEventListener("DOMContentLoaded", () => {
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
            "Business Name": businessName,
            "Your Name": yourName,
            "Phone Number": phone,
            "Location Name": locationName,
            "Business Address": address,
            "Business Email": email,
            slug,
            HeroImage: heroUrl,
          },
        }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        console.log("Create business failed:", resp.status, err);
        alert(err?.error || err?.message || "Could not create business");
        return;
      }

      const out = await resp.json().catch(() => ({}));
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
