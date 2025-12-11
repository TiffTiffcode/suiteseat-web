// src/app/[slug]/LinkFlows/linkPageFlow.tsx
"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

const API =
  process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8400";

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
  slug: string | undefined;
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
      console.log("[linkPageFlow] loading slug:", slug);

      if (!slug) {
        console.warn("[linkPageFlow] no slug provided – skipping load");
        setState({
          loading: false,
          error: "No slug provided for link page.",
          page: null,
          links: [],
        });
        return;
      }

      setState((s) => ({ ...s, loading: true, error: null }));

      try {
        // 1️⃣ Get ALL Link Pages
      const pageRes = await fetch(
  `${API}/public/records?dataType=Link%20Page&limit=500`,
  {
    cache: "no-store",
    next: { revalidate: 0 },
  }
);


        if (!pageRes.ok) throw new Error(`HTTP ${pageRes.status}`);

        const raw = await pageRes.json();
        console.log("[linkPageFlow] raw from API:", raw);

        const allPages: LinkPageRecord[] = Array.isArray(raw)
          ? raw
          : Array.isArray((raw as any)?.records)
          ? (raw as any).records
          : Array.isArray((raw as any)?.items)
          ? (raw as any).items
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

        const page =
          allPages.find((p) => {
            const v: any = p.values || {};
            const candidates: any[] = [
              v.Slug,
              v.slug,
              v["Slug"],
              v["slug"],
              v["Page Slug"],
              v["pageSlug"],
            ].filter(Boolean);

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

        if (!page) {
          throw new Error("Link Page not found.");
        }

        // 3️⃣ Load links referenced in "Link(s)"
        const refs = (page.values as any)["Link(s)"] || [];
        const ids: string[] = refs
          .map((r: any) => String(r?._id || ""))
          .filter(Boolean);

        let links: LinkRecord[] = [];
        if (ids.length) {
       const linkRes = await fetch(
  `${API}/public/records?dataType=Link&limit=500`,
  {
    cache: "no-store",
    next: { revalidate: 0 },
  }
);

          if (!linkRes.ok) throw new Error(`HTTP ${linkRes.status}`);

          const rawLinks = await linkRes.json();

          const allLinks: LinkRecord[] = Array.isArray(rawLinks)
            ? rawLinks
            : Array.isArray((rawLinks as any)?.records)
            ? (rawLinks as any).records
            : Array.isArray((rawLinks as any)?.items)
            ? (rawLinks as any).items
            : [];

          links = allLinks.filter((l: any) =>
            ids.includes(String(l._id))
          );
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
