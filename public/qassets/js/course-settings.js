 //* Course-settings.js  

 
/* ============== API HELPERS (put FIRST) ============== */

// Prevent double-init (safe guard)
if (window.__COURSE_SETTINGS_INIT__) {
  console.warn("[course-settings] init already ran; skipping duplicate load");
} else {
  window.__COURSE_SETTINGS_INIT__ = true;
}

// ==============================
// ✅ API BASE (single source of truth)
// ==============================
const API_BASE =
  location.hostname.includes("localhost")
    ? "http://localhost:8400"
    : "https://api.suiteseat.io";

// expose for debugging if you want
window.API_BASE = API_BASE;

function apiUrl(path) {
  const p = path.startsWith("/") ? path : `/${path}`;
  // ✅ ONLY for real /api routes
  return `${API_BASE}${p}`;
}

function publicUrl(path) {
  const p = path.startsWith("/") ? path : `/${path}`;
  // ✅ for non-/api routes (like /public/records)
  return `${API_BASE}${p}`;
}

async function apiFetch(path, opts = {}) {
  return fetch(apiUrl(path), {
    credentials: "include",
    cache: "no-store",
    headers: { Accept: "application/json", ...(opts.headers || {}) },
    ...opts,
  });
}

async function fetchJSON(path, opts = {}) {
  const res = await apiFetch(path, {
    headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
    ...opts,
  });

  // If we accidentally hit HTML (service suspended / cloudflare), surface it clearly
  const contentType = res.headers.get("content-type") || "";
  const text = await res.text();

  if (!res.ok) {
    // try json first
    try {
      const data = JSON.parse(text);
      throw new Error(data?.error || data?.message || `HTTP ${res.status}`);
    } catch {
      throw new Error(
        contentType.includes("text/html")
          ? `API returned HTML (wrong host or blocked). HTTP ${res.status}`
          : (text || `HTTP ${res.status}`)
      );
    }
  }

  // ok response
  if (!text) return {};
  try { return JSON.parse(text); }
  catch { return { raw: text }; }
}

window.apiFetch = apiFetch;
window.fetchJSON = fetchJSON;





/////////////////////////////////////////////////////
//Helpers
//helper to Save videos to cloud 
async function getCloudinarySignature(folder) {
  const res = await apiFetch(`/api/cloudinary/sign?folder=${encodeURIComponent(folder)}`, {
    headers: { Accept: "application/json" },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.ok) throw new Error(data?.error || "Signature failed");
  return data;
}


// ✅ Direct upload to Cloudinary (video OR raw)
async function uploadToCloudinary(file, { folder, resourceType }) {
  if (!file) throw new Error("No file provided");

  const MAX_VIDEO_MB = 50;
  const sizeMB = file.size / (1024 * 1024);

  console.log("[cloudinary] size MB:", sizeMB.toFixed(2));

  if (resourceType === "video" && sizeMB > MAX_VIDEO_MB) {
    throw new Error(
      `Video is ${Math.round(sizeMB)}MB. Max is ${MAX_VIDEO_MB}MB for now.`
    );
  }

  const sig = await getCloudinarySignature(folder);

  const form = new FormData();
  form.append("file", file);
  form.append("api_key", sig.apiKey);
  form.append("timestamp", String(sig.timestamp));
  form.append("folder", sig.folder);
  form.append("signature", sig.signature);

  const endpoint = `https://api.cloudinary.com/v1_1/${sig.cloudName}/${resourceType}/upload`;

  const up = await fetch(endpoint, { method: "POST", body: form });
  const out = await up.json().catch(() => null);

  if (!up.ok) {
    console.error("[cloudinary] upload failed", out);
    throw new Error(out?.error?.message || "Upload failed");
  }

  return {
    url: out.secure_url,
    publicId: out.public_id,
    bytes: out.bytes,
    format: out.format,
    originalFilename: out.original_filename,
  };
}
/* ============== GLOBAL STATE ============== */

window.STATE = window.STATE || {
  user: { loggedIn: false, userId: null, email: "", firstName: "" },
};

/* ============== AUTH MODULE ============== */
(function authModule () {
  const loginBtn  = document.getElementById('open-login-popup-btn');
  const logoutBtn = document.getElementById('logout-btn');
  const statusEl  = document.getElementById('login-status-text');

  const modal   = document.getElementById('authModal');
  const form    = document.getElementById('authForm');
  const emailEl = document.getElementById('authEmail');
  const passEl  = document.getElementById('authPass');
  const errEl   = document.getElementById('authError');
  const closeX  = document.getElementById('authClose');
  const submit  = document.getElementById('authSubmit');
  const idleTxt = submit?.querySelector('.when-idle');
  const busyTxt = submit?.querySelector('.when-busy');

  function setBusy(on) {
    if (!submit) return;
    submit.disabled = !!on;
    if (idleTxt) idleTxt.hidden = !!on;
    if (busyTxt) busyTxt.hidden = !on;
  }

  function openAuth () {
    if (!modal) return;
    modal.hidden = false;
    modal.setAttribute('aria-hidden', 'false');
    emailEl?.focus();
  }

  function closeAuth () {
    if (!modal) return;
    modal.hidden = true;
    modal.setAttribute('aria-hidden', 'true');
  }

  function setAuthUI () {
    const u = window.STATE?.user || {};
    if (u.loggedIn) {
      statusEl && (statusEl.textContent = u.firstName
        ? `Hi, ${u.firstName}`
        : (u.email || 'Signed in'));
      loginBtn && (loginBtn.style.display = 'none');
      logoutBtn && (logoutBtn.style.display = '');
    } else {
      statusEl && (statusEl.textContent = 'Not signed in');
      loginBtn && (loginBtn.style.display = '');
      logoutBtn && (logoutBtn.style.display = 'none');
    }
  }

  async function hydrateUser () {
    try {
      const res  = await apiFetch('/api/me', { headers: { Accept: 'application/json' } });
      const text = await res.text();
      let data; try { data = JSON.parse(text); } catch { data = {}; }

      const user = data?.user || data?.data?.user || (data?.ok && data?.session?.user) || null;
      console.log('[auth] /api/me payload:', data);

      if (user && (user._id || user.id)) {
        window.STATE.user = {
          loggedIn: true,
          userId:   user._id || user.id,
          email:    user.email || '',
          firstName: user.firstName || user.name || '',
        };
      } else {
        window.STATE.user = { loggedIn: false, userId: null, email: '', firstName: '' };
      }
    } catch (e) {
      console.warn('[auth] hydrateUser failed:', e);
      window.STATE.user = { loggedIn: false, userId: null, email: '', firstName: '' };
    }
    console.log('[auth] STATE.user ->', window.STATE.user);
    setAuthUI();
  }

  // Guard to require a logged-in user before privileged actions
  async function requireUser () {
    await hydrateUser();
    if (!window.STATE.user.loggedIn) {
      openAuth();
      throw new Error('Login required');
    }
    return window.STATE.user.userId;
  }
  window.requireUser = requireUser;

  // Events
  loginBtn && loginBtn.addEventListener('click', openAuth);
  closeX   && closeX.addEventListener('click', closeAuth);
  modal    && modal.addEventListener('click', (e) => {
    if (e.target === modal) closeAuth();
  });

  logoutBtn && logoutBtn.addEventListener('click', async () => {
    try { await window.fetchJSON('/api/logout', { method: 'POST' }); } catch {}
    window.STATE.user = { loggedIn: false, userId: null, email: '', firstName: '' };
    setAuthUI();
  });

  form && form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errEl && (errEl.textContent = '');
    setBusy(true);
    try {
      const r = await apiFetch('/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          email:    emailEl.value.trim(),
          password: passEl.value,
        }),
      });

      const t = await r.text();
      let d; try { d = JSON.parse(t); } catch { d = { error: t }; }
      if (!r.ok || d.error) throw new Error(d.error || `HTTP ${r.status}`);

      await hydrateUser();
      closeAuth();
    } catch (err) {
      console.error('[auth] login failed:', err);
      errEl && (errEl.textContent = err.message || 'Login failed');
    } finally {
      setBusy(false);
    }
  });

  // Initial session check → announce ready
  hydrateUser()
    .catch(() => {})
    .finally(() => {
      document.dispatchEvent(new Event('auth:ready'));
    });
})();







                        ////////////////////////////////////////////////////////////////////
                                                             //Dashboard
                          ////////////////////////////////////////////////////////////////////

  // =========================
  // Dashboard wiring
  // =========================
  const dashActiveEl   = document.getElementById('dash-active-courses-count');
  const dashEnrollEl   = document.getElementById('dash-enrollments-count');
  const dashRevenueEl  = document.getElementById('dash-revenue-total');
  const dashCoursesList = document.getElementById('dash-courses-list');

  async function hydrateDashboard() {
    // if the dashboard elements don't exist, bail
    if (!dashActiveEl && !dashCoursesList && !dashEnrollEl && !dashRevenueEl) return;

    try {
      // make sure we know who the user is
      await window.requireUser().catch(() => null);

      // reuse the same helper you already have
      const courses = await listCoursesForCurrentUser(); // returns [{id, title}, ...]

      // 🔢 Active courses = number of records
      if (dashActiveEl) {
        dashActiveEl.textContent = String(courses.length);
      }

      // 🔢 Enrollments & Revenue – we'll keep these 0 until we have Enrollment data
      if (dashEnrollEl)  dashEnrollEl.textContent  = '0';
      if (dashRevenueEl) dashRevenueEl.textContent = '$0.00';

      // 📋 List of courses under the “Courses” heading
      if (dashCoursesList) {
        dashCoursesList.innerHTML = '';

        if (!courses.length) {
          dashCoursesList.innerHTML =
            '<p class="muted">No courses yet. Create your first one in the Courses tab.</p>';
          return;
        }

        courses.forEach((c) => {
          const pill = document.createElement('button');
          pill.type = 'button';
          pill.className = 'dash-course-pill'; // style this in CSS
          pill.textContent = c.title || '(Untitled course)';

          // When you click a course on the dashboard:
          //  - select it in the Courses dropdown
          //  - scroll to the Courses section
          pill.addEventListener('click', () => {
            const select = document.getElementById('courses-select');
            if (select) {
              select.value = c.id;
              select.dispatchEvent(new Event('change'));
            }
            const coursesSection = document.getElementById('courses');
            if (coursesSection) {
              coursesSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
          });

          dashCoursesList.appendChild(pill);
        });
      }
    } catch (err) {
      console.error('[dashboard] hydrateDashboard failed', err);
    }
  }

  // run once on load (if user is already known, this will work immediately;
  // otherwise it'll do nothing until auth:ready fires below)
 document.addEventListener("auth:ready", () => {
  hydrateDashboard().catch(() => {});
});





























                        ////////////////////////////////////////////////////////////////////
                                                             //Courses
                          ////////////////////////////////////////////////////////////////////
//Slug helper 
function slugify(str = "") {
  return String(str)
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

async function generateSlugForType(typeName, base, excludeId = null) {
  const out = await window.fetchJSON(`/api/slug/${encodeURIComponent(typeName)}`, {
    method: "POST",
    body: JSON.stringify({
      base: String(base || ""),
      excludeId: excludeId || null, // important for EDIT mode
    }),
  });

  return out?.slug || "";
}


                          //Link to courses page 
window.selectedCourse = null; // set this when a course is picked

const viewBtn = document.getElementById("courses-view-page");

function getCourseSlug(courseRow) {
  const v = (courseRow && (courseRow.values || courseRow)) || {};
  return (
    v.slug ||
    v.courseSlug ||
    v["Course Slug"] ||
    v["slug"] ||
    ""
  ).toString().trim();
}

viewBtn?.addEventListener("click", () => {
  const courseRow = window.selectedCourse;
  if (!courseRow) {
    alert("Select a course first.");
    return;
  }

  const slug = getCourseSlug(courseRow);
  if (!slug) {
    alert("This course doesn’t have a slug yet. Save the course with a slug first.");
    return;
  }

  // ✅ opens: https://yoursite.com/{slug}
  const url = `${window.location.origin}/${encodeURIComponent(slug)}`;
  window.open(url, "_blank");
});



//Courses Dropdown
// === Load "Your courses" dropdown ===

// 1. Fetch all Course records created by the current user
async function listCoursesForCurrentUser() {
  const uid = window.STATE?.user?.userId;
  if (!uid) return [];

  const params = new URLSearchParams();
  params.set("dataType", "Course");
  params.set("limit", "200");
  params.set("Created By", uid);
  params.set("ts", String(Date.now()));

  // ✅ IMPORTANT: hit /public/records exactly (no /api prefix)
  const url = publicUrl(`/public/records?${params.toString()}`);

  const res = await fetch(url, {
    credentials: "include",
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const data = await res.json().catch(() => null);
  const rows = Array.isArray(data) ? data : (data?.items || data?.records || []);

  const active = rows.filter((r) => !(r?.deletedAt || r?.values?.deletedAt));

  window.__COURSE_CACHE = {};
  active.forEach((r) => {
    const id = String(r._id || r.id || "");
    if (id) window.__COURSE_CACHE[id] = r;
  });

  return active;
}



// 2. Populate the <select id="courses-select">
async function hydrateCourseDropdown({ autoSelectLatest = true } = {}) {
  const select = document.getElementById("courses-select");
  if (!select) return;

  const rows = await listCoursesForCurrentUser();

  // sort newest first (fallback to createdAt if needed)
  rows.sort((a, b) => {
    const av = a.values || a;
    const bv = b.values || b;

    const aTime = Date.parse(av["Last Edited At"] || a.updatedAt || a.createdAt || 0) || 0;
    const bTime = Date.parse(bv["Last Edited At"] || b.updatedAt || b.createdAt || 0) || 0;

    return bTime - aTime;
  });

  select.innerHTML = `<option value="">Select a course…</option>`;

  rows.forEach((rec) => {
    const v = rec.values || {};
    const id = String(rec._id || rec.id);
    const label = v["Course Title"] || v["Title"] || v["Name"] || "Untitled Course";

    const opt = document.createElement("option");
    opt.value = id;
    opt.textContent = label;
    select.appendChild(opt);
  });

  // ✅ auto-select most recently edited
  if (autoSelectLatest && rows.length) {
    const firstId = String(rows[0]._id || rows[0].id || "");
    if (firstId) {
      select.value = firstId;
      select.dispatchEvent(new Event("change"));
    }
  }
}

// 3. Run when auth is ready, and after saving a course
document.addEventListener("auth:ready", () => {
  hydrateCourseDropdown().catch(() => {});
  hydrateStudentsCourseDropdown().catch(() => {}); // ✅ add this
  if (typeof hydrateDashboard === "function") {
    hydrateDashboard().catch(() => {});
  }
});
document.addEventListener("click", (e) => {
  const btn = e.target.closest('button[data-target="courses"]');
  if (!btn) return;

  hydrateCourseDropdown({ autoSelectLatest: true }).catch(() => {});
});

// === Students section – use the SAME course list ===
// === Students section – use the SAME course list (FULL RECORD SHAPE) ===
async function hydrateStudentsCourseDropdown() {
  const sel = document.getElementById("students-course-select");
  if (!sel) return;

  sel.innerHTML = `<option value="">Loading your courses…</option>`;

  try {
    await window.requireUser().catch(() => null);

    const rows = await listCoursesForCurrentUser(); // ✅ returns full records

    // ✅ belt + suspenders (should already be filtered, but keep it safe)
    const active = rows.filter((r) => {
      const deletedAt = r?.deletedAt || r?.values?.deletedAt || null;
      return !deletedAt;
    });

    if (!active.length) {
      sel.innerHTML = `<option value="">No courses yet</option>`;
      return;
    }

    sel.innerHTML = `<option value="">Select a course…</option>`;

    active.forEach((rec) => {
      const v = rec.values || {};
      const id = String(rec._id || rec.id || "");
      const label =
        v["Course Title"] || v["Title"] || v["Name"] || "Untitled Course";

      const opt = document.createElement("option");
      opt.value = id;
      opt.textContent = label;
      sel.appendChild(opt);
    });
  } catch (err) {
    console.error("[students] hydrateStudentsCourseDropdown failed", err);
    sel.innerHTML = `<option value="">Couldn’t load courses</option>`;
  }
}




async function uploadImageFile(file) {
  if (!file) return null;

  const fd = new FormData();
  fd.append("file", file);

  const res = await fetch(apiUrl("/api/upload"), {
    method: "POST",
    body: fd,
    credentials: "include",
  });

  const out = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(out.error || "Image upload failed");
  return out.url || null;
}











                                        // =======================
                                            // Course outline 
                                         // =======================
// === Course outline UI + Save ===
document.addEventListener("DOMContentLoaded", () => {
  // course let
  let currentCourseId = null;

  // Buttons + cards
  const addBtn = document.getElementById("courses-add-course");
  const outlineCard = document.getElementById("courses-outline");

  //hide the course outline section
  function setOutlineVisible(visible) {
  if (!outlineCard) return;
  outlineCard.hidden = !visible;
}


// =======================
// Custom Popup Lead Capture (NEW)
// =======================
// =======================
// Lead Capture (NEW)
// =======================
const leadEnabledEl    = document.getElementById("lead-enabled");
const leadSettingsEl   = document.getElementById("lead-settings");

const leadHeadlineEl   = document.getElementById("lead-headline");
const leadBtnTextEl    = document.getElementById("lead-button-text");

const leadBgEl         = document.getElementById("lead-bg");
const leadTextEl       = document.getElementById("lead-text");
const leadBtnEl        = document.getElementById("lead-btn");
const leadBtnTextColEl = document.getElementById("lead-btn-text");
const leadBorderEl     = document.getElementById("lead-border");

const previewWrap      = document.getElementById("lead-preview");

const leadBgImageEl    = document.getElementById("lead-bg-image");
let leadBgImageUrl     = "";

// ✅ NEW: header image
const leadHeaderImageEl = document.getElementById("lead-header-image");
let leadHeaderImageUrl  = "";

const leadHeaderImageStatusEl  = document.getElementById("lead-header-image-status");
const leadHeaderImagePreviewEl = document.getElementById("lead-header-image-preview");
const leadHeaderImageRemoveBtn = document.getElementById("lead-header-image-remove");
 
const leadDeliverFileEl = document.getElementById("lead-deliver-file");
const leadDeliverFileStatusEl = document.getElementById("lead-deliver-file-status");

// store URL/path for saving + later delivery
let leadDeliverFileUrl = "";
let leadDeliverFileName = "";
function getLeadCaptureConfigFromUI() {
  return {
    enabled: !!leadEnabledEl?.checked,
    headline: (leadHeadlineEl?.value || "").trim(),
    buttonText: (leadBtnTextEl?.value || "").trim(),
    styles: {
      bg: leadBgEl?.value || "#ffffff",
      bgImage: leadBgImageUrl || "",
      text: leadTextEl?.value || "#111111",
      btn: leadBtnEl?.value || "#111111",
      btnText: leadBtnTextColEl?.value || "#ffffff",
      border: leadBorderEl?.value || "#dddddd",
    },
    fields: Array.isArray(window.leadFields) ? window.leadFields : [], // uses your leadFields
    deliver: {
      fileUrl: leadDeliverFileUrl || "",
      fileName: leadDeliverFileName || "",
    },
  };
}

function applyLeadCaptureConfigToUI(cfg) {
  const c = cfg || {};

  if (leadEnabledEl) leadEnabledEl.checked = !!c.enabled;
  setLeadSettingsVisible();

  if (leadHeadlineEl) leadHeadlineEl.value = c.headline || "";
  if (leadBtnTextEl) leadBtnTextEl.value = c.buttonText || "";

  const s = c.styles || {};
  if (leadBgEl) leadBgEl.value = s.bg || "#ffffff";
  if (leadTextEl) leadTextEl.value = s.text || "#111111";
  if (leadBtnEl) leadBtnEl.value = s.btn || "#111111";
  if (leadBtnTextColEl) leadBtnTextColEl.value = s.btnText || "#ffffff";
  if (leadBorderEl) leadBorderEl.value = s.border || "#dddddd";

  // ✅ image + file vars
  leadBgImageUrl = s.bgImage || "";
  leadDeliverFileUrl = c.deliver?.fileUrl || "";
  leadDeliverFileName = c.deliver?.fileName || "";

  // ✅ fields
  if (Array.isArray(c.fields) && c.fields.length) {
    window.leadFields = c.fields;
    leadFields = c.fields;           // if your leadFields is a local var
  } else {
    window.leadFields = [...LEAD_DEFAULT_FIELDS];
    leadFields = [...LEAD_DEFAULT_FIELDS];
  }
  renderLeadFields();

  // ✅ refresh UI
  renderLeadBgImageUI();
  renderLeadHeaderImageUI();

  renderLeadDeliverFileUI();
  updateLeadPreview();
}


const leadBgImageStatusEl = document.getElementById("lead-bg-image-status");
const leadBgImagePreviewEl = document.getElementById("lead-bg-image-preview");

// BG image UI

const leadBgImageRemoveBtn = document.getElementById("lead-bg-image-remove");

// Deliver file UI
const leadDeliverFileRemoveBtn = document.getElementById("lead-deliver-file-remove");




function renderLeadBgImageUI() {
  if (leadBgImageStatusEl) {
    leadBgImageStatusEl.textContent = leadBgImageUrl ? "Image saved ✅" : "";
  }

  if (leadBgImageRemoveBtn) {
    leadBgImageRemoveBtn.style.display = leadBgImageUrl ? "inline-flex" : "none";
  }

  if (leadBgImagePreviewEl) {
    leadBgImagePreviewEl.innerHTML = leadBgImageUrl
      ? `<img src="${leadBgImageUrl}" alt="Saved background">`
      : "";
  }
}

function renderLeadHeaderImageUI() {
  if (leadHeaderImageStatusEl) {
    leadHeaderImageStatusEl.textContent = leadHeaderImageUrl ? "Header image saved ✅" : "";
  }

  if (leadHeaderImageRemoveBtn) {
    leadHeaderImageRemoveBtn.style.display = leadHeaderImageUrl ? "inline-flex" : "none";
  }

  if (leadHeaderImagePreviewEl) {
    leadHeaderImagePreviewEl.innerHTML = leadHeaderImageUrl
      ? `<img src="${leadHeaderImageUrl}" alt="Saved header image" />`
      : "";
  }
}

function renderLeadDeliverFileUI() {
  const hasFile = !!leadDeliverFileUrl;

  // status area shows link + name
  if (leadDeliverFileStatusEl) {
    if (hasFile) {
      const name = leadDeliverFileName || "Download file";
      leadDeliverFileStatusEl.innerHTML = `
        <span style="display:inline-flex; align-items:center; gap:8px;">
          <span>File saved ✅</span>
          <a href="${leadDeliverFileUrl}" target="_blank" rel="noopener">
            ${name}
          </a>
        </span>
      `;
    } else {
      leadDeliverFileStatusEl.textContent = "";
    }
  }

  // show/hide X
  if (leadDeliverFileRemoveBtn) {
    leadDeliverFileRemoveBtn.style.display = hasFile ? "inline-flex" : "none";
  }
}

// --------------------
// REMOVE buttons
// --------------------
leadBgImageRemoveBtn?.addEventListener("click", () => {
  const ok = confirm("Remove this background image?");
  if (!ok) return;

  leadBgImageUrl = "";
  if (leadBgImageEl) leadBgImageEl.value = "";
  updateLeadPreview();
  renderLeadBgImageUI();
});

// ✅ NEW: remove header image
leadHeaderImageRemoveBtn?.addEventListener("click", () => {
  const ok = confirm("Remove this header image?");
  if (!ok) return;

  leadHeaderImageUrl = "";
  if (leadHeaderImageEl) leadHeaderImageEl.value = "";

  renderLeadHeaderImageUI();
  updateLeadPreview();
});

// --------------------
// UPLOAD handlers
// --------------------

// ✅ existing: upload background image
if (leadBgImageEl) {
  leadBgImageEl.addEventListener("change", async () => {
    const file = leadBgImageEl.files?.[0];
    if (!file) return;

    try {
      const fd = new FormData();
      fd.append("file", file);

      const res = await fetch(apiUrl("/api/upload"), {
        method: "POST",
        body: fd,
        credentials: "include",
      });

      const out = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(out.error || "Image upload failed");

      leadBgImageUrl = out.url || out.path || out.location || "";

      updateLeadPreview();
      renderLeadBgImageUI();
    } catch (err) {
      console.error("[lead] bg image upload failed", err);
      alert("Could not upload image. Try again.");
    }
  });
}

// ✅ NEW: upload HEADER image
if (leadHeaderImageEl) {
  leadHeaderImageEl.addEventListener("change", async () => {
    const file = leadHeaderImageEl.files?.[0];
    if (!file) return;

    try {
      const fd = new FormData();
      fd.append("file", file);

      const res = await fetch(apiUrl("/api/upload"), {
        method: "POST",
        body: fd,
        credentials: "include",
      });

      const out = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(out.error || "Image upload failed");

      leadHeaderImageUrl = out.url || out.path || out.location || "";

      renderLeadHeaderImageUI();
      updateLeadPreview();
    } catch (err) {
      console.error("[lead] header image upload failed", err);
      alert("Could not upload header image. Try again.");
    }
  });
}


leadDeliverFileRemoveBtn?.addEventListener("click", () => {
  const ok = confirm("Remove the deliver file?");
  if (!ok) return;

  leadDeliverFileUrl = "";
  leadDeliverFileName = "";
  if (leadDeliverFileEl) leadDeliverFileEl.value = "";
  renderLeadDeliverFileUI();
});

function setLeadSettingsVisible() {
  if (!leadSettingsEl || !leadEnabledEl) return;
  leadSettingsEl.style.display = leadEnabledEl.checked ? "block" : "none";
}

function updateLeadPreview() {
  if (!previewWrap) return;

  const card   = previewWrap.querySelector(".lead-preview-card");
  const title  = previewWrap.querySelector(".lead-preview-title");
  const inputs = previewWrap.querySelectorAll(".lead-preview-input");
  const btn    = previewWrap.querySelector(".lead-preview-btn");

  const bg       = leadBgEl?.value || "#ffffff";
  const text     = leadTextEl?.value || "#111111";
  const btnBg    = leadBtnEl?.value || "#111111";
  const btnText  = leadBtnTextColEl?.value || "#ffffff";
  const border   = leadBorderEl?.value || "#dddddd";
  const headline = (leadHeadlineEl?.value || "Enter your info to continue").trim();
  const btnLabel = (leadBtnTextEl?.value || "Continue").trim();

  if (card) {
    card.style.backgroundColor = bg;
    card.style.color = text;
    card.style.borderColor = border;

    if (leadBgImageUrl) {
      card.style.backgroundImage = `url("${leadBgImageUrl}")`;
      card.style.backgroundSize = "cover";
      card.style.backgroundPosition = "center";
      card.style.backgroundRepeat = "no-repeat";
    } else {
      card.style.backgroundImage = "none";
    }
  }

  if (title) title.textContent = headline;

  inputs.forEach((inp) => {
    inp.style.borderColor = border;
  });

  if (btn) {
    btn.textContent = btnLabel;
    btn.style.background = btnBg;
    btn.style.color = btnText;
  }
}
//File to deliver to customer 
if (leadDeliverFileEl) {
  leadDeliverFileEl.addEventListener("change", async () => {
    const file = leadDeliverFileEl.files?.[0];
    if (!file) return;

    try {
      const fd = new FormData();
      fd.append("file", file);

      const res = await fetch(apiUrl("/api/upload"), {
        method: "POST",
        body: fd,
        credentials: "include",
      });

      const out = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(out.error || "File upload failed");

leadDeliverFileUrl = out.url || out.path || out.location || "";
leadDeliverFileName = file.name;

renderLeadDeliverFileUI();




renderLeadDeliverFileUI();

    } catch (err) {
      console.error("[lead] deliver file upload failed", err);
      alert("Could not upload file. Try again.");
    }
  });
}

// ✅ Upload bg image + update preview (ONE time)
if (leadBgImageEl) {
  leadBgImageEl.addEventListener("change", async () => {
    const file = leadBgImageEl.files?.[0];
    if (!file) return;

    try {
      const fd = new FormData();
      fd.append("file", file);

      const res = await fetch(apiUrl("/api/upload"), {
        method: "POST",
        body: fd,
        credentials: "include",
      });

      const out = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(out.error || "Image upload failed");

  leadBgImageUrl = out.url || out.path || out.location || "";
updateLeadPreview();
renderLeadBgImageUI(); 

    } catch (err) {
      console.error("[lead] bg image upload failed", err);
      alert("Could not upload image. Try again.");
    }
  });
}

if (leadEnabledEl) {
  leadEnabledEl.addEventListener("change", () => {
    setLeadSettingsVisible();
    updateLeadPreview();
  });
}

[
  leadHeadlineEl, leadBtnTextEl,
  leadBgEl, leadTextEl, leadBtnEl, leadBtnTextColEl, leadBorderEl
].forEach((el) => el && el.addEventListener("input", updateLeadPreview));

// Initialize UI once
setLeadSettingsVisible();
updateLeadPreview();


// -----------------------
// Lead Fields UI (NEW)
// -----------------------
const leadFieldsListEl = document.getElementById("lead-fields-list");
const leadAddFieldBtn  = document.getElementById("lead-add-field");

// Default fields (always present)
const LEAD_DEFAULT_FIELDS = [
  { key: "name",  label: "Name",  type: "text",  required: true, locked: true },
  { key: "email", label: "Email", type: "email", required: true, locked: true },
];

// This will be saved in Lead Capture Config
let leadFields = [...LEAD_DEFAULT_FIELDS];

function slugKey(label = "") {
  return String(label)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40) || "field";
}

function renderLeadFields() {
  if (!leadFieldsListEl) return;
  leadFieldsListEl.innerHTML = "";

  leadFields.forEach((f, idx) => {
    const pill = document.createElement("div");
    pill.className = "collect-pill";

    const left = document.createElement("div");
    left.className = "collect-pill-left";

    const title = document.createElement("div");
    title.className = "collect-pill-title";
    title.textContent = f.label || f.key || "Field";

    const meta = document.createElement("div");
    meta.className = "collect-pill-meta";
    meta.textContent = `${f.type || "text"}${f.required ? " • required" : ""}`;

    left.appendChild(title);
    left.appendChild(meta);

    const actions = document.createElement("div");
    actions.className = "collect-pill-actions";

    // Only custom fields can be edited/deleted
    if (!f.locked) {
      const editBtn = document.createElement("button");
      editBtn.type = "button";
      editBtn.title = "Edit";
      editBtn.textContent = "✏️";
      editBtn.addEventListener("click", () => editLeadField(idx));

      const delBtn = document.createElement("button");
      delBtn.type = "button";
      delBtn.title = "Delete";
      delBtn.textContent = "🗑️";
      delBtn.addEventListener("click", () => {
        leadFields.splice(idx, 1);
        renderLeadFields();
      });

      actions.appendChild(editBtn);
      actions.appendChild(delBtn);
    }

    pill.appendChild(left);
    pill.appendChild(actions);
    leadFieldsListEl.appendChild(pill);
  });
}

function addLeadField() {
  // Simple prompt version (fast). We can replace later with a nicer popup.
  const label = prompt("Field name (ex: Phone, Instagram, City):");
  if (!label) return;

  const type = prompt("Type? (text, email, tel, url) — default is text:", "text") || "text";
  const required = confirm("Should this be required?");

  const key = slugKey(label);

  // prevent duplicates
  if (leadFields.some(f => f.key === key)) {
    alert("That field already exists. Choose a different name.");
    return;
  }

  leadFields.push({
    key,
    label: label.trim(),
    type: type.trim(),
    required,
    locked: false,
  });

  renderLeadFields();
}

function editLeadField(index) {
  const f = leadFields[index];
  if (!f || f.locked) return;

  const newLabel = prompt("Field label:", f.label || "");
  if (!newLabel) return;

  const newType = prompt("Type? (text, email, tel, url)", f.type || "text") || "text";
  const newRequired = confirm("Required? (OK = required, Cancel = optional)");

  f.label = newLabel.trim();
  f.type = newType.trim();
  f.required = !!newRequired;

  renderLeadFields();
}

leadAddFieldBtn?.addEventListener("click", addLeadField);

// Initial render
renderLeadFields();

////////////////////////////////////////////////////



if (addBtn) {
  addBtn.addEventListener("click", () => {
    resetCourseOutlineUI();     // your reset (optional)
    setOutlineVisible(false);   // ✅ hide the Course Outline section
  });
}

  //Reset Outline when add course button is pressed 
  function resetCourseOutlineUI() {
  // ✅ clear selected course + ids
  window.selectedCourse = null;
  if (typeof currentCourseId !== "undefined") currentCourseId = null;

  // ✅ clear outline list
  const outlineList = document.getElementById("outline-sections");
  if (outlineList) outlineList.innerHTML = "";

  // ✅ show "No sections yet."
  const emptyNote = document.getElementById("outline-empty-note");
  if (emptyNote) emptyNote.style.display = "block";

  // ✅ hide outline card if you want it hidden until saved
  // (optional — comment out if you want outline visible)
  // const outlineCard = document.getElementById("courses-outline");
  // if (outlineCard) outlineCard.hidden = true;

  // ✅ reset any "currently selected section/lesson" state you keep
  window.SELECTED_SECTION_ID = null;
  window.SELECTED_LESSON_ID = null;

  // ✅ hide lesson + chapter detail panels (so they don’t stay open)
  const lessonPanel = document.getElementById("lesson-detail-panel");
  if (lessonPanel) lessonPanel.style.display = "none";

  const chapterPanel = document.getElementById("chapter-detail-panel");
  if (chapterPanel) chapterPanel.style.display = "none";

  // ✅ clear chapters list in the lesson panel
  const chaptersList = document.getElementById("lesson-chapters-list");
  if (chaptersList) chaptersList.innerHTML = "";

  // ✅ clear drop zones
  const lessonDrop = document.getElementById("lesson-drop-zone");
  if (lessonDrop) lessonDrop.innerHTML = `<p class="lesson-drop-hint">Drag blocks here</p>`;

  const chapterDrop = document.getElementById("chapter-drop-zone");
  if (chapterDrop) chapterDrop.innerHTML = `<p class="lesson-drop-hint">Drag blocks here</p>`;

  // ✅ reset chapter hidden index
  const chapterIndex = document.getElementById("chapter-detail-index");
  if (chapterIndex) chapterIndex.value = "";

  // ✅ reset lesson hidden ids
  const lessonIdEl = document.getElementById("lesson-detail-lesson-id");
  const sectionIdEl = document.getElementById("lesson-detail-section-id");
  if (lessonIdEl) lessonIdEl.value = "";
  if (sectionIdEl) sectionIdEl.value = "";

  // ✅ reset lesson inputs
  const lessonName = document.getElementById("lesson-detail-name");
  const lessonDesc = document.getElementById("lesson-detail-description");
  if (lessonName) lessonName.value = "";
  if (lessonDesc) lessonDesc.value = "";

  // ✅ reset chapter detail inputs
  const chapterName = document.getElementById("chapter-detail-name");
  const chapterDesc = document.getElementById("chapter-detail-description");
  if (chapterName) chapterName.value = "";
  if (chapterDesc) chapterDesc.value = "";

  // ✅ reset chapters array state
  if (typeof currentLessonChapters !== "undefined") {
    currentLessonChapters = [];
    window.LESSON_CHAPTERS = currentLessonChapters;
  }

  // ✅ also reset the collapse toggles to OPEN state (optional)
  const chaptersBody = document.getElementById("chapters-body");
  const chaptersToggle = document.getElementById("chapters-toggle");
  if (chaptersBody && chaptersToggle) {
    chaptersBody.hidden = false;
    chaptersToggle.setAttribute("aria-expanded", "true");
    chaptersToggle.querySelector(".icon-open")?.removeAttribute("hidden");
    const closed = chaptersToggle.querySelector(".icon-closed");
    if (closed) closed.hidden = true;
  }
}

//when the add chapter button is pressed how do i expand the chapter section
function openChaptersSection() {
  const chaptersBody   = document.getElementById("chapters-body");
  const chaptersToggle = document.getElementById("chapters-toggle");
  if (!chaptersBody || !chaptersToggle) return;

  // ✅ open
  chaptersBody.hidden = false;

  // ✅ icons
  const openIcon = chaptersToggle.querySelector(".icon-open");
  const closedIcon = chaptersToggle.querySelector(".icon-closed");
  if (openIcon) openIcon.hidden = false;
  if (closedIcon) closedIcon.hidden = true;

  // ✅ aria
  chaptersToggle.setAttribute("aria-expanded", "true");
}



function readOutlineFields() {
  return {
    titleEl: document.getElementById("courses-outline-title"),
    shortDescEl: document.getElementById("courses-outline-desc"),
    notesEl: document.getElementById("courses-outline-notes"),
    priceEl: document.getElementById("courses-price"),
    thumbInput: document.getElementById("courses-thumb"),
    thumbPreview: document.getElementById("courses-thumb-preview"),
    logoInput: document.getElementById("courses-logo"),
    logoPreview: document.getElementById("courses-logo-preview"),
  };
}


  // Form fields
  const titleEl = document.getElementById("courses-outline-title");
  const shortDescEl = document.getElementById("courses-outline-desc");
  const notesEl = document.getElementById("courses-outline-notes");
  const priceEl = document.getElementById("courses-price");

  // Thumbnail elements
  const thumbInput = document.getElementById("courses-thumb");
  const thumbPreview = document.getElementById("courses-thumb-preview");

  // ✅ Logo elements
const logoInput = document.getElementById("courses-logo");
const logoPreview = document.getElementById("courses-logo-preview");

  // Landing UI elements
  const landingCard = document.getElementById("courses-landing-card");
  const openLandingBtn = document.getElementById("courses-open-landing");
  const closeLandingBtn = document.getElementById("courses-landing-close");

  //Add vertical or horizontal images in rich editor
  function wrapSelectionInRow(editorEl) {
  editorEl.focus();

  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return;

  const range = sel.getRangeAt(0);
  if (range.collapsed) {
    alert("Highlight the images/text you want side-by-side first.");
    return;
  }

  const wrapper = document.createElement("div");
  wrapper.className = "rte-row";

  const contents = range.extractContents();
  wrapper.appendChild(contents);

  range.insertNode(wrapper);

  range.setStartAfter(wrapper);
  range.collapse(true);
  sel.removeAllRanges();
  sel.addRange(range);
}

function unwrapRow(editorEl) {
  editorEl.focus();

  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return;
  const node = sel.anchorNode;

  const row =
    node?.nodeType === 1
      ? node.closest?.(".rte-row")
      : node?.parentElement?.closest?.(".rte-row");

  if (!row) {
    alert("Click inside a row first.");
    return;
  }

  const parent = row.parentNode;
  while (row.firstChild) parent.insertBefore(row.firstChild, row);
  parent.removeChild(row);
}

//Add x next to each image
document.addEventListener("click", (e) => {
  const btn = e.target.closest(".rte-img-x");
  if (!btn) return;

  const wrap = btn.closest(".rte-imgwrap");
  if (wrap) wrap.remove();
});

function normalizeEditorImages(editorEl) {
  if (!editorEl) return;

  // wrap any img that is NOT already inside .rte-imgwrap
  const imgs = editorEl.querySelectorAll("img:not(.rte-imgwrap img)");

  imgs.forEach((img) => {
    const wrap = document.createElement("span");
    wrap.className = "rte-imgwrap";
    wrap.setAttribute("contenteditable", "false");

    const x = document.createElement("button");
    x.type = "button";
    x.className = "rte-img-x";
    x.setAttribute("aria-label", "Remove image");
    x.textContent = "×";

    // move the img into the wrap
    img.parentNode.insertBefore(wrap, img);
    wrap.appendChild(x);
    wrap.appendChild(img);
  });
}

  // ✅ Generic RTE setup: B/I/U + Insert Image (no extra preview sections needed)
function initAllRTEs() {
  const toolbars = document.querySelectorAll(".rte-toolbar[data-editor]");

  toolbars.forEach((toolbar) => {
    const editorId = toolbar.getAttribute("data-editor");
    const editorEl = editorId ? document.getElementById(editorId) : null;

    if (!editorEl) {
      console.warn("[RTE] Missing editor for toolbar:", editorId);
      return;
    }

    toolbar.addEventListener("click", async (e) => {
      const btn = e.target.closest("button");
      if (!btn) return;

      // 1) Bold/Italic/Underline
      const cmd = btn.getAttribute("data-cmd");
      if (cmd) {
        editorEl.focus();
        document.execCommand(cmd, false, null);
        return;
      }

      // 2) Actions
      const action = btn.getAttribute("data-action");

      // row
      if (action === "row") {
        wrapSelectionInRow(editorEl);
        return;
      }

      // stack
      if (action === "stack") {
        unwrapRow(editorEl);
        return;
      }

      // image
      if (action === "image") {
        try {
          const picker = document.createElement("input");
          picker.type = "file";
          picker.accept = "image/*";

          picker.onchange = async () => {
            const file = picker.files?.[0];
            if (!file) return;

            if (typeof uploadImageFile !== "function") {
              alert("uploadImageFile(file) is missing. Add it back in your JS.");
              return;
            }

            const url = await uploadImageFile(file);
            if (!url) return;

            editorEl.focus();
        document.execCommand(
  "insertHTML",
  false,
  `
  <span class="rte-imgwrap" contenteditable="false">
    <button type="button" class="rte-img-x" aria-label="Remove image">×</button>
    <img src="${url}" alt="" />
  </span>
  `
);

          };

          picker.click();
        } catch (err) {
          console.error("[RTE] image insert failed", err);
          alert("Could not upload image. Try again.");
        }
        return;
      }
    });
  });
}

// Call once after DOM is ready
initAllRTEs();

  // start closed
  if (landingCard) landingCard.hidden = true;

  // --- Rich editors (headline/subheadline) ---
  const headlineRichEl = document.getElementById("courses-headline-rich");
  const subheadlineRichEl = document.getElementById("courses-subheadline-rich");

  // --- Rich editors (landing page) ---
const salesCopyRichEl      = document.getElementById("courses-sales-copy-rich");
const salesStoryRichEl     = document.getElementById("courses-sales-story-rich");
const primaryCtaRichEl     = document.getElementById("courses-primary-cta-rich");
const secondaryCtaRichEl   = document.getElementById("courses-secondary-cta-rich");
const urgencyRichEl        = document.getElementById("courses-sales-urgency-rich");
const outcomesRichEl       = document.getElementById("courses-outcomes-rich");
const bonusesRichEl        = document.getElementById("courses-bonuses-rich");
const guaranteeRichEl      = document.getElementById("courses-guarantee-rich");
const proofHeadlineRichEl  = document.getElementById("courses-proof-headline-text-rich");
const instructorBioRichEl  = document.getElementById("courses-instructor-bio-rich");
const faqRichEl            = document.getElementById("courses-faq-rich");

  function bindToolbar(toolbarRoot, editorEl) {
    if (!toolbarRoot || !editorEl) return;

    toolbarRoot.addEventListener("click", (e) => {
      const btn = e.target.closest("button");
      if (!btn) return;

      const cmd = btn.getAttribute("data-cmd");
      if (!cmd) return;

      editorEl.focus();
      document.execCommand(cmd, false, null);
    });
  }

  // In YOUR markup, toolbar is usually previousElementSibling.
  // But keep it safe if DOM structure changes.
  const headlineToolbar =
    headlineRichEl?.previousElementSibling ||
    document.getElementById("courses-headline-toolbar");

  const subheadlineToolbar =
    subheadlineRichEl?.previousElementSibling ||
    document.getElementById("courses-subheadline-toolbar");

  bindToolbar(headlineToolbar, headlineRichEl);
  bindToolbar(subheadlineToolbar, subheadlineRichEl);



  // Helpers to read/write HTML
  const getHtml = (el) => (el ? (el.innerHTML || "").trim() : "");
  const setHtml = (el, html) => {
    if (el) el.innerHTML = html || "";
  };
// ✅ Plain inputs that are NOT rich editors
const primaryCtaUrlEl    = document.getElementById("courses-primary-cta-url");
const secondaryAnchorEl  = document.getElementById("courses-secondary-cta-anchor");
const ctaTextEl          = document.getElementById("courses-cta-text");
const saleEndsAtEl       = document.getElementById("courses-sale-ends-at");


  // Buttons
  const saveBtn = document.getElementById("courses-save");
  const cancelBtn = document.getElementById("courses-cancel");
  const deleteBtn = document.getElementById("courses-delete");
  const courseSelect = document.getElementById("courses-select");

  // Outline collapse toggle
  const outlineBody = document.getElementById("courses-outline-body");
  const toggleBtn = document.getElementById("courses-outline-toggle");
  const iconOpenSpan = toggleBtn?.querySelector(".icon-open");
  const iconClosedSpan = toggleBtn?.querySelector(".icon-closed");
  const openOutlineBtn = document.getElementById("courses-open-outline");

  ////////////
  ////Minimize Course Details when Edit Outline Button is pressed 
  openOutlineBtn?.addEventListener("click", () => {
  // ✅ minimize details section
  if (detailsBody) detailsBody.hidden = true;

  // ✅ flip the chevron icon to the "closed" state
  if (dIconOpenSpan) dIconOpenSpan.hidden = true;     // hide ▾
  if (dIconClosedSpan) dIconClosedSpan.hidden = false; // show ▸ (if you have it)

  // ✅ update aria
  detailsToggle?.setAttribute("aria-expanded", "false");

  // ✅ show outline (if you're using this helper)
  if (typeof setOutlineVisible === "function") setOutlineVisible(true);

  // optional: scroll
  document.getElementById("courses-outline")?.scrollIntoView({
    behavior: "smooth",
    block: "start",
  });
});
//////////
  // detailsCard
  const detailsCard = document.getElementById("courses-details");
  const detailsBody = document.getElementById("courses-details-body");
  const detailsToggle = document.getElementById("courses-details-toggle");
  const dIconOpenSpan = detailsToggle?.querySelector(".icon-open");
  const dIconClosedSpan = detailsToggle?.querySelector(".icon-closed");

  //helper
  function closeAllCourseSectionsExceptDetails() {
  // ✅ keep details card visible + keep its body open
  if (detailsCard) detailsCard.hidden = false;

  if (detailsBody) detailsBody.hidden = false;
  if (dIconOpenSpan) dIconOpenSpan.hidden = false;
  if (dIconClosedSpan) dIconClosedSpan.hidden = true;
  detailsToggle?.setAttribute("aria-expanded", "true");

  // ✅ close Landing
  if (landingCard) landingCard.hidden = true;

  // ✅ hide Outline card entirely (or just collapse body — your choice)
  setOutlineVisible(false); // hides the whole outline card

  // OPTIONAL: also collapse outline body toggle state so next time it's consistent
  if (outlineBody && toggleBtn) {
    outlineBody.hidden = true;
    if (iconOpenSpan) iconOpenSpan.hidden = true;
    if (iconClosedSpan) iconClosedSpan.hidden = false;
    toggleBtn.setAttribute("aria-expanded", "false");
  }
}

  ////////////
  //Minimize Course Details when ▾ button is pressed 
  if (detailsToggle && detailsBody) {
  // start OPEN by default (optional)
  detailsBody.hidden = false;
  if (dIconOpenSpan) dIconOpenSpan.hidden = false; // ▾ visible
  if (dIconClosedSpan) dIconClosedSpan.hidden = true; // ▸ hidden
  detailsToggle.setAttribute("aria-expanded", "true");

  detailsToggle.addEventListener("click", () => {
    const isOpen = !detailsBody.hidden;

    // toggle body
    detailsBody.hidden = isOpen;

    // toggle icons
    if (dIconOpenSpan) dIconOpenSpan.hidden = isOpen;      // hide ▾ when closed
    if (dIconClosedSpan) dIconClosedSpan.hidden = !isOpen; // show ▸ when closed

    detailsToggle.setAttribute("aria-expanded", String(!isOpen));
  });
}
////////////////

  // Sections
  const sectionsWrap = document.getElementById("outline-sections");
  const addSectionBtn = document.getElementById("outline-add-section");
  const emptyNote = document.getElementById("outline-empty-note");




  // 🔹 1. Open outline when "Add Course" is clicked (CREATE mode)
  if (addBtn && detailsCard) {
    addBtn.addEventListener("click", () => {
      currentCourseId = null;

      // clear landing fields too
      setHtml(headlineRichEl, "");
      setHtml(subheadlineRichEl, "");

    // ✅ clear rich landing editors
setHtml(salesCopyRichEl, "");
setHtml(salesStoryRichEl, "");
setHtml(primaryCtaRichEl, "");
setHtml(secondaryCtaRichEl, "");
setHtml(urgencyRichEl, "");
setHtml(outcomesRichEl, "");
setHtml(bonusesRichEl, "");
setHtml(guaranteeRichEl, "");
setHtml(proofHeadlineRichEl, "");
setHtml(instructorBioRichEl, "");
setHtml(faqRichEl, "");



// ✅ clear the few plain landing inputs
if (primaryCtaUrlEl) primaryCtaUrlEl.value = "";
if (secondaryAnchorEl) secondaryAnchorEl.value = "";
if (ctaTextEl) ctaTextEl.value = "";
if (saleEndsAtEl) saleEndsAtEl.value = "";


      // close landing card on new course
      if (landingCard) landingCard.hidden = true;

      // clear fields...
      if (titleEl) titleEl.value = "";
      if (shortDescEl) shortDescEl.value = "";
      if (notesEl) notesEl.value = "";
      if (priceEl) priceEl.value = "";
      if (thumbInput) thumbInput.value = "";
      if (thumbPreview) {
        thumbPreview.innerHTML = '<span class="muted">Click to upload thumbnail</span>';
      }

          // ✅ reset logo too
    if (logoInput) logoInput.value = "";
    if (logoPreview) {
      logoPreview.innerHTML = '<span class="muted">Click to upload logo</span>';
    }

    // ✅ reset style to defaults for NEW course
applyCourseStyleToUI({ courseBgColor: "#ffffff", courseTextColor: "#111111" });

// details open
if (detailsBody) detailsBody.hidden = false;
if (dIconOpenSpan) dIconOpenSpan.hidden = false;
if (dIconClosedSpan) dIconClosedSpan.hidden = true;



      detailsCard.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  // 🔹 2. Thumbnail preview (click box → open file, show preview)
  if (thumbInput && thumbPreview) {
    const openPicker = () => thumbInput.click();

    thumbPreview.parentElement?.addEventListener("click", openPicker);

    thumbInput.addEventListener("change", () => {
      const file = thumbInput.files?.[0];
      if (!file) {
        thumbPreview.innerHTML = '<span class="muted">Click to upload thumbnail</span>';
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        thumbPreview.innerHTML = `<img src="${reader.result}" alt="Course thumbnail">`;
      };
      reader.readAsDataURL(file);
    });
  }

  // ✅ Logo preview (click box → open file, show preview)
if (logoInput && logoPreview) {
  const openPicker = () => logoInput.click();

  logoPreview.parentElement?.addEventListener("click", openPicker);

  logoInput.addEventListener("change", () => {
    const file = logoInput.files?.[0];
    if (!file) {
      logoPreview.innerHTML = '<span class="muted">Click to upload logo</span>';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      logoPreview.innerHTML = `<img src="${reader.result}" alt="Course logo">`;
    };
    reader.readAsDataURL(file);
  });
}

  // Helper to upload thumbnail (if selected)
  async function uploadThumbIfNeeded() {
    if (!thumbInput || !thumbInput.files || !thumbInput.files[0]) return null;

    const fd = new FormData();
    fd.append("file", thumbInput.files[0]);

    const res = await fetch(apiUrl("/api/upload"), {
      method: "POST",
      body: fd,
      credentials: "include",
    });

    const out = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(out.error || "Thumbnail upload failed");
    }

    return out.url || out.path || out.location || null;
  }

  //helper for thumbnail image 
  async function uploadLogoIfNeeded() {
  if (!logoInput || !logoInput.files || !logoInput.files[0]) return null;

  const fd = new FormData();
  fd.append("file", logoInput.files[0]);

  const res = await fetch(apiUrl("/api/upload"), {
    method: "POST",
    body: fd,
    credentials: "include",
  });

  const out = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(out.error || "Logo upload failed");
  }

  return out.url || out.path || out.location || null;
}

  ///////////////////////////////////////
  // Style Course
  //////////////////////////
  // ---------- Course Style Popup ----------
const openStyleBtn = document.getElementById("open-course-style");
const overlay = document.getElementById("course-style-overlay");
const closeBtn = document.getElementById("close-course-style");


const bgColor = document.getElementById("course-bg-color");
const bgHex   = document.getElementById("course-bg-hex");
const txColor = document.getElementById("course-text-color");
const txHex   = document.getElementById("course-text-hex");

const saveStyleBtn   = document.getElementById("save-course-style");
const cancelStyleBtn = document.getElementById("cancel-course-style");

// open
if (openStyleBtn && overlay) {
  openStyleBtn.addEventListener("click", () => {
    // pull from hidden (if present) so popup always matches current course style
    const bg = document.getElementById("courses-bg-color")?.value || "#ffffff";
    const tx = document.getElementById("courses-text-color")?.value || "#111111";

    applyCourseStyleToUI({ courseBgColor: bg, courseTextColor: tx });

    overlay.style.display = "flex";
  });
}


// close helpers
function closeStylePopup() {
  overlay.style.display = "none";
}

if (closeBtn) closeBtn.addEventListener("click", closeStylePopup);
if (cancelStyleBtn) cancelStyleBtn.addEventListener("click", closeStylePopup);


// click outside to close
if (overlay) {
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeStylePopup();
  });
}

// sync color <-> hex inputs
function syncPair(colorEl, hexEl) {
  if (!colorEl || !hexEl) return;

  colorEl.addEventListener("input", () => {
    hexEl.value = colorEl.value;
  });

  hexEl.addEventListener("input", () => {
    // basic guard so it doesn't break if they type weird stuff
    const v = String(hexEl.value || "").trim();
    if (/^#[0-9A-Fa-f]{6}$/.test(v)) colorEl.value = v;
  });
}

syncPair(bgColor, bgHex);
syncPair(txColor, txHex);


  
if (saveStyleBtn) {
  saveStyleBtn.addEventListener("click", () => {
    const courseBgColor = bgColor?.value || "#ffffff";
    const courseTextColor = txColor?.value || "#111111";

    // store to hidden inputs so your main Save Course includes them
    let bgHidden = document.getElementById("courses-bg-color");
    let txHidden = document.getElementById("courses-text-color");

    if (!bgHidden) {
      bgHidden = document.createElement("input");
      bgHidden.type = "hidden";
      bgHidden.id = "courses-bg-color";
      document.body.appendChild(bgHidden);
    }
    if (!txHidden) {
      txHidden = document.createElement("input");
      txHidden.type = "hidden";
      txHidden.id = "courses-text-color";
      document.body.appendChild(txHidden);
    }

    bgHidden.value = courseBgColor;
    txHidden.value = courseTextColor;

    closeStylePopup();
  });
}


  ///////////////////////////////////////
  // Save Course
  //////////////////////////
  function stripHtml(html = "") {
    const div = document.createElement("div");
    div.innerHTML = html;
    return (div.textContent || "").trim();
  }

  // 🔹 3. Save Course → POST /api/records/Course
  saveBtn?.addEventListener("click", async () => {
    try {
      const uid = await window.requireUser(); // ensure logged in

      const title = (titleEl?.value || "").trim();
      if (!title) {
        alert("Please enter a course title.");
        titleEl?.focus();
        return;
      }

      // ✅ slug (create + edit)
      console.log("[course] requesting slug…", { title, currentCourseId });
      const slug = await generateSlugForType("Course", title, currentCourseId);
      console.log("[course] slug result:", slug);

      const shortDesc = (shortDescEl?.value || "").trim();
      const notes = (notesEl?.value || "").trim();

      const priceNum = Number(priceEl?.value || 0);
      const price = Number.isNaN(priceNum) ? 0 : priceNum;

    // ✅ Plain inputs that still exist
const primaryCtaUrl    = (primaryCtaUrlEl?.value || "").trim();
const secondaryAnchor  = (secondaryAnchorEl?.value || "").trim();
const ctaText          = (ctaTextEl?.value || "").trim();

// ✅ read rich HTML
const salesCopyRich     = getHtml(salesCopyRichEl);
const salesStoryRich    = getHtml(salesStoryRichEl);
const primaryCtaRich    = getHtml(primaryCtaRichEl);
const secondaryCtaRich  = getHtml(secondaryCtaRichEl);
const urgencyRich       = getHtml(urgencyRichEl);
const outcomesRich      = getHtml(outcomesRichEl);
const bonusesRich       = getHtml(bonusesRichEl);
const guaranteeRich     = getHtml(guaranteeRichEl);
const proofHeadlineRich = getHtml(proofHeadlineRichEl);
const instructorBioRich = getHtml(instructorBioRichEl);
const faqRich           = getHtml(faqRichEl);

// ✅ also keep a plain-text version (optional, but nice for simple templates)
const salesCopyText     = stripHtml(salesCopyRich);
const salesStoryText    = stripHtml(salesStoryRich);
const primaryCtaText    = stripHtml(primaryCtaRich);
const secondaryCtaText  = stripHtml(secondaryCtaRich);
const urgencyText       = stripHtml(urgencyRich);
const outcomesText      = stripHtml(outcomesRich);
const bonusesText       = stripHtml(bonusesRich);
const guaranteeText     = stripHtml(guaranteeRich);
const proofHeadlineText = stripHtml(proofHeadlineRich);
const instructorBioText = stripHtml(instructorBioRich);
const faqText           = stripHtml(faqRich);

      // Try to upload thumbnail (optional)
      let thumbUrl = null;
      try {
        thumbUrl = await uploadThumbIfNeeded();
      } catch (err) {
        console.warn("[courses] thumbnail upload failed:", err);
        alert("Thumbnail upload failed. The course will be saved without it.");
      }
let logoUrl = null;
try {
  logoUrl = await uploadLogoIfNeeded();
} catch (err) {
  console.warn("[courses] logo upload failed:", err);
  alert("Logo upload failed. The course will be saved without it.");
}

      // ✅ convert datetime-local -> ISO before values object
      let saleEndsAtISO = null;
      const saleEndsLocal = (saleEndsAtEl?.value || "").trim();
      if (saleEndsLocal) {
        const d = new Date(saleEndsLocal);
        if (!Number.isNaN(d.getTime())) saleEndsAtISO = d.toISOString();
      }

      // ✅ Landing Page values (RICH-first)
      const headlineRich = getHtml(headlineRichEl);
      const subheadlineRich = getHtml(subheadlineRichEl);

      const headlineText = stripHtml(headlineRich);
      const subheadlineText = stripHtml(subheadlineRich);

      // Build values object matching your Course DataType fields
      const values = {
        "Course Title": title,
        "Short Description": shortDesc,
        "Outline Notes": notes,
        Price: price,
        "Sale Price": null,
        "Created At": new Date().toISOString(),
        "Created By": { _id: uid },
        Locked: false,
        Visible: true,

        // ✅ slug fields
        slug: slug,
        "Course Slug": slug,
        courseSlug: slug,

        // ✅ Landing Page fields
    // ✅ Landing Page fields
Headline: headlineText,
Subheadline: subheadlineText,
"Headline Rich": headlineRich,
"Subheadline Rich": subheadlineRich,

"Sales Copy": salesCopyText,
"Sales Copy Rich": salesCopyRich,

"Sales Story": salesStoryText,
"Sales Story Rich": salesStoryRich,

"Primary CTA": primaryCtaText,
"Primary CTA Rich": primaryCtaRich,
"Primary CTA URL": primaryCtaUrl,

"Secondary CTA": secondaryCtaText,
"Secondary CTA Rich": secondaryCtaRich,
"Secondary CTA Anchor/Section": secondaryAnchor,

"CTA Text": ctaText,

"Sales Urgency": urgencyText,
"Sales Urgency Rich": urgencyRich,
"Sale Ends At": saleEndsAtISO,

Outcomes: outcomesText,
"Outcomes Rich": outcomesRich,

Bonuses: bonusesText,
"Bonuses Rich": bonusesRich,

Guarantee: guaranteeText,
"Guarantee Rich": guaranteeRich,

"Social Proof Headline Text": proofHeadlineText,
"Social Proof Headline Text Rich": proofHeadlineRich,

"Instructor Bio": instructorBioText,
"Instructor Bio Rich": instructorBioRich,

FAQ: faqText,
"FAQ Rich": faqRich,
      };
// ✅ ADD STYLE VALUES RIGHT HERE (below the values object)
values.courseBgColor =
  document.getElementById("courses-bg-color")?.value || values.courseBgColor;

values.courseTextColor =
  document.getElementById("courses-text-color")?.value || values.courseTextColor;

  //last edited 
  values["Last Edited At"] = new Date().toISOString();

// ✅ Lead capture settings (default: name + email)
values["Lead Capture Enabled"] = !!document.getElementById("lead-enabled")?.checked;

values["Lead Capture Config"] = JSON.stringify({
  headline: (leadHeadlineEl?.value || "Enter your info to continue").trim(),
  buttonText: (leadBtnTextEl?.value || "Continue").trim(),
  fields: leadFields,
  styles: {
    bg: leadBgEl?.value || "#ffffff",
    bgImage: leadBgImageUrl || "",
    headerImage: leadHeaderImageUrl || "",
    text: leadTextEl?.value || "#111111",
    buttonBg: leadBtnEl?.value || "#111111",
    buttonText: leadBtnTextColEl?.value || "#ffffff",
    border: leadBorderEl?.value || "#dddddd",
  },
deliver: {
  fileUrl: leadDeliverFileUrl || "",
  fileName: leadDeliverFileName || "",
}

});





      console.log("[course] saving course with slug fields:", {
        slug: values.slug,
        courseSlug: values.courseSlug,
        courseSlugField: values["Course Slug"],
      });

      if (thumbUrl) values["Thumbnail Image"] = thumbUrl;

      if (logoUrl) values["Course Logo"] = logoUrl; // ✅ use your DataType field name

      // Create or update
      let saved;
      if (currentCourseId) {
        saved = await window.fetchJSON(`/api/records/Course/${currentCourseId}`, {
          method: "PATCH",
          body: JSON.stringify({ values }),
        });
      } else {
        saved = await window.fetchJSON("/api/records/Course", {
          method: "POST",
          body: JSON.stringify({ values }),
        });
      }

      console.log("[course] saved response:", saved);

      const savedId =
        (Array.isArray(saved?.items) && saved.items[0]?._id) ? saved.items[0]._id :
        (Array.isArray(saved?.items) && saved.items[0]?.id) ? saved.items[0].id :
        saved?._id || saved?.id;

      console.log("[course] savedId:", savedId);

      alert("Course saved!");

      closeAllCourseSectionsExceptDetails();

// ✅ scroll to the top of course details
detailsCard?.scrollIntoView({ behavior: "smooth", block: "start" });

      // Refresh dropdown
      if (typeof hydrateCourseDropdown === "function") {
        await hydrateCourseDropdown();
      } else if (window.hydrateCourseDropdown) {
        await window.hydrateCourseDropdown();
      }

      // Auto-select new course
      const select = document.getElementById("courses-select");
      if (select && savedId) {
        select.value = savedId;
        select.dispatchEvent(new Event("change"));
      }

  
    
    } catch (err) {
      console.error("[courses] save failed", err);
      alert("Could not save course: " + (err.message || err));
    }
  });

  // 🔹 4. Cancel → just hide the outline panel
cancelBtn?.addEventListener("click", () => {
  if (detailsCard) detailsCard.hidden = true;
  if (landingCard) landingCard.hidden = true; // keep UI tidy
});

// 🔹 Delete course → DELETE /api/records/Course/:id
deleteBtn?.addEventListener("click", async () => {
  try {
    if (!currentCourseId) {
      alert("Select a course from the dropdown first.");
      return;
    }

    const ok = confirm("Are you sure you want to delete this course? This cannot be undone.");
    if (!ok) return;

    await window.requireUser();

    // ✅ LOGS (BEFORE delete)
    console.log("[delete] currentCourseId:", currentCourseId);
    console.log("[delete] cache record:", window.__COURSE_CACHE?.[currentCourseId] || null);
    console.log(
      "[delete] cache deletedAt:",
      window.__COURSE_CACHE?.[currentCourseId]?.deletedAt ||
        window.__COURSE_CACHE?.[currentCourseId]?.values?.deletedAt ||
        null
    );

    // ✅ DO THE DELETE (and CAPTURE RESPONSE)
    const delRes = await window.fetchJSON(`/api/records/Course/${currentCourseId}`, {
      method: "DELETE",
    });

    // ✅ LOGS (AFTER delete)
    console.log("[delete] server response:", delRes);
    console.log("[delete] server updated deletedAt?:", delRes?.items?.[0]?.deletedAt || null);

    // ✅ remove from dropdown immediately (courses-select)
    const select = document.getElementById("courses-select");
    if (select) {
      const opt = select.querySelector(`option[value="${currentCourseId}"]`);
      if (opt) opt.remove();
      select.value = "";
    }

    // ✅ also remove from students dropdown immediately (students-course-select)
    const sel2 = document.getElementById("students-course-select");
    if (sel2) {
      const opt2 = sel2.querySelector(`option[value="${currentCourseId}"]`);
      if (opt2) opt2.remove();
      sel2.value = "";
    }

    // ✅ remove from cache
    if (window.__COURSE_CACHE) delete window.__COURSE_CACHE[currentCourseId];

    alert("Course deleted.");

    // Clear current selection + UI
    currentCourseId = null;
    window.selectedCourse = null;

    // ✅ re-hydrate BOTH dropdowns to be safe
    if (typeof hydrateCourseDropdown === "function") await hydrateCourseDropdown();
    if (typeof hydrateStudentsCourseDropdown === "function") await hydrateStudentsCourseDropdown();

  } catch (err) {
    console.error("[courses] delete failed", err);
    alert("Could not delete course: " + (err?.message || err));
  }
});







// Load a course into the outline when dropdown changes
function escapeHtml(s = "") {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function applyCourseStyleToUI(style = {}) {
  const bg = style.courseBgColor || "#ffffff";
  const tx = style.courseTextColor || "#111111";

  // 1) set the popup pickers so they show the saved values
  if (bgColor) bgColor.value = bg;
  if (bgHex) bgHex.value = bg;

  if (txColor) txColor.value = tx;
  if (txHex) txHex.value = tx;

  // 2) keep hidden inputs in sync (so Save Course keeps them)
  let bgHidden = document.getElementById("courses-bg-color");
  let txHidden = document.getElementById("courses-text-color");

  if (!bgHidden) {
    bgHidden = document.createElement("input");
    bgHidden.type = "hidden";
    bgHidden.id = "courses-bg-color";
    document.body.appendChild(bgHidden);
  }
  if (!txHidden) {
    txHidden = document.createElement("input");
    txHidden.type = "hidden";
    txHidden.id = "courses-text-color";
    document.body.appendChild(txHidden);
  }

  bgHidden.value = bg;
  txHidden.value = tx;


}

// 🔹 Helper: load an existing course into the outline (EDIT mode)
async function loadCourseIntoDetails(courseId) {
  if (!courseId || !detailsCard) return;

  // look up from cache
  let rec = window.__COURSE_CACHE?.[courseId];

  if (!rec) {
    try {
      await listCoursesForCurrentUser(); // repopulate cache
    } catch (e) {
      console.warn("[courses] refetch while loading details failed", e);
    }
    rec = window.__COURSE_CACHE?.[courseId];
  }

  if (!rec) {
    alert("Could not find that course.");
    return;
  }
console.log("[loadCourseIntoDetails] asked for:", courseId);
console.log("[loadCourseIntoDetails] got rec:", rec);
console.log("[loadCourseIntoDetails] rec ids:", {
  _id: rec?._id,
  id: rec?.id,
  computed: String(rec?._id || rec?.id || courseId),
});
console.log("[loadCourseIntoDetails] deletedAt:", rec?.deletedAt || rec?.values?.deletedAt || null);

  const v = rec.values || rec;
  // ✅ HYDRATE + APPLY saved course style
applyCourseStyleToUI({
  courseBgColor: v.courseBgColor || v["courseBgColor"] || "",
  courseTextColor: v.courseTextColor || v["courseTextColor"] || "",
});

  currentCourseId = rec._id || rec.id || courseId;

  if (titleEl) titleEl.value = v["Course Title"] || v.Title || "";
  if (shortDescEl) shortDescEl.value = v["Short Description"] || "";
  if (notesEl) notesEl.value = v["Outline Notes"] || "";
  if (priceEl) {
    const p = v["Price"];
    priceEl.value = p === undefined || p === null ? "" : String(p);
  }

  // ✅ Landing Page fields hydrate (EDIT mode) — rich-first


  if (headlineRichEl) {
    const rich = String(v["Headline Rich"] || "").trim();
    const plain = String(v["Headline"] || "").trim();
    setHtml(headlineRichEl, rich || (plain ? `<p>${escapeHtml(plain)}</p>` : ""));
  }

  if (subheadlineRichEl) {
    const rich = String(v["Subheadline Rich"] || "").trim();
    const plain = String(v["Subheadline"] || "").trim();
    setHtml(subheadlineRichEl, rich || (plain ? `<p>${escapeHtml(plain)}</p>` : ""));
  }

  // ✅ hydrate the other rich editors (rich-first, fallback to plain)
setHtml(salesCopyRichEl,      (String(v["Sales Copy Rich"] || "").trim()) || (v["Sales Copy"] ? `<p>${escapeHtml(v["Sales Copy"])}</p>` : ""));
setHtml(salesStoryRichEl,     (String(v["Sales Story Rich"] || "").trim()) || (v["Sales Story"] ? `<p>${escapeHtml(v["Sales Story"])}</p>` : ""));
setHtml(primaryCtaRichEl,     (String(v["Primary CTA Rich"] || "").trim()) || (v["Primary CTA"] ? `<p>${escapeHtml(v["Primary CTA"])}</p>` : ""));
setHtml(secondaryCtaRichEl,   (String(v["Secondary CTA Rich"] || "").trim()) || (v["Secondary CTA"] ? `<p>${escapeHtml(v["Secondary CTA"])}</p>` : ""));
setHtml(urgencyRichEl,        (String(v["Sales Urgency Rich"] || "").trim()) || (v["Sales Urgency"] ? `<p>${escapeHtml(v["Sales Urgency"])}</p>` : ""));
setHtml(outcomesRichEl,       (String(v["Outcomes Rich"] || "").trim()) || (v["Outcomes"] ? `<p>${escapeHtml(v["Outcomes"])}</p>` : ""));
setHtml(bonusesRichEl,        (String(v["Bonuses Rich"] || "").trim()) || (v["Bonuses"] ? `<p>${escapeHtml(v["Bonuses"])}</p>` : ""));
setHtml(guaranteeRichEl,      (String(v["Guarantee Rich"] || "").trim()) || (v["Guarantee"] ? `<p>${escapeHtml(v["Guarantee"])}</p>` : ""));
setHtml(proofHeadlineRichEl,  (String(v["Social Proof Headline Text Rich"] || "").trim()) || (v["Social Proof Headline Text"] ? `<p>${escapeHtml(v["Social Proof Headline Text"])}</p>` : ""));
setHtml(instructorBioRichEl,  (String(v["Instructor Bio Rich"] || "").trim()) || (v["Instructor Bio"] ? `<p>${escapeHtml(v["Instructor Bio"])}</p>` : ""));
setHtml(faqRichEl,            (String(v["FAQ Rich"] || "").trim()) || (v["FAQ"] ? `<p>${escapeHtml(v["FAQ"])}</p>` : ""));

normalizeEditorImages(headlineRichEl);
normalizeEditorImages(subheadlineRichEl);
normalizeEditorImages(salesCopyRichEl);
normalizeEditorImages(salesStoryRichEl);
normalizeEditorImages(primaryCtaRichEl);
normalizeEditorImages(secondaryCtaRichEl);
normalizeEditorImages(urgencyRichEl);
normalizeEditorImages(outcomesRichEl);
normalizeEditorImages(bonusesRichEl);
normalizeEditorImages(guaranteeRichEl);
normalizeEditorImages(proofHeadlineRichEl);
normalizeEditorImages(instructorBioRichEl);
normalizeEditorImages(faqRichEl);


  if (primaryCtaUrlEl) primaryCtaUrlEl.value = v["Primary CTA URL"] || "";
 
  if (secondaryAnchorEl) secondaryAnchorEl.value = v["Secondary CTA Anchor/Section"] || "";

  if (ctaTextEl) ctaTextEl.value = v["CTA Text"] || "";

  // ✅ datetime-local needs special formatting
  if (saleEndsAtEl) {
    saleEndsAtEl.value = isoToLocalInputValue(v["Sale Ends At"]);
  }

  if (thumbPreview) {
    const t = v["Thumbnail Image"];
    const imgUrl = t && t.url ? t.url : typeof t === "string" ? t : "";

    if (imgUrl) {
      thumbPreview.innerHTML = `<img src="${imgUrl}" alt="Course thumbnail">`;
    } else {
      thumbPreview.innerHTML = '<span class="muted">Click to upload thumbnail</span>';
    }
  }

  if (logoPreview) {
  const lg = v["Course Logo"];
  const imgUrl = lg && lg.url ? lg.url : typeof lg === "string" ? lg : "";

  if (imgUrl) {
    logoPreview.innerHTML = `<img src="${imgUrl}" alt="Course logo">`;
  } else {
    logoPreview.innerHTML = '<span class="muted">Click to upload logo</span>';
  }
}


// ✅ hydrate Lead Capture UI (EDIT mode)
try {
  const enabled = !!v["Lead Capture Enabled"];
  if (leadEnabledEl) leadEnabledEl.checked = enabled;

  const cfgRaw = v["Lead Capture Config"];
  const cfg = cfgRaw ? JSON.parse(cfgRaw) : null;

// ✅ hydrate background image (if saved)
leadBgImageUrl = cfg?.styles?.bgImage || "";
if (leadBgImageEl) leadBgImageEl.value = ""; // can't prefill

leadHeaderImageUrl = cfg?.styles?.headerImage || "";
if (leadHeaderImageEl) leadHeaderImageEl.value = ""; // can't prefill file input
renderLeadHeaderImageUI();

// ✅ hydrate deliver file (if saved)
leadDeliverFileUrl  = cfg?.deliver?.fileUrl || "";
leadDeliverFileName = cfg?.deliver?.fileName || ""; // ✅ THIS IS THE MISSING PIECE
if (leadDeliverFileEl) leadDeliverFileEl.value = ""; // can't prefill

updateLeadPreview();
renderLeadBgImageUI();
renderLeadHeaderImageUI();

renderLeadDeliverFileUI();




  // ✅ ADD THIS BLOCK RIGHT HERE (after cfg is parsed)
  if (cfg?.fields && Array.isArray(cfg.fields)) {
    // Merge defaults + saved custom fields (defaults win)
    const custom = cfg.fields.filter(
      (f) => f && !f.locked && f.key !== "name" && f.key !== "email"
    );
    leadFields = [...LEAD_DEFAULT_FIELDS, ...custom];
  } else {
    leadFields = [...LEAD_DEFAULT_FIELDS];
  }
  renderLeadFields();
  // ✅ END ADD BLOCK

  if (cfg) {
    if (leadHeadlineEl) leadHeadlineEl.value = cfg.headline || "";
    if (leadBtnTextEl) leadBtnTextEl.value = cfg.buttonText || "";

    if (leadBgEl) leadBgEl.value = cfg.styles?.bg || "#ffffff";
    if (leadTextEl) leadTextEl.value = cfg.styles?.text || "#111111";
    if (leadBtnEl) leadBtnEl.value = cfg.styles?.buttonBg || "#111111";
    if (leadBtnTextColEl) leadBtnTextColEl.value = cfg.styles?.buttonText || "#ffffff";
    if (leadBorderEl) leadBorderEl.value = cfg.styles?.border || "#dddddd";
    
  } else {
    if (leadHeadlineEl) leadHeadlineEl.value = "Enter your info to continue";
    if (leadBtnTextEl) leadBtnTextEl.value = "Continue";
  }

  setLeadSettingsVisible();
  updateLeadPreview();
} catch (e) {
  console.warn("[lead capture] could not parse Lead Capture Config", e);

  // ✅ fallback defaults so UI still shows name/email
  leadFields = [...LEAD_DEFAULT_FIELDS];
  renderLeadFields();

  setLeadSettingsVisible();
  updateLeadPreview();
}

// show details
detailsCard.hidden = false;
// ✅ make sure details is OPEN when course loads
if (detailsBody) detailsBody.hidden = false;
if (dIconOpenSpan) dIconOpenSpan.hidden = false;
if (dIconClosedSpan) dIconClosedSpan.hidden = true;




  // 🔹 load sections for this course
  if (typeof hydrateSectionsForCourse === "function") {
    await hydrateSectionsForCourse(currentCourseId);
  }

  detailsCard.scrollIntoView({ behavior: "smooth", block: "start" });
}

function isoToLocalInputValue(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

// 🔹 When user selects a course in the dropdown → open details (EDIT mode)
if (courseSelect) {
  courseSelect.addEventListener("change", async (e) => {
    const target = e.target;
    const id = target && "value" in target ? target.value : "";

    
    // ✅ LOG: dropdown selection
console.log("[courses-select] change -> raw value:", id);
console.log("[courses-select] typeof value:", typeof id);

// ✅ LOG: what's in cache for this id (before loading)
console.log("[courses-select] cache has id?:", !!window.__COURSE_CACHE?.[id]);
console.log("[courses-select] cached record:", window.__COURSE_CACHE?.[id] || null);
console.log("[courses-select] cached deletedAt:", window.__COURSE_CACHE?.[id]?.deletedAt || window.__COURSE_CACHE?.[id]?.values?.deletedAt || null);

    if (!id) {
  if (detailsCard) detailsCard.hidden = true;
  if (landingCard) landingCard.hidden = true;
  currentCourseId = null;
  window.selectedCourse = null;
  return;
}

    await loadCourseIntoDetails(id);



    // keep landing closed on course switch
    if (landingCard) landingCard.hidden = true;

    window.selectedCourse = window.__COURSE_CACHE?.[id] || null;
  });
}

// Course Customizations
function openLanding() {
  if (!landingCard) return;
  if (!currentCourseId) {
    alert("Select or create a course first.");
    return;
  }
  landingCard.hidden = false;
  landingCard.scrollIntoView({ behavior: "smooth", block: "start" });
}

function closeLanding() {
  if (!landingCard) return;
  landingCard.hidden = true;
}

openLandingBtn?.addEventListener("click", openLanding);
closeLandingBtn?.addEventListener("click", closeLanding);

// 🔹 Collapse / expand Course Outline body
if (toggleBtn && outlineBody) {
  toggleBtn.addEventListener("click", () => {
    const isCurrentlyOpen = !outlineBody.hidden;

    outlineBody.hidden = isCurrentlyOpen;

    if (iconOpenSpan) iconOpenSpan.hidden = isCurrentlyOpen;
    if (iconClosedSpan) iconClosedSpan.hidden = !isCurrentlyOpen;

    toggleBtn.setAttribute("aria-expanded", String(!isCurrentlyOpen));
  });
}



                                      
























/////////////Sections
 // helper to build a section row
const SECTION_TYPE = 'Course Section'; // DataType name

// ✅ section image field name in Mongo
const SECTION_IMAGE_KEY = "Section Image";

// ✅ resolve upload path to a usable URL (same pattern as your app)
function resolveAssetUrl(raw) {
  if (!raw) return "";
  const s = String(raw).trim();
  if (!s) return "";
  if (/^https?:\/\//i.test(s)) return s;
  if (s.startsWith("/uploads/")) return `${API_ORIGIN}${s}`;
  if (s.startsWith("/")) return `${API_ORIGIN}${s}`;
  return `${API_ORIGIN}/uploads/${s}`;
}

// ✅ upload ONE image file and return a URL/path to store in the record
// IMPORTANT: update endpoint name if yours is different
async function uploadSectionImage(file) {
  if (!file) return "";

  const fd = new FormData();
  fd.append("file", file);

  // If your upload endpoint is different, change this:
  const res = await fetch(`${API_ORIGIN}/api/upload`, {
    method: "POST",
    credentials: "include",
    body: fd,
  });

  if (!res.ok) throw new Error("Upload failed (HTTP " + res.status + ")");

  const data = await res.json().catch(() => ({}));

  // support common shapes:
  // { url: "/uploads/x.png" } OR { path: "/uploads/x.png" } OR { file: "x.png" }
  const raw =
    data.url ||
    data.path ||
    data.location ||
    (data.file ? `/uploads/${data.file}` : "");

  return raw;
}

function unpackFirstItem(payload) {
  if (!payload) return null;
  if (Array.isArray(payload)) return payload[0] || null;
  if (Array.isArray(payload.items)) return payload.items[0] || null;
  if (Array.isArray(payload.records)) return payload.records[0] || null;
  return payload;
}

function getIdFromSave(payload, fallbackId = null) {
  const rec = unpackFirstItem(payload);
  return rec?._id || rec?.id || fallbackId;
}

// helper to POST/PUT a section record
async function saveSectionRecord({ id, name, courseId, imageUrl }) {
  if (!courseId) throw new Error("No courseId – save or select a course first.");

  const values = {
    "Section Name": name,
    "Name": name,
    "Section Title": name,
    "Title": name,
    "Course": { _id: courseId },
  };

  // ✅ only set if provided (prevents wiping)
  if (typeof imageUrl === "string" && imageUrl.trim()) {
    values[SECTION_IMAGE_KEY] = imageUrl.trim();
  }

  let url, method;
  if (id) {
    url = `/api/records/${encodeURIComponent(SECTION_TYPE)}/${id}`;
    method = "PATCH";
  } else {
    url = `/api/records/${encodeURIComponent(SECTION_TYPE)}`;
    method = "POST";
  }

  return await window.fetchJSON(url, {
    method,
    body: JSON.stringify({ values }),
  });
}


// 🔹 Lessons
const LESSON_TYPE = 'Course Lesson';   // must match your DataType name exactly
// 🔐 Save only the "Lesson Locked" flag for a lesson
async function saveLessonLockState(lessonId, locked) {
  if (!lessonId) {
    console.warn('[lessons] no lessonId; cannot save lock state');
    return;
  }

  const url = `/api/records/${encodeURIComponent(LESSON_TYPE)}/${lessonId}`;

  const payload = {
    values: {
      'Lesson Locked': !!locked,
    },
  };

  console.log('[lessons] saving lock state', payload);

  const res = await fetch(url, {
    method: 'PATCH',             // use PATCH or PUT depending on your API
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    credentials: 'include',
  });

  if (!res.ok) {
    throw new Error('HTTP ' + res.status);
  }

  const data = await res.json();
  console.log('[lessons] lock state saved OK', data);
  return data;
}

//Lesson Visibility
// 👁 Save only the "Visible" flag for a lesson
async function saveLessonVisibleState(lessonId, visible) {
  if (!lessonId) {
    console.warn('[lessons] no lessonId; cannot save visible state');
    return;
  }

  const url = `/api/records/${encodeURIComponent(LESSON_TYPE)}/${lessonId}`;

  const payload = {
    values: {
      'Visible': !!visible, // ✅ same field name you're using for sections
    },
  };

  console.log('[lessons] saving visible state', payload);

  const res = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    credentials: 'include',
  });

  if (!res.ok) throw new Error('HTTP ' + res.status);

  const data = await res.json();
  console.log('[lessons] visible state saved OK', data);
  return data;
}


// helper to CREATE / UPDATE a lesson record
async function saveLessonRecord({
  id,
  name,
  sectionId,
  courseId,
  description,
  blocks,
  chapters,
}) {
  if (!sectionId) {
    throw new Error('No sectionId – save or select a section first.');
  }
  if (!courseId) {
    throw new Error('No courseId – save or select a course first.');
  }

 const values = {
  'Lesson Name': name,
  'Course':  { _id: courseId },
  'Section': { _id: sectionId },
  
};

// only set these if caller provided them (prevents wiping)
if (typeof description === 'string') values['Lesson Description'] = description;
if (blocks !== undefined)  values['Lesson Blocks']   = JSON.stringify(blocks || []);
if (chapters !== undefined) values['Lesson Chapters'] = JSON.stringify(chapters || []);


  let url, method;
  if (id) {
    // 🔁 update existing record
    url = `/api/records/${encodeURIComponent(LESSON_TYPE)}/${id}`;
    method = 'PATCH'; // matches your server route
  } else {
    // 🆕 create new record
    url = `/api/records/${encodeURIComponent(LESSON_TYPE)}`;
    method = 'POST';
  }

  const saved = await window.fetchJSON(url, {
    method,
    body: JSON.stringify({ values }),
    // if your fetchJSON doesn't add headers automatically, uncomment:
    // headers: { 'Content-Type': 'application/json' },
  });

  return saved;
}

// ✅ build a lesson row
function createLessonRow(name = "", options = {}) {
  const {
    id = null,
    sectionId = null,
    locked = false,
    visible = true,
  } = options;

  const row = document.createElement("div");
  row.className = "outline-lesson-row";
  row.classList.toggle("is-hidden", !visible);

  if (id) row.dataset.lessonId = id;
  if (sectionId) row.dataset.sectionId = sectionId;

  // left: lesson name input
  const input = document.createElement("input");
  input.type = "text";
  input.className = "outline-lesson-input";
  input.placeholder = "Lesson name";
  input.value = name;

  // right: actions
  const actions = document.createElement("div");
  actions.className = "outline-lesson-actions";

  // 🔒 lock toggle
  const lockBtn = document.createElement("button");
  lockBtn.type = "button";
  lockBtn.className = "btn ghost btn-xs outline-lesson-lock";
  lockBtn.textContent = locked ? "🔒" : "🔓";
  lockBtn.title = locked ? "Lesson is locked" : "Lesson is unlocked";
  lockBtn.dataset.locked = locked ? "1" : "0";

  lockBtn.addEventListener("click", async (e) => {
    e.stopPropagation();

    const lessonId = row.dataset.lessonId;
    if (!lessonId) {
      alert("Save the lesson first, then you can lock it.");
      return;
    }

    const nextLocked = lockBtn.dataset.locked !== "1";
    lockBtn.dataset.locked = nextLocked ? "1" : "0";
    lockBtn.textContent = nextLocked ? "🔒" : "🔓";
    lockBtn.title = nextLocked ? "Lesson is locked" : "Lesson is unlocked";

    try {
      await saveLessonLockState(lessonId, nextLocked);
    } catch (err) {
      console.error("[lesson] lock save failed", err);
      alert("Could not save lock state.");
    }
  });

  // 👁 visible toggle  ✅ (THIS MUST BE OUTSIDE lockBtn listener)
  const eyeBtn = document.createElement("button");
  eyeBtn.type = "button";
  eyeBtn.className = "btn ghost btn-xs outline-lesson-eye";
  eyeBtn.textContent = visible ? "👁" : "🚫";
  eyeBtn.title = visible ? "Lesson is visible" : "Lesson is hidden";
  eyeBtn.dataset.visible = visible ? "1" : "0";

  eyeBtn.addEventListener("click", async (e) => {
    e.stopPropagation();

    const lessonId = row.dataset.lessonId;
    if (!lessonId) {
      alert("Save the lesson first, then you can hide/show it.");
      return;
    }

    const nextVisible = eyeBtn.dataset.visible !== "1";
    eyeBtn.dataset.visible = nextVisible ? "1" : "0";
    eyeBtn.textContent = nextVisible ? "👁" : "🚫";
    eyeBtn.title = nextVisible ? "Lesson is visible" : "Lesson is hidden";

    row.classList.toggle("is-hidden", !nextVisible);

    try {
      await saveLessonVisibleState(lessonId, nextVisible);
    } catch (err) {
      console.error("[lesson] visible save failed", err);
      alert("Could not save visibility.");
    }
  });

  // ✏️ edit
  const editBtn = document.createElement("button");
  editBtn.type = "button";
  editBtn.className = "btn ghost btn-xs outline-lesson-edit";
  editBtn.textContent = "Edit";

  editBtn.addEventListener("click", (e) => {
    e.stopPropagation();

    const lessonId = row.dataset.lessonId || "";
    const sid = row.dataset.sectionId || sectionId || "";

    openLessonDetail({
      lessonId,
      sectionId: sid,
      name: (input.value || "").trim(),
    });
  });

  actions.appendChild(lockBtn);
  actions.appendChild(eyeBtn);
  actions.appendChild(editBtn);

  row.appendChild(input);
  row.appendChild(actions);

  // ✅ Save on blur (simple + reliable)
  input.addEventListener("blur", async () => {
    const value = (input.value || "").trim();
    if (!value) return;

    const sid = row.dataset.sectionId || sectionId;
    if (!sid) {
      alert("Save the section first, then add lessons.");
      return;
    }
    if (!currentCourseId) {
      alert("Save/select a course first.");
      return;
    }

    try {
      const existingId = row.dataset.lessonId || null;

      const saved = await saveLessonRecord({
        id: existingId,
        name: value,
        sectionId: sid,
        courseId: currentCourseId,

        // ✅ don't wipe
        description: undefined,
        blocks: undefined,
        chapters: undefined,
      });

      const newId = getIdFromSave(saved, existingId);
      if (newId) row.dataset.lessonId = String(newId);

      if (newId) {
        try {
          await saveLessonOrderToDB(String(sid));
        } catch (e) {
          console.warn("[lessons] could not save lesson order", e);
        }
      }
    } catch (err) {
      console.error("[lesson] save failed", err);
      alert("Could not save lesson: " + (err?.message || err));
    }
  });

  return row;
}


//Delete Section
async function deleteSectionRecord(sectionId) {
  if (!sectionId) return;

  const url = `/api/records/${encodeURIComponent(SECTION_TYPE)}/${encodeURIComponent(sectionId)}`;

  const res = await fetch(url, {
    method: "DELETE",
    credentials: "include",
  });

  // if your server returns JSON, you can read it, but not required
  if (!res.ok) throw new Error("HTTP " + res.status);
}

//Also delete all lessons in that section if you want to avoid “ghost lessons” in the database:
async function deleteLessonsForSection(sectionId) {
  if (!sectionId) return;

  // Load lessons
  const params = new URLSearchParams();
  params.set("dataType", LESSON_TYPE);
  params.set("limit", "500");
  if (currentCourseId) params.set("Course", currentCourseId);

  const res = await fetch(`${API_ORIGIN}/public/records?${params.toString()}`, {
    credentials: "include",
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error("HTTP " + res.status);

  const data = await res.json();
  const rows = Array.isArray(data) ? data : data.records || data.items || [];

  // Filter lessons that reference this section
  const lessonIds = rows
    .filter((rec) => {
      const v = rec.values || {};
      const sectionRef = v["Section"];
      const refId = sectionRef?._id || sectionRef?.id || sectionRef;
      return String(refId) === String(sectionId);
    })
    .map((rec) => rec._id || rec.id)
    .filter(Boolean);

  // Delete each lesson
  for (const id of lessonIds) {
    const url = `/api/records/${encodeURIComponent(LESSON_TYPE)}/${encodeURIComponent(id)}`;
    const delRes = await fetch(url, { method: "DELETE", credentials: "include" });
    if (!delRes.ok) throw new Error("Failed deleting lesson " + id + " (HTTP " + delRes.status + ")");
  }
}

// 🔹 build a section row
function createSectionRow(name = "", options = {}) {
  const {
    id = null,
    startLocked = false,
    imageUrl = "",
    locked = false,
    visible = true,
  } = options;

  const row = document.createElement("div");
  row.className = "outline-section-row";
  row.classList.toggle("is-hidden", !visible);

  if (id) row.dataset.sectionId = id;

  // ✅ ADD THESE RIGHT HERE
  row.dataset.sectionLocked = locked ? "1" : "0";
  row.dataset.sectionVisible = visible ? "1" : "0";

  row.classList.toggle("is-hidden", row.dataset.sectionVisible === "0");
row.classList.toggle("is-section-locked", row.dataset.sectionLocked === "1");
  // make row draggable
  row.draggable = true;


  // --- HEADER (drag + title + actions) --------------------
  const header = document.createElement("div");
  header.className = "outline-section-header";

  // drag handle
  const drag = document.createElement("button");
  drag.type = "button";
  drag.className = "outline-drag";
  drag.setAttribute("aria-label", "Reorder section");
  drag.draggable = true;
  drag.innerHTML = `
    <span class="dot-row"><span class="dot"></span><span class="dot"></span></span>
    <span class="dot-row"><span class="dot"></span><span class="dot"></span></span>
    <span class="dot-row"><span class="dot"></span><span class="dot"></span></span>
  `;

  // main (title input)
  const main = document.createElement("div");
  main.className = "outline-section-main";

  const input = document.createElement("input");
  input.type = "text";
  input.className = "outline-section-input";
  input.placeholder = "Section Name";
  input.value = name;

  // ✅ Section Image UI (preview + upload)
  const imgWrap = document.createElement("div");
  imgWrap.className = "outline-section-imgWrap";

  const imgPreview = document.createElement("button");
  imgPreview.type = "button";
  imgPreview.className = "outline-section-imgPreview";
  imgPreview.innerHTML = `<span class="muted">Add image</span>`;

  const imgInput = document.createElement("input");
  imgInput.type = "file";
  imgInput.accept = "image/*";
  imgInput.hidden = true;

  // ✅ DO NOT wipe it here — only set if we actually have something
  if (imageUrl) row.dataset.sectionImage = String(imageUrl);

  // ✅ THIS is where the hydration block goes (imgPreview exists now)
  if (row.dataset.sectionImage) {
    const src = resolveAssetUrl(row.dataset.sectionImage);
    imgPreview.innerHTML = `<img src="${src}" alt="Section image">`;
  }

  imgPreview.addEventListener("click", () => imgInput.click());

  imgInput.addEventListener("change", async () => {
    const file = imgInput.files?.[0];
    if (!file) return;

    try {
      imgPreview.innerHTML = `<span class="muted">Uploading...</span>`;

      const uploaded = await uploadSectionImage(file); // returns "/uploads/.."
      row.dataset.sectionImage = uploaded;

      const src = resolveAssetUrl(uploaded);
      imgPreview.innerHTML = `<img src="${src}" alt="Section image">`;

      // ✅ if section already saved, immediately PATCH image
      const sectionId = row.dataset.sectionId;
      if (sectionId) {
        await saveSectionRecord({
          id: sectionId,
          name: (input.value || "").trim() || "Section",
          courseId: currentCourseId,
          imageUrl: uploaded,
        });
      }
    } catch (e) {
      console.error("[section image] upload failed", e);
      imgPreview.innerHTML = `<span class="muted">Upload failed</span>`;
      alert("Could not upload section image.");
    } finally {
      imgInput.value = "";
    }
  });

  imgWrap.appendChild(imgPreview);
  imgWrap.appendChild(imgInput);

  // ✅ Append image UI + input
  main.appendChild(imgWrap);
  main.appendChild(input);

  // actions on the right
  const actions = document.createElement("div");
  actions.className = "outline-section-actions";

  header.appendChild(drag);
  header.appendChild(main);
  header.appendChild(actions);

  row.appendChild(header);

  // --- LESSONS AREA (list + add button) -------------------
  const lessonsWrap = document.createElement("div");
  lessonsWrap.className = "outline-lessons-wrap";

  const lessonsList = document.createElement("div");
  lessonsList.className = "outline-lessons-list";

  const addLessonBtn = document.createElement("button");
  addLessonBtn.type = "button";
  addLessonBtn.className = "btn ghost btn-sm";
  addLessonBtn.textContent = "+ Add lesson";

  lessonsWrap.appendChild(lessonsList);
  lessonsWrap.appendChild(addLessonBtn);
  row.appendChild(lessonsWrap);

  if (row.dataset.sectionId) {
    addLessonBtn.dataset.sectionId = row.dataset.sectionId;
  }

  let originalName = name;


  // --------- LOAD LESSONS FOR THIS SECTION ----------------
  //Helper
  // --- helpers: read + save order to Mongo (NO localStorage) ---

async function getSectionLessonOrderFromDB(sectionId) {
  if (!sectionId) return [];
  try {
    const sec = await window.fetchJSON(`/api/records/${encodeURIComponent(SECTION_TYPE)}/${encodeURIComponent(sectionId)}`);
    const v = sec?.values || {};
    const order = v["Lesson Order"] || v["lessonOrder"] || [];
    return Array.isArray(order) ? order.map(String) : [];
  } catch (e) {
    console.warn("[lessons] could not read Lesson Order from DB", e);
    return [];
  }
}

async function saveLessonOrderToDB(sectionId) {
  if (!sectionId) return;

  const rowEl = sectionsWrap?.querySelector(`.outline-section-row[data-section-id="${CSS.escape(String(sectionId))}"]`)
    || sectionsWrap?.querySelector(`.outline-section-row[data-sectionid="${CSS.escape(String(sectionId))}"]`);

  // safer: just find by dataset match
  const sectionRow =
    Array.from(sectionsWrap?.querySelectorAll(".outline-section-row") || []).find(r => String(r.dataset.sectionId) === String(sectionId));

  const lessonsList = sectionRow?.querySelector(".outline-lessons-list");
  if (!lessonsList) return;

  const lessonIds = Array.from(lessonsList.querySelectorAll(".outline-lesson-row"))
    .map(r => r.dataset.lessonId)
    .filter(Boolean)
    .map(String);

  await window.fetchJSON(`/api/records/${encodeURIComponent(SECTION_TYPE)}/${encodeURIComponent(sectionId)}`, {
    method: "PATCH",
    body: JSON.stringify({
      values: {
        "Lesson Order": lessonIds,
      },
    }),
  });
}

  async function loadLessonsForThisSection(sectionId) {
    if (!sectionId) return;

    try {
      const params = new URLSearchParams();
      params.set("dataType", LESSON_TYPE); // e.g. "Course Lesson"
      params.set("limit", "200");

      if (currentCourseId) {
        params.set("Course", currentCourseId);
      }

      const url = `${API_ORIGIN}/public/records?${params.toString()}`;

      const res = await fetch(url, {
        credentials: "include",
        headers: { Accept: "application/json" },
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      const rows = Array.isArray(data) ? data : data.records || data.items || [];

      // filter by Section reference
   let filtered = rows.filter((rec) => {
  const v = rec.values || {};
  const sectionRef = v["Section"];
  if (!sectionRef) return false;

  const refId = sectionRef?._id || sectionRef?.id || sectionRef;
  return String(refId) === String(sectionId);
});


    // ✅ apply saved order from DB (Section -> "Lesson Order")
const orderIds = await getSectionLessonOrderFromDB(sectionId);

if (orderIds.length) {
  const orderMap = new Map(orderIds.map((id, idx) => [String(id), idx]));
  filtered.sort((a, b) => {
    const aId = String(a._id || a.id || "");
    const bId = String(b._id || b.id || "");
    return (orderMap.get(aId) ?? 9999) - (orderMap.get(bId) ?? 9999);
  });
}


      // ✅ render into THIS row's lessonsList (not a global one)
      lessonsList.innerHTML = "";
      filtered.forEach((rec) => {
        const v = rec.values || {};
        const lessonName = v["Lesson Name"] || v.Name || "";
        const lessonId = rec._id || rec.id;
  const locked = !!v["Lesson Locked"];
const visible = (v.Visible !== false); // ✅ default true

const lRow = createLessonRow(lessonName, { id: lessonId, locked, visible, sectionId });
lessonsList.appendChild(lRow);

      });


    } catch (err) {
      console.error("[outline] load lessons failed", err);
    }
  }

  // ✅ Add lesson button should ONLY work when section is saved
  addLessonBtn.addEventListener("click", () => {
    const sectionId = row.dataset.sectionId || addLessonBtn.dataset.sectionId;

    if (!sectionId) {
      alert("Save the section first, then add lessons.");
      return;
    }

    const lRow = createLessonRow("", { id: null, sectionId }); // pass sectionId if your save needs it
    lessonsList.appendChild(lRow);

    const lInput = lRow.querySelector("input");
    if (lInput) lInput.focus();
  });

  // --------- MODE HELPERS (VIEW / EDIT) -------------------
function switchToViewMode() {
  input.readOnly = true;
  input.classList.add("is-locked");
  actions.innerHTML = "";

  const edit = document.createElement("button");
  edit.type = "button";
  edit.className = "btn ghost btn-sm";
  edit.textContent = "Edit";
  edit.addEventListener("click", () => {
    switchToEditMode();
    input.focus();
  });

  const del = document.createElement("button");
  del.type = "button";
  del.className = "btn danger btn-sm";
  del.textContent = "Delete";

  del.addEventListener("click", async (e) => {
  e.stopPropagation();

  const sectionId = row.dataset.sectionId || "";
  const ok = confirm("Delete this section? This will remove its lessons too.");
  if (!ok) return;

  try {
    // ✅ If not saved yet, just remove UI and stop
    if (!sectionId) {
      row.remove();
      updateEmptyNoteVisibility?.();
      return;
    }

    // ✅ remove from UI first
    row.remove();
    updateEmptyNoteVisibility?.();

    // ✅ delete from DB
    await deleteLessonsForSection(sectionId);
    await deleteSectionRecord(sectionId);

    // ✅ keep order clean
    if (currentCourseId) {
      persistSectionsForCourse(currentCourseId);
      await saveSectionOrderToDB(currentCourseId);
    }
  } catch (err) {
    console.error("[sections] delete failed", err);
    alert("Could not delete section: " + (err?.message || err));
  }
});


  actions.appendChild(edit);
  actions.appendChild(del);
}


  function switchToEditMode() {
    input.readOnly = false;
    input.classList.remove("is-locked");
    actions.innerHTML = "";

    originalName = input.value;

    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = "btn ghost btn-sm";
    cancel.textContent = "Cancel";

    const save = document.createElement("button");
    save.type = "button";
    save.className = "btn peach btn-sm";
    save.textContent = "Save";

    const lockBtn = document.createElement("button");
lockBtn.type = "button";
lockBtn.className = "btn ghost btn-sm";
lockBtn.title = "Lock/unlock this section";
lockBtn.textContent = (row.dataset.sectionLocked === "1") ? "🔒" : "🔓";

lockBtn.addEventListener("click", async (e) => {
  e.stopPropagation();

  const sectionId = row.dataset.sectionId;
  if (!sectionId) {
    alert("Save the section first, then you can lock it.");
    return;
  }

  const nextLocked = row.dataset.sectionLocked !== "1";
  row.dataset.sectionLocked = nextLocked ? "1" : "0";
  lockBtn.textContent = nextLocked ? "🔒" : "🔓";

  try {
    await saveSectionLockState(sectionId, nextLocked);
  } catch (err) {
    console.error("[section] lock save failed", err);
    alert("Could not save section lock state.");
  }
});

const eyeBtn = document.createElement("button");
eyeBtn.type = "button";
eyeBtn.className = "btn ghost btn-sm";
eyeBtn.title = "Show/hide this section";
eyeBtn.textContent = (row.dataset.sectionVisible === "1") ? "👁" : "🚫";

eyeBtn.addEventListener("click", async (e) => {
  e.stopPropagation();

  const sectionId = row.dataset.sectionId;
  if (!sectionId) {
    alert("Save the section first, then you can change visibility.");
    return;
  }

  const nextVisible = row.dataset.sectionVisible !== "1";
  row.dataset.sectionVisible = nextVisible ? "1" : "0";
  eyeBtn.textContent = nextVisible ? "👁" : "🚫";

  try {
    await saveSectionVisibility(sectionId, nextVisible);
  } catch (err) {
    console.error("[section] visibility save failed", err);
    alert("Could not save section visibility.");
  }
});

actions.appendChild(lockBtn);
actions.appendChild(eyeBtn);
actions.appendChild(cancel);
actions.appendChild(save);


    cancel.addEventListener("click", () => {
      if (row.dataset.sectionId) {
        input.value = originalName;
        switchToViewMode();
      } else {
        row.remove();
        if (typeof updateEmptyNoteVisibility === "function") {
          updateEmptyNoteVisibility();
        }
      }
    });

    save.addEventListener("click", async () => {
      const value = input.value.trim();
      if (!value) {
        alert("Please enter a section name.");
        input.focus();
        return;
      }

      if (!currentCourseId) {
        alert("Save/select the course first so sections can be linked to it.");
        return;
      }

      try {
        const existingId = row.dataset.sectionId || null;

      const saved = await saveSectionRecord({
  id: existingId,
  name: value,
  courseId: currentCourseId,
  imageUrl: row.dataset.sectionImage || "", // ✅ ADD THIS
});


       const newId = getIdFromSave(saved, existingId);


        // ✅ store the sectionId on the row
        row.dataset.sectionId = newId;

        // ✅ store the sectionId on the Add Lesson button
        addLessonBtn.dataset.sectionId = newId;

        originalName = value;

       // keep local order
persistSectionsForCourse(currentCourseId);

// ✅ ALSO persist the order to DB (so refresh keeps it)
await saveSectionOrderToDB(currentCourseId);

// ✅ now that the section has an id, load its lessons
await loadLessonsForThisSection(newId);

switchToViewMode();

      } catch (err) {
        console.error("[outline] save section failed", err);
        alert("Could not save section: " + (err.message || err));
      }
    });
  }

  // start mode
  if (startLocked) {
    switchToViewMode();
  } else {
    switchToEditMode();
  }

  if (row.dataset.sectionId) {
  loadLessonsForThisSection(row.dataset.sectionId);
}

  // ✅ If section already exists, load lessons immediately
  if (row.dataset.sectionId) {
    loadLessonsForThisSection(row.dataset.sectionId);
  }

  return row;
}






//Move sections 
function readSectionsFromDOM() {
  if (!sectionsWrap) return [];
  const rows = sectionsWrap.querySelectorAll('.outline-section-row');

  return Array.from(rows).map(row => {
    const input = row.querySelector('.outline-section-input');
    return {
      id: row.dataset.sectionId || null,              // 🔹 keep section id
      title: (input?.value || '').trim(),
    };
  });
}

function persistSectionsForCourse(courseId) {
  if (!courseId || !sectionsWrap) return;
  const key = `ss_course_sections_${courseId}`;
  const list = readSectionsFromDOM();
  localStorage.setItem(key, JSON.stringify(list));
}

let dragSrcRow = null;

sectionsWrap?.addEventListener('dragstart', (e) => {
  const row = e.target.closest('.outline-section-row');
  if (!row) return;
  dragSrcRow = row;
  row.classList.add('is-dragging');

  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', '');
  }
});

sectionsWrap?.addEventListener('dragover', (e) => {
  e.preventDefault(); // allow drop

  const targetRow = e.target.closest('.outline-section-row');
  if (!targetRow || !dragSrcRow || targetRow === dragSrcRow) return;

  const rect = targetRow.getBoundingClientRect();
  const offset = e.clientY - rect.top;

  const insertBefore = offset < rect.height / 2;

  if (insertBefore) {
    sectionsWrap.insertBefore(dragSrcRow, targetRow);
  } else {
    sectionsWrap.insertBefore(dragSrcRow, targetRow.nextSibling);
  }
});

sectionsWrap?.addEventListener("drop", async (e) => {
  e.preventDefault();
  if (!dragSrcRow) return;

  dragSrcRow.classList.remove("is-dragging");
  dragSrcRow = null;

  if (currentCourseId) {
    // keep local (optional)
    persistSectionsForCourse(currentCourseId);

    // ✅ persist to DB (this is the real fix)
    try {
      await saveSectionOrderToDB(currentCourseId);
    } catch (err) {
      console.error("[sections] save order failed", err);
      alert("Couldn't save section order. Try again.");
    }
  }
});


sectionsWrap?.addEventListener('dragend', () => {
  if (dragSrcRow) {
    dragSrcRow.classList.remove('is-dragging');
    dragSrcRow = null;
  }
});

function getSectionOrderFromDOM() {
  if (!sectionsWrap) return [];
  const rows = Array.from(sectionsWrap.querySelectorAll(".outline-section-row"));

  // only saved sections can be ordered in DB
  return rows
    .map((row, idx) => ({
      id: row.dataset.sectionId || null,
      order: idx,
    }))
    .filter((x) => x.id);
}

async function saveSectionOrderToDB(courseId) {
  if (!courseId) return;
  const ordered = getSectionOrderFromDOM();
  if (!ordered.length) return;

  // update each section with its new order
  await Promise.all(
    ordered.map(({ id, order }) => {
      const url = `/api/records/${encodeURIComponent(SECTION_TYPE)}/${encodeURIComponent(id)}`;
      return window.fetchJSON(url, {
        method: "PATCH",
        body: JSON.stringify({
          values: {
            "Section Order": order,
            // optional: also store course ref to be safe
            "Course": { _id: courseId },
          },
        }),
      });
    })
  );
}

//
  function updateEmptyNoteVisibility() {
    if (!sectionsWrap || !emptyNote) return;
    const hasRows = !!sectionsWrap.querySelector('.outline-section-row');
    emptyNote.style.display = hasRows ? 'none' : '';
  }

  // Add Section on click
addSectionBtn?.addEventListener('click', () => {
  if (!sectionsWrap) return;

  if (!currentCourseId) {
    alert('Save or select a course before adding sections.');
    return;
  }

  const row = createSectionRow('', { currentCourseIdRef: () => currentCourseId });
  sectionsWrap.appendChild(row);

  if (typeof updateEmptyNoteVisibility === 'function') {
    updateEmptyNoteVisibility();
  }

  const input = row.querySelector('input');
  if (input) input.focus();
});

  // (optional) call this once on load
  updateEmptyNoteVisibility();

// fetch sections for a given course from /public/records
async function listSectionsForCourse(courseId) {
  if (!courseId) return [];

  const params = new URLSearchParams();
  params.set('dataType', SECTION_TYPE); // "Course Section"
  params.set('limit', '200');
  params.set('Course', courseId);       // field name "Course" on Course Section

  const res = await fetch(
    `${API_ORIGIN}/public/records?${params.toString()}`,
    {
      credentials: 'include',
      headers: { Accept: 'application/json' },
    }
  );

  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const data = await res.json();
  const rows = Array.isArray(data)
    ? data
    : data.records || data.items || [];

  return rows.map((row) => {
    const v = row.values || row;
    return {
      id: row._id || row.id || '',
      name: v['Section Name'] || v.Name || '',
    };
  });
}

// render all sections for the current course
function unpackRows(payload) {
  if (Array.isArray(payload)) return payload;
  return payload?.items || payload?.records || payload?.rows || [];
}

async function hydrateSectionsForCourse(courseId) {
  if (!sectionsWrap || !courseId) return;

  sectionsWrap.innerHTML = "";

  const params = new URLSearchParams();
  params.set("dataType", SECTION_TYPE);
  params.set("limit", "200");
  params.set("Course", courseId);
  params.set("ts", String(Date.now())); // cache buster

  const url = `${API_ORIGIN}/public/records?${params.toString()}`;
  console.log("[outline] sections url:", url);

  try {
    const res = await fetch(url, {
      credentials: "include",
      headers: { Accept: "application/json" },
    });

    if (!res.ok) {
      console.warn("[outline] sections fetch failed:", res.status);
      if (emptyNote) emptyNote.hidden = false;
      return;
    }

    const data = await res.json().catch(() => null);
const rows = Array.isArray(data) ? data : (data?.items || data?.records || []);

// ✅ filter to ONLY this course (client-side safety)
const filteredByCourse = rows.filter((rec) => {
  const v = rec?.values || {};
 const courseRef = v["Course"] || rec?.Course || rec?.course || null;

  const refId = courseRef?._id || courseRef?.id || courseRef;
  return String(refId) === String(courseId);
});

// ✅ DEBUG (optional)
window.__secRows = rows;
window.__secRowsFiltered = filteredByCourse;

// ✅ filter out soft-deleted / hidden rows
function isActiveSection(rec) {
  const v = rec?.values || {};
  const deletedAt = rec?.deletedAt || v?.deletedAt || v?.DeletedAt || null;

  if (deletedAt) return false;
// keep hidden sections visible in settings so creator can toggle them back on
// (public page will still hide them)

  if (v.Archived === true) return false;
  if ((v.Status || "").toLowerCase() === "deleted") return false;

  return true;
}

// ✅ IMPORTANT: filter AFTER course filter
const activeRows = filteredByCourse.filter(isActiveSection);

// ✅ DEBUG (optional)
window.__activeSecRows = activeRows;


console.log("[outline] sections raw:", rows.length, "active:", activeRows.length);
console.table(
  activeRows.map((s) => {
    const v = s?.values || {};
    return {
      id: String(s._id || s.id),
      title: v["Section Name"] || v["Title"] || v["Name"] || "",
      Visible: v.Visible,
      deletedAt: s.deletedAt || v.deletedAt || null,
      Status: v.Status || "",
   Course: (v["Course"] && (v["Course"]._id || v["Course"].id)) || v["Course"] || "",

    };
  })
);

  // sort by saved order
activeRows.sort((a, b) => {
  const av = a?.values || {};
  const bv = b?.values || {};

  const ao = Number(av["Section Order"]);
  const bo = Number(bv["Section Order"]);

  const aNum = Number.isFinite(ao) ? ao : 999999;
  const bNum = Number.isFinite(bo) ? bo : 999999;

  return aNum - bNum;
});

console.log("[outline] sections rows:", activeRows);

if (!activeRows.length) {
  if (emptyNote) emptyNote.hidden = false;
  return;
}

if (emptyNote) emptyNote.hidden = true;

activeRows.forEach((secRow, idx) => {
  const id = String(secRow?._id || secRow?.id || "");
  const v = secRow?.values || {};

  const title =
    v["Section Name"] ||
    v["Section Title"] ||
    v["Name"] ||
    v["Title"] ||
    `Section ${idx + 1}`;

  // ✅ GET THE IMAGE VALUE YOU SAVED IN MONGO
  const imageRaw =
    v["Section Image"] ||  // <-- this is the main one
    v["Image"] ||
    v["Thumbnail"] ||
    "";

  // ✅ PASS IT INTO createSectionRow
const locked = !!v["Section Locked"];
const visible = (v.Visible !== false); // default true

const rowEl = createSectionRow(title, {
  id,
  startLocked: true,
  imageUrl: imageRaw,
  locked,
  visible,
});

sectionsWrap.appendChild(rowEl);

});



    if (typeof updateEmptyNoteVisibility === "function") {
      updateEmptyNoteVisibility();
    }
  } catch (err) {
    console.error("[outline] hydrateSectionsForCourse failed", err);
    if (emptyNote) emptyNote.hidden = false;
  }
}

//Lock Section 
// 🔐 Save "Section Locked"
async function saveSectionLockState(sectionId, locked) {
  if (!sectionId) return;

  const url = `/api/records/${encodeURIComponent(SECTION_TYPE)}/${encodeURIComponent(sectionId)}`;

  return await window.fetchJSON(url, {
    method: "PATCH",
    body: JSON.stringify({
      values: { "Section Locked": !!locked }
    }),
  });
}

// 👁 Save "Visible"
async function saveSectionVisibility(sectionId, visible) {
  if (!sectionId) return;

  const url = `/api/records/${encodeURIComponent(SECTION_TYPE)}/${encodeURIComponent(sectionId)}`;

  return await window.fetchJSON(url, {
    method: "PATCH",
    body: JSON.stringify({
      values: { "Visible": !!visible }
    }),
  });
}














                                     // =======================
                                     // Lesson Section (EDITED)
                                     // =======================

// ✅ cards/panels to toggle
const coursesDetailsCard = document.getElementById("courses-details");     // Course details card
const outlinePanel       = document.getElementById("courses-outline");     // Course outline card
const lessonDetailPanel  = document.getElementById("lesson-detail-panel"); // Lesson detail panel

// ✅ lesson detail fields
const lessonDetailTitle     = document.getElementById("lesson-detail-title");
const lessonDetailName      = document.getElementById("lesson-detail-name");
const lessonDetailDesc      = document.getElementById("lesson-detail-description");
const lessonDetailLessonId  = document.getElementById("lesson-detail-lesson-id");
const lessonDetailSectionId = document.getElementById("lesson-detail-section-id");
const lessonDetailBack      = document.getElementById("lesson-detail-back");

const dropZone        = document.getElementById("lesson-drop-zone");
const chapterDropZone = document.getElementById("chapter-drop-zone");
const palettes        = Array.from(document.querySelectorAll(".lesson-block-palette"));
const lessonDetailSave = document.getElementById("lesson-detail-save");

// ---------------------------
// LESSON toggle
// ---------------------------
const lessonPanel  = document.getElementById("lesson-detail-panel");
const lessonBody   = document.getElementById("lesson-body");
const lessonToggle = document.getElementById("lesson-toggle");
const lOpen        = lessonToggle?.querySelector(".icon-open");
const lClosed      = lessonToggle?.querySelector(".icon-closed");

if (lessonToggle && lessonBody) {
  lessonToggle.addEventListener("click", () => {
    const isOpen = !lessonBody.hidden;
    lessonBody.hidden = isOpen;

    if (lOpen) lOpen.hidden = isOpen;
    if (lClosed) lClosed.hidden = !isOpen;

    lessonToggle.setAttribute("aria-expanded", String(!isOpen));
  });
}



// -----------------------
// Panel show/hide helpers
// -----------------------
function showLessonPanel() {
  // hide both builder cards
  if (coursesDetailsCard) coursesDetailsCard.hidden = true;
  if (outlinePanel) outlinePanel.hidden = true;

  // show lesson details
  if (lessonDetailPanel) lessonDetailPanel.style.display = "block";

  window.scrollTo({ top: 0, behavior: "smooth" });
}

function showOutlinePanel() {
  // hide lesson details
  if (lessonDetailPanel) lessonDetailPanel.style.display = "none";

  // show builder cards again
  if (coursesDetailsCard) coursesDetailsCard.hidden = false;
  if (outlinePanel) outlinePanel.hidden = false;

  document
    .getElementById("courses-outline")
    ?.scrollIntoView({ behavior: "smooth", block: "start" });
}


// -----------------------
// Open Lesson Detail
// -----------------------
async function openLessonDetail({ lessonId, sectionId, name }) {
  // ✅ hide outline + course details, show lesson
  showLessonPanel();

  // basic info from the outline row
  if (lessonDetailTitle) lessonDetailTitle.textContent = name || "Lesson details";
  if (lessonDetailName) lessonDetailName.value = name || "";
  if (lessonDetailLessonId) lessonDetailLessonId.value = lessonId || "";
  if (lessonDetailSectionId) lessonDetailSectionId.value = sectionId || "";

  // default: show loading/empty hint
  if (dropZone) {
    dropZone.innerHTML = "";
    const hint = document.createElement("p");
    hint.className = "lesson-drop-hint";
    hint.textContent = lessonId ? "Loading lesson..." : "Drag blocks here";
    dropZone.appendChild(hint);
  }

  // ✅ if lesson isn't saved yet, stop after showing panel
  if (!lessonId) return;

  try {
    const url = `/api/records/${encodeURIComponent(LESSON_TYPE)}/${encodeURIComponent(lessonId)}`;
   const raw = await window.fetchJSON(url);
   const rec =
  (raw && raw.item) ||
  (raw && Array.isArray(raw.items) ? raw.items[0] : null) ||
  (raw && Array.isArray(raw.records) ? raw.records[0] : null) ||
  unpackFirstItem(raw) ||
  raw;
const vals = rec?.values || {};


    // lock state
    const isLocked = !!vals["Lesson Locked"];
    window.CURRENT_LESSON_LOCKED = isLocked;

    // refresh name/desc from saved record
    const savedName = vals["Lesson Name"] || name || "";
    if (lessonDetailTitle) lessonDetailTitle.textContent = savedName || "Lesson details";
    if (lessonDetailName) lessonDetailName.value = savedName;

    if (lessonDetailDesc) lessonDetailDesc.value = vals["Lesson Description"] || "";

    // lesson blocks
    let blocks = [];
    if (vals["Lesson Blocks"]) {
      try { blocks = JSON.parse(vals["Lesson Blocks"]); }
      catch (e) { console.error("[lesson] could not parse Lesson Blocks JSON", e); }
    }
    // ✅ IMPORTANT: render saved blocks into the lesson UI
rebuildDropZoneFromBlocks(dropZone, blocks);

    // chapters
    currentLessonChapters = [];
    if (vals["Lesson Chapters"]) {
      try { currentLessonChapters = JSON.parse(vals["Lesson Chapters"]) || []; }
      catch (e) {
        console.error("[lesson] could not parse Lesson Chapters JSON", e);
        currentLessonChapters = [];
      }
    }
    window.LESSON_CHAPTERS = currentLessonChapters;


// ✅ render list, but do NOT auto-open any chapter
renderChaptersList();

// keep chapter detail hidden when lesson first opens
// ✅ SAFE: don't crash if chapter toggle vars aren't defined
const chapterDetailPanelEl = document.getElementById("chapter-detail-panel");
if (chapterDetailPanelEl) chapterDetailPanelEl.style.display = "none";

const chaptersBodyEl = document.getElementById("chapters-body");
const chaptersToggleEl = document.getElementById("chapters-toggle");
const cOpenEl = chaptersToggleEl?.querySelector(".icon-open");
const cClosedEl = chaptersToggleEl?.querySelector(".icon-closed");

// collapse chapters by default (optional)
if (chaptersBodyEl) chaptersBodyEl.hidden = true;
if (cOpenEl) cOpenEl.hidden = true;
if (cClosedEl) cClosedEl.hidden = false;
if (chaptersToggleEl) chaptersToggleEl.setAttribute("aria-expanded", "false");


  } catch (err) {
    console.error("[lesson] load lesson detail failed", err);

    if (dropZone) {
      dropZone.innerHTML = "";
      const hint = document.createElement("p");
      hint.className = "lesson-drop-hint";
      hint.textContent = "Drag blocks here";
      dropZone.appendChild(hint);
    }
  }
}



function closeLessonDetail() {
  showOutlinePanel(); // ✅ restores the outline + course details cards
}


  if (lessonDetailBack) {
    lessonDetailBack.addEventListener('click', closeLessonDetail);
  }



 const dropZones = [dropZone, chapterDropZone].filter(Boolean);

 // ✅ enable drag-to-reorder inside zones
if (dropZone) enableReorderForZone(dropZone);
if (chapterDropZone) enableReorderForZone(chapterDropZone);

if (palettes.length && dropZones.length) {
  // drag FROM any palette
  palettes.forEach((palette) => {
    palette.addEventListener('dragstart', (e) => {
      const blockEl = e.target.closest('.lesson-block');
      if (!blockEl) return;

      const type  = blockEl.dataset.blockType || 'unknown';
      const label = blockEl.querySelector('.lesson-block-label')?.textContent || '';

      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = 'copy';
        e.dataTransfer.setData('text/plain', JSON.stringify({ type, label }));
      }
    });
  });

  // drop INTO any zone (lesson or chapter)
  dropZones.forEach((zone) => {
    zone.addEventListener('dragover', (e) => {
      e.preventDefault();
      zone.classList.add('is-drag-over');
    });

    zone.addEventListener('dragleave', () => {
      zone.classList.remove('is-drag-over');
    });

    zone.addEventListener('drop', (e) => {
      e.preventDefault();
      zone.classList.remove('is-drag-over');

      let data;
      try {
        const raw = e.dataTransfer?.getData('text/plain');
        data = raw ? JSON.parse(raw) : null;
      } catch {
        data = null;
      }
      if (!data) return;

      // ⬇️ your existing block-creation code here (item, minus button, text/video/resource, etc.)
      const item = document.createElement('div');
      item.className = 'lesson-drop-item';

      makeLessonDropItemDraggable(item);

      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'lesson-drop-remove';
      removeBtn.textContent = '−';
      removeBtn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        item.remove();
      });
      item.appendChild(removeBtn);

  if (data.type === "text") {
  const textarea = document.createElement("textarea");
  textarea.className = "lesson-drop-textarea";
  textarea.placeholder = "Text here";

  // ✅ auto-grow as user types
  textarea.addEventListener("input", () => autoGrowTextarea(textarea));

  // ✅ set initial height
  requestAnimationFrame(() => autoGrowTextarea(textarea));

  item.appendChild(textarea);


   } else if (data.type === 'video') {
  const topRow = document.createElement('div');
  topRow.className = 'lesson-video-header';

  const labelSpan = document.createElement('span');
  labelSpan.className = 'lesson-video-label';
  labelSpan.textContent = 'Video';

  const addBtn = document.createElement('button');
  addBtn.type = 'button';
  addBtn.className = 'btn peach btn-xs lesson-video-add-btn';
  addBtn.textContent = 'Add video';

  topRow.appendChild(labelSpan);
  topRow.appendChild(addBtn);

  const config = document.createElement('div');
  config.className = 'lesson-video-config';
  config.style.display = 'none';

  const urlLabel = document.createElement('label');
  urlLabel.className = 'lesson-video-url-label';
  urlLabel.textContent = 'Video URL';

  const urlInput = document.createElement('input');
  urlInput.type = 'text';
  urlInput.className = 'lesson-video-url-input';
  urlInput.placeholder = 'Paste video link (YouTube, Vimeo, etc.)';

  urlLabel.appendChild(urlInput);
  config.appendChild(urlLabel);

  const uploadLabel = document.createElement('label');
  uploadLabel.className = 'lesson-video-url-label';
  uploadLabel.textContent = 'Or upload from your device';

  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = 'video/*';
  fileInput.className = 'lesson-video-file-input';

  uploadLabel.appendChild(fileInput);
  config.appendChild(uploadLabel);

  // ✅ store url on the item so readBlocksFromDropZone() can pick it up
  item.dataset.videoUrl = "";
  item.dataset.videoPoster = "";
  item.dataset.videoName = "";

  // ✅ when file chosen, upload to Cloudinary (video)
  fileInput.addEventListener("change", async () => {
    const f = fileInput.files && fileInput.files[0];
    if (!f) return;

    addBtn.textContent = "Uploading...";
    addBtn.disabled = true;

    try {
      const uploaded = await uploadToCloudinary(f, {
        folder: "suiteseat/course/videos",
        resourceType: "video",
      });

      item.dataset.videoUrl = uploaded.url;
      item.dataset.videoName = f.name;

      // ✅ show preview
      let preview = item.querySelector("video.lesson-video-preview");
      if (!preview) {
        preview = document.createElement("video");
        preview.className = "lesson-video-preview";
        preview.controls = true;
        preview.preload = "metadata";
        preview.style.width = "100%";
        preview.style.borderRadius = "12px";
        preview.style.marginTop = "10px";
        item.appendChild(preview);
      }
      preview.src = uploaded.url;

      // auto-open config once uploaded
      config.style.display = "block";

    } catch (e) {
      alert("Video upload failed: " + (e?.message || e));
      console.error(e);
    } finally {
      addBtn.textContent = "Add video";
      addBtn.disabled = false;
    }
  });

  addBtn.addEventListener('click', () => {
    const isHidden = config.style.display === 'none';
    config.style.display = isHidden ? 'block' : 'none';
  });

  item.appendChild(topRow);
  item.appendChild(config);

} else if (data.type === 'resource') {
  const label = document.createElement('div');
  label.className = 'lesson-resource-label';
  label.textContent = 'Resource';

  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.className = 'lesson-resource-input';
  fileInput.accept = '.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,image/*';

  item.appendChild(label);
  item.appendChild(fileInput);

  // ✅ store url on the item so readBlocksFromDropZone() can pick it up
  item.dataset.resourceUrl = "";
  item.dataset.resourceName = "";

  fileInput.addEventListener("change", async () => {
    const f = fileInput.files && fileInput.files[0];
    if (!f) return;

    item.dataset.resourceName = f.name;

    try {
      const uploaded = await uploadToCloudinary(f, {
        folder: "suiteseat/course/resources",
        resourceType: "raw",
      });

      item.dataset.resourceUrl = uploaded.url;

      // show link
      let link = item.querySelector("a.lesson-resource-link");
      if (!link) {
        link = document.createElement("a");
        link.className = "lesson-resource-link";
        link.target = "_blank";
        link.rel = "noreferrer";
        link.style.display = "inline-block";
        link.style.marginTop = "8px";
        item.appendChild(link);
      }
      link.href = uploaded.url;
      link.textContent = `Open: ${f.name}`;

    } catch (e) {
      alert("Resource upload failed: " + (e?.message || e));
      console.error(e);
    }
  });

} else {
  const span = document.createElement('span');
  span.textContent = data.label || data.type;
  item.appendChild(span);
}


      zone.appendChild(item);
    });
  });
}

//grow text area 
function autoGrowTextarea(el) {
  if (!el) return;
  // reset then grow to fit content
  el.style.height = "auto";
  el.style.height = (el.scrollHeight || 0) + "px";
}

//Reorder lesson 
// =======================
// Reorder blocks in a zone
// =======================
let CURRENT_DRAG_ITEM = null;

function makeLessonDropItemDraggable(item) {
  if (!item) return;
  item.setAttribute("draggable", "true");
  item.classList.add("is-sortable");

  // optional: add a drag handle feel (whole card drags)
  item.addEventListener("dragstart", (e) => {
    CURRENT_DRAG_ITEM = item;
    item.classList.add("is-dragging");

    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", "move-lesson-item");
    }
  });

  item.addEventListener("dragend", () => {
    item.classList.remove("is-dragging");
    CURRENT_DRAG_ITEM = null;
  });
}

function enableReorderForZone(zone) {
  if (!zone) return;

  zone.addEventListener("dragover", (e) => {
    // Only allow reorder when we’re dragging a lesson item
    if (!CURRENT_DRAG_ITEM) return;

    e.preventDefault();
    zone.classList.add("is-drag-over");

    const afterEl = getDragAfterElement(zone, e.clientY);
    if (!afterEl) {
      zone.appendChild(CURRENT_DRAG_ITEM);
    } else {
      zone.insertBefore(CURRENT_DRAG_ITEM, afterEl);
    }
  });

  zone.addEventListener("dragleave", () => {
    zone.classList.remove("is-drag-over");
  });

  zone.addEventListener("drop", () => {
    zone.classList.remove("is-drag-over");
  });
}

// Finds the element the dragged item should be inserted before
function getDragAfterElement(zone, mouseY) {
  const els = [...zone.querySelectorAll(".lesson-drop-item:not(.is-dragging)")];

  let closest = { offset: Number.NEGATIVE_INFINITY, element: null };

  for (const el of els) {
    const box = el.getBoundingClientRect();
    const offset = mouseY - (box.top + box.height / 2);

    // negative means cursor is above the center of this element
    // pick the closest negative offset
    if (offset < 0 && offset > closest.offset) {
      closest = { offset, element: el };
    }
  }

  return closest.element;
}


// -----------------------------
// Save Lesson Details - Blocks
// -----------------------------
function readBlocksFromDropZone() {
  if (!dropZone) return [];

  const items = dropZone.querySelectorAll(".lesson-drop-item");
  const blocks = [];

  items.forEach((item, index) => {
    const block = { order: index, type: "unknown" };

    // 📝 Text
    const textArea = item.querySelector(".lesson-drop-textarea");
    if (textArea) {
      block.type = "text";
      block.text = (textArea.value || "").trim();
      blocks.push(block);
      return;
    }

    // 🎥 Video
    const videoUrlInput = item.querySelector(".lesson-video-url-input");
    const videoFileInput = item.querySelector(".lesson-video-file-input");
    if (videoUrlInput || videoFileInput) {
      block.type = "video";

      const cloudUrl = item.dataset.videoUrl || "";
      const manualUrl = (videoUrlInput?.value || "").trim();

      block.url = cloudUrl || manualUrl;
      block.fileName = item.dataset.videoName || "";

      blocks.push(block);
      return;
    }

    // 📎 Resource
    const resourceInput = item.querySelector(".lesson-resource-input");
    if (resourceInput) {
      block.type = "resource";
      block.url = item.dataset.resourceUrl || "";
      block.fileName = item.dataset.resourceName || "";
      blocks.push(block);
      return;
    }

    blocks.push(block);
  });

  return blocks;
}




if (lessonDetailSave) {
  lessonDetailSave.addEventListener('click', async () => {
    console.log('[lesson] Save lesson content clicked');

    const lessonId  = lessonDetailLessonId?.value || null;
    const sectionId = lessonDetailSectionId?.value || null;

    if (!lessonId) {
      alert('Save the lesson name in the outline first, then open it to edit details.');
      console.warn('[lesson] missing lessonId, stopping save');
      return;
    }
    if (!sectionId) {
      alert('Missing section id for this lesson.');
      console.warn('[lesson] missing sectionId, stopping save');
      return;
    }
    if (!currentCourseId) {
      alert('Save/select a course first.');
      console.warn('[lesson] missing currentCourseId, stopping save');
      return;
    }

    const name        = (lessonDetailName?.value || '').trim();
    const description = (lessonDetailDesc?.value || '').trim();
    const blocks      = readBlocksFromDropZone();
    const chapters    = readChaptersForSave();

    // ✅ keep the UI exactly as-is after saving
const blocksSnapshot = JSON.parse(JSON.stringify(blocks || []));

    console.log('[lesson] about to save payload:', {
      lessonId,
      sectionId,
      courseId: currentCourseId,
      name,
      description,
      blocks,
      chapters,
    });

    try {
     // inside your detail save button click handler...
const result = await saveLessonRecord({
  id: lessonId,
  name,
  sectionId,
  courseId: currentCourseId,
  description,
  blocks,
  chapters,
});

const savedId = getIdFromSave(result, lessonId);
if (lessonDetailLessonId) lessonDetailLessonId.value = String(savedId);

// ✅ keep blocks visible after save
rebuildDropZoneFromBlocks(dropZone, blocksSnapshot);

alert("Lesson content saved.");

    } catch (err) {
      console.error('[outline] save full lesson content failed', err);
      alert('Could not save lesson content: ' + (err.message || err));
    }
  });
}


  // Build the drop zone UI from saved blocks
function rebuildDropZoneFromBlocks(zoneEl, blocks) {
  if (!zoneEl) return;

  zoneEl.innerHTML = "";

  if (!blocks || !blocks.length) {
    const hint = document.createElement("p");
    hint.className = "lesson-drop-hint";
    hint.textContent = "Drag blocks here";
    zoneEl.appendChild(hint);
    return;
  }

  const sorted = [...blocks].sort((a, b) => (a.order || 0) - (b.order || 0));

  sorted.forEach((block) => {
    const item = document.createElement("div");
    item.className = "lesson-drop-item";

    makeLessonDropItemDraggable(item);

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "lesson-drop-remove";
    removeBtn.textContent = "−";
    removeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      item.remove();
    });
    item.appendChild(removeBtn);

    // 📝 Text
if (block.type === "text") {
  const textarea = document.createElement("textarea");
  textarea.className = "lesson-drop-textarea";
  textarea.placeholder = "Text here";
  textarea.value = block.text || "";

  // ✅ auto-grow as user types
  textarea.addEventListener("input", () => autoGrowTextarea(textarea));

  // ✅ grow immediately to fit saved text
  requestAnimationFrame(() => autoGrowTextarea(textarea));

  item.appendChild(textarea);
  zoneEl.appendChild(item);
  return;
}


    // 🎥 Video
    if (block.type === "video") {
      const topRow = document.createElement("div");
      topRow.className = "lesson-video-header";

      const labelSpan = document.createElement("span");
      labelSpan.className = "lesson-video-label";
      labelSpan.textContent = "Video";

      const addBtn = document.createElement("button");
      addBtn.type = "button";
      addBtn.className = "btn peach btn-xs lesson-video-add-btn";
      addBtn.textContent = "Add video";

      topRow.appendChild(labelSpan);
      topRow.appendChild(addBtn);

      const config = document.createElement("div");
      config.className = "lesson-video-config";
      config.style.display = (block.url || block.fileName) ? "block" : "none";

      const urlLabel = document.createElement("label");
      urlLabel.className = "lesson-video-url-label";
      urlLabel.textContent = "Video URL";

      const urlInput = document.createElement("input");
      urlInput.type = "text";
      urlInput.className = "lesson-video-url-input";
      urlInput.placeholder = "Paste video link (YouTube, Vimeo, etc.)";
      urlInput.value = block.url || "";

      urlLabel.appendChild(urlInput);
      config.appendChild(urlLabel);

      const uploadLabel = document.createElement("label");
      uploadLabel.className = "lesson-video-url-label";
      uploadLabel.textContent = "Or upload from your device";

      const fileInput = document.createElement("input");
      fileInput.type = "file";
      fileInput.accept = "video/*";
      fileInput.className = "lesson-video-file-input";

      uploadLabel.appendChild(fileInput);
      config.appendChild(uploadLabel);

      // ✅ persist into dataset so saving keeps it
      item.dataset.videoUrl = block.url || "";
      item.dataset.videoName = block.fileName || "";

      // ✅ show preview if we have URL
      if (block.url) {
        const preview = document.createElement("video");
        preview.className = "lesson-video-preview";
        preview.controls = true;
        preview.preload = "metadata";
        preview.style.width = "100%";
        preview.style.borderRadius = "12px";
        preview.style.marginTop = "10px";
        preview.src = block.url;
        item.appendChild(preview);
      } else if (block.fileName) {
        const fileNote = document.createElement("div");
        fileNote.className = "lesson-video-file-note";
        fileNote.textContent = `Previously attached: ${block.fileName}`;
        config.appendChild(fileNote);
      }

      // ✅ allow upload to cloud again on file pick
 fileInput.addEventListener("change", async () => {
  const f = fileInput.files?.[0];
  if (!f) return;

  // ✅ DEBUG: see file size
  console.log("VIDEO SIZE MB:", (f.size / (1024 * 1024)).toFixed(2));

  // ✅ GUARD: block huge videos for now
  const MAX_MB = 50;
  if (f.size > MAX_MB * 1024 * 1024) {
    alert(
      `That video is ${Math.round(f.size / 1024 / 1024)}MB. Please upload a smaller file (max ${MAX_MB}MB for now).`
    );
    fileInput.value = ""; // clears the picker
    return;
  }

  addBtn.textContent = "Uploading...";
  addBtn.disabled = true;

  try {
    const uploaded = await uploadToCloudinary(f, {
      folder: "suiteseat/course/videos",
      resourceType: "video",
    });

    item.dataset.videoUrl = uploaded.url;
    item.dataset.videoName = f.name;

    // preview (optional)
    let preview = item.querySelector("video.lesson-video-preview");
    if (!preview) {
      preview = document.createElement("video");
      preview.className = "lesson-video-preview";
      preview.controls = true;
      preview.preload = "metadata";
      preview.style.width = "100%";
      preview.style.borderRadius = "12px";
      preview.style.marginTop = "10px";
      item.appendChild(preview);
    }
    preview.src = uploaded.url;

    config.style.display = "block";
  } catch (e) {
    alert("Video upload failed: " + (e?.message || e));
    console.error(e);
  } finally {
    addBtn.textContent = "Add video";
    addBtn.disabled = false;
  }
});


      addBtn.addEventListener("click", () => {
        config.style.display = (config.style.display === "none") ? "block" : "none";
      });

      item.appendChild(topRow);
      item.appendChild(config);
      zoneEl.appendChild(item);
      return;
    }

    // 📎 Resource
    if (block.type === "resource") {
      const label = document.createElement("div");
      label.className = "lesson-resource-label";
      label.textContent = "Resource";

      const fileInput = document.createElement("input");
      fileInput.type = "file";
      fileInput.className = "lesson-resource-input";
      fileInput.accept = ".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,image/*";

      item.appendChild(label);
      item.appendChild(fileInput);

      // ✅ persist into dataset
      item.dataset.resourceUrl = block.url || "";
      item.dataset.resourceName = block.fileName || "";

      // ✅ show link if url exists
      if (block.url) {
        const link = document.createElement("a");
        link.className = "lesson-resource-link";
        link.href = block.url;
        link.target = "_blank";
        link.rel = "noreferrer";
        link.textContent = block.fileName ? `Open: ${block.fileName}` : "Open resource";
        link.style.display = "inline-block";
        link.style.marginTop = "8px";
        item.appendChild(link);
      } else if (block.fileName) {
        const note = document.createElement("div");
        note.className = "lesson-resource-note";
        note.textContent = `Previously attached: ${block.fileName}`;
        item.appendChild(note);
      }

      fileInput.addEventListener("change", async () => {
        const f = fileInput.files && fileInput.files[0];
        if (!f) return;

        item.dataset.resourceName = f.name;

        try {
          const uploaded = await uploadToCloudinary(f, {
            folder: "suiteseat/course/resources",
            resourceType: "raw",
          });

          item.dataset.resourceUrl = uploaded.url;

          let link = item.querySelector("a.lesson-resource-link");
          if (!link) {
            link = document.createElement("a");
            link.className = "lesson-resource-link";
            link.target = "_blank";
            link.rel = "noreferrer";
            link.style.display = "inline-block";
            link.style.marginTop = "8px";
            item.appendChild(link);
          }
          link.href = uploaded.url;
          link.textContent = `Open: ${f.name}`;

        } catch (e) {
          alert("Resource upload failed: " + (e?.message || e));
          console.error(e);
        }
      });

      zoneEl.appendChild(item);
      return;
    }

    // fallback
    const span = document.createElement("span");
    span.textContent = block.type || "Block";
    item.appendChild(span);
    zoneEl.appendChild(item);
  });
}



//Helper to save videos 
async function uploadVideoFile(file) {
  const fd = new FormData();
  fd.append("file", file);

  const res = await fetch("/api/uploads/video", {
    method: "POST",
    body: fd,
    credentials: "include",
  });

  if (!res.ok) throw new Error("Video upload failed (HTTP " + res.status + ")");
  const data = await res.json();
  return data; // { ok, url, fileName }
}




















/////// Chapter Section
const lessonChaptersList   = document.getElementById('lesson-chapters-list');
const lessonAddChapterBtn  = document.getElementById('lesson-add-chapter');

const chapterDetailPanel   = document.getElementById('chapter-detail-panel');
const chapterDetailIndex   = document.getElementById('chapter-detail-index');
const chapterDetailTitle   = document.getElementById('chapter-detail-title');
const chapterDetailName    = document.getElementById('chapter-detail-name');
const chapterDetailDesc    = document.getElementById('chapter-detail-description');

const chapterCancelBtn     = document.getElementById('chapter-detail-cancel');
const chapterSaveBtn       = document.getElementById('chapter-detail-save');

const chapterThumbInput  = document.getElementById("chapter-thumb-input");
const chapterThumbPreview = document.getElementById("chapter-thumb-preview");

const chapterCloseBtn = document.getElementById("chapter-detail-close");

const CHAPTER_THUMB_MAX_MB = 8;

// ---------------------------
// CHAPTERS toggle (display-based)
// ---------------------------
const chaptersBody   = document.getElementById("chapters-body");
const chaptersToggle = document.getElementById("chapters-toggle");

const cOpen          = chaptersToggle?.querySelector(".icon-open");
const cClosed        = chaptersToggle?.querySelector(".icon-closed");

if (chaptersToggle && chaptersBody) {
  chaptersToggle.addEventListener("click", () => {
    const isOpen = !chaptersBody.hidden;
    chaptersBody.hidden = isOpen;

    if (cOpen) cOpen.hidden = isOpen;
    if (cClosed) cClosed.hidden = !isOpen;

    chaptersToggle.setAttribute("aria-expanded", String(!isOpen));
  });
}

// One array that holds all chapters for the *current* lesson
let currentLessonChapters = [];
window.LESSON_CHAPTERS = currentLessonChapters;
let draggedChapterIndex = null;


/* -------------------- BLOCK HELPERS FOR CHAPTER -------------------- */
//Video Helper
// ✅ Chapter video upload guard (size + minutes estimate)
// Put this under "BUTTONS + INPUT LISTENERS" after chapterDropZone is defined.

const CHAPTER_VIDEO_MAX_MB = 50;

// very rough estimate: assume ~10–15MB per minute for 720p
function estimateMinutesFromMB(mb) {
  const avgMBPerMin = 12; // pick 12 as a middle estimate
  return Math.max(1, Math.round(mb / avgMBPerMin));
}

// Chapter video upload + preview (persists via dataset.cloudUrl)
if (chapterDropZone) {
  chapterDropZone.addEventListener("change", async (e) => {
    const input = e.target;

    // only handle chapter video file inputs
    if (!(input instanceof HTMLInputElement)) return;
    if (!input.classList.contains("lesson-video-file-input")) return;

    const file = input.files?.[0];
    if (!file) return;

    // ---- size checks (keep your existing logic) ----
    const sizeMB = file.size / (1024 * 1024);
    console.log("[chapter video] size MB:", sizeMB.toFixed(2));

    const estMin = typeof estimateMinutesFromMB === "function"
      ? estimateMinutesFromMB(sizeMB)
      : null;

    if (sizeMB > CHAPTER_VIDEO_MAX_MB) {
      alert(
        `That video is ${Math.round(sizeMB)}MB` +
          (estMin ? ` (≈ ~${estMin} min at HD)` : "") +
          `. Please upload a smaller file (max ${CHAPTER_VIDEO_MAX_MB}MB for now).`
      );
      input.value = "";
      return;
    }

    // ---- find the block container ----
    const item = input.closest(".lesson-drop-item");
    if (!item) return;

    // optional: UI feedback
    item.classList.add("is-uploading");

    try {
      // ✅ upload to Cloudinary
      const up = await uploadToCloudinary(file, {
        folder: `courses/${currentCourseId}/chapters`,
        resourceType: "video",
      });

      // ✅ store on DOM item so readBlocksFromChapterDropZone() can persist it
      item.dataset.cloudUrl = up.url;
      item.dataset.publicId = up.publicId;

      // ✅ show preview from Cloudinary URL (NOT from the file input)
      const preview = item.querySelector(".lesson-video-preview");
      if (preview) {
        preview.innerHTML = `
          <video controls style="width:100%; max-height:260px;">
            <source src="${up.url}">
          </video>
        `;
      }

      // Optional: clear the file input after upload (prevents re-uploading)
      // input.value = "";

    } catch (err) {
      console.error("[chapter video] upload failed", err);
      alert(err?.message || "Upload failed");
      input.value = "";
      item.dataset.cloudUrl = "";
      item.dataset.publicId = "";
    } finally {
      item.classList.remove("is-uploading");
    }
  });
}


// Read blocks from the chapter drop zone
function readBlocksFromChapterDropZone() {
  if (!chapterDropZone) return [];
  const items = chapterDropZone.querySelectorAll('.lesson-drop-item');

  const blocks = [];
  items.forEach((item, index) => {
    let block = { order: index, type: 'unknown' };

    const textArea = item.querySelector('.lesson-drop-textarea');
    if (textArea) {
      block.type = 'text';
      block.text = textArea.value.trim();
      blocks.push(block);
      return;
    }

const videoUrlInput  = item.querySelector('.lesson-video-url-input');
const videoFileInput = item.querySelector('.lesson-video-file-input');

if (videoUrlInput || videoFileInput) {
  block.type = 'video';

  // ✅ Persist the uploaded Cloudinary URL (best) OR typed URL (fallback)
  const cloudUrl = item.dataset.cloudUrl || "";
  block.url = cloudUrl || (videoUrlInput?.value || '').trim();

  // optional metadata
  if (item.dataset.publicId) block.publicId = item.dataset.publicId;

  // fileName is optional; not used for preview persistence
  const f = videoFileInput?.files?.[0];
  if (f) block.fileName = f.name;

  blocks.push(block);
  return;
}




    const resourceInput = item.querySelector('.lesson-resource-input');
    if (resourceInput) {
      block.type = 'resource';
      if (resourceInput.files && resourceInput.files[0]) {
        block.fileName = resourceInput.files[0].name;
      }
      blocks.push(block);
      return;
    }

    // fallback
    blocks.push(block);
  });

  return blocks;
}

// Save the blocks for whichever chapter is currently open
function persistActiveChapterBlocks() {
  if (!chapterDropZone) return;
  const idx = parseInt(chapterDetailIndex?.value || '-1', 10);
  if (idx < 0 || !currentLessonChapters[idx]) return;

  currentLessonChapters[idx].blocks = readBlocksFromChapterDropZone();
}

/* -------------------- HIGHLIGHT + OPEN DETAIL -------------------- */

function highlightActiveChapterRow(index) {
  if (!lessonChaptersList) return;
  lessonChaptersList
    .querySelectorAll('.mini-chapter-row')
    .forEach((row, i) => {
      row.classList.toggle('is-active', i === index);
    });
}

// SINGLE source of truth for opening a chapter
function openChapterDetail(index, anchorRowEl = null) {
  if (!chapterDetailPanel) return;
  const ch = currentLessonChapters[index];
  if (!ch) return;

  // ✅ remember active
  ACTIVE_CHAPTER_INDEX = index;

  // Before switching, save the previous chapter's blocks
  persistActiveChapterBlocks();

  // store which chapter is active
  if (chapterDetailIndex) chapterDetailIndex.value = String(index);

  if (chapterDetailName) chapterDetailName.value = ch.name || '';
  if (chapterDetailDesc) chapterDetailDesc.value = ch.description || '';

  // ✅ show panel
  chapterDetailPanel.style.display = 'block';

  // ✅ move the panel directly under the row being edited
  // if we weren’t passed the row, try to find it
  const row =
    anchorRowEl ||
    lessonChaptersList?.querySelector(`[data-chapter-index="${index}"]`);

  if (row) {
    row.insertAdjacentElement("afterend", chapterDetailPanel);
  }

  // rebuild drop zone with THIS chapter’s saved blocks
  if (chapterDropZone) {
    const blocks = Array.isArray(ch.blocks) ? ch.blocks : [];
    rebuildDropZoneFromBlocks(chapterDropZone, blocks);
  }

  // thumbnail preview
  if (chapterThumbPreview) {
    const url = ch.thumbUrl || "";
    chapterThumbPreview.innerHTML = url
      ? `<img src="${url}" style="width:180px; height:110px; object-fit:cover; border-radius:12px; border:1px solid rgba(0,0,0,.08);" />`
      : `<div class="muted">No thumbnail yet.</div>`;
  }

  if (chapterThumbInput) chapterThumbInput.value = "";

  highlightActiveChapterRow(index);
}

function closeChapterDetail() {
  // hide panel
  if (chapterDetailPanel) chapterDetailPanel.style.display = "none";

  // reset active index
  ACTIVE_CHAPTER_INDEX = -1;
  if (chapterDetailIndex) chapterDetailIndex.value = "-1";

  // ✅ exit edit mode visually by re-rendering the list
  // (your render defaults to view mode for saved chapters)
  if (typeof renderChaptersList === "function") {
    renderChaptersList();
  }
}
if (chapterCloseBtn) {
  chapterCloseBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    closeChapterDetail();
  });
}

/* -------------------- RENDER CHAPTER LIST -------------------- */
function moveChapter(fromIndex, toIndex) {
  if (
    fromIndex === toIndex ||
    fromIndex < 0 || toIndex < 0 ||
    fromIndex >= currentLessonChapters.length ||
    toIndex   >= currentLessonChapters.length
  ) {
    return;
  }

  const [moved] = currentLessonChapters.splice(fromIndex, 1);
  currentLessonChapters.splice(toIndex, 0, moved);
}

function renderChaptersList() {
  if (!lessonChaptersList) return;
  lessonChaptersList.innerHTML = '';

  if (!currentLessonChapters.length) {
    const empty = document.createElement('p');
    empty.className = 'lesson-chapters-empty';
    empty.textContent = 'No chapters yet.';
    lessonChaptersList.appendChild(empty);
    if (chapterDetailPanel) chapterDetailPanel.style.display = 'none';
    return;
  }

  
  currentLessonChapters.forEach((ch, idx) => {
    const row = document.createElement('div');
    row.className = 'outline-section-row mini-chapter-row';
    row.dataset.chapterIndex = String(idx);

    const chapterRef = currentLessonChapters[idx];
const isVisible = (chapterRef?.visible !== false);
row.classList.toggle("is-hidden", !isVisible);

    const header = document.createElement('div');
    header.className = 'outline-section-header';

    const drag = document.createElement('button');
    drag.type = 'button';
    drag.className = 'outline-drag chapter-drag';
    drag.setAttribute('aria-label', 'Reorder chapter');
    drag.draggable = true;
    drag.innerHTML = `
      <span class="dot-row">
        <span class="dot"></span><span class="dot"></span>
      </span>
      <span class="dot-row">
        <span class="dot"></span><span class="dot"></span>
      </span>
      <span class="dot-row">
        <span class="dot"></span><span class="dot"></span>
      </span>
    `;

    const main = document.createElement('div');
    main.className = 'outline-section-main';

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'outline-section-input chapter-name-input';

    input.addEventListener("input", () => {
  setChapterNameEverywhere(idx, input.value);
});

    input.value = ch.name || `Chapter ${idx + 1}`;
    main.appendChild(input);

    const actions = document.createElement('div');
    actions.className = 'outline-section-actions';

    header.appendChild(drag);
    header.appendChild(main);
    header.appendChild(actions);
    row.appendChild(header);

    let originalName = input.value;
    let hasSaved = !ch.isNew;

        // 🔹 DRAG START: remember which chapter index we grabbed
    drag.addEventListener('dragstart', (e) => {
      draggedChapterIndex = idx;
      row.classList.add('is-dragging');

      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', String(idx));
      }
    });

    // 🔹 DRAG END: clean up
    drag.addEventListener('dragend', () => {
      draggedChapterIndex = null;
      row.classList.remove('is-dragging');
      // remove drop highlight from all rows
      lessonChaptersList
        .querySelectorAll('.mini-chapter-row')
        .forEach(r => r.classList.remove('is-drop-target'));
    });

        // 🔹 Allow rows to be drop targets
    row.addEventListener('dragover', (e) => {
      e.preventDefault(); // needed so drop will fire
      row.classList.add('is-drop-target');
    });

    row.addEventListener('dragleave', () => {
      row.classList.remove('is-drop-target');
    });

    row.addEventListener('drop', async (e) => {
      e.preventDefault();
      row.classList.remove('is-drop-target');

      const fromIndex = draggedChapterIndex !== null
        ? draggedChapterIndex
        : parseInt(e.dataTransfer?.getData('text/plain') || '-1', 10);

      const toIndex = parseInt(row.dataset.chapterIndex || '-1', 10);

      console.log('[chapters] drop from', fromIndex, 'to', toIndex);

      if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return;

      // 1️⃣ Reorder in memory
      moveChapter(fromIndex, toIndex);

      // 2️⃣ Re-render list (so indexes/labels update)
      renderChaptersList();

      // 3️⃣ Keep the moved chapter "selected"
      const newIndex = toIndex; // after move, it's at the drop position
      if (chapterDetailIndex) chapterDetailIndex.value = String(newIndex);
      openChapterDetail(newIndex);

      // 4️⃣ Persist new order to backend
      try {
        await saveLessonFromUI('chapter-drag-reorder');
        persistActiveChapterBlocks();

      } catch (err) {
        console.error('[chapters] failed to save after drag reorder', err);
        alert('Could not save new chapter order: ' + (err.message || err));
      }
    });


  // VIEW MODE → read-only + Lock icon + Edit button
function switchChapterToViewMode() {
  input.readOnly = true;
  input.classList.add('is-locked');
  actions.innerHTML = '';

  const chapterRef = currentLessonChapters[idx];

  // if locked, add a visual class on the whole row (optional)
  if (chapterRef.locked) {
    row.classList.add('is-locked');
  } else {
    row.classList.remove('is-locked');
  }

  // ✏️ Edit button
  const edit = document.createElement('button');
  edit.type = 'button';
  edit.className = 'btn ghost btn-sm';
  edit.textContent = 'Edit';

edit.addEventListener('click', (e) => {
  e.stopPropagation();

  // ✅ open details right under THIS row
  openChapterDetail(idx, row);

  // then allow editing the name
  originalName = input.value;
  switchChapterToEditMode();
  input.focus();
});

// 👁 Visible / hidden button
const eyeBtn = document.createElement("button");
eyeBtn.type = "button";
eyeBtn.className = "btn ghost btn-sm chapter-eye-btn";
eyeBtn.innerHTML = (chapterRef.visible !== false) ? "👁" : "🚫";
eyeBtn.title = (chapterRef.visible !== false) ? "Chapter is visible" : "Chapter is hidden";

eyeBtn.addEventListener("click", async (e) => {
  e.stopPropagation();

  // toggle
  chapterRef.visible = (chapterRef.visible === false) ? true : false;

  // UI updates
  const nextVisible = (chapterRef.visible !== false);
  eyeBtn.innerHTML = nextVisible ? "👁" : "🚫";
  eyeBtn.title = nextVisible ? "Chapter is visible" : "Chapter is hidden";
  row.classList.toggle("is-hidden", !nextVisible);

  // persist to DB (same save pattern you already use)
  try {
    persistActiveChapterBlocks();
    await saveLessonFromUI("chapter-visible-toggle");
  } catch (err) {
    console.error("[chapters] failed to save visible state", err);
    alert("Could not save visibility: " + (err?.message || err));
  }

  // optional: re-render to keep everything in sync
  renderChaptersList();
});

  // 🔐 Lock / unlock button (to the RIGHT of Edit)
  const lockBtn = document.createElement('button');
  lockBtn.type = 'button';
  lockBtn.className = 'btn ghost btn-sm chapter-lock-btn';
  lockBtn.innerHTML = chapterRef.locked ? '🔒' : '🔓';
  lockBtn.title = chapterRef.locked ? 'Chapter locked' : 'Chapter unlocked';

lockBtn.addEventListener('click', async (e) => {
  e.stopPropagation();

  // 🔄 toggle state
  chapterRef.locked = !chapterRef.locked;

  lockBtn.innerHTML = chapterRef.locked ? '🔒' : '🔓';
  lockBtn.title = chapterRef.locked ? 'Chapter locked' : 'Chapter unlocked';

  if (chapterRef.locked) {
    row.classList.add('is-locked');
  } else {
    row.classList.remove('is-locked');
  }

  // 🔁 re-render list so any other UI updates stay in sync
  renderChaptersList();

  // ✅ NOW SAVE TO BACKEND (same as chapter Save)
  const lessonId  = lessonDetailLessonId?.value || null;
  const sectionId = lessonDetailSectionId?.value || null;

  if (!lessonId || !sectionId || !currentCourseId) {
    console.warn('[chapters] missing IDs; not saving lock state');
    return;
  }

  const name        = (lessonDetailName?.value || '').trim();
  const description = (lessonDetailDesc?.value || '').trim();
  const blocks      = readBlocksFromDropZone();
  const chapters    = readChaptersForSave(); // includes locked flag

  console.log('[chapters] saving after lock toggle:', {
    lessonId,
    sectionId,
    courseId: currentCourseId,
    name,
    description,
    blocks,
    chapters,
  });

  try {
    await saveLessonRecord({
      id: lessonId,
      name,
      sectionId,
      courseId: currentCourseId,
      description,
      blocks,
      chapters,
    });
    console.log('[chapters] lock state saved');
  } catch (err) {
    console.error('[chapters] failed to save lock state', err);
    alert('Could not save lock state: ' + (err.message || err));
  }
});


  // 👉 Append Edit first, then Lock so lock is on the *right*
  actions.appendChild(edit);
  actions.appendChild(eyeBtn);
  actions.appendChild(lockBtn);
}


    // EDIT MODE → Cancel + Save buttons
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'btn ghost btn-sm';
    cancel.textContent = 'Cancel';

    const save = document.createElement('button');
    save.type = 'button';
    save.className = 'btn peach btn-sm';
    save.textContent = 'Save';

  function switchChapterToEditMode() {
  input.readOnly = false;
  input.classList.remove('is-locked');
  actions.innerHTML = '';

  const cancel = document.createElement('button');
  cancel.type = 'button';
  cancel.className = 'btn ghost btn-sm';
  cancel.textContent = 'Cancel';

  const save = document.createElement('button');
  save.type = 'button';
  save.className = 'btn peach btn-sm';
  save.textContent = 'Save';

  const del = document.createElement('button');
  del.type = 'button';
  del.className = 'btn ghost btn-sm outline-chapter-delete';
  del.textContent = 'Delete';

  // order: Cancel · Save · Delete
  actions.appendChild(cancel);
  actions.appendChild(save);
  actions.appendChild(del);

  // 🔹 Cancel: revert name + go back to view mode
  cancel.addEventListener('click', (e) => {
    e.stopPropagation();
    input.value = originalName || '';
    switchChapterToViewMode();
  });

 // ✅ Save (row): update name + persist to backend
save.addEventListener("click", async (e) => {
  e.stopPropagation();

  const newName = input.value.trim();
  if (!newName) {
    alert("Please enter a chapter name.");
    input.focus();
    return;
  }

  const chapterRef = currentLessonChapters[idx];
  if (!chapterRef) return;

  // ✅ update chapter in memory
  chapterRef.name = newName;
  chapterRef.isNew = false;
  hasSaved = true;
  originalName = newName;

  // ✅ keep blocks in sync before saving
  persistActiveChapterBlocks();

  // ✅ update UI
  renderChaptersList();
  highlightActiveChapterRow(idx);

  // ✅ persist to DB so refresh keeps it
  try {
    await saveLessonFromUI("chapter-row-save");
  } catch (err) {
    console.error("[chapters] failed to save after row save", err);
    alert("Could not save chapter: " + (err?.message || err));
  }
});

 
 // 🔹 Delete: remove chapter from array + refresh list
del.addEventListener('click', (e) => {
  e.stopPropagation();

  const ok = confirm('Delete this chapter? This cannot be undone.');
  if (!ok) return;

  // ✅ use idx from the forEach closure instead of reading from DOM
  if (idx < 0 || !currentLessonChapters[idx]) {
    console.warn('[chapters] cannot resolve index for delete (idx=', idx, ')');
    return;
  }

  // remove from chapters array
  currentLessonChapters.splice(idx, 1);

  // re-render the list UI
  if (typeof renderChaptersList === 'function') {
    renderChaptersList();
  }

  // handle detail panel:
  if (currentLessonChapters.length && typeof openChapterDetail === 'function') {
    // open the previous chapter if possible, otherwise the first one
    const nextIndex = Math.min(idx, currentLessonChapters.length - 1);
    openChapterDetail(nextIndex);
  } else if (chapterDetailPanel) {
    chapterDetailPanel.style.display = 'none';
  }
});
}

    // Cancel (row)
    cancel.addEventListener('click', (e) => {
      e.stopPropagation();

      const chapterRef = currentLessonChapters[idx];

      // brand-new chapter → remove from list completely
      if (!hasSaved || (chapterRef && chapterRef.isNew)) {
        currentLessonChapters.splice(idx, 1);
        renderChaptersList();
        if (!currentLessonChapters.length && chapterDetailPanel) {
          chapterDetailPanel.style.display = 'none';
        }
        return;
      }

      // existing chapter → revert to original
      input.value = originalName;
      switchChapterToViewMode();
    });


    // clicking row (not on buttons / input) opens detail panel
row.addEventListener("click", (e) => {
  if (e.target === input) return;
  if (e.target.closest("button")) return; // ✅ ignore clicks on any button
  openChapterDetail(idx);
});

    lessonChaptersList.appendChild(row);

    if (hasSaved) {
      switchChapterToViewMode();
    } else {
      switchChapterToEditMode();
    }
  });

  const idx = parseInt(chapterDetailIndex?.value || '-1', 10);
  if (idx >= 0) highlightActiveChapterRow(idx);
}

//CHange chapter titles at the same time 
function getChapterRowNameInput(index) {
  if (!lessonChaptersList) return null;
  const row = lessonChaptersList.querySelector(
    `.mini-chapter-row[data-chapter-index="${index}"]`
  );
  return row ? row.querySelector("input.chapter-name-input") : null;
}
function setChapterNameEverywhere(index, newName) {
  const ch = currentLessonChapters?.[index];
  if (!ch) return;

  // 1) update the data
  ch.name = newName;

  // 2) update detail input (only if it's not already the one typing)
  if (chapterDetailName && chapterDetailName.value !== newName) {
    chapterDetailName.value = newName;
  }

  // 3) update row input in the chapter list
  const rowInput = getChapterRowNameInput(index);
  if (rowInput && rowInput.value !== newName) {
    rowInput.value = newName;
  }

  // optional: keep title highlight
  highlightActiveChapterRow?.(index);
}

/* -------------------- BUTTONS + INPUT LISTENERS -------------------- */
// + Add chapter thumbnail
// ✅ Chapter thumbnail upload listener (PUT IT HERE)
if (chapterThumbInput) {
  chapterThumbInput.addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const sizeMB = file.size / (1024 * 1024);
    if (sizeMB > CHAPTER_THUMB_MAX_MB) {
      alert(`Thumbnail is too big (${Math.round(sizeMB)}MB). Max ${CHAPTER_THUMB_MAX_MB}MB.`);
      chapterThumbInput.value = "";
      return;
    }

    const idx = parseInt(chapterDetailIndex?.value || "-1", 10);
    if (idx < 0 || !currentLessonChapters[idx]) return;

    try {
      const up = await uploadToCloudinary(file, {
        folder: `courses/${currentCourseId}/chapter-thumbs`,
        resourceType: "image",
      });

      currentLessonChapters[idx].thumbUrl = up.url;

      if (chapterThumbPreview) {
        chapterThumbPreview.innerHTML = `
          <img src="${up.url}" style="width:180px; height:110px; object-fit:cover; border-radius:12px; border:1px solid rgba(0,0,0,.08);" />
        `;
      }

      await persistChaptersToDB("chapter-thumb-upload");
    } catch (err) {
      console.error("[chapter thumb] upload failed", err);
      alert(err?.message || "Thumbnail upload failed");
      chapterThumbInput.value = "";
    }
  });
}

// + Add chapter

if (lessonAddChapterBtn) {
  lessonAddChapterBtn.addEventListener("click", async () => {
    openChaptersSection(); // ✅ expand the Chapters section FIRST

    const newChapter = {
      id: null,
      name: `Chapter ${currentLessonChapters.length + 1}`,
      description: "",
      isNew: true,
      locked: false,
       visible: true,  
      blocks: [],
      thumbUrl: "",
    };

    currentLessonChapters.push(newChapter);
    renderChaptersList();
    openChapterDetail(currentLessonChapters.length - 1);

    await persistChaptersToDB("chapter-add");
  });
}

// description typing → keep model in sync
if (chapterDetailDesc) {
  chapterDetailDesc.addEventListener('input', () => {
    const idx = parseInt(chapterDetailIndex?.value || '-1', 10);
    if (idx >= 0 && currentLessonChapters[idx]) {
      currentLessonChapters[idx].description = chapterDetailDesc.value;
    }
  });
}

// chapter title in detail panel → sync to array + list
if (chapterDetailName) {
  chapterDetailName.addEventListener("input", () => {
    const idx = parseInt(chapterDetailIndex?.value || "-1", 10);
    if (idx < 0) return;

    setChapterNameEverywhere(idx, chapterDetailName.value);
  });
}

// Cancel in detail panel → revert fields
if (chapterCancelBtn) {
  chapterCancelBtn.addEventListener('click', () => {
    const idx = parseInt(chapterDetailIndex?.value || '-1', 10);
    const ch  = currentLessonChapters[idx];
    if (!ch) return;

    if (chapterDetailName) chapterDetailName.value = ch.name || '';
    if (chapterDetailDesc) chapterDetailDesc.value = ch.description || '';

    if (chapterDropZone) {
      const blocks = Array.isArray(ch.blocks) ? ch.blocks : [];
      rebuildDropZoneFromBlocks(chapterDropZone, blocks);
    }
  });
}

// Save in detail panel → update title/description + keep UI in sync
if (chapterSaveBtn) {
  chapterSaveBtn.addEventListener('click', async () => {
    console.log('[chapters] detail Save button clicked');

    const idx = parseInt(chapterDetailIndex?.value || '-1', 10);
    console.log('[chapters] active index from hidden input:', idx);
    console.log('[chapters] chapters BEFORE detail save:', JSON.parse(JSON.stringify(currentLessonChapters)));

    if (idx < 0 || !currentLessonChapters[idx]) {
      console.warn('[chapters] no chapter at this index, aborting save');
      return;
    }

    const newName = chapterDetailName?.value || '';
    const newDesc = chapterDetailDesc?.value || '';

    currentLessonChapters[idx].name        = newName;
    currentLessonChapters[idx].description = newDesc;

    console.log('[chapters] chapter AFTER detail save:', {
      idx,
      chapter: currentLessonChapters[idx],
    });

    // also capture blocks for this chapter
    if (typeof readBlocksFromChapterDropZone === 'function') {
      const blocks = readBlocksFromChapterDropZone();
      currentLessonChapters[idx].blocks = blocks;
      console.log('[chapters] blocks saved for chapter', idx, blocks);
    }

    // Refresh the list UI and keep the chapter open
    renderChaptersList();
    openChapterDetail(idx);

    // 🔹 NOW PERSIST TO BACKEND 🔹

    const lessonId  = lessonDetailLessonId?.value || null;
    const sectionId = lessonDetailSectionId?.value || null;

    if (!lessonId) {
      console.warn('[chapters] no lessonId; not saving to backend');
      return;
    }
    if (!sectionId) {
      console.warn('[chapters] no sectionId; not saving to backend');
      return;
    }
    if (!currentCourseId) {
      console.warn('[chapters] no currentCourseId; not saving to backend');
      return;
    }

    const name        = (lessonDetailName?.value || '').trim();
    const description = (lessonDetailDesc?.value || '').trim();
  const blocks   = await readBlocksFromDropZone();
    const chapters = readChaptersForSave();  // uses currentLessonChapters

    console.log('[chapters] about to save lesson with updates from chapter:', {
      lessonId,
      sectionId,
      courseId: currentCourseId,
      name,
      description,
      blocks,
      chapters,
    });

    try {
      await saveLessonRecord({
        id: lessonId,
        name,
        sectionId,
        courseId: currentCourseId,
        description,
        blocks,
        chapters,
      });
      console.log('[chapters] lesson record saved with updated chapters');
      // optional: alert('Chapter saved.');
    } catch (err) {
      console.error('[chapters] failed to save lesson with updated chapters', err);
      alert('Could not save chapter: ' + (err.message || err));
    }
  });
}


/* -------------------- CHAPTERS → CLEAN ARRAY FOR SAVE -------------------- */

function readChaptersForSave() {
  if (!Array.isArray(currentLessonChapters)) return [];

  persistActiveChapterBlocks();

  const cleaned = currentLessonChapters.map((ch, index) => ({
    order: index,
    name: (ch.name || '').trim(),
    description: (ch.description || '').trim(),
    locked: !!ch.locked,
    visible: (ch.visible !== false),  
    thumbUrl: (ch.thumbUrl || "").trim(), // ✅ NEW
    blocks: Array.isArray(ch.blocks) ? ch.blocks : [],
  }));

  console.log('[chapters] readChaptersForSave →', cleaned);
  return cleaned;
}


//Drag Section
async function saveLessonFromUI(reason = 'unknown') {
  console.log('[lesson] saveLessonFromUI called, reason:', reason);

  const lessonId  = lessonDetailLessonId?.value || null;
  const sectionId = lessonDetailSectionId?.value || null;

  if (!lessonId || !sectionId || !currentCourseId) {
    console.warn('[lesson] missing ID(s); skipping save from', reason, {
      lessonId,
      sectionId,
      currentCourseId,
    });
    return;
  }

  const name        = (lessonDetailName?.value || '').trim();
  const description = (lessonDetailDesc?.value || '').trim();
  const blocks      = readBlocksFromDropZone();
  const chapters    = readChaptersForSave();  // uses currentLessonChapters

  console.log('[lesson] saveLessonFromUI payload:', {
    lessonId,
    sectionId,
    courseId: currentCourseId,
    name,
    description,
    blocks,
    chapters,
  });

  await saveLessonRecord({
    id: lessonId,
    name,
    sectionId,
    courseId: currentCourseId,
    description,
    blocks,
    chapters,
  });

  console.log('[lesson] saveLessonFromUI complete');
}

//Helper
async function persistChaptersToDB(reason = "chapters-change") {
  try {
    // keep the current chapter blocks in sync before saving
    persistActiveChapterBlocks();

    await saveLessonFromUI(reason); // this saves blocks + chapters + name/desc into the lesson record
  } catch (err) {
    console.error("[chapters] persistChaptersToDB failed", err);
    alert("Could not save chapters. Try again.");
  }
}











////////////////////////////////////////////////////////////////////
                    //Sidebar
 ////////////////////////////////////////////////////////////////////
 
 /* ===================== BASIC SIDEBAR / NAV ===================== */
/* ===================== SIDEBAR / TABS ===================== */
(() => {
  const app = document.getElementById("app");
  const nav = document.getElementById("nav");
  const sections = Array.from(document.querySelectorAll(".section"));

  // collapse sidebar
  document.getElementById("collapseBtn")?.addEventListener("click", () => {
    app?.classList.toggle("collapsed");
  });

  // click to switch sections
  nav?.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-target]");
    if (!btn) return;

    const targetId = btn.dataset.target;

    nav.querySelectorAll("button").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");

    sections.forEach((sec) => {
      sec.classList.toggle("active", sec.id === targetId);
    });
  });

  // keyboard up/down in sidebar (optional)
  nav?.addEventListener("keydown", (e) => {
    const buttons = Array.from(nav.querySelectorAll("button"));
    const i = buttons.findIndex((b) => b.classList.contains("active"));
    if (e.key === "ArrowDown") {
      const next = buttons[(i + 1) % buttons.length];
      next.focus();
      next.click();
      e.preventDefault();
    } else if (e.key === "ArrowUp") {
      const prev = buttons[(i - 1 + buttons.length) % buttons.length];
      prev.focus();
      prev.click();
      e.preventDefault();
    }
  });
})();



                        ////////////////////////////////////////////////////////////////////
                                                          //Students
                          ////////////////////////////////////////////////////////////////////
                              
                          // --- Students Section ---
const studentsSection        = document.getElementById('students');
const studentsCourseSelect   = document.getElementById('students-course-select');
const studentsCourseSummary  = document.getElementById('students-course-summary');
const studentsList           = document.getElementById('students-list');

//Courses dropdown
// 🔹 Course type (if not defined already)
const COURSE_TYPE = (window.TYPES && window.TYPES.Course) || 'Course';

// 🔹 List all courses (for dropdown in Students section)
async function listCoursesForUser() {
  const params = new URLSearchParams();
  params.set('dataType', COURSE_TYPE);
  params.set('limit', '200');

  // If your backend supports filtering by current user, you can add:
  // params.set('Owner', currentUserId);
  // but we’ll just pull all “Course” records and let your permissions handle it.

  const url = `${API_ORIGIN}/public/records?${params.toString()}`;

  const res = await fetch(url, {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  });

  if (!res.ok) {
    throw new Error('HTTP ' + res.status);
  }

  const data = await res.json();
  const rows = Array.isArray(data)
    ? data
    : data.records || data.items || [];

  return rows.map((row) => {
    const v = row.values || row;
    return {
      id: row._id || row.id || '',
      name: v['Course Name'] || v.Name || 'Untitled course',
    };
  });
}


function updateStudentsCourseSummary() {
  if (!studentsCourseSummary || !studentsCourseSelect) return;

  const courseId = studentsCourseSelect.value;
  if (!courseId) {
    studentsCourseSummary.textContent = 'No course selected yet.';
    if (studentsList) {
      studentsList.innerHTML = '<p class="muted">Select a course to see its students.</p>';
    }
    return;
  }

  const label =
    studentsCourseSelect.options[studentsCourseSelect.selectedIndex]?.textContent ||
    'Selected course';

  studentsCourseSummary.textContent = `Showing students for: ${label}`;

  // TODO: later we’ll call a real "load students for this course" function
  if (studentsList) {
    studentsList.innerHTML = `
      <p class="muted">
        (Hook up enrolled students list here for course: <strong>${label}</strong>.)
      </p>
    `;
  }
}

// --- Students section wiring ---
if (studentsCourseSelect) {
  studentsCourseSelect.addEventListener('change', () => {
    updateStudentsCourseSummary();
    // later: loadStudentsForCourse(studentsCourseSelect.value)
  });
}

// Call this once on page load to fill the dropdown
hydrateStudentsCourseDropdown();


  // =========================
  // Students table wiring
  // =========================

  const studentsTableBody      = document.getElementById('students-table-body');
  const studentsTableSubtitle  = document.getElementById('students-table-subtitle');

  // Render rows into the table body
  function renderStudentTableRows(enrollments) {
    if (!studentsTableBody) return;

    studentsTableBody.innerHTML = '';

    if (!enrollments || !enrollments.length) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 4;
      td.className = 'muted';
      td.textContent = 'No students enrolled in this course yet.';
      tr.appendChild(td);
      studentsTableBody.appendChild(tr);

      if (studentsTableSubtitle) {
        studentsTableSubtitle.textContent = 'No enrollments yet.';
      }
      return;
    }

    if (studentsTableSubtitle) {
      studentsTableSubtitle.textContent = `Showing ${enrollments.length} student(s).`;
    }

    enrollments.forEach((enr) => {
      const tr = document.createElement('tr');

      const tdStudent   = document.createElement('td');
      const tdCourse    = document.createElement('td');
      const tdDate      = document.createElement('td');
      const tdCompleted = document.createElement('td');

      tdStudent.textContent   = enr.studentName || '—';
      tdCourse.textContent    = enr.courseTitle || '—';
      tdDate.textContent      = enr.enrolledAt || '—';
      tdCompleted.textContent = enr.completedAt || '—';

      tr.appendChild(tdStudent);
      tr.appendChild(tdCourse);
      tr.appendChild(tdDate);
      tr.appendChild(tdCompleted);

      studentsTableBody.appendChild(tr);
    });
  }

  // For now, stub data when a course is picked
  if (studentsCourseSelect) {
    studentsCourseSelect.addEventListener('change', () => {
      const courseId = studentsCourseSelect.value;

      if (!courseId) {
        renderStudentTableRows([]);
        return;
      }

      // TODO: replace with real API call later.
      // For now, just show fake rows so UI works.
      const fakeEnrollments = [
        {
          studentName: 'Jane Doe',
          courseTitle: studentsCourseSelect.options[studentsCourseSelect.selectedIndex].textContent,
          enrolledAt: '2025-11-01',
          completedAt: '—',
        },
        {
          studentName: 'Alex Smith',
          courseTitle: studentsCourseSelect.options[studentsCourseSelect.selectedIndex].textContent,
          enrolledAt: '2025-11-10',
          completedAt: '2025-11-15',
        },
      ];

      renderStudentTableRows(fakeEnrollments);
    });
  }


});