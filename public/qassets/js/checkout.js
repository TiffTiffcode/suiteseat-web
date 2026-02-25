// /public/qassets/js/checkout.js
(() => {
  const API = "https://api2.suiteseat.io";
let stripe = null;
let elements = null;
let card = null;

const STRIPE_PUBLISHABLE_KEY = "pk_live_xxx"; // <-- put your real publishable key here

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
async function loadCheckoutView(loggedIn) {
  if (loggedIn) {
    // LOGGED IN: use real checkout items
    const cur = await apiFetch("/api/checkout/current", { method: "GET" });
    if (!cur?.res?.ok) return { mode: "loggedOut", items: [] };

    const pack = Array.isArray(cur.data?.items) ? cur.data.items[0] : null;
    const items = Array.isArray(pack?.items) ? pack.items : [];
    const checkoutId = pack?.checkout?._id || null;

    return { mode: "loggedIn", items, checkoutId };
  }

  // GUEST: build a “virtual item” from URL
  const courseId = getParam("courseId") || getParam("addCourse"); // support both
  const qty = Math.max(1, Number(getParam("qty") || 1));
  if (!courseId) return { mode: "guestEmpty", items: [] };

  // Use your PUBLIC records endpoint to fetch course details (read-only)
  const { res, data } = await apiFetch(
    `/public/records?dataType=${encodeURIComponent("Course")}&_id=${encodeURIComponent(courseId)}&limit=1&ts=${Date.now()}`,
    { method: "GET" }
  );

  const rows = Array.isArray(data) ? data : (data?.items || data?.rows || []);
  const course = rows[0];
  if (!course) return { mode: "guestEmpty", items: [] };

  const v = course.values || {};
  const title = v["Course Title"] || v["Title"] || "Course";
  const priceDollars = Number(v["Price"] || 0);     // IMPORTANT: for display only
  const unitCents = Math.round(priceDollars * 100); // display only
  const totalCents = unitCents * qty;

  const virtualItem = {
    values: {
      Label: title,
      Quantity: qty,
      "Unit Amount": unitCents,
      "Total Amount": totalCents,
      Kind: "course",
      "Reference Id": courseId,
    }
  };

  return { mode: "guest", items: [virtualItem], courseId, qty };
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

        <div id="stripe-area" style="margin-top:14px;"></div>

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
    const id = it?._id || it?.id || ""; // record id
    const v = it?.values || it || {};
    const label = v["Label"] || v.label || v["Kind"] || "Item";
    const qty = Number(v["Quantity"] || v.quantity || 1);
    const unit = Number(v["Unit Amount"] || v.unitAmount || 0);
    const total = Number(v["Total Amount"] || v.totalAmount || unit * qty);

    const canRemove = !!id; // guest “virtual items” won't have _id

    return `
      <div style="border:1px solid #e5e5e5;border-radius:12px;padding:12px;display:flex;justify-content:space-between;gap:12px;align-items:flex-start;">
        <div style="min-width:0;">
          <div style="font-weight:700;">${escapeHtml(label)}</div>
          <div style="font-size:12px;opacity:.75;margin-top:4px;">
            Qty: ${qty} • Unit: ${moneyFromCents(unit)}
          </div>
        </div>

        <div style="display:flex;align-items:center;gap:10px;flex-shrink:0;">
          <div style="font-weight:800;">${moneyFromCents(total)}</div>
          ${
            canRemove
              ? `<button class="ss-trash-btn" data-remove-id="${escapeHtml(id)}" title="Remove" aria-label="Remove item"
                   style="border:1px solid #ddd;background:#fff;border-radius:10px;padding:8px 10px;cursor:pointer;">
                   🗑️
                 </button>`
              : ``
          }
        </div>
      </div>
    `;
  })
  .join("");

  // remove handlers
wrap.querySelectorAll("[data-remove-id]").forEach((btn) => {
  btn.addEventListener("click", async () => {
    const id = btn.getAttribute("data-remove-id");
    if (!id) return;

    btn.disabled = true;

    const ok = confirm("Remove this item from checkout?");
    if (!ok) { btn.disabled = false; return; }

    const { res, data } = await apiFetch(`/api/checkout/items/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });

    if (!res.ok) {
      console.error("remove failed", res.status, data);
      alert(data?.error || data?.message || "Could not remove item.");
      btn.disabled = false;
      return;
    }

    // reload view + rerender
    const me = await apiFetch("/api/me", { method: "GET" }).catch(() => null);
    const loggedIn = !!me?.data?.ok;

    const view = await loadCheckoutView(loggedIn).catch(() => ({ items: [] }));
    renderItems(view.items);
  });
});


document.getElementById("payNowBtn")?.addEventListener("click", async () => {
  try {
    // must be logged in to charge + attach to customer
    const me = await apiFetch("/api/me", { method: "GET" });
    if (!me?.data?.ok) {
      openAuth();
      return;
    }

    // show stripe UI area
    await showStripeCardFormAndPay();
  } catch (e) {
    console.error(e);
    alert("Could not start Stripe checkout.");
  }
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
const view = await loadCheckoutView(false);
renderItems(view.items);

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
const view = await loadCheckoutView(loggedIn);
renderItems(view.items);


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
const view2 = await loadCheckoutView(true);
renderItems(view2.items);

    });
  }

  document.addEventListener("DOMContentLoaded", init);

  async function showStripeCardFormAndPay() {
  const stripeWrap = document.getElementById("stripe-area");
  if (!stripeWrap) return alert("Missing #stripe-area");

  // build UI once
  stripeWrap.innerHTML = `
    <section style="border:1px solid #e5e5e5;border-radius:12px;padding:14px;">
      <h3 style="margin:0 0 10px;">Payment</h3>

      <div id="card-element" style="padding:12px;border:1px solid #ddd;border-radius:10px;"></div>
      <div id="card-error" style="color:#b00020;margin-top:10px;min-height:18px;"></div>

      <button id="confirmPayBtn" class="ss-btn ss-btn-outline" style="margin-top:12px;width:100%;">
        Pay now
      </button>
    </section>
  `;

  if (!stripe) stripe = window.Stripe(STRIPE_PUBLISHABLE_KEY);
  if (!elements) elements = stripe.elements();

  // mount card element once
  if (!card) {
    card = elements.create("card");
    card.mount("#card-element");

    card.on("change", (event) => {
      document.getElementById("card-error").textContent = event.error ? event.error.message : "";
    });
  }

  // click confirm pay
  document.getElementById("confirmPayBtn").onclick = async () => {
    document.getElementById("confirmPayBtn").disabled = true;
    document.getElementById("card-error").textContent = "";

    try {
      // 1) ask server to create PaymentIntent based on current checkout items
     // 1) get current checkout (needs login)
const cur = await apiFetch("/api/checkout/current", { method: "GET" });
if (!cur?.res?.ok) {
  openAuth();
  document.getElementById("confirmPayBtn").disabled = false;
  return;
}

const pack = Array.isArray(cur.data?.items) ? cur.data.items[0] : null;
const checkoutId = pack?.checkout?._id;
if (!checkoutId) {
  alert("No checkout found.");
  document.getElementById("confirmPayBtn").disabled = false;
  return;
}

// 2) create PI for THAT checkout
const { res, data } = await apiFetch(`/api/checkout/${encodeURIComponent(checkoutId)}/create-payment-intent`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({}),
});

  

      if (!res.ok) {
        console.error("create intent failed", res.status, data);
        alert(data?.message || data?.error || "Could not start payment.");
        document.getElementById("confirmPayBtn").disabled = false;
        return;
      }

      const clientSecret = data?.clientSecret;
      if (!clientSecret) {
        alert("Missing clientSecret from server.");
        document.getElementById("confirmPayBtn").disabled = false;
        return;
      }

      // 2) confirm card payment
      const result = await stripe.confirmCardPayment(clientSecret, {
        payment_method: { card },
      });

      if (result.error) {
        document.getElementById("card-error").textContent = result.error.message || "Payment failed.";
        document.getElementById("confirmPayBtn").disabled = false;
        return;
      }

      if (result.paymentIntent?.status === "succeeded") {
        // optional: tell server to finalize checkout / grant access
        await apiFetch("/api/checkout/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paymentIntentId: result.paymentIntent.id }),
        }).catch(() => null);

        alert("Payment successful ✅");
        window.location.href = "/checkout-success.html";
      } else {
        alert(`Payment status: ${result.paymentIntent?.status}`);
        document.getElementById("confirmPayBtn").disabled = false;
      }
    } catch (e) {
      console.error(e);
      alert("Payment error. Please try again.");
      document.getElementById("confirmPayBtn").disabled = false;
    }
  };
}

})();
