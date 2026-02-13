//appointment-settings.js
console.log("[Appointment-settings] web loaded");

async function fetchMe() {
  const res = await fetch("/api/me", { credentials: "include" });
  const data = await res.json().catch(() => ({}));
  return data; // { ok, user }
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
    if (data?.ok && data?.user) {
      setHeaderLoggedIn(data.user);
    } else {
      setHeaderLoggedOut();
    }
  } catch (e) {
    console.error("[auth header] failed:", e);
    setHeaderLoggedOut();
  }
}

document.addEventListener("DOMContentLoaded", () => {
  initHeaderAuth();

  // logout click
  document.getElementById("logout-btn")?.addEventListener("click", async () => {
    try {
      await fetch("/api/logout", { method: "POST", credentials: "include" });
    } catch {}
    setHeaderLoggedOut();
    // optional: force refresh
    location.reload();
  });
});



  // Tab switching
  const optionTabs  = document.querySelectorAll(".option");
  const tabSections = document.querySelectorAll("[id$='-section']");
  optionTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      optionTabs.forEach(t => t.classList.remove("active"));
      tabSections.forEach(section => section.style.display = "none");
      tab.classList.add("active");
      const targetId = `${tab.dataset.id}-section`;
      const section  = document.getElementById(targetId);
      if (section) section.style.display = "block";
      if (targetId === "booking-section") attachSaveTemplateLogic?.();
    });
  });
