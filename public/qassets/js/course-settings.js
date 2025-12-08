 //* Course-settings.js  

 
/****************************************************
 * course-settings.js
 * - API helpers
 * - Global STATE
 * - Auth module (login / logout popup)
 ****************************************************/

/* ============== API HELPERS (put FIRST) ============== */

// Use API server in dev, same-origin in prod
const API_ORIGIN =
  location.hostname === "localhost" ? "http://localhost:8400" : "";

// Build full URL for API
function apiUrl(path) {
  const base = path.startsWith("/api") ? path : `/api${path.startsWith("/") ? path : `/${path}`}`;
  return `${API_ORIGIN}${base}`;
}

// Low-level fetch wrapper
async function apiFetch(path, opts = {}) {
  return fetch(apiUrl(path), {
    credentials: "include", // send cookie
    headers: { Accept: "application/json", ...(opts.headers || {}) },
    ...opts,
  });
}

// JSON helper
window.fetchJSON = async function fetchJSON(path, opts = {}) {
  const res  = await apiFetch(path, {
    headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
    ...opts,
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { error: text }; }
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
};

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
  hydrateDashboard().catch(() => {});






























                        ////////////////////////////////////////////////////////////////////
                                                             //Courses
                          ////////////////////////////////////////////////////////////////////
 // ===================== MANAGE COURSES: show Course Outline panel =====================

//Courses Dropdown
// === Load "Your courses" dropdown ===

// 1. Fetch all Course records created by the current user
async function listCoursesForCurrentUser() {
  const uid = window.STATE?.user?.userId;
  if (!uid) return [];

  const params = new URLSearchParams();
  params.set('dataType', 'Course');        // DataType name
  params.set('limit', '200');
  // Filter by "Created By" reference
  params.set('Created By', uid);

  const res = await fetch(
    `${API_ORIGIN}/public/records?${params.toString()}`,
    {
      credentials: 'include',
      headers: { Accept: 'application/json' },
    }
  );

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }

  const data = await res.json();
  const rows = Array.isArray(data)
    ? data
    : data.records || data.items || [];

  // 🔹 Cache full records by ID so we can open them later
  window.__COURSE_CACHE = window.__COURSE_CACHE || {};
  const cache = window.__COURSE_CACHE;

  rows.forEach((row) => {
    const id = row._id || row.id;
    if (id) cache[id] = row;
  });

  // Normalize shape for dropdown
  return rows.map((row) => {
    const v = row.values || row;
    return {
      id: row._id || row.id || '',
      title: v['Course Title'] || v.Title || '(Untitled course)',
    };
  });
}


// 2. Populate the <select id="courses-select">
async function hydrateCourseDropdown() {
  const select = document.getElementById('courses-select');
  const picker = document.querySelector('.course-picker');
  if (!select) return;

  select.innerHTML = `<option value="">Loading your courses…</option>`;

  try {
    // make sure auth state is up to date
    await window.requireUser().catch(() => null);

    const courses = await listCoursesForCurrentUser();

    if (!courses.length) {
      select.innerHTML = `<option value="">No courses yet</option>`;
      // optional: hide the picker if you don't want it when empty
      // if (picker) picker.style.display = 'none';
      return;
    }

    if (picker) picker.style.display = '';

    select.innerHTML = `<option value="">Select a course…</option>`;
    for (const c of courses) {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = c.title;
      select.appendChild(opt);
    }
  } catch (err) {
    console.error('[courses] hydrateCourseDropdown failed', err);
    select.innerHTML = `<option value="">Couldn’t load courses</option>`;
  }
}

// 3. Run when auth is ready, and after saving a course
document.addEventListener('auth:ready', () => {
  hydrateCourseDropdown().catch(() => {});
  if (typeof hydrateDashboard === 'function') {
    hydrateDashboard().catch(() => {});
  }
});

// === Students section – use the SAME course list ===
async function hydrateStudentsCourseDropdown() {
  const studentsCourseSelect = document.getElementById('students-course-select');
  if (!studentsCourseSelect) return;

  studentsCourseSelect.innerHTML =
    `<option value="">Loading your courses…</option>`;

  try {
    await window.requireUser().catch(() => null);

    const courses = await listCoursesForCurrentUser();
    console.log('[students] courses for dropdown:', courses);

    if (!courses.length) {
      studentsCourseSelect.innerHTML =
        `<option value="">No courses yet</option>`;
      return;
    }

    studentsCourseSelect.innerHTML =
      `<option value="">Select a course…</option>`;

    courses.forEach((c) => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = c.title || '(Untitled course)';
      studentsCourseSelect.appendChild(opt);
    });
  } catch (err) {
    console.error('[students] hydrateStudentsCourseDropdown failed', err);
    studentsCourseSelect.innerHTML =
      `<option value="">Couldn’t load courses</option>`;
  }
}


                         // === Course outline UI + Save ===
document.addEventListener('DOMContentLoaded', () => {
    //course Let
let currentCourseId = null;



  // Buttons + cards
  const addBtn      = document.getElementById('courses-add-course');
  const outlineCard = document.getElementById('courses-outline');

  // Form fields
  const titleEl     = document.getElementById('courses-outline-title');
  const shortDescEl = document.getElementById('courses-outline-desc');
  const notesEl     = document.getElementById('courses-outline-notes');
  const priceEl     = document.getElementById('courses-price');

  // Thumbnail elements
  const thumbInput   = document.getElementById('courses-thumb');
  const thumbPreview = document.getElementById('courses-thumb-preview');

  // Buttons
  const saveBtn    = document.getElementById('courses-save');
  const cancelBtn  = document.getElementById('courses-cancel');
  const deleteBtn  = document.getElementById('courses-delete');
  const courseSelect = document.getElementById('courses-select');

  // Outline collapse toggle
  const outlineBody    = document.getElementById('courses-outline-body');
  const toggleBtn      = document.getElementById('courses-outline-toggle');
  const iconOpenSpan   = toggleBtn?.querySelector('.icon-open');
  const iconClosedSpan = toggleBtn?.querySelector('.icon-closed');

  //detailsCard 
const detailsCard      = document.getElementById('courses-details');
  const detailsBody      = document.getElementById('courses-details-body');
  const detailsToggle    = document.getElementById('courses-details-toggle');
  const dIconOpenSpan    = detailsToggle?.querySelector('.icon-open');
  const dIconClosedSpan  = detailsToggle?.querySelector('.icon-closed');

  //Sections
    const sectionsWrap   = document.getElementById('outline-sections');
  const addSectionBtn  = document.getElementById('outline-add-section');
  const emptyNote      = document.getElementById('outline-empty-note');

 // Collapse / expand Course DETAILS
  if (detailsToggle && detailsBody) {
    detailsToggle.addEventListener('click', () => {
      const isOpen = !detailsBody.hidden;

      // toggle body
      detailsBody.hidden = isOpen;

      // toggle icons
      if (dIconOpenSpan)   dIconOpenSpan.hidden   = isOpen;
      if (dIconClosedSpan) dIconClosedSpan.hidden = !isOpen;

      // accessibility
      detailsToggle.setAttribute('aria-expanded', String(!isOpen));
    });
  }

  // when you first show detailsCard (Add Course / select course),
  // you probably want it opened:
  function openDetailsCard() {
    if (!detailsCard) return;
    detailsCard.hidden = false;
    if (detailsBody) detailsBody.hidden = false;
    if (dIconOpenSpan)   dIconOpenSpan.hidden   = false;
    if (dIconClosedSpan) dIconClosedSpan.hidden = true;
  }

  // 🔹 1. Open outline when "Add Course" is clicked
  // 🔹 1. Open outline when "Add Course" is clicked (CREATE mode)
  if (addBtn && detailsCard) {
    addBtn.addEventListener('click', () => {
      currentCourseId = null;

      // clear fields...
      if (titleEl)     titleEl.value = '';
      if (shortDescEl) shortDescEl.value = '';
      if (notesEl)     notesEl.value = '';
      if (priceEl)     priceEl.value = '';
      if (thumbInput)  thumbInput.value = '';
      if (thumbPreview) {
        thumbPreview.innerHTML =
          '<span class="muted">Click to upload thumbnail</span>';
      }

      // show details + (optional) outline card
      detailsCard.hidden = false;
      if (outlineCard) outlineCard.hidden = false;

      detailsCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }


  // 🔹 2. Thumbnail preview (click box → open file, show preview)
  if (thumbInput && thumbPreview) {
    const openPicker = () => thumbInput.click();

    thumbPreview.parentElement?.addEventListener('click', openPicker);

    thumbInput.addEventListener('change', () => {
      const file = thumbInput.files?.[0];
      if (!file) {
        thumbPreview.innerHTML =
          '<span class="muted">Click to upload thumbnail</span>';
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        thumbPreview.innerHTML =
          `<img src="${reader.result}" alt="Course thumbnail">`;
      };
      reader.readAsDataURL(file);
    });
  }

  // Helper to upload thumbnail (if selected)
  async function uploadThumbIfNeeded() {
    if (!thumbInput || !thumbInput.files || !thumbInput.files[0]) return null;

    const fd = new FormData();
    fd.append('file', thumbInput.files[0]);

    const res = await fetch(apiUrl('/api/upload'), {
      method: 'POST',
      body: fd,
      credentials: 'include',
    });

    const out = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(out.error || 'Thumbnail upload failed');
    }

    // Return a usable URL for the "Thumbnail Image" field
    return out.url || out.path || out.location || null;
  }


  // 🔹 3. Save Course → POST /api/records/Course
  saveBtn?.addEventListener('click', async () => {
    try {
      const uid = await window.requireUser();  // ensure logged in

      const title = (titleEl?.value || '').trim();
      if (!title) {
        alert('Please enter a course title.');
        titleEl?.focus();
        return;
      }

      const shortDesc = (shortDescEl?.value || '').trim();
      const notes     = (notesEl?.value || '').trim();

      const priceNum  = Number(priceEl?.value || 0);
      const price     = Number.isNaN(priceNum) ? 0 : priceNum;

      // Try to upload thumbnail (optional)
      let thumbUrl = null;
      try {
        thumbUrl = await uploadThumbIfNeeded();
      } catch (err) {
        console.warn('[courses] thumbnail upload failed:', err);
        alert('Thumbnail upload failed. The course will be saved without it.');
      }

      // Build values object matching your Course DataType fields
      const values = {
        'Course Title':      title,
        'Short Description': shortDesc,
        'Outline Notes':     notes,
        'Price':             price,
        'Sale Price':        null,              // UI later
        'Created At':        new Date().toISOString(),
        'Created By':        { _id: uid },
        'Locked':            false,
        'Visible':           true,
        // Release Date, Long description, Students, Chapters, etc. can be added later
      };

      if (thumbUrl) {
        values['Thumbnail Image'] = thumbUrl;
      }

      // 🔑 Create the course
        // 🔑 Create or update the course depending on currentCourseId
    let saved;
    if (currentCourseId) {
      // EDIT mode → update existing record
      saved = await window.fetchJSON(`/api/records/${currentCourseId}`, {
        method: 'PUT',
        body: JSON.stringify({ values }),
      });
    } else {
      // CREATE mode → new record
      saved = await window.fetchJSON('/api/records/Course', {
        method: 'POST',
        body: JSON.stringify({ values }),
      });
    }


      console.log('[courses] saved course', saved);
      alert('Course saved!');

      // ✅ Refresh dropdown
      if (typeof hydrateCourseDropdown === 'function') {
        await hydrateCourseDropdown();
      } else if (window.hydrateCourseDropdown) {
        await window.hydrateCourseDropdown();
      }

      // ✅ Auto-select the new course in the dropdown
      const select = document.getElementById('courses-select');
      if (select && (saved?._id || saved?.id)) {
        const newId = saved._id || saved.id;
        select.value = newId;

        // optional: trigger any change listener
        select.dispatchEvent(new Event('change'));
      }

      // ✅ Clear the fields manually (no `form` needed)
      if (titleEl)      titleEl.value = '';
      if (shortDescEl)  shortDescEl.value = '';
      if (notesEl)      notesEl.value = '';
      if (priceEl)      priceEl.value = '';
      if (thumbInput)   thumbInput.value = '';

      if (thumbPreview) {
        thumbPreview.innerHTML =
          '<span class="muted">Click to upload thumbnail</span>';
      }

      // ✅ Hide outline after save (optional)
        if (detailsCard) detailsCard.hidden = true;

    } catch (err) {
      console.error('[courses] save failed', err);
      alert('Could not save course: ' + (err.message || err));
    }
  });

  // 🔹 4. Cancel → just hide the outline panel
  cancelBtn?.addEventListener('click', () => {
       if (detailsCard) detailsCard.hidden = true;
  });

    // 🔹 Delete course → DELETE /api/records/Course/:id
  deleteBtn?.addEventListener('click', async () => {
    try {
      if (!currentCourseId) {
        alert('Select a course from the dropdown first.');
        return;
      }

      const ok = confirm('Are you sure you want to delete this course? This cannot be undone.');
      if (!ok) return;

      await window.requireUser();

      await window.fetchJSON(`/api/records/Course/${currentCourseId}`, {
        method: 'DELETE',
      });

      alert('Course deleted.');

      // Clear current selection + outline
      currentCourseId = null;
      const select = document.getElementById('courses-select');
      if (select) {
        select.value = '';
      }

      if (titleEl)      titleEl.value = '';
      if (shortDescEl)  shortDescEl.value = '';
      if (notesEl)      notesEl.value = '';
      if (priceEl)      priceEl.value = '';
      if (thumbInput)   thumbInput.value = '';
      if (thumbPreview) {
        thumbPreview.innerHTML =
          '<span class="muted">Click to upload thumbnail</span>';
      }
      if (outline) outline.hidden = true;

      // Refresh dropdown + cache
      if (typeof hydrateCourseDropdown === 'function') {
        await hydrateCourseDropdown();
      } else if (window.hydrateCourseDropdown) {
        await window.hydrateCourseDropdown();
      }

    } catch (err) {
      console.error('[courses] delete failed', err);
      alert('Could not delete course: ' + (err.message || err));
    }
  });

  //Load a course into the outline when dropdown changes
  // 🔹 Helper: load an existing course into the outline (EDIT mode)
async function loadCourseIntoDetails(courseId) {
  if (!courseId || !detailsCard) return;

  // look up from cache
  let rec = window.__COURSE_CACHE?.[courseId];

  if (!rec) {
    try {
      await listCoursesForCurrentUser(); // repopulate cache
    } catch (e) {
      console.warn('[courses] refetch while loading details failed', e);
    }
    rec = window.__COURSE_CACHE?.[courseId];
  }

  if (!rec) {
    alert('Could not find that course.');
    return;
  }

  const v = rec.values || rec;
  currentCourseId = rec._id || rec.id || courseId;

  if (titleEl)     titleEl.value     = v['Course Title'] || v.Title || '';
  if (shortDescEl) shortDescEl.value = v['Short Description'] || '';
  if (notesEl)     notesEl.value     = v['Outline Notes'] || '';
  if (priceEl) {
    const p = v['Price'];
    priceEl.value = (p === undefined || p === null) ? '' : String(p);
  }

  if (thumbPreview) {
    const t = v['Thumbnail Image'];
    const imgUrl =
      (t && t.url) ? t.url :
      (typeof t === 'string' ? t : '');

    if (imgUrl) {
      thumbPreview.innerHTML =
        `<img src="${imgUrl}" alt="Course thumbnail">`;
    } else {
      thumbPreview.innerHTML =
        '<span class="muted">Click to upload thumbnail</span>';
    }
  }

  // show detail + outline cards
  detailsCard.hidden = false;
  if (outlineCard) outlineCard.hidden = false;

  // 🔹 load sections for this course
  await hydrateSectionsForCourse(currentCourseId);

  // scroll into view after everything is rendered
  detailsCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
}


  // 🔹 When user selects a course in the dropdown → open details (EDIT mode)
  if (courseSelect) {
    courseSelect.addEventListener('change', (e) => {
      const id = e.target.value;
      if (!id) {
        if (detailsCard) detailsCard.hidden = true;
        currentCourseId = null;
        return;
      }
      loadCourseIntoDetails(id);
      
    });
  }

  // 🔹 Collapse / expand Course Outline body
  if (toggleBtn && outlineBody) {
    toggleBtn.addEventListener('click', () => {
      const isCurrentlyOpen = !outlineBody.hidden;

      outlineBody.hidden = isCurrentlyOpen;

      if (iconOpenSpan)   iconOpenSpan.hidden   = isCurrentlyOpen;
      if (iconClosedSpan) iconClosedSpan.hidden = !isCurrentlyOpen;

      toggleBtn.setAttribute(
        'aria-expanded',
        String(!isCurrentlyOpen)
      );
    });
  }










/////////////Sections
 // helper to build a section row
const SECTION_TYPE = 'Course Section'; // DataType name

// helper to POST/PUT a section record
async function saveSectionRecord({ id, name, courseId }) {
  if (!courseId) {
    throw new Error('No courseId – save or select a course first.');
  }

  const values = {
    'Section Name': name,          // or whatever you named the text field
    'Course': { _id: courseId },   // Reference → Course
  };

  let url, method;
  if (id) {
    url = `/api/records/${id}`;
    method = 'PUT';
  } else {
    url = `/api/records/${SECTION_TYPE}`;
    method = 'POST';
  }

  const saved = await window.fetchJSON(url, {
    method,
    body: JSON.stringify({ values }),
  });

  return saved;
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
    'Lesson Blocks':   JSON.stringify(blocks   || []),
    'Lesson Chapters': JSON.stringify(chapters || []),
  };

  if (typeof description === 'string') {
    values['Lesson Description'] = description;
  }

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


// 🔹 build a section row
function createSectionRow(name = '', options = {}) {
  const { id = null, startLocked = false } = options;

  const row = document.createElement('div');
  row.className = 'outline-section-row';
  if (id) row.dataset.sectionId = id;

  // make row draggable
  row.draggable = true;

  // --- HEADER (drag + title + actions) --------------------
  const header = document.createElement('div');
  header.className = 'outline-section-header';

  // drag handle
  const drag = document.createElement('button');
  drag.type = 'button';
  drag.className = 'outline-drag';
  drag.setAttribute('aria-label', 'Reorder section');
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

  // main (title input)
  const main = document.createElement('div');
  main.className = 'outline-section-main';

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'outline-section-input';
  input.placeholder = 'Section Name';
  input.value = name;

  main.appendChild(input);

  // actions on the right
  const actions = document.createElement('div');
  actions.className = 'outline-section-actions';

  header.appendChild(drag);
  header.appendChild(main);
  header.appendChild(actions);

  // append header to row
  row.appendChild(header);

  // keep track of last saved name
  let originalName = name;

  // --------- MODE HELPERS (VIEW / EDIT) -------------------

  function switchToViewMode() {
    input.readOnly = true;
    input.classList.add('is-locked');
    actions.innerHTML = '';

    const edit = document.createElement('button');
    edit.type = 'button';
    edit.className = 'btn ghost btn-sm';
    edit.textContent = 'Edit';

    edit.addEventListener('click', () => {
      switchToEditMode();
      input.focus();
    });

    actions.appendChild(edit);
  }

  function switchToEditMode() {
    input.readOnly = false;
    input.classList.remove('is-locked');
    actions.innerHTML = '';

    // remember value when entering edit mode
    originalName = input.value;

    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'btn ghost btn-sm';
    cancel.textContent = 'Cancel';

    const save = document.createElement('button');
    save.type = 'button';
    save.className = 'btn peach btn-sm';
    save.textContent = 'Save';

    actions.appendChild(cancel);
    actions.appendChild(save);

    // Cancel
    cancel.addEventListener('click', () => {
      if (row.dataset.sectionId) {
        // existing section → revert + lock
        input.value = originalName;
        switchToViewMode();
      } else {
        // new unsaved section → remove
        row.remove();
        if (typeof updateEmptyNoteVisibility === 'function') {
          updateEmptyNoteVisibility();
        }
      }
    });

    // Save section
    save.addEventListener('click', async () => {
      const value = input.value.trim();
      if (!value) {
        alert('Please enter a section name.');
        input.focus();
        return;
      }

      if (!currentCourseId) {
        alert('Save/select the course first so sections can be linked to it.');
        return;
      }

      try {
        const existingId = row.dataset.sectionId || null;

        const saved = await saveSectionRecord({
          id: existingId,
          name: value,
          courseId: currentCourseId,
        });

        row.dataset.sectionId = saved._id || saved.id || existingId;
        originalName = value;

        // keep local order
        persistSectionsForCourse(currentCourseId);

        switchToViewMode();
      } catch (err) {
        console.error('[outline] save section failed', err);
        alert('Could not save section: ' + (err.message || err));
      }
    });
  }

  // start mode
  if (startLocked) {
    switchToViewMode();
  } else {
    switchToEditMode();
  }

  // ========================================================
  //  LESSONS AREA (under the section name)
  // ========================================================

  const lessonsRow = document.createElement('div');
  lessonsRow.className = 'outline-section-lessons';

  // container for lesson rows (we'll put inputs here)
  const lessonsList = document.createElement('div');
  lessonsList.className = 'outline-lessons-list';

  // "+ Add lesson" pill
  const addLessonBtn = document.createElement('button');
  addLessonBtn.type = 'button';
  addLessonBtn.className = 'outline-add-lesson';
  addLessonBtn.innerHTML = `
    <span class="outline-add-plus">+</span>
    <span>Add lesson</span>
  `;

  lessonsRow.appendChild(lessonsList);
  lessonsRow.appendChild(addLessonBtn);
  row.appendChild(lessonsRow);

    // --- LESSON ORDER HELPERS (per section) -----------------
  function readLessonsFromDOM() {
    const rows = lessonsList.querySelectorAll('.outline-lesson-row');
    return Array.from(rows)
      .map(r => r.dataset.lessonId)
      .filter(Boolean); // only keep ones that actually have an id
  }

  function persistLessonsForSection(sectionId) {
    if (!sectionId) return;
    const key = `ss_lessons_${sectionId}`;
    const ids = readLessonsFromDOM();
    try {
      localStorage.setItem(key, JSON.stringify(ids));
    } catch (e) {
      console.warn('[outline] could not persist lesson order', e);
    }
  }

  let lessonDragSrcRow = null;

  lessonsList.addEventListener('dragstart', (e) => {
    const rowEl = e.target.closest('.outline-lesson-row');
    if (!rowEl) return;
    lessonDragSrcRow = rowEl;
    rowEl.classList.add('is-dragging');

    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', '');
    }
  });

  lessonsList.addEventListener('dragover', (e) => {
    e.preventDefault();
    const targetRow = e.target.closest('.outline-lesson-row');
    if (!targetRow || !lessonDragSrcRow || targetRow === lessonDragSrcRow) return;

    const rect = targetRow.getBoundingClientRect();
    const offset = e.clientY - rect.top;
    const insertBefore = offset < rect.height / 2;

    if (insertBefore) {
      lessonsList.insertBefore(lessonDragSrcRow, targetRow);
    } else {
      lessonsList.insertBefore(lessonDragSrcRow, targetRow.nextSibling);
    }
  });

  lessonsList.addEventListener('drop', (e) => {
    e.preventDefault();
    if (!lessonDragSrcRow) return;

    lessonDragSrcRow.classList.remove('is-dragging');
    lessonDragSrcRow = null;

    const sectionId = row.dataset.sectionId || null;
    if (sectionId) {
      persistLessonsForSection(sectionId);
    }
  });

  lessonsList.addEventListener('dragend', () => {
    if (lessonDragSrcRow) {
      lessonDragSrcRow.classList.remove('is-dragging');
      lessonDragSrcRow = null;
    }
  });

  // 🔹 helper to build a lesson row
  // 🔹 helper to build a lesson row
  function createLessonRow(initialName = '', options = {}) {
    const { id = null, locked = false } = options; // ⬅️ add "locked"
    let lessonId      = id;
    let lessonLocked  = !!locked;                 // current lock state

    const lRow = document.createElement('div');
    lRow.className = 'outline-lesson-row';
    lRow.draggable = true;

    if (lessonId) {
      lRow.dataset.lessonId = lessonId;
    } else {
      // brand new lesson → mark as unsaved (gray background)
      lRow.classList.add('is-unsaved');
    }

    if (lessonLocked) {
      lRow.classList.add('is-locked');
    }

    // drag handle
    const lDrag = document.createElement('button');
    lDrag.type = 'button';
    lDrag.className = 'outline-lesson-drag';
    lDrag.setAttribute('aria-label', 'Reorder lesson');
    lDrag.draggable = true;
    lDrag.innerHTML = `
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

    const lInput = document.createElement('input');
    lInput.type = 'text';
    lInput.className = 'outline-lesson-input';
    lInput.placeholder = 'Lesson name';
    lInput.value = initialName;

    const lActions = document.createElement('div');
    lActions.className = 'outline-lesson-actions';

    lRow.appendChild(lDrag);
    lRow.appendChild(lInput);
    lRow.appendChild(lActions);

    // 🔹 track saved state + last saved value
    let originalName = initialName || '';
    let hasSaved     = !!lessonId; // true if this row came from the DB later

    // helper to sync lock icon + row class
    function applyLockStateToUI(lockBtn) {
      if (lockBtn) {
        lockBtn.innerHTML = lessonLocked ? '🔒' : '🔓';
        lockBtn.title     = lessonLocked ? 'Lesson locked' : 'Lesson unlocked';
      }
      if (lessonLocked) {
        lRow.classList.add('is-locked');
      } else {
        lRow.classList.remove('is-locked');
      }
    }

    // --- view / edit mode helpers (same vibe as sections) ---
    function switchLessonToViewMode() {
      lInput.readOnly = true;
      lInput.classList.add('is-locked');
      lActions.innerHTML = '';

      // ✏️ Edit button
      const edit = document.createElement('button');
      edit.type = 'button';
      edit.className = 'btn ghost btn-sm';
      edit.textContent = 'Edit';

      edit.addEventListener('click', () => {
        switchLessonToEditMode();
        lInput.focus();
      });

      // 🔐 Lock button (to the RIGHT of Edit)
      const lockBtn = document.createElement('button');
      lockBtn.type = 'button';
      lockBtn.className = 'btn ghost btn-sm lesson-lock-btn';

      applyLockStateToUI(lockBtn);

      lockBtn.addEventListener('click', async (e) => {
        e.stopPropagation();

        if (!lessonId) {
          alert('Save the lesson first before locking it.');
          return;
        }

        // toggle locally
        lessonLocked = !lessonLocked;
        applyLockStateToUI(lockBtn);

        try {
          await saveLessonLockState(lessonId, lessonLocked);
        } catch (err) {
          console.error('[lessons] failed to save lock state', err);
          alert('Could not save lesson lock state: ' + (err.message || err));
          // revert on error
          lessonLocked = !lessonLocked;
          applyLockStateToUI(lockBtn);
        }
      });

      // order: Edit then Lock → lock icon on the right
      lActions.appendChild(edit);
      lActions.appendChild(lockBtn);
    }

    function switchLessonToEditMode() {
      lInput.readOnly = false;
      lInput.classList.remove('is-locked');
      lActions.innerHTML = '';

      const cancel = document.createElement('button');
      cancel.type = 'button';
      cancel.className = 'btn ghost btn-sm';
      cancel.textContent = 'Cancel';

      const save = document.createElement('button');
      save.type = 'button';
      save.className = 'btn peach btn-sm';
      save.textContent = 'Save';

      // 🗑️ Delete button (only meaningful if we have a saved lesson)
      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'btn ghost btn-sm outline-lesson-delete';
      del.textContent = 'Delete';

      // Order: Cancel · Save · Delete
      lActions.appendChild(cancel);
      lActions.appendChild(save);
      lActions.appendChild(del);

      // 🔸 Cancel logic
      cancel.addEventListener('click', () => {
        if (!hasSaved) {
          // brand new / never saved → remove row
          lRow.remove();
          return;
        }

        // saved lesson → revert value + lock it again
        lInput.value = originalName;
        switchLessonToViewMode();
      });

      // 🔸 Save logic (hit backend)
      save.addEventListener('click', async () => {
        const val = lInput.value.trim();
        if (!val) {
          alert('Please enter a lesson name.');
          lInput.focus();
          return;
        }

        // need a section + course id to link properly
        const sectionId = row.dataset.sectionId || null;
        if (!sectionId) {
          alert('Save the section first so lessons can be linked to it.');
          return;
        }
        if (!currentCourseId) {
          alert('Save/select the course first so lessons can be linked to it.');
          return;
        }

        try {
          const saved = await saveLessonRecord({
            id: lessonId,
            name: val,
            sectionId,
            courseId: currentCourseId,
          });

          lessonId = saved._id || saved.id || lessonId;
          if (lessonId) lRow.dataset.lessonId = lessonId;

          hasSaved     = true;
          originalName = val;

          // no longer “unsaved”
          lRow.classList.remove('is-unsaved');

          switchLessonToViewMode();

          const sectionIdAfter = row.dataset.sectionId || null;
          if (sectionIdAfter) {
            persistLessonsForSection(sectionIdAfter);
          }
        } catch (err) {
          console.error('[outline] save lesson failed', err);
          alert('Could not save lesson: ' + (err.message || err));
        }
      });

      // 🔸 Delete logic
      del.addEventListener('click', async (e) => {
        e.stopPropagation(); // don’t open lesson detail

        if (!lessonId) {
          // never saved → just remove from DOM
          const sectionId = row.dataset.sectionId || null;
          lRow.remove();
          if (sectionId) {
            persistLessonsForSection(sectionId);
          }
          return;
        }

        const ok = confirm('Delete this lesson? This cannot be undone.');
        if (!ok) return;

        try {
          // same base path you use for PATCH
          const url = `/api/records/${encodeURIComponent(LESSON_TYPE)}/${lessonId}`;

          const res = await fetch(url, {
            method: 'DELETE',
            credentials: 'include',
          });

          if (!res.ok) {
            throw new Error('HTTP ' + res.status);
          }

          // remove from DOM + update order
          const sectionId = row.dataset.sectionId || null;
          lRow.remove();
          if (sectionId) {
            persistLessonsForSection(sectionId);
          }
        } catch (err) {
          console.error('[outline] delete lesson failed', err);
          alert('Could not delete lesson: ' + (err.message || err));
        }
      });
    }


    // When a lesson row (not the buttons) is clicked → open details panel
    lRow.addEventListener('click', (e) => {
      const target = e.target;

      // Ignore clicks on buttons (Edit, Save, Cancel, Lock)
      if (target.closest('button')) return;

      const lessonName = lInput.value.trim();
      const sectionId  = row.dataset.sectionId || null;
      const currentId  = lRow.dataset.lessonId || lessonId || null;

      if (typeof openLessonDetail === 'function') {
        openLessonDetail({
          lessonId: currentId,
          sectionId,
          name: lessonName,
        });
      }
    });

    // start new lessons in EDIT mode
    // if this lesson already exists → start in view mode (Edit + Lock)
    if (hasSaved) {
      switchLessonToViewMode();
    } else {
      switchLessonToEditMode();
    }

    return lRow;
  }


    // 🔹 load lessons for THIS section (uses the createLessonRow above)
  async function loadLessonsForThisSection(sectionId) {
    if (!sectionId) return;

    try {
      const params = new URLSearchParams();
      params.set('dataType', LESSON_TYPE);   // "Course Lesson"
      params.set('limit', '200');

      // optional: narrow by Course like you do for sections
      if (currentCourseId) {
        params.set('Course', currentCourseId);
      }

      // 🚨 IMPORTANT: use API_ORIGIN + /public/records (NO /api here)
      const url = `${API_ORIGIN}/public/records?${params.toString()}`;

      const res = await fetch(url, {
        credentials: 'include',
        headers: { Accept: 'application/json' },
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

        const data = await res.json();
    const rows = Array.isArray(data)
      ? data
      : data.records || data.items || [];

    // 🔍 filter on the client by Section reference
    let filtered = rows.filter((rec) => {
      const v = rec.values || {};
      const sectionRef = v['Section'];
      if (!sectionRef) return false;
      const refId = sectionRef._id || sectionRef.id || sectionRef;
      return refId === sectionId;
    });

    // 🔢 apply saved order from localStorage (if any)
    const orderKey = `ss_lessons_${sectionId}`;
    let orderIds = [];
    try {
      const raw = localStorage.getItem(orderKey);
      if (raw) orderIds = JSON.parse(raw);
    } catch {}

    if (orderIds && orderIds.length) {
      const orderMap = new Map(
        orderIds.map((id, idx) => [id, idx])
      );
      filtered.sort((a, b) => {
        const aId = a._id || a.id;
        const bId = b._id || b.id;
        const aPos = orderMap.get(aId);
        const bPos = orderMap.get(bId);
        // unknown items go to the end
        return (aPos ?? 9999) - (bPos ?? 9999);
      });
    }

    console.log('[outline] lessons for section', sectionId, filtered);

 filtered.forEach((rec) => {
  const v        = rec.values || {};
  const name     = v['Lesson Name'] || v.Name || '';
  const lessonId = rec._id || rec.id;
  const locked   = !!v['Lesson Locked'];   // ⬅️ read from backend

  const lRow = createLessonRow(name, { id: lessonId, locked });
  lessonsList.appendChild(lRow);
});

    // if there was no saved order yet, create one based on this initial order
    if (!orderIds || !orderIds.length) {
      persistLessonsForSection(sectionId);
    }

    } catch (err) {
      console.error('[outline] load lessons failed', err);
    }
  }



  // when "+ Add lesson" is clicked → show a new lesson input row
  addLessonBtn.addEventListener('click', () => {
    const lRow = createLessonRow('', { id: null });
    lessonsList.appendChild(lRow);
    const lInput = lRow.querySelector('input');
    if (lInput) lInput.focus();
  });

  // 🔸 If this section already exists (has an id), load its lessons from the server
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

sectionsWrap?.addEventListener('drop', (e) => {
  e.preventDefault();
  if (!dragSrcRow) return;

  dragSrcRow.classList.remove('is-dragging');
  dragSrcRow = null;

  // 🔹 SAVE NEW ORDER *RIGHT AFTER* DROP
  if (currentCourseId) {
    persistSectionsForCourse(currentCourseId);
  }
});

sectionsWrap?.addEventListener('dragend', () => {
  if (dragSrcRow) {
    dragSrcRow.classList.remove('is-dragging');
    dragSrcRow = null;
  }
});


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
async function hydrateSectionsForCourse(courseId) {
  if (!sectionsWrap || !courseId) return;

  const key = `ss_course_sections_${courseId}`;
  const raw = localStorage.getItem(key);

  // clear any old rows
  sectionsWrap.innerHTML = '';

  const emptyNote = document.getElementById('outline-empty-note');

  if (!raw) {
    if (emptyNote) emptyNote.hidden = false;
    return;
  }

  let list = [];
  try {
    list = JSON.parse(raw);
  } catch {
    list = [];
  }

  if (emptyNote) emptyNote.hidden = list.length > 0;

list.forEach((sec, idx) => {
  const row = createSectionRow(sec.title || '', {
    // if we don’t have a real backend id, use a stable local one
    id: sec.id || `local-${idx}`,
    startLocked: true,   // saved sections start in view mode
  });
  sectionsWrap.appendChild(row);
});

}








//Lesson Section
  const outlinePanel       = document.getElementById('course-outline-panel');
  const lessonDetailPanel  = document.getElementById('lesson-detail-panel');
  const lessonDetailTitle  = document.getElementById('lesson-detail-title');
  const lessonDetailName   = document.getElementById('lesson-detail-name');
  const lessonDetailDesc   = document.getElementById('lesson-detail-description');
  const lessonDetailLessonId  = document.getElementById('lesson-detail-lesson-id');
  const lessonDetailSectionId = document.getElementById('lesson-detail-section-id');
  const lessonDetailBack   = document.getElementById('lesson-detail-back');
 
  const dropZone   = document.getElementById('lesson-drop-zone');
 const palettes = Array.from(document.querySelectorAll('.lesson-block-palette'));

  const lessonDetailSave      = document.getElementById('lesson-detail-save');
const chapterDropZone = document.getElementById('chapter-drop-zone');

async function openLessonDetail({ lessonId, sectionId, name }) {
  // minimize outline
  if (outlinePanel) outlinePanel.classList.add('is-minimized');

  // show details panel
  if (lessonDetailPanel) lessonDetailPanel.style.display = 'block';

  // basic info from the outline row
  if (lessonDetailTitle) lessonDetailTitle.textContent = name || 'Lesson details';
  if (lessonDetailName)  lessonDetailName.value = name || '';
  if (lessonDetailLessonId)  lessonDetailLessonId.value  = lessonId || '';
  if (lessonDetailSectionId) lessonDetailSectionId.value = sectionId || '';

  // default: empty drop zone until we load
  if (dropZone) {
    dropZone.innerHTML = '';
    const hint = document.createElement('p');
    hint.className = 'lesson-drop-hint';
    hint.textContent = 'Loading lesson...';
    dropZone.appendChild(hint);
  }

  if (!lessonId) {
    // nothing else we can load
    return;
  }

  try {
    // 🔹 assumes GET /api/records/:typeName/:id exists (similar pattern to your PATCH)
    const url   = `/api/records/${encodeURIComponent(LESSON_TYPE)}/${lessonId}`;
    const rec   = await window.fetchJSON(url);
const vals  = rec.values || {};

const isLocked = !!vals['Lesson Locked'];
console.log('[lesson] loaded lock state:', isLocked);

// if you want to keep it somewhere:
window.CURRENT_LESSON_LOCKED = isLocked;

    // update title/description from the record in case they changed
    const savedName = vals['Lesson Name'] || name || '';
    if (lessonDetailTitle) lessonDetailTitle.textContent = savedName || 'Lesson details';
    if (lessonDetailName)  lessonDetailName.value = savedName;

    if (lessonDetailDesc) {
      lessonDetailDesc.value = vals['Lesson Description'] || '';
    }

   // 🔹 Lesson-level blocks (for the main drop zone)
let blocks = [];
if (vals['Lesson Blocks']) {
  try {
    blocks = JSON.parse(vals['Lesson Blocks']);
  } catch (e) {
    console.error('[outline] could not parse Lesson Blocks JSON', e);
  }
}

// ✅ pass the lesson drop zone element
rebuildDropZoneFromBlocks(dropZone, blocks);


    // 🔹 Chapters (OUTSIDE the drop area)
    currentLessonChapters = [];
    if (vals['Lesson Chapters']) {
      try {
        currentLessonChapters = JSON.parse(vals['Lesson Chapters']) || [];
      } catch (e) {
        console.error('[outline] could not parse Lesson Chapters JSON', e);
        currentLessonChapters = [];
      }
    }
    window.LESSON_CHAPTERS = currentLessonChapters;

    renderChaptersList();
    if (currentLessonChapters.length) {
      openChapterDetail(0);
    } else if (chapterDetailPanel) {
      chapterDetailPanel.style.display = 'none';
    }





  } catch (err) {
    console.error('[outline] load lesson detail failed', err);

    if (dropZone) {
      dropZone.innerHTML = '';
      const hint = document.createElement('p');
      hint.className = 'lesson-drop-hint';
      hint.textContent = 'Drag blocks here';
      dropZone.appendChild(hint);
    }
  }
}

  function closeLessonDetail() {
    if (outlinePanel) outlinePanel.classList.remove('is-minimized');
    if (lessonDetailPanel) lessonDetailPanel.style.display = 'none';
  }

  if (lessonDetailBack) {
    lessonDetailBack.addEventListener('click', closeLessonDetail);
  }



 const dropZones = [dropZone, chapterDropZone].filter(Boolean);

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

      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'lesson-drop-remove';
      removeBtn.textContent = '−';
      removeBtn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        item.remove();
      });
      item.appendChild(removeBtn);

      if (data.type === 'text') {
        const textarea = document.createElement('textarea');
        textarea.className = 'lesson-drop-textarea';
        textarea.placeholder = 'Text here';
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

        label.appendChild(document.createElement('br'));
        item.appendChild(label);
        item.appendChild(fileInput);

      } else {
        const span = document.createElement('span');
        span.textContent = data.label || data.type;
        item.appendChild(span);
      }

      zone.appendChild(item);
    });
  });
}


 //Save Lesson Details
  // Read all blocks in the drop zone in visual order
  function readBlocksFromDropZone() {
    if (!dropZone) return [];
    const items = dropZone.querySelectorAll('.lesson-drop-item');

    const blocks = [];
    items.forEach((item, index) => {
      let block = { order: index, type: 'unknown' };

      // 📝 Text block
      const textArea = item.querySelector('.lesson-drop-textarea');
      if (textArea) {
        block.type = 'text';
        block.text = textArea.value.trim();
        blocks.push(block);
        return;
      }

    
      // 🎥 Video block
      const videoUrlInput  = item.querySelector('.lesson-video-url-input');
      const videoFileInput = item.querySelector('.lesson-video-file-input');
      if (videoUrlInput || videoFileInput) {
        block.type = 'video';
        block.url = (videoUrlInput?.value || '').trim();
        if (videoFileInput && videoFileInput.files && videoFileInput.files[0]) {
          // For now, just store the name; actual upload is a separate step
          block.fileName = videoFileInput.files[0].name;
        }
        blocks.push(block);
        return;
      }

      // 📎 Resource block
      const resourceInput = item.querySelector('.lesson-resource-input');
      if (resourceInput) {
        block.type = 'resource';
        if (resourceInput.files && resourceInput.files[0]) {
          block.fileName = resourceInput.files[0].name;
        }
        blocks.push(block);
        return;
      }

      // Fallback
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
      const result = await saveLessonRecord({
        id: lessonId,
        name,
        sectionId,
        courseId: currentCourseId,
        description,
        blocks,
        chapters,
      });

      console.log('[lesson] saveLessonRecord result:', result);
      alert('Lesson content saved.');
    } catch (err) {
      console.error('[outline] save full lesson content failed', err);
      alert('Could not save lesson content: ' + (err.message || err));
    }
  });
}


  // Build the drop zone UI from saved blocks
function rebuildDropZoneFromBlocks(zoneEl, blocks) {
  if (!zoneEl) return;

  zoneEl.innerHTML = '';

  if (!blocks || !blocks.length) {
    const hint = document.createElement('p');
    hint.className = 'lesson-drop-hint';
    hint.textContent = 'Drag blocks here';
    zoneEl.appendChild(hint);
    return;
  }

  const sorted = [...blocks].sort((a, b) => (a.order || 0) - (b.order || 0));

  sorted.forEach((block) => {
    const item = document.createElement('div');
    item.className = 'lesson-drop-item';

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'lesson-drop-remove';
    removeBtn.textContent = '−';
    removeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      item.remove();
    });
    item.appendChild(removeBtn);

    if (block.type === 'text') {
      const textarea = document.createElement('textarea');
      textarea.className = 'lesson-drop-textarea';
      textarea.placeholder = 'Text here';
      textarea.value = block.text || '';
      item.appendChild(textarea);

    } else if (block.type === 'video') {
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
        config.style.display = block.url || block.fileName ? 'block' : 'none';

        // URL
        const urlLabel = document.createElement('label');
        urlLabel.className = 'lesson-video-url-label';
        urlLabel.textContent = 'Video URL';

        const urlInput = document.createElement('input');
        urlInput.type = 'text';
        urlInput.className = 'lesson-video-url-input';
        urlInput.placeholder = 'Paste video link (YouTube, Vimeo, etc.)';
        urlInput.value = block.url || '';

        urlLabel.appendChild(urlInput);
        config.appendChild(urlLabel);

        // Upload from device (we can’t reattach the original file, but we can let them pick again)
        const uploadLabel = document.createElement('label');
        uploadLabel.className = 'lesson-video-url-label';
        uploadLabel.textContent = 'Or upload from your device';

        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = 'video/*';
        fileInput.className = 'lesson-video-file-input';

        uploadLabel.appendChild(fileInput);
        config.appendChild(uploadLabel);

        // Show stored file name if we have one
        if (block.fileName) {
          const fileNote = document.createElement('div');
          fileNote.className = 'lesson-video-file-note';
          fileNote.textContent = `Previously attached: ${block.fileName}`;
          config.appendChild(fileNote);
        }

        addBtn.addEventListener('click', () => {
          const isHidden = config.style.display === 'none';
          config.style.display = isHidden ? 'block' : 'none';
        });

        item.appendChild(topRow);
        item.appendChild(config);

      } else if (block.type === 'resource') {
        const label = document.createElement('div');
        label.className = 'lesson-resource-label';
        label.textContent = 'Resource';

        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.className = 'lesson-resource-input';
        fileInput.accept = '.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,image/*';

        item.appendChild(label);
        item.appendChild(fileInput);

        if (block.fileName) {
          const note = document.createElement('div');
          note.className = 'lesson-resource-note';
          note.textContent = `Previously attached: ${block.fileName}`;
          item.appendChild(note);
        }
      } else {
        // Fallback
        const span = document.createElement('span');
        span.textContent = block.type || 'Block';
        item.appendChild(span);
      }

       zoneEl.appendChild(item);
    });
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


// One array that holds all chapters for the *current* lesson
let currentLessonChapters = [];
window.LESSON_CHAPTERS = currentLessonChapters;
let draggedChapterIndex = null;

/* -------------------- BLOCK HELPERS FOR CHAPTER -------------------- */

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
      block.url = (videoUrlInput?.value || '').trim();
      if (videoFileInput && videoFileInput.files && videoFileInput.files[0]) {
        block.fileName = videoFileInput.files[0].name;
      }
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
function openChapterDetail(index) {
  if (!chapterDetailPanel) return;
  const ch = currentLessonChapters[index];
  if (!ch) return;

  // Before switching, save the previous chapter's blocks
  persistActiveChapterBlocks();

  // store which chapter is active
  if (chapterDetailIndex) chapterDetailIndex.value = String(index);

  if (chapterDetailTitle) chapterDetailTitle.textContent = ch.name || `Chapter ${index + 1}`;
  if (chapterDetailName)  chapterDetailName.value = ch.name || '';
  if (chapterDetailDesc)  chapterDetailDesc.value = ch.description || '';

  chapterDetailPanel.style.display = 'block';

  // rebuild drop zone with THIS chapter’s saved blocks
  if (chapterDropZone) {
    const blocks = Array.isArray(ch.blocks) ? ch.blocks : [];
    rebuildDropZoneFromBlocks(chapterDropZone, blocks);
  }

  highlightActiveChapterRow(index);
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
    originalName = input.value;
    switchChapterToEditMode();
    input.focus();
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

  // 🔹 Save: update currentLessonChapters[index].name and lock again
  save.addEventListener('click', (e) => {
    e.stopPropagation();

    const newName = input.value.trim();
    if (!newName) {
      alert('Please enter a chapter name.');
      input.focus();
      return;
    }

    // find this chapter's index from DOM
    const rowEl = input.closest('.outline-chapter-row');
    const idxStr = rowEl?.dataset.chapterIndex;
    const idx = idxStr ? parseInt(idxStr, 10) : -1;

    if (idx >= 0 && currentLessonChapters[idx]) {
      currentLessonChapters[idx].name = newName;
      originalName = newName;
    }

    // re-render list so labels stay in sync
    if (typeof renderChaptersList === 'function') {
      renderChaptersList();
    }

    switchChapterToViewMode();
  });

  // 🔹 Delete: remove chapter from array + refresh list
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

    // Save (row)
    save.addEventListener('click', (e) => {
      e.stopPropagation();
      const val = input.value.trim();
      if (!val) {
        alert('Please enter a chapter name.');
        input.focus();
        return;
      }

      const chapterRef = currentLessonChapters[idx];
      chapterRef.name = val;
      originalName = val;
      chapterRef.isNew = false;
      hasSaved = true;

      switchChapterToViewMode();
      highlightActiveChapterRow(idx);
    });

    // clicking row (not on buttons / input) opens detail panel
    row.addEventListener('click', (e) => {
      if (e.target === input || e.target === cancel || e.target === save) return;
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

/* -------------------- BUTTONS + INPUT LISTENERS -------------------- */

// + Add chapter
if (lessonAddChapterBtn) {
  lessonAddChapterBtn.addEventListener('click', () => {
    const newChapter = {
      id: null,
      name: `Chapter ${currentLessonChapters.length + 1}`,
      description: '',
      isNew: true,
      locked: false,   // 🔐 default unlocked
      blocks: [],
    };

    currentLessonChapters.push(newChapter);
    renderChaptersList();
    openChapterDetail(currentLessonChapters.length - 1);
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
  chapterDetailName.addEventListener('input', () => {
    const idx = parseInt(chapterDetailIndex?.value || '-1', 10);
    if (idx >= 0 && currentLessonChapters[idx]) {
      currentLessonChapters[idx].name = chapterDetailName.value;
      renderChaptersList();
      highlightActiveChapterRow(idx);
    }
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
    const blocks      = readBlocksFromDropZone();
    const chapters    = readChaptersForSave();  // uses currentLessonChapters

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
    locked: !!ch.locked,  // 🔐 persist lock state
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