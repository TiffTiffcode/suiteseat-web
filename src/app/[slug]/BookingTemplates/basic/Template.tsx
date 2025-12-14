//C:\Users\tiffa\OneDrive\Desktop\suiteseat-web\src\app\[slug]\BookingTemplates\basic\Template.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useBookingFlow } from "../../BookingFlows/basicFlow";
import AuthModal from "./AuthModal";
import { fmtDate, fmtTime12h, fmtUSD, getDurationMin } from "../../../lib/format";

type Calendar = { _id: string; name: string };
type TemplateProps = { calendars: Calendar[] };

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8400";
const ASSET_BASE = process.env.NEXT_PUBLIC_ASSET_BASE ?? "";

// ---- helpers ---------------------------------------------------------------
function resolveAsset(raw?: string | null) {
  if (!raw) return null;

  const s = String(raw).trim();
  if (!s) return null;

  // cloudinary or any full url
  if (s.startsWith("http://") || s.startsWith("https://")) return s;

  // already absolute
  if (s.startsWith("/")) return s;

  // already includes uploads prefix
  if (s.startsWith("uploads/")) return `/${s}`;

  // default: treat as filename
  return `/uploads/${s}`;
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

const filteredCategories = useMemo(() => {
  console.log("[cats debug] selectedCalendarId:", flow.selectedCalendarId);
  console.log("[cats debug] categories count:", Array.isArray(flow.categories) ? flow.categories.length : 0);
  console.log("[cats debug] sample cat:", flow.categories?.[0]);
  console.log("[cats debug] sample cat.values keys:", Object.keys(flow.categories?.[0]?.values || {}));

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

  const [showNextModal, setShowNextModal] = useState(false);
  const [bookedDetails, setBookedDetails] = useState<BookedDetails>({});

  // local UI-only toggle (picks live in flow)
  const [multiMode, setMultiMode] = useState(false);

  // Reset multi toggle if leaving services step (flow keeps the picked ids)
  useEffect(() => {
    if (!flow.selectedCategoryId || flow.selectedServiceId) {
      setMultiMode(false);
    }
  }, [flow.selectedCategoryId, flow.selectedServiceId]);

  // hero image/title/desc
  const [heroSrc, setHeroSrc] = useState<string | null>(null);
  const title = business?.values?.Name || business?.name || "Business";
  const desc = business?.values?.Description || "Book an appointment";

  useEffect(() => {
    document.title = title;
  }, [title]);

  useEffect(() => {
    const rawHero =
      business?.values?.HeroImage ||
      business?.values?.heroImage ||
      business?.heroImageUrl ||
      business?.heroImage ||
      business?.values?.Hero;

    const firstTry = resolveAsset(rawHero ?? null);
    if (firstTry) {
      setHeroSrc(firstTry);
      return;
    }

    const slug = business?.slug;
    if (!slug) return;

    (async () => {
      try {
       const url = `${API_BASE}/public/records?dataType=Business&values.slug=${encodeURIComponent(slug)}&limit=1`;
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        const item = Array.isArray(data) ? data[0] : data?.items?.[0] ?? data;
        const v = item?.values ?? item ?? {};
        const raw2 =
          v.heroImageUrl ||
          v.heroImage ||
          v["Hero Image"] ||
          v.hero_image ||
          v.imageUrl ||
          v.image ||
          (Array.isArray(v.images) ? v.images[0] : null);

        setHeroSrc(resolveAsset(raw2 ?? null));
      } catch {
        /* ignore */
      }
    })();
  }, [business?._id, business?.slug]);

  // derived summary for multi-mode footer (best effort using currently loaded data)
  const pickedCount = flow.pickedServiceIds.length;

  // (Optional) quick sums using currently visible services list — may undercount if picks span categories.
  const visiblePicked = useMemo(() => {
    if (!Array.isArray(flow.services) || !flow.services.length) return [];
    const set = new Set(flow.pickedServiceIds.map(String));
    return flow.services.filter((s: any) => set.has(String(s._id)));
  }, [flow.services, flow.pickedServiceIds]);

  const roughMin = useMemo(
    () => visiblePicked.reduce((sum: number, s: any) => sum + readMinFlexible(s), 0),
    [visiblePicked]
  );
  const roughPrice = useMemo(
    () =>
      visiblePicked.reduce((sum: number, s: any) => {
        const p = Number(s?.price ?? s?.values?.Price ?? 0);
        return sum + (Number.isFinite(p) ? p : 0);
      }, 0),
    [visiblePicked]
  );

  // jump to availability using currently selected multi picks
  async function continueToAvailability() {
    if (!flow.pickedServiceIds.length) return;
    await flow.handleMultiServiceSelect(flow.pickedServiceIds);
    requestAnimationFrame(() => {
      document.getElementById("availability-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

return (
  <main id="booking-root" className="bk-container">
    {heroSrc ? (
      <header className="bk-hero bk-hero--image bk-hero--contain">
        <div className="bk-hero-imgwrap">
          <img src={heroSrc} alt={`${title} hero`} className="bk-hero-img" />
        </div>
      </header>
    ) : (
      <header className="bk-hero">
    
        {/* remove or comment this line to hide “Book an appointment” */}
        {/* <p className="bk-sub">{desc}</p> */}
      </header>
    )}

    <section className="bk-grid">
        <div className="bk-flow">
          {/* Calendars */}
          {!flow.selectedCalendarId && (
            <section className="bk-card" id="calendars-section">
              <h3 className="bk-h3">Calendars</h3>
              {flow.loading ? (
                <div className="bk-placeholder">Loading calendars…</div>
              ) : flow.calendars?.length ? (
                <div className="bk-list" style={{ display: "flex", gap: 12, overflowX: "auto" }}>
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
            <section className="bk-card" id="categories-section">
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <h3 className="bk-h3" style={{ margin: 0 }}>
                  Categories
                </h3>
                <button
                  type="button"
                  className="bk-btn"
                  onClick={() => {
                    flow.goBackToCalendars();
                    document.getElementById("calendars-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                >
                  ← Back to calendars
                </button>
              </div>

          {flow.loadingCats ? (
  <div className="bk-placeholder">Loading categories…</div>
) : filteredCategories.length ? (
  <fieldset disabled={!!flow.isReschedule}>
    <div className="bk-list" style={{ display: "flex", gap: 12, overflowX: "auto" }}>
      {filteredCategories.map((cat: any) => (
        <button
          key={cat._id}
          type="button"
          className="card card--select"
          style={{ minWidth: 220, textAlign: "left" }}
          onClick={() => flow.handleCategorySelect(cat._id)}
        >
          <div className="card__title">{cat?.name ?? cat?.values?.Name ?? "Untitled category"}</div>
          {cat?.desc ? <div className="card__sub">{cat.desc}</div> : null}
        </button>
      ))}
    </div>
  </fieldset>
) : (
  <div className="bk-placeholder">No categories for this calendar.</div>
)}

            </section>
          )}

          {/* Services */}
          {flow.selectedCategoryId && !flow.selectedServiceId && (
            <section className="bk-card" id="services-section">
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
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
                      disabled={flow.pickedServiceIds.length === 0}
                      onClick={continueToAvailability}
                    >
                      Continue ({flow.pickedServiceIds.length})
                    </button>
                  )}

                  {/* Back to categories */}
                  <button
                    type="button"
                    className="bk-btn"
                    onClick={() => {
                      flow.goBackToCategories();
                      document.getElementById("categories-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
                    }}
                  >
                    ← Back to categories
                  </button>
                </div>
              </div>

              {flow.loadingServices ? (
                <div className="bk-placeholder">Loading services…</div>
              ) : flow.services?.length ? (
                <fieldset disabled={flow.isReschedule}>
                  <div className="bk-list" style={{ display: "flex", gap: 12, overflowX: "auto" }}>
                    {flow.services.map((srv: any) => {
                      const id = String(srv._id);
                      const picked = flow.isPicked(id);

                      return (
                        <button
                          key={id}
                          type="button"
                          className={"card card--select" + (picked ? " is-picked" : "")}
                          style={{ minWidth: 220, textAlign: "left" }}
                          onClick={() => {
                            if (multiMode) {
                              picked ? flow.removePick(id) : flow.addPick(id);
                            } else {
                              flow.handleServiceSelect(id);
                            }
                          }}
                        >
                          <div className="card__title">
                            {srv.name || srv.values?.Name || "Service"} {picked ? "✓" : ""}
                          </div>
                          {srv.desc && <div className="card__sub">{srv.desc}</div>}
                          {(srv.price != null && srv.price !== "") && (
                            <div className="card__sub" style={{ color: "var(--muted)" }}>
                              ${Number(srv.price).toFixed(2)}
                            </div>
                          )}
                          {srv.durationMin ? (
                            <div className="card__sub" style={{ color: "var(--muted)" }}>
                              {srv.durationMin} min
                            </div>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                </fieldset>
              ) : (
                <div className="bk-placeholder">No services found.</div>
              )}

              {/* helper text / sticky summary for multi mode */}
              {multiMode && (
                <>
                  <div className="bk-sub" style={{ marginTop: 12 }}>
                    {pickedCount ? `${pickedCount} selected` : "Pick one or more services"}
                  </div>

                  <div className="bk-sticky-footer">
                    <div className="bk-summary">
                      {pickedCount ? (
                        <>
                          <strong>{pickedCount}</strong> selected
                          {roughMin ? <> • <strong>{roughMin}</strong> min</> : null}
                          {Number.isFinite(roughPrice) && roughPrice > 0 ? (
                            <> • <strong>{fmtUSD(roughPrice)}</strong></>
                          ) : null}
                        </>
                      ) : (
                        <>Select services to continue</>
                      )}
                    </div>
                    <div className="bk-actions">
                      <button
                        className="bk-btn"
                        onClick={() => flow.clearPicks()}
                        disabled={!pickedCount}
                      >
                        Clear
                      </button>
                      <button
                        className="bk-btn bk-primary"
                        disabled={!pickedCount}
                        onClick={continueToAvailability}
                      >
                        Continue to Availability
                      </button>
                    </div>
                  </div>
                </>
              )}
            </section>
          )}
        </div>

        {/* Availability */}
        {flow.selectedServiceId && !flow.isConfirmOpen && !showNextModal && (
          <section className="bk-card" id="availability-section">
            <h3 className="bk-h3">Availability</h3>
            <button
              type="button"
              className="bk-btn"
              onClick={() => {
                flow.goBackToServices();
                document.getElementById("services-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
            >
              ← Back to services
            </button>

            <div className="bk-calendar">
              <div className="bk-cal-header">
                <button type="button" className="bk-btn" onClick={() => flow.shiftMonth(-1)}>
                  ‹
                </button>
                <div className="bk-month">{flow.monthLabel}</div>
                <button type="button" className="bk-btn" onClick={() => flow.shiftMonth(1)}>
                  ›
                </button>
              </div>

              {flow.loadingMonth ? (
                <div className="bk-placeholder">Loading month…</div>
              ) : (
                <div className="bk-cal-grid">
                  {flow.monthDays.map((d: any) => (
                    <button
                      key={d.dateISO}
                      type="button"
                      className={[
                        "bk-cal-day",
                        d.isToday ? "is-today" : "",
                        d.isAvailable ? "is-available" : "",
                        flow.selectedDateISO === d.dateISO ? "is-selected" : "",
                      ]
                        .join(" ")
                        .trim()}
                      disabled={!d.isAvailable}
                      onClick={() => flow.selectDate(d.dateISO)}
                    >
                      {d.dateISO.slice(-2)}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="bk-slots">
              {flow.loadingSlots ? (
                <div className="bk-placeholder">Loading times…</div>
              ) : (
                <>
                  <div className="bk-slot-group">
                    <h4>Morning</h4>
                    <div className="bk-slot-list">
                      {flow.slots.morning.map((t: string) => (
                        <button key={t} type="button" className="bk-time" onClick={() => flow.openConfirm(t)}>
                          {t}
                        </button>
                      ))}
                      {!flow.slots.morning.length && <div className="bk-sub">—</div>}
                    </div>
                  </div>

                  <div className="bk-slot-group">
                    <h4>Afternoon</h4>
                    <div className="bk-slot-list">
                      {flow.slots.afternoon.map((t: string) => (
                        <button key={t} type="button" className="bk-time" onClick={() => flow.openConfirm(t)}>
                          {t}
                        </button>
                      ))}
                      {!flow.slots.afternoon.length && <div className="bk-sub">—</div>}
                    </div>
                  </div>

                  <div className="bk-slot-group">
                    <h4>Evening</h4>
                    <div className="bk-slot-list">
                      {flow.slots.evening.map((t: string) => (
                        <button key={t} type="button" className="bk-time" onClick={() => flow.openConfirm(t)}>
                          {t}
                        </button>
                      ))}
                      {!flow.slots.evening.length && <div className="bk-sub">—</div>}
                    </div>
                  </div>
                </>
              )}
            </div>
          </section>
        )}
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
                  document.getElementById("availability-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
                }, 0);
              }}
            >
              ← Back to availability
            </button>

            {(() => {
              const cal = flow.calendars?.find((c: any) => c._id === flow.selectedCalendarId);
              const isMulti =
                String(flow.selectedServiceId) === "__MULTI__" &&
                Array.isArray(flow.multiSelection) &&
                flow.multiSelection.length > 0;

              // names (best effort from visible services)
              const names = isMulti
                ? (visiblePicked.length
                    ? visiblePicked.map((s: any) => s?.name ?? s?.values?.Name ?? "Service").join(", ")
                    : "Multiple services")
                : (Array.isArray(flow.services)
                    ? (flow.services.find((s: any) => String(s._id) === String(flow.selectedServiceId))?.name ??
                       "Service")
                    : "Service");

              // duration: rely on flow.serviceDurationMin
              const durMin = flow.serviceDurationMin || 0;

              // price: best effort from visible picks
              const price = isMulti
                ? roughPrice
                : (() => {
                    const one = Array.isArray(flow.services)
                      ? flow.services.find((s: any) => String(s._id) === String(flow.selectedServiceId))
                      : null;
                    const p = Number(one?.price ?? one?.values?.Price ?? 0);
                    return Number.isFinite(p) ? p : 0;
                  })();

              return (
                <div className="bk-summary">
                  <div className="bk-summary-row"><strong>Calendar:</strong> {cal?.name || "—"}</div>
                  <div className="bk-summary-row"><strong>Service{isMulti ? "s" : ""}:</strong> {names}</div>
                  <div className="bk-summary-row"><strong>Duration:</strong> {durMin ? `${durMin} min` : "—"}</div>
                  <div className="bk-summary-row"><strong>Date:</strong> {fmtDate(flow.selectedDateISO)}</div>
                  <div className="bk-summary-row"><strong>Time:</strong> {fmtTime12h(flow.selectedTimeHHMM)}</div>
                  <div className="bk-summary-row"><strong>Price:</strong> {fmtUSD(price)}</div>
                </div>
              );
            })()}

            <div className="bk-modal-actions">
              <button type="button" className="bk-btn" onClick={() => flow.closeConfirm()}>
                Cancel
              </button>

   {flow.confirmStage === "review" ? (
  <button
    type="button"
    className="bk-btn-primary"
    onClick={() => {
      // 🔹 Always open the login/signup popup, even if cookies say you're logged in
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
      const ok = await flow.createAppointment();
      if (!ok) {
        // if booking fails, reload times so you see current availability
        if (flow.selectedDateISO) await flow.selectDate(flow.selectedDateISO);
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
