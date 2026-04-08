//C:\Users\tiffa\OneDrive\Desktop\suiteseat-web\src\app\[slug]\SuiteTemplates\template1\Template.tsx


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
};

//Template Helpers
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

    const inputType = (row.inputType || "").toLowerCase();
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





////////////////////////////////////////////////
export default function Template1({
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



  //Template States
const [appSections, setAppSections] = useState<any[]>([]);
const [appAnswers, setAppAnswers] = useState<Record<string, string>>({});
const [appModalOpen, setAppModalOpen] = useState(false);
const [appSubmitting, setAppSubmitting] = useState(false);
const [appSubmitError, setAppSubmitError] = useState<string | null>(null);
const [appSubmitDone, setAppSubmitDone] = useState(false);
const [applicantName, setApplicantName] = useState("");
const [applicantEmail, setApplicantEmail] = useState("");

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
      typeof rawTemplate === "string"
        ? JSON.parse(rawTemplate)
        : rawTemplate;

    const sections = normalizeTemplateToSections(parsed);
    setAppSections(sections);
  } catch (err) {
    console.error("[template1] failed to parse suite application template", err);
    setAppSections([]);
  }
}, [selectedSuite]);


useEffect(() => {
  const updateResponsiveView = () => {
    setActiveResponsiveView(window.innerWidth <= 768 ? "mobile" : "desktop");
  };

  updateResponsiveView();
  window.addEventListener("resize", updateResponsiveView);

  return () => window.removeEventListener("resize", updateResponsiveView);
}, []);

  const v = business?.values || {};
const DEFAULT_TEMPLATE_COLORS = {
  pageBg: "#f7f4ef",
  cardBg: "#ffffff",
  text: "#111111",
  mutedText: "#555555",
  accent: "#efb37c",
  buttonBg: "#111111",
  buttonText: "#ffffff",
};

const pageBgColor =
  v["Background Color"] ||
  v.bgColor ||
  DEFAULT_TEMPLATE_COLORS.pageBg;

const cardBgColor =
  v["Card Background Color"] ||
  v.cardBgColor ||
  DEFAULT_TEMPLATE_COLORS.cardBg;

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
  accentColor ||
  DEFAULT_TEMPLATE_COLORS.buttonBg;

const buttonTextColor =
  v["Button Text Color"] ||
  v.buttonTextColor ||
  DEFAULT_TEMPLATE_COLORS.buttonText;

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
    "";

  const visibleSuites = useMemo(() => {
    return (suites || []).filter((suite) => {
      const name = String(suite?.name || "").trim();
      const hasImage = !!suite?.imageUrl;
      const hasDate = !!suite?.availableDate;
      return name || hasImage || hasDate;
    });
  }, [suites]);

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



//Application Submit
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
    console.log("[template1] application saved response:", {
      status: res.status,
      body: text,
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    setAppSubmitting(false);
    setAppSubmitDone(true);
    setAppAnswers({});
    setAppModalOpen(false);

    // optional: close suite popup too
    // setSelectedSuite(null);
  } catch (err: any) {
    console.error("[template1] submit application error", err);
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
          maxWidth: "1200px",
          margin: "0 auto",
          padding: "32px 20px 20px",
        }}
      >
<div
  style={{
    display: "grid",
    gridTemplateColumns:
      activeResponsiveView === "mobile" ? "1fr" : "1.2fr 1fr",
    gap: "24px",
    alignItems: "stretch",
  }}
>
          <div
            style={{
minHeight: activeResponsiveView === "mobile" ? "280px" : "420px",
              borderRadius: "24px",
              overflow: "hidden",
              background: "#ddd",
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
                }}
              />
            ) : (
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "#e8e1d8",
                  fontSize: "20px",
                  fontWeight: 600,
                }}
              >
                {locationName}
              </div>
            )}
          </div>

<div
  style={{
    background: cardBgColor,
    borderRadius: "24px",
    padding: activeResponsiveView === "mobile" ? "24px" : "32px",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    boxShadow: "0 8px 24px rgba(0,0,0,0.06)",
  }}
>
            <div
              style={{
                fontSize: "14px",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                marginBottom: "12px",
                color: accentColor,
              }}
            >
              Suite Location
            </div>

<h1
  style={{
    fontSize: activeResponsiveView === "mobile" ? "38px" : "48px",
    lineHeight: 1,
    margin: "0 0 18px",
  }}
>
  {locationName}
</h1>

            <p
              style={{
                fontSize: "16px",
                lineHeight: 1.6,
                margin: 0,
                color: mutedTextColor,
              }}
            >
              {aboutText || "Explore available suites at this location."}
            </p>
          </div>
        </div>
      </section>

      <section
        style={{
          maxWidth: "1200px",
          margin: "0 auto",
          padding: "12px 20px 40px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "20px",
          }}
        >
          <h2 style={{ margin: 0, fontSize: "30px" }}>Available Suites</h2>
          <div style={{ color: mutedTextColor, fontSize: "14px" }}>
            {visibleSuites.length} suite{visibleSuites.length === 1 ? "" : "s"}
          </div>
        </div>

        {loading && <p>Loading suites...</p>}
        {error && <p>{error}</p>}
        {!loading && !error && visibleSuites.length === 0 && (
          <p>No suites available yet.</p>
        )}

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
  activeResponsiveView === "mobile"
    ? "1fr"
    : "repeat(auto-fit, minmax(260px, 1fr))",
            gap: "20px",
          }}
        >
          {visibleSuites.map((suite, index) => (
            <article
              key={suite.id || index}
              onClick={() => setSelectedSuite(suite)}
              style={{
                background: "#ffffff",
                borderRadius: "22px",
                overflow: "hidden",
                cursor: "pointer",
                boxShadow: "0 8px 24px rgba(0,0,0,0.06)",
              }}
            >
              <div
                style={{
                  height: "220px",
                  background: "#e9e3da",
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

              <div style={{ padding: "18px 18px 20px" }}>
                <h3
                  style={{
                    margin: "0 0 8px",
                    fontSize: "22px",
                  }}
                >
                  {suite.name || "Suite"}
                </h3>

                <div style={{ color: mutedTextColor, marginBottom: "8px" }}>
                  {fmtDate(suite.availableDate)}
                </div>

                <div
                  style={{
                    fontWeight: 700,
                    fontSize: "16px",
                  }}
                >
                  {renderRate(suite)}
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

{selectedSuite && (
  <div
    onClick={() => setSelectedSuite(null)}
    style={{
      position: "fixed",
      inset: 0,
      background: "rgba(0,0,0,0.45)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 9999,
      padding: "20px",
      boxSizing: "border-box",
    }}
  >
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        width: "min(900px, 100%)",
        maxHeight: "90vh",
        overflowY: "auto",
        background: cardBgColor,
        borderRadius: "24px",
        padding: activeResponsiveView === "mobile" ? "20px" : "28px",
        boxShadow: "0 20px 60px rgba(0,0,0,0.18)",
        position: "relative",
      }}
    >
      <button
        type="button"
        onClick={() => setSelectedSuite(null)}
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
          fontSize: activeResponsiveView === "mobile" ? "30px" : "34px",
        }}
      >
        {selectedSuite.name || "Suite"}
      </h2>

      {selectedSuite.imageUrl && (
        <div
          style={{
            width: "100%",
            height: activeResponsiveView === "mobile" ? "240px" : "360px",
            borderRadius: "20px",
            overflow: "hidden",
            marginBottom: "18px",
            background: "#e9e3da",
          }}
        >
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
        </div>
      )}

      <p style={{ color: mutedTextColor, marginBottom: "10px" }}>
        {fmtDate(selectedSuite.availableDate)}
      </p>

      <p style={{ fontWeight: 700, fontSize: "18px", marginTop: 0 }}>
        {renderRate(selectedSuite)}
      </p>

<button
  type="button"
  onClick={() => setAppModalOpen(true)}
  style={{
    marginTop: "8px",
    border: "none",
    borderRadius: "999px",
    padding: "14px 22px",
    background: buttonBgColor,
    color: buttonTextColor,
    cursor: "pointer",
    fontWeight: 600,
  }}
>
  Apply for this suite
</button>
    </div>
  </div>
)}



                                    {/* Template */}

{appModalOpen && selectedSuite && (
  <div
    onClick={() => setAppModalOpen(false)}
    style={{
      position: "fixed",
      inset: 0,
      background: "rgba(0,0,0,0.45)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 9999,
      padding: "20px",
      boxSizing: "border-box",
    }}
  >
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        width: "min(900px, 100%)",
        maxHeight: "90vh",
        overflowY: "auto",
        background: cardBgColor,
        borderRadius: "24px",
        padding: activeResponsiveView === "mobile" ? "20px" : "28px",
        boxShadow: "0 20px 60px rgba(0,0,0,0.18)",
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

      <h2 style={{ marginTop: 0, marginBottom: "18px" }}>
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
            minHeight: "44px",
            padding: "10px 14px",
            border: "1px solid #d0d7de",
            borderRadius: "10px",
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
            minHeight: "44px",
            padding: "10px 14px",
            border: "1px solid #d0d7de",
            borderRadius: "10px",
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
              background: "#f5f6f7",
              borderRadius: "12px",
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
                      borderRadius: "10px",
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
                      minHeight: "44px",
                      padding: "10px 14px",
                      border: "1px solid #d0d7de",
                      borderRadius: "10px",
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
            borderRadius: "10px",
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
  disabled={appSubmitting || appSections.length === 0}
  style={{
    padding: "12px 20px",
    border: "none",
    borderRadius: "10px",
    background: buttonBgColor,
    color: buttonTextColor,
    cursor: "pointer",
    fontSize: "16px",
    fontWeight: 600,
    opacity: appSubmitting || appSections.length === 0 ? 0.6 : 1,
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