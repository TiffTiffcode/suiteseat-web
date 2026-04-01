//C:\Users\tiffa\OneDrive\Desktop\suiteseat-web\src\app\[slug]\SuiteTemplates\custom\templateRenderer.ts
export function renderPublicTemplateFromJson(
  templateJson: any,
  sourceRecord: any,
  meta: any = {}
) {

const target = document.getElementById("public-template-render-target");
if (!target) {
  console.error("[template/render] No template render target found.");
  return;
}

const safeTarget = target as HTMLElement;

  safeTarget.innerHTML = ""

  const sourceRecordId =
    meta.sourceRecordId ||
    sourceRecord?._id ||
    sourceRecord?.id ||
    sourceRecord?.values?._id ||
    "";

  target.dataset.templateLoaded = "1";
  target.dataset.templateSession = meta.sessionId || "";
  target.dataset.sourceRecordId = String(sourceRecordId);
  target.dataset.templateField = meta.templateFieldName || "";

  const sections = templateJson?.sections || {};

  function createSectionContainer(title: string, sectionKey = "") {
    const sectionWrap = document.createElement("div");
    sectionWrap.className = "rendered-template-section";
    sectionWrap.dataset.sectionKey = sectionKey;
    sectionWrap.style.marginBottom = "24px";

    const heading = document.createElement("h3");
    heading.textContent = title;
    heading.style.margin = "20px 0 12px";

    sectionWrap.appendChild(heading);
    safeTarget.appendChild(sectionWrap);

    return sectionWrap;
  }

  function addFieldRow(field: any, index: number, sectionKey = "", sectionContainer: HTMLElement) {
    const wrap = document.createElement("div");
    wrap.className = "rendered-template-field";
    wrap.style.marginBottom = "12px";

    const label = document.createElement("label");
    label.textContent = field?.label || field?.key || `Field ${index + 1}`;
    label.style.display = "block";
    label.style.marginBottom = "6px";

    let input: HTMLInputElement | HTMLTextAreaElement;
    const rawType = String(field?.inputType || field?.type || "").toLowerCase();

    if (rawType.includes("textarea")) {
      input = document.createElement("textarea");
    } else {
      input = document.createElement("input");

      if (rawType.includes("date")) {
        input.type = "date";
      } else if (rawType.includes("email")) {
        input.type = "email";
      } else if (rawType.includes("number")) {
        input.type = "number";
      } else {
        input.type = "text";
      }
    }

    input.dataset.templateField = field?.key || `${sectionKey}_field_${index}`;
    input.dataset.templateSection = sectionKey;
    input.placeholder = field?.label || "";
    input.style.width = "100%";
    input.style.padding = "8px";

    if (field?.required) input.required = true;
    if (field?.value != null) input.value = field.value;

    wrap.appendChild(label);
    wrap.appendChild(input);
    sectionContainer.appendChild(wrap);
  }

  if (Array.isArray(sections.applicant) && sections.applicant.length) {
    const applicantSection = createSectionContainer("Applicant Information", "applicant");
    sections.applicant.forEach((field: any, index: number) => {
      addFieldRow(field, index, "applicant", applicantSection);
    });
  }

  if (Array.isArray(sections.experience) && sections.experience.length) {
    const experienceSection = createSectionContainer("Experience", "experience");
    sections.experience.forEach((field: any, index: number) => {
      addFieldRow(field, index, "experience", experienceSection);
    });
  }

  if (Array.isArray(sections.custom) && sections.custom.length) {
    sections.custom.forEach((section: any, sectionIndex: number) => {
      const sectionKey = section?.sectionKey || `custom_${sectionIndex}`;
      const customSection = createSectionContainer(
        section?.title || `Custom Section ${sectionIndex + 1}`,
        sectionKey
      );

      const rows = Array.isArray(section?.rows) ? section.rows : [];
      rows.forEach((field: any, index: number) => {
        addFieldRow(field, index, sectionKey, customSection);
      });
    });
  }

  const submitWrap = document.createElement("div");
  submitWrap.className = "rendered-template-submit-wrap";
  submitWrap.style.marginTop = "24px";

  const submitBtn = document.createElement("button");
  submitBtn.type = "button";
  submitBtn.textContent = "Submit Application";
  submitBtn.className = "rendered-template-submit-btn";
  submitBtn.style.padding = "12px 20px";
  submitBtn.style.border = "none";
  submitBtn.style.borderRadius = "10px";
  submitBtn.style.background = "black";
  submitBtn.style.color = "white";
  submitBtn.style.cursor = "pointer";

  submitBtn.addEventListener("click", async () => {
    const allInputs = target.querySelectorAll("[data-template-field]");
    const formValues: Record<string, string> = {};

    allInputs.forEach((input: any) => {
      const key = input.dataset.templateField;
      formValues[key] = input.value;
    });

    console.log("[template/submit] submitted values:", formValues);
    alert("Application submitted.");
  });

  submitWrap.appendChild(submitBtn);
  target.appendChild(submitWrap);
}