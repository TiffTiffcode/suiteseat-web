//C:\Users\tiffa\OneDrive\Desktop\suiteseat-web\src\app\[slug]\StoreTemplates\basic\Template.tsx

"use client";

// ✅ go up two levels to [slug]/StoreFlows/basicFlow.ts and StoreCartContext.tsx
import { useFlow } from "../../StoreFlows/basicFlow";
import { useCart } from "../../StoreCartContext";

export default function BasicTemplate({ store, products, slug }: any) {
  const { startBuyNow } = useFlow();
  const { addItem, openCart } = useCart();

  const name = store?.values?.Name || slug;
  const desc = store?.values?.Description;

  return (
    <main className="container">
      <header>
        <h1 className="store-hero">{name} Store</h1>
        {desc && <p className="store-sub">{desc}</p>}
      </header>

      <section className="grid">
        {(products || []).map((p: any, i: number) => {
          const v = p.values || {};
          const priceCents = Number(v.Price ?? 0);
          const price = (priceCents / 100).toFixed(2);

          return (
            <article key={p._id || i} className="store-card">
              <div className="img" />
              <h3>{v.Title || "(untitled)"}</h3>
              {v.Description && <p className="store-sub">{v.Description}</p>}
              <div className="row">
                <strong>${price}</strong>
                <div>
                  <button className="btn" onClick={() => { addItem(p); openCart(); }}>
                    Add to cart
                  </button>
                  <button className="btn" style={{ marginLeft: 8 }}
                          onClick={() => startBuyNow([{ id: p._id }])}>
                    Buy now
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </section>
    </main>
  );
}
