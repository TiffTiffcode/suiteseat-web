function money(n) {
  const num = Number(n || 0);
  return num.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

function formatDue(due) {
  if (!due) return "";
  // accept ISO or YYYY-MM-DD
  const dt = new Date(String(due).includes("T") ? String(due) : `${due}T00:00:00`);
  if (Number.isNaN(dt.getTime())) return "";
  return `Due: ${dt.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}`;
}

(async function () {
  const parts = location.pathname.split("/");
  const token = parts[parts.length - 1]; // /pay/invoice/:token

  const msg = document.getElementById("msg");
  const amountEl = document.getElementById("inv-amount");
  const dueEl = document.getElementById("inv-due");
  const payBtn = document.getElementById("pay-btn");

  // show paid message (optional)
  const qs = new URLSearchParams(location.search);
  if (qs.get("paid") === "1") {
    if (msg) msg.textContent = "Payment completed! 🎉";
    if (payBtn) payBtn.style.display = "none";
  }

  try {
    const res = await fetch(`/api/public/invoice/${encodeURIComponent(token)}`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.message || "Failed to load invoice");

    const inv = data.item;
    const v = inv?.values || inv || {};

    // your Invoice fields
    const amount = v.Amount ?? 0;
    const due = v["Due Date"] || v.DueDate || v.dueDate || "";

    // NEW: stripe hosted invoice url saved on Invoice record
    const hostedUrl =
      v.stripeHostedInvoiceUrl ||
      v["Stripe Hosted Invoice Url"] ||
      v.hostedInvoiceUrl ||
      "";

    if (amountEl) amountEl.textContent = money(amount);
    if (dueEl) dueEl.textContent = formatDue(due);

    if (!hostedUrl) {
      if (msg) msg.textContent = "This invoice isn’t ready to pay yet.";
      if (payBtn) payBtn.disabled = true;
      return;
    }

    // Pay now just goes to Stripe Hosted Invoice page
    if (payBtn) {
      payBtn.disabled = false;
      payBtn.addEventListener("click", () => {
        window.location.href = hostedUrl;
      });
    }
  } catch (e) {
    if (msg) msg.textContent = e?.message || "Failed to load invoice";
    if (payBtn) payBtn.disabled = true;
  }
})();
