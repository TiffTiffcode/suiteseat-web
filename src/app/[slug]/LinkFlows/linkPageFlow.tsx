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
  slug?: string;
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
      // 🔒 normalize slug safely so we never crash on undefined
      const rawSlug = (slug ?? "").toString().trim();

      console.log("[linkPageFlow] loading slug:", rawSlug || slug);

      if (!rawSlug) {
        console.warn("[linkPageFlow] no slug provided – skipping load");
        if (!cancelled) {
          setState({
            loading: false,
            error: "No slug provided for link page.",
            page: null,
            links: [],
          });
        }
        return;
      }

      const lowerSlug = rawSlug.toLowerCase();

      setState((s) => ({ ...s, loading: true, error: null }));

      try {
        // 1️⃣ Get ALL Link Pages
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
          : Array.isArray(raw?.data)
          ? raw.data
          : [];

        console.log(
          "[linkPageFlow] normalized pages:",
          allPages.map((p) => ({
            id: (p as any)._id,
            values: p.values,
          }))
        );

        console.log(
          "[linkPageFlow] searching for slug",
          lowerSlug,
          "among",
          allPages.map((p) => p.values)
        );

        // 2️⃣ Find the page whose any slug-like field matches
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

        if (!page) {
          throw new Error("Link Page not found.");
        }

        // 3️⃣ Load links referenced in "Link(s)"
        const refs = (page.values as any)["Link(s)"] || [];
        const ids: string[] = Array.isArray(refs)
          ? refs
              .map((r: any) => String(r?._id || "").trim())
              .filter(Boolean)
          : [];

        let links: LinkRecord[] = [];

        if (ids.length) {
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
            : Array.isArray(rawLinks?.data)
            ? rawLinks.data
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
