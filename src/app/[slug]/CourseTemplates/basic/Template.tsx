// src/app/[slug]/CourseTemplates/basic/Template.tsx
//C:\Users\tiffa\OneDrive\Desktop\suiteseat-web\src\app\[slug]\CourseTemplates\basic\Template.tsx

"use client";

import React, { useEffect, useMemo, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8400";

// ✅ change these names if your DataTypes are named differently
const DT_COURSE = "Course";
const DT_SECTION = "Course Section";
const DT_LESSON  = "Course Lesson";
const DT_CHAPTER = "Course Chapter"; // optional
type AnyRec = Record<string, any>;

export function sanitizePublicRichHtml(html = "") {
  const raw = String(html || "");

  // ✅ IMPORTANT: server + client must produce the SAME output
  // so we DO NOT "return raw" on the server anymore.
  // Instead we do a safe, deterministic strip that works everywhere.

  // 1) Always remove your editor-only image remove button specifically
  // (this is what was causing the hydration mismatch)
  let out = raw.replace(
    /<button[^>]*class=["'][^"']*\brte-img-x\b[^"']*["'][^>]*>[\s\S]*?<\/button>/gi,
    ""
  );

  // 2) Also remove a handful of common remove/close controls by class/attrs
  // without needing DOMParser (works SSR + client).
  out = out
    // remove elements with known "remove/close" classes
    .replace(
      /<(button|a|span|div)[^>]*class=["'][^"']*(modalClose|remove|remove-btn|removeBtn|imageRemove|imageRemoveBtn|assetRemove|delete|close|btn-remove|editor-only|admin-only)[^"']*["'][^>]*>[\s\S]*?<\/\1>/gi,
      ""
    )
    // remove elements with remove-ish data attributes / aria labels
    .replace(
      /<(button|a|span|div)[^>]*(data-action=["']remove["']|data-remove\b|aria-label=["'](Remove|Delete)["'])[^>]*>[\s\S]*?<\/\1>/gi,
      ""
    )
    // remove any leftover "only X" nodes (×, x, ✕) for common tags
    .replace(
      /<(button|a|span|div)[^>]*>\s*(×|x|✕)\s*<\/\1>/gi,
      ""
    );

  // 3) Optional: normalize whitespace a bit so SSR/client stay identical
  out = out.replace(/\s+\n/g, "\n").trim();

  return out;
}




function refId(x: any): string {
  if (!x) return "";
  if (typeof x === "string") return x;
  return String(x._id || x.id || x.value || x.$id || x.reference || "");
}


function resolveAsset(raw?: string | null) {
  if (!raw) return "";
  const s = String(raw).trim();
  if (!s) return "";
  if (/^https?:\/\//i.test(s)) return s;
  if (s.startsWith("/uploads/")) return `${API}${s}`; // API origin
  if (s.startsWith("/")) return `${API}${s}`;         // ✅ was "return s"
  return `${API}/uploads/${s}`;
}
function resolveColor(val: any): string {
  if (!val) return "";
  if (typeof val === "string") return val.trim();

  // common shapes if you saved a color picker object
  if (typeof val === "object") {
    const maybe =
      val.color ||
      val.hex ||
      val.value ||
      val.background ||
      val.bg ||
      val?.data?.color;
    if (typeof maybe === "string") return maybe.trim();
  }

  return "";
}

//Section Image 
function pickSectionImage(sv: any) {
  // match whatever you saved from settings
  const raw =
    sv["Section Image"] ||
    sv["Section image"] ||
    sv["Image"] ||
    sv["Thumbnail"] ||
    sv["Thumbnail Image"] ||
    sv["Cover"] ||
    null;

  const url = resolveAsset(raw);
  return url;
}


/////////////////////////////////////////////////////////////////////////////
//other state
export default function BasicCourseTemplate({ course }: { course: any }) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);


  const [loading, setLoading] = useState(true);
  const [courseRec, setCourseRec] = useState<any>(course || null);
  const [sections, setSections] = useState<AnyRec[]>([]);
 const [lessons, setLessons] = useState<AnyRec[]>([]);
  const [activeLessonId, setActiveLessonId] = useState<string | null>(null);
  const [chapters, setChapters] = useState<any[]>([]); // optional

const [loadingSections, setLoadingSections] = useState(false);
const [activeSectionId, setActiveSectionId] = useState<string | null>(null);

const [chaptersByLesson, setChaptersByLesson] = useState<Record<string, AnyRec[]>>({});

const [activeChapterIdx, setActiveChapterIdx] = useState<number | null>(null);
const [openSections, setOpenSections] = useState<Record<string, boolean>>({});


/////////////////////////////////////////////////////////////////////////////

const [lessonsBySection, setLessonsBySection] = useState<Record<string, AnyRec[]>>({});

    // ----------Check if user is logged in----------
useEffect(() => {
  let cancelled = false;

  async function checkSession() {
    try {
      const res = await fetch(`${API}/api/me`, {
        credentials: "include",
        headers: { Accept: "application/json" },
        cache: "no-store",
      });

      const data = await res.json().catch(() => null);

      if (!cancelled) setIsLoggedIn(!!data?.ok);
    } catch {
      if (!cancelled) setIsLoggedIn(false);
    }
  }

  checkSession();
  return () => {
    cancelled = true;
  };
}, []);


  // ---------- load course fresh (public) ----------
  useEffect(() => {
    let cancelled = false;

    async function loadCourse() {
      setLoading(true);
      try {
        const id = course?._id || course?.id;
        const slug = course?.slug;

        // Prefer by _id (strongest)
        let url = "";
        if (id) url = `${API}/public/records?dataType=${encodeURIComponent(DT_COURSE)}&_id=${encodeURIComponent(id)}&limit=1&ts=${Date.now()}`;
        else if (slug) url = `${API}/public/records?dataType=${encodeURIComponent(DT_COURSE)}&values.slug=${encodeURIComponent(slug)}&limit=1&ts=${Date.now()}`;

        if (!url) return;

        const r = await fetch(url, { cache: "no-store" });
        const payload = await r.json().catch(() => null);
        const rows = unpackRows(payload);
        const rec = rows?.[0] || null;

        if (!cancelled && rec) setCourseRec(rec);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadCourse();
    return () => { cancelled = true; };
  }, [course?._id, course?.slug]);

  const courseV = courseRec?.values || courseRec || {};

  
////////////////////////////////////////////////////
// ===== Lead popup background (TOP-LEVEL) =====
// ---------------------------
// LEAD POPUP CONFIG + FIELDS
// ---------------------------

type LeadField = {
  key: string;
  label?: string;
  type?: string; // text | email | tel | url
  required?: boolean;
  locked?: boolean;
};

// Helpers
function safeParseJsonObject(raw: any) {
  if (!raw) return null;
  if (typeof raw === "object") return raw;
  if (typeof raw !== "string") return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function getLeadCfgFromCourseValues(courseV: any) {
  const candidates = [
    "Lead Capture Config",
    "Lead Capture",
    "Lead Config",
    "Lead",
    "Collect Info",
    "Collect Info Config",
    "Lead Capture (NEW)",
    "Custom Popup Lead Capture",
  ];

  for (const k of candidates) {
    const got = safeParseJsonObject(courseV?.[k]);
    if (got) return got;
  }

  for (const [k, v] of Object.entries(courseV || {})) {
    const got = safeParseJsonObject(v as any);
    if (got?.styles && (got?.headline || got?.buttonText || typeof got?.enabled === "boolean")) {
      console.log("[LEAD POPUP DEBUG] matched key:", k);
      return got;
    }
  }

  return null;
}

// 1) leadCfg first
const leadCfg = useMemo(() => getLeadCfgFromCourseValues(courseV), [courseV]);
const leadEnabled = !!leadCfg?.enabled;

// 2) leadFields next (depends on leadCfg)
const leadFields: LeadField[] = useMemo(() => {
  const raw = leadCfg?.fields;
  const arr = Array.isArray(raw) ? raw : [];

  if (!arr.length) {
    return [
      { key: "name", label: "Name", type: "text", required: true, locked: true },
      { key: "email", label: "Email", type: "email", required: true, locked: true },
    ];
  }

  const normalized = arr
    .filter(Boolean)
    .map((f: any) => ({
      key: String(f.key || f.id || f.name || "").trim(),
      label: String(f.label || f.key || "").trim(),
      type: String(f.type || "text").trim(),
      required: !!f.required,
      locked: !!f.locked,
    }))
    .filter((f) => !!f.key);

  const hasName = normalized.some((f) => f.key === "name");
  const hasEmail = normalized.some((f) => f.key === "email");

  const out = [...normalized];
  if (!hasName) out.unshift({ key: "name", label: "Name", type: "text", required: true, locked: true });
  if (!hasEmail) out.push({ key: "email", label: "Email", type: "email", required: true, locked: true });

  return out;
}, [leadCfg]);

// 3) leadValues state AFTER leadFields is defined (so effects below can use it safely)
const [leadValues, setLeadValues] = useState<Record<string, string>>({});

// 4) setLeadValue AFTER setLeadValues exists
function setLeadValue(key: string, value: string) {
  setLeadValues((prev) => ({ ...prev, [key]: value }));
}

// 5) initialize missing keys whenever leadFields changes
useEffect(() => {
  setLeadValues((prev) => {
    const next = { ...prev };
    leadFields.forEach((f) => {
      if (next[f.key] == null) next[f.key] = "";
    });
    return next;
  });
}, [leadFields]);

// ---- styles (after leadCfg exists) ----
const leadStyles = leadCfg?.styles || {};
const leadBgColor = String(leadStyles?.bg || "").trim();
const leadBgImageRaw = leadStyles?.bgImage || "";
const leadTextColor = String(leadStyles?.text || "").trim() || "#111111";
// ✅ border already matches your save key ("border")
const leadBorderColor =
  String(leadStyles?.border || "").trim() || "#dddddd";
// ✅ support both old keys (btn/btnText) and new keys (buttonBg/buttonText)
const leadBtnBg =
  String(leadStyles?.btn || leadStyles?.button || leadStyles?.buttonBg || "").trim() || "#111111";

const leadBtnTextColor =
  String(leadStyles?.btnText || leadStyles?.buttonText || leadStyles?.textOnButton || "").trim() || "#ffffff";

const leadHeadline = String(leadCfg?.headline || "").trim();
const leadBtnText  = String(leadCfg?.buttonText || "").trim();

const leadBgImageUrl = useMemo(() => {
  const raw = String(leadBgImageRaw || "").trim();
  return raw ? resolveAsset(raw) : "";
}, [leadBgImageRaw]);

const leadHeaderImageUrl = useMemo(() => {
  const raw =
    leadCfg?.headerImage ||
    leadCfg?.styles?.headerImage ||
    leadCfg?.headerImageUrl ||
    leadCfg?.headerImagePath ||
    "";
  const s = String(raw || "").trim();
  return s ? resolveAsset(s) : "";
}, [leadCfg]);

const leadPopupStyle: React.CSSProperties = leadBgImageUrl
  ? {
      backgroundImage: `url("${leadBgImageUrl}")`,
      backgroundSize: "cover",
      backgroundPosition: "center",
      backgroundRepeat: "no-repeat",
      backgroundColor: leadBgColor || "#ffffff",
    }
  : {
      backgroundColor: leadBgColor || "#ffffff",
    };

const leadCardStyle: React.CSSProperties = {
  ...leadPopupStyle,
  color: leadTextColor,
  borderColor: leadBorderColor,
};


//////////////////////////////////////////////////////////////////

useEffect(() => {
  if (isLoggedIn) return;
  if (typeof window === "undefined") return;

  // ✅ stop the browser from restoring the old scroll position
  try {
    window.history.scrollRestoration = "manual";
  } catch {}

  // ✅ clear any #hash so browser won't jump to #outline
  if (window.location.hash) {
    window.history.replaceState(null, "", window.location.pathname);
  }

  // ✅ wait until #home exists, then scroll to it
  let tries = 0;

  const jumpToHome = () => {
    const home = document.getElementById("home");
    if (home) {
      home.scrollIntoView({ behavior: "auto", block: "start" });
      return;
    }

    if (tries++ < 30) {
      requestAnimationFrame(jumpToHome);
    } else {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    }
  };

  jumpToHome();
}, [isLoggedIn, courseRec?._id]);





////////////////////////////////////////////
//Buy Now Set up 

const [pendingBuyNow, setPendingBuyNow] = useState(false);

// put near your other handlers inside the component
async function handleBuyNowClick() {
  try {
    // 1) if not logged in, open login (or your lead popup)
    if (!isLoggedIn) {
       setPendingBuyNow(true);
      setShowLogin(true); // or setShowBuyNow(true) if you want lead popup first
      return;
    }

    // 2) we need the course record id
const courseId = String(courseRec?._id || "");


    if (!courseId) {
      alert("Missing course id");
      return;
    }

    // 3) add course to checkout
    const r = await fetch("https://api2.suiteseat.io/api/checkout/items/add-course", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ courseId, quantity: 1 }),
    });

    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      console.error("add-course failed:", data);
      alert(data?.error || "Failed to add course to checkout");
      return;
    }

    // 4) go to checkout page
    window.location.href = "/checkout";
  } catch (err) {
    console.error("handleBuyNowClick error:", err);
    alert("Something went wrong. Please try again.");
  }
}
 
///////////////////////////////////////////////////////////////////////////////
  // ---------- Log in ----------
const [showLogin, setShowLogin] = useState(false);
const [loginEmail, setLoginEmail] = useState("");
const [loginPassword, setLoginPassword] = useState("");
const [loginMsg, setLoginMsg] = useState<string | null>(null);
const [loginLoading, setLoginLoading] = useState(false);

async function handleLoginSubmit(e: React.FormEvent) {
  e.preventDefault();
  setLoginLoading(true);
  setLoginMsg(null);

  try {
const res = await fetch(`${API}/api/login`, {
  method: "POST",
  credentials: "include",
  headers: { "Content-Type": "application/json", Accept: "application/json" },
  body: JSON.stringify({ email: loginEmail, password: loginPassword }),
});

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      setIsLoggedIn(false);
      setLoginMsg(data?.message || "Login failed. Check your email/password.");
      return;
    }

    // ✅ success
    setIsLoggedIn(true);
    setLoginMsg("Logged in!");
    setShowLogin(false);

if (pendingBuyNow) {
  setPendingBuyNow(false);
  await handleBuyNowClick();
}

  } catch (err: any) {
    setIsLoggedIn(false);
    setLoginMsg(err?.message || "Network error logging in.");
  } finally {
    setLoginLoading(false);
  }
}

async function handleLogout() {
  try {
    await fetch(`${API}/auth/logout`, {
      method: "POST",
      credentials: "include",
      headers: { Accept: "application/json" },
    });
  } catch {}

  setIsLoggedIn(false);

  // reset private view state
  setActiveSectionId(null);
  setActiveLessonId(null);
  setActiveChapterIdx(null);

  // ✅ force landing to show (top of page)
  if (typeof window !== "undefined") {
    window.history.replaceState(null, "", window.location.pathname);
    window.scrollTo({ top: 0, behavior: "auto" });
  }
}




///////////////////////////////////////////////////////////////////////////////
  // ---------- landing page fields (from Course values) ----------
const landingHeadline = pickText(courseV, ["Headline"], "");
const landingSubheadline = pickText(courseV, ["Subheadline"], "");

const headlineRich = String(courseV["Headline Rich"] || "").trim();
const subheadlineRich = String(courseV["Subheadline Rich"] || "").trim();

const headlineText = pickText(courseV, ["Headline"], "");
const subheadlineText = pickText(courseV, ["Subheadline"], "");


const landingSalesCopy = pickText(courseV, ["Sales Copy"], "");
const landingSalesStory = pickText(courseV, ["Sales Story"], "");
const salesCopyRich = String(courseV["Sales Copy Rich"] || "").trim();
const salesCopyText = pickText(courseV, ["Sales Copy"], "");


const landingUrgency = pickText(courseV, ["Sales Urgency"], "");
const saleEndsAtISO = courseV["Sale Ends At"] || null;

const primaryCta = pickText(courseV, ["Primary CTA"], "");
const primaryCtaUrl = pickText(courseV, ["Primary CTA URL"], "");

const primaryCtaRichHtml = String(courseV["Primary CTA Rich"] || "").trim();
const ctaTextPlain = pickText(courseV, ["CTA Text"], "");

const secondaryCta = pickText(courseV, ["Secondary CTA"], "");
const secondaryAnchor = pickText(courseV, ["Secondary CTA Anchor/Section"], "");
const secondaryCtaText = pickText(courseV, ["Secondary CTA"], "");
const secondaryCtaRich = String(courseV["Secondary CTA Rich"] || courseV["Secondary CTA (button text) Rich"] || "").trim();

const outcomesText = pickText(courseV, ["Outcomes"], "");
const bonusesText = pickText(courseV, ["Bonuses"], "");
const guaranteeText = pickText(courseV, ["Guarantee"], "");

const proofHeadlineText = pickText(courseV, ["Social Proof Headline Text"], "");
const instructorBio = pickText(courseV, ["Instructor Bio"], "");
const faqText = pickText(courseV, ["FAQ"], "");

// ===== Rich + Plain fields for landing sections =====

// Outcomes
const outcomesRich = String(courseV["Outcomes Rich"] || "").trim();
const outcomesPlain = pickText(courseV, ["Outcomes"], "");

// Sales Story
const salesStoryRich = String(courseV["Sales Story Rich"] || "").trim();
const salesStoryPlain = pickText(courseV, ["Sales Story"], "");

// Social Proof
const socialProofRich = String(courseV["Social Proof Rich"] || "").trim();
const socialProofPlain = pickText(courseV, ["Social Proof"], "");
const socialProofHeadline = pickText(courseV, ["Social Proof Headline Text"], "");

// Instructor Bio
const instructorBioRich = String(courseV["Instructor Bio Rich"] || "").trim();
const instructorBioPlain = pickText(courseV, ["Instructor Bio"], "");

// Guarantee
const guaranteeRich = String(courseV["Guarantee Rich"] || "").trim();
const guaranteePlain = pickText(courseV, ["Guarantee"], "");

// FAQ
const faqRich = String(courseV["FAQ Rich"] || "").trim();
const faqPlain = pickText(courseV, ["FAQ"], "");


//Primary CTA button 
const PrimaryCtaLabel = () => {
  if (safePrimaryRich) {
    return (
      <span className="ctaBtnLabel">
        <span
          className="ctaBtnLabel__rich"
          dangerouslySetInnerHTML={{ __html: safePrimaryRich }}
        />
      </span>
    );
  }

  if (ctaTextPlain) return <span className="ctaBtnLabel">{ctaTextPlain}</span>;

  return <span className="ctaBtnLabel">Buy Now</span>;
};

const safePrimaryRich = useMemo(
  () => sanitizePublicRichHtml(primaryCtaRichHtml),
  [primaryCtaRichHtml]
);

//Popup
//Show CTA Popup 
const [showBuyNow, setShowBuyNow] = useState(false);
const [leadSubmitted, setLeadSubmitted] = useState(false);
const [leadSubmitMsg, setLeadSubmitMsg] = useState<string | null>(null);

useEffect(() => {
  if (isLoggedIn) return;
  if (typeof window === "undefined") return;

  const key = "course_buynow_popup_shown_v1";
  if (sessionStorage.getItem(key) === "1") return;

  const t = window.setTimeout(() => {
    setShowBuyNow(true);
    sessionStorage.setItem(key, "1");
  }, 3000);

  return () => window.clearTimeout(t);
}, [isLoggedIn]);

//Deliver deliverables
function validateLead() {
  for (const f of leadFields) {
    if (f.required && !String(leadValues[f.key] || "").trim()) {
      return `${f.label || f.key} is required.`;
    }
  }
  return null;
}

async function submitLeadAndShowDeliver() {
  const err = validateLead();
  if (err) {
    setLeadSubmitMsg(err);
    return;
  }

  setLeadSubmitMsg(null);

  try {
    // OPTIONAL: save lead in your DB (recommended)
    // If you don’t have this endpoint yet, you can remove this fetch
    await fetch(`${API}/public/lead-capture`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        courseId: String(courseRec?._id || courseRec?.id || ""),
        slug: String(courseV?.slug || ""),
        values: leadValues,
      }),
    }).catch(() => null);

    // ✅ flip UI to “success/download”
    setLeadSubmitted(true);

    // OPTIONAL: auto-download right away
    const fileUrl = leadCfg?.deliver?.fileUrl;
    if (fileUrl) window.open(fileUrl, "_blank", "noopener,noreferrer");
  } catch (e: any) {
    console.error("[lead] submit failed", e);
    setLeadSubmitMsg("Something went wrong. Please try again.");
  }
}

//Collect Info section 
// ✅ Collectinfo background (reuse lead styles)
const collectBgColor = leadBgColor || "#ffffff";

const collectBgImageUrl = useMemo(() => {
  const raw = String(leadBgImageRaw || "").trim();
  return raw ? resolveAsset(raw) : "";
}, [leadBgImageRaw]);




//Sale ends flip
function splitDigits(value: number, digits: number) {
  const s = String(Math.max(0, value)).padStart(digits, "0");
  return s.slice(-digits).split("").map((ch) => Number(ch));
}

type FlipCountdownProps = {
  saleEndsAtISO: string; // pass your existing saleEndsAtISO
};

function VideoFlipCountdown({ saleEndsAtISO }: FlipCountdownProps) {

  const rootRef = React.useRef<HTMLDivElement | null>(null);
const daysDigits = Math.max(1, String(Math.max(0, Math.floor((new Date(saleEndsAtISO).getTime() - Date.now()) / 86400000))).length);

  React.useEffect(() => {
    if (!rootRef.current) return;

    const root = rootRef.current;

    function getTimeSegmentElements(segmentElement: Element) {
      const segmentDisplay = segmentElement.querySelector(".segment-display");
      const segmentDisplayTop = segmentDisplay?.querySelector(".segment-display__top") as HTMLElement | null;
      const segmentDisplayBottom = segmentDisplay?.querySelector(".segment-display__bottom") as HTMLElement | null;

      const segmentOverlay = segmentDisplay?.querySelector(".segment-overlay") as HTMLElement | null;
      const segmentOverlayTop = segmentOverlay?.querySelector(".segment-overlay__top") as HTMLElement | null;
      const segmentOverlayBottom = segmentOverlay?.querySelector(".segment-overlay__bottom") as HTMLElement | null;

      return {
        segmentDisplayTop,
        segmentDisplayBottom,
        segmentOverlay,
        segmentOverlayTop,
        segmentOverlayBottom,
      };
    }

    function updateSegmentValues(displayEl: HTMLElement | null, overlayEl: HTMLElement | null, value: number) {
      if (!displayEl || !overlayEl) return;
      displayEl.textContent = String(value);
      overlayEl.textContent = String(value);
    }

    function updateTimeSegment(segmentElement: Element, timeValue: number) {
      const el = getTimeSegmentElements(segmentElement);
      if (!el.segmentDisplayTop || !el.segmentOverlay || !el.segmentOverlayTop || !el.segmentOverlayBottom || !el.segmentDisplayBottom) return;

      const current = parseInt(el.segmentDisplayTop.textContent || "0", 10);
      if (current === timeValue) return;

      el.segmentOverlay.classList.add("flip");

      // top static shows new value immediately + overlay bottom shows new value
      updateSegmentValues(el.segmentDisplayTop, el.segmentOverlayBottom, timeValue);

      function finishAnimation(this: Element) {
        el.segmentOverlay?.classList.remove("flip");
        // bottom static + overlay top set to new value at end
        updateSegmentValues(el.segmentDisplayBottom, el.segmentOverlayTop, timeValue);
        this.removeEventListener("animationend", finishAnimation as any);
      }

      el.segmentOverlay.addEventListener("animationend", finishAnimation as any);
    }



    function updateTimeSection(sectionId: string, timeValue: number, digits: number) {
      const sectionElement = root.querySelector(`#${sectionId}`);
      if (!sectionElement) return;

      const timeSegments = sectionElement.querySelectorAll(".time-segment");
      const nums = splitDigits(timeValue, digits);
        // ✅ Hide the first Hours digit when hours is 0–9 (remove the extra block)
  if (sectionId === "hours") {
    const tensSeg = timeSegments[0] as HTMLElement | undefined;
    if (tensSeg) tensSeg.style.display = timeValue < 10 ? "none" : "";
  }

if (sectionId === "days") {
  timeSegments.forEach((seg, i) => {
    const isLeading = i < nums.length - 1;
    const shouldHide = isLeading && nums[i] === 0;
    (seg as HTMLElement).style.display = shouldHide ? "none" : "";
  });
}

      // map digits to segments left -> right
      (nums as number[]).forEach((num: number, idx: number) => {
  const seg = timeSegments[idx];
  if (seg) updateTimeSegment(seg, num);
});

    }

    function getTimeRemaining(targetDateTime: number) {
      const now = Date.now();
      const complete = now >= targetDateTime;

      if (complete) {
        return { complete: true, days: 0, hours: 0, minutes: 0, seconds: 0 };
      }

      const secondsRemaining = Math.floor((targetDateTime - now) / 1000);

      const days = Math.floor(secondsRemaining / 86400);
      const hours = Math.floor((secondsRemaining % 86400) / 3600);
      const minutes = Math.floor((secondsRemaining % 3600) / 60);
      const seconds = secondsRemaining % 60;

      return { complete: false, days, hours, minutes, seconds };
    }

    const target = new Date(saleEndsAtISO).getTime();
    if (!Number.isFinite(target)) return;

    // initial set so it doesn't start blank
    const init = getTimeRemaining(target);
  updateTimeSection("days", init.days, daysDigits);   // 3 digits for days (000–999)
    updateTimeSection("hours", init.hours, 2);
    updateTimeSection("minutes", init.minutes, 2);
    updateTimeSection("seconds", init.seconds, 2);


    const timer = window.setInterval(() => {
      const t = getTimeRemaining(target);

    updateTimeSection("days", t.days, daysDigits);
      updateTimeSection("hours", t.hours, 2);
      updateTimeSection("minutes", t.minutes, 2);
      updateTimeSection("seconds", t.seconds, 2);


      if (t.complete) window.clearInterval(timer);
    }, 1000);

    return () => window.clearInterval(timer);
  }, [saleEndsAtISO]);

  return (
    <div className="countdown" ref={rootRef}>
      {/* DAYS (3 digits) */}
      <div className="time-section" id="days">
        <div className="time-group">
          {/* 3 segments for days */}
         {Array.from({ length: daysDigits }).map((_, i) => (

            <div className="time-segment" key={`d-${i}`}>
              <div className="segment-display">
                <div className="segment-display__top"></div>
                <div className="segment-display__bottom"></div>
                <div className="segment-overlay">
                  <div className="segment-overlay__top"></div>
                  <div className="segment-overlay__bottom"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
        <p>Days</p>
      </div>

      {/* HOURS */}
      <div className="time-section" id="hours">
        <div className="time-group">
          {[0, 1].map((i) => (
            <div className="time-segment" key={`h-${i}`}>
              <div className="segment-display">
                <div className="segment-display__top"></div>
                <div className="segment-display__bottom"></div>
                <div className="segment-overlay">
                  <div className="segment-overlay__top"></div>
                  <div className="segment-overlay__bottom"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
        <p>Hours</p>
      </div>

      {/* MINUTES */}
      <div className="time-section" id="minutes">
        <div className="time-group">
          {[0, 1].map((i) => (
            <div className="time-segment" key={`m-${i}`}>
              <div className="segment-display">
                <div className="segment-display__top"></div>
                <div className="segment-display__bottom"></div>
                <div className="segment-overlay">
                  <div className="segment-overlay__top"></div>
                  <div className="segment-overlay__bottom"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
        <p>Minutes</p>
      </div>

      {/* SECONDS */}
      <div className="time-section" id="seconds">
        <div className="time-group">
          {[0, 1].map((i) => (
            <div className="time-segment" key={`s-${i}`}>
              <div className="segment-display">
                <div className="segment-display__top"></div>
                <div className="segment-display__bottom"></div>
                <div className="segment-overlay">
                  <div className="segment-overlay__top"></div>
                  <div className="segment-overlay__bottom"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
        <p>Seconds</p>
      </div>
    </div>
  );
}





//////////////
///////////////////////////////////////////////////////////////////////////////
                                   //Course Section
                                   /////////////// 
useEffect(() => {
  // expose to DevTools console
  (window as any).__COURSE_DEBUG__ = {
    activeSectionId,
    activeLessonId,
    lessonsBySection,
    chaptersByLesson,
    sections,
    lessons,
  };
}, [activeSectionId, activeLessonId, lessonsBySection, chaptersByLesson, sections, lessons]);

useEffect(() => {
  (window as any).__COURSE_DEBUG__ = (window as any).__COURSE_DEBUG__ || {};
}, []);


// Helpers to turn multiline text into bullets
const splitLines = (txt: string) =>
  String(txt || "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

const outcomes = splitLines(outcomesText);
const bonuses = splitLines(bonusesText);

const title = pickText(courseV, ["Course Title", "Title", "Name", "Course Name"], "Course");
const desc  = pickText(courseV, ["Short Description", "Short description", "Description", "Desc"], "");

const thumb = resolveAsset(
  courseV["Thumbnail Image"] ||
  courseV.Thumbnail ||
  courseV.thumbnail ||
  courseV.thumbnailUrl ||
  courseV["Thumbnail image"] ||
  null
);

const logoUrl = resolveAsset(
  courseV["Course Logo"]?.url ||
  courseV["Course Logo"] ||
  courseV.logo?.url ||
  courseV.logo ||
  null
);

const sidebarBgRaw =
  courseV?.["Course Background"] ??
  courseV?.["Course Background Color"] ??
  courseV?.["Sidebar Background"] ??
  courseV?.["Sidebar Background Color"] ??
  courseV?.["Background"] ??
  courseV?.["Background Color"] ??
  "";

const sidebarBg = resolveColor(sidebarBgRaw);

const sidebarBgImage = resolveAsset(
  courseV?.["Course Background Image"] ??
  courseV?.["Sidebar Background Image"] ??
  null
);

console.log("[sidebar bg]", {
  sidebarBg,
  sidebarBgImage,
  courseVKeys: Object.keys(courseV || {}),
  courseVBgRaw:
    courseV?.["Course Background"] ??
    courseV?.["Course Background Color"] ??
    courseV?.["Sidebar Background"] ??
    courseV?.["Sidebar Background Color"] ??
    courseV?.["Background"] ??
    courseV?.["Background Color"],
});


  // ---------- load outline ----------
  //Filter out deleted sections 
function notDeleted(rec: any) {
  const v = rec?.values || {};
  const topDeleted = rec?.deletedAt;
  const valDeleted = v?.deletedAt || v?.DeletedAt || v?.["Deleted At"];

  // also treat Visible=false as "deleted/hidden"
  const visible = v?.Visible;
  const isHidden = visible === false || String(visible).toLowerCase() === "false";

  return !topDeleted && !valDeleted && !isHidden;
}

function isActive(rec: any) {
  const v = rec?.values || {};
  const deletedAt = rec?.deletedAt || v?.deletedAt || v?.DeletedAt || null;

  // common "soft delete" / hide flags you might be using
  const visible = v?.Visible;
  const archived = v?.Archived || v?.archive || v?.isArchived;
  const status = String(v?.Status || v?.status || "").toLowerCase();

  if (deletedAt) return false;
  if (visible === false) return false;
  if (archived === true) return false;
  if (status === "deleted" || status === "archived" || status === "hidden") return false;

  return true;
}

// De-dupe sections (sometimes “deleted + recreated” causes duplicates)
function dedupeById(rows: any[]) {
  const seen = new Set<string>();
  return rows.filter((r) => {
    const id = String(r?._id || r?.id || "");
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

useEffect(() => {
  const courseId = String(courseRec?._id || courseRec?.id || "");
  if (!courseId) return;

  let cancelled = false;

  async function loadOutline() {
    try {
      const secUrl =
        `${API}/public/records?dataType=${encodeURIComponent(DT_SECTION)}` +
        `&Course=${encodeURIComponent(courseId)}&limit=200&ts=${Date.now()}`;

      const lesUrl =
        `${API}/public/records?dataType=${encodeURIComponent(DT_LESSON)}` +
        `&Course=${encodeURIComponent(courseId)}&limit=500&ts=${Date.now()}`;

      const [secRes, lesRes] = await Promise.all([
        fetch(secUrl, { cache: "no-store" }),
        fetch(lesUrl, { cache: "no-store" }),
      ]);

      const secData = await secRes.json().catch(() => null);
      const lesData = await lesRes.json().catch(() => null);

      // 1) de-dupe + remove deleted/hidden
      const secAll = dedupeById(unpackRows(secData)).filter(isActive);
      const lesAll = dedupeById(unpackRows(lesData)).filter(isActive);

      // 2) HARD filter to THIS course (handles weird record shapes)
      const secRows = secAll.filter((s: any) => {
        const v = s?.values || s || {};
        const courseRef = v["Course"] ?? v.Course;
        return String(refId(courseRef)) === courseId;
      });

      const lesRows = lesAll.filter((l: any) => {
        const v = l?.values || l || {};
        const courseRef = v["Course"] ?? v.Course;
        return String(refId(courseRef)) === courseId;
      });

      // ✅ LOGS (keep these while testing)
      console.log("[outline] courseId", courseId);
      console.log("[outline] secUrl", secUrl);
      console.log("[outline] lesUrl", lesUrl);
      console.log("[outline] secRows", secRows.length);
      console.log("[outline] lesRows", lesRows.length);

      console.log(
        "[outline] sections details:",
        secRows.map((s: any) => {
          const v = s?.values || {};
          const courseRef = v.Course ?? v["Course"];
          return {
            id: String(s?._id || s?.id),
            title: v.Title || v.Name || v["Section Name"] || "",
            courseIdGuess: String(refId(courseRef)),
            deletedAt: s.deletedAt || v.deletedAt || null,
          };
        })
      );

      // then set state
      if (!cancelled) {
        setSections(secRows);
        setLessons(lesRows);
        
        const chaptersMap: Record<string, any[]> = {};

(lesRows || []).forEach((lessonRec: any) => {
  const lessonId = String(lessonRec?._id || lessonRec?.id || "");
  const lv = lessonRec?.values || lessonRec || {};
  chaptersMap[lessonId] = getLessonChaptersFromLessonValues(lv);
});

setChaptersByLesson(chaptersMap);

      }

      console.log(
        "[sections] fetched:",
        secRows.map((s: any) => ({
          id: s._id,
          title: s.values?.Title || s.values?.Name,
          deletedAt: s.deletedAt || s.values?.deletedAt || null,
        }))
      );

      // group lessons by section
      const grouped: Record<string, AnyRec[]> = {};

      lesRows.forEach((rec: AnyRec) => {
        const v = rec?.values || {};

        // Section might be stored as:
        // - values.Section (id or object)
        // - values["Section Id"]
        // - values.SectionId
        const sectionRef =
          v["Section"] ??
          v["SectionId"] ??
          v["Section Id"] ??
          v.section ??
          v.sectionId;

        const sid = String(sectionRef?._id || sectionRef?.id || sectionRef || "");
        if (!sid) return;

        (grouped[sid] ||= []).push(rec);
      });

      if (!cancelled) setLessonsBySection(grouped);
    } catch (e) {
      console.error("[outline] load failed", e);
      if (!cancelled) {
        setSections([]);
        setLessons([]);
        setLessonsBySection({});
      }
    }
  }

  loadOutline();

  return () => {
    cancelled = true;
  };
}, [courseRec?._id, courseRec?.id]);

  // ---------- optional: chapters by lesson (if you store separate DT) ----------
  useEffect(() => {
    let cancelled = false;

    async function loadChapters() {
      if (!activeLessonId) return;
      const url = `${API}/public/records?dataType=${encodeURIComponent(DT_CHAPTER)}&Lesson=${encodeURIComponent(activeLessonId)}&limit=300&ts=${Date.now()}`;
      const r = await fetch(url, { cache: "no-store" });
      const payload = await r.json().catch(() => null);
      const rows = unpackRows(payload);
      if (!cancelled) setChapters(Array.isArray(rows) ? rows : []);
    }

    loadChapters();
    return () => { cancelled = true; };
  }, [activeLessonId]);

  // ---------- derived ----------


  const activeLesson = useMemo(() => {
    return lessons.find(l => String(l._id) === String(activeLessonId)) || null;
  }, [lessons, activeLessonId]);

  const activeLessonV = activeLesson?.values || activeLesson || {};
  const activeLessonTitle = pickText(activeLessonV, ["Title", "Name", "Lesson title"], "Lesson");
  const activeLessonDesc = pickText(activeLessonV, ["Description", "Desc"], "");

  // blocks: if you store blocks inside the lesson record
  const lessonBlocks = (activeLessonV.blocks || activeLessonV.Blocks || []) as any[];








///////////////////////////////////////////////////////////////////////////////
  // ----------Course Section  ----------
function unpackRows(payload: any) {
  if (Array.isArray(payload)) return payload;
  return payload?.items || payload?.records || payload?.rows || [];
}

function pickText(v: any, keys: string[] = [], fallbackKey?: string) {
  if (!v) return "";
  for (const k of keys) {
    const val = v?.[k];
    if (typeof val === "string" && val.trim()) return val.trim();
  }
  if (fallbackKey) {
    const val = v?.[fallbackKey];
    if (typeof val === "string" && val.trim()) return val.trim();
  }
  return "";
}

///////////////////////////////////////////////////////////////////////////////////
//Lesson section
function getFirstLessonIdForSection(sectionId: string) {
  const list = lessonsBySection?.[sectionId] || [];
  if (!list.length) return null;

  // same ordering you used in SectionDetailView
  const getSortOrder = (rec: any): number => {
    const v = rec?.values || rec || {};
    const candidates = [
      v.Order, v["Order"], v["Sort Order"], v.SortOrder, v.sortOrder,
      v.Position, v.position, v.Index, v.index,
    ];
    for (const c of candidates) {
      const n = Number(c);
      if (Number.isFinite(n)) return n;
    }
    const t = new Date(rec?.createdAt || v?.createdAt || 0).getTime();
    return Number.isFinite(t) ? t : 0;
  };

  const sorted = [...list].sort((a, b) => getSortOrder(a) - getSortOrder(b));
  return String(sorted[0]?._id || sorted[0]?.id || "") || null;
}

useEffect(() => {
  if (!activeSectionId) return;
  if (activeLessonId) return;

  const first = getFirstLessonIdForSection(activeSectionId);
  if (first) setActiveLessonId(first);
}, [activeSectionId, activeLessonId, lessonsBySection]);

///////////////////////////////////////////////////////////////////////////////////
//chapter section
//helper
function safeParseJsonArray(raw: any) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw !== "string") return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function getLessonChaptersFromLessonValues(lv: any) {
  const raw =
    lv?.["Lesson Chapters"] ??
    lv?.["LessonChapters"] ??
    lv?.["Lesson Chapters JSON"] ??
    lv?.["Chapters"] ??
    "";

  const arr = safeParseJsonArray(raw);

  return arr
    .filter(Boolean)
    // ✅ hide chapters where visible === false
    .filter((ch: any) => ch?.visible !== false)
    .sort((a: any, b: any) => (a?.order ?? 0) - (b?.order ?? 0))
    .map((ch: any, idx: number) => ({
      order: ch?.order ?? idx,
      name: ch?.name || `Chapter ${idx + 1}`,
      description: ch?.description || "",
      locked: !!ch?.locked,
      visible: ch?.visible !== false, // ✅ keep it
      thumbUrl: ch?.thumbUrl || ch?.thumbnail || "",
      blocks: Array.isArray(ch?.blocks) ? ch.blocks : [],
    }));
}



///////////////////////////////////////////////////////////////////////////////
                     //Orange Section orange section
function SectionDetailView({
  lessonsBySection,
  chaptersByLesson,
  activeSectionId,
  activeLessonId,
  activeChapterIdx,
  onBack,
  onSelectLesson,
  onSelectChapter,
  sections,
}: {
  sections: AnyRec[];
  lessonsBySection: Record<string, AnyRec[]>;
  chaptersByLesson: Record<string, any[]>;

  activeSectionId: string;
  activeLessonId: string | null;
  activeChapterIdx: number | null;
  onBack: () => void;
  onSelectLesson: (lessonId: string) => void;
 onSelectChapter: (idx: number | null) => void;

}) {

  const active = sections.find(
    (s) => String(s?._id || s?.id || "") === String(activeSectionId)
  );

  const av = active?.values || active || {};
  const title = av["Section Name"] || av["Name"] || av["Title"] || "Section";

  const lessons = lessonsBySection?.[activeSectionId] || [];

  const activeLessonRec =
    lessons.find((l) => String(l?._id || l?.id || "") === String(activeLessonId)) || null;

  const lv = activeLessonRec?.values || activeLessonRec || {};
  const activeLessonTitle = lv["Lesson Name"] || lv["Name"] || lv["Title"] || "Lesson";

  // sort helper (optional)
  function getSortOrder(rec: any): number {
    const v = rec?.values || rec || {};
    const candidates = [
      v.Order, v["Order"], v["Sort Order"], v.SortOrder, v.sortOrder,
      v.Position, v.position, v.Index, v.index,
    ];
    for (const c of candidates) {
      const n = Number(c);
      if (Number.isFinite(n)) return n;
    }
    const t = new Date(rec?.createdAt || v?.createdAt || 0).getTime();
    return Number.isFinite(t) ? t : 0;
  }

  const sortedLessons = [...lessons].sort((a, b) => getSortOrder(a) - getSortOrder(b));

  //Add Chapters under lesson in sidebar
  const [openLessons, setOpenLessons] = React.useState<Record<string, boolean>>({});

// auto-open the selected lesson so its chapters show
React.useEffect(() => {
  if (!activeLessonId) return;
  setOpenLessons((prev) => ({ ...prev, [String(activeLessonId)]: true }));
}, [activeLessonId]);

function getChapterTitle(ch: any) {
  const v = ch?.values || ch || {};
  return v["Chapter Name"] || v["Name"] || v["Title"] || "Chapter";
}

function getChapterOrder(ch: any) {
  const v = ch?.values || ch || {};
  const n =
    Number(v.Order ?? v["Order"] ?? v["Sort Order"] ?? v.SortOrder ?? v.Position ?? v.Index);
  if (Number.isFinite(n)) return n;
  const t = new Date(ch?.createdAt || v?.createdAt || 0).getTime();
  return Number.isFinite(t) ? t : 0;
}

//Put Chapter cards under lesson on right 
const activeLessonIdStr = String(activeLessonId || "");

const activeLessonChapters =
  (activeLessonIdStr && chaptersByLesson?.[activeLessonIdStr])
    ? chaptersByLesson[activeLessonIdStr]
    : [];

const sortedActiveChapters = [...activeLessonChapters].sort(
  (a: any, b: any) => (Number(a?.order) || 0) - (Number(b?.order) || 0)
);

// ✅ debug (temporary)
console.log("[RIGHT PANEL] activeLessonId:", activeLessonIdStr);
console.log("[RIGHT PANEL] chapters:", sortedActiveChapters.length, sortedActiveChapters);
const activeChapter =
  activeChapterIdx != null ? sortedActiveChapters[activeChapterIdx] : null;

  //put buttons to go to next chapter 
  const activeLessonIndex = sortedLessons.findIndex(
  (l) => String(l?._id || l?.id || "") === String(activeLessonId || "")
);

const hasNextChapter =
  activeChapterIdx != null && activeChapterIdx + 1 < sortedActiveChapters.length;

const hasNextLesson =
  activeLessonIndex >= 0 && activeLessonIndex + 1 < sortedLessons.length;

function goNext() {
  // 1) next chapter
  if (hasNextChapter) {
    onSelectChapter((activeChapterIdx as number) + 1);
    return;
  }

  // 2) next lesson (if any)
  if (hasNextLesson) {
    const nextLessonRec = sortedLessons[activeLessonIndex + 1];
    const nextLessonId = String(nextLessonRec?._id || nextLessonRec?.id || "");

    if (nextLessonId) {
      onSelectLesson(nextLessonId);

      // ✅ choose one behavior:
      // A) open lesson view (no chapter selected)
      // onSelectChapter(null);

      // B) auto-open chapter 1 (index 0) for the next lesson
      onSelectChapter(0);
    }
    return;
  }

  // 3) no next chapter + no next lesson
  alert("You reached the end ✅");
}
//Add locked and visible to chapter 
type ChapterBlock = {
  order?: number;
  type?: string;
  url?: string;
  text?: string;
  fileName?: string;
  [k: string]: any;
};

type PublicChapter = {
  order: number;
  name: string;
  description: string;
  locked: boolean;
  visible: boolean;
  thumbUrl: string;
  blocks: ChapterBlock[];
};

// ✅ generic safe JSON parser
function parseJsonSafe<T>(raw: unknown, fallback: T): T {
  try {
    if (raw == null) return fallback;
    if (Array.isArray(raw)) return raw as unknown as T;
    if (typeof raw === "string") return JSON.parse(raw) as T;
    return fallback;
  } catch {
    return fallback;
  }
}

function normalizeChapters(rawChapters: unknown): PublicChapter[] {
  const chapters = Array.isArray(rawChapters) ? rawChapters : [];

  return chapters
    .map((ch: any, idx: number) => ({
      order: Number.isFinite(Number(ch?.order)) ? Number(ch.order) : idx,
      name: ch?.name || `Chapter ${idx + 1}`,
      description: ch?.description || "",
      locked: !!ch?.locked,
      visible: ch?.visible !== false, // ✅ default visible
      thumbUrl: ch?.thumbUrl || "",
      blocks: Array.isArray(ch?.blocks) ? (ch.blocks as ChapterBlock[]) : [],
    }))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

function getPublicChapters(rawLessonChapters: unknown): PublicChapter[] {
  const parsed = parseJsonSafe<unknown[]>(rawLessonChapters, []);
  const normalized = normalizeChapters(parsed);
  return normalized.filter((ch) => ch.visible !== false);
}

  ///////////////////////////////////////////////////////////////////////////////
                     //lesson section
  //helper
  function getBlockOrder(b: any, fallbackIndex = 0) {
  const v = b?.values || b || {};
  const candidates = [
    v.Order,
    v["Order"],
    v["Sort Order"],
    v.SortOrder,
    v.sortOrder,
    v.Position,
    v.position,
    v.Index,
    v.index,
  ];

  for (const c of candidates) {
    const n = Number(c);
    if (Number.isFinite(n)) return n;
  }
  return fallbackIndex;
}

function pickBlockType(b: any) {
  const v = b?.values || b || {};
  return String(
    v.Type ||
      v.type ||
      v["Block Type"] ||
      v["Type"] ||
      "text"
  ).toLowerCase();
}

function pickBlockTitle(b: any) {
  const v = b?.values || b || {};
  return (
    v.Label ||
    v.Title ||
    v.Name ||
    v["Block Title"] ||
    ""
  );
}

function pickBlockContent(b: any) {
  const v = b?.values || b || {};
  return (
    v.Html ||
    v["HTML"] ||
    v.Rich ||
    v["Rich Text"] ||
    v.Text ||
    v["Text"] ||
    v.Content ||
    v["Content"] ||
    ""
  );
}

function pickBlockAsset(b: any) {
  const v = b?.values || b || {};
  return (
    v.Image ||
    v["Image"] ||
    v.File ||
    v["File"] ||
    v.Url ||
    v.URL ||
    v["Asset URL"] ||
    ""
  );
}
  type LessonBlock =
  | { order?: number; type: "text"; text?: string }
  | { order?: number; type: "video"; url?: string; fileName?: string }
  | { order?: number; type: "resource"; url?: string; fileName?: string }
  | { order?: number; type: string; [k: string]: any };

function parseLessonBlocksFromRecord(lessonRec: any): LessonBlock[] {
  const v = lessonRec?.values || lessonRec || {};

  // 1) Sometimes blocks might already be an array (future-proof)
  const direct = v.blocks || v.Blocks;
  if (Array.isArray(direct)) {
    return [...direct].sort((a, b) => (Number(a?.order) || 0) - (Number(b?.order) || 0));
  }

  // 2) Your CURRENT saved format: values["Lesson Blocks"] is a JSON string
  const raw =
    v["Lesson Blocks"] ||
    v["LessonBlocks"] ||
    v["Lesson Blocks JSON"] ||
    "";

  if (typeof raw === "string" && raw.trim()) {
    try {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) {
        return [...arr].sort((a, b) => (Number(a?.order) || 0) - (Number(b?.order) || 0));
      }
    } catch (e) {
      console.error("[blocks] could not parse Lesson Blocks JSON", e, raw);
    }
  }

  return [];
}

function isYouTube(url: string) {
  return /youtube\.com|youtu\.be/i.test(url || "");
}
function toYouTubeEmbed(url: string) {
  // supports youtu.be/<id> or youtube.com/watch?v=<id>
  const u = String(url || "");
  const id =
    u.match(/youtu\.be\/([A-Za-z0-9_-]+)/)?.[1] ||
    u.match(/[?&]v=([A-Za-z0-9_-]+)/)?.[1] ||
    "";
  return id ? `https://www.youtube.com/embed/${id}` : "";
}

function renderTextWithBreaks(txt: string) {
  return String(txt || "").split("\n").map((line, i) => (
    <React.Fragment key={i}>
      {line}
      <br />
    </React.Fragment>
  ));
}
       









///////////////////////////////////////////////////////////////////////////////////
 return (
    <div className="course-detail">
<aside
  className="course-detail__sidebar"

>

        <button className="btn btn-ghost" type="button" onClick={onBack}>
          ← Back to sections
        </button>

  {/* =========================
      SIDEBAR HEADER (SECTION NAME)
     ========================= */}
  <div className="course-detail__sectionName">
    {title}
  </div>

  {/* =========================
      SIDEBAR LESSONS LIST ✅✅✅
      (THIS is where lessons are rendered)
     ========================= */}
    <div className="course-detail__lessonList">
          {!sortedLessons.length ? (
            <div className="muted">No lessons yet.</div>
          ) : (
            sortedLessons.map((lessonRec) => {
              const lv = lessonRec?.values || lessonRec || {};
              const lessonId = String(lessonRec?._id || lessonRec?.id || "");
              const lessonTitle =
                lv["Lesson Name"] || lv["Name"] || lv["Title"] || "Lesson";

              const isActiveRow = String(lessonId) === String(activeLessonId);
              const hasChapters = (chaptersByLesson?.[lessonId] || []).length > 0;

              //Shoow chapters underneath leassons
              
return (
  <div key={lessonId} className="course-detail__lessonGroup">
    <button
      type="button"
      className={`course-detail__lessonItem ${isActiveRow ? "is-active" : ""}`}
      onClick={() => {
        console.log("[CLICK LESSON BUTTON]", { lessonId, lessonTitle });
        onSelectLesson(lessonId);
      }}
    >
      <span className="course-detail__lessonTitle">{lessonTitle}</span>

      {hasChapters ? (
        <span className="course-detail__lessonArrow" aria-hidden="true">
          ▾
        </span>
      ) : (
        <span className="course-detail__lessonArrowSpacer" aria-hidden="true" />
      )}
    </button>

 
 
 
    {/* ✅Section Under lesson in sidebar*/}
{hasChapters && (
  <div className="course-detail__chapterList">
    {(chaptersByLesson?.[lessonId] || []).map((ch: any, idx: number) => {
      const locked = !!ch?.locked;

      return (
        <button
          key={`${lessonId}-ch-${idx}`}
          type="button"
          className={`course-detail__chapterItem ${locked ? "is-locked" : ""}`}
          disabled={locked}                       // ✅ prevents click + tab focus
          aria-disabled={locked}
          onClick={(e) => {
            if (locked) return;                   // ✅ extra safety
            e.preventDefault();
            e.stopPropagation();
            onSelectLesson(lessonId);
            onSelectChapter(idx);
          }}
        >
          <span className="course-detail__chapterTitle">
            {ch?.name || `Chapter ${idx + 1}`}
          </span>

          {locked ? (
            <span className="course-detail__chapterLock" aria-label="Locked">
              🔒
            </span>
          ) : null}
        </button>
      );
    })}
  </div>
)}




  </div>
);

              
            })
          )}
        </div>
      </aside>















                       {/* =========================
                                Right side) 
                        ========================= */}
                    
<main className="course-detail__main">
  <div id="lessonTop" />

  {!activeLessonId ? (
    <div className="course-detail__empty">Select a lesson to view it.</div>
  ) : activeChapter ? (
    // ✅ CHAPTER VIEW
    <>
      <div className="course-detail__mainHeader">
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => onSelectChapter(null)} // ✅ no "as any"
        >
          ← Back to lesson
        </button>

        <h2 className="course-detail__lessonTitleRight">
          {activeChapter?.name || "Chapter"}
        </h2>
      </div>

      {activeChapter?.description ? (
        <p className="muted">{activeChapter.description}</p>
      ) : null}

   
                   {/* =========================
                               Chapters Seciton
                        ========================= */}
 {Array.isArray(activeChapter?.blocks) && activeChapter.blocks.length ? (
  <div className="lessonBlocks">
    {activeChapter.blocks
      .slice()
      .sort((a: any, b: any) => (Number(a?.order) || 0) - (Number(b?.order) || 0))
      .map((b: any, idx: number) => {
        const type = String(b?.type || "").toLowerCase();

        if (type === "text") {
          return (
            <div className="lessonBlock lessonBlock--text" key={idx}>
              <div className="lessonBlock__content">
                {renderTextWithBreaks(String(b?.text || ""))}
              </div>
            </div>
          );
        }

        if (type === "video") {
          const url = String(b?.url || "").trim();
          const embed = isYouTube(url) ? toYouTubeEmbed(url) : "";

          return (
            <div className="lessonBlock lessonBlock--video" key={idx}>
              {embed ? (
                <iframe
                  className="lessonBlock__iframe"
                  src={embed}
                  title="Chapter video"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : url ? (
                <video className="lessonBlock__video" controls preload="metadata">
                  <source src={url} />
                </video>
              ) : (
                <div className="muted">Video block has no URL.</div>
              )}
            </div>
          );
        }

        if (type === "resource") {
          const url = String(b?.url || "").trim();
          const name = String(b?.fileName || "Open resource");

          return (
            <div className="lessonBlock lessonBlock--resource" key={idx}>
              {url ? (
                <a className="lessonBlock__link" href={url} target="_blank" rel="noreferrer">
                  {name}
                </a>
              ) : (
                <div className="muted">Resource block has no URL.</div>
              )}
            </div>
          );
        }

        return (
          <div className="lessonBlock" key={idx}>
            <div className="muted">Unsupported block: {String(b?.type)}</div>
          </div>
        );
      })}
  </div>
) : (
  <div className="muted">No chapter content yet.</div>
)}


<div className="chapterNextRow">
  <button type="button" className="btn btn-primary" onClick={goNext}>
    Next →
  </button>
</div>



    </>
  ) : (
    ////////////////////////////////////////
    ////////////////// ✅ LESSON VIEW
    //////////
    <>
      <h2 className="course-detail__lessonTitleRight">{activeLessonTitle}</h2>

      {(() => {
        const blocks = parseLessonBlocksFromRecord(activeLessonRec);

        if (!blocks.length) {
          return <div className="muted">No lesson blocks yet.</div>;
        }

        return (
          <div className="lessonBlocks">
            {blocks.map((b, idx) => {
              const type = String(b?.type || "").toLowerCase();

              if (type === "text") {
                return (
                  <div className="lessonBlock lessonBlock--text" key={idx}>
                    <div className="lessonBlock__content">
                      {renderTextWithBreaks((b as any).text || "")}
                    </div>
                  </div>
                );
              }

              if (type === "video") {
                const url = String((b as any).url || "").trim();
                const embed = isYouTube(url) ? toYouTubeEmbed(url) : "";

                return (
                  <div className="lessonBlock lessonBlock--video" key={idx}>
                    {embed ? (
                      <iframe
                        className="lessonBlock__iframe"
                        src={embed}
                        title="Lesson video"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    ) : url ? (
                      <video className="lessonBlock__video" controls preload="metadata">
                        <source src={url} />
                      </video>
                    ) : (
                      <div className="muted">Video block has no URL.</div>
                    )}
                  </div>
                );
              }

              if (type === "resource") {
                const url = String((b as any).url || "").trim();
                const name = String((b as any).fileName || "Open resource");
                return (
                  <div className="lessonBlock lessonBlock--resource" key={idx}>
                    {url ? (
                      <a
                        className="lessonBlock__link"
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {name}
                      </a>
                    ) : (
                      <div className="muted">Resource block has no URL.</div>
                    )}
                  </div>
                );
              }

              return (
                <div className="lessonBlock" key={idx}>
                  <div className="muted">
                    Unsupported block: {String((b as any).type)}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })()}
 
 
                       {/* =========================
                  Chapter section under lesson elements
                        ========================= */}
<div className="lessonBlue">
  <div className="lessonBlue__title">Chapters</div>
  <div className="lessonBlue__text">Pick a chapter from this lesson.</div>

  {(() => {
    const lid = String(activeLessonId || "");
    const chs = (lid && chaptersByLesson?.[lid]) ? chaptersByLesson[lid] : [];

    if (!chs.length) {
      return <div className="lessonBlue__empty">No chapters for this lesson yet.</div>;
    }

    const sorted = [...chs].sort(
      (a: any, b: any) => (Number(a?.order) || 0) - (Number(b?.order) || 0)
    );

    return (
      <div className="lessonBlue__grid">
        {sorted.map((ch: any, idx: number) => (
<button
  key={`blue-ch-${lid}-${idx}`}
  type="button"
  className={`lessonBlue__card ${ch?.locked ? "is-locked" : ""}`}
  disabled={!!ch?.locked}
  aria-disabled={!!ch?.locked}
  onClick={() => {
    if (ch?.locked) return;
  onSelectChapter(idx);

  }}
>

  <div className="lessonBlue__cardThumb">
    {ch?.thumbUrl ? <img src={ch.thumbUrl} alt="" /> : null}
  </div>

  {/* ✅ Chapter name BELOW the card image */}
<div
  className="lessonBlue__cardName"
  style={{ color: "#fff", fontWeight: 800, marginTop: 8 }}
>
  {ch?.name || `Chapter ${idx + 1}`}
</div>


  {ch?.locked ? (
    <div className="lessonBlue__cardMeta">🔒 Locked</div>
  ) : (
    <div className="lessonBlue__cardMeta">Open</div>
  )}
</button>

        ))}
      </div>
    );
  })()}
</div>

  </>



  )}
</main>













    </div>
  );
}









    {/* /////////////////////////////////////////////////////
    // //////////////Landing Page
    // ///////////////*/}
 
return (
  <div className="course-wrap">

{!isLoggedIn ? (
  <section className="landing-section">
                                     
                                     
                                     
                                     
                                     
                                          {/* =======================
                                                      Header                                          
                                             Top Nav Header (PUBLIC)
                                            ======================= */}
    <header className="course-topnav">
      <div className="course-topnav__inner">
        {/* Left */}
        <div className="course-topnav__left">
          <span className="course-topnav__brand">{title}</span>
        </div>

        {/* Middle tabs */}
        <nav className="course-topnav__tabs" aria-label="Course navigation">
          <button
            type="button"
            className="course-tab"
            onClick={() =>
              document
                .getElementById("home")
                ?.scrollIntoView({ behavior: "smooth", block: "start" })
            }
          >
            Home
          </button>

       

          <button
            type="button"
            className="course-tab"
            onClick={() =>
              document
                .getElementById("about")
                ?.scrollIntoView({ behavior: "smooth", block: "start" })
            }
          >
            About
          </button>

<button
  type="button"
  className="course-tab"
  onClick={handleBuyNowClick}
>
  Buy Now
</button>


        </nav>

        {/* Right buttons */}
 <div className="course-topnav__right" >





          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => setShowLogin(true)}
          >
            Log In
          </button>
        </div>
      </div>
    </header>

    {/* =======================
        Landing Page CONTENT
        (goes directly under header)
    ======================= */}
<div className="course-public">
  {/* Landing hero */}
  <section className="course-landingHero" id="home">
    <div className="course-landingHero__inner">
      {/* LEFT: Headline */}
      <div className="course-landingHero__left">
        {headlineRich ? (
          <div
            className="course-landingHero__headlineRich"
            dangerouslySetInnerHTML={{
              __html: sanitizePublicRichHtml(headlineRich),
            }}
          />
        ) : (
          <h1 className="course-landingHero__headline">
            {headlineText || title}
          </h1>
        )}
      </div>


          {/* RIGHT: Subheadline */}
      <div className="course-landingHero__right">
  {subheadlineRich ? (
    <div
      className="course-landingHero__subheadlineRich"
      dangerouslySetInnerHTML={{
        __html: sanitizePublicRichHtml(subheadlineRich),
      }}
    />
  ) : subheadlineText ? (
    <p className="course-landingHero__subheadline">{subheadlineText}</p>
  ) : (
    <p className="course-landingHero__subheadline muted">{desc || ""}</p>
  )}
</div>
</div>


      </section>

      {/* Primary CTA bar */}
      <section className="course-ctaBar" aria-label="Primary call to action">
        <div className="course-ctaBar__inner">
          <div className="course-ctaBar__left">
            {primaryCtaRichHtml ? (
              <div
                className="course-ctaBar__copy"
                dangerouslySetInnerHTML={{ __html: sanitizePublicRichHtml(primaryCtaRichHtml), }}
              />
            ) : ctaTextPlain ? (
              <div className="course-ctaBar__copy">{ctaTextPlain}</div>
            ) : null}
          </div>
        </div>
      </section>

{/* ✅ Collectinfo section */}

<section className="collectinfo" id="collectinfo" style={leadCardStyle}>
  {/* Headline */}
  <div className="collectinfo__headline">
    {leadHeadline || "Enter your info to continue"}
  </div>

  {/* Header Image */}
  {leadHeaderImageUrl ? (
    <div className="collectinfo__headerImgWrap">
      <img className="collectinfo__headerImg" src={leadHeaderImageUrl} alt="" />
    </div>
  ) : null}

  {/* Body */}
  <div className="collectinfo__body">
    {!leadSubmitted ? (
      <>
   
        {/* ✅ Fields (same as popup) */}
        <div className="leadForm">
          {leadFields.map((f) => {
            const label = f.label || f.key;
            const type =
              f.type === "email" || f.type === "tel" || f.type === "url"
                ? f.type
                : "text";

            return (
              <div key={f.key} className="leadField">
                <label className="fieldLabel">
                  {label}
                  {f.required ? <span className="reqStar"> *</span> : null}
                </label>

                <input
                  className="fieldInput"
                  type={type}
                  value={leadValues[f.key] || ""}
                  onChange={(e) => setLeadValue(f.key, e.target.value)}
                  placeholder={label}
                  required={!!f.required}
                  autoComplete={
                    f.key === "email" ? "email" : f.key === "name" ? "name" : "off"
                  }
                />
              </div>
            );
          })}
        </div>

        {/* Error */}
        {leadSubmitMsg ? (
          <div className="leadError" role="alert">
            {leadSubmitMsg}
          </div>
        ) : null}

        {/* Button */}
<button
  className="btn btn-primary leadModalBtn"
  style={{
    ["--btnBg" as any]: leadBtnBg,
    ["--btnText" as any]: leadBtnTextColor,
  }}
>
  {leadBtnText || "Continue"}
</button>


      </>
    ) : (
      <>
        <div className="leadSuccess">
          <div className="leadSuccess__title" style={{ textAlign: "center" }}>
            You’re all set ✅
          </div>

          <div className="leadSuccess__sub" style={{ textAlign: "center" }}>
            {leadCfg?.deliver?.fileUrl
              ? "Tap below to download your file."
              : "No file was attached for delivery."}
          </div>

          {leadCfg?.deliver?.fileUrl ? (
            <a
              className="btn btn-primary leadModalBtn"
              href={leadCfg.deliver.fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                backgroundColor: leadBtnBg,
                color: leadBtnTextColor,
                borderColor: leadBtnBg,
                textAlign: "center",
                justifyContent: "center",
                display: "inline-flex",
                alignItems: "center",
                width: "100%",
              }}
            >
              Download {leadCfg?.deliver?.fileName || "file"}
            </a>
          ) : null}
        </div>
      </>
    )}
  </div>
</section>




      {/* Sale ends clock */}
{saleEndsAtISO ? (
  <section className="flipCountdown">
    <div className="flipCountdown__title"> Ends In</div>
    <VideoFlipCountdown saleEndsAtISO={String(saleEndsAtISO)} />
  </section>
) : null}


      {/* Secondary CTA */}
{(secondaryCtaRich || secondaryCtaText) ? (
  <section className="course-secondaryCta" aria-label="Secondary call to action">
    <div className="course-secondaryCta__inner">
      <button
        type="button"
        className="btn btn-ghost"
        onClick={() => {
          if (!secondaryAnchor) return;
          document.getElementById(secondaryAnchor)?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
        }}
      >
        {secondaryCtaRich ? (
          <span
            className="course-secondaryCta__rich"
            dangerouslySetInnerHTML={{
              __html: sanitizePublicRichHtml(secondaryCtaRich),
            }}
          />
        ) : (
          secondaryCtaText
        )}
      </button>
    </div>
  </section>
) : null}


      {/* Sales Copy */}
      {(salesCopyRich || salesCopyText) ? (
        <section className="course-salesCopy" aria-label="Sales copy">
          <div className="course-salesCopy__inner">
            {salesCopyRich ? (
              <div
                className="course-salesCopy__rich"
                dangerouslySetInnerHTML={{ __html: sanitizePublicRichHtml (salesCopyRich), }}
              />
            ) : (
              <div className="course-salesCopy__text">{salesCopyText}</div>
            )}
          </div>
        </section>
      ) : null}

      {/* Outcomes */}
      {(outcomesRich || outcomesPlain) ? (
        <section className="course-section" id="outcomes" aria-label="Outcomes">
          <div className="course-section__inner">
            {outcomesRich ? (
              <div
                className="course-section__rich"
                dangerouslySetInnerHTML={{ __html: sanitizePublicRichHtml (outcomesRich), }}
              />
            ) : (
              <div className="course-section__text">{outcomesPlain}</div>
            )}
          </div>
        </section>
      ) : null}

    {/* Course Outline (Accordion) */}
<section className="course-section" id="outline" aria-label="Course outline">
  <div className="course-section__inner">
    <div className="outlineTop">
      <h2 className="course-section__title">Course content</h2>

      <div className="outlineTop__meta">
        {sections.length} sections •{" "}
        {Object.values(lessonsBySection || {}).reduce((sum, arr) => sum + (arr?.length || 0), 0)} lectures
      </div>

      <button
        type="button"
        className="outlineTop__expandBtn"
onClick={() => {
  const allIds = sections.map((s) => String(s?._id || ""));
  const allOpen = allIds.every((id) => !!openSections[id]);

  const next: Record<string, boolean> = {};
  allIds.forEach((id) => (next[id] = !allOpen));
  setOpenSections(next);
}}

      >
        Expand all sections
      </button>
    </div>

    <div className="outlineAcc">
      {sections.map((sec) => {
        const sv = sec?.values || sec || {};
        const secId = String(sec?._id || "");
        const secTitle = pickText(sv, ["Title", "Name", "Section Name"], "Section");
        const secLessons = lessonsBySection?.[secId] || [];

        const isOpen = !!openSections[secId];

        return (
          <div key={secId} className="outlineAcc__item">
            <button
              type="button"
              className="outlineAcc__header"
              aria-expanded={isOpen}
              onClick={() => setOpenSections((prev) => ({ ...prev, [secId]: !prev[secId] }))}
            >
              <span className={`outlineAcc__chev ${isOpen ? "is-open" : ""}`}>⌄</span>

              <span className="outlineAcc__title">{secTitle}</span>

              <span className="outlineAcc__meta">
                {secLessons.length} lecture{secLessons.length === 1 ? "" : "s"}
              </span>
            </button>

            {isOpen ? (
              <div className="outlineAcc__body">
                {secLessons.length ? (
                  <ul className="outlineAcc__list">
                    {secLessons.map((l) => {
                      const lv = l?.values || l || {};
                      const lid = String(l?._id || "");
               const lt = pickText(lv, ["Lesson Name", "Lesson Title", "Title", "Name"], "Lesson");


                      return (
                        <li key={lid} className="outlineAcc__lesson">
                          {lt}
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <div className="outlineAcc__empty">No lessons in this section yet.</div>
                )}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  </div>
</section>


      {/* Social Proof */}
      {(socialProofRich || socialProofPlain) ? (
        <section className="course-section" id="proof" aria-label="Social proof">
          <div className="course-section__inner">
            <h2 className="course-section__title">
              {socialProofHeadline || "Results & social proof"}
            </h2>

            {socialProofRich ? (
              <div
                className="course-section__rich"
                dangerouslySetInnerHTML={{ __html: sanitizePublicRichHtml(socialProofRich), }}
              />
            ) : (
              <div className="course-section__text">{socialProofPlain}</div>
            )}
          </div>
        </section>
      ) : null}

      {/* Instructor Bio */}
      {(instructorBioRich || instructorBioPlain) ? (
        <section className="course-section" id="about" aria-label="Instructor bio">
          <div className="course-section__inner">
            {instructorBioRich ? (
              <div
                className="course-section__rich"
                dangerouslySetInnerHTML={{ __html: sanitizePublicRichHtml (instructorBioRich) }}
              />
            ) : (
              <div className="course-section__text">{instructorBioPlain}</div>
            )}
          </div>
        </section>
      ) : null}

      {/* Sales Story */}
      {(salesStoryRich || salesStoryPlain) ? (
        <section className="course-section" id="story" aria-label="Sales story">
          <div className="course-section__inner">
            {salesStoryRich ? (
              <div
                className="course-section__rich"
                dangerouslySetInnerHTML={{ __html: sanitizePublicRichHtml (salesStoryRich), }}
              />
            ) : (
              <div className="course-section__text">{salesStoryPlain}</div>
            )}
          </div>
        </section>
      ) : null}

      {/* Guarantee */}
      {(guaranteeRich || guaranteePlain) ? (
        <section className="course-section" id="guarantee" aria-label="Guarantee">
          <div className="course-section__inner">
            {guaranteeRich ? (
              <div
                className="course-section__rich"
                dangerouslySetInnerHTML={{ __html: sanitizePublicRichHtml (guaranteeRich), }}
              />
            ) : (
              <div className="course-section__text">{guaranteePlain}</div>
            )}
          </div>
        </section>
      ) : null}

      {/* FAQ */}
      {(faqRich || faqPlain) ? (
        <section className="course-section" id="faq" aria-label="FAQ">
          <div className="course-section__inner">
            {faqRich ? (
              <div
                className="course-section__rich"
                dangerouslySetInnerHTML={{ __html: sanitizePublicRichHtml (faqRich), }}
              />
            ) : (
              <div className="course-section__text">{faqPlain}</div>
            )}
          </div>
        </section>
      ) : null}
    </div>
  </section>
) : null}

















               {/* =======================
                     Course Section 
                 ======================= */}
    {/* ✅ ORANGE: show ONLY when logged in */}
    {isLoggedIn ? (
      <section className="course-shell">
        {/* =======================
            PRIVATE HEADER (LOGGED IN)
        ======================= */}
        <header className="course-privateNav">
          <div className="course-privateNav__inner">
            {/* Left */}
            <div className="course-privateNav__left">
       <button className="course-privateNav__logo" type="button" aria-label="Course logo">
  {logoUrl ? (
    <img className="course-privateNav__logoImg" src={logoUrl} alt="" />
  ) : (
    "LOGO"
  )}
</button>



              <div className="course-privateNav__title">
                {title || "Course Name"}
              </div>

              <button
                className="course-privateNav__switch"
                type="button"
                aria-label="Switch course"
              >
                ⇅
              </button>
            </div>

            {/* Middle */}
            <div className="course-privateNav__middle">
              <div className="course-privateNav__searchWrap">
                <span className="course-privateNav__searchIcon">🔎</span>
                <input
                  className="course-privateNav__search"
                  placeholder="Search"
                />
              </div>
            </div>

            {/* Right */}
            <div className="course-privateNav__right">
         
     

              <button
                className="course-privateNav__logout"
                type="button"
                onClick={handleLogout}
              >
                Log out
              </button>
            </div>
          </div>
        </header>

        
                       {/* =======================
                           Course Section Cards
                        ======================= */}


        <main className="course-privateBody">



{!activeSectionId ? (
  // ✅ VIEW A: grid of section cards
  <div className="course-cardsWrap">
    <div className="course-cardsGrid">
      {!sections?.length ? (
        <div className="course-empty">No sections yet.</div>
      ) : (
        sections.map((sec) => {
          const sv = sec?.values || sec || {};
          const secId = String(sec?._id || sec?.id || "");
          const secTitle =
            pickText(sv, ["Section Name", "Name", "Title"]) || "Section";

              const visible = sv?.Visible !== false; // ✅ default true
  if (!visible) return null;             // ✅ hides it completely

  const locked = !!sv?.["Section Locked"]; // ✅ lock flag
          const secSubtitle = pickText(sv, [
            "Section Subtitle",
            "Subtitle",
            "Description",
            "Desc",
          ]);

          const secLessons = lessonsBySection?.[secId] || [];
          const progressPct = 0;

          return (
          <button
  key={secId}
  type="button"
  className={`course-card ${locked ? "is-locked" : ""}`}
  disabled={locked}
  onClick={() => {
    if (locked) return; // ✅ extra safety
    setActiveSectionId(secId);

    const firstLessonId = getFirstLessonIdForSection(secId);
    setActiveLessonId(firstLessonId);
    setActiveChapterIdx(null);
  }}
>

          {(() => {
  const img = pickSectionImage(sv);
  return (
    <div className="course-card__thumb">
      {img ? (
        <img
          src={img}
          alt={`${secTitle} cover`}
          loading="lazy"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = "none";
          }}
        />
      ) : (
        <div className="course-card__thumbFallback" />
      )}

      {/* ✅ overlay must be OUTSIDE the <img /> */}
      {locked ? (
        <div className="course-card__lockOverlay" aria-hidden="true">
          <span className="course-card__lockIcon">🔒</span>
        </div>
      ) : null}
    </div>
  );
})()}

              <div className="course-card__body">
                <div className="course-card__title">{secTitle}</div>
                {secSubtitle ? (
                  <div className="course-card__subtitle">{secSubtitle}</div>
                ) : null}

                <div className="course-card__meta">
                  <span className="course-card__count">
                    {secLessons.length} lesson
                    {secLessons.length === 1 ? "" : "s"}
                  </span>
                </div>

                <div className="course-card__progressRow">
                  <div className="course-card__progressTrack">
                    <div
                      className="course-card__progressFill"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                  <div className="course-card__pct">{progressPct}%</div>
                </div>
              </div>
            </button>
          );
        })
      )}
    </div>
  </div>
) : (
  // ✅ VIEW B: detail view
<SectionDetailView
  sections={sections}
  lessonsBySection={lessonsBySection}
  chaptersByLesson={chaptersByLesson}
  activeSectionId={activeSectionId}
  activeLessonId={activeLessonId}
  activeChapterIdx={activeChapterIdx}
  onBack={() => {
    setActiveSectionId(null);
    setActiveLessonId(null);
    setActiveChapterIdx(null);
  }}
  onSelectLesson={(lessonId) => {
    setActiveLessonId(lessonId);
    setActiveChapterIdx(null);
  }}
  onSelectChapter={(idx) => {
 setActiveChapterIdx(null);


  }}
/>




)}










        </main>
      </section>
    ) : null}






  {/* =======================
                           Popups
                        ======================= */}
  
 {/* ✅✅✅ PUT THE POPUP RIGHT HERE (still inside course-wrap) */}
    {showLogin ? (
      <div
        className="modalOverlay"
        role="dialog"
        aria-modal="true"
        aria-label="Login"
      >
        <div className="modalCard">
          <div className="modalHeader">
            <div className="modalTitle">Log in</div>

            <button
              type="button"
              className="modalClose"
              onClick={() => setShowLogin(false)}
              aria-label="Close"
            >
              ✕
            </button> 
          </div>

          <form onSubmit={handleLoginSubmit} className="modalBody">
            <label className="fieldLabel">Email</label>
            <input
              className="fieldInput"
              value={loginEmail}
              onChange={(e) => setLoginEmail(e.target.value)}
              type="email"
              placeholder="you@email.com"
              required
            />

            <label className="fieldLabel">Password</label>
            <input
              className="fieldInput"
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
              type="password"
              placeholder="••••••••"
              required
            />

            {loginMsg ? <div className="modalMsg">{loginMsg}</div> : null}

            <button
              className="btn btn-primary"
              type="submit"
              disabled={loginLoading}
            >
              {loginLoading ? "Logging in..." : "Log in"}
            </button>

            <button
              type="button"
              className="btn btn-ghost"
              onClick={() =>
                alert("Next: open signup modal or route to signup page")
              }
            >
              Create an account
            </button>
          </form>
        </div>
      </div>
    ) : null}






{/*LeadPopup */}
{/* ✅ LEAD POPUP (PUBLIC ONLY) */}
{showBuyNow && !isLoggedIn ? (
  <div
    className="modalOverlay"
    role="dialog"
    aria-modal="true"
    aria-label="Lead capture"
    onClick={() => setShowBuyNow(false)}
  >
    <div
      className="modalCard leadModalCard"
      style={leadCardStyle}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="modalHeader">
        {/* ✅ headline */}
        <div className="modalTitle">
          {leadHeadline || "Enter your info to continue"}
        </div>

        <button
          type="button"
          className="modalClose"
          onClick={() => setShowBuyNow(false)}
          aria-label="Close"
        >
          ✕
        </button>
      </div>

      {/* ✅ optional header image */}
      {leadHeaderImageUrl ? (
        <div className="leadModalHeaderImgWrap">
          <img className="leadModalHeaderImg" src={leadHeaderImageUrl} alt="" />
        </div>
      ) : null}

      <div className="modalBody">
        {/* ✅ SWITCH: show form OR show deliver file */}
        {!leadSubmitted ? (
          <>
          

            {/* ✅ fields */}
            <div className="leadForm">
              {leadFields.map((f) => {
                const label = f.label || f.key;
                const type =
                  f.type === "email" || f.type === "tel" || f.type === "url"
                    ? f.type
                    : "text";

                return (
                  <div key={f.key} className="leadField">
                    <label className="fieldLabel">
                      {label}
                      {f.required ? <span className="reqStar"> *</span> : null}
                    </label>

                    <input
                      className="fieldInput"
                      type={type}
                      value={leadValues[f.key] || ""}
                      onChange={(e) => setLeadValue(f.key, e.target.value)}
                      placeholder={label}
                      required={!!f.required}
                      autoComplete={
                        f.key === "email"
                          ? "email"
                          : f.key === "name"
                          ? "name"
                          : "off"
                      }
                    />
                  </div>
                );
              })}
            </div>

            {/* ✅ error message if needed */}
            {leadSubmitMsg ? (
              <div className="leadError" role="alert">
                {leadSubmitMsg}
              </div>
            ) : null}

            {/* ✅ main button */}
          <button
  className="btn btn-primary leadModalBtn"
  style={{
    ["--btnBg" as any]: leadBtnBg,
    ["--btnText" as any]: leadBtnTextColor,
  }}
>
  {leadBtnText || "Continue"}
</button>


            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setShowBuyNow(false)}
            >
              Maybe later
            </button>
          </>
        ) : (
          <>
            <div className="leadSuccess">
              <div className="leadSuccess__title" style={{ textAlign: "center" }}>
                You’re all set ✅
              </div>

              <div className="leadSuccess__sub" style={{ textAlign: "center" }}>
                {leadCfg?.deliver?.fileUrl
                  ? "Tap below to download your file."
                  : "No file was attached for delivery."}
              </div>

              {leadCfg?.deliver?.fileUrl ? (
                <a
                  className="btn btn-primary leadModalBtn"
                  href={leadCfg.deliver.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    backgroundColor: leadBtnBg,
                    color: leadBtnTextColor,
                    borderColor: leadBtnBg,
                    textAlign: "center",
                    justifyContent: "center",
                    display: "inline-flex",
                    alignItems: "center",
                    width: "100%",
                  }}
                >
                  Download {leadCfg?.deliver?.fileName || "file"}
                </a>
              ) : null}

              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setShowBuyNow(false)}
              >
                Close
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  </div>
) : null}




  </div>
);








}
