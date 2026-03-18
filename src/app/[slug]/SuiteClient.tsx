"use client";

import { useEffect, useState } from "react";
import "./styles/SuitePage/basic.css";

import BasicSuiteTemplate, {
  Suite as TemplateSuite,
} from "./SuiteTemplates/basic/Template";

// future templates
import Template1 from "./SuiteTemplates/template1/Template";
import Template2 from "./SuiteTemplates/template2/Template";
import CustomTemplate from "./SuiteTemplates/custom/Template";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8400";
const ASSET_BASE = process.env.NEXT_PUBLIC_ASSET_BASE || API_BASE;

function extractSuiteDetails(suite: any) {
  const v = suite?.values || suite || {};

  return {
    description: v["Details"] || v.details || v.Description || "",
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

  if (/^https?:\/\//i.test(s)) return s;
  if (s.startsWith("/")) return `${ASSET_BASE}${s}`;
  return `${ASSET_BASE}/${s}`;
}

type Suite = TemplateSuite;

export default function SuiteClient({ biz }: { biz: any }) {
  const [suites, setSuites] = useState<Suite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

const v = biz?.values || {};
const pageType = String(v["Suite Template"] || "default").toLowerCase();

console.log("[SuiteClient] raw Page Type:", v["Page Type"]);
console.log("[SuiteClient] raw Suite Template:", v["Suite Template"]);
console.log("[SuiteClient] using template:", pageType);

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
            const rowValues = row.values || row;

            const locRef =
              rowValues["Location"] ||
              rowValues.Location ||
              rowValues["Suite Location"] ||
              null;

            let locFromSuite: string | null = null;
            if (typeof locRef === "string") {
              locFromSuite = locRef;
            } else if (locRef && typeof locRef === "object") {
              locFromSuite = String(locRef._id || locRef.id || "");
            }

            if (!locFromSuite || locFromSuite !== locIdStr) {
              return null;
            }

            const name =
              rowValues["Suite Name"] ||
              rowValues["Suite Number/Name"] ||
              rowValues.Name ||
              "Suite";

            const availableDateRaw =
              rowValues["Date Available"] ||
              rowValues.DateAvailable ||
              rowValues["Available Date"] ||
              null;

            const availableDate =
              typeof availableDateRaw === "string"
                ? availableDateRaw
                : availableDateRaw
                ? String(availableDateRaw)
                : null;

            const imageRaw =
              rowValues["Default Photo"] ||
              rowValues["Default Photo URL"] ||
              rowValues["Default Photo Url"] ||
              rowValues["Default Image"] ||
              rowValues["Suite Default Image"] ||
              rowValues["Suite Photo"] ||
              rowValues["Photo URL"] ||
              rowValues["Photo Url"] ||
              rowValues["Photo"] ||
              rowValues.photoUrl ||
              rowValues.img ||
              null;

            const galleryRaw =
              rowValues["Suite Gallery"] ||
              rowValues["Gallery Images"] ||
              rowValues["Gallery"] ||
              rowValues.gallery ||
              [];

            const gallery: string[] = Array.isArray(galleryRaw)
              ? galleryRaw
                  .filter(Boolean)
                  .map((x) => resolveAsset(String(x)))
                  .filter(Boolean) as string[]
              : [];

            const imageUrl =
              resolveAsset(imageRaw ? String(imageRaw) : null) ||
              (gallery.length ? gallery[0] : null);

            let rentAmount: number | null = null;
            const rentRaw = rowValues["Suite Rent"] ?? rowValues["Rent Amount"];
            if (typeof rentRaw === "number") {
              rentAmount = rentRaw;
            } else if (
              typeof rentRaw === "string" &&
              rentRaw.trim() !== ""
            ) {
              const num = Number(rentRaw);
              if (!Number.isNaN(num)) rentAmount = num;
            }

            const rentFrequency: string | null =
              rowValues["Rent Frequency"] || null;

            const rateText: string = rowValues["Rate Text"] || "";

            const applicationTemplate: string | null =
              rowValues["Application Template"] ||
              rowValues.applicationTemplate ||
              null;

            const applicationFileUrl: string | null =
              rowValues["Application File"] ||
              rowValues["Application URL"] ||
              rowValues.applicationFileUrl ||
              null;

            const modeRaw =
              rowValues["Use this application on my site"] ||
              rowValues["Application Mode"] ||
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
              availableDate,
              imageUrl: imageUrl || null,
              rentAmount,
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

        console.log("[SuiteClient] pageType:", pageType);
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
  }, [biz?._id, biz?.id, pageType]);

  function renderTemplate() {
    switch (pageType) {
      case "template1":
        return (
          <Template1
            business={biz}
            suites={suites}
            loading={loading}
            error={error}
          />
        );

      case "template2":
        return (
          <Template2
            business={biz}
            suites={suites}
            loading={loading}
            error={error}
          />
        );

case "custom":
  return (
    <CustomTemplate
      business={biz}
      suites={suites}
      loading={loading}
      error={error}
    />
  );

      case "default":
      default:
        return (
          <BasicSuiteTemplate
            business={biz}
            suites={suites}
            loading={loading}
            error={error}
          />
        );
    }
  }

  return renderTemplate();
}