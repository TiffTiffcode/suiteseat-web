//C:\Users\tiffa\OneDrive\Desktop\suiteseat-web\public\qassets\js\template.js
//Make sidebar minimize
document.addEventListener("DOMContentLoaded", () => {
  const root = document.querySelector(".tpl");
  const btn = document.getElementById("sidebar-toggle");
  if (!root || !btn) return;

  btn.addEventListener("click", () => {
    root.classList.toggle("is-collapsed");

    const collapsed = root.classList.contains("is-collapsed");
    btn.setAttribute("aria-label", collapsed ? "Expand sidebar" : "Collapse sidebar");
  });
});

// ✅ editor mode flag (default = editing)
window.TPL_PREVIEW = false;
//IIFE
                            //Drag logic 
//Drag Section
(() => {
  const grid = document.getElementById("dropAreaInner");
  if (!grid) return;

  //Bar for each element
  // ✅ ONE floating bar that always sits above everything
const floatingBar = document.createElement("div");
floatingBar.className = "da-floatingBar";
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

                                                 // =======================
                                            // STEP 5A: Add functions in bar /controls
                                             //
                                             // =======================
floatingBar.innerHTML = `
<!-- ✅ Image controls (only show when an IMAGE is selected) -->
<div class="da-imgControls" style="display:none">
  <button type="button" class="da-imgPickBtn" title="Upload image" aria-label="Upload image">🖼️</button>
  <input class="da-imgFile" type="file" accept="image/*" style="display:none" />

  <select class="da-imgFit" title="Fit" aria-label="Fit">
    <option value="cover">Cover</option>
    <option value="contain">Contain</option>
  </select>

<input class="da-imgZoom" type="range" min="0.2" max="3" step="0.05" value="1" />




  <input class="da-imgBorderW" type="number" min="0" max="20" step="1" value="0" title="Border width" aria-label="Border width" />
  <input class="da-imgBorderC" type="color" value="#111111" title="Border color" aria-label="Border color" />
  <input class="da-imgRadius" type="number" min="0" max="120" step="1" value="12" title="Border radius" aria-label="Border radius" />
</div>

<!-- ✅ Button controls (only show when a BUTTON is selected) -->
<div class="da-btnControls" style="display:none">
  <input class="da-btn__label" type="text" placeholder="Button text" aria-label="Button text" />

  <input class="da-btn__bg" type="color" value="#111111" title="Button color" aria-label="Button color" />
  <input class="da-btn__textColor" type="color" value="#ffffff" title="Text color" aria-label="Text color" />

  <input class="da-btn__borderWidth" type="number" min="0" max="20" step="1" value="0" title="Border thickness" aria-label="Border thickness" />
  <input class="da-btn__borderColor" type="color" value="#111111" title="Border color" aria-label="Border color" />
  <select class="da-btn__borderStyle" title="Border style" aria-label="Border style">
    <option value="solid">Solid</option>
    <option value="dashed">Dashed</option>
    <option value="dotted">Dotted</option>
    <option value="none">None</option>
  </select>

  <input class="da-btn__radius" type="number" min="0" max="80" step="1" value="12" title="Border radius" aria-label="Border radius" />
  <input class="da-btn__href" type="text" placeholder="https:// link" aria-label="Button link" />
</div>


  <input class="da-floatingBar__name" type="text" value="Section" aria-label="Element name" />
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

<!-- ✅ Section border controls (only for sections) -->
<input class="da-secBorder__radius" type="number" min="0" max="200" step="1" value="0" title="Corner radius" aria-label="Corner radius" />

<button type="button" class="da-secBtn" data-sec="borderToggle" title="Border" aria-label="Border">▭</button>

<input class="da-secBorder__width" type="number" min="0" max="40" step="1" value="2" title="Border width" aria-label="Border width" />
<input class="da-secBorder__color" type="color" value="#111111" title="Border color" aria-label="Border color" />

<select class="da-secBorder__style" title="Border style" aria-label="Border style">
  <option value="solid">Solid</option>
  <option value="dashed">Dashed</option>
  <option value="dotted">Dotted</option>
</select>


    <input class="da-floatingBar__color" type="color" value="#f2b26b" aria-label="Background color" />
    <button type="button" class="da-layerBtn" data-action="sendBack" title="Send back">⬇︎</button>
    <button type="button" class="da-layerBtn" data-action="bringFront" title="Bring front">⬆︎</button>
    <button type="button" class="da-layerBtn" data-action="duplicate" title="Duplicate">＋</button>
    <button type="button" class="da-delBtn" data-action="remove" title="Remove">✕</button>
  </div>
`;

grid.appendChild(floatingBar);


// ✅ start hidden until an element is selected
floatingBar.style.display = "none";

                                                 // =======================
                                            // STEP 5B Element Wiring
                                             //
                                             // =======================
                                             // =======================
                                             // =======================
// IMAGE BAR WIRING
// =======================
const imgWrap   = floatingBar.querySelector(".da-imgControls");
const imgPickBtn= floatingBar.querySelector(".da-imgPickBtn");
const imgFileEl = floatingBar.querySelector(".da-imgFile");
const imgFitEl  = floatingBar.querySelector(".da-imgFit");
const imgZoomEl = floatingBar.querySelector(".da-imgZoom");
const imgBWEl   = floatingBar.querySelector(".da-imgBorderW");
const imgBCEl   = floatingBar.querySelector(".da-imgBorderC");
const imgRadEl  = floatingBar.querySelector(".da-imgRadius");

function applyImageFromBar() {
  if (!selectedItem) return;
  if (selectedItem.dataset.type !== "image") return;

  const img = selectedItem.querySelector(".da-img");
  if (!img) return;

  // fit
  const fit = imgFitEl?.value || "cover";
  selectedItem.dataset.fit = fit;
  img.style.objectFit = fit;

  // zoom
  const zoom = parseFloat(imgZoomEl?.value || "1") || 1;
  selectedItem.dataset.zoom = String(zoom);
  img.style.transform = `scale(${zoom})`;

  // border + radius (on wrapper so it clips)
  const bw = parseInt(imgBWEl?.value || "0", 10) || 0;
  const bc = imgBCEl?.value || "#111111";
  const rad = parseInt(imgRadEl?.value || "0", 10) || 0;

  selectedItem.dataset.borderWidth = String(bw);
  selectedItem.dataset.borderColor = bc;
  selectedItem.dataset.radius = String(rad);

selectedItem.style.border = bw > 0 ? `${bw}px solid ${bc}` : "none";
selectedItem.style.borderRadius = `${rad}px`;
selectedItem.style.overflow = "hidden"; // ✅ keep corners clean
img.style.borderRadius = `${rad}px`;
 // keeps image corners clean too
}

// open file picker by icon click
imgPickBtn?.addEventListener("click", (e) => {
  e.preventDefault();
  e.stopPropagation();
  imgFileEl?.click();
});

// file chosen -> set image
imgFileEl?.addEventListener("change", (e) => {
  if (!selectedItem || selectedItem.dataset.type !== "image") return;
  const file = e.target.files?.[0];
  if (!file) return;

  const url = URL.createObjectURL(file);
  selectedItem.dataset.src = url;

  const img = selectedItem.querySelector(".da-img");
  if (img) img.src = url;

  // reset position nicely
  selectedItem.dataset.posX = "50";
  selectedItem.dataset.posY = "50";
  if (img) img.style.objectPosition = "50% 50%";
});

// listeners
imgFitEl?.addEventListener("change", applyImageFromBar);
imgZoomEl?.addEventListener("input", applyImageFromBar);
imgBWEl?.addEventListener("input", applyImageFromBar);
imgBCEl?.addEventListener("input", applyImageFromBar);
imgRadEl?.addEventListener("input", applyImageFromBar);

// BUTTON BAR WIRING (Step 5)
// =======================
const btnWrap = floatingBar.querySelector(".da-btnControls");
const btnLabelEl = floatingBar.querySelector(".da-btn__label");
const btnBgEl = floatingBar.querySelector(".da-btn__bg");
const btnTextColorEl = floatingBar.querySelector(".da-btn__textColor");
const btnBwEl = floatingBar.querySelector(".da-btn__borderWidth");
const btnBcEl = floatingBar.querySelector(".da-btn__borderColor");
const btnBsEl = floatingBar.querySelector(".da-btn__borderStyle");
const btnRadiusEl = floatingBar.querySelector(".da-btn__radius");
const btnHrefEl = floatingBar.querySelector(".da-btn__href");

function applyButtonFromBar() {
  if (!selectedItem) return;
  if (selectedItem.dataset.type !== "button") return;

  // store values
  selectedItem.dataset.label = btnLabelEl?.value || "Button";
  selectedItem.dataset.btnBg = btnBgEl?.value || "#111111";
  selectedItem.dataset.btnTextColor = btnTextColorEl?.value || "#ffffff";

  selectedItem.dataset.borderWidth = String(parseInt(btnBwEl?.value || "0", 10) || 0);
  selectedItem.dataset.borderColor = btnBcEl?.value || "#111111";
  selectedItem.dataset.borderStyle = btnBsEl?.value || "solid";
  selectedItem.dataset.radius = String(parseInt(btnRadiusEl?.value || "0", 10) || 0);

  selectedItem.dataset.href = btnHrefEl?.value || "";

  // apply to DOM
  const b = selectedItem.querySelector(".da-btn");
  if (!b) return;

  b.textContent = selectedItem.dataset.label;
  b.style.background = selectedItem.dataset.btnBg;
  b.style.color = selectedItem.dataset.btnTextColor;

  const bw = parseInt(selectedItem.dataset.borderWidth, 10) || 0;
  const bs = selectedItem.dataset.borderStyle || "solid";
  const bc = selectedItem.dataset.borderColor || "#111111";

  b.style.border = (bs === "none" || bw === 0) ? "none" : `${bw}px ${bs} ${bc}`;
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
btnHrefEl?.addEventListener("input", applyButtonFromBar);


// ✅ Fill font dropdown from FONT_LIBRARY
const fontSelect = floatingBar.querySelector(".da-floatingBar__font");
if (fontSelect) {
  fontSelect.innerHTML =
    `<option value="system-ui" data-gf="">System</option>` +
    FONT_LIBRARY.map(f => `<option value="${f.css}" data-gf="${f.gf}">${f.label}</option>`).join("");
}

let selectedItem = null;

// ✅ SECTION BORDER inputs (PUT THIS RIGHT HERE)
const bwEl = floatingBar.querySelector(".da-secBorder__width");
const bcEl = floatingBar.querySelector(".da-secBorder__color");
const bsEl = floatingBar.querySelector(".da-secBorder__style");
const brEl = floatingBar.querySelector(".da-secBorder__radius");

function applySectionBorderFromBar() {
  if (!selectedItem) return;
  if (selectedItem.dataset.type !== "section") return;

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

bwEl?.addEventListener("input", applySectionBorderFromBar);
bcEl?.addEventListener("input", applySectionBorderFromBar);
bsEl?.addEventListener("change", applySectionBorderFromBar);
brEl?.addEventListener("input", applySectionBorderFromBar);

// ✅ ADD THIS RIGHT HERE (ONCE)
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


// ✅ Handle layer buttons even when clicked inside the floating bar
floatingBar.addEventListener("click", (e) => {
const btn = e.target.closest("[data-action]");
if (!btn) return;


  e.preventDefault();
  e.stopPropagation();

  if (!selectedItem) return;

  const action = btn.getAttribute("data-action");

    if (action === "duplicate") {
    // clone the selected item
    const clone = selectedItem.cloneNode(true);

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
  clone.dataset.label = selectedItem.dataset.label || "Button";
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
    b.style.background = clone.dataset.btnBg;
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

    // select the clone + show bar on it
    grid.querySelectorAll(".da-item").forEach(x => x.classList.remove("is-selected"));
    clone.classList.add("is-selected");
    showBarForItem(clone);

    return;
  }

if (action === "remove") {
  if (selectedItem?.dataset?.locked === "1") return; // ✅ can't delete locked
  selectedItem.remove();
  selectedItem = null;
  showBarForItem(null);
  return;
}


  const curZ = parseInt(selectedItem.style.zIndex || "1", 10);
  const all = [...grid.querySelectorAll(".da-item")];
  const maxZ = all.reduce((m, el) => Math.max(m, parseInt(el.style.zIndex || "1", 10)), 1);

  if (action === "bringFront") selectedItem.style.zIndex = String(maxZ + 1);
  if (action === "sendBack") selectedItem.style.zIndex = String(Math.max(1, curZ - 1));
});
//Border Styling
floatingBar.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-sec]");
  if (!btn) return;

  if (!selectedItem) return;
  if (selectedItem.dataset.type !== "section") return;

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


function addLockedHeaderAt(pos = {}) {
  // base position (default pinned to top-left)
  const baseX = Number.isFinite(pos.x) ? pos.x : 0;
  const baseY = Number.isFinite(pos.y) ? pos.y : 0;

  // create header like a section
  const header = makeSectionEl({ x: baseX, y: baseY, w: grid.clientWidth, h: 90, title: "Header" });

  header.dataset.type = "header";
  header.dataset.locked = "1";
  header.classList.add("da-header");

  // full width + pinned
  header.style.left = "0px";
  header.style.top = "0px";
  header.style.width = `${grid.clientWidth}px`;
  header.style.height = "90px";
  header.style.zIndex = "9999";

  header.dataset.bg = header.dataset.bg || "#ffffff";
  header.style.background = header.dataset.bg;
  header.style.border = "none";
  header.style.borderRadius = "0px";

  grid.appendChild(header);

  const headerId = header.dataset.id;

  // lock children into header (so they move with it)
  const lockIntoHeader = (child) => {
    child.dataset.parent = headerId;
    child.dataset.locked = "1";
    child.style.zIndex = String(parseInt(header.style.zIndex || "9999", 10) + 1);
    grid.appendChild(child);
    return child;
  };

  // ---------- Logo ----------
  const logo = makeImageEl({ x: 18, y: 18, src: "" });
  logo.style.width = "54px";
  logo.style.height = "54px";
  logo.dataset.radius = "999";
  // ✅ keep logo square when resizing
logo.dataset.lockRatio = "1";

  logo.style.borderRadius = "999px";
  logo.style.overflow = "hidden";
  const logoImg = logo.querySelector(".da-img");
  if (logoImg) logoImg.style.borderRadius = "999px";
  lockIntoHeader(logo);

  // ---------- Store name ----------
  const storeName = makeTextEl({ x: 86, y: 28, text: "Store Name" });
  storeName.style.width = "240px";
  lockIntoHeader(storeName);

  // ---------- Tabs GROUP (so all tabs can move together) ----------
  const tabsGroup = makeSectionEl({ x: 360, y: 18, w: 420, h: 54, title: "Tabs" });
  tabsGroup.dataset.type = "group";
  tabsGroup.dataset.parent = headerId; // 👈 group belongs to header
  tabsGroup.dataset.locked = "1";

  tabsGroup.style.background = "transparent";
  tabsGroup.style.border = "none";
  tabsGroup.style.borderRadius = "0px";
  tabsGroup.style.zIndex = String(parseInt(header.style.zIndex || "9999", 10) + 2);

  grid.appendChild(tabsGroup);

  const tabsGroupId = tabsGroup.dataset.id;

  // lock children into tabs group
  const lockIntoTabsGroup = (child) => {
    child.dataset.parent = tabsGroupId;
    child.dataset.locked = "1";
    child.style.zIndex = String(parseInt(tabsGroup.style.zIndex || "1", 10) + 1);
    grid.appendChild(child);
    return child;
  };

  // Tabs (positions are absolute in grid, so place them inside group area)
  lockIntoTabsGroup(makeTextEl({ x: 380, y: 28, text: "Home" }));
  lockIntoTabsGroup(makeTextEl({ x: 460, y: 28, text: "Shop" }));
  lockIntoTabsGroup(makeTextEl({ x: 540, y: 28, text: "About" }));
  lockIntoTabsGroup(makeTextEl({ x: 620, y: 28, text: "Contact" }));

  // ---------- Cart + Profile ----------
  const cart = makeTextEl({ x: grid.clientWidth - 90, y: 26, text: "🛒" });
  cart.style.width = "40px";
  lockIntoHeader(cart);

  const prof = makeTextEl({ x: grid.clientWidth - 45, y: 26, text: "👤" });
  prof.style.width = "40px";
  lockIntoHeader(prof);
}
// ✅ Header default on canvas
function ensureDefaultHeader() {
  const already = grid.querySelector('.da-item.da-header');
  if (already) return;

  addLockedHeaderAt({ x: 0, y: 0 });
}

ensureDefaultHeader();

window.addEventListener("resize", () => {
  const header = grid.querySelector('.da-item.da-header');
  if (!header) return;
  header.style.left = "0px";
  header.style.top = "0px";
  header.style.width = `${grid.clientWidth}px`;
});

// =======================
// ✅ HEADER: default on canvas + show/hide toggle
// =======================

// create a toggle button
const headerToggleBtn = document.createElement("button");
headerToggleBtn.type = "button";
headerToggleBtn.className = "da-headerToggleBtn";
headerToggleBtn.textContent = "Hide Header";
grid.appendChild(headerToggleBtn);

// place the button on the canvas
headerToggleBtn.style.position = "absolute";
headerToggleBtn.style.left = "12px";
headerToggleBtn.style.top = "12px";
headerToggleBtn.style.zIndex = "10000";

// create header if it doesn't exist
function ensureDefaultHeader() {
  const already = grid.querySelector(".da-item.da-header");
  if (already) return;
  addLockedHeaderAt({ x: 0, y: 0 });
}

// hide/show header + all children
function setHeaderVisible(isVisible) {
  const header = grid.querySelector(".da-item.da-header");
  if (!header) return;

  header.style.display = isVisible ? "" : "none";

  const kids = getChildrenDeep(header);
  kids.forEach((el) => {
    el.style.display = isVisible ? "" : "none";
  });

  localStorage.setItem("tpl_header_visible", isVisible ? "1" : "0");
}

// initial boot
ensureDefaultHeader();

const saved = (localStorage.getItem("tpl_header_visible") ?? "1") === "1";
setHeaderVisible(saved);
headerToggleBtn.textContent = saved ? "Hide Header" : "Show Header";

// click toggle
headerToggleBtn.addEventListener("click", () => {
  const cur = (localStorage.getItem("tpl_header_visible") ?? "1") === "1";
  const next = !cur;

  setHeaderVisible(next);
  headerToggleBtn.textContent = next ? "Hide Header" : "Show Header";

  // if you hid it while selected, clear selection + bar
  if (!next) {
    const header = grid.querySelector(".da-item.da-header");
    if (selectedItem && (selectedItem === header || selectedItem.dataset.parent === header?.dataset.id)) {
      selectedItem = null;
      showBarForItem(null);
    }
  }
});

function showBarForItem(item) {
  selectedItem = item;

  const headerAncestor = getHeaderAncestor(item);
if (headerAncestor && item.dataset.type !== "header") {
  clampElToHeaderBounds(item, headerAncestor);
}

  if (!item) {
    floatingBar.style.display = "none";
    return;
  }

  const r = item.getBoundingClientRect();
  const gr = grid.getBoundingClientRect();

  // position the bar relative to the grid
  const left = (r.left - gr.left) + grid.scrollLeft + 12;
  const top  = (r.top  - gr.top)  + grid.scrollTop  - 12;

  floatingBar.style.left = `${Math.round(left)}px`;
  floatingBar.style.top  = `${Math.round(top)}px`;
  floatingBar.style.display = "flex";

  const isText = item.dataset.type === "text";
                                                   // =======================
                                            // STEP 5C showBarForItem(item) function
                                             //Just add that code right below this 
                                             // =======================
    // =======================
// Show/Hide header
// =======================                                         
 const delBtn = floatingBar.querySelector('[data-action="remove"]');
if (delBtn) {
  const locked = item?.dataset?.locked === "1";
  delBtn.style.opacity = locked ? "0.35" : "1";
  delBtn.style.pointerEvents = locked ? "none" : "auto";
  delBtn.title = locked ? "This element can't be removed" : "Remove";
}
//Block keyboard Delete too
window.addEventListener("keydown", (e) => {
  if (!selectedItem) return;

  const isDelete = (e.key === "Delete" || e.key === "Backspace");
  if (!isDelete) return;

  // don’t delete while typing in an input/textarea/contenteditable
  if (document.activeElement && (
    document.activeElement.tagName === "INPUT" ||
    document.activeElement.tagName === "TEXTAREA" ||
    document.activeElement.isContentEditable
  )) return;

  e.preventDefault();

  if (selectedItem.dataset.locked === "1") return; // ✅ locked stays
  selectedItem.remove();
  selectedItem = null;
  showBarForItem(null);
});

// =======================
// Show/Hide Image controls + fill values
// =======================
const isImage = item.dataset.type === "image";
if (imgWrap) imgWrap.style.display = isImage ? "block" : "none";

if (isImage) {
  // load values into controls
  imgFitEl.value  = item.dataset.fit || "cover";
  imgZoomEl.value = item.dataset.zoom || "1";
  imgBWEl.value   = item.dataset.borderWidth || "0";
  imgBCEl.value   = item.dataset.borderColor || "#111111";
  imgRadEl.value  = item.dataset.radius || "12";
}


// =======================
// Show/Hide BUTTON controls + fill values
// =======================
const isButton = item.dataset.type === "button";

// show/hide the button controls block
if (btnWrap) btnWrap.style.display = isButton ? "block" : "none";


if (isButton) {
  btnLabelEl.value = item.dataset.label || "Button";
  btnBgEl.value = item.dataset.btnBg || "#111111";
  btnTextColorEl.value = item.dataset.btnTextColor || "#ffffff";
  btnBwEl.value = item.dataset.borderWidth || "0";
  btnBcEl.value = item.dataset.borderColor || "#111111";
  btnBsEl.value = item.dataset.borderStyle || "solid";
  btnRadiusEl.value = item.dataset.radius || "12";
  btnHrefEl.value = item.dataset.href || "";
}



  const brEl = floatingBar.querySelector(".da-secBorder__radius");
if (brEl) {
  brEl.style.display = (!isText) ? "inline-block" : "none";
  if (!isText) brEl.value = item.dataset.radius || "0";
}

const isSection = item.dataset.type === "section";

const secControls = [
  floatingBar.querySelector('[data-sec="borderToggle"]'),
  floatingBar.querySelector(".da-secBorder__width"),
  floatingBar.querySelector(".da-secBorder__color"),
  floatingBar.querySelector(".da-secBorder__style"),
  floatingBar.querySelector(".da-secBorder__radius"),
];

secControls.forEach((c) => { if (c) c.style.display = isSection ? "inline-block" : "none"; });

if (isSection) {
  // load into bar
  floatingBar.querySelector(".da-secBorder__width").value  = item.dataset.borderWidth || "2";
  floatingBar.querySelector(".da-secBorder__color").value  = item.dataset.borderColor || "#111111";
  floatingBar.querySelector(".da-secBorder__style").value  = item.dataset.borderStyle || "solid";
  floatingBar.querySelector(".da-secBorder__radius").value = item.dataset.radius || "12";

  // highlight border toggle
  floatingBar.querySelector('[data-sec="borderToggle"]')
    ?.classList.toggle("is-on", item.dataset.borderOn === "1");
}

  // name
  floatingBar.querySelector(".da-floatingBar__name").value =
    item.dataset.name || (isText ? "Text" : isButton ? "Button" : "Section");

  // color (text => font color, section => bg color)
  const colorVal = isText
    ? (item.dataset.color || "#111111")
    : (item.dataset.bg || "#f9f7f6");

  floatingBar.querySelector(".da-floatingBar__color").value = colorVal;

const fontEl = floatingBar.querySelector(".da-floatingBar__font");
if (fontEl) {
  fontEl.style.display = isText ? "inline-block" : "none";
  if (isText) {
    fontEl.value = item.dataset.fontFamily || "system-ui";
  }
}

  // font size control (only show for text)
  const fsEl = floatingBar.querySelector(".da-floatingBar__fontSize");
  fsEl.style.display = isText ? "inline-block" : "none";
  if (isText) fsEl.value = item.dataset.fontSize || "24";

  // ✅ show/hide text buttons + highlight on/off states
  const txtBtns = [...floatingBar.querySelectorAll("[data-txt]")];
  txtBtns.forEach((b) => (b.style.display = isText ? "inline-block" : "none"));

  if (isText) {
    floatingBar.querySelector('[data-txt="bold"]')?.classList.toggle("is-on", item.dataset.bold === "1");
    floatingBar.querySelector('[data-txt="italic"]')?.classList.toggle("is-on", item.dataset.italic === "1");
    floatingBar.querySelector('[data-txt="underline"]')?.classList.toggle("is-on", item.dataset.underline === "1");

    // align highlight
    floatingBar.querySelectorAll('[data-txt^="align"]').forEach(b => b.classList.remove("is-on"));
    const a = item.dataset.align || "left";
    const key = a === "center" ? "alignCenter" : a === "right" ? "alignRight" : "alignLeft";
    floatingBar.querySelector(`[data-txt="${key}"]`)?.classList.add("is-on");
  }
}
// ✅ on load: hide bar until something is clicked
selectedItem = null;
floatingBar.style.display = "none";




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
  selectedItem.dataset.name = e.target.value || "Section";
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
    // ✅ for text elements: change text color
    selectedItem.dataset.color = val;
    const t = selectedItem.querySelector(".da-text");
    if (t) t.style.color = val;
  } else {
    // ✅ for sections: change background color
    selectedItem.dataset.bg = val;
    selectedItem.style.background = val;
  }
});


  let active = null;
let resizeActive = null;

function getMinSizeForItem(el) {
  const t = el?.dataset?.type || "";
  if (t === "text")   return { w: 40,  h: 24 };
  if (t === "button") return { w: 60,  h: 30 };
  // section default
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

  function toLocalXY(container, clientX, clientY) {
    const r = container.getBoundingClientRect();
    return {
      x: clientX - r.left + container.scrollLeft,
      y: clientY - r.top + container.scrollTop,
    };
  }

                                                 // =======================
                                            // STEP 4: //makeTextEl
                                             //Put all elements above Section Element
                                             // =======================
  //Add New Element
  //Image Element
  function makeImageEl({ x, y, src = "" }) {
  const el = document.createElement("div");
  el.className = "da-item da-item--image";
  el.dataset.type = "image";
  el.dataset.id = uid("img");

  // defaults
  el.dataset.src = src;               // later we’ll set this from the bar
  el.dataset.fit = el.dataset.fit || "cover";  // cover | contain
  el.dataset.radius = el.dataset.radius || "12";

  el.style.left = `${Math.round(x)}px`;
  el.style.top  = `${Math.round(y)}px`;
  el.style.width = `220px`;
  el.style.height = `160px`;
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

    img.style.objectFit = el.dataset.fit || "cover";
    img.style.borderRadius = `${parseInt(el.dataset.radius, 10) || 0}px`;
  }

  el.dataset.name = el.dataset.name || "Image";
  return el;
}

  //Text Element
function makeTextEl({ x, y, text = "Type here" }) {
  const el = document.createElement("div");
  el.className = "da-item da-item--text";
  el.dataset.type = "text";
  el.dataset.id = uid("text");
el.dataset.fontFamily = el.dataset.fontFamily || "system-ui";

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
  textEl.textContent = text;

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
    el.dataset.text = textEl.textContent || "";
  });

  // allow typing without starting drag
  textEl.addEventListener("mousedown", (ev) => {
    ev.stopPropagation();
  });

  return el;
}

  //Button Element
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
  el.dataset.href = el.dataset.href || "";

  el.style.left = `${Math.round(x)}px`;
  el.style.top  = `${Math.round(y)}px`;
  el.style.width = `180px`;
  el.style.height = `48px`;
el.dataset.name = el.dataset.name || "Button";


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
    b.textContent = el.dataset.label;

    b.style.background = el.dataset.btnBg;
    b.style.color = el.dataset.btnTextColor;

    const bw = parseInt(el.dataset.borderWidth, 10) || 0;
    const bs = el.dataset.borderStyle || "solid";
    const bc = el.dataset.borderColor || "#111111";
    b.style.border = (bs === "none" || bw === 0) ? "none" : `${bw}px ${bs} ${bc}`;

    b.style.borderRadius = `${parseInt(el.dataset.radius, 10) || 0}px`;

    // ✅ click opens link
b.addEventListener("click", (ev) => {
  if (!window.TPL_PREVIEW) return; // ✅ editing mode: don't open links
  ev.preventDefault();
  ev.stopPropagation();

  const href = (el.dataset.href || "").trim();
  if (href) window.open(href, "_blank");
});

 
  }

  return el;
}


  //Section Element
 function makeSectionEl({ x, y, w = 420, h = 168, title = "Section" }) {

    const el = document.createElement("div");
   el.className = "da-item da-item--section";
el.dataset.type = "section";
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


/////////////////////////////////////////////////////////

    return el;
  }
//get a section’s children
function getSectionChildren(sectionEl) {
  const id = sectionEl?.dataset?.id;
  if (!id) return [];
  return [...grid.querySelectorAll(`.da-item[data-parent="${id}"]`)];
}


                                             // =======================
                                            // STEP 8A
                                             //
                                             // =======================
function serializeCanvas() {
  const items = [...grid.querySelectorAll(".da-item")];

  return items.map((el) => ({
    type: el.dataset.type,
    id: el.dataset.id,
    parent: el.dataset.parent || "",
    x: parseFloat(el.style.left) || 0,
    y: parseFloat(el.style.top) || 0,
    w: el.offsetWidth,
    h: el.offsetHeight,
    z: parseInt(el.style.zIndex || "1", 10),

    // store ALL dataset fields (font, colors, borders, href, etc.)
    data: { ...el.dataset },
  }));
}
function clearCanvasItems() {
  grid.querySelectorAll(".da-item").forEach((n) => n.remove());
}

function applyDatasetToElement(el, data) {
  Object.entries(data || {}).forEach(([k, v]) => (el.dataset[k] = v));
}

function restoreCanvas(items = []) {
  clearCanvasItems();

  items.forEach((it) => {
    let el = null;

    if (it.type === "section") el = makeSectionEl({ x: it.x, y: it.y, w: it.w, h: it.h, title: it.data?.name || "Section" });
    if (it.type === "text") el = makeTextEl({ x: it.x, y: it.y, text: it.data?.text || "Type here" });
    if (it.type === "button") el = makeButtonEl({ x: it.x, y: it.y, label: it.data?.label || "Button" });
if (el.dataset.type === "image") {
  const img = el.querySelector(".da-img");
  if (img) {
    img.src = el.dataset.src || img.src;
    img.style.objectFit = el.dataset.fit || "cover";

    const zx = parseFloat(el.dataset.zoom || "1") || 1;
    img.style.transform = `scale(${zx})`;

    const px = parseFloat(el.dataset.posX || "50");
    const py = parseFloat(el.dataset.posY || "50");
    img.style.objectPosition = `${px}% ${py}%`;
  }

  const bw = parseInt(el.dataset.borderWidth || "0", 10) || 0;
  const bc = el.dataset.borderColor || "#111111";
  const rad = parseInt(el.dataset.radius || "0", 10) || 0;
  el.style.border = bw > 0 ? `${bw}px solid ${bc}` : "none";
  el.style.borderRadius = `${rad}px`;
}
if (it.type === "image") el = makeImageEl({ x: it.x, y: it.y, src: it.data?.src || "" });


    if (!el) return;

    // restore exact ID + dataset
    el.dataset.id = it.id || el.dataset.id;
    applyDatasetToElement(el, it.data);

    if (el.dataset.type === "image") {
  const img = el.querySelector(".da-img");
  if (img) {
    img.src = el.dataset.src || img.src;
    img.style.objectFit = el.dataset.fit || "cover";

    const zx = parseFloat(el.dataset.zoom || "1") || 1;
    img.style.transform = `scale(${zx})`;

    const px = parseFloat(el.dataset.posX || "50");
    const py = parseFloat(el.dataset.posY || "50");
    img.style.objectPosition = `${px}% ${py}%`;

    const rad = parseInt(el.dataset.radius || "0", 10) || 0;
    img.style.borderRadius = `${rad}px`;
  }

  const bw = parseInt(el.dataset.borderWidth || "0", 10) || 0;
  const bc = el.dataset.borderColor || "#111111";
  const rad = parseInt(el.dataset.radius || "0", 10) || 0;

  el.style.border = bw > 0 ? `${bw}px solid ${bc}` : "none";
  el.style.borderRadius = `${rad}px`;
  el.style.overflow = "hidden";
}

    // restore position/size/z
    el.style.left = `${Math.round(it.x)}px`;
    el.style.top  = `${Math.round(it.y)}px`;
    el.style.width  = `${Math.round(it.w)}px`;
    el.style.height = `${Math.round(it.h)}px`;
    el.style.zIndex = String(it.z || 1);

    // re-apply visual styles that depend on dataset
    if (el.dataset.type === "text") {
      const t = el.querySelector(".da-text");
      if (t) {
        t.textContent = el.dataset.text || "";
        t.style.color = el.dataset.color || "#111111";
        t.style.fontSize = `${parseInt(el.dataset.fontSize, 10) || 24}px`;
        t.style.fontFamily = el.dataset.fontFamily || "system-ui";
        t.style.fontWeight = (el.dataset.bold === "1") ? "700" : "400";
        t.style.fontStyle  = (el.dataset.italic === "1") ? "italic" : "normal";
        t.style.textDecoration = (el.dataset.underline === "1") ? "underline" : "none";
        t.style.textAlign = el.dataset.align || "left";

        // load google font if needed (optional)
        // you can only do this if you stored a gf param; otherwise skip
      }
    }

    if (el.dataset.type === "section") {
      el.style.background = el.dataset.bg || "#f2b26b";
      const on = el.dataset.borderOn === "1";
      const bw = parseInt(el.dataset.borderWidth, 10) || 0;
      const bs = el.dataset.borderStyle || "solid";
      const bc = el.dataset.borderColor || "#111111";
      el.style.border = on && bw > 0 ? `${bw}px ${bs} ${bc}` : "none";
      el.style.borderRadius = `${parseInt(el.dataset.radius, 10) || 0}px`;
    }

    if (el.dataset.type === "button") {
      const b = el.querySelector(".da-btn");
      if (b) {
        b.textContent = el.dataset.label || "Button";
        b.style.background = el.dataset.btnBg || "#111111";
        b.style.color = el.dataset.btnTextColor || "#ffffff";

        const bw = parseInt(el.dataset.borderWidth, 10) || 0;
        const bs = el.dataset.borderStyle || "solid";
        const bc = el.dataset.borderColor || "#111111";
        b.style.border = (bs === "none" || bw === 0) ? "none" : `${bw}px ${bs} ${bc}`;
        b.style.borderRadius = `${parseInt(el.dataset.radius, 10) || 0}px`;
      }
    }

    grid.appendChild(el);
  });
}


                                             // =======================
                                            // STEP 2: DRAGSTART PICKUP
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
////////////////////////////////////////////////////////////////////////////////////

  document.addEventListener("dragend", () => {
    dragType = null;
  });

  grid.addEventListener("dragover", (e) => {
    if (!dragType) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  });

                                               // =======================
                                            // STEP 3: DropArea
                                             //
                                             // =======================
grid.addEventListener("drop", (e) => {
  e.preventDefault();

  const type = e.dataTransfer.getData("text/plain") || dragType;
  if (!type) return;

  const pt = toLocalXY(grid, e.clientX, e.clientY);
  const x = Math.round(pt.x);
  const y = snapY(Math.round(pt.y));

  // ✅ find a section under the cursor (top-most)
const els = document.elementsFromPoint(e.clientX, e.clientY);
const parentSection = els
  .filter((n) => !n.closest?.(".da-floatingBar"))
  .map((n) => n.closest?.(".da-item--section"))
  .find((n) => n) || null;

  ////////////////////////////////////////////
//this is where you add the new element
//
  let el = null;
  if (type === "section") el = makeSectionEl({ x, y });
  if (type === "text") el = makeTextEl({ x, y });
  if (type === "button") el = makeButtonEl({ x, y });
  if (type === "image") el = makeImageEl({ x, y });
if (type === "header") {
  addLockedHeaderAt({ x, y });
  return;
}




  if (!el) return;

  // ✅ if dropping text on a section, "contain" it
if ((type === "text" || type === "button" || type === "image") && parentSection) {
  el.dataset.parent = parentSection.dataset.id;
  el.style.zIndex = String(parseInt(parentSection.style.zIndex || "1", 10) + 1);
}

  grid.appendChild(el);

  grid.querySelector(".tpl-dropArea__label")?.remove();
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

  previewModal.querySelector("img").src = src;
  previewModal.classList.add("is-open");
});

grid.addEventListener("mousedown", (e) => {
 // ✅ normal click picks the top item, shift-click cycles through stacked items
  // ✅ If the user clicks the floating bar, do NOT unselect/hide it
   if (e.target.closest(".da-resize")) return;
    if (e.target.closest(".da-floatingBar")) return;

 let item = e.target.closest(".da-item");
// ✅ PREVIEW MODE: clicking a real button should NOT drag the canvas item
if (window.TPL_PREVIEW && e.target.closest(".da-btn")) {
  return; // let the button's own click handler open the link
}

// ✅ if click hits overlap, allow selecting the back one with SHIFT
if (e.shiftKey) {
  item = pickAtPoint(e.clientX, e.clientY) || item;
}
// ✅ if you clicked a tab inside a group, drag the group instead
const parentGroup = getParentGroupEl(item);
const dragEl = parentGroup || item; // drag group if exists, otherwise drag item


  // ✅ CLICKED EMPTY SPACE = UNSELECT
if (!item) {
  grid.querySelectorAll(".da-item").forEach((x) => x.classList.remove("is-selected"));
  showBarForItem(null);
  return;
}

// ✅ if user clicked inputs/editable text, don't start drag
if (e.target.closest("input, textarea, [contenteditable='true']")) return;


  // ✅ remember if it was already selected BEFORE we change selection
  const wasSelected = item.classList.contains("is-selected");

  // ✅ SELECT (shows bar)
  grid.querySelectorAll(".da-item").forEach((x) => x.classList.remove("is-selected"));
item.classList.add("is-selected");
showBarForItem(item);


 
  // ✅ RULE:
  // first click selects only. second click/drag actually drags.
// ✅ Sections drag immediately, everything else still needs select-then-drag
if (!wasSelected && item.dataset.type !== "section") return;

e.preventDefault();
document.body.style.userSelect = "none";

const rect = dragEl.getBoundingClientRect();
const gridRect = grid.getBoundingClientRect();

const startLeft = rect.left - gridRect.left + grid.scrollLeft;
const startTop  = rect.top  - gridRect.top  + grid.scrollTop;

let childrenStart = null;
if (dragEl.dataset.type === "section" || dragEl.dataset.type === "header" || dragEl.dataset.type === "group") {
  const kids = getChildrenDeep(dragEl);
  childrenStart = kids.map((k) => ({
    el: k,
    left: parseFloat(k.style.left) || 0,
    top: parseFloat(k.style.top) || 0,
  }));
}

active = {
  el: dragEl,
  startX: e.clientX,
  startY: e.clientY,
  startLeft,
  startTop,
  childrenStart,
};

dragEl.classList.add("is-dragging");

});

let imgPan = null;

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

  // ✅ If resizing something inside header, clamp size + position to header
const headerAncestor = getHeaderAncestor(r.el);
if (headerAncestor && r.el.dataset.type !== "header") {
  // apply the current computed values first (so offsets match)
  r.el.style.left = px(left);
  r.el.style.top  = px(top);
  r.el.style.width = px(w);
  r.el.style.height = px(h);

  clampElToHeaderBounds(r.el, headerAncestor);

  refreshBarPosition();
  return;
}

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

    const dx = e.clientX - active.startX;
    const dy = e.clientY - active.startY;

  let nextLeft = active.startLeft + dx;
let nextTop  = active.startTop + dy;

// keep it inside drop area bounds (basic clamp)
const maxLeft = grid.scrollWidth - active.el.offsetWidth;
const maxTop  = grid.scrollHeight - active.el.offsetHeight;

nextLeft = clamp(nextLeft, 0, Math.max(0, maxLeft));
nextTop  = clamp(nextTop, 0, Math.max(0, maxTop));

// ✅ only sections snap vertically
if (active?.el?.dataset?.type === "section") {
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
   active.el.dataset.type === "group") &&
  Array.isArray(active.childrenStart)
) {
  active.childrenStart.forEach((c) => {
    c.el.style.left = `${Math.round(c.left + finalDx)}px`;
    c.el.style.top  = `${Math.round(c.top + finalDy)}px`;
  });
}

active.el.style.left = `${Math.round(nextLeft)}px`;
active.el.style.top  = `${Math.round(nextTop)}px`;

refreshBarPosition();


  });

window.addEventListener("mouseup", () => {
  if (resizeActive) {
    document.body.style.userSelect = "";
    resizeActive = null;
    return;
  }

  if (!active) return;

  document.body.style.userSelect = ""; // ✅ restore
  active.el.classList.remove("is-dragging");
  active = null;
});
})();

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
