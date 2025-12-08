
 //* store-settings.js  

/* ===================== API HELPERS (MUST BE FIRST) ===================== */
// use API server in dev, same-origin in prod
const API_ORIGIN = location.hostname === 'localhost' ? 'http://localhost:8400' : '';


const apiUrl = (path) =>
  `${API_ORIGIN}${path.startsWith('/api') ? path : `/api${path.startsWith('/') ? path : `/${path}`}`}`;

async function apiFetch(path, opts = {}) {
  return fetch(apiUrl(path), {
    credentials: 'include', // send connect.sid
    headers: { Accept: 'application/json', ...(opts.headers || {}) },
    ...opts,
  });
}

window.fetchJSON = async function fetchJSON(path, opts = {}) {
  const res = await apiFetch(path, {
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
    ...opts,
  });
  const text = await res.text();
  let data; try { data = JSON.parse(text); } catch { data = { error: text }; }
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
};

/* ===================== GLOBAL STATE + HELPERS ===================== */
window.STATE = window.STATE || { user: { loggedIn: false, userId: null, email: '' } };

// Cache DataType ids by name (global so all modules use the same one)
window.__DTYPE_CACHE = window.__DTYPE_CACHE || {};
window.getTypeId = window.getTypeId || async function getTypeId(name) {
  const cache = window.__DTYPE_CACHE;
  if (cache[name]) return cache[name];
  const list = await window.fetchJSON('/api/datatypes');
  const canon = (s) => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
  const hit = (list || []).find(
    (dt) => canon(dt.name) === canon(name) || canon(dt.nameCanonical) === canon(name)
  );
  if (!hit) throw new Error(`DataType not found: ${name}`);
  cache[name] = hit._id;
  return hit._id;
};

/* ===================== AUTH MODULE ===================== */
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
      statusEl && (statusEl.textContent = u.firstName ? `Hi, ${u.firstName}` : (u.email || 'Signed in'));
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
      const res = await apiFetch('/api/me', { headers: { 'Accept': 'application/json' } });
      const text = await res.text();
      let data; try { data = JSON.parse(text); } catch { data = {}; }

      // { ok:true, user:{...} } OR { user:{...} } OR { ok, session:{ user } }
      const user = data?.user || data?.data?.user || (data?.ok && data?.session?.user) || null;
      console.log('[auth] /api/me payload:', data);

      if (user && (user._id || user.id)) {
        window.STATE.user = {
          loggedIn: true,
          userId: user._id || user.id,
          email: user.email || '',
          firstName: user.firstName || user.name || ''
        };
      } else {
        window.STATE.user = { loggedIn: false, userId: null, email: '' };
      }
    } catch (e) {
      console.warn('[auth] hydrateUser failed:', e);
      window.STATE.user = { loggedIn: false, userId: null, email: '' };
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
  modal    && modal.addEventListener('click', (e) => { if (e.target === modal) closeAuth(); });

  logoutBtn && logoutBtn.addEventListener('click', async () => {
    try { await window.fetchJSON('/api/logout', { method: 'POST' }); } catch {}
    window.STATE.user = { loggedIn: false, userId: null, email: '' };
    setAuthUI();
  });

  form && form.addEventListener('submit', async (e) => {
    e.preventDefault();
    console.log('[auth] submit clicked');
    errEl && (errEl.textContent = '');
    setBusy(true);
    try {
      const r = await apiFetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ email: emailEl.value.trim(), password: passEl.value })
      });
      const t = await r.text();
      let d; try { d = JSON.parse(t); } catch { d = { error: t }; }
      if (!r.ok || d.error) throw new Error(d.error || `HTTP ${r.status}`);

      await hydrateUser();
      closeAuth();
    } catch (err) {
      errEl && (errEl.textContent = err.message || 'Login failed');
    } finally {
      setBusy(false);
    }
  });

  // Initial session check → announce ready
  hydrateUser()
    .catch(() => {})
    .finally(() => { document.dispatchEvent(new Event('auth:ready')); });
})();





/* ===================== //////////////////////////////// ===================== */
                       //BASIC SIDEBAR / NAV (unchanged)
//////////////////////////////////////////////////////////////////////////////////

(() => {
  const app = document.getElementById('app');
  const nav = document.getElementById('nav');
  const sections = Array.from(document.querySelectorAll('.section'));

  document.getElementById('collapseBtn')?.addEventListener('click', () => {
    app?.classList.toggle('collapsed');
  });

  nav?.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-target]');
    if (!btn) return;
    const targetId = btn.dataset.target;

    nav.querySelectorAll('button').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');

    sections.forEach((sec) => { sec.classList.toggle('active', sec.id === targetId); });
  });

  nav?.addEventListener('keydown', (e) => {
    const buttons = Array.from(nav.querySelectorAll('button'));
    const i = buttons.findIndex((b) => b.classList.contains('active'));
    if (e.key === 'ArrowDown') {
      const next = buttons[(i + 1) % buttons.length];
      next.focus(); next.click(); e.preventDefault();
    } else if (e.key === 'ArrowUp') {
      const prev = buttons[(i - 1 + buttons.length) % buttons.length];
      prev.focus(); prev.click(); e.preventDefault();
    }
  });
})();


////////////////////////////////////////////////////////////////////////
                                    //Orders Section
////////////////////////////////////////////////////////////////////////


/* ===================== ORDERS MODULE: STORE DROPDOWN ===================== */
/* ===================== ORDERS MODULE ===================== */
(function ordersModule () {
  const root = document.getElementById('orders');
  if (!root) return; // section not present

  const storeSelect   = document.getElementById('orders-store-select');
  const statusButtons = root.querySelectorAll('.orders-status-toggle [data-status]');
  const emptyCard     = document.getElementById('orders-empty');
  const listCard      = document.getElementById('orders-list');
  const tableEl       = document.getElementById('orders-table');
  const countEl       = document.getElementById('orders-count');
  const testBtn       = document.getElementById('orders-create-test');

  let allOrders      = [];
  let currentStatus  = '';
  let currentStoreId = '';

  // ---------- helpers ----------

  const escapeHtml = (s) =>
    (s || '').replace(/[&<>"']/g, (m) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }[m]));

function setView() {
  // always show the table card; we’ll show “no orders” inside it
  emptyCard.hidden = true;
  listCard.hidden  = false;
}


  function inferFulfilled(v) {
    const raw =
      (v.Status ||
        v['Fulfillment Status'] ||
        v['Payment Status'] ||
        '')
        .toString()
        .toLowerCase();

    // tweak these rules later to match your exact field values
    if (!raw) return false;
    if (raw.includes('fulfill') || raw.includes('paid') || raw.includes('complete')) {
      return true;
    }
    return false;
  }

function renderOrders() {
  let items = allOrders.slice();

  // filter by status
  if (currentStatus === 'fulfilled') {
    items = items.filter((o) => inferFulfilled(o.values || {}));
  } else if (currentStatus === 'unfulfilled') {
    items = items.filter((o) => !inferFulfilled(o.values || {}));
  }

  countEl.textContent = String(items.length);

  // 🔹 header row like your mock
  const headerHtml = `
    <div class="row row-head">
      <div class="col-order">Order</div>
      <div class="col-date">Date</div>
      <div class="col-customer">Customer</div>
      <div class="col-total">Total</div>
      <div class="col-pay-status">Payment Status</div>
      <div class="col-fulfill-status">Fulfilment Status</div>
      <div class="col-items"># items</div>
    </div>
  `;

  let bodyHtml = '';

  if (!items.length) {
    // 🔹 no orders yet → show message in a full-width row
    bodyHtml = `
      <div class="row">
        <div class="muted" style="grid-column: 1 / -1;">
          No orders yet.
        </div>
      </div>
    `;
  } else {
    bodyHtml = items
      .map((o) => {
        const v = o.values || {};

        const orderId = (o._id || o.id || '').toString();
        const shortId = orderId ? `#${orderId.slice(-6)}` : '—';

        const created =
          v['Created At'] || o.createdAt || o.updatedAt || '';
        const dateStr = created ? new Date(created).toLocaleDateString() : '—';

        const customerName =
          v['Customer Name'] ||
          v.Customer ||
          v['Buyer Name'] ||
          'Guest';

        const email =
          v['Customer Email'] ||
          v.Email ||
          v['Buyer Email'] ||
          '';

        const total = Number(
          v.Total ||
          v['Total Amount'] ||
          v['Grand Total'] ||
          0
        ).toFixed(2);

        const paymentStatus =
          v['Payment Status'] ||
          v['Payment state'] ||
          '';

        const fulfilled = inferFulfilled(v);
        const statusLabel = fulfilled ? 'Fulfilled' : 'Unfulfilled';

        const itemsCount = Array.isArray(v['Items'])
          ? v['Items'].length
          : Array.isArray(v['Line Items'])
          ? v['Line Items'].length
          : Number(v['Item Count'] || v.Quantity || 0) || 0;

        return `
          <div class="row">
            <div class="col-order"><strong>${shortId}</strong></div>
            <div class="col-date">${dateStr}</div>
            <div class="col-customer">
              <strong>${escapeHtml(customerName)}</strong>
              <div class="muted small">${escapeHtml(email || '')}</div>
            </div>
            <div class="col-total">$${total}</div>
            <div class="col-pay-status">${escapeHtml(paymentStatus || '')}</div>
            <div class="col-fulfill-status">
              <span class="badge ${fulfilled ? 'badge-success' : 'badge-warning'}">
                ${statusLabel}
              </span>
            </div>
            <div class="col-items">${itemsCount}</div>
          </div>
        `;
      })
      .join('');
  }

  tableEl.innerHTML = headerHtml + bodyHtml;

  // always show table card
  setView();
}

  // ---------- data fetchers ----------

  async function listStoresForOrders() {
    const uid = window.STATE?.user?.userId;

    const res = await fetch(
      `${API_ORIGIN}/public/records?dataType=Store&limit=200`,
      {
        credentials: 'include',
        headers: { Accept: 'application/json' },
      }
    );

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();
    const rows = Array.isArray(data)
      ? data
      : (data.records || data.items || []);

    console.log('[orders] raw store rows =', rows);

    const mine = rows.filter((r) => {
      const rootCreated =
        r?.createdBy && String(r.createdBy) === String(uid);
      const valCreated =
        r?.values?.['Created By']?._id &&
        String(r.values['Created By']._id) === String(uid);
      return rootCreated || valCreated;
    });

    return mine.length ? mine : rows;
  }

  async function hydrateOrderStores() {
    try {
      await window.requireUser();
      const stores = await listStoresForOrders();
      console.log(
        '[orders] showing',
        stores.length,
        'stores in Orders dropdown'
      );

      storeSelect.innerHTML =
        `<option value="">All stores</option>` +
        stores
          .map(
            (s) =>
              `<option value="${s._id}">${
                s.values?.Name ||
                s.values?.slug ||
                '(untitled store)'
              }</option>`
          )
          .join('');

      // keep currentStoreId if still valid
      if (currentStoreId && stores.some((s) => s._id === currentStoreId)) {
        storeSelect.value = currentStoreId;
      }
    } catch (err) {
      console.error('[orders] hydrateOrderStores failed:', err);
    }
  }

  async function loadOrders() {
    try {
      await window.requireUser();

      const params = new URLSearchParams();
      params.set('dataType', 'Order');
      params.set('limit', '200');
      if (currentStoreId) {
        params.set('Store', currentStoreId);
      }

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
        : (data.records || data.items || []);

      console.log('[orders] loaded', rows.length, 'orders');
      allOrders = rows;
      renderOrders();
    } catch (err) {
      console.error('[orders] loadOrders failed:', err);
      allOrders = [];
      renderOrders();
    }
  }

  // ---------- wiring ----------

  // store dropdown changes → reload orders
  storeSelect?.addEventListener('change', () => {
    currentStoreId = storeSelect.value || '';
    console.log(
      '[orders] store filter changed:',
      currentStoreId || 'All stores'
    );
    loadOrders().catch(() => {});
  });

  // status filter buttons
  statusButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      statusButtons.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      currentStatus = btn.dataset.status || '';
      console.log('[orders] status filter:', currentStatus || 'all');
      renderOrders();
    });
  });

  // test order button (we'll wire real creation once the Order DataType is set up)
  testBtn?.addEventListener('click', () => {
    alert(
      'Test order creation is not wired yet. Once your Order data type is ready, we will hook this button to create a sample order in the database.'
    );
  });

  // hydrate when auth ready
  document.addEventListener('auth:ready', () => {
    hydrateOrderStores().catch(() => {});
    loadOrders().catch(() => {});
  });

  // if already logged in (hot reload, etc.)
  if (window.STATE?.user?.loggedIn) {
    hydrateOrderStores().catch(() => {});
    loadOrders().catch(() => {});
  }
})();











////////////////////////////////////////////////////////////////////////
// PRODUCTS MODULE
////////////////////////////////////////////////////////////////////////
(() => {
  const root = document.getElementById('products');
  if (!root) return;

  // ---- CONFIG ----
  const PRODUCT_TYPE_NAME = 'Product'; // (not used yet, but fine to keep)
  const UPLOAD_URL        = '/api/upload';

  const $  = (s, el = root) => el.querySelector(s);
  const $$ = (s, el = root) => Array.from(el.querySelectorAll(s));

  // elements...
  const elEmpty  = $('#prod-empty');
  const elList   = $('#prod-list');
  const elForm   = $('#prod-form');
  const elTable  = $('#prod-table');
  const elCount  = $('#prod-count');

  const btnOpen1 = $('#prod-open-form');
  const btnOpen2 = $('#prod-open-form-2');
  const btnCancel= $('#prod-cancel');
  const btnSave  = $('#prod-save');

  const fTitle = $('#p-title');
  const fDesc  = $('#p-desc');
  const fImg   = $('#p-image');
  const prev   = $('#p-imagePreview');
  const galWrap= $('#p-gallery');
  const btnAdd = $('#p-add-thumb');
  const fPrice = $('#p-price');
  const fSale  = $('#p-sale');
  const fQty   = $('#p-qty');
  const fFiles = $('#p-files');

  // ---------- helpers ----------
  const escapeHtml = (s) =>
    (s || '').replace(/[&<>"']/g, (m) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }[m]));

  const slugify = (s) =>
    String(s || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

  async function uploadOne(file) {
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch(apiUrl(UPLOAD_URL), {
      method: 'POST',
      body: fd,
      credentials: 'include',
    });
    const out = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(out.error || 'Upload failed');
    return { url: out.url || out.path || out.location, name: file.name };
  }

  async function uploadMany(files) {
    const r = [];
    for (const f of files) r.push(await uploadOne(f));
    return r;
  }

  function fileToUrl(file) {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result);
      r.onerror = rej;
      r.readAsDataURL(file);
    });
  }

  // ---------- data ----------

  async function createProduct(payloadValues) {
    await window.requireUser(); // still enforce login

    // 🔑 Use /api/records/Product (DataType name)
    return await window.fetchJSON('/api/records/Product', {
      method: 'POST',
      body: JSON.stringify({ values: payloadValues }),
    });
  }

  async function listProducts() {
    const sid = getStoreId();

    const res = await fetch(
      `${API_ORIGIN}/public/records?dataType=Product&limit=300`,
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
      : (data.records || data.items || []);

    if (!sid) return rows;

    // only products for the current store
    return rows.filter((r) => r?.values?.Store?._id === sid);
  }

  // ---------- views ----------
  const showEmpty = () => {
    elEmpty.hidden = false;
    elList.hidden  = true;
    elForm.hidden  = true;
  };
  const showList  = () => {
    elEmpty.hidden = true;
    elList.hidden  = false;
    elForm.hidden  = true;
  };
  const showForm  = () => {
    elEmpty.hidden = true;
    elList.hidden  = true;
    elForm.hidden  = false;
  };

  async function renderList() {
    try {
      const items = await listProducts();
      elCount.textContent = String(items.length);
      if (!items.length) {
        showEmpty();
        return;
      }

      elTable.innerHTML = items
        .map((r) => {
          const v = r.values || {};
          const price = Number(
            (v['Sale Price'] ?? v.Price) || 0
          ).toFixed(2);

          const img =
            (v['Default Image'] &&
              (v['Default Image'].url || v['Default Image'])) ||
            (Array.isArray(v.Gallery) &&
              v.Gallery[0] &&
              (v.Gallery[0].url || v.Gallery[0])) ||
            '';

          return `
          <div class="row">
            <div class="thumb">${img ? `<img src="${img}">` : ''}</div>
            <div>
              <strong>${escapeHtml(v.Title || '(untitled)')}</strong>
              <div class="muted">${escapeHtml(v.Description || '')}</div>
            </div>
            <div>$${price}</div>
            <div class="muted">${Number(v.Quantity || 0)}</div>
          </div>`;
        })
        .join('');

      showList();
    } catch (e) {
      console.error('renderList failed:', e);
      elTable.innerHTML = `
        <div class="row">
          <div class="muted">
            Failed to load products: ${escapeHtml(e.message)}
          </div>
        </div>`;
      showList();
    }
  }

  // ---------- UI wiring ----------
  fImg?.addEventListener('change', async () => {
    const file = fImg.files?.[0];
    if (!file) {
      prev.innerHTML = '';
      return;
    }
    const url = await fileToUrl(file);
    prev.innerHTML = `<img src="${url}">`;
  });

  btnAdd?.addEventListener('click', async () => {
    const input = Object.assign(document.createElement('input'), {
      type: 'file',
      accept: 'image/*',
      hidden: true,
    });
    document.body.appendChild(input);
    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      if (!file) return;
      const url = await fileToUrl(file);
      const item = document.createElement('div');
      item.className = 'thumb';
      item.innerHTML =
        `<img src="${url}"><button class="x" title="Remove">×</button>`;
      item.querySelector('.x').addEventListener('click', () => item.remove());
      galWrap.insertBefore(item, btnAdd);
      input.remove();
    });
    input.click();
  });

  // ---------- actions ----------
  const STORE_LS_KEY = 'ss_current_store_id';
  const getStoreId = () =>
    window.STATE?.storeId || localStorage.getItem(STORE_LS_KEY) || null;

  btnOpen1?.addEventListener('click', async () => {
    try {
      await window.requireUser();
      showForm();
    } catch (_) {}
  });

  btnOpen2?.addEventListener('click', async () => {
    try {
      await window.requireUser();
      showForm();
    } catch (_) {}
  });

  btnCancel?.addEventListener('click', renderList);

  btnSave?.addEventListener('click', async () => {
    try {
      const uid     = await window.requireUser();
      const storeId = getStoreId();
      if (!storeId) {
        alert('Choose a Store first.');
        return;
      }
      if (!fTitle.value.trim()) {
        alert('Title is required.');
        fTitle.focus();
        return;
      }

      // uploads
      let defaultImage = null;
      if (fImg.files && fImg.files[0]) {
        defaultImage = await uploadOne(fImg.files[0]);
      }
      const downloadFiles = Array.from(fFiles.files || []).slice(0, 5);
      const downloads     = downloadFiles.length
        ? await uploadMany(downloadFiles)
        : [];

      const values = {
        Title:         fTitle.value.trim(),
        Description:   fDesc.value.trim(),
        Price:         Number(fPrice.value || 0),
        'Sale Price':  Number(fSale.value || 0) || null,
        Quantity:      Number(fQty.value || 0),
        Slug:          slugify(fTitle.value),
        Store:         { _id: storeId },
        'Default Image': defaultImage || null,
        Downloads:       downloads,
        'Created By':  { _id: uid },
        'Created At':  new Date().toISOString(),
      };

      await createProduct(values);

      // reset & refresh
      root.querySelector('#prod-create-form')?.reset();
      prev.innerHTML = '';
      $$('.thumb', galWrap).forEach((el) => {
        if (!el.classList.contains('add')) el.remove();
      });
      await renderList();
    } catch (e) {
      console.error('Save product failed:', e);
      alert('Save failed: ' + e.message);
    }
  });

  // ---------- init ----------
  renderList();
})();
















////////////////////////////////////////////////////////////////////////////////////
                                // STORE PICKER
////////////////////////////////////////////////////////////////////////////////////
(function storePicker () {
  const dd       = document.getElementById('store-select');
  const btnNew   = document.getElementById('store-new-btn');
  const modal    = document.getElementById('store-modal');
  const closeX   = document.getElementById('store-x');
  const saveBtn  = document.getElementById('store-save');
  const nameEl   = document.getElementById('store-name');
  const errEl    = document.getElementById('store-err');

  if (!dd) return;

  const STORE_LS_KEY = 'ss_current_store_id';
  const setBusy = (on) => {
    const idle = saveBtn?.querySelector('.when-idle');
    const busy = saveBtn?.querySelector('.when-busy');
    if (saveBtn) saveBtn.disabled = !!on;
    if (idle) idle.hidden = !!on;
    if (busy) busy.hidden = !on;
  };
  const slugify = (s) =>
    String(s || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

  async function getStoreTypeId () { return await window.getTypeId('Store'); }

async function listStores () {
  const uid = window.STATE?.user?.userId;

  const res = await fetch(
    `${API_ORIGIN}/public/records?dataType=Store&limit=200`,
    {
      credentials: "include",
      headers: { Accept: "application/json" },
    }
  );

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }

  const data = await res.json();
  const rows = Array.isArray(data) ? data : (data.records || data.items || []);
  console.log("[stores] raw rows=", rows);

  const mine = rows.filter((r) => {
    const rootCreated =
      r?.createdBy && String(r.createdBy) === String(uid);
    const valCreated =
      r?.values?.["Created By"]?._id &&
      String(r.values["Created By"]._id) === String(uid);
    return rootCreated || valCreated;
  });

  // Fallback: if nothing matches user, show all stores
  return mine.length ? mine : rows;
}


async function createStore (name) {
  const uid = await window.requireUser();

  const values = {
    Name:        name,
    slug:        slugify(name),
    'Created By': { _id: uid },
    'Created At': new Date().toISOString()
  };

  // 🔑 Use /api/records/Store instead of /api/records
  return await window.fetchJSON('/api/records/Store', {
    method: 'POST',
    body: JSON.stringify({ values })
  });
}


  function setCurrentStore (id) {
    window.STATE = window.STATE || {};
    window.STATE.storeId = id || null;
    if (id) localStorage.setItem(STORE_LS_KEY, id);
    else localStorage.removeItem(STORE_LS_KEY);
    document.dispatchEvent(new CustomEvent('store:change', { detail: { id } }));
  }

  document.addEventListener('store:change', () => {
    // if products section loaded, attempt refresh
    try { /* renderList is inside products IIFE; this is best-effort */ renderList(); } catch {}
  });

  async function hydrateStores () {
    try {
      await window.requireUser();
      const stores  = await listStores();
      console.log('[stores] showing', stores.length, 'stores for user', window.STATE?.user?.userId);
      const current = window.STATE?.storeId || localStorage.getItem(STORE_LS_KEY) || '';

      dd.innerHTML = `<option value="">Select a Store…</option>` +
        stores.map((s) => `<option value="${s._id}">${s.values?.Name || s.values?.slug || '(untitled store)'}</option>`).join('');

      if (current && stores.some((s) => s._id === current)) {
        dd.value = current;
        setCurrentStore(current);
      } else {
        dd.value = '';
        setCurrentStore('');
      }
    } catch (err) {
      console.error('[stores] load failed', err);
    }
  }

  dd.addEventListener('change', () => {
    const id = dd.value || '';
    setCurrentStore(id);
  });

  btnNew?.addEventListener('click', async () => {
    try { await window.requireUser(); } catch { return; }
    errEl.textContent = '';
    nameEl.value = '';
    modal.hidden = false;
    nameEl.focus();
  });

  closeX?.addEventListener('click', () => (modal.hidden = true));
  modal?.addEventListener('click', (e) => { if (e.target === modal) modal.hidden = true; });

  saveBtn?.addEventListener('click', async () => {
    errEl.textContent = '';
    const name = nameEl.value.trim();
    if (!name) { errEl.textContent = 'Enter a store name.'; nameEl.focus(); return; }
    setBusy(true);
    try {
      const rec = await createStore(name);
      modal.hidden = true;
      await hydrateStores();
      dd.value = rec._id;
      setCurrentStore(rec._id);
    } catch (e) {
      console.error('createStore failed', e);
      errEl.textContent = e.message || 'Save failed';
    } finally {
      setBusy(false);
    }
  });

  // hydrate when auth ready
  document.addEventListener('auth:ready', () => {
    console.log('[storePicker] auth:ready -> hydrateStores');
    hydrateStores().catch(() => {});
  });

  // if already logged in (hot reload, etc.)
  if (window.STATE?.user?.loggedIn) {
    console.log('[storePicker] already logged in -> hydrateStores');
    hydrateStores().catch(() => {});
  }
})();
