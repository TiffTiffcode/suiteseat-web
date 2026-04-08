//C:\Users\tiffa\OneDrive\Desktop\suiteseat-web\public\qassets\js\template.js
//Make sidebar minimize

const API_BASE =
  location.hostname === "localhost"
    ? "http://localhost:8400"
    : "https://api2.suiteseat.io";

function apiUrl(path) {
  if (!path.startsWith("/")) path = `/${path}`;

  if (path.startsWith("/public")) return `${API_BASE}${path}`;
  if (!path.startsWith("/api")) path = `/api${path}`;

  return `${API_BASE}${path}`;
}

async function apiFetch(path, opts = {}) {
  return fetch(apiUrl(path), {
    credentials: "include",
    headers: { Accept: "application/json", ...(opts.headers || {}) },
    ...opts,
  });
}

async function fetchJSON(path, opts = {}) {
  const res = await apiFetch(path, {
    headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
    ...opts,
  });

  const text = await res.text().catch(() => "");
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }

  if (!res.ok) throw new Error(data.message || data.error || `HTTP ${res.status}`);
  return data;
}

let currentUser = null;
let currentPageRecord = null;

async function hydrateUser() {
  try {
    const data = await fetchJSON("/api/me", { method: "GET" });
    console.log("[builder] /api/me response:", data);

    const userId =
      data?.user?._id ||
      data?.user?.id ||
      null;

    const email = data?.user?.email || "";
    const firstName = data?.user?.firstName || data?.user?.name || "";

    if (userId) {
      currentUser = {
        id: String(userId),
        email,
        firstName,
        roles: Array.isArray(data?.user?.roles) ? data.user.roles : [],
        proMode: data?.user?.proMode || "",
      };
    } else {
      currentUser = null;
    }
  } catch (e) {
    console.warn("[builder] hydrateUser failed:", e);
    currentUser = null;
  }

  console.log("[builder] hydrateUser currentUser:", currentUser);
  return currentUser;
}

window.TPL_PAGE_TYPE = "booking"; 









// ✅ editor mode flag (default = editing)
window.TPL_PREVIEW = false;


//Flip label inside element
function updateLabelPlacement(el, grid) {
 const nameWrap = el.querySelector(".da-item__namebar");

  if (!nameWrap) return;

  const left = parseFloat(el.style.left) || 0;
  const top  = parseFloat(el.style.top)  || 0;

  const gridW = grid.clientWidth || 0;
  const labelW = nameWrap.offsetWidth || 210;
  const pad = 8;

  // reset (default = outside, top-left)
  nameWrap.style.top = "-12px";
  nameWrap.style.left = "12px";
  nameWrap.style.right = "auto";

  // ✅ too close to top → move inside
  if (top < 16) nameWrap.style.top = `${pad}px`;

  // ✅ too close to left → move inside-left
  if (left < 8) nameWrap.style.left = `${pad}px`;

  // ✅ too close to right → pin inside-right
  if (left + labelW + 12 > gridW) {
    nameWrap.style.left = "auto";
    nameWrap.style.right = `${pad}px`;
  }
}






                                               // =======================
                                            //  Drodown
                                             //
                                             // =======================
//Choose Page to Customize 
function filterElementsForPageType() {
  const select = document.getElementById("tpl-page-type");
  const items = document.querySelectorAll(".elementItem");

  if (!select) return;

  const pageType = select.value || "booking";
  window.TPL_PAGE_TYPE = pageType;

  items.forEach((item) => {
    const pages = String(item.dataset.pages || "")
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);

    const show = !pages.length || pages.includes(pageType);
    item.style.display = show ? "" : "none";
  });

  console.log("[builder] page type:", pageType);
} 

//Load dropdown
function toItems(data) {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.items)) return data.items;
  if (Array.isArray(data.records)) return data.records;
  return [];
}

async function loadSuitePageOptions() {
  const select = document.getElementById("tpl-page-record");
  if (!select) return;

  try {
    if (!currentUser?.id) {
      select.innerHTML = `<option value="">Log in first</option>`;
      return;
    }

    const data = await fetchJSON(`/api/records/Location?limit=200&ts=${Date.now()}`, {
      method: "GET",
      cache: "no-store",
    });

    const rows = toItems(data);

    select.innerHTML = `<option value="">Select a suite page</option>`;

    rows.forEach((row) => {
      const v = row.values || row;
      const id = row._id || row.id;
      const name =
        v["Location Name"] ||
        v.name ||
        v.Name ||
        "Untitled location";

      if (!id) return;

      const opt = document.createElement("option");
      opt.value = String(id);
      opt.textContent = name;
      select.appendChild(opt);
    });

    console.log("[builder] suite page options loaded:", rows);
  } catch (err) {
    console.error("[builder] failed to load suite page options:", err);
    select.innerHTML = `<option value="">No suite pages found</option>`;
  }
}



document.addEventListener("DOMContentLoaded", async () => {
  console.log("[builder boot] url:", window.location.href);

  const launch = getBuilderLaunchParams();
  console.log("[builder boot] launch params at startup:", launch);

const pageTypeEl = document.getElementById("tpl-page-type");
const pageRecordEl = document.getElementById("tpl-page-record");
const saveBtn = document.getElementById("tpl-save-btn");
const resetBtn = document.getElementById("tpl-reset-btn");
  
  const user = await hydrateUser();

  if (!user) {
    alert("Please log in first.");
    return;
  }

  restoreBuilderSelectionState();
  filterElementsForPageType();

  window.populateDynamicFieldOptions?.();
  window.populateSectionDataTypeOption?.();

  if (pageTypeEl) {
    pageTypeEl.addEventListener("change", async () => {
      saveBuilderSelectionState();
      filterElementsForPageType();
      populateDynamicFieldOptions();
      populateSectionDataTypeOption();
      await loadPageRecordOptionsByType();

      const savedRecordId = localStorage.getItem("tpl_selected_page_record") || "";
      if (pageRecordEl && savedRecordId) {
        pageRecordEl.value = savedRecordId;
      }

      if (pageRecordEl?.value) {
        await loadTemplateFromDatabase();
      }
    });
  }

  pageRecordEl?.addEventListener("change", async () => {
    saveBuilderSelectionState();
    console.log("[builder] selected page id:", pageRecordEl.value);
    await loadTemplateFromDatabase();
  });

  saveBtn?.addEventListener("click", () => {
    window.saveTemplateToDatabase?.();
  });

  resetBtn?.addEventListener("click", () => {
  window.resetTemplateToDefault?.();
});

  const usedLaunchParams = await applyLaunchParamsToBuilder();

  if (!usedLaunchParams) {
    await loadPageRecordOptionsByType();

    const savedRecordId = localStorage.getItem("tpl_selected_page_record") || "";
    if (pageRecordEl && savedRecordId) {
      pageRecordEl.value = savedRecordId;
    }

    if (pageRecordEl?.value) {
      await loadTemplateFromDatabase();
    }
  }
});
async function loadPageRecordOptionsByType() {
  const pageTypeEl = document.getElementById("tpl-page-type");
  if (!pageTypeEl) return;

  const pageType = pageTypeEl.value || "booking";

  console.log("[builder] loading page options for type:", pageType);

  if (pageType === "suite") {
    await loadSuitePageOptions();
    return;
  }

  // temporary fallback for everything else
  const select = document.getElementById("tpl-page-record");
  if (select) {
    select.innerHTML = `<option value="">No loader set for ${pageType} yet</option>`;
  }
}


//Redirect Helper
function getBuilderLaunchParams() {
  const params = new URLSearchParams(window.location.search);

  const result = {
    locationId: params.get("locationId") || "",
    pageType: params.get("pageType") || "",
    templateKey: params.get("template") || "default",
    slug: params.get("slug") || "",
  };

  console.log("[builder launch] raw search:", window.location.search);
  console.log("[builder launch] params:", result);

  return result;
}

async function applyLaunchParamsToBuilder() {
  const { locationId, pageType, templateKey, slug } = getBuilderLaunchParams();

  console.log("[builder applyLaunch] locationId:", locationId);
  console.log("[builder applyLaunch] pageType:", pageType);
  console.log("[builder applyLaunch] templateKey:", templateKey);
  console.log("[builder applyLaunch] slug:", slug);

  const pageTypeSelect = document.getElementById("tpl-page-type");
  const pageRecordSelect = document.getElementById("tpl-page-record");
  const templateSelect = document.getElementById("tpl-template-select");

  if (!locationId && !pageType && !templateKey) {
    console.log("[builder applyLaunch] no launch params found");
    return false;
  }

  if (pageType && pageTypeSelect) {
    console.log("[builder applyLaunch] setting pageType dropdown to:", pageType);
    pageTypeSelect.value = pageType;
    window.TPL_PAGE_TYPE = pageType;
    filterElementsForPageType();
    await loadPageRecordOptionsByType();
  }

  if (templateSelect) {
    const nextTemplate = templateKey || "custom";
    console.log("[builder applyLaunch] setting template dropdown to:", nextTemplate);
    templateSelect.value = nextTemplate;
    window.TPL_SELECTED_TEMPLATE = nextTemplate;
  }

  if (locationId && pageRecordSelect) {
    console.log("[builder applyLaunch] setting page record dropdown to:", locationId);
    pageRecordSelect.value = locationId;
    localStorage.setItem("tpl_selected_page_record", locationId);
  }

  if (pageRecordSelect?.value) {
    console.log("[builder applyLaunch] loading template for page:", pageRecordSelect.value);
    await loadTemplateFromDatabase();
  }

  return true;
}

//Canvas Helper
function clampElToCanvasBounds(el) {
  const gridEl = document.getElementById("dropAreaInner");
  if (!el || !gridEl) return;

  const maxLeft = Math.max(0, gridEl.clientWidth - el.offsetWidth);
  const maxTop = Math.max(0, gridEl.scrollHeight - el.offsetHeight);

  let left = parseFloat(el.style.left || "0") || 0;
  let top = parseFloat(el.style.top || "0") || 0;

  left = Math.max(0, Math.min(left, maxLeft));
  top = Math.max(0, Math.min(top, maxTop));

  el.style.left = `${Math.round(left)}px`;
  el.style.top = `${Math.round(top)}px`;
}

///Save Canvas

function saveBuilderSelectionState() {
  const pageTypeEl = document.getElementById("tpl-page-type");
  const pageRecordEl = document.getElementById("tpl-page-record");

  localStorage.setItem("tpl_selected_page_type", pageTypeEl?.value || "booking");
  localStorage.setItem("tpl_selected_page_record", pageRecordEl?.value || "");
}

function restoreBuilderSelectionState() {
  const pageTypeEl = document.getElementById("tpl-page-type");

  const launch = getBuilderLaunchParams();
  const hasLaunchParams = !!(launch.pageType || launch.locationId);

  console.log("[builder restore] hasLaunchParams:", hasLaunchParams);
  console.log("[builder restore] launch params:", launch);
  console.log("[builder restore] localStorage page type:", localStorage.getItem("tpl_selected_page_type"));
  console.log("[builder restore] localStorage page record:", localStorage.getItem("tpl_selected_page_record"));

  if (hasLaunchParams) {
    if (pageTypeEl && launch.pageType) {
      pageTypeEl.value = launch.pageType;
      window.TPL_PAGE_TYPE = launch.pageType;
    }
    return;
  }

  const savedType = localStorage.getItem("tpl_selected_page_type") || "booking";

  if (pageTypeEl) {
    pageTypeEl.value = savedType;
    window.TPL_PAGE_TYPE = savedType;
  }
}






//Remove Drop Here Label
const dropLabel = document.querySelector(".tpl-dropArea__label");
if (dropLabel) {
  dropLabel.style.display = "none";
}



                                               // =======================
                                            // STEPS Inside IIFE
                                             //
                                             // =======================
//IIFE
                            //Drag logic 
//Drag Section
(() => {

  //////////////////////Helper
const DATA_TYPE_FIELDS_CACHE = {};
function getDynamicPathFromElement(el) {
  if (!el) return [];

  try {
    const parsed = JSON.parse(el.dataset.dynamicPath || "[]");
    if (Array.isArray(parsed) && parsed.length) return parsed;
  } catch {}

  // fallback for old UI
  const oldField = el.dataset.dynamicField || "";
  if (oldField) {
    return [
      { kind: "field", value: oldField }
    ];
  }

  return [];
}

async function populateTextNestedFieldOptions(item = selectedItem) {
  if (!textNestedFieldEl || !item) return;

  const source = item.dataset.dynamicSource || "page";
  const field = item.dataset.dynamicField || "";
  const selectedRecordId = item.dataset.selectedRecordId || "";
  const currentValue = item.dataset.nestedField || "";

  textNestedFieldEl.innerHTML = `<option value="">Select nested field</option>`;

  if (!field || !selectedRecordId) return;

  let parentDataTypeName = "";
  let parentDataTypeId = "";

  if (source === "page") {
    const pageType = window.TPL_PAGE_TYPE || "booking";
    parentDataTypeName = getMainDataTypeForPageType(pageType) || "";
    parentDataTypeId = window.TPL_CURRENT_PAGE_DATATYPE_ID || "";
  }

if (source === "parentGroup") {
  const parentGroup = getParentGroupContainer(item);
  parentDataTypeName =
    parentGroup?.dataset?.finalDataType ||
    parentGroup?.dataset?.itemDataType ||
    "";
  parentDataTypeId =
    parentGroup?.dataset?.finalDataTypeId ||
    parentGroup?.dataset?.itemDataTypeId ||
    "";
}

  const relatedMeta = await getRelatedDataTypeMetaFromField(
    field,
    parentDataTypeName,
    parentDataTypeId
  );

  if (!relatedMeta?.name) return;

  const fields = await getFieldsForDataType(
    relatedMeta.name,
    relatedMeta.id || ""
  );

  const seen = new Set();

  fields.forEach((fieldObj) => {
    const fieldKey =
      fieldObj?.fieldName ||
      fieldObj?.name ||
      fieldObj?.label ||
      "";

    const fieldLabel =
      fieldObj?.label ||
      fieldObj?.name ||
      fieldKey;

    let referenceTo =
      fieldObj?.referenceTo ||
      fieldObj?.referenceDataType ||
      fieldObj?.relatedDataType ||
      fieldObj?.dataTypeName ||
      fieldObj?.options?.referenceTo ||
      "";

    const fieldType =
      fieldObj?.type ||
      fieldObj?.fieldType ||
      "";

    if (referenceTo && typeof referenceTo === "object") {
      referenceTo =
        referenceTo.name ||
        referenceTo.label ||
        referenceTo.dataTypeName ||
        referenceTo._id ||
        "";
    }

    const isReference =
      String(fieldType).toLowerCase().includes("reference") ||
      !!referenceTo;

    const key = String(fieldKey).trim().toLowerCase();
    if (!fieldKey) return;
    if (!isReference) return;
    if (seen.has(key)) return;

    seen.add(key);

    const option = document.createElement("option");
    option.value = fieldKey;
    option.textContent = fieldLabel;
    textNestedFieldEl.appendChild(option);
  });

  if ([...textNestedFieldEl.options].some((o) => o.value === currentValue)) {
    textNestedFieldEl.value = currentValue;
  }
}
async function populateTextSelectedRecordOptions(item = selectedItem) {
  if (!textSelectedRecordEl || !item) return;

  const source = item.dataset.dynamicSource || "page";
  const field = item.dataset.dynamicField || "";
  const currentValue = item.dataset.selectedRecordId || "";

  console.log("[text/records] source:", source);
  console.log("[text/records] field:", field);
  console.log("[text/records] currentValue:", currentValue);

  textSelectedRecordEl.innerHTML = `<option value="">Select item</option>`;

  if (!field) return;

  let sourceRecord = null;
  let sourceRecordId = "";

  if (source === "page") {
    sourceRecord = window.TPL_CURRENT_PAGE_ROW || currentPageRecord || null;
    sourceRecordId = String(getRecordId(sourceRecord));
  }

  if (source === "parentGroup") {
    const parentGroup = getParentGroupContainer(item);
    if (!parentGroup) return;

    sourceRecord = await getSelectedRecordFromGroup(parentGroup);
    sourceRecordId = String(getRecordId(sourceRecord));
  }

  console.log("[text/records] sourceRecord:", sourceRecord);
  console.log("[text/records] sourceRecord keys:", Object.keys(sourceRecord || {}));
  console.log("[text/records] sourceRecord values keys:", Object.keys(sourceRecord?.values || {}));
  console.log("[text/records] sourceRecordId:", sourceRecordId);

  if (!sourceRecord) return;

  const fieldValue = getFieldValueFromRecord(sourceRecord, field);

  console.log("[text/records] requested field exactly:", JSON.stringify(field));
  console.log("[text/records] direct sourceRecord[field]:", sourceRecord?.[field]);
  console.log("[text/records] direct sourceRecord.values[field]:", sourceRecord?.values?.[field]);

  const refIds = extractRefIds(fieldValue);

  console.log("[text/records] fieldValue:", fieldValue);
  console.log("[text/records] refIds:", refIds);

  let parentDataTypeName = "";
  let parentDataTypeId = "";

  if (source === "page") {
    const pageType = window.TPL_PAGE_TYPE || "booking";
    parentDataTypeName = getMainDataTypeForPageType(pageType) || "";
    parentDataTypeId = window.TPL_CURRENT_PAGE_DATATYPE_ID || "";
  }

  if (source === "parentGroup") {
    const parentGroup = getParentGroupContainer(item);
    parentDataTypeName = parentGroup?.dataset?.itemDataType || "";
    parentDataTypeId = parentGroup?.dataset?.itemDataTypeId || "";
  }

  console.log("[text/records] parentDataTypeName:", parentDataTypeName);
  console.log("[text/records] parentDataTypeId:", parentDataTypeId);

  const relatedMeta = await getRelatedDataTypeMetaFromField(
    field,
    parentDataTypeName,
    parentDataTypeId
  );

  console.log("[text/records] relatedMeta:", relatedMeta);

  // ✅ if Parent Group field is a plain field, no selected-record dropdown is needed
  if (source === "parentGroup" && !relatedMeta?.name) {
    textSelectedRecordEl.innerHTML = `<option value="">Direct field</option>`;
    return;
  }

  if (!relatedMeta?.name) return;

  const rows = await fetchRowsForDynamicReference(
    relatedMeta.name,
    relatedMeta.id || ""
  );

  console.log("[text/records] fetched rows:", rows);

  let matchedRows = [];

  // 1) normal direct-id lookup
  if (refIds.length) {
    matchedRows = rows.filter((row, index) => {
      const rowId = String(getRecordId(row, index));
      return refIds.includes(rowId);
    });

    console.log("[text/records] matchedRows by direct ids:", matchedRows);
  }

  // 2) reverse lookup fallback
  if (!matchedRows.length && sourceRecordId) {
    matchedRows = rows.filter((row) => {
      const locationValue =
        getFieldValueFromRecord(row, parentDataTypeName) ||
        getFieldValueFromRecord(row, "Location") ||
        getFieldValueFromRecord(row, "location");

      const rowRefIds = extractRefIds(locationValue);

      return rowRefIds.includes(sourceRecordId);
    });

    console.log("[text/records] matchedRows by reverse lookup:", matchedRows);
  }

  matchedRows.forEach((entry, index) => {
    const option = document.createElement("option");
    const value = String(getRecordId(entry, index));
    option.value = value;
    option.textContent = getRecordLabel(entry, index);
    textSelectedRecordEl.appendChild(option);
  });

  if ([...textSelectedRecordEl.options].some((o) => o.value === currentValue)) {
    textSelectedRecordEl.value = currentValue;
  }

  console.log(
    "[text/records] final options:",
    [...textSelectedRecordEl.options].map((o) => ({
      value: o.value,
      text: o.textContent
    }))
  );
}

async function populateTextRecordFieldOptions(item = selectedItem) {
  if (!textRecordFieldEl || !item) return;

  const source = item.dataset.dynamicSource || "page";
  const field = item.dataset.dynamicField || "";
  const nestedField = item.dataset.nestedField || "";
  const currentValue = item.dataset.recordField || "";

  console.log("[text/recordFields] source:", source);
  console.log("[text/recordFields] field:", field);
  console.log("[text/recordFields] nestedField:", nestedField);
  console.log("[text/recordFields] currentValue:", currentValue);

  textRecordFieldEl.innerHTML = `<option value="">Select item field</option>`;

  if (!field) return;

  let parentDataTypeName = "";
  let parentDataTypeId = "";

  if (source === "page") {
    const pageType = window.TPL_PAGE_TYPE || "booking";
    parentDataTypeName = getMainDataTypeForPageType(pageType) || "";
    parentDataTypeId = window.TPL_CURRENT_PAGE_DATATYPE_ID || "";
  }

if (source === "parentGroup") {
  const parentGroup = getParentGroupContainer(item);
  parentDataTypeName =
    parentGroup?.dataset?.finalDataType ||
    parentGroup?.dataset?.itemDataType ||
    "";
  parentDataTypeId =
    parentGroup?.dataset?.finalDataTypeId ||
    parentGroup?.dataset?.itemDataTypeId ||
    "";
}

  console.log("[text/recordFields] parentDataTypeName:", parentDataTypeName);
  console.log("[text/recordFields] parentDataTypeId:", parentDataTypeId);

  const firstMeta = await getRelatedDataTypeMetaFromField(
    field,
    parentDataTypeName,
    parentDataTypeId
  );

  console.log("[text/recordFields] firstMeta:", firstMeta);

  if (!firstMeta?.name) return;

  let finalDataTypeName = firstMeta.name;
  let finalDataTypeId = firstMeta.id || "";

  if (nestedField) {
    const secondMeta = await getRelatedDataTypeMetaFromField(
      nestedField,
      firstMeta.name,
      firstMeta.id || ""
    );

    console.log("[text/recordFields] secondMeta:", secondMeta);

    if (!secondMeta?.name) return;

    finalDataTypeName = secondMeta.name;
    finalDataTypeId = secondMeta.id || "";
  }

  const fields = await getFieldsForDataType(
    finalDataTypeName,
    finalDataTypeId
  );

  console.log("[text/recordFields] final fields source datatype:", finalDataTypeName);
  console.log("[text/recordFields] fields:", fields);

  const seen = new Set();

  fields.forEach((fieldObj) => {
    const fieldKey =
      fieldObj?.fieldName ||
      fieldObj?.name ||
      fieldObj?.label ||
      "";

    const fieldLabel =
      fieldObj?.label ||
      fieldObj?.name ||
      fieldKey;

    const key = String(fieldKey).trim().toLowerCase();
    if (!fieldKey || seen.has(key)) return;

    seen.add(key);

    const option = document.createElement("option");
    option.value = fieldKey;
    option.textContent = fieldLabel;
    textRecordFieldEl.appendChild(option);
  });

  if ([...textRecordFieldEl.options].some((o) => o.value === currentValue)) {
    textRecordFieldEl.value = currentValue;
  }

  console.log(
    "[text/recordFields] final options:",
    [...textRecordFieldEl.options].map((o) => ({
      value: o.value,
      text: o.textContent
    }))
  );
}

//Group Helper
function extractReferenceIds(rawValue) {
  const list = Array.isArray(rawValue)
    ? rawValue
    : rawValue != null
      ? [rawValue]
      : [];

  return list.flatMap((entry) => {
    if (entry == null) return [];

    if (typeof entry === "string" || typeof entry === "number") {
      return [String(entry)];
    }

    return [
      entry._id,
      entry.id,
      entry.userId,
      entry.recordId,
      entry.value,
      entry.values?._id,
      entry.values?.id,
    ]
      .filter(Boolean)
      .map((v) => String(v));
  });
}

function getFlexibleRecordId(row, index = 0) {
  return String(
    row?._id ||
    row?.id ||
    row?.userId ||
    row?.recordId ||
    row?.values?._id ||
    row?.values?.id ||
    index
  );
}

//////////
function updateGroupBarVisibility(item = selectedItem) {
  if (!item || item.dataset.type !== "group") return;

  const isDynamic = (item.dataset.dynamicMode || "static") === "dynamic";
  const hasDynamicField = !!(item.dataset.dynamicField || "");
  const hasSelectedItem = !!(item.dataset.selectedItemId || "");
  const hasNestedField = !!(item.dataset.nestedField || "");
  const hasNestedSelectedItem = !!(item.dataset.nestedSelectedItemId || "");

  if (groupModeEl) groupModeEl.style.display = "";
  if (groupDynamicSourceEl) groupDynamicSourceEl.style.display = isDynamic ? "" : "none";
  if (groupBindModeEl) groupBindModeEl.style.display = isDynamic ? "" : "none";
  if (groupDynamicFieldEl) groupDynamicFieldEl.style.display = isDynamic ? "" : "none";

  if (groupSelectedItemEl) {
    groupSelectedItemEl.style.display = isDynamic && hasDynamicField ? "" : "none";
  }

  if (groupNestedFieldEl) {
    groupNestedFieldEl.style.display = isDynamic && hasSelectedItem ? "" : "none";
  }

  if (groupNestedSelectedItemEl) {
    groupNestedSelectedItemEl.style.display = isDynamic && hasNestedField ? "" : "none";
  }

  if (groupItemFieldEl) {
    groupItemFieldEl.style.display =
      isDynamic && hasNestedSelectedItem ? "" : "none";
  }
}


function getParentGroupContainer(childEl) {
  if (!childEl) return null;

  let current = childEl;
  let guard = 0;

  while (current && guard++ < 50) {
    const pid = current.dataset.parent;
    if (!pid) return null;

    const parent = getItemById(pid);
    if (!parent) return null;

    if (parent.dataset.type === "group") {
      return parent;
    }

    current = parent;
  }

  return null;
}


async function getGroupSourceList(groupEl) {
  if (!groupEl) return [];

  const source = groupEl.dataset.dynamicSource || "page";
  const field = groupEl.dataset.dynamicField || "";

  console.log("[group] source:", source);
  console.log("[group] field:", field);

  if (!field) return [];

  let sourceRecord = null;
  let sourceRecordId = "";

  if (source === "page") {
    sourceRecord = window.TPL_CURRENT_PAGE_ROW || currentPageRecord || null;
    sourceRecordId = getSelectedPageId() || "";
  }

  if (source === "parentGroup") {
    const parentGroup = getParentGroupContainer(groupEl);
    if (!parentGroup) return [];

    sourceRecord = await getSelectedRecordFromGroup(parentGroup);
    if (!sourceRecord) return [];

    sourceRecordId = String(getRecordId(sourceRecord));
  }

  if (!sourceRecord) return [];

  const directValue = getFieldValueFromRecord(sourceRecord, field);
  const directIds = extractRefIds(directValue);

  console.log("[group/source] field:", field);
  console.log("[group/source] raw value:", directValue);
  console.log("[group/source] extracted ids:", directIds);

  console.log("[group] directValue:", directValue);
  console.log("[group] directIds:", directIds);
  console.log("[group] sourceRecordId:", sourceRecordId);

  const { parentDataTypeName, parentDataTypeId } = getSourceBaseInfo(source, groupEl);

  const relatedMeta = await getRelatedDataTypeMetaFromField(
    field,
    parentDataTypeName,
    parentDataTypeId
  );

  console.log("[group/source] related meta:", relatedMeta);
  console.log("[group] relatedMeta:", relatedMeta);
groupEl.dataset.itemDataType = relatedMeta.name || "";
groupEl.dataset.itemDataTypeId = relatedMeta.id || "";

console.log("[group] itemDataType:", groupEl.dataset.itemDataType);
console.log("[group] itemDataTypeId:", groupEl.dataset.itemDataTypeId);

  if (!relatedMeta?.name) return [];

  try {
    if (!currentUser?.id) return [];

    const rows = await fetchRowsForDynamicReference(
      relatedMeta.name,
      relatedMeta.id || ""
    );

    console.log("[group/source] all rows:", rows);
    console.log("[group] fetched rows:", rows);

    if (directIds.length) {
      const matchedById = rows.filter((row, index) => {
        const rowId = String(getRecordId(row, index));
        return directIds.includes(rowId);
      });
      if (matchedById.length) return matchedById;
    }

    if (sourceRecordId) {
      const reverseMatched = rows.filter((row) =>
        rowHasReferenceToId(row, sourceRecordId)
      );
      if (reverseMatched.length) return reverseMatched;
    }

    if (directIds.length) {
      const matchedByRelationship = rows.filter((row) =>
        recordMatchesByIds(row, directIds)
      );
      if (matchedByRelationship.length) return matchedByRelationship;
    }

    const selectedPageId = getSelectedPageId();
    const fallback = selectedPageId
      ? rows.filter((row) => recordBelongsToParent(row, selectedPageId))
      : [];

    return fallback;
  } catch (err) {
    console.error("[group] failed to load related records", err);
    return [];
  }
}

async function getSelectedRecordFromGroup(groupEl) {
  if (!groupEl) return null;

  const nestedSelectedId = groupEl.dataset.nestedSelectedItemId || "";
  const selectedId = groupEl.dataset.selectedItemId || "";

  // ✅ if the group has a nested selected item (like a Suitie), return that first
  if (nestedSelectedId) {
    await populateGroupNestedSelectedItemOptions(groupEl);

    const nestedOptions = [...groupNestedSelectedItemEl.options];
    const hasMatch = nestedOptions.some(
      (opt) => String(opt.value) === String(nestedSelectedId)
    );

    if (hasMatch) {
      const relatedMetaName = groupEl.dataset.finalDataType || "";
      const relatedMetaId = groupEl.dataset.finalDataTypeId || "";

      if (relatedMetaName) {
        const rows = await fetchRowsForDynamicReference(
          relatedMetaName,
          relatedMetaId || ""
        );

        const nestedRecord =
          rows.find((row, index) => {
            return String(getRecordId(row, index)) === String(nestedSelectedId);
          }) || null;

        if (nestedRecord) return nestedRecord;
      }
    }
  }

  // fallback to first-level selected item (like Suite)
  if (!selectedId) return null;

  const list = await getDynamicRecordList(groupEl);
  if (!Array.isArray(list)) return null;

  return (
    list.find((entry, index) => {
      return String(getRecordId(entry, index)) === String(selectedId);
    }) || null
  );
}

async function populateGroupItemFieldOptions(item = selectedItem) {
  if (!groupItemFieldEl || !item) return;

const dataTypeName =
  item.dataset.finalDataType ||
  item.dataset.itemDataType ||
  "";

const dataTypeId =
  item.dataset.finalDataTypeId ||
  item.dataset.itemDataTypeId ||
  "";

const currentValue = item.dataset.itemField || "";

groupItemFieldEl.innerHTML = `<option value="">Select item field</option>`;

if (!dataTypeName && !dataTypeId) return;

const fields = await getFieldsForDataType(dataTypeName, dataTypeId);

const seen = new Set();

fields.forEach((field) => {
  const fieldName =
    field?.name ||
    field?.fieldName ||
    field?.label ||
    "";

  const key = String(fieldName).trim().toLowerCase();
  if (!fieldName) return;
  if (seen.has(key)) return;

  seen.add(key);

  const option = document.createElement("option");
  option.value = fieldName;
  option.textContent = fieldName;
  groupItemFieldEl.appendChild(option);
});

  if ([...groupItemFieldEl.options].some((o) => o.value === currentValue)) {
    groupItemFieldEl.value = currentValue;
  }
}
async function populateGroupNestedFieldOptions(item = selectedItem) {
  if (!groupNestedFieldEl || !item) return;

  const dataTypeName = item.dataset.itemDataType || "";
  const dataTypeId = item.dataset.itemDataTypeId || "";
  const currentValue = item.dataset.nestedField || "";

  groupNestedFieldEl.innerHTML = `<option value="">Select nested field</option>`;

    console.log("[nested] item.dataset.itemDataType:", dataTypeName);
  console.log("[nested] item.dataset.itemDataTypeId:", dataTypeId);
  console.log("[nested] current selected suite id:", item.dataset.selectedItemId);

  if (!dataTypeName && !dataTypeId) return;

  const fields = await getFieldsForDataType(dataTypeName, dataTypeId);
console.log("[nested] fields returned:", fields);

  console.log("[group/nested-fields] dataTypeName:", dataTypeName);
  console.log("[group/nested-fields] dataTypeId:", dataTypeId);
  console.log("[group/nested-fields] fields:", fields);

  const seen = new Set();

  fields.forEach((field) => {
    const fieldName =
      field?.name ||
      field?.fieldName ||
      field?.label ||
      "";

    const fieldType =
      field?.type ||
      field?.fieldType ||
      field?.kind ||
      "";

    const normalizedType = String(fieldType).trim().toLowerCase();

    if (!fieldName) return;
    if (!normalizedType.includes("reference")) return;

    const key = String(fieldName).trim().toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);

    const option = document.createElement("option");
    option.value = fieldName;
    option.textContent = fieldName;
    groupNestedFieldEl.appendChild(option);
  });

  if ([...groupNestedFieldEl.options].some((o) => o.value === currentValue)) {
    groupNestedFieldEl.value = currentValue;
  }
}

async function populateGroupNestedSelectedItemOptions(item = selectedItem) {
  if (!groupNestedSelectedItemEl || !item) return;

  const selectedId = item.dataset.selectedItemId || "";
  const nestedField = item.dataset.nestedField || "";

  groupNestedSelectedItemEl.innerHTML = `<option value="">Select nested item</option>`;

  if (!selectedId) return;

  // get first-level records (example: suites)
  const list = await getGroupSourceList(item);

  const selectedRecord = list.find((entry, index) => {
    const value =
      entry?._id ||
      entry?.id ||
      entry?.values?._id ||
      entry?.values?.id ||
      String(index);

    return String(value) === String(selectedId);
  });

  console.log("[group/nested-items] selectedId:", selectedId);
  console.log("[group/nested-items] nestedField:", nestedField);
  console.log("[group/nested-items] selectedRecord:", selectedRecord);

  if (!selectedRecord) return;

  const relatedMeta = await getRelatedDataTypeMetaFromField(
    nestedField,
    item.dataset.itemDataType || "",
    item.dataset.itemDataTypeId || ""
  );

  console.log("[group/nested-items] relatedMeta:", relatedMeta);

  if (!relatedMeta?.name) return;

  const allRows = await fetchRowsForDynamicReference(
    relatedMeta.name,
    relatedMeta.id || ""
  );

  const rawValue = getFieldValueFromRecord(selectedRecord, nestedField);
  let ids = extractRefIds(rawValue);

  console.log("[group/nested-items] rawValue:", rawValue);
  console.log("[group/nested-items] direct ids:", ids);
  console.log("[group/nested-items] allRows:", allRows);

  // If Suite does not directly store Suitie(s), fall back to reverse lookup:
  // find all User records whose Suite field points to this selected suite
if (!ids.length && nestedField === "Suitie(s)") {
  const selectedSuiteId = String(getRecordId(selectedRecord));

  console.log("[nested] running direct Suite match fallback");

  ids = allRows
    .filter((row) => {
      const suiteVal =
        row?.values?.Suite ||
        row?.Suite ||
        row?.values?.suite;

      return String(suiteVal) === selectedSuiteId;
    })
    .map((row, index) => String(getRecordId(row, index)));

  console.log("[nested] fallback ids:", ids);
}

  const matchedRows = allRows.filter((row, index) => {
    const rowId = String(getRecordId(row, index));
    return ids.includes(rowId);
  });

  console.log("[group/nested-items] matchedRows:", matchedRows);

  matchedRows.forEach((entry, index) => {
    const value =
      entry?._id ||
      entry?.id ||
      entry?.values?._id ||
      entry?.values?.id ||
      String(index);

    const option = document.createElement("option");
    option.value = String(value);
    option.textContent = getRecordLabel(entry, index);
    groupNestedSelectedItemEl.appendChild(option);
  });

  const currentValue = item.dataset.nestedSelectedItemId || "";
  if ([...groupNestedSelectedItemEl.options].some((o) => o.value === currentValue)) {
    groupNestedSelectedItemEl.value = currentValue;
  }

  item.dataset.finalDataType = relatedMeta.name || "";
  item.dataset.finalDataTypeId = relatedMeta.id || "";

  console.log("[group/nested-items] finalDataType:", item.dataset.finalDataType);
  console.log("[group/nested-items] finalDataTypeId:", item.dataset.finalDataTypeId);
}

function recordBelongsToParent(row, parentId) {
  const v = row?.values || row || {};

  const refs = [
    v["Location"],
    v["Business"],
    v["Course"],
    v.locationId,
    v.businessId,
    v.courseId,
    v.parentId,
  ];

  return refs.some((ref) => {
    if (!ref) return false;

    // array ref like Location: [id]
    if (Array.isArray(ref)) {
      return ref.some((item) => {
        let value = item;
        if (typeof value === "object") {
          value = value._id || value.id || value.value || "";
        }
        return String(value).trim() === String(parentId).trim();
      });
    }

    // object ref
    if (typeof ref === "object") {
      ref = ref._id || ref.id || ref.value || "";
    }

    return String(ref).trim() === String(parentId).trim();
  });
}

function getRecordLabel(entry, index = 0) {
  const v = entry?.values || entry || {};

  const first = v["First Name"] || "";
  const last = v["Last Name"] || "";
  const fullName = `${first} ${last}`.trim();

  return (
    fullName ||
    v["Suite Name"] ||
    v["Business Name"] ||
    v["Service Name"] ||
    v["Category Name"] ||
    v["Calendar Name"] ||
    v["Lesson Name"] ||
    v["Module Name"] ||
    v["Name"] ||
    v["Title"] ||
    entry?.name ||
    entry?.title ||
    `Item ${index + 1}`
  );
}

function getMainDataTypeForPageType(pageType) {
  if (pageType === "suite") return "Location";
  if (pageType === "course") return "Course";
  if (pageType === "booking") return "Booking";
  return "";
}


function populateSectionDataTypeOption() {
  if (!sectionDynamicDataTypeEl) return;

  const pageType = window.TPL_PAGE_TYPE || "booking";
  const dataType = getMainDataTypeForPageType(pageType);

  sectionDynamicDataTypeEl.innerHTML = "";

  const option = document.createElement("option");
  option.value = dataType;
  option.textContent = dataType || "Current page datatype";
  sectionDynamicDataTypeEl.appendChild(option);
}

window.populateSectionDataTypeOption = populateSectionDataTypeOption;







async function getFieldsForDataType(dataTypeName, dataTypeId = "") {
  const cleanName = String(dataTypeName || "").trim();
  const cleanId = String(dataTypeId || "").trim();
  const cacheKey = `${cleanName}__${cleanId}`;

  if (!cleanName && !cleanId) return [];

  if (DATA_TYPE_FIELDS_CACHE[cacheKey]) {
    return DATA_TYPE_FIELDS_CACHE[cacheKey];
  }

  try {
    const data = await fetchJSON(
      `/api/fields?limit=500&ts=${Date.now()}`,
      {
        method: "GET",
        cache: "no-store",
      }
    );

    const rows = Array.isArray(data)
      ? data
      : data.items || data.records || data.fields || [];

    const filtered = rows.filter((field) => {
      const rowDataTypeId = String(field?.dataTypeId || "").trim();

      // ✅ prefer id match
      if (cleanId) {
        return rowDataTypeId === cleanId;
      }

      // fallback if name-based info exists
      const dtName =
        field?.dataTypeName ||
        field?.dataType?.name ||
        field?.parentDataTypeName ||
        field?.recordTypeName ||
        "";

      return String(dtName).trim().toLowerCase() === cleanName.toLowerCase();
    });

    console.log("[fields] requested datatype name:", cleanName);
    console.log("[fields] requested datatype id:", cleanId);
    console.log("[fields] raw rows:", rows);
    console.log("[fields] first raw row:", rows[0]);
    console.log("[fields] filtered rows:", filtered);

    DATA_TYPE_FIELDS_CACHE[cacheKey] = filtered;
    return filtered;
  } catch (err) {
    console.error("[builder] failed to load fields for", cleanName, cleanId, err);
    return [];
  }
}




////////////////////////////////////////////////////////////


  const grid = document.getElementById("dropAreaInner");
  if (!grid) return;

  //Bar for each element
  // ✅ ONE floating bar that always sits above everything
const floatingBar = document.createElement("div");
floatingBar.className = "da-floatingBar";

let selectedItem = null;
let active = null;
let resizeActive = null;
let imgPan = null;



                                  ////////////////
                                  //Template Loader
                                  ////////
//Allow elements to move with groups and sections 
function applySavedItemToEl(el, item) {
  if (!el || !item) return;

  el.dataset.id = item.id || "";
  el.dataset.parent = item.parent || "";
  el.dataset.type = item.type || item?.data?.type || "";

  el.style.left = `${item.x || 0}px`;
  el.style.top = `${item.y || 0}px`;
  el.style.width = `${item.w || 0}px`;
  el.style.height = `${item.h || 0}px`;
  el.style.zIndex = String(item.z || 1);

  const data = item.data || {};
  Object.entries(data).forEach(([key, value]) => {
    if (value == null) return;
    el.dataset[key] = String(value);
  });

  // keep the real top-level type from item.type
  el.dataset.type = item.type || el.dataset.type || "";
}

//Choose what type of template to load 
const TEMPLATE_STARTERS = {
                       ////////////////////////////
                     //Default
                     ////////////////////////////













template1: {
  currentView: "default",
  views: {
    default: {
      name: "Default View",
     desktop: {
  items: [
    {
      type: "header",
      id: "header_t1",
      parent: "",
      x: 0,
      y: 0,
      w: 1200,
      h: 90,
      z: 9999,
      data: {
        type: "header",
        name: "Header",
        bg: "#ffffff",
        bgOn: "1",
        locked: "1"
      }
    },
    {
      type: "section",
      id: "hero_image_wrap_t1",
      parent: "",
      x: 40,
      y: 120,
      w: 680,
      h: 420,
      z: 1,
      data: {
        type: "section",
        name: "Hero Image Wrap",
        bg: "#dddddd",
        bgOn: "1",
        borderOn: "0",
        radius: "24"
      }
    },
    {
      type: "image",
      id: "hero_image_t1",
      parent: "hero_image_wrap_t1",
      x: 40,
      y: 120,
      w: 680,
      h: 420,
      z: 2,
      data: {
        type: "image",
        name: "Hero Image",
        dynamicMode: "dynamic",
        dynamicSource: "page",
        dynamicField: "Location Photo",
        fit: "cover",
        radius: "24"
      }
    },
    {
      type: "section",
      id: "hero_text_card_t1",
      parent: "",
      x: 750,
      y: 120,
      w: 410,
      h: 420,
      z: 1,
      data: {
        type: "section",
        name: "Hero Text Card",
        bg: "#ffffff",
        bgOn: "1",
        borderOn: "0",
        radius: "24"
      }
    },
    {
      type: "text",
      id: "hero_eyebrow_t1",
      parent: "hero_text_card_t1",
      x: 780,
      y: 160,
      w: 220,
      h: 28,
      z: 2,
      data: {
        type: "text",
        name: "Hero Eyebrow",
        text: "Suite Location",
        fontSize: "14",
        color: "#efb37c",
        bold: "0",
        align: "left"
      }
    },
    {
      type: "text",
      id: "hero_title_t1",
      parent: "hero_text_card_t1",
      x: 780,
      y: 205,
      w: 320,
      h: 80,
      z: 2,
      data: {
        type: "text",
        name: "Location Name",
        text: "Location",
        fontSize: "48",
        color: "#111111",
        bold: "1",
        align: "left"
      }
    },
    {
      type: "text",
      id: "hero_about_t1",
      parent: "hero_text_card_t1",
      x: 780,
      y: 310,
      w: 320,
      h: 120,
      z: 2,
      data: {
        type: "text",
        name: "About Text",
        text: "Explore available suites at this location.",
        fontSize: "16",
        color: "#555555",
        bold: "0",
        align: "left"
      }
    },
    {//Available Suites Section
      type: "text",
      id: "available_suites_heading_t1",
      parent: "",
      x: 40,
      y: 590,
      w: 320,
      h: 40,
      z: 1,
      data: {
        type: "text",
        name: "Available Suites Heading",
        text: "Available Suites",
        fontSize: "30",
        color: "#111111",
        bold: "1",
        align: "left"
      }
    },
    {
      type: "group",
      id: "suite_cards_group_t1",
      parent: "",
      x: 40,
      y: 650,
      w: 1120,
      h: 320,
      z: 1,
      data: {
        type: "group",
        name: "Suite Cards Group",
        bg: "transparent",
        bgOn: "0",
        borderOn: "0",
        radius: "0",
        dynamicMode: "dynamic",
        dynamicSource: "page",
        bindMode: "list",
        dynamicField: "Suites"
      }
    },
    {
      type: "section",
      id: "suite_card_placeholder_t1",
      parent: "",
      x: 40,
      y: 650,
      w: 1120,
      h: 420,
      z: 2,
      data: {
        type: "section",
        name: "Suite Card Placeholder",
        bg: "#ffffff",
        bgOn: "1",
        borderOn: "0",
        radius: "22"
      }
    },

    {
  type: "image",
  id: "suite_card_placeholder_image_t1",
  parent: "suite_card_placeholder_t1",
  x: 40,
  y: 650,
  w: 1120,
  h: 280,
  z: 3,
  data: {
    type: "image",
    name: "Suite Placeholder Image",
    fit: "cover",
    radius: "22"
  }
},

{
  type: "text",
  id: "suite_card_placeholder_title_t1",
  parent: "suite_card_placeholder_t1",
  x: 70,
  y: 955,
  w: 260,
  h: 30,
  z: 3,
  data: {
    type: "text",
    name: "Suite Placeholder Title",
    text: "Suite name goes here",
    fontSize: "22",
    color: "#111111",
    bold: "1",
    align: "left"
  }
},
{
  type: "text",
  id: "suite_card_placeholder_date_t1",
  parent: "suite_card_placeholder_t1",
  x: 70,
  y: 995,
  w: 260,
  h: 24,
  z: 3,
  data: {
    type: "text",
    name: "Suite Placeholder Date",
    text: "Available date goes here",
    fontSize: "14",
    color: "#555555",
    bold: "0",
    align: "left"
  }
},
{
  type: "text",
  id: "suite_card_placeholder_rate_t1",
  parent: "suite_card_placeholder_t1",
  x: 70,
  y: 1030,
  w: 220,
  h: 24,
  z: 3,
  data: {
    type: "text",
    name: "Suite Placeholder Rate",
    text: "$23 / weekly",
    fontSize: "16",
    color: "#111111",
    bold: "1",
    align: "left"
  }
},
  ]
},


      //Template 1 Mobile
      mobile: {
        items: [
          {
            type: "header",
            id: "header_t1_mobile",
            parent: "",
            x: 0,
            y: 0,
            w: 390,
            h: 90,
            z: 9999,
            data: {
              type: "header",
              name: "Header",
              bg: "#ffffff",
              bgOn: "1",
              locked: "1"
            }
          },
          {
            type: "section",
            id: "hero_image_wrap_t1_mobile",
            parent: "",
            x: 0,
            y: 100,
            w: 390,
            h: 280,
            z: 1,
            data: {
              type: "section",
              name: "Hero Image Wrap",
              bg: "#dddddd",
              bgOn: "1",
              borderOn: "0",
              radius: "24"
            }
          },
          {
            type: "image",
            id: "hero_image_t1_mobile",
            parent: "hero_image_wrap_t1_mobile",
            x: 0,
            y: 100,
            w: 390,
            h: 280,
            z: 2,
            data: {
              type: "image",
              name: "Hero Image",
              dynamicMode: "dynamic",
              dynamicSource: "page",
              dynamicField: "Location Photo",
              fit: "cover",
              radius: "24"
            }
          },
          {
            type: "section",
            id: "hero_text_card_t1_mobile",
            parent: "",
            x: 0,
            y: 400,
            w: 390,
            h: 260,
            z: 1,
            data: {
              type: "section",
              name: "Hero Text Card",
              bg: "#ffffff",
              bgOn: "1",
              borderOn: "0",
              radius: "24"
            }
          },
          {
            type: "text",
            id: "available_suites_heading_t1_mobile",
            parent: "",
            x: 20,
            y: 700,
            w: 260,
            h: 36,
            z: 1,
            data: {
              type: "text",
              name: "Available Suites Heading",
              text: "Available Suites",
              fontSize: "26",
              color: "#111111",
              bold: "1",
              align: "left"
            }
          },
          {
            type: "group",
            id: "suite_cards_group_t1_mobile",
            parent: "",
            x: 0,
            y: 760,
            w: 390,
            h: 700,
            z: 1,
            data: {
              type: "group",
              name: "Suite Cards Group",
              bg: "transparent",
              bgOn: "0",
              borderOn: "0",
              radius: "0",
              dynamicMode: "dynamic",
              dynamicSource: "page",
              bindMode: "list",
              dynamicField: "Suites"
            }
          }
        ]
      }
    }
  }
},

                     ////////////////////////////
                     //Template 2
                     ////////////////////////////
template2: {
  currentView: "default",
  views: {
    default: {
      name: "Default View",
      desktop: {
        items: [
          {
            type: "header",
            id: "header_t2",
            parent: "",
            x: 0,
            y: 0,
            w: 1400,
            h: 90,
            z: 9999,
            data: {
              type: "header",
              name: "Header",
              bg: "#ffffff",
              bgOn: "1",
              locked: "1"
            }
          },

          {
            type: "section",
            id: "hero_wrap_t2",
            parent: "",
            x: 30,
            y: 120,
            w: 1320,
            h: 680,
            z: 1,
            data: {
              type: "section",
              name: "Hero Wrap",
              bg: "#efe7dc",
              bgOn: "1",
              borderOn: "0",
              radius: "36"
            }
          },
          {
            type: "image",
            id: "hero_image_t2",
            parent: "hero_wrap_t2",
            x: 30,
            y: 120,
            w: 1320,
            h: 680,
            z: 2,
            data: {
              type: "image",
              name: "Hero Image",
              dynamicMode: "dynamic",
              dynamicSource: "page",
              dynamicField: "Location Photo",
              fit: "cover",
              radius: "36"
            }
          },
          {
            type: "text",
            id: "hero_suite_count_t2",
            parent: "hero_wrap_t2",
            x: 1140,
            y: 160,
            w: 160,
            h: 30,
            z: 3,
            data: {
              type: "text",
              name: "Hero Suite Count",
              text: "3 suites",
              fontSize: "14",
              color: "#ffffff",
              bold: "0",
              align: "right"
            }
          },
          {
            type: "text",
            id: "hero_title_t2",
            parent: "hero_wrap_t2",
            x: 90,
            y: 560,
            w: 700,
            h: 90,
            z: 3,
            data: {
              type: "text",
              name: "Hero Title",
              text: "Location",
              fontSize: "78",
              color: "#ffffff",
              bold: "1",
              align: "left"
            }
          },
          {
            type: "text",
            id: "hero_about_t2",
            parent: "hero_wrap_t2",
            x: 90,
            y: 660,
            w: 640,
            h: 80,
            z: 3,
            data: {
              type: "text",
              name: "Hero About",
              text: "Discover a refined suite experience designed for professionals who want a polished, premium environment.",
              fontSize: "19",
              color: "#ffffff",
              bold: "0",
              align: "left"
            }
          },

          {
            type: "section",
            id: "featured_suite_image_wrap_t2",
            parent: "",
            x: 30,
            y: 840,
            w: 680,
            h: 520,
            z: 1,
            data: {
              type: "section",
              name: "Featured Suite Image Wrap",
              bg: "#efe7dc",
              bgOn: "1",
              borderOn: "0",
              radius: "30"
            }
          },
          {
            type: "image",
            id: "featured_suite_image_t2",
            parent: "featured_suite_image_wrap_t2",
            x: 30,
            y: 840,
            w: 680,
            h: 520,
            z: 2,
            data: {
              type: "image",
              name: "Featured Suite Image",
              fit: "cover",
              radius: "30"
            }
          },

          {
            type: "section",
            id: "featured_suite_card_t2",
            parent: "",
            x: 740,
            y: 840,
            w: 610,
            h: 520,
            z: 1,
            data: {
              type: "section",
              name: "Featured Suite Card",
              bg: "#ffffff",
              bgOn: "1",
              borderOn: "1",
              borderWidth: "1",
              borderStyle: "solid",
              borderColor: "rgba(0,0,0,0.08)",
              radius: "30"
            }
          },
          {
            type: "text",
            id: "featured_suite_label_t2",
            parent: "featured_suite_card_t2",
            x: 780,
            y: 890,
            w: 220,
            h: 24,
            z: 2,
            data: {
              type: "text",
              name: "Featured Suite Label",
              text: "Featured Suite",
              fontSize: "12",
              color: "#b88a58",
              bold: "0",
              align: "left"
            }
          },
          {
            type: "text",
            id: "featured_suite_title_t2",
            parent: "featured_suite_card_t2",
            x: 780,
            y: 940,
            w: 360,
            h: 70,
            z: 2,
            data: {
              type: "text",
              name: "Featured Suite Title",
              text: "Suite Name",
              fontSize: "52",
              color: "#171717",
              bold: "1",
              align: "left"
            }
          },
          {
            type: "text",
            id: "featured_suite_date_t2",
            parent: "featured_suite_card_t2",
            x: 780,
            y: 1030,
            w: 260,
            h: 24,
            z: 2,
            data: {
              type: "text",
              name: "Featured Suite Date",
              text: "Available Jan 5, 2026",
              fontSize: "16",
              color: "#6b6258",
              bold: "0",
              align: "left"
            }
          },
          {
            type: "text",
            id: "featured_suite_rate_t2",
            parent: "featured_suite_card_t2",
            x: 780,
            y: 1080,
            w: 220,
            h: 34,
            z: 2,
            data: {
              type: "text",
              name: "Featured Suite Rate",
              text: "$23 / weekly",
              fontSize: "30",
              color: "#171717",
              bold: "1",
              align: "left"
            }
          },
          {
            type: "button",
            id: "featured_suite_btn_t2",
            parent: "featured_suite_card_t2",
            x: 780,
            y: 1220,
            w: 170,
            h: 50,
            z: 2,
            data: {
              type: "button",
              name: "Featured Suite Button",
              label: "View Suite",
              btnBg: "#171717",
              btnTextColor: "#ffffff",
              borderWidth: "0",
              borderColor: "#171717",
              borderStyle: "solid",
              radius: "999"
            }
          },

             
{
  type: "section",
  id: "more_suites_wrap_t2",
  parent: "",
  x: 30,
  y: 1390,
  w: 1320,
  h: 380,
  z: 1,
  data: {
    type: "section",
    name: "More Suites Wrap",
    bg: "#ffffff",
    bgOn: "1",
    borderOn: "1",
    borderWidth: "1",
    borderStyle: "solid",
    borderColor: "rgba(0,0,0,0.08)",
    radius: "28"
  }
},
{
  type: "text",
  id: "more_suites_heading_t2",
  parent: "more_suites_wrap_t2",
  x: 70,
  y: 1415,
  w: 420,
  h: 40,
  z: 2,
  data: {
    type: "text",
    name: "More Suites Heading",
    text: "More Available Suites",
    fontSize: "32",
    color: "#171717",
    bold: "1",
    align: "left"
  }
},
{
  type: "text",
  id: "more_suites_label_t2",
  parent: "more_suites_wrap_t2",
  x: 1080,
  y: 1420,
  w: 220,
  h: 24,
  z: 2,
  data: {
    type: "text",
    name: "More Suites Label",
   
    fontSize: "13",
    color: "#6b6258",
    bold: "0",
    align: "right"
  }
},
{
  type: "group",
  id: "more_suites_group_t2",
  parent: "",
  x: 30,
  y: 1500,
  w: 1320,
  h: 500,
  z: 1,
  data: {
    type: "group",
    name: "More Suites Group",
    bg: "transparent",
    bgOn: "0",
    borderOn: "0",
    radius: "0",
    dynamicMode: "dynamic",
    dynamicSource: "page",
    bindMode: "list",
    dynamicField: "Suites"
  }
}
        ]
      },
                                           //Template 2 Mobile
    //Template 2 Mobile
mobile: {
  items: [
    {
      type: "header",
      id: "header_t2_mobile",
      parent: "",
      x: 0,
      y: 0,
      w: 390,
      h: 90,
      z: 9999,
      data: {
        type: "header",
        name: "Header",
        bg: "#ffffff",
        bgOn: "1",
        locked: "1"
      }
    },
    {
      type: "section",
      id: "hero_wrap_t2_mobile",
      parent: "",
      x: 10,
      y: 100,
      w: 370,
      h: 420,
      z: 1,
      data: {
        type: "section",
        name: "Hero Wrap",
        bg: "#efe7dc",
        bgOn: "1",
        borderOn: "0",
        radius: "28"
      }
    },
    {
      type: "image",
      id: "hero_image_t2_mobile",
      parent: "hero_wrap_t2_mobile",
      x: 10,
      y: 100,
      w: 370,
      h: 420,
      z: 2,
      data: {
        type: "image",
        name: "Hero Image",
        dynamicMode: "dynamic",
        dynamicSource: "page",
        dynamicField: "Location Photo",
        fit: "cover",
        radius: "28"
      }
    },
    {
      type: "text",
      id: "hero_title_t2_mobile",
      parent: "hero_wrap_t2_mobile",
      x: 30,
      y: 380,
      w: 300,
      h: 60,
      z: 3,
      data: {
        type: "text",
        name: "Hero Title",
        text: "Location",
        fontSize: "42",
        color: "#ffffff",
        bold: "1",
        align: "left"
      }
    },
    {
      type: "text",
      id: "hero_about_t2_mobile",
      parent: "hero_wrap_t2_mobile",
      x: 30,
      y: 450,
      w: 300,
      h: 60,
      z: 3,
      data: {
        type: "text",
        name: "Hero About",
        text: "Refined suite experience.",
        fontSize: "16",
        color: "#ffffff",
        bold: "0",
        align: "left"
      }
    },
    {
      type: "section",
      id: "featured_suite_card_t2_mobile",
      parent: "",
      x: 10,
      y: 560,
      w: 370,
      h: 380,
      z: 1,
      data: {
        type: "section",
        name: "Featured Suite Card",
        bg: "#ffffff",
        bgOn: "1",
        borderOn: "1",
        borderWidth: "1",
        borderStyle: "solid",
        borderColor: "rgba(0,0,0,0.08)",
        radius: "28"
      }
    },
    {
      type: "text",
      id: "featured_suite_label_t2_mobile",
      parent: "featured_suite_card_t2_mobile",
      x: 30,
      y: 600,
      w: 180,
      h: 24,
      z: 2,
      data: {
        type: "text",
        name: "Featured Suite Label",
        text: "Featured Suite",
        fontSize: "12",
        color: "#b88a58",
        bold: "0",
        align: "left"
      }
    },
    {
      type: "text",
      id: "featured_suite_title_t2_mobile",
      parent: "featured_suite_card_t2_mobile",
      x: 30,
      y: 640,
      w: 260,
      h: 60,
      z: 2,
      data: {
        type: "text",
        name: "Featured Suite Title",
        text: "Suite Name",
        fontSize: "34",
        color: "#171717",
        bold: "1",
        align: "left"
      }
    },
    {
      type: "text",
      id: "featured_suite_date_t2_mobile",
      parent: "featured_suite_card_t2_mobile",
      x: 30,
      y: 720,
      w: 220,
      h: 24,
      z: 2,
      data: {
        type: "text",
        name: "Featured Suite Date",
        text: "Available Jan 5, 2026",
        fontSize: "15",
        color: "#6b6258",
        bold: "0",
        align: "left"
      }
    },
    {
      type: "text",
      id: "featured_suite_rate_t2_mobile",
      parent: "featured_suite_card_t2_mobile",
      x: 30,
      y: 760,
      w: 220,
      h: 34,
      z: 2,
      data: {
        type: "text",
        name: "Featured Suite Rate",
        text: "$23 / weekly",
        fontSize: "26",
        color: "#171717",
        bold: "1",
        align: "left"
      }
    },
    {
      type: "button",
      id: "featured_suite_btn_t2_mobile",
      parent: "featured_suite_card_t2_mobile",
      x: 30,
      y: 840,
      w: 150,
      h: 48,
      z: 2,
      data: {
        type: "button",
        name: "Featured Suite Button",
        label: "View Suite",
        btnBg: "#171717",
        btnTextColor: "#ffffff",
        borderWidth: "0",
        borderColor: "#171717",
        borderStyle: "solid",
        radius: "999"
      }
    },
    //More Available Suites Card
    {
  type: "section",
  id: "more_suites_wrap_t2_mobile",
  parent: "",
  x: 10,
  y: 960,
  w: 370,
  h: 380,
  z: 1,
  data: {
    type: "section",
    name: "More Suites Wrap",
    bg: "#ffffff",
    bgOn: "1",
    borderOn: "1",
    borderWidth: "1",
    borderStyle: "solid",
    borderColor: "rgba(0,0,0,0.08)",
    radius: "28"
  }
},
   {
  type: "text",
  id: "more_suites_heading_t2_mobile",
  parent: "more_suites_wrap_t2_mobile",
  x: 30,
  y: 995,
  w: 260,
  h: 60,
  z: 2,
  data: {
    type: "text",
    name: "More Suites Heading",
    text: "More Available Suites",
    fontSize: "26",
    color: "#171717",
    bold: "1",
    align: "left"
  }
},
    {
      type: "text",
      id: "more_suites_label_t2_mobile",
      parent: "",
      x: 20,
      y: 1040,
      w: 180,
      h: 22,
      z: 1,
      data: {
        type: "text",
        name: "More Suites Label",
       
        fontSize: "12",
        color: "#6b6258",
        bold: "0",
        align: "left"
      }
    },
    {
      type: "group",
      id: "more_suites_group_t2_mobile",
      parent: "",
      x: 10,
      y: 1080,
      w: 370,
      h: 900,
      z: 1,
      data: {
        type: "group",
        name: "More Suites Group",
        bg: "transparent",
        bgOn: "0",
        borderOn: "0",
        radius: "0",
        dynamicMode: "dynamic",
        dynamicSource: "page",
        bindMode: "list",
        dynamicField: "Suites"
      }
    }
  ]
}

    }
  }
},

  custom: {
    currentView: "default",
    views: {
      default: {
        name: "Default View",
        desktop: { items: [] },
        mobile: { items: [] }
      }
    }
  }
};

function cloneTemplateStarter(templateKey) {
  const starter = TEMPLATE_STARTERS[templateKey] || TEMPLATE_STARTERS.default;
  return JSON.parse(JSON.stringify(starter));
}


function getTemplateJsonFieldName(templateKey) {
  if (templateKey === "default") return "Default Template JSON";
  if (templateKey === "template1") return "Template 1 JSON";
  if (templateKey === "template2") return "Template 2 JSON";
  return "Custom Page JSON";
}



//Adding Templates 
const tplTemplateSelect = document.getElementById("tpl-template-select");

tplTemplateSelect?.addEventListener("change", async function () {
  const selectedTemplate = this.value || "default";

  console.log("[builder] template dropdown changed:", selectedTemplate);

  window.TPL_SELECTED_TEMPLATE = selectedTemplate;

  const pageRecordEl = document.getElementById("tpl-page-record");
  const hasPageSelected = !!pageRecordEl?.value;

  if (hasPageSelected) {
    await loadTemplateFromDatabase();
    return;
  }

  const starter = cloneTemplateStarter(selectedTemplate);

  pageViews = starter.views || {
    default: {
      name: "Default View",
      desktop: { items: [] },
      mobile: { items: [] }
    }
  };

  currentViewKey = starter.currentView || "default";

  if (!pageViews[currentViewKey]) {
    currentViewKey = Object.keys(pageViews)[0] || "default";
  }

  rebuildViewDropdown();
  await loadViewIntoCanvas(currentViewKey);
});


//Create template loader


tplTemplateSelect?.addEventListener("change", async function () {
 const selectedTemplate = this.value || "default";

  console.log("[builder] template dropdown changed:", selectedTemplate);

  window.TPL_SELECTED_TEMPLATE = selectedTemplate;

  const pageRecordEl = document.getElementById("tpl-page-record");
  const hasPageSelected = !!pageRecordEl?.value;

  if (hasPageSelected) {
    await loadTemplateFromDatabase();
    return;
  }

  const starter = cloneTemplateStarter(selectedTemplate);

  pageViews = starter.views || {
    default: {
      name: "Default View",
      desktop: { items: [] },
      mobile: { items: [] }
    }
  };

  currentViewKey = starter.currentView || "default";

  if (!pageViews[currentViewKey]) {
    currentViewKey = Object.keys(pageViews)[0] || "default";
  }

  rebuildViewDropdown();
  await loadViewIntoCanvas(currentViewKey);
});
                                             // =======================
                                            // STEP 1: DRAGSTART PICKUP
                                             //Do not Change
                                             // =======================
  // ---------------------------
  // DRAG FROM SIDEBAR -> DROPAREA
  // ---------------------------
  document.addEventListener("dragstart", (e) => {
    const item = e.target.closest("[draggable='true'][data-type]");
    if (!item) return;
    dragType = item.getAttribute("data-type");
    e.dataTransfer.effectAllowed = "copy";
    e.dataTransfer.setData("text/plain", dragType);
  });


  document.addEventListener("dragend", () => {
    dragType = null;
  });

  grid.addEventListener("dragover", (e) => {
    if (!dragType) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  });
                                               // =======================
                                            // STEP 2: DropArea
                                             //
                                             // =======================
grid.addEventListener("drop", (e) => {
  e.preventDefault();

  const type = e.dataTransfer.getData("text/plain") || dragType;
  if (!type) return;

const pt = toLocalXY(grid, e.clientX, e.clientY);
let x = Math.round(pt.x);
let y = snapY(Math.round(pt.y));

// ✅ find a section under the cursor (top-most)
const els = document.elementsFromPoint(e.clientX, e.clientY);

const parentContainer = els
  .filter((n) => !n.closest?.(".da-floatingBar"))
  .map((n) => n.closest?.(".da-item"))
  .find((n) => {
    if (!n) return false;
    const t = n.dataset.type;
    return t === "section" || t === "group" || t === "popup";
  }) || null;

const header = grid.querySelector(".da-item.da-header");
const headerBottom = header ? header.offsetHeight : 90;

const parentType = parentContainer?.dataset?.type || "";
const droppingInsideHeader =
  parentContainer?.classList?.contains("da-header") ||
  parentType === "header";

if (!droppingInsideHeader) {
  y = Math.max(y, headerBottom -2);
}





  ////////////////////////////////////////////
//this is where you add the new element
//
  let el = null;
  if (type === "section") el = makeSectionEl({ x, y });
  if (type === "group") el = makeGroupEl({ x, y });
  if (type === "text") el = makeTextEl({ x, y });
  if (type === "button") el = makeButtonEl({ x, y });
  if (type === "image") el = makeImageEl({ x, y });
  if (type === "popup") el = makePopupEl({ x, y });
  if (type === "input") el = makeInputEl({ x, y });
  if (type === "video") el = makeVideoEl({ x, y });
 if (type === "shape") el = makeShapeEl({ x, y, shapeType: "circle", w: 120, h: 120 });
if (type === "background") {
  const header = grid.querySelector(".da-item.da-header");
  const headerBottom = header ? header.offsetHeight : 90;

  el = makeBackgroundEl({
    x: 0,
    y: headerBottom,
    w: grid.clientWidth,
    h: 600
  });

  el.dataset.autoHeight = "1";
  el.style.left = "0px";
  el.style.width = `${grid.clientWidth}px`;
}
if (type === "header") {
  addLockedHeaderAt({ x, y });
  return;
}


if (!el) return;

// ✅ if dropping text on a section, "contain" it
if (
  (type === "text" ||
   type === "button" ||
   type === "image" ||
   type === "input" ||
   type === "section" ||
   type === "group" ||
   type === "popup" ||
   type === "shape") &&
  parentContainer
)
{
  el.dataset.parent = parentContainer.dataset.id;
  el.style.zIndex = String(parseInt(parentContainer.style.zIndex || "1", 10) + 1);
}

grid.appendChild(el);

if (
  el.dataset.type === "section" ||
  el.dataset.type === "shape" ||
  el.dataset.type === "background"
) {
  clampElToCanvasBounds(el);
}

refreshPopupList();
grid.querySelectorAll(".da-item").forEach((x) => x.classList.remove("is-selected"));
el.classList.add("is-selected");
selectedItem = el;
showBarForItem(el);

if (el.dataset.type === "popup") {
  openPopupEditMode(el);
}

grid.querySelector(".tpl-dropArea__label")?.remove();
trimCanvasHeight();
syncAutoBackgrounds();
});



  // ---------------------------
  // DRAG EXISTING SECTIONS (x free, y snaps)
  // ---------------------------
// ---------------------------
// SELECT + DRAG (universal for all .da-item)
// ---------------------------
grid.addEventListener("click", (e) => {
  const item = e.target.closest(".da-item--image");
  if (!item) return;

  if (!window.TPL_PREVIEW) return; // ✅ only preview mode
  e.preventDefault();
  e.stopPropagation();

  const src = (item.dataset.src || "").trim();
  if (!src) return;

  //Button Clicks
grid.addEventListener("click", (e) => {
  const btn = e.target.closest('.da-item[data-type="button"]');
  if (!btn) return;

  if (!window.TPL_PREVIEW) return;

  handleButtonAction(btn);
});

 // previewModal.querySelector("img").src = src;
  //previewModal.classList.add("is-open");
});

grid.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-popup-action='toggle']");
  if (!btn) return;

  const popup = btn.closest(".da-item");
  if (!popup || popup.dataset.type !== "popup") return;

  e.preventDefault();
  e.stopPropagation();

  const next = popup.dataset.popupMinimized !== "1";
  setPopupMinimized(popup, next);

  if (selectedItem === popup) {
    showBarForItem(popup);
  }
});

grid.addEventListener("mousedown", (e) => {
 // ✅ normal click picks the top item, shift-click cycles through stacked items
  // ✅ If the user clicks the floating bar, do NOT unselect/hide it
   if (e.target.closest(".da-resize")) return;
    if (e.target.closest(".da-floatingBar")) return;

      const editingPopup = grid.querySelector('.da-item[data-type="popup"].is-popup-editing');

  // ✅ if a popup is open and user clicked OUTSIDE that popup, close it
  if (editingPopup && !e.target.closest('.da-item[data-type="popup"].is-popup-editing')) {
    closePopupEditMode();
    grid.querySelectorAll(".da-item").forEach((x) => x.classList.remove("is-selected"));
    showBarForItem(null);
    e.preventDefault();
    return;
  }
 
 let item = e.target.closest(".da-item");
 if (item?.dataset?.type === "header") {
  grid.querySelectorAll(".da-item").forEach((x) => x.classList.remove("is-selected"));
  item.classList.add("is-selected");
  selectedItem = item;
window.selectedItem = item;
  showBarForItem(item);
  e.preventDefault();
  return;
}
// ✅ PREVIEW MODE: clicking a real button should NOT drag the canvas item
if (window.TPL_PREVIEW && e.target.closest(".da-btn")) {
  return; // let the button's own click handler open the link
}

// ✅ if click hits overlap, allow selecting the back one with SHIFT
if (e.shiftKey) {
  item = pickAtPoint(e.clientX, e.clientY) || item;
}

  // ✅ empty canvas
  if (!item) {
    closePopupEditMode();
    grid.querySelectorAll(".da-item").forEach((x) => x.classList.remove("is-selected"));
    showBarForItem(null);
    return;
  }

  // ✅ popup click opens popup mode
  if (item.dataset.type === "popup") {
    grid.querySelectorAll(".da-item").forEach((x) => x.classList.remove("is-selected"));
    item.classList.add("is-selected");
    selectedItem = item;
window.selectedItem = item;
    showBarForItem(item);
    openPopupEditMode(item);
    e.preventDefault();
    return;
  }

// ✅ if you clicked a tab inside a group, drag the group instead
// ✅ exact clicked item should drag itself
let dragEl = item;

// if user clicks an image inside a section/group, drag the parent container instead
if (item.dataset.type === "image" && item.dataset.parent) {
  const parentEl = grid.querySelector(`.da-item[data-id="${item.dataset.parent}"]`);

  if (
    parentEl &&
    (
      parentEl.dataset.type === "section" ||
      parentEl.dataset.type === "group" ||
      parentEl.dataset.type === "popup"
    )
  ) {
    dragEl = parentEl;
  }
}


// ✅ CLICKED EMPTY SPACE = UNSELECT
if (!item) {
  closePopupEditMode();
  grid.querySelectorAll(".da-item").forEach((x) => x.classList.remove("is-selected"));
  showBarForItem(null);
  return;
}

// ✅ POPUP: do not drag like normal items
if (item.dataset.type === "popup") {
  grid.querySelectorAll(".da-item").forEach((x) => x.classList.remove("is-selected"));
  item.classList.add("is-selected");
  selectedItem = item;
window.selectedItem = item;
  showBarForItem(item);
  openPopupEditMode(item);
  e.preventDefault();
  return;
}

// ✅ if user clicked inputs/editable text, don't start drag
if (window.TPL_PREVIEW && e.target.closest("input, textarea, [contenteditable='true']")) return;

  // ✅ remember if it was already selected BEFORE we change selection
  const wasSelected = item.classList.contains("is-selected");

  // ✅ SELECT (shows bar)
  grid.querySelectorAll(".da-item").forEach((x) => x.classList.remove("is-selected"));
item.classList.add("is-selected");
showBarForItem(item);

// ✅ AUTO OPEN SIDEBAR WHEN ITEM CLICKED
const root = document.querySelector(".tpl");

if (root?.classList.contains("is-collapsed")) {
  root.classList.remove("is-collapsed");

  const btn = document.getElementById("sidebar-toggle");
  if (btn) {
    btn.textContent = "← Back";
  }

  requestAnimationFrame(() => {
    syncLockedHeaderWidth();

    if (typeof layoutHeaderChildren === "function") {
      layoutHeaderChildren();
    }

    if (typeof mountBarInSidebar === "function") {
      mountBarInSidebar();
    }

    if (typeof showBarForItem === "function") {
      showBarForItem(item);
    }
  });
}
 
  // ✅ RULE:
  // first click selects only. second click/drag actually drags.
// ✅ Sections drag immediately, everything else still needs select-then-drag
// first click = select only for everything
if (!wasSelected) {
  e.preventDefault();
  return;
}

e.preventDefault();
document.body.style.userSelect = "none";

const kids = getChildrenDeep(dragEl);
const hasChildren = kids.length > 0;
const hasParent = !!dragEl.dataset.parent;

const shouldUseCanvasCoords =
  hasParent ||
  hasChildren ||
  dragEl.dataset.type === "group" ||
  dragEl.dataset.type === "popup" ||
  dragEl.dataset.type === "header" ||
  dragEl.dataset.type === "shape";

let startLeft, startTop;

if (shouldUseCanvasCoords) {
  startLeft = parseFloat(dragEl.style.left) || 0;
  startTop = parseFloat(dragEl.style.top) || 0;
} else {
  const rect = dragEl.getBoundingClientRect();
  const gridRect = grid.getBoundingClientRect();

  startLeft = rect.left - gridRect.left + grid.scrollLeft;
  startTop = rect.top - gridRect.top + grid.scrollTop;
}

let childrenStart = null;
if (
  dragEl.dataset.type === "section" ||
  dragEl.dataset.type === "header" ||
  dragEl.dataset.type === "group" ||
  dragEl.dataset.type === "popup" ||
  dragEl.dataset.type === "shape"
) {
  childrenStart = kids.map((k) => ({
    el: k,
    left: parseFloat(k.style.left) || 0,
    top: parseFloat(k.style.top) || 0,
  }));
}

console.log("[drag start about to happen]", {
  id: dragEl?.dataset?.id,
  type: dragEl?.dataset?.type,
  wasSelected,
  startLeft,
  startTop
});

active = {
  el: dragEl,
  startX: e.clientX,
  startY: e.clientY,
  startLeft,
  startTop,
  childrenStart,
  hasStartedDrag: false,
};

dragEl.classList.remove("is-dragging");

});



grid.addEventListener("mousedown", (e) => {
  const item = e.target.closest(".da-item--image");
  if (!item) return;

  // ✅ only pan when holding ALT (otherwise normal drag should work)
  if (!e.altKey) return;

  if (e.target.closest(".da-resize") || e.target.closest(".da-floatingBar")) return;
  if (!item.classList.contains("is-selected")) return;

  const img = item.querySelector(".da-img");
  if (!img) return;

  e.preventDefault();
  e.stopPropagation();

  const startX = e.clientX;
  const startY = e.clientY;

  const startPosX = parseFloat(item.dataset.posX || "50");
  const startPosY = parseFloat(item.dataset.posY || "50");

  imgPan = { item, img, startX, startY, startPosX, startPosY };
  document.body.style.userSelect = "none";
}, true);


window.addEventListener("mousemove", (e) => {
  if (!imgPan) return;

  const dx = e.clientX - imgPan.startX;
  const dy = e.clientY - imgPan.startY;

  // tweak sensitivity
  const speed = 0.12;

  let nextX = imgPan.startPosX + dx * speed;
  let nextY = imgPan.startPosY + dy * speed;

  // clamp 0–100%
  nextX = Math.max(0, Math.min(100, nextX));
  nextY = Math.max(0, Math.min(100, nextY));

  imgPan.item.dataset.posX = String(nextX);
  imgPan.item.dataset.posY = String(nextY);

  imgPan.img.style.objectPosition = `${nextX}% ${nextY}%`;
  refreshBarPosition();
});

window.addEventListener("mouseup", () => {
  if (!imgPan) return;
  document.body.style.userSelect = "";
  imgPan = null;
});

  window.addEventListener("mousemove", (e) => {
   // RESIZE has priority
if (resizeActive) {
  const r = resizeActive;
  const dx = e.clientX - r.startX;
  const dy = e.clientY - r.startY;

  let left = r.startLeft;
  let top  = r.startTop;
  let w    = r.startW;
  let h    = r.startH;



  // Horizontal
const mins = getMinSizeForItem(r.el);

if (r.dir.includes("e")) w = Math.max(mins.w, r.startW + dx);
if (r.dir.includes("w")) {
  w = Math.max(mins.w, r.startW - dx);
  left = r.startLeft + (r.startW - w);
}
  // Vertical
if (r.dir.includes("s")) h = Math.max(mins.h, r.startH + dy);
if (r.dir.includes("n")) {
  h = Math.max(mins.h, r.startH - dy);
  top = r.startTop + (r.startH - h);
}

r.el.style.left = px(left);
r.el.style.top  = px(top);
r.el.style.width  = px(w);
r.el.style.height = px(h);

const headerAncestor = getHeaderAncestor(r.el);
if (headerAncestor && r.el.dataset.type !== "header") {
  clampElToHeaderBounds(r.el, headerAncestor);
}

clampElToCanvasBounds(r.el);

  // ✅ LOCK ASPECT RATIO (logo)
  const lockRatio = r.el?.dataset?.lockRatio === "1";
  if (lockRatio) {
    const ratio = (r.startW / r.startH) || 1; // square => 1

    // If resizing side handles, force the other dimension
    const isSideOnly =
      (r.dir === "e" || r.dir === "w" || r.dir === "n" || r.dir === "s");

    if (isSideOnly) {
      if (r.dir === "e" || r.dir === "w") {
        // width changed -> set height to match
        h = Math.max(mins.h, w / ratio);
        // keep vertically centered while height changes
        top = r.startTop + (r.startH - h) / 2;
      } else {
        // height changed -> set width to match
        w = Math.max(mins.w, h * ratio);
        // keep horizontally centered while width changes
        left = r.startLeft + (r.startW - w) / 2;
      }
    } else {
      // corner resize: pick the dominant change
      if (Math.abs(dx) >= Math.abs(dy)) {
        h = Math.max(mins.h, w / ratio);
        if (r.dir.includes("n")) top = r.startTop + (r.startH - h);
      } else {
        w = Math.max(mins.w, h * ratio);
        if (r.dir.includes("w")) left = r.startLeft + (r.startW - w);
      }
    }
  }

  refreshBarPosition();
  return;
}

if (!active) return;

console.log("[mousemove active]", {
  id: active?.el?.dataset?.id,
  type: active?.el?.dataset?.type,
  startLeft: active?.startLeft,
  startTop: active?.startTop
});

const dx = e.clientX - active.startX;
const dy = e.clientY - active.startY;

const DRAG_THRESHOLD = 6;
if (!active.hasStartedDrag) {
  if (Math.abs(dx) < DRAG_THRESHOLD && Math.abs(dy) < DRAG_THRESHOLD) {
    return;
  }
  active.hasStartedDrag = true;
  active.el.classList.add("is-dragging");
}

  let nextLeft = active.startLeft + dx;
let nextTop  = active.startTop + dy;

// keep it inside drop area bounds (basic clamp)
const maxLeft = grid.clientWidth - active.el.offsetWidth;
const maxTop  = grid.scrollHeight - active.el.offsetHeight;

nextLeft = clamp(nextLeft, 0, Math.max(0, maxLeft));
nextTop  = clamp(nextTop, 0, Math.max(0, maxTop));

  // keep normal elements below the header
  const header = grid.querySelector(".da-item.da-header");
  const headerBottom = header ? header.offsetHeight : 90;
  const itemHeaderAncestor = getHeaderAncestor(active.el);

if (!itemHeaderAncestor && active.el.dataset.type !== "header") {
  nextTop = Math.max(nextTop, headerBottom -2);
}

  // only sections/groups snap vertically
  if (
    active?.el?.dataset?.type === "section" ||
    active?.el?.dataset?.type === "group"
  ) {
    nextTop = snapY(nextTop);
  }

// ✅ If dragging something inside header, clamp to header bounds
const headerAncestor = getHeaderAncestor(active.el);
if (headerAncestor && active.el.dataset.type !== "header") {
  const hLeft = getNum(headerAncestor, "left", 0);
  const hTop  = getNum(headerAncestor, "top", 0);
  const hW    = headerAncestor.offsetWidth;
  const hH    = headerAncestor.offsetHeight;

  const elW = active.el.offsetWidth;
  const elH = active.el.offsetHeight;

  nextLeft = clamp(nextLeft, hLeft, hLeft + hW - elW);
  nextTop  = clamp(nextTop,  hTop,  hTop  + hH - elH);
}

// ✅ NOW compute final delta (after clamp + snap)
const finalDx = nextLeft - active.startLeft;
const finalDy = nextTop  - active.startTop;

// ✅ if dragging a container (section/header/group), drag its children too
if (
  (active.el.dataset.type === "section" ||
   active.el.dataset.type === "header"  ||
   active.el.dataset.type === "group"   ||
   active.el.dataset.type === "popup") &&
  Array.isArray(active.childrenStart)
)
 {
  active.childrenStart.forEach((c) => {
    c.el.style.left = `${Math.round(c.left + finalDx)}px`;
    c.el.style.top  = `${Math.round(c.top + finalDy)}px`;
  });
}

active.el.style.left = `${Math.round(nextLeft)}px`;
active.el.style.top  = `${Math.round(nextTop)}px`;

clampElToCanvasBounds(active.el);
refreshBarPosition();


  });

window.addEventListener("mouseup", () => {
  if (resizeActive) {
    document.body.style.userSelect = "";
    
    if (resizeActive?.el) {
      const headerAncestor = getHeaderAncestor(resizeActive.el);
      if (headerAncestor) {
        clampElToHeaderBounds(resizeActive.el, headerAncestor);
      }
    }

        // ✅ if user manually resized a background, stop auto height
    if (resizeActive?.el?.dataset?.type === "background") {
      resizeActive.el.dataset.autoHeight = "0";
    }

    resizeActive = null;
    trimCanvasHeight();
    return;
  }

  if (!active) return;

  document.body.style.userSelect = "";
  active.el.classList.remove("is-dragging");
  active = null;
  trimCanvasHeight();
  syncAutoBackgrounds();
});




//Reset Template 
async function resetTemplateToDefault() {
  try {
    const locationId = getSelectedPageId();
    if (!locationId) {
      alert("Please select a page first.");
      return;
    }

    const selectedTemplate =
      tplTemplateSelect?.value ||
      getBuilderLaunchParams().templateKey ||
      "custom";

    const confirmed = window.confirm(
      `Reset ${selectedTemplate} back to its default layout?\n\nThis cannot be undone.`
    );

    if (!confirmed) return;

    const starter = cloneTemplateStarter(selectedTemplate);
    const jsonFieldName = getTemplateJsonFieldName(selectedTemplate);

    const values = {
      "Selected Template": selectedTemplate,
      [jsonFieldName]: JSON.stringify(starter),
    };

    const res = await apiFetch(`/api/records/Location/${encodeURIComponent(locationId)}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ values }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(data?.message || "Failed to reset template");
    }

    pageViews = starter.views || {
      default: {
        name: "Default View",
        desktop: { items: [] },
        mobile: { items: [] }
      }
    };

    currentViewKey = starter.currentView || "default";

    if (!pageViews[currentViewKey]) {
      currentViewKey = Object.keys(pageViews)[0] || "default";
    }

    rebuildViewDropdown();
    await loadViewIntoCanvas(currentViewKey);

    alert("Template reset to default.");
  } catch (err) {
    console.error("[builder] reset template error:", err);
    alert(err?.message || "Failed to reset template.");
  }
}





                                                 // =======================
                                            // STEP 3: Bar Controls 
                                             // =======================
                                             //Add a font
// ✅ Font library (add as many as you want)
const FONT_LIBRARY = [
  { label: "Inter", css: "'Inter', sans-serif", gf: "Inter:wght@300;400;500;600;700" },
  { label: "Poppins", css: "'Poppins', sans-serif", gf: "Poppins:wght@300;400;500;600;700" },
  { label: "Montserrat", css: "'Montserrat', sans-serif", gf: "Montserrat:wght@300;400;500;600;700" },
  { label: "Roboto", css: "'Roboto', sans-serif", gf: "Roboto:wght@300;400;500;700" },
  { label: "Open Sans", css: "'Open Sans', sans-serif", gf: "Open+Sans:wght@300;400;600;700" },
  { label: "Lato", css: "'Lato', sans-serif", gf: "Lato:wght@300;400;700;900" },
  { label: "Raleway", css: "'Raleway', sans-serif", gf: "Raleway:wght@300;400;600;700;900" },
  { label: "Playfair Display", css: "'Playfair Display', serif", gf: "Playfair+Display:wght@400;500;600;700;800;900" },
  { label: "Merriweather", css: "'Merriweather', serif", gf: "Merriweather:wght@300;400;700;900" },
  { label: "DM Sans", css: "'DM Sans', sans-serif", gf: "DM+Sans:wght@300;400;500;600;700" },
  { label: "DM Serif Display", css: "'DM Serif Display', serif", gf: "DM+Serif+Display" },
  { label: "Bebas Neue", css: "'Bebas Neue', sans-serif", gf: "Bebas+Neue" },
  { label: "Oswald", css: "'Oswald', sans-serif", gf: "Oswald:wght@300;400;500;600;700" },
  { label: "Nunito", css: "'Nunito', sans-serif", gf: "Nunito:wght@300;400;600;700;800;900" },
  { label: "Quicksand", css: "'Quicksand', sans-serif", gf: "Quicksand:wght@300;400;500;600;700" },
  {
  label: "Rubik Mono One",
  css: "'Rubik Mono One', monospace",
  gf: "Rubik+Mono+One"
},
  {
  label: "oi-regular ",
  css: "'Oi',serif",
  gf: "Oi"
},
  // ...add 100+ more
];

function ensureGoogleFontLoaded(gfParam) {
  if (!gfParam) return;

  const id = "gf_" + gfParam.replace(/[^a-z0-9]+/gi, "_").toLowerCase();
  if (document.getElementById(id)) return;

  const link = document.createElement("link");
  link.id = id;
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?family=${gfParam}&display=swap`;
  document.head.appendChild(link);
}

floatingBar.innerHTML = `
<button type="button" class="da-editorBackBtn">← Back</button>
<!-- ✅ Image controls (only show when an IMAGE is selected) -->
<div class="da-imgControls" style="display:none">
  <button type="button" class="da-imgPickBtn" title="Upload image" aria-label="Upload image">🖼️</button>
  <input class="da-imgFile" type="file" accept="image/*" style="display:none" />

  <select class="da-img__mode" aria-label="Image mode">
    <option value="static">Static</option>
    <option value="dynamic">Dynamic</option>
  </select>

  <select class="da-img__dynamicSource" aria-label="Image dynamic source">
    <option value="page">Current Page</option>
    <option value="parentGroup">Parent Group</option>
  </select>

  <select class="da-img__dynamicField" aria-label="Image dynamic field">
    <option value="">Select image field</option>
  </select>

  <select class="da-imgFit" title="Fit" aria-label="Fit">
    <option value="cover">Cover</option>
    <option value="contain">Contain</option>
  </select>

<div class="da-imgPositionControls">
  <button type="button" class="da-imgMoveBtn" data-move="up">↑</button>
  <button type="button" class="da-imgMoveBtn" data-move="left">←</button>
  <button type="button" class="da-imgMoveBtn" data-move="right">→</button>
  <button type="button" class="da-imgMoveBtn" data-move="down">↓</button>

  <input class="da-imgPosX" type="range" min="0" max="100" step="1" value="50" />
  <input class="da-imgPosY" type="range" min="0" max="100" step="1" value="50" />
</div>

  <input class="da-imgZoom" type="range" min="0.2" max="3" step="0.05" value="1" />

  <input class="da-imgBorderW" type="number" min="0" max="20" step="1" value="0" title="Border width" aria-label="Border width" />
  <input class="da-imgBorderC" type="color" value="#111111" title="Border color" aria-label="Border color" />
  <input class="da-imgRadius" type="number" min="0" max="120" step="1" value="12" title="Border radius" aria-label="Border radius" />


  </div>



<!-- ✅ Video Controls  -->
<div class="da-videoControls" style="display:none">
  <button type="button" class="da-videoPickBtn">🎥</button>
  <input class="da-videoFile" type="file" accept="video/*" style="display:none" />

  <input class="da-videoRadius" type="number" min="0" max="120" step="1" value="12" title="Corner radius" />

  <label><input class="da-videoControlsToggle" type="checkbox" checked /> Controls</label>
  <label><input class="da-videoAutoplay" type="checkbox" /> Autoplay</label>
  <label><input class="da-videoMuted" type="checkbox" checked /> Muted</label>
  <label><input class="da-videoLoop" type="checkbox" /> Loop</label>
</div>


<!-- ✅ Header Controls  -->
<div class="da-headerControls" style="display:none">
  <button type="button" class="da-headerPartBtn" data-header-part="Logo">Logo</button>
  <button type="button" class="da-headerPartBtn" data-header-part="Store Name">Store</button>
  <button type="button" class="da-headerPartBtn" data-header-part="Tabs">Tabs</button>
  <button type="button" class="da-headerPartBtn" data-header-part="Cart">Cart</button>
  <button type="button" class="da-headerPartBtn" data-header-part="Profile">User</button>
</div>

<!-- ✅ Group Controls  -->
<div class="da-groupDynamicControls" style="display:none">
  <select class="da-group__mode" aria-label="Group data mode">
    <option value="static">Static</option>
    <option value="dynamic">Dynamic</option>
  </select>

  <select class="da-group__dynamicSource" aria-label="Group dynamic source">
    <option value="page">Current Page</option>
    <option value="parentGroup">Parent Group</option>
  </select>

  <select class="da-group__bindMode" aria-label="Group bind mode">
    <option value="single">Single Item</option>
    <option value="list">List</option>
  </select>

  <select class="da-group__dynamicField" aria-label="Group dynamic field">
    <option value="">Select field</option>
  </select>

  <select class="da-group__selectedItem" aria-label="Selected item">
    <option value="">Select item</option>
  </select>

  <select class="da-group__nestedField" aria-label="Nested field">
    <option value="">Select nested field</option>
  </select>

  <select class="da-group__nestedSelectedItem" aria-label="Nested selected item">
    <option value="">Select nested item</option>
  </select>

  <select class="da-group__itemField" aria-label="Item field">
    <option value="">Select item field</option>
  </select>
</div>

<!-- ✅ Button Controls (only show when a BUTTON is selected) -->
<div class="da-btnControls" style="display:none">
  <!-- Button label -->
  <input class="da-btn__label" type="text" placeholder="Button text" aria-label="Button text" />

  <!-- Button colors -->
  <input class="da-btn__bg" type="color" value="#111111" title="Button color" aria-label="Button color" />
  <input class="da-btn__textColor" type="color" value="#ffffff" title="Text color" aria-label="Text color" />

  <!-- Button border -->
  <input class="da-btn__borderWidth" type="number" min="0" max="20" step="1" value="0" title="Border thickness" aria-label="Border thickness" />
  <input class="da-btn__borderColor" type="color" value="#111111" title="Border color" aria-label="Border color" />
  <select class="da-btn__borderStyle" title="Border style" aria-label="Border style">
    <option value="solid">Solid</option>
    <option value="dashed">Dashed</option>
    <option value="dotted">Dotted</option>
    <option value="none">None</option>
  </select>

  <div class="da-btn__submitInputsWrap" style="display:none;">
  <div class="da-btn__submitInputsTitle">Submit Inputs</div>
  <div class="da-btn__submitInputsList"></div>
</div>

<button type="button" class="da-btn__bgToggle">Remove Background</button>

  <!-- Button radius -->
  <input class="da-btn__radius" type="number" min="0" max="80" step="1" value="12" title="Border radius" aria-label="Border radius" />

  <!-- NEW: button action -->
 <select class="da-btn__actionType" title="Button action" aria-label="Button action">
  <option value="none">No action</option>
  <option value="link">Open link</option>
  <option value="change-view">Change view</option>
  <option value="open-popup">Open popup</option>
  <option value="scroll-to-section">Scroll to section</option>
  <option value="download-pdf">Download PDF</option>
  <option value="submit">Submit form</option>
  <option value="open-template">Open Template</option>
</select>

<select class="da-btn__actionSource" title="Button source" aria-label="Button source">
  <option value="page">Current Page</option>
  <option value="parentGroup">Parent Group</option>
</select>

  <input class="da-btn__actionTarget" type="text" placeholder="URL / view name / popup id" aria-label="Button target" />

  <select class="da-btn__actionTargetSelect" aria-label="Button target select" style="display:none;">
  <option value="">Select target</option>
</select>


<input class="da-btn__pdfFile" type="file" accept="application/pdf" style="display:none;" />
<button type="button" class="da-btn__pdfPick" style="display:none;">Choose PDF</button>

  <!-- NEW: button display -->
  <select class="da-btn__displayType" title="Button display" aria-label="Button display">
    <option value="text">Text</option>
    <option value="icon">Icon</option>
    <option value="text-icon">Text + Icon</option>
  </select>

  <!-- optional icon text for now -->
  <input class="da-btn__icon" type="text" placeholder="Icon (ex: ← or ★)" aria-label="Button icon" />
</div>


  <input class="da-floatingBar__name" type="text" value="Section" aria-label="Element name" />

<div class="da-textDynamicControls" style="display:none">
  <select class="da-text__mode" aria-label="Text mode">
    <option value="static">Static</option>
    <option value="dynamic">Dynamic</option>
  </select>

  <select class="da-text__dynamicSource" aria-label="Dynamic source">
    <option value="page">Current Page</option>
    <option value="parentGroup">Parent Group</option>
  </select>

  <select class="da-text__dynamicField" aria-label="Dynamic field">
    <option value="">Select dynamic field</option>
  </select>

  <select class="da-text__selectedRecord" aria-label="Selected record" style="display:none">
    <option value="">Select item</option>
  </select>

  <select class="da-text__nestedField" aria-label="Nested field" style="display:none">
    <option value="">Select nested field</option>
  </select>

  <select class="da-text__nestedSelectedRecord" aria-label="Nested selected record" style="display:none">
    <option value="">Select nested item</option>
  </select>

  <select class="da-text__recordField" aria-label="Record field" style="display:none">
    <option value="">Select item field</option>
  </select>
</div>


<div class="da-sectionDynamicControls" style="display:none">
  <select class="da-section__mode" aria-label="Section data mode">
    <option value="static">Static</option>
    <option value="dynamic">Dynamic</option>
  </select>

  <select class="da-section__dynamicSource" aria-label="Section dynamic source">
    <option value="page">Current Page</option>
  </select>

  <select class="da-section__dynamicDataType" aria-label="Section data type" disabled>
    <option value="">Current page datatype</option>
  </select>
</div>

<div class="da-floatingBar__right">

<select class="da-floatingBar__font" title="Font" aria-label="Font"></select>

    <!-- ✅ Font size (only used for text items) -->
    <input class="da-floatingBar__fontSize" type="number" min="8" max="160" step="1" value="24" title="Font size" aria-label="Font size" />
<button type="button" class="da-txtBtn" data-txt="bold" title="Bold" aria-label="Bold"><b>B</b></button>
<button type="button" class="da-txtBtn" data-txt="italic" title="Italic" aria-label="Italic"><i>I</i></button>
 <button type="button" class="da-txtBtn" data-txt="underline" title="Underline" aria-label="Underline"><u>U</u></button>
<button type="button" class="da-txtBtn" data-txt="alignLeft" title="Align left" aria-label="Align left">⟸</button>
<button type="button" class="da-txtBtn" data-txt="alignCenter" title="Align center" aria-label="Align center">≡</button>
<button type="button" class="da-txtBtn" data-txt="alignRight" title="Align right" aria-label="Align right">⟹</button>




<!-- ✅ Input Controls  -->
<div class="da-inputControls" style="display:none;">
  <input class="da-input__labelTextControl" type="text" placeholder="Label text" aria-label="Input label text" />
  <input class="da-input__placeholderControl" type="text" placeholder="Placeholder" aria-label="Input placeholder" />

  <label>Label BG</label>
<input class="da-input__labelBgControl" type="color" value="#ffffff" />

<label>Input BG</label>
<input class="da-input__inputBgControl" type="color" value="#ffffff" />

<!--label background--!>
<select class="da-input__labelBgModeControl">
  <option value="none">None</option>
  <option value="color">Color</option>
</select>

<!--input background--!>
<select class="da-input__inputBgModeControl">
  <option value="none">None</option>
  <option value="color">Color</option>
</select>

<input class="da-input__inputBgControl" type="color" value="#ffffff" />

<input class="da-input__labelBgControl" type="color" value="#ffffff" />

  <select class="da-input__typeControl" aria-label="Input type">
    <option value="text">Text</option>
    <option value="email">Email</option>
    <option value="tel">Phone</option>
    <option value="number">Number</option>
    <option value="password">Password</option>
  </select>

  <label class="da-input__requiredWrap">
    <input class="da-input__requiredControl" type="checkbox" />
    Required
  </label>

  <label class="da-input__bgToggleWrap">
  <input class="da-input__bgToggleControl" type="checkbox" />
  Background
</label>

<input class="da-input__bgControl" type="color" value="#ffffff" />

</div>


<!-- ✅ Shape Controls -->
<div class="da-shapeControls" style="display:none">
  <select class="da-shape__type" aria-label="Shape type">
    <option value="rectangle">Rectangle</option>
    <option value="circle">Circle</option>
    <option value="pill">Pill</option>
  </select>

  <input class="da-shape__bg" type="color" value="#d9d9d9" aria-label="Shape color" />

  <label>
    <input class="da-shape__bgOn" type="checkbox" checked />
    Fill
  </label>

  <label>
    <input class="da-shape__borderOn" type="checkbox" />
    Border
  </label>

  <input class="da-shape__borderWidth" type="number" min="0" max="20" step="1" value="2" aria-label="Border width" />
  <input class="da-shape__borderColor" type="color" value="#111111" aria-label="Border color" />

  <select class="da-shape__borderStyle" aria-label="Border style">
    <option value="solid">Solid</option>
    <option value="dashed">Dashed</option>
    <option value="dotted">Dotted</option>
    <option value="none">None</option>
  </select>

  <input class="da-shape__radius" type="number" min="0" max="200" step="1" value="0" aria-label="Corner radius" />
</div>


<!-- ✅ Background Controls -->
<div class="da-backgroundControls" style="display:none">

  <select class="da-background__mode" aria-label="Background mode">
    <option value="color">Color</option>
    <option value="image">Image</option>
    <option value="video">Video</option>
  </select>

 

  <input class="da-background__color" type="color" value="#ffffff" aria-label="Background color" />

  <button type="button" class="da-backgroundPickBtn">🖼️</button>
  <input class="da-backgroundFile" type="file" accept="image/*" style="display:none" />

  <button type="button" class="da-backgroundVideoPickBtn">🎥</button>
  <input class="da-backgroundVideoFile" type="file" accept="video/*" style="display:none" />

  <select class="da-background__fit" aria-label="Background fit">
    <option value="cover">Cover</option>
    <option value="contain">Contain</option>
  </select>

     <div class="da-backgroundPositionControls">
  <button type="button" class="da-backgroundMoveBtn" data-move="up">↑</button>
  <button type="button" class="da-backgroundMoveBtn" data-move="left">←</button>
  <button type="button" class="da-backgroundMoveBtn" data-move="right">→</button>
  <button type="button" class="da-backgroundMoveBtn" data-move="down">↓</button>

  <input class="da-backgroundPosX" type="range" min="0" max="100" step="1" value="50" />
  <input class="da-backgroundPosY" type="range" min="0" max="100" step="1" value="50" />
</div>

  <input class="da-background__radius" type="number" min="0" max="200" step="1" value="0" aria-label="Corner radius" />

  <input class="da-background__opacity" type="range" min="0" max="1" step="0.05" value="1" aria-label="Opacity" />

  <label>
    <input class="da-background__bgOn" type="checkbox" checked />
    Show BG
  </label>
  <br>


</div>



<!-- ✅ Section border controls (only for sections) -->
<input class="da-secBorder__radius" type="number" min="0" max="200" step="1" value="0" title="Corner radius" aria-label="Corner radius" />

<button type="button" class="da-secBtn" data-sec="borderToggle" title="Border" aria-label="Border">▭</button>

<input class="da-secBorder__width" type="number" min="0" max="40" step="1" value="2" title="Border width" aria-label="Border width" />
<input class="da-secBorder__color" type="color" value="#111111" title="Border color" aria-label="Border color" />

<select class="da-secBorder__style" title="Border style" aria-label="Border style">
  <option value="solid">Solid</option>
  <option value="dashed">Dashed</option>
  <option value="dotted">Dotted</option>
   <option value="none">None</option>
</select>

<input class="da-parallax" type="range" min="0" max="1" step="0.05" value="0" title="Parallax" aria-label="Parallax" />

   <input class="da-floatingBar__color" type="color" value="#f2b26b" aria-label="Background color" />
<button type="button" class="da-secBtn" data-sec="bgToggle" title="Background on/off" aria-label="Background on/off">◪</button>
<button type="button" class="da-layerBtn" data-action="sendBack" title="Send back">⬇︎</button>
 <button type="button" class="da-layerBtn" data-action="bringFront" title="Bring front">⬆︎</button>
    <button type="button" class="da-layerBtn" data-action="duplicate" title="Duplicate">＋</button>
    <button type="button" class="da-delBtn" data-action="remove" title="Remove">✕</button>
    <button type="button" class="da-hideBtn" data-action="toggleHide" title="Hide/show">👁</button>
  </div>


`;

grid.appendChild(floatingBar);

const bgWrap = floatingBar.querySelector(".da-backgroundControls");
const bgModeEl = floatingBar.querySelector(".da-background__mode");
const bgColorEl = floatingBar.querySelector(".da-background__color");
const bgPickBtn = floatingBar.querySelector(".da-backgroundPickBtn");
const bgFileEl = floatingBar.querySelector(".da-backgroundFile");
const bgVideoPickBtn = floatingBar.querySelector(".da-backgroundVideoPickBtn");
const bgVideoFileEl = floatingBar.querySelector(".da-backgroundVideoFile");
const bgFitEl = floatingBar.querySelector(".da-background__fit");
const bgRadiusEl = floatingBar.querySelector(".da-background__radius");
const bgOpacityEl = floatingBar.querySelector(".da-background__opacity");
const bgOnEl = floatingBar.querySelector(".da-background__bgOn");

const bgPosXEl = floatingBar.querySelector(".da-backgroundPosX");
const bgPosYEl = floatingBar.querySelector(".da-backgroundPosY");
const bgMoveBtns = floatingBar.querySelectorAll(".da-backgroundMoveBtn");

const btnBgToggleEl = floatingBar.querySelector(".da-btn__bgToggle");

const imgPosXEl = floatingBar.querySelector(".da-imgPosX");
const imgPosYEl = floatingBar.querySelector(".da-imgPosY");
const imgMoveBtns = floatingBar.querySelectorAll(".da-imgMoveBtn");
// ✅ start hidden until an element is selected
floatingBar.style.display = "none";

//Image

//move image 
function getMovedPosition(move, currentX, currentY) {
  const stepX = 10;
  const stepY = 10;

  let x = Number(currentX ?? 50);
  let y = Number(currentY ?? 50);

  if (move === "left") x = Math.max(0, x - stepX);
  if (move === "right") x = Math.min(100, x + stepX);
  if (move === "up") y = Math.max(0, y - stepY);
  if (move === "down") y = Math.min(100, y + stepY);

  return { x, y };
}
function applyImagePosition(item) {
  if (!item || item.dataset.type !== "image") return;

  const img = item.querySelector(".da-img");
  if (!img) return;

  const posX = parseFloat(item.dataset.posX || "50");
  const posY = parseFloat(item.dataset.posY || "50");

  img.style.objectFit = item.dataset.fit || "cover";
  img.style.objectPosition = `${posX}% ${posY}%`;
}


//Image Listeners
imgPosXEl?.addEventListener("input", () => {
  if (!selectedItem || selectedItem.dataset.type !== "image") return;
  selectedItem.dataset.posX = imgPosXEl.value;
  applyImagePosition(selectedItem);
});

imgPosYEl?.addEventListener("input", () => {
  if (!selectedItem || selectedItem.dataset.type !== "image") return;
  selectedItem.dataset.posY = imgPosYEl.value;
  applyImagePosition(selectedItem);
});

imgMoveBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    if (!selectedItem || selectedItem.dataset.type !== "image") return;

    const { x, y } = getMovedPosition(
      btn.dataset.move,
      selectedItem.dataset.posX,
      selectedItem.dataset.posY
    );

    selectedItem.dataset.posX = String(x);
    selectedItem.dataset.posY = String(y);

    if (imgPosXEl) imgPosXEl.value = String(x);
    if (imgPosYEl) imgPosYEl.value = String(y);

    applyImagePosition(selectedItem);

    console.log("[image move]", {
      move: btn.dataset.move,
      x,
      y
    });
  });
});

if (selectedItem && selectedItem.dataset.type === "image") {
  if (imgPosXEl) imgPosXEl.value = selectedItem.dataset.posX ?? "50";
  if (imgPosYEl) imgPosYEl.value = selectedItem.dataset.posY ?? "50";
}
//////////////////////////////////////////////////////////////////////////////////////////////////////
//////////////  
//Elements
 ///////////  
                                                 // =======================
                                            // STEP 4: Add Elements
                                             //Put all elements above Section Element
                                             // =======================


 //////
//Add New Element
//////////

                                             //////////
                                         // Background Element
                                        //////// ////
function makeBackgroundEl({ x = 0, y = 90, w = grid.clientWidth, h = 600, title = "Background" }) {
  const el = document.createElement("div");
  el.className = "da-item da-item--background";
  el.dataset.type = "background";
  el.dataset.id = uid("background");
  el.dataset.name = title || "Background";

  el.dataset.bgMode = el.dataset.bgMode || "color"; // color | image | video
  el.dataset.bg = el.dataset.bg || "#ffffff";
  el.dataset.bgOn = el.dataset.bgOn || "1";
  el.dataset.radius = el.dataset.radius || "0";

  el.dataset.src = el.dataset.src || "";       // image src
  el.dataset.videoSrc = el.dataset.videoSrc || ""; // video src
  el.dataset.fit = el.dataset.fit || "cover";
  el.dataset.opacity = el.dataset.opacity || "1";
  el.dataset.autoHeight = el.dataset.autoHeight || "1";

  el.dataset.posX = el.dataset.posX || "50";
  el.dataset.posY = el.dataset.posY || "50";

  el.style.left = `${Math.round(x)}px`;
  el.style.top = `${Math.round(y)}px`;
  el.style.width = `${Math.round(w)}px`;
  el.style.height = `${Math.round(h)}px`;
  el.style.zIndex = "0";

  el.innerHTML = `
    <div class="da-background__media"></div>

    <div class="da-resize da-resize--nw" data-resize="nw"></div>
    <div class="da-resize da-resize--n"  data-resize="n"></div>
    <div class="da-resize da-resize--ne" data-resize="ne"></div>
    <div class="da-resize da-resize--w"  data-resize="w"></div>
    <div class="da-resize da-resize--e"  data-resize="e"></div>
    <div class="da-resize da-resize--sw" data-resize="sw"></div>
    <div class="da-resize da-resize--s"  data-resize="s"></div>
    <div class="da-resize da-resize--se" data-resize="se"></div>
  `;

  renderBackgroundContent(el);
  return el;
}

function renderBackgroundContent(el) {
  if (!el || el.dataset.type !== "background") return;

  const media = el.querySelector(".da-background__media");
  if (!media) return;

  const mode = el.dataset.bgMode || "color";
  const radius = parseInt(el.dataset.radius || "0", 10);
  const opacity = parseFloat(el.dataset.opacity || "1");

  el.style.borderRadius = `${radius}px`;
  el.style.overflow = "hidden";

  media.innerHTML = "";
  media.style.position = "absolute";
  media.style.inset = "0";
  media.style.borderRadius = `${radius}px`;
  media.style.opacity = String(opacity);

  if (mode === "color") {
    media.style.background = el.dataset.bg || "#ffffff";
    media.style.backgroundImage = "";
  }

if (mode === "image") {
  const x = Number(el.dataset.posX ?? 50);
  const y = Number(el.dataset.posY ?? 50);

  media.style.background = "transparent";
  media.style.backgroundImage = `url("${el.dataset.src || ""}")`;
  media.style.backgroundSize = "120% 120%";
  media.style.backgroundPosition = `${x}% ${y}%`;
  media.style.backgroundRepeat = "no-repeat";
}

  if (mode === "video") {
    media.style.background = "transparent";
    media.innerHTML = `<video class="da-background__video" autoplay muted loop playsinline></video>`;
    const video = media.querySelector("video");
if (video) {
  const x = Number(el.dataset.posX ?? 50);
  const y = Number(el.dataset.posY ?? 50);

  video.src = el.dataset.videoSrc || "";
  video.style.width = "100%";
  video.style.height = "100%";
  video.style.objectFit = el.dataset.fit || "cover";
  video.style.objectPosition = `${x}% ${y}%`;
  video.style.display = "block";
}
  }
}

function syncAutoBackgrounds() {
    const grid = document.getElementById("dropAreaInner");
  if (!grid) return;

  const header = grid.querySelector(".da-item.da-header");
  const headerBottom = header ? header.offsetHeight : 90;

  const allItems = [...grid.querySelectorAll(".da-item")];
  const backgrounds = allItems.filter(el => el.dataset.type === "background");

  backgrounds.forEach((bg) => {
    if (bg.dataset.autoHeight !== "1") return;

    const bgTop = headerBottom;

    // everything except this background and header
    const contentItems = allItems.filter((el) => {
      return el !== bg && el.dataset.type !== "header";
    });

    let maxBottom = bgTop + 400; // minimum fallback height

    contentItems.forEach((el) => {
      if (el.style.display === "none") return;

      const top = parseFloat(el.style.top) || 0;
      const height = el.offsetHeight || parseFloat(el.style.height) || 0;
      const bottom = top + height;

      if (bottom > maxBottom) {
        maxBottom = bottom;
      }
    });

    // optional bottom padding
    const paddingBottom = 40;

    bg.style.left = "0px";
    bg.style.top = `${bgTop}px`;
    bg.style.width = `${grid.clientWidth}px`;
    bg.style.height = `${Math.max(200, maxBottom - bgTop + paddingBottom)}px`;
  });
}

function applyBackgroundPosition(item) {
  if (!item || item.dataset.type !== "background") return;

  const x = Number(item.dataset.posX ?? 50);
  const y = Number(item.dataset.posY ?? 50);

  const media = item.querySelector(".da-background__media");
  if (!media) return;

  if ((item.dataset.bgMode || "color") === "image") {
    media.style.backgroundPosition = `${x}% ${y}%`;
  }

  if ((item.dataset.bgMode || "color") === "video") {
    const video = media.querySelector("video");
    if (video) {
      video.style.objectFit = item.dataset.fit || "cover";
      video.style.objectPosition = `${x}% ${y}%`;
    }
  }
}
//Background Listeners
bgMoveBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    if (!selectedItem || selectedItem.dataset.type !== "background") return;

    const { x, y } = getMovedPosition(
      btn.dataset.move,
      selectedItem.dataset.posX,
      selectedItem.dataset.posY
    );

    selectedItem.dataset.posX = String(x);
    selectedItem.dataset.posY = String(y);

    if (bgPosXEl) bgPosXEl.value = String(x);
    if (bgPosYEl) bgPosYEl.value = String(y);

    renderBackgroundContent(selectedItem);
    applyBackgroundPosition(selectedItem);

    console.log("[background move]", {
      move: btn.dataset.move,
      x,
      y
    });
  });
});


bgPosXEl?.addEventListener("input", () => {
  if (!selectedItem || selectedItem.dataset.type !== "background") return;
  selectedItem.dataset.posX = bgPosXEl.value;
  renderBackgroundContent(selectedItem);
  applyBackgroundPosition(selectedItem);
});

bgPosYEl?.addEventListener("input", () => {
  if (!selectedItem || selectedItem.dataset.type !== "background") return;
  selectedItem.dataset.posY = bgPosYEl.value;
  renderBackgroundContent(selectedItem);
  applyBackgroundPosition(selectedItem);
});
  ////////////////////////////////////////                                      
//Make Elements from Template 
function makeElementFromSavedItem(item) {
  const type = item?.type || item?.data?.type || "text";

  let el = null;

  if (type === "section") el = makeSectionEl({ x: item.x, y: item.y, w: item.w, h: item.h });
  else if (type === "group") el = makeGroupEl({ x: item.x, y: item.y, w: item.w, h: item.h });
  else if (type === "text") el = makeTextEl({ x: item.x, y: item.y, w: item.w, h: item.h });
  else if (type === "image") el = makeImageEl({ x: item.x, y: item.y, w: item.w, h: item.h });
  else if (type === "button") el = makeButtonEl({ x: item.x, y: item.y, w: item.w, h: item.h });
  else if (type === "popup") el = makePopupEl({ x: item.x, y: item.y, w: item.w, h: item.h });
  else if (type === "input") el = makeInputEl({ x: item.x, y: item.y, w: item.w, h: item.h });
  else if (type === "video") el = makeVideoEl({ x: item.x, y: item.y, w: item.w, h: item.h });
  else if (type === "shape") el = makeShapeEl({ x: item.x, y: item.y, w: item.w, h: item.h });
 else if (type === "background") el = makeBackgroundEl({ x: item.x, y: item.y, w: item.w, h: item.h });
  if (!el) return null;

  el.dataset.type = type;
  el.dataset.id = item.id || crypto.randomUUID();
  el.dataset.parent = item.parent || "";

  return el;
}

function applySavedItemData(el, item) {
  const data = item?.data || {};

  Object.entries(data).forEach(([key, value]) => {
    if (value == null) return;
    el.dataset[key] = String(value);
  });

  el.dataset.type = item.type || data.type || el.dataset.type || "";
  el.style.left = `${item.x || 0}px`;
  el.style.top = `${item.y || 0}px`;
  el.style.width = `${item.w || el.offsetWidth || 0}px`;
  el.style.height = `${item.h || el.offsetHeight || 0}px`;
  el.style.zIndex = String(item.z || 1);

  if (el.dataset.type === "background") {
    renderBackgroundContent(el);
    applyBackgroundPosition(el);
  }
}

  //Shape Element

function makeShapeEl({ x, y, w = 140, h = 140, title = "Shape", shapeType = "rectangle" } = {}) {
  const el = document.createElement("div");
  el.className = "da-item da-item--shape";

  el.dataset.type = "shape";
  el.dataset.id = uid("shape");
  el.dataset.name = title || "Shape";
  el.dataset.parent = "";

  el.dataset.shapeType = shapeType || "rectangle";
  el.dataset.bg = "#d9d9d9";
  el.dataset.bgOn = "1";

  el.dataset.borderOn = "0";
  el.dataset.borderWidth = "2";
  el.dataset.borderStyle = "solid";
  el.dataset.borderColor = "#111111";
  el.dataset.radius = "0";

  el.style.left = `${Math.round(x)}px`;
  el.style.top = `${Math.round(y)}px`;
  el.style.width = `${Math.round(w)}px`;
  el.style.height = `${Math.round(h)}px`;

  const all = grid.querySelectorAll(".da-item");
  const maxZ = [...all].reduce(
    (m, n) => Math.max(m, parseInt(n.style.zIndex || "1", 10)),
    1
  );
  el.style.zIndex = String(maxZ + 1);

  applyShapeStyles(el);

  el.innerHTML = `
    <div class="da-resize da-resize--nw" data-resize="nw"></div>
    <div class="da-resize da-resize--n"  data-resize="n"></div>
    <div class="da-resize da-resize--ne" data-resize="ne"></div>

    <div class="da-resize da-resize--w"  data-resize="w"></div>
    <div class="da-resize da-resize--e"  data-resize="e"></div>

    <div class="da-resize da-resize--sw" data-resize="sw"></div>
    <div class="da-resize da-resize--s"  data-resize="s"></div>
    <div class="da-resize da-resize--se" data-resize="se"></div>
  `;

  return el;
}
function applyShapeStyles(el) {
  if (!el || el.dataset.type !== "shape") return;

  const bgOn = el.dataset.bgOn !== "0";
  const bg = el.dataset.bg || "#d9d9d9";
  const borderOn = el.dataset.borderOn === "1";
  const borderWidth = parseInt(el.dataset.borderWidth || "0", 10) || 0;
  const borderStyle = el.dataset.borderStyle || "solid";
  const borderColor = el.dataset.borderColor || "#111111";
  const radius = parseInt(el.dataset.radius || "0", 10) || 0;
  const shapeType = el.dataset.shapeType || "rectangle";

  el.style.background = bgOn ? bg : "transparent";
  el.style.border = borderOn
    ? `${borderWidth}px ${borderStyle} ${borderColor}`
    : "none";

  if (shapeType === "circle") {
    el.style.borderRadius = "999px";
  } else if (shapeType === "pill") {
    el.style.borderRadius = "999px";
  } else {
    el.style.borderRadius = `${radius}px`;
  }
}


  //Image Element
  function makeImageEl({ x, y, src = "" }) {
  const el = document.createElement("div");
  el.className = "da-item da-item--image";
  el.dataset.type = "image";
  el.dataset.parallax = el.dataset.parallax || "0";

  el.dataset.id = uid("img");

  // defaults
  el.dataset.src = src;               // later we’ll set this from the bar
  el.dataset.fit = el.dataset.fit || "cover";  // cover | contain
  el.dataset.radius = el.dataset.radius || "12";

  el.style.left = `${Math.round(x)}px`;
  el.style.top  = `${Math.round(y)}px`;
  el.style.width = `220px`;
  el.style.height = `160px`;

  el.dataset.posX = el.dataset.posX || "50";
el.dataset.posY = el.dataset.posY || "50";

el.dataset.dynamicMode = el.dataset.dynamicMode || "static";
el.dataset.dynamicSource = el.dataset.dynamicSource || "page";
el.dataset.bindMode = el.dataset.bindMode || "single";
el.dataset.dynamicField = el.dataset.dynamicField || "";
el.dataset.selectedItemId = el.dataset.selectedItemId || "";
el.dataset.itemField = el.dataset.itemField || "";
el.dataset.itemDataType = el.dataset.itemDataType || "";
el.dataset.itemDataTypeId = el.dataset.itemDataTypeId || "";

el.dataset.borderWidth = el.dataset.borderWidth || "0";
el.dataset.borderColor = el.dataset.borderColor || "#111111";
el.dataset.borderStyle = el.dataset.borderStyle || "solid";
el.dataset.radius = el.dataset.radius || "12";

  const all = grid.querySelectorAll(".da-item");
  const maxZ = [...all].reduce((m, n) => Math.max(m, parseInt(n.style.zIndex || "1", 10)), 1);
  el.style.zIndex = String(maxZ + 1);

  el.innerHTML = `
    <img class="da-img" alt="" />

    <div class="da-resize da-resize--nw" data-resize="nw"></div>
    <div class="da-resize da-resize--n"  data-resize="n"></div>
    <div class="da-resize da-resize--ne" data-resize="ne"></div>
    <div class="da-resize da-resize--w"  data-resize="w"></div>
    <div class="da-resize da-resize--e"  data-resize="e"></div>
    <div class="da-resize da-resize--sw" data-resize="sw"></div>
    <div class="da-resize da-resize--s"  data-resize="s"></div>
    <div class="da-resize da-resize--se" data-resize="se"></div>
  `;

  const img = el.querySelector(".da-img");
  if (img) {
    // if no src yet, show a simple placeholder
    img.src = el.dataset.src || "data:image/svg+xml;charset=utf-8," + encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" width="400" height="260">
        <rect width="100%" height="100%" fill="#f3f3f3"/>
        <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle"
              font-family="system-ui, Arial" font-size="18" fill="#777">Drop image</text>
      </svg>
    `);

     img.style.objectPosition = `${el.dataset.posX}% ${el.dataset.posY}%`;
    img.style.objectFit = el.dataset.fit || "cover";
    img.style.borderRadius = `${parseInt(el.dataset.radius, 10) || 0}px`;
  }

  el.dataset.name = el.dataset.name || "Image";
  return el;
}



function normalizeImageValueToUrl(value) {
  if (!value) return "";

  // plain string
  if (typeof value === "string") {
    return value.trim();
  }

  // array
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = normalizeImageValueToUrl(item);
      if (found) return found;
    }
    return "";
  }

  // object
  if (typeof value === "object") {
    return (
      value.url ||
      value.src ||
      value.image ||
      value.fileUrl ||
      value.path ||
      value.value ||
      ""
    );
  }

  return "";
}

async function resolveDynamicImageValue(el) {
  if (!el) return "";

  const source = el.dataset.dynamicSource || "page";
  const field = el.dataset.dynamicField || "";

  if (!field) return "";

  let sourceRecord = null;

  if (source === "page") {
    sourceRecord = window.TPL_CURRENT_PAGE_ROW || currentPageRecord || null;
  }

  if (source === "parentGroup") {
    const parentGroup = getParentGroupContainer(el);
    if (!parentGroup) return "";
    sourceRecord = await getSelectedRecordFromGroup(parentGroup);
  }

  if (!sourceRecord) return "";

  let parentDataTypeName = "";
  let parentDataTypeId = "";

  if (source === "page") {
    const pageType = window.TPL_PAGE_TYPE || "booking";
    parentDataTypeName = getMainDataTypeForPageType(pageType) || "";
    parentDataTypeId = window.TPL_CURRENT_PAGE_DATATYPE_ID || "";
  }

  if (source === "parentGroup") {
    const parentGroup = getParentGroupContainer(el);
    parentDataTypeName =
      parentGroup?.dataset?.finalDataType ||
      parentGroup?.dataset?.itemDataType ||
      "";
    parentDataTypeId =
      parentGroup?.dataset?.finalDataTypeId ||
      parentGroup?.dataset?.itemDataTypeId ||
      "";
  }

  // ✅ DIRECT FIELD shortcut for image
  if (source === "parentGroup" && field) {
    const directValue = getFieldValueFromRecord(sourceRecord, field);

    console.log("[image/resolve] parentGroup directValue:", directValue);

    if (directValue !== undefined && directValue !== null && directValue !== "") {
      return normalizeImageValue(directValue);
    }
  }

  const mode = el.dataset.dynamicMode || "static";
  if (mode !== "dynamic") {
    return el.dataset.src || "";
  }

  const path = getDynamicPathFromElement(el);

  const result = await resolveDynamicPath({
    source: el.dataset.dynamicSource || "page",
    path
  });

  const value = result?.value;

  console.log("[image] resolved raw value:", value);

  if (!value) return "";

  if (typeof value === "string") return value;

  if (Array.isArray(value)) {
    const first = value[0];
    if (typeof first === "string") return first;
    if (typeof first === "object") {
      return first.url || first.src || first.path || "";
    }
    return "";
  }

  if (typeof value === "object") {
    return value.url || value.src || value.path || value.secure_url || "";
  }

  return "";
}


async function renderImageContent(el) {
  if (!el || el.dataset.type !== "image") return;

  const img = el.querySelector(".da-img");
  if (!img) return;

  let finalSrc = "";

  if ((el.dataset.dynamicMode || "static") === "dynamic") {
    finalSrc = await resolveDynamicImageValue(el);
  } else {
    finalSrc = el.dataset.src || "";
  }

  console.log("[image] final resolved src:", finalSrc);

  if (finalSrc) {
    img.src = finalSrc;
  } else {
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" width="400" height="260">
        <rect width="100%" height="100%" fill="#f3f3f3"/>
        <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle"
              font-family="system-ui, Arial" font-size="18" fill="#777">Drop image</text>
      </svg>
    `);
  }

  img.style.objectFit = el.dataset.fit || "cover";

 const zx = 1.4;
  img.style.transform = `scale(${zx})`;

  const px = parseFloat(el.dataset.posX || "50");
  const py = parseFloat(el.dataset.posY || "50");
  img.style.objectPosition = `${px}% ${py}%`;

  const rad = parseInt(el.dataset.radius || "0", 10) || 0;
  img.style.borderRadius = `${rad}px`;
}

//Image dropdown loader helper 
async function populateImageDynamicFieldOptions(item = selectedItem) {
  if (!imgDynamicFieldEl) return;

  const source = imgDynamicSourceEl?.value || "page";
  const currentValue = item?.dataset?.dynamicField || "";

  imgDynamicFieldEl.innerHTML = `<option value="">Select image field</option>`;

  if (source === "page") {
    const pageType = window.TPL_PAGE_TYPE || "booking";
    const dataTypeName = getMainDataTypeForPageType(pageType);
    const dataTypeId = window.TPL_CURRENT_PAGE_DATATYPE_ID || "";

    if (!dataTypeName && !dataTypeId) return;

    const fields = await getFieldsForDataType(dataTypeName, dataTypeId);

    const seen = new Set();

    fields.forEach((field) => {
      const fieldName =
        field?.name ||
        field?.fieldName ||
        field?.label ||
        "";

      const key = String(fieldName).trim().toLowerCase();
      if (!fieldName) return;
      if (seen.has(key)) return;

      seen.add(key);

      const option = document.createElement("option");
      option.value = fieldName;
      option.textContent = fieldName;
      imgDynamicFieldEl.appendChild(option);
    });
  }

if (source === "parentGroup" && item) {
  const parentGroup = getParentGroupContainer(item);

  const dataTypeName =
    parentGroup?.dataset?.finalDataType ||
    parentGroup?.dataset?.itemDataType ||
    "";

  const dataTypeId =
    parentGroup?.dataset?.finalDataTypeId ||
    parentGroup?.dataset?.itemDataTypeId ||
    "";

  if (!dataTypeName && !dataTypeId) return;

  const fields = await getFieldsForDataType(dataTypeName, dataTypeId);

    const seen = new Set();

    fields.forEach((field) => {
      const fieldName =
        field?.name ||
        field?.fieldName ||
        field?.label ||
        "";

      const key = String(fieldName).trim().toLowerCase();
      if (!fieldName) return;
      if (seen.has(key)) return;

      seen.add(key);

      const option = document.createElement("option");
      option.value = fieldName;
      option.textContent = fieldName;
      imgDynamicFieldEl.appendChild(option);
    });
  }

  if ([...imgDynamicFieldEl.options].some((o) => o.value === currentValue)) {
    imgDynamicFieldEl.value = currentValue;
  }
} 


























  //Text Element
function makeTextEl({ x, y, text = "Type here" }) {
  const el = document.createElement("div");
  el.className = "da-item da-item--text";
  el.dataset.type = "text";
  el.dataset.id = uid("text");
el.dataset.fontFamily = el.dataset.fontFamily || "system-ui";

el.dataset.selectedRecordId = el.dataset.selectedRecordId || "";
el.dataset.recordField = el.dataset.recordField || "";

el.dataset.text = text;
el.dataset.dynamicMode = "static";
el.dataset.dynamicSource = "page";
el.dataset.dynamicField = "";

el.dataset.actionType = el.dataset.actionType || "none";
el.dataset.actionTarget = el.dataset.actionTarget || "";
el.dataset.actionSource = el.dataset.actionSource || "page";

el.dataset.selectedRecordId = el.dataset.selectedRecordId || "";
el.dataset.nestedField = el.dataset.nestedField || "";
el.dataset.nestedSelectedRecordId = el.dataset.nestedSelectedRecordId || "";
el.dataset.recordField = el.dataset.recordField || "";
  // defaults (stored on element)
  el.dataset.fontSize = el.dataset.fontSize || "24";
  el.dataset.bold     = el.dataset.bold || "0";
  el.dataset.italic   = el.dataset.italic || "0";
  el.dataset.underline = el.dataset.underline || "0";
  el.dataset.align    = el.dataset.align || "left"; // left | center | right

  el.style.left = `${Math.round(x)}px`;
  el.style.top  = `${Math.round(y)}px`;
  el.style.width  = `240px`;
  el.style.height = `48px`;

  const all = grid.querySelectorAll(".da-item");
  const maxZ = [...all].reduce((m, n) => Math.max(m, parseInt(n.style.zIndex || "1", 10)), 1);
  el.style.zIndex = String(maxZ + 1);

  // store text
  el.dataset.text = text;

  el.innerHTML = `
    <div class="da-text" contenteditable="true" spellcheck="false"></div>

    <div class="da-resize da-resize--nw" data-resize="nw"></div>
    <div class="da-resize da-resize--n"  data-resize="n"></div>
    <div class="da-resize da-resize--ne" data-resize="ne"></div>
    <div class="da-resize da-resize--w"  data-resize="w"></div>
    <div class="da-resize da-resize--e"  data-resize="e"></div>
    <div class="da-resize da-resize--sw" data-resize="sw"></div>
    <div class="da-resize da-resize--s"  data-resize="s"></div>
    <div class="da-resize da-resize--se" data-resize="se"></div>
  `;

const textEl = el.querySelector(".da-text");
renderTextContent(el);

  // apply styles from dataset
  const fs = parseInt(el.dataset.fontSize, 10) || 24;
  textEl.style.fontFamily = el.dataset.fontFamily || "system-ui";

  textEl.style.fontSize = `${fs}px`;
  textEl.style.fontWeight = (el.dataset.bold === "1") ? "700" : "400";
  textEl.style.fontStyle  = (el.dataset.italic === "1") ? "italic" : "normal";
  textEl.style.textDecoration = (el.dataset.underline === "1") ? "underline" : "none";
  textEl.style.textAlign = el.dataset.align || "left";

  // keep dataset in sync when user types
textEl.addEventListener("input", () => {
  if (el.dataset.dynamicMode === "dynamic") return;
  el.dataset.text = textEl.textContent || "";
});

  // allow typing without starting drag
  textEl.addEventListener("mousedown", (ev) => {
    ev.stopPropagation();
  });

  textEl.addEventListener("click", (ev) => {
  if (!window.TPL_PREVIEW) return;
  if ((el.dataset.actionType || "none") === "none") return;

  handleElementAction(ev, el);
});

  return el;
}

async function resolveDynamicTextValue(el) {
  if (!el) return "";

  const mode = el.dataset.dynamicMode || "static";
  if (mode !== "dynamic") {
    return el.dataset.text || "";
  }

  const source = el.dataset.dynamicSource || "page";
  const field = el.dataset.dynamicField || "";
  const selectedRecordId = el.dataset.selectedRecordId || "";
  const nestedField = el.dataset.nestedField || "";
  const nestedSelectedRecordId = el.dataset.nestedSelectedRecordId || "";
  const recordField = el.dataset.recordField || "";

  console.log("[text/resolve] mode:", mode);
  console.log("[text/resolve] source:", source);
  console.log("[text/resolve] field:", field);
  console.log("[text/resolve] selectedRecordId:", selectedRecordId);
  console.log("[text/resolve] nestedField:", nestedField);
  console.log("[text/resolve] nestedSelectedRecordId:", nestedSelectedRecordId);
  console.log("[text/resolve] recordField:", recordField);
  console.log("[text/resolve] el:", el);

  if (!field) return "";

  let sourceRecord = null;
  let sourceRecordId = "";

  if (source === "page") {
    sourceRecord = window.TPL_CURRENT_PAGE_ROW || currentPageRecord || null;
    sourceRecordId = String(getRecordId(sourceRecord));
  }

  if (source === "parentGroup") {
    const parentGroup = getParentGroupContainer(el);
    if (!parentGroup) return "";
    sourceRecord = await getSelectedRecordFromGroup(parentGroup);
    sourceRecordId = String(getRecordId(sourceRecord));
  }

  console.log("[text/resolve] sourceRecord:", sourceRecord);
  console.log("[text/resolve] sourceRecordId:", sourceRecordId);

  if (!sourceRecord) return "";

  let parentDataTypeName = "";
  let parentDataTypeId = "";

  if (source === "page") {
    const pageType = window.TPL_PAGE_TYPE || "booking";
    parentDataTypeName = getMainDataTypeForPageType(pageType) || "";
    parentDataTypeId = window.TPL_CURRENT_PAGE_DATATYPE_ID || "";
  }

  if (source === "parentGroup") {
    const parentGroup = getParentGroupContainer(el);
    parentDataTypeName =
      parentGroup?.dataset?.finalDataType ||
      parentGroup?.dataset?.itemDataType ||
      "";
    parentDataTypeId =
      parentGroup?.dataset?.finalDataTypeId ||
      parentGroup?.dataset?.itemDataTypeId ||
      "";
  }

  // ✅ DIRECT FIELD shortcut for Parent Group
  // If sourceRecord already is the parent group's selected record,
  // and the chosen field is a plain field (not a reference),
  // return it directly.
  if (source === "parentGroup" && field && !selectedRecordId && !nestedField) {
    const directValue = getFieldValueFromRecord(sourceRecord, field);

    console.log("[text/resolve] parentGroup directValue:", directValue);

    if (directValue !== undefined) {
      return normalizeTextValue(directValue);
    }
  }

  const firstMeta = await getRelatedDataTypeMetaFromField(
    field,
    parentDataTypeName,
    parentDataTypeId
  );

  console.log("[text/resolve] firstMeta:", firstMeta);

  if (!firstMeta?.name) return "";

  const firstRows = await fetchRowsForDynamicReference(
    firstMeta.name,
    firstMeta.id || ""
  );

  console.log("[text/resolve] firstRows:", firstRows);

  let selectedRecord = firstRows.find((row, index) => {
    return String(getRecordId(row, index)) === String(selectedRecordId);
  });

  // reverse lookup fallback for first hop
  if (!selectedRecord && sourceRecordId) {
    selectedRecord = firstRows.find((row) => {
      const reverseValue =
        getFieldValueFromRecord(row, parentDataTypeName) ||
        getFieldValueFromRecord(row, "Location") ||
        getFieldValueFromRecord(row, "location");

      const reverseIds = extractRefIds(reverseValue);
      return reverseIds.includes(sourceRecordId);
    });
  }

  console.log("[text/resolve] selectedRecord:", selectedRecord);

  if (!selectedRecord) return "";

  // one-hop mode
  if (!nestedField) {
    if (!recordField) {
      const labelValue = getRecordLabel(selectedRecord);
      console.log("[text/resolve] final label value:", labelValue);
      return normalizeTextValue(labelValue);
    }

    const value = getFieldValueFromRecord(selectedRecord, recordField);
    console.log("[text/resolve] final value:", value);
    return normalizeTextValue(value);
  }

  const secondMeta = await getRelatedDataTypeMetaFromField(
    nestedField,
    firstMeta.name,
    firstMeta.id || ""
  );

  console.log("[text/resolve] secondMeta:", secondMeta);

  if (!secondMeta?.name) return "";

  const secondRows = await fetchRowsForDynamicReference(
    secondMeta.name,
    secondMeta.id || ""
  );

  console.log("[text/resolve] secondRows:", secondRows);

  const nestedValue = getFieldValueFromRecord(selectedRecord, nestedField);
  const nestedRefIds = extractRefIds(nestedValue);

  console.log("[text/nestedRecords] selectedRecord values:", selectedRecord?.values);
console.log("[text/nestedRecords] nestedField exact:", nestedField);
console.log("[text/nestedRecords] nestedValue:", nestedValue);
console.log("[text/nestedRecords] nestedRefIds:", nestedRefIds);
  console.log("[text/resolve] nestedValue:", nestedValue);
  console.log("[text/resolve] nestedRefIds:", nestedRefIds);

let nestedSelectedRecord = secondRows.find((row, index) => {
  return String(getRecordId(row, index)) === String(nestedSelectedRecordId);
});

if (!nestedSelectedRecord && nestedRefIds.length) {
  nestedSelectedRecord = secondRows.find((row, index) => {
    return nestedRefIds.includes(String(getRecordId(row, index)));
  });
}

// reverse lookup fallback: User/Suitie points back to Suite
if (!nestedSelectedRecord && selectedRecord) {
  const selectedSuiteId = String(getRecordId(selectedRecord));

  nestedSelectedRecord = secondRows.find((row) => {
    const reverseValue =
      getFieldValueFromRecord(row, firstMeta.name) ||   // e.g. "Suite"
      getFieldValueFromRecord(row, "Suite") ||
      getFieldValueFromRecord(row, "suite");

    const reverseIds = extractRefIds(reverseValue);
    return reverseIds.includes(selectedSuiteId);
  });
}
  console.log("[text/resolve] nestedSelectedRecord:", nestedSelectedRecord);

  if (!nestedSelectedRecord) return "";

  if (!recordField) {
    const nestedLabel = getRecordLabel(nestedSelectedRecord);
    console.log("[text/resolve] final nested label value:", nestedLabel);
    return normalizeTextValue(nestedLabel);
  }

  const finalValue = getFieldValueFromRecord(nestedSelectedRecord, recordField);
  console.log("[text/resolve] final nested value:", finalValue);
  return normalizeTextValue(finalValue);
}





function normalizeTextValue(value) {
  if (value === null || value === undefined) return "";

  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (item === null || item === undefined) return "";

        if (typeof item === "object") {
          return (
            item.name ||
            item.title ||
            item.label ||
            item._id ||
            item.id ||
            JSON.stringify(item)
          );
        }

        return String(item);
      })
      .filter(Boolean)
      .join(", ");
  }

  if (typeof value === "object") {
    return (
      value.name ||
      value.title ||
      value.label ||
      value._id ||
      value.id ||
      JSON.stringify(value)
    );
  }

  return String(value);
}

function getSourceBaseInfo(source, item) {
  const pageType = window.TPL_PAGE_TYPE || "booking";

  if (source === "page") {
    return {
      parentDataTypeName: getMainDataTypeForPageType(pageType),
      parentDataTypeId: window.TPL_CURRENT_PAGE_DATATYPE_ID || "",
      sourceRecord: currentPageRecord || null,
    };
  }

  if (source === "parentGroup") {
    const parentGroup = getParentGroupContainer(item);
    return {
      parentDataTypeName: parentGroup?.dataset?.itemDataType || "",
      parentDataTypeId: parentGroup?.dataset?.itemDataTypeId || "",
      sourceRecord: parentGroup || null,
    };
  }

  if (source === "parentSection") {
    return {
      parentDataTypeName:
        getParentContainerDataType(item) ||
        getMainDataTypeForPageType(pageType),
      parentDataTypeId: "",
      sourceRecord: null,
    };
  }

  return {
    parentDataTypeName: "",
    parentDataTypeId: "",
    sourceRecord: null,
  };
}

function normalizeRefId(value) {
  if (!value) return "";

  if (Array.isArray(value)) return normalizeRefId(value[0]);

  if (typeof value === "object") {
    return String(value._id || value.id || value.value || "").trim();
  }

  return String(value).trim();
}

function extractRefIds(value) {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value.map(normalizeRefId).filter(Boolean);
  }

  const one = normalizeRefId(value);
  return one ? [one] : [];
}












function getFieldValueFromRecord(record, field) {
  if (!record || !field) return undefined;

  // direct field
  if (record[field] !== undefined) {
    return record[field];
  }

  // nested values (THIS is your case)
  if (record.values && record.values[field] !== undefined) {
    return record.values[field];
  }

  // fallback: case-insensitive match
  const lowerField = String(field).toLowerCase();

  // check record
  for (const key in record) {
    if (key.toLowerCase() === lowerField) {
      return record[key];
    }
  }

  // check values
  if (record.values) {
    for (const key in record.values) {
      if (key.toLowerCase() === lowerField) {
        return record.values[key];
      }
    }
  }

  return undefined;
}

function recordMatchesByIds(row, idsToMatch) {
  if (!idsToMatch?.length) return false;

  const values = row?.values || row || {};

  for (const key of Object.keys(values)) {
    const refIds = extractRefIds(values[key]);
    if (!refIds.length) continue;

    if (refIds.some((id) => idsToMatch.includes(String(id)))) {
      return true;
    }
  }

  return false;
}





async function getSelectedRecordFromGroup(groupEl) {
  if (!groupEl) return null;

  const nestedSelectedId = groupEl.dataset.nestedSelectedItemId || "";
  const selectedId = groupEl.dataset.selectedItemId || "";

  // ✅ if the group has a nested selected item, return that first
  if (nestedSelectedId) {
    const finalDataType = groupEl.dataset.finalDataType || "";
    const finalDataTypeId = groupEl.dataset.finalDataTypeId || "";

    if (finalDataType) {
      const rows = await fetchRowsForDynamicReference(
        finalDataType,
        finalDataTypeId || ""
      );

      const nestedRecord =
        rows.find((row, index) => {
          return String(getRecordId(row, index)) === String(nestedSelectedId);
        }) || null;

      if (nestedRecord) return nestedRecord;
    }
  }

  // fallback = first-level selected item
  if (!selectedId) return null;

  const list = await getDynamicRecordList(groupEl);
  if (!Array.isArray(list)) return null;

  return (
    list.find((entry, index) => {
      return String(getRecordId(entry, index)) === String(selectedId);
    }) || null
  );
}

function getRecordValues(record) {
  return record?.values || record || {};
}

function getRecordId(record, index = 0) {
  return (
    record?._id ||
    record?.id ||
    record?.values?._id ||
    record?.values?.id ||
    String(index)
  );
}

function rowHasReferenceToId(row, targetId) {
  if (!row || !targetId) return false;

  const values = getRecordValues(row);

  return Object.values(values).some((raw) => {
    const ids = extractRefIds(raw);
    return ids.includes(String(targetId));
  });
}

async function getDynamicRecordList(item) {
  if (!item) return [];

  const source = item.dataset.dynamicSource || "page";
  const field = item.dataset.dynamicField || "";

  console.log("[dynamic-list] source:", source);
  console.log("[dynamic-list] field:", field);

  if (!field) return [];

  let sourceRecord = null;
  let sourceRecordId = "";

  if (source === "page") {
    sourceRecord = window.TPL_CURRENT_PAGE_ROW || currentPageRecord || null;
    sourceRecordId = getSelectedPageId() || "";
  }

  if (source === "parentGroup") {
    const parentGroup = getParentGroupContainer(item);
    if (!parentGroup) return [];

    sourceRecord = await getSelectedRecordFromGroup(parentGroup);
    if (!sourceRecord) return [];

    sourceRecordId = String(getRecordId(sourceRecord));
  }

  const directValue = getFieldValueFromRecord(sourceRecord, field);
  const directIds = extractRefIds(directValue);

  console.log("[dynamic-list] directValue:", directValue);
  console.log("[dynamic-list] directIds:", directIds);
  console.log("[dynamic-list] sourceRecordId:", sourceRecordId);

  const { parentDataTypeName, parentDataTypeId } = getSourceBaseInfo(source, item);

  const relatedMeta = await getRelatedDataTypeMetaFromField(
    field,
    parentDataTypeName,
    parentDataTypeId
  );

  console.log("[dynamic-list] relatedMeta:", relatedMeta);

  if (!relatedMeta?.name) return [];

  try {
    if (!currentUser?.id) return [];

    const rows = await fetchRowsForDynamicReference(
      relatedMeta.name,
      relatedMeta.id || ""
    );

    console.log("[dynamic-list] fetched rows:", rows);

    if (directIds.length) {
      const matchedById = rows.filter((row, index) => {
        const rowId = String(getRecordId(row, index));
        return directIds.includes(rowId);
      });

      console.log("[dynamic-list] matchedById:", matchedById);

      if (matchedById.length) return matchedById;
    }

    if (sourceRecordId) {
      const reverseMatched = rows.filter((row) =>
        rowHasReferenceToId(row, sourceRecordId)
      );

      console.log("[dynamic-list] reverseMatched:", reverseMatched);

      if (reverseMatched.length) return reverseMatched;
    }

    if (directIds.length) {
      const matchedByRelationship = rows.filter((row) =>
        recordMatchesByIds(row, directIds)
      );

      console.log("[dynamic-list] matchedByRelationship:", matchedByRelationship);

      if (matchedByRelationship.length) return matchedByRelationship;
    }

    const selectedPageId = getSelectedPageId();
    const fallback = selectedPageId
      ? rows.filter((row) => recordBelongsToParent(row, selectedPageId))
      : [];

    console.log("[dynamic-list] fallback rows:", fallback);

    return fallback;
  } catch (err) {
    console.error("[dynamic-list] failed to load related records", err);
    return [];
  }
}


async function renderTextContent(el) {
  if (!el || el.dataset.type !== "text") return;

  const t = el.querySelector(".da-text");
  if (!t) return;

  t.textContent = await resolveDynamicTextValue(el);

  t.style.color = el.dataset.color || "#111111";
  t.style.fontSize = `${parseInt(el.dataset.fontSize, 10) || 24}px`;
  t.style.fontFamily = el.dataset.fontFamily || "system-ui";
  t.style.fontWeight = el.dataset.bold === "1" ? "700" : "400";
  t.style.fontStyle = el.dataset.italic === "1" ? "italic" : "normal";
  t.style.textDecoration = el.dataset.underline === "1" ? "underline" : "none";
  t.style.textAlign = el.dataset.align || "left";
}



async function populateDynamicFieldOptions(item = selectedItem) {
  if (!textDynamicFieldEl) return;

  const source = textDynamicSourceEl?.value || "page";
  const currentValue = item?.dataset?.dynamicField || "";

  console.log("[text/fields] source:", source);
  console.log("[text/fields] currentValue:", currentValue);

  textDynamicFieldEl.innerHTML = `<option value="">Select dynamic field</option>`;

  if (source === "page") {
    const pageType = window.TPL_PAGE_TYPE || "booking";
    const dataTypeName = getMainDataTypeForPageType(pageType);
    const dataTypeId = window.TPL_CURRENT_PAGE_DATATYPE_ID || "";

    console.log("[text/fields] page dataTypeName:", dataTypeName);
    console.log("[text/fields] page dataTypeId:", dataTypeId);

    if (!dataTypeName && !dataTypeId) return;

    const fields = await getFieldsForDataType(dataTypeName, dataTypeId);
    console.log("[text/fields] page fields:", fields);
console.log("[debug] window.TPL_PAGE_TYPE:", window.TPL_PAGE_TYPE);
console.log("[debug] window.TPL_CURRENT_PAGE_DATATYPE_ID:", window.TPL_CURRENT_PAGE_DATATYPE_ID);
console.log("[debug] asking fields for:", { dataTypeName, dataTypeId });

    const seen = new Set();

    fields.forEach((field) => {
      const fieldKey =
        field?.fieldName ||
        field?.name ||
        field?.label ||
        "";

      const fieldLabel =
        field?.label ||
        field?.name ||
        fieldKey;

      const key = String(fieldKey).trim().toLowerCase();
      if (!fieldKey) return;
      if (seen.has(key)) return;

      seen.add(key);

      const option = document.createElement("option");
      option.value = fieldKey;
      option.textContent = fieldLabel;
      textDynamicFieldEl.appendChild(option);
    });
  }

if (source === "parentGroup" && item) {
  const parentGroup = getParentGroupContainer(item);

  const dataTypeName =
    parentGroup?.dataset?.finalDataType ||
    parentGroup?.dataset?.itemDataType ||
    "";

  const dataTypeId =
    parentGroup?.dataset?.finalDataTypeId ||
    parentGroup?.dataset?.itemDataTypeId ||
    "";

  console.log("[text/fields] parentGroup dataTypeName:", dataTypeName);
  console.log("[text/fields] parentGroup dataTypeId:", dataTypeId);

  if (!dataTypeName && !dataTypeId) return;

  const fields = await getFieldsForDataType(dataTypeName, dataTypeId);

    console.log("[text/fields] parentGroup fields:", fields);

    const seen = new Set();

    fields.forEach((field) => {
      const fieldKey =
        field?.fieldName ||
        field?.name ||
        field?.label ||
        "";

      const fieldLabel =
        field?.label ||
        field?.name ||
        fieldKey;

      const key = String(fieldKey).trim().toLowerCase();
      if (!fieldKey) return;
      if (seen.has(key)) return;

      seen.add(key);

      const option = document.createElement("option");
      option.value = fieldKey;
      option.textContent = fieldLabel;
      textDynamicFieldEl.appendChild(option);
    });
  }

  if ([...textDynamicFieldEl.options].some((o) => o.value === currentValue)) {
    textDynamicFieldEl.value = currentValue;
  } else {
    textDynamicFieldEl.value = "";
    if (item) item.dataset.dynamicField = "";
  }

  console.log(
    "[text/fields] final options:",
    [...textDynamicFieldEl.options].map(o => ({
      value: o.value,
      text: o.textContent
    }))
  );
}

window.populateDynamicFieldOptions = populateDynamicFieldOptions;

async function getRelatedDataTypeMetaFromField(fieldName, parentDataTypeName, parentDataTypeId = "") {
  const cleanField = String(fieldName || "").trim().toLowerCase();
  const cleanParent = String(parentDataTypeName || "").trim();

  if (!cleanField || !cleanParent) {
    return { name: "", id: "" };
  }

  const fields = await getFieldsForDataType(cleanParent, parentDataTypeId);

  const match = fields.find((field) => {
    const name =
      field?.name ||
      field?.fieldName ||
      field?.label ||
      "";

    return String(name).trim().toLowerCase() === cleanField;
  });

  if (!match) {
    return { name: "", id: "" };
  }

  let referenceTo =
    match?.referenceTo ||
    match?.referenceDataType ||
    match?.relatedDataType ||
    match?.dataTypeName ||
    match?.options?.referenceTo ||
    "";

  let referenceId =
    match?.referenceToId ||
    match?.referenceDataTypeId ||
    match?.relatedDataTypeId ||
    match?.options?.referenceToId ||
    "";

  if (referenceTo && typeof referenceTo === "object") {
    referenceId =
      referenceTo._id ||
      referenceTo.id ||
      referenceId ||
      "";

    referenceTo =
      referenceTo.name ||
      referenceTo.label ||
      referenceTo.dataTypeName ||
      "";
  }

  return {
    name: String(referenceTo || "").trim(),
    id: String(referenceId || "").trim(),
  };
}
async function populateTextNestedSelectedRecordOptions(item = selectedItem) {
  if (!textNestedSelectedRecordEl || !item) return;

  const source = item.dataset.dynamicSource || "page";
  const field = item.dataset.dynamicField || "";
  const selectedRecordId = item.dataset.selectedRecordId || "";
  const nestedField = item.dataset.nestedField || "";
  const currentValue = item.dataset.nestedSelectedRecordId || "";

  console.log("[text/nestedRecords] source:", source);
  console.log("[text/nestedRecords] field:", field);
  console.log("[text/nestedRecords] selectedRecordId:", selectedRecordId);
  console.log("[text/nestedRecords] nestedField:", nestedField);
  console.log("[text/nestedRecords] currentValue:", currentValue);

  textNestedSelectedRecordEl.innerHTML = `<option value="">Select nested item</option>`;

  if (!field || !selectedRecordId || !nestedField) return;

  let parentDataTypeName = "";
  let parentDataTypeId = "";

  if (source === "page") {
    const pageType = window.TPL_PAGE_TYPE || "booking";
    parentDataTypeName = getMainDataTypeForPageType(pageType) || "";
    parentDataTypeId = window.TPL_CURRENT_PAGE_DATATYPE_ID || "";
  }

if (source === "parentGroup") {
  const parentGroup = getParentGroupContainer(item);
  parentDataTypeName =
    parentGroup?.dataset?.finalDataType ||
    parentGroup?.dataset?.itemDataType ||
    "";
  parentDataTypeId =
    parentGroup?.dataset?.finalDataTypeId ||
    parentGroup?.dataset?.itemDataTypeId ||
    "";
}

  const firstMeta = await getRelatedDataTypeMetaFromField(
    field,
    parentDataTypeName,
    parentDataTypeId
  );

  console.log("[text/nestedRecords] firstMeta:", firstMeta);

  if (!firstMeta?.name) return;

  const firstRows = await fetchRowsForDynamicReference(
    firstMeta.name,
    firstMeta.id || ""
  );

  const selectedRecord = firstRows.find((row, index) => {
    return String(getRecordId(row, index)) === String(selectedRecordId);
  });

  console.log("[text/nestedRecords] selectedRecord:", selectedRecord);
  console.log("[text/nestedRecords] selectedRecord values:", selectedRecord?.values);

  if (!selectedRecord) return;

  const nestedValue = getFieldValueFromRecord(selectedRecord, nestedField);
  const nestedRefIds = extractRefIds(nestedValue);

  console.log("[text/nestedRecords] nestedField exact:", nestedField);
  console.log("[text/nestedRecords] nestedValue:", nestedValue);
  console.log("[text/nestedRecords] nestedRefIds:", nestedRefIds);

  const secondMeta = await getRelatedDataTypeMetaFromField(
    nestedField,
    firstMeta.name,
    firstMeta.id || ""
  );

  console.log("[text/nestedRecords] secondMeta:", secondMeta);

  if (!secondMeta?.name) return;

  const secondRows = await fetchRowsForDynamicReference(
    secondMeta.name,
    secondMeta.id || ""
  );

  console.log("[text/nestedRecords] secondRows:", secondRows);

  let matchedRows = [];

  // 1) direct ID match
  if (nestedRefIds.length) {
    matchedRows = secondRows.filter((row, index) => {
      const rowId = String(getRecordId(row, index));
      return nestedRefIds.includes(rowId);
    });

    console.log("[text/nestedRecords] matchedRows by direct ids:", matchedRows);
  }

  // 2) scalar id fallback
  if (!matchedRows.length && nestedValue != null && typeof nestedValue !== "object") {
    matchedRows = secondRows.filter((row, index) => {
      const rowId = String(getRecordId(row, index));
      return rowId === String(nestedValue);
    });

    console.log("[text/nestedRecords] matchedRows by scalar value:", matchedRows);
  }

  // 3) object-with-id fallback
  if (!matchedRows.length && nestedValue && typeof nestedValue === "object" && !Array.isArray(nestedValue)) {
    const possibleId =
      nestedValue?._id ||
      nestedValue?.id ||
      nestedValue?.value ||
      "";

    if (possibleId) {
      matchedRows = secondRows.filter((row, index) => {
        const rowId = String(getRecordId(row, index));
        return rowId === String(possibleId);
      });
    }

    console.log("[text/nestedRecords] matchedRows by object id:", matchedRows);
  }

  // 4) reverse lookup fallback
  if (!matchedRows.length && selectedRecord) {
    const selectedFirstId = String(getRecordId(selectedRecord));

    matchedRows = secondRows.filter((row) => {
      const reverseValue =
        getFieldValueFromRecord(row, firstMeta.name) ||   // e.g. "Suite"
        getFieldValueFromRecord(row, "Suite") ||
        getFieldValueFromRecord(row, "suite");

      const reverseIds = extractRefIds(reverseValue);
      return reverseIds.includes(selectedFirstId);
    });

    console.log("[text/nestedRecords] matchedRows by reverse lookup:", matchedRows);
  }

  matchedRows.forEach((entry, index) => {
    const option = document.createElement("option");
    const value = String(getRecordId(entry, index));
    option.value = value;
    option.textContent = getRecordLabel(entry, index);
    textNestedSelectedRecordEl.appendChild(option);
  });

  if ([...textNestedSelectedRecordEl.options].some((o) => o.value === currentValue)) {
    textNestedSelectedRecordEl.value = currentValue;
  }

  console.log(
    "[text/nestedRecords] final options:",
    [...textNestedSelectedRecordEl.options].map((o) => ({
      value: o.value,
      text: o.textContent
    }))
  );
}
async function populateGroupDynamicFieldOptions(item = selectedItem) {
  if (!groupDynamicFieldEl || !item) return;

  console.log("[group-fields] populateGroupDynamicFieldOptions fired");

  const source = item.dataset.dynamicSource || "parentSection";
  const pageType = window.TPL_PAGE_TYPE || "booking";

  let dataTypeName = "";
  let dataTypeId = "";

  if (source === "page") {
    dataTypeName = getMainDataTypeForPageType(pageType);
    dataTypeId = window.TPL_CURRENT_PAGE_DATATYPE_ID || "";
  }

  if (source === "parentSection") {
    dataTypeName =
      getParentContainerDataType(item) ||
      getMainDataTypeForPageType(pageType);
  }

  console.log("[group-fields] dataTypeName:", dataTypeName);
  console.log("[group-fields] dataTypeId:", dataTypeId);

  const currentValue = item.dataset.dynamicField || "";
  groupDynamicFieldEl.innerHTML = `<option value="">Select field</option>`;

  if (!dataTypeName && !dataTypeId) return;

  const fields = await getFieldsForDataType(dataTypeName, dataTypeId);
  console.log("[group-fields] fields returned:", fields);

  const seen = new Set();

  fields.forEach((field) => {
    const fieldName =
      field?.name ||
      field?.fieldName ||
      field?.label ||
      "";

    const fieldType =
      field?.type ||
      field?.fieldType ||
      "";

    let referenceTo =
      field?.referenceTo ||
      field?.referenceDataType ||
      field?.relatedDataType ||
      field?.dataTypeName ||
      field?.options?.referenceTo ||
      "";

    if (referenceTo && typeof referenceTo === "object") {
      referenceTo =
        referenceTo.name ||
        referenceTo.label ||
        referenceTo.dataTypeName ||
        referenceTo._id ||
        "";
    }

    const isReference =
      String(fieldType).toLowerCase().includes("reference") ||
      !!referenceTo;

    const key = String(fieldName).trim().toLowerCase();

    if (!fieldName || !isReference) return;
    if (seen.has(key)) return;

    seen.add(key);

    const option = document.createElement("option");
    option.value = fieldName;
    option.textContent = fieldName;
    groupDynamicFieldEl.appendChild(option);
  });

  if ([...groupDynamicFieldEl.options].some((o) => o.value === currentValue)) {
    groupDynamicFieldEl.value = currentValue;
  }
}

function buildDynamicConfigFromTextBar() {
  return {
    mode: textModeEl?.value || "static",
    source: textDynamicSourceEl?.value || "page",
    path: [
      {
        field: textDynamicFieldEl?.value || "",
        selectedId: textSelectedRecordEl?.value || "",
      },
      {
        field: textNestedFieldEl?.value || "",
        selectedId: textNestedSelectedRecordEl?.value || "",
      },
    ].filter(step => step.field),
    finalField: textRecordFieldEl?.value || "",
  };
}

async function applyTextDynamicFromBar() {
  if (!selectedItem) return;
  if (selectedItem.dataset.type !== "text") return;

  const config = buildDynamicConfigFromTextBar();

  // new shared config
  selectedItem.dataset.dynamicConfig = JSON.stringify(config);

  console.log("[text/apply] dynamicConfig:", selectedItem.dataset.dynamicConfig);
  // keep old fields for now so existing code still works
  selectedItem.dataset.dynamicMode = config.mode;
  selectedItem.dataset.dynamicSource = config.source;
  selectedItem.dataset.dynamicField = config.path[0]?.field || "";
  selectedItem.dataset.selectedRecordId = config.path[0]?.selectedId || "";
  selectedItem.dataset.nestedField = config.path[1]?.field || "";
  selectedItem.dataset.nestedSelectedRecordId = config.path[1]?.selectedId || "";
  selectedItem.dataset.recordField = config.finalField || "";
  console.log("[text/apply] mode:", selectedItem.dataset.dynamicMode);
  console.log("[text/apply] source:", selectedItem.dataset.dynamicSource);
  console.log("[text/apply] dynamicField:", selectedItem.dataset.dynamicField);
  console.log("[text/apply] selectedRecordId:", selectedItem.dataset.selectedRecordId);
  console.log("[text/apply] nestedField:", selectedItem.dataset.nestedField);
  console.log("[text/apply] nestedSelectedRecordId:", selectedItem.dataset.nestedSelectedRecordId);
  console.log("[text/apply] recordField:", selectedItem.dataset.recordField);
  console.log("[text/apply] selectedItem:", selectedItem);

  const textEl = selectedItem.querySelector(".da-text");
  if (textEl) {
    textEl.contentEditable =
      selectedItem.dataset.dynamicMode === "dynamic" ? "false" : "true";
  }

  const showDynamicStuff = selectedItem.dataset.dynamicMode === "dynamic";
  const showSelectedRecord =
    showDynamicStuff && !!selectedItem.dataset.dynamicField;
  const showNestedField =
    showSelectedRecord && !!selectedItem.dataset.selectedRecordId;
  const showNestedSelectedRecord =
    showNestedField && !!selectedItem.dataset.nestedField;
  const showRecordField =
    (showNestedSelectedRecord && !!selectedItem.dataset.nestedSelectedRecordId) ||
    (showSelectedRecord && !!selectedItem.dataset.selectedRecordId && !selectedItem.dataset.nestedField);

  if (textDynamicSourceEl) {
    textDynamicSourceEl.style.display = showDynamicStuff ? "inline-block" : "none";
  }

  if (textDynamicFieldEl) {
    textDynamicFieldEl.style.display = showDynamicStuff ? "inline-block" : "none";
  }

  if (textSelectedRecordEl) {
    textSelectedRecordEl.style.display = showSelectedRecord ? "inline-block" : "none";
  }

  if (textNestedFieldEl) {
    textNestedFieldEl.style.display = showNestedField ? "inline-block" : "none";
  }

  if (textNestedSelectedRecordEl) {
    textNestedSelectedRecordEl.style.display = showNestedSelectedRecord ? "inline-block" : "none";
  }

  if (textRecordFieldEl) {
    textRecordFieldEl.style.display = showRecordField ? "inline-block" : "none";
  }

  await populateDynamicFieldOptions(selectedItem);
  if (textDynamicFieldEl) {
    textDynamicFieldEl.value = selectedItem.dataset.dynamicField || "";
  }

  await populateTextSelectedRecordOptions(selectedItem);
  if (textSelectedRecordEl) {
    textSelectedRecordEl.value = selectedItem.dataset.selectedRecordId || "";
  }

  await populateTextNestedFieldOptions(selectedItem);
  if (textNestedFieldEl) {
    textNestedFieldEl.value = selectedItem.dataset.nestedField || "";
  }

  await populateTextNestedSelectedRecordOptions(selectedItem);
  if (textNestedSelectedRecordEl) {
    textNestedSelectedRecordEl.value = selectedItem.dataset.nestedSelectedRecordId || "";
  }

  await populateTextRecordFieldOptions(selectedItem);
  if (textRecordFieldEl) {
    textRecordFieldEl.value = selectedItem.dataset.recordField || "";
  }

  await renderTextContent(selectedItem);
}

                                       //////////////////////////////
                                           //Shape Element
                                      ///////////////////////////////
const shapeWrap = floatingBar.querySelector(".da-shapeControls");
const shapeTypeEl = floatingBar.querySelector(".da-shape__type");
const shapeBgEl = floatingBar.querySelector(".da-shape__bg");
const shapeBgOnEl = floatingBar.querySelector(".da-shape__bgOn");
const shapeBorderOnEl = floatingBar.querySelector(".da-shape__borderOn");
const shapeBorderWidthEl = floatingBar.querySelector(".da-shape__borderWidth");
const shapeBorderColorEl = floatingBar.querySelector(".da-shape__borderColor");
const shapeBorderStyleEl = floatingBar.querySelector(".da-shape__borderStyle");
const shapeRadiusEl = floatingBar.querySelector(".da-shape__radius");

const colorEl = floatingBar.querySelector(".da-floatingBar__color");



function applyShapeFromBar() {
  if (!selectedItem || selectedItem.dataset.type !== "shape") return;

  selectedItem.dataset.shapeType = shapeTypeEl?.value || "rectangle";
  selectedItem.dataset.bg = shapeBgEl?.value || "#d9d9d9";
  selectedItem.dataset.bgOn = shapeBgOnEl?.checked ? "1" : "0";
  selectedItem.dataset.borderOn = shapeBorderOnEl?.checked ? "1" : "0";
  selectedItem.dataset.borderWidth = String(parseInt(shapeBorderWidthEl?.value || "0", 10) || 0);
  selectedItem.dataset.borderColor = shapeBorderColorEl?.value || "#111111";
  selectedItem.dataset.borderStyle = shapeBorderStyleEl?.value || "solid";
  selectedItem.dataset.radius = String(parseInt(shapeRadiusEl?.value || "0", 10) || 0);

  applyShapeStyles(selectedItem);
}

shapeTypeEl?.addEventListener("change", applyShapeFromBar);
shapeBgEl?.addEventListener("input", applyShapeFromBar);
shapeBgOnEl?.addEventListener("change", applyShapeFromBar);
shapeBorderOnEl?.addEventListener("change", applyShapeFromBar);
shapeBorderWidthEl?.addEventListener("input", applyShapeFromBar);
shapeBorderColorEl?.addEventListener("input", applyShapeFromBar);
shapeBorderStyleEl?.addEventListener("change", applyShapeFromBar);
shapeRadiusEl?.addEventListener("input", applyShapeFromBar);


                                       //////////////////////////////
                                           //Input Element
                                      ///////////////////////////////
const inputWrapEl = floatingBar.querySelector(".da-inputControls");
const inputLabelTextEl = floatingBar.querySelector(".da-input__labelTextControl");
const inputPlaceholderEl = floatingBar.querySelector(".da-input__placeholderControl");
const inputTypeEl = floatingBar.querySelector(".da-input__typeControl");
const inputRequiredEl = floatingBar.querySelector(".da-input__requiredControl");
const inputBgToggleEl = floatingBar.querySelector(".da-input__bgToggleControl");
const inputBgEl = floatingBar.querySelector(".da-input__bgControl");
const inputLabelBgEl = floatingBar.querySelector(".da-input__labelBgControl");
const inputFieldBgEl = floatingBar.querySelector(".da-input__inputBgControl");

const inputLabelBgModeEl = floatingBar.querySelector(".da-input__labelBgModeControl");

const inputFieldBgModeEl = floatingBar.querySelector(".da-input__inputBgModeControl");

const btnSubmitInputsWrapEl = floatingBar.querySelector(".da-btn__submitInputsWrap");
const btnSubmitInputsListEl = floatingBar.querySelector(".da-btn__submitInputsList");

function applyInputFromBar() {
  if (!selectedItem || selectedItem.dataset.type !== "input") return;

  selectedItem.dataset.label = inputLabelTextEl?.value || "Label";
  selectedItem.dataset.placeholder = inputPlaceholderEl?.value || "Type here";
  selectedItem.dataset.inputType = inputTypeEl?.value || "text";
  selectedItem.dataset.required = inputRequiredEl?.checked ? "1" : "0";

  selectedItem.dataset.labelBgMode = inputLabelBgModeEl?.value || "none";
  selectedItem.dataset.labelBg = inputLabelBgEl?.value || "#ffffff";

  selectedItem.dataset.inputBgMode = inputFieldBgModeEl?.value || "none";
  selectedItem.dataset.inputBg = inputFieldBgEl?.value || "#ffffff";

  renderInputContent(selectedItem);
}

//Wire Input Controls
inputLabelTextEl?.addEventListener("input", applyInputFromBar);
inputPlaceholderEl?.addEventListener("input", applyInputFromBar);
inputTypeEl?.addEventListener("change", applyInputFromBar);
inputRequiredEl?.addEventListener("change", applyInputFromBar);
inputLabelBgEl?.addEventListener("input", applyInputFromBar);
inputFieldBgEl?.addEventListener("input", applyInputFromBar);

inputLabelBgModeEl?.addEventListener("change", applyInputFromBar);

inputFieldBgModeEl?.addEventListener("change", applyInputFromBar);
inputFieldBgEl?.addEventListener("input", applyInputFromBar);


function renderSubmitInputsPicker(currentIds = []) {
  if (!btnSubmitInputsListEl) return;

  const options = getInputOptions();
  btnSubmitInputsListEl.innerHTML = "";

  options.forEach((opt) => {
    const row = document.createElement("label");
    row.style.display = "flex";
    row.style.alignItems = "center";
    row.style.gap = "6px";

    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.value = opt.value;
    cb.checked = currentIds.includes(opt.value);

    cb.addEventListener("change", () => {
      applyButtonFromBar();
    });

    const span = document.createElement("span");
    span.textContent = opt.label;

    row.appendChild(cb);
    row.appendChild(span);
    btnSubmitInputsListEl.appendChild(row);
  });
}

                                       //////////////////////////////
                                           //Button Element
                                      ///////////////////////////////


// =======================
// MAKE BUTTON ELEMENT
// =======================
function makeButtonEl({ x, y, label = "Button" }) {
  const el = document.createElement("div");
  el.className = "da-item da-item--button";
  el.dataset.type = "button";
  el.dataset.id = uid("btn");

  // defaults
  el.dataset.label = label;
  el.dataset.btnBg = el.dataset.btnBg || "#111111";
  el.dataset.btnTextColor = el.dataset.btnTextColor || "#ffffff";
  el.dataset.borderWidth = el.dataset.borderWidth || "0";
  el.dataset.borderColor = el.dataset.borderColor || "#111111";
  el.dataset.borderStyle = el.dataset.borderStyle || "solid";
  el.dataset.radius = el.dataset.radius || "12";

  el.dataset.btnBgOn = el.dataset.btnBgOn || "1";

  // NEW button behavior defaults
  el.dataset.actionType = el.dataset.actionType || "none";
  el.dataset.actionTarget = el.dataset.actionTarget || "";
  el.dataset.displayType = el.dataset.displayType || "text";
  el.dataset.icon = el.dataset.icon || "";

  el.style.left = `${Math.round(x)}px`;
  el.style.top  = `${Math.round(y)}px`;
  el.style.width = `180px`;
  el.style.height = `48px`;
  el.dataset.name = el.dataset.name ?? "Button";

  const all = grid.querySelectorAll(".da-item");
  const maxZ = [...all].reduce((m, n) => Math.max(m, parseInt(n.style.zIndex || "1", 10)), 1);
  el.style.zIndex = String(maxZ + 1);

  el.innerHTML = `
    <button class="da-btn" type="button"></button>

    <div class="da-resize da-resize--nw" data-resize="nw"></div>
    <div class="da-resize da-resize--n"  data-resize="n"></div>
    <div class="da-resize da-resize--ne" data-resize="ne"></div>
    <div class="da-resize da-resize--w"  data-resize="w"></div>
    <div class="da-resize da-resize--e"  data-resize="e"></div>
    <div class="da-resize da-resize--sw" data-resize="sw"></div>
    <div class="da-resize da-resize--s"  data-resize="s"></div>
    <div class="da-resize da-resize--se" data-resize="se"></div>
  `;

  const b = el.querySelector(".da-btn");
  if (b) {
    renderButtonContent(el);

    b.style.background =
  el.dataset.btnBgOn === "0"
    ? "transparent"
    : (el.dataset.btnBg || "#111111");
    b.style.color = el.dataset.btnTextColor;

    const bw = parseInt(el.dataset.borderWidth, 10) || 0;
    const bs = el.dataset.borderStyle || "solid";
    const bc = el.dataset.borderColor || "#111111";
    b.style.border = (bs === "none" || bw === 0) ? "none" : `${bw}px ${bs} ${bc}`;
    b.style.borderRadius = `${parseInt(el.dataset.radius, 10) || 0}px`;

    b.addEventListener("click", (ev) => {
      handleButtonAction(ev, el);
    });
  }

  return el;
}

// =======================
// RENDER BUTTON CONTENT
// =======================
function renderButtonContent(el) {
  if (!el || el.dataset.type !== "button") return;

  const b = el.querySelector(".da-btn");
  if (!b) return;

  const label = el.dataset.label ?? "Button";
  const icon = el.dataset.icon || "";
  const displayType = el.dataset.displayType || "text";

  if (displayType === "icon") {
    b.textContent = icon || "★";
    return;
  }

  if (displayType === "text-icon") {
    b.textContent = icon ? `${label} ${icon}` : label;
    return;
  }

  // default = text
  b.textContent = label;
}

// =======================
// HANDLE BUTTON ACTION
// =======================
async function handleElementAction(ev, el) {
  console.log("[handleButtonAction] fired", {
    preview: window.TPL_PREVIEW,
    el,
    actionType: el?.dataset?.actionType,
    actionSource: el?.dataset?.actionSource,
    actionTarget: el?.dataset?.actionTarget
  });

   if (!window.TPL_PREVIEW && actionType !== "open-popup") return;

  ev.preventDefault();
  ev.stopPropagation();

  const actionType = el.dataset.actionType || "none";
  const actionTarget = (el.dataset.actionTarget || "").trim();
  const actionSource = el.dataset.actionSource || "page";

  console.log("[button preview click]", {
    label: el?.dataset?.label,
    actionType,
    actionTarget,
    actionSource,
    displayType: el?.dataset?.displayType,
    icon: el?.dataset?.icon,
    buttonId: el?.dataset?.id
  });

  if (actionType === "open-template") {
    console.log("[open-template] clicked", {
      actionTarget,
      actionSource,
      buttonEl: el,
      preview: window.TPL_PREVIEW
    });

    if (!actionTarget) return;

    await openTemplateFromButton(el, actionSource, actionTarget);
    return;
  }

  if (actionType === "none") return;

  if (actionType === "link") {
    if (!actionTarget) return;

    let url = actionTarget.trim();

    if (!/^https?:\/\//i.test(url) && !/^mailto:/i.test(url) && !/^tel:/i.test(url)) {
      url = `https://${url}`;
    }

    window.open(url, "_blank", "noopener,noreferrer");
    return;
  }

  if (actionType === "change-view") {
    if (!actionTarget) return;

    saveCurrentCanvasToView();

    if (!pageViews[actionTarget]) {
      console.warn("[builder] view not found:", actionTarget);
      return;
    }

    await loadViewIntoCanvas(actionTarget);
    return;
  }

  if (actionType === "open-popup") {
    if (!actionTarget) return;
    openPopupById(actionTarget);
    return;
  }

  if (actionType === "scroll-to-section") {
    if (!actionTarget) return;
    scrollToSectionById(actionTarget);
    return;
  }

  if (actionType === "download-pdf") {
    console.log("PDF CLICKED:", actionTarget);

    if (!actionTarget) return;

    openPdfPreview(actionTarget);
    return;
  }

if (actionType === "submit") {
  const templateTarget = document.getElementById("public-template-render-target");

  console.log("[submit] templateTarget:", templateTarget);

  // ✅ NEW: application template submit
  if (templateTarget && templateTarget.dataset.templateLoaded === "1") {
    try {
      await submitActiveTemplateApplication();
    } catch (err) {
      console.error("[submit application] failed:", err);
      alert(err?.message || "Failed to submit application.");
    }
    return;
  }

  // ⚠️ OPTIONAL: remove this whole fallback later
  console.warn("[submit] no active template — falling back to old input system");

  let inputIds = [];
  try {
    inputIds = JSON.parse(el.dataset.submitInputs || "[]");
  } catch {
    inputIds = [];
  }

  const values = inputIds.map((id) => {
    const inputEl = grid.querySelector(
      `.da-item[data-type="input"][data-id="${id}"]`
    );

    return {
      id,
      label: inputEl?.dataset?.label || "",
      value: inputEl?.dataset?.value || "",
      required: inputEl?.dataset?.required === "1"
    };
  });

  console.log("[submit button] collected inputs:", values);
  return;
}
}

function syncButtonBgToggleLabel() {
  if (!btnBgToggleEl) return;
  if (!selectedItem || selectedItem.dataset.type !== "button") {
    btnBgToggleEl.textContent = "Remove Background";
    return;
  }

  btnBgToggleEl.textContent =
    selectedItem.dataset.btnBgOn === "0"
      ? "Show Background"
      : "Hide Background";
}
async function submitActiveTemplateApplication() {
  const target = document.getElementById("public-template-render-target");
  if (!target || target.dataset.templateLoaded !== "1") {
    alert("No application template is open.");
    return;
  }

  const suiteId =
    window.TPL_ACTIVE_TEMPLATE_SOURCE_ID ||
    target.dataset.sourceRecordId ||
    "";

  if (!suiteId) {
    alert("No suite/application source found.");
    return;
  }

  const inputs = [
    ...target.querySelectorAll("input, textarea, select")
  ];

  const answers = {};

  inputs.forEach((input, index) => {
    const key =
      input.dataset.templateField ||
      input.name ||
      `field_${index}`;

    answers[key] = input.value || "";
  });

  const payload = {
    values: {
      "Suite": suiteId,
      "Answers JSON": JSON.stringify(answers),
      "Status": "Submitted"
    }
  };

  console.log("[submit application] payload:", payload);

  const res = await apiFetch(`/api/records/Suite Application Submission`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify(payload)
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data?.message || data?.error || "Failed to submit application");
  }

  alert("Application submitted successfully.");
}

//Button Change View Helper
function getViewOptions() {
  return Object.keys(pageViews || {}).map((key) => ({
    value: key,
    label: pageViews[key]?.name || key
  }));
}
function getTemplateOptions() {
  return [
    { value: "Application Template", label: "Application Template" }
  ];
}


//Button Popup Helper
function openPopupById(popupId) {
  if (!popupId) return;

  const popup = [...grid.querySelectorAll('.da-item[data-type="popup"]')]
    .find((el) =>
      String(el.dataset.id || "") === String(popupId) ||
      String(el.dataset.popupId || "") === String(popupId)
    );

  if (!popup) {
    console.warn("[builder] popup not found:", popupId);
    return;
  }

  openPopupEditMode(popup);
}
//Button Scroll to Helper
function scrollToSectionById(sectionId) {
  if (!sectionId) return;

  const target = grid.querySelector(`.da-item[data-id="${CSS.escape(sectionId)}"]`);
  if (!target) {
    console.warn("[builder] section not found:", sectionId);
    return;
  }

  target.scrollIntoView({
    behavior: "smooth",
    block: "center",
    inline: "center"
  });
}











//Open Template Helper
// Open Template Helper
async function openTemplateFromButton(buttonEl, actionSource, templateFieldName) {
  if (!buttonEl || !templateFieldName) return;

  let sourceRecord = null;

  if (actionSource === "parentGroup") {
    const parentGroup = getParentGroupContainer(buttonEl);
    console.log("[open-template] parentGroup:", parentGroup);

    if (parentGroup) {
      sourceRecord = await getSelectedRecordFromGroup(parentGroup);
    }
  }

  if (actionSource === "page") {
    sourceRecord = window.TPL_CURRENT_PAGE_ROW || currentPageRecord || null;
  }

  console.log("[open-template] actionSource:", actionSource);
  console.log("[open-template] templateFieldName:", templateFieldName);
  console.log("[open-template] sourceRecord:", sourceRecord);
  console.log("[open-template] sourceRecord.values:", sourceRecord?.values);

  if (!sourceRecord) {
    alert("No source record found.");
    return;
  }

  const templateJson = getFieldValueFromRecord(sourceRecord, templateFieldName);

  console.log("[open-template] raw field value:", templateJson);
  console.log("[open-template] raw field type:", typeof templateJson);

  if (!templateJson) {
    alert("No template found on this record.");
    return;
  }

  try {
    const parsed =
      typeof templateJson === "string"
        ? JSON.parse(templateJson)
        : templateJson;

    console.log("[open-template] parsed template:", parsed);
    console.log("[open-template] parsed keys:", Object.keys(parsed || {}));
    console.log("[open-template] parsed sections:", parsed?.sections);

    window.TPL_ACTIVE_TEMPLATE = parsed;
    window.TPL_ACTIVE_TEMPLATE_SOURCE = sourceRecord;
    window.TPL_ACTIVE_TEMPLATE_SOURCE_ID = String(getRecordId(sourceRecord));
    window.TPL_ACTIVE_TEMPLATE_FIELD = templateFieldName;

    await renderPublicTemplateFromJson(parsed, sourceRecord, {
      sourceRecordId: String(getRecordId(sourceRecord)),
      templateFieldName,
      sessionId: `tpl_${Date.now()}`
    });

    return parsed;
  } catch (err) {
    console.error("[open-template] failed to parse template:", err);
    console.log("[open-template] unparsed template value:", templateJson);
    alert("Template could not be opened.");
  }
}

async function renderPublicTemplateFromJson(templateJson, sourceRecord, meta = {}) {
  const target = document.getElementById("public-template-render-target");

  if (!target) {
    console.error("[template/render] No template render target found.");
    alert("No template render target found.");
    return;
  }

  target.innerHTML = "";

  const sourceRecordId =
    meta.sourceRecordId ||
    sourceRecord?._id ||
    sourceRecord?.id ||
    sourceRecord?.values?._id ||
    "";

  target.dataset.templateLoaded = "1";
  target.dataset.templateSession = meta.sessionId || "";
  target.dataset.sourceRecordId = String(sourceRecordId);
  target.dataset.templateField = meta.templateFieldName || "";

  const sections = templateJson?.sections || {};
  const submitWrap = document.createElement("div");
  submitWrap.className = "rendered-template-submit-wrap";
  submitWrap.style.marginTop = "24px";

  const submitBtn = document.createElement("button");
  submitBtn.type = "button";
  submitBtn.textContent = "Submit Application";
  submitBtn.className = "rendered-template-submit-btn";
  submitBtn.style.padding = "12px 20px";
  submitBtn.style.border = "none";
  submitBtn.style.borderRadius = "10px";
  submitBtn.style.background = "black";
  submitBtn.style.color = "white";
  submitBtn.style.cursor = "pointer";

  submitBtn.addEventListener("click", async () => {
    const allInputs = target.querySelectorAll("[data-template-field]");
    const formValues = {};

    allInputs.forEach((input) => {
      const key = input.dataset.templateField;
      formValues[key] = input.value;
    });

    console.log("[template/submit] submitted values:", formValues);
    alert("Application submitted.");
  });

  submitWrap.appendChild(submitBtn);
  target.appendChild(submitWrap);
  
  console.log("[template/render] sections:", sections);

  function createSectionContainer(title, sectionKey = "") {
    const sectionWrap = document.createElement("div");
    sectionWrap.className = "rendered-template-section";
    sectionWrap.dataset.sectionKey = sectionKey;
    sectionWrap.style.marginBottom = "24px";

    const heading = document.createElement("h3");
    heading.textContent = title;
    heading.style.margin = "20px 0 12px";

    sectionWrap.appendChild(heading);
    target.appendChild(sectionWrap);

    return sectionWrap;
  }

  function addFieldRow(field, index, sectionKey = "", sectionContainer) {
    const wrap = document.createElement("div");
    wrap.className = "rendered-template-field";
    wrap.style.marginBottom = "12px";

    const label = document.createElement("label");
    label.textContent = field?.label || field?.key || `Field ${index + 1}`;
    label.style.display = "block";
    label.style.marginBottom = "6px";

    let input;
    const rawType = String(field?.inputType || field?.type || "").toLowerCase();

    if (rawType.includes("textarea")) {
      input = document.createElement("textarea");
    } else {
      input = document.createElement("input");

      if (rawType.includes("date")) {
        input.type = "date";
      } else if (rawType.includes("email")) {
        input.type = "email";
      } else if (rawType.includes("number")) {
        input.type = "number";
      } else {
        input.type = "text";
      }
    }

    input.dataset.templateField = field?.key || `${sectionKey}_field_${index}`;
    input.dataset.templateSection = sectionKey;
    input.placeholder = field?.label || "";
    input.style.width = "100%";
    input.style.padding = "8px";

    if (field?.required) {
      input.required = true;
    }

    if (field?.value != null) {
      input.value = field.value;
    }

    wrap.appendChild(label);
    wrap.appendChild(input);

    sectionContainer.appendChild(wrap);
  }

  if (Array.isArray(sections.applicant) && sections.applicant.length) {
    const applicantSection = createSectionContainer("Applicant Information", "applicant");

    sections.applicant.forEach((field, index) => {
      addFieldRow(field, index, "applicant", applicantSection);
    });
  }

  if (Array.isArray(sections.experience) && sections.experience.length) {
    const experienceSection = createSectionContainer("Experience", "experience");

    sections.experience.forEach((field, index) => {
      addFieldRow(field, index, "experience", experienceSection);
    });
  }

  if (Array.isArray(sections.custom) && sections.custom.length) {
    sections.custom.forEach((section, sectionIndex) => {
      const sectionKey = section?.sectionKey || `custom_${sectionIndex}`;
      const customSection = createSectionContainer(
        section?.title || `Custom Section ${sectionIndex + 1}`,
        sectionKey
      );

      const rows = Array.isArray(section?.rows) ? section.rows : [];

      rows.forEach((field, index) => {
        addFieldRow(field, index, sectionKey, customSection);
      });
    });
  }

  console.log("[template/render] target dataset:", {
    templateLoaded: target.dataset.templateLoaded,
    templateSession: target.dataset.templateSession,
    sourceRecordId: target.dataset.sourceRecordId,
    templateField: target.dataset.templateField
  });
}
async function submitActiveTemplateApplication() {
  const target = document.getElementById("public-template-render-target");
  if (!target || target.dataset.templateLoaded !== "1") {
    alert("No application template is open.");
    return;
  }

  const sourceRecord = window.TPL_ACTIVE_TEMPLATE_SOURCE;
  if (!sourceRecord) {
    alert("No source suite found.");
    return;
  }

  const suiteId =
    sourceRecord?._id ||
    sourceRecord?.id ||
    sourceRecord?.values?._id ||
    "";

  if (!suiteId) {
    alert("No suite id found.");
    return;
  }

  const inputs = [
    ...target.querySelectorAll("input, textarea, select")
  ];

  const answers = {};

  for (const input of inputs) {
    const key = input.dataset.templateField || input.name || input.id;
    if (!key) continue;
    answers[key] = input.value || "";
  }

  const payload = {
    values: {
      "Suite": suiteId,
      "Answers JSON": JSON.stringify(answers),
      "Status": "Submitted"
    }
  };

  console.log("[application submit] payload:", payload);

  const res = await apiFetch(`/api/records/Suite Application Submission`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify(payload)
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data?.message || data?.error || "Failed to submit application");
  }

  alert("Application submitted.");
}

//Button Download Pdf Helper
function downloadPdfFromTarget(target) {
  if (!target) return;

  let url = target.trim();

  if (!/^https?:\/\//i.test(url) && !url.startsWith("/")) {
    url = `/${url}`;
  }

  const a = document.createElement("a");
  a.href = url;
  a.download = "";
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  document.body.appendChild(a);
  a.click();
  a.remove();
}



function getPopupOptions() {
  return [...grid.querySelectorAll('.da-item[data-type="popup"]')].map((el, index) => ({
    value: el.dataset.popupId || "",
    label: (el.dataset.name || "").trim() || `Popup ${index + 1}`
  }));
}

function getSectionOptions() {
  return [...grid.querySelectorAll('.da-item[data-type="section"]')]
    .map((el, index) => ({
      value: el.dataset.id || "",
      label: (el.dataset.name || "").trim() || `Section ${index + 1}`
    }))
    .filter((x) => x.value);
}

function populateButtonTargetSelect(type, currentValue = "") {
  if (!btnActionTargetSelectEl) return;

  let options = [];

  if (type === "change-view") {
    options = getViewOptions();
  }

  if (type === "open-popup") {
    options = getPopupOptions();
  }

  if (type === "scroll-to-section") {
    options = getSectionOptions();
  }

if (type === "open-template") {
  options = getTemplateOptions(); // real templates
}
  btnActionTargetSelectEl.innerHTML = `<option value="">Select target</option>`;

  options.forEach((opt) => {
    const option = document.createElement("option");
    option.value = opt.value;
    option.textContent = opt.label;
    btnActionTargetSelectEl.appendChild(option);
  });

  if ([...btnActionTargetSelectEl.options].some((o) => o.value === currentValue)) {
    btnActionTargetSelectEl.value = currentValue;
  } else {
    btnActionTargetSelectEl.value = "";
  }
}


function updateButtonActionUI() {
  if (!btnActionTypeEl || !btnActionTargetEl || !btnActionTargetSelectEl) return;

  const type = btnActionTypeEl.value || "none";
  const currentValue =
    selectedItem?.dataset?.actionTarget ||
    btnActionTargetEl.value ||
    "";

  const useSelect =
    type === "change-view" ||
    type === "open-popup" ||
    type === "scroll-to-section" ||
    type === "open-template";

  if (btnSubmitInputsWrapEl) {
    btnSubmitInputsWrapEl.style.display = "none";
  }

  // ✅ show/hide source selector BEFORE any early return
  if (btnActionSourceEl) {
    btnActionSourceEl.style.display =
      type === "open-template" ? "inline-block" : "none";
  }

  if (useSelect) {
    populateButtonTargetSelect(type, currentValue);

    btnActionTargetEl.style.display = "none";
    btnActionTargetSelectEl.style.display = "inline-block";

    if (btnPdfPickEl) btnPdfPickEl.style.display = "none";
    return;
  }

  btnActionTargetSelectEl.style.display = "none";
  btnActionTargetEl.style.display = "inline-block";

  if (btnPdfPickEl) btnPdfPickEl.style.display = "none";

  if (type === "link") {
    btnActionTargetEl.placeholder = "https://example.com";
    return;
  }

  if (type === "download-pdf") {
    btnActionTargetEl.style.display = "none";
    if (btnPdfPickEl) btnPdfPickEl.style.display = "inline-block";
    return;
  }

  if (type === "submit") {
    btnActionTargetEl.style.display = "none";

    if (btnSubmitInputsWrapEl) {
      btnSubmitInputsWrapEl.style.display = "block";
    }

    let selectedIds = [];
    try {
      selectedIds = JSON.parse(selectedItem?.dataset?.submitInputs || "[]");
    } catch {
      selectedIds = [];
    }

    renderSubmitInputsPicker(selectedIds);
    return;
  }

  btnActionTargetEl.placeholder = "";
}

const btnActionTypeEl = floatingBar.querySelector(".da-btn__actionType");
const btnActionTargetEl = floatingBar.querySelector(".da-btn__actionTarget");
const btnActionTargetSelectEl = floatingBar.querySelector(".da-btn__actionTargetSelect");
const btnPdfFileEl = floatingBar.querySelector(".da-btn__pdfFile");
const btnPdfPickEl = floatingBar.querySelector(".da-btn__pdfPick");
const btnActionSourceEl = floatingBar.querySelector(".da-btn__actionSource");

//Upload PDF
async function uploadTemplatePdf(file) {
  const fd = new FormData();
  fd.append("file", file);

  const res = await fetch(apiUrl("/api/upload"), {
    method: "POST",
    credentials: "include",
    body: fd,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok || !data?.url) {
    throw new Error(data?.error || data?.message || "PDF upload failed");
  }

  return data.url;
}
//Wire File input
btnPdfFileEl?.addEventListener("change", async () => {
  if (!selectedItem || selectedItem.dataset.type !== "button") return;

  const file = btnPdfFileEl.files?.[0];
  if (!file) return;

  try {
    const url = await uploadTemplatePdf(file);

    selectedItem.dataset.actionType = "download-pdf";
    selectedItem.dataset.actionTarget = url;

    applyButtonFromBar();
    updateButtonActionUI();
  } catch (err) {
    console.error("[builder] pdf upload failed:", err);
    alert("PDF upload failed.");
  } finally {
    btnPdfFileEl.value = "";
  }
});



//Open and close Helpers for Pdf 
function openPdfPreview(url) {
  const overlay = document.getElementById("pdf-preview-overlay");
  const frame = document.getElementById("pdf-preview-frame");
  if (!overlay || !frame || !url) return;

  frame.src = url;
  overlay.hidden = false;
}

function closePdfPreview() {
  const overlay = document.getElementById("pdf-preview-overlay");
  const frame = document.getElementById("pdf-preview-frame");
  if (!overlay || !frame) return;

  frame.src = "";
  overlay.hidden = true;
}




                                             //////////
                                         // Input Element
                                                ////
function makeInputEl({ x, y, w = 220, h = 44, placeholder = "Type here" } = {}) {
  const el = document.createElement("div");
  el.className = "da-item da-item--input";
  el.dataset.type = "input";
  el.dataset.id = uid("input");

  el.dataset.placeholder = placeholder;
  el.dataset.inputType = el.dataset.inputType || "text";
  el.dataset.name = el.dataset.name || "Input";
  el.dataset.value = el.dataset.value || "";
  el.dataset.required = el.dataset.required || "0";

  el.dataset.labelBgMode = el.dataset.labelBgMode || "none";
el.dataset.labelBg = el.dataset.labelBg || "#ffffff";

el.dataset.inputBgMode = el.dataset.inputBgMode || "none";
el.dataset.inputBg = el.dataset.inputBg || "#ffffff";

  el.dataset.label = el.dataset.label || "Label";
  el.dataset.labelColor = el.dataset.labelColor || "#111111";
  el.dataset.labelSize = el.dataset.labelSize || "14";
  el.dataset.labelWeight = el.dataset.labelWeight || "600";
  el.dataset.showLabel = el.dataset.showLabel || "1";

  el.dataset.labelBg = el.dataset.labelBg || "transparent";
el.dataset.inputBg = el.dataset.inputBg || "#ffffff";

el.dataset.inputBgMode = el.dataset.inputBgMode || "color";


  el.dataset.borderWidth = el.dataset.borderWidth || "1";
  el.dataset.borderColor = el.dataset.borderColor || "#111111";
  el.dataset.borderStyle = el.dataset.borderStyle || "solid";
  el.dataset.radius = el.dataset.radius || "10";

  el.style.left = `${Math.round(x)}px`;
  el.style.top = `${Math.round(y)}px`;
  el.style.width = `${Math.round(w)}px`;
  el.style.height = `${Math.round(h)}px`;

  const all = grid.querySelectorAll(".da-item");
  const maxZ = [...all].reduce((m, n) => Math.max(m, parseInt(n.style.zIndex || "1", 10)), 1);
  el.style.zIndex = String(maxZ + 1);

  el.innerHTML = `
    <div class="da-inputWrap">
      <label class="da-input__label">Label</label>
      <input class="da-input" type="text" placeholder="${placeholder}" value="${el.dataset.value}" />
    </div>

    <div class="da-resize da-resize--nw" data-resize="nw"></div>
    <div class="da-resize da-resize--n"  data-resize="n"></div>
    <div class="da-resize da-resize--ne" data-resize="ne"></div>
    <div class="da-resize da-resize--w"  data-resize="w"></div>
    <div class="da-resize da-resize--e"  data-resize="e"></div>
    <div class="da-resize da-resize--sw" data-resize="sw"></div>
    <div class="da-resize da-resize--s"  data-resize="s"></div>
    <div class="da-resize da-resize--se" data-resize="se"></div>
  `;

  renderInputContent(el);
  return el;
}


//Input Helper
function renderInputContent(el) {
  if (!el || el.dataset.type !== "input") return;

  const wrap = el.querySelector(".da-inputWrap");
  const label = el.querySelector(".da-input__label");
  const input = el.querySelector(".da-input");
  if (!wrap || !label || !input) return;

  el.style.background = "transparent";

wrap.style.background = "transparent";
  wrap.style.display = "flex";
  wrap.style.flexDirection = "column";
  wrap.style.width = "100%";
  wrap.style.height = "100%";
  wrap.style.boxSizing = "border-box";
  wrap.style.background = "transparent"; // important

  label.textContent = el.dataset.label || "Label";
  label.style.display = el.dataset.showLabel === "1" ? "block" : "none";
  label.style.color = el.dataset.labelColor || "#111111";
  label.style.fontSize = `${parseInt(el.dataset.labelSize || "14", 10) || 14}px`;
  label.style.fontWeight = el.dataset.labelWeight || "600";
  label.style.margin = "0 0 6px 0";
  label.style.padding = "0";
  label.style.border = "none";
  label.style.borderRadius = "0";
  label.style.boxShadow = "none";

label.style.background =
  el.dataset.labelBgMode === "color"
    ? (el.dataset.labelBg || "#ffffff")
    : "transparent";

input.style.background =
  el.dataset.inputBgMode === "color"
    ? (el.dataset.inputBg || "#ffffff")
    : "transparent";

  input.type = el.dataset.inputType || "text";
  input.placeholder = el.dataset.placeholder || "Type here";
  input.value = el.dataset.value || "";
  input.required = el.dataset.required === "1";

  input.style.width = "100%";
  input.style.flex = "1";
  input.style.boxSizing = "border-box";

input.style.appearance = "none";
input.style.webkitAppearance = "none";
input.style.mozAppearance = "none";
input.style.boxShadow = "none";

  const bw = parseInt(el.dataset.borderWidth || "1", 10) || 1;
  const bc = el.dataset.borderColor || "#111111";
  const bs = el.dataset.borderStyle || "solid";
  const br = parseInt(el.dataset.radius || "10", 10) || 10;

  input.style.border = (bs === "none" || bw === 0) ? "none" : `${bw}px ${bs} ${bc}`;
  input.style.borderRadius = `${br}px`;
  input.style.padding = "0 8px";
  input.style.boxShadow = "none";
  input.style.outline = "none";
  input.style.appearance = "none";
  input.style.webkitAppearance = "none";

  input.disabled = !window.TPL_PREVIEW;
  input.style.pointerEvents = window.TPL_PREVIEW ? "auto" : "none";

  input.oninput = () => {
    el.dataset.value = input.value || "";
  };
}

function getInputOptions() {
  return [...grid.querySelectorAll('.da-item[data-type="input"]')]
    .map((el, index) => ({
      value: el.dataset.id || "",
      label: (el.dataset.name || "").trim() || `Input ${index + 1}`
    }))
    .filter((x) => x.value);
}

function getCheckedSubmitInputIds() {
  if (!btnSubmitInputsListEl) return [];

  return [...btnSubmitInputsListEl.querySelectorAll('input[type="checkbox"]:checked')]
    .map((cb) => cb.value)
    .filter(Boolean);
}

                                             //////////
                                         // Popup Element
                                                ////
//Popup Element
function hasPopupAncestor(el) {
  if (!el) return false;

  let parentId = el.dataset.parent || "";
  while (parentId) {
    const parentEl = grid.querySelector(`.da-item[data-id="${parentId}"]`);
    if (!parentEl) return false;
    if (parentEl.dataset.type === "popup") return true;
    parentId = parentEl.dataset.parent || "";
  }

  return false;
}

function makePopupEl({ x, y, w = 360, h = 220, title = "" }) {
  const el = document.createElement("div");
  el.className = "da-item da-item--popup";
  el.dataset.type = "popup";
  el.dataset.id = uid("popup");

  // popup defaults
  el.dataset.name = title || "";
  el.dataset.bg = el.dataset.bg || "#ffffff";
  el.dataset.borderOn = el.dataset.borderOn || "1";
  el.dataset.borderWidth = el.dataset.borderWidth || "2";
  el.dataset.borderStyle = el.dataset.borderStyle || "solid";
  el.dataset.borderColor = el.dataset.borderColor || "#111111";
  el.dataset.radius = el.dataset.radius || "16";
  el.dataset.popupId = el.dataset.popupId || `popup_${Date.now()}`;
  el.dataset.popupMode = el.dataset.popupMode || "modal";
  el.dataset.popupDefaultOpen = el.dataset.popupDefaultOpen || "0";
  el.dataset.popupMinimized = el.dataset.popupMinimized || "0";

  el.dataset.dynamicMode = el.dataset.dynamicMode || "static";
 el.dataset.dynamicSource = el.dataset.dynamicSource || "page";

  el.style.left = `${Math.round(x)}px`;
  el.style.top = `${Math.round(y)}px`;
  el.style.width = `${Math.round(w)}px`;
  el.style.height = `${Math.round(h)}px`;
  el.style.background = el.dataset.bg;

  
el.dataset.popupId = el.dataset.popupId || `popup_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
el.dataset.name = el.dataset.name || "Popup";
el.dataset.popupMinimized = el.dataset.popupMinimized || "0";

  const all = grid.querySelectorAll(".da-item");
  const maxZ = [...all].reduce((m, n) => Math.max(m, parseInt(n.style.zIndex || "1", 10)), 1);
  el.style.zIndex = String(maxZ + 1);

  const bw = parseInt(el.dataset.borderWidth, 10) || 0;
  const bs = el.dataset.borderStyle || "solid";
  const bc = el.dataset.borderColor || "#111111";
  const br = parseInt(el.dataset.radius, 10) || 0;

  el.style.border = el.dataset.borderOn === "1" ? `${bw}px ${bs} ${bc}` : "none";
  el.style.borderRadius = `${br}px`;

el.innerHTML = `
  <div class="da-popup__body"></div>

  <div class="da-resize da-resize--nw" data-resize="nw"></div>
  <div class="da-resize da-resize--n"  data-resize="n"></div>
  <div class="da-resize da-resize--ne" data-resize="ne"></div>
  <div class="da-resize da-resize--w"  data-resize="w"></div>
  <div class="da-resize da-resize--e"  data-resize="e"></div>
  <div class="da-resize da-resize--sw" data-resize="sw"></div>
  <div class="da-resize da-resize--s"  data-resize="s"></div>
  <div class="da-resize da-resize--se" data-resize="se"></div>


`;



  return el;
}

//Sidebar Helper
const sidebarMain = document.getElementById("builder-sidebar-main");
const sidebarEditor = document.getElementById("builder-sidebar-editor");

function mountBarInSidebar() {
  if (!sidebarMain || !sidebarEditor) return;

  sidebarMain.style.display = "none";
  sidebarEditor.style.display = "block";

  sidebarEditor.innerHTML = "";
  sidebarEditor.appendChild(floatingBar);

  floatingBar.style.position = "relative";
  floatingBar.style.left = "0";
  floatingBar.style.top = "0";
  floatingBar.style.width = "100%";
  floatingBar.style.maxWidth = "100%";
  floatingBar.style.display = "flex";
}

function unmountBarToCanvas() {
  if (!sidebarMain || !sidebarEditor) return;

  sidebarMain.style.display = "";
  sidebarEditor.style.display = "none";

  sidebarEditor.innerHTML = "";
  grid.appendChild(floatingBar);

  floatingBar.style.position = "absolute";
  floatingBar.style.width = "280px";
  floatingBar.style.maxWidth = "280px";
  floatingBar.style.display = "none";
}

//Build Popup List in sidebar 
function refreshPopupList() {
  const popupList = document.getElementById("popup-list");
  if (!popupList || !grid) return;

  popupList.innerHTML = "";

  const popups = [...grid.querySelectorAll('.da-item[data-type="popup"]')];
console.log(
  "POPUP LIST ITEMS:",
  popups.map((el) => ({
    type: el.dataset.type,
    name: el.dataset.name,
    popupId: el.dataset.popupId,
    id: el.dataset.id
  }))
);

  if (!popups.length) {
    popupList.innerHTML = `<div class="popup-list-empty">No popups yet</div>`;
    return;
  }

  popups.forEach((popup, index) => {
    const row = document.createElement("button");
    row.type = "button";
    row.className = "popup-list-row";
    row.dataset.popupId = popup.dataset.popupId || "";

    const rawName = (popup.dataset.name || "").trim();
const label =
  rawName && rawName !== "Section"
    ? rawName
    : `Popup ${index + 1}`;

    row.textContent = label;

    if (selectedItem === popup) {
      row.classList.add("is-active");
    }

row.addEventListener("click", () => {
  grid.querySelectorAll(".da-item").forEach((x) => x.classList.remove("is-selected"));
  popup.classList.add("is-selected");
  selectedItem = popup;
  showBarForItem(popup);
  openPopupEditMode(popup);
});

    popupList.appendChild(row);
  });
}

//Open and close popup
let popupEditReturnState = null;

function openPopupEditMode(popupEl) {
  if (!popupEl || popupEl.dataset.type !== "popup") return;

  const overlay = document.getElementById("popup-edit-overlay");
  if (!overlay) return;

  closePopupEditMode();

  popupEditReturnState = {
    popupId: popupEl.dataset.popupId || "",
    left: popupEl.style.left || "",
    top: popupEl.style.top || "",
    transform: popupEl.style.transform || "",
    zIndex: popupEl.style.zIndex || ""
  };

  overlay.hidden = false;

  popupEl.style.display = "block";
  popupEl.classList.add("is-popup-editing");

  if ((popupEl.dataset.popupMode || "modal") === "modal") {
    popupEl.style.left = "50%";
    popupEl.style.top = "24px";
    popupEl.style.transform = "translateX(-50%)";
  } else {
    popupEl.style.left = popupEditReturnState?.left || popupEl.style.left;
    popupEl.style.top = popupEditReturnState?.top || popupEl.style.top;
    popupEl.style.transform = "";
  }

  popupEl.style.zIndex = "20001";

  // show popup children too
  const kids = getChildrenDeep(popupEl);
  popupEditChildrenState = kids.map((child) => ({
    el: child,
    display: child.style.display || "",
    zIndex: child.style.zIndex || "",
  }));

  kids.forEach((child) => {
    child.style.display = "block";
    child.style.zIndex = "20002";
  });

  selectedItem = popupEl;
  showBarForItem(popupEl);
}

function closePopupEditMode() {
  const overlay = document.getElementById("popup-edit-overlay");
  const editingPopup = grid.querySelector('.da-item[data-type="popup"].is-popup-editing');

  if (overlay) overlay.hidden = true;

  if (!editingPopup) {
    popupEditReturnState = null;
    popupEditChildrenState = [];
    if (typeof showBarForItem === "function") showBarForItem(null);
    if (typeof unmountBarToCanvas === "function") unmountBarToCanvas();
    return;
  }

  editingPopup.classList.remove("is-popup-editing");

  if (
    popupEditReturnState &&
    (!popupEditReturnState.popupId ||
      popupEditReturnState.popupId === editingPopup.dataset.popupId)
  ) {
    editingPopup.style.left = popupEditReturnState.left;
    editingPopup.style.top = popupEditReturnState.top;
    editingPopup.style.transform = popupEditReturnState.transform;
    editingPopup.style.zIndex = popupEditReturnState.zIndex;
  } else {
    editingPopup.style.transform = "";
  }

  editingPopup.style.display = "none";

  popupEditChildrenState.forEach(({ el, display, zIndex }) => {
    el.style.display = display;
    el.style.zIndex = zIndex;
  });

  popupEditChildrenState = [];
  popupEditReturnState = null;

  editingPopup.classList.remove("is-selected");
  selectedItem = null;
  window.selectedItem = null;

  if (typeof showBarForItem === "function") showBarForItem(null);
  if (typeof unmountBarToCanvas === "function") unmountBarToCanvas();
}

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    closePopupEditMode();
  }
  document.getElementById("popup-edit-overlay")?.addEventListener("click", () => {
  closePopupEditMode();
});

});

//////////////////////////
//Video Element
//////////////////
function makeVideoEl({ x, y, w = 320, h = 180, src = "" }) {
  const el = document.createElement("div");
  el.className = "da-item da-item--video";
  el.dataset.type = "video";
  el.dataset.id = uid("video");
  el.dataset.name = el.dataset.name || "Video";
  el.dataset.src = src || "";
  el.dataset.radius = el.dataset.radius || "12";
  el.dataset.autoplay = el.dataset.autoplay || "0";
  el.dataset.muted = el.dataset.muted || "1";
  el.dataset.loop = el.dataset.loop || "0";
  el.dataset.controls = el.dataset.controls || "1";

  el.style.left = `${Math.round(x)}px`;
  el.style.top = `${Math.round(y)}px`;
  el.style.width = `${Math.round(w)}px`;
  el.style.height = `${Math.round(h)}px`;

  const all = grid.querySelectorAll(".da-item");
  const maxZ = [...all].reduce((m, n) => Math.max(m, parseInt(n.style.zIndex || "1", 10)), 1);
  el.style.zIndex = String(maxZ + 1);

  el.innerHTML = `
    <video class="da-video" playsinline></video>

    <div class="da-resize da-resize--nw" data-resize="nw"></div>
    <div class="da-resize da-resize--n"  data-resize="n"></div>
    <div class="da-resize da-resize--ne" data-resize="ne"></div>
    <div class="da-resize da-resize--w"  data-resize="w"></div>
    <div class="da-resize da-resize--e"  data-resize="e"></div>
    <div class="da-resize da-resize--sw" data-resize="sw"></div>
    <div class="da-resize da-resize--s"  data-resize="s"></div>
    <div class="da-resize da-resize--se" data-resize="se"></div>
  `;

  renderVideoContent(el);
  return el;
}

function renderVideoContent(el) {
  if (!el || el.dataset.type !== "video") return;

  const video = el.querySelector(".da-video");
  if (!video) return;

  video.src = el.dataset.src || "";
  video.controls = el.dataset.controls === "1";
  video.autoplay = el.dataset.autoplay === "1";
  video.muted = el.dataset.muted === "1";
  video.loop = el.dataset.loop === "1";

  el.style.borderRadius = `${parseInt(el.dataset.radius, 10) || 0}px`;
  el.style.overflow = "hidden";
  video.style.borderRadius = `${parseInt(el.dataset.radius, 10) || 0}px`;
}

const videoWrap = floatingBar.querySelector(".da-videoControls");
const videoPickBtn = floatingBar.querySelector(".da-videoPickBtn");
const videoFileEl = floatingBar.querySelector(".da-videoFile");
const videoRadiusEl = floatingBar.querySelector(".da-videoRadius");
const videoControlsToggleEl = floatingBar.querySelector(".da-videoControlsToggle");
const videoAutoplayEl = floatingBar.querySelector(".da-videoAutoplay");
const videoMutedEl = floatingBar.querySelector(".da-videoMuted");
const videoLoopEl = floatingBar.querySelector(".da-videoLoop");

//////////////////////////
//Group Element
//////////////////

function makeGroupEl({ x, y, w = 420, h = 168, title = "Group" }) {
  const el = makeSectionEl({ x, y, w, h, title });

  el.dataset.type = "group";
  el.dataset.name = title || "Group";
el.dataset.bgOn = el.dataset.bgOn || "1";
  el.dataset.dynamicMode = el.dataset.dynamicMode || "static";
  el.dataset.dynamicSource = el.dataset.dynamicSource || "page";
  el.dataset.bindMode = el.dataset.bindMode || "single";
  el.dataset.dynamicField = el.dataset.dynamicField || "";
  el.dataset.selectedItemId = el.dataset.selectedItemId || "";
  el.dataset.itemField = el.dataset.itemField || "";
  el.dataset.itemDataType = el.dataset.itemDataType || "";
  el.dataset.itemDataTypeId = el.dataset.itemDataTypeId || "";

  el.classList.add("da-item--group");

  return el;
}
async function populateGroupSelectedItemOptions(item = selectedItem) {
  if (!groupSelectedItemEl || !item) return;

  const list = await getGroupSourceList(item);
  const currentValue = item.dataset.selectedItemId || "";

  groupSelectedItemEl.innerHTML = `<option value="">Select item</option>`;

  list.forEach((entry, index) => {
    const option = document.createElement("option");

    const value =
      entry?._id ||
      entry?.id ||
      entry?.values?._id ||
      entry?.values?.id ||
      String(index);

    option.value = String(value);
    option.textContent = getRecordLabel(entry, index);

    groupSelectedItemEl.appendChild(option);
  });

  if ([...groupSelectedItemEl.options].some((o) => o.value === currentValue)) {
    groupSelectedItemEl.value = currentValue;
  }

  // set the datatype for the selected-item level
  if (list && list.length) {
    const first = list[0];

    const dataTypeName =
      first?.dataTypeName ||
      first?.recordTypeName ||
      first?.type ||
      item.dataset.itemDataType ||
      "";

    const dataTypeId =
      first?.dataTypeId ||
      first?.values?.dataTypeId ||
      item.dataset.itemDataTypeId ||
      "";

    item.dataset.itemDataType = dataTypeName;
    item.dataset.itemDataTypeId = dataTypeId;

    console.log("[group] itemDataType set:", dataTypeName);
    console.log("[group] itemDataTypeId set:", dataTypeId);
  }
}
  //Section Element
 function makeSectionEl({ x, y, w = 420, h = 168, title = "Section" }) {

    const el = document.createElement("div");
   el.className = "da-item da-item--section";
el.dataset.type = "section";
el.dataset.dynamicMode = el.dataset.dynamicMode || "static";
el.dataset.dynamicSource = el.dataset.dynamicSource || "page";
el.dataset.bgOn = el.dataset.bgOn || "1";
el.dataset.bindType = el.dataset.bindType || "record";
el.dataset.dynamicField = el.dataset.dynamicField || "";

// defaults for section border styling
el.dataset.borderOn    = el.dataset.borderOn || "0";
el.dataset.borderWidth = el.dataset.borderWidth || "2";
el.dataset.borderStyle = el.dataset.borderStyle || "solid";
el.dataset.borderColor = el.dataset.borderColor || "#111111";

el.dataset.radius = el.dataset.radius || "0";
el.dataset.borderOn = el.dataset.borderOn || "0"; // if you’re using the toggle

// apply defaults immediately
el.style.border = (el.dataset.borderOn === "1")
  ? `${el.dataset.borderWidth}px ${el.dataset.borderStyle} ${el.dataset.borderColor}`
  : "none";

el.style.borderRadius = `${parseInt(el.dataset.radius, 10) || 0}px`;

    el.dataset.id = uid("section");
    el.style.left = `${Math.round(x)}px`;
    el.style.top = `${Math.round(y)}px`;
    el.style.width = `${Math.round(w)}px`;
    el.style.height = `${Math.round(h)}px`;
  const all = grid.querySelectorAll(".da-item");
const maxZ = [...all].reduce((m, n) => Math.max(m, parseInt(n.style.zIndex || "1", 10)), 1);
el.style.zIndex = String(maxZ + 1); // ✅ new items appear on top by default




//Rename Section
const safe = String(title || "Section").replace(/</g, "&lt;").replace(/>/g, "&gt;");



el.innerHTML = ``;
// --- resize handles (8) ---
el.innerHTML = `
  <div class="da-resize da-resize--nw" data-resize="nw"></div>
  <div class="da-resize da-resize--n"  data-resize="n"></div>
  <div class="da-resize da-resize--ne" data-resize="ne"></div>

  <div class="da-resize da-resize--w"  data-resize="w"></div>
  <div class="da-resize da-resize--e"  data-resize="e"></div>

  <div class="da-resize da-resize--sw" data-resize="sw"></div>
  <div class="da-resize da-resize--s"  data-resize="s"></div>
  <div class="da-resize da-resize--se" data-resize="se"></div>
`;



// store name on the element so you can read it later
el.dataset.name = title || "Section";

    return el;
  }

//get a section’s children
function getSectionChildren(sectionEl) {
  const id = sectionEl?.dataset?.id;
  if (!id) return [];
  return [...grid.querySelectorAll(`.da-item[data-parent="${id}"]`)];
}

function getSectionDynamicFieldOptions(pageType, bindType) {
  if (pageType === "suite") {
    if (bindType === "list") {
      return [
        { value: "Suites", label: "Suites" },
        { value: "Suities", label: "Suities" },
        { value: "Suite Applications", label: "Suite Applications" },
        { value: "Amenities", label: "Amenities" },
      ];
    }

    return [
      { value: "__page__", label: "Current Page Record" },
    ];
  }

  if (pageType === "booking") {
    if (bindType === "list") {
      return [
        { value: "Services", label: "Services" },
        { value: "Categories", label: "Categories" },
        { value: "Calendars", label: "Calendars" },
      ];
    }

    return [
      { value: "__page__", label: "Current Page Record" },
    ];
  }

  return [];
}


/////////////////////////////////////
//Dropdown Flow 
async function resolveDynamicPath({
  source = "page",
  path = []
}) {
  let currentRecord = null;
  let currentDataTypeName = "";
  let currentDataTypeId = "";

  if (source === "page") {
    currentRecord = window.TPL_CURRENT_PAGE_ROW || null;
    currentDataTypeName = getMainDataTypeForPageType(window.TPL_PAGE_TYPE || "booking");
    currentDataTypeId = window.TPL_CURRENT_PAGE_DATATYPE_ID || "";
  }

  if (!currentRecord) return {
    value: "",
    record: null,
    dataTypeName: "",
    dataTypeId: ""
  };

  for (let i = 0; i < path.length; i++) {
    const step = path[i];

    if (step.kind === "field") {
      const values = currentRecord?.values || currentRecord || {};
      const rawValue = values?.[step.value];

      const nextStep = path[i + 1];

      if (!nextStep || nextStep.kind !== "record") {
        return {
          value: rawValue,
          record: currentRecord,
          dataTypeName: currentDataTypeName,
          dataTypeId: currentDataTypeId
        };
      }

      const relatedMeta = await getRelatedDataTypeMetaFromField(
        step.value,
        currentDataTypeName,
        currentDataTypeId
      );

      if (!relatedMeta?.name) {
        return {
          value: rawValue,
          record: currentRecord,
          dataTypeName: currentDataTypeName,
          dataTypeId: currentDataTypeId
        };
      }

      const possibleRows = await fetchRowsForDynamicReference(
        relatedMeta.name,
        relatedMeta.id
      );

      const selectedId = String(nextStep.value || "");

      const matched = possibleRows.find((row) => {
        const rowId =
          row?._id ||
          row?.id ||
          row?.values?._id ||
          row?.values?.id ||
          "";
        return String(rowId) === selectedId;
      });

      if (!matched) {
        return {
          value: "",
          record: null,
          dataTypeName: relatedMeta.name,
          dataTypeId: relatedMeta.id || ""
        };
      }

      currentRecord = matched;
      currentDataTypeName = relatedMeta.name;
      currentDataTypeId = relatedMeta.id || "";

      i += 1;
    }
  }

  return {
    value: "",
    record: currentRecord,
    dataTypeName: currentDataTypeName,
    dataTypeId: currentDataTypeId
  };
} 

async function fetchRowsForDynamicReference(dataTypeName, dataTypeId = "") {
  if (!dataTypeName) return [];

  const data = await fetchJSON(
    `/public/records?dataType=${encodeURIComponent(dataTypeName)}&limit=500&ownerUserId=${encodeURIComponent(currentUser.id)}`,
    {
      method: "GET",
      cache: "no-store"
    }
  );

  return Array.isArray(data)
    ? data
    : data.records || data.items || data.data || [];
}























//Responsive View
let responsiveViewMode = "auto"; // "auto" | "manual"
let manualResponsiveView = "desktop"; // "desktop" | "mobile"

function getAutoResponsiveView() {
  const dropArea = document.querySelector(".tpl__dropArea");
  const width = dropArea?.clientWidth || window.innerWidth;

  // choose your breakpoint
  return width <= 900 ? "mobile" : "desktop";
}

function applyResponsiveViewMode() {
  const nextView =
    responsiveViewMode === "manual"
      ? manualResponsiveView
      : getAutoResponsiveView();

  switchResponsiveView(nextView);
}

                                                 // =======================
                                            // STEP 5 Element Wiring
                                             //
                                             // =======================
                                             // =======================
                                             // =======================
// IMAGE BAR WIRING
// =======================
//Image back to list button 
async function uploadTemplateImage(file) {
  const fd = new FormData();
  fd.append("file", file);

  const res = await fetch(apiUrl("/api/upload"), {
    method: "POST",
    credentials: "include",
    body: fd,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok || !data?.url) {
    throw new Error(data?.message || "Image upload failed");
  }

  return data.url;
}

const imgWrap   = floatingBar.querySelector(".da-imgControls");
const imgPickBtn= floatingBar.querySelector(".da-imgPickBtn");
const imgFileEl = floatingBar.querySelector(".da-imgFile");
const imgModeEl = floatingBar.querySelector(".da-img__mode");
const imgDynamicSourceEl = floatingBar.querySelector(".da-img__dynamicSource");
const imgDynamicFieldEl = floatingBar.querySelector(".da-img__dynamicField");
const imgFitEl  = floatingBar.querySelector(".da-imgFit");
const imgZoomEl = floatingBar.querySelector(".da-imgZoom");
const imgBWEl   = floatingBar.querySelector(".da-imgBorderW");
const imgBCEl   = floatingBar.querySelector(".da-imgBorderC");
const imgRadEl  = floatingBar.querySelector(".da-imgRadius");

async function applyImageFromBar() {
  if (!selectedItem) return;
  if (selectedItem.dataset.type !== "image") return;

  const img = selectedItem.querySelector(".da-img");
  if (!img) return;

  selectedItem.dataset.dynamicMode = imgModeEl?.value || "static";
  selectedItem.dataset.dynamicSource = imgDynamicSourceEl?.value || "page";
  selectedItem.dataset.dynamicField = imgDynamicFieldEl?.value || "";

  const fit = imgFitEl?.value || "cover";
  selectedItem.dataset.fit = fit;
  img.style.objectFit = fit;

  const zoom = parseFloat(imgZoomEl?.value || "1") || 1;
  selectedItem.dataset.zoom = String(zoom);
  img.style.transform = `scale(${zoom})`;

  const bw = parseInt(imgBWEl?.value || "0", 10) || 0;
  const bc = imgBCEl?.value || "#111111";
  const rad = parseInt(imgRadEl?.value || "0", 10) || 0;

  selectedItem.dataset.borderWidth = String(bw);
  selectedItem.dataset.borderColor = bc;
  selectedItem.dataset.radius = String(rad);

selectedItem.style.border = bw > 0 ? `${bw}px solid ${bc}` : "none";
selectedItem.style.borderRadius = `${rad}px`;
selectedItem.style.overflow = "hidden";

img.style.borderRadius = `${rad}px`;
img.style.width = "100%";
img.style.height = "100%";
img.style.display = "block";

  const showDynamicStuff = selectedItem.dataset.dynamicMode === "dynamic";

  if (imgDynamicSourceEl) {
    imgDynamicSourceEl.style.display = showDynamicStuff ? "inline-block" : "none";
  }

  if (imgDynamicFieldEl) {
    imgDynamicFieldEl.style.display = showDynamicStuff ? "inline-block" : "none";
  }

  if (imgPickBtn) {
    imgPickBtn.style.display = showDynamicStuff ? "none" : "inline-block";
  }

  await populateImageDynamicFieldOptions(selectedItem);

  if (imgDynamicFieldEl) {
    imgDynamicFieldEl.value = selectedItem.dataset.dynamicField || "";
  }

  await renderImageContent(selectedItem);
}

//Responsive View
const desktopViewBtn = document.getElementById("desktop-view-btn");
const mobileViewBtn = document.getElementById("mobile-view-btn");

desktopViewBtn?.addEventListener("click", () => {
  responsiveViewMode = "manual";
  manualResponsiveView = "desktop";
  applyResponsiveViewMode();
});

mobileViewBtn?.addEventListener("click", () => {
  responsiveViewMode = "manual";
  manualResponsiveView = "mobile";
  applyResponsiveViewMode();
});

// open file picker by icon click
imgPickBtn?.addEventListener("click", (e) => {
  e.preventDefault();
  e.stopPropagation();
  imgFileEl?.click();
});

// file chosen -> set image
imgFileEl?.addEventListener("change", async (e) => {
  if (!selectedItem || selectedItem.dataset.type !== "image") return;

  const file = e.target.files?.[0];
  if (!file) return;

  const img = selectedItem.querySelector(".da-img");
  if (!img) return;

  try {
    // optional quick preview while upload happens
    const tempUrl = URL.createObjectURL(file);
    img.src = tempUrl;

    // upload immediately
    const uploadedUrl = await uploadTemplateImage(file);

    // save permanent URL on the element
    selectedItem.dataset.src = uploadedUrl;
    img.src = uploadedUrl;

    // reset image position nicely
    selectedItem.dataset.posX = "50";
    selectedItem.dataset.posY = "50";
    img.style.objectPosition = "50% 50%";

    console.log("[builder] image uploaded:", uploadedUrl);
  } catch (err) {
    console.error("[builder] image upload failed:", err);
    alert(err?.message || "Failed to upload image.");
  } finally {
    e.target.value = "";
  }
});

// listeners
imgFitEl?.addEventListener("change", applyImageFromBar);
imgZoomEl?.addEventListener("input", applyImageFromBar);
imgBWEl?.addEventListener("input", applyImageFromBar);
imgBCEl?.addEventListener("input", applyImageFromBar);
imgRadEl?.addEventListener("input", applyImageFromBar);

imgModeEl?.addEventListener("change", applyImageFromBar);

imgDynamicSourceEl?.addEventListener("change", async () => {
  await populateImageDynamicFieldOptions(selectedItem);
  await applyImageFromBar();
});

imgDynamicFieldEl?.addEventListener("change", applyImageFromBar);
// BUTTON BAR WIRING (Step 5)
// =======================
// =======================
// BUTTON BAR SELECTORS
// =======================


const btnWrap = floatingBar.querySelector(".da-btnControls");
const textDynamicWrap = floatingBar.querySelector(".da-textDynamicControls");
const textModeEl = floatingBar.querySelector(".da-text__mode");
const textDynamicSourceEl = floatingBar.querySelector(".da-text__dynamicSource");
const textDynamicFieldEl = floatingBar.querySelector(".da-text__dynamicField");

const textSelectedRecordEl = floatingBar.querySelector(".da-text__selectedRecord");
const textRecordFieldEl = floatingBar.querySelector(".da-text__recordField");
const textNestedFieldEl = floatingBar.querySelector(".da-text__nestedField");
const textNestedSelectedRecordEl = floatingBar.querySelector(".da-text__nestedSelectedRecord");

const sectionDynamicWrap = floatingBar.querySelector(".da-sectionDynamicControls");
const sectionModeEl = floatingBar.querySelector(".da-section__mode");
const sectionDynamicSourceEl = floatingBar.querySelector(".da-section__dynamicSource");
const sectionDynamicDataTypeEl = floatingBar.querySelector(".da-section__dynamicDataType");


const groupDynamicWrap = floatingBar.querySelector(".da-groupDynamicControls");
const groupModeEl = floatingBar.querySelector(".da-group__mode");
const groupDynamicSourceEl = floatingBar.querySelector(".da-group__dynamicSource");
const groupBindModeEl = floatingBar.querySelector(".da-group__bindMode");
const groupDynamicFieldEl = floatingBar.querySelector(".da-group__dynamicField");
const groupSelectedItemEl = floatingBar.querySelector(".da-group__selectedItem");
const groupItemFieldEl = floatingBar.querySelector(".da-group__itemField");

const groupNestedFieldEl = floatingBar.querySelector(".da-group__nestedField");
const groupNestedSelectedItemEl = floatingBar.querySelector(".da-group__nestedSelectedItem");

const btnLabelEl = floatingBar.querySelector(".da-btn__label");
const btnBgEl = floatingBar.querySelector(".da-btn__bg");
const btnTextColorEl = floatingBar.querySelector(".da-btn__textColor");
const btnBwEl = floatingBar.querySelector(".da-btn__borderWidth");
const btnBcEl = floatingBar.querySelector(".da-btn__borderColor");
const btnBsEl = floatingBar.querySelector(".da-btn__borderStyle");
const btnRadiusEl = floatingBar.querySelector(".da-btn__radius");

// NEW
const btnDisplayTypeEl = floatingBar.querySelector(".da-btn__displayType");
const btnIconEl = floatingBar.querySelector(".da-btn__icon");


//Button Helper
function updateButtonActionUI() {
  if (!btnActionTypeEl || !btnActionTargetEl || !btnActionTargetSelectEl) return;

  const type = btnActionTypeEl.value || "none";
  const currentValue = selectedItem?.dataset?.actionTarget || btnActionTargetEl.value || "";

const useSelect =
  type === "change-view" ||
  type === "open-popup" ||
  type === "scroll-to-section" ||
  type === "open-template";

  if (btnSubmitInputsWrapEl) {
    btnSubmitInputsWrapEl.style.display = "none";
  }

  if (useSelect) {
    populateButtonTargetSelect(type, currentValue);
    btnActionTargetEl.style.display = "none";
    btnActionTargetSelectEl.style.display = "inline-block";
    if (btnPdfPickEl) btnPdfPickEl.style.display = "none";
    return;
  }

  btnActionTargetSelectEl.style.display = "none";
  btnActionTargetEl.style.display = "inline-block";
  if (btnPdfPickEl) btnPdfPickEl.style.display = "none";

  if (type === "link") {
    btnActionTargetEl.placeholder = "https://example.com";
    return;
  }

  if (type === "download-pdf") {
    btnActionTargetEl.style.display = "none";
    if (btnPdfPickEl) btnPdfPickEl.style.display = "inline-block";
    return;
  }

if (type === "submit") {
  btnActionTargetEl.style.display = "none";
  btnActionTargetSelectEl.style.display = "none";

  if (btnActionSourceEl) {
    btnActionSourceEl.style.display = "none";
  }

  // TEMP: hide old submit-input picker for application-template flow
  if (btnSubmitInputsWrapEl) {
    btnSubmitInputsWrapEl.style.display = "none";
  }

  return;
}

  btnActionTargetEl.placeholder = "";
}

btnActionTypeEl?.addEventListener("change", () => {
  updateButtonActionUI();
  applyButtonFromBar();
});

btnActionTargetEl?.addEventListener("input", () => {
  applyButtonFromBar();
});

btnActionTargetSelectEl?.addEventListener("change", () => {
  applyButtonFromBar();
});

btnPdfPickEl?.addEventListener("click", () => {
  btnPdfFileEl?.click();
});

updateButtonActionUI();

btnBgEl?.addEventListener("input", (e) => {
  if (!selectedItem) return;
  if (selectedItem.dataset.type !== "button") return;

  const val = e.target.value;
  selectedItem.dataset.btnBg = val;

  const b = selectedItem.querySelector(".da-btn");
  if (b) {
    b.style.background =
      selectedItem.dataset.btnBgOn === "0"
        ? "transparent"
        : val;
  }
});
// =======================
// APPLY BUTTON SETTINGS FROM BAR
// =======================
function applyButtonFromBar() {
  if (!selectedItem) return;
if (
  selectedItem.dataset.type !== "button" &&
  selectedItem.dataset.type !== "text"
) return;

 if (selectedItem.dataset.type === "text") {
  selectedItem.dataset.text = btnLabelEl?.value ?? "";
} else {
  selectedItem.dataset.label = btnLabelEl?.value ?? "Button";
}

  if (selectedItem.dataset.btnBgOn !== "0") {
    selectedItem.dataset.btnBg = btnBgEl?.value || "#111111";
  }

  selectedItem.dataset.btnTextColor = btnTextColorEl?.value || "#ffffff";
  selectedItem.dataset.borderWidth = String(parseInt(btnBwEl?.value || "0", 10) || 0);
  selectedItem.dataset.borderColor = btnBcEl?.value || "#111111";
  selectedItem.dataset.borderStyle = btnBsEl?.value || "solid";
  selectedItem.dataset.radius = String(parseInt(btnRadiusEl?.value || "0", 10) || 0);
selectedItem.dataset.actionType = btnActionTypeEl?.value || "none";
selectedItem.dataset.actionSource = btnActionSourceEl?.value || "page";
selectedItem.dataset.actionTarget = btnActionTargetEl?.value || "";

  const type = selectedItem.dataset.actionType;
  const useSelect =
    type === "change-view" ||
    type === "open-popup" ||
    type === "scroll-to-section" ||
    type === "open-template";

  if (useSelect) {
    selectedItem.dataset.actionTarget = (btnActionTargetSelectEl?.value || "").trim();
  } else if (type === "download-pdf") {
    selectedItem.dataset.actionTarget = selectedItem.dataset.actionTarget || "";
  } else if (type === "submit") {
    selectedItem.dataset.actionTarget = "";
    selectedItem.dataset.submitInputs = JSON.stringify(getCheckedSubmitInputIds());
  } else {
    selectedItem.dataset.actionTarget = (btnActionTargetEl?.value || "").trim();
  }

  if (useSelect && btnActionTargetSelectEl && selectedItem) {
    selectedItem.dataset.actionTarget = btnActionTargetSelectEl.value || "";
  }

  console.log("[applyButtonFromBar]", {
    type,
    actionTarget: selectedItem.dataset.actionTarget
  });

  selectedItem.dataset.displayType = btnDisplayTypeEl?.value || "text";
  selectedItem.dataset.icon = btnIconEl?.value || "";

  const b = selectedItem.querySelector(".da-btn");
  if (!b) return;

  renderButtonContent(selectedItem);

  b.style.background =
    selectedItem.dataset.btnBgOn === "0"
      ? "transparent"
      : (selectedItem.dataset.btnBg || "#111111");

  b.style.color = selectedItem.dataset.btnTextColor;

  const bw = parseInt(selectedItem.dataset.borderWidth, 10) || 0;
  const bs = selectedItem.dataset.borderStyle || "solid";
  const bc = selectedItem.dataset.borderColor || "#111111";

  b.style.border =
    (bs === "none" || bw === 0)
      ? "none"
      : `${bw}px ${bs} ${bc}`;

  b.style.borderRadius = `${parseInt(selectedItem.dataset.radius, 10) || 0}px`;
}

// listeners
btnLabelEl?.addEventListener("input", applyButtonFromBar);
btnBgEl?.addEventListener("input", applyButtonFromBar);
btnTextColorEl?.addEventListener("input", applyButtonFromBar);
btnBwEl?.addEventListener("input", applyButtonFromBar);
btnBcEl?.addEventListener("input", applyButtonFromBar);
btnBsEl?.addEventListener("change", applyButtonFromBar);
btnRadiusEl?.addEventListener("input", applyButtonFromBar);

// NEW

btnActionTypeEl?.addEventListener("change", applyButtonFromBar);
btnActionSourceEl?.addEventListener("change", applyButtonFromBar);
btnActionTargetEl?.addEventListener("input", applyButtonFromBar);
btnDisplayTypeEl?.addEventListener("change", applyButtonFromBar);
btnIconEl?.addEventListener("input", applyButtonFromBar);
btnActionTargetSelectEl?.addEventListener("change", applyButtonFromBar);

//Text 
textModeEl?.addEventListener("change", async () => {
  console.log("[text/event] mode changed:", textModeEl.value);
  await applyTextDynamicFromBar();
});

textDynamicSourceEl?.addEventListener("change", async () => {
  console.log("[text/event] source changed:", textDynamicSourceEl.value);
  if (!selectedItem || selectedItem.dataset.type !== "text") return;

  selectedItem.dataset.dynamicSource = textDynamicSourceEl.value || "page";
  selectedItem.dataset.dynamicField = "";
  selectedItem.dataset.selectedRecordId = "";
  selectedItem.dataset.nestedField = "";
  selectedItem.dataset.nestedSelectedRecordId = "";
  selectedItem.dataset.recordField = "";

  await applyTextDynamicFromBar();
});

textDynamicFieldEl?.addEventListener("change", async () => {
  console.log("[text/event] dynamicField changed:", textDynamicFieldEl.value);
  if (!selectedItem || selectedItem.dataset.type !== "text") return;

  selectedItem.dataset.dynamicField = textDynamicFieldEl.value || "";
  selectedItem.dataset.selectedRecordId = "";
  selectedItem.dataset.nestedField = "";
  selectedItem.dataset.nestedSelectedRecordId = "";
  selectedItem.dataset.recordField = "";

  await applyTextDynamicFromBar();
});

textSelectedRecordEl?.addEventListener("change", async () => {
  console.log("[text/event] selectedRecord changed:", textSelectedRecordEl.value);
  if (!selectedItem || selectedItem.dataset.type !== "text") return;

  selectedItem.dataset.selectedRecordId = textSelectedRecordEl.value || "";
  selectedItem.dataset.nestedField = "";
  selectedItem.dataset.nestedSelectedRecordId = "";
  selectedItem.dataset.recordField = "";

  await applyTextDynamicFromBar();
});
textRecordFieldEl?.addEventListener("change", async () => {
  console.log("[text/event] recordField changed:", textRecordFieldEl.value);
  if (!selectedItem || selectedItem.dataset.type !== "text") return;

  selectedItem.dataset.recordField = textRecordFieldEl.value || "";

  await applyTextDynamicFromBar();
});

textNestedFieldEl?.addEventListener("change", async () => {
  if (!selectedItem || selectedItem.dataset.type !== "text") return;

  selectedItem.dataset.nestedField = textNestedFieldEl.value || "";
  selectedItem.dataset.nestedSelectedRecordId = "";
  selectedItem.dataset.recordField = "";

  await applyTextDynamicFromBar();
});

textNestedSelectedRecordEl?.addEventListener("change", async () => {
  if (!selectedItem || selectedItem.dataset.type !== "text") return;

  selectedItem.dataset.nestedSelectedRecordId = textNestedSelectedRecordEl.value || "";
  selectedItem.dataset.recordField = "";

  await applyTextDynamicFromBar();
});

//Group

groupModeEl?.addEventListener("change", async () => {
  populateGroupDynamicFieldOptions(selectedItem);
  await populateGroupSelectedItemOptions(selectedItem);
  await populateGroupItemFieldOptions(selectedItem);
  applyGroupDynamicFromBar();
});

groupDynamicSourceEl?.addEventListener("change", async () => {
  populateGroupDynamicFieldOptions(selectedItem);
  await populateGroupSelectedItemOptions(selectedItem);
  await populateGroupItemFieldOptions(selectedItem);
  applyGroupDynamicFromBar();
});

groupBindModeEl?.addEventListener("change", async () => {
  populateGroupDynamicFieldOptions(selectedItem);
  await populateGroupSelectedItemOptions(selectedItem);
  await populateGroupItemFieldOptions(selectedItem);
  applyGroupDynamicFromBar();
});

groupDynamicFieldEl?.addEventListener("change", async () => {
  if (selectedItem) {
    selectedItem.dataset.dynamicField = groupDynamicFieldEl.value;
  }

  await applyGroupDynamicFromBar();
});

groupSelectedItemEl?.addEventListener("change", async () => {
  if (!selectedItem || selectedItem.dataset.type !== "group") return;

  // save selected suite
  selectedItem.dataset.selectedItemId = groupSelectedItemEl.value || "";

  // 🔥 RESET downstream state (VERY IMPORTANT)

  selectedItem.dataset.finalDataType = "";
  selectedItem.dataset.finalDataTypeId = "";
  selectedItem.dataset.itemField = "";

  // 🔥 THIS IS THE MISSING STEP
  await populateGroupNestedFieldOptions(selectedItem);

  // keep these
  await populateGroupNestedSelectedItemOptions(selectedItem);
  await populateGroupItemFieldOptions(selectedItem);

  updateGroupBarVisibility(selectedItem);
  await applyGroupDynamicFromBar();
});

groupItemFieldEl?.addEventListener("change", () => {
  applyGroupDynamicFromBar();
});

groupNestedFieldEl?.addEventListener("change", async () => {
  if (!selectedItem || selectedItem.dataset.type !== "group") return;

  selectedItem.dataset.nestedField = groupNestedFieldEl.value || "";
  selectedItem.dataset.nestedSelectedItemId = "";
  selectedItem.dataset.itemField = "";
  selectedItem.dataset.finalDataType = "";
  selectedItem.dataset.finalDataTypeId = "";

  await populateGroupNestedSelectedItemOptions(selectedItem);
  await populateGroupItemFieldOptions(selectedItem);

  updateGroupBarVisibility(selectedItem);
  await applyGroupDynamicFromBar();
});

groupNestedSelectedItemEl?.addEventListener("change", async () => {
  if (!selectedItem || selectedItem.dataset.type !== "group") return;

  selectedItem.dataset.nestedSelectedItemId = groupNestedSelectedItemEl.value || "";
  selectedItem.dataset.itemField = "";

  await populateGroupItemFieldOptions(selectedItem);

  updateGroupBarVisibility(selectedItem);
  await applyGroupDynamicFromBar();
});

// ✅ Fill font dropdown from FONT_LIBRARY
const fontSelect = floatingBar.querySelector(".da-floatingBar__font");
if (fontSelect) {
  fontSelect.innerHTML =
    `<option value="system-ui" data-gf="">System</option>` +
    FONT_LIBRARY.map(f => `<option value="${f.css}" data-gf="${f.gf}">${f.label}</option>`).join("");
}



// ✅ SECTION BORDER inputs (PUT THIS RIGHT HERE)
const bwEl = floatingBar.querySelector(".da-secBorder__width");
const bcEl = floatingBar.querySelector(".da-secBorder__color");
const bsEl = floatingBar.querySelector(".da-secBorder__style");
const brEl = floatingBar.querySelector(".da-secBorder__radius");

const parallaxEl = floatingBar.querySelector(".da-parallax");

parallaxEl?.addEventListener("input", () => {
  if (!selectedItem) return;

  selectedItem.dataset.parallax = parallaxEl.value || "0";

  console.log("[parallax slider]", {
    selectedId: selectedItem.dataset.id,
    type: selectedItem.dataset.type,
    value: parallaxEl.value,
    saved: selectedItem.dataset.parallax
  });

  applyParallax();
  saveCurrentCanvasToView();
});

function reorderItemWithinParent(item, direction) {
  if (!item) return;

  const parentId = item.dataset.parent || "";
  const parentEl = parentId ? getItemById(parentId) : null;

  const siblings = [...grid.querySelectorAll(".da-item")].filter((el) => {
    return (el.dataset.parent || "") === parentId;
  });

  if (!siblings.length) return;

  siblings.sort((a, b) => {
    const za = parseInt(a.style.zIndex || "1", 10);
    const zb = parseInt(b.style.zIndex || "1", 10);
    return za - zb;
  });

  const currentIndex = siblings.indexOf(item);
  if (currentIndex === -1) return;

  siblings.splice(currentIndex, 1);

  if (direction === "front") {
    siblings.push(item);
  }

  if (direction === "back") {
    siblings.unshift(item);
  }

  // IMPORTANT:
  // children must stay ABOVE their parent container
  const parentZ = parentEl ? parseInt(parentEl.style.zIndex || "1", 10) : 1;
  const baseZ = parentEl ? parentZ + 1 : 1;

  siblings.forEach((el, index) => {
    el.style.zIndex = String(baseZ + index);
  });
}

function applySectionBorderFromBar() {
  if (!selectedItem) return;

if (
  selectedItem.dataset.type !== "section" &&
  selectedItem.dataset.type !== "group" &&
  selectedItem.dataset.type !== "popup" &&
  selectedItem.dataset.type !== "header"
) return;

  selectedItem.dataset.borderWidth = String(parseInt(bwEl?.value || "0", 10) || 0);
  selectedItem.dataset.borderColor = bcEl?.value || "#111111";
  selectedItem.dataset.borderStyle = bsEl?.value || "solid";
  selectedItem.dataset.radius = String(parseInt(brEl?.value || "0", 10) || 0);

  const on = selectedItem.dataset.borderOn === "1";

  selectedItem.style.border = on
    ? `${selectedItem.dataset.borderWidth}px ${selectedItem.dataset.borderStyle} ${selectedItem.dataset.borderColor}`
    : "none";

  selectedItem.style.borderRadius = `${parseInt(selectedItem.dataset.radius, 10) || 0}px`;
}
function applySectionDynamicFromBar() {
  if (!selectedItem) return;

  const t = selectedItem.dataset.type;
  if (t !== "section" && t !== "group" && t !== "popup") return;

  const pageType = window.TPL_PAGE_TYPE || "booking";
  const dataType = getMainDataTypeForPageType(pageType);

  selectedItem.dataset.dynamicMode = sectionModeEl?.value || "static";
  selectedItem.dataset.dynamicSource = sectionDynamicSourceEl?.value || "page";
  selectedItem.dataset.dynamicDataType = dataType || "";

  const showDynamicStuff = selectedItem.dataset.dynamicMode === "dynamic";

  if (sectionDynamicSourceEl) {
    sectionDynamicSourceEl.style.display = showDynamicStuff ? "inline-block" : "none";
  }

  if (sectionDynamicDataTypeEl) {
    sectionDynamicDataTypeEl.style.display = showDynamicStuff ? "inline-block" : "none";
    sectionDynamicDataTypeEl.value = dataType || "";
  }
}

bwEl?.addEventListener("input", applySectionBorderFromBar);
bcEl?.addEventListener("input", applySectionBorderFromBar);
bsEl?.addEventListener("change", applySectionBorderFromBar);
brEl?.addEventListener("input", applySectionBorderFromBar);

// ✅ ADD THIS RIGHT HERE (ONCE)
const fontSizeEl = floatingBar.querySelector(".da-floatingBar__fontSize");
const txtBtns = [...floatingBar.querySelectorAll(".da-txtBtn")];

const fontEl = floatingBar.querySelector(".da-floatingBar__font");
if (fontEl) {
  fontEl.addEventListener("change", (e) => {
    if (!selectedItem) return;
    if (selectedItem.dataset.type !== "text") return;

    const opt = e.target.selectedOptions?.[0];
    const css = e.target.value || "system-ui";
    const gf  = opt?.dataset?.gf || "";

    ensureGoogleFontLoaded(gf);

    selectedItem.dataset.fontFamily = css;

    const textEl = selectedItem.querySelector(".da-text");
    if (textEl) textEl.style.fontFamily = css;
  });
}
//Floating Bar Helper to show and hide in sidebar
floatingBar.addEventListener("click", (e) => {
  const backBtn = e.target.closest(".da-editorBackBtn");
  if (!backBtn) return;

  e.preventDefault();
  e.stopPropagation();

  grid.querySelectorAll(".da-item").forEach((x) => x.classList.remove("is-selected"));
  selectedItem = null;
  unmountBarToCanvas();
});

//Show and hide buttons for Header store name,logo,and tabs
floatingBar.addEventListener("click", (e) => {
  const btn = e.target.closest(".da-headerPartBtn");
  if (!btn) return;

  const partName = btn.dataset.headerPart || "";
  const parts = getHeaderPartsMap();
  const part = parts[partName];
  if (!part) return;

  const hiddenNow = part.dataset.hidden === "1";
  setHeaderPartHidden(partName, !hiddenNow);

  layoutHeaderChildren();
  syncHeaderPartButtons();
});



// ✅ Handle layer buttons even when clicked inside the floating bar
floatingBar.addEventListener("click", (e) => {
const btn = e.target.closest("[data-action]");
if (!btn) return;


  e.preventDefault();
  e.stopPropagation();

  if (!selectedItem) return;

  const action = btn.getAttribute("data-action");

  if (action === "toggleHide") {
  if (!selectedItem) return;
  if (selectedItem.dataset.type === "header") return;

  const next = selectedItem.dataset.hidden === "1" ? "0" : "1";
  selectedItem.dataset.hidden = next;
  selectedItem.style.display = next === "1" ? "none" : "";

  const kids = getChildrenDeep(selectedItem);
  kids.forEach((child) => {
    child.dataset.hidden = next;
    child.style.display = next === "1" ? "none" : "";
  });

  showBarForItem(null);
  return;
}

    if (action === "duplicate") {
    // clone the selected item
    const clone = selectedItem.cloneNode(true);
grid.appendChild(clone);
refreshPopupList();
    // give it a new id so it’s unique
    clone.dataset.id = uid("section");

    // offset it a little so you can see it duplicated
    const left = (parseFloat(selectedItem.style.left) || 0) + 24;
    const top  = (parseFloat(selectedItem.style.top) || 0) + 24;
    clone.style.left = `${Math.round(left)}px`;
    clone.style.top  = `${Math.round(top)}px`;

    // keep the same name + bg
  clone.dataset.name = selectedItem.dataset.name || "Section";
                                                            

                                                         //STEP 6
const t = (selectedItem.dataset.type || "");

if (t === "text") {
  clone.dataset.color = selectedItem.dataset.color || "#111111";
  clone.dataset.fontSize = selectedItem.dataset.fontSize || "24";
  clone.dataset.fontFamily = selectedItem.dataset.fontFamily || "system-ui";
  clone.dataset.bold = selectedItem.dataset.bold || "0";
  clone.dataset.italic = selectedItem.dataset.italic || "0";
  clone.dataset.underline = selectedItem.dataset.underline || "0";
  clone.dataset.align = selectedItem.dataset.align || "left";

  const tx = clone.querySelector(".da-text");
  if (tx) {
    tx.style.color = clone.dataset.color;
    tx.style.fontSize = `${parseInt(clone.dataset.fontSize, 10) || 24}px`;
    tx.style.fontFamily = clone.dataset.fontFamily;
    tx.style.fontWeight = (clone.dataset.bold === "1") ? "700" : "400";
    tx.style.fontStyle = (clone.dataset.italic === "1") ? "italic" : "normal";
    tx.style.textDecoration = (clone.dataset.underline === "1") ? "underline" : "none";
    tx.style.textAlign = clone.dataset.align;
  }
}

else if (t === "button") {
  clone.dataset.label = selectedItem.dataset.label ?? "Button";
  clone.dataset.btnBg = selectedItem.dataset.btnBg || "#111111";
  clone.dataset.btnTextColor = selectedItem.dataset.btnTextColor || "#ffffff";
  clone.dataset.borderWidth = selectedItem.dataset.borderWidth || "0";
  clone.dataset.borderColor = selectedItem.dataset.borderColor || "#111111";
  clone.dataset.borderStyle = selectedItem.dataset.borderStyle || "solid";
  clone.dataset.radius = selectedItem.dataset.radius || "12";
  clone.dataset.href = selectedItem.dataset.href || "";

  const b = clone.querySelector(".da-btn");
  if (b) {
    b.textContent = clone.dataset.label;
    b.style.background =
  clone.dataset.btnBgOn === "0"
    ? "transparent"
    : (clone.dataset.btnBg || "#111111");
    b.style.color = clone.dataset.btnTextColor;

    const bw = parseInt(clone.dataset.borderWidth, 10) || 0;
    const bs = clone.dataset.borderStyle || "solid";
    const bc = clone.dataset.borderColor || "#111111";
    b.style.border = (bs === "none" || bw === 0) ? "none" : `${bw}px ${bs} ${bc}`;
    b.style.borderRadius = `${parseInt(clone.dataset.radius, 10) || 0}px`;
  }
}

else {
  // section fallback
  clone.dataset.bg = selectedItem.dataset.bg || "#f2b26b";
  clone.style.background = clone.dataset.bg;

  // section border copy if you have it
  clone.dataset.borderOn = selectedItem.dataset.borderOn || "0";
  clone.dataset.borderWidth = selectedItem.dataset.borderWidth || "0";
  clone.dataset.borderColor = selectedItem.dataset.borderColor || "#111111";
  clone.dataset.borderStyle = selectedItem.dataset.borderStyle || "solid";
  clone.dataset.radius = selectedItem.dataset.radius || "0";

  const on = clone.dataset.borderOn === "1";
  clone.style.border = on
    ? `${parseInt(clone.dataset.borderWidth, 10) || 0}px ${clone.dataset.borderStyle} ${clone.dataset.borderColor}`
    : "none";
  clone.style.borderRadius = `${parseInt(clone.dataset.radius, 10) || 0}px`;
}

//////////////////////////////////////////////////////////////////////////
    // put it on top
    const all = [...grid.querySelectorAll(".da-item")];
    const maxZ = all.reduce((m, el) => Math.max(m, parseInt(el.style.zIndex || "1", 10)), 1);
    clone.style.zIndex = String(maxZ + 1);

    // add it
    grid.appendChild(clone);
refreshPopupList();
    // select the clone + show bar on it
    grid.querySelectorAll(".da-item").forEach(x => x.classList.remove("is-selected"));
    clone.classList.add("is-selected");
    showBarForItem(clone);

    return;
  }

if (action === "remove") {
    if (selectedItem?.dataset?.locked === "1") return;

    const kids = getChildrenDeep(selectedItem);
    kids.forEach((el) => el.remove());

    selectedItem.remove();
    selectedItem = null;
    showBarForItem(null);
    refreshPopupList();
    return;
  }

if (action === "bringFront") {
  reorderItemWithinParent(selectedItem, "front");
  return;
}

if (action === "sendBack") {
  reorderItemWithinParent(selectedItem, "back");
  return;
}
});

//Border Styling
floatingBar.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-sec]");
  if (!btn) return;

  if (!selectedItem) return;

  if (
    selectedItem.dataset.type !== "section" &&
    selectedItem.dataset.type !== "group" &&
    selectedItem.dataset.type !== "popup"
  ) return;

  e.preventDefault();
  e.stopPropagation();

  const action = btn.getAttribute("data-sec");

  if (action === "borderToggle") {
    const next = (selectedItem.dataset.borderOn === "1") ? "0" : "1";
    selectedItem.dataset.borderOn = next;

    selectedItem.style.border = (next === "1")
      ? `${selectedItem.dataset.borderWidth || 2}px ${selectedItem.dataset.borderStyle || "solid"} ${selectedItem.dataset.borderColor || "#111111"}`
      : "none";

    showBarForItem(selectedItem);
  }
});
//Header background
floatingBar.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-sec]");
  if (!btn) return;
  if (!selectedItem) return;

if (
  selectedItem.dataset.type !== "section" &&
  selectedItem.dataset.type !== "group" &&
  selectedItem.dataset.type !== "popup" &&
  selectedItem.dataset.type !== "header"
) return;

  const action = btn.getAttribute("data-sec");

  if (action === "bgToggle") {
    const next = (selectedItem.dataset.bgOn === "1") ? "0" : "1";
    selectedItem.dataset.bgOn = next;

    selectedItem.style.background =
      next === "1"
        ? (selectedItem.dataset.bg || "#f2f2f2")
        : "transparent";

    showBarForItem(selectedItem);
  }
});

//Header Helper
function getHeaderChildByName(name) {
  const header = grid.querySelector(".da-item.da-header");
  if (!header) return null;

  const headerId = header.dataset.id;
  if (!headerId) return null;

  const kids = [...grid.querySelectorAll(`.da-item[data-parent="${headerId}"]`)];
  return kids.find((el) => (el.dataset.name || "") === name) || null;
}

function setHeaderPartVisible(name, isVisible) {
  const part = getHeaderChildByName(name);
  if (!part) return;

  part.dataset.hidden = isVisible ? "0" : "1";
  part.style.display = isVisible ? "" : "none";

  const kids = getChildrenDeep(part);
  kids.forEach((child) => {
    child.dataset.hidden = isVisible ? "0" : "1";
    child.style.display = isVisible ? "" : "none";
  });
}

function syncHeaderToggleButtons() {
  const wrap = floatingBar.querySelector(".da-headerControls");
  if (!wrap) return;

  const buttons = wrap.querySelectorAll(".da-headerPartBtn");

  buttons.forEach((btn) => {
    const name = btn.dataset.headerPart || "";
    const part = getHeaderChildByName(name);
    const hidden = part?.dataset?.hidden === "1";

    btn.classList.toggle("is-off", hidden);
  });
}

floatingBar.addEventListener("click", (e) => {
  const btn = e.target.closest(".da-headerPartBtn");
  if (!btn) return;

  e.preventDefault();
  e.stopPropagation();

  const partName = btn.dataset.headerPart || "";
  const parts = getHeaderPartsMap();
  const part = parts[partName];
  if (!part) return;

  const hiddenNow = part.dataset.hidden === "1";
  setHeaderPartHidden(partName, !hiddenNow);

  syncHeaderPartButtons();
});


//Add italics and bold to bar for texts 
// ✅ Text controls (bold/italic/underline/align) for TEXT items only
floatingBar.addEventListener("click", (e) => {
  const tbtn = e.target.closest("[data-txt]");
  if (!tbtn) return;

  if (!selectedItem) return;
  if (selectedItem.dataset.type !== "text") return;

  e.preventDefault();
  e.stopPropagation();

  const action = tbtn.getAttribute("data-txt");
  const textEl = selectedItem.querySelector(".da-text");
  if (!textEl) return;

  if (action === "bold") {
    const next = (selectedItem.dataset.bold === "1") ? "0" : "1";
    selectedItem.dataset.bold = next;
    textEl.style.fontWeight = (next === "1") ? "700" : "400";
  }

  if (action === "italic") {
    const next = (selectedItem.dataset.italic === "1") ? "0" : "1";
    selectedItem.dataset.italic = next;
    textEl.style.fontStyle = (next === "1") ? "italic" : "normal";
  }

  if (action === "underline") {
    const next = (selectedItem.dataset.underline === "1") ? "0" : "1";
    selectedItem.dataset.underline = next;
    textEl.style.textDecoration = (next === "1") ? "underline" : "none";
  }

  if (action === "alignLeft" || action === "alignCenter" || action === "alignRight") {
    const align =
      action === "alignLeft" ? "left" :
      action === "alignCenter" ? "center" : "right";

    selectedItem.dataset.align = align;
    textEl.style.textAlign = align;
  }

  // ✅ refresh button highlight states
  showBarForItem(selectedItem);
});

//Header
// =======================
// HEADER
//Header Helper
function getFullCanvasWidth() {
  return grid.scrollWidth || grid.clientWidth || 1200;
}
const canvasWrap = document.querySelector(".tpl-dropArea");

function addLockedHeaderAt(saved = {}) {
  grid.querySelectorAll(".da-item.da-header").forEach((el) => el.remove());

  const header = document.createElement("div");
  header.className = "da-item da-header";
  header.dataset.type = "header";
  header.dataset.locked = "1";
  header.dataset.id = saved.id || uid("header");

  header.dataset.bg = saved.bg || "#ffffff";
  header.dataset.bgOn = saved.bgOn || "1";

  header.style.position = "absolute";
  header.style.left = "0px";
  header.style.top = "0px";
  header.style.width = "100%";
  header.style.height = "90px";
  header.style.background = header.dataset.bgOn === "1" ? header.dataset.bg : "transparent";
  header.style.border = "none";
  header.style.zIndex = "9999";
  header.style.boxSizing = "border-box";

  requestAnimationFrame(() => {
    layoutHeaderChildren();
  });

  grid.appendChild(header);
  return header;
}

function layoutHeaderChildren() {
  const header = grid.querySelector(".da-item.da-header");
  if (!header) return;

  const headerId = header.dataset.id;
  if (!headerId) return;

  const kids = [...grid.querySelectorAll(`.da-item[data-parent="${headerId}"]`)];

  const storeName = kids.find(el => (el.dataset.name || "").toLowerCase().includes("store"));
  const tabsGroup = kids.find(el => (el.dataset.name || "").toLowerCase().includes("tabs"));
  const cartIcon = kids.find(el => (el.dataset.name || "").toLowerCase().includes("cart"));
  const userIcon = kids.find(el => {
    const n = (el.dataset.name || "").toLowerCase();
    return n.includes("user") || n.includes("profile");
  });

  const headerW = header.offsetWidth;

  if (storeName) {
    storeName.style.left = "40px";
    storeName.style.top = "22px";
  }

if (tabsGroup) {
  if (!tabsGroup.dataset.defaultSized) {
    tabsGroup.style.width = "420px";
    tabsGroup.style.height = "56px";
    tabsGroup.dataset.defaultSized = "1";
  }

  if (!tabsGroup.classList.contains("is-selected")) {
    const tabsW = tabsGroup.offsetWidth || 420;
    tabsGroup.style.left = `${Math.round((headerW - tabsW) / 2)}px`;
    tabsGroup.style.top = "22px";
  }
}

  if (cartIcon) {
    const cartW = cartIcon.offsetWidth || 32;
    cartIcon.style.left = `${headerW - 110}px`;
    cartIcon.style.top = "28px";
  }

  if (userIcon) {
    const userW = userIcon.offsetWidth || 32;
    userIcon.style.left = `${headerW - 60}px`;
    userIcon.style.top = "28px";
  }
}

function ensureDefaultHeader() {
  addLockedHeaderAt();
}

ensureDefaultHeader();

window.addEventListener("resize", () => {
  const header = grid.querySelector(".da-item.da-header");
  if (!header) return;

  header.style.left = "0px";
  header.style.top = "0px";
 header.style.width = "100%";
layoutHeaderChildren();
  header.style.height = "90px";


});

//Header Helper (logo,store name,and tabs)
function getHeaderPartsMap() {
  const header = grid.querySelector(".da-item.da-header");
  if (!header) return {};

  const all = getChildrenDeep(header);

  const byName = (matcher) =>
    all.find((el) => matcher((el.dataset.name || "").trim().toLowerCase())) || null;

  const byText = (matcher) =>
    all.find((el) => {
      const txt = (el.querySelector(".da-text")?.textContent || "").trim().toLowerCase();
      return matcher(txt);
    }) || null;

  const tabs =
    byName((n) => n.includes("tabs") || n.includes("tab")) ||
    null;

  const logo =
    byName((n) => n.includes("logo")) ||
    all.find((el) => el.dataset.type === "image") ||
    null;

  const store =
    byName((n) => n.includes("store") || n.includes("location")) ||
    byText((t) => t.includes("my store") || t.includes("location")) ||
    all.find((el) => el.dataset.type === "text" && el !== tabs) ||
    null;

  const cart =
    byName((n) => n.includes("cart")) ||
    byText((t) => t.includes("cart") || t.includes("🛒") || t.includes("bag")) ||
    null;

  const profile =
    byName((n) => n.includes("profile") || n.includes("user")) ||
    byText((t) => t.includes("user") || t.includes("profile") || t.includes("👤")) ||
    null;

  if (logo && !logo.dataset.name) logo.dataset.name = "Logo";
  if (store && !store.dataset.name) store.dataset.name = "Store Name";
  if (tabs && !tabs.dataset.name) tabs.dataset.name = "Tabs";
  if (cart && !cart.dataset.name) cart.dataset.name = "Cart";
  if (profile && !profile.dataset.name) profile.dataset.name = "Profile";

  return {
    "Logo": logo,
    "Store Name": store,
    "Tabs": tabs,
    "Cart": cart,
    "Profile": profile,
  };
}

function syncLockedHeaderWidth() {
  const header = document.querySelector(".da-item.da-header");
  const grid = document.getElementById("dropAreaInner");
  if (!header || !grid) return;

  let targetWidth;

  if (currentResponsiveView === "mobile") {
    targetWidth = parseFloat(grid.style.width) || grid.clientWidth;
  } else {
    targetWidth = grid.scrollWidth || grid.clientWidth;
  }

  header.style.left = "0px";
  header.style.top = "0px";
  header.style.width = `${targetWidth}px`;
  header.style.minWidth = `${targetWidth}px`;
  header.style.maxWidth = `${targetWidth}px`;
  header.style.boxSizing = "border-box";
}

function setHeaderPartHidden(partName, hidden) {
  const parts = getHeaderPartsMap();
  const el = parts[partName];
  if (!el) return;

  el.dataset.hidden = hidden ? "1" : "0";
  el.style.display = hidden ? "none" : "";

  const kids = getChildrenDeep(el);
  kids.forEach((child) => {
    child.dataset.hidden = hidden ? "1" : "0";
    child.style.display = hidden ? "none" : "";
  });
}

function syncHeaderPartButtons() {
  const wrap = floatingBar.querySelector(".da-headerControls");
  if (!wrap) return;

  const parts = getHeaderPartsMap();

  wrap.querySelectorAll(".da-headerPartBtn").forEach((btn) => {
    const partName = btn.dataset.headerPart;
    const el = parts[partName];
    const hidden = el?.dataset?.hidden === "1";

    btn.classList.toggle("is-off", !!hidden);

    if (partName === "Store Name") {
      btn.textContent = hidden ? "Show Store" : "Hide Store";
    } else if (partName === "Profile") {
      btn.textContent = hidden ? "Show User" : "Hide User";
    } else {
      btn.textContent = hidden ? `Show ${partName}` : `Hide ${partName}`;
    }
  });
}
//Show and Hide buttons for Header
floatingBar.addEventListener("click", (e) => {
  const btn = e.target.closest(".da-headerPartBtn");
  if (!btn) return;

  e.preventDefault();
  e.stopPropagation();

  const partName = btn.dataset.headerPart || "";
  const parts = getHeaderPartsMap();
  const part = parts[partName];
  if (!part) return;

  const hiddenNow = part.dataset.hidden === "1";
  setHeaderPartHidden(partName, !hiddenNow);

  syncHeaderPartButtons();
});












async function showBarForItem(item) {
  if (!item) {
    floatingBar.style.display = "none";
    return;
  }

  const type = item.dataset.type || "";

  const imgWrap = floatingBar.querySelector(".da-imgControls");
  const videoWrap = floatingBar.querySelector(".da-videoControls");
  const headerWrap = floatingBar.querySelector(".da-headerControls");
  const groupWrap = floatingBar.querySelector(".da-groupDynamicControls");
  const sectionWrap = floatingBar.querySelector(".da-sectionDynamicControls");
  const textWrap = floatingBar.querySelector(".da-textDynamicControls");
  const btnWrap = floatingBar.querySelector(".da-btnControls");
  const inputWrap = floatingBar.querySelector(".da-inputControls");
  const shapeWrap = floatingBar.querySelector(".da-shapeControls");

  const fontEl = floatingBar.querySelector(".da-floatingBar__font");
  const fontSizeEl = floatingBar.querySelector(".da-floatingBar__fontSize");
  const txtBtns = floatingBar.querySelectorAll(".da-txtBtn");

const bgPosXEl = floatingBar.querySelector(".da-backgroundPosX");
const bgPosYEl = floatingBar.querySelector(".da-backgroundPosY");
const bgMoveBtns = floatingBar.querySelectorAll(".da-backgroundMoveBtn");

  if (bgWrap) bgWrap.style.display = "none";

  // hide everything first
  if (imgWrap) imgWrap.style.display = "none";
  if (videoWrap) videoWrap.style.display = "none";
  if (headerWrap) headerWrap.style.display = "none";
  if (groupWrap) groupWrap.style.display = "none";
  if (sectionWrap) sectionWrap.style.display = "none";
  if (textWrap) textWrap.style.display = "none";
  if (btnWrap) btnWrap.style.display = "none";
  if (inputWrap) inputWrap.style.display = "none";
  if (shapeWrap) shapeWrap.style.display = "none";

  if (fontEl) fontEl.style.display = "none";
  if (fontSizeEl) fontSizeEl.style.display = "none";
  txtBtns.forEach((btn) => (btn.style.display = "none"));

  // now show only what matches
if (type === "section") {
  if (sectionWrap) sectionWrap.style.display = "";
  if (floatingBar.querySelector(".da-secBorder__radius")) floatingBar.querySelector(".da-secBorder__radius").style.display = "";
  if (floatingBar.querySelector(".da-secBorder__width")) floatingBar.querySelector(".da-secBorder__width").style.display = "";
  if (floatingBar.querySelector(".da-secBorder__color")) floatingBar.querySelector(".da-secBorder__color").style.display = "";
  if (floatingBar.querySelector(".da-secBorder__style")) floatingBar.querySelector(".da-secBorder__style").style.display = "";
  if (floatingBar.querySelector(".da-floatingBar__color")) floatingBar.querySelector(".da-floatingBar__color").style.display = "";
  if (floatingBar.querySelector('[data-sec="bgToggle"]')) floatingBar.querySelector('[data-sec="bgToggle"]').style.display = "";
  if (floatingBar.querySelector('[data-sec="borderToggle"]')) floatingBar.querySelector('[data-sec="borderToggle"]').style.display = "";
}

if (type === "group") {
  if (groupWrap) groupWrap.style.display = "";
  if (floatingBar.querySelector(".da-secBorder__radius")) floatingBar.querySelector(".da-secBorder__radius").style.display = "";
  if (floatingBar.querySelector(".da-secBorder__width")) floatingBar.querySelector(".da-secBorder__width").style.display = "";
  if (floatingBar.querySelector(".da-secBorder__color")) floatingBar.querySelector(".da-secBorder__color").style.display = "";
  if (floatingBar.querySelector(".da-secBorder__style")) floatingBar.querySelector(".da-secBorder__style").style.display = "";
  if (floatingBar.querySelector(".da-floatingBar__color")) floatingBar.querySelector(".da-floatingBar__color").style.display = "";
  if (floatingBar.querySelector('[data-sec="bgToggle"]')) floatingBar.querySelector('[data-sec="bgToggle"]').style.display = "";
  if (floatingBar.querySelector('[data-sec="borderToggle"]')) floatingBar.querySelector('[data-sec="borderToggle"]').style.display = "";
}

if (item.dataset.type === "background") {
  if (bgWrap) bgWrap.style.display = "flex";

  if (bgPosXEl) bgPosXEl.value = item.dataset.posX || "50";
  if (bgPosYEl) bgPosYEl.value = item.dataset.posY || "50";
}
if (item.dataset.type === "image") {
  if (imgPosXEl) imgPosXEl.value = item.dataset.posX || "50";
  if (imgPosYEl) imgPosYEl.value = item.dataset.posY || "50";
}

if (type === "text") {
  if (textWrap) textWrap.style.display = "";
  if (fontEl) fontEl.style.display = "";
  if (fontSizeEl) fontSizeEl.style.display = "";
  txtBtns.forEach((btn) => (btn.style.display = ""));
}

 selectedItem = item;
window.selectedItem = item;

const headerAncestor = getHeaderAncestor(item);
console.log("[header clamp check]", {
  clickedId: item?.dataset?.id,
  clickedType: item?.dataset?.type,
  clickedParent: item?.dataset?.parent,
  headerAncestorId: headerAncestor?.dataset?.id || null
});

const isActuallyInsideHeader =
  !!headerAncestor &&
  !!item.dataset.parent &&
  item.dataset.parent === headerAncestor.dataset.id;

if (isActuallyInsideHeader && item.dataset.type !== "header") {
  clampElToHeaderBounds(item, headerAncestor);
}
if (!item) {
  unmountBarToCanvas();
  return;
}

  const headerControls = floatingBar.querySelector(".da-headerControls");
if (headerControls) {
  headerControls.style.display = item?.dataset?.type === "header" ? "flex" : "none";
}

if (item?.dataset?.type === "header") {
  syncHeaderPartButtons();
}

const root = document.querySelector(".tpl");
if (!root?.classList.contains("is-collapsed")) {
  mountBarInSidebar();
}
const nameEl = floatingBar.querySelector(".da-floatingBar__name");

if (nameEl) {
  nameEl.value =
    item.dataset.name ||
    (item.dataset.type === "text" ? "Text" :
     item.dataset.type === "image" ? "Image" :
     item.dataset.type === "button" ? "Button" :
     item.dataset.type === "group" ? "Group" :
     item.dataset.type === "popup" ? "Popup" :
     item.dataset.type === "section" ? "Section" :
     item.dataset.type || "");
}

//Parallax
if (parallaxEl) {
  parallaxEl.value = item.dataset.parallax || "0";
}

/////////
//Shape Element
const isShape = item?.dataset?.type === "shape";

if (shapeWrap) shapeWrap.style.display = isShape ? "" : "none";

// hide text-only controls for shape
if (fontEl) fontEl.style.display = isShape ? "none" : "";
if (fontSizeEl) fontSizeEl.style.display = isShape ? "none" : "";

txtBtns.forEach((btn) => {
  btn.style.display = isShape ? "none" : "";
});

if (isShape) {
  if (shapeTypeEl) shapeTypeEl.value = item.dataset.shapeType || "rectangle";
  if (shapeBgEl) shapeBgEl.value = item.dataset.bg || "#d9d9d9";
  if (shapeBgOnEl) shapeBgOnEl.checked = item.dataset.bgOn !== "0";
  if (shapeBorderOnEl) shapeBorderOnEl.checked = item.dataset.borderOn === "1";
  if (shapeBorderWidthEl) shapeBorderWidthEl.value = item.dataset.borderWidth || "2";
  if (shapeBorderColorEl) shapeBorderColorEl.value = item.dataset.borderColor || "#111111";
  if (shapeBorderStyleEl) shapeBorderStyleEl.value = item.dataset.borderStyle || "solid";
  if (shapeRadiusEl) shapeRadiusEl.value = item.dataset.radius || "0";
}


//////////
  const isText = item.dataset.type === "text";
  const isGroup = item.dataset.type === "group";

  const isImage = item.dataset.type === "image";

  const isPopup = item.dataset.type === "popup";
const isSection = item.dataset.type === "section";
const isButton = item.dataset.type === "button";
const isInput = item.dataset.type === "input";
const isActionableText = item.dataset.type === "text";
const isButtonLike = item.dataset.type === "button" || isActionableText;

const isSectionLike = isSection || isGroup || isPopup;

if (isSection) {
  if (bcEl) bcEl.value = item.dataset.borderColor || "#111111";
  if (bwEl) bwEl.value = item.dataset.borderWidth || "0";
  if (bsEl) bsEl.value = item.dataset.borderStyle || "solid";
  if (brEl) brEl.value = item.dataset.radius || "0";
  if (colorEl) colorEl.value = item.dataset.bg || "#ffffff";
}

if (isGroup) {
  if (bcEl) bcEl.value = item.dataset.borderColor || "#111111";
  if (bwEl) bwEl.value = item.dataset.borderWidth || "0";
  if (bsEl) bsEl.value = item.dataset.borderStyle || "solid";
  if (brEl) brEl.value = item.dataset.radius || "0";
  if (colorEl) colorEl.value = item.dataset.bg || "#ffffff";
}

// show/hide SECTION/GROUP/POPUP border controls
if (bwEl) bwEl.style.display = isSectionLike ? "inline-block" : "none";
if (bcEl) bcEl.style.display = isSectionLike ? "inline-block" : "none";
if (bsEl) bsEl.style.display = isSectionLike ? "inline-block" : "none";
if (brEl) brEl.style.display = isSectionLike ? "inline-block" : "none";
  //Text
  if (textDynamicWrap) {
  textDynamicWrap.style.display = isText ? "flex" : "none";
}

if (isText) {
  if (textModeEl) {
    textModeEl.value = item.dataset.dynamicMode || "static";
  }

  if (textDynamicSourceEl) {
    textDynamicSourceEl.value = item.dataset.dynamicSource || "page";
  }

  await populateDynamicFieldOptions(item);

  if (textDynamicFieldEl) {
    textDynamicFieldEl.value = item.dataset.dynamicField || "";
  }

  await populateTextSelectedRecordOptions(item);

  if (textSelectedRecordEl) {
    textSelectedRecordEl.value = item.dataset.selectedRecordId || "";
  }

  await populateTextNestedFieldOptions(item);

  if (textNestedFieldEl) {
    textNestedFieldEl.value = item.dataset.nestedField || "";
  }

  await populateTextNestedSelectedRecordOptions(item);

  if (textNestedSelectedRecordEl) {
    textNestedSelectedRecordEl.value = item.dataset.nestedSelectedRecordId || "";
  }

  await populateTextRecordFieldOptions(item);

  if (textRecordFieldEl) {
    textRecordFieldEl.value = item.dataset.recordField || "";
  }

  const showDynamicStuff = (item.dataset.dynamicMode || "static") === "dynamic";
  const showSelectedRecord =
    showDynamicStuff && !!item.dataset.dynamicField;
  const showNestedField =
    showSelectedRecord && !!item.dataset.selectedRecordId;
  const showNestedSelectedRecord =
    showNestedField && !!item.dataset.nestedField;
  const showRecordField =
    (showNestedSelectedRecord && !!item.dataset.nestedSelectedRecordId) ||
    (showSelectedRecord && !!item.dataset.selectedRecordId && !item.dataset.nestedField);

  if (textDynamicSourceEl) {
    textDynamicSourceEl.style.display = showDynamicStuff ? "inline-block" : "none";
  }

  if (textDynamicFieldEl) {
    textDynamicFieldEl.style.display = showDynamicStuff ? "inline-block" : "none";
  }

  if (textSelectedRecordEl) {
    textSelectedRecordEl.style.display = showSelectedRecord ? "inline-block" : "none";
  }

  if (textNestedFieldEl) {
    textNestedFieldEl.style.display = showNestedField ? "inline-block" : "none";
  }

  if (textNestedSelectedRecordEl) {
    textNestedSelectedRecordEl.style.display = showNestedSelectedRecord ? "inline-block" : "none";
  }

  if (textRecordFieldEl) {
    textRecordFieldEl.style.display = showRecordField ? "inline-block" : "none";
  }
} else {
  if (textDynamicWrap) {
    textDynamicWrap.style.display = "none";
  }
}


//Image

if (imgWrap) {
  imgWrap.style.display = isImage ? "flex" : "none";
}

if (isImage) {
  if (imgModeEl) {
    imgModeEl.value = item.dataset.dynamicMode || "static";
  }

  if (imgDynamicSourceEl) {
    imgDynamicSourceEl.value = item.dataset.dynamicSource || "page";
  }

  await populateImageDynamicFieldOptions(item);

if (imgDynamicFieldEl) {
  imgDynamicFieldEl.value = item.dataset.dynamicField || "";
}
  if (imgFitEl) {
    imgFitEl.value = item.dataset.fit || "cover";
  }

  if (imgZoomEl) {
    imgZoomEl.value = item.dataset.zoom || "1";
  }

  if (imgBWEl) {
    imgBWEl.value = item.dataset.borderWidth || "0";
  }

  if (imgBCEl) {
    imgBCEl.value = item.dataset.borderColor || "#111111";
  }

  if (imgRadEl) {
    imgRadEl.value = item.dataset.radius || "12";
  }

  const showDynamicStuff = (item.dataset.dynamicMode || "static") === "dynamic";

  if (imgDynamicSourceEl) {
    imgDynamicSourceEl.style.display = showDynamicStuff ? "inline-block" : "none";
  }

  if (imgDynamicFieldEl) {
    imgDynamicFieldEl.style.display = showDynamicStuff ? "inline-block" : "none";
  }

  if (imgPickBtn) {
    imgPickBtn.style.display = showDynamicStuff ? "none" : "inline-block";
  }
}
  if (groupDynamicWrap) {
    groupDynamicWrap.style.display = isGroup ? "block" : "none";
  }

if (isGroup) {
  if (groupModeEl) {
    groupModeEl.value = item.dataset.dynamicMode || "static";
  }

  if (groupDynamicSourceEl) {
    groupDynamicSourceEl.value = item.dataset.dynamicSource || "parentSection";
  }

  if (groupBindModeEl) {
    groupBindModeEl.value = item.dataset.bindMode || "single";
  }

  await populateGroupDynamicFieldOptions(item);

  if (groupDynamicFieldEl) {
    groupDynamicFieldEl.value = item.dataset.dynamicField || "";
  }

  await populateGroupSelectedItemOptions(item);

  if (groupSelectedItemEl) {
    groupSelectedItemEl.value = item.dataset.selectedItemId || "";
  }

  await populateGroupNestedFieldOptions(item);

  if (groupNestedFieldEl) {
    groupNestedFieldEl.value = item.dataset.nestedField || "";
  }

  await populateGroupNestedSelectedItemOptions(item);

  if (groupNestedSelectedItemEl) {
    groupNestedSelectedItemEl.value = item.dataset.nestedSelectedItemId || "";
  }

  await populateGroupItemFieldOptions(item);

  if (groupItemFieldEl) {
    groupItemFieldEl.value = item.dataset.itemField || "";
  }

  updateGroupBarVisibility(item);
}

//Background 
// Background
if (item.dataset.type === "background") {
  if (bgWrap) bgWrap.style.display = "flex";

  // hide shared text controls
  if (fontEl) fontEl.style.display = "none";
  if (fontSizeEl) fontSizeEl.style.display = "none";
  txtBtns.forEach((btn) => (btn.style.display = "none"));

  // hide text-only/dynamic text wrap
  if (textWrap) textWrap.style.display = "none";

  // hide image controls
  if (imgWrap) imgWrap.style.display = "none";

  // load background values
  if (bgModeEl) bgModeEl.value = item.dataset.bgMode || "color";
  if (bgColorEl) bgColorEl.value = item.dataset.bg || "#ffffff";
  if (bgFitEl) bgFitEl.value = item.dataset.fit || "cover";
  if (bgRadiusEl) bgRadiusEl.value = item.dataset.radius || "0";
  if (bgOpacityEl) bgOpacityEl.value = item.dataset.opacity || "1";
  if (bgOnEl) bgOnEl.checked = item.dataset.bgOn !== "0";

  // load new background position controls
  if (bgPosXEl) bgPosXEl.value = item.dataset.posX || "50";
  if (bgPosYEl) bgPosYEl.value = item.dataset.posY || "50";
}

  //Input 
  if (item.dataset.type === "input") {
  if (inputWrapEl) inputWrapEl.style.display = "flex";

  if (inputBgToggleEl) inputBgToggleEl.checked = item.dataset.bgOn !== "0";
  if (inputBgEl) inputBgEl.value = item.dataset.bg || "#020202";

  if (inputLabelBgEl) inputLabelBgEl.value = item.dataset.labelBg || "#ffffff";
  if (inputFieldBgEl) inputFieldBgEl.value = item.dataset.inputBg || "#ffffff";

  if (inputLabelBgModeEl) inputLabelBgModeEl.value = item.dataset.labelBgMode || "none";
if (inputLabelBgEl) inputLabelBgEl.value = item.dataset.labelBg || "#ffffff";

if (inputFieldBgModeEl) inputFieldBgModeEl.value = item.dataset.inputBgMode || "none";
if (inputFieldBgEl) inputFieldBgEl.value = item.dataset.inputBg || "#ffffff";

  if (inputLabelTextEl) inputLabelTextEl.value = item.dataset.label || "Label";
  if (inputPlaceholderEl) inputPlaceholderEl.value = item.dataset.placeholder || "Type here";
  if (inputTypeEl) inputTypeEl.value = item.dataset.inputType || "text";
  if (inputRequiredEl) inputRequiredEl.checked = item.dataset.required === "1";
} else {
  if (inputWrapEl) inputWrapEl.style.display = "none";
} 


  //Button
  if (isButtonLike) {
  if (btnWrap) btnWrap.style.display = "flex";

  if (btnLabelEl) {
  btnLabelEl.value =
    item.dataset.type === "text"
      ? (item.dataset.text ?? "")
      : (item.dataset.label ?? "Button");
}
  if (btnBgEl) btnBgEl.value = item.dataset.btnBg || "#111111";
  if (btnTextColorEl) btnTextColorEl.value = item.dataset.btnTextColor || "#ffffff";
  if (btnBwEl) btnBwEl.value = item.dataset.borderWidth || "0";
  if (btnBcEl) btnBcEl.value = item.dataset.borderColor || "#111111";
  if (btnBsEl) btnBsEl.value = item.dataset.borderStyle || "solid";
  if (btnRadiusEl) btnRadiusEl.value = item.dataset.radius || "12";

if (btnActionTypeEl) btnActionTypeEl.value = item.dataset.actionType || "none";
if (btnActionTargetEl) btnActionTargetEl.value = item.dataset.actionTarget || "";
if (btnActionSourceEl) btnActionSourceEl.value = item.dataset.actionSource || "page";
  if (btnDisplayTypeEl) btnDisplayTypeEl.value = item.dataset.displayType || "text";
  if (btnIconEl) btnIconEl.value = item.dataset.icon || "";

if (btnActionSourceEl) {
  btnActionSourceEl.value = item.dataset.actionSource || "page";
}

  updateButtonActionUI();
syncButtonBgToggleLabel();

  if (btnActionTargetSelectEl && btnActionTargetSelectEl.style.display !== "none") {
  btnActionTargetSelectEl.value = item.dataset.actionTarget || "";
}

} else {
  if (btnWrap) btnWrap.style.display = "none";
}


//Video
const isVideo = item.dataset.type === "video";

if (videoWrap) {
  videoWrap.style.display = isVideo ? "flex" : "none";
}

if (isVideo) {
  if (videoRadiusEl) videoRadiusEl.value = item.dataset.radius || "12";
  if (videoControlsToggleEl) videoControlsToggleEl.checked = item.dataset.controls !== "0";
  if (videoAutoplayEl) videoAutoplayEl.checked = item.dataset.autoplay === "1";
  if (videoMutedEl) videoMutedEl.checked = item.dataset.muted === "1";
  if (videoLoopEl) videoLoopEl.checked = item.dataset.loop === "1";
}
} 

function applyVideoFromBar() {
  if (!selectedItem || selectedItem.dataset.type !== "video") return;

  selectedItem.dataset.radius = videoRadiusEl?.value || "12";
  selectedItem.dataset.controls = videoControlsToggleEl?.checked ? "1" : "0";
  selectedItem.dataset.autoplay = videoAutoplayEl?.checked ? "1" : "0";
  selectedItem.dataset.muted = videoMutedEl?.checked ? "1" : "0";
  selectedItem.dataset.loop = videoLoopEl?.checked ? "1" : "0";

  renderVideoContent(selectedItem);
}

videoRadiusEl?.addEventListener("input", applyVideoFromBar);
videoControlsToggleEl?.addEventListener("change", applyVideoFromBar);
videoAutoplayEl?.addEventListener("change", applyVideoFromBar);
videoMutedEl?.addEventListener("change", applyVideoFromBar);
videoLoopEl?.addEventListener("change", applyVideoFromBar);

videoPickBtn?.addEventListener("click", () => {
  if (!selectedItem || selectedItem.dataset.type !== "video") return;
  videoFileEl?.click();
});

videoFileEl?.addEventListener("change", async () => {
  if (!selectedItem || selectedItem.dataset.type !== "video") return;
  const file = videoFileEl.files?.[0];
  if (!file) return;

  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch("/api/upload", {
    method: "POST",
    body: formData
  });

  const data = await res.json();
  selectedItem.dataset.src = data.url || "";

  // 🔥 FORCE SAVE immediately
saveCurrentCanvasToView();
  renderVideoContent(selectedItem);
});



//Parallax Helper
const scrollArea1 = document.querySelector(".tpl__dropArea");
const scrollArea2 = document.getElementById("tpl-dropArea");
const scrollArea3 = document.getElementById("dropAreaInner");

scrollArea1?.addEventListener("scroll", () => {
  console.log("[scroll test] .tpl__dropArea", scrollArea1.scrollTop);
});

scrollArea2?.addEventListener("scroll", () => {
  console.log("[scroll test] #tpl-dropArea", scrollArea2.scrollTop);
});

scrollArea3?.addEventListener("scroll", () => {
  console.log("[scroll test] #dropAreaInner", scrollArea3.scrollTop);
});

window.addEventListener("scroll", () => {
  console.log("[scroll test] window", window.scrollY);
});

function getParallaxScrollY() {
  const a = document.querySelector(".tpl__dropArea");
  const b = document.getElementById("tpl-dropArea");
  const c = document.getElementById("dropAreaInner");

  return (
    a?.scrollTop ||
    b?.scrollTop ||
    c?.scrollTop ||
    window.scrollY ||
    document.documentElement.scrollTop ||
    0
  );
}

function applyParallax() {
  if (!window.TPL_PREVIEW) return;

  const scrollWrap = document.getElementById("tpl-dropArea");
  if (!scrollWrap) return;

  const scrollY = scrollWrap.scrollTop || 0;

  console.log("[parallax] preview:", window.TPL_PREVIEW);
  console.log("[parallax] scrollTop:", scrollY);

  document
    .querySelectorAll(
      '.da-item[data-type="section"], .da-item[data-type="image"], .da-item[data-type="group"]'
    )
    .forEach((el) => {
      const strength = parseFloat(el.dataset.parallax || "0");
      const offset = -scrollY * strength;

      el.style.setProperty("--parallaxY", `${offset}px`);

      console.log("[parallax] item", {
        id: el.dataset.id,
        type: el.dataset.type,
        name: el.dataset.name || "",
        parallax: el.dataset.parallax || "0",
        strength,
        offset
      });
    });
}

document.getElementById("tpl-dropArea")?.addEventListener("scroll", applyParallax);


// keep bar stuck to item while dragging
function refreshBarPosition() {
  if (!selectedItem) return;
  showBarForItem(selectedItem);
}

  // ✅ Hit-test + cycle select through stacked items (so you can select back elements)
let lastPickSig = "";
let lastPickIdx = 0;

function getHitsAtPoint(clientX, clientY) {
const items = [...grid.querySelectorAll(".da-item")];

  const hits = items.filter((el) => {
    const r = el.getBoundingClientRect();
    return clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom;
  });

  // topmost first
  hits.sort((a, b) => {
    const za = parseInt(a.style.zIndex || "1", 10);
    const zb = parseInt(b.style.zIndex || "1", 10);
    return zb - za;
  });

  return hits;
}

function pickAtPoint(clientX, clientY) {
  const hits = getHitsAtPoint(clientX, clientY);
  if (!hits.length) return null;

  const sig = hits.map(h => h.dataset.id).join("|") + `@${Math.round(clientX)}:${Math.round(clientY)}`;

  if (sig !== lastPickSig) {
    lastPickSig = sig;
    lastPickIdx = 0;
  } else {
    lastPickIdx = (lastPickIdx + 1) % hits.length;
  }

  return hits[lastPickIdx];
}

// ✅ click-through selection for stacked/overlapping items
let lastPickKey = "";
let lastPickIndex = 0;


  const GRID_Y = 4; // matches your background-size (28px 28px)

  let dragType = null;
  // name + color change
floatingBar.querySelector(".da-floatingBar__name").addEventListener("input", (e) => {
  if (!selectedItem) return;

  const nextName = e.target.value || "Section";
  selectedItem.dataset.name = nextName;

  if (selectedItem.dataset.type === "popup") {
    const titleEl = selectedItem.querySelector(".da-popup__title");
    if (titleEl) titleEl.textContent = nextName;

    refreshPopupList();  
  }
});

floatingBar.querySelector(".da-floatingBar__fontSize").addEventListener("input", (e) => {
  if (!selectedItem) return;
  if (selectedItem.dataset.type !== "text") return;

  const size = Math.max(8, Math.min(160, parseInt(e.target.value || "24", 10)));
  selectedItem.dataset.fontSize = String(size);

  const textEl = selectedItem.querySelector(".da-text");
  if (textEl) textEl.style.fontSize = `${size}px`;
});

floatingBar.querySelector(".da-floatingBar__color").addEventListener("input", (e) => {
  if (!selectedItem) return;

  const val = e.target.value;

  if (selectedItem.dataset.type === "text") {
    selectedItem.dataset.color = val;
    const t = selectedItem.querySelector(".da-text");
    if (t) t.style.color = val;
  } else {
    selectedItem.dataset.bg = val;
    selectedItem.style.background =
      selectedItem.dataset.bgOn === "0" ? "transparent" : val;
  }
});

btnBgToggleEl?.addEventListener("click", () => {
  if (!selectedItem) return;
  if (selectedItem.dataset.type !== "button") return;

  const next = selectedItem.dataset.btnBgOn === "0" ? "1" : "0";
  selectedItem.dataset.btnBgOn = next;

  const b = selectedItem.querySelector(".da-btn");
  if (b) {
    b.style.background =
      next === "0"
        ? "transparent"
        : (selectedItem.dataset.btnBg || "#111111");
  }

  syncButtonBgToggleLabel();
});


//Element Resizing 
function getMinSizeForItem(el) {
  const t = el?.dataset?.type || "";

  if (t === "text") return { w: 40, h: 24 };
  if (t === "button") return { w: 60, h: 30 };
  if (t === "input") return { w: 70, h: 30 };
  if (t === "popup") return { w: 180, h: 80 };
  if (t === "group") return { w: 70, h: 30 };
 if (t === "shape") return { w: 2, h: 2 };

  return { w: 120, h: 80 };
}

function px(n) { return `${Math.round(n)}px`; }

function getNumStyle(el, prop, fallback = 0) {
  const v = parseFloat(el.style[prop]);
  return Number.isFinite(v) ? v : fallback;
}

function beginResize(item, handle, clientX, clientY) {
  const dir = handle.getAttribute("data-resize");
  const startLeft = getNumStyle(item, "left", 0);
  const startTop  = getNumStyle(item, "top", 0);
  const startW    = item.offsetWidth;
  const startH    = item.offsetHeight;

  resizeActive = {
    el: item,
    dir,
    startX: clientX,
    startY: clientY,
    startLeft,
    startTop,
    startW,
    startH,
  };
}


// resize handle mousedown (event delegation)
grid.addEventListener("mousedown", (e) => {
  // If click is NOT on a resize handle, ignore
  const handle = e.target.closest(".da-resize");
  if (!handle) return;

  // If click is on the floating bar, ignore
  if (e.target.closest(".da-floatingBar")) return;

  const item = handle.closest(".da-item");
  if (!item) return;

    if (item.dataset.type === "header") {
    e.preventDefault();
    e.stopPropagation();
    return;
  }

  // Select the item when resizing
  grid.querySelectorAll(".da-item").forEach((x) => x.classList.remove("is-selected"));
  item.classList.add("is-selected");
  showBarForItem(item);

  // Stop other mousedown handlers (like drag) from firing
  e.preventDefault();
  e.stopPropagation();

  beginResize(item, handle, e.clientX, e.clientY);
  document.body.style.userSelect = "none";
}, true); // ✅ capture phase so resize wins


  function snapY(y) {
    return Math.round(y / GRID_Y) * GRID_Y;
  }

  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }
function getNum(el, prop, fallback = 0) {
  const v = parseFloat(el?.style?.[prop]);
  return Number.isFinite(v) ? v : fallback;
}

// Walk up parent chain until we find the header container
function getHeaderAncestor(el) {
  if (!el) return null;

  let cur = el;
  let guard = 0;

  while (cur && guard++ < 50) {
    if (cur.dataset.type === "header" && cur.classList.contains("da-header")) return cur;

    const pid = cur.dataset.parent;
    if (!pid) return null;

    cur = getItemById(pid);
  }
  return null;
}

// Clamp an element (position + size) to a header using GRID coordinates
function clampElToHeaderBounds(el, header) {
  if (!el || !header) return;

  const hLeft = getNum(header, "left", 0);
  const hTop  = getNum(header, "top", 0);
  const hW    = header.offsetWidth;
  const hH    = header.offsetHeight;

  let left = getNum(el, "left", 0);
  let top  = getNum(el, "top", 0);
  let w    = el.offsetWidth;
  let h    = el.offsetHeight;

  // keep size from exceeding header
  w = Math.min(w, hW);
  h = Math.min(h, hH);

  // clamp position inside header
  left = clamp(left, hLeft, hLeft + hW - w);
  top  = clamp(top,  hTop,  hTop  + hH - h);

  el.style.left = `${Math.round(left)}px`;
  el.style.top  = `${Math.round(top)}px`;

  // (optional) if we shrank it because it was too big
  if (el.offsetWidth !== w) el.style.width = `${Math.round(w)}px`;
  if (el.offsetHeight !== h) el.style.height = `${Math.round(h)}px`;
}

  function uid(prefix = "sec") {
    return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now()}`;
  }
//keep tabs together 
function getItemById(id) {
  if (!id) return null;
  // modern browsers support CSS.escape; add fallback
  const esc = window.CSS && CSS.escape ? CSS.escape(id) : String(id).replace(/"/g, '\\"');
  return grid.querySelector(`.da-item[data-id="${esc}"]`);
}

// If you click a child tab, return its parent group element (only if parent is type="group")
function getParentGroupEl(childEl) {
  const pid = childEl?.dataset?.parent;
  if (!pid) return null;

  const p = getItemById(pid);
  if (!p) return null;

  return (p.dataset.type === "group") ? p : null;
}

function getParentContainerEl(childEl) {
  const pid = childEl?.dataset?.parent;
  if (!pid) return null;
  return getItemById(pid);
}

function getParentContainerDataType(childEl) {
  const parent = getParentContainerEl(childEl);
  if (!parent) return "";

  return parent.dataset.dynamicDataType || "";
}
function setHeaderVisible(isVisible) {
  const header = grid.querySelector('.da-item.da-header');
  if (!header) return;

  const headerId = header.dataset.id;

  // header itself
  header.style.display = isVisible ? "" : "none";

  // all descendants (logo, store name, tabsGroup, tabs, cart, profile, etc.)
  const kids = getChildrenDeep(header);
  kids.forEach((el) => {
    el.style.display = isVisible ? "" : "none";
  });

  // persist
  localStorage.setItem("tpl_header_visible", isVisible ? "1" : "0");
}

// Get ALL descendants of a parent (supports nesting: header -> group -> tabs)
function getChildrenDeep(parentEl) {
  const parentId = parentEl?.dataset?.id;
  if (!parentId) return [];

  const all = [...grid.querySelectorAll(".da-item")];
  const out = [];
  const visited = new Set();

  function walk(pid) {
    for (const el of all) {
      if (el.dataset.parent === pid && !visited.has(el)) {
        visited.add(el);
        out.push(el);
        walk(el.dataset.id);
      }
    }
  }

  walk(parentId);
  return out;
}

function setPopupMinimized(popupEl, minimized) {
  if (!popupEl || popupEl.dataset.type !== "popup") return;

  popupEl.dataset.popupMinimized = minimized ? "1" : "0";

  const topbarHeight = 42;
  const body = popupEl.querySelector(".da-popup__body");

  if (minimized) {
    popupEl.dataset.expandedHeight = popupEl.style.height || `${popupEl.offsetHeight}px`;
    popupEl.style.height = `${topbarHeight}px`;
    if (body) body.style.display = "none";
  } else {
    popupEl.style.height = popupEl.dataset.expandedHeight || "220px";
    if (body) body.style.display = "";
  }

  const kids = getChildrenDeep(popupEl);
  kids.forEach((child) => {
    child.style.display = minimized ? "none" : "";
  });

  const btn = popupEl.querySelector(".da-popup__minBtn");
  if (btn) btn.textContent = minimized ? "+" : "—";
}
  function toLocalXY(container, clientX, clientY) {
    const r = container.getBoundingClientRect();
    return {
      x: clientX - r.left + container.scrollLeft,
      y: clientY - r.top + container.scrollTop,
    };
  }












                                             // =======================
                                            // STEP 6
                                             //
                                             // =======================
function serializeCanvas() {
  const items = [...grid.querySelectorAll(".da-item")];

  return {
    pageType: window.TPL_PAGE_TYPE || "booking",
    canvasHeight: parseFloat(grid.style.height) || grid.offsetHeight || 0,
    items: items.map((el) => ({
      type: el.dataset.type,
      id: el.dataset.id,
      parent: el.dataset.parent || "",
      x: parseFloat(el.style.left) || 0,
      y: parseFloat(el.style.top) || 0,
      w: el.offsetWidth,
      h: el.offsetHeight,
      z: parseInt(el.style.zIndex || "1", 10),
      data: { ...el.dataset },
    })),
  };
}

function getSelectedPageId() {
  const select = document.getElementById("tpl-page-record");
  return select?.value || "";
}
function clearCanvasItems() {
  grid.querySelectorAll(".da-item").forEach((n) => n.remove());
}

function applyDatasetToElement(el, data) {
  Object.entries(data || {}).forEach(([k, v]) => (el.dataset[k] = v));
}
async function applyGroupDynamicFromBar() {
  if (!selectedItem) return;
  if (selectedItem.dataset.type !== "group") return;

  selectedItem.dataset.dynamicMode = groupModeEl?.value || "static";
  selectedItem.dataset.dynamicSource = groupDynamicSourceEl?.value || "page";
  selectedItem.dataset.bindMode = groupBindModeEl?.value || "single";
  selectedItem.dataset.dynamicField = groupDynamicFieldEl?.value || "";
  selectedItem.dataset.selectedItemId = groupSelectedItemEl?.value || "";

  // NEW
  selectedItem.dataset.nestedField = groupNestedFieldEl?.value || "";
  selectedItem.dataset.nestedSelectedItemId = groupNestedSelectedItemEl?.value || "";

  selectedItem.dataset.itemField = groupItemFieldEl?.value || "";

  updateGroupBarVisibility(selectedItem);

  await populateGroupSelectedItemOptions(selectedItem);

  // NEW
  await populateGroupNestedFieldOptions(selectedItem);
  await populateGroupNestedSelectedItemOptions(selectedItem);

  await populateGroupItemFieldOptions(selectedItem);

  updateGroupBarVisibility(selectedItem);

  if (typeof renderAllDynamicContent === "function") {
    await renderAllDynamicContent();
  }
}
function hasPopupAncestorById(itemId) {
  if (!itemId) return false;

  const el = grid.querySelector(`.da-item[data-id="${itemId}"]`);
  if (!el) return false;

  let parentId = el.dataset.parent || "";
  while (parentId) {
    const parentEl = grid.querySelector(`.da-item[data-id="${parentId}"]`);
    if (!parentEl) return false;
    if (parentEl.dataset.type === "popup") return true;
    parentId = parentEl.dataset.parent || "";
  }

  return false;
}
async function restoreCanvas(saved = null) {
  const payload = saved && Array.isArray(saved.items) ? saved : { items: [] };

  clearCanvasItems();

  for (const it of payload.items) {
    let el = null;

    console.log("RESTORING:", it.type, it.id, it.parent);

    
    if (it.type === "popup") {
      el = makePopupEl({
        x: it.x,
        y: it.y,
        w: it.w,
        h: it.h,
        title: it.data?.name || "Popup",
      });
    }

    if (it.type === "header") {
      el = document.createElement("div");
      el.className = "da-item da-header";
      el.dataset.type = "header";
      el.dataset.locked = "1";
    }

    if (it.type === "section") {
      el = makeSectionEl({
        x: it.x,
        y: it.y,
        w: it.w,
        h: it.h,
        title: it.data?.name || "Section",
      });
    }

    if (it.type === "group") {
      el = makeGroupEl({
        x: it.x,
        y: it.y,
        w: it.w,
        h: it.h,
        title: it.data?.name || "Group",
      });
    }

    if (it.type === "text") {
      el = makeTextEl({
        x: it.x,
        y: it.y,
        text: it.data?.text || "Type here",
      });
    }

    if (it.type === "video") {
  el = makeVideoEl({
    x: it.x,
    y: it.y,
    w: it.w,
    h: it.h,
    src: it.data?.src || "",
  });
}

if (it.type === "button") {
  el = makeButtonEl({
    x: it.x,
    y: it.y,
    label: it.data?.label ?? "Button",
  });
}

    if (it.type === "background") {
      el = makeBackgroundEl({
        x: it.x,
        y: it.y,
        w: it.w,
        h: it.h,
        title: it.data?.name || "Background",
      });
    }


    if (it.type === "image") {
      el = makeImageEl({
        x: it.x,
        y: it.y,
        src: it.data?.src || "",
      });
    }

    if (!el) continue;

el.dataset.id = it.id || el.dataset.id;
el.dataset.parent = it.parent || "";
el.dataset.type = it.type || el.dataset.type || it.data?.type || "";
applyDatasetToElement(el, it.data);

if (el.dataset.decorative === "1") {
  el.style.pointerEvents = "none";
}
console.log("RESTORED ITEM", {
  savedId: it.id,
  savedParent: it.parent,
  savedType: it.type,
  domId: el?.dataset?.id,
  domParent: el?.dataset?.parent,
  domType: el?.dataset?.type
});

    if (el.dataset.type === "video") {
  renderVideoContent(el);
}

  if (el.dataset.type === "background") {
      renderBackgroundContent(el);
    }

    if (el.dataset.hidden === "1") {
  el.style.display = "none";
}

if (it.type === "header") {
  el.style.position = "absolute";
  el.style.left = "0px";
  el.style.top = "0px";
  el.style.width = "100%";
  el.style.height = "90px";
  el.style.zIndex = "9999";
  el.style.boxSizing = "border-box";
}
 else {
      el.style.left = `${Math.round(it.x)}px`;
      el.style.top = `${Math.round(it.y)}px`;
      el.style.width = `${Math.round(it.w)}px`;
      el.style.height = `${Math.round(it.h)}px`;
      el.style.zIndex = String(it.z || 1);
    }

    if (el.dataset.type === "text") {
      await renderTextContent(el);
    }

if (el.dataset.type === "header") {
  el.style.background =
    el.dataset.bgOn === "0"
      ? "transparent"
      : (el.dataset.bg || "#ffffff");

  el.style.border = "none";
  el.style.borderRadius = "0px";
}

if (el.dataset.hidden === "1") {
  el.style.display = "none";
}

if (el.dataset.type === "section" || el.dataset.type === "group" || el.dataset.type === "popup") {
  el.style.background =
    el.dataset.bgOn === "0"
      ? "transparent"
      : (el.dataset.bg || "#f2f2f2");

  const on = el.dataset.borderOn === "1";
  const bw = parseInt(el.dataset.borderWidth, 10) || 0;
  const bs = el.dataset.borderStyle || "solid";
  const bc = el.dataset.borderColor || "#111111";

  el.style.border = on && bw > 0
    ? `${bw}px ${bs} ${bc}`
    : "none";

  el.style.borderRadius = `${parseInt(el.dataset.radius, 10) || 0}px`;
}

if (el.dataset.type === "popup") {
  el.style.background =
    el.dataset.bgOn === "0"
      ? "transparent"
      : (el.dataset.bg || "#ffffff");

      const on = el.dataset.borderOn === "1";
      const bw = parseInt(el.dataset.borderWidth, 10) || 0;
      const bs = el.dataset.borderStyle || "solid";
      const bc = el.dataset.borderColor || "#111111";
      const br = parseInt(el.dataset.radius, 10) || 0;

      el.style.border = on && bw > 0 ? `${bw}px ${bs} ${bc}` : "none";
      el.style.borderRadius = `${br}px`;

      const titleEl = el.querySelector(".da-popup__title");
      if (titleEl) {
        titleEl.textContent = el.dataset.name || "Popup";
      }
    }

    if (el.dataset.type === "button") {
      const b = el.querySelector(".da-btn");
      if (b) {
        renderButtonContent(el);

        b.style.background =
  el.dataset.btnBgOn === "0"
    ? "transparent"
    : (el.dataset.btnBg || "#111111");
        b.style.color = el.dataset.btnTextColor || "#ffffff";

        const bw = parseInt(el.dataset.borderWidth, 10) || 0;
        const bs = el.dataset.borderStyle || "solid";
        const bc = el.dataset.borderColor || "#111111";
        b.style.border = bs === "none" || bw === 0 ? "none" : `${bw}px ${bs} ${bc}`;
        b.style.borderRadius = `${parseInt(el.dataset.radius, 10) || 0}px`;

        b.addEventListener("click", (ev) => {
          handleElementAction(ev, el);
        });
      }
    }

    if (el.dataset.type === "image") {
      const bw = parseInt(el.dataset.borderWidth || "0", 10) || 0;
      const bc = el.dataset.borderColor || "#111111";
      const rad = parseInt(el.dataset.radius || "0", 10) || 0;

      el.style.border = bw > 0 ? `${bw}px solid ${bc}` : "none";
      el.style.borderRadius = `${rad}px`;
      el.style.overflow = "hidden";

      await renderImageContent(el);
      applyImagePosition(el);
    }

    grid.appendChild(el);


// hide popup shells and popup children on initial load
if (el.dataset.type === "popup" || hasPopupAncestorById(el.dataset.id)) {
  el.style.display = "none";
}
    if (el.dataset.type === "popup") {
      el.style.display = "none";
    }
  }


  // 🔥 FORCE HEADER WIDTH AFTER EVERYTHING LOADS
const header = grid.querySelector(".da-item.da-header");
if (header) {
  syncLockedHeaderWidth();

  if (typeof layoutHeaderChildren === "function") {
    layoutHeaderChildren();
  }
}

trimCanvasHeight();
syncAutoBackgrounds();
refreshPopupList();
}

async function saveTemplateToDatabase() {
  try {
    const locationId = getSelectedPageId();
    if (!locationId) {
      alert("Please select a page first.");
      return;
    }

    saveBuilderSelectionState();

    const payload = buildPagePayload();

const selectedTemplate =
  tplTemplateSelect?.value ||
  getBuilderLaunchParams().templateKey ||
  "custom";

if (selectedTemplate === "custom") {
  alert("Custom pages do not have a default template to reset to.");
  return;
}

    const jsonFieldName = getTemplateJsonFieldName(selectedTemplate);

    console.log("[builder] selectedTemplate being saved:", selectedTemplate);
    console.log("[builder] jsonFieldName being saved:", jsonFieldName);

    console.log(
      "[builder] buttons being saved:",
      (payload.views && Object.entries(payload.views).flatMap(([viewKey, view]) =>
        ((view.desktop?.items || []).concat(view.mobile?.items || []))
          .filter((item) => item.type === "button")
          .map((item) => ({
            viewKey,
            id: item.id,
            label: item.data?.label,
            actionType: item.data?.actionType,
            actionTarget: item.data?.actionTarget,
            displayType: item.data?.displayType,
            icon: item.data?.icon
          }))
      )) || []
    );

    const values = {
      "Custom Page Type": window.TPL_PAGE_TYPE || "booking",
      "Selected Template": selectedTemplate,
      [jsonFieldName]: JSON.stringify(payload),
    };

    console.log("[builder] saving to db...", {
      locationId,
      values,
    });

    console.log("[builder] payload being saved:", payload);

    const res = await apiFetch(`/api/records/Location/${encodeURIComponent(locationId)}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ values }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(data?.message || "Failed to save template");
    }

    console.log("[builder] save success:", data);
    console.log("[builder] save success response:", data);
    console.log("[builder] saved json length:", values[jsonFieldName]?.length || 0);

    alert("Page saved.");
  } catch (err) {
    console.error("[builder] save error:", err);
    alert(err?.message || "Failed to save page.");
  }
}

async function loadTemplateFromDatabase() {
  try {
    const locationId = getSelectedPageId();
    if (!locationId) return;

    const res = await apiFetch(`/api/records/Location/${encodeURIComponent(locationId)}`, {
      method: "GET",
      headers: { Accept: "application/json" },
    });

    const raw = await res.json().catch(() => ({}));

    const row =
      raw?.item ||
      raw?.record ||
      raw?.data ||
      raw?.items?.[0] ||
      raw?.records?.[0] ||
      raw;

    if (!row) return;

    window.TPL_CURRENT_PAGE_ROW = row || null;
    window.TPL_CURRENT_PAGE_DATATYPE_ID =
      row?.dataTypeId ||
      row?.values?.dataTypeId ||
      "694ca3228079ae580face921";

    console.log("[builder] TPL_CURRENT_PAGE_ROW:", window.TPL_CURRENT_PAGE_ROW);
    console.log("[builder] TPL_CURRENT_PAGE_DATATYPE_ID:", window.TPL_CURRENT_PAGE_DATATYPE_ID);

    const v = row.values || row;
    const savedType = v["Custom Page Type"] || "booking";
    window.TPL_PAGE_TYPE = savedType;

    const launch = getBuilderLaunchParams();

    const selectedTemplate =
      tplTemplateSelect?.value ||
      launch.templateKey ||
      v["Selected Template"] ||
      "custom";

    window.TPL_SELECTED_TEMPLATE = selectedTemplate;

    if (tplTemplateSelect) {
      tplTemplateSelect.value = selectedTemplate;
    }

    const jsonFieldName = getTemplateJsonFieldName(selectedTemplate);
    const savedJson = v[jsonFieldName] || "";

    console.log("[builder] selectedTemplate:", selectedTemplate);
    console.log("[builder] jsonFieldName:", jsonFieldName);
    console.log("[builder] savedJson exists:", !!savedJson);

    if (!savedJson) {
      const starter = cloneTemplateStarter(selectedTemplate);

      pageViews = starter.views || {
        default: {
          name: "Default View",
          desktop: { items: [] },
          mobile: { items: [] }
        }
      };

      currentViewKey = starter.currentView || "default";

      if (!pageViews[currentViewKey]) {
        currentViewKey = Object.keys(pageViews)[0] || "default";
      }

      rebuildViewDropdown();
      await loadViewIntoCanvas(currentViewKey);
      return;
    }

    const payload = JSON.parse(savedJson);

    if (payload.views && typeof payload.views === "object") {
      pageViews = payload.views;
    } else {
      pageViews = {
        default: {
          name: "Default View",
          desktop: { items: payload.items || [] },
          mobile: { items: [] }
        }
      };
    }

    Object.keys(pageViews).forEach((key) => {
      const view = pageViews[key];

      if (!view.desktop) {
        view.desktop = { items: view.items || [] };
      }

      if (!view.mobile) {
        view.mobile = { items: [] };
      }

      delete view.items;
    });

    currentViewKey = payload.currentView || "default";

    if (!pageViews[currentViewKey]) {
      currentViewKey = Object.keys(pageViews)[0] || "default";
    }

    rebuildViewDropdown();
    await loadViewIntoCanvas(currentViewKey);
  } catch (err) {
    console.error("[builder] load error:", err);
  }
}

window.saveTemplateToDatabase = saveTemplateToDatabase;
window.loadTemplateFromDatabase = loadTemplateFromDatabase;
window.resetTemplateToDefault = resetTemplateToDefault;

////////////////////////////////
//View
//////////////////////
//Helpers

function getCurrentViewData() {
  if (!pageViews[currentViewKey]) {
    pageViews[currentViewKey] = {
      name: currentViewKey === "default" ? "Default View" : currentViewKey,
      desktop: { items: [] },
      mobile: { items: [] }
    };
  }

  const viewData = pageViews[currentViewKey];

  if (!viewData.desktop) {
    viewData.desktop = { items: viewData.items || [] };
  }

  if (!viewData.mobile) {
    viewData.mobile = { items: [] };
  }

  delete viewData.items;

  return viewData;
}


function rebuildViewDropdown() {
  const viewSelect = document.getElementById("tpl-page-view");
  if (!viewSelect) return;

  viewSelect.innerHTML = "";

  Object.entries(pageViews).forEach(([viewKey, viewData]) => {
    const option = document.createElement("option");
    option.value = viewKey;
    option.textContent = viewData?.name || viewKey;
    viewSelect.appendChild(option);
  });

  if (pageViews[currentViewKey]) {
    viewSelect.value = currentViewKey;
  }
}



////
let currentViewKey = "default";

let pageViews = {
  default: {
    name: "Default View",
    desktop: { items: [] },
    mobile: { items: [] }
  }
};

let popupViews = {
  popup1: { name: "Popup 1", items: [] }
};



























function rehydrateCanvasItem(item) {
  if (!item || !item.type) return null;

  let el = null;

  if (item.type === "section") {
    el = makeSectionEl({
      x: item.x || 0,
      y: item.y || 0,
      w: item.w || 420,
      h: item.h || 168,
      title: item.data?.name || "Section"
    });
  }

  if (item.type === "group") {
    el = makeGroupEl({
      x: item.x || 0,
      y: item.y || 0,
      w: item.w || 420,
      h: item.h || 168,
      title: item.data?.name || "Group"
    });
  }

  if (item.type === "text") {
    el = makeTextEl({
      x: item.x || 0,
      y: item.y || 0,
      w: item.w || 240,
      h: item.h || 48,
      text: item.data?.text || "Type here"
    });
  }

  if (item.type === "image") {
    el = makeImageEl({
      x: item.x || 0,
      y: item.y || 0,
      w: item.w || 180,
      h: item.h || 180
    });
  }

  if (item.type === "button") {
el = makeButtonEl({
  x: item.x || 0,
  y: item.y || 0,
  label: item.data?.label ?? "Button"
});
  }

  if (item.type === "popup") {
    el = makePopupEl({
      x: item.x || 0,
      y: item.y || 0,
      w: item.w || 420,
      h: item.h || 220,
      title: item.data?.name || "Popup"
    });
  }

  if (item.type === "input") {
  el = makeInputEl({
    x: item.x || 0,
    y: item.y || 0,
    w: item.w || 220,
    h: item.h || 44,
    placeholder: item.data?.placeholder || "Type here"
  });
}

if (item.type === "shape") {
  el = makeShapeEl({
    x: item.x,
    y: item.y,
    w: item.w,
    h: item.h,
    title: item.data?.name || "Shape"
  });
}
if (item.type === "shape") {
  el.dataset.shapeType = item.data?.shapeType || "rectangle";
  el.dataset.bg = item.data?.bg || "#d9d9d9";
  el.dataset.bgOn = item.data?.bgOn || "1";
  el.dataset.borderOn = item.data?.borderOn || "0";
  el.dataset.borderWidth = item.data?.borderWidth || "2";
  el.dataset.borderStyle = item.data?.borderStyle || "solid";
  el.dataset.borderColor = item.data?.borderColor || "#111111";
  el.dataset.radius = item.data?.radius || "0";
  el.dataset.parent = item.parent || "";

  el.style.background = el.dataset.bgOn === "1" ? el.dataset.bg : "transparent";
  el.style.border =
    el.dataset.borderOn === "1"
      ? `${el.dataset.borderWidth}px ${el.dataset.borderStyle} ${el.dataset.borderColor}`
      : "none";
  el.style.borderRadius = `${parseInt(el.dataset.radius, 10) || 0}px`;

  if (el.dataset.shapeType === "circle") {
    el.style.borderRadius = "999px";
  }
}

if (item.type === "header") {
  el = document.createElement("div");
  el.className = "da-item da-header";
  el.dataset.type = "header";
  el.dataset.locked = "1";
}

if (item.type === "video") {
  el = makeVideoEl({
    x: item.x || 0,
    y: item.y || 0,
    w: item.w || 320,
    h: item.h || 180,
    src: item.data?.src || ""
  });
}

if (el.dataset.type === "video") {
  renderVideoContent(el);
}
  if (!el) return null;


  if (item.data) {
    Object.entries(item.data).forEach(([key, value]) => {
      el.dataset[key] = value ?? "";
    });
  }

  if (el.dataset.hidden === "1") {
  el.style.display = "none";
}

  el.style.left = `${item.x || 0}px`;
  el.style.top = `${item.y || 0}px`;
  el.style.width = `${item.w || 0}px`;
  el.style.height = `${item.h || 0}px`;
  el.style.zIndex = String(item.z || 1);

  if (el.dataset.type === "input") {
  renderInputContent(el);
}

  if (item.parent) {
    el.dataset.parent = item.parent;
  }
//Header Styling
if (el.dataset.type === "header") {
  el.style.position = "absolute";
  el.style.left = "0px";
  el.style.top = "0px";
  el.style.width = `${getFullCanvasWidth()}px`;
  el.style.height = "60px";
  el.style.zIndex = "9999";
  el.style.boxSizing = "border-box";
  el.style.background =
    el.dataset.bgOn === "0"
      ? "transparent"
      : (el.dataset.bg || "#ffffff");
  el.style.border = "none";
  el.style.borderRadius = "0px";
}

if (
  el.dataset.type === "section" ||
  el.dataset.type === "group" ||
  el.dataset.type === "popup"
) {
  el.style.background =
    el.dataset.bgOn === "0"
      ? "transparent"
      : (el.dataset.bg || "#f2f2f2");

  const on = el.dataset.borderOn === "1";
  const bw = parseInt(el.dataset.borderWidth, 10) || 0;
  const bs = el.dataset.borderStyle || "solid";
  const bc = el.dataset.borderColor || "#111111";

  el.style.border = on && bw > 0 ? `${bw}px ${bs} ${bc}` : "none";
  el.style.borderRadius = `${parseInt(el.dataset.radius, 10) || 0}px`;
}

  if (el.dataset.type === "text") {
    el.style.color = el.dataset.color || "#111111";
    el.style.fontSize = `${parseInt(el.dataset.fontSize, 10) || 24}px`;
    el.style.fontWeight = el.dataset.bold === "1" ? "700" : "400";
    el.style.textAlign = el.dataset.align || "left";

    if (typeof renderTextContent === "function") {
      renderTextContent(el);
    }
  }

  if (el.dataset.type === "button") {
    const b = el.querySelector(".da-btn");
    if (b) {
      renderButtonContent(el);

      b.style.background =
  el.dataset.btnBgOn === "0"
    ? "transparent"
    : (el.dataset.btnBg || "#111111");
      b.style.color = el.dataset.btnTextColor || "#ffffff";

      const bw = parseInt(el.dataset.borderWidth, 10) || 0;
      const bs = el.dataset.borderStyle || "solid";
      const bc = el.dataset.borderColor || "#111111";
      b.style.border = (bs === "none" || bw === 0) ? "none" : `${bw}px ${bs} ${bc}`;
      b.style.borderRadius = `${parseInt(el.dataset.radius, 10) || 0}px`;

      b.onclick = (ev) => handleElementAction(ev, el);
    }
  }

if (el.dataset.type === "image") {
  const rad = parseInt(el.dataset.radius, 10) || 0;
  const bw = parseInt(el.dataset.borderWidth, 10) || 0;
  const bc = el.dataset.borderColor || "#111111";

  el.style.borderRadius = `${rad}px`;
  el.style.border = bw > 0 ? `${bw}px solid ${bc}` : "none";
  el.style.overflow = "hidden";

  if (typeof renderImageContent === "function") {
    renderImageContent(el);
  }

  const img = el.querySelector(".da-img");
  if (img) {
    img.style.borderRadius = `${rad}px`;
    img.style.width = "100%";
    img.style.height = "100%";
    img.style.display = "block";
  }
}

  grid.appendChild(el);

  if (el.dataset.type === "popup") {
    el.style.display = "none";
  }

  return el;
}
let currentResponsiveView = "desktop";

//Load a view into the canvas
async function loadViewIntoCanvas(viewKey) {
  currentViewKey = viewKey || "default";

  const viewData = getCurrentViewData();
  const responsiveKey = currentResponsiveView || "desktop";
const items = viewData[responsiveKey]?.items || [];

  await restoreCanvas({ items });

  const viewSelect = document.getElementById("tpl-page-view");
  if (viewSelect) {
    viewSelect.value = currentViewKey;
  }

  if (typeof renderAllDynamicContent === "function") {
    await renderAllDynamicContent();
  }

  if (typeof syncLockedHeaderWidth === "function") {
    syncLockedHeaderWidth();
  }

  if (typeof layoutHeaderChildren === "function") {
    layoutHeaderChildren();
  }

  refreshPopupList();
}
//Save current canvas back into current view
function saveCurrentCanvasToView() {
  const viewData = getCurrentViewData();
  viewData[currentResponsiveView].items = serializeCanvasItems();
}

//Add View Button 
document.getElementById("tpl-add-view-btn")?.addEventListener("click", () => {
  const name = prompt("Enter a name for the new view:");
  if (!name) return;

  const cleanKey = name.trim().toLowerCase().replace(/\s+/g, "-");
  if (!cleanKey) return;

  if (!pageViews[cleanKey]) {
pageViews[cleanKey] = {
  name: name.trim(),
  desktop: { items: [] },
  mobile: { items: [] }
};
    const viewSelect = document.getElementById("tpl-page-view");
    if (viewSelect) {
      const option = document.createElement("option");
      option.value = cleanKey;
      option.textContent = name.trim();
      viewSelect.appendChild(option);
    }
  }

  saveCurrentCanvasToView();
  loadViewIntoCanvas(cleanKey);
});

//View dropdown change
document.getElementById("tpl-page-view")?.addEventListener("change", (e) => {
  const nextViewKey = e.target.value;
  saveCurrentCanvasToView();
  loadViewIntoCanvas(nextViewKey);
});

function buildPagePayload() {
  saveCurrentCanvasToView();

  return {
    pageType: window.TPL_PAGE_TYPE || "booking",
    currentView: currentViewKey,
    views: pageViews,
    popupViews: popupViews
  };
}

function serializeCanvasItems() {
  if (!grid) return [];

  const items = [...grid.querySelectorAll(".da-item")];

  return items.map((el) => ({
    type: el.dataset.type || "",
    id: el.dataset.id || "",
    parent: el.dataset.parent || "",
    x: parseInt(el.style.left || "0", 10) || 0,
    y: parseInt(el.style.top || "0", 10) || 0,
    w: parseInt(el.style.width || "0", 10) || 0,
    h: parseInt(el.style.height || "0", 10) || 0,
    z: parseInt(el.style.zIndex || "1", 10) || 1,
    data: { ...el.dataset }
  }));
}

                                /////////////////////
                                   //Background
                                //////////////////
bgModeEl?.addEventListener("change", () => {
  if (!selectedItem || selectedItem.dataset.type !== "background") return;
  selectedItem.dataset.bgMode = bgModeEl.value;
  renderBackgroundContent(selectedItem);
});

bgColorEl?.addEventListener("input", () => {
  if (!selectedItem || selectedItem.dataset.type !== "background") return;
  selectedItem.dataset.bg = bgColorEl.value;
  renderBackgroundContent(selectedItem);
});

bgFitEl?.addEventListener("change", () => {
  if (!selectedItem || selectedItem.dataset.type !== "background") return;
  selectedItem.dataset.fit = bgFitEl.value;
  renderBackgroundContent(selectedItem);
});

bgRadiusEl?.addEventListener("input", () => {
  if (!selectedItem || selectedItem.dataset.type !== "background") return;
  selectedItem.dataset.radius = bgRadiusEl.value;
  renderBackgroundContent(selectedItem);
});

bgOpacityEl?.addEventListener("input", () => {
  if (!selectedItem || selectedItem.dataset.type !== "background") return;
  selectedItem.dataset.opacity = bgOpacityEl.value;
  renderBackgroundContent(selectedItem);
});

bgOnEl?.addEventListener("change", () => {
  if (!selectedItem || selectedItem.dataset.type !== "background") return;
  selectedItem.dataset.bgOn = bgOnEl.checked ? "1" : "0";
  renderBackgroundContent(selectedItem);
});

bgPickBtn?.addEventListener("click", () => bgFileEl?.click());

bgFileEl?.addEventListener("change", async (e) => {
  if (!selectedItem || selectedItem.dataset.type !== "background") return;
  const file = e.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    selectedItem.dataset.src = reader.result;
    selectedItem.dataset.bgMode = "image";
    if (bgModeEl) bgModeEl.value = "image";
    renderBackgroundContent(selectedItem);
  };
  reader.readAsDataURL(file);
});

bgVideoPickBtn?.addEventListener("click", () => bgVideoFileEl?.click());

bgVideoFileEl?.addEventListener("change", async (e) => {
  if (!selectedItem || selectedItem.dataset.type !== "background") return;
  const file = e.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    selectedItem.dataset.videoSrc = reader.result;
    selectedItem.dataset.bgMode = "video";
    if (bgModeEl) bgModeEl.value = "video";
    renderBackgroundContent(selectedItem);
  };
  reader.readAsDataURL(file);
});


                                /////////////////////
                                   //Preview Mode
                                //////////////////
window.TPL_PREVIEW = false;
//turn preview on and off
window.setPreviewMode = function setPreviewMode(isOn) {
 window.TPL_PREVIEW = !!isOn;

  document.body.classList.toggle("is-preview-mode", window.TPL_PREVIEW);

  const root = document.querySelector(".tpl");
  if (root) {
    root.classList.toggle("is-preview-mode", window.TPL_PREVIEW);
  }

  grid.classList.toggle("is-preview-mode", window.TPL_PREVIEW);

  const previewBtn = document.getElementById("tpl-preview-btn");
  if (previewBtn) {
    previewBtn.textContent = window.TPL_PREVIEW ? "Exit Preview" : "Preview";
  }

    // show or hide the fixed exit-preview button
  ensureExitPreviewButton();

  if (!window.TPL_PREVIEW) {
    closePopupEditMode?.();
    grid.querySelectorAll(".da-item").forEach((x) => x.classList.remove("is-selected"));
    showBarForItem(null);
  }

  if (typeof renderAllDynamicContent === "function") {
    renderAllDynamicContent();
  }
  applyParallax();
  requestAnimationFrame(applyParallax);
}


//Exit Preview Mode
function ensureExitPreviewButton() {
  let btn = document.getElementById("tpl-exit-preview-btn");

  if (!btn) {
    btn = document.createElement("button");
    btn.id = "tpl-exit-preview-btn";
    btn.type = "button";
    btn.textContent = "Back to Edit";

    Object.assign(btn.style, {
      position: "fixed",
      top: "16px",
      right: "16px",
      zIndex: "50000",
      padding: "10px 14px",
      borderRadius: "10px",
      border: "1px solid #111",
      background: "#fff",
      color: "#111",
      cursor: "pointer",
      display: "none"
    });

    btn.addEventListener("click", () => {
      window.setPreviewMode(false);
    });

    document.body.appendChild(btn);
  }

  btn.style.display = window.TPL_PREVIEW ? "block" : "none";
}

///////////////////////////////////////////////////////////////
                           //Responsive Views


//View Helper
function ensureResponsiveLayoutExists(viewName, responsiveView) {
  if (!pageViews[viewName]) {
    pageViews[viewName] = {
      desktop: { items: [] },
      mobile: { items: [] }
    };
  }

  const targetLayout = pageViews[viewName][responsiveView];
  const hasItems = targetLayout && Array.isArray(targetLayout.items) && targetLayout.items.length > 0;

  if (hasItems) return;

  if (responsiveView === "mobile") {
    const desktopLayout = pageViews[viewName].desktop;

    if (desktopLayout?.items?.length) {
      pageViews[viewName].mobile = JSON.parse(JSON.stringify(desktopLayout));
    }
  }

  if (responsiveView === "desktop") {
    const mobileLayout = pageViews[viewName].mobile;

    if (mobileLayout?.items?.length) {
      pageViews[viewName].desktop = JSON.parse(JSON.stringify(mobileLayout));
    }
  }
}

//Then add the switch button logic

async function switchResponsiveView(nextView) {
  if (nextView !== "desktop" && nextView !== "mobile") return;

  saveCurrentCanvasToView();
  currentResponsiveView = nextView;

  const viewData = getCurrentViewData();

  if (
    nextView === "mobile" &&
    (!viewData.mobile.items || viewData.mobile.items.length === 0) &&
    viewData.desktop.items?.length
  ) {
    viewData.mobile.items = JSON.parse(JSON.stringify(viewData.desktop.items));
  }

  if (
    nextView === "desktop" &&
    (!viewData.desktop.items || viewData.desktop.items.length === 0) &&
    viewData.mobile.items?.length
  ) {
    viewData.desktop.items = JSON.parse(JSON.stringify(viewData.mobile.items));
  }

  applyResponsiveCanvasWidth();
  await loadViewIntoCanvas(currentViewKey);
  if (currentResponsiveView === "mobile") {
  clampAllItemsToCurrentCanvas();
}
}

function applyResponsiveCanvasWidth() {
  const mainArea = document.querySelector(".tpl__dropArea");
  const viewport = document.getElementById("tpl-dropArea");
  const grid = document.getElementById("dropAreaInner");
  if (!grid) return;

  if (currentResponsiveView === "mobile") {
    if (mainArea) {
      mainArea.style.display = "flex";
      mainArea.style.justifyContent = "center";
      mainArea.style.alignItems = "flex-start";
      mainArea.style.overflowX = "hidden";
    }

    if (viewport) {
      viewport.style.width = "390px";
      viewport.style.maxWidth = "390px";
      viewport.style.minWidth = "390px";
      viewport.style.margin = "0 auto";
      viewport.style.overflowX = "hidden";
    }

    grid.style.width = "390px";
    grid.style.maxWidth = "390px";
    grid.style.minWidth = "390px";
    grid.style.overflowX = "hidden";
  } else {
    if (mainArea) {
      mainArea.style.display = "";
      mainArea.style.justifyContent = "";
      mainArea.style.alignItems = "";
      mainArea.style.overflowX = "";
    }

    if (viewport) {
      viewport.style.width = "";
      viewport.style.maxWidth = "";
      viewport.style.minWidth = "";
      viewport.style.margin = "";
      viewport.style.overflowX = "";
    }

    grid.style.width = "";
    grid.style.maxWidth = "";
    grid.style.minWidth = "";
    grid.style.overflowX = "";
  }

  if (typeof syncLockedHeaderWidth === "function") {
    syncLockedHeaderWidth();
  }

  if (typeof layoutHeaderChildren === "function") {
    layoutHeaderChildren();
  }

  trimCanvasHeight?.();
}


function trimCanvasHeight() {
  const grid = document.getElementById("dropAreaInner");
  if (!grid) return;

  const items = [...grid.querySelectorAll(".da-item")].filter((el) => {
    if (el.style.display === "none") return false;
    if (el.dataset.type === "popup") return false;
    return true;
  });

const minHeight = 1400;
const bottomPadding = 200;

  if (!items.length) {
    grid.style.height = `${minHeight}px`;
    grid.style.minHeight = `${minHeight}px`;
    return;
  }

  let maxBottom = 0;

  items.forEach((el) => {
    const top = parseFloat(el.style.top) || 0;
    const height = parseFloat(el.style.height) || el.offsetHeight || 0;
    const bottom = top + height;
    maxBottom = Math.max(maxBottom, bottom);
  });

  const nextHeight = Math.max(minHeight, Math.ceil(maxBottom + bottomPadding));

  grid.style.height = `${nextHeight}px`;
  grid.style.minHeight = `${nextHeight}px`;
}


function clampAllItemsToCurrentCanvas() {
  const grid = document.getElementById("dropAreaInner");
  if (!grid) return;

  const maxWidth = grid.clientWidth;

  grid.querySelectorAll(".da-item").forEach((el) => {
    if (el.dataset.type === "header") return;

    const left = parseFloat(el.style.left) || 0;
    const width = parseFloat(el.style.width) || el.offsetWidth || 0;

    let nextLeft = left;
    let nextWidth = width;

    if (nextWidth > maxWidth) {
      nextWidth = maxWidth;
      el.style.width = `${Math.round(nextWidth)}px`;
    }

    if (nextLeft + nextWidth > maxWidth) {
      nextLeft = Math.max(0, maxWidth - nextWidth);
      el.style.left = `${Math.round(nextLeft)}px`;
    }
  });
}





})();




                                               // =======================
                                            // DOM
                                             //
                                             // =======================

document.addEventListener("DOMContentLoaded", async () => {
  const root = document.querySelector(".tpl");
  const btn = document.getElementById("sidebar-toggle");
  if (!root || !btn) return;

  function syncSidebarToggle() {
    const collapsed = root.classList.contains("is-collapsed");
    btn.setAttribute("aria-label", collapsed ? "Expand sidebar" : "Collapse sidebar");
    btn.textContent = collapsed ? "Show " : "← Back";
  }

btn.addEventListener("click", () => {
  root.classList.toggle("is-collapsed");

  syncSidebarToggle();

  requestAnimationFrame(() => {
    syncLockedHeaderWidth();

    if (typeof layoutHeaderChildren === "function") {
      layoutHeaderChildren();
    }

    const panel = document.querySelector(".sidebar-panel");
    if (panel) panel.style.display = "";

    if (typeof mountBarInSidebar === "function") {
      mountBarInSidebar();
    }

    if (window.selectedItem && typeof showBarForItem === "function") {
      showBarForItem(window.selectedItem);
    }
  });
});

  syncSidebarToggle();

  document.getElementById("tpl-preview-btn")?.addEventListener("click", () => {
    setPreviewMode(!window.TPL_PREVIEW);
  });

await applyLaunchParamsToBuilder();
});

//Pdf Close Button 
document.getElementById("pdf-preview-close")?.addEventListener("click", () => {
  closePdfPreview();
});

document.getElementById("pdf-preview-close")?.addEventListener("click", () => {
  const overlay = document.getElementById("pdf-preview-overlay");
  const frame = document.getElementById("pdf-preview-frame");

  if (overlay) overlay.hidden = true;
  if (frame) frame.src = "";



  //Reset Template 
  const resetBtn = document.getElementById("tpl-reset-btn");

resetBtn?.addEventListener("click", async () => {
  await resetTemplateToDefault();
});

  applyResponsiveViewMode();
});
////////////////////End of dom


 
