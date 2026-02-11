//\src\app\[slug]\StoreTemplates\ThemeLoader.tsx
"use client";

import dynamic from "next/dynamic";
import React from "react";
import StoreClient from "../StoreClient";

const TEMPLATE_MAP: Record<string, React.ComponentType<any>> = {
  basic: dynamic(() => import("./basic/Template").then((m) => m.default), { ssr: false }),
  iconic: dynamic(() => import("./iconic/Template").then((m) => m.default), { ssr: false }),
};

export default function ThemeLoader({ templateKey, store, theme, slug }: any) {
  const key = String(templateKey || "basic").trim().toLowerCase();
  const Template = TEMPLATE_MAP[key] || TEMPLATE_MAP.basic;

  return <StoreClient store={store} theme={theme} slug={slug} Template={Template} />;
}

