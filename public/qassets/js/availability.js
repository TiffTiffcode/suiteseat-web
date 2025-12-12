console.log('[availability v2 loaded');

// 👇 replace this:
// const API_ORIGIN = window.location.origin;

// 👇 with this:
const API_ORIGIN =
  window.location.hostname === 'localhost'
    ? 'http://localhost:6400'
    : 'https://live-353x.onrender.com'; // ← put YOUR real API here


const TYPE_UPCOMING = 'Upcoming Hours';
const API = (type) => `${API_ORIGIN}/api/records/${encodeURIComponent(type)}`;



 // Remember last-used selections across page loads
const LS_BIZ = 'lastBusinessId';
const LS_CAL = 'lastCalendarId';

  // --- small fetch helpers ---
async function fetchJSON(url, init={}) {
  const res = await fetch(url, init);
  // Try to read text first (so we can show meaningful errors)
  const text = await res.text().catch(() => '');
  const ct = res.headers.get('content-type') || '';

  if (!res.ok) {
    // Server likely sent an HTML error page; surface it
    const preview = text.slice(0, 200);
    throw new Error(`${res.status} ${res.statusText} — ${preview}`);
  }

  if (ct.includes('application/json')) {
    try { return JSON.parse(text); } catch {
      throw new Error('Response was not valid JSON');
    }
  }

  // Non-JSON success; return raw text
  return text;
}
// Call the correct login route; include credentials so cookie sticks
async function apiLogin(email, password) {
  await fetchJSON('/api/login', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({ email, password })
  });
}

// Returns the user object or null (when 401)
async function getMe() {
  const res = await fetch('/api/users/me?ts=' + Date.now(), { credentials: 'include' });
  if (res.status === 401) return null;
  const ct = res.headers.get('content-type') || '';
  const body = ct.includes('application/json') ? await res.json().catch(() => ({})) : {};
  return body.user || null;
}

// UI handler for your “Log In” button on the availability page
async function onAvailabilityLoginClick() {
  const email = document.querySelector('#login-email')?.value?.trim();
  const pass  = document.querySelector('#login-pass')?.value?.trim();
  if (!email || !pass) { alert('Enter email and password'); return; }

  try {
    await apiLogin(email, pass);
    const me = await getMe();
    if (!me) { alert('Login failed. Please check your credentials.'); return; }

    console.log('[availability] logged in as', me._id || me.email);
    // continue to whatever admin action you needed…
    // e.g., enable the “Add Availability” UI
  } catch (err) {
    console.error('Login error:', err);
    alert(`Login error: ${err.message || err}`);
  }
}

// Wire up once
(function wireAvailLoginOnce(){
  const btn = document.querySelector('#btn-login-avail');
  if (btn && !btn.__wired) {
    btn.__wired = true;
    btn.addEventListener('click', onAvailabilityLoginClick);
  }
})();

  
  function toYMD(d) {
  const x = new Date(d);
  x.setHours(0,0,0,0);
  const y = x.getFullYear();
  const m = String(x.getMonth() + 1).padStart(2, '0');
  const day = String(x.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`; // local YYYY-MM-DD
}




// define once, only if not already defined
// --- DEV ONLY: make this tab "admin" so /api/records works ---

document.addEventListener("DOMContentLoaded", () => {
  // =========================
  // LOGIN 
  // =========================
  const loginStatus  = document.getElementById("user-greeting"); // make sure this id is unique in HTML
  const openLoginBtn = document.getElementById("open-login-popup-btn");
  const logoutBtn    = document.getElementById("logout-btn");
  const loginForm    = document.getElementById("login-form");

  // Always include cookies + JSON Accept header for session-protected routes
// one helper to always hit /api/*
const apiFetch = (url, opts = {}) =>
  fetch(url.startsWith('/api/') ? url : `/api${url.startsWith('/') ? url : `/${url}`}`, {
    credentials: 'include',
    headers: { Accept: 'application/json', ...(opts.headers || {}) },
    cache: 'no-store',
    ...opts,
  });

// replace old check-login with this:
async function checkLogin() {
  const res  = await apiFetch('/me');      // GET /api/me
  const text = await res.text();
  try {
    const data = JSON.parse(text);         // { ok:boolean, user:null|{...} }
    return { loggedIn: !!(data?.ok && data.user), user: data?.user || null };
  } catch {
    // got HTML or invalid JSON
    return { loggedIn: false, user: null };
  }
}

// Loader for UpcomingAvailability (adjust field names if yours differ)
/*async function loadUpcomingHours({ businessId, calendarId, fromYMD, toYMD }) {
  const where = {
    business: businessId,          // or 'Business' / 'businessId' depending on your schema
    calendar: calendarId,          // or 'Calendar' / 'calendarId'
    date: { $gte: fromYMD, $lte: toYMD },  // if you store Y-M-D; change to your shape
  };

  const qs = new URLSearchParams({
    where: JSON.stringify(where),
    limit: '1000',
    sort: JSON.stringify({ date: 1, startTime: 1 }) // optional
  });

  const url = `${API('UpcomingAvailability')}?${qs.toString()}`;
  const r = await apiFetch(url);
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return r.json();
}
*/



// Put this near the top of your file (above initLogin)
// ---- Name helper (put above initLogin) ----
function displayNameFrom(d) {
  const first =
    d?.firstName || d?.first_name || d?.user?.firstName || d?.user?.first_name;
  const last =
    d?.lastName  || d?.last_name  || d?.user?.lastName  || d?.user?.last_name;

  if (first && last) return `${first} ${last}`;

  const candidates = [
    d?.name,
    d?.user?.name,
    d?.fullName,
    d?.full_name,
    d?.displayName,
    d?.display_name,
    first,
    d?.email ? d.email.split('@')[0] : ''
  ];

  return candidates.find(Boolean) || '';
}

// ---- Login init (replace your initLogin with this) ----
// ---- Login init – use /api/me instead of /check-login ----
async function initLogin() {
  try {
    // use the apiFetch helper + /api/me
    const res  = await apiFetch('/me');  // GET /api/me
    const text = await res.text();
    let data = {};
    try {
      data = JSON.parse(text);
    } catch {
      data = {};
    }

    const user = data.user || null;
    const loggedIn = !!user;

    if (loggedIn) {
      const name =
        displayNameFrom(user) ||
        (user.email ? user.email.split('@')[0] : '') ||
        (user._id ? `User ${String(user._id).slice(-4)}` : '');

      if (loginStatus)  loginStatus.textContent = name ? `Hi, ${name} 👋` : 'Hi 👋';
      if (logoutBtn)    logoutBtn.style.display = 'inline-block';
      if (openLoginBtn) openLoginBtn.style.display = 'none';

      // after detecting login, wire dropdowns
      await initBusinessDropdown();
      await initCalendarDropdown();
    } else {
      if (loginStatus)  loginStatus.textContent = 'Not logged in';
      if (logoutBtn)    logoutBtn.style.display = 'none';
      if (openLoginBtn) openLoginBtn.style.display = 'inline-block';
    }
  } catch (e) {
    console.error('initLogin failed:', e);
    if (loginStatus) loginStatus.textContent = 'Not logged in';
  }
}



  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      try {
        const res = await fetch("/logout");
        const result = await res.json();
        if (res.ok) {
          alert("👋 Logged out!");
          window.location.href = "index.html";
        } else {
          alert(result.message || "Logout failed.");
        }
      } catch (err) {
        console.error("Logout error:", err);
        alert("Something went wrong during logout.");
      }
    });
  }

  if (openLoginBtn) {
    openLoginBtn.addEventListener("click", () => {
      document.getElementById("popup-login")?.style?.setProperty("display", "block");
      document.getElementById("popup-overlay")?.style?.setProperty("display", "block");
      document.body.classList.add("popup-open");
    });
  }

if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email    = document.getElementById("login-email").value.trim();
    const password = document.getElementById("login-password").value.trim();
    if (!email || !password) {
      alert("Please enter both email and password.");
      return;
    }

    try {
      // use the shared helper → POST /api/login
      await apiLogin(email, password);

      // confirm we’re actually logged in
      const me = await getMe();
      if (!me) {
        alert("Login failed. Please check your email and password.");
        return;
      }

      alert("✅ Logged in!");
      closeLoginPopup?.();

      // refresh the greeting + dropdowns
      await initLogin();
    } catch (err) {
      console.error("Login error:", err);
      alert(`Login error: ${err.message || err}`);
    }
  });
}











  //////////////////////////////////////////////////////////////////////////////
                       //Menu Section

// =========================
// BUSINESS DROPDOWN (replace your whole block)
// =========================
const bizSel = document.getElementById('dropdown-category-business');

async function initBusinessDropdown() {
  console.log('[biz] initBusinessDropdown called');

  await loadBusinessOptions('dropdown-category-business', { placeholder: '-- Select --' });

  if (!bizSel) {
    console.warn('[biz] dropdown-category-business not found in DOM');
    return;
  }

  console.log('[biz] options after load:', bizSel.options.length);
  // No need to auto-select or anything fancy yet
}
  // bind business -> calendar reload
  if (bizSel && !bizSel.dataset.bound) {
    bizSel.addEventListener('change', async () => {
      const bizId = bizSel.value || '';

      // remember selection for next load
      localStorage.setItem(LS_BIZ, bizId);
      sessionStorage.setItem('selectedBusinessId', bizId);

      // reset saved calendar when business changes
      localStorage.removeItem(LS_CAL);
      sessionStorage.removeItem('selectedAvailabilityCalendarId');

      // reload calendars for this business
      await loadCalendarOptions(
        'dropdown-availability-calendar',
        bizId,
        { placeholder: '-- Select --' }
      );

      // optional: clear the calendar grid until they pick a calendar
      const calSel = document.getElementById('dropdown-availability-calendar');
      if (calSel && !calSel.value) {
        // clear or disable stuff if you want
      }
    });

    bizSel.dataset.bound = '1';
  }

// =========================
// CALENDAR DROPDOWN (replace your whole block)
// =========================
// ==== Calendar dropdown (preselect last used if it still exists) ====
// --- helpers for saved ids ---
const getSavedBizId = () =>
  (typeof bizSel !== 'undefined' && bizSel?.value) ||
  localStorage.getItem(LS_BIZ) ||
  sessionStorage.getItem('selectedBusinessId') || '';

const getSavedCalId = () =>
  localStorage.getItem(LS_CAL) ||
  sessionStorage.getItem('selectedAvailabilityCalendarId') || '';

// --- robust preselect for the calendar dropdown ---
async function initCalendarDropdown() {
  const calSel = document.getElementById('dropdown-availability-calendar');
  if (!calSel) return;

  const bizId = getSavedBizId();

  // (Re)populate options for this business (your function must fill <option>s)
  await loadCalendarOptions('dropdown-availability-calendar', bizId, {
    placeholder: '-- Select --'
  });

  // Try to preselect saved calendar id
  const wanted = getSavedCalId();
  const opts = Array.from(calSel.options);

  // Find by value (coerce types + trim) or data-id fallback
  const match = opts.find(o =>
    (String(o.value).trim() == String(wanted).trim()) ||
    (o.dataset && String(o.dataset.id).trim() == String(wanted).trim())
  );

  if (match && match.value !== '') {
    calSel.value = match.value;
    calSel.disabled = false;
    // Bubble change so listeners (e.g., loadAndGenerateCalendar) run
    calSel.dispatchEvent(new Event('change', { bubbles: true }));
  } else {
    // No valid saved calendar for this business → reset
    calSel.value = '';
    calSel.disabled = opts.length <= 1; // keep disabled if only placeholder
  }

  // Save on change (bind once)
  if (!calSel.dataset.bound) {
    calSel.addEventListener('change', () => {
      const v = calSel.value || '';
      localStorage.setItem(LS_CAL, v);
      sessionStorage.setItem('selectedAvailabilityCalendarId', v);
      calSel.disabled = (v === '');
    });
    calSel.dataset.bound = '1';
  }
}













  // =========================
  // TABS (together)
  // =========================
const calendarTabs     = document.querySelectorAll(".calendarOptions");
const calendarSections = document.querySelectorAll(".content-area > div");

function isMobile() {
  return window.matchMedia("(max-width: 500px)").matches;
}

calendarTabs.forEach(tab => {
  tab.addEventListener("click", () => {
    const targetId = tab.dataset.target;

    // show the selected section
    calendarSections.forEach(s => s.style.display = "none");
    calendarTabs.forEach(t => t.classList.remove("active-tab"));
    const sectionEl = document.getElementById(targetId);
    sectionEl?.style?.setProperty("display", "block");
    tab.classList.add("active-tab");

    // smooth scroll the section into view (titles have scroll-margin in CSS)
    sectionEl?.scrollIntoView({ behavior: "smooth", block: "start" });

    // close the sidebar drawer on small screens
    if (isMobile()) {
      if (typeof closeSidebar === "function") {
        closeSidebar();
      } else {
        // fallback in case closeSidebar() isn't in scope
        const sidebar = document.getElementById("calendar-sidebar");
        const overlay = document.getElementById("sidebar-overlay");
        sidebar?.classList.remove("is-open");
        overlay?.classList.remove("show");
        document.body.classList.remove("no-scroll");
      }
    }
  });
});

  // =========================
  // SIDEBAR TOGGLER (optional block)
  // =========================
 // SIDEBAR TOGGLER (overlay on <=500px)
const sidebar           = document.getElementById("calendar-sidebar");
const openBtn           = document.getElementById("open-sidebar-btn");
const closeBtn          = document.getElementById("close-sidebar-btn");
const calendarContainer = document.querySelector(".calendar-container");
const overlay           = document.getElementById("sidebar-overlay");
const collapseBtn = document.getElementById('collapse-sidebar-btn');

function isMobile() {
  return window.matchMedia("(max-width: 500px)").matches;
}

function openSidebar() {
  if (!sidebar) return;

  if (isMobile()) {
    sidebar.classList.add("is-open");
    overlay?.classList.add("show");
    document.body.classList.add("no-scroll");
  } else {
    sidebar.classList.remove("hidden");
    calendarContainer?.classList.remove("full-width");
   document.body.classList.remove("sidebar-collapsed"); 
  }

if (openBtn)  openBtn.style.display = "none";
if (closeBtn) closeBtn.style.display = isMobile() ? "block" : "none";


  openBtn?.setAttribute("aria-expanded", "true");
  sidebar?.setAttribute("aria-hidden", "false");
}

function closeSidebar() {
  if (!sidebar) return;

  if (isMobile()) {
    sidebar.classList.remove("is-open");
    overlay?.classList.remove("show");
    document.body.classList.remove("no-scroll");
  } else {
    sidebar.classList.add("hidden");
    calendarContainer?.classList.add("full-width");
  }

if (openBtn)  openBtn.style.display = "block";
if (closeBtn) closeBtn.style.display = isMobile() ? "none" : "none";

  openBtn?.setAttribute("aria-expanded", "false");
  sidebar?.setAttribute("aria-hidden", "true");
}

openBtn?.addEventListener("click", openSidebar);
closeBtn?.addEventListener("click", closeSidebar);
overlay?.addEventListener("click", closeSidebar);

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && isMobile() && sidebar?.classList.contains("is-open")) {
    closeSidebar();
  }
});

window.addEventListener("resize", () => {
  if (isMobile()) {
    // leaving desktop -> mobile: cleanup desktop state
    document.body.classList.remove('sidebar-collapsed');
    sidebar?.classList.remove('hidden');
    calendarContainer?.classList.remove('full-width');

    // also make sure drawer is closed until user opens it
    overlay?.classList.remove('show');
    document.body.classList.remove('no-scroll');
    sidebar?.classList.remove('is-open');
  } else {
    // leaving mobile -> desktop: no overlay on desktop
    overlay?.classList.remove('show');
    document.body.classList.remove('no-scroll');
    sidebar?.classList.remove('is-open');
  }
});
// handles (put near your other consts)
const openBtnDesktop = document.getElementById('open-sidebar-btn-desktop');

// clicking the desktop burger reopens the sidebar
openBtnDesktop?.addEventListener('click', () => {
  openSidebar();               // your existing function
  // No need to hide the button manually: removing 'sidebar-collapsed'
  // makes CSS hide it automatically.
});


// Collapse on desktop / close on mobile
collapseBtn?.addEventListener('click', (e) => {
  e.preventDefault();

  if (isMobile()) {
    // behave like the mobile drawer "close"
    closeSidebar();
    return;
  }

  // Desktop: collapse the inline sidebar and let content fill the space
  document.body.classList.add('sidebar-collapsed');
  sidebar?.classList.add('hidden');
  calendarContainer?.classList.add('full-width');

  if (openBtn)  openBtn.style.display  = 'block';
  if (closeBtn) closeBtn.style.display = 'none';

  openBtn?.setAttribute('aria-expanded', 'false');
  sidebar?.setAttribute('aria-hidden', 'true');

  // move focus to a visible control (a11y)
  openBtn?.focus();
});

  // Kick things off
  initLogin();

document.getElementById('close-sidebar-btn')
  ?.addEventListener('click', () => closeSidebar && closeSidebar());

  
document.querySelectorAll('#calendar-sidebar .calendarOptions').forEach(tile => {
  tile.addEventListener('click', () => {
    document.querySelectorAll('#calendar-sidebar .calendarOptions')
      .forEach(x => x.classList.remove('active'));
    tile.classList.add('active');
  });
});

  //
//Show times on calendar for Upcoming Hours 
document.getElementById("dropdown-availability-calendar")?.addEventListener("change", () => {
  loadAndGenerateCalendar();
});

document.getElementById("dropdown-category-business")?.addEventListener("change", () => {
  loadAndGenerateCalendar();
});


//Reusable Show Times in dropdowns 

////Show times in dropdowns 
function generateTimeOptions() {
  const timeSelects = document.querySelectorAll(".time-select");
  const times = [];

  // Generate times in 15-minute intervals
  for (let hour = 0; hour < 24; hour++) {
    for (let min = 0; min < 60; min += 15) {
      const hour12 = hour % 12 === 0 ? 12 : hour % 12;
      const ampm = hour  <12 ? "AM" : "PM";
    const formattedTime = `${hour12}:${min.toString().padStart(2, "0")} ${ampm}`;
 times.push(formattedTime);
    }
  }

  // Populate each dropdown
  timeSelects.forEach(select => {
    select.innerHTML = ""; // Clear existing options
    times.forEach(time => {
      const option = document.createElement("option");
      option.value = time;
      option.textContent = time;
      select.appendChild(option);
    });
  });
}
generateTimeOptions();

/////////////////////////////////////////////////////////////

            //Upcoming Hours    
// Close popup (if present)
document.getElementById("popup-close")?.addEventListener("click", () => {
  document.getElementById("availability-popup").style.display = "none";
});

/* ===== Upcoming Hours calendar inside #upcomingHours-section ===== */


//make calendar say 2 months ago ect
// Month label: This month / Next month / 2 months away / Last month / 2 months ago ...
function relativeMonthLabel(viewYear, viewMonth) {
  const today = new Date();
  const diff = (viewYear - today.getFullYear()) * 12 + (viewMonth - today.getMonth());
  if (diff === 0)  return 'This month';
  if (diff === 1)  return 'Next month';
  if (diff === -1) return 'Last month';
  return diff > 1 ? `${diff} months away` : `${Math.abs(diff)} months ago`;
}

function setRelativeMonthBadge(y, m) {
  const el = document.querySelector('#upcomingHours-section .week-label');
  if (el) el.textContent = relativeMonthLabel(y, m);
}


/////////////
(function initUpcomingHoursCalendar(){
  const section = document.getElementById('upcomingHours-section');
  if (!section) return;

  const monthYearEl = section.querySelector('#uh-monthYear');
  const daysGridEl  = section.querySelector('#uh-days');
  const prevBtn     = section.querySelector('#uh-prev');
  const nextBtn     = section.querySelector('#uh-next');

  const monthNames = ['January','February','March','April','May','June',
                      'July','August','September','October','November','December'];

  // helpers scoped to this calendar
  const pad = (n) => String(n).padStart(2,'0');

  const formatTime = (t) => {
    if (!t) return '';
    if (/\b(AM|PM)\b/i.test(t)) return t;        // already 12-hour
    const [hStr, mStr='0'] = String(t).split(':');
    let h = parseInt(hStr, 10), m = parseInt(mStr, 10);
    const ap = h >= 12 ? 'PM' : 'AM';
    h = ((h + 11) % 12) + 1;
    return `${h}:${String(m).padStart(2,'0')} ${ap}`;
  };
const rowsToSavedHoursMap = (rows) => {
  const map = {};
  (rows || []).forEach(r => {
    const v = r.values || {};
    // Prefer a plain dateKey if present; fallback to Date field
    const raw = v.dateKey || v['Date'] || v.date || '';
    const ymd = String(raw).slice(0, 10); // works for "YYYY-MM-DD" or ISO
    if (!ymd) return;
   const start = v['Start'] || v['Start Time'] || '';
const end   = v['End']   || v['End Time']   || '';

 if ((start || end) && !map[ymd]) map[ymd] = { start, end };

  });
  // cache globally so Save can update immediately
  window.upcomingHoursMap = map;
  return map;
};

  const today = new Date();
  let viewYear  = today.getFullYear();
  let viewMonth = today.getMonth();

  async function loadAndGenerateCalendar(){
    const businessId = document.getElementById('dropdown-category-business')?.value || '';
    const calendarId = document.getElementById('dropdown-availability-calendar')?.value || '';

    // visible month range
    const start = new Date(viewYear, viewMonth, 1);
    const end   = new Date(viewYear, viewMonth + 1, 0);

    const where = { Date: { $gte: toYMD(start), $lte: toYMD(end) } };
    if (businessId) where['Business'] = businessId;
    if (calendarId) where['Calendar'] = calendarId;

    let savedMap = {};
    try{
      const url = `${API(TYPE_UPCOMING)}?where=${encodeURIComponent(JSON.stringify(where))}&limit=500&sort=-updatedAt&ts=${Date.now()}`;

      const res = await fetch(url, { credentials:'include', cache:'no-store' });
      const rows = await res.json().catch(()=>[]);
      if (res.ok && Array.isArray(rows)) savedMap = rowsToSavedHoursMap(rows);
    }catch(e){ console.error('Load upcoming hours failed', e); }

   renderMonth(viewYear, viewMonth, savedMap);
   setRelativeMonthBadge(viewYear, viewMonth);


  }

  function renderMonth(year, month, saved = {}){
    // title
    if (monthYearEl) monthYearEl.textContent = `${monthNames[month]} ${year}`;

    // grid
    daysGridEl.innerHTML = '';

    const first   = new Date(year, month, 1);
    const lead    = first.getDay();
    const numDays = new Date(year, month + 1, 0).getDate();

    // leading blanks
    for (let i=0;i<lead;i++){
      const blank = document.createElement('div');
      blank.className = 'day-cell empty';
      daysGridEl.appendChild(blank);
    }

    // month days
    for (let d=1; d<=numDays; d++){
      const cell = document.createElement('div');
      cell.className = 'day-cell';
      cell.textContent = d;

      const iso = `${year}-${pad(month+1)}-${pad(d)}`;
      cell.dataset.iso = iso;

      const avail = saved[iso];
      if (avail && (avail.start || avail.end)){
        const t = document.createElement('div');
        t.className = 'availability-time';
        t.textContent = `${formatTime(avail.start)} – ${formatTime(avail.end)}`;
        cell.classList.add('has-availability');
        cell.appendChild(t);
      }

      if (d===today.getDate() && month===today.getMonth() && year===today.getFullYear()){
        cell.classList.add('current-day');
      }

      daysGridEl.appendChild(cell);
    }
  }

  // one delegated click handler for all days
  daysGridEl?.addEventListener('click', (e) => {
    const el = e.target.closest('.day-cell[data-iso]');
    if (!el) return;
    openAvailabilityPopup(el.dataset.iso); // opens + preselects times
  });

  // nav
  prevBtn?.addEventListener('click', ()=>{
    viewMonth--; if (viewMonth < 0) { viewMonth = 11; viewYear--; }
    loadAndGenerateCalendar();
  });
  nextBtn?.addEventListener('click', ()=>{
    viewMonth++; if (viewMonth > 11) { viewMonth = 0;  viewYear++; }
    loadAndGenerateCalendar();
  });

  // expose same name other code calls after save
  window.loadAndGenerateCalendar = loadAndGenerateCalendar;

  // initial
  loadAndGenerateCalendar();
})();  
    
// ===== Weekly bridge (optional) =====
function getStartOfWeek(d) {
  const x = new Date(d);
  x.setHours(0,0,0,0);
  const day = x.getDay();
  x.setDate(x.getDate() - day);
  return x;
}
function formatDateRange(start, end) {
  const opts = { month: 'short', day: 'numeric' };
  return `${start.toLocaleDateString('en-US', opts)} – ${end.toLocaleDateString('en-US', opts)}, ${end.getFullYear()}`;
}
let currentWeekStart = getStartOfWeek(new Date());
function updateWeekDisplay() {
  const now = new Date();
  setRelativeMonthBadge(now.getFullYear(), now.getMonth());
  window.loadAndGenerateCalendar?.();
}

document.getElementById("prev-week")?.addEventListener("click", () => {
  currentWeekStart.setDate(currentWeekStart.getDate() - 7);
  updateWeekDisplay();
});
document.getElementById("next-week")?.addEventListener("click", () => {
  currentWeekStart.setDate(currentWeekStart.getDate() + 7);
  updateWeekDisplay();
});

// time-selects (if you still use them)
if (typeof initializeAllTimeSelects === 'function') initializeAllTimeSelects();



//////////////////////////////////////////////////////////////
const popupEl        = document.getElementById('availability-popup');
const popupOverlayEl = document.getElementById('popup-overlay');

function openAvailabilityModal() {
  if (!popupEl || !popupOverlayEl) return;
  popupEl.style.display = 'block';
  popupOverlayEl.classList.add('show');
  document.body.classList.add('popup-open');
}

function closeAvailabilityModal() {
  if (!popupEl || !popupOverlayEl) return;
  popupEl.style.display = 'none';
  popupOverlayEl.classList.remove('show');
  document.body.classList.remove('popup-open');
}

// close with the “×”
document.getElementById('popup-close')?.addEventListener('click', closeAvailabilityModal);
// close by clicking the grey background
popupOverlayEl?.addEventListener('click', closeAvailabilityModal);
// close with Escape
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && popupEl?.style.display === 'block') closeAvailabilityModal();
});





//
// ──────────────────────────────────────────────
// Weekly Upcoming Hours (only if you still use it)
// Requires markup like:
//  <input type="checkbox" id="toggle-upcoming-sunday" class="day-toggle" />
//  <div class="sunday-times">... start-upcoming-sunday / end-upcoming-sunday ...</div>
// and a function updateWeekDisplay() you already had.
// ──────────────────────────────────────────────
(function initWeeklyUpcomingHoursOnce() {
  const section = document.getElementById('upcomingHours-section');
  if (!section || section.dataset.weeklyBound) return;
  section.dataset.weeklyBound = '1'; // set early to prevent double-binding

  // Toggle show/hide per weekday
  section.querySelectorAll('.day-toggle').forEach(toggle => {
    const dayName = toggle.id.replace('toggle-upcoming-', ''); // 'sunday', etc.
    const row  = section.querySelector(`.${dayName}-times`);
    const sSel = document.getElementById(`start-upcoming-${dayName}`);
    const eSel = document.getElementById(`end-upcoming-${dayName}`);

    // initial state
    if (row) row.style.display = toggle.checked ? 'flex' : 'none';

    toggle.addEventListener('change', () => {
      if (row) row.style.display = toggle.checked ? 'flex' : 'none';
      if (!toggle.checked) {
        if (sSel) sSel.value = '';
        if (eSel) eSel.value = '';
      }
    });
  });

  // Tab switching → when the "Adjust Upcoming Hours" tab is clicked
  document.querySelectorAll('.calendarOptions[data-target]').forEach(tab => {
    tab.addEventListener('click', () => {
      if (tab.dataset.target !== 'upcomingHours-section') return;
      window.currentWeekStart = getStartOfWeek(new Date());
      // No need to await; it's sync
      if (typeof updateWeekDisplay === 'function') updateWeekDisplay();
    });
  });

  // Calendar dropdown change → refresh weekly view (and monthly grid if desired)
  const calSel = document.getElementById('dropdown-availability-calendar');
  if (calSel && !calSel.dataset.weeklyBound) {
    calSel.addEventListener('change', e => {
      const businessId = document.getElementById('dropdown-category-business')?.value;
      const calendarId = e.target.value;

      if (businessId && calendarId) {
        window.currentWeekStart = getStartOfWeek(new Date());
        if (typeof updateWeekDisplay === 'function') updateWeekDisplay();
        if (typeof loadAndGenerateCalendar === 'function') loadAndGenerateCalendar();
      } else {
        // Clear rows if nothing selected
        ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'].forEach(day => {
          const t = document.getElementById(`toggle-upcoming-${day}`);
          const r = section.querySelector(`.${day}-times`);
          const s = document.getElementById(`start-upcoming-${day}`);
          const e2= document.getElementById(`end-upcoming-${day}`);
          if (t)  t.checked = false;
          if (r)  r.style.display = 'none';
          if (s)  s.value = '';
          if (e2) e2.value = '';
        });
      }
    });
    calSel.dataset.weeklyBound = '1';
  }
})();

















}); // END DOMContentLoaded



// Canonicalize: ignore spaces, punctuation, and case
const canon = (s) =>
  String(s ?? '')
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[\s\-_]+/g, '')      // drop spaces/underscores/dashes
    .replace(/[^a-z0-9]/g, '');    // drop other punctuation

// Get DataType by exact name OR canonical match
async function getDataTypeByNameLoose(typeName) {
  // Try your existing function first
  const exact = await getDataTypeByName(typeName);
  if (exact) return exact;

  // Fallback: scan by canonical (add an index/cached map later if needed)
  const all = await DataType.find({ /* scope as needed */ });
  const want = canon(typeName);
  return all.find(dt => canon(dt.name) === want) || null;
}

// Build quick lookup maps for field labels and option sets
function buildFieldMaps(dt) {
  const fields = Array.isArray(dt.fields) ? dt.fields : []; // adapt to your schema
  const byCanon = new Map();      // canon(label) -> original label
  const optionsByCanon = new Map(); // label -> Map(canon(optionLabel/value) -> storedValue)

  for (const f of fields) {
    const label = f.label || f.name; // whatever you store as the field label
    if (!label) continue;
    byCanon.set(canon(label), label);

    // Option sets: accept label/value variations
    if (Array.isArray(f.options)) {
      const m = new Map();
      for (const opt of f.options) {
        const stored = opt.value ?? opt.label;     // how you store in values
        m.set(canon(opt.label), stored);
        m.set(canon(opt.value ?? ''), stored);
      }
      optionsByCanon.set(label, m);
    }
  }
  return { byCanon, optionsByCanon };
}

// Map incoming {values} keys to real labels; normalize option-set values, booleans, etc.
function normalizeIncomingValues(dt, values) {
  const { byCanon, optionsByCanon } = buildFieldMaps(dt);
  const out = {};
  for (const [k, v] of Object.entries(values || {})) {
    const realLabel = byCanon.get(canon(k)) || k;      // fall back if unknown
    let val = v;

    // Option sets: map "available"/"Available" -> stored value (e.g., "Available")
    const optMap = optionsByCanon.get(realLabel);
    if (optMap && typeof v === 'string') {
      const mapped = optMap.get(canon(v));
      if (mapped !== undefined) val = mapped;
    }

    // Booleans: accept "true"/"1"/true
    if (typeof val === 'string' && ['true','false','1','0','yes','no'].includes(val.toLowerCase())) {
      const t = val.toLowerCase();
      val = (t === 'true' || t === '1' || t === 'yes');
    }

    out[realLabel] = val;
  }
  return out;
}

// Map `where` keys (values.*) from canonical to real labels
function normalizeWhere(dt, whereObj) {
  const { byCanon } = buildFieldMaps(dt);
  const q = {};
  for (const [k, v] of Object.entries(whereObj || {})) {
    const realLabel = byCanon.get(canon(k)) || k;
    q[`values.${realLabel}`] = v;
  }
  return q;
}

// Map `sort` keys (values.*) from canonical to real labels
function normalizeSort(dt, sortObj) {
  const { byCanon } = buildFieldMaps(dt);
  const out = {};
  for (const [k, dir] of Object.entries(sortObj || {})) {
    if (k.startsWith('values.')) {
      const raw = k.slice(7);
      const realLabel = byCanon.get(canon(raw)) || raw;
      out[`values.${realLabel}`] = dir;
    } else {
      out[k] = dir;
    }
  }
  return out;
}

// =========================
// REUSABLE HELPERS
// =========================

// Fill a <select> with the user's (non-deleted) Businesses
async function loadBusinessOptions(selectId, {
  defaultId  = null,
  remember   = true,
  placeholder= '-- Select --'
} = {}) {
  const sel = document.getElementById(selectId);
  if (!sel) {
    console.warn('[biz] no select found with id', selectId);
    return;
  }

  console.log('[biz] loading options into', selectId);

  sel.innerHTML = `<option value="">${placeholder}</option>`;
  sel.disabled = true;

  try {
    const res = await fetch(`${API_ORIGIN}/api/records/Business?ts=${Date.now()}`, {
      credentials: 'include',
      cache: 'no-store'
    });
    console.log('[biz] response status', res.status);

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const raw = await res.json();
    console.log('[biz] raw response:', raw);

    const businesses = (raw || [])
      .filter(b => !b.deletedAt)
      .sort((a,b) =>
        (a?.values?.businessName || a?.values?.Name || '').localeCompare(
          b?.values?.businessName || b?.values?.Name || ''
        )
      );

    console.log('[biz] businesses after filter/sort:', businesses.length, businesses);

    sel.innerHTML = `<option value="">${placeholder}</option>`;
    for (const biz of businesses) {
      const label = biz?.values?.businessName ?? biz?.values?.Name ?? '(Untitled)';
      const opt = document.createElement('option');
      opt.value = biz._id;
      opt.textContent = label;
      sel.appendChild(opt);
    }
  } catch (e) {
    console.error('loadBusinessOptions error:', e);
    sel.innerHTML = `<option value="">${placeholder}</option>`;
  } finally {
    sel.disabled = false;
  }
}


// Fill a <select> with (non-deleted) Calendars for a Business
async function loadCalendarOptions(
  selectId,
  businessId,
  {
    placeholder = '-- Select --',
    defaultId   = null,
    rememberKey = null
  } = {}
) {
  const sel = document.getElementById(selectId);
  if (!sel) return;

  if (!businessId) {
    sel.innerHTML = `<option value="">${placeholder}</option>`;
    sel.disabled = true;
    return;
  }

  sel.innerHTML = '<option value="">Loading…</option>';
  sel.disabled = true;

  try {
const res = await fetch(`${API_ORIGIN}/api/records/Calendar?ts=${Date.now()}`, {
  credentials: 'include',
  cache: 'no-store'
});
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

const rows = (await res.json())
  .filter(c => {
    if (c.deletedAt) return false;

    const v = c.values || {};
    // Try several possible field names
    const calBizId =
      v.businessId ||
      v.Business ||
      v.business ||
      v['Business Id'] ||
      v['business id'];

    return String(calBizId) === String(businessId);
  })
  .sort((a, b) =>
    (a?.values?.calendarName || a?.values?.name || '').localeCompare(
      b?.values?.calendarName || b?.values?.name || ''
    )
  );


    sel.innerHTML = `<option value="">${placeholder}</option>`;
    for (const cal of rows) {
      const label = cal?.values?.calendarName ?? cal?.values?.name ?? '(Untitled)';
      const opt = document.createElement('option');
      opt.value = cal._id;
      opt.textContent = label;
      sel.appendChild(opt);
    }

    const remembered = rememberKey ? (sessionStorage.getItem(rememberKey) || '') : '';
    const want = defaultId || remembered;
    if (want && sel.querySelector(`option[value="${want}"]`)) sel.value = want;

    sel.disabled = rows.length === 0;
  } catch (e) {
    console.error('loadCalendarOptions:', e);
    sel.innerHTML = `<option value="">${placeholder}</option>`;
    sel.disabled = true;
  }
}

// Optional: close helper for the login popup
function closeLoginPopup() {
  document.getElementById("popup-login")?.style?.setProperty("display", "none");
  document.getElementById("popup-overlay")?.style?.setProperty("display", "none");
  document.body.classList.remove("popup-open");
}




//////////////////////////////////////////////////////////////
        //End Upcoming Hours 
     
// "HH:MM" OR "h:mm AM/PM" → minutes since midnight
function timeStrToMinutes(s) {
  if (!s) return NaN;
  s = s.trim();

  let m = s.match(/^(\d{1,2}):(\d{2})\s*([ap]m)$/i);
  if (m) {
    let hh = parseInt(m[1], 10) % 12;
    if (/pm/i.test(m[3])) hh += 12;
    return hh * 60 + parseInt(m[2], 10);
  }

  m = s.match(/^(\d{1,2}):(\d{2})$/);
  if (m) return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);

  return NaN;
}

//Upcoming Hours Section

/* =======================
   UPCOMING HOURS (new cal)
   ======================= */

/* Close Upcoming Hours popup */

 
/* ---------- helpers you already had ---------- */
function getStartOfWeek(date) {
  const copy = new Date(date);
  const day = copy.getDay(); // 0=Sun
  copy.setDate(copy.getDate() - day);
  return new Date(copy.getFullYear(), copy.getMonth(), copy.getDate());
}

function formatDateRange(startDate, endDate) {
  const options = { month: "short", day: "numeric" };
  const startStr = startDate.toLocaleDateString("en-US", options);
  const endStr   = endDate.toLocaleDateString("en-US", options);
  const yearStr  = endDate.getFullYear();
  return `${startStr} – ${endStr}, ${yearStr}`;
}

function populateTimeSelect(selectElementId) {
  const select = document.getElementById(selectElementId);
  if (!select) return;
  select.innerHTML = "";

  const def = document.createElement("option");
  def.value = "";
  def.textContent = "--:--";
  select.appendChild(def);

  for (let hour = 0; hour < 24; hour++) {
    for (let min = 0; min < 60; min += 15) {
      const h12  = hour % 12 === 0 ? 12 : hour % 12;
      const ampm = hour < 12 ? "AM" : "PM";
      const t    = `${h12}:${String(min).padStart(2, "0")} ${ampm}`;
      const opt  = document.createElement("option");
      opt.value = t;
      opt.textContent = t;
      select.appendChild(opt);
    }
  }
}

function initializeAllTimeSelects() {
  const days = ["sunday","monday","tuesday","wednesday","thursday","friday","saturday"];
  days.forEach(d => {
    populateTimeSelect(`start-${d}`);
    populateTimeSelect(`end-${d}`);
    populateTimeSelect(`start-upcoming-${d}`);
    populateTimeSelect(`end-upcoming-${d}`);
  });
}


// cache DataType ids
const TYPE_CACHE = {};
async function getTypeIdByName(name) {
  const key = name.toLowerCase();
  if (TYPE_CACHE[key]) return TYPE_CACHE[key];
  const r = await fetch(`${API_ORIGIN}/api/datatypes`, { credentials: 'include' });
  if (!r.ok) return null;
  const list = await r.json();
  const found = (list || []).find(dt =>
    String(dt.name || dt.values?.Name || '').toLowerCase() === key
  );
  return (TYPE_CACHE[key] = found?._id ? String(found._id) : null);
}

// READ (list rows for a month)
async function listUpcomingHours(where, limit = 500) {
  const url = `${API_ORIGIN}/public/records`
    + `?dataType=${encodeURIComponent('Upcoming Hours')}`
    + `&where=${encodeURIComponent(JSON.stringify(where))}`
    + `&limit=${limit}&sort=-updatedAt&ts=${Date.now()}`;
  const res = await fetch(url, { credentials: 'include', cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// CREATE one row
async function createUpcomingHours(values) {
  const typeId = await getTypeIdByName('Upcoming Hours');
  if (!typeId) throw new Error("Missing DataType 'Upcoming Hours'.");
  const res = await fetch(`${API_ORIGIN}/api/records`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ dataTypeId: typeId, values }),
  });
  if (!res.ok) throw new Error(`Create failed: ${res.status} ${await res.text().catch(()=> '')}`);
  return res.json();
}

// UPDATE by record id
async function updateUpcomingHours(id, values) {
  const res = await fetch(`${API_ORIGIN}/api/records/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ values }),
  });
  if (!res.ok) throw new Error(`Update failed: ${res.status}`);
  return res.json();
}


/* ---------- hook up the NEW calendar ----------

Expecting each day cell to look like:
  <button class="cal-day" data-date="2025-09-10">10</button>
(You can use <div> as well; the data-date attribute is what matters.)
*/

/* ---------- popup open for the new calendar ---------- */
async function openAvailabilityPopup(dateOrYear, month, day) {
  const popup     = document.getElementById("availability-popup");
  const dateLabel = document.getElementById("popup-date-label");

  // Accept Date | ISO string | (y,m,d)
  let jsDate;
  if (dateOrYear instanceof Date) {
    jsDate = new Date(dateOrYear.getFullYear(), dateOrYear.getMonth(), dateOrYear.getDate());
  } else if (typeof dateOrYear === "string") {
    const d = new Date(dateOrYear + "T00:00:00");
    jsDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  } else {
    jsDate = new Date(dateOrYear, month, day);
    jsDate = new Date(jsDate.getFullYear(), jsDate.getMonth(), jsDate.getDate());
  }

  const ymd = toYMD(jsDate);
  window.upcomingSelectedDate = jsDate;

  popup.setAttribute("data-date", ymd);
  dateLabel.textContent = jsDate.toLocaleDateString(undefined, {
    weekday: "long", month: "long", day: "numeric", year: "numeric"
  });

  const businessId = document.getElementById("dropdown-category-business")?.value || "";
  const calendarId = document.getElementById("dropdown-availability-calendar")?.value || "";
  if (!businessId || !calendarId) {
    alert("Please select a business and calendar first.");
    return;
  }

  // 1) Build the selects first
  populateTimeSelect24('current-day-start');
  populateTimeSelect24('current-day-end');
  setTimeSelect('current-day-start', '');
  setTimeSelect('current-day-end', '');

  // 2) Fetch existing values and preselect
  try {
const where = encodeURIComponent(JSON.stringify({ "Calendar": calendarId, "Date": ymd }));

const url =
  `${API_ORIGIN}/public/records` +
  `?dataType=${encodeURIComponent('Upcoming Hours')}` +
  `&where=${where}` +
  `&limit=1&ts=${Date.now()}`;

const res = await fetch(url, {
  credentials: 'include',
  cache: 'no-store'
});

  
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const items = await res.json();
    const row = Array.isArray(items) ? items[0] : null;

    if (row?.values) {
      const v = row.values;
      // These can be "HH:MM" or "h:mm AM/PM" – setTimeSelect normalizes for you
  setTimeSelect('current-day-start', v.Start || v['Start Time'] || '');
setTimeSelect('current-day-end',   v.End   || v['End Time']   || '');

    }
  } catch (err) {
    console.error("Error loading availability:", err);
  }

  popup.style.display = "block";
}


// Save Upcoming Hours
/* ---------- time helpers ---------- */
function to24h(t) {
  if (!t) return '';
  // Already HH:MM?
  if (/^\d{2}:\d{2}$/.test(t)) return t;

  // Convert "h:mm AM/PM" -> "HH:MM"
  const m = String(t).trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!m) return t; // unknown format, return as-is
  let h = parseInt(m[1], 10);
  const mm = m[2];
  const ap = m[3].toUpperCase();
  if (h === 12) h = 0;
  if (ap === 'PM') h += 12;
  return `${String(h).padStart(2,'0')}:${mm}`;
}

function setTimeSelect(selectId, valueFromDb) {
  const sel = document.getElementById(selectId);
  if (!sel) return;
  sel.value = to24h(valueFromDb || '');
}

/* Fill a <select> so that:
   - option.value is "HH:MM"
   - option.text  is "h:mm AM/PM"
*/
function populateTimeSelect24(selectId) {
  const sel = document.getElementById(selectId);
  if (!sel) return;

  sel.innerHTML = '';
  const def = document.createElement('option');
  def.value = '';
  def.textContent = '--:--';
  sel.appendChild(def);

  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 15) {
      const value = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      const h12 = (h % 12) === 0 ? 12 : (h % 12);
      const ap  = h < 12 ? 'AM' : 'PM';
      const label = `${h12}:${String(m).padStart(2,'0')} ${ap}`;
      const opt = document.createElement('option');
      opt.value = value;     // 24h for databases
      opt.textContent = label;  // user-friendly
      sel.appendChild(opt);
    }
  }
}

/* ---------- bind Save button ---------- */
(function bindUpcomingSaveOnce() {
  const btn = document.getElementById('save-upcoming-day-availability');
  if (!btn || btn.dataset.bound) return;

  btn.addEventListener('click', async () => {
    const businessId = document.getElementById('dropdown-category-business')?.value || '';
    const calendarId = document.getElementById('dropdown-availability-calendar')?.value || '';

    const start = to24h(document.getElementById('current-day-start')?.value || '');
    const end   = to24h(document.getElementById('current-day-end')?.value || '');

    let jsDate = window.upcomingSelectedDate;
    if (!jsDate) {
      const attr = document.getElementById('availability-popup')?.getAttribute('data-date');
      if (attr) jsDate = new Date(attr + 'T00:00:00');
    }

    if (!businessId)   return alert('Choose a business first.');
    if (!calendarId)   return alert('Choose a calendar first.');
    if (!jsDate)       return alert('Pick a date on the calendar.');
    if (!start && !end) {
  // allow clearing a day by leaving both blank
} else if (!start || !end) {
  return alert('Choose both start and end time, or leave both blank to clear.');
} else {
  // validate start < end
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  const startMin = sh * 60 + sm;
  const endMin   = eh * 60 + em;
  if (endMin <= startMin) return alert('End time must be after start time.');
}

    const ymd = toYMD(jsDate);

    const prev = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Saving…';

    try {
      const whereObj = { "Calendar": calendarId, "Date": ymd };
      const where = encodeURIComponent(JSON.stringify(whereObj));

      // look up existing
      const check = await fetch(`${API(TYPE_UPCOMING)}?where=${where}&ts=${Date.now()}`, {
        credentials: 'include',
        cache: 'no-store'
      });
      if (!check.ok) throw new Error(`HTTP ${check.status}`);
      const existing = await check.json();
const clearing = !start && !end;

const values = clearing
  ? {
      "Business":     businessId,
      "Calendar":     calendarId,
      "Date":         ymd,
      "Start":        "",
      "End":          "",
      "Start Time":   "",   // keep legacy fields in sync
      "End Time":     "",
      "is Available": false
    }
  : {
      "Business":     businessId,
      "Calendar":     calendarId,
      "Date":         ymd,
      "Start":        start,
      "End":          end,
      "Start Time":   start, // keep legacy fields in sync
      "End Time":     end,
      "is Available": true
    };


      if (Array.isArray(existing) && existing.length) {
        const id = existing[0]._id;
        const up = await fetch(`${API(TYPE_UPCOMING)}/${id}`, {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ values })
        });
        if (!up.ok) throw new Error(`HTTP ${up.status}`);
        await up.json();
      } else {
        const create = await fetch(API(TYPE_UPCOMING), {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ values })
        });
        if (!create.ok) throw new Error(`HTTP ${create.status}`);
        await create.json();
      }

   // update local cache so the cell shows new hours immediately
window.upcomingHoursMap = window.upcomingHoursMap || {};
if (clearing) {
  delete window.upcomingHoursMap[ymd];
} else {
  window.upcomingHoursMap[ymd] = { start, end };
}


document.getElementById('availability-popup').style.display = 'none';
// optional: comment this out if the alert is annoying
alert('Saved!');
if (typeof window.loadAndGenerateCalendar === 'function') {
  await window.loadAndGenerateCalendar();
}

    } catch (e) {
      console.error(e);
      alert('Error saving: ' + e.message);
    } finally {
      btn.disabled = false;
      btn.textContent = prev;
    }
  });

  btn.dataset.bound = '1';
})();

