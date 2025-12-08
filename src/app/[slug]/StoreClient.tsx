//C:\Users\tiffa\OneDrive\Desktop\suiteseat-web\src\app\[slug]\StoreClient.tsx

"use client";
import { useMemo } from "react";

// ✅ correct relative paths
import BasicTemplate from "./StoreTemplates/basic/Template";
import { BasicFlowProvider } from "./StoreFlows/basicFlow";
import { CartProvider } from "./StoreCartContext";

export default function StoreClient({ store, products, slug }: any) {
  const templateKey =
    store?.values?.templateKey || "basic"; // default for now

  // In the future: template registry by key
  const Template = useMemo(() => {
    switch (templateKey) {
      case "basic":
      default:
        return BasicTemplate;
    }
  }, [templateKey]);

  return (
    <CartProvider>
      <BasicFlowProvider apiOrigin={process.env.NEXT_PUBLIC_API_ORIGIN || "http://localhost:8400"}
                         store={{ slug, id: store?._id, values: store?.values }}>
        <Template store={store} products={products} slug={slug} />
      </BasicFlowProvider>
    </CartProvider>
  );
}
