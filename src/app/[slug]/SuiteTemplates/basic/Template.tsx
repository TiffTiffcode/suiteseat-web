// src/app/[slug]/SuiteTemplates/basic/Template.tsx
"use client";

import { useState, useEffect } from "react";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8400";

// 🔹 Shared Suite shape used by this template
export type Suite = {
  id: string;
  name: string;
  availableDate: string | null;
  imageUrl: string | null;
  rentAmount: number | null;
  rentFrequency: string | null;
  rateText: string;
  gallery: string[];

  // 🔹 NEW fields for applications
  applicationTemplate?: string | null;
  applicationMode?: "template" | "file" | null;
  applicationFileUrl?: string | null;

  // 🔹 NEW: style fields coming from normalizeSuite
  bgColor?: string | null;
  textColor?: string | null;
  accentColor?: string | null;
  buttonColor?: string | null;
};

type Professional = {
  id: string;
  name: string;
  imageUrl?: string | null;
  slug?: string | null;
};

type SuiteTemplateProps = {
  business: any; // booking JSON shape
  suites: Suite[];
  loading: boolean;
  error: string | null;
};

type AppQuestion = {
  id: string;
  label: string;
  type: "text" | "textarea" | "date" | "signature";
  placeholder?: string;
};

type AppSection = {
  id: string;
  title: string;
  questions: AppQuestion[];
};

function fmtDate(d?: string | null) {
  if (!d) return "Available date TBA";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "Available date TBA";
  return dt.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// ================================
// Template JSON → Questions helper
// ================================
function rowsToQuestions(rows: any[], prefix: string): AppQuestion[] {
  if (!Array.isArray(rows)) return [];

  return rows.map((row, idx) => {
    const key =
      row.key ||
      row.id ||
      `${prefix}_${idx + 1}`;

    const label = (row.label || "").trim() || "Question";

    // Very simple mapping from inputType text → AppQuestion.type
    const inputType = (row.inputType || "").toLowerCase();
    let type: AppQuestion["type"] = "text";
    if (inputType.includes("date")) {
      type = "date";
    } else if (inputType.includes("textarea")) {
      type = "textarea";
    } else if (inputType.includes("sign")) {
      type = "signature";
    }

    return {
      id: key,
      label,
      type,
      placeholder: row.placeholder || "",
    };
  });
}

// Convert whatever JSON we have into AppSection[]
function normalizeTemplateToSections(raw: any): AppSection[] {
  if (!raw) return [];

  // If it's already an array, try to coerce each section
  if (Array.isArray(raw)) {
    return raw.map((sec: any, secIdx: number): AppSection => {
      const id = sec.id || `section_${secIdx + 1}`;
      const title = sec.title || `Section ${secIdx + 1}`;
      const questions = rowsToQuestions(
        sec.questions || sec.rows || [],
        id
      );
      return { id, title, questions };
    });
  }

  // New builder shape: { sections: { applicant, experience, custom, applicantTitle, experienceTitle } }
  if (raw.sections) {
    const out: AppSection[] = [];

    const applicantRows = raw.sections.applicant || [];
    if (applicantRows.length) {
      out.push({
        id: "applicant",
        title: raw.sections.applicantTitle?.label || "Applicant",
        questions: rowsToQuestions(applicantRows, "applicant"),
      });
    }

    const experienceRows = raw.sections.experience || [];
    if (experienceRows.length) {
      out.push({
        id: "experience",
        title:
          raw.sections.experienceTitle?.label ||
          "Professional Experience",
        questions: rowsToQuestions(experienceRows, "experience"),
      });
    }

    const customSections = Array.isArray(raw.sections.custom)
      ? raw.sections.custom
      : [];

    customSections.forEach((sec: any, idx: number) => {
      const sectionId =
        sec.sectionKey || sec.titleKey || `custom_${idx + 1}`;
      out.push({
        id: sectionId,
        title: sec.title || "New section",
        questions: rowsToQuestions(sec.rows || [], sectionId),
      });
    });

    return out;
  }

  // Fallback – unknown shape
  return [];
}

// 🎨 1) your current default colors from the design you like *now*
const DEFAULT_SUITE_COLORS = {
  pageBg: "#ffffff",      // whatever your page background currently is
  text:   "#111827",      // your normal text color
  accent: "#efb37c",      // your brand accent
  buttonBg: "#111827",    // existing button bg
  buttonText: "#ffffff",  // existing button text
};

export default function BasicSuiteTemplate({
  business,
  suites,
  loading,
  error,
}: SuiteTemplateProps) {
  const v = business?.values ?? {};

    // 🎨 Base colors from the LOCATION record (business.values)
  const basePageBg =
    v["Background Color"] ||
    v.bgColor ||
    DEFAULT_SUITE_COLORS.pageBg;

  const baseTextColor =
    v["Text Color"] ||
    v.textColor ||
    DEFAULT_SUITE_COLORS.text;

  const bgImageUrl =
    v["Background Image"] ||
    v.bgImageUrl ||
    "";

  // 🔹 Who owns this location (creator of the suites)
  const rawOwnerId =
    v["ownerUserId"] ||
    v["Owner User Id"] ||
    v["OwnerUserId"] ||
    null;

  const ownerId = rawOwnerId ? String(rawOwnerId) : null;

  const title =
    v["Location Name"] ||
    v["Suite Location Name"] ||
    v["Name"] ||
    business?.name ||
    business?.slug ||
    "Suite Location";

  const heroImg =
    v["Location Photo"] ||
    v["Default Image"] ||
    business?.heroUrl ||
    "";

  // 👇 NEW: About text for this location
  const aboutText =
    v["About"] ||
    v["Location About"] ||
    v["Details"] ||
    "";
const hasAbout =
  typeof aboutText === "string" && aboutText.trim() !== "";

  // 👇 NEW: Location gallery images
  const locationGallery: string[] = Array.isArray(v["Location Gallery"])
    ? v["Location Gallery"].filter(Boolean)
    : [];

  // 👇 Who owns this location? (used to find other locations)
  const [otherLocations, setOtherLocations] = useState<any[]>([]);

  // 🆕 professionals (Suities in this location)
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [prosLoading, setProsLoading] = useState(false);
  const [prosError, setProsError] = useState<string | null>(null);

  // ---------- Suite application template state ----------
  const [appSections, setAppSections] = useState<AppSection[]>([]);
  const [appTemplateLoading, setAppTemplateLoading] = useState(false);
  const [appTemplateError, setAppTemplateError] = useState<string | null>(null);

  // answers keyed by question id
  const [appAnswers, setAppAnswers] = useState<Record<string, string>>({});
  const [appModalOpen, setAppModalOpen] = useState(false);
  const [appSubmitting, setAppSubmitting] = useState(false);
  const [appSubmitError, setAppSubmitError] = useState<string | null>(null);
  const [appSubmitDone, setAppSubmitDone] = useState(false);

  // 🔹 New: basic applicant info fields
  const [applicantName, setApplicantName] = useState("");
  const [applicantEmail, setApplicantEmail] = useState("");

  const [selectedSuite, setSelectedSuite] = useState<Suite | null>(null);

    // ✅ NEW: success popup after sending
  const [successModalOpen, setSuccessModalOpen] = useState(false);

  // 🎨 Final colors = location base → optional suite override
  const pageBgColor =
    selectedSuite?.bgColor || basePageBg;

  const textColor =
    selectedSuite?.textColor || baseTextColor;

  const accentColor =
    selectedSuite?.accentColor || DEFAULT_SUITE_COLORS.accent;

  const buttonBgColor =
    selectedSuite?.buttonColor || accentColor;

  const buttonTextColor =
    DEFAULT_SUITE_COLORS.buttonText;

  console.log("[suite-template] colors", {
    pageBgColor,
    textColor,
    accentColor,
    buttonBgColor,
    bgImageUrl,
  });

 
  // ✅ Load Suite Application Template when a suite is selected
  useEffect(() => {
    console.log("[appTemplate] selectedSuite changed:", selectedSuite);

    if (!selectedSuite) {
      setAppSections([]);
      setAppTemplateError(null);
      setAppTemplateLoading(false);
      return;
    }

    // 🔍 If this suite is NOT set to use the template, skip loading
    if (
      selectedSuite.applicationMode &&
      selectedSuite.applicationMode !== "template"
    ) {
      console.log(
        "[appTemplate] suite is not in 'template' mode, skipping template load. mode =",
        selectedSuite.applicationMode
      );
      setAppSections([]);
      setAppTemplateError(null);
      setAppTemplateLoading(false);
      return;
    }

    let cancelled = false;

    async function loadTemplate() {
      setAppTemplateLoading(true);
      setAppTemplateError(null);
      setAppSections([]);
      setAppAnswers({});
      setAppSubmitDone(false);
      setApplicantName("");
      setApplicantEmail("");

      try {
        const suiteId = selectedSuite?.id;
        if (!suiteId) {
          console.warn("[appTemplate] no suiteId, skipping template fetch");
          setAppTemplateLoading(false);
          return;
        }

        // 1️⃣ First, try template stored directly on the Suite record
        const suiteAny: any = selectedSuite;
        const suiteTemplateStr =
          suiteAny.applicationTemplate ||
          suiteAny["Application Template"] ||
          suiteAny.values?.["Application Template"] ||
          "";

        if (suiteTemplateStr) {
          console.log("[appTemplate] using template from Suite.Application Template");

          let parsedJson: any;
          try {
            parsedJson = JSON.parse(suiteTemplateStr);
          } catch (e) {
            console.warn(
              "[appTemplate] bad JSON in Suite.Application Template, falling back to Application",
              e
            );
            parsedJson = null;
          }

          if (parsedJson) {
            const sections = normalizeTemplateToSections(parsedJson);
            if (!cancelled) {
              setAppSections(sections);
              setAppTemplateLoading(false);
            }
            return; // ✅ done, no need to hit /public/records
          }
        }

        // 2️⃣ Fallback: load a shared template from Application DataType
        const params = new URLSearchParams();
        params.set("dataType", "Application");
        params.set("limit", "1");

        console.log(
          "[appTemplate] fetching template with params:",
          params.toString()
        );

        const res = await fetch(
          `${API_BASE}/public/records?${params.toString()}`,
          { cache: "no-store" }
        );

        console.log("[appTemplate] fetch status:", res.status);

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }

        const raw = await res.json();
        console.log("[appTemplate] raw response:", raw);

        const rows = Array.isArray(raw)
          ? raw
          : Array.isArray(raw.records)
          ? raw.records
          : Array.isArray(raw.items)
          ? raw.items
          : [];

        console.log("[appTemplate] rows:", rows);

        const first = rows[0];
        console.log("[appTemplate] first row:", first);

        if (!first) {
          if (!cancelled) {
            setAppSections([]);
            setAppTemplateLoading(false);
          }
          return;
        }

        const vals = first.values || first;
        console.log("[appTemplate] first.values:", vals);

        const jsonString =
          vals["Template Json"] ||
          vals["Sections Json"] ||
          vals["Application Json"] ||
          "";

        console.log("[appTemplate] template jsonString:", jsonString);

        if (!jsonString) {
          if (!cancelled) {
            setAppSections([]);
            setAppTemplateLoading(false);
          }
          return;
        }

        let parsedJson: any;
        try {
          parsedJson = JSON.parse(jsonString);
        } catch (e) {
          console.error("[suite] bad template JSON in Application record", e);
          throw new Error("Template JSON invalid");
        }

        const sections = normalizeTemplateToSections(parsedJson);
        console.log("[appTemplate] parsed sections:", sections);

        if (!cancelled) {
          setAppSections(sections || []);
          setAppTemplateLoading(false);
        }
      } catch (err: any) {
        console.error("[suite] loadTemplate error", err);
        if (!cancelled) {
          setAppTemplateError(err.message || "Failed to load application");
          setAppTemplateLoading(false);
          setAppSections([]);
        }
      }
    }

    loadTemplate();
    return () => {
      cancelled = true;
    };
  }, [selectedSuite?.id, selectedSuite?.applicationMode]);


  useEffect(() => {
    const vals = business?.values || v || {};

    // 🔹 ownerUserId is how you filter locations in suite-settings.js
    const ownerId =
      vals["ownerUserId"] ||
      vals["Owner User Id"] ||
      vals["OwnerUserId"] ||
      null;

    if (!ownerId) {
      console.warn("[suite] no ownerUserId on this location; no other locations to show.");
      setOtherLocations([]);
      return;
    }

    let cancelled = false;

    async function loadOtherLocations() {
      try {
        const params = new URLSearchParams();
        // ✅ Your locations live in the "Suite" DataType
        params.set("dataType", "Suite");
        params.set("ownerUserId", String(ownerId));
        params.set("limit", "200");

        const res = await fetch(
          `${API_BASE}/public/records?${params.toString()}`,
          { cache: "no-store" }
        );

        if (!res.ok) {
          console.warn("[suite] other locations fetch failed", res.status);
          if (!cancelled) setOtherLocations([]);
          return;
        }

        const raw = await res.json();
        let rows = Array.isArray(raw)
          ? raw
          : Array.isArray(raw.records)
          ? raw.records
          : Array.isArray(raw.items)
          ? raw.items
          : [];

        console.log("[suite] otherLocations raw rows:", rows);

        // 🔹 keep ONLY top-level locations (same logic as loadLocations)
        const topLevelLocations = rows.filter((row: any) => {
          const rv = row.values || row;

          // if it has a Location reference, it's a *suite*, not a top-level location
          const locRef =
            rv.Location ||
            rv["Location"] ||
            rv.location ||
            null;

          if (locRef) return false;

          const hasLocationName =
            rv["Location Name"] ||
            rv.LocationName ||
            "";
          return !!hasLocationName;
        });

        // 🔹 filter out THIS location by slug so we only show "other" ones
        const currentSlug =
          v["Slug"] || v.slug || business?.slug || business?.values?.Slug;

        const filtered = currentSlug
          ? topLevelLocations.filter((loc: any) => {
              const lv = loc.values || loc;
              const slug =
                lv["Slug"] || lv.slug || loc.slug || "";
              return slug !== currentSlug;
            })
          : topLevelLocations;

        if (!cancelled) {
          setOtherLocations(filtered);
        }
      } catch (err) {
        console.error("[suite] loadOtherLocations error", err);
        if (!cancelled) setOtherLocations([]);
      }
    }

    loadOtherLocations();

    return () => {
      cancelled = true;
    };
  }, [business?._id, business?.slug, v]);

  // 🆕 Load “Suities” (professionals) for this location
  useEffect(() => {
    const vals = business?.values || v || {};

    // the location id for this page
    const locationId =
      business?._id ||
      business?.id ||
      vals["_id"] ||
      vals["Location Id"] ||
      null;

    if (!locationId) {
      console.warn("[suite] no locationId for professionals");
      setProfessionals([]);
      return;
    }

    let cancelled = false;

    async function loadProfessionals() {
      setProsLoading(true);
      setProsError(null);

      try {
        const params = new URLSearchParams();
        params.set("dataType", "Suitie");         // 🔹 your Suitie DataType
        params.set("Location", String(locationId)); // 🔹 match admin: ?Location=<loc.id>
        params.set("limit", "200");

        const res = await fetch(
          `${API_BASE}/public/records?${params.toString()}`,
          { cache: "no-store" }
        );

        if (!res.ok) {
          const msg = `HTTP ${res.status}`;
          console.warn("[suite] professionals fetch failed", msg);
          if (!cancelled) {
            setProsError(msg);
            setProfessionals([]);
            setProsLoading(false);
          }
          return;
        }

        const raw = await res.json();
        const rows = Array.isArray(raw)
          ? raw
          : Array.isArray(raw.records)
          ? raw.records
          : Array.isArray(raw.items)
          ? raw.items
          : [];

        const mapped: Professional[] = rows.map((row: any) => {
          const rv = row.values || row;

          const first =
            rv["First Name"] ||
            rv["FirstName"] ||
            rv.firstName ||
            "";
          const last =
            rv["Last Name"] ||
            rv["LastName"] ||
            rv.lastName ||
            "";
          const fullName =
            rv["Suitie Name"] ||
            rv["Full Name"] ||
            rv.fullName ||
            [first, last].filter(Boolean).join(" ") ||
            rv.Name ||
            "Professional";

       const imageUrl =
  rv["Suitie Photo"] ||           // 🔹 match your dashboard field
  rv["Profile Photo"] ||
  rv["Profile Image"] ||
  rv["Default Image"] ||
  rv["Photo URL"] ||
  rv["Photo"] ||
  rv.photoUrl ||
  null;


          const slug =
            rv["Slug"] ||
            rv.slug ||
            row.slug ||
            null;

          return {
            id: row._id || row.id || "",
            name: fullName,
            imageUrl,
            slug,
          };
        });

        if (!cancelled) {
          setProfessionals(mapped);
          setProsLoading(false);
        }
      } catch (err: any) {
        console.error("[suite] loadProfessionals error", err);
        if (!cancelled) {
          setProsError(err.message || "Failed to load professionals");
          setProfessionals([]);
          setProsLoading(false);
        }
      }
    }

    loadProfessionals();

    return () => {
      cancelled = true;
    };
  }, [business?._id, business?.id, v]);






  const hasGallery = locationGallery.length > 0;

  const visibleSuites = (suites || []).filter((s) => {
    const name = (s.name || "").trim();
    const hasCustomName =
      name !== "" && name.toLowerCase() !== "suite";

    const hasImage =
      !!s.imageUrl && s.imageUrl.trim() !== "";

    const hasDate =
      !!s.availableDate && String(s.availableDate).trim() !== "";

    return hasCustomName || hasImage || hasDate;
  });

  const [menuOpen, setMenuOpen] = useState(false);
  const menuSuites = visibleSuites.slice(0, 3);
  const [currentImgIndex, setCurrentImgIndex] = useState(0);

  const handleScrollTo = (targetId: string) => {
    if (typeof document === "undefined") return;
    const el = document.getElementById(targetId);
    if (el) {
      el.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  };

  const handleMenuClick = (targetId?: string) => {
    setMenuOpen(false);
    if (!targetId) return;
    setTimeout(() => {
      handleScrollTo(targetId);
    }, 0);
  };

  const galleryImages =
    selectedSuite && selectedSuite.gallery && selectedSuite.gallery.length > 0
      ? selectedSuite.gallery
      : selectedSuite?.imageUrl
      ? [selectedSuite.imageUrl]
      : [];

  function prevImage() {
    if (!galleryImages.length) return;
    setCurrentImgIndex((idx) =>
      (idx - 1 + galleryImages.length) % galleryImages.length
    );
  }

  function nextImage() {
    if (!galleryImages.length) return;
    setCurrentImgIndex((idx) => (idx + 1) % galleryImages.length);
  }

  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);

  const openGallery = (startIndex = 0) => {
    if (!hasGallery) return;
    setGalleryIndex(startIndex);
    setGalleryOpen(true);
  };

  const closeGallery = () => setGalleryOpen(false);

  const handlePrevGallery = () => {
    if (!hasGallery) return;
    setGalleryIndex((prev) =>
      prev === 0 ? locationGallery.length - 1 : prev - 1
    );
  };

  const handleNextGallery = () => {
    if (!hasGallery) return;
    setGalleryIndex((prev) =>
      prev === locationGallery.length - 1 ? 0 : prev + 1
    );
  };

  const selectedSuiteImage =
    selectedSuite
      ? selectedSuite.imageUrl || heroImg || ""
      : "";

  console.log("[suite-detail] selectedSuite", selectedSuite);
  console.log("[suite-detail] selectedSuiteImage", selectedSuiteImage);

  function handleAnswerChange(questionId: string, value: string) {
    setAppAnswers((prev) => ({ ...prev, [questionId]: value }));
  }

  function extractApplicantFields(answers: Record<string, any> | null | undefined) {
  const result = { name: "", email: "" };
  if (!answers) return result;

  for (const [key, raw] of Object.entries(answers)) {
    const k = key.toLowerCase();
    const value =
      typeof raw === "string" ? raw.trim() : String(raw ?? "").trim();

    if (!value) continue;

    // email field – any key that contains "email"
    if (!result.email && k.includes("email")) {
      result.email = value;
      continue;
    }

    // name field – contains "name" but not "email"
    if (!result.name && k.includes("name") && !k.includes("email")) {
      result.name = value;
      continue;
    }
  }

  return result;
}

 async function handleSubmitApplication() {
  if (!selectedSuite) return;
  setAppSubmitting(true);
  setAppSubmitError(null);
  setAppSubmitDone(false);

  try {
    console.log("[suite] appAnswers before submit:", appAnswers);
    console.log("[suite] applicant state fields:", {
      applicantName,
      applicantEmail,
    });

    const extracted = extractApplicantFields(appAnswers || {});
    console.log("[suite] extracted from answers:", extracted);

    const finalApplicantName =
      (applicantName || "").trim() || extracted.name || "";
    const finalApplicantEmail =
      (applicantEmail || "").trim() || extracted.email || "";

    const values: any = {
      Suite: { _id: selectedSuite.id },
      Name:
        finalApplicantName && selectedSuite?.name
          ? `${finalApplicantName} – ${selectedSuite.name}`
          : selectedSuite?.name || "Suite Application",
      Status: "Submitted",
      "Answers Json": JSON.stringify(appAnswers || {}),
      "Submitted At": new Date().toISOString(),
      "Applicant Name": finalApplicantName,
      "Applicant Email": finalApplicantEmail,
    };

    console.log("[suite] submitting application payload:", {
      url: `${API_BASE}/api/public/application`,
      values,
    });

    const res = await fetch(`${API_BASE}/api/public/application`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ values }),
    });

    const text = await res.text();
    console.log("[suite] application saved response:", {
      status: res.status,
      body: text,
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    setAppSubmitting(false);
    setAppSubmitDone(true);
    setAppAnswers({});
    setAppSections((prev) => prev);
    setAppModalOpen(false);
    setSuccessModalOpen(true);
  } catch (err: any) {
    console.error("[suite] submit application error", err);
    setAppSubmitting(false);
    setAppSubmitError(err.message || "Something went wrong.");
  }
}



  function handleCloseSuccessModal() {
    setSuccessModalOpen(false);
    setSelectedSuite(null); // go back to list view

    // ✅ refresh the page
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  }


function pickFirst(v: any, keys: string[]) {
  for (const k of keys) {
    const val = v?.[k];
    if (val != null && String(val).trim() !== "") return val;
  }
  return "";
}

  function renderQuestionInput(q: AppQuestion) {
    const value = appAnswers[q.id] || "";

    switch (q.type) {
      case "textarea":
        return (
          <textarea
            className="suite-app-input suite-app-textarea"
            value={value}
            placeholder={q.placeholder || ""}
            onChange={(e) => handleAnswerChange(q.id, e.target.value)}
          />
        );
      case "date":
        return (
          <input
            type="date"
            className="suite-app-input"
            value={value}
            onChange={(e) => handleAnswerChange(q.id, e.target.value)}
          />
        );
      case "signature":
        return (
          <input
            type="text"
            className="suite-app-input"
            placeholder={q.placeholder || "Type your full name as signature"}
            value={value}
            onChange={(e) => handleAnswerChange(q.id, e.target.value)}
          />
        );
      case "text":
      default:
        return (
          <input
            type="text"
            className="suite-app-input"
            value={value}
            placeholder={q.placeholder || ""}
            onChange={(e) => handleAnswerChange(q.id, e.target.value)}
          />
        );
    }
  }
const suiteDetails = (() => {
  const s: any = selectedSuite as any;
  const sv = s?.values || s || {};

  const description = pickFirst(sv, [
    "Suite Description",
    "Description",
    "Details",
    "About",
  ]);

  const sqft = pickFirst(sv, ["Square Feet", "Sq Ft", "Sqft", "Size"]);
  const deposit = pickFirst(sv, ["Deposit", "Security Deposit"]);
  const amenities = pickFirst(sv, ["Amenities", "Included", "What’s Included"]);
  const availabilityNotes = pickFirst(sv, ["Availability Notes", "Notes"]);

  return { description, sqft, deposit, amenities, availabilityNotes };
})();


  return (
<main
  className="suite-page"
  style={{
    backgroundColor: pageBgColor,
    color: textColor,
    ...(bgImageUrl ? { "--bg-url": `url(${bgImageUrl})` } as any : {}),
  }}
>


      {/* Top bar */}
      <header className="suite-topbar">
        <div className="suite-topbar-left">
          <span className="suite-topbar-location-label">Location</span>
          <span className="suite-topbar-location-name">{title}</span>
        </div>

        <button
          className="suite-menu-btn"
          type="button"
          aria-label="Open menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span />
          <span />
          <span />
        </button>
      </header>

 {/* 🔹 NEW: sub navigation bar under the top bar */}
      <nav className="suite-subbar">
        <div className="suite-subbar-group">
{hasAbout && (
  <button
    type="button"
    className="suite-subbar-link"
    onClick={() => handleScrollTo("about-section")}
  >
    About
  </button>
)}


        </div>
        
       <button
  type="button" className="suite-subbar-link" disabled={!hasGallery}
  onClick={() => openGallery(0)}
>
  Gallery
</button>


        <button
  type="button"
  className="suite-subbar-link"
  onClick={() => {
    const el = document.getElementById("other-locations");
    if (el) el.scrollIntoView({ behavior: "smooth" });
  }}
>
  Locations
</button>


               <button
          type="button"
          className="suite-subbar-link"
          onClick={() => handleScrollTo("professionals-section")}
        >
          Our Professionals
        </button>


        <div className="suite-subbar-group">
          <button type="button" className="suite-subbar-link">
            Suites
          </button>
      
        </div>

        <button type="button" className="suite-subbar-link">
          Contact Us
        </button>
      </nav>

      {/* Slide-out menu */}
      {menuOpen && (
        <div
          className="suite-menu-overlay"
          onClick={() => setMenuOpen(false)}
        >
          <nav
            className="suite-menu-panel"
            onClick={(e) => e.stopPropagation()}
          >
         <div className="suite-menu-group">
  <div
    className="suite-menu-section-title"
    style={{ fontWeight: 700, color: "#000000" }}
  >
    {title}
  </div>
</div>

              
 {hasAbout && (
  <button
    type="button"
    className="suite-menu-link"
    onClick={() => handleMenuClick("about-section")}
  >
    About
  </button>
)}


<button
  type="button"
  className="suite-menu-link"
  disabled={!hasGallery}
  onClick={() => {
    setMenuOpen(false);   // close the slide-out
    openGallery(0);       // open gallery modal
  }}
>
  Gallery
</button>

<button
  type="button"
  className="suite-menu-link"
  onClick={() => handleMenuClick("other-locations")}
>
  Locations
</button>

<button
  type="button"
  className="suite-menu-link"
  onClick={() => handleMenuClick("professionals-section")}
>
  Our Professionals
</button>

<div className="suite-menu-group">
  <div className="suite-menu-section-title">Suites</div>
  {menuSuites.length === 0 ? (
    <div className="suite-menu-link-secondary">Coming soon</div>
  ) : (
    menuSuites.map((s) => (
      <div
        key={s.id}
        className="suite-menu-link-secondary"
    onClick={() => {
  setMenuOpen(false);
  setSelectedSuite(s);
  setCurrentImgIndex(0);
  setTimeout(() => handleScrollTo("suite-detail"), 0);
}}

      >
        {s.name || "Suite"}
      </div>
    ))
  )}
</div>


         

            <button type="button" className="suite-menu-link">
              Contact Us
            </button>
          </nav>
        </div>
      )}

         {/* 👇 if NO suite is selected, show original layout */}
      {!selectedSuite && (
        <section className="suite-main">
          {/* Hero / default image (no arrows) */}
          <div className="suite-hero-row">
            <div className="suite-hero-card">
              {heroImg ? (
                <img src={heroImg} alt={title} className="suite-hero-img" />
              ) : (
                <div className="suite-hero-placeholder">
                  <span>Location</span>
                  <span>Default</span>
                  <span>Image</span>
                </div>
              )}
            </div>
          </div>

          {/* Available suites row */}
          <section className="suite-available-section">
            <div className="suite-available-inner">
              <h2 className="suite-available-title">Available Suites</h2>

              {loading && (
                <p className="suite-status">Loading suites…</p>
              )}
              {error && (
                <p className="suite-status suite-status-error">{error}</p>
              )}
              {!loading && !error && visibleSuites.length === 0 && (
                <p className="suite-status">
                  No suites have been added yet for this location.
                </p>
              )}

              <div className="suite-cards-row">
                {visibleSuites.map((s) => (
                  <article
                    key={s.id}
                    className="suite-card"
                    onClick={() => {
                      setSelectedSuite(s); // open that suite
                      setCurrentImgIndex(0); // reset gallery to first image
                    }}
                  >
                    <div className="suite-card-img-placeholder">
                      {s.imageUrl && (
                        <img
                          src={s.imageUrl}
                          alt={s.name}
                          className="suite-card-img"
                        />
                      )}
                    </div>
                    <div className="suite-card-text">
                      <div className="suite-card-name">{s.name}</div>
                      <div>Available On</div>
                      <div className="suite-card-date">
                        {fmtDate(s.availableDate)}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </section>

              {/* 👇 NEW: About section under Available Suites */}
     {hasAbout && (
  <section
    className="suite-about-section"
    id="about-section"
  >
    <h2 className="suite-about-title">About this location</h2>
    <div className="suite-about-card">
      <p>{aboutText}</p>
    </div>
  </section>
)}


          {/* ————————————————
              OUR PROFESSIONALS SECTION
          ———————————————— */}
          {professionals.length > 0 && (
            <section
              id="professionals-section"
              className="suite-pros-section"
            >
              <h2 className="suite-pros-title">Our Professionals</h2>

              {prosLoading && (
                <p className="suite-status">Loading professionals…</p>
              )}
              {prosError && (
                <p className="suite-status suite-status-error">
                  {prosError}
                </p>
              )}

              <div className="suite-pros-row">
                {professionals.map((pro) => (
                  <div
                    key={pro.id}
                    className="suite-pro-card"
                  >
                    <div className="suite-pro-img-wrap">
                      {pro.imageUrl ? (
                        <img
                          src={pro.imageUrl}
                          alt={pro.name}
                          className="suite-pro-img"
                        />
                      ) : (
                        <div className="suite-pro-placeholder">
                          {pro.name?.charAt(0) || "P"}
                        </div>
                      )}
                    </div>
                    <div className="suite-pro-name">{pro.name}</div>
                  </div>
                ))}
              </div>
            </section>
          )}




          {/* ————————————————
              OTHER LOCATIONS SECTION
          ———————————————— */}
          {otherLocations.length > 0 && (
            <section
              id="other-locations"
              className="suite-other-locations-section"
            >
              <h2 className="suite-other-title">
                Check out our other locations
              </h2>

              <div className="suite-other-row">
                {otherLocations.map((loc: any) => {
                  const lv = loc.values || {};
                  const img =
                    lv["Location Photo"] ||
                    lv["Default Image"] ||
                    "/qassets/images/default-location.png";

                  const slug =
                    lv["Slug"] ||
                    lv.slug ||
                    loc.slug ||
                    "";

                  const name =
                    lv["Location Name"] ||
                    lv["Suite Location Name"] ||
                    loc.name ||
                    "Location";

                  return (
                    <a
                      key={loc._id || loc.id}
                      href={`/${slug}`}
                      className="suite-other-card"
                    >
                      <img
                        src={img}
                        className="suite-other-img"
                        alt={name}
                      />
                      <div className="suite-other-name">
                        {name}
                      </div>
                    </a>
                  );
                })}
              </div>
            </section>
          )}

        </section>
        
      )}








    {/* 👇 if a suite IS selected, show detail view instead */}
{selectedSuite && (
  <section className="suite-detail-main">
    <button
      type="button"
      className="suite-back-btn"
      onClick={() => setSelectedSuite(null)}
    >
      ← Back to all suites
    </button>

    <h1 className="suite-title">{selectedSuite.name}</h1>

    {/* 🔹 SUPER SIMPLE image block */}
    {selectedSuiteImage && (
      <div className="suite-detail-image-wrap">
        <img
          src={selectedSuiteImage}
          alt={selectedSuite.name || title}
          className="suite-detail-img"
        />
      </div>
    )}

    <div className="suite-detail-meta">
    

      <div className="suite-detail-line">
        <span className="suite-detail-label">Available:</span>
        <span>{fmtDate(selectedSuite.availableDate)}</span>
      </div>

  <div className="suite-detail-line">
  <span className="suite-detail-label">Rate:</span>
  <span>
    {(() => {
      const amount = selectedSuite.rentAmount;
      const rawFreq = selectedSuite.rentFrequency || "";

      // if there is no amount at all
      if (amount == null) {
        return "Contact for rate";
      }

      // format amount nicely
      const amountStr = Number(amount).toLocaleString(undefined, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      });

      const freq = rawFreq.trim();
      if (!freq) {
        // amount but no frequency
        return `$${amountStr}`;
      }

      // optional: map internal values → prettier labels
      const freqMap: Record<string, string> = {
        daily: "day",
        weekly: "week",
        "bi-weekly": "2 weeks",
        monthly: "month",
      };

      const prettyFreq = freqMap[freq] || freq;

      return `$${amountStr} / ${prettyFreq}`;
    })()}
  </span>
</div>

      {/* PDF link if you still have one */}
      {selectedSuite.applicationFileUrl && (
        <a
          href={selectedSuite.applicationFileUrl}
          target="_blank"
          rel="noopener"
          className="suite-app-link"
        >
          <span className="suite-app-icon">PDF</span>
          <span>Download application</span>
        </a>
      )}


      {/* Dynamic template status + button */}
      <div className="suite-detail-line">
        <span className="suite-detail-label">Application:</span>
        <span>
          {appTemplateLoading && "Loading application…"}
          {appTemplateError && "Not available"}
          {!appTemplateLoading &&
            !appTemplateError &&
            appSections.length === 0 &&
            "Not available"}
          {!appTemplateLoading &&
            !appTemplateError &&
            appSections.length > 0 && (
              <button
                type="button"
                className="suite-app-open-btn"
                onClick={() => setAppModalOpen(true)}
              >
                Apply for this suite
              </button>
            )}
        </span>
      </div>

{/* ✅ Suite details section (under Application) */}
<div className="suite-details-section">
 <h3 className="suite-details-title">Suite details</h3>


  {suiteDetails.description && (
    <p className="suite-details-desc">{suiteDetails.description}</p>
  )}

  <div className="suite-details-grid">
    {suiteDetails.sqft && (
      <div className="suite-details-item">
        <div className="suite-details-label">Size</div>
        <div className="suite-details-value">{suiteDetails.sqft}</div>
      </div>
    )}

    {suiteDetails.deposit && (
      <div className="suite-details-item">
        <div className="suite-details-label">Deposit</div>
        <div className="suite-details-value">{suiteDetails.deposit}</div>
      </div>
    )}

    {suiteDetails.amenities && (
      <div className="suite-details-item">
        <div className="suite-details-label">Amenities</div>
        <div className="suite-details-value">{suiteDetails.amenities}</div>
      </div>
    )}

    {suiteDetails.availabilityNotes && (
      <div className="suite-details-item">
        <div className="suite-details-label">Notes</div>
        <div className="suite-details-value">{suiteDetails.availabilityNotes}</div>
      </div>
    )}
  </div>

  {!suiteDetails.description &&
    !suiteDetails.sqft &&
    !suiteDetails.deposit &&
    !suiteDetails.amenities &&
    !suiteDetails.availabilityNotes && (
      <p className="muted">No extra details have been added for this suite yet.</p>
    )}
</div>

    </div>
  </section>
)}






                                       {/* 🔹 Popups  */}

                                             {/* ✅ APPLICATION SENT SUCCESS MODAL */}
      {successModalOpen && (
        <div
          className="suite-app-overlay"
          onClick={handleCloseSuccessModal}
        >
          <div
            className="suite-app-modal suite-app-success-modal"
            onClick={(e) => e.stopPropagation()} // don’t close when clicking inside
          >
            <button
              type="button"
              className="suite-app-close"
              onClick={handleCloseSuccessModal}
            >
              ×
            </button>

            <div className="suite-app-success-content">
              <h2 className="suite-app-success-title">
                Application sent 🎉
              </h2>
              <p className="suite-app-success-text">
                Thank you for applying! The location owner will review your
                application and follow up with you soon.
              </p>

      <button
  type="button"
  className="suite-app-primary-btn"
  style={{ backgroundColor: buttonBgColor, color: buttonTextColor }}
  onClick={handleCloseSuccessModal}
>
  Close
</button>

            </div>
          </div>
        </div>
      )}

                                             {/* ---------- APPLICATION MODAL ---------- */}
      {appModalOpen && (
        <div
          className="suite-app-overlay"
          onClick={() => setAppModalOpen(false)}
        >
          <div
            className="suite-app-modal"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header row */}
            <div className="suite-app-header">
              <button
                type="button"
                className="suite-app-close"
                onClick={() => setAppModalOpen(false)}
              >
                ×
              </button>
              <div className="suite-app-header-main">
                <div className="suite-app-header-top">
                  <div className="suite-app-avatar">
                    {(title || "SU")[0]}
                  </div>
                  <div className="suite-app-header-text">
                    <div className="suite-app-location-name">{title}</div>
                    <div className="suite-app-suite-name">
                      Application for Lease – {selectedSuite?.name}
                    </div>
                  </div>
                </div>
                <p className="suite-app-header-sub">
                  Customize your answers below. Suite name and location will be
                  shown automatically on the final application.
                </p>
              </div>
            </div>

                 {/* Body: sections + questions */}
            <div className="suite-app-body">
              {appTemplateError && (
                <div className="suite-app-error">
                  Couldn&apos;t load this application.
                </div>
              )}

              {/* 🔹 Basic applicant info (always shown) */}
              <div className="suite-app-section">
                <div className="suite-app-section-title">Your details</div>

                <div className="suite-app-question-row">
                  <div className="suite-app-question-label">Full name</div>
                  <div className="suite-app-question-input">
                    <input
                      type="text"
                      className="suite-app-input"
                      placeholder="Enter your full name"
                      value={applicantName}
                      onChange={(e) => setApplicantName(e.target.value)}
                    />
                  </div>
                </div>

                <div className="suite-app-question-row">
                  <div className="suite-app-question-label">Email address</div>
                  <div className="suite-app-question-input">
                    <input
                      type="email"
                      className="suite-app-input"
                      placeholder="Enter your email"
                      value={applicantEmail}
                      onChange={(e) => setApplicantEmail(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* 🔹 Dynamic template sections (from builder) */}
              {!appTemplateError &&
                appSections.map((section) => (
                  <div
                    key={section.id}
                    className="suite-app-section"
                  >
                    <div className="suite-app-section-title">
                      {section.title}
                    </div>

                    {section.questions.map((q) => (
                      <div
                        key={q.id}
                        className="suite-app-question-row"
                      >
                        <div className="suite-app-question-label">
                          {q.label}
                        </div>
                        <div className="suite-app-question-input">
                          {renderQuestionInput(q)}
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
            </div>


            {/* Footer: buttons + status */}
            <div className="suite-app-footer">
              {appSubmitError && (
                <div className="suite-app-error">{appSubmitError}</div>
              )}
              {appSubmitDone && !appSubmitError && (
                <div className="suite-app-success">
                  Application sent successfully!
                </div>
              )}

              <div className="suite-app-footer-buttons">
                <button
                  type="button"
                  className="suite-app-secondary-btn"
                  onClick={() => setAppModalOpen(false)}
                  disabled={appSubmitting}
                >
                  Cancel
                </button>
           <button
  type="button"
  className="suite-app-primary-btn"
  style={{ backgroundColor: buttonBgColor, color: buttonTextColor }}
  onClick={handleSubmitApplication}
  disabled={appSubmitting || appSections.length === 0}
>
  {appSubmitting ? "Sending…" : "Send application"}
</button>

              </div>
            </div>
          </div>
        </div>
      )}

      {/* 🔹 LOCATION GALLERY MODAL */}
      {galleryOpen && hasGallery && (
        <div
          className="suite-gallery-overlay"
          onClick={closeGallery}
        >
          <div
            className="suite-gallery-modal"
            onClick={(e) => e.stopPropagation()} // don't close on inner click
          >
            {/* Close button */}
            <button
              type="button"
              className="suite-gallery-close"
              onClick={closeGallery}
            >
              ×
            </button>

            {/* Left arrow */}
            <button
              type="button"
              className="suite-gallery-arrow suite-gallery-arrow-left"
              onClick={handlePrevGallery}
            >
              ❮
            </button>

            {/* Image */}
            <img
              src={locationGallery[galleryIndex]}
              alt={`Gallery image ${galleryIndex + 1}`}
              className="suite-gallery-img"
            />

            {/* Right arrow */}
            <button
              type="button"
              className="suite-gallery-arrow suite-gallery-arrow-right"
              onClick={handleNextGallery}
            >
              ❯
            </button>
          </div>
        </div>
      )}


  </main>
);
}
