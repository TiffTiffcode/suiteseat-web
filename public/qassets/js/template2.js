//C:\Users\tiffa\OneDrive\Desktop\suiteseat-web\public\qassets\js\template2.js


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
//////////////////////////////////////////////////////////////////







//////////////////////Helper
const DATA_TYPE_FIELDS_CACHE = {};

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

async function getSelectedRecordFromGroup(groupEl) {
  if (!groupEl) return null;

  const selectedId = groupEl.dataset.selectedItemId || "";
  if (!selectedId) return null;

  const list = await getGroupSourceList(groupEl);
  if (!Array.isArray(list)) return null;

  return list.find((entry, index) => {
    const value =
      entry?._id ||
      entry?.id ||
      entry?.values?._id ||
      entry?.values?.id ||
      String(index);

    return String(value) === String(selectedId);
  }) || null;
}

async function populateGroupItemFieldOptions(item = selectedItem) {
  if (!groupItemFieldEl || !item) return;

  const list = await getGroupSourceList(item);
  const selectedId = item.dataset.selectedItemId || "";

  groupItemFieldEl.innerHTML = `<option value="">Select item field</option>`;

  if (!selectedId) return;

  const selectedRecord = list.find((entry, index) => {
    const value =
      entry?._id ||
      entry?.id ||
      entry?.values?._id ||
      entry?.values?.id ||
      String(index);

    return String(value) === String(selectedId);
  });

  if (!selectedRecord) return;

  const values = selectedRecord?.values || selectedRecord || {};
  const keys = Object.keys(values || {});

  keys.forEach((key) => {
    const option = document.createElement("option");
    option.value = key;
    option.textContent = key;
    groupItemFieldEl.appendChild(option);
  });

  const currentValue = item.dataset.itemField || "";
  if ([...groupItemFieldEl.options].some(o => o.value === currentValue)) {
    groupItemFieldEl.value = currentValue;
  }
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

function getGroupDynamicFieldOptions(source, parentDataType, pageType) {
  const mainType = getMainDataTypeForPageType(pageType);

  if (source === "parentSection") {
    if (parentDataType === "Location") {
      return [
        { value: "Suites", label: "Suites" },
        { value: "Suities", label: "Suities" },
        { value: "Suite Applications", label: "Suite Applications" },
        { value: "Amenities", label: "Amenities" },
      ];
    }

    if (parentDataType === "Course") {
      return [
        { value: "Lessons", label: "Lessons" },
        { value: "Modules", label: "Modules" },
      ];
    }

    if (parentDataType === "Booking") {
      return [
        { value: "Services", label: "Services" },
        { value: "Categories", label: "Categories" },
        { value: "Calendars", label: "Calendars" },
      ];
    }
  }

  if (source === "page") {
    if (mainType === "Location") {
      return [
        { value: "Suites", label: "Suites" },
        { value: "Suities", label: "Suities" },
        { value: "Suite Applications", label: "Suite Applications" },
        { value: "Amenities", label: "Amenities" },
      ];
    }

    if (mainType === "Course") {
      return [
        { value: "Lessons", label: "Lessons" },
        { value: "Modules", label: "Modules" },
      ];
    }

    if (mainType === "Booking") {
      return [
        { value: "Services", label: "Services" },
        { value: "Categories", label: "Categories" },
        { value: "Calendars", label: "Calendars" },
      ];
    }
  }

  return [];
}

function getSuiteLocationId(suite) {
  const v = suite?.values || suite || {};

  let loc =
    v["Location"] ??
    v.locationId ??
    v.suiteLocationId ??
    v.parentLocationId ??
    "";

  if (loc && typeof loc === "object") {
    loc = loc._id || loc.id || loc.value || "";
  }

  return String(loc || "").trim();
}

async function getGroupSourceList(item) {
  if (!item) return [];

  const source = item.dataset.dynamicSource || "parentSection";
  const field = item.dataset.dynamicField || "";

  console.log("[group] source:", source);
  console.log("[group] field:", field);
  console.log("[group] currentPageRecord:", currentPageRecord);

  if (!field) return [];

  if (source === "page") {
    const directValue = currentPageRecord?.[field];
    if (Array.isArray(directValue)) {
      return directValue;
    }
  }

  const pageType = window.TPL_PAGE_TYPE || "booking";
  const parentDataTypeName = getMainDataTypeForPageType(pageType);
  const relatedDataType = await getRelatedDataTypeFromField(field, parentDataTypeName);

  console.log("[group] relatedDataType:", relatedDataType);

  if (!relatedDataType) return [];

  try {
    const selectedPageId = getSelectedPageId();
    if (!selectedPageId || !currentUser?.id) return [];

    const data = await fetchJSON(
      `/public/records?dataType=${encodeURIComponent(relatedDataType)}&limit=500&ownerUserId=${encodeURIComponent(currentUser.id)}`,
      {
        method: "GET",
        cache: "no-store",
      }
    );

    const rows = Array.isArray(data)
      ? data
      : data.records || data.items || data.data || [];

    console.log("[group] fetched rows:", rows);

    const filtered = rows.filter((row) => recordBelongsToParent(row, selectedPageId));

    console.log("[group] filtered rows:", filtered);

    return filtered;
  } catch (err) {
    console.error("[group] failed to load related records", err);
    return [];
  }
}








































///////////////////////////////////////////

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
                                            // STEP 3: Drodown
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
  const pageTypeEl = document.getElementById("tpl-page-type");
  const pageRecordEl = document.getElementById("tpl-page-record");
  const saveBtn = document.getElementById("tpl-save-btn");

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

  saveBtn?.addEventListener("click", saveTemplateToDatabase);

  await loadPageRecordOptionsByType();

  const savedRecordId = localStorage.getItem("tpl_selected_page_record") || "";
  if (pageRecordEl && savedRecordId) {
    pageRecordEl.value = savedRecordId;
  }

  if (pageRecordEl?.value) {
    await loadTemplateFromDatabase();
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




///Save Canvas

function saveBuilderSelectionState() {
  const pageTypeEl = document.getElementById("tpl-page-type");
  const pageRecordEl = document.getElementById("tpl-page-record");

  localStorage.setItem("tpl_selected_page_type", pageTypeEl?.value || "booking");
  localStorage.setItem("tpl_selected_page_record", pageRecordEl?.value || "");
}

function restoreBuilderSelectionState() {
  const pageTypeEl = document.getElementById("tpl-page-type");
  const savedType = localStorage.getItem("tpl_selected_page_type") || "booking";

  if (pageTypeEl) {
    pageTypeEl.value = savedType;
    window.TPL_PAGE_TYPE = savedType;
  }
} 














///////
//SideBar toggle 
/////

document.addEventListener("DOMContentLoaded", () => {
  const root = document.querySelector(".tpl");
  const btn = document.getElementById("sidebar-toggle");
  if (!root || !btn) return;

  btn.addEventListener("click", () => {
    root.classList.toggle("is-collapsed");

    const collapsed = root.classList.contains("is-collapsed");
    btn.setAttribute("aria-label", collapsed ? "Expand sidebar" : "Collapse sidebar");
  });




  ////////////////////////////////////////////////////End of Dom
});