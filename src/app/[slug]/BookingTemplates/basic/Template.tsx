//C:\Users\tiffa\OneDrive\Desktop\suiteseat-web\src\app\[slug]\BookingTemplates\basic\Template.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useBookingFlow } from "../../BookingFlows/basicFlow";
import AuthModal from "./AuthModal";
import { fmtDate, fmtTime12h, fmtUSD, getDurationMin } from "../../../lib/format";

function svcMinutes(s: any): number {
  if (!s) return 0;

  const v = s.values || s || {};

  const raw =
    v.durationMinutes ??      // main field if you ever use it
    v.DurationMin ??
    v["Duration (min)"] ??
    v["Duration (mins)"] ??
    v["Duration Minutes"] ??
    v.ServiceDuration ??
    v.Minutes ??
    v.Duration ??
    v.duration ??             // ✅ your Service field
    s.durationMin ??          // fallback to mapped field
    s.duration;

  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
}





type Calendar = { _id: string; name: string };
type TemplateProps = { calendars: Calendar[] };

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8400";
const ASSET_BASE = process.env.NEXT_PUBLIC_ASSET_BASE ?? "";


function resolveAssetUrl(raw?: string | null) {
  if (!raw) return "";

  // already absolute
  if (/^https?:\/\//i.test(raw)) return raw;

  // relative uploads path -> point it at your API
  if (raw.startsWith("/uploads/")) return `${API_BASE}${raw}`;

  // other relative path (optional)
  if (raw.startsWith("/")) return raw;

  return raw;
}

// ---- helpers ---------------------------------------------------------------
function resolveAsset(raw?: string | null) {
  if (!raw) return null;

  const s = String(raw).trim();
  if (!s) return null;

  // full url
  if (s.startsWith("http://") || s.startsWith("https://")) return s;

  // normalize relative uploads
  if (s.startsWith("/uploads/")) return `${API_BASE}${s}`;
  if (s.startsWith("uploads/")) return `${API_BASE}/${s}`;

  // other absolute path (rare)
  if (s.startsWith("/")) return s;

  // filename only
  return `${API_BASE}/uploads/${s}`;
}


// Read duration from a Service (robust to different field shapes)
function readMinFlexible(s: any): number {
  const raw =
    s?.durationMin ??
    s?.values?.DurationMin ??
    s?.values?.Duration ??
    s?.values?.Minutes ??
    s?.duration;

  if (typeof raw === "number" && Number.isFinite(raw)) return raw;

  if (typeof raw === "string") {
    const n = Number(raw);
    if (Number.isFinite(n)) return n;
    // parse "1h 30m" / "90m"
    let total = 0;
    const h = /(\d+(\.\d+)?)\s*h/i.exec(raw)?.[1];
    const m = /(\d+)\s*m/i.exec(raw)?.[1];
    if (h) total += Number(h) * 60;
    if (m) total += Number(m);
    if (total > 0) return total;
  }

  const fallback = Number((getDurationMin && getDurationMin(s)) || 0);
  return Number.isFinite(fallback) ? fallback : 0;
}

// ---- component -------------------------------------------------------------
export function CalendarsList({ calendars }: TemplateProps) {
  if (!calendars || calendars.length === 0) return <div>No calendars yet</div>;
  return (
    <div>
      {calendars.map((c) => (
        <div key={c._id}>{c.name}</div>
      ))}
    </div>
  );
}

type BookedDetails = {
  date?: string | null;
  time?: string | null;
  service?: string | null;
};
function refId(v: any): string {
  if (!v) return "";
  if (typeof v === "string") return v;
  if (typeof v === "object") return String(v._id || v.id || v.value || v.$id || "");
  return "";
}

function categoryMatchesCalendar(
  cat: any,
  selectedCalendarId?: string | null,
  calendars?: any[]
) {
  if (!selectedCalendarId) return false;

  // ✅ Use values only if it actually has data; otherwise use flattened record
  const v =
    cat?.values && Object.keys(cat.values).length
      ? cat.values
      : cat || {};

  const raw =
    v.calendarId ??
    v.CalendarId ??
    v.Calendar ??
    v["Calendar"] ??
    v["Calendar Id"] ??
    v["CalendarID"] ??
    v.calendar ??
    v["Calendar Ref"] ??
    cat?.calendarId;

  // 1) ID match
  const calId = Array.isArray(raw) ? refId(raw[0]) : refId(raw);
  if (calId && String(calId) === String(selectedCalendarId)) return true;

  // 2) fallback name match
  const selectedCal = Array.isArray(calendars)
    ? calendars.find((c: any) => String(c._id) === String(selectedCalendarId))
    : null;

  const selectedName = String(
    selectedCal?.values?.calendarName ??
    selectedCal?.values?.name ??
    selectedCal?.calendarName ??
    selectedCal?.name ??
    ""
  ).trim();

  const rawName = String(
    typeof raw === "string"
      ? raw
      : raw?.name ?? raw?.label ?? raw?.value ?? ""
  ).trim();

  if (
    selectedName &&
    rawName &&
    rawName.toLowerCase() === selectedName.toLowerCase()
  ) return true;

  return false;
}


export default function BasicBookingTemplate({ business }: { business?: any }) {
  const flow = useBookingFlow();

  const [showNextModal, setShowNextModal] = useState(false);
  const [bookedDetails, setBookedDetails] = useState<BookedDetails>({});

  // UI-only multi-select mode
  const [multiMode, setMultiMode] = useState(false);

  // 🔹 Our own cross-category selection state
  const [multiIds, setMultiIds] = useState<string[]>([]);
  const [multiMap, setMultiMap] = useState<Record<string, any>>({});

  // Always: services for the *current* category only
  const services = flow.services ?? [];

  // ---------- CATEGORY DEBUG (you already had this) ----------
  useEffect(() => {
    console.log("[cats debug] selectedCalendarId:", flow.selectedCalendarId);
    console.log("[cats debug] categories count:", flow.categories?.length ?? 0);
    console.log("[cats debug] sample cat:", flow.categories?.[0]);
    console.log(
      "[cats debug] sample cat.values keys:",
      Object.keys(flow.categories?.[0]?.values || {})
    );
  }, [flow.selectedCalendarId, flow.categories]);

  const filteredCategories = useMemo(() => {
    console.log("[cats debug] selectedCalendarId:", flow.selectedCalendarId);
    console.log(
      "[cats debug] categories count:",
      Array.isArray(flow.categories) ? flow.categories.length : 0
    );
    console.log("[cats debug] sample cat:", flow.categories?.[0]);
    console.log(
      "[cats debug] sample cat.values keys:",
      Object.keys(flow.categories?.[0]?.values || {})
    );

    return Array.isArray(flow.categories)
      ? flow.categories.filter((cat: any) =>
          categoryMatchesCalendar(cat, flow.selectedCalendarId, flow.calendars)
        )
      : [];
  }, [flow.categories, flow.selectedCalendarId, flow.calendars]);

  useEffect(() => {
    console.log("[cats debug] selectedCalendarId:", flow.selectedCalendarId);
    console.log("[cats debug] categories count:", flow.categories?.length);
    console.log("[cats debug] first category raw:", flow.categories?.[0]);

    if (Array.isArray(flow.categories) && flow.categories.length) {
      const v = flow.categories[0]?.values || flow.categories[0] || {};
      console.log("[cats debug] first category keys:", Object.keys(v));
      console.log("[cats debug] first category Calendar-ish values:", {
        Calendar_plain: v.Calendar,
        Calendar_quoted: v["Calendar"],
        calendar: v.calendar,
        calendarId: v.calendarId,
        Calendar_Id: v["Calendar Id"],
        CalendarId: v.CalendarId,
        Calendar_Ref: v["Calendar Ref"],
      });
    }

    console.log("[cats debug] filtered count:", filteredCategories.length);
  }, [flow.selectedCalendarId, flow.categories, filteredCategories.length]);

  // Leave multiMode if user leaves calendar / switches to single-service flow
  useEffect(() => {
    if (!flow.selectedCalendarId || flow.selectedServiceId) {
      setMultiMode(false);
    }
  }, [flow.selectedCalendarId, flow.selectedServiceId]);

  // ---------- HERO ----------
  const [heroSrc, setHeroSrc] = useState<string | null>(null);

  const v = business?.values || business || {};

const heroUrl =
  business?.heroUrl ||
  v["Hero Image"] ||
  v.HeroImage ||
  v.heroImage ||
  v.heroImageUrl ||
  v.heroUrl ||
  v.Hero ||
  null;

  const title = business?.values?.Name || business?.name || "Business";
  const desc = business?.values?.Description || "Book an appointment";

  useEffect(() => {
    document.title = title;
  }, [title]);

useEffect(() => {
  // 1) prefer the already-normalized heroUrl from page.tsx
  if (heroUrl) {
    const resolved = resolveAssetUrl(heroUrl);
    setHeroSrc(resolved);
    console.log("[hero] using heroUrl:", { heroUrl, resolved });
    return;
  }

  // 2) if nothing exists, clear it
  setHeroSrc(null);
  console.log("[hero] no hero found on business record", {
    keys: Object.keys(v || {}),
  });
}, [business?._id, business?.heroUrl]);


  // ---------- MULTI-SELECT DATA (our own copy) ----------
  const pickedList = useMemo(
    () => multiIds.map((id) => multiMap[id]).filter(Boolean),
    [multiIds, multiMap]
  );

  const pickedCount = pickedList.length;

  const roughMin = useMemo(
    () => pickedList.reduce((sum: number, s: any) => sum + svcMinutes(s), 0),
    [pickedList]
  );

  const roughPrice = useMemo(
    () =>
      pickedList.reduce((sum: number, s: any) => {
        const p = Number(s?.price ?? s?.values?.Price ?? 0);
        return sum + (Number.isFinite(p) ? p : 0);
      }, 0),
    [pickedList]
  );

  useEffect(() => {
    console.log("[multi debug] pickedList:", pickedList);
    console.log(
      "[multi debug] mins each:",
      pickedList.map((s: any) => svcMinutes(s))
    );
    console.log("[multi debug] roughMin:", roughMin);
  }, [pickedList, roughMin]);

  // Toggle a service in/out of our multi selection
  function toggleServiceMulti(svc: any) {
    const id = String(svc._id);

    setMultiIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );

    setMultiMap((prev) => {
      const next = { ...prev };
      if (next[id]) {
        delete next[id];
      } else {
        next[id] = svc;
      }
      return next;
    });
  }

  // Jump to availability using selected multi services
  async function continueToAvailability() {
    if (!multiIds.length) return;
    await flow.handleMultiServiceSelect(multiIds);
    requestAnimationFrame(() => {
      document
        .getElementById("availability-section")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  const showAvailability =
    !!flow.selectedServiceId && !flow.isConfirmOpen && !showNextModal;

  const weekdayLabels = ["S", "M", "T", "W", "Th", "F", "S"];

  // ---------- CONFIRM SUMMARY (single + multi) ----------
  const confirmServices = React.useMemo(() => {
    // Multi-service mode – use our pickedList (cross-category)
    if (flow.selectedServiceId === "__MULTI__") {
      console.log("[confirm] multi-mode services (pickedList):", pickedList);
      return pickedList;
    }

    // Single-service mode
    if (flow.selectedServiceId) {
      const one = flow.lookupService(flow.selectedServiceId);
      return one ? [one] : [];
    }

    return [];
  }, [flow.selectedServiceId, pickedList, flow]);

  const confirmNames = React.useMemo(
    () =>
      confirmServices
        .map(
          (s: any) =>
            s?.name ?? s?.values?.Name ?? s?.values?.serviceName ?? ""
        )
        .filter(Boolean),
    [confirmServices]
  );

  const confirmMinutes = React.useMemo(() => {
    const total = confirmServices.reduce(
      (sum: number, s: any) => sum + svcMinutes(s),
      0
    );
    return total || flow.serviceDurationMin || 0;
  }, [confirmServices, flow.serviceDurationMin]);

  const confirmPrice = React.useMemo(
    () =>
      confirmServices.reduce((sum: number, s: any) => {
        const p = Number(s?.price ?? s?.values?.Price ?? 0);
        return sum + (Number.isFinite(p) ? p : 0);
      }, 0),
    [confirmServices]
  );

  // ---------- RENDER ----------
  return (
    <main id="booking-root">
      {/* Full-width hero */}
      {heroSrc ? (
        <header className="bk-hero bk-hero--image bk-hero--contain bk-hero-full">
          <div className="bk-hero-imgwrap">
<img
  src={heroSrc || ""}
  alt={`${title} hero`}
  className="bk-hero-img"
  onError={(e) => {
    console.log("[hero] IMG FAILED", heroSrc);
    // optional: hide the broken img so it doesn't show the broken icon
    (e.currentTarget as HTMLImageElement).style.display = "none";
  }}
/>

          </div>
        </header>
      ) : (
        <header className="bk-hero bk-hero-full">
          {/* <p className="bk-sub">{desc}</p> */}
        </header>
      )}

      {/* Bottom booking area – now full width */}
      <section className="booking-bottom">
        <div className="booking-bottom-inner">
          <div className="bk-grid bk-grid--full">
            <div className="bk-flow">
              {/* Calendars */}
              {!flow.selectedCalendarId && (
                <section
                  className="bk-card bk-card--full"
                  id="calendars-section"
                >
                  <h3 className="bk-h3">Calendars</h3>
                  {flow.loading ? (
                    <div className="bk-placeholder">Loading calendars…</div>
                  ) : flow.calendars?.length ? (
                 <div className="bk-list bk-list--cards-center">
  {flow.calendars.map((c: any) => (
                        <button
                          key={c._id}
                          type="button"
                          className="card card--select"
                          style={{ minWidth: 220, textAlign: "left" }}
                          onClick={() => flow.handleCalendarSelect(c._id)}
                          disabled={flow.isReschedule}
                        >
                          <div className="card__title">{c.name}</div>
                          {c.desc && <div className="card__sub">{c.desc}</div>}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="bk-placeholder">No calendars found.</div>
                  )}
                </section>
              )}

              {/* Categories */}
              {flow.selectedCalendarId && !flow.selectedCategoryId && (
                <section
                  className="bk-card bk-card--full"
                  id="categories-section"
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 12,
                    }}
                  >
                    <h3 className="bk-h3" style={{ margin: 0 }}>
                      Categories
                    </h3>
                    <button
                      type="button"
                      className="bk-btn"
                      onClick={() => {
                        flow.goBackToCalendars();
                        document
                          .getElementById("calendars-section")
                          ?.scrollIntoView({
                            behavior: "smooth",
                            block: "start",
                          });
                      }}
                    >
                      ← Back to calendars
                    </button>
                  </div>

                  {flow.loadingCats ? (
                    <div className="bk-placeholder">Loading categories…</div>
                  ) : filteredCategories.length ? (
                    <fieldset disabled={!!flow.isReschedule}>
                  <div className="bk-list bk-list--cards-center">

                        {filteredCategories.map((cat: any) => (
                          <button
                            key={cat._id}
                            type="button"
                            className="card card--select"
                            style={{ minWidth: 220, textAlign: "left" }}
                            onClick={() => flow.handleCategorySelect(cat._id)}
                          >
                            <div className="card__title">
                              {cat?.name ??
                                cat?.values?.Name ??
                                "Untitled category"}
                            </div>
                            {cat?.desc ? (
                              <div className="card__sub">{cat.desc}</div>
                            ) : null}
                          </button>
                        ))}
                      </div>
                    </fieldset>
                  ) : (
                    <div className="bk-placeholder">
                      No categories for this calendar.
                    </div>
                  )}
                </section>
              )}

              {/* Services */}
              {flow.selectedCategoryId && !flow.selectedServiceId && (
                <section className="bk-card" id="services-section">
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 12,
                    }}
                  >
                    <h3 className="bk-h3" style={{ margin: 0 }}>
                      Services
                    </h3>

                    <div style={{ display: "flex", gap: 8 }}>
                      {/* Multi-select toggle */}
                      <button
                        type="button"
                        className="bk-btn"
                        onClick={() => setMultiMode((m) => !m)}
                        title="Pick more than one service"
                      >
                        {multiMode ? "✓ Multiple selected" : "Select multiple"}
                      </button>

                      {/* Continue button (only when in multi mode) */}
                      {multiMode && (
                        <button
                          type="button"
                          className="bk-btn-primary"
                          disabled={!multiIds.length}
                          onClick={continueToAvailability}
                        >
                          Continue ({multiIds.length})
                        </button>
                      )}

                      {/* Back to categories */}
                      <button
                        type="button"
                        className="bk-btn"
                        onClick={() => {
                          flow.goBackToCategories();
                          document
                            .getElementById("categories-section")
                            ?.scrollIntoView({
                              behavior: "smooth",
                              block: "start",
                            });
                        }}
                      >
                        ← Back to categories
                      </button>
                    </div>
                  </div>

                  {flow.loadingServices ? (
                    <div className="bk-placeholder">Loading services…</div>
                  ) : services.length ? (
                    <fieldset disabled={flow.isReschedule}>
                      {/* vertical list */}
                      <div className="bk-list bk-list--vertical">
                        {services.map((srv: any) => {
                          const id = String(srv._id);
                          const picked = multiIds.includes(id);

                          const title =
                            srv.values?.serviceName ??
                            srv.values?.Name ??
                            srv.name ??
                            "Service";

                          const desc =
                            srv.values?.description ?? srv.desc ?? "";

                          const rawPrice =
                            srv.values?.price ??
                            srv.values?.Price ??
                            srv.price;

                          const rawDuration = svcMinutes(srv);

                          const rawImage =
                            srv.values?.imageUrl ??
                            srv.imageUrl ??
                            srv.values?.ImageUrl ??
                            srv.values?.image ??
                            (Array.isArray(srv.values?.images)
                              ? srv.values.images[0]
                              : null);

                          const imgSrc = resolveAsset(rawImage ?? null);

                          const minutesForCalc = svcMinutes(srv);

                          console.log("[service debug]", {
                            id,
                            rawDuration,
                            durationFieldFromValues: srv.values?.durationMinutes,
                            allValues: srv.values,
                          });

                          return (
                            <button
                              key={id}
                              type="button"
                              className={
                                "card card--select" +
                                (picked ? " is-picked" : "")
                              }
                              style={{ width: "100%", textAlign: "left" }}
                              onClick={() => {
                                if (multiMode) {
                                  toggleServiceMulti(srv);
                                } else {
                                  // single-service flow
                                  flow.handleServiceSelect(id);
                                }
                              }}
                            >
                              <div
                                style={{
                                  display: "flex",
                                  gap: 12,
                                  alignItems: "flex-start",
                                }}
                              >
                                {imgSrc && (
                                  <img
                                    src={imgSrc}
                                    alt={title}
                                    style={{
                                      width: 64,
                                      height: 64,
                                      borderRadius: 8,
                                      objectFit: "cover",
                                      flexShrink: 0,
                                    }}
                                  />
                                )}

                                <div>
                                  <div className="card__title">
                                    {title} {picked ? "✓" : ""}
                                  </div>

                                  {desc && (
                                    <div className="card__sub">{desc}</div>
                                  )}

                                  {rawPrice != null && rawPrice !== "" && (
                                    <div
                                      className="card__sub"
                                      style={{ color: "var(--muted)" }}
                                    >
                                      {fmtUSD(Number(rawPrice))}
                                    </div>
                                  )}

                                  {minutesForCalc ? (
                                    <div
                                      className="card__sub"
                                      style={{ color: "var(--muted)" }}
                                    >
                                      {minutesForCalc} min
                                    </div>
                                  ) : null}
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </fieldset>
                  ) : (
                    <div className="bk-placeholder">No services found.</div>
                  )}

                  {multiMode && (
                    <>
                      <div className="bk-sub" style={{ marginTop: 12 }}>
                        {pickedCount
                          ? `${pickedCount} selected`
                          : "Pick one or more services"}
                      </div>

                      <div className="bk-sticky-footer">
                        <div className="bk-summary">
                          {pickedCount ? (
                            <>
                              <strong>{pickedCount}</strong> selected
                              {roughMin ? (
                                <>
                                  {" "}
                                  • <strong>{roughMin}</strong> min
                                </>
                              ) : null}
                              {Number.isFinite(roughPrice) &&
                              roughPrice > 0 ? (
                                <>
                                  {" "}
                                  • <strong>{fmtUSD(roughPrice)}</strong>
                                </>
                              ) : null}
                            </>
                          ) : (
                            <>Select services to continue</>
                          )}
                        </div>
                        <div className="bk-actions">
                          <button
                            className="bk-btn"
                            onClick={() => {
                              setMultiIds([]);
                              setMultiMap({});
                            }}
                            disabled={!pickedCount}
                          >
                            Clear
                          </button>
                          <button
                            type="button"
                            className="bk-btn-primary"
                            onClick={continueToAvailability}
                            disabled={!multiIds.length}
                          >
                            Continue to Availability
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </section>
              )}

              {/* Availability */}
              {showAvailability && (
                <section
                  className="bk-card bk-card--availability"
                  id="availability-section"
                >
                  <h3 className="bk-h3">Availability</h3>

                  <button
                    type="button"
                    className="bk-btn"
                    onClick={() => {
                      flow.goBackToServices();
                      document
                        .getElementById("services-section")
                        ?.scrollIntoView({
                          behavior: "smooth",
                          block: "start",
                        });
                    }}
                  >
                    ← Back to services
                  </button>

                  {/* Which services + total minutes */}
                  <div className="bk-sub">
                    {confirmNames.join(", ") || "Selected service(s)"}
                  </div>
                  <div className="bk-sub">
                    {confirmMinutes ? `${confirmMinutes} min` : ""}
                  </div>
    <div className="bk-calendar bk-calendar--wide">
      <div className="bk-cal-header">
        <button
          type="button"
          className="bk-btn"
          onClick={() => flow.shiftMonth(-1)}
        >
          ‹
        </button>

        <div className="bk-month">{flow.monthLabel}</div>

        <button
          type="button"
          className="bk-btn"
          onClick={() => flow.shiftMonth(1)}
        >
          ›
        </button>
      </div>

      {flow.loadingMonth ? (
        <div className="bk-placeholder">Loading month…</div>
      ) : (
        <div className="bk-cal-grid bk-cal-grid--wide">
          {/* Weekday header row */}
       {weekdayLabels.map((label, i) => (
  <div key={`${label}-${i}`} className="bk-cal-dow">
    {label}
  </div>
))}


       {/* Date cells (with blanks) */}
{flow.calendarCells.map((cell: any) => {
  if (cell.kind === "blank") {
    return <div key={cell.key} className="bk-cal-blank" />;
  }

  const disabled = cell.isPast || !cell.isAvailable;

  return (
    <button
      key={cell.key}
      type="button"
      className={[
        "bk-cal-day",
        cell.isPast ? "is-past" : "",
        cell.isToday ? "is-today" : "",
        cell.isAvailable ? "is-available" : "",
        flow.selectedDateISO === cell.dateISO ? "is-selected" : "",
      ].join(" ").trim()}
      disabled={disabled}
      onClick={() => flow.selectDate(cell.dateISO)}
    >
      {cell.dateISO.slice(-2)}
      {cell.isAvailable && <span className="cal-dot" />}
    </button>
  );
})}

        </div>
      )}
    </div>

  {/* Times only show AFTER a date is picked */}
{flow.selectedDateISO ? (
  <div className="bk-slots">
    {flow.loadingSlots ? (
      <div className="bk-placeholder">Loading times…</div>
    ) : (
      <>
        <div className="bk-slot-group">
          <h4>Morning</h4>
          <div className="bk-slot-list">
            {flow.slots.morning.map((t: string) => (
              <button
                key={t}
                type="button"
                className="bk-time"
                onClick={() => flow.openConfirm(t)}
              >
               {fmtTime12h(t)}
              </button>
            ))}
            {!flow.slots.morning.length && <div className="bk-sub">—</div>}
          </div>
        </div>

        <div className="bk-slot-group">
          <h4>Afternoon</h4>
          <div className="bk-slot-list">
            {flow.slots.afternoon.map((t: string) => (
              <button
                key={t}
                type="button"
                className="bk-time"
                onClick={() => flow.openConfirm(t)}
              >
               {fmtTime12h(t)}
              </button>
            ))}
            {!flow.slots.afternoon.length && <div className="bk-sub">—</div>}
          </div>
        </div>

        <div className="bk-slot-group">
          <h4>Evening</h4>
          <div className="bk-slot-list">
            {flow.slots.evening.map((t: string) => (
              <button
                key={t}
                type="button"
                className="bk-time"
                onClick={() => flow.openConfirm(t)}
              >
                {fmtTime12h(t)}
              </button>
            ))}
            {!flow.slots.evening.length && <div className="bk-sub">—</div>}
          </div>
        </div>
      </>
    )}
  </div>
) : (
  <div className="bk-sub">Select a date to see available times.</div>
)}

         </section>
        )}
      </div>
    </div>
  </div>
</section>


          {/* Confirm modal */}
      {flow.isConfirmOpen && !flow.isAuthOpen && (
        <div
          className="bk-modal-overlay"
          role="dialog"
          aria-modal="true"
          onClick={() => flow.closeConfirm()}
        >
          <div className="bk-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="bk-h3">Confirm appointment</h3>

            <button
              type="button"
              className="bk-btn"
              onClick={() => {
                flow.closeConfirm();
                setTimeout(() => {
                  document
                    .getElementById("availability-section")
                    ?.scrollIntoView({ behavior: "smooth", block: "start" });
                }, 0);
              }}
            >
              ← Back to availability
            </button>

        {(() => {
  const cal = flow.calendars?.find(
    (c: any) => c._id === flow.selectedCalendarId
  );

  return (
    <div className="bk-summary">
      <div className="bk-summary-row">
        <strong>Calendar:</strong> {cal?.name || "—"}
      </div>

      <div className="bk-summary-row">
        <strong>Services:</strong>{" "}
        {confirmNames.length ? (
          confirmNames.map((n, idx) => (
            <span key={idx}>
              {idx > 0 && ", "}
              {n}
            </span>
          ))
        ) : (
          "—"
        )}
      </div>

      <div className="bk-summary-row">
        <strong>Total duration:</strong> {confirmMinutes} min
      </div>

      <div className="bk-summary-row">
        <strong>Date:</strong> {fmtDate(flow.selectedDateISO)}
      </div>

      <div className="bk-summary-row">
        <strong>Time:</strong> {fmtTime12h(flow.selectedTimeHHMM)}
      </div>

      <div className="bk-summary-row">
        <strong>Total price:</strong> {fmtUSD(confirmPrice)}
      </div>
    </div>
  );
})()}


            <div className="bk-modal-actions">
              <button
                type="button"
                className="bk-btn"
                onClick={() => flow.closeConfirm()}
              >
                Cancel
              </button>

              {flow.confirmStage === "review" ? (
                <button
                  type="button"
                  className="bk-btn-primary"
                  onClick={() => {
                    // Always open the login/signup popup
                    flow.openAuth();
                  }}
                >
                  Log In or Sign Up
                </button>
              ) : (
                <button
                  type="button"
                  className="bk-btn-primary"
                  onClick={async () => {
                      console.log("🟢 [UI] Book now clicked", {
    date: flow.selectedDateISO,
    time: flow.selectedTimeHHMM,
    calendarId: flow.selectedCalendarId,
    serviceId: flow.selectedServiceId,
    pickedServiceIds: flow.pickedServiceIds,
    serviceDurationMin: flow.serviceDurationMin,
  });
                    const ok = await flow.createAppointment();
                    if (!ok) {
                      // if booking fails, reload times so you see current availability
                      if (flow.selectedDateISO)
                        await flow.selectDate(flow.selectedDateISO);
                      return;
                    }

                    setBookedDetails({
                      date: flow.selectedDateISO ?? undefined,
                      time: flow.selectedTimeHHMM ?? undefined,
                      service: undefined,
                    });

                    flow.closeConfirm();
                    setShowNextModal(true);
                  }}
                >
                  Book now
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Success modal */}
      {showNextModal && (
        <div
          className="bk-modal-overlay"
          role="dialog"
          aria-modal="true"
          onClick={() => setShowNextModal(false)}
        >
          <div className="bk-modal" style={{ zIndex: 1001 }} onClick={(e) => e.stopPropagation()}>
            <h3 className="bk-h3">Appointment booked 🎉</h3>

            <div className="bk-summary">
              {bookedDetails.date && (
                <div className="bk-summary-row">
                  <strong>Date:</strong> {fmtDate(bookedDetails.date!)}
                </div>
              )}
              {bookedDetails.time && (
                <div className="bk-summary-row">
                  <strong>Time:</strong> {fmtTime12h(bookedDetails.time!)}
                </div>
              )}
            </div>

            <div className="bk-modal-actions">
              <a className="bk-btn-primary" href="/client-dashboard.html">
                Go to my dashboard
              </a>
              <button
                className="bk-btn"
                onClick={() => {
                  flow.closeConfirm();
                  if (typeof window !== "undefined") window.location.reload();
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {flow.isAuthOpen && <AuthModal onClose={flow.closeAuth} />}






      
    </main>
  );
}
