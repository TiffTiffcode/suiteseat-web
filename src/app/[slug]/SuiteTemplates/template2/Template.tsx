//C:\Users\tiffa\OneDrive\Desktop\suiteseat-web\src\app\[slug]\SuiteTemplates\template2\Template.tsx

"use client";

import { Fragment, useEffect, useMemo, useState } from "react";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8400";

type Suite = {
  id?: string;
  name?: string;
  imageUrl?: string | null;
  availableDate?: string | null;
  rentAmount?: number | null;
  rentFrequency?: string | null;
  rateText?: string;
  values?: any;
  applicationTemplate?: string | null;
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

function rowsToQuestions(rows: any[], prefix: string): AppQuestion[] {
  if (!Array.isArray(rows)) return [];

  return rows.map((row, idx) => {
    const key = row.key || row.id || `${prefix}_${idx + 1}`;
    const label = (row.label || "").trim() || "Question";

    const inputType = String(row.inputType || "").toLowerCase();
    let type: AppQuestion["type"] = "text";

    if (inputType.includes("date")) type = "date";
    else if (inputType.includes("textarea")) type = "textarea";
    else if (inputType.includes("sign")) type = "signature";

    return {
      id: key,
      label,
      type,
      placeholder: row.placeholder || "",
    };
  });
}

function normalizeTemplateToSections(raw: any): AppSection[] {
  if (!raw) return [];

  if (Array.isArray(raw)) {
    return raw.map((sec: any, secIdx: number) => {
      const id = sec.id || `section_${secIdx + 1}`;
      const title = sec.title || `Section ${secIdx + 1}`;
      const questions = rowsToQuestions(sec.questions || sec.rows || [], id);
      return { id, title, questions };
    });
  }

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
        title: raw.sections.experienceTitle?.label || "Professional Experience",
        questions: rowsToQuestions(experienceRows, "experience"),
      });
    }

    const customSections = Array.isArray(raw.sections.custom)
      ? raw.sections.custom
      : [];

    customSections.forEach((sec: any, idx: number) => {
      const sectionId = sec.sectionKey || sec.titleKey || `custom_${idx + 1}`;
      out.push({
        id: sectionId,
        title: sec.title || "New section",
        questions: rowsToQuestions(sec.rows || [], sectionId),
      });
    });

    return out;
  }

  return [];
}

export default function Template2({
  business,
  suites,
  loading,
  error,
}: {
  business: any;
  suites: Suite[];
  loading: boolean;
  error: string | null;
}) {
  const [selectedSuite, setSelectedSuite] = useState<Suite | null>(null);
  const [activeResponsiveView, setActiveResponsiveView] = useState<"desktop" | "mobile">("desktop");

  const [appSections, setAppSections] = useState<AppSection[]>([]);
  const [appAnswers, setAppAnswers] = useState<Record<string, string>>({});
  const [appModalOpen, setAppModalOpen] = useState(false);
  const [appSubmitting, setAppSubmitting] = useState(false);
  const [appSubmitError, setAppSubmitError] = useState<string | null>(null);
  const [appSubmitDone, setAppSubmitDone] = useState(false);
  const [applicantName, setApplicantName] = useState("");
  const [applicantEmail, setApplicantEmail] = useState("");

  useEffect(() => {
    const updateResponsiveView = () => {
      setActiveResponsiveView(window.innerWidth <= 768 ? "mobile" : "desktop");
    };

    updateResponsiveView();
    window.addEventListener("resize", updateResponsiveView);

    return () => window.removeEventListener("resize", updateResponsiveView);
  }, []);

  useEffect(() => {
    if (!selectedSuite) {
      setAppSections([]);
      setAppModalOpen(false);
      return;
    }

    const suiteAny: any = selectedSuite;
    const rawTemplate =
      suiteAny.applicationTemplate ||
      suiteAny["Suite Application Template"] ||
      suiteAny.values?.["Suite Application Template"] ||
      suiteAny["Application Template"] ||
      suiteAny.values?.["Application Template"] ||
      "";

    if (!rawTemplate) {
      setAppSections([]);
      return;
    }

    try {
      const parsed =
        typeof rawTemplate === "string" ? JSON.parse(rawTemplate) : rawTemplate;

      setAppSections(normalizeTemplateToSections(parsed));
    } catch (err) {
      console.error("[template2] failed to parse suite application template", err);
      setAppSections([]);
    }
  }, [selectedSuite]);

  const v = business?.values || {};

  const DEFAULT_TEMPLATE_COLORS = {
    pageBg: "#f5f0e9",
    surface: "#ffffff",
    text: "#171717",
    mutedText: "#6b6258",
    accent: "#b88a58",
    buttonBg: "#171717",
    buttonText: "#ffffff",
    border: "rgba(0,0,0,0.08)",
    softBlock: "#efe7dc",
  };

  const pageBgColor =
    v["Background Color"] ||
    v.bgColor ||
    DEFAULT_TEMPLATE_COLORS.pageBg;

  const surfaceColor =
    v["Card Background Color"] ||
    v.cardBgColor ||
    DEFAULT_TEMPLATE_COLORS.surface;

  const textColor =
    v["Text Color"] ||
    v.textColor ||
    DEFAULT_TEMPLATE_COLORS.text;

  const mutedTextColor =
    v["Muted Text Color"] ||
    v.mutedTextColor ||
    DEFAULT_TEMPLATE_COLORS.mutedText;

  const accentColor =
    v["Accent Color"] ||
    v.accentColor ||
    DEFAULT_TEMPLATE_COLORS.accent;

  const buttonBgColor =
    v["Button Color"] ||
    v.buttonColor ||
    DEFAULT_TEMPLATE_COLORS.buttonBg;

  const buttonTextColor =
    v["Button Text Color"] ||
    v.buttonTextColor ||
    DEFAULT_TEMPLATE_COLORS.buttonText;

  const borderColor =
    v["Border Color"] ||
    v.borderColor ||
    DEFAULT_TEMPLATE_COLORS.border;

  const softBlockColor =
    v["Soft Block Color"] ||
    v.softBlockColor ||
    DEFAULT_TEMPLATE_COLORS.softBlock;

  const locationName =
    business?.name ||
    v["Location Name"] ||
    v["Suite Location Name"] ||
    "Location";

  const heroImage =
    v["Location Photo"] ||
    v["Default Image"] ||
    "";

  const aboutText =
    v["About"] ||
    v["Location About"] ||
    v["Details"] ||
    "Discover a refined suite experience designed for professionals who want a polished, premium environment.";

  const visibleSuites = useMemo(() => {
    return (suites || []).filter((suite) => {
      const name = String(suite?.name || "").trim();
      const hasImage = !!suite?.imageUrl;
      const hasDate = !!suite?.availableDate;
      return name || hasImage || hasDate;
    });
  }, [suites]);

  const featuredSuite = visibleSuites[0] || null;
  const secondarySuites = visibleSuites.slice(1);

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

  function renderRate(suite: Suite) {
    if (suite?.rateText) return suite.rateText;
    if (suite?.rentAmount == null) return "Contact for rate";

    const amount = Number(suite.rentAmount).toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });

    const freq = String(suite?.rentFrequency || "").trim();
    return freq ? `$${amount} / ${freq}` : `$${amount}`;
  }

  function extractApplicantFields(answers: Record<string, any> | null | undefined) {
    const result = { name: "", email: "" };
    if (!answers) return result;

    for (const [key, raw] of Object.entries(answers)) {
      const k = key.toLowerCase();
      const value =
        typeof raw === "string" ? raw.trim() : String(raw ?? "").trim();

      if (!value) continue;

      if (!result.email && k.includes("email")) {
        result.email = value;
        continue;
      }

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
      const extracted = extractApplicantFields(appAnswers || {});
      const finalApplicantName =
        (applicantName || "").trim() || extracted.name || "";
      const finalApplicantEmail =
        (applicantEmail || "").trim() || extracted.email || "";

      const payload = {
        dataTypeName: "Suite Application Submission",
        values: {
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
        },
      };

      const res = await fetch(`${API_BASE}/api/public/submit-record`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const text = await res.text();
      console.log("[template2] application saved response:", {
        status: res.status,
        body: text,
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      setAppSubmitting(false);
      setAppSubmitDone(true);
      setAppAnswers({});
      setAppModalOpen(false);
    } catch (err: any) {
      console.error("[template2] submit application error", err);
      setAppSubmitting(false);
      setAppSubmitError(err.message || "Something went wrong.");
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: pageBgColor,
        color: textColor,
      }}
    >
      <section
        style={{
          maxWidth: "1360px",
          margin: "0 auto",
          padding: activeResponsiveView === "mobile" ? "18px 18px 10px" : "28px 34px 14px",
        }}
      >
        <div
          style={{
            position: "relative",
            minHeight: activeResponsiveView === "mobile" ? "420px" : "680px",
            borderRadius: activeResponsiveView === "mobile" ? "28px" : "36px",
            overflow: "hidden",
            background: softBlockColor,
          }}
        >
          {heroImage ? (
            <img
              src={heroImage}
              alt={locationName}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                display: "block",
                position: "absolute",
                inset: 0,
              }}
            />
          ) : null}

          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(to top, rgba(0,0,0,0.48), rgba(0,0,0,0.08) 45%, rgba(0,0,0,0.06))",
            }}
          />

          <div
            style={{
              position: "absolute",
              inset: 0,
              zIndex: 2,
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              padding: activeResponsiveView === "mobile" ? "22px" : "34px",
              color: "#fff",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: "16px",
              }}
            >
              <div
                style={{
                  fontSize: "12px",
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  opacity: 0.92,
                }}
              >
               
              </div>

              <div
                style={{
                  padding: "10px 14px",
                  borderRadius: "999px",
                  background: "rgba(255,255,255,0.16)",
                  backdropFilter: "blur(8px)",
                  fontSize: "12px",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                }}
              >
                {visibleSuites.length} suites
              </div>
            </div>

            <div style={{ maxWidth: activeResponsiveView === "mobile" ? "100%" : "760px" }}>
              <div
                style={{
                  width: "82px",
                  height: "3px",
                  borderRadius: "999px",
                  background: accentColor,
                  marginBottom: "18px",
                }}
              />

              <h1
                style={{
                  margin: "0 0 16px",
                  fontSize: activeResponsiveView === "mobile" ? "42px" : "78px",
                  lineHeight: 0.94,
                  fontWeight: 700,
                  letterSpacing: "-0.03em",
                }}
              >
                {locationName}
              </h1>

              <p
                style={{
                  margin: 0,
                  fontSize: activeResponsiveView === "mobile" ? "16px" : "19px",
                  lineHeight: 1.8,
                  maxWidth: "640px",
                  opacity: 0.95,
                }}
              >
                {aboutText}
              </p>
            </div>
          </div>
        </div>
      </section>

      {featuredSuite && (
        <section
          style={{
            maxWidth: "1360px",
            margin: "0 auto",
            padding: activeResponsiveView === "mobile" ? "10px 18px 28px" : "8px 34px 40px",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                activeResponsiveView === "mobile" ? "1fr" : "1.05fr 0.95fr",
              gap: activeResponsiveView === "mobile" ? "18px" : "26px",
              alignItems: "stretch",
            }}
          >
            <div
              style={{
                minHeight: activeResponsiveView === "mobile" ? "280px" : "520px",
                borderRadius: "30px",
                overflow: "hidden",
                background: softBlockColor,
                cursor: "pointer",
              }}
              onClick={() => setSelectedSuite(featuredSuite)}
            >
              {featuredSuite.imageUrl ? (
                <img
                  src={featuredSuite.imageUrl}
                  alt={featuredSuite.name || "Featured suite"}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    display: "block",
                  }}
                />
              ) : null}
            </div>

            <div
              style={{
                background: surfaceColor,
                borderRadius: "30px",
                padding: activeResponsiveView === "mobile" ? "24px" : "34px",
                border: `1px solid ${borderColor}`,
                boxShadow: "0 14px 38px rgba(0,0,0,0.05)",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
              }}
            >
              <div>
                <div
                  style={{
                    color: accentColor,
                    fontSize: "12px",
                    letterSpacing: "0.16em",
                    textTransform: "uppercase",
                    marginBottom: "12px",
                  }}
                >
                  Featured Suite
                </div>

                <h2
                  style={{
                    margin: "0 0 14px",
                    fontSize: activeResponsiveView === "mobile" ? "34px" : "52px",
                    lineHeight: 0.96,
                    letterSpacing: "-0.03em",
                  }}
                >
                  {featuredSuite.name || "Suite"}
                </h2>

                <p
                  style={{
                    margin: "0 0 12px",
                    color: mutedTextColor,
                    fontSize: "16px",
                  }}
                >
                  Available {fmtDate(featuredSuite.availableDate)}
                </p>

                <p
                  style={{
                    margin: 0,
                    fontSize: activeResponsiveView === "mobile" ? "24px" : "30px",
                    fontWeight: 700,
                  }}
                >
                  {renderRate(featuredSuite)}
                </p>
              </div>

              <div style={{ marginTop: "28px" }}>
                <button
                  type="button"
                  onClick={() => setSelectedSuite(featuredSuite)}
                  style={{
                    border: "none",
                    borderRadius: "999px",
                    padding: "15px 24px",
                    background: buttonBgColor,
                    color: buttonTextColor,
                    cursor: "pointer",
                    fontWeight: 600,
                    fontSize: "15px",
                  }}
                >
                  View Suite
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      {secondarySuites.length > 0 && (
        <section
          style={{
            maxWidth: "1360px",
            margin: "0 auto",
            padding: activeResponsiveView === "mobile" ? "0 18px 48px" : "0 34px 60px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: activeResponsiveView === "mobile" ? "flex-start" : "center",
              justifyContent: "space-between",
              flexDirection: activeResponsiveView === "mobile" ? "column" : "row",
              gap: "10px",
              marginBottom: "22px",
            }}
          >
            <h3
              style={{
                margin: 0,
                fontSize: activeResponsiveView === "mobile" ? "26px" : "32px",
                letterSpacing: "-0.02em",
              }}
            >
              More Available Suites
            </h3>

            <div
              style={{
                color: mutedTextColor,
                fontSize: "13px",
                letterSpacing: "0.12em",
                textTransform: "uppercase",
              }}
            >
              Curated availability
            </div>
          </div>

          {loading && <p>Loading suites...</p>}
          {error && <p>{error}</p>}

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                activeResponsiveView === "mobile"
                  ? "1fr"
                  : "repeat(auto-fit, minmax(260px, 1fr))",
              gap: "22px",
            }}
          >
            {secondarySuites.map((suite, index) => (
              <article
                key={suite.id || index}
                onClick={() => setSelectedSuite(suite)}
                style={{
                  background: surfaceColor,
                  borderRadius: "26px",
                  overflow: "hidden",
                  cursor: "pointer",
                  border: `1px solid ${borderColor}`,
                  boxShadow: "0 10px 28px rgba(0,0,0,0.05)",
                }}
              >
                <div
                  style={{
                    height: activeResponsiveView === "mobile" ? "220px" : "280px",
                    background: softBlockColor,
                  }}
                >
                  {suite.imageUrl ? (
                    <img
                      src={suite.imageUrl}
                      alt={suite.name || "Suite"}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        display: "block",
                      }}
                    />
                  ) : null}
                </div>

                <div style={{ padding: "22px" }}>
                  <div
                    style={{
                      color: accentColor,
                      fontSize: "11px",
                      letterSpacing: "0.14em",
                      textTransform: "uppercase",
                      marginBottom: "10px",
                    }}
                  >
                    {fmtDate(suite.availableDate)}
                  </div>

                  <h4
                    style={{
                      margin: "0 0 8px",
                      fontSize: "24px",
                      lineHeight: 1.08,
                    }}
                  >
                    {suite.name || "Suite"}
                  </h4>

                  <div
                    style={{
                      color: mutedTextColor,
                      marginBottom: "14px",
                      fontSize: "15px",
                    }}
                  >
                    {renderRate(suite)}
                  </div>

                  <div
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "8px",
                      fontSize: "14px",
                      fontWeight: 600,
                    }}
                  >
                    View details <span>→</span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {selectedSuite && (
        <div
          onClick={() => setSelectedSuite(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: activeResponsiveView === "mobile" ? "14px" : "24px",
            boxSizing: "border-box",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(980px, 100%)",
              maxHeight: "92vh",
              overflowY: "auto",
              background: surfaceColor,
              borderRadius: "28px",
              border: `1px solid ${borderColor}`,
              boxShadow: "0 24px 80px rgba(0,0,0,0.22)",
              position: "relative",
            }}
          >
            <button
              type="button"
              onClick={() => setSelectedSuite(null)}
              style={{
                position: "absolute",
                top: "18px",
                right: "18px",
                border: "none",
                background: "rgba(255,255,255,0.92)",
                width: "42px",
                height: "42px",
                borderRadius: "999px",
                fontSize: "26px",
                lineHeight: 1,
                cursor: "pointer",
                zIndex: 3,
                color: textColor,
              }}
            >
              ×
            </button>

            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  activeResponsiveView === "mobile" ? "1fr" : "1.1fr 0.9fr",
              }}
            >
              <div
                style={{
                  minHeight: activeResponsiveView === "mobile" ? "260px" : "640px",
                  background: softBlockColor,
                }}
              >
                {selectedSuite.imageUrl ? (
                  <img
                    src={selectedSuite.imageUrl}
                    alt={selectedSuite.name || "Suite"}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      display: "block",
                    }}
                  />
                ) : null}
              </div>

              <div
                style={{
                  padding: activeResponsiveView === "mobile" ? "22px" : "34px",
                }}
              >
                <div
                  style={{
                    color: accentColor,
                    fontSize: "12px",
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    marginBottom: "12px",
                  }}
                >
                  Signature Suite
                </div>

                <h2
                  style={{
                    margin: "0 0 12px",
                    fontSize: activeResponsiveView === "mobile" ? "34px" : "44px",
                    lineHeight: 1,
                  }}
                >
                  {selectedSuite.name || "Suite"}
                </h2>

                <p
                  style={{
                    color: mutedTextColor,
                    margin: "0 0 10px",
                    fontSize: "16px",
                  }}
                >
                  Available {fmtDate(selectedSuite.availableDate)}
                </p>

                <p
                  style={{
                    fontWeight: 700,
                    fontSize: "20px",
                    marginTop: 0,
                    marginBottom: "22px",
                  }}
                >
                  {renderRate(selectedSuite)}
                </p>

                <button
                  type="button"
                  onClick={() => setAppModalOpen(true)}
                  style={{
                    border: "none",
                    borderRadius: "999px",
                    padding: "15px 24px",
                    background: buttonBgColor,
                    color: buttonTextColor,
                    cursor: "pointer",
                    fontWeight: 600,
                    fontSize: "15px",
                  }}
                >
                  Apply for this suite
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {appModalOpen && selectedSuite && (
        <div
          onClick={() => setAppModalOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10000,
            padding: activeResponsiveView === "mobile" ? "14px" : "24px",
            boxSizing: "border-box",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(920px, 100%)",
              maxHeight: "92vh",
              overflowY: "auto",
              background: surfaceColor,
              borderRadius: "28px",
              border: `1px solid ${borderColor}`,
              padding: activeResponsiveView === "mobile" ? "20px" : "30px",
              boxShadow: "0 24px 80px rgba(0,0,0,0.22)",
              position: "relative",
            }}
          >
            <button
              type="button"
              onClick={() => setAppModalOpen(false)}
              style={{
                position: "absolute",
                top: "16px",
                right: "16px",
                border: "none",
                background: "transparent",
                fontSize: "30px",
                lineHeight: 1,
                cursor: "pointer",
                color: textColor,
              }}
            >
              ×
            </button>

            <h2
              style={{
                marginTop: 0,
                marginBottom: "18px",
                fontSize: activeResponsiveView === "mobile" ? "28px" : "36px",
              }}
            >
              Application for {selectedSuite.name || "Suite"}
            </h2>

            <div style={{ marginBottom: "24px" }}>
              <label style={{ display: "block", marginBottom: "8px", fontWeight: 600 }}>
                Full name
              </label>
              <input
                type="text"
                value={applicantName}
                onChange={(e) => setApplicantName(e.target.value)}
                placeholder="Enter your full name"
                style={{
                  width: "100%",
                  minHeight: "46px",
                  padding: "10px 14px",
                  border: "1px solid #d0d7de",
                  borderRadius: "12px",
                  boxSizing: "border-box",
                  fontSize: "15px",
                  background: "#fff",
                }}
              />
            </div>

            <div style={{ marginBottom: "24px" }}>
              <label style={{ display: "block", marginBottom: "8px", fontWeight: 600 }}>
                Email address
              </label>
              <input
                type="email"
                value={applicantEmail}
                onChange={(e) => setApplicantEmail(e.target.value)}
                placeholder="Enter your email"
                style={{
                  width: "100%",
                  minHeight: "46px",
                  padding: "10px 14px",
                  border: "1px solid #d0d7de",
                  borderRadius: "12px",
                  boxSizing: "border-box",
                  fontSize: "15px",
                  background: "#fff",
                }}
              />
            </div>

            {appSections.map((section) => (
              <div key={section.id} style={{ marginBottom: "28px" }}>
                <div
                  style={{
                    background: "#f6f2ed",
                    borderRadius: "14px",
                    padding: "14px 16px",
                    marginBottom: "18px",
                    fontWeight: 600,
                  }}
                >
                  {section.title}
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      activeResponsiveView === "mobile" ? "1fr" : "240px 1fr",
                    gap: "16px 24px",
                    alignItems: activeResponsiveView === "mobile" ? "stretch" : "center",
                  }}
                >
                  {section.questions.map((q: AppQuestion) => (
                    <Fragment key={q.id}>
                      <label style={{ fontWeight: 500 }}>{q.label}</label>

                      {q.type === "textarea" ? (
                        <textarea
                          value={appAnswers[q.id] || ""}
                          onChange={(e) =>
                            setAppAnswers((prev) => ({
                              ...prev,
                              [q.id]: e.target.value,
                            }))
                          }
                          placeholder={q.placeholder || ""}
                          style={{
                            width: "100%",
                            minHeight: "110px",
                            padding: "10px 14px",
                            border: "1px solid #d0d7de",
                            borderRadius: "12px",
                            boxSizing: "border-box",
                            fontSize: "15px",
                            background: "#fff",
                            resize: "vertical",
                          }}
                        />
                      ) : (
                        <input
                          type={q.type === "date" ? "date" : "text"}
                          value={appAnswers[q.id] || ""}
                          onChange={(e) =>
                            setAppAnswers((prev) => ({
                              ...prev,
                              [q.id]: e.target.value,
                            }))
                          }
                          placeholder={q.placeholder || ""}
                          style={{
                            width: "100%",
                            minHeight: "46px",
                            padding: "10px 14px",
                            border: "1px solid #d0d7de",
                            borderRadius: "12px",
                            boxSizing: "border-box",
                            fontSize: "15px",
                            background: "#fff",
                          }}
                        />
                      )}
                    </Fragment>
                  ))}
                </div>
              </div>
            ))}

            {appSubmitError && (
              <p style={{ color: "#b00020", marginTop: "12px" }}>
                {appSubmitError}
              </p>
            )}

            {appSubmitDone && !appSubmitError && (
              <p style={{ color: "green", marginTop: "12px" }}>
                Application submitted successfully!
              </p>
            )}

            <div style={{ marginTop: "24px", display: "flex", gap: "12px" }}>
              <button
                type="button"
                onClick={() => setAppModalOpen(false)}
                style={{
                  padding: "12px 20px",
                  borderRadius: "12px",
                  border: "1px solid #ccc",
                  background: "#fff",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleSubmitApplication}
                disabled={appSubmitting}
                style={{
                  padding: "12px 20px",
                  border: "none",
                  borderRadius: "12px",
                  background: buttonBgColor,
                  color: buttonTextColor,
                  cursor: "pointer",
                  fontSize: "16px",
                  fontWeight: 600,
                  opacity: appSubmitting ? 0.6 : 1,
                }}
              >
                {appSubmitting ? "Submitting..." : "Submit Application"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}