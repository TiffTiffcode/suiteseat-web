// src/app/[slug]/SuiteClient.tsx
"use client";

import { useEffect, useState } from "react";
import "./styles/SuitePage/basic.css";
import BasicSuiteTemplate, {
  Suite as TemplateSuite,
} from "./SuiteTemplates/basic/Template";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8400";
const ASSET_BASE = process.env.NEXT_PUBLIC_ASSET_BASE || API_BASE;

function extractSuiteDetails(suite: any) {
  const v = suite?.values || suite || {};

  return {
    // ✅ THIS is your Quill field
    description: v["Details"] || v.details || v.Description || "",

    // optional fields if you add them later
    sqft: v["Sq Ft"] || v["Square Feet"] || v.sqft || "",
    deposit: v["Deposit"] || v.deposit || "",
    amenities: v["Amenities"] || v.amenities || "",
    availabilityNotes: v["Availability Notes"] || v["Notes"] || v.notes || "",
  };
}

function resolveAsset(raw?: string | null) {
  if (!raw) return null;
  const s = String(raw).trim();
  if (!s) return null;

  // already absolute (Cloudinary, S3, etc)
  if (/^https?:\/\//i.test(s)) return s;

  // relative path from your API server
  if (s.startsWith("/")) return `${ASSET_BASE}${s}`;

  // plain filename case
  return `${ASSET_BASE}/${s}`;
}

// ✅ Reuse the Suite type from the template so both files agree
type Suite = TemplateSuite;

export default function SuiteClient({ biz }: { biz: any }) {
  const [suites, setSuites] = useState<Suite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadSuites() {
      const locationId = biz?._id || biz?.id;
      if (!locationId) {
        setSuites([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams();
        params.set("dataType", "Suite");
        params.set("Location", String(locationId));
        params.set("limit", "500");

        const res = await fetch(
          `${API_BASE}/public/records?${params.toString()}`,
          { cache: "no-store" }
        );

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const raw = await res.json();
        const rows = Array.isArray(raw)
          ? raw
          : Array.isArray(raw.records)
          ? raw.records
          : Array.isArray(raw.items)
          ? raw.items
          : [];

        const locIdStr = String(locationId);

        const mapped: Suite[] = rows
          .map((row: any) => {
            const v = row.values || row;

            // 🔹 read Location reference from the Suite record
            const locRef =
              v["Location"] ||
              v.Location ||
              v["Suite Location"] ||
              null;

            let locFromSuite: string | null = null;
            if (typeof locRef === "string") {
              locFromSuite = locRef;
            } else if (locRef && typeof locRef === "object") {
              locFromSuite = String(locRef._id || locRef.id || "");
            }

            // ❌ skip if suite doesn't belong to this location
            if (!locFromSuite || locFromSuite !== locIdStr) {
              return null;
            }

            // ✅ Name
            const name =
              v["Suite Name"] ||
              v["Suite Number/Name"] ||
              v.Name ||
              "Suite";

            // ✅ Available date
            const availableDateRaw =
              v["Date Available"] ||
              v.DateAvailable ||
              v["Available Date"] ||
              null;

            const availableDate =
              typeof availableDateRaw === "string"
                ? availableDateRaw
                : availableDateRaw
                ? String(availableDateRaw)
                : null;

         // ✅ Main image (try many possible field names)
const imageRaw =
  v["Default Photo"] ||
  v["Default Photo URL"] ||
  v["Default Photo Url"] ||
  v["Default Image"] ||
  v["Suite Default Image"] ||
  v["Suite Photo"] ||
  v["Photo URL"] ||
  v["Photo Url"] ||
  v["Photo"] ||
  v.photoUrl ||
  v.img || // ✅ from your “merged suite” shape
  null;

// ✅ Gallery (try many)
const galleryRaw =
  v["Suite Gallery"] ||
  v["Gallery Images"] ||
  v["Gallery"] ||
  v.gallery ||
  [];

const gallery: string[] = Array.isArray(galleryRaw)
  ? galleryRaw
      .filter(Boolean)
      .map((x) => resolveAsset(String(x)))
      .filter(Boolean) as string[]
  : [];

// ✅ final main image = imageRaw OR gallery[0]
const imageUrl =
  resolveAsset(imageRaw ? String(imageRaw) : null) ||
  (gallery.length ? gallery[0] : null);
            // ✅ Rent amount
            let rentAmount: number | null = null;
            const rentRaw = v["Suite Rent"] ?? v["Rent Amount"];
            if (typeof rentRaw === "number") {
              rentAmount = rentRaw;
            } else if (
              typeof rentRaw === "string" &&
              rentRaw.trim() !== ""
            ) {
              const num = Number(rentRaw);
              if (!Number.isNaN(num)) rentAmount = num;
            }

            // ✅ Rent frequency + rate text
            const rentFrequency: string | null =
              v["Rent Frequency"] || null;

            const rateText: string =
              v["Rate Text"] || "";

          
            // ✅ Application template JSON (if stored on Suite)
            const applicationTemplate: string | null =
              v["Application Template"] ||
              v.applicationTemplate ||
              null;

            // ✅ File URL (PDF/image)
            const applicationFileUrl: string | null =
              v["Application File"] ||
              v["Application URL"] ||
              v.applicationFileUrl ||
              null;

            // ⭐ NEW – radio “Use this application on my site”
            const modeRaw =
              v["Use this application on my site"] ||
              v["Application Mode"] ||
              "";

            let applicationMode: "template" | "file" | null = null;

            if (
              modeRaw === "Online application form (template)" ||
              modeRaw === "template"
            ) {
              applicationMode = "template";
            } else if (
              modeRaw === "Downloadable file (PDF / image)" ||
              modeRaw === "file"
            ) {
              applicationMode = "file";
            }

            const suite: Suite = {
              id: row._id || row.id || "",
              name,
              availableDate: availableDate,
              imageUrl: imageUrl || null,
              rentAmount: rentAmount,
              rentFrequency,
              rateText,
              gallery,
              applicationTemplate,
              applicationMode,
              applicationFileUrl,
            };

            return suite;
          })
          .filter((s: Suite | null): s is Suite => !!s);

        if (cancelled) return;

        console.log("[SuiteClient] mapped suites:", mapped);
        setSuites(mapped);
        setLoading(false);
      } catch (err: any) {
        if (cancelled) return;
        console.error("[SuiteClient] load suites error:", err);
        setError(err.message || "Failed to load suites");
        setLoading(false);
      }
    }

    loadSuites();
    return () => {
      cancelled = true;
    };
  }, [biz?._id, biz?.id]);

  return (
    <BasicSuiteTemplate
      business={biz}
      suites={suites}
      loading={loading}
      error={error}
    />
  );
}
