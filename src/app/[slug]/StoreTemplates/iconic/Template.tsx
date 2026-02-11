
//C:\Users\tiffa\OneDrive\Desktop\suiteseat-web\src\app\[slug]\StoreTemplates\iconic\Template.tsx
"use client";

export default function IconicTemplate({ store, products, slug }: any) {
  const name = store?.values?.Name || slug;

  return (
    <main style={{ padding: 24 }}>
      <h1>{name} (Iconic Theme)</h1>

      <div style={{ marginTop: 16 }}>
        {(products || []).map((p: any) => {
          const v = p.values || {};
          return (
            <div key={p._id} style={{ padding: 12, border: "1px solid #333", marginBottom: 10 }}>
              <strong>{v.Title || "(untitled)"}</strong>
            </div>
          );
        })}
      </div>
    </main>
  );
}
