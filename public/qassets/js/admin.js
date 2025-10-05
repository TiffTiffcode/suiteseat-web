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

  // Boot on page load
  loadDataTypes();
  refreshReferenceOptions();
  loadOptionSets();
  loadOptionSets();
 populateOptionSetsInFieldType();
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
  // Prefer populated name, otherwise look it up
  if (f.referenceTo && typeof f.referenceTo === 'object' && f.referenceTo?.name) {
    tdType.textContent = `Reference → ${f.referenceTo.name}`;
  } else {
    tdType.textContent = 'Reference';
    (async () => {
      const map = await getDTMap();
      tdType.textContent = `Reference → ${map[idOf(f.referenceTo)] || '(unknown)'}`;
    })();
  }

} else {
  tdType.textContent = f.type;
}



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



});
