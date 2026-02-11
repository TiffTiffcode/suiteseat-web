// src/app/[slug]/CourseTemplates/basic/Template.tsx
//src\app\[slug]\CourseTemplate\basic\Template.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8400";

// ✅ change these names if your DataTypes are named differently
const DT_COURSE = "Course";
const DT_SECTION = "CourseSection";
const DT_LESSON = "CourseLesson";
const DT_CHAPTER = "CourseChapter"; // optional (only used if you store chapters separately)

function unpackRows(payload: any): any[] {
  if (Array.isArray(payload)) return payload;
  return payload?.items || payload?.records || payload?.rows || [];
}

function refId(x: any): string {
  if (!x) return "";
  if (typeof x === "string") return x;
  return String(x._id || x.id || x.value || x.$id || x.reference || "");
}

function pickText(v: any, keys: string[], fallback = "") {
  for (const k of keys) {
    const val = v?.[k];
    if (val != null && String(val).trim()) return String(val).trim();
  }
  return fallback;
}

function resolveAsset(raw?: string | null) {
  if (!raw) return "";
  const s = String(raw).trim();
  if (!s) return "";
  if (/^https?:\/\//i.test(s)) return s;
  if (s.startsWith("/uploads/")) return `${API}${s}`;
  if (s.startsWith("/")) return s;
  return `${API}/uploads/${s}`;
}

export default function BasicCourseTemplate({ course }: { course: any }) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);


  const [loading, setLoading] = useState(true);
  const [courseRec, setCourseRec] = useState<any>(course || null);
  const [sections, setSections] = useState<any[]>([]);
  const [lessons, setLessons] = useState<any[]>([]);
  const [activeLessonId, setActiveLessonId] = useState<string | null>(null);
  const [chapters, setChapters] = useState<any[]>([]); // optional


    // ----------Check if user is logged in----------
useEffect(() => {
  let cancelled = false;

  async function checkSession() {
    try {
      // pick whichever route you already have for “current user”
      // common ones: /me, /api/me, /current-user
      const res = await fetch(`${API}/me`, {
        credentials: "include",
        headers: { Accept: "application/json" },
      });

      if (!cancelled) setIsLoggedIn(res.ok);
    } catch {
      if (!cancelled) setIsLoggedIn(false);
    }
  }

  checkSession();
  return () => { cancelled = true; };
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
  console.log("Course values keys:", Object.keys(courseV));
console.log("Secondary CTA raw:", courseV["Secondary CTA (button text)"], courseV["Secondary CTA"]);

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
    const res = await fetch(`${API}/login`, {
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
  } catch (err: any) {
    setIsLoggedIn(false);
    setLoginMsg(err?.message || "Network error logging in.");
  } finally {
    setLoginLoading(false);
  }
}

async function handleLogout() {
  try {
    await fetch(`${API}/logout`, { method: "POST", credentials: "include" });
  } catch {}
  setIsLoggedIn(false);
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


///////////////////////////////////////////////////////////////////////////////




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


  // ---------- load outline ----------
  useEffect(() => {
    let cancelled = false;

    async function loadOutline() {
      const courseId = courseRec?._id || courseRec?.id;
      if (!courseId) return;

      // Sections
      const secUrl = `${API}/public/records?dataType=${encodeURIComponent(DT_SECTION)}&Course=${encodeURIComponent(courseId)}&limit=200&ts=${Date.now()}`;
      const secRes = await fetch(secUrl, { cache: "no-store" });
      const secPayload = await secRes.json().catch(() => null);
      const secRows = unpackRows(secPayload);

      // Lessons (fetch all for course, then group by section)
      const lessonUrl = `${API}/public/records?dataType=${encodeURIComponent(DT_LESSON)}&Course=${encodeURIComponent(courseId)}&limit=500&ts=${Date.now()}`;
      const lessonRes = await fetch(lessonUrl, { cache: "no-store" });
      const lessonPayload = await lessonRes.json().catch(() => null);
      const lessonRows = unpackRows(lessonPayload);

      if (cancelled) return;

      setSections(Array.isArray(secRows) ? secRows : []);
      setLessons(Array.isArray(lessonRows) ? lessonRows : []);

      // default active lesson
      const firstLesson = Array.isArray(lessonRows) ? lessonRows[0] : null;
      if (firstLesson?._id) setActiveLessonId(String(firstLesson._id));
    }

    loadOutline();
    return () => { cancelled = true; };
  }, [courseRec?._id]);

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
  const lessonsBySection = useMemo(() => {
    const map: Record<string, any[]> = {};
    for (const l of lessons) {
      const v = l?.values || l || {};
      const sectionRef = v.Section || v.section || v.sectionId || "";
      const sid = refId(sectionRef);
      if (!sid) continue;
      if (!map[sid]) map[sid] = [];
      map[sid].push(l);
    }
    return map;
  }, [lessons]);

  const activeLesson = useMemo(() => {
    return lessons.find(l => String(l._id) === String(activeLessonId)) || null;
  }, [lessons, activeLessonId]);

  const activeLessonV = activeLesson?.values || activeLesson || {};
  const activeLessonTitle = pickText(activeLessonV, ["Title", "Name", "Lesson title"], "Lesson");
  const activeLessonDesc = pickText(activeLessonV, ["Description", "Desc"], "");

  // blocks: if you store blocks inside the lesson record
  const lessonBlocks = (activeLessonV.blocks || activeLessonV.Blocks || []) as any[];





// Starts At clock
const [cd, setCd] = useState({
  days: "00",
  hours: "00",
  minutes: "00",
  seconds: "00",
  ended: false,
});

useEffect(() => {
  if (!saleEndsAtISO) {
    setCd({ days: "00", hours: "00", minutes: "00", seconds: "00", ended: false });
    return;
  }

  let timer: any = null;

  const pad2 = (n: number) => String(n).padStart(2, "0");

  const tick = () => {
    const end = new Date(saleEndsAtISO as any).getTime();
    if (!Number.isFinite(end)) return;

    const diff = end - Date.now();

    if (diff <= 0) {
      setCd({ days: "00", hours: "00", minutes: "00", seconds: "00", ended: true });
      return;
    }

    const totalSeconds = Math.floor(diff / 1000);
    const daysNum = Math.floor(totalSeconds / 86400);
    const hoursNum = Math.floor((totalSeconds % 86400) / 3600);
    const minsNum = Math.floor((totalSeconds % 3600) / 60);
    const secsNum = totalSeconds % 60;

    const next = {
      days: String(daysNum), // days can be 1+ digits
      hours: pad2(hoursNum),
      minutes: pad2(minsNum),
      seconds: pad2(secsNum),
      ended: false,
    };

    setCd(next); // ✅ THIS WAS MISSING
  };

  tick(); // ✅ initial run
  timer = setInterval(tick, 1000);

  return () => timer && clearInterval(timer);
}, [saleEndsAtISO]);



function FlipUnit({ label, value }: { label: string; value: string }) {
  const [current, setCurrent] = React.useState(value);
  const [next, setNext] = React.useState(value);
  const [flipping, setFlipping] = React.useState(false);
  const timeoutRef = React.useRef<any>(null);

  React.useEffect(() => {
    if (value === current) return;

    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    setNext(value);
    setFlipping(true);

    timeoutRef.current = setTimeout(() => {
      setCurrent(value);
      setFlipping(false);
    }, 650);

    return () => timeoutRef.current && clearTimeout(timeoutRef.current);
  }, [value, current]);

  return (
    <div className="flipUnit">
      <div className={`flipCard ${flipping ? "is-flipping" : ""}`}>
        <div className="flipCard__half flipCard__half--top">
          <span>{current}</span>
        </div>
        <div className="flipCard__half flipCard__half--bottom">
          <span>{current}</span>
        </div>

        <div className="flipCard__flap flipCard__flap--top">
          <span>{current}</span>
        </div>
        <div className="flipCard__flap flipCard__flap--bottom">
          <span>{next}</span>
        </div>
      </div>

      <div className="flipUnit__label">{label}</div>
    </div>
  );
}



  return (
    <div className="course-wrap">
                      {/* =======================
                          Full Landing Page 
                       ======================= */}
      <div className="course-public">
{/* =======================
    Top Nav Header
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
        onClick={() => document.getElementById("home")?.scrollIntoView({ behavior: "smooth", block: "start" })}
      >
        Home
      </button>

      <button
        type="button"
        className="course-tab"
        onClick={() => document.getElementById("outline")?.scrollIntoView({ behavior: "smooth", block: "start" })}
      >
        Course Outline
      </button>

      <button
        type="button"
        className="course-tab"
        onClick={() => document.getElementById("about")?.scrollIntoView({ behavior: "smooth", block: "start" })}
      >
        About
      </button>
    </nav>

    {/* Right buttons */}
    <div className="course-topnav__right">
      <a
        className="btn btn-primary"
        href={primaryCtaUrl || "#"}
        onClick={(e) => {
          if (!primaryCtaUrl) {
            e.preventDefault();
            alert("Add a Primary CTA URL in course settings first.");
          }
        }}
      >
        Buy Now
      </a>

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
                           Landing Page
                     ======================= */}
<section className="course-landingHero" id="home">
  <div className="course-landingHero__inner">
    {/* =======================
    Headliners
======================= */}
    {/* LEFT: Headline */}
    <div className="course-landingHero__left">
      {headlineRich ? (
        <div
          className="course-landingHero__headlineRich"
          dangerouslySetInnerHTML={{ __html: headlineRich }}
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
          dangerouslySetInnerHTML={{ __html: subheadlineRich }}
        />
      ) : subheadlineText ? (
        <p className="course-landingHero__subheadline">{subheadlineText}</p>
      ) : (
        <p className="course-landingHero__subheadline muted">
          {/* optional fallback */}
          {desc || ""}
        </p>
      )}
    </div>
  </div>
</section>





                        {/* =======================
                                Primary Cta
                        ======================= */}
{/* ---------- CTA (right after headline/subheadline) ---------- */}
<section className="course-ctaBar" aria-label="Primary call to action">
  <div className="course-ctaBar__inner">
    <div className="course-ctaBar__left">
      {/* ✅ show what user entered in settings */}
      {primaryCtaRichHtml ? (
        <div
          className="course-ctaBar__copy"
          dangerouslySetInnerHTML={{ __html: primaryCtaRichHtml }}
        />
      ) : ctaTextPlain ? (
        <div className="course-ctaBar__copy">{ctaTextPlain}</div>
      ) : null}
    </div>

    
  </div>
</section>



                        {/* =======================
                              Sale Ends at clock
                        ======================= */}
{saleEndsAtISO ? (
  <section className="flipCountdown">
    <div className="flipCountdown__title">Sale Ends In</div>

    <div className="flipCountdown__grid">
      <FlipUnit label="Days" value={cd.days} />
      <FlipUnit label="Hours" value={cd.hours} />
      <FlipUnit label="Minutes" value={cd.minutes} />
      <FlipUnit label="Seconds" value={cd.seconds} />
    </div>

    {cd.ended ? <div className="flipCountdown__ended">Sale ended</div> : null}
  </section>
) : null}


                       {/* =======================
                              Secondary CTa
                        ======================= */}

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
            dangerouslySetInnerHTML={{ __html: secondaryCtaRich }}
          />
        ) : (
          secondaryCtaText
        )}
      </button>
    </div>
  </section>
) : null}





                       {/* =======================
                              Sales Copy 
                        ======================= */}
{(salesCopyRich || salesCopyText) ? (
  <section className="course-salesCopy" aria-label="Sales copy">
    <div className="course-salesCopy__inner">
      {salesCopyRich ? (
        <div
          className="course-salesCopy__rich"
          dangerouslySetInnerHTML={{ __html: salesCopyRich }}
        />
      ) : (
        <div className="course-salesCopy__text">
          {salesCopyText}
        </div>
      )}
    </div>
  </section>
) : null}

                        

                       {/* =======================
                             Outcomes
                        ======================= */}
{(outcomesRich || outcomesPlain) ? (
  <section className="course-section" id="outcomes" aria-label="Outcomes">
    <div className="course-section__inner">
      

      {outcomesRich ? (
        <div
          className="course-section__rich"
          dangerouslySetInnerHTML={{ __html: outcomesRich }}
        />
      ) : (
        <div className="course-section__text">{outcomesPlain}</div>
      )}
    </div>
  </section>
) : null}

                        

                       {/* =======================
                              Course outline
                        ======================= */}
<section className="course-section" id="outline" aria-label="Course outline">
  <div className="course-section__inner">
    <h2 className="course-section__title">Course outline</h2>

    {!sections?.length ? (
      <div className="course-section__muted">No outline yet.</div>
    ) : (
      <div className="outline">
        {sections.map((sec) => {
          const sv = sec?.values || sec || {};
          const secId = String(sec?._id || "");
          const secTitle = pickText(sv, ["Title", "Name"], "Section");

          const secLessons = lessonsBySection?.[secId] || [];

          return (
            <div className="outline__block" key={secId}>
              <div className="outline__header">
                <div className="outline__title">{secTitle}</div>
                <div className="outline__count">
                  {secLessons.length} lesson{secLessons.length === 1 ? "" : "s"}
                </div>
              </div>

              {secLessons.length ? (
                <ul className="outline__list">
                  {secLessons.map((l) => {
                    const lv = l?.values || l || {};
                    const lid = String(l?._id || "");
                    const lt = pickText(lv, ["Title", "Name"], "Lesson");
                    return (
                      <li className="outline__item" key={lid}>
                        {lt}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <div className="course-section__muted">No lessons in this section yet.</div>
              )}
            </div>
          );
        })}
      </div>
    )}
  </div>
</section>

                        

                       {/* =======================
                              Social Proof
                        ======================= */}
{(socialProofRich || socialProofPlain) ? (
  <section className="course-section" id="proof" aria-label="Social proof">
    <div className="course-section__inner">
      <h2 className="course-section__title">
        {socialProofHeadline || "Results & social proof"}
      </h2>

      {socialProofRich ? (
        <div
          className="course-section__rich"
          dangerouslySetInnerHTML={{ __html: socialProofRich }}
        />
      ) : (
        <div className="course-section__text">{socialProofPlain}</div>
      )}
    </div>
  </section>
) : null}

                        

                       {/* =======================
                              Instructor Bio
                        ======================= */}
{(instructorBioRich || instructorBioPlain) ? (
  <section className="course-section" id="about" aria-label="Instructor bio">
    <div className="course-section__inner">
      

      {instructorBioRich ? (
        <div
          className="course-section__rich"
          dangerouslySetInnerHTML={{ __html: instructorBioRich }}
        />
      ) : (
        <div className="course-section__text">{instructorBioPlain}</div>
      )}
    </div>
  </section>
) : null}

                        

                       {/* =======================
                             Sales Story
                        ======================= */}
{(salesStoryRich || salesStoryPlain) ? (
  <section className="course-section" id="story" aria-label="Sales story">
    <div className="course-section__inner">
      

      {salesStoryRich ? (
        <div
          className="course-section__rich"
          dangerouslySetInnerHTML={{ __html: salesStoryRich }}
        />
      ) : (
        <div className="course-section__text">{salesStoryPlain}</div>
      )}
    </div>
  </section>
) : null}

                        

                       {/* =======================
                              Guarantee
                        ======================= */}
{(guaranteeRich || guaranteePlain) ? (
  <section className="course-section" id="guarantee" aria-label="Guarantee">
    <div className="course-section__inner">
     

      {guaranteeRich ? (
        <div
          className="course-section__rich"
          dangerouslySetInnerHTML={{ __html: guaranteeRich }}
        />
      ) : (
        <div className="course-section__text">{guaranteePlain}</div>
      )}
    </div>
  </section>
) : null}

                        

                       {/* =======================
                              FAQ
                        ======================= */}
{(faqRich || faqPlain) ? (
  <section className="course-section" id="faq" aria-label="FAQ">
    <div className="course-section__inner">
      

      {faqRich ? (
        <div
          className="course-section__rich"
          dangerouslySetInnerHTML={{ __html: faqRich }}
        />
      ) : (
        <div className="course-section__text">{faqPlain}</div>
      )}
    </div>
  </section>
) : null}

  </div> {/* ✅ end .course-public */}





                       {/* =======================
                           Course Section
                        ======================= */}







                       {/* =======================
                           Popups
                        ======================= */}
  
  
   {/* ===== Log in Popup=== */}                       
{showLogin ? (
  <div className="modalOverlay" role="dialog" aria-modal="true" aria-label="Login">
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

        <button className="btn btn-primary" type="submit" disabled={loginLoading}>
          {loginLoading ? "Logging in..." : "Log in"}
        </button>

        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => alert("Next: open signup modal or route to signup page")}
        >
          Create an account
        </button>
      </form>
    </div>
  </div>
) : null}


    </div>
  );
}
