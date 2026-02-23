// /public/qassets/js/checkout.js
(() => {
  const API = "https://api2.suiteseat.io";

  // ---------- helpers ----------
  const $ = (id) => document.getElementById(id);

  async function apiFetch(path, options = {}) {
    const res = await fetch(`${API}${path}`, {
      credentials: "include",
      headers: { Accept: "application/json", ...(options.headers || {}) },
      ...options,
    });

    const data = await res.json().catch(() => null);
    return { res, data };
  }

  function getParam(name) {
    const u = new URL(window.location.href);
    return u.searchParams.get(name);
  }

  function clearAddParamsFromUrl() {
    const u = new URL(window.location.href);
    u.searchParams.delete("addCourse");
    u.searchParams.delete("qty");
    window.history.replaceState({}, "", u.toString());
  }

  function moneyFromCents(cents) {
    const n = Number(cents || 0);
    return `$${(n / 100).toFixed(2)}`;
  }

  function escapeHtml(s) {
    return String(s || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  // ---------- auth UI ----------
  function setLoggedOutUI() {
    $("login-status-text").textContent = "Not logged in";
    $("open-login-popup-btn").style.display = "";
    $("logout-btn").style.display = "none";
  }

  function setLoggedInUI(user) {
    const name = user?.firstName ? `Hey ${user.firstName}` : "Logged in";
    $("login-status-text").textContent = name;
    $("open-login-popup-btn").style.display = "none";
    $("logout-btn").style.display = "";
  }

  function openAuth() {
    const m = $("authModal");
    m.hidden = false;
    m.setAttribute("aria-hidden", "false");
  }

  function closeAuth() {
    const m = $("authModal");
    m.hidden = true;
    m.setAttribute("aria-hidden", "true");
  }

  // ---------- checkout items ----------
  async function loadCheckoutItems() {
    // For now we’re using public records just to SEE what exists.
    // Later you’ll likely swap to a private endpoint.
    const { data } = await apiFetch(
      `/public/records?dataType=${encodeURIComponent("Checkout Item")}&limit=50&ts=${Date.now()}`,
      { method: "GET" }
    );

    return Array.isArray(data) ? data : (data?.items || data?.rows || []);
  }

  function renderItems(items) {
    const main = document.querySelector("main.ss-settings-layout");
    if (!main) return;

    const subtotalCents = items.reduce((sum, it) => {
      const v = it?.values || it || {};
      return sum + Number(v["Total Amount"] || v.totalAmount || 0);
    }, 0);

    main.innerHTML = `
      <section style="max-width:900px;margin:24px auto;padding:16px;">
        <h2 style="margin:0 0 12px;">Your checkout</h2>

        <div id="itemsWrap" style="display:grid;gap:12px;"></div>

        <div style="margin-top:18px;padding-top:12px;border-top:1px solid #ddd;display:flex;justify-content:space-between;align-items:center;">
          <div style="font-weight:600;">Subtotal</div>
          <div style="font-weight:700;">${moneyFromCents(subtotalCents)}</div>
        </div>

        <button id="payNowBtn" class="ss-btn ss-btn-outline" style="margin-top:16px;width:100%;">
          Pay with Stripe
        </button>

        <p style="margin-top:10px;font-size:12px;opacity:.7;">
          Stripe step comes next — we’ll create a PaymentIntent using these items.
        </p>
      </section>
    `;

    const wrap = document.getElementById("itemsWrap");
    if (!wrap) return;

    if (!items.length) {
      wrap.innerHTML = `<div style="padding:14px;border:1px dashed #bbb;border-radius:10px;">No items in checkout yet.</div>`;
      return;
    }

    wrap.innerHTML = items
      .map((it) => {
        const v = it?.values || it || {};
        const label = v["Label"] || v.label || v["Kind"] || "Item";
        const qty = Number(v["Quantity"] || v.quantity || 1);
        const unit = Number(v["Unit Amount"] || v.unitAmount || 0);
        const total = Number(v["Total Amount"] || v.totalAmount || unit * qty);

        return `
          <div style="border:1px solid #e5e5e5;border-radius:12px;padding:12px;display:flex;justify-content:space-between;gap:12px;">
            <div>
              <div style="font-weight:700;">${escapeHtml(label)}</div>
              <div style="font-size:12px;opacity:.75;margin-top:4px;">
                Qty: ${qty} • Unit: ${moneyFromCents(unit)}
              </div>
            </div>
            <div style="font-weight:800;">${moneyFromCents(total)}</div>
          </div>
        `;
      })
      .join("");

    document.getElementById("payNowBtn")?.addEventListener("click", () => {
      alert("Next step: create PaymentIntent + show Stripe Elements here.");
    });
  }

  // ---------- add course from URL ----------
  async function maybeAddCourseFromUrl(isLoggedIn) {
    const addCourse = getParam("addCourse");
    const qtyRaw = getParam("qty");

    if (!addCourse) return;
    if (!isLoggedIn) return; // keep params until login

    const quantity = Math.max(1, Number(qtyRaw || 1));

    const { res, data } = await apiFetch("/api/checkout/items/add-course", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ courseId: addCourse, quantity }),
    });

    if (!res.ok) {
      console.error("add-course failed:", res.status, data);
      alert(data?.error || data?.message || "Failed to add course to checkout");
      return;
    }

    clearAddParamsFromUrl();
  }

  // ---------- init ----------
  async function init() {
    // header buttons
    $("open-login-popup-btn")?.addEventListener("click", openAuth);
    $("logout-btn")?.addEventListener("click", async () => {
      await apiFetch("/api/logout", { method: "POST" }).catch(() => null);
      setLoggedOutUI();
      const items = await loadCheckoutItems().catch(() => []);
      renderItems(items);
    });

    // modal close
    $("authClose")?.addEventListener("click", closeAuth);

    // check session
    const me = await apiFetch("/api/me", { method: "GET" }).catch(() => ({ res: null, data: null }));
    const loggedIn = !!me?.data?.ok;

    if (loggedIn) setLoggedInUI(me.data.user);
    else setLoggedOutUI();

    // add course if URL has it and user is logged in
    await maybeAddCourseFromUrl(loggedIn);

    // render items
    const items = await loadCheckoutItems().catch(() => []);
    renderItems(items);

    // login submit
    $("authForm")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      $("authError").textContent = "";

      const email = $("authEmail").value;
      const password = $("authPass").value;

      const submitBtn = $("authSubmit");
      submitBtn?.setAttribute("disabled", "true");

      const { res, data } = await apiFetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      }).catch((err) => ({ res: { ok: false }, data: { message: err?.message } }));

      submitBtn?.removeAttribute("disabled");

      if (!res.ok) {
        $("authError").textContent = data?.message || "Login failed.";
        return;
      }

      closeAuth();
      setLoggedInUI(data.user);

      // now add the course from URL (if present), then refresh list
      await maybeAddCourseFromUrl(true);
      const items2 = await loadCheckoutItems().catch(() => []);
      renderItems(items2);
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
