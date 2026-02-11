console.log("[suite-settings] loaded");
// Use the EXACT DataType name from your admin
const APPLICATION_TYPE = "Application";

// ---- API base (same pattern as other pages) ----
// ---- API base (NEVER empty) ----
const API_BASE =
  (window.NEXT_PUBLIC_API_BASE_URL ||
   window.API_BASE_URL ||
   window.API_BASE ||
   "http://localhost:8400"   // ✅ fallback to your Express API
  ).replace(/\/+$/,'');

console.log("[suite-settings] API_BASE =", API_BASE);


// ================================
// AUTH UI (header + popup)
// ================================
function initAuthUI(currentUser) {
  const loginBtn  = document.getElementById("open-login-popup-btn");
  const logoutBtn = document.getElementById("logout-btn");
  const loginText = document.getElementById("login-status-text");

  const modal     = document.getElementById("authModal");
  const closeBtn  = document.getElementById("authClose");
  const form      = document.getElementById("authForm");
  const emailEl   = document.getElementById("authEmail");
  const passEl    = document.getElementById("authPass");
  const errorEl   = document.getElementById("authError");
  const submitBtn = document.getElementById("authSubmit");

  function setLoggedInUI(user) {
    const loggedIn = !!(user && user.id);
    if (loggedIn) {
      const name =
        user.firstName ||
        (user.email ? user.email.split("@")[0] : "") ||
        "there";

      if (loginText) loginText.textContent = `Hi, ${name}`;
      if (loginBtn)  loginBtn.style.display  = "none";
      if (logoutBtn) logoutBtn.style.display = "inline-block";
    } else {
      if (loginText) loginText.textContent = "Not logged in";
      if (loginBtn)  loginBtn.style.display  = "inline-block";
      if (logoutBtn) logoutBtn.style.display = "none";
    }
  }

  function openModal() {
    if (!modal) return;
    modal.hidden = false;
    modal.setAttribute("aria-hidden", "false");
    if (emailEl) emailEl.focus();
  }

  function closeModal() {
    if (!modal) return;
    modal.hidden = true;
    modal.setAttribute("aria-hidden", "true");
    if (errorEl) errorEl.textContent = "";
  }

  loginBtn?.addEventListener("click", openModal);
  closeBtn?.addEventListener("click", closeModal);
  modal?.addEventListener("click", (e) => {
    if (e.target === modal) closeModal();
  });

  // login submit
  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!emailEl || !passEl || !submitBtn) return;

    const email = emailEl.value.trim();
    const password = passEl.value.trim();
    if (!email || !password) {
      if (errorEl) errorEl.textContent = "Enter email and password.";
      return;
    }

    // show "busy" state
    const idleSpan  = submitBtn.querySelector(".when-idle");
    const busySpan  = submitBtn.querySelector(".when-busy");
    submitBtn.disabled = true;
    if (idleSpan) idleSpan.hidden = true;
    if (busySpan) busySpan.hidden = false;
    if (errorEl) errorEl.textContent = "";

    try {
 const res = await fetch(`${API_BASE}/api/login`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  credentials: "include",
  body: JSON.stringify({ email, password }),
});

      const body = await res.json().catch(() => ({}));

      if (!res.ok || !body.loggedIn) {
        if (errorEl) errorEl.textContent = body.message || "Login failed.";
      } else {
        closeModal();
        location.reload();
      }
    } catch (err) {
      console.error("[auth] login error", err);
      if (errorEl) errorEl.textContent = "Something went wrong. Try again.";
    } finally {
      submitBtn.disabled = false;
      if (idleSpan) idleSpan.hidden = false;
      if (busySpan) busySpan.hidden = true;
    }
  });

  // logout
logoutBtn?.addEventListener("click", async () => {
  try {
await fetch(`${API_BASE}/api/logout`, {
  method: "POST",
  credentials: "include",
});

  } catch {}
  location.reload();
});

  // initial paint
  setLoggedInUI(currentUser);
}


// ---- Get signed-in user via /check-login ----
async function getSignedInUser() {
  try {
    const res = await fetch('/api/check-login', {
      credentials: 'include',
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.user || null;
  } catch (err) {
    console.warn('[suite-settings] getSignedInUser error', err);
    return null;
  }
}

                                               // ================================
                                                         // Dashboard
                                            // ================================
// Simple shared state (if you don't already have this)
// ---- Dashboard shared state + updater ----
window.STATE = window.STATE || {};
window.STATE.locations = window.STATE.locations || [];
window.STATE.suities   = window.STATE.suities   || [];
window.STATE.maintenanceRequests = window.STATE.maintenanceRequests || [];

function updateDashboardCounts() {
  const locEl   = document.getElementById("dash-locations-count");
  const suiteEl = document.getElementById("dash-suities-count");
  const maintEl = document.getElementById("dash-maint-count");

  if (locEl) {
    const activeLocations = window.STATE.locations.length; // later you can filter "active"
    locEl.textContent = String(activeLocations);
  }

  if (suiteEl) {
    const activeSuities = window.STATE.suities.length;
    suiteEl.textContent = String(activeSuities);
  }

  if (maintEl) {
    const totalRequests = window.STATE.maintenanceRequests.length || 0;
    maintEl.textContent = String(totalRequests);
  }
}









// =====================
// Suite Details
// =====================
let activeSuite = null;

// 🔹 Layout elements shared by Location + Suite panels
const locationsSection      = document.getElementById("locations");
const locationDetailsGrid   = document.querySelector(".location-details-grid");
const locationsHeader       = document.getElementById("locations-header");

const locationSuitesHeader  = document.querySelector(".location-suites-header");
const locationSuitesList    = document.getElementById("location-suites-list");
const locationSuiteFormCard = document.getElementById("location-suite-form-card");
const locationSuiteBackBtn  = document.getElementById("location-suite-back-btn");
const locSuiteLocationName  = document.getElementById("loc-suite-location-name");

function showSuiteDetails(suite) {
  if (!locationSuiteDetailsCard) return;

  // remember which suite is open
  activeSuite = suite;

  const hasTemplate =
    !!(suite.applicationTemplate && String(suite.applicationTemplate).trim());
  const hasFile = !!suite.applicationFileUrl;

  console.log("[suite-details] open for:", {
    id: suite.id,
    name: suite.name,
    hasTemplate,
    applicationFileUrl: hasFile ? suite.applicationFileUrl : null,
  });

    // 🔹 If this suite has NO template, reset the modal body
  if (!hasTemplate) {
    resetSuiteTemplatePreview();
  }
  // hide location layout while viewing suite
  if (locationsHeader)       locationsHeader.style.display = "none";
  if (locationDetailsGrid)   locationDetailsGrid.style.display = "none";
  if (locationSuitesHeader)  locationSuitesHeader.style.display = "none";
  if (locationSuiteFormCard) locationSuiteFormCard.style.display = "none";

  // basic fields
  if (locationSuiteDetailsName) {
    locationSuiteDetailsName.textContent = suite.name || "Suite details";
  }

  if (locationSuiteDetailsAvail) {
    locationSuiteDetailsAvail.textContent =
      suite.dateAvailable || "No date set";
  }

  if (locationSuiteDetailsRate) {
    if (suite.rentAmount) {
      const freqLabel = suite.rentFrequency || "month";
      locationSuiteDetailsRate.textContent =
        `$${suite.rentAmount} / ${freqLabel}`;
    } else {
      locationSuiteDetailsRate.textContent = "$0.00";
    }
  }

  // default image
  if (locationSuiteDetailsPhoto) {
    locationSuiteDetailsPhoto.innerHTML = "";
    if (suite.img) {
      const imgEl = document.createElement("img");
      imgEl.src = suite.img;
      imgEl.alt = "Suite default image";
      imgEl.style.maxWidth = "220px";
      imgEl.style.borderRadius = "12px";
      locationSuiteDetailsPhoto.appendChild(imgEl);
    } else {
      locationSuiteDetailsPhoto.textContent = "No default image set.";
    }
  }

  // gallery
  if (locationSuiteDetailsGallery) {
    locationSuiteDetailsGallery.innerHTML = "";
    if (Array.isArray(suite.gallery) && suite.gallery.length) {
      suite.gallery.forEach((url) => {
        const imgEl = document.createElement("img");
        imgEl.src = url;
        imgEl.alt = "Suite gallery image";
        imgEl.className = "suite-gallery-thumb";
        locationSuiteDetailsGallery.appendChild(imgEl);
      });
    } else {
      locationSuiteDetailsGallery.textContent = "No gallery images added.";
    }
  }

  // ✅ Application section – show that a template exists
  if (locationSuiteDetailsApp) {
    if (hasTemplate && hasFile) {
      locationSuiteDetailsApp.innerHTML = `
        Online form (template saved) + 
        <a href="${suite.applicationFileUrl}" target="_blank" rel="noopener">
          downloadable file
        </a>
      `;
    } else if (hasTemplate) {
      locationSuiteDetailsApp.textContent =
        "Online application form (template saved).";
    } else if (hasFile) {
      locationSuiteDetailsApp.innerHTML = `
        <a href="${suite.applicationFileUrl}" target="_blank" rel="noopener">
          Download application file
        </a>
      `;
    } else {
      locationSuiteDetailsApp.textContent = "No application added yet.";
    }
  }

  // show the details card
  locationSuiteDetailsCard.style.display = "block";
  locationSuiteDetailsCard.scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderSuitesForLocation(listEl, suitesFromLocation) {
  if (!listEl) return;
  listEl.innerHTML = "";

  console.log("[renderSuitesForLocation] raw location suites:", suitesFromLocation);

  if (!suitesFromLocation || !suitesFromLocation.length) {
    listEl.textContent = "No suites in this location yet.";
    return;
  }

  // 🔹 Get the full normalized suites that *do* have img, gallery, etc.
  const allSuites = getAllSuitesForRender
    ? getAllSuitesForRender()
    : []; // fallback if that helper exists

  const suiteById = new Map(allSuites.map((s) => [String(s.id), s]));

  // Map each “skinny” row to the full suite
  const suites = suitesFromLocation.map((row) => {
    const full = suiteById.get(String(row.id));
    const out = full || row; // fallback to row if not found

    console.log("[renderSuitesForLocation] merged suite:", {
      rowId: row.id,
      fullFound: !!full,
      id: out.id,
      name: out.name,
      img: out.img,
      gallery: out.gallery,
    });

    return out;
  });

  suites.forEach((suite) => {
    const imgUrl =
      suite.img ||
      (Array.isArray(suite.gallery) && suite.gallery[0]) ||
      "";

    console.log("[renderSuitesForLocation] suite row final:", {
      id: suite.id,
      name: suite.name,
      img: suite.img,
      gallery: suite.gallery,
      imgUrl,
    });

    const row = document.createElement("div");
    row.className = "location-suite-row";
    row.innerHTML = `
      <div class="suite-row-main">
        ${
          imgUrl
            ? `<img class="suite-row-thumb" src="${imgUrl}" alt="${suite.name || "Suite"}" />`
            : ""
        }
        <div class="suite-row-text">
          <div class="suite-row-name">${suite.name || "Unnamed suite"}</div>
          <div class="suite-row-sub">
            ${suite.dateAvailable ? `Available: ${suite.dateAvailable}` : ""}
            ${
              suite.rentAmount
                ? ` • $${suite.rentAmount} / ${suite.rentFrequency || "month"}`
                : ""
            }
          </div>
        </div>
      </div>
    `;

    row.addEventListener("click", () => {
      showSuiteDetails(suite);
    });

    listEl.appendChild(row);
  });

  console.log("[renderSuitesForLocation] final HTML:", listEl.innerHTML);
}

// ---- Suite Details (Quill) GLOBALS ----
let suiteDetailsQuill = null;

function initSuiteDetailsEditor() {
  const editorEl = document.getElementById("loc-suite-details-editor");
  const toolbarEl = document.getElementById("suite-details-toolbar");
  const hiddenEl = document.getElementById("loc-suite-details");

  if (!editorEl || !toolbarEl || !hiddenEl) return;

  // prevent double-init
  if (suiteDetailsQuill) return;

  suiteDetailsQuill = new Quill(editorEl, {
    theme: "snow",
    modules: { toolbar: toolbarEl },
  });

  suiteDetailsQuill.on("text-change", () => {
    hiddenEl.value = suiteDetailsQuill.root.innerHTML;
  });

  hiddenEl.value = "";
}

function setSuiteDetailsHTML(html) {
  const hiddenEl = document.getElementById("loc-suite-details");
  if (hiddenEl) hiddenEl.value = html || "";

  // if quill exists, update editor too
  if (suiteDetailsQuill) {
    suiteDetailsQuill.root.innerHTML = html || "";
  }
}



// 🆕 Suite details panel elements
const locationSuiteDetailsCard   = document.getElementById("location-suite-details-card");
const locationSuiteDetailsName   = document.getElementById("location-suite-details-name");
const locationSuiteDetailsAvail  = document.getElementById("location-suite-details-availability");
const locationSuiteDetailsNotes  = document.getElementById("location-suite-details-notes");
const locationSuiteDetailsPhoto  = document.getElementById("location-suite-details-photo");
const locationSuiteDetailsClose  = document.getElementById("location-suite-details-close");

// 🆕 new elements for details card
const locationSuiteDetailsGallery = document.getElementById("location-suite-details-gallery");
const locationSuiteDetailsApp     = document.getElementById("location-suite-details-application");
const locationSuiteEditBtn        = document.getElementById("location-suite-edit-btn");
const locationSuiteDeleteBtn      = document.getElementById("location-suite-delete-btn");
const locationSuiteDetailsRate = document.getElementById("location-suite-details-rate");

// 🆕 back-to-location button
const locationSuiteDetailsBackBtn =
  document.getElementById("location-suite-details-back-btn");
const locationSuiteDetailsLocName =
  document.getElementById("location-suite-details-location-name");


const suiteDetailsAppText   = document.getElementById("suite-details-app-text");
const suiteDetailsAppPdf    = document.getElementById("suite-details-app-pdf");
const suiteDetailsAppButton = document.getElementById("suite-details-app-template-btn");

const locationSuiteDetailsDefaultImg =
  document.getElementById("location-suite-default-img");

const locationSuiteAppTemplateBtn =
  document.getElementById("location-suite-app-template-btn");




  // 🆕 Suites area inside location details

  const locationAddSuiteBtn    = document.getElementById("location-add-suite-btn");

  const locationSuiteForm      = document.getElementById("location-suite-form");
  const locSuiteIdInput        = document.getElementById("loc-suite-id");
  const locSuiteNameInput      = document.getElementById("loc-suite-name");
  const locSuiteDetailsInput   = document.getElementById("loc-suite-details");
  const locSuiteAvailableInput = document.getElementById("loc-suite-available");
  const locSuitePhotoInput     = document.getElementById("loc-suite-photo-file");
  const locSuiteCancelBtn      = document.getElementById("loc-suite-cancel-btn");

                                            
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
                                         // ================================
                                         // Locations: save to backend per user
                                        // ================================
function initLocationForm(currentUser) {
  const formCard  = document.getElementById("location-form-card");
  const addBtn    = document.getElementById("locations-add-btn");
  const cancelBtn = document.getElementById("location-cancel-btn");
  const form      = document.getElementById("location-form");

  const idInput      = document.getElementById("loc-id"); 
  const nameInput    = document.getElementById("loc-name");
  const addressInput = document.getElementById("loc-address");
  const phoneInput   = document.getElementById("loc-phone");
  const listEl       = document.getElementById("locations-list");

     const detailsInput    = document.getElementById("loc-details");
const photoFileInput = document.getElementById("loc-photo-file");
const locCurrentPhoto      = document.getElementById("loc-current-photo");
const locCurrentGallery    = document.getElementById("loc-current-gallery");
const locNewGalleryPreview = document.getElementById("loc-new-gallery-preview");


  const locationEditBtn = document.getElementById("location-edit-btn");

  // 🔹 Details panel elements
  const locationDetailsCard     = document.getElementById("location-details-card");
  const locationDetailsName     = document.getElementById("location-details-name");
  const locationDetailsAddr     = document.getElementById("location-details-address");
  const locationDetailsAddrFull = document.getElementById("location-details-address-full");
  const locationDetailsPhone    = document.getElementById("location-details-phone");
  const locationTotalRentEl     = document.getElementById("location-total-rent");
  const locationYearRentEl      = document.getElementById("location-year-total-rent"); 
  const locationDetailsDesc     = document.getElementById("location-details-desc");
  const locationDetailsPhoto    = document.getElementById("location-details-photo");
  const locationBackBtn         = document.getElementById("location-back-btn");
const locationDetailsHeader = document.querySelector(".location-details-header");
const deleteBtn = document.getElementById("location-delete-btn");
const locationDetailsActions = document.querySelector(".location-details-actions");

const locationDeleteBtn = document.getElementById("location-delete-btn");




// 🆕 suite form inputs (MOVE THESE UP HERE)
const locSuiteAppInput       = document.getElementById("loc-suite-app-input"); // or -file, see note below
const locSuiteGalleryInput   = document.getElementById("loc-suite-gallery-files");
const locSuiteCurrentGallery = document.getElementById("loc-suite-current-gallery");
const locSuiteCurrentApp     = document.getElementById("loc-suite-current-app");
console.log("[init] locSuiteCurrentApp:", locSuiteCurrentApp);
const locSuiteCurrentPhoto   = document.getElementById("loc-suite-current-photo");
const locSuiteNewGalleryPrev = document.getElementById("loc-suite-new-gallery-preview");

const locationScrollSuitesBtn = document.getElementById("location-scroll-suites-btn");




let pendingSuiteGalleryFiles = [];


// Read-only template preview modal
// Read-only template preview modal (global)
const suiteTemplatePreviewModal = document.getElementById("suite-template-preview-modal");
const suiteTemplatePreviewBody  = document.getElementById("suite-template-preview-body");
const suiteTemplatePreviewClose = document.getElementById("suite-template-preview-close");

// Default empty state for the template modal
const EMPTY_SUITE_TEMPLATE_HTML = `
  <div class="suite-template-empty">
    <h2>No application template saved</h2>
    <p class="muted">
      This suite doesn’t have a saved application template yet.
      You can create one in the Suite settings.
    </p>
  </div>
`;

function resetSuiteTemplatePreview() {
  if (!suiteTemplatePreviewBody) return;
  suiteTemplatePreviewBody.innerHTML = EMPTY_SUITE_TEMPLATE_HTML;
}


resetSuiteTemplatePreview();

// helper: render current suite photo with an X button
// =====================
// Suite default photo helper + preview
// =====================
function renderSuiteCurrentPhoto(url) {
  if (!locSuiteCurrentPhoto) return;

  locSuiteCurrentPhoto.innerHTML = "";

  if (!url) {
    locSuiteCurrentPhoto.textContent = "No photo uploaded yet.";
    return;
  }

  const wrapper = document.createElement("div");
  wrapper.className = "suite-current-photo-wrapper";

  const img = document.createElement("img");
  img.src = url;
  img.alt = "Suite default image";
  img.className = "suite-default-img"; // style in CSS however you want

  const removeBtn = document.createElement("button");
  removeBtn.type = "button";
  removeBtn.className = "suite-remove-photo-btn";
  removeBtn.title = "Remove this photo";
  removeBtn.textContent = "×";

  removeBtn.addEventListener("click", () => {
    // mark it so the save handler can clear this field
    suitePhotoMarkedForRemoval = true;
    locSuiteCurrentPhoto.textContent =
      "Photo will be removed when you save.";
  });

  wrapper.appendChild(img);
  wrapper.appendChild(removeBtn);
  locSuiteCurrentPhoto.appendChild(wrapper);
}

// When user picks a NEW default photo file
if (locSuitePhotoInput && locSuiteCurrentPhoto) {
  locSuitePhotoInput.addEventListener("change", () => {
    const file =
      locSuitePhotoInput.files && locSuitePhotoInput.files[0];

    // user picked a new image → don't treat it as "removed"
    suitePhotoMarkedForRemoval = false;

    if (!file) {
      // no file selected → fallback to "no photo"
      renderSuiteCurrentPhoto(null);
      return;
    }

    const url = URL.createObjectURL(file);
    renderSuiteCurrentPhoto(url);

    // clean up temp URL once it loads
    const imgEl = locSuiteCurrentPhoto.querySelector("img");
    if (imgEl) {
      imgEl.onload = () => URL.revokeObjectURL(url);
    }
  });
}


// Live preview when user picks a default location photo (works for add + edit)
if (photoFileInput && locCurrentPhoto) {
  photoFileInput.addEventListener("change", () => {
    const file = photoFileInput.files && photoFileInput.files[0];

    if (!file) {
      // No file selected → show empty state again
      locCurrentPhoto.innerHTML = "No photo uploaded yet.";
      return;
    }

    const url = URL.createObjectURL(file);

    // Clear any previous content
    locCurrentPhoto.innerHTML = "";

    const img = document.createElement("img");
    img.src = url;
    img.alt = "Location photo (not saved yet)";
    img.className = "location-main-photo-preview";

    img.onload = () => {
      URL.revokeObjectURL(url);
    };

    locCurrentPhoto.appendChild(img);
  });
}

if (suiteTemplatePreviewClose && suiteTemplatePreviewModal) {
  suiteTemplatePreviewClose.addEventListener("click", () => {
    suiteTemplatePreviewModal.style.display = "none";
  });
}

// 🔹 Hide the modal's built-in title so we only see our custom one
if (suiteTemplatePreviewModal) {
  const headerTitle = suiteTemplatePreviewModal.querySelector(
    ".suite-template-modal-header h2"
  );
  if (headerTitle) {
    headerTitle.style.display = "none";
  }
}

// optional: click dimmed background to close
if (suiteTemplatePreviewModal) {
  suiteTemplatePreviewModal.addEventListener("click", (e) => {
    if (e.target === suiteTemplatePreviewModal) {
      suiteTemplatePreviewModal.style.display = "none";
    }
  });
}

function escapeHtml(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// =========================
// Read-only template preview
// =========================
function openSuiteTemplatePreview(templateJsonOrObj) {
  console.log("[suite-template] openSuiteTemplatePreview called with:", templateJsonOrObj);

  const modal = document.getElementById("suite-template-preview-modal");
  const bodyEl = document.getElementById("suite-template-preview-body");

  if (!modal || !bodyEl) {
    console.warn("[suite-template] preview modal elements missing");
    return;
  }

  // Parse JSON string if needed
  let tpl = templateJsonOrObj || {};
  if (typeof tpl === "string") {
    try {
      tpl = JSON.parse(tpl);
    } catch (e) {
      console.error("[suite-template] could not parse template JSON", e);
      tpl = {};
    }
  }

  const sections = tpl.sections || {};
  const applicantRows   = sections.applicant   || [];
  const experienceRows  = sections.experience  || [];
  const customSections  = sections.custom      || [];
  const applicantTitle  = sections.applicantTitle?.label   || "Applicant information";
  const experienceTitle = sections.experienceTitle?.label  || "Professional experience";

 const renderRows = (rows) =>
  rows
    .map((row) => {
      const label = escapeHtml(row.label || row.key || "");
      const input = escapeHtml(row.inputType || "[text input]");

      return `
        <div class="suite-template-row">
          <div class="suite-template-row-left">
            <div class="suite-template-bullet"></div>
            <div class="suite-template-label">${label}</div>
          </div>
          <div class="suite-template-input">${input}</div>
        </div>
      `;
    })
    .join("");


  let html = "";

  // applicant section
  if (applicantRows.length) {
    html += `<h3>${applicantTitle}</h3>`;
    html += renderRows(applicantRows);
  }

  // experience section
  if (experienceRows.length) {
    html += `<h3>${experienceTitle}</h3>`;
    html += renderRows(experienceRows);
  }

  // custom sections
  customSections.forEach((sec) => {
    if (sec.title) {
      html += `<h3>${sec.title}</h3>`;
    }
    html += renderRows(sec.rows || []);
  });

  if (!html) {
    html = `<p class="muted">This template does not have any questions yet.</p>`;
  }

  bodyEl.innerHTML = html;

  // 👉 SHOW the modal
  modal.style.display = "block";
  modal.setAttribute("aria-hidden", "false");
}


function closeSuiteTemplatePreview() {
  const modal = document.getElementById("suite-template-preview-modal");
  if (!modal) return;

  modal.hidden = true;
  modal.setAttribute("aria-hidden", "true");

  // unlock page scroll if you locked it
  document.body.classList.remove("modal-open");

  // return focus to the thing that opened the preview (optional but good)
  const opener = document.querySelector(".suite-template-view-link")
             || document.getElementById("open-suite-app-builder");
  if (opener) opener.focus();
}

suiteTemplatePreviewClose?.addEventListener("click", closeSuiteTemplatePreview);

// click on the dark overlay to close
suiteTemplatePreviewModal?.addEventListener("click", (e) => {
  if (e.target === suiteTemplatePreviewModal) {
    closeSuiteTemplatePreview();
  }
});

//scroll to suites when the suite button is pressed 
locationScrollSuitesBtn?.addEventListener("click", () => {
  // make sure the suites area is visible (in case something hid it)
  if (locationSuitesHeader) locationSuitesHeader.style.display = "flex";
  if (locationSuitesList)   locationSuitesList.style.display   = "block";

  // smooth scroll down to the suites area
  if (locationSuitesHeader) {
    locationSuitesHeader.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  } else if (locationSuitesList) {
    locationSuitesList.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }
});

document.addEventListener("DOMContentLoaded", () => {
  const previewModal = document.getElementById("suite-template-preview-modal");
  const closeBtn     = document.getElementById("suite-template-preview-close");
  const overlay      = previewModal?.querySelector(".suite-template-modal-overlay");

  function hidePreview() {
    if (!previewModal) return;
    previewModal.style.display = "none";
    previewModal.setAttribute("aria-hidden", "true");
  }

  closeBtn?.addEventListener("click", hidePreview);
  overlay?.addEventListener("click", hidePreview);
});

//Reset Application template 
// Global builder state
let currentTemplate = null;
let applicantRows  = [];
let experienceRows = [];
let customSections = [];

// create a blank template object
function getEmptyTemplate() {
  return {
    sections: {
      applicantTitle:  { label: "Applicant information" },
      experienceTitle: { label: "Professional experience" },
      applicant:  [],
      experience: [],
      custom:     [],
    },
  };
}

// completely clear JS + DOM state for the builder
function resetTemplateBuilder() {
  currentTemplate  = getEmptyTemplate();
  applicantRows    = currentTemplate.sections.applicant;
  experienceRows   = currentTemplate.sections.experience;
  customSections   = currentTemplate.sections.custom;

  // 🔹 clear the DOM lists/inputs the user sees
  const appList = document.getElementById("builder-applicant-rows");
  const expList = document.getElementById("builder-experience-rows");
  const customList = document.getElementById("builder-custom-sections");

  if (appList)    appList.innerHTML = "";
  if (expList)    expList.innerHTML = "";
  if (customList) customList.innerHTML = "";

  // clear any title inputs etc if you have them
  const appTitleInput = document.getElementById("builder-applicant-title");
  const expTitleInput = document.getElementById("builder-experience-title");

  if (appTitleInput) appTitleInput.value = currentTemplate.sections.applicantTitle.label;
  if (expTitleInput) expTitleInput.value = currentTemplate.sections.experienceTitle.label;
}
function openSuiteAppBuilder(suite) {
  activeSuite = suite;

  // ⬇️ always start by clearing old in-memory data
  resetTemplateBuilder();

  const rawTpl = suite.applicationTemplate;

  if (rawTpl && String(rawTpl).trim() !== "") {
    // this suite HAS a saved template → load it into the builder
    try {
      const tpl = typeof rawTpl === "string" ? JSON.parse(rawTpl) : rawTpl;

      currentTemplate = tpl;

      // re-attach arrays so UI uses them
      applicantRows  = tpl.sections?.applicant  || [];
      experienceRows = tpl.sections?.experience || [];
      customSections = tpl.sections?.custom     || [];

      // TODO: render these rows into your DOM lists
      renderBuilderFromTemplate(tpl);
    } catch (e) {
      console.error("[suite-template] bad JSON, starting empty", e);
      resetTemplateBuilder();
    }
  } else {
    // ❗ no template saved for this suite → leave it EMPTY
    // resetTemplateBuilder() already gave you a blank state
    renderBuilderFromTemplate(currentTemplate);
  }

  // finally show the modal
  const modal = document.getElementById("suite-app-builder-modal");
  if (modal) {
    modal.style.display = "grid";
    modal.setAttribute("aria-hidden", "false");
  }
}

// =====================
// Suite gallery – preview new images
// =====================
function renderSuitePendingGalleryPreview() {
  if (!locSuiteNewGalleryPrev) return;

  locSuiteNewGalleryPrev.innerHTML = "";

  if (!pendingSuiteGalleryFiles.length) {
    locSuiteNewGalleryPrev.textContent = "";
    return;
  }

  pendingSuiteGalleryFiles.forEach((file, index) => {
    const wrapper = document.createElement("div");
    wrapper.className = "gallery-thumb-wrapper";

    const img = document.createElement("img");
    img.className = "suite-gallery-thumb";
    img.src = URL.createObjectURL(file);
    img.alt = file.name;

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "gallery-thumb-remove";
    removeBtn.textContent = "×";

    removeBtn.addEventListener("click", () => {
      pendingSuiteGalleryFiles.splice(index, 1);
      renderSuitePendingGalleryPreview();
    });

    wrapper.appendChild(img);
    wrapper.appendChild(removeBtn);
    locSuiteNewGalleryPrev.appendChild(wrapper);
  });
}

if (locSuiteGalleryInput) {
  locSuiteGalleryInput.addEventListener("change", () => {
    const files = Array.from(locSuiteGalleryInput.files || []);

    files.forEach((file) => {
      pendingSuiteGalleryFiles.push(file);
    });

    // clear the native input so you can re-select the same file if needed
    locSuiteGalleryInput.value = "";

    renderSuitePendingGalleryPreview();
  });
}
const appModeRadios = document.querySelectorAll(
  'input[name="loc-suite-app-mode"]'
);



  const locAboutInput      = document.getElementById("loc-about");
  const locGalleryInput    = document.getElementById("loc-gallery-files");

  const locationDetailsAbout   = document.getElementById("location-details-about");
  const locationDetailsGallery = document.getElementById("location-details-gallery");



const locationAboutToggleBtn = document.getElementById("location-about-toggle");


const aboutToggleBtn        = document.getElementById("location-details-about-toggle");
const detailsToggleBtn      = document.getElementById("location-details-desc-toggle");




// 🆕 keep track of all gallery files selected (across multiple clicks)
let pendingGalleryFiles = [];



// =====================
// New gallery preview logic
// =====================
if (locGalleryInput && locNewGalleryPreview) {
  locGalleryInput.addEventListener("change", () => {
    const files = Array.from(locGalleryInput.files || []);
    if (!files.length) return;

    // 👇 APPEND new files instead of replacing
    pendingGalleryFiles = pendingGalleryFiles.concat(files);

    // clear the native input so OS lets you pick the same file again if needed
    locGalleryInput.value = "";

    renderPendingGalleryPreview();
  });
}
function autoResizeTextarea(el) {
  if (!el) return;
  el.style.height = "auto";              // reset
  el.style.height = el.scrollHeight + "px"; // grow to fit content
}

// grow while typing
detailsInput?.addEventListener("input", () => autoResizeTextarea(detailsInput));
locAboutInput?.addEventListener("input", () => autoResizeTextarea(locAboutInput));




function slugify(s) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function hideLocationsHeader() {
  if (locationsHeader) {
    locationsHeader.style.display = "none";
  }
}

function showLocationsHeader() {
  if (locationsHeader) {
    // let CSS decide (block/flex/etc)
    locationsHeader.style.display = "";
  }
}



const locationViewPublicBtn = document.getElementById("location-view-public-btn");

const locationTotalRent = document.getElementById("location-total-rent");


  // near the top of the file with other suite/location globals

let suiteGalleryRemoveSet = new Set();    // 🆕 track gallery images to remove

  // suites currently loaded for this location
  let currentLocationSuites = [];

let selectedLocation = null;
let suitePhotoMarkedForRemoval = false;


// 🎨 Location style controls
const locationStyleBtn        = document.getElementById("location-style-btn");
const locationStyleModal      = document.getElementById("location-style-modal");
const locationStyleCloseBtn   = document.getElementById("location-style-close-btn");
const locationStyleCancelBtn  = document.getElementById("location-style-cancel-btn");
const locationStyleSaveBtn    = document.getElementById("location-style-save-btn");

// inputs + preview
const locStyleBgColorInput    = document.getElementById("location-style-bg-color");
const locStyleTextColorInput  = document.getElementById("location-style-text-color");
const locStyleBgImageInput    = document.getElementById("location-style-bg-image");
const locStyleBgPreview       = document.getElementById("location-style-bg-preview");

// 🔹 Track existing gallery + which ones to remove
let existingGalleryUrls = [];
let galleryRemoveSet = new Set();

//Go to location/Suite Dynamic page 
locationViewPublicBtn?.addEventListener("click", () => {
  if (!selectedLocation) {
    alert("Open a location first.");
    return;
  }

  // Prefer an explicit slug from the record
  let slug = selectedLocation.slug;

  // Fallback: build one from the name if needed
  if (!slug) {
    slug = slugify(selectedLocation.name || "");
  }

  if (!slug) {
    alert("This location doesn’t have a public page yet.");
    return;
  }

  // 🔗 CHANGE THIS if your Suite page uses a different route
  // Right now this opens: /[slug]
  // If later you make /[slug]/suites, change it to `/${slug}/suites`
  const url = `/${encodeURIComponent(slug)}`;

  // open in a new tab so you don’t lose the admin page
  window.open(url, "_blank");
});

// open / close helpers
function openLocationStyleModal() {
  if (!locationStyleModal) return;
  locationStyleModal.hidden = false;
  locationStyleModal.style.display = "grid";     // match .auth-modal
  document.body.classList.add("modal-open");
}

function closeLocationStyleModal() {
  if (!locationStyleModal) return;
  locationStyleModal.hidden = true;
  locationStyleModal.style.display = "none";
  document.body.classList.remove("modal-open");
}

// 🔍 Open button in Location details (🎨 icon)
locationStyleBtn?.addEventListener("click", () => {
  if (!selectedLocation) {
    alert("Open a location first.");
    return;
  }

  console.log("[location-style] open panel for:", selectedLocation);

  // prefill bg color
  if (locStyleBgColorInput) {
    const val =
      selectedLocation.bgColor && /^#/.test(selectedLocation.bgColor)
        ? selectedLocation.bgColor
        : "#ffffff";
    locStyleBgColorInput.value = val;
  }

  // prefill text color
  if (locStyleTextColorInput) {
    const val =
      selectedLocation.textColor && /^#/.test(selectedLocation.textColor)
        ? selectedLocation.textColor
        : "#000000";
    locStyleTextColorInput.value = val;
  }

  // show current bg image (or default message)
  if (locStyleBgPreview) {
    locStyleBgPreview.innerHTML = "";
    if (selectedLocation.bgImageUrl) {
      const img = document.createElement("img");
      img.src = selectedLocation.bgImageUrl;
      img.alt = "Location background image";
      img.className = "location-style-bg-thumb";
      locStyleBgPreview.appendChild(img);
    } else {
      locStyleBgPreview.innerHTML =
        '<p class="muted">No background image yet.</p>';
    }
  }

  // clear file input
  if (locStyleBgImageInput) locStyleBgImageInput.value = "";

  openLocationStyleModal();
});

// ❌ Close / cancel buttons
locationStyleCloseBtn?.addEventListener("click", closeLocationStyleModal);
locationStyleCancelBtn?.addEventListener("click", closeLocationStyleModal);

// click outside card to close
locationStyleModal?.addEventListener("click", (e) => {
  if (e.target === locationStyleModal) {
    closeLocationStyleModal();
  }
});

// 🖼 Live preview when user picks a new background image
locStyleBgImageInput?.addEventListener("change", () => {
  if (!locStyleBgPreview) return;

  const file = locStyleBgImageInput.files?.[0];
  if (!file) {
    locStyleBgPreview.innerHTML =
      '<p class="muted">No background image yet.</p>';
    return;
  }

  // Clear any previous content/text
  locStyleBgPreview.innerHTML = "";

  // Create a temporary preview image
  const img = document.createElement("img");
  img.alt = "Preview background image";
  img.className = "location-style-bg-thumb";
  img.src = URL.createObjectURL(file);

  img.onload = () => {
    URL.revokeObjectURL(img.src);
  };

  locStyleBgPreview.appendChild(img);
});

// 💾 Save style
locationStyleSaveBtn?.addEventListener("click", async () => {
  console.log("[location-style] Save clicked");

  if (!selectedLocation || !selectedLocation.id) {
    alert("Open a location first.");
    return;
  }

  const recId = selectedLocation.id;

  const bgColor   = locStyleBgColorInput?.value || "";
  const textColor = locStyleTextColorInput?.value || "";

  let bgImageUrl = selectedLocation.bgImageUrl || "";

  // If user picked a new background image, upload it
  if (locStyleBgImageInput && locStyleBgImageInput.files[0]) {
    const fd = new FormData();
    fd.append("file", locStyleBgImageInput.files[0]);

    try {
      const uploadRes = await fetch(`${API_BASE}/api/upload`, {
        method: "POST",
        credentials: "include",
        body: fd,
      });

      if (!uploadRes.ok) {
        const txt = await uploadRes.text().catch(() => "");
        console.warn("[location-style] bg upload failed", uploadRes.status, txt);
        alert("Couldn't upload background image.");
        return; // stop save if upload failed
      } else {
        const body = await uploadRes.json().catch(() => ({}));
        if (body && body.url) {
          bgImageUrl = body.url;
        }
      }
    } catch (err) {
      console.error("[location-style] upload error", err);
      alert("Something went wrong uploading the background image.");
      return;
    }
  }

// Build only the style fields
const values = {};
if (bgColor)    values["Background Color"]  = bgColor;
if (textColor)  values["Text Color"]        = textColor;
if (bgImageUrl) values["Background Image"]  = bgImageUrl;

  try {
    const res = await fetch(
      `${API_BASE}/api/records/Suite/${encodeURIComponent(recId)}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ values }),
      }
    );

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      console.warn("[location-style] save failed", res.status, txt);
      alert("Couldn't save style settings. Check console for details.");
      return;
    }

    const saved = await res.json().catch(() => null);
    console.log("[location-style] saved", saved);

    // Update in-memory copy
    selectedLocation.bgColor    = bgColor;
    selectedLocation.textColor  = textColor;
    selectedLocation.bgImageUrl = bgImageUrl;

    // Refresh preview block with the *saved* image
    if (locStyleBgPreview) {
      locStyleBgPreview.innerHTML = "";
      if (bgImageUrl) {
        const img = document.createElement("img");
        img.src = bgImageUrl;
        img.alt = "Location background image";
        img.className = "location-style-bg-thumb";
        locStyleBgPreview.appendChild(img);
      } else {
        locStyleBgPreview.innerHTML =
          '<p class="muted">No background image yet.</p>';
      }
    }

    alert("Style saved.");
    closeLocationStyleModal();
  } catch (err) {
    console.error("[location-style] error", err);
    alert("Something went wrong while saving style.");
  }
});





  if (!formCard || !addBtn || !form || !nameInput || !addressInput || !listEl) {
    console.warn("[locations] form or list elements missing");
    return;
  }

  // 👇 IMPORTANT: do NOT return early here anymore.
  // If not logged in, show a note but keep the UI working.
if (!currentUser || !currentUser.id) {
  console.warn("[locations] no current user; will require login on save");
  listEl.innerHTML = `<p class="muted">Log in to add and manage locations.</p>`;
  addBtn.disabled = true;
  formCard.hidden = true;
  return;  // 🔴 important: don't call loadLocations or hook submit
}
  let locations = [];

  // Normalize one record from the API
function normalizeLocation(row) {
  const v = row.values || row;

  const aboutRaw =
    v["About"] ||
    v["About Location"] ||
    "";

  const galleryRaw =
    v["Location Gallery"] ||
    v["Gallery Images"] ||
    [];

  const gallery = Array.isArray(galleryRaw) ? galleryRaw : [];

  return {
    id: row._id || row.id || "",
    slug: v["Slug"] || v.slug || "",   // 🆕 add this
    name: v["Location Name"] || v.LocationName || "",
    address: v.Address || v.address || "",
    phone: v["Phone Number"] || v.PhoneNumber || "",
    details: v["Details"] || v.Details || "",
    photoUrl:
      v["Location Photo"] ||
      v["Photo URL"] ||
      v.photoUrl ||
      null,
    about: aboutRaw,
    gallery,

    // 🆕 style fields (pulled from the record)
    bgColor:
      v["Background Color"] ||
      v.bgColor ||
      "",
    textColor:
      v["Text Color"] ||
      v.textColor ||
      "",
    bgImageUrl:
      v["Background Image"] ||
      v.bgImageUrl ||
      "",
  };
}

const ABOUT_CHAR_LIMIT = 160;  // change this number if you want more/less

function applyAboutText(fullText) {
  if (!locationDetailsAbout) return;

  const trimmed = (fullText || "").trim();

  // If nothing, show dash and hide button
  if (!trimmed) {
    locationDetailsAbout.textContent = "—";
    locationDetailsAbout.dataset.full = "";
    locationDetailsAbout.dataset.short = "";
    locationDetailsAbout.dataset.expanded = "false";
    if (locationAboutToggleBtn) {
      locationAboutToggleBtn.style.display = "none";
    }
    return;
  }

  const isLong = trimmed.length > ABOUT_CHAR_LIMIT;
  const shortVersion = isLong
    ? trimmed.slice(0, ABOUT_CHAR_LIMIT) + "…"
    : trimmed;

  // Store both versions + state on the element
  locationDetailsAbout.dataset.full = trimmed;
  locationDetailsAbout.dataset.short = shortVersion;
  locationDetailsAbout.dataset.expanded = "false";

  // Show short by default
  locationDetailsAbout.textContent = shortVersion;

  // Show/hide button
  if (locationAboutToggleBtn) {
    locationAboutToggleBtn.style.display = isLong ? "inline-block" : "none";
    locationAboutToggleBtn.textContent = "Show more";
  }
}

locationAboutToggleBtn?.addEventListener("click", () => {
  if (!locationDetailsAbout) return;

  const expanded = locationDetailsAbout.dataset.expanded === "true";
  const full  = locationDetailsAbout.dataset.full || "";
  const short = locationDetailsAbout.dataset.short || full;

  if (expanded) {
    // Go back to short
    locationDetailsAbout.textContent = short;
    locationDetailsAbout.dataset.expanded = "false";
    locationAboutToggleBtn.textContent = "Show more";
  } else {
    // Show full text
    locationDetailsAbout.textContent = full;
    locationDetailsAbout.dataset.expanded = "true";
    locationAboutToggleBtn.textContent = "Show less";
  }
});

  // Render the list in the DOM
  function renderLocations() {
    listEl.innerHTML = "";

    if (!locations.length) {
      listEl.innerHTML = `<p class="muted">No locations yet. Click “Add location” to create one.</p>`;
      return;
    }

    locations.forEach((loc) => {
    const card = document.createElement("div");
    card.className = "location-item";

   card.innerHTML = `
  <div class="location-main-row">
    <div class="location-main-inline">
      ${
        loc.photoUrl
          ? `<img class="location-thumb" src="${loc.photoUrl}" alt="${loc.name}" />`
          : ""
      }
      <div class="location-main-text">
        <h3>${loc.name}</h3>
        <p>${loc.address}</p>
        ${loc.phone ? `<p class="muted">${loc.phone}</p>` : ""}
      </div>
    </div>
  </div>
`;



      // 🔹 click → open details view
    // ✅ when you click a LOCATION card, show LOCATION details
    card.addEventListener("click", () => {
      showLocationDetails(loc);
    });

      listEl.appendChild(card);
    });
  }


// Load saved locations for this user from the backend
async function loadLocations() {
  const ownerFilter =
    currentUser && currentUser.id
      ? `&ownerUserId=${encodeURIComponent(currentUser.id)}`
      : "";

  // 👈 use the Suite DataType again (where your locations are stored)
  const url =
    `${API_BASE}/public/records` +
    `?dataType=Suite${ownerFilter}&limit=200`;

  try {
    const res = await fetch(url, {
      credentials: "include",
      headers: { Accept: "application/json" },
    });

    if (!res.ok) {
      console.warn("[locations] load failed", res.status);
      locations = [];
      window.STATE.locations = locations;
      renderLocations();
      updateDashboardCounts();
      return;
    }

    const data = await res.json();
    const rows = Array.isArray(data)
      ? data
      : data.records || data.items || [];

    // ✅ keep ONLY top-level "locations", NOT child suites
    const topLevelLocationRows = rows.filter((row) => {
      const v = row.values || row;

      // if this record has a Location reference, it's a *Suite*, not a top-level location
      const locRef =
        v.Location ||
        v["Location"] ||
        v.location ||
        null;

      if (locRef) return false; // child suite ⇒ skip

      // bonus: make sure it actually looks like a location
      const hasLocationName =
        v["Location Name"] ||
        v.LocationName ||
        "";
      return !!hasLocationName;
    });

 
  locations = topLevelLocationRows.map(normalizeLocation);
  window.STATE.locations = locations;

  renderLocations();
  updateDashboardCounts();

  if (window.refreshSuitieLocationDropdown) {
    window.refreshSuitieLocationDropdown();
  }

  // 👇 this keeps the Suites dropdown in sync with Locations
  if (window.refreshSuitesLocationDropdown) {
    window.refreshSuitesLocationDropdown();
  }

  } catch (err) {
    console.error("[locations] load error", err);
    locations = [];
    window.STATE.locations = locations;
    renderLocations();
    updateDashboardCounts();
  }
}

// Start state
formCard.hidden = true;
loadLocations();

// Load Suites (rooms) so the Suites tab + Applications table can work
loadSuitesForUser();        // ✅ fills Suite data + dropdown
renderSuitesList();         // ✅ renders the Suites list
loadAllSuiteApplications(); // ✅ populates the Applications table



  // Open the form when "Add location" is clicked
  addBtn.addEventListener("click", () => {
  formCard.hidden = false;
  form.reset();
  idInput.value = "";          // new create
  selectedLocation = null;     // not editing any existing one

  // hide details while adding
  if (locationDetailsCard) {
    locationDetailsCard.style.display = "none";
  }
  listEl.style.display = "block"; // or keep as you prefer

  // 🔹 RESET IMAGE STUFF 🔹
  // clear current main photo preview
  if (locCurrentPhoto) {
    locCurrentPhoto.textContent = "No photo uploaded yet.";
    locCurrentPhoto.innerHTML = locCurrentPhoto.textContent;
  }

  // clear current gallery preview
  if (locCurrentGallery) {
    locCurrentGallery.textContent = "No gallery images yet.";
    locCurrentGallery.innerHTML = locCurrentGallery.textContent;
  }

  // clear “new images” preview + array
  pendingGalleryFiles = [];
  if (locNewGalleryPreview) {
    locNewGalleryPreview.textContent = "";
    locNewGalleryPreview.innerHTML = locNewGalleryPreview.textContent;
  }

  // clear file inputs so nothing is pre-selected
// clear file inputs so nothing is pre-selected
if (photoFileInput)  photoFileInput.value  = "";
if (locGalleryInput) locGalleryInput.value = "";

});


  // Cancel button closes + clears form
 if (cancelBtn) {
  cancelBtn.addEventListener("click", () => {
    form.reset();
    formCard.hidden = true;

    // If we have a selectedLocation, we were editing → go back to details
    if (selectedLocation) {
      // show details, hide list
      if (locationDetailsCard) locationDetailsCard.style.display = "block";
      if (listEl)              listEl.style.display              = "none";

      // re-render details so they’re fresh
      showLocationDetails(selectedLocation);
    } else {
      // no selectedLocation = we were adding a new location → go back to list
      if (listEl)              listEl.style.display              = "block";
      if (locationDetailsCard) locationDetailsCard.style.display = "none";
    }
  });
}


  function applyExpandableText(el, btn, fullText, limit = 160) {
  if (!el || !btn) return;

  const text = String(fullText || "").trim();
  if (!text) {
    el.textContent = "—";
    btn.style.display = "none";
    el.dataset.full = "";
    return;
  }

  el.dataset.full = text;

  if (text.length <= limit) {
    el.textContent = text;
    btn.style.display = "none";
    btn.dataset.state = "collapsed";
    return;
  }

  el.textContent = text.slice(0, limit) + "…";
  btn.style.display = "";
  btn.textContent = "Show more";
  btn.dataset.state = "collapsed";
}

function toggleExpandableText(el, btn, limit = 160) {
  if (!el || !btn) return;

  const full  = el.dataset.full || "";
  const state = btn.dataset.state || "collapsed";

  if (state === "collapsed") {
    el.textContent = full;
    btn.textContent = "Show less";
    btn.dataset.state = "expanded";
  } else {
    el.textContent = full.length > limit ? full.slice(0, limit) + "…" : full;
    btn.textContent = "Show more";
    btn.dataset.state = "collapsed";
  }
}
aboutToggleBtn?.addEventListener("click", () => {
  toggleExpandableText(locationDetailsAbout, aboutToggleBtn, 160);
});

detailsToggleBtn?.addEventListener("click", () => {
  toggleExpandableText(locationDetailsDesc, detailsToggleBtn, 160);
});

async function showLocationDetails(loc) {
  if (!locationDetailsCard) return;

  selectedLocation = loc;

  // 🆕 update the “Go to …” button label
  const publicNameSpan = document.getElementById("location-view-public-name");
  if (publicNameSpan) {
    publicNameSpan.textContent = loc.name || "Location";
  }


  // 🆕 normalized about + gallery (define FIRST)
  const aboutRaw = loc.about || "";
  const gallery  = Array.isArray(loc.gallery) ? loc.gallery : [];

  // Basic info
  if (locationDetailsName) {
    locationDetailsName.textContent = loc.name || "Location details";
  }

  // also show the name inside the suite form label
  if (locSuiteLocationName) {
    locSuiteLocationName.textContent = loc.name || "";
  }

  if (locationDetailsAddr) {
    locationDetailsAddr.textContent = loc.address || "";
  }

  if (locationDetailsAddrFull) {
    locationDetailsAddrFull.textContent = loc.address || "—";
  }

  if (locationDetailsPhone) {
    locationDetailsPhone.textContent = loc.phone || "—";
  }

  // Details (short + show more)
  applyExpandableText(
    locationDetailsDesc,
    detailsToggleBtn,
    loc.details,
    200
  );

  // About (short + show more)
  applyExpandableText(
    locationDetailsAbout,
    aboutToggleBtn,
    aboutRaw,
    200
  );

  // About text with truncation + toggle (your helper)
  applyAboutText(aboutRaw);

  // Photo
  if (locationDetailsPhoto) {
    if (loc.photoUrl) {
      locationDetailsPhoto.src = loc.photoUrl;
      locationDetailsPhoto.style.display = "block";
    } else {
      locationDetailsPhoto.src = "";
      locationDetailsPhoto.style.display = "none";
    }
  }

  // Gallery
  if (locationDetailsGallery) {
    locationDetailsGallery.innerHTML = "";
    if (gallery.length) {
      gallery.forEach((url) => {
        const img = document.createElement("img");
        img.src = url;
        img.className = "location-gallery-thumb";
        locationDetailsGallery.appendChild(img);
      });
    } else {
      locationDetailsGallery.innerHTML =
        `<p class="muted">No gallery images yet.</p>`;
    }
  }

  // Start by showing "Loading…" while we calculate total rent
   // Start by showing "Loading…" while we calculate total rent
  if (locationTotalRentEl) locationTotalRentEl.textContent = "Loading…";
  if (locationYearRentEl)  locationYearRentEl.textContent  = "Loading…";

  // Load suites for this location into the list
  if (loc.id) {
    await loadSuitesForLocation(loc.id);
  }

  // Fetch all Suitie records where Location = this location.id
  try {
    const url =
      `${API_BASE}/public/records` +
      `?dataType=Suitie&Location=${encodeURIComponent(loc.id)}&limit=500`;

    const res = await fetch(url, {
      credentials: "include",
      headers: { Accept: "application/json" },
    });

    if (!res.ok) {
      console.warn("[locations] total rent fetch failed", res.status);
      if (locationTotalRentEl) locationTotalRentEl.textContent = "—";
      if (locationYearRentEl)  locationYearRentEl.textContent  = "—";
    } else {
      const data = await res.json();
      const rows = Array.isArray(data)
        ? data
        : data.records || data.items || [];

      let monthlyTotal = 0;      // sum of suite rent (per month)
      let paidThisYear = 0;      // sum of rent where rent has been PAID this year
      const currentYear = new Date().getFullYear();

      rows.forEach((row) => {
        const v = row.values || row;

    // 🔹 Only include Suities whose Location matches THIS location
  const locRef = v["Location"] || v.Location || v.location;
  const locRefId =
    locRef && (locRef._id || locRef.id || locRef); // handles { _id }, { id }, or plain string

  if (!locRefId || String(locRefId) !== String(loc.id)) {
    // this Suitie belongs to some other location → skip
    return;
  }
      
        // ----- Get rent amount -----
        const rentRaw = v["Suite Rent"];
        let rent = 0;

        if (typeof rentRaw === "number") {
          rent = rentRaw;
        } else if (typeof rentRaw === "string" && rentRaw.trim() !== "") {
          const num = Number(rentRaw);
          if (!Number.isNaN(num)) rent = num;
        }

        if (!rent) return; // nothing to add

        // Always count into "total suite rent (per month)"
        monthlyTotal += rent;

        // ----- Only count PAID rent into yearly total -----
        const paidRaw =
          v["Rent Paid Date"] ||
          v["Rent Paid"] ||
          v.rentPaid ||
          null;

        if (!paidRaw) return;

        const paidDate = new Date(paidRaw);
        if (
          !Number.isNaN(paidDate.getTime()) &&
          paidDate.getFullYear() === currentYear
        ) {
          paidThisYear += rent;
        }
      });

      // Monthly total (keeps your existing $690.00 line)
      if (locationTotalRentEl) {
        locationTotalRentEl.textContent =
          "$" +
          monthlyTotal.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          });
      }

      // 🔹 New: only show amount actually PAID this year
      if (locationYearRentEl) {
        locationYearRentEl.textContent =
          "$" +
          paidThisYear.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          });
      }
    }
  } catch (err) {
    console.error("[locations] total rent error", err);
    if (locationTotalRentEl) locationTotalRentEl.textContent = "—";
    if (locationYearRentEl)  locationYearRentEl.textContent  = "—";
  }

  //Add Rich text to details section
  let suiteDetailsQuill = null;

function initSuiteDetailsEditor() {
  const editorEl = document.getElementById("loc-suite-details-editor");
  const toolbarEl = document.getElementById("suite-details-toolbar");
  const hiddenEl = document.getElementById("loc-suite-details");

  if (!editorEl || !toolbarEl || !hiddenEl) return;

  // prevent double-init
  if (suiteDetailsQuill) return;

  suiteDetailsQuill = new Quill(editorEl, {
    theme: "snow",
    modules: { toolbar: toolbarEl },
  });

  // keep hidden input updated with HTML
  suiteDetailsQuill.on("text-change", () => {
    hiddenEl.value = suiteDetailsQuill.root.innerHTML;
  });

  // start empty
  hiddenEl.value = "";
}

function setSuiteDetailsHTML(html) {
  const hiddenEl = document.getElementById("loc-suite-details");
  if (hiddenEl) hiddenEl.value = html || "";

  if (suiteDetailsQuill) {
    suiteDetailsQuill.root.innerHTML = html || "";
  }
}


  //Increase location details area when text overflows 
  const ta = document.getElementById("loc-suite-details");

function autoGrow(el){
  el.style.height = "auto";
  el.style.height = el.scrollHeight + "px";
}

if (ta){
  autoGrow(ta); // if it already has content
  ta.addEventListener("input", () => autoGrow(ta));
}


  // ✅ ALWAYS reset layout to "location details" mode
  if (locationDetailsGrid)      locationDetailsGrid.style.display      = "grid";
  if (locationSuitesHeader)     locationSuitesHeader.style.display     = "flex";
  if (locationSuitesList)       locationSuitesList.style.display       = "block";
  if (locationSuiteDetailsCard) locationSuiteDetailsCard.style.display = "none";
  if (locationSuiteFormCard)    locationSuiteFormCard.style.display    = "none";

  // Show details card, hide list + form
  listEl.style.display = "none";
  formCard.hidden = true;
  locationDetailsCard.style.display = "block";
  
}





















////////////////////////////////Suite Details 

function openSuiteDetails(suite) {
  if (!suite) return;
  activeSuite = suite;

  // hide the location layout while suite details are open
  if (locationDetailsGrid)  locationDetailsGrid.style.display  = "none";
  if (locationSuitesHeader) locationSuitesHeader.style.display = "none";
  if (locationSuitesList)   locationSuitesList.style.display   = "none";

    // 👇 HIDE location Edit / Delete buttons while suite details are open
  if (locationEditBtn) locationEditBtn.style.display = "none";
  if (deleteBtn)       deleteBtn.style.display       = "none";
  if (locationScrollSuitesBtn) locationScrollSuitesBtn.style.display = "none";

  // 🔹 fill your existing suite detail fields (you probably already do this somewhere):
  if (locationSuiteDetailsName) {
    locationSuiteDetailsName.textContent = suite.name || "Suite details";
  }
  if (locationSuiteDetailsAvail) {
    locationSuiteDetailsAvail.textContent =
      suite.availableText || suite.available || "—";
  }
  if (locationSuiteDetailsNotes) {
    locationSuiteDetailsNotes.textContent = suite.details || suite.notes || "—";
  }

  // 🔹 Show Rate (Rent Amount + Frequency)
if (locationSuiteDetailsRate) {
  // read from normalized suite OR raw values
  const v = suite.values || suite;

  const rawAmount =
    suite.rentAmount ??
    v["Rent Amount"] ??
    v["Suite Rent Amount"] ??
    v.rentAmount ??
    null;

  const rawFrequency =
    suite.rentFrequency ||
    v["Rent Frequency"] ||
    v["Rent Schedule"] ||
    v.rentFrequency ||
    "";

  let rateText = "Contact for rate";

  if (rawAmount !== null && rawAmount !== "") {
    const num = Number(rawAmount);
    const amountStr = Number.isFinite(num)
      ? num.toLocaleString(undefined, {
          minimumFractionDigits: 0,
          maximumFractionDigits: 2,
        })
      : String(rawAmount);

    const freqStr = String(rawFrequency || "").trim();

    rateText = freqStr
      ? `$${amountStr} / ${freqStr}`
      : `$${amountStr}`;
  }

  locationSuiteDetailsRate.textContent = rateText;
}

  // default photo
  if (locationSuiteDetailsPhoto) {
    if (suite.photoUrl) {
      locationSuiteDetailsPhoto.src = suite.photoUrl;
      locationSuiteDetailsPhoto.style.display = "block";
    } else {
      locationSuiteDetailsPhoto.src = "";
      locationSuiteDetailsPhoto.style.display = "none";
    }
  }

  // gallery
  if (locationSuiteDetailsGallery) {
    locationSuiteDetailsGallery.innerHTML = "";
    const gallery = Array.isArray(suite.gallery) ? suite.gallery : [];
    if (gallery.length) {
      gallery.forEach((url) => {
        const img = document.createElement("img");
        img.src = url;
        img.className = "suite-gallery-thumb";
        locationSuiteDetailsGallery.appendChild(img);
      });
    } else {
      locationSuiteDetailsGallery.innerHTML =
        `<p class="muted">No gallery images yet.</p>`;
    }
  }

  // label the back button with the current location name
  if (locationSuiteDetailsLocName && selectedLocation) {
    locationSuiteDetailsLocName.textContent =
      selectedLocation.name || "location";
  }


  // 🔹 Application template + PDF (NOW INSIDE THE FUNCTION)
// 🔹 Application template + PDF – show TEMPLATE instead of PDF if present
if (suiteDetailsAppText && suiteDetailsAppPdf && suiteDetailsAppButton) {
  // reset view
  suiteDetailsAppText.textContent = "No application added yet.";
  suiteDetailsAppPdf.style.display = "none";
  suiteDetailsAppButton.style.display = "none";
  suiteDetailsAppPdf.href = "#";
  suiteDetailsAppButton.onclick = null;

  // read values from the suite record (use values or direct)
  const v = suite.values || suite;

  const templateRaw =
    v.applicationTemplate ||
    v["Application Template"] ||
    "";

  const pdfUrl =
    v.applicationFileUrl ||
    v.applicationPdf ||
    v["Application File"] ||
    v["Application PDF"] ||
    v["Application PDF URL"] ||
    "";
  console.log("[suite-details] template/PDF block:", {
    templateRaw,
    templateRawType: typeof templateRaw,
    templateTrimmed: String(templateRaw || "").slice(0, 80),
    pdfUrl,
  });
const hasTemplate = !!(templateRaw && String(templateRaw).trim());
const hasFile     = !!pdfUrl;

console.log("[suite-details] open for suite:", {
  id: suite.id,
  name: suite.name,
  hasTemplate,
  hasFile,          // ✅ use hasFile instead of hasPdf
  templatePreview:
    typeof templateRaw === "string"     // ✅ log the same thing you read
      ? String(templateRaw).slice(0, 120)
      : templateRaw,
  pdfUrl,                                // ✅ clearer key name
});


  if (hasTemplate) {
    // ✅ We prefer the TEMPLATE preview here
    suiteDetailsAppText.textContent = hasFile
      ? "Template (and PDF) attached."
      : "Application form template";

    // hide the PDF link in the details card
    suiteDetailsAppPdf.style.display = "none";

    // show the "View application" button
    suiteDetailsAppButton.style.display = "inline-block";
    suiteDetailsAppButton.textContent = "View application";

    // when clicked → open read-only preview modal
    suiteDetailsAppButton.onclick = () => {
      // pass the raw JSON string (or object) into the preview helper
      openSuiteTemplatePreview(templateRaw);
    };

    // keep hidden input in sync so the builder can still edit it
    if (templateInput) {
      templateInput.value =
        typeof templateRaw === "string"
          ? templateRaw
          : JSON.stringify(templateRaw || {});
    }
  } else if (hasFile) {
    // 🤷 No template, but there *is* a PDF → just show link
    suiteDetailsAppText.textContent = "Application PDF:";
    suiteDetailsAppPdf.href = pdfUrl;
    suiteDetailsAppPdf.style.display = "inline-block";
    suiteDetailsAppButton.style.display = "none";
  } else {
    // nothing
    suiteDetailsAppText.textContent = "No application added yet.";
    suiteDetailsAppPdf.style.display = "none";
    suiteDetailsAppButton.style.display = "none";
  }
}


  // 🔹 load submitted applications for this suite
  if (typeof showSuiteApplications === "function") {
    showSuiteApplications(suite);
  }

  // finally show the suite details card
  if (locationSuiteDetailsCard) {
    locationSuiteDetailsCard.style.display = "block";
  }
}


// Back button in location details (← Back to locations)
// Back button in location details (← Back to locations)
locationBackBtn?.addEventListener("click", () => {
  selectedLocation = null;
  activeSuite = null;

  if (locationSuiteDetailsCard) locationSuiteDetailsCard.style.display = "none";
  if (locationSuiteFormCard)    locationSuiteFormCard.style.display    = "none";
  if (locationDetailsCard)      locationDetailsCard.style.display      = "none";

  if (listEl)          listEl.style.display          = "block";
  if (locationsHeader) locationsHeader.style.display = "flex";
});

// Back button inside the suite form (← Back to location details)
locationSuiteBackBtn?.addEventListener("click", () => {
  if (locationSuiteFormCard) locationSuiteFormCard.style.display = "none";

  if (locationDetailsCard)  locationDetailsCard.style.display  = "block";
  if (locationDetailsGrid)  locationDetailsGrid.style.display  = "grid";
  if (locationSuitesList)   locationSuitesList.style.display   = "block";
});

// 🆕 Back button inside the suite *details* card
locationSuiteDetailsBackBtn?.addEventListener("click", () => {
  if (locationSuiteDetailsCard) locationSuiteDetailsCard.style.display = "none";

  if (locationDetailsCard)  locationDetailsCard.style.display  = "block";
  if (locationDetailsGrid)  locationDetailsGrid.style.display  = "grid";
  if (locationSuitesHeader) locationSuitesHeader.style.display = "flex";
  if (locationSuitesList)   locationSuitesList.style.display   = "block";
    
  // 👇 SHOW location Edit / Delete again
  if (locationEditBtn) locationEditBtn.style.display = "";
  if (deleteBtn)       deleteBtn.style.display       = "";
   if (locationScrollSuitesBtn) locationScrollSuitesBtn.style.display = "";
});


// =====================
// Edit Location
// =====================
locationEditBtn?.addEventListener("click", () => {
  if (!selectedLocation) return;

  // Prefill form
  idInput.value      = selectedLocation.id || "";
  nameInput.value    = selectedLocation.name || "";
  addressInput.value = selectedLocation.address || "";
  phoneInput.value   = selectedLocation.phone || "";
  detailsInput.value = selectedLocation.details || "";
locAboutInput.value = selectedLocation.about || ""; 

  autoResizeTextarea(detailsInput);
autoResizeTextarea(locAboutInput);

   // 🆕 prefill About field
  if (locAboutInput) {
    locAboutInput.value = selectedLocation.about || "";
  }

  // 🔹 Show existing main photo
  if (locCurrentPhoto) {
    locCurrentPhoto.innerHTML = "";
    if (selectedLocation.photoUrl) {
      const img = document.createElement("img");
      img.src = selectedLocation.photoUrl;
      img.alt = "Current location photo";
      img.className = "location-main-photo-preview";
      locCurrentPhoto.appendChild(img);
    } else {
      locCurrentPhoto.textContent = "No photo uploaded yet.";
    }
  }

  // 🔹 Show existing gallery images
  // 🔹 Show existing gallery images with X buttons
  renderExistingGalleryForEdit(selectedLocation.gallery || []);

  // 🔹 Reset “new images” preview
  if (locNewGalleryPreview) {
    locNewGalleryPreview.textContent = "";
  }
// reset pending gallery for this edit
pendingGalleryFiles = [];
renderPendingGalleryPreview();

  // clear file inputs (browser won't allow prefilling)
  if (photoFileInput) photoFileInput.value = "";
  if (locGalleryInput) locGalleryInput.value = "";



  // Show form, hide others
  formCard.hidden = false;
  locationDetailsCard.style.display = "none";
  listEl.style.display = "none";

  form.scrollIntoView({ behavior: "smooth" });
});


// Handle submit: save to backend, then reload
form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const name    = nameInput.value.trim();
  const slug = slugify(name);

  const address = addressInput.value.trim();
  const phone   = phoneInput ? phoneInput.value.trim() : "";
  const extraDetails = detailsInput ? detailsInput.value.trim() : "";
 const about   = locAboutInput   ? locAboutInput.value.trim()   : "";

  if (!name || !address) {
    alert("Please enter at least a location name and address.");
    return;
  }

  // 🔹 Base values
  const values = {
    // match your DataType fields exactly
    "Location Name": name,
    Address: address,
    "Phone Number": phone,
  Details: extraDetails,

      // 👇 NEW — both lowercase + capitalized so the API can match either
  slug,
  Slug: slug,

    ownerUserId: currentUser.id,           // your text field
    "Suitie(s)": [{ _id: currentUser.id }], // optional: tie to user ref
    "Created By": { _id: currentUser.id },  // matches your Created By reference
  };

  if (about) {
    values["About"] = about;           // 👈 match your DataType field name
  }

// 🔹 Upload main photo (existing code)
let mainPhotoUrl = "";
if (photoFileInput && photoFileInput.files[0]) {
  const fd = new FormData();
  fd.append("file", photoFileInput.files[0]);   // ✅ same variable

  const uploadRes = await fetch(`${API_BASE}/api/upload`, {
    method: "POST",
    credentials: "include",
    body: fd,
  });

  if (uploadRes.ok) {
    const body = await uploadRes.json().catch(() => ({}));
    if (body && body.url) {
      mainPhotoUrl = body.url;
      values["Location Photo"] = mainPhotoUrl;
    }
  }
}

  // 🆕 Upload gallery images (multiple)
// 🆕 Upload gallery images (multiple)
let galleryUrls = [];

// Use pendingGalleryFiles if we have them; fall back to the input as backup
const gallerySource =
  pendingGalleryFiles.length
    ? pendingGalleryFiles
    : (locGalleryInput && locGalleryInput.files
        ? Array.from(locGalleryInput.files)
        : []);

if (gallerySource.length) {
  for (const file of gallerySource) {
    const fd = new FormData();
    fd.append("file", file);

    try {
      const uploadRes = await fetch(`${API_BASE}/api/upload`, {
        method: "POST",
        credentials: "include",
        body: fd,
      });

      if (!uploadRes.ok) {
        const txt = await uploadRes.text().catch(() => "");
        console.warn("[locations] gallery upload failed", uploadRes.status, txt);
        continue;
      }

      const body = await uploadRes.json().catch(() => ({}));
      if (body && body.url) {
        galleryUrls.push(body.url);
      }
    } catch (err) {
      console.error("[locations] gallery upload error", err);
    }
  }
}

// Start from old gallery, but drop any the user X’d out
const keptOld = existingGalleryUrls.filter(
  (url) => !galleryRemoveSet.has(url)
);

// Add new uploads on top
const finalGallery = [...keptOld, ...galleryUrls];

if (finalGallery.length) {
  values["Location Gallery"] = finalGallery;
} else {
  // Optional: explicitly clear if you want
  values["Location Gallery"] = [];
}


  try {
    // Is this an edit or a new location?
    const locId = idInput.value.trim();
    const isEditing = !!locId;

    const endpoint = isEditing
      ? `${API_BASE}/api/records/Suite/${encodeURIComponent(locId)}`
      : `${API_BASE}/api/records/Suite`;

    const method = isEditing ? "PATCH" : "POST";

    const res = await fetch(endpoint, {
      method,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      credentials: "include",
      body: JSON.stringify({ values }),
    });

    // ⬇️ Read body ONCE
    const body = await res.json().catch(() => null);

    if (!res.ok || !body) {
      console.warn("[locations] save failed", res.status, body);
      alert(`Couldn't save location (${res.status}). Check console for details.`);
      return;
    }

    console.log(
      isEditing ? "[locations] updated" : "[locations] created",
      body
    );

    // 1️⃣ Re-load the locations array from the server
    await loadLocations();

    // 2️⃣ Find the saved/updated location in the in-memory list
    const savedId = body._id || body.id || locId;

    const updatedLoc = locations.find(
      (loc) => String(loc.id) === String(savedId)
    );

    // 3️⃣ Hide form and show the details for that location
    formCard.hidden = true;

    if (updatedLoc) {
      selectedLocation = updatedLoc;

      // hide list, show details card
      if (listEl) listEl.style.display = "none";
      if (locationDetailsCard)
        locationDetailsCard.style.display = "block";

      // reuse your existing helper
      showLocationDetails(updatedLoc);
    } else {
      // fallback: just go back to list if we didn’t find it
      if (listEl) listEl.style.display = "block";
      if (locationDetailsCard)
        locationDetailsCard.style.display = "none";
    }
  } catch (err) {
    console.error("[locations] save error", err);
    alert("Something went wrong while saving. Please try again.");
  }
});



// 🔹 Show existing gallery images with X buttons
function renderExistingGalleryForEdit(urls) {
  if (!locCurrentGallery) return;

  existingGalleryUrls = Array.isArray(urls) ? urls.slice() : [];
  galleryRemoveSet = new Set();

  if (!existingGalleryUrls.length) {
    locCurrentGallery.innerHTML = "No gallery images yet.";
    return;
  }

  locCurrentGallery.innerHTML = "";

  existingGalleryUrls.forEach((url) => {
    const wrap = document.createElement("div");
    wrap.className = "loc-gallery-thumb-wrap";

    const img = document.createElement("img");
    img.src = url;
    img.alt = "Gallery image";
    img.className = "location-gallery-thumb";

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "gallery-remove-btn";
    btn.textContent = "×";

    btn.addEventListener("click", () => {
      // mark this URL as “removed”
      galleryRemoveSet.add(url);
      wrap.remove();

      // if nothing left, show empty state
      const anyLeft = existingGalleryUrls.some(
        (u) => !galleryRemoveSet.has(u)
      );
      if (!anyLeft) {
        locCurrentGallery.innerHTML = "No gallery images yet.";
      }
    });

    wrap.appendChild(img);
    wrap.appendChild(btn);
    locCurrentGallery.appendChild(wrap);
  });
}


// =====================
// Delete Location
// =====================
deleteBtn?.addEventListener("click", async () => {
  if (!selectedLocation) return;

  // Use the same id you use for editing
  const recId = selectedLocation.id;

  if (!recId) {
    console.warn("[locations] no id on selectedLocation", selectedLocation);
    alert("Cannot delete this location because it has no record id.");
    return;
  }

  const ok = confirm(
    `Delete location "${selectedLocation.name || selectedLocation.locationName || ""}"?`
  );
  if (!ok) return;

  try {
    const res = await fetch(
      `${API_BASE}/api/records/Suite/${encodeURIComponent(recId)}`, // ✅ same pattern as edit
      {
        method: "DELETE",
        credentials: "include",
        headers: { Accept: "application/json" },
      }
    );

    if (!res.ok) {
      console.error("[locations] delete failed", res.status);
      alert("Could not delete this location. Please try again.");
      return;
    }

    console.log("[locations] deleted", recId);

    // ✅ Reload from backend instead of manual filter
    await loadLocations();
pendingGalleryFiles = [];
renderPendingGalleryPreview();

    // Reset UI state
    selectedLocation = null;
    if (locationDetailsCard) {
      locationDetailsCard.style.display = "none";
    }
    if (listEl) {
      listEl.style.display = "block";
    }
    if (locationsHeader) {
      locationsHeader.style.display = "flex"; // or block, whatever you use
    }

    alert("Location deleted.");
  } catch (err) {
    console.error("[locations] delete error", err);
    alert("Something went wrong deleting this location.");
  }
});

function renderPendingGalleryPreview() {
  if (!locNewGalleryPreview) return;

  // No files selected → show default text
  if (!pendingGalleryFiles.length) {
    locNewGalleryPreview.innerHTML = "";
    return;
  }

  // Clear previous content
  locNewGalleryPreview.innerHTML = "";

  // Show a thumbnail for each newly picked file
  pendingGalleryFiles.forEach((file) => {
    const url = URL.createObjectURL(file);
    const img = document.createElement("img");
    img.src = url;
    img.alt = file.name || "New gallery image";
    img.className = "location-gallery-thumb";

    // Clean up the temp URL once it’s loaded
    img.onload = () => {
      URL.revokeObjectURL(url);
    };

    locNewGalleryPreview.appendChild(img);
  });
}

// =====================
// Suite Application Builder
// =====================

// 🔹 Shared hidden input that stores the JSON template
const templateInput = document.getElementById("loc-suite-application-template");

// 🔹 Status text next to "Create / edit application"
const suiteAppStatusSpan = document.getElementById("suite-app-status");

function refreshSuiteAppStatus() {
  if (!suiteAppStatusSpan || !templateInput) return;

  const val = (templateInput.value || "").trim();
  const hasTemplate = val && val !== "{}";

  suiteAppStatusSpan.textContent = hasTemplate
    ? "Template saved"
    : "No template yet";
}

(function setupSuiteAppBuilder() {
  const appModal = document.getElementById("suite-app-builder");
  if (!appModal) return;

  const openAppBtn   = document.getElementById("open-suite-app-builder");
  const closeAppBtn  = document.getElementById("suite-app-builder-close");
  const cancelAppBtn = document.getElementById("suite-app-builder-cancel");
  const saveAppBtn   = document.getElementById("suite-app-builder-save");

  // button in the Suitie card
const suiteDetailsAppButton = document.getElementById("suite-details-app-template-btn");
// button in the Location suite details card
const locationSuiteAppTemplateBtn =
  document.getElementById("location-suite-app-template-btn");


  appModal.addEventListener("click", (e) => {
  // if you clicked directly on the overlay (not inside the card), close
  if (e.target === appModal) {
    closeAppBuilder();
  }
});

function handleOpenTemplateClick() {
  if (!activeSuite) return;

  if (templateInput) {
    const tmpl =
      activeSuite.applicationTemplate ||
      activeSuite["Application Template"] ||
      "";
    templateInput.value =
      typeof tmpl === "string" ? tmpl : JSON.stringify(tmpl || {});
  }

  openAppBuilder();
}

suiteDetailsAppButton?.addEventListener("click", handleOpenTemplateClick);
locationSuiteAppTemplateBtn?.addEventListener("click", handleOpenTemplateClick);

  // =====================
  // "Add question" for Applicant + Experience sections
  // =====================

  function wireQuestionAdder(sectionId, buttonId, keyPrefix) {
    const section = document.getElementById(sectionId);
    const button  = document.getElementById(buttonId);
    if (!section || !button) return;

    let counter = 0;

    button.addEventListener("click", () => {
      counter += 1;

      const row = document.createElement("div");
      row.className = "suite-app-row";
      row.innerHTML = `
        <div class="suite-app-bullet suite-app-drag-handle"></div>
        <div
          class="suite-app-label"
          contenteditable="true"
          data-app-field="${keyPrefix}${counter}"
        >
          New question
        </div>
        <div class="suite-app-input-box">
          [text input]
        </div>
      `;

      // insert new row right above the button we clicked
      section.insertBefore(row, button);
    });
  }

  // Applicant section extra questions
  wireQuestionAdder(
    "suite-app-section-applicant",
    "suite-app-add-applicant-question",
    "customApplicantQ_"
  );

  // Experience section extra questions
  wireQuestionAdder(
    "suite-app-section-experience",
    "suite-app-add-experience-question",
    "experienceCustomQ_"
  );

  //////////////////////////////////////////////
  // Professional Experience – Add rows
  //////////////////////////////////////////////
  const experienceSection = document.getElementById("suite-app-section-experience");
  const addExperienceBtn  = document.getElementById("suite-app-add-experience");
  let experienceCounter = 0;

  if (experienceSection && addExperienceBtn) {
    addExperienceBtn.addEventListener("click", () => {
      experienceCounter += 1;

      const row = document.createElement("div");
      row.className = "suite-app-row";
      row.innerHTML = `
        <div class="suite-app-bullet suite-app-drag-handle"></div>
        <div
          class="suite-app-label"
          contenteditable="true"
          data-app-field="experienceCustom_${experienceCounter}"
        >
          New experience question
        </div>
        <div class="suite-app-input-box">
          [text input]
        </div>
      `;

      experienceSection.insertBefore(row, addExperienceBtn);
    });
  }

  //////////////////////////////////////////////
  // "Add new section" – whole custom block
  //////////////////////////////////////////////
  const addSectionBtn = document.getElementById("suite-app-add-section");
  let customSectionCount = 0;

  if (addSectionBtn) {
    addSectionBtn.addEventListener("click", () => {
      customSectionCount += 1;
      const sectionKey = `customSection_${customSectionCount}`;

      // Create a new section container
      const section = document.createElement("div");
      section.className = "suite-app-section suite-app-section-custom";
      section.dataset.sectionKey = sectionKey;

      section.innerHTML = `
        <div class="suite-app-section-title">
          <span
            contenteditable="true"
            data-app-field="${sectionKey}_title"
          >
            New section
          </span>
        </div>

        <div class="suite-app-row">
          <div class="suite-app-bullet suite-app-drag-handle"></div>
          <div
            class="suite-app-label"
            contenteditable="true"
            data-app-field="${sectionKey}_q1"
          >
            New question
          </div>
          <div class="suite-app-input-box">
            [text input]
          </div>
        </div>

        <button
          type="button"
          class="btn ghost suite-app-add-more"
          data-add-question-for="${sectionKey}"
        >
          + Add question
        </button>
      `;

      // Insert this new section right AFTER the experience section
      const experienceSection = document.getElementById("suite-app-section-experience");
      if (experienceSection && experienceSection.parentNode) {
        experienceSection.parentNode.insertBefore(
          section,
          experienceSection.nextSibling
        );
      } else {
        // fallback: put it after the "Add new section" button
        addSectionBtn.parentNode.insertBefore(section, addSectionBtn.nextSibling);
      }

      // Wire up the "Add question" button inside this new section
      const sectionAddBtn = section.querySelector(
        `button[data-add-question-for="${sectionKey}"]`
      );
      if (sectionAddBtn) {
        let qCounter = 1;
        sectionAddBtn.addEventListener("click", () => {
          qCounter += 1;
          const row = document.createElement("div");
          row.className = "suite-app-row";
          row.innerHTML = `
            <div class="suite-app-bullet suite-app-drag-handle"></div>
            <div
              class="suite-app-label"
              contenteditable="true"
              data-app-field="${sectionKey}_q${qCounter}"
            >
              New question
            </div>
            <div class="suite-app-input-box">
              [text input]
            </div>
          `;
          // insert above the "+ Add question" button
          section.insertBefore(row, sectionAddBtn);
        });
      }

      // Make its rows draggable too
      if (window.Sortable) {
        new Sortable(section, {
          animation: 150,
          handle: ".suite-app-drag-handle",
          draggable: ".suite-app-row",
        });
      }
    });
  }

  // 🔹 Location / suite name wiring
  const suiteNameSubtitle = appModal.querySelector(".suite-app-subtitle");
  const locationNameLeft  = appModal.querySelector('[data-app-field="locationName"]');
  const locationNameRight = appModal.querySelector('[data-app-field="locationNameRight"]');

  // All editable pieces inside the builder (for save/load)
  function collectTemplateFromBuilder() {
    if (!appModal) return {};

    // generic helper: collects rows inside a section element
    function collectRowsFromSection(sectionEl, fallbackPrefix) {
      if (!sectionEl) return [];

      const rows = sectionEl.querySelectorAll(".suite-app-row");
      const out = [];

      rows.forEach((row, idx) => {
        const labelEl = row.querySelector(".suite-app-label");
        const inputEl = row.querySelector(".suite-app-input-box");
        if (!labelEl || !inputEl) return;

        const key =
          labelEl.dataset.appField ||
          `${fallbackPrefix || "field"}_${idx + 1}`;

        out.push({
          key,
          label: (labelEl.textContent || "").trim(),
          inputType: (inputEl.textContent || "").trim(),
        });
      });

      return out;
    }

    // 🔹 Built-in sections
    const applicantSection  = document.getElementById("suite-app-section-applicant");
    const experienceSection = document.getElementById("suite-app-section-experience");

    const applicantRows  = collectRowsFromSection(applicantSection,  "applicant");
    const experienceRows = collectRowsFromSection(experienceSection, "experience");

    // 🔹 Built-in titles
    const applicantTitleSpan = applicantSection
      ? applicantSection.querySelector(".suite-app-section-title [data-app-field]")
      : null;
    const experienceTitleSpan = experienceSection
      ? experienceSection.querySelector(".suite-app-section-title [data-app-field]")
      : null;

    const applicantTitleCfg = applicantTitleSpan
      ? {
          key:
            applicantTitleSpan.getAttribute("data-app-field") ||
            "applicant_title",
          label: (applicantTitleSpan.textContent || "").trim() || "Application",
        }
      : null;

    const experienceTitleCfg = experienceTitleSpan
      ? {
          key:
            experienceTitleSpan.getAttribute("data-app-field") ||
            "experience_title",
          label:
            (experienceTitleSpan.textContent || "").trim() ||
            "Professional Experience",
        }
      : null;

    // 🔹 Custom sections
    const custom = [];
    const customSections = appModal.querySelectorAll(".suite-app-section-custom");

    customSections.forEach((sec) => {
      const sectionKey = sec.dataset.sectionKey || "";

      const titleSpan = sec.querySelector(".suite-app-section-title [data-app-field]");
      const titleKey =
        (titleSpan && titleSpan.getAttribute("data-app-field")) ||
        (sectionKey ? sectionKey + "_title" : "");
      const titleText = (titleSpan && titleSpan.textContent || "").trim() || "New section";

      const rows = collectRowsFromSection(sec, sectionKey || "customSection");

      custom.push({
        sectionKey,
        titleKey,
        title: titleText,
        rows,
      });
    });

    return {
      sections: {
        applicant: applicantRows,
        experience: experienceRows,
        custom,
        applicantTitle:   applicantTitleCfg,
        experienceTitle:  experienceTitleCfg,
      },
    };
  }

  function rebuildSectionFromConfig(sectionId, configs) {
    const section = document.getElementById(sectionId);
    if (!section || !configs) return;

    // keep any buttons (Add question, Add more experience)
    const buttons = Array.from(
      section.querySelectorAll("button")
    );

    // remove existing rows
    section.querySelectorAll(".suite-app-row").forEach((row) => {
      row.remove();
    });

    // recreate rows in saved order
    configs.forEach((cfg) => {
      const row = document.createElement("div");
      row.className = "suite-app-row";
      row.innerHTML = `
        <div class="suite-app-bullet suite-app-drag-handle"></div>
        <div
          class="suite-app-label"
          contenteditable="true"
          data-app-field="${cfg.key}"
        >
          ${cfg.label || ""}
        </div>
        <div class="suite-app-input-box">
          ${cfg.inputType || "[text input]"}
        </div>
      `;

      if (buttons[0]) {
        section.insertBefore(row, buttons[0]);
      } else {
        section.appendChild(row);
      }
    });
  }

  function rebuildCustomSections(customConfigs) {
    const addSectionBtn = document.getElementById("suite-app-add-section");
    if (!addSectionBtn) return;

    // remove any existing custom sections
    appModal.querySelectorAll(".suite-app-section-custom").forEach((sec) => {
      sec.remove();
    });

    if (!customConfigs || !customConfigs.length) return;

    let maxIndex = 0;

    customConfigs.forEach((cfg) => {
      const sectionKey = cfg.sectionKey || `customSection_1`;
      const titleKey   = cfg.titleKey   || `${sectionKey}_title`;
      const titleText  = cfg.title      || "New section";
      const rowsCfg    = Array.isArray(cfg.rows) ? cfg.rows : [];

      // 🧱 create the wrapper section
      const section = document.createElement("div");
      section.className = "suite-app-section suite-app-section-custom";
      section.dataset.sectionKey = sectionKey;

      section.innerHTML = `
        <div class="suite-app-section-title">
          <span
            contenteditable="true"
            data-app-field="${titleKey}"
          >
            ${titleText}
          </span>
        </div>
      `;

      // add rows from config
      rowsCfg.forEach((rowCfg, idx) => {
        const row = document.createElement("div");
        row.className = "suite-app-row";
        const rowKey = rowCfg.key || `${sectionKey}_q${idx + 1}`;

        row.innerHTML = `
          <div class="suite-app-bullet suite-app-drag-handle"></div>
          <div
            class="suite-app-label"
            contenteditable="true"
            data-app-field="${rowKey}"
          >
            ${rowCfg.label || "New question"}
          </div>
          <div class="suite-app-input-box">
            ${rowCfg.inputType || "[text input]"}
          </div>
        `;

        section.appendChild(row);
      });

      // "+ Add question" button
      const addBtn = document.createElement("button");
      addBtn.type = "button";
      addBtn.className = "btn ghost suite-app-add-more";
      addBtn.dataset.addQuestionFor = sectionKey;
      addBtn.textContent = "+ Add question";

      section.appendChild(addBtn);

      // insert after Experience section if possible, otherwise after the main "Add new section" button
      const experienceSection = document.getElementById("suite-app-section-experience");
      if (experienceSection && experienceSection.parentNode) {
        experienceSection.parentNode.insertBefore(
          section,
          experienceSection.nextSibling
        );
      } else {
        addSectionBtn.parentNode.insertBefore(section, addSectionBtn.nextSibling);
      }

      // wire internal "Add question" button
      let qCounter = rowsCfg.length || 1;
      addBtn.addEventListener("click", () => {
        qCounter += 1;
        const row = document.createElement("div");
        row.className = "suite-app-row";
        const rowKey = `${sectionKey}_q${qCounter}`;

        row.innerHTML = `
          <div class="suite-app-bullet suite-app-drag-handle"></div>
          <div
            class="suite-app-label"
            contenteditable="true"
            data-app-field="${rowKey}"
          >
            New question
          </div>
          <div class="suite-app-input-box">
            [text input]
          </div>
        `;
        section.insertBefore(row, addBtn);
      });

      // make this section sortable
      if (window.Sortable) {
        new Sortable(section, {
          animation: 150,
          handle: ".suite-app-drag-handle",
          draggable: ".suite-app-row",
        });
      }

      // track highest index so future "Add section" keeps counting up
      const m = sectionKey.match(/customSection_(\d+)/);
      if (m) {
        const n = parseInt(m[1], 10);
        if (!Number.isNaN(n) && n > maxIndex) {
          maxIndex = n;
        }
      }
    });

    // keep your existing counter in sync so new sections get fresh ids
    try {
      if (typeof customSectionCount !== "undefined") {
        customSectionCount = Math.max(customSectionCount, maxIndex);
      }
    } catch (e) {
      // ignore if not in scope
    }
  }

  function applyTemplateToBuilder(jsonStr) {
    if (!jsonStr) return;
    let data;
    try {
      data = JSON.parse(jsonStr);
    } catch (e) {
      console.warn("[suite-app] bad template JSON", e);
      return;
    }

    // ✅ New format with sections + rows
    if (data.sections) {
      // rows
      rebuildSectionFromConfig(
        "suite-app-section-applicant",
        data.sections.applicant || []
      );
      rebuildSectionFromConfig(
        "suite-app-section-experience",
        data.sections.experience || []
      );

      // 🔹 restore built-in titles
      if (data.sections.applicantTitle) {
        const cfg = data.sections.applicantTitle;
        const span = document.querySelector(
          "#suite-app-section-applicant .suite-app-section-title [data-app-field]"
        );
        if (span) {
          if (cfg.key) {
            span.setAttribute("data-app-field", cfg.key);
          }
          if (cfg.label) {
            span.textContent = cfg.label;
          }
        }
      }

      if (data.sections.experienceTitle) {
        const cfg = data.sections.experienceTitle;
        const span = document.querySelector(
          "#suite-app-section-experience .suite-app-section-title [data-app-field]"
        );
        if (span) {
          if (cfg.key) {
            span.setAttribute("data-app-field", cfg.key);
          }
          if (cfg.label) {
            span.textContent = cfg.label;
          }
        }
      }

      // 🔹 restore custom sections
      rebuildCustomSections(data.sections.custom || []);
      return;
    }

    // 🔙 Fallback for old simple { key: label } format
    const fields = appModal
      ? appModal.querySelectorAll("[data-app-field]")
      : [];
    fields.forEach((el) => {
      const key = el.getAttribute("data-app-field");
      if (key && data[key]) {
        el.textContent = data[key];
      }
    });
  }

  function openAppBuilder() {
    // location name (left + right)
    if (typeof selectedLocation !== "undefined" && selectedLocation) {
      const locName = selectedLocation.name || "";
      if (locationNameLeft)  locationNameLeft.textContent  = locName || "Location Name";
      if (locationNameRight) locationNameRight.textContent = locName || "Location Name";
    }

    // suite name subtitle
    let suiteName = "";
    if (typeof locSuiteNameInput !== "undefined" &&
        locSuiteNameInput &&
        locSuiteNameInput.value.trim()) {
      suiteName = locSuiteNameInput.value.trim();
    } else if (typeof activeSuite !== "undefined" && activeSuite) {
      suiteName = activeSuite["Suite Name"] || activeSuite.name || "";
    }
    if (suiteNameSubtitle) {
      suiteNameSubtitle.textContent = suiteName || "Suite Name";
    }

    // 🔹 load saved template (hidden input OR activeSuite)
    if (templateInput) {
      const fromHidden = templateInput.value && templateInput.value.trim();
      const fromSuite =
        (!fromHidden && typeof activeSuite !== "undefined" && activeSuite)
          ? (activeSuite.applicationTemplate ||
            activeSuite["Application Template"] ||
            "")
          : "";

      const jsonToUse = fromHidden || fromSuite;

      if (jsonToUse) {
        templateInput.value = jsonToUse;
        applyTemplateToBuilder(jsonToUse);
      }
    }

    appModal.hidden = false;
    appModal.setAttribute("aria-hidden", "false");

      document.body.classList.add("modal-open");
  }

function closeAppBuilder() {
  // hide the modal
  appModal.hidden = true;
  appModal.setAttribute("aria-hidden", "true");

  // 🔓 unlock scroll again
  document.body.classList.remove("modal-open");

  // ✅ If we’re editing a suite, go back to its details view
  if (typeof activeSuite !== "undefined" && activeSuite && typeof openSuiteDetails === "function") {
    openSuiteDetails(activeSuite);
  }

  // Optional: move focus back to the open button
  const openAppBtn = document.getElementById("open-suite-app-builder");
  if (openAppBtn) openAppBtn.focus();
}


  openAppBtn?.addEventListener("click", openAppBuilder);
  closeAppBtn?.addEventListener("click", closeAppBuilder);
  cancelAppBtn?.addEventListener("click", closeAppBuilder);

// ===========================
// Save Application Template as an Application record
// ===========================
async function saveSuiteApplicationTemplate(suiteId, templateJson) {
  if (!templateJson) return;

  const values = {
    // 👇 match the DataType field name EXACTLY
    "Template Json": templateJson,
  };

  // optional but recommended
  if (suiteId) {
    values["Name"] = `Suite Application for ${suiteId}`;
    // (later you can add a "Suite" reference field here if you want)
  }

  const res = await fetch(`${API_BASE}/api/records/Application`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    credentials: "include",
    body: JSON.stringify({ values }),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    console.warn(
      "[suite-app] saveSuiteApplicationTemplate failed",
      res.status,
      txt
    );
    throw new Error("HTTP " + res.status);
  }

  const body = await res.json().catch(() => null);
  console.log("[suite-app] template saved to Application", body);
  return body;
}


  if (saveAppBtn) {
    saveAppBtn.addEventListener("click", async () => {
      if (!templateInput) return;

      const data = collectTemplateFromBuilder();
      const json = JSON.stringify(data);

      templateInput.value = json;

      try {
        if (window.activeSuite && activeSuite.id) {
          await saveSuiteApplicationTemplate(activeSuite.id, json);
          activeSuite.applicationTemplate = json;
        }
      } catch (err) {
        console.error("[suite-app] error saving to server", err);
        alert(
          "The application layout was updated, but we couldn’t save it to the server yet. " +
          "Please click “Save suite” before leaving this page."
        );
      }

      // 🔹 update the little status text next to the button
      refreshSuiteAppStatus();

      closeAppBuilder();
    });
  }

  // 🔹 Sortable drag–reorder
  if (window.Sortable) {
    const sections = appModal.querySelectorAll(".suite-app-section");
    sections.forEach((section) => {
      new Sortable(section, {
        animation: 150,
        handle: ".suite-app-drag-handle",
        draggable: ".suite-app-row",
      });
    });
  }

  // initial status on load
  refreshSuiteAppStatus();
})();

//Add Suite 
// When "+ Add suite" is clicked in the location details card
if (locationAddSuiteBtn) {
  locationAddSuiteBtn.addEventListener("click", () => {
    if (!selectedLocation) {
      alert("Open a location first, then add a suite.");
      return;
    }
 if (locationDetailsActions) locationDetailsActions.style.display = "none";
    if (!locationSuiteFormCard || !locationSuiteForm) return;

    // 🆕 reset removal flags whenever we start a brand-new suite
    suitePhotoMarkedForRemoval = false;
    suiteGalleryRemoveSet = new Set();

    // reset form for new suite
    locationSuiteForm.reset();
    if (locSuiteIdInput)        locSuiteIdInput.value = "";
    if (locSuitePhotoInput)     locSuitePhotoInput.value = "";
    if (locSuiteGalleryInput)   locSuiteGalleryInput.value = "";
    if (locSuiteAppInput)       locSuiteAppInput.value = "";
    
    // 🔹 brand-new suite → no stored application template yet
    if (templateInput) templateInput.value = "";

    // hide the top of the location card while adding a suite
    if (locationDetailsHeader) locationDetailsHeader.style.display = "none";
    if (locationSuitesHeader)  locationSuitesHeader.style.display  = "none";
    if (locationSuitesList)    locationSuitesList.style.display    = "none";

    // clear previews
    if (locSuiteCurrentGallery) {
      locSuiteCurrentGallery.textContent = "";
    }
    if (locSuiteCurrentApp) {
      locSuiteCurrentApp.textContent = "";
    }
    if (locSuiteCurrentPhoto) {
      locSuiteCurrentPhoto.textContent = "";
    }

    // 🔹 clear *new* gallery preview too
    if (typeof pendingSuiteGalleryFiles !== "undefined") {
      pendingSuiteGalleryFiles = [];
      renderSuitePendingGalleryPreview();
    } else if (locSuiteNewGalleryPrev) {
      // fallback if helper is in a different scope
      locSuiteNewGalleryPrev.textContent = "";
    }

    // 🔹 HIDE location header + details while in suite-edit mode
    if (locationsHeader)        locationsHeader.style.display = "none";
    if (locationDetailsGrid)    locationDetailsGrid.style.display = "none";
    if (locationSuitesList)     locationSuitesList.style.display = "none";
    if (locationSuiteDetailsCard) locationSuiteDetailsCard.style.display = "none";

    // 🔹 SHOW suite form
    locationSuiteFormCard.style.display = "block";
    initSuiteDetailsEditor();
setSuiteDetailsHTML("");

    if (locSuiteNameInput) locSuiteNameInput.focus();

    // (optional) show location name in the suite form
    const locLabel = document.getElementById("loc-suite-location-name");
    if (locLabel && selectedLocation) {
      locLabel.textContent = selectedLocation.name || "";
    }

    if (locationEditBtn) locationEditBtn.style.display = "none";
    if (deleteBtn)       deleteBtn.style.display       = "none";
  });
}


///////////////////////////////////////////////////////////////////////////////////////
  // Cancel suite form
// Cancel suite form
if (locSuiteCancelBtn && locationSuiteFormCard && locationSuiteForm) {
  locSuiteCancelBtn.addEventListener("click", () => {
    locationSuiteForm.reset();
    if (locSuiteAppInput)     locSuiteAppInput.value = "";
    if (locSuitePhotoInput)   locSuitePhotoInput.value = "";
    if (locSuiteGalleryInput) locSuiteGalleryInput.value = "";
    if (locSuiteIdInput)      locSuiteIdInput.value = "";

    // 🆕 reset removal flags when cancelling
    suitePhotoMarkedForRemoval = false;
    suiteGalleryRemoveSet = new Set();

    activeSuite = null;
    locationSuiteFormCard.style.display = "none";

    // back to location view
    if (locationDetailsCard)  locationDetailsCard.style.display  = "block";
    if (locationDetailsGrid)  locationDetailsGrid.style.display  = "grid";

    showLocationsHeader();   // 👈 bring header back

    if (locationDetailsCard)  locationDetailsCard.style.display  = "block";
    if (locationDetailsGrid)  locationDetailsGrid.style.display  = "grid";
    if (locationSuitesHeader) locationSuitesHeader.style.display = "flex";
    if (locationSuitesList)   locationSuitesList.style.display   = "block";

    activeSuite = null;
  });
}

  // Save suite (create or edit)
if (locationSuiteForm && locSuiteNameInput) {
  locationSuiteForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    if (!selectedLocation || !selectedLocation.id) {
      alert("No location selected for this suite.");
      return;
    }

    const suiteName   = locSuiteNameInput.value.trim();
    
    const suiteDetail = locSuiteDetailsInput
      ? locSuiteDetailsInput.value.trim()
      : "";
    const dateAvail   = locSuiteAvailableInput
      ? locSuiteAvailableInput.value
      : "";

    if (!suiteName) {
      alert("Please enter a suite name or number.");
      return;
    }

    // 🔹 base values for the Suite record
// 🔹 base values for the Suite record
const values = {
  "Suite Name": suiteName,
  Details: suiteDetail,
  "Date Available": dateAvail || null,
  Location: { _id: selectedLocation.id },  // reference to Location

    // 🎨 style fields (example names – match what’s in your DataType)
  "Suite Background Color": document.getElementById("suite-bg-color")?.value || "",
  "Suite Text Color":       document.getElementById("suite-text-color")?.value || "",
  "Suite Accent Color":     document.getElementById("suite-accent-color")?.value || "",
  "Suite Button Color":     document.getElementById("suite-button-color")?.value || "",

  // 🧡 builder JSON – keep old one if the hidden input is empty
  "Application Template":
    (templateInput && templateInput.value.trim()) ||
    (activeSuite && activeSuite.applicationTemplate) ||
    "",

  // extra questions text area
  "Application Questions": (
    document.getElementById("loc-suite-app-questions")?.value || ""
  ).trim(),
};

// 🔹 Rent fields from the form
const rentAmountInput   = document.getElementById("suite-rent-amount");
const rentFrequencySel  = document.getElementById("suite-rent-frequency");

const rentAmountVal = rentAmountInput
  ? parseFloat(rentAmountInput.value || "")
  : NaN;
const rentFrequencyVal = rentFrequencySel
  ? rentFrequencySel.value
  : "";

if (!Number.isNaN(rentAmountVal)) {
  values["Rent Amount"] = rentAmountVal;
}
if (rentFrequencyVal) {
  values["Rent Frequency"] = rentFrequencyVal; // "daily" / "weekly" / "bi weekly" / "monthly"
}

// 🔹 which application type to use on the public site
let appMode = "template"; // default
if (appModeRadios && appModeRadios.length) {
  const checked = Array.from(appModeRadios).find((r) => r.checked);
  if (checked && checked.value) {
    appMode = checked.value;  // "template" or "file"
  }
}
values["Application Mode"] = appMode;

 // 🔹 save the current builder template JSON with this suite **only if present**
const templateRaw = (templateInput?.value || "").trim();
if (templateRaw) {
  values["Application Template"] = templateRaw;
}
// if templateRaw is empty, we don't send the key at all – backend keeps the old one

    // 🔹 default image upload
// 🆕 Application file upload
if (locSuiteAppInput && locSuiteAppInput.files && locSuiteAppInput.files[0]) {
  const appFile = locSuiteAppInput.files[0];
  const fd = new FormData();
  fd.append("file", appFile);

  try {
    const uploadRes = await fetch(`${API_BASE}/api/upload`, {
      method: "POST",
      credentials: "include",
      body: fd,
    });

    if (!uploadRes.ok) {
      const txt = await uploadRes.text().catch(() => "");
      console.warn("[locations] suite application upload failed", uploadRes.status, txt);
      alert(`Couldn't upload application file (${uploadRes.status}). Check console for details.`);
    } else {
      const uploadJson = await uploadRes.json().catch(() => ({}));
      if (uploadJson && uploadJson.url) {
        values["Suite Application File"] = uploadJson.url;

      }
    }
  } catch (err) {
    console.error("[locations] suite application upload error", err);
    alert("Something went wrong while uploading the application file.");
  }
} else if (activeSuite && activeSuite.applicationFileUrl) {
  values["Suite Application File"] = activeSuite.applicationFileUrl;
}


        // If user clicked the X and did NOT upload a new photo,
    // explicitly clear the Default Image field.
    if (
      suitePhotoMarkedForRemoval &&
      !(locSuitePhotoInput && locSuitePhotoInput.files && locSuitePhotoInput.files[0])
    ) {
      values["Default Image"] = "";   // clears the default image
    }

    // 🆕 Suite gallery upload (multiple images)
    let galleryUrls = [];

    // Use pendingSuiteGalleryFiles if we have them; fallback to input as backup
    const suiteGallerySource =
      pendingSuiteGalleryFiles && pendingSuiteGalleryFiles.length
        ? pendingSuiteGalleryFiles
        : (locSuiteGalleryInput && locSuiteGalleryInput.files
            ? Array.from(locSuiteGalleryInput.files)
            : []);

    if (suiteGallerySource.length) {
      for (const file of suiteGallerySource) {
        const fd = new FormData();
        fd.append("file", file);

        try {
          const uploadRes = await fetch(`${API_BASE}/api/upload`, {
            method: "POST",
            credentials: "include",
            body: fd,
          });

          if (!uploadRes.ok) {
            const txt = await uploadRes.text().catch(() => "");
            console.warn(
              "[locations] suite gallery upload failed",
              uploadRes.status,
              txt
            );
            continue; // skip this file, keep going
          }

          const uploadJson = await uploadRes.json().catch(() => ({}));
          if (uploadJson && uploadJson.url) {
            galleryUrls.push(uploadJson.url);
          }
        } catch (err) {
          console.error("[locations] suite gallery upload error", err);
          // skip this file and keep going
        }
      }
    }

// 🆕 Suite gallery: merge existing (minus removed) + new uploads
const suiteId = locSuiteIdInput ? locSuiteIdInput.value.trim() : "";
let finalGallery = [];

// 1) start with existing gallery, minus any that were X'd out
if (suiteId && activeSuite && Array.isArray(activeSuite.gallery)) {
  const toRemove = suiteGalleryRemoveSet || new Set();
  finalGallery = activeSuite.gallery.filter((url) => !toRemove.has(url));
}

// 2) add any newly-uploaded gallery URLs
if (galleryUrls.length) {
  finalGallery = finalGallery.concat(galleryUrls);
}

// 3) save to values – if empty, clear the field
if (finalGallery.length) {
  values["Suite Gallery"] = finalGallery;
} else if (suiteId) {
  // explicitly clear on edit if everything was removed
  values["Suite Gallery"] = [];
}


    // 🆕 Application file upload
    if (locSuiteAppInput && locSuiteAppInput.files && locSuiteAppInput.files[0]) {
      const appFile = locSuiteAppInput.files[0];
      const fd = new FormData();
      fd.append("file", appFile);

      try {
        const uploadRes = await fetch(`${API_BASE}/api/upload`, {
          method: "POST",
          credentials: "include",
          body: fd,
        });

        if (!uploadRes.ok) {
          const txt = await uploadRes.text().catch(() => "");
          console.warn("[locations] suite application upload failed", uploadRes.status, txt);
          alert(`Couldn't upload application file (${uploadRes.status}). Check console for details.`);
        } else {
          const uploadJson = await uploadRes.json().catch(() => ({}));
          if (uploadJson && uploadJson.url) {
         values["Suite Application File"] = uploadJson.url;

          }
        }
      } catch (err) {
        console.error("[locations] suite application upload error", err);
        alert("Something went wrong while uploading the application file.");
      }
    }

// 🔹 Save Suite record
try {
  const suiteId = locSuiteIdInput ? locSuiteIdInput.value.trim() : "";

const DT = "Suite";

const endpoint = suiteId
  ? `${API_BASE}/api/records/${encodeURIComponent(DT)}/${encodeURIComponent(suiteId)}`
  : `${API_BASE}/api/records/${encodeURIComponent(DT)}`;


const method = suiteId ? "PATCH" : "POST";


  const res = await fetch(endpoint, {
    method,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    credentials: "include",
    body: JSON.stringify({ values }),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    console.warn("[locations] save suite failed", res.status, txt);
    alert(`Couldn't save suite (${res.status}). Check console for details.`);
    return;
  }

  const saved = await res.json().catch(() => null);
  console.log("[locations] suite saved", saved);

  // 🔹 pull record + id from response
  const rawRecord =
    (saved && (saved.data || saved.record || saved)) || null;

  const savedId =
    suiteId ||                // if we were editing, keep the same id
    rawRecord?._id ||
    rawRecord?.id ||
    null;

  const suiteValues =
    (rawRecord && (rawRecord.values || rawRecord.record?.values)) ||
    (saved && (saved.values || saved.record?.values)) ||
    values ||
    {};

  // build the suite object we keep in memory
    // build the suite object we keep in memory
  const newSuite = {
    id: savedId,
    name: suiteValues["Suite Name"] || suiteValues.name || "",

    dateAvail:
      suiteValues["Date Available"] ||
      suiteValues["Available Date"] ||
      "",

    availableText:
      suiteValues["Available Text"] ||
      suiteValues["Availability"] ||
      (suiteValues["Date Available"] || suiteValues["Available Date"]
        ? `Available: ${String(
            suiteValues["Date Available"] || suiteValues["Available Date"]
          ).slice(0, 10)}`
        : ""),

    details:
      suiteValues["Suite Notes"] ||
      suiteValues["Details"] ||
      "",

    // main photo
    photoUrl:
      suiteValues["Default image"] ||
      suiteValues["Default Image"] ||
      suiteValues["Default Photo"] ||
      suiteValues["Suite Default Image"] ||
      suiteValues["Suite Photo"] ||
      suiteValues["Photo"] ||
      "",

    // gallery
    gallery: Array.isArray(suiteValues["Suite Gallery"])
      ? suiteValues["Suite Gallery"]
      : [],

    // ✅ rent fields
    rentAmount:
      suiteValues["Rent Amount"] ??
      suiteValues["Suite Rent Amount"] ??
      null,
    rentFrequency:
      suiteValues["Rent Frequency"] ||
      suiteValues["Rent Schedule"] ||
      "",

    // ✅ application fields
    applicationTemplate:
      suiteValues["Application Template"] ||
      suiteValues.applicationTemplate ||
      (activeSuite && activeSuite.applicationTemplate) ||
      "",

    applicationFileUrl:
      suiteValues["Application File"] ||
      suiteValues["Application PDF"] ||
      suiteValues.applicationFileUrl ||
      (activeSuite && activeSuite.applicationFileUrl) ||
      "",
  };

  // alias for old code that used .img
  newSuite.img = newSuite.photoUrl;
  activeSuite  = newSuite;


  // refresh the list so the left side is up to date
  if (selectedLocation && selectedLocation.id) {
    await loadSuitesForLocation(selectedLocation.id);
  }

  // reset form + state
  locationSuiteForm.reset();
  if (locSuiteIdInput && savedId) locSuiteIdInput.value = savedId;

  pendingSuiteGalleryFiles = [];
  if (typeof renderSuitePendingGalleryPreview === "function") {
    renderSuitePendingGalleryPreview();
  }

  // hide the form
  if (locationSuiteFormCard) {
    locationSuiteFormCard.style.display = "none";
  }

  // ✅ show the suite details card instead of going back to location details
  if (typeof openSuiteDetails === "function") {
    openSuiteDetails(newSuite);
  }
} catch (err) {
  console.error("[locations] create suite error", err);
  alert("Something went wrong while saving this suite. Please try again.");
}

  });
}



// Load all Suite records for a specific location


async function loadSuitesForLocation(locationId) {
  if (!locationSuitesList) return;
  locationSuitesList.innerHTML = `<p class="muted">Loading suites…</p>`;

  try {
    const params = new URLSearchParams();
    params.set("dataType", "Suite");
    if (locationId) params.set("Location", locationId); // backend filter
    params.set("limit", "200");

    const res = await fetch(
      `${API_BASE}/public/records?` + params.toString(),
      {
        credentials: "include",
        headers: { Accept: "application/json" },
      }
    );

    if (!res.ok) {
      console.warn("[locations] loadSuitesForLocation HTTP", res.status);
      locationSuitesList.innerHTML =
        `<p class="muted">Couldn’t load suites for this location.</p>`;
      return;
    }

    const body = await res.json();
    const rows = Array.isArray(body)
      ? body
      : body.records || body.items || [];

    const locIdStr = String(locationId || "");

    // 🔹 Normalize each suite and add availability + rent info
    let normalizedSuites = rows.map((row) => {
      const base = normalizeSuite(row);        // 👈 has img + gallery
      const v    = row.values || row;

      // Availability
      const availableDate =
        v["Date Available"] || v["Available Date"] || null;

      let availableText = "";
      if (availableDate) {
        availableText = `Available: ${String(availableDate).slice(0, 10)}`;
      }

      // Rent fields
      const rentAmount =
        v["Rent Amount"] ??
        v["Suite Rent Amount"] ??
        null;

      const rentFrequency =
        v["Rent Frequency"] ||
        v["Rent Schedule"] ||
        "";

      const out = {
        ...base,
        availableDate,
        availableText,
        rentAmount,
        rentFrequency,
      };

      console.log("[loadSuitesForLocation] normalized suite:", out);
      return out;
    });

    // 🔹 Filter to this location on the front-end too
    normalizedSuites = normalizedSuites.filter((s) =>
      locIdStr ? String(s.locationId) === locIdStr : true
    );

    currentLocationSuites = normalizedSuites;

    console.log("[loadSuitesForLocation] suites for location:", {
      locationId: locIdStr,
      count: currentLocationSuites.length,
      currentLocationSuites,
    });

    if (!currentLocationSuites.length) {
      locationSuitesList.innerHTML =
        `<p class="muted">No suites added yet for this location.</p>`;
      return;
    }

    locationSuitesList.innerHTML = "";

    function formatSuiteRate(suite) {
      const rawAmount = suite.rentAmount;
      const rawFreq   = suite.rentFrequency || "";

      if (rawAmount == null || rawAmount === "") return "";

      const num = Number(rawAmount);
      const amountStr = Number.isFinite(num)
        ? num.toLocaleString(undefined, {
            minimumFractionDigits: 0,
            maximumFractionDigits: 2,
          })
        : String(rawAmount);

      const freqStr = String(rawFreq || "").trim();
      return freqStr ? `$${amountStr} / ${freqStr}` : `$${amountStr}`;
    }

    currentLocationSuites.forEach((suite) => {
      const card = document.createElement("div");
      card.className = "location-suite-item";

      const rateText = formatSuiteRate(suite);

      // 👇 this uses normalizeSuite's img / gallery
      const imgUrl =
        suite.img ||
        (Array.isArray(suite.gallery) && suite.gallery[0]) ||
        "";

      card.innerHTML = `
        <div class="location-suite-main-row">
          ${
            imgUrl
              ? `<img class="location-suite-thumb" src="${imgUrl}" alt="${suite.name || "Suite"}">`
              : ""
          }
          <div class="location-suite-text">
            <strong>${suite.name || "Untitled suite"}</strong>
            ${
              suite.availableText
                ? `<div class="muted">${suite.availableText}</div>`
                : ""
            }
            ${
              rateText
                ? `<div class="muted">${rateText}</div>`
                : ""
            }
          </div>
        </div>
      `;

      // open suite details when clicked
      card.addEventListener("click", () => {
        openSuiteDetails(suite);
      });

      locationSuitesList.appendChild(card);
    });
  } catch (err) {
    console.error("[locations] loadSuitesForLocation error", err);
    if (locationSuitesList) {
      locationSuitesList.innerHTML =
        `<p class="muted">Error loading suites for this location.</p>`;
    }
  }
}



// Close suite details
locationSuiteDetailsClose?.addEventListener("click", () => {
  // hide the suite details card
  if (locationSuiteDetailsCard) {
    locationSuiteDetailsCard.style.display = "none";
  }

  // show the location view again
  if (locationDetailsGrid)  locationDetailsGrid.style.display = "grid";  // or "block"
  if (locationSuitesHeader) locationSuitesHeader.style.display = "flex";
  if (locationSuitesList)   locationSuitesList.style.display   = "block";

  // OPTIONAL: if you hid the main Locations header above, re-show it here:
  // if (locationsHeader) locationsHeader.style.display = "flex";
});


// =====================
// Edit Suite button
// =====================
if (locationSuiteEditBtn) {
  locationSuiteEditBtn.addEventListener("click", () => {
    if (!activeSuite) return;
    if (!locationSuiteFormCard || !locationSuiteForm) return;

    // 👇 add this line here
    console.log("[edit-suite] file url:", activeSuite.applicationFileUrl);
// show existing application file text/link
if (locSuiteCurrentApp) {
  if (activeSuite.applicationFileUrl) {
    locSuiteCurrentApp.innerHTML = `
      <a href="${activeSuite.applicationFileUrl}"
         target="_blank"
         rel="noopener">
        View current application
      </a>
    `;
  } else {
    locSuiteCurrentApp.textContent = "No application uploaded yet.";
  }
}

    // Put suite ID in hidden input so we know it's an edit
    if (locSuiteIdInput) {
      locSuiteIdInput.value = activeSuite.id || "";
    }

    if (locSuiteNameInput) {
      locSuiteNameInput.value = activeSuite.name || "";
    }

    if (locSuiteDetailsInput) {
      locSuiteDetailsInput.value = activeSuite.details || "";
    }

    if (locSuiteAvailableInput) {
      locSuiteAvailableInput.value = activeSuite.dateAvail || "";
    }

    // 🔹 load any saved application template JSON into the hidden input
    const templateInput =
      document.getElementById("loc-suite-application-template");
    if (templateInput) {
      templateInput.value =
        activeSuite.applicationTemplate ||
        activeSuite["Application Template"] ||
        "";
      refreshSuiteAppStatus();
    }

    // 🔹 restore which application mode is selected
    if (appModeRadios && appModeRadios.length) {
      const mode =
        activeSuite.applicationMode ||
        activeSuite["Application Mode"] ||
        "template";

      appModeRadios.forEach((r) => {
        r.checked = (r.value === mode);
      });
    }



function refreshSuiteAppStatus() {
  if (!suiteAppStatusSpan) return;

  // look at hidden input AND activeSuite’s values
  const raw =
    (templateInput && templateInput.value && templateInput.value.trim()) ||
    (activeSuite &&
      (activeSuite.applicationTemplate ||
        activeSuite["Application Template"])) ||
    "";

  const hasTemplate = !!raw && raw !== "{}";

  if (!hasTemplate) {
    suiteAppStatusSpan.textContent = "No template yet";
    suiteAppStatusSpan.classList.remove("suite-app-clickable");
    suiteAppStatusSpan.onclick = null;
    return;
  }

  // ✅ show clickable status
  suiteAppStatusSpan.textContent = "Template saved – click to preview";
  suiteAppStatusSpan.classList.add("suite-app-clickable");

  suiteAppStatusSpan.onclick = () => {
    const tmplJson =
      (templateInput && templateInput.value && templateInput.value.trim()) ||
      (activeSuite &&
        (activeSuite.applicationTemplate ||
          activeSuite["Application Template"])) ||
      "";

    openSuiteTemplatePreview(tmplJson);
  };
}


    // if you added the "Location: ___" text inside the suite form
    if (locSuiteLocationName && selectedLocation) {
      locSuiteLocationName.textContent = selectedLocation.name || "";
    }

   // ✅ show existing default image with X button
suitePhotoMarkedForRemoval = false;   // reset each time we enter edit mode

if (locSuiteCurrentPhoto) {
  locSuiteCurrentPhoto.innerHTML = "";

  if (activeSuite.img) {
    locSuiteCurrentPhoto.innerHTML = `
      <div class="suite-current-photo-wrapper">
        <img
          src="${activeSuite.img}"
          alt="Current default image"
          style="max-width: 220px; border-radius: 12px;"
        />
        <button
          type="button"
          class="suite-remove-photo-btn"
          title="Remove this photo"
        >
          ×
        </button>
      </div>
    `;

    const removeBtn = locSuiteCurrentPhoto.querySelector(".suite-remove-photo-btn");
    if (removeBtn) {
      removeBtn.addEventListener("click", () => {
        suitePhotoMarkedForRemoval = true;
        locSuiteCurrentPhoto.textContent =
          "Photo will be removed when you save.";
      });
    }
  } else {
    locSuiteCurrentPhoto.textContent = "No photo uploaded yet.";
  }
}

    // clear file inputs (browser won't allow prefilling)
    if (locSuitePhotoInput)   locSuitePhotoInput.value = "";
    if (locSuiteGalleryInput) locSuiteGalleryInput.value = "";
    if (locSuiteAppInput)     locSuiteAppInput.value = "";

// 🆕 reset removal set each time we enter edit mode
suiteGalleryRemoveSet = new Set();

// show existing gallery with X buttons
if (locSuiteCurrentGallery) {
  locSuiteCurrentGallery.innerHTML = "";

  if (activeSuite.gallery && activeSuite.gallery.length) {
    activeSuite.gallery.forEach((url) => {
      const wrapper = document.createElement("div");
      wrapper.className = "suite-gallery-item";

      wrapper.innerHTML = `
        <img
          src="${url}"
          class="suite-gallery-thumb"
          alt="Suite gallery image"
        />
        <button
          type="button"
          class="suite-gallery-remove-btn"
          title="Remove this image"
        >
          ×
        </button>
      `;

      const removeBtn = wrapper.querySelector(".suite-gallery-remove-btn");
      if (removeBtn) {
        removeBtn.addEventListener("click", () => {
          suiteGalleryRemoveSet.add(url);  // mark this URL for removal
          wrapper.remove();                // remove from the UI
        });
      }

      locSuiteCurrentGallery.appendChild(wrapper);
    });
  } else {
    locSuiteCurrentGallery.textContent = "No gallery images uploaded yet.";
  }
}


    // show existing application file
    if (locSuiteCurrentApp) {
      if (activeSuite.applicationFileUrl) {
        locSuiteCurrentApp.innerHTML = `
          <a href="${activeSuite.applicationFileUrl}" target="_blank" rel="noopener">
            View current application
          </a>
        `;
      } else {
        locSuiteCurrentApp.textContent = "No application uploaded yet.";
      }
    }

    // 👇 keep the outer location card visible,
    // but hide the header + grid + suites list so the form feels clean
    if (locationDetailsCard)  locationDetailsCard.style.display = "block";
   if (locationsHeader)      locationsHeader.style.display = "none";
    if (locationSuitesHeader) locationSuitesHeader.style.display = "none";
    if (locationDetailsGrid)  locationDetailsGrid.style.display = "none";
    if (locationSuitesList)   locationSuitesList.style.display = "none";

    // show suite form, hide suite-details panel
    locationSuiteFormCard.style.display   = "block";
    locationSuiteDetailsCard.style.display = "none";

    locationSuiteFormCard.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

// =====================
// Delete Suite button
// =====================
if (locationSuiteDeleteBtn) {
  locationSuiteDeleteBtn.addEventListener("click", async () => {
    if (!activeSuite || !activeSuite.id) return;
    if (!selectedLocation || !selectedLocation.id) return;

    const ok = confirm(
      `Are you sure you want to delete "${activeSuite.name || "this suite"}"?`
    );
    if (!ok) return;

    try {
      const endpoint = `${API_BASE}/api/records/Suite/${encodeURIComponent(
        activeSuite.id
      )}`;

      const nowIso = new Date().toISOString();

      const res = await fetch(endpoint, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          deletedAt: nowIso,
          values: {
            deletedAt: nowIso,
            "Deleted At": nowIso,
            isDeleted: true,
          },
        }),
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        console.warn("[locations] delete suite failed", res.status, txt);
        alert(`Couldn't delete suite (${res.status}). Check console for details.`);
        return;
      }

      console.log("[locations] suite deleted");

      // Hide details + refresh the list of suites
      activeSuite = null;
      if (locationSuiteDetailsCard) {
        locationSuiteDetailsCard.style.display = "none";
      }

      await loadSuitesForLocation(selectedLocation.id);
    } catch (err) {
      console.error("[locations] delete suite error", err);
      alert("Something went wrong while deleting this suite. Please try again.");
    }
  });
}

// Go back to locations from Suite
// Go back from the Suite *form* to this Location's details
locationSuiteBackBtn?.addEventListener("click", () => {
  // hide the add/edit suite form
  if (locationSuiteFormCard) {
    locationSuiteFormCard.style.display = "none";
  }

  // show the location details again (same location)
  if (locationDetailsCard)   locationDetailsCard.style.display = "block";
    if (locationDetailsHeader) locationDetailsHeader.style.display = "flex"; 
  if (locationDetailsGrid)   locationDetailsGrid.style.display = "grid";
  if (locationSuitesHeader)  locationSuitesHeader.style.display = "flex";
  if (locationSuitesList)    locationSuitesList.style.display = "block";
  // keep these hidden because you're still inside ONE location
  if (locationsHeader) locationsHeader.style.display = "none";
  // IMPORTANT: do NOT clear selectedLocation
  // IMPORTANT: do NOT show the main locations list here

    // 👇 RESTORE Edit/Delete area
  if (locationDetailsActions) locationDetailsActions.style.display = "flex";
  // safety if you hid buttons individually:
  if (locationEditBtn) locationEditBtn.style.display = "";
  if (deleteBtn)       deleteBtn.style.display = "";
});


}









// ================================
// MAIN INIT (auth + sidebar + tabs + locations)
// ================================
document.addEventListener("DOMContentLoaded", async () => {
  console.log("[suite-settings] DOM ready");

  // 1) figure out the current user
  const user = await getSignedInUser();
  console.log("[suite-settings] currentUser:", user);

  currentUser = user || null;   // ✅ keep it in a global

  // 2) auth header + login popup
  initAuthUI(user);

  // 3) sidebar collapse + tab switching
  const app        = document.getElementById("app");
  const collapseBtn = document.getElementById("collapseBtn");
  const nav        = document.getElementById("nav");
  const sections   = document.querySelectorAll(".section");
  // collapse / expand
  collapseBtn?.addEventListener("click", () => {
    app.classList.toggle("collapsed");
  });

  function applyInitialCollapse() {
    if (window.innerWidth <= 900) {
      app.classList.add("collapsed");
    }
  }
  applyInitialCollapse();
  window.addEventListener("resize", () => {
    if (window.innerWidth <= 900) {
      app.classList.add("collapsed");
    }
  });

  // tab switching
let suitesTabInitialized = false; // put this near your other top-level vars

nav?.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-target]");
  if (!btn) return;

  const targetId = btn.dataset.target;

  nav.querySelectorAll("button").forEach((b) => {
    b.classList.toggle("active", b === btn);
  });

  sections.forEach((sec) => {
    sec.classList.toggle("active", sec.id === targetId);
  });

  // 👇 NEW: when Suites tab is opened, load apps (All locations)
  if (targetId === "suites") {
    suitesCurrentLocationFilter = suitesLocationFilter?.value || "";

    if (!suiteApplications.length) {
      // first time → fetch from server then render
      loadAllSuiteApplications();
    } else {
      // already loaded once → just re-render with current filter
      renderSuiteApplications();
    }
  }
});


  // 4) locations (uses the same user we just fetched)
  initLocationForm(user);

    // 5) Suities UI (no backend yet)
  initSuitieForm(user);
});

// helper: click a sidebar nav button by its data-target
function openSection(targetId) {
  const btn = document.querySelector(
    `#nav button[data-target="${targetId}"]`
  );
  if (btn) btn.click();
}

// Dashboard card shortcuts
const dashCardLocations  = document.getElementById("dash-card-locations");
const dashCardSuities    = document.getElementById("dash-card-suities");
const dashCardMaint      = document.getElementById("dash-card-maint");

dashCardLocations?.addEventListener("click", () => {
  openSection("locations");
});

dashCardSuities?.addEventListener("click", () => {
  openSection("suities");
});

dashCardMaint?.addEventListener("click", () => {
  openSection("maintenance");
});











// ================================
// Suities: save to backend (DataType "Suitie")
// ================================
function initSuitieForm(currentUser) {
  const addBtn     = document.getElementById("suities-add-btn");
  const formCard   = document.getElementById("suities-form-card");
  const cancelBtn  = document.getElementById("suitie-cancel-btn");
  const form       = document.getElementById("suitie-form");

  const suiteSelect = document.getElementById("suitie-suite-select");

  const firstInput  = document.getElementById("suitie-first");
  const lastInput   = document.getElementById("suitie-last");
  const emailInput  = document.getElementById("suitie-email");
  const phoneInput  = document.getElementById("suitie-phone");
  const noteInput   = document.getElementById("suitie-note");
  const listEl      = document.getElementById("suities-list");
  const appFileInput = document.getElementById("suitie-app-file");
  const appDisplay   = document.getElementById("suitie-details-app");

  const photoFileInput = document.getElementById("suitie-photo-file");
const photoDisplay   = document.getElementById("suitie-details-photo");


  const detailsCard   = document.getElementById("suitie-details-card");
  const detailsTitle  = document.getElementById("suitie-details-title");
  const detailsSuite  = document.getElementById("suitie-details-suite");
  const detailsName   = document.getElementById("suitie-details-name");
  const detailsEmail  = document.getElementById("suitie-details-email");
  const detailsPhone  = document.getElementById("suitie-details-phone");
  const detailsNote   = document.getElementById("suitie-details-note");

  const rentAmountEl  = document.getElementById("rent-amount-display");
  const rentDueEl     = document.getElementById("rent-due-display");
  const rentPaidEl    = document.getElementById("rent-paid-display");
  const rentLateEl    = document.getElementById("rent-late-display");
  const rentInput     = document.getElementById("suitie-rent");
  const rentDueInput  = document.getElementById("suitie-rent-due");
  const editBtn       = document.getElementById("suitie-edit-btn");
  const backBtn       = document.getElementById("suitie-back-btn");
const deleteBtn     = document.getElementById("suitie-delete-btn");

const suitieFilterRow  = document.getElementById("suitie-filter-row");
const suitieIntroText  = document.getElementById("suitie-intro-text");
const suitieFormCard   = document.getElementById("suitie-form-card"); // your Add Suitie form
const suitieCancelBtn  = document.getElementById("suitie-cancel-btn");
const suitieAddBtn     = document.getElementById("suitie-add-btn");


let suities = [];
let currentLocationFilter = "";   // "" means "All locations"

const suitieLocationFilter = document.getElementById("suities-location-filter");

let suites = [];                  // 👈 keep all loaded Suite records here






  //Delete Suitie
  deleteBtn?.addEventListener("click", async () => {
  if (!selectedSuitie || !selectedSuitie.id) return;

  const sure = confirm(
    "Are you sure you want to delete this suitie? This will remove it from your list."
  );
  if (!sure) return;

  try {
    const endpoint = `${API_BASE}/api/records/Suitie/${encodeURIComponent(
      selectedSuitie.id
    )}`;

    const res = await fetch(endpoint, {
      method: "DELETE",
      credentials: "include",
      headers: { Accept: "application/json" },
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      console.warn("[suities] delete failed", res.status, txt);
      alert(`Couldn't delete suitie (${res.status}). Check console for details.`);
      return;
    }

    console.log("[suities] deleted", selectedSuitie.id);

    // reload list + reset UI
    await loadSuities();
    selectedSuitie = null;
    if (detailsCard) detailsCard.style.display = "none";
    if (listEl) listEl.style.display = "block";
  } catch (err) {
    console.error("[suities] delete error", err);
    alert("Something went wrong while deleting this suitie. Please try again.");
  }
});

  // helper: safely read a text field from row.values
  function getText(v, label) {
    const raw = v[label];
    if (raw == null) return "";
    if (typeof raw === "string") return raw;
    if (typeof raw === "object") {
      // handle shapes like { value: "..."} or { text: "..." }
      return raw.value || raw.text || raw.label || raw.name || "";
    }
    return "";
  }


  // ---- Normalize one Suitie record from API → simple object ----
function normalizeSuitie(row) {
  const v = row.values || row;

  // --- Location reference ---
  const locRef = v.Location || v["Location"] || null;
  const locVals = (locRef && (locRef.values || locRef)) || {};
  const locationId =
    (locRef && (locRef._id || locRef.id)) ||
    v.locationId ||
    "";
  const locationLabel =
    getText(locVals, "Location Name") ||
    getText(locVals, "Name") ||
    "";

  // --- Suite reference (what you already had) ---
  const suiteRef   = v.Suite || v.suite || null;
  const suiteVals  = (suiteRef && (suiteRef.values || suiteRef)) || {};
  const suiteId    =
    (suiteRef && (suiteRef._id || suiteRef.id)) ||
    v.suiteId ||
    "";

  const suiteLabel =
    getText(suiteVals, "Suite Number/Name") ||
    getText(suiteVals, "Suite Name") ||
    suiteVals.name ||
    "";

  const suiteName =
    getText(v, "Suite Number/Name") ||
    getText(v, "Suite Name") ||
    getText(v, "Location Name") ||
    getText(v, "Name");

  const firstName = getText(v, "First Name");
  const lastName  = getText(v, "Last Name");
  const email     = getText(v, "Email");
  const phone     = getText(v, "Phone Number");
  const note      = getText(v, "Note");

  console.log("[suities] normalizeSuitie debug", {
    row,
    values: v,
    keys: Object.keys(v || {}),
    suiteName,
    suiteLabel,
    locationId,
    locationLabel,
    firstName,
    lastName,
  });

  return {
    id: row._id || row.id || "",
    suiteId,
    suiteName,
    suiteLabel,
    locationId,    // 👈 important
    locationLabel, // 👈 optional, for display later

    firstName,
    lastName,
    email,
    phone,
    note,

    rentAmount: v["Suite Rent"]     || null,
    rentDue:    v["Rent Due Date"]  || v["Rent Due"] || null,
    rentPaid:   v["Rent Paid Date"] || null,
    lateFee:    v["Late Fee"]       || null,

    appFileUrl:
      v["Application File"] ||
      v["Application URL"] ||
      null,

    photoUrl:
      v["Suitie Photo"] ||
      v["Photo URL"] ||
      v["Photo"] ||
      v.photoUrl ||
      null,

    applicationTemplate:
      v.applicationTemplate || v["Application Template"] || "",
    applicationPdf:
      v.applicationPdf ||
      v["Application PDF URL"] ||
      v["Application PDF"] ||
      "",

    values: v,
  };
}
function refreshSuitieLocationDropdown() {
  if (!suitieLocationFilter) return;

  // reset dropdown
  suitieLocationFilter.innerHTML = `<option value="">All locations</option>`;

  // pull locations that the Locations section loaded
  const locs =
    window.STATE && Array.isArray(window.STATE.locations)
      ? window.STATE.locations
      : [];

  const seen = new Set();

  locs.forEach((loc) => {
    const v = loc.values || loc;

    const id =
      loc.id ||
      loc._id ||
      v._id ||
      "";

    const name =
      loc.name ||
      v["Location Name"] ||
      v.LocationName ||
      "";

    if (!id || !name || seen.has(id)) return;
    seen.add(id);

    const opt = document.createElement("option");
    opt.value = String(id);
    opt.textContent = name;
    suitieLocationFilter.appendChild(opt);
  });

  console.log(
    "[suities-filter] options from locations:",
    Array.from(suitieLocationFilter.options).map((o) => ({
      value: o.value,
      label: o.textContent,
    }))
  );
}

// make it callable from the Locations code
window.refreshSuitieLocationDropdown = refreshSuitieLocationDropdown;


function renderSuities() {
  listEl.innerHTML = "";

  const visibleSuities = currentLocationFilter
    ? suities.filter((s) => s.locationId === currentLocationFilter)
    : suities;

  if (!visibleSuities.length) {
    listEl.innerHTML =
      `<p class="muted">No suities found for this location.</p>`;
    return;
  }

  visibleSuities.forEach((s) => {
    const card = document.createElement("div");
    card.className = "suitie-item";

    const occupier =
      [s.firstName, s.lastName].filter(Boolean).join(" ") || "";
    const contactBits = [];
    if (s.email) contactBits.push(s.email);
    if (s.phone) contactBits.push(s.phone);

    const title =
      s.suiteName ||
      (s.suiteLabel ? s.suiteLabel : "") ||
      occupier ||
      "Untitled suitie";

    const rentAmountText =
      s.rentAmount != null && s.rentAmount !== ""
        ? `$${Number(s.rentAmount).toFixed(2)}`
        : "—";

    const isPaid = !!s.rentPaid;
    const rentStatusText  = isPaid ? "Paid" : "Not paid";
    const rentStatusClass = isPaid ? "is-paid" : "is-unpaid";

    card.innerHTML = `
      <div class="suitie-main-row">
        <div class="suitie-main-left">
          <div class="suitie-main-left-inner">
            ${
              s.photoUrl
                ? `<div class="suitie-avatar">
                     <img src="${s.photoUrl}" alt="${title}" />
                   </div>`
                : `<div class="suitie-avatar suitie-avatar--placeholder">
                     <span>${(title || "?").charAt(0).toUpperCase()}</span>
                   </div>`
            }
            <div class="suitie-text">
              <h3>${title}</h3>
              ${
                s.locationLabel
                  ? `<p class="suitie-meta">Location: ${s.locationLabel}</p>`
                  : ""
              }
              ${
                s.suiteLabel && s.suiteLabel !== title
                  ? `<p class="suitie-meta">Suite: ${s.suiteLabel}</p>`
                  : ""
              }
              ${occupier ? `<p>${occupier}</p>` : ""}
              ${
                contactBits.length
                  ? `<p class="suitie-meta">${contactBits.join(" • ")}</p>`
                  : ""
              }
              ${s.note ? `<p class="suitie-meta">${s.note}</p>` : ""}
            </div>
          </div>
        </div>

        <div class="suitie-main-right">
          <div class="rent-amount">${rentAmountText}</div>
          <div class="rent-status ${rentStatusClass}">
            ${rentStatusText}
          </div>
        </div>
      </div>
    `;

    card.addEventListener("click", () => {
      showSuitieDetails(s);   // (use showSuitieDetails here)
    });
    listEl.appendChild(card);
  });
}

suitieLocationFilter?.addEventListener("change", () => {
  currentLocationFilter = suitieLocationFilter.value || "";

  if (!currentLocationFilter) {
    // back to "all locations" list view
    if (detailsCard) detailsCard.style.display = "none";
    if (listEl) listEl.style.display = "block";
    selectedSuitie = null;
  }

  renderSuities();
});

// 🔹 Helper: how much rent has actually been paid this year for a location
function getLocationPaidTotalThisYear(locationId) {
  if (!window.STATE || !Array.isArray(window.STATE.suities)) return 0;

  const suities = window.STATE.suities;
  const currentYear = new Date().getFullYear();

  return suities.reduce((sum, s) => {
    // must belong to this location
    if (String(s.locationId) !== String(locationId)) return sum;

    // must have a paid date
    if (!s.rentPaid) return sum;

    const paidDate = new Date(s.rentPaid);
    if (Number.isNaN(paidDate.getTime())) return sum;

    // only count payments from this calendar year
    if (paidDate.getFullYear() !== currentYear) return sum;

    const amt = Number(s.rentAmount);
    if (!Number.isFinite(amt)) return sum;

    return sum + amt;
  }, 0);
}

async function showSuitieDetails(s) {
  if (!detailsCard || !listEl) return;
  selectedSuitie = s;

  // 🔹 hide the list, show the details card
  listEl.style.display = "none";
  detailsCard.style.display = "block";

  const fullName = [s.firstName, s.lastName].filter(Boolean).join(" ");

  detailsTitle.textContent =
    s.suiteName || s.suiteLabel || "Suitie details";

  detailsSuite.textContent = s.suiteLabel
    ? `Suite: ${s.suiteLabel}`
    : "";

  detailsName.textContent  = fullName || "—";
  detailsEmail.textContent = s.email || "—";
  detailsPhone.textContent = s.phone || "—";
  detailsNote.textContent  = s.note || "—";

  // Rent display
  rentAmountEl.textContent =
    s.rentAmount != null && s.rentAmount !== ""
      ? `$${Number(s.rentAmount).toFixed(2)}`
      : "—";

  rentDueEl.textContent = s.rentDue
    ? new Date(s.rentDue).toLocaleDateString()
    : "—";

  rentPaidEl.textContent = s.rentPaid
    ? new Date(s.rentPaid).toLocaleDateString()
    : "—";

  rentLateEl.textContent =
    s.lateFee != null && s.lateFee !== ""
      ? `$${Number(s.lateFee).toFixed(2)}`
      : "—";

  // 🔹 Application file (from Suitie record)
  if (appDisplay) {
    if (s.appFileUrl) {
      appDisplay.innerHTML = `
        <a href="${s.appFileUrl}" target="_blank" rel="noopener">
          View application
        </a>
      `;
    } else {
      appDisplay.textContent = "No application uploaded.";
    }
  }

  // 🔹 Suitie photo
  if (photoDisplay) {
    if (s.photoUrl) {
      photoDisplay.src = s.photoUrl;
      photoDisplay.style.display = "block";
    } else {
      photoDisplay.src = "";
      photoDisplay.style.display = "none";
    }
  }

  // 🔹 NEW: load latest Suite Application Submission (status, answers, etc.)
  try {
    const submission = await loadSuitieApplication(s);

    if (submission && appDisplay) {
      const v = submission.values || submission;
      const status = v.Status || "Pending";
      appDisplay.textContent = `Application status: ${status}`;
      // later you can add a separate "View answers" button / popup
    } else if (appDisplay && !s.appFileUrl) {
      // only show this if there's no Suitie-level file either
      appDisplay.textContent = "No application submitted yet.";
    }
  } catch (err) {
    console.error("[suities] loadSuitieApplication error", err);
    // optional: don’t override the existing appDisplay text on error
  }
}

  


backBtn?.addEventListener("click", () => {
  if (listEl) listEl.style.display = "block";
  if (detailsCard) detailsCard.style.display = "none";
  selectedSuitie = null;

  // reset dropdown back to "All locations"
  if (suitieLocationFilter) suitieLocationFilter.value = "";
  currentLocationFilter = "";
  renderSuities();
    showSuitieFilterAndIntro();
});


async function loadSuitieApplication(suitie) {
  const url =
    `${API_BASE}/public/records` +
    `?dataType=Suite Application Submission` +
    `&Suitie=${encodeURIComponent(suitie.id)}` +
    `&includeRefField=1` + 
    `&limit=1`;

  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) return null;
  const data = await res.json();
  const rows = Array.isArray(data) ? data : data.records || data.items || [];
  return rows[0] || null;
}

  // ---- Load existing suities from backend ----
async function loadSuities() {
  const url = `${API_BASE}/public/records?dataType=Suitie&limit=200`;

  try {
    const res = await fetch(url, {
      credentials: "include",
      headers: { Accept: "application/json" },
    });

    if (!res.ok) {
      console.warn("[suities] load failed", res.status);
      suities = [];
      window.STATE.suities = suities;
      renderSuities();
      updateDashboardCounts();
      return;
    }

    const data = await res.json();
    const rows = Array.isArray(data)
      ? data
      : data.records || data.items || [];

    console.log("[suities] raw rows from API:", rows);
    const nonEmptyRows = rows.filter(
      (r) => r.values && Object.keys(r.values).length
    );
    console.log("[suities] filtered:", nonEmptyRows);

    suities = nonEmptyRows.map(normalizeSuitie);
    window.STATE.suities = suities;

    console.log("[suities] loaded", suities.length);

    // 🔹 build the "Filter by location" dropdown from the loaded suities
    refreshSuitieLocationDropdown();

    renderSuities();
    updateDashboardCounts();

  } catch (err) {
    console.error("[suities] load error", err);
    suities = [];
    window.STATE.suities = suities;
    renderSuities();
    updateDashboardCounts();
  }
}


// ---- Initial state ----
formCard.hidden = true;
loadSuitesForUser();  // 🔹 fill dropdown
loadSuities();        // 🔹 render list + update dashboard


    // When "Edit suitie" is clicked, prefill the form from selectedSuitie
// When "Edit suitie" is clicked, prefill the form from selectedSuitie
editBtn?.addEventListener("click", () => {
  if (!selectedSuitie) return;
  formCard.hidden = false;

  if (suiteSelect && selectedSuitie.suiteId) {
    suiteSelect.value = selectedSuitie.suiteId;
  }

  // no suite-name field anymore, so nothing else to set here

  if (firstInput) firstInput.value = selectedSuitie.firstName || "";
  if (lastInput)  lastInput.value  = selectedSuitie.lastName  || "";

  emailInput.value = selectedSuitie.email || "";
  phoneInput.value = selectedSuitie.phone || "";
  noteInput.value  = selectedSuitie.note  || "";

  if (rentInput) {
    rentInput.value =
      selectedSuitie.rentAmount != null && selectedSuitie.rentAmount !== ""
        ? String(selectedSuitie.rentAmount)
        : "";
  }

  if (rentDueInput) {
    rentDueInput.value = selectedSuitie.rentDue
      ? String(selectedSuitie.rentDue).slice(0, 10)
      : "";
  }

  if (appFileInput)   appFileInput.value = "";
  if (photoFileInput) photoFileInput.value = "";

  formCard.scrollIntoView({ behavior: "smooth", block: "start" });
});


// open form
addBtn.addEventListener("click", () => {
  formCard.hidden = false;
  form.reset();

  // focus first useful field now that suite name input is gone
  if (suiteSelect) {
    suiteSelect.focus();
  } else if (firstInput) {
    firstInput.focus();
  }

  if (listEl)      listEl.style.display = "none";
  if (detailsCard) detailsCard.style.display = "none";

  // hide dropdown + intro text
  if (suitieFilterRow) suitieFilterRow.style.display = "none";
  if (suitieIntroText) suitieIntroText.style.display = "none";

  selectedSuitie = null;
});


function showSuitieFilterAndIntro() {
  if (suitieFilterRow) suitieFilterRow.style.display = "";
  if (suitieIntroText) suitieIntroText.style.display = "";
}

  // cancel form
cancelBtn?.addEventListener("click", () => {
  form.reset();
  formCard.hidden = true;

  if (listEl) listEl.style.display = "block";
  if (detailsCard) detailsCard.style.display = "none";

  selectedSuitie = null;
  showSuitieFilterAndIntro();   // 👈 add this
});



// submit → create OR update suitie
form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const suiteId = suiteSelect ? suiteSelect.value.trim() : "";

    // 🔹 NEW: find the selected suite object from the suites array
  const suite = Array.isArray(suites)
    ? suites.find((s) => s.id === suiteId)
    : null;

  // safely read first/last name from inputs (they might be null)
  const first = firstInput ? firstInput.value.trim() : "";
  const last  = lastInput  ? lastInput.value.trim()  : "";

  const email   = emailInput.value.trim();
  const phone   = phoneInput.value.trim();
  const note    = noteInput.value.trim();
  const rentStr = rentInput ? rentInput.value.trim() : "";
  const rentDue = rentDueInput ? rentDueInput.value : "";

  // ✅ we now REQUIRE a suite to be selected instead of a free-text suite name
  if (!suiteId) {
    alert("Please select a suite for this suitie.");
    return;
  }

const values = {
  // "Suite Number/Name": suiteName,   // ❌ still removed
  "First Name": first,
  "Last Name": last,
  Email: email,
  "Phone Number": phone,
  Note: note,
  createdBy: currentUser.id,
  updatedBy: currentUser.id,
};

  // link to Suite record
  values.Suite = { _id: suiteId };

    // 🔥 NEW: also link the Location based on the Suite’s location
  if (suite && suite.locationId) {
    values.Location = { _id: suite.locationId };
  }

  // optional rent fields
  if (rentStr) {
    values["Suite Rent"] = Number(rentStr);
  }
  if (rentDue) {
    values["Rent Due Date"] = rentDue;
  }

  
  console.log("[suities] saving suitie", { suiteId, values });

  // 🔹 upload application file (if any)
  if (appFileInput && appFileInput.files && appFileInput.files[0]) {
    const file = appFileInput.files[0];
    const formData = new FormData();
    formData.append("file", file);

    try {
      const uploadRes = await fetch(`${API_BASE}/api/upload`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      if (!uploadRes.ok) {
        const txt = await uploadRes.text().catch(() => "");
        console.warn("[suities] file upload failed", uploadRes.status, txt);
        alert(
          `Couldn't upload application file (${uploadRes.status}). Check console for details.`
        );
      } else {
        const uploadJson = await uploadRes.json().catch(() => ({}));
        if (uploadJson && uploadJson.url) {
         values["Suite Application File"] = uploadJson.url;

        }
      }
    } catch (err) {
      console.error("[suities] file upload error", err);
      alert("Something went wrong while uploading the application file.");
    }
  }

  // 🔹 upload photo (if any)
  if (photoFileInput && photoFileInput.files && photoFileInput.files[0]) {
    const photo = photoFileInput.files[0];
    const photoData = new FormData();
    photoData.append("file", photo);

    try {
      const uploadRes = await fetch(`${API_BASE}/api/upload`, {
        method: "POST",
        credentials: "include",
        body: photoData,
      });

      if (!uploadRes.ok) {
        const txt = await uploadRes.text().catch(() => "");
        console.warn("[suities] photo upload failed", uploadRes.status, txt);
        alert(
          `Couldn't upload suitie photo (${uploadRes.status}). Check console for details.`
        );
      } else {
        const uploadJson = await uploadRes.json().catch(() => ({}));
        if (uploadJson && uploadJson.url) {
          values["Suitie Photo"] = uploadJson.url;
        }
      }
    } catch (err) {
      console.error("[suities] photo upload error", err);
      alert("Something went wrong while uploading the suitie photo.");
    }
  }

  // 🔹 Are we editing an existing suitie or creating a new one?
  const isEditing = !!(selectedSuitie && selectedSuitie.id);

  const endpoint = isEditing
    ? `${API_BASE}/api/records/Suitie/${encodeURIComponent(selectedSuitie.id)}`
    : `${API_BASE}/api/records/Suitie`;

  const method = isEditing ? "PATCH" : "POST";

  try {
    const res = await fetch(endpoint, {
      method,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      credentials: "include",
      body: JSON.stringify({ values }),
    });





    
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      console.warn("[suities] save failed", res.status, txt);
      alert(`Couldn't save suitie (${res.status}). Check console for details.`);
      return;
    }

    const saved = await res.json().catch(() => null);
    console.log("[suities] saved", saved, "editing?", isEditing);

    await loadSuities();
    form.reset();
    formCard.hidden = true;

    if (listEl)      listEl.style.display = "block";
    if (detailsCard) detailsCard.style.display = "none";
    selectedSuitie = null;
  } catch (err) {
    console.error("[suities] save error", err);
    alert("Something went wrong while saving this suitie. Please try again.");
  }
});


}

// Global suites array used by getAllSuitesForRender()
let suites = window.STATE && Array.isArray(window.STATE.suites)
  ? window.STATE.suites
  : [];


// Normalize a Suite record from the API
function normalizeSuite(row) {
  const v = row.values || row;

  const id =
    row.id ||
    row._id ||
    v.id ||
    v._id ||
    "";

  const name =
    v["Suite Name"] ||
    v["Name"] ||
    v["Suite Number/Name"] ||
    "Untitled suite";

  const locationId =
    (v.Location && (v.Location._id || v.Location.id)) ||
    v.locationId ||
    v.LocationId ||
    "";

  const locationName =
    v["Location Name"] ||
    v.LocationName ||
    v.locationName ||
    "";

  // 🔹 template + pdf
  const applicationTemplate =
    v.applicationTemplate ||
    v["Application Template"] ||
    "";

  const applicationPdf =
    v.applicationPdf ||
    v["Application PDF URL"] ||
    v["Application PDF"] ||
    v["Application File"] ||
    "";

  // 🔹 gallery + default image  (👈 adjust field names to match your DataType)
const galleryRaw =
  v["Suite Gallery"] ||
  v["Gallery Images"] ||
  v["Suite Photos"] ||
  [];

const gallery = Array.isArray(galleryRaw) ? galleryRaw : [];

const img =
  v["Suite Default Photo"] ||
  v["Suite Photo"] ||
  v["Default Image"] ||
  (gallery.length ? gallery[0] : "") || "";



  const suiteObj = {
    id: String(id),
    name,
    locationId: locationId ? String(locationId) : "",
    locationName,
    applicationTemplate,
    applicationPdf,

    // 🎨 styles
    bgColor:
      v["Suite Background Color"] ||
      v["Background Color"] ||
      v.bgColor ||
      "",

    textColor:
      v["Suite Text Color"] ||
      v["Text Color"] ||
      v.textColor ||
      "",

    accentColor:
      v["Suite Accent Color"] ||
      v.accentColor ||
      "",

    buttonColor:
      v["Suite Button Color"] ||
      v.buttonColor ||
      "",

    // 🖼 new fields
    img,
    gallery
  };

  console.log("[normalizeSuite] suite loaded:", {
    id: suiteObj.id,
    name: suiteObj.name,
    hasTemplate: !!(
      suiteObj.applicationTemplate &&
      String(suiteObj.applicationTemplate).trim()
    ),
    hasPdf: !!suiteObj.applicationPdf,
    img: suiteObj.img,
    galleryLen: suiteObj.gallery.length,
    templatePreview:
      typeof suiteObj.applicationTemplate === "string"
        ? suiteObj.applicationTemplate.slice(0, 120)
        : suiteObj.applicationTemplate,
  });

  return suiteObj;
}



async function loadSuitesForUser() {
  const url = `${API_BASE}/public/records?dataType=Suite&limit=200`;

  try {
    const res = await fetch(url, {
      credentials: "include",
      headers: { Accept: "application/json" },
    });

    if (!res.ok) {
      console.warn("[suites] loadSuitesForUser failed", res.status);
      suites = [];
      window.STATE.suites = suites;
      renderSuitesList();
      return;
    }

    const data = await res.json();
    const rows = Array.isArray(data) ? data : data.records || data.items || [];

    suites = rows.map(normalizeSuite);
    window.STATE = window.STATE || {};
    window.STATE.suites = suites;

    renderSuitesList(); // show the list
    if (window.refreshSuitesLocationDropdown) {
      window.refreshSuitesLocationDropdown();
    }
  } catch (err) {
    console.error("[suites] loadSuitesForUser error", err);
    suites = [];
    window.STATE.suites = suites;
    renderSuitesList();
  }
}


///////////////////////////////////////////////////////////////////
//Suites Section
///////////////////////////////////////////////////////////////////                       
// Suites filter + nav
const suitesLocationFilter = document.getElementById("suites-location-filter");
const suitesNavBtn = document.querySelector('button[data-target="suites"]');

// ⬇️ hide the Add Suite button in the Suites tab
const suitesAddBtn = document.getElementById("suites-add-btn");
if (suitesAddBtn) {
  suitesAddBtn.style.display = "none";
}

// New button in location details
const locationGoSuitesBtn = document.getElementById("location-go-suites-btn");


locationGoSuitesBtn?.addEventListener("click", () => {
  if (!selectedLocation || !selectedLocation.id) {
    alert("Open a location first.");
    return;
  }

  // 1) Switch to the Suites tab by re-using your existing nav logic
  if (suitesNavBtn) {
    suitesNavBtn.click(); // uses the same sidebar handler you already have
  }

  // 2) Set the Suites filter dropdown to this location
  if (suitesLocationFilter) {
    suitesLocationFilter.value = selectedLocation.id;

    // fire change so your existing filter code runs
    const evt = new Event("change", { bubbles: true });
    suitesLocationFilter.dispatchEvent(evt);
  }
});

function refreshSuitesLocationDropdown() {
  if (!suitesLocationFilter) return;

  // reset dropdown
  suitesLocationFilter.innerHTML = `<option value="">All locations</option>`;

  // pull locations that the Locations section loaded
  const locs =
    window.STATE && Array.isArray(window.STATE.locations)
      ? window.STATE.locations
      : [];

  const seen = new Set();

  locs.forEach((loc) => {
    const v = loc.values || loc;

    const id =
      loc.id ||
      loc._id ||
      v._id ||
      "";

    const name =
      loc.name ||
      v["Location Name"] ||
      v.LocationName ||
      "";

    if (!id || !name || seen.has(id)) return;
    seen.add(id);

    const opt = document.createElement("option");
    opt.value = String(id);
    opt.textContent = name;
    suitesLocationFilter.appendChild(opt);
  });

  console.log(
    "[suites-filter] options from locations:",
    Array.from(suitesLocationFilter.options).map((o) => ({
      value: o.value,
      label: o.textContent,
    }))
  );
}

// make it callable from Locations code if you want
window.refreshSuitesLocationDropdown = refreshSuitesLocationDropdown;
refreshSuitesLocationDropdown();

// =====================
// Suites list in Suites tab
// =====================
const suitesListEl = document.getElementById("suites-list");
let suitesCurrentLocationFilter = "";

// helper: get all suites safely
function getAllSuitesForRender() {
  if (window.STATE && Array.isArray(window.STATE.suites)) {
    return window.STATE.suites;
  }
  // fallback if `suites` exists as a global
  if (typeof suites !== "undefined" && Array.isArray(suites)) {
    return suites;
  }
  return [];
}

function renderSuitesList() {
  if (!suitesListEl) return;

  const allSuites = getAllSuitesForRender();

  const visibleSuites = suitesCurrentLocationFilter
    ? allSuites.filter((s) => s.locationId === suitesCurrentLocationFilter)
    : allSuites;

  if (!visibleSuites.length) {
    suitesListEl.innerHTML =
      `<p class="muted">No suites found for this filter.</p>`;
    return;
  }

  suitesListEl.innerHTML = "";

  visibleSuites.forEach((suite) => {
    const card = document.createElement("div");
    card.className = "suite-item";

    const locationName = suite.locationName || "Unassigned location";

    card.innerHTML = `
      <div class="suite-main-row">
        <div class="suite-main-text">
          <h3>${suite.name}</h3>
          <p class="suite-meta">Location: ${locationName}</p>
        </div>
      </div>
    `;

    suitesListEl.appendChild(card);
  });
}

// when the Location dropdown in Suites tab changes → filter the suites list
suitesLocationFilter?.addEventListener("change", () => {
  suitesCurrentLocationFilter = suitesLocationFilter.value || "";
  renderSuitesList();
  renderSuiteApplications();   // 👈 update apps when filter changes
});

//Show submitted Applications 
// ========= Applications table under Suites =========
// ========= Applications table under Suites =========
let suiteApplications = [];

// helper: read a suite id from the Application values
function getSuiteIdFromApplicationRow(row) {
  const v = row.values || row;
  const ref = v.Suite || v["Suite"] || null;

  if (!ref) return null;
  if (typeof ref === "string") return ref;

  if (typeof ref === "object") {
    return String(ref._id || ref.id || "");
  }

  return null;
}

async function loadAllSuiteApplications() {
  if (!suiteApplicationsList) return;

  console.log("[suites] loadAllSuiteApplications: start");

  suiteApplicationsList.innerHTML = `<p class="muted">Loading applications…</p>`;

  try {
    const url =
      `${API_BASE}/public/records` +
      `?dataType=${encodeURIComponent(APPLICATION_TYPE)}` +
      `&includeRefField=1` +
      `&limit=500`;

    console.log("[suites] fetching applications from:", url);

    const res = await fetch(url, { credentials: "include" });
    const raw = await res.text().catch(() => "");

    console.log("[suites] applications HTTP status:", res.status);
    console.log("[suites] applications raw body:", raw);

    if (!res.ok) {
      suiteApplicationsList.innerHTML =
        `<p class="muted">Couldn’t load applications.</p>`;
      return;
    }

    let data;
    try {
      data = raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.error("[suites] JSON parse error:", e);
      data = [];
    }

    const rows = Array.isArray(data) ? data : data.records || data.items || [];
    console.log("[suites] applications parsed rows:", rows);

    // 🔹 ADD THIS BLOCK HERE
    console.log("[suites] raw application rows from API:", rows);
    rows.forEach((row) => {
      const v = row.values || row;
      console.log("[suites] raw applicant fields:", {
        id: row._id || row.id,
        applicantName: v["Applicant Name"],
        applicantEmail: v["Applicant Email"],
        Email: v["Email"],
        allKeys: Object.keys(v),
      });
    });
    // 🔹 END EXTRA DEBUG

    suiteApplications = rows;
    renderSuiteApplications();
  } catch (err) {
    console.error("[suites] loadAllSuiteApplications error", err);
    suiteApplicationsList.innerHTML =
      `<p class="muted">Couldn’t load applications.</p>`;
  }
}
async function deleteSuiteApplication(id) {
  if (!id) return;

  // APPLICATION_TYPE is the same variable you use when loading them
  const endpoint = `${API_BASE}/api/records/${encodeURIComponent(
    APPLICATION_TYPE
  )}/${encodeURIComponent(id)}`;

  console.log("[suites] deleting application", { endpoint });

  const res = await fetch(endpoint, {
    method: "DELETE",
    credentials: "include",
    headers: {
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    console.warn("[suites] delete failed", res.status, txt);
    throw new Error("HTTP " + res.status);
  }
}

// ================================
// Shared Suite Template Preview Modal
// ================================
const suiteTemplatePreviewModal = document.getElementById("suite-template-preview-modal");
const suiteTemplatePreviewBody  = document.getElementById("suite-template-preview-body");
const suiteTemplatePreviewClose = document.getElementById("suite-template-preview-close");

// Close button
if (suiteTemplatePreviewClose && suiteTemplatePreviewModal) {
  suiteTemplatePreviewClose.addEventListener("click", () => {
    suiteTemplatePreviewModal.style.display = "none";
  });
}

// 🔹 Remove the modal shell's built-in title so we only see our custom one
if (suiteTemplatePreviewModal) {
  // Try to find a header, then any heading inside it
  const header =
    suiteTemplatePreviewModal.querySelector(".suite-template-modal-header") ||
    suiteTemplatePreviewModal.querySelector(".suite-template-header") ||
    suiteTemplatePreviewModal.querySelector(".modal-header");

  if (header) {
    const builtInTitle =
      header.querySelector("h1, h2, h3, .suite-template-title, .modal-title") ||
      header.firstElementChild; // fallback

    if (builtInTitle) {
      builtInTitle.remove(); // completely delete the extra title
    }
  }
}


console.log("[suite-template-modal] modal:", {
  hasModal: !!suiteTemplatePreviewModal,
  hasBody: !!suiteTemplatePreviewBody,
  hasClose: !!suiteTemplatePreviewClose,
});


// ========= View a single Suite Application in the template modal =========
function openSuiteApplicationModal(row) {
  // re-use your existing template preview modal
  if (!suiteTemplatePreviewModal || !suiteTemplatePreviewBody) {
    console.warn("[suites] no template preview modal found for application view");
    return;
  }

  const v = row.values || row;

  // 🔹 applicant meta (pulled from the record, same fields you show in the table)
  const applicantName =
    v["Applicant Name"] ||
    v.applicantName ||
    "Unknown applicant";

  const applicantEmailRaw =
    v["Applicant Email"] ||
    v.applicantEmail ||
    v["Email"] ||
    v.email ||
    "";

  const applicantEmail = applicantEmailRaw || "";

  // 🔹 answers JSON (same as your old working code)
  const answersRaw =
    v["Answers Json"] ||
    v["Answers JSON"] ||
    v.answersJson ||
    null;

  let pairs = [];

  if (answersRaw) {
    try {
      const parsed =
        typeof answersRaw === "string" ? JSON.parse(answersRaw) : answersRaw;

      if (Array.isArray(parsed)) {
        // e.g. [{key:'dateOfApplication', label:'Date of application', value:'...'}, ...]
        pairs = parsed.map((item, idx) => ({
          question: item.label || item.question || item.key || `Question ${idx + 1}`,
          answer: item.answer || item.value || "",
        }));
      } else if (parsed && typeof parsed === "object") {
        // { dateOfApplication: '2025-12-13', applicantName: 'Ash', ... }
        pairs = Object.entries(parsed).map(([key, val]) => ({
          question: key,
          answer: typeof val === "string" ? val : JSON.stringify(val),
        }));
      }
    } catch (e) {
      console.warn("[suites] openSuiteApplicationModal parse error", e, answersRaw);
    }
  }

  // ---------- NO ANSWERS ----------
  if (!pairs.length) {
    const html = `
      <div class="suite-app-view">
        <div class="suite-app-header">
          <div class="suite-app-meta">
            <div class="suite-app-meta-name">${applicantName}</div>
            <div class="suite-app-meta-email">
              ${applicantEmail || "No email provided"}
            </div>
          </div>
          <h2 class="suite-app-title">Suite application</h2>
          <p class="suite-app-subtitle">Submitted answers</p>
        </div>
        <p class="muted">No saved answers for this application.</p>
      </div>
    `;
    suiteTemplatePreviewBody.innerHTML = html;
    suiteTemplatePreviewModal.style.display = "block";
    return;
  }

  // ---------- BUILD ROWS (same as before) ----------
  const rowsHtml = pairs
    .map(
      (p) => `
        <div class="suite-app-row">
          <div class="suite-app-label">${p.question}</div>
          <div class="suite-app-value">${p.answer || "—"}</div>
        </div>
      `
    )
    .join("");

  const html = `
    <div class="suite-app-view">
      <div class="suite-app-header">
        <div class="suite-app-meta">
          <div class="suite-app-meta-name">${applicantName}</div>
          <div class="suite-app-meta-email">
            ${applicantEmail || "No email provided"}
          </div>
        </div>
        <h2 class="suite-app-title">Suite application</h2>
        <p class="suite-app-subtitle">Submitted answers</p>
      </div>

      <section class="suite-app-section">
        <div class="suite-app-section-body">
          ${rowsHtml}
        </div>
      </section>
    </div>
  `;

  suiteTemplatePreviewBody.innerHTML = html;
  suiteTemplatePreviewModal.style.display = "block";
}


// Render the Applications card as a table
function renderSuiteApplications() {
  if (!suiteApplicationsList) return;

  const allSuites = getAllSuitesForRender();
  const suiteById = new Map(allSuites.map((s) => [String(s.id), s]));

  console.log("[suites] renderSuiteApplications: starting", {
    suitesCurrentLocationFilter,
    totalSuites: allSuites.length,
    totalApplications: suiteApplications.length,
    applicationsSample: suiteApplications.slice(0, 5),
  });

  // apply location filter using the suite’s locationId
  const visible = suiteApplications.filter((row) => {
    const suiteId = getSuiteIdFromApplicationRow(row);
    const suite = suiteId ? suiteById.get(String(suiteId)) : null;
    const locId  = suite ? suite.locationId : null;

    console.log("[suites] application row filter check:", {
      appId: row._id,
      suiteId,
      hasSuite: !!suite,
      suiteLocationId: locId,
      passesFilter:
        !suitesCurrentLocationFilter ||
        String(locId) === String(suitesCurrentLocationFilter),
    });

    if (!suite) return false;
    if (!suitesCurrentLocationFilter) return true;
    return String(locId) === String(suitesCurrentLocationFilter);
  });

  console.log("[suites] renderSuiteApplications: visible rows", {
    count: visible.length,
    visibleSample: visible.slice(0, 5),
  });

  if (!visible.length) {
    suiteApplicationsList.innerHTML =
      `<p class="muted">No applications found for this filter.</p>`;
    return;
  }

  const rowsHtml = visible
  .map((row) => {
    const v = row.values || row;
    const suiteId = getSuiteIdFromApplicationRow(row);
    const suite = suiteId ? suiteById.get(String(suiteId)) : null;

    const suiteName =
      (suite && suite.name) ||
      (suite && suite.suiteName) ||
      "Suite";

    // -------- NAME ----------
    let applicantName = v["Applicant Name"] || "";

    const answersRaw =
      v["Answers Json"] ||
      v["Answers JSON"] ||
      v.answersJson ||
      null;

    let answersObj = null;
    if (answersRaw) {
      try {
        answersObj =
          typeof answersRaw === "string"
            ? JSON.parse(answersRaw)
            : answersRaw;

        if (!applicantName && answersObj && typeof answersObj === "object") {
          applicantName =
            answersObj["Applicant Name"] ||
            answersObj["Full Name"] ||
            answersObj["Name"] ||
            applicantName;
        }
      } catch (e) {
        console.warn("[suites] Answers Json parse error", e, answersRaw);
      }
    }

    if (!applicantName) applicantName = "Unknown applicant";

    // ---------- EMAIL ----------
    let applicantEmail = v["Applicant Email"] || "";

    if (!applicantEmail && answersObj && typeof answersObj === "object") {
      applicantEmail =
        answersObj["Applicant Email"] ||
        answersObj["Email"] ||
        answersObj["email"] ||
        applicantEmail;

      if (!applicantEmail) {
        for (const val of Object.values(answersObj)) {
          if (typeof val === "string" && val.includes("@")) {
            applicantEmail = val;
            break;
          }
        }
      }
    }
    if (!applicantEmail) applicantEmail = "—";

    console.log("[suites] email debug row", {
      id: row._id,
      applicantName,
      applicantEmail,
      answersObj,
    });

    const appId = row._id || row.id;

    return `
      <tr>
        <td>${suiteName}</td>
        <td>${applicantName}</td>
        <td>${applicantEmail}</td>
        <td>
          <button
            type="button"
            class="link-button suite-app-view-btn"
            data-app-id="${appId}"
          >
            View
          </button>
        </td>
        <td>
          <button
            type="button"
            class="icon-button suite-app-delete-btn"
            data-app-id="${appId}"
            title="Delete application"
          >
            🗑
          </button>
        </td>
      </tr>
    `;
  })
  .join("");


 suiteApplicationsList.innerHTML = `
  <table class="suite-app-table">
    <thead>
      <tr>
        <th>Suite</th>
        <th>Applicant Name</th>
        <th>Applicant Email</th>
        <th>Application</th>
        <th></th> <!-- trash icon column -->
      </tr>
    </thead>
    <tbody>
      ${rowsHtml}
    </tbody>
  </table>
`;

  // hook up “View” buttons
// hook up “View” buttons
suiteApplicationsList
  .querySelectorAll(".suite-app-view-btn")
  .forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-app-id");
      const row = suiteApplications.find(
        (r) => String(r._id || r.id) === String(id)
      );
      if (row) {
        openSuiteApplicationModal(row);
      }
    });
  });

// 🔹 hook up “Delete” buttons
suiteApplicationsList
  .querySelectorAll(".suite-app-delete-btn")
  .forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-app-id");
      if (!id) return;

      const ok = confirm("Delete this application? This cannot be undone.");
      if (!ok) return;

      try {
        await deleteSuiteApplication(id);
        // remove from local array + re-render
        suiteApplications = suiteApplications.filter(
          (row) => String(row._id || row.id) !== String(id)
        );
        renderSuiteApplications();
      } catch (err) {
        console.error("[suites] deleteSuiteApplication error", err);
        alert("Couldn’t delete this application. Check console for details.");
      }
    });
  });
 }


const suiteApplicationsList = document.getElementById("suite-applications-list");

// 🔹 Fetch application submissions for a given suite
async function loadApplicationsForSuite(suiteId) {
  if (!suiteId) return [];

  try {
    const params = new URLSearchParams({
      dataType: "Suite Application Submission", // 👈 match your DataType name
      Suite: suiteId,                           // 👈 reference field "Suite"
      limit: "50",
    });

    const res = await fetch(
      `${API_BASE}/api/records?` + params.toString(),
      {
        credentials: "include",
        headers: { Accept: "application/json" },
      }
    );

    if (!res.ok) {
      console.warn("[suite-apps] HTTP", res.status);
      return [];
    }

    const body = await res.json().catch(() => ({}));
    const rows =
      Array.isArray(body.data)    ? body.data :
      Array.isArray(body.records) ? body.records :
      Array.isArray(body.items)   ? body.items :
      [];

    return rows;
  } catch (err) {
    console.error("[suite-apps] loadApplicationsForSuite error:", err);
    return [];
  }
}

async function showSuiteApplications(suite) {
  if (!suiteApplicationsList) return;

  suiteApplicationsList.innerHTML = `<p class="muted">Loading applications…</p>`;

  const rows = await loadApplicationsForSuite(suite.id);

  if (!rows.length) {
    suiteApplicationsList.innerHTML =
      `<p class="muted">No applications submitted for this suite yet.</p>`;
    return;
  }

  suiteApplicationsList.innerHTML = "";

  rows.forEach((row) => {
    const v = row.values || row;

    const name   = v["Applicant Name"]  || "Unknown applicant";
    const email  = v["Applicant Email"] || "—";
    const status = v.Status             || "Pending";
    const submittedAt =
      v["Submitted At"] || v["Created At"] || v.createdAt || null;

    const card = document.createElement("div");
    card.className = "suite-app-item";
    card.innerHTML = `
      <div class="suite-app-main">
        <div>
          <strong>${name}</strong>
          <p class="muted">${email}</p>
        </div>
        <div class="suite-app-meta">
          <span class="badge">${status}</span>
          <span class="muted">
            ${
              submittedAt
                ? new Date(submittedAt).toLocaleDateString()
                : ""
            }
          </span>
        </div>
      </div>
    `;

    suiteApplicationsList.appendChild(card);
  });
}
