//C:\Users\tiffa\OneDrive\Desktop\suiteseat-web\src\app\[slug]\StoreFlows\basicFlow.tsx

"use client";
import { createContext, useContext, useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";

const FlowCtx = createContext<any>(null);
export const useFlow = () => useContext(FlowCtx);

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

export function BasicFlowProvider({ apiOrigin, store, children }: any){
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [show, setShow] = useState(false);

  async function startBuyNow(items: { id: string }[]){
    const r = await fetch(`${apiOrigin}/api/store/checkout-intent`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ storeId: store?.id, items })
    });
    const json = await r.json();
    if (!json?.clientSecret) { alert("Checkout init failed"); return; }
    setClientSecret(json.clientSecret);
    setShow(true);
  }

  function close(){ setShow(false); setClientSecret(null); }

  return (
    <FlowCtx.Provider value={{ startBuyNow, close }}>
      {children}
      {show && clientSecret && (
        <Elements stripe={stripePromise} options={{ clientSecret }}>
          <CheckoutModal onClose={close} />
        </Elements>
      )}
    </FlowCtx.Provider>
  );
}

function CheckoutModal({ onClose }: { onClose: () => void }){
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);

  return (
    <div className="checkout-modal">
      <div className="checkout-card">
        <h3>Checkout</h3>
        <PaymentElement />
        <button
          disabled={busy || !stripe || !elements}
          className="btn"
          onClick={async ()=>{
            if (!stripe || !elements) return;
            setBusy(true);
            const { error } = await stripe.confirmPayment({
              elements,
              confirmParams: { return_url: window.location.href + "?success=1" }
            });
            if (error) alert(error.message);
            setBusy(false);
          }}
        >
          Pay
        </button>
        <button className="btn" onClick={onClose} style={{ marginLeft: 8 }}>Cancel</button>
      </div>
    </div>
  );
}
