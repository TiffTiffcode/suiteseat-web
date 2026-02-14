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
// Login popup helpers (ONE version only)
// ------------------------------
function openLoginPopup() {
  document.getElementById("login-popup")?.style.setProperty("display", "block");
  document.getElementById("popup-overlay")?.style.setProperty("display", "block");
}

function closeLoginPopup() {
  document.getElementById("login-popup")?.style.setProperty("display", "none");
  document.getElementById("popup-overlay")?.style.setProperty("display", "none");
}

  // Open login popup
  document.getElementById("open-login-popup-btn")?.addEventListener("click", openLoginPopup);

  // Close popup
  document.getElementById("popup-overlay")?.addEventListener("click", closeLoginPopup);
  document.getElementById("close-login-popup-btn")?.addEventListener("click", closeLoginPopup);

  // Login submit (ONE handler only)
  document.getElementById("login-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = document.getElementById("login-email")?.value?.trim();
    const password = document.getElementById("login-password")?.value;

    if (!email || !password) return alert("Please enter email and password.");

    const res = await apiFetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const out = await res.json().catch(() => ({}));
    if (!res.ok) return alert(out?.error || out?.message || "Login failed");

    await initHeaderAuth();
    closeLoginPopup();
    document.getElementById("login-password").value = "";
  });

  // Logout
  document.getElementById("logout-btn")?.addEventListener("click", async () => {
    try {
      await apiFetch("/api/logout", { method: "POST" });
    } catch {}
    setHeaderLoggedOut();
    location.reload();
  });
