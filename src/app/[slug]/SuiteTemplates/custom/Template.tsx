//C:\Users\tiffa\OneDrive\Desktop\suiteseat-web\src\app\[slug]\SuiteTemplates\custom\Template.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import "../../styles/SuitePage/custom.css";



export default function CustomTemplate({
  
  business,
  suites,
  loading,
  error,
  pageJson,
}: {
  business: any;
  suites: any[];
  loading: boolean;
  error: string | null;
  pageJson: any;
}) {
const initialViewKey = pageJson?.views?.default
  ? "default"
  : pageJson?.currentView || "default";

const [activeViewKey, setActiveViewKey] = useState(initialViewKey);


// public page responsive mode
const [activeResponsiveView, setActiveResponsiveView] = useState<"desktop" | "mobile">("desktop");

 useEffect(() => {
    const updateResponsiveView = () => {
      setActiveResponsiveView(window.innerWidth <= 768 ? "mobile" : "desktop");
    };

    updateResponsiveView();
    window.addEventListener("resize", updateResponsiveView);

    return () => window.removeEventListener("resize", updateResponsiveView);
  }, []);
//Parallax Helper
const [scrollY, setScrollY] = useState(0);

//Parallax
useEffect(() => {
  const scrollEl = document.querySelector(".custom-page");

  if (!scrollEl) return;

  const onScroll = () => {
    setScrollY(scrollEl.scrollTop || 0);
  };

  onScroll();
  scrollEl.addEventListener("scroll", onScroll);

  return () => scrollEl.removeEventListener("scroll", onScroll);
}, []);

const currentView = pageJson?.views?.[activeViewKey] || null;

// fallback for old saved pages that still use .items
const elements = Array.isArray(currentView?.[activeResponsiveView]?.items)
  ? currentView[activeResponsiveView].items
  : Array.isArray(currentView?.items)
  ? currentView.items
  : [];
const [activePopupKey, setActivePopupKey] = useState<string | null>(null);

//Canvas Width
const canvasWidth = Math.max(
  activeResponsiveView === "mobile" ? 390 : 1200,
  ...elements.map((el: any) => Number(el?.x || 0) + Number(el?.w || 0))
);

const canvasHeight = Math.max(
  600,
  ...elements.map((el: any) => Number(el?.y || 0) + Number(el?.h || 0))
);



//Template Helper
const [appSections, setAppSections] = useState<any[]>([]);
const [appAnswers, setAppAnswers] = useState<Record<string, string>>({});
const [appModalOpen, setAppModalOpen] = useState(false);
const [appSubmitting, setAppSubmitting] = useState(false);
const [appSubmitError, setAppSubmitError] = useState<string | null>(null);
const [appSubmitDone, setAppSubmitDone] = useState(false);
const [applicantName, setApplicantName] = useState("");
const [applicantEmail, setApplicantEmail] = useState("");
const [selectedSuiteForApplication, setSelectedSuiteForApplication] = useState<any | null>(null);


function getFieldValueFromSourceRecord(record: any, fieldName: string) {
  if (!record || !fieldName) return null;

  return (
    record?.values?.[fieldName] ??
    record?.rawRecord?.values?.[fieldName] ??
    record?.rawRecord?.[fieldName] ??
    record?.[fieldName] ??
    null
  );
}

function getRecordId(record: any) {
  return String(
    record?._id ||
    record?.id ||
    record?.values?._id ||
    ""
  );
}

function getSelectedRecordFromGroupItem(groupItem: any) {
  if (!groupItem) return null;

  const groupData = groupItem?.data || {};

  const selectedId =
    groupData?.selectedItemId ||
    groupData?.selectedRecordId ||
    "";

  if (!selectedId) return null;

  const selectedIdStr = String(selectedId);

  const matchedSuite = (suites || []).find((suite: any) => {
    return getRecordId(suite) === selectedIdStr;
  });

  return matchedSuite || null;
}



const allViewItems = Object.values(pageJson?.views || {}).flatMap((view: any) => {
  if (Array.isArray(view?.desktop?.items) && Array.isArray(view?.mobile?.items)) {
    return [...view.desktop.items, ...view.mobile.items];
  }
  if (Array.isArray(view?.desktop?.items)) return view.desktop.items;
  if (Array.isArray(view?.mobile?.items)) return view.mobile.items;
  if (Array.isArray(view?.items)) return view.items;
  return [];
});

const activePopupEl = activePopupKey
  ? allViewItems.find((item: any) => String(item?.id || "") === activePopupKey)
  : null;

const popupItems = activePopupEl
  ? allViewItems.filter(
      (item: any) => String(item?.parent || "") === String(activePopupEl.id || "")
    )
  : [];

function rowsToQuestions(rows: any[]) {
  return (rows || []).map((row: any, idx: number) => {
    const rawType = String(row?.inputType || row?.type || "").toLowerCase();

    let type = "text";

    if (rawType.includes("textarea")) type = "textarea";
    else if (rawType.includes("date")) type = "date";
    else if (rawType.includes("email")) type = "email";
    else if (rawType.includes("number")) type = "number";

    return {
      id: row?.key || `q_${idx}`,
      label: row?.label || row?.key || `Question ${idx + 1}`,
      type,
      required: !!row?.required,
      placeholder: row?.label || "",
    };
  });
}

function normalizeTemplateToSections(raw: any) {
  const sections: any[] = [];

  if (!raw?.sections) return sections;

  if (Array.isArray(raw.sections.applicant)) {
    sections.push({
      id: "applicant",
      title: "Applicant Information",
      questions: rowsToQuestions(raw.sections.applicant),
    });
  }

  if (Array.isArray(raw.sections.experience)) {
    sections.push({
      id: "experience",
      title: "Experience",
      questions: rowsToQuestions(raw.sections.experience),
    });
  }

  if (Array.isArray(raw.sections.custom)) {
    raw.sections.custom.forEach((section: any, index: number) => {
      sections.push({
        id: section?.sectionKey || `custom_${index}`,
        title: section?.title || `Section ${index + 1}`,
        questions: rowsToQuestions(section?.rows || []),
      });
    });
  }

  return sections;
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  minHeight: "44px",
  padding: "10px 14px",
  border: "1px solid #d0d7de",
  borderRadius: "10px",
  boxSizing: "border-box",
  fontSize: "15px",
  background: "#fff",
};

const locationName =
  business?.name ||
  business?.values?.["Location Name"] ||
  "Location";

const locationLogo =
  business?.logo ||
  business?.values?.["Logo"] ||
  business?.values?.["Location Logo"] ||
  business?.values?.["Business Logo"] ||
  "";

const suiteDisplayName =
  selectedSuiteForApplication?.name ||
  selectedSuiteForApplication?.values?.["Suite Name"] ||
  "Suite";

const locationInitial = String(locationName).trim().charAt(0).toUpperCase();

  //Element Functions
function handleElementAction(element: any) {
  const data = element?.data || {};

  const rawActionType =
    data?.actionType ||
    data?.action ||
    data?.clickAction ||
    "";

  const actionType = String(rawActionType).toLowerCase().trim();

  const actionTarget =
    data?.actionTarget ||
    data?.target ||
    data?.targetView ||
    data?.viewKey ||
    "";

  console.log("[public/action] rawActionType:", rawActionType);
  console.log("[public/action] actionType:", actionType);
  console.log("[public/action] actionTarget:", actionTarget);
  console.log("[public/action] data:", data);

  // CHANGE VIEW
  if (
    actionType === "change-view" ||
    actionType === "change view" ||
    actionType === "switch-view" ||
    actionType === "switch view" ||
    actionType === "go-to-view" ||
    actionType === "open-view"
  ) {
    const normalizedTarget = String(actionTarget).trim().toLowerCase();

    const matchingViewKey = Object.keys(pageJson?.views || {}).find(
      (key) => key.toLowerCase() === normalizedTarget
    );

    if (matchingViewKey) {
      setActiveViewKey(matchingViewKey);
      return;
    }

    console.warn("[public/action] target view not found:", actionTarget);
    return;
  }

  // OPEN POPUP
  if (
    actionType === "open-popup" ||
    actionType === "open popup"
  ) {
    const popupTarget = String(actionTarget || "").trim();
    if (!popupTarget) {
      console.warn("[public/action] missing popup target:", data);
      return;
    }

    // Find popup element in the CURRENT saved page items by popupId first,
    // then fall back to matching element id.
const allViewItems = Object.values(pageJson?.views || {}).flatMap((view: any) => {
  if (Array.isArray(view?.desktop?.items) && Array.isArray(view?.mobile?.items)) {
    return [...view.desktop.items, ...view.mobile.items];
  }
  if (Array.isArray(view?.desktop?.items)) return view.desktop.items;
  if (Array.isArray(view?.mobile?.items)) return view.mobile.items;
  if (Array.isArray(view?.items)) return view.items;
  return [];
});

    const popupElement = allViewItems.find((item: any) => {
      if (item?.type !== "popup") return false;

      const popupId = String(item?.data?.popupId || "").trim();
      const itemId = String(item?.id || "").trim();

      return popupId === popupTarget || itemId === popupTarget;
    });

    if (popupElement) {
      setActivePopupKey(String(popupElement.id));
      return;
    }

    console.warn("[public/action] popup target not found:", popupTarget);
    return;
  }

  // OPEN LINK
  if (
    actionType === "link" ||
    actionType === "open-link" ||
    actionType === "open link"
  ) {
    const linkTarget =
      data?.href ||
      data?.url ||
      data?.linkUrl ||
      data?.link ||
      actionTarget ||
      "";

    if (!linkTarget) {
      console.warn("[public/action] missing link target:", data);
      return;
    }

    const finalUrl = /^https?:\/\//i.test(linkTarget)
      ? linkTarget
      : `https://${linkTarget}`;

    window.open(finalUrl, "_blank", "noopener,noreferrer");
    return;
  }

  // SCROLL TO SECTION
  if (
    actionType === "scroll-to-section" ||
    actionType === "scroll to section"
  ) {
    const targetId = String(actionTarget || "").trim();
    if (!targetId) return;

    const sectionEl = document.querySelector(`[data-id="${targetId}"]`);
    if (sectionEl) {
      (sectionEl as HTMLElement).scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    } else {
      console.warn("[public/action] section not found:", targetId);
    }
    return;
  }

  // DOWNLOAD PDF
  if (actionType === "download-pdf" || actionType === "download pdf") {
    if (!actionTarget) return;

    const a = document.createElement("a");
    a.href = actionTarget;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.download = "";
    document.body.appendChild(a);
    a.click();
    a.remove();
    return;
  }

  // SUBMIT FORM
  if (actionType === "submit-form" || actionType === "submit form") {
    console.log("[public/action] submit-form not wired yet");
    return;
  }

// OPEN TEMPLATE
if (actionType === "open-template" || actionType === "open template") {
  const actionSource = String(data?.actionSource || "page").trim().toLowerCase();
  const templateFieldName = String(actionTarget || "").trim();

  console.log("[public/action] open-template clicked:", {
    templateFieldName,
    actionSource,
  });

  if (!templateFieldName) {
    console.warn("[public/action] missing template field name");
    return;
  }

  let sourceRecord: any = null;

  if (actionSource === "page") {
    sourceRecord = business;
  }

  if (actionSource === "parentgroup" || actionSource === "parent-group") {
    const parentId = String(element?.parent || "").trim();

    const parentGroupItem = allViewItems.find(
      (item: any) => String(item?.id || "") === parentId
    );

    console.log("[public/action] parentGroup item:", parentGroupItem);

    sourceRecord = getSelectedRecordFromGroupItem(parentGroupItem);

    console.log("[public/action] parentGroup sourceRecord:", sourceRecord);
  }

  if (!sourceRecord) {
    console.warn("[public/action] no source record found for template");
    return;
  }

  const rawTemplateValue = getFieldValueFromSourceRecord(sourceRecord, templateFieldName);

  console.log("[public/action] raw template value:", rawTemplateValue);

  if (!rawTemplateValue) {
    console.warn("[public/action] no template found in field:", templateFieldName);
    return;
  }

  try {
    const parsedTemplate =
      typeof rawTemplateValue === "string"
        ? JSON.parse(rawTemplateValue)
        : rawTemplateValue;

const sections = normalizeTemplateToSections(parsedTemplate);

setAppSections(sections);
setSelectedSuiteForApplication(sourceRecord);
setAppAnswers({});
setApplicantName("");
setApplicantEmail("");
setAppSubmitError(null);
setAppSubmitDone(false);
setAppModalOpen(true);

  } catch (err) {
    console.error("[public/action] failed to parse template:", err);
  }

  return;
}

  // NO ACTION
  if (actionType === "no-action" || actionType === "no action" || !actionType) {
    return;
  }

  console.warn("[public/action] unsupported action:", actionType);
}

const elementMap = useMemo(() => {
  const map = new Map<string, any>();

  (elements || []).forEach((el: any) => {
    const id = String(el?.id || "");
    if (id) map.set(id, el);
  });

  return map;
}, [elements]);
function getParallaxStrength(element: any) {
  let total = parseFloat(element?.data?.parallax || "0") || 0;

  let parentId = String(element?.parent || "").trim();
  let guard = 0;

  while (parentId && guard < 20) {
    const parent = elementMap.get(parentId);
    if (!parent) break;

    total += parseFloat(parent?.data?.parallax || "0") || 0;
    parentId = String(parent?.parent || "").trim();
    guard += 1;
  }

  return total;
}

function getParallaxStyle(element: any): React.CSSProperties {
  const strength = getParallaxStrength(element);
  if (!strength) return {};

  const offset = -scrollY * strength;

  return {
    transform: `translateY(${offset}px)`,
    willChange: "transform",
  };
}

  function renderElement(element: any, index: number) {
    const key = element?.id || index;
    const type = element?.type;
    const data = element?.data || {};
if (data?.hidden === "1") {
  return null;
}
const isHeader = type === "header";

const isNearFullWidth =
  !element?.parent &&
  Number(element?.x || 0) <= 30 &&
  Number(element?.w || 0) >= canvasWidth - 80;

const style: React.CSSProperties = {
  position: "absolute",
  left: isHeader ? "0px" : `${element?.x || 0}px`,
  top: `${element?.y || 0}px`,
  width:
    isHeader || isNearFullWidth
      ? "100%"
      : `${element?.w || 0}px`,
  height: `${element?.h || "auto"}px`,
  zIndex: element?.z || 1,
};

const parallaxStyle = getParallaxStyle(element);

    if (type === "text") {
      return (
        <div
          key={key}
style={{
  ...style,
  ...parallaxStyle,
  fontSize: `${data?.fontSize || 16}px`,
  fontFamily: data?.fontFamily || "system-ui",
  fontWeight: data?.bold === "1" ? 700 : 400,
  fontStyle: data?.italic === "1" ? "italic" : "normal",
  textDecoration: data?.underline === "1" ? "underline" : "none",
  textAlign: data?.align || "left",
  color: data?.color || "#111111",
}}
        >
          {data?.text || "Text"}
        </div>
      );
    }

    //Image Function 
if (type === "image") {
  const imageSrc =
    data?.src ||
    data?.url ||
    data?.imageUrl ||
    data?.image ||
    null;

  if (!imageSrc) {
    return null;
  }

  return (
    <img
      key={key}
      src={imageSrc}
      alt={data?.alt || "Image"}
style={{
  ...style,
  ...parallaxStyle,
  objectFit: data?.objectFit || "cover",
  borderRadius: `${data?.radius || 0}px`,
  display: "block",
}}
    />
  );
}

//Button Function
    if (type === "button") {
      return (
        <button
          key={key}
          type="button"
          onClick={() => handleElementAction(element)}
style={{
  ...style,
  ...parallaxStyle,
  background: data?.btnBg || "#111111",
  color: data?.btnTextColor || "#ffffff",
  borderWidth: `${data?.borderWidth || 0}px`,
  borderStyle: data?.borderStyle || "solid",
  borderColor: data?.borderColor || "#111111",
  borderRadius: `${data?.radius || 12}px`,
  cursor: "pointer",
}}
        >
          {data?.label || "Button"}
        </button>
      );
    }

if (type === "section" || type === "group" || type === "header") {
  const bgImage =
    data?.bgImage ||
    data?.backgroundImage ||
    data?.imageUrl ||
    data?.image ||
    "";

  const bgColor =
    data?.bgOn === "0"
      ? "transparent"
      : (data?.bg || (type === "header" ? "#ffffff" : "transparent"));

  const borderOn = data?.borderOn === "1";
  const borderWidth = Number(data?.borderWidth || 0);

  return (
    <div
      key={key}
      data-id={element?.id || ""}
style={{
  ...style,
  ...parallaxStyle,
  backgroundColor: bgColor,
  backgroundImage: bgImage ? `url(${bgImage})` : "none",
  backgroundSize: data?.backgroundSize || "cover",
  backgroundPosition: data?.backgroundPosition || "center",
  backgroundRepeat: "no-repeat",
  border:
    borderOn && borderWidth > 0
      ? `${borderWidth}px ${data?.borderStyle || "solid"} ${data?.borderColor || "#111111"}`
      : "none",
  borderRadius: `${data?.radius || 0}px`,
}}
    />
  );
}

//Video Function
if (type === "video") {
  const videoSrc =
    data?.src ||
    data?.url ||
    data?.videoUrl ||
    data?.video ||
    null;

  if (!videoSrc) {
    return null;
  }

  return (
    <video
      key={key}
      src={videoSrc}
      controls={false}
      autoPlay={true}
      muted={true}
      loop={true}
      playsInline
      style={{
        ...style,
        display: "block",
        objectFit: "cover",
        borderRadius: `${data?.radius || 0}px`,
        overflow: "hidden",
        background: "#000",
      }}
    />
  );
}


//Input Function
    if (type === "input") {
      return (
        <div key={key} style={style}>
          {data?.showLabel === "1" && (
            <label
              style={{
                display: "block",
                marginBottom: "6px",
                color: data?.labelColor || "#111111",
                fontSize: `${data?.labelSize || 14}px`,
                fontWeight: data?.labelWeight || 600,
              }}
            >
              {data?.label || "Label"}
            </label>
          )}

          <input
            type={data?.inputType || "text"}
            placeholder={data?.placeholder || ""}
            defaultValue={data?.value || ""}
            style={{
              width: "100%",
              height: "100%",
              background: data?.bg || "#ffffff",
              border: `${data?.borderWidth || 1}px ${data?.borderStyle || "solid"} ${data?.borderColor || "#111111"}`,
              borderRadius: `${data?.radius || 10}px`,
              padding: "10px 12px",
              boxSizing: "border-box",
            }}
          />
        </div>
      );
    }

    return null;
  }











//End 

return (
  <div
    className="custom-page"
    style={{
      height: "100vh",
      overflowY: "auto",
    }}
  >
    {loading && <p>Loading...</p>}
    {error && <p>{error}</p>}

<div
  className="custom-page-canvas"
  style={{
    position: "relative",
    width: activeResponsiveView === "mobile" ? "390px" : "100%",
    maxWidth: activeResponsiveView === "mobile" ? "390px" : `${canvasWidth}px`,
    minWidth: activeResponsiveView === "mobile" ? "390px" : `${canvasWidth}px`,
    minHeight: `${canvasHeight}px`,
    background: "#fff",
    zIndex: 1,
    margin: "0 auto",
    overflow: "visible",
  }}
>
      {Array.isArray(elements) && elements.length > 0 ? (
        elements.map((element: any, index: number) =>
          renderElement(element, index)
        )
      ) : (
        <p>No saved elements found.</p>
      )}
    </div>

    {activePopupKey && (
      <div
        className="custom-popup-overlay"
        onClick={() => setActivePopupKey(null)}
      >
        <div
          className="custom-popup-card"
          onClick={(e) => e.stopPropagation()}
          style={{
            position: "relative",
            width: "900px",
            minHeight: "500px",
            background: "#fff",
            borderRadius: "16px",
            overflow: "hidden",
          }}
        >
          <button
            type="button"
            onClick={() => setActivePopupKey(null)}
            style={{
              position: "absolute",
              top: "12px",
              right: "12px",
              zIndex: 20,
            }}
          >
            Close
          </button>

          <div
            style={{
              position: "relative",
              width: "100%",
              minHeight: "500px",
            }}
          >
            {Array.isArray(popupItems) && popupItems.length > 0
              ? popupItems.map((element: any, index: number) =>
                  renderElement(element, index)
                )
              : null}
          </div>
        </div>
      </div>
    )}
    

   













{appModalOpen && (
  <div
    className="public-template-overlay"
    onClick={() => setAppModalOpen(false)}
    style={{
      position: "fixed",
      inset: 0,
      background: "rgba(0,0,0,0.45)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 99999,
    }}
  >
    <div
      className="public-template-card"
      onClick={(e) => e.stopPropagation()}
      style={{
        position: "relative",
        zIndex: 100000,
        width: "min(1100px, 92vw)",
        maxHeight: "88vh",
        overflowY: "auto",
        background: "#fff",
        borderRadius: "24px",
        padding: "32px",
        boxSizing: "border-box",
        isolation: "isolate",
      }}
    >
      <div style={{ marginBottom: "28px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            marginBottom: "18px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "14px",
            }}
          >
            {locationLogo ? (
              <img
                src={locationLogo}
                alt={locationName}
                style={{
                  width: "64px",
                  height: "64px",
                  borderRadius: "999px",
                  objectFit: "cover",
                  display: "block",
                  flexShrink: 0,
                }}
              />
            ) : (
              <div
                style={{
                  width: "64px",
                  height: "64px",
                  borderRadius: "999px",
                  background: "#eef1f4",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "28px",
                  fontWeight: 700,
                  color: "#111111",
                  flexShrink: 0,
                }}
              >
                {locationInitial}
              </div>
            )}

            <div
              style={{
                fontSize: "14px",
                color: "#444",
                fontWeight: 500,
              }}
            >
              {locationName}
            </div>
          </div>

          <button
            type="button"
            onClick={() => setAppModalOpen(false)}
            style={{
              border: "none",
              background: "transparent",
              fontSize: "32px",
              lineHeight: 1,
              cursor: "pointer",
              color: "#111111",
              padding: 0,
              marginLeft: "24px",
              flexShrink: 0,
            }}
            aria-label="Close application"
          >
            ×
          </button>
        </div>

        <div
          style={{
            textAlign: "center",
            marginTop: "8px",
          }}
        >
          <div
            style={{
              fontSize: "18px",
              fontWeight: 500,
              marginBottom: "6px",
            }}
          >
            Application for
          </div>

          <div
            style={{
              fontSize: "42px",
              fontWeight: 700,
              lineHeight: 1.1,
            }}
          >
            {suiteDisplayName}
          </div>
        </div>
      </div>

      {appSubmitDone ? (
        <div
          style={{
            textAlign: "center",
            padding: "40px 20px 20px",
          }}
        >
          <div
            style={{
              fontSize: "22px",
              fontWeight: 700,
              marginBottom: "10px",
            }}
          >
            Application submitted successfully
          </div>

          <p
            style={{
              color: "#444",
              marginBottom: "24px",
            }}
          >
            Your application has been sent.
          </p>

          <button
            type="button"
            onClick={() => {
              setAppModalOpen(false);
              setAppSubmitDone(false);
              setAppAnswers({});
              setApplicantName("");
              setApplicantEmail("");
              setAppSubmitError(null);
            }}
            style={{
              padding: "12px 20px",
              border: "none",
              borderRadius: "10px",
              background: "#111111",
              color: "#ffffff",
              cursor: "pointer",
              fontSize: "16px",
              fontWeight: 600,
            }}
          >
            Close
          </button>
        </div>
      ) : (
        <>
          <div
            style={{
              background: "#f5f6f7",
              borderRadius: "12px",
              padding: "14px 16px",
              marginBottom: "20px",
              fontWeight: 600,
            }}
          >
            Your details
          </div>

<div
  style={{
    display: "grid",
    gridTemplateColumns:
      activeResponsiveView === "mobile" ? "1fr" : "240px 1fr",
    gap: "16px 24px",
    alignItems: activeResponsiveView === "mobile" ? "stretch" : "center",
    marginBottom: "28px",
  }}
>
            <label style={{ fontWeight: 500 }}>Full name</label>
            <input
              value={applicantName}
              onChange={(e) => setApplicantName(e.target.value)}
              placeholder="Enter your full name"
              style={inputStyle}
            />

            <label style={{ fontWeight: 500 }}>Email address</label>
            <input
              type="email"
              value={applicantEmail}
              onChange={(e) => setApplicantEmail(e.target.value)}
              placeholder="Enter your email"
              style={inputStyle}
            />
          </div>

          {appSections.map((section: any) => (
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
    marginBottom: "28px",
  }}
>
                {section.questions.map((question: any) => (
                  <React.Fragment key={question.id}>
                    <label style={{ fontWeight: 500 }}>{question.label}</label>

                    {question.type === "textarea" ? (
                      <textarea
                        value={appAnswers[question.id] || ""}
                        onChange={(e) =>
                          setAppAnswers((prev) => ({
                            ...prev,
                            [question.id]: e.target.value,
                          }))
                        }
                        placeholder={question.placeholder || ""}
                        style={{
                          ...inputStyle,
                          minHeight: "110px",
                          resize: "vertical",
                        }}
                      />
                    ) : (
                      <input
                        type={
                          question.type === "date"
                            ? "date"
                            : question.type === "email"
                            ? "email"
                            : question.type === "number"
                            ? "number"
                            : "text"
                        }
                        value={appAnswers[question.id] || ""}
                        onChange={(e) =>
                          setAppAnswers((prev) => ({
                            ...prev,
                            [question.id]: e.target.value,
                          }))
                        }
                        placeholder={question.placeholder || ""}
                        style={inputStyle}
                      />
                    )}
                  </React.Fragment>
                ))}
              </div>
            </div>
          ))}

          {appSubmitError && (
            <p style={{ color: "#b00020", marginTop: "12px" }}>
              {appSubmitError}
            </p>
          )}

          <div style={{ marginTop: "24px" }}>
            <button
              type="button"
              disabled={appSubmitting}
              onClick={async () => {
                try {
                  setAppSubmitting(true);
                  setAppSubmitError(null);

                  const suiteId =
                    selectedSuiteForApplication?._id ||
                    selectedSuiteForApplication?.id ||
                    selectedSuiteForApplication?.values?._id ||
                    "";

                  const payload = {
                    dataTypeName: "Suite Application Submission",
                    values: {
                      "Applicant Name": applicantName,
                      "Applicant Email": applicantEmail,
                      "Answers Json": JSON.stringify(appAnswers || {}),
                      Status: "Submitted",
                      "Submitted At": new Date().toISOString(),
                      Suite: { _id: suiteId },
                    },
                  };

                  const res = await fetch(
                    `${process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8400"}/api/public/submit-record`,
                    {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify(payload),
                    }
                  );

                  const data = await res.json().catch(() => ({}));

                  if (!res.ok) {
                    throw new Error(
                      data?.message || data?.error || "Failed to submit application"
                    );
                  }

                  setAppSubmitDone(true);
                } catch (err: any) {
                  setAppSubmitError(err.message || "Failed to submit application");
                } finally {
                  setAppSubmitting(false);
                }
              }}
              style={{
                padding: "12px 20px",
                border: "none",
                borderRadius: "10px",
                background: "#111111",
                color: "#ffffff",
                cursor: "pointer",
                fontSize: "16px",
                fontWeight: 600,
              }}
            >
              {appSubmitting ? "Submitting..." : "Submit Application"}
            </button>
          </div>
        </>
      )}
    </div>
  </div>
)}

  </div>
);

}

