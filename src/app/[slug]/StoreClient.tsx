//C:\Users\tiffa\OneDrive\Desktop\suiteseat-web\src\app\[slug]\StoreClient.tsx

"use client";

import React, { useEffect, useMemo, useState } from "react";

// ✅ Providers you already use in templates
import { BasicFlowProvider } from "./StoreFlows/basicFlow";
import { CartProvider } from "./StoreCartContext";

import "./styles/Store/basic.css";

const API = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8400";

// ---- theme helpers ----
function parseSettings(raw: any) {
  if (!raw) return {};
  if (typeof raw === "object") return raw;
  try {
    return JSON.parse(String(raw));
  } catch {
    return {};
  }
}

// turn Settings JSON -> CSS variables
function settingsToVars(settings: any): React.CSSProperties {
  const s = settings || {};
  const c = s.colors || {};

  return {
["--bg" as any]: c.bg || "#ffffff",
["--surface" as any]: c.surface || "#f4f5f7",
["--text" as any]: c.text || "#111111",
["--muted" as any]: c.muted || "rgba(0,0,0,.65)",

    ["--brand" as any]: c.brand || "#FF6600",
    ["--accent" as any]: c.accent || "#efb37c",
    ["--radius" as any]: `${s.radius ?? 18}px`,
  };
}

async function fetchPublicProductsForStore(storeId: string) {
  if (!storeId) return [];
  const qs = new URLSearchParams({ dataType: "Product", limit: "400" });

  const res = await fetch(`${API}/public/records?${qs.toString()}`, {
    cache: "no-store",
    credentials: "include",
    headers: { Accept: "application/json" },
  });

  if (!res.ok) return [];
  const data = await res.json();
  const rows = Array.isArray(data) ? data : data.items || data.records || [];

  // match your product field: Store: { _id: storeId }
  return rows.filter((r: any) => {
    const v = r?.values || {};
    const ref = v.Store;
    const refId = typeof ref === "object" ? (ref?._id || ref?.id) : ref;
    return String(refId || "") === String(storeId);
  });
}

export default function StoreClient({
  store,
  theme,
  slug,
  Template,
}: {
  store: any;
  theme: any;
  slug: string;
  Template: React.ComponentType<any>;
}) {
  const storeId = String(store?._id || store?.id || "");
  const storeName = store?.values?.Name || slug;

  const templateKey =
    String(theme?.values?.["Template Key"] || "basic").toLowerCase().trim();

  const settingsRaw = theme?.values?.Settings;
  const settings = useMemo(() => parseSettings(settingsRaw), [settingsRaw]);
  const cssVars = useMemo(() => settingsToVars(settings), [settings]);

  const [products, setProducts] = useState<any[]>([]);

  useEffect(() => {
    fetchPublicProductsForStore(storeId)
      .then(setProducts)
      .catch(() => setProducts([]));
  }, [storeId]);

  return (
    <div style={cssVars} className={`storeThemeRoot theme-${templateKey}`}>
      <CartProvider>
        <BasicFlowProvider apiOrigin={API} store={store}>
          <Template store={store} products={products} slug={slug} />
        </BasicFlowProvider>
      </CartProvider>
    </div>
  );
}

