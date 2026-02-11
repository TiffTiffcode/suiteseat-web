const osList = document.getElementById('optionset-list');
const osDetail = document.getElementById('optionset-detail');
const osForm = document.getElementById('optionset-form');
const osInput = document.getElementById('new-optionset');
const osKindCreateSelect = document.getElementById('optionset-kind-create');
const osSelectedId = document.getElementById('selected-optionset-id');
const osNameInput = document.getElementById('optionset-name-input');
const osRenameBtn = document.getElementById('optionset-rename-btn');
const osDeleteBtn = document.getElementById('optionset-delete-btn');
const osKindSelect = document.getElementById('optionset-kind');
const osKindSaveBtn = document.getElementById('optionset-kind-save');

const ovTbody = document.getElementById('optionvalues-tbody');
const ovForm = document.getElementById('optionvalue-form');
const ovLabelInput = document.getElementById('ov-label');
const ovImageUrl = document.getElementById('ov-imageUrl');
const ovNumberValue = document.getElementById('ov-numberValue');
const ovBoolValue = document.getElementById('ov-boolValue');
const ovColorHex = document.getElementById('ov-colorHex');
const ovOrderInput = document.getElementById('ov-order');

const ovMetaImage = document.getElementById('ov-meta-image');
const ovMetaNumber = document.getElementById('ov-meta-number');
const ovMetaBoolean = document.getElementById('ov-meta-boolean');
const ovMetaColor = document.getElementById('ov-meta-color');

// public/js/admin.js
document.addEventListener('DOMContentLoaded', () => {
  console.log('admin.js loaded');

  // ----------------------------
  // Tab switching
  // ----------------------------
  const tabs  = Array.from(document.querySelectorAll('.tab[data-tab]'));
  const panes = Array.from(document.querySelectorAll('.content[data-content]'));

  function switchToTab(n) {
    const target = String(n);
    tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === target));
    panes.forEach(p => p.classList.toggle('active', p.dataset.content === target));
  }

  tabs.forEach(t => t.addEventListener('click', () => switchToTab(t.dataset.tab)));
  window.switchToTab = switchToTab; // so we can jump to Fields in code


  // ----------------------------
  // Elements: Businesses tab
  // ----------------------------
  const businessTableBody = document.querySelector('#business-records-table tbody');
  const businessFilterInput = document.getElementById('business-filter-input');

  // will hold loaded business records so we can filter on the client
  let allBusinessRecords = [];
















  // ----------------------------
  // Elements: Data Types
  // ----------------------------
  const form = document.getElementById('new-data-type-form');
  const input = document.getElementById('new-data-type');
  const list  = document.getElementById('datatype-list');
  const selectedIdInput = document.getElementById('selected-datatype-id');

  // ----------------------------
  // Elements: Fields
  // ----------------------------
  const fieldForm        = document.getElementById('field-form');
  const fieldNameInput   = document.getElementById('new-field');
  const fieldTypeSelect  = document.getElementById('field-type');
  const allowMultipleBox = document.getElementById('allow-multiple');
  const fieldList        = document.querySelector('#content2 #field-list');
  const btnShowFieldForm = document.getElementById('btn-show-field-form');
  const btnCancelField   = document.getElementById('btn-cancel-field');
  const fieldCtx         = document.getElementById('field-context');
  const fieldCtxName     = document.getElementById('field-context-name');
  const fieldsTbody = document.getElementById('fields-tbody');

  
  // ----------------------------
  // Elements: Option Sets
  // ----------------------------
const osForm          = document.getElementById('optionset-form');
const osInput         = document.getElementById('new-optionset');
const osList          = document.getElementById('optionset-list');
const osDetail        = document.getElementById('optionset-detail');
const osNameInput     = document.getElementById('optionset-name-input');
const osRenameBtn     = document.getElementById('optionset-rename-btn');
const osDeleteBtn     = document.getElementById('optionset-delete-btn');
const osSelectedId    = document.getElementById('selected-optionset-id');


const ovForm          = document.getElementById('optionvalue-form');
const ovLabelInput    = document.getElementById('ov-label');
const ovValueInput    = document.getElementById('ov-value');
const ovOrderInput    = document.getElementById('ov-order');
const ovTbody         = document.getElementById('optionvalues-tbody');

const optionSetPicker = document.getElementById('option-set-picker');
const optionSetSelect = document.getElementById('option-set-select');

const osKindSelect     = document.getElementById('optionset-kind');
const osKindSaveBtn    = document.getElementById('optionset-kind-save');

const ovMetaImage   = document.getElementById('ov-meta-image');
const ovMetaNumber  = document.getElementById('ov-meta-number');
const ovMetaBoolean = document.getElementById('ov-meta-boolean');
const ovMetaColor   = document.getElementById('ov-meta-color');

const ovImageUrl    = document.getElementById('ov-imageUrl');
const ovNumberValue = document.getElementById('ov-numberValue');
const ovBoolValue   = document.getElementById('ov-boolValue');
const ovColorHex    = document.getElementById('ov-colorHex');

const osKindCreateSelect = document.getElementById('optionset-kind-create'); // left form


  // Initial UI state
  if (fieldForm) fieldForm.style.display = 'none';
  if (btnShowFieldForm) btnShowFieldForm.disabled = true;

    // live filter as you type
  if (businessFilterInput) {
    businessFilterInput.addEventListener('input', () => {
      renderBusinessTable();
    });
  }

  // Boot on page load
  loadDataTypes();
  refreshReferenceOptions();
  loadOptionSets();
  loadOptionSets();
 populateOptionSetsInFieldType();
  // 🔹 load Business records on startup
  loadBusinessRecords();
  // ----------------------------
  // Create DataType
  // ----------------------------
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = input.value.trim();
    if (!name) return;

    const res = await fetch('/api/datatypes', {
      method: 'POST',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify({ name })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err.error || 'Failed to create data type');
      return;
    }

    input.value = '';
    await loadDataTypes();
  });

// ----------------------------
// Load DataTypes list
// ----------------------------
async function loadDataTypes() {
  list.innerHTML = '<li>Loading…</li>';
  try {
    const res = await fetch('/api/datatypes', { headers: { 'Accept': 'application/json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const items = await res.json();

    if (!Array.isArray(items) || items.length === 0) {
      list.innerHTML = '<li>No data types yet</li>';
      return;
    }

    list.innerHTML = '';
    items.forEach(dt => {
      const li = document.createElement('li');
      li.textContent = dt.name || '(unnamed)';
      li.style.cursor = 'pointer';
      li.tabIndex = 0;             // keyboard focus
      li.dataset.id = dt._id;      // for selected styling later

      const selectType = async () => {
        selectedIdInput.value = dt._id;

        const titleSpan = document.querySelector('#content2 #type-name');
        if (titleSpan) titleSpan.textContent = dt.name;

        if (fieldCtx && fieldCtxName) {
          fieldCtxName.textContent = dt.name;
          fieldCtx.style.display = 'block';
        }

        // highlight selected
        [...list.children].forEach(el => el.classList.toggle('active', el.dataset.id === dt._id));

        if (btnShowFieldForm) btnShowFieldForm.disabled = false;
        if (fieldForm) fieldForm.style.display = 'none';

        await loadFieldsForSelected();
        switchToTab(2);
      };

      li.addEventListener('click', selectType);
      li.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectType(); }
      });

      list.appendChild(li);
    });
  } catch (err) {
    console.error('loadDataTypes failed:', err);
    list.innerHTML = '<li>Failed to load</li>';
  }
}

  // ----------------------------
  // Load Business records (for debugging slugs)
  // ----------------------------
  async function loadBusinessRecords() {
    if (!businessTableBody) return;

    businessTableBody.innerHTML = '<tr><td colspan="4">Loading…</td></tr>';

    try {
      // 1) get all DataTypes to find Business
      const dtRes = await fetch('/api/datatypes', {
        headers: { 'Accept': 'application/json' }
      });
      if (!dtRes.ok) throw new Error(`DataTypes HTTP ${dtRes.status}`);
      const dts = await dtRes.json();
      const businessDT = (dts || []).find(dt =>
        dt.name === 'Business' ||
        dt.nameCanonical === 'business'
      );

      if (!businessDT) {
        businessTableBody.innerHTML = '<tr><td colspan="4">No Business DataType found</td></tr>';
        console.warn('[admin] Business DataType not found');
        return;
      }

      console.log('[admin] Business DataType id:', businessDT._id);

      // 2) load records for that DataType
      //    👉 if your endpoint name is slightly different, tweak this URL
      const recRes = await fetch(`/api/records?dataTypeId=${businessDT._id}&limit=500&sort=-createdAt`, {
        headers: { 'Accept': 'application/json' }
      });

      if (!recRes.ok) throw new Error(`Records HTTP ${recRes.status}`);

      const body = await recRes.json().catch(() => ({}));

      // support several possible shapes: [rows] or {records:[..]} etc.
      const rows = Array.isArray(body)
        ? body
        : Array.isArray(body.records)
        ? body.records
        : Array.isArray(body.items)
        ? body.items
        : [];

      allBusinessRecords = rows;
      console.log('[admin] loaded Business records:', rows.length);

      renderBusinessTable();
    } catch (err) {
      console.error('[admin] loadBusinessRecords failed:', err);
      businessTableBody.innerHTML =
        `<tr><td colspan="4">Failed to load: ${err.message}</td></tr>`;
    }
  }

    function renderBusinessTable() {
    if (!businessTableBody) return;

    const term = (businessFilterInput?.value || '').trim().toLowerCase();
    let rows = allBusinessRecords || [];

    if (term) {
      rows = rows.filter(rec => {
        const v = rec.values || {};
        const name = String(v.businessName || v['Business Name'] || '').toLowerCase();
        const slug = String(v.slug || v.businessSlug || v['Slug'] || '').toLowerCase();
        return name.includes(term) || slug.includes(term);
      });
    }

    if (!rows.length) {
      businessTableBody.innerHTML = '<tr><td colspan="4">No businesses found</td></tr>';
      return;
    }

    businessTableBody.innerHTML = '';

    rows.forEach(rec => {
      const v = rec.values || {};

      const name =
        v.businessName ||
        v['Business Name'] ||
        '(no name)';

      // 👇 adjust keys if your slug field is named differently
      const slug =
        v.slug ||
        v.businessSlug ||
        v['Booking Slug'] ||
        '';

      const createdRaw = rec.createdAt || rec.created_at;
      const createdAt = createdRaw
        ? new Date(createdRaw).toLocaleString()
        : '—';

      const tr = document.createElement('tr');

      const tdName = document.createElement('td');
      tdName.textContent = String(name);

      const tdSlug = document.createElement('td');
      tdSlug.textContent = String(slug);
      if (slug) {
        tdSlug.style.fontFamily = 'monospace';
      }

      const tdCreated = document.createElement('td');
      tdCreated.textContent = createdAt;

      const tdId = document.createElement('td');
      tdId.textContent = String(rec._id || '');
      tdId.style.fontFamily = 'monospace';
      tdId.style.fontSize = '11px';

      tr.appendChild(tdName);
      tr.appendChild(tdSlug);
      tr.appendChild(tdCreated);
      tr.appendChild(tdId);

      businessTableBody.appendChild(tr);
    });
  }

  // ----------------------------
  // Show/Hide Field form
  // ----------------------------
  btnShowFieldForm.addEventListener('click', () => {
    fieldForm.style.display = 'block';
    fieldForm.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });

  btnCancelField.addEventListener('click', () => {
    fieldForm.reset();
    allowMultipleBox.checked = false;
    fieldForm.style.display = 'none';
  });

  // ----------------------------
  // Create Field
  // ----------------------------
fieldForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const dataTypeId = selectedIdInput.value;
  const name = fieldNameInput.value.trim();
  const raw = fieldTypeSelect.value;
  const allowMultiple = !!allowMultipleBox.checked;

  if (!dataTypeId) return alert('Select a data type first');
  if (!name)       return alert('Field name is required');
  if (!raw)        return alert('Select a field type');

  let type = raw;
  let referenceTo = null;
  let optionSetId = null;

  if (raw.startsWith('ref:')) {
    type = 'Reference';
    referenceTo = raw.split(':')[1];
  } else if (raw.startsWith('os:')) {
    type = 'Dropdown';
    optionSetId = raw.split(':')[1];
  }

  const payload = { dataTypeId, name, type, allowMultiple };

  if (type === 'Reference') {
    if (!referenceTo) return alert('Missing reference target');
    payload.referenceTo = referenceTo;
  }
  if (type === 'Dropdown') {
    if (!optionSetId) return alert('Pick an Option Set (choose from the “Option Sets” section in the list)');
    payload.optionSetId = optionSetId;
  }

  const res = await fetch('/api/fields', {
    method: 'POST',
    headers: { 'Content-Type':'application/json' },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const err = await res.json().catch(()=>({}));
    alert(err.error || 'Failed to create field');
    return;
  }

  fieldForm.reset();
  await loadFieldsForSelected();
});

  // ----------------------------
  // Helpers
  // ----------------------------
// turn a human label into a safe key: "Sale Price" -> "sale_price"
function canon(s) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_") // non-alphanumerics -> underscore
    .replace(/^_+|_+$/g, "");    // trim underscores at ends
}

  /////////////////////////////////////////////
  async function refreshReferenceOptions() {
    const res = await fetch('/api/datatypes');
    const types = await res.json();
    const group = document.getElementById('reference-options');
    group.innerHTML = '';

    types.forEach(dt => {
      const opt = document.createElement('option');
      opt.value = `ref:${dt._id}`;
      opt.textContent = `Reference → ${dt.name}`;
      group.appendChild(opt);
    });
  }
  //Load Field List
async function loadFieldsForSelected() {
  const dataTypeId = selectedIdInput.value;
  if (!dataTypeId) {
    if (fieldsTbody) fieldsTbody.innerHTML = '';
    return;
  }
  const res = await fetch(`/api/fields?dataTypeId=${dataTypeId}`);
  const fields = await res.json();

  fieldsTbody.innerHTML = '';

  if (!Array.isArray(fields) || fields.length === 0) {
    fieldsTbody.innerHTML = `<tr><td colspan="3">No fields yet</td></tr>`;
    return;
  }

  fields.forEach(f => {
    const tr = document.createElement('tr');

    // --- col 1: editable name ---
    const tdName = document.createElement('td');
    const input = document.createElement('input');
    input.type = 'text';
    input.value = f.name;
    input.style.width = '100%';
    input.title = 'Edit name and click away to save';
    input.addEventListener('change', async () => {
      const newName = input.value.trim();
      if (!newName || newName === f.name) return;
      // optimistic UI
      const old = f.name;
      f.name = newName;
      try {
        const r = await fetch(`/api/fields/${f._id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: newName })
        });
        if (!r.ok) {
          const err = await r.json().catch(() => ({}));
          alert(err.error || 'Rename failed');
          f.name = old;
          input.value = old;
        }
      } catch (e) {
        alert('Rename failed: ' + e.message);
        f.name = old;
        input.value = old;
      }
    });
    tdName.appendChild(input);

   // --- col 2: type / default selector for Dropdown ---
// --- col 2: type / default selector for Dropdown ---
const tdType = document.createElement('td');

if (f.type === 'Dropdown' && f.optionSetId) {
  // Show "Dropdown → {SetName}" when available
  const setName = (typeof f.optionSetId === 'object' && f.optionSetId?.name)
    ? ` → ${f.optionSetId.name}`
    : '';
  const typeLabel = document.createElement('div');
  typeLabel.textContent = `Dropdown${setName}`;
  typeLabel.style.marginBottom = '6px';
  tdType.appendChild(typeLabel);

  // default selector
  const wrap = document.createElement('div');
  const lab  = document.createElement('label');
  lab.textContent = 'Default: ';
  lab.style.marginRight = '6px';

  const sel = document.createElement('select');
  const loading = document.createElement('option');
  loading.textContent = 'Loading…';
  sel.appendChild(loading);

  wrap.appendChild(lab);
  wrap.appendChild(sel);
  tdType.appendChild(wrap);

  // fill options from this field's option set
  (async () => {
    const setId = idOf(f.optionSetId);
    const r = await fetch(`/api/optionsets/${setId}/values`);
    const vals = await r.json();
    sel.innerHTML = '';

    const none = document.createElement('option');
    none.value = '';
    none.textContent = '— none —';
    sel.appendChild(none);

    (vals || []).forEach(v => {
      const opt = document.createElement('option');
      opt.value = v._id;
      opt.textContent = v.label;
      sel.appendChild(opt);
    });

    if (f.defaultOptionValueId) sel.value = f.defaultOptionValueId;
  })().catch(() => {
    sel.innerHTML = '';
    const err = document.createElement('option');
    err.disabled = true;
    err.textContent = 'Failed to load';
    sel.appendChild(err);
  });

  // save default when changed
  sel.addEventListener('change', async () => {
    const defaultOptionValueId = sel.value || null;
    const r = await fetch(`/api/fields/${f._id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ defaultOptionValueId })
    });
    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      alert(err.error || 'Failed to save default');
      sel.value = f.defaultOptionValueId || '';
      return;
    }
    f.defaultOptionValueId = defaultOptionValueId;
  });

} else if (f.type === 'Reference') {
  const typeLabel = document.createElement('div');
  typeLabel.textContent = 'Reference';
  tdType.appendChild(typeLabel);

  // keep your existing reference name lookup here if you want
  if (f.referenceTo && typeof f.referenceTo === 'object' && f.referenceTo?.name) {
    typeLabel.textContent = `Reference → ${f.referenceTo.name}`;
  } else {
    (async () => {
      const map = await getDTMap();
      typeLabel.textContent = `Reference → ${map[idOf(f.referenceTo)] || '(unknown)'}`;
    })();
  }

} else {
  const typeLabel = document.createElement('div');
  typeLabel.textContent = f.type;
  tdType.appendChild(typeLabel);
}

// 🔹 "Allow multiple" toggle for any type (esp. File)
const multiWrap = document.createElement('label');
multiWrap.style.display = 'block';
multiWrap.style.marginTop = '4px';
const multiBox = document.createElement('input');
multiBox.type = 'checkbox';
multiBox.checked = !!f.allowMultiple;
multiBox.style.marginRight = '4px';

multiWrap.appendChild(multiBox);
multiWrap.appendChild(document.createTextNode('Allow multiple'));
tdType.appendChild(multiWrap);

// save allowMultiple when changed
multiBox.addEventListener('change', async () => {
  const newVal = !!multiBox.checked;
  try {
    const r = await fetch(`/api/fields/${f._id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ allowMultiple: newVal })
    });
    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      alert(err.error || 'Failed to save "allow multiple"');
      multiBox.checked = !newVal; // revert
      return;
    }
    f.allowMultiple = newVal;
  } catch (e) {
    alert('Failed to save: ' + e.message);
    multiBox.checked = !newVal;
  }
});


    // --- col 3: delete (soft) ---
    const tdActions = document.createElement('td');
    tdActions.style.textAlign = 'right';
    const del = document.createElement('button');
    del.textContent = '✕';
    del.title = 'Remove (soft delete)';
    del.style.background = '#d9534f';
    del.style.borderRadius = '4px';
    del.addEventListener('click', async () => {
      if (!confirm(`Remove field "${f.name}"?`)) return;
      try {
        const r = await fetch(`/api/fields/${f._id}`, { method: 'DELETE' });
        if (!r.ok) {
          const err = await r.json().catch(() => ({}));
          alert(err.error || 'Delete failed');
          return;
        }
        // Remove row from UI
        tr.remove();
        if (!fieldsTbody.children.length) {
          fieldsTbody.innerHTML = `<tr><td colspan="3">No fields yet</td></tr>`;
        }
      } catch (e) {
        alert('Delete failed: ' + e.message);
      }
    });
    tdActions.appendChild(del);

    tr.appendChild(tdName);
    tr.appendChild(tdType);
    tr.appendChild(tdActions);
    fieldsTbody.appendChild(tr);
  });
}
//Add option sets in Dropdown
async function populateOptionSetsInFieldType() {
  const group = document.getElementById('option-sets-options');
  if (!group) return;
  group.innerHTML = '<option disabled>Loading…</option>';

  try {
    const res = await fetch('/api/optionsets');
    const sets = await res.json();

    group.innerHTML = '';
    if (!Array.isArray(sets) || sets.length === 0) {
      const opt = document.createElement('option');
      opt.disabled = true;
      opt.textContent = 'No option sets yet';
      group.appendChild(opt);
      return;
    }

    // Put each set as "Dropdown → SetName"
    sets
      .filter(s => !s.deletedAt)
      .forEach(s => {
        const opt = document.createElement('option');
        opt.value = `os:${s._id}`;           // 👈 special value
        opt.textContent = `Dropdown → ${s.name}${s.kind ? ` (${s.kind})` : ''}`;
        group.appendChild(opt);
      });
  } catch (err) {
    group.innerHTML = '';
    const opt = document.createElement('option');
    opt.disabled = true;
    opt.textContent = 'Failed to load option sets';
    group.appendChild(opt);
  }
}



// ---- OPTION SETS 
//Helper for optionsets
const slugify = s =>
  String(s || '')
    .trim().toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 64);

// Load sets into the left column (optionally auto-select one by id)
async function loadOptionSets(preselectId = null) {
  if (!osList) return;
  osList.innerHTML = '<li>Loading…</li>';

  const res = await fetch('/api/optionsets');
  const sets = await res.json();

  if (!Array.isArray(sets) || sets.length === 0) {
    osList.innerHTML = '<li>No option sets yet</li>';
    osDetail.style.display = 'none';
    return;
  }

  osList.innerHTML = '';
  sets.forEach(set => {
    const li = document.createElement('li');
    li.dataset.id = set._id;
    li.className = 'datatype-row';
    li.innerHTML = `
      <span class="os-name" style="flex:1;">${set.name}</span>
      <button class="edit-datatype-btn" type="button">Edit</button>
    `;

    const open = () => {
      [...osList.children].forEach(el => el.classList.remove('selected'));
      li.classList.add('selected');
      openOptionSet(set);
    };

    li.addEventListener('click', open);
    li.querySelector('button').addEventListener('click', (e) => { e.stopPropagation(); open(); });

    osList.appendChild(li);

    if (preselectId && preselectId === set._id) open(); // auto-open after create/rename
  });
}

// Open selected set on the right
function openOptionSet(set) {
  osSelectedId.value = set._id;
  osNameInput.value = set.name;
  osDetail.style.display = 'block';
  loadOptionValues(set._id);
}

// Create set
osForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = (osInput.value || '').trim();
  if (!name) return;

  const kind = osKindCreateSelect?.value || 'text';

  const res = await fetch('/api/optionsets', {
    method: 'POST',
    headers: { 'Content-Type':'application/json' },
    body: JSON.stringify({ name, kind }) // 👈 include kind
  });

  if (!res.ok) {
    const err = await res.json().catch(()=>({}));
    alert(err.error || 'Failed to create option set');
    return;
  }

  const created = await res.json();
  osInput.value = '';
  if (osKindCreateSelect) osKindCreateSelect.value = 'text';
  await loadOptionSets(created._id);
  await populateOptionSetsInFieldType();   // 👈 refresh the field type select
});

// Rename set (keep current selection highlighted)
osRenameBtn?.addEventListener('click', async () => {
  const id = osSelectedId.value;
  const name = (osNameInput.value || '').trim();
  if (!id || !name) return;

  const res = await fetch(`/api/optionsets/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type':'application/json' },
    body: JSON.stringify({ name })
  });

  if (!res.ok) {
    const err = await res.json().catch(()=>({}));
    alert(err.error || 'Rename failed');
    return;
  }
  await loadOptionSets(id);
 await populateOptionSetsInFieldType(); 
});

// Delete set (and its values)
osDeleteBtn?.addEventListener('click', async () => {
  const id = osSelectedId.value;
  if (!id) return;
  if (!confirm('Delete this option set (and its values)?')) return;

  const res = await fetch(`/api/optionsets/${id}`, { method: 'DELETE' });
  if (!res.ok) {
    const err = await res.json().catch(()=>({}));
    alert(err.error || 'Delete failed');
    return;
  }

  osDetail.style.display = 'none';
  osSelectedId.value = '';
  await loadOptionSets();
});

// Load values for the selected set (right column table)
async function loadOptionValues(optionSetId) {
  ovTbody.innerHTML = '<tr><td colspan="4">Loading…</td></tr>';
  const res = await fetch(`/api/optionsets/${optionSetId}/values`);
  const vals = await res.json();

  ovTbody.innerHTML = '';
  if (!Array.isArray(vals) || vals.length === 0) {
    ovTbody.innerHTML = '<tr><td colspan="4">No values yet</td></tr>';
    return;
  }

  vals.forEach(v => {
 // inside vals.forEach(v => { ... })
const tr = document.createElement('tr');

// label
const tdLabel = document.createElement('td');
const inLabel = document.createElement('input');
inLabel.type = 'text';
inLabel.value = v.label;
inLabel.style.width = '100%';
inLabel.addEventListener('change', () => updateOptionValue(v._id, { label: inLabel.value }));
tdLabel.appendChild(inLabel);

// meta (depends on set.kind)
const tdMeta = document.createElement('td');
const kind = osKindSelect.value;

if (kind === 'image') {
  const imgIn = document.createElement('input');
  imgIn.type = 'text';
  imgIn.placeholder = 'Image URL';
  imgIn.style.width = '100%';
  imgIn.value = v.imageUrl ?? '';
  imgIn.addEventListener('change', () => updateOptionValue(v._id, { imageUrl: imgIn.value }));
  tdMeta.appendChild(imgIn);
} else if (kind === 'number') {
  const numIn = document.createElement('input');
  numIn.type = 'number';
  numIn.style.width = '100%';
  numIn.value = v.numberValue ?? '';
  numIn.addEventListener('change', () => updateOptionValue(v._id, { numberValue: numIn.value }));
  tdMeta.appendChild(numIn);
} else if (kind === 'boolean') {
  const chk = document.createElement('input');
  chk.type = 'checkbox';
  chk.checked = !!v.boolValue;
  chk.addEventListener('change', () => updateOptionValue(v._id, { boolValue: chk.checked }));
  tdMeta.appendChild(chk);
} else if (kind === 'color') {
  const col = document.createElement('input');
  col.type = 'color';
  col.value = v.colorHex || '#000000';
  col.addEventListener('change', () => updateOptionValue(v._id, { colorHex: col.value }));
  tdMeta.appendChild(col);
} else {
  tdMeta.textContent = '—'; // text kind: no extra meta
}

// order
const tdOrder = document.createElement('td');
const inOrder = document.createElement('input');
inOrder.type = 'number';
inOrder.value = v.order ?? 0;
inOrder.style.width = '80px';
inOrder.addEventListener('change', () => updateOptionValue(v._id, { order: Number(inOrder.value || 0) }));
tdOrder.appendChild(inOrder);

// actions
const tdActions = document.createElement('td');
tdActions.style.textAlign = 'right';
const del = document.createElement('button');
del.textContent = '✕';
del.style.background = '#d9534f';
del.addEventListener('click', async () => {
  if (!confirm(`Remove "${v.label}"?`)) return;
  const r = await fetch(`/api/optionvalues/${v._id}`, { method: 'DELETE' });
  if (!r.ok) {
    const err = await r.json().catch(()=>({}));
    alert(err.error || 'Delete failed');
    return;
  }
  tr.remove();
  if (!ovTbody.children.length) {
    ovTbody.innerHTML = '<tr><td colspan="4">No values yet</td></tr>';
  }
});
tdActions.appendChild(del);

// assemble row
tr.appendChild(tdLabel);
tr.appendChild(tdMeta);
tr.appendChild(tdOrder);
tr.appendChild(tdActions);
ovTbody.appendChild(tr);

  });
}

// Inline update one value
async function updateOptionValue(id, patch) {
  const res = await fetch(`/api/optionvalues/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type':'application/json' },
    body: JSON.stringify(patch)
  });
  if (!res.ok) {
    const err = await res.json().catch(()=>({}));
    alert(err.error || 'Update failed');
  }
}

// Add new value to the selected set
ovForm?.addEventListener('submit', async (e) => {
  e.preventDefault();

  const optionSetId = osSelectedId.value;
  if (!optionSetId) return alert('Select an option set first');

  const label = (ovLabelInput.value || '').trim();
  if (!label) return alert('Label is required');

  const body = {
    label,
    order: Number(ovOrderInput.value || 0)
  };

  const kind = osKindSelect.value;
  if (kind === 'image')   body.imageUrl    = ovImageUrl.value || null;
  if (kind === 'number')  body.numberValue = ovNumberValue.value;
  if (kind === 'boolean') body.boolValue   = ovBoolValue.checked;
  if (kind === 'color')   body.colorHex    = ovColorHex.value || null;

  const res = await fetch(`/api/optionsets/${optionSetId}/values`, {
    method: 'POST',
    headers: { 'Content-Type':'application/json' },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    alert(err.error || 'Failed to add value');
    return;
  }

  // reset UI
  ovLabelInput.value = '';
  ovImageUrl.value = '';
  ovNumberValue.value = '';
  ovBoolValue.checked = false;
  ovColorHex.value = '#000000';
  ovOrderInput.value = '0';

  await loadOptionValues(optionSetId);
});


//When opening a set, show its kind and toggle meta UI:
function openOptionSet(set) {
  osSelectedId.value = set._id;
  osNameInput.value = set.name;
  osDetail.style.display = 'block';

  // set the dropdown
  if (osKindSelect) {
    osKindSelect.value = set.kind || 'text';
    applyKindUI(osKindSelect.value); // show/hide meta inputs for values
  }

  loadOptionValues(set._id);
}

 //Kind Changer +save
 function applyKindUI(kind) {
  ovMetaImage.style.display   = (kind === 'image')   ? 'block' : 'none';
  ovMetaNumber.style.display  = (kind === 'number')  ? 'block' : 'none';
  ovMetaBoolean.style.display = (kind === 'boolean') ? 'block' : 'none';
  ovMetaColor.style.display   = (kind === 'color')   ? 'block' : 'none';
}

osKindSelect?.addEventListener('change', () => applyKindUI(osKindSelect.value));

osKindSaveBtn?.addEventListener('click', async () => {
  const id = osSelectedId.value;
  if (!id) return;
  const kind = osKindSelect.value;

  const res = await fetch(`/api/optionsets/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type':'application/json' },
    body: JSON.stringify({ kind })
  });

  if (!res.ok) {
    const err = await res.json().catch(()=>({}));
    alert(err.error || 'Failed to save kind');
    return;
  }

  // re-render values table with the right meta column
  await loadOptionValues(id);
});


 //Submit new value with the right meta:
ovForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const optionSetId = osSelectedId.value;
  if (!optionSetId) return alert('Select an option set first');

  const label = (ovLabelInput.value || '').trim();
  if (!label) return alert('Label is required');

  const body = { label, order: Number(ovOrderInput.value || 0) };
  const kind = osKindSelect.value;
  if (kind === 'image')   body.imageUrl    = ovImageUrl.value || null;
  if (kind === 'number')  body.numberValue = ovNumberValue.value;
  if (kind === 'boolean') body.boolValue   = ovBoolValue.checked;
  if (kind === 'color')   body.colorHex    = ovColorHex.value || null;

  const res = await fetch(`/api/optionsets/${optionSetId}/values`, {
    method: 'POST',
    headers: { 'Content-Type':'application/json' },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const err = await res.json().catch(()=>({}));
    alert(err.error || 'Failed to add value');
    return;
  }

  // reset form
  ovLabelInput.value = '';
  ovImageUrl.value = '';
  ovNumberValue.value = '';
  ovBoolValue.checked = false;
  ovColorHex.value = '#000000';
  ovOrderInput.value = '0';

  await loadOptionValues(optionSetId);
});






///////////////////////////////////////
//////                                    Themes Section 
/////////////////////////////////////

// ----------------------------
// Themes (Tab 6)
// ----------------------------
const themesTbody = document.querySelector('#themes-table tbody');
const themeCreateForm = document.getElementById('theme-create-form');
const themeNameInput = document.getElementById('theme-name');
const themeKeyInput = document.getElementById('theme-key');
const themePreviewInput = document.getElementById('theme-preview');

let themesDT = null;
let allThemes = [];

async function getThemeDataType() {
  if (themesDT) return themesDT;

  const dtRes = await fetch('/api/datatypes', { headers: { 'Accept': 'application/json' } });
  if (!dtRes.ok) throw new Error(`DataTypes HTTP ${dtRes.status}`);
  const dts = await dtRes.json();

  const found = (dts || []).find(dt =>
    dt.name === 'Store Theme' ||
    dt.nameCanonical === 'store_theme' ||
    dt.nameCanonical === 'store theme'
  );

  if (!found) throw new Error('No "Store Theme" DataType found. Create it first in Data Types tab.');

  themesDT = found;
  return found;
}

async function loadThemes() {
  if (!themesTbody) return;

  themesTbody.innerHTML = `<tr><td colspan="4">Loading…</td></tr>`;

  try {
    const dt = await getThemeDataType();

    const res = await fetch(`/api/records?dataTypeId=${dt._id}&limit=500&sort=-createdAt`, {
      headers: { 'Accept': 'application/json' }
    });

    if (!res.ok) throw new Error(`Records HTTP ${res.status}`);

    const body = await res.json().catch(() => ({}));
    const rows = Array.isArray(body) ? body : (body.items || body.records || []);
    allThemes = rows;

    renderThemesTable();
  } catch (err) {
    console.error('[admin] loadThemes failed:', err);
    themesTbody.innerHTML = `<tr><td colspan="4">Failed: ${err.message}</td></tr>`;
  }
}

function renderThemesTable() {
  if (!themesTbody) return;

  if (!allThemes.length) {
    themesTbody.innerHTML = `<tr><td colspan="4">No themes yet</td></tr>`;
    return;
  }

  themesTbody.innerHTML = '';

  allThemes.forEach(rec => {
    const v = rec.values || {};
    const name = String(v.name || v['Name'] || '');
    const key  = String(v.templateKey || v['Template Key'] || v.key || '');
    const preview = String(v.previewImage || v['Preview Image'] || v.previewUrl || '');

    const tr = document.createElement('tr');

    // name (editable)
    const tdName = document.createElement('td');
    const inName = document.createElement('input');
    inName.type = 'text';
    inName.value = name;
    inName.style.width = '100%';
    tdName.appendChild(inName);

    // key (editable)
    const tdKey = document.createElement('td');
    const inKey = document.createElement('input');
    inKey.type = 'text';
    inKey.value = key;
    inKey.style.width = '100%';
    tdKey.appendChild(inKey);

    // preview (editable)
    const tdPrev = document.createElement('td');
    const inPrev = document.createElement('input');
    inPrev.type = 'text';
    inPrev.value = preview;
    inPrev.placeholder = 'https://...';
    inPrev.style.width = '100%';
    tdPrev.appendChild(inPrev);

    // actions
    const tdActions = document.createElement('td');
    tdActions.style.textAlign = 'right';

    const btnSave = document.createElement('button');
    btnSave.textContent = 'Save';
    btnSave.style.marginRight = '8px';

    btnSave.addEventListener('click', async () => {
      const patch = {
        values: {
          name: inName.value.trim(),
          templateKey: inKey.value.trim(),
          previewImage: inPrev.value.trim() || null
        }
      };

      if (!patch.values.name) return alert('Theme name is required');
      if (!patch.values.templateKey) return alert('Template key is required');

      const r = await fetch(`/api/records/${rec._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch)
      });

      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        alert(err.error || 'Save failed');
        return;
      }

      // update local
      rec.values = { ...(rec.values || {}), ...patch.values };
      alert('Saved');
    });

    const btnDel = document.createElement('button');
    btnDel.textContent = 'Delete';
    btnDel.style.background = '#d9534f';

    btnDel.addEventListener('click', async () => {
      if (!confirm(`Delete theme "${name}"?`)) return;
      const r = await fetch(`/api/records/${rec._id}`, { method: 'DELETE' });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        alert(err.error || 'Delete failed');
        return;
      }
      allThemes = allThemes.filter(x => (x._id !== rec._id));
      renderThemesTable();
    });

    tdActions.appendChild(btnSave);
    tdActions.appendChild(btnDel);

    tr.appendChild(tdName);
    tr.appendChild(tdKey);
    tr.appendChild(tdPrev);
    tr.appendChild(tdActions);

    themesTbody.appendChild(tr);
  });
}

// Create Theme
themeCreateForm?.addEventListener('submit', async (e) => {
  e.preventDefault();

  const name = (themeNameInput.value || '').trim();
  const templateKey = (themeKeyInput.value || '').trim();
  const previewImage = (themePreviewInput.value || '').trim();

  if (!name) return alert('Theme name is required');
  if (!templateKey) return alert('Template key is required');

  try {
    const dt = await getThemeDataType();

    const payload = {
      dataTypeId: dt._id,
      values: {
        name,
        templateKey,
        previewImage: previewImage || null
      }
    };

    const res = await fetch('/api/records', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err.error || 'Failed to create theme');
      return;
    }

    themeNameInput.value = '';
    themeKeyInput.value = '';
    themePreviewInput.value = '';

    await loadThemes();
    // optional: jump to tab 6 after creating
    if (window.switchToTab) window.switchToTab(6);

  } catch (err) {
    alert(err.message);
  }
});

// OPTIONAL: auto-load themes when tab is clicked
document.getElementById('tab6')?.addEventListener('click', () => {
  loadThemes();
});

});
