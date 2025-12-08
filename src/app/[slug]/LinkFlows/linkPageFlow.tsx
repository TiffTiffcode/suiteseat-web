// src/app/[slug]/LinkFlows/linkPageFlow.tsx
"use client";
const API =
  process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8400";


import React, { createContext, useContext, useEffect, useState } from "react";

export type LinkRecord = {
  _id: string;
  values: {
    Title?: string;
    URL?: string;
    Subtitle?: string;
    "Long Description"?: string;
    Price?: number | string;
    "Sale Price"?: number | string;
    "Thumbnail Image"?: string;
  };
};

type LinkPageRecord = {
  _id: string;
  values: {
    "Page Name"?: string;
    "Link Page Name"?: string;
    // slug field name in DB might vary, so we keep this loose
    Slug?: string;
    slug?: string;
    [key: string]: any;
  };
};

type LinkPageState = {
  loading: boolean;
  error: string | null;
  page: LinkPageRecord | null;
  links: LinkRecord[];
};

const LinkPageContext = createContext<LinkPageState | null>(null);

export function LinkPageProvider({
  slug,
  children,
}: {
  slug: string;
  children: React.ReactNode;
}) {
  const [state, setState] = useState<LinkPageState>({
    loading: true,
    error: null,
    page: null,
    links: [],
  });

  useEffect(() => {
    let cancelled = false;

    
  async function load() {
    setState((s) => ({ ...s, loading: true, error: null }));

    try {
      console.log("[linkPageFlow] loading slug:", slug);

      // 1️⃣ Get ALL Link Pages (whatever shape the API uses)
  const pageRes = await fetch(
  `${API}/public/records?dataType=Link%20Page&limit=500`,
  { cache: "no-store" }
);

      if (!pageRes.ok) throw new Error(`HTTP ${pageRes.status}`);

      const raw = await pageRes.json();
      console.log("[linkPageFlow] raw from API:", raw);

      const allPages: LinkPageRecord[] = Array.isArray(raw)
        ? raw
        : Array.isArray(raw?.records)
        ? raw.records
        : Array.isArray(raw?.items)
        ? raw.items
        : [];

      console.log(
        "[linkPageFlow] normalized pages:",
        allPages.map((p) => ({
          id: (p as any)._id,
          values: p.values,
        }))
      );

      const lowerSlug = slug.toLowerCase();

      console.log(
        "[linkPageFlow] searching for slug",
        lowerSlug,
        "among",
        allPages.map((p) => p.values)
      );

      // 2️⃣ Find the page whose *any* slug-like field matches
      const page =
        allPages.find((p) => {
          const v: any = p.values || {};
          // check obvious keys first
          const candidates: any[] = [
            v.Slug,
            v.slug,
            v["Slug"],
            v["slug"],
            v["Page Slug"],
            v["pageSlug"],
          ].filter(Boolean);

          // also scan ALL keys for something containing "slug"
          for (const [k, val] of Object.entries(v)) {
            if (k.toLowerCase().includes("slug")) {
              candidates.push(val);
            }
          }

          return candidates.some((val) => {
            if (!val) return false;
            return String(val).trim().toLowerCase() === lowerSlug;
          });
        }) || undefined;

      if (!page) throw new Error("Link Page not found.");

      // 3️⃣ Load links referenced in "Link(s)"
  // 3️⃣ Load links referenced in "Link(s)"
const refs = page.values["Link(s)"] || [];
const ids: string[] = refs.map((r: any) => String(r?._id || "")).filter(Boolean);

let links: LinkRecord[] = [];
if (ids.length) {
  // Get all Link records, then filter on the client
  const linkRes = await fetch(
    `${API}/public/records?dataType=Link&limit=500`,
    { cache: "no-store" }
  );
  if (!linkRes.ok) throw new Error(`HTTP ${linkRes.status}`);

  const rawLinks = await linkRes.json();

  const allLinks: LinkRecord[] = Array.isArray(rawLinks)
    ? rawLinks
    : Array.isArray(rawLinks?.records)
    ? rawLinks.records
    : Array.isArray(rawLinks?.items)
    ? rawLinks.items
    : [];

  // ✅ only keep links whose _id is in this page's "Link(s)" refs
  links = allLinks.filter((l: any) => ids.includes(String(l._id)));
}


      if (cancelled) return;

      setState({
        loading: false,
        error: null,
        page,
        links,
      });
    } catch (err: any) {
      if (cancelled) return;
      console.error("[linkPageFlow] load error:", err);
      setState({
        loading: false,
        error: err?.message || "Failed to load link page",
        page: null,
        links: [],
      });
    }
  }

  load();
  return () => {
    cancelled = true;
  };
}, [slug]);

  return (
    <LinkPageContext.Provider value={state}>
      {children}
    </LinkPageContext.Provider>
  );
}

export function useLinkPageFlow() {
  const ctx = useContext(LinkPageContext);
  if (!ctx) {
    throw new Error("useLinkPageFlow must be used inside LinkPageProvider");
  }
  return ctx;
}
