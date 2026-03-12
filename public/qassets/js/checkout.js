// /public/qassets/js/checkout.js
(() => {
  const API = "https://api2.suiteseat.io";
let stripe = null;
let elements = null;
let cardNumber = null;
let cardExpiry = null;
let cardCvc = null;

  function resetStripeForm() {
    try { cardNumber?.unmount(); } catch (e) {}
    try { cardExpiry?.unmount(); } catch (e) {}
    try { cardCvc?.unmount(); } catch (e) {}

    cardNumber = null;
    cardExpiry = null;
    cardCvc = null;
    elements = null;

    const stripeWrap = document.getElementById("stripe-area");
    if (stripeWrap) {
      stripeWrap.innerHTML = "";
    }
  }

const STRIPE_PUBLISHABLE_KEY = "pk_live_51OUNpKIQ1nIGUF4eTF7bnLg90u4IDbaHyrZ4wHrPAIjneesni2ZSd5a7hl92Cp32KtaYC646eZXifZp62WLwtivh003OiMqPmY"; // <-- put your real publishable key here

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

  // move focus into the modal
  setTimeout(() => $("authEmail")?.focus(), 0);
}

function closeAuth() {
  // move focus OUT of the modal first
  $("open-login-popup-btn")?.focus();

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

    return { mode: "loggedIn", items, checkout: pack?.checkout || null, checkoutId };
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


function setCheckoutMode(totalCents) {
  const payBtn = document.getElementById("payNowBtn");
  const paymentCard = document.querySelector(".checkout-payment-card");
  const stripeWrap = document.getElementById("stripe-area");
  const processingEl = document.getElementById("processingAmount");

  const isFree = Number(totalCents || 0) <= 0;

  if (payBtn) {
    payBtn.textContent = isFree ? "Continue with order" : "Enter card details";
  }

  if (paymentCard) {
    paymentCard.style.display = isFree ? "none" : "block";
  }

  if (stripeWrap && isFree) {
    stripeWrap.innerHTML = "";
  }

  if (processingEl && isFree) {
    processingEl.textContent = "$0.00";
  }
}

function renderItems(view) {
  const wrap = document.getElementById("itemsWrap");
  if (!wrap) return;

  const items = Array.isArray(view?.items) ? view.items : [];
  const checkoutValues = view?.checkout?.values || {};

  // reset Stripe form when cart changes
  resetStripeForm();

  const subtotalCents = Number(checkoutValues["Subtotal"] || 0);
  const processingCents = Number(checkoutValues["Platform Fee"] || 0);
  const totalCents = Number(checkoutValues["Total Amount"] || 0);

  const subtotalEl = document.getElementById("subtotalAmount");
  const processingEl = document.getElementById("processingAmount");
  const totalEl = document.getElementById("totalAmount");
  const payBtn = document.getElementById("payNowBtn");

  if (subtotalEl) subtotalEl.textContent = moneyFromCents(subtotalCents);
  if (processingEl) processingEl.textContent = moneyFromCents(processingCents);
  if (totalEl) totalEl.textContent = moneyFromCents(totalCents);
setCheckoutMode(totalCents);

  if (payBtn) {
    payBtn.textContent = totalCents <= 0 ? "Continue with order" : "Enter card details";
  }

  if (!items.length) {
    wrap.innerHTML = `<div class="empty-checkout">No items in checkout yet.</div>`;
    if (processingEl) processingEl.textContent = "$0.00";
    if (subtotalEl) subtotalEl.textContent = "$0.00";
    if (totalEl) totalEl.textContent = "$0.00";
    if (payBtn) payBtn.textContent = "Enter card details";
    return;
  }

  wrap.innerHTML = items.map((it) => {
    const id = it?._id || it?.id || "";
    const v = it?.values || it || {};
    const label = v["Label"] || v.label || v["Kind"] || "Item";
    const qty = Number(v["Quantity"] || v.quantity || 1);
    const unit = Number(v["Unit Amount"] || v.unitAmount || 0);
    const total = Number(v["Total Amount"] || v.totalAmount || unit * qty);

    const canRemove = !!id;

    return `
      <div class="summary-item">
        <div>
          <div class="summary-name">${escapeHtml(label)}</div>
          <div class="summary-meta">
            Qty: ${qty} • Unit: ${moneyFromCents(unit)}
          </div>
        </div>

        <div class="summary-item-right">
          <div class="summary-price">${moneyFromCents(total)}</div>
          ${
            canRemove
              ? `
                <button
                  class="remove-item-btn"
                  data-remove-id="${escapeHtml(id)}"
                  title="Remove"
                  aria-label="Remove item"
                  type="button"
                >
                  🗑️
                </button>
              `
              : ``
          }
        </div>
      </div>
    `;
  }).join("");

  wrap.querySelectorAll("[data-remove-id]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-remove-id");
      if (!id) return;

      btn.disabled = true;

      const ok = confirm("Remove this item from checkout?");
      if (!ok) {
        btn.disabled = false;
        return;
      }

      const { res, data } = await apiFetch(`/api/checkout/items/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        console.error("remove failed", res.status, data);
        alert(data?.error || data?.message || "Could not remove item.");
        btn.disabled = false;
        return;
      }

      const me = await apiFetch("/api/me", { method: "GET" }).catch(() => null);
      const loggedIn = !!me?.data?.ok;

      const fresh = await loadCheckoutView(loggedIn).catch(() => ({ items: [], checkout: null }));
      renderItems(fresh);
    });
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
renderItems(view);

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
const view2 = await loadCheckoutView(loggedIn);
renderItems(view2);


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
renderItems(view2);

    });

$("payNowBtn")?.addEventListener("click", async () => {
  try {
    const me = await apiFetch("/api/me", { method: "GET" });
    if (!me?.data?.ok) {
      openAuth();
      return;
    }

    const cur = await apiFetch("/api/checkout/current", { method: "GET" });
    if (!cur?.res?.ok) {
      alert("Could not load checkout.");
      return;
    }

    const pack = Array.isArray(cur.data?.items) ? cur.data.items[0] : null;
    const checkoutValues = pack?.checkout?.values || {};
    const totalAmount = Number(checkoutValues["Total Amount"] || 0);

    if (totalAmount <= 0) {
      const freeRes = await apiFetch("/api/checkout/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          freeCheckout: true,
          paymentIntentId: "FREE_ORDER",
        }),
      });

      if (!freeRes.res.ok) {
        alert(freeRes.data?.message || freeRes.data?.error || "Could not complete free order.");
        return;
      }

      alert("Free order completed ✅");
      window.location.href = "/checkout-success";
      return;
    }

    await showStripeCardFormAndPay();
  } catch (e) {
    console.error(e);
    alert("Could not start checkout.");
  }
});
  }

  document.addEventListener("DOMContentLoaded", init);

  async function showStripeCardFormAndPay() {
  const stripeWrap = document.getElementById("stripe-area");
  if (!stripeWrap) return alert("Missing #stripe-area");

  // build UI once
stripeWrap.innerHTML = `
  <section class="stripe-card-box">
    <h3 class="stripe-card-title">Enter your card details</h3>

    <div class="stripe-fields-grid">
      <div class="stripe-field stripe-field-large">
        <label class="stripe-label">Card number</label>
        <div id="card-number-element" class="stripe-input-box"></div>
      </div>

      <div class="stripe-field">
        <label class="stripe-label">Expiration date</label>
        <div id="card-expiry-element" class="stripe-input-box"></div>
      </div>

      <div class="stripe-field">
        <label class="stripe-label">CVC</label>
        <div id="card-cvc-element" class="stripe-input-box"></div>
      </div>
    </div>

    <div id="card-error" class="card-error-text"></div>

    <button id="confirmPayBtn" class="confirm-pay-btn" type="button">
      Confirm payment
    </button>
  </section>
`;

  if (!stripe) stripe = window.Stripe(STRIPE_PUBLISHABLE_KEY);
  if (!elements) elements = stripe.elements();

  // mount card element once
const stripeStyle = {
  base: {
    fontSize: "16px",
    color: "#171717",
    fontFamily: "Arial, sans-serif",
    "::placeholder": {
      color: "#9ca3af",
    },
  },
  invalid: {
    color: "#c62828",
  },
};

if (!cardNumber) {
  cardNumber = elements.create("cardNumber", { style: stripeStyle });
  cardExpiry = elements.create("cardExpiry", { style: stripeStyle });
  cardCvc = elements.create("cardCvc", { style: stripeStyle });

  cardNumber.mount("#card-number-element");
  cardExpiry.mount("#card-expiry-element");
  cardCvc.mount("#card-cvc-element");

  const handleChange = (event) => {
    document.getElementById("card-error").textContent = event.error ? event.error.message : "";
  };

  cardNumber.on("change", handleChange);
  cardExpiry.on("change", handleChange);
  cardCvc.on("change", handleChange);
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

const checkoutValues = pack?.checkout?.values || {};
const totalAmount = Number(checkoutValues["Total Amount"] || 0);

if (totalAmount <= 0) {
  console.log("[free checkout] sending confirm request");

  const freeRes = await apiFetch("/api/checkout/confirm", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      freeCheckout: true,
      paymentIntentId: "FREE_ORDER",
    }),
  });

  console.log("[free checkout confirm response]", {
    status: freeRes.res?.status,
    data: freeRes.data,
  });

  if (!freeRes.res.ok) {
    alert(freeRes.data?.message || freeRes.data?.error || "Could not complete free order.");
    return;
  }

  alert("Free order completed ✅");
  window.location.href = "/checkout-success";
  return;
}
// 2) create PI for THAT checkout
const { res, data } = await apiFetch(`/api/checkout/${encodeURIComponent(checkoutId)}/create-payment-intent`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({}),
});

console.log("[create PI] full response:", { status: res.status, data });


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

      if (!cardNumber) {
  document.getElementById("card-error").textContent = "Please enter your card details.";
  document.getElementById("confirmPayBtn").disabled = false;
  return;
}
      // 2) confirm card payment
const result = await stripe.confirmCardPayment(clientSecret, {
  payment_method: {
    card: cardNumber,
  },
});

      if (result.error) {
        document.getElementById("card-error").textContent = result.error.message || "Payment failed.";
        document.getElementById("confirmPayBtn").disabled = false;
        return;
      }

      if (result.paymentIntent?.status === "succeeded") {
         console.log("[confirm] sending paymentIntentId", result.paymentIntent.id);
        // optional: tell server to finalize checkout / grant access
const confirmRes = await apiFetch("/api/checkout/confirm", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ paymentIntentId: result.paymentIntent.id }),
});

console.log("[checkout confirm]", {
  status: confirmRes.res?.status,
  data: confirmRes.data,
});

if (!confirmRes.res?.ok) {
  document.getElementById("card-error").textContent =
    confirmRes.data?.message || confirmRes.data?.error || "Payment went through, but checkout confirmation failed.";
  document.getElementById("confirmPayBtn").disabled = false;
  return;
}

alert("Payment successful ✅");
window.location.href = "/checkout-success";
      } 
      else {
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
