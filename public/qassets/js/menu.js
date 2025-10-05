// === Menu Page Script (single DOMContentLoaded, de-duped) ===
let currentUserId = null; // <-- declare before use

document.addEventListener("DOMContentLoaded", async () => {
  // ---- Config: tweak if your API paths differ ----
// use existing server routes
const API_CHECK_LOGIN = "/check-login";
const API_LOGOUT      = "/logout";

// read current user from /check-login; update via /update-user-profile
const API_ME_GET        = "/check-login";
const API_ME_PUT        = "/update-user-profile";
const API_ME_PUT_METHOD = "POST"; // most upload endpoints are POST
const FALLBACK_ME_GET   = API_CHECK_LOGIN; // keep
const DEFAULT_AVATAR    = "/uploads/default-avatar.png";


  // ---- Helpers ----
  const $ = (sel) => document.querySelector(sel);
  const byId = (id) => document.getElementById(id);
  const show = (el, display = "block") => el && (el.style.display = display);
  const hide = (el) => el && (el.style.display = "none");

  const safeJson = async (res) => {
    const ct = (res.headers.get("content-type") || "").toLowerCase();
    if (ct.includes("application/json")) return res.json();
    const text = await res.text();
    throw new Error(`Expected JSON, got ${ct || "unknown"} - ${text.slice(0, 160)}`);
  };

  const pick = (obj, key, fallback = "") =>
    obj?.[key] ?? obj?.values?.[key] ?? obj?.profile?.[key] ?? fallback;

  const renderAvatar = (imgEl, noImgEl, url) => {
    if (!imgEl) return;
    imgEl.src = url || DEFAULT_AVATAR;
    show(imgEl);
    if (noImgEl) hide(noImgEl);
  };

  // ---- Elements ----
  const loginStatus = byId("login-status-text");
  const openLoginBtn = byId("open-login-popup-btn");
  const logoutBtn = byId("logout-btn");

  const popupLogin = byId("popup-login");
  const popupOverlay = byId("popup-overlay");

  const loginForm = byId("login-form");

  const openProfileBtn = byId("open-profile-settings");
  const backBtn = byId("back-to-menu");
  const profileSection = $(".update-profile");
  const menuGrid = $(".menu-grid");
  const profileForm = byId("update-profile-form");
  const fileInput = byId("user-profile-image");
  const imgEl = byId("current-profile-image");
  const noImgEl = byId("no-profile-image-text");

  const firstNameInput = byId("pro-first-name");
  const lastNameInput  = byId("pro-last-name");
  const emailInput     = byId("pro-signup-email");
  const phoneInput     = byId("update-phone-number");

  // ---- Login status/UI ----
  async function refreshLoginUI() {
    try {
      const res = await fetch(API_CHECK_LOGIN, { credentials: "include" });
      const data = await res.json();

      if (data?.loggedIn) {
        currentUserId = data.userId || null;
        if (loginStatus) loginStatus.textContent = `Hi, ${data.firstName || ""} 👋`;
        show(logoutBtn, "inline-block");
        hide(openLoginBtn);
      } else {
        currentUserId = null;
        if (loginStatus) loginStatus.textContent = "Not logged in";
        hide(logoutBtn);
        show(openLoginBtn, "inline-block");
      }
    } catch (err) {
      console.error("refreshLoginUI error:", err);
      // leave UI as-is on failure
    }
  }

  await refreshLoginUI();

  // ---- Logout ----
  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      try {
        const res = await fetch(API_LOGOUT, { credentials: "include" });
        const result = await res.json();
        if (res.ok) {
          alert("👋 Logged out!");
          window.location.href = "index.html";
        } else {
          alert(result?.message || "Logout failed.");
        }
      } catch (err) {
        console.error("Logout error:", err);
        alert("Something went wrong during logout.");
      }
    });
  }

  // ---- Open Login Popup ----
  if (openLoginBtn && popupLogin && popupOverlay) {
    openLoginBtn.addEventListener("click", () => {
      show(popupLogin);
      show(popupOverlay);
      document.body.classList.add("popup-open");
    });
  }

  // If you call this elsewhere, make sure it exists:
  function closeLoginPopup() {
    if (popupLogin) hide(popupLogin);
    if (popupOverlay) hide(popupOverlay);
    document.body.classList.remove("popup-open");
  }

  // ---- Handle Login Form ----
  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = byId("login-email")?.value.trim();
      const password = byId("login-password")?.value.trim();
      if (!email || !password) return alert("Please enter both email and password.");

      try {
        const res = await fetch("/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
          credentials: "include",
        });
        const result = await res.json();
        if (res.ok) {
          alert("✅ Logged in!");
          closeLoginPopup();
          location.reload();
        } else {
          alert(result?.message || "Login failed.");
        }
      } catch (err) {
        console.error("Login error:", err);
        alert("Something went wrong.");
      }
    });
  }

  // ---- Profile: open & load ----
  async function loadMyProfile() {
  try {
    // We’re using /check-login as the primary source now
    const res = await fetch(API_ME_GET, {
      headers: { Accept: "application/json" },
      credentials: "include",
    });
    const payload = await res.json();

    if (!payload?.loggedIn) {
      alert("Please log in first.");
      return false;
    }

    // Support both top-level fields and { user: { ... } }
    const u = payload.user || payload;

    const get = (obj, key, fb = "") =>
      obj?.[key] ?? obj?.user?.[key] ?? obj?.values?.[key] ?? fb;

    if (firstNameInput) firstNameInput.value = get(payload, "firstName");
    if (lastNameInput)  lastNameInput.value  = get(payload, "lastName");
    if (emailInput)     emailInput.value     = get(payload, "email");
    if (phoneInput)     phoneInput.value     = get(payload, "phone");

    const avatarUrl =
      u?.profilePhoto || u?.avatarUrl || DEFAULT_AVATAR;
    renderAvatar(imgEl, noImgEl, avatarUrl);

    return true;
  } catch (err) {
    console.error("loadMyProfile error:", err);
    alert("Something went wrong while loading your profile.");
    return false;
  }
}


  if (openProfileBtn && profileSection && menuGrid) {
    openProfileBtn.addEventListener("click", async () => {
      const ok = await loadMyProfile();
      if (!ok) return;
      show(profileSection, "block");
      hide(menuGrid);
    });
  }

  if (backBtn && profileSection && menuGrid) {
    backBtn.addEventListener("click", () => {
      hide(profileSection);
      show(menuGrid, "flex"); // adjust if your CSS grid uses another display
    });
  }

  // ---- Local image preview ----
  if (fileInput && imgEl) {
    fileInput.addEventListener("change", function () {
      const file = this.files?.[0];
      if (!file) {
        renderAvatar(imgEl, noImgEl, null);
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        imgEl.src = e.target.result;
        show(imgEl);
        if (noImgEl) hide(noImgEl);
      };
      reader.readAsDataURL(file);
    });
  }

  // ---- Submit profile update ----
  if (profileForm) {
    profileForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const submitBtn = profileForm.querySelector("[type='submit']");
      if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = "Saving…"; }

      try {
        const formData = new FormData(profileForm); // includes file if selected
      const res = await fetch(API_ME_PUT, {
  method: API_ME_PUT_METHOD,  // <-- was PUT, now POST
  body: new FormData(profileForm),
  credentials: "include",
  headers: { Accept: "application/json" }, // don't set Content-Type with FormData
});

        let result;
        try {
          result = await safeJson(res);
        } catch (parseErr) {
          result = { ok: false, message: parseErr.message };
        }

        if (res.ok) {
          alert("✅ Profile updated!");
          const newUrl =
            result?.user?.profilePhoto ||
            result?.data?.profilePhoto ||
            result?.profilePhoto ||
            null;
          if (newUrl) renderAvatar(imgEl, noImgEl, newUrl);
        } else {
          const msg = result?.message || result?.error || `Update failed (HTTP ${res.status}).`;
          alert(msg);
          console.error("Update error payload:", result);
        }
      } catch (err) {
        console.error("Update error:", err);
        alert("An error occurred while updating.");
      } finally {
        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = "Save Changes"; }
      }
    });
  }
});
