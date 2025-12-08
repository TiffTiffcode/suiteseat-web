// src/app/[slug]/BookingFlows/basicFlow.tsx
"use client";
import { createContext, useContext, useEffect, useState, ReactNode } from "react";
type SlotGroups = { morning: string[]; afternoon: string[]; evening: string[] };

const API = process.env.NEXT_PUBLIC_API_ORIGIN || "http://localhost:8400";

// ─────────────────────────────────────────────
// 1️⃣ CONTEXT SETUP
// ─────────────────────────────────────────────
type FlowContextType = {
  // Calendars
  calendars: any[];
  loading: boolean;
  selectedCalendarId: string | null;
  handleCalendarSelect: (calId: string) => Promise<void>;

  // Categories
  categories: any[];
  loadingCats: boolean;

  // 🟣 SERVICES
  selectedCategoryId: string | null;
  services: any[];
  loadingServices: boolean;
  handleCategorySelect: (catId: string) => Promise<void>;

  // 🟠 AVAILABILITY
  selectedServiceId: string | null;
  selectedDateISO: string | null;
  monthCursor: Date; // which month the mini-calendar shows
  monthLabel: string; // e.g. "October 2025"
  monthDays: { dateISO: string; isToday: boolean; isAvailable: boolean }[];
  loadingMonth: boolean;
  loadingSlots: boolean;
  slots: { morning: string[]; afternoon: string[]; evening: string[] };

  // 🟡 CONFIRM POPUP
serviceDurationMin: number;
selectedTimeHHMM: string | null;
isConfirmOpen: boolean;
openConfirm: (timeHHMM: string) => void;
closeConfirm: () => void;

  // actions
  handleServiceSelect: (serviceId: string) => Promise<void>;
  shiftMonth: (deltaMonths: number) => Promise<void>;
  selectDate: (dateISO: string) => Promise<void>;

   // 🔐 AUTH
  isLoggedIn: boolean;
  isAuthOpen: boolean;
  openAuth: () => void;
  closeAuth: () => void;
  login: (email: string, password: string) => Promise<boolean>;
  requireAuthThen: (fn: () => Promise<void> | void) => void;


};

const FlowCtx = createContext<FlowContextType | null>(null);
export const useBookingFlow = () => useContext(FlowCtx) as FlowContextType;


// ─────────────────────────────────────────────
// 2️⃣ FETCH CALENDARS (REUSABLE HELPER)
// ─────────────────────────────────────────────
async function fetchCalendarsForBusiness(businessId: string) {
  const keys = ["Business", "businessId"];
  for (const k of keys) {
    const url = `${API}/public/records?dataType=Calendar&${encodeURIComponent(k)}=${encodeURIComponent(businessId)}&ts=${Date.now()}`;
    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) continue;
    const rows = await r.json();
    if (Array.isArray(rows) && rows.length) {
      return rows.map((doc: any) => {
        const v = doc.values || {};
        const name = v.Name || v.name || v["Calendar Name"] || v.calendarName || "Calendar";
        const desc = v.Description || v.description || v.Details || v.details || "";
        return { _id: String(doc._id), name: String(name), desc: String(desc || "") };
      });
    }
  }
  return [];
}


// ─────────────────────────────────────────────
// 3️⃣ FLOW PROVIDER (MAIN BOOKING LOGIC)
// ─────────────────────────────────────────────
export function BasicFlowProvider({
  businessId,
  children,
}: {
  businessId: string;
  children: ReactNode;
}) {
  // ── CALENDAR SECTION STATE ──
  const [calendars, setCalendars] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // ── CATEGORY SECTION STATE ──
  const [selectedCalendarId, setSelectedCalendarId] = useState<string | null>(null);
  const [categories, setCategories] = useState<any[]>([]);
  const [loadingCats, setLoadingCats] = useState(false);

    // 🟣 SERVICE SECTION STATE
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [services, setServices] = useState<any[]>([]);
  const [loadingServices, setLoadingServices] = useState(false);

// ─────────────────────────────
  // LOAD CALENDARS ON PAGE LOAD
  // ─────────────────────────────
  useEffect(() => {
    if (!businessId) return;
    (async () => {
      setLoading(true);
      const data = await fetchCalendarsForBusiness(businessId);
      setCalendars(data);
      setLoading(false);
    })();
  }, [businessId]);

  //────────────────────────
  // 🔵 HANDLE CALENDAR SELECTION
  // ─────────────────────────────



    async function handleCalendarSelect(calId: string) {
    setSelectedCalendarId(calId);
    setLoadingCats(true);
    setCategories(await fetchCategoriesForCalendar(businessId, calId));
    setLoadingCats(false);
  }

  // ─────────────────────────────
  // 🟢 CATEGORIES SECTION (FETCH + SELECT)
  // ─────────────────────────────
async function fetchCategoriesForCalendar(businessId: string, calendarId: string) {
  const keys = ["Calendar", "calendarId"];
  for (const k of keys) {
    const url = `${API}/public/records?dataType=Category&${encodeURIComponent(k)}=${encodeURIComponent(calendarId)}&ts=${Date.now()}`;
    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) continue;
    const rows = await r.json();
    if (Array.isArray(rows) && rows.length) {
      return rows.map((doc: any) => {
        const v = doc.values || {};
        const name = v.Name || v.name || v["Category Name"] || v.categoryName || "Category";
        const desc = v.Description || v.description || v.Details || v.details || "";
        return { _id: String(doc._id), name: String(name), desc: String(desc || "") };
      });
    }
  }
  return [];
}

  //────────────────────────
  // 🔵 HANDLE Category SELECTION
  // ─────────────────────────────

   async function handleCategorySelect(catId: string) {
    setSelectedCategoryId(catId);
    setLoadingServices(true);
    const data = await fetchServicesForCategory(businessId, catId);
    setServices(data);
    setLoadingServices(false);
  }

// ─────────────────────────────
// 🟣 SERVICES SECTION (FETCH + SELECT)
// ─────────────────────────────

async function fetchServicesForCategory(businessId: string, categoryId: string) {
  const keys = ["Category", "categoryId"];
  const coerceMinutes = (val: any): number | undefined => {
    if (val == null) return undefined;
    const s = String(val).toLowerCase().trim();
    const hMatch = s.match(/(\d+)\s*h/);
    const mMatch = s.match(/(\d+)\s*m/);
    if (hMatch || mMatch) {
      const h = hMatch ? parseInt(hMatch[1], 10) : 0;
      const m = mMatch ? parseInt(mMatch[1], 10) : 0;
      const total = h * 60 + m;
      return Number.isFinite(total) && total > 0 ? total : undefined;
    }
    const numMatch = s.match(/(\d+(\.\d+)?)/);
    if (numMatch) {
      const n = Math.round(Number(numMatch[1]));
      return Number.isFinite(n) && n > 0 ? n : undefined;
    }
    return undefined;
  };

  for (const k of keys) {
    const url = `${API}/public/records?dataType=Service&${encodeURIComponent(k)}=${encodeURIComponent(categoryId)}&ts=${Date.now()}`;
    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) continue;
    const rows = await r.json();
    if (Array.isArray(rows) && rows.length) {
      return rows.map((doc: any) => {
        const v = doc.values || {};
        const name = v.Name || v.name || v["Service Name"] || v.serviceName || "Service";
        const desc = v.Description || v.description || v.Details || v.details || "";
        const price = v.Price || v.price || "";
        const rawDur =
          v.DurationMin ?? v["Duration (min)"] ?? v["Duration (mins)"] ??
          v["Service Duration"] ?? v.Minutes ?? v.Duration ?? v.duration;
        const durationMin = coerceMinutes(rawDur);
        return { _id: String(doc._id), name, desc, price, durationMin };
      });
    }
  }
  return [];
}

  // ─────────────────────────────
// 🟠 AVAILABILITY STATE
// ─────────────────────────────
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [serviceDurationMin, setServiceDurationMin] = useState<number>(0);
  const [selectedDateISO, setSelectedDateISO] = useState<string | null>(null);

  const [monthCursor, setMonthCursor] = useState<Date>(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [monthLabel, setMonthLabel] = useState<string>("");
  const [monthDays, setMonthDays] = useState<{ dateISO: string; isToday: boolean; isAvailable: boolean }[]>([]);
  const [loadingMonth, setLoadingMonth] = useState(false);

  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slots, setSlots] = useState<SlotGroups>({ morning: [], afternoon: [], evening: [] });

  function monthBoundaries(d: Date){ return { start: new Date(d.getFullYear(), d.getMonth(), 1), end: new Date(d.getFullYear(), d.getMonth()+1, 0) }; }

  // upcoming-hours helpers (inside provider for brevity)
  function pickISODate(v: any): string | null {
    if (!v) return null;
    if (typeof v.Date === "string") return v.Date.slice(0,10);
    if (v.date) return String(v.date).slice(0,10);
    const raw = v.Date || v.dateISO || v.iso || v.day || v["Date (ISO)"];
    return raw ? String(raw).slice(0,10) : null;
  }
  function buildQuarterSteps(startHHMM: string, endHHMM: string): string[] {
    const toMin = (t: string) => { const [h,m]=String(t).split(":").map(Number); return (h||0)*60+(m||0); };
    const pad = (n: number) => String(n).padStart(2,"0");
    const s = toMin(startHHMM), e = toMin(endHHMM);
    if (!Number.isFinite(s)||!Number.isFinite(e)||e<=s) return [];
    const out:string[]=[]; for(let m=s; m<=e; m+=15){ out.push(`${pad(Math.floor(m/60))}:${pad(m%60)}`); }
    return out;
  }
  function filterStartsByDuration(flatStarts: string[], minMinutes: number): string[] {
    if (!Array.isArray(flatStarts) || !flatStarts.length || !minMinutes) return [];
    const needSteps = Math.max(1, Math.ceil(minMinutes / 15));
    const set = new Set(flatStarts);
    const next = (t: string) => {
      const [h,m]=t.split(":").map(Number); const total=(h||0)*60+(m||0)+15;
      return `${String(Math.floor(total/60)).padStart(2,"0")}:${String(total%60).padStart(2,"0")}`;
    };
    const valid:string[]=[]; for(const start of flatStarts){ let ok=true, cur=start; for(let i=1;i<needSteps;i++){ cur=next(cur); if(!set.has(cur)){ok=false;break;} } if(ok) valid.push(start); }
    return valid;
  }
  function groupByTOA(times: string[]): SlotGroups {
    const g: SlotGroups = { morning: [], afternoon: [], evening: [] };
    for (const t of times) { const hr=parseInt(t.split(":")[0]||"0",10); if (hr<12) g.morning.push(t); else if (hr<17) g.afternoon.push(t); else g.evening.push(t); }
    return g;
  }
  function refId(x: any): string | null {
    if (!x) return null; if (typeof x === "string") return x;
    if (typeof x === "object") return String(x._id||x.id||x.value||x.$id||x.reference||"").trim() || null;
    return null;
  }
  function truthyBool(v: any): boolean { const s=String(v).toLowerCase().trim(); return v===true||v===1||s==="true"||s==="yes"||s==="y"; }

  async function getUpcomingHoursRows(businessId: string, calendarId: string): Promise<any[]> {
    const qsVariants = [
      `Business=${encodeURIComponent(businessId)}&Calendar=${encodeURIComponent(calendarId)}`,
      `Business._id=${encodeURIComponent(businessId)}&Calendar._id=${encodeURIComponent(calendarId)}`,
      `Calendar=${encodeURIComponent(calendarId)}`,
      `Calendar._id=${encodeURIComponent(calendarId)}`,
      `businessId=${encodeURIComponent(businessId)}&calendarId=${encodeURIComponent(calendarId)}`
    ];
    let all:any[]=[];
    for (const qs of qsVariants) {
      const url = `${API}/public/records?dataType=Upcoming%20Hours&${qs}&ts=${Date.now()}`;
      const r = await fetch(url, { cache: "no-store" });
      if (!r.ok) continue;
      const rows = await r.json();
      if (Array.isArray(rows)) all = all.concat(rows);
    }
    const wantId = String(calendarId);
    const filtered = (all||[]).filter((row) => {
      const v = row?.values || row || {};
      const calId = refId(v.Calendar) || refId(v.calendar) || refId(v["Calendar Ref"]) || v.calendarId || v.CalendarId || null;
      const sameCalendar = calId && String(calId) === wantId;
      const enabledField = v.Enabled ?? v.enabled ?? v["Is Enabled"];
      const availField   = v["is Available"] ?? v.isAvailable ?? v.available;
      const passesEnabled = enabledField === undefined ? true : truthyBool(enabledField);
      const passesAvail   = availField   === undefined ? true : truthyBool(availField);
      return !!sameCalendar && passesEnabled && passesAvail;
    });
    const seen = new Set<string>();
    return filtered.filter(r => { const id=String(r._id||r.id||Math.random()); if (seen.has(id)) return false; seen.add(id); return true; });
  }

  async function fetchMonthAvailabilityClient(opts: {
    businessId: string; calendarId: string; year: number; monthZeroBased: number; minMinutes: number;
  }): Promise<Set<string>> {
    const rows = await getUpcomingHoursRows(opts.businessId, opts.calendarId);
    const month = opts.monthZeroBased, year = opts.year;
    const monthDates = new Set<string>();
    for (const r of rows) {
      const v = r.values || r; const iso = pickISODate(v); if (!iso) continue;
      const d = new Date(iso + "T00:00:00");
      if (d.getFullYear() === year && d.getMonth() === month) monthDates.add(iso);
    }
    const valid = new Set<string>();
    for (const iso of monthDates) {
      const starts = collectFlatStartsForDate(rows, iso);
      const ok = filterStartsByDuration(starts, opts.minMinutes);
      if (ok.length) valid.add(iso);
    }
    return valid;
  }

  function collectFlatStartsForDate(rows: any[], dateISO: string): string[] {
    const starts:string[]=[];
    for (const r of rows) {
      const v = r.values || r; const iso = pickISODate(v); if (iso !== dateISO) continue;
      const rawStart = (v.Start||v.start||v["Start Time"]||v["Start"]) as string|undefined;
      const rawEnd   = (v.End||v.end||v["End Time"]||v["End"]) as string|undefined;
      const start = normalizeHHMM(rawStart), end = normalizeHHMM(rawEnd);
      if (!start || !end) continue;
      starts.push(...buildQuarterSteps(start,end));
    }
    return Array.from(new Set(starts)).sort();
  }

  function normalizeHHMM(input?: string | null): string | null {
    if (!input) return null;
    let s = String(input).trim().toLowerCase();
    if (/^\d{1,2}:\d{2}$/.test(s) && !/[ap]m$/.test(s)) {
      const [h,m]=s.split(":").map(Number);
      if (h>=0&&h<24&&m>=0&&m<60) return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`;
    }
    const m = s.match(/^(\d{1,2})(?::?(\d{2}))?\s*([ap]m)$/i);
    if (m) {
      let h = Number(m[1]); const min = Number(m[2] ?? "0"); const ap = m[3];
      if (ap==="pm" && h!==12) h+=12; if (ap==="am" && h===12) h=0;
      if (h>=0&&h<24&&min>=0&&min<60) return `${String(h).padStart(2,"0")}:${String(min).padStart(2,"0")}`;
    }
    s = s.replace(/\s+/g,"");
    const m2 = s.match(/^(\d{1,2})(?::?(\d{2}))$/);
    if (m2) {
      const h=Number(m2[1]), min=Number(m2[2] ?? "0");
      if (h>=0&&h<24&&min>=0&&min<60) return `${String(h).padStart(2,"0")}:${String(min).padStart(2,"0")}`;
    }
    return null;
  }

  // service selection + month/day loading
  async function handleServiceSelect(serviceId: string) {
    setSelectedServiceId(serviceId);
    const svc = services.find(s => String(s._id) === String(serviceId));
    const dur =
      Number(svc?.durationMin) ||
      Number((svc as any)?.DurationMin) ||
      Number((svc as any)?.Duration) ||
      Number((svc as any)?.duration) || 60;
    setServiceDurationMin(dur);
    setSelectedDateISO(null);
    setSlots({ morning: [], afternoon: [], evening: [] });
    if (!businessId || !selectedCalendarId || !svc) return;
    await loadMonth({ base: monthCursor });
  }

  async function shiftMonth(deltaMonths: number) {
    const next = new Date(monthCursor.getFullYear(), monthCursor.getMonth() + deltaMonths, 1);
    setMonthCursor(next);
    setSelectedDateISO(null);
    setSlots({ morning: [], afternoon: [], evening: [] });
    await loadMonth({ base: next });
  }

  async function selectDate(dateISO: string) {
    setSelectedDateISO(dateISO);
    if (!businessId || !selectedCalendarId || !selectedServiceId) return;
    setLoadingSlots(true);
    const grouped = await fetchDaySlotsClient({
      businessId,
      calendarId: selectedCalendarId,
      dateISO,
      minMinutes: serviceDurationMin,
    });
    setSlots(grouped);
    setLoadingSlots(false);
  }

  async function fetchDaySlotsClient(opts: { businessId: string; calendarId: string; dateISO: string; minMinutes: number; }): Promise<SlotGroups> {
    const rows = await getUpcomingHoursRows(opts.businessId, opts.calendarId);
    const starts = collectFlatStartsForDate(rows, opts.dateISO);
    return groupByTOA(filterStartsByDuration(starts, opts.minMinutes));
  }

  async function loadMonth({ base }: { base: Date }) {
    if (!businessId || !selectedCalendarId || !selectedServiceId) return;
    setLoadingMonth(true);
    const avail = await fetchMonthAvailabilityClient({
      businessId,
      calendarId: selectedCalendarId,
      year: base.getFullYear(),
      monthZeroBased: base.getMonth(),
      minMinutes: serviceDurationMin,
    });
    const { start, end } = monthBoundaries(base);
    const days: { dateISO: string; isToday: boolean; isAvailable: boolean }[] = [];
    const toYMD = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
    const todayYMD = toYMD(new Date());
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const ymd = toYMD(d);
      days.push({ dateISO: ymd, isToday: ymd === todayYMD, isAvailable: avail.has(ymd) });
    }
    setMonthDays(days);
    setMonthLabel(base.toLocaleString(undefined, { month: "long", year: "numeric" }));
    setLoadingMonth(false);
  }

  useEffect(() => {
    setMonthLabel(monthCursor.toLocaleString(undefined, { month: "long", year: "numeric" }));
  }, [monthCursor]);


  // ─────────────────────────────
  // Confirmation popup
  // ─────────────────────────────
  const [selectedTimeHHMM, setSelectedTimeHHMM] = useState<string | null>(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  function openConfirm(timeHHMM: string){ setSelectedTimeHHMM(timeHHMM); setIsConfirmOpen(true); }
  function closeConfirm(){ setIsConfirmOpen(false); }

  // ── provide context value AFTER everything is defined ───────────────────────
  const value: FlowContextType = {
    calendars, loading, selectedCalendarId, handleCalendarSelect,
    categories, loadingCats,
    selectedCategoryId, services, loadingServices, handleCategorySelect,

    selectedServiceId, selectedDateISO, monthCursor, monthLabel, monthDays,
    loadingMonth, loadingSlots, slots,

    serviceDurationMin, selectedTimeHHMM, isConfirmOpen, openConfirm, closeConfirm,

    handleServiceSelect, shiftMonth, selectDate,

    isLoggedIn, isAuthOpen, openAuth, closeAuth, login, requireAuthThen,
  };

  return <FlowCtx.Provider value={value}>{children}</FlowCtx.Provider>;
}

   // ─────────────────────────────
  // Log in popup
  // ─────────────────────────────
  
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  let _pending: (() => Promise<void> | void) | null = null;

  function openAuth(){ setIsAuthOpen(true); }
  function closeAuth(){ setIsAuthOpen(false); }

  async function login(email: string, password: string): Promise<boolean> {
    try {
      const r = await fetch(`${API}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });
      if (!r.ok) return false;
      setIsLoggedIn(true);
      setIsAuthOpen(false);
      if (_pending) { const fn = _pending; _pending = null; await Promise.resolve(fn()); }
      return true;
    } catch { return false; }
  }

  function requireAuthThen(fn: () => Promise<void> | void) {
    if (isLoggedIn) Promise.resolve(fn());
    else { _pending = fn; openAuth(); }
  }
