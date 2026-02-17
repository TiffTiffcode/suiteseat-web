// src/app/[slug]/BookingFlows/basicFlow.tsx
//C:\Users\tiffa\OneDrive\Desktop\suiteseat-web\src\app\[slug]\BookingFlows\basicFlow.tsx
"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  ReactNode,
} from "react";
import { useSearchParams, useRouter } from "next/navigation";

if (typeof window !== "undefined") {
  console.log("[flow] basicFlow.tsx loaded");
}

type SlotGroups = { morning: string[]; afternoon: string[]; evening: string[] };
type ConfirmStage = "review" | "book";

// basicFlow.tsx (and anywhere else the client calls the API)
const API =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  (process.env.NODE_ENV === "production"
    ? "https://api.suiteseat.io"
    : "http://localhost:8400");
console.log("[flow] FILE CHECK basicFlow.tsx path marker: 2026-02-17 A");

    console.log("[flow] API base is:", API);
function unpackRows(payload: any): any[] {
  if (Array.isArray(payload)) return payload;
  return payload?.items || payload?.records || payload?.rows || [];
}


// ✅ single context (no duplicates)
const FlowCtx = createContext<FlowContextType | null>(null);

// ✅ single hook (no duplicates)
export function useBookingFlow() {
  const ctx = useContext(FlowCtx);

  // 👇 this proves the hook is actually being called by a component
  if (typeof window !== "undefined") {
    console.log("[flow] useBookingFlow() called", { hasProvider: !!ctx });
  }

  if (!ctx) throw new Error("useBookingFlow must be used within BasicFlowProvider");
  return ctx;
}


// --- amplify debug ---
const dbg = (...args: any[]) => console.log("[flow]", ...args);

// ==== [FLOW_TYPE] Booking flow context shape ========────────────────────────────────────────────────────────
type FlowContextType = {
  calendars: any[];
  loading: boolean;
  selectedCalendarId: string | null;
  handleCalendarSelect: (calId: string) => Promise<void>;
heroUrl: string;
businessRec: any | null;

  categories: any[];
  loadingCats: boolean;

  selectedCategoryId: string | null;
  services: any[];
  loadingServices: boolean;
  handleCategorySelect: (catId: string) => Promise<void>;

  selectedServiceId: string | null;
  selectedDateISO: string | null;
  monthCursor: Date;
  monthLabel: string;
  monthDays: { dateISO: string; isToday: boolean; isAvailable: boolean }[];
  loadingMonth: boolean;
  loadingSlots: boolean;
  slots: SlotGroups;

  serviceDurationMin: number;
  selectedTimeHHMM: string | null;

  // confirm modal
  isConfirmOpen: boolean;
  openConfirm: (timeHHMM: string) => void;
  closeConfirm: (mode?: "soft" | "hard" | boolean) => void;
  confirmStage: "review" | "book";
  reopenConfirmAsBook: () => void;

  handleServiceSelect: (serviceId: string) => Promise<void>;
  shiftMonth: (deltaMonths: number) => Promise<void>;
  selectDate: (dateISO: string) => Promise<void>;

  // auth
  isLoggedIn: boolean;
  isAuthOpen: boolean;
  openAuth: () => void;
  closeAuth: () => void;
  login: (email: string, password: string) => Promise<boolean>;
  requireAuthThen: (fn: () => Promise<void> | void) => void;

  createAppointment: () => Promise<any>;
  removeBookedFromSlots: (startHHMM: string, durMin: number) => void;

  isReschedule: boolean;
  rescheduleApptId: string | null;
  onConfirm: () => Promise<void>;

  goBackToCalendars: () => void;
  goBackToCategories: () => void;
  goBackToServices: () => void;

  // multi-service
  multiSelection: string[] | null;
  handleMultiServiceSelect: (ids: string[]) => Promise<void>;

  // 🔁 picks API
  pickedServiceIds: string[];
  pickedServices: any[];
  addPick: (id: string, svc: any) => void;
  removePick: (id: string) => void;
  clearPicks: () => void;
  isPicked: (id: string) => boolean;

  lookupService: (id: string) => any | null;
  currentUserId: string | null;
currentUser: any | null;


  // 🔹 NEW: all services we’ve cached across categories
  allServices: any[];
  calendarCells: any[];

};





// ── Fetch helpers (module-level) ──────────────────────────────────────────────
// Does this category belong to the selected calendar?
function categoryMatchesCalendar(cat: any, selectedCalendarId?: string | null) {
  if (!selectedCalendarId) return false;
  return String(cat?.calendarId || "") === String(selectedCalendarId);
}

async function fetchCalendarsForBusiness(businessId: string) {
  const keys = ["Business", "businessId"];
  for (const k of keys) {
    const url = `${API}/public/records?dataType=Calendar&${encodeURIComponent(k)}=${encodeURIComponent(businessId)}&ts=${Date.now()}`;
    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) continue;
 const payload = await r.json().catch(() => null);
const rows = unpackRows(payload);

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
function refId(x: any): string | null {
  if (!x) return null;
  if (typeof x === "string") return x;
  if (typeof x === "object")
    return String(x._id || x.id || x.value || x.$id || x.reference || "").trim() || null;
  return null;
}

// -----------------------------
// Business -> Pro extraction helpers (MODULE SCOPE)
// -----------------------------
function idVal(x: any): string {
  if (!x) return "";
  if (typeof x === "string") return x;
  return String(x._id || x.id || x.value || "").trim();
}

function getBusinessNameFromRecord(rec: any): string {
  const v = rec?.values || rec || {};
  return String(
    v.BusinessName ||
    v["Business Name"] ||
    v.Name ||
    v.name ||
    v.title ||
    ""
  ).trim();
}

function getProIdFromBusinessRecord(bizRec: any) {
  const v = bizRec?.values || {};
  return (
    bizRec?.createdBy ||
    v?.proUserId ||          // ✅ this will now exist
    v?.ownerUserId ||
    v?.providerId ||
    null
  );
}



async function fetchBusinessRecordById(businessId: string) {
  const res = await fetch(
    `${API}/public/records?dataType=Business&_id=${encodeURIComponent(businessId)}&limit=1&ts=${Date.now()}`,
    { cache: "no-store", credentials: "include" }
  );

  const data = await res.json().catch(() => null);

  const rows = Array.isArray(data)
    ? data
    : (data?.items || data?.records || data?.data || []);

  return rows[0] || null; // ✅ THIS is the Business record
}

function normalizeImageUrl(url: string, API: string) {
  if (!url) return "";
  if (url.startsWith("http")) return url;
  if (url.startsWith("/")) return `${API}${url}`;
  return `${API}/${url}`;
}

async function fetchCategoriesForCalendar(businessId: string, calendarId: string) {
  // ✅ IMPORTANT: your DataType field is named "Calendar" (per your screenshot)
  const url = `${API}/public/records?dataType=Category&Calendar=${encodeURIComponent(calendarId)}&ts=${Date.now()}`;
  console.log("[cats] url", url);

  const r = await fetch(url, { cache: "no-store" });
  if (r.ok) {
  const payload = await r.json().catch(() => null);
const rows = unpackRows(payload);

    if (Array.isArray(rows) && rows.length) {
      return rows.map((doc: any) => {
        const v = doc.values || {};
        const name =
          v.Name || v.name || v["Category Name"] || v.categoryName || "Category";
        const desc =
          v.Description || v.description || v.Details || v.details || "";

        return {
          _id: String(doc._id),
          name: String(name),
          desc: String(desc || ""),
          // ✅ keep ids so filtering works
          calendarId: refId(v.Calendar || v.calendarId),
          businessId: refId(v.Business || v.businessId),
        };
      });
    }
  }

  // fallback by Business (also use the real field name "Business")
  const url2 = `${API}/public/records?dataType=Category&Business=${encodeURIComponent(businessId)}&ts=${Date.now()}`;
  console.log("[cats] fallback", url2);

const r2 = await fetch(url2, { cache: "no-store" });
const payload2 = r2.ok ? await r2.json().catch(() => null) : null;
const rows2 = unpackRows(payload2);

return Array.isArray(rows2)
  ? rows2.map((doc: any) => {
      const v = doc.values || {};
      const name = v.Name || v.name || v["Category Name"] || v.categoryName || "Category";
      const desc = v.Description || v.description || v.Details || v.details || "";
      return {
        _id: String(doc._id),
        name: String(name),
        desc: String(desc || ""),
        calendarId: refId(v.Calendar || v.calendarId),
        businessId: refId(v.Business || v.businessId),
      };
    })
  : [];

}



// REPLACE your fetchServicesForCategory with this version
async function fetchServicesForCategory(businessId: string, categoryId: string) {
  const URLS: string[] = [];

  // 1) Try by category id with a few common field names
  for (const key of ["Category", "categoryId", "Categories"]) {
    URLS.push(
      `${API}/public/records?dataType=Service&${encodeURIComponent(key)}=${encodeURIComponent(
        categoryId
      )}&ts=${Date.now()}`
    );
  }

  // 2) (Optional) dotted lookups — harmless if ignored
  for (const key of ["Category._id", "Categories._id"]) {
    URLS.push(
      `${API}/public/records?dataType=Service&${encodeURIComponent(key)}=${encodeURIComponent(
        categoryId
      )}&ts=${Date.now()}`
    );
  }

  // try each URL until one returns rows
  for (const url of URLS) {
    console.log("[services] try", url);
    try {
      const r = await fetch(url, { cache: "no-store" });
      if (!r.ok) continue;

      const payload = await r.json().catch(() => null);
      const rows = unpackRows(payload);

      console.log("[services] rows from try:", rows.length);
      if (Array.isArray(rows) && rows.length) return rows.map(mapServiceDoc);
    } catch {}
  }

  // 3) Fallback: fetch ALL services for the business, then filter locally
  const url = `${API}/public/records?dataType=Service&Business=${encodeURIComponent(
    businessId
  )}&ts=${Date.now()}`;

  console.log("[services] fallback (by Business) → filter locally", url);

  try {
    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) return [];

    const payload = await r.json().catch(() => null);
    const rows = unpackRows(payload); // ✅ THIS is the missing part in your code

    console.log("[services] business rows:", rows.length);

    const filtered = rows.filter((doc: any) => {
      const v = doc?.values || doc || {};

      const hit =
        String(v.categoryId || "") === String(categoryId) ||
        String(v.Category?._id || "") === String(categoryId) ||
        String(v.Category || "") === String(categoryId) ||
        (Array.isArray(v.Categories) &&
          v.Categories.some((c: any) => String(c?._id || c) === String(categoryId)));

      return hit;
    });

    console.log("[services] filtered rows:", filtered.length, { categoryId });

    return filtered.map(mapServiceDoc);
  } catch (e) {
    console.warn("[services] fallback error", e);
    return [];
  }
}


// normalizer
function mapServiceDoc(doc: any) {
  const v = (doc?.values || doc || {}) as any;

  const name =
    v.Name || v.name || v["Service Name"] || v.serviceName || v.Title || v.title || "Service";
  const desc = v.Description || v.description || v.Details || v.details || "";
  const price = v.Price ?? v.price ?? v.Cost ?? v.cost ?? "";

  const coerceMinutes = (val: any): number | undefined => {
    if (val == null) return undefined;
    const s = String(val).toLowerCase().trim();
    const h = /(\d+(\.\d+)?)\s*h/.exec(s)?.[1];
    const m = /(\d+)\s*m/.exec(s)?.[1];
    if (h || m) {
      const total = Math.round((h ? Number(h) * 60 : 0) + (m ? Number(m) : 0));
      return total > 0 ? total : undefined;
    }
    const num = Number(s.replace(/[^\d.]/g, ""));
    if (Number.isFinite(num) && num > 0) return Math.round(num);
    return undefined;
  };

const rawDur =
  v.durationMin ??              // already mapped value
  v.durationMinutes ??          // 👈 add this
  v.DurationMin ??
  v["Duration (min)"] ??
  v["Duration (mins)"] ??
  v["Duration Minutes"] ??      // your common label
  v["Service Time (mins)"] ??   // 👈 add exact label
  v["Service Time"] ??          // keep as loose backup
  v.Minutes ??
  v.Duration ??
  v.duration;


  console.log("[svc] mapServiceDoc duration", {
    id: String(doc._id || v._id || v.id),
    name,
    rawDur,
    allKeys: Object.keys(v),
  });

  const durationMin = coerceMinutes(rawDur) ?? DEFAULT_MIN_FOR_UNKNOWN;

  return {
    _id: String(doc._id || v._id || v.id),
    name: String(name),
    desc: String(desc || ""),
    price,
    durationMin,
    values: v,
  };
}



//Helpers

/////
// ===== time helpers (pure) =====
function addMinutesHHMM(start: string, mins: number): string {
  const [h, m] = start.split(":").map(Number);
  const total = (h * 60 + m + (mins || 0) + 24 * 60) % (24 * 60);
  const hh = String(Math.floor(total / 60)).padStart(2, "0");
  const mm = String(total % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}
function timeLTE(a: string, b: string) { return a <= b; } // "HH:MM" works lexicographically
function timeLT(a: string, b: string)  { return a <  b; }
function overlap(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  // intervals overlap if aStart < bEnd && bStart < aEnd
  return aStart < bEnd && bStart < aEnd;
}
function readMinFlexible(s: any): number {
  if (!s) return 0;
  const v = s.values || s || {};

  const raw =
    s?.durationMin ??                     // mapped field first
    v.durationMinutes ??
    v.DurationMin ??
    v["Duration (min)"] ??
    v["Duration (mins)"] ??
    v["Duration Minutes"] ??              // <- your label
    v["Service Time (mins)"] ??           // <- your label
    v.Minutes ??
    v.Duration ??
    v.duration;

  if (raw == null) return 0;

  if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) {
    return Math.round(raw);
  }

  if (typeof raw === "string") {
    const txt = raw.toLowerCase().trim();

    // "1h 30m", "2h"
    const h = /(\d+(\.\d+)?)\s*h/.exec(txt)?.[1];
    const m = /(\d+)\s*m/.exec(txt)?.[1];
    if (h || m) {
      const total = Math.round((h ? Number(h) * 60 : 0) + (m ? Number(m) : 0));
      if (total > 0) return total;
    }

    // "60", "60min"
    const onlyNum = Number(txt.replace(/[^\d.]/g, ""));
    if (Number.isFinite(onlyNum) && onlyNum > 0) return Math.round(onlyNum);
  }

  return 0;
}
// near the top of basicFlow.ts
const DEFAULT_MIN_FOR_UNKNOWN = 15; // (or whatever you want as fallback)

function serviceDurationMinutes(s: any): number {
  if (!s) return 0;

  const v = s.values || s || {};

  const raw =
    v.durationMinutes ??
    v.DurationMin ??
    v["Duration (min)"] ??
    v["Duration (mins)"] ??
    v["Duration Minutes"] ??
    v.ServiceDuration ??
    v.Minutes ??
    v.Duration ??
    v.duration ??       // ← your Service field
    s.durationMin ??
    s.duration;

  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
}


function sumMinutes(services: any[]): number {
  return services.reduce((acc, svc) => {
    const mins = serviceDurationMinutes(svc);
    return acc + (Number.isFinite(mins) && mins > 0 ? mins : 0);
  }, 0);
}


//Create Appointment helper
// src/app/[slug]/BookingFlows/basicFlow.tsx
// ...top of file (module scope)
let TYPE_CACHE: Record<string, string> = {}; // name -> id

async function getTypeIdByName(apiBase: string, typeName: string): Promise<string | null> {
  const key = String(typeName || "").toLowerCase().trim();
  if (TYPE_CACHE[key]) return TYPE_CACHE[key];

  const r = await fetch(`${apiBase}/api/datatypes`, { credentials: "include" });
  if (!r.ok) return null;

  const list = await r.json().catch(() => null);

  const found = Array.isArray(list)
    ? list.find((dt: any) =>
        String(dt?.name || dt?.values?.Name || "")
          .toLowerCase()
          .trim() === key
      )
    : null;

  const id = found?._id ? String(found._id) : null;
  if (id) TYPE_CACHE[key] = id;
  return id;
}



//State
// ── Provider Component──────────────────────────────────────────────────────────────────
export function BasicFlowProvider({ businessId, children }: { businessId: string; children: ReactNode; }) {
  console.log("[flow] BasicFlowProvider mount", { businessId });
useEffect(() => {
  console.log("[flow] useEffect boot", { businessId, path: window.location.pathname });
}, [businessId]);

  // calendars/categories/services
  const [calendars, setCalendars] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedCalendarId, setSelectedCalendarId] = useState<string | null>(null);
  const [categories, setCategories] = useState<any[]>([]);
  const [loadingCats, setLoadingCats] = useState(false);

  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [services, setServices] = useState<any[]>([]);
  const [loadingServices, setLoadingServices] = useState(false);
const [bookingInFlight, setBookingInFlight] = useState(false);
const params = useSearchParams();
const rescheduleId = params.get('reschedule'); // e.g. "6905ad14..."
const [isReschedule, setIsReschedule] = useState(false);
const [rescheduleApptId, setRescheduleApptId] = useState<string | null>(null);

const [multiSelection, setMultiSelection] = useState<string[]>([]);
const [pickedServiceIds, setPickedServiceIds] = useState<string[]>([]);
const [pickedServices, setPickedServices] = useState<any[]>([]);
const [currentUserId, setCurrentUserId] = useState<string | null>(null);
const pendingRef = useRef<(() => Promise<void> | void) | null>(null);

const [currentUser, setCurrentUser] = useState<any | null>(null);

const currentHoldIdRef = useRef<string | null>(null);

const [needsName, setNeedsName] = useState(false);

const [businessRec, setBusinessRec] = useState<any | null>(null);
const [heroUrl, setHeroUrl] = useState<string>("");


function addPick(id: string, svc: any) {
  const key = String(id);

  // update IDs
  setPickedServiceIds(prev => {
    const set = new Set(prev);
    set.add(key);
    return Array.from(set);
  });

  // update full objects
  setPickedServices(prev => {
    if (prev.some(s => String(s._id) === key)) return prev;
    return [...prev, svc];
  });
}

function removePick(id: string) {
  const key = String(id);

  setPickedServiceIds(prev =>
    prev.filter(x => String(x) !== key)
  );

  setPickedServices(prev =>
    prev.filter(s => String(s._id) !== key)
  );
}

function clearPicks() {
  setPickedServiceIds([]);
  setPickedServices([]);
}

function isPicked(id: string) {
  return pickedServiceIds.includes(String(id));
}
useEffect(() => {
  if (!businessId) return;

  (async () => {
    const biz = await fetchBusinessRecordById(businessId);

    console.log("[biz] fetched business record:", biz);
    console.log("[biz] values keys:", Object.keys(biz?.values || {}));
    console.log("[biz] Hero Image:", biz?.values?.["Hero Image"]);

    setBusinessRec(biz);

    const v = biz?.values || biz || {};
    const raw =
      v["Hero Image"] ||
      v.heroImage ||
      v.heroUrl ||
      "";

    const fixed = raw ? normalizeImageUrl(String(raw), API) : "";
    setHeroUrl(fixed);
  })();
}, [businessId]);

useEffect(() => {
    if (!businessId) return;
    (async () => {
      setLoading(true);
      setCalendars(await fetchCalendarsForBusiness(businessId));
      setLoading(false);
    })();
  }, [businessId]);
 const router = useRouter();
async function handleCalendarSelect(calId: string) {
  // 🧠 only if we’re actually switching calendars…
  if (calId !== selectedCalendarId) {
    // ❌ wipe multi-select state
    clearPicks();          // <- from your addPick/removePick/clearPicks
    setMultiSelection([]); // <- your multiSelection state
    setPickedServices([]); // <- so duration/summary reset too
  }

  setSelectedCalendarId(calId);

  // 🔄 reset everything downstream of Calendar
  setSelectedCategoryId(null);
  setServices([]);                 // clear services list
  setSelectedServiceId(null);
  setSelectedDateISO(null);
  setSlots({ morning: [], afternoon: [], evening: [] });

  setLoadingCats(true);
  try {
    const cats = await fetchCategoriesForCalendar(businessId, calId);
    setCategories(cats);
  } finally {
    setLoadingCats(false);
  }
}

async function handleCategorySelect(catId: string) {
  setSelectedCategoryId(catId);

  // 🔄 reset everything downstream of Category
  setSelectedServiceId(null);
  setSelectedDateISO(null);
  setSlots({ morning: [], afternoon: [], evening: [] });

  setLoadingServices(true);
  try {
    const svcs = await fetchServicesForCategory(businessId, catId);
    setServices(svcs);
  } finally {
    setLoadingServices(false);
  }
}


  useEffect(() => {
  (async () => {
    if (!rescheduleId) return;

    const appt = await fetchAppointmentById(rescheduleId);
    if (!appt) return;

    const v = appt.values || appt;

    // Extract ids from the existing appt
    const biz = v.Business?._id || v.businessId;
    const cal = v.Calendar?._id || v.calendarId;
    const svc = (Array.isArray(v['Service(s)']) && v['Service(s)'][0]?._id) || v.serviceId;

    // Lock the picks to match the original appointment
    // Use whatever you already expose; prefer your existing handlers
    if (cal) {
      // if you have a dedicated setter:
      // setSelectedCalendarId?.(cal);
      // else use your existing handler:
      handleCalendarSelect?.(cal);
    }
    if (svc) {
      handleServiceSelect?.(svc);
    }
    if (v.Date) {
      // if you have a direct setter:
      // setSelectedDateISO?.(v.Date);
      // else call your existing selectDate helper:
    selectDate?.(v.Date);

    }

    setIsReschedule(true);
    setRescheduleApptId(appt._id);

    // put a soft hold on the old record so no one grabs it while user is editing
    await holdAppointment(appt._id, true);
  })();

  // Release hold if the user navigates away
  return () => { if (rescheduleId) holdAppointment(rescheduleId, false).catch(()=>{}); };
}, [rescheduleId, businessId, selectedCalendarId]);

// ── Multi-category confirm helper (INSIDE BasicFlowProvider, no export) ──
async function handleMultiServiceSelect(idsFromThisCategory: string[]) {
  // idsFromThisCategory = whatever the UI says is checked in the CURRENT category
  const incoming = (idsFromThisCategory || []).map(String);

  // ✅ merge with what we already picked globally
  const mergedIds = Array.from(new Set([...(pickedServiceIds || []), ...incoming]));

  setMultiSelection(mergedIds);
  setSelectedServiceId("__MULTI__");

  // build known map from cache
  const known = new Map(Object.values(serviceCache || {}).map((s: any) => [String(s._id), s]));

  // fetch any missing
  const missingIds = mergedIds.filter(id => !known.has(id));
  const fetched = await fetchServicesByIds(missingIds);

  // cache fetched
  setServiceCache(prev => {
    const next = { ...(prev || {}) };
    for (const s of fetched) next[String(s._id)] = s;
    return next;
  });

  // build full picked services list in merged order
  const allSvcs = mergedIds
    .map(id => known.get(id) || fetched.find((s: any) => String(s._id) === id))
    .filter(Boolean) as any[];

  // ✅ THIS is your global truth
  setPickedServiceIds(mergedIds);
  setPickedServices(allSvcs);

  // duration = sum of ALL selected services across categories
  let newDur = sumMinutes(allSvcs);
  if (!Number.isFinite(newDur) || newDur <= 0) newDur = DEFAULT_MIN_FOR_UNKNOWN;

  setServiceDurationMin(newDur);
  setSelectedDateISO(null);
  setSlots({ morning: [], afternoon: [], evening: [] });

  await loadMonth({ base: monthCursor, minOverride: newDur });
}


async function handleServiceSelect(serviceId: string) {
  setSelectedServiceId(serviceId);
  setMultiSelection([]);

  const one = lookupService(serviceId); // ✅ pulls from cache across categories

  const mins = serviceDurationMinutes(one);
  setServiceDurationMin(
    Number.isFinite(mins) && mins > 0 ? mins : DEFAULT_MIN_FOR_UNKNOWN
  );

  setSelectedDateISO(null);
  setSlots({ morning: [], afternoon: [], evening: [] });
}


// helper inside basicFlow.ts (near top)
function svcMinutes(s: any): number {
  // you can paste the same logic you already have in Template.tsx
  const v = s?.values || s || {};
  const raw =
    v.durationMinutes ??
    v.DurationMin ??
    v["Duration (min)"] ??
    v["Duration (mins)"] ??
    v["Duration Minutes"] ??
    v.ServiceDuration ??
    v.Minutes ??
    v.Duration ??
    s?.durationMin ??
    s?.duration;

  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
}

useEffect(() => {
  (async () => {
    try {
      await getTypeIdByName(API, "Appointment");
      await getTypeIdByName(API, "Business");
      await getTypeIdByName(API, "Service");
    } catch {}
  })();
}, []);

function totalDurationFor(ids: string[]): number {
  const all = Object.values(serviceCache || {});
  const byId = new Map(all.map((s: any) => [String(s._id), s]));
  return ids.reduce((sum, id) => sum + svcMinutes(byId.get(String(id))), 0);
}

// helper: fetch a batch of services by _id (cross-category safe)
// ── Fetch helpers (continue) ──────────────────────────────────────────────
async function fetchServicesByIds(ids: string[]): Promise<any[]> {
  if (!Array.isArray(ids) || ids.length === 0) return [];
  const out: any[] = [];

  // If your API supports querying by _id list, you can optimize here.
  // Fallback: fetch one-by-one.
  for (const id of ids) {
    const url = `${API}/public/records?dataType=Service&_id=${encodeURIComponent(id)}&ts=${Date.now()}`;
    try {
      const r = await fetch(url, { cache: "no-store" });
      if (!r.ok) continue;
      const arr = await r.json();
      const doc = Array.isArray(arr) ? arr[0] : arr;
      if (!doc) continue;

      const v = (doc?.values || doc || {}) as any;
      const name =
        v.Name || v.name || v["Service Name"] || v.serviceName || v.Title || v.title || "Service";
      const desc = v.Description || v.description || v.Details || v.details || "";
      const price = v.Price ?? v.price ?? v.Cost ?? v.cost ?? "";

 const rawDur =
  v.durationMin ??              // already mapped value
  v.durationMinutes ??          // 👈 add this
  v.DurationMin ??
  v["Duration (min)"] ??
  v["Duration (mins)"] ??
  v["Duration Minutes"] ??      // your common label
  v["Service Time (mins)"] ??   // 👈 add exact label
  v["Service Time"] ??          // keep as loose backup
  v.Minutes ??
  v.Duration ??
  v.duration;


      const durationMin =
        readMinFlexible({ values: { Duration: rawDur }, durationMin: rawDur }) || DEFAULT_MIN_FOR_UNKNOWN;

      out.push({
        _id: String(doc._id || v._id || v.id),
        name: String(name),
        desc: String(desc || ""),
        price,
        durationMin,
        values: v,
      });
    } catch {}
  }
  return out;
}


  // availability
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

  
// ✅ place goBackToCalendars HERE (after the setters above)
const goBackToCalendars = () => {
  setSelectedServiceId(null);
  setSelectedCategoryId(null);
  setSelectedDateISO(null);
  setSelectedTimeHHMM(null);
  setServices([]);

    setSlots({ morning: [], afternoon: [], evening: [] });

  // 👈 key line: clear the picked calendar so the Calendars section shows
  setSelectedCalendarId(null);
  setCategories([]);
};

// Back to categories: keep calendar & category, clear service/date/time/slots
// Back to categories: show the category list again
const goBackToCategories = () => {
  // hide availability + service list
  setSelectedServiceId(null);
  setSelectedDateISO(null);
  setSelectedTimeHHMM(null);
  setSlots({ morning: [], afternoon: [], evening: [] });

  // ⬅️ key line: unselect the category so the Categories section renders
  setSelectedCategoryId(null);

  // optional: clear the loaded services
  setServices([]);
};

const goBackToServices = () => {
  setSelectedDateISO(null);
  setSelectedTimeHHMM(null);
  setSlots({ morning: [], afternoon: [], evening: [] });
  setSelectedServiceId(null); // ← key: hide Availability, show Services
};

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
  if (!Array.isArray(flatStarts) || !flatStarts.length) return [];
  if (!Number.isFinite(minMinutes) || minMinutes <= 0) {
    console.log("[fit] duration not set; returning raw starts:", flatStarts.length);
    return [...new Set(flatStarts)].sort();
  }

  const needSteps = Math.max(1, Math.ceil(minMinutes / 15));
  console.log("[fit] checking duration", minMinutes, "→ needSteps:", needSteps, "against", flatStarts.length, "starts");

  const set = new Set(flatStarts);
  const next = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    const total = (h || 0) * 60 + (m || 0) + 15;
    const hh = String(Math.floor(total / 60)).padStart(2, "0");
    const mm = String(total % 60).padStart(2, "0");
    return `${hh}:${mm}`;
  };

  const valid: string[] = [];
  for (const start of flatStarts) {
    let ok = true,
      cur = start;
    for (let i = 1; i < needSteps; i++) {
      cur = next(cur);
      if (!set.has(cur)) {
        ok = false;
        break;
      }
    }
    if (ok) valid.push(start);
  }
  console.log("[fit] valid starts after fit:", valid.length);
  return valid;
}


function buildCalendarGrid(
  monthCursor: Date,
  monthDays: { dateISO: string; isToday: boolean; isAvailable: boolean; isPast?: boolean }[]
) {
  // monthCursor should be the 1st of the month already (yours is)
  const y = monthCursor.getFullYear();
  const m = monthCursor.getMonth();

  // Sunday-first offset (0=Sun..6=Sat)
  const firstDow = new Date(y, m, 1).getDay();

  // placeholders for blank cells
  const blanks = Array.from({ length: firstDow }).map(() => ({
    kind: "blank" as const,
    key: `blank-${Math.random()}`,
  }));

  // real day cells
  const days = monthDays.map((d) => ({
    kind: "day" as const,
    key: d.dateISO,
    ...d,
  }));

  return [...blanks, ...days];
}

const calendarCells = React.useMemo(() => {
  return buildCalendarGrid(monthCursor, monthDays as any);
}, [monthCursor, monthDays]);

  function groupByTOA(times: string[]): SlotGroups {
    const g: SlotGroups = { morning: [], afternoon: [], evening: [] };
    for (const t of times) { const hr=parseInt(t.split(":")[0]||"0",10); if (hr<12) g.morning.push(t); else if (hr<17) g.afternoon.push(t); else g.evening.push(t); }
    return g;
  }

  function truthyBool(v: any): boolean { const s=String(v).toLowerCase().trim(); return v===true||v===1||s==="true"||s==="yes"||s==="y"; }
function readDurationMin(s: any): number {
  const v = s?.values || s || {};
  const raw =
    s?.durationMin ??
    v.durationMinutes ??     // <– in case you ever save this way
    v.DurationMin ??
    v["Duration (min)"] ??
    v["Duration (mins)"] ??
    v.Duration ??
    0;

  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

  async function getUpcomingHoursRows(businessId: string, calendarId: string): Promise<any[]> {
  const qsVariants = [
    `Business=${encodeURIComponent(businessId)}&Calendar=${encodeURIComponent(calendarId)}`,
    `Business._id=${encodeURIComponent(businessId)}&Calendar._id=${encodeURIComponent(calendarId)}`,
    `Calendar=${encodeURIComponent(calendarId)}`,
    `Calendar._id=${encodeURIComponent(calendarId)}`,
    `businessId=${encodeURIComponent(businessId)}&calendarId=${encodeURIComponent(calendarId)}`,
  ];
  let all: any[] = [];
  for (const qs of qsVariants) {
    const url = `${API}/public/records?dataType=Upcoming%20Hours&${qs}&ts=${Date.now()}`;
    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) continue;
   const payload = await r.json().catch(() => null);
const rows = unpackRows(payload);

    if (Array.isArray(rows)) all = all.concat(rows);
  }
  const wantId = String(calendarId);
  const filtered = (all || []).filter((row) => {
    const v = row?.values || row || {};
    const calId =
      refId(v.Calendar) ||
      refId(v.calendar) ||
      refId(v["Calendar Ref"]) ||
      v.calendarId ||
      v.CalendarId ||
      null;
    const sameCalendar = calId && String(calId) === wantId;
    const enabledField = v.Enabled ?? v.enabled ?? v["Is Enabled"];
    const availField = v["is Available"] ?? v.isAvailable ?? v.available;
    const passesEnabled = enabledField === undefined ? true : truthyBool(enabledField);
    const passesAvail = availField === undefined ? true : truthyBool(availField);
    return !!sameCalendar && passesEnabled && passesAvail;
  });
  const seen = new Set<string>();
  const dedup = filtered.filter((r) => {
    const id = String(r._id || r.id || Math.random());
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });

  console.log("[UH] filtered UH rows:", filtered.length, "deduped:", dedup.length);
  return dedup;
}



async function fetchAppointmentsForCalendar(calendarId: string): Promise<any[]> {
  const qsVariants = [
    `Calendar=${encodeURIComponent(calendarId)}`,
    `Calendar._id=${encodeURIComponent(calendarId)}`,
    `calendarId=${encodeURIComponent(calendarId)}`
  ];
  let all: any[] = [];
  for (const qs of qsVariants) {
    const url = `${API}/public/records?dataType=Appointment&${qs}&ts=${Date.now()}`;
    try {
      const r = await fetch(url, { cache: "no-store" });
      if (!r.ok) continue;
     const payload = await r.json().catch(() => null);
const rows = unpackRows(payload);

      if (Array.isArray(rows)) all = all.concat(rows);
    } catch {}
  }
  // Dedup + log
  const seen = new Set<string>();
  const dedup = all.filter((row) => {
    const id = String(row._id || row.id || Math.random());
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
  console.debug('[appts] fetched for calendar', calendarId, 'count:', dedup.length);
  return dedup;
}
// --- Single appointment fetch (by id) ---
async function fetchAppointmentById(id: string) {
  if (!id) return null;
  // Try multiple shapes; your API might support only one:
  const tries = [
    `${API}/public/records?dataType=Appointment&_id=${encodeURIComponent(id)}`,
    `${API}/api/records?dataType=Appointment&_id=${encodeURIComponent(id)}`
  ];
  for (const url of tries) {
    try {
      const r = await fetch(url, { credentials: "include", headers: { Accept: "application/json" } });
      if (!r.ok) continue;
      const data = await r.json();
      const rec =
        Array.isArray(data) ? data[0] :
        (data?.records?.[0] || data?.items?.[0]) || data;
      if (rec && (rec._id || rec.id)) return rec;
    } catch {}
  }
  return null;
}

//reschedule helper
// --- helpers (place near your other helpers once) ---
function toDayRange(dateISO: string) {
  const start = new Date(`${dateISO}T00:00:00`);
  const end   = new Date(`${dateISO}T23:59:59.999`);
  return { start, end };
}

async function fetchActiveHoldsForDay(calendarId: string, dateISO: string, ignoreApptId?: string | null) {
  const { start, end } = toDayRange(dateISO);
  const url = new URL(`${API}/api/holds/active`);
  url.searchParams.set("calendarId", calendarId);
  url.searchParams.set("start", start.toISOString());
  url.searchParams.set("end", end.toISOString());
  if (ignoreApptId) url.searchParams.set("ignoreAppointmentId", ignoreApptId);

  try {
    const r = await fetch(url.toString(), { credentials: "include" });

    if (r.status === 404) return []; // ✅ endpoint not implemented yet
    if (!r.ok) return [];

    const data = await r.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}


function toHHMM(d: Date) {
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}
// -----------------------------------------------



function buildSlotWindow(dateISO: string, startHHMM: string, durMin: number) {
  const [h, m] = startHHMM.split(':').map(Number);
  const s = new Date(`${dateISO}T00:00:00`);
  s.setHours(h || 0, m || 0, 0, 0);
  const e = new Date(s.getTime() + Math.max(0, durMin || 0) * 60_000);
  return { s, e };
}

function slotOverlapsAnyHold(slotS: Date, slotE: Date, holds: Array<{ start: string; end: string }>) {
  return holds.some(h => {
    const hs = new Date(h.start);
    const he = new Date(h.end);
    return slotS < he && hs < slotE; // standard overlap
  });
}
//Hold Helper 
async function validateSlot(opts: {
  calendarId: string;
  dateISO: string;
  startHHMM: string;
  durationMin: number;
  ignoreAppointmentId?: string | null;
}): Promise<boolean> {
  const r = await fetch(`${API}/api/availability/validate`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(opts),
  });
  if (r.ok) return true;
  if (r.status === 409) return false;
  // treat other errors as unavailable to be safe
  return false;
}

// --- Soft-hold toggle while user is editing a reschedule ---
async function holdAppointment(id: string, hold: boolean) {
  if (!id) return false;
  const r = await fetch(`${API}/api/records/Appointment/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ values: { Hold: !!hold } }),
  });
  return r.ok;
}

// --- Apply new Date/Time to the SAME appointment (commit the reschedule) ---
async function patchAppointment(apptId: string, dateISO: string, timeHHMM: string){
  const r = await fetch(`${API}/api/records/Appointment/${encodeURIComponent(apptId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type':'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      values: {
        Date: dateISO,
        Time: timeHHMM,
        Hold: false,                 // release hold on commit
        // You can also set a breadcrumb like RescheduledAt: new Date().toISOString()
      }
    }),
  });
  if (!r.ok) {
    console.error('[reschedule] PATCH failed', r.status, await r.text().catch(()=> ''));
    return false;
  }
  return true;
}

// Unified confirm handler: reschedule → PATCH, normal → create
// Unified confirm handler: validate → (reschedule PATCH | normal CREATE)
const onConfirm = async () => {
  if (!selectedDateISO || !selectedTimeHHMM || !selectedCalendarId) {
    alert("Pick a date, time, and calendar first.");
    return;
  }

  // 🔒 last-second recheck so two people can't take the same time
  const stillFree = await validateSlot({
    calendarId: selectedCalendarId!,
    dateISO: selectedDateISO!,
    startHHMM: selectedTimeHHMM!,
    durationMin: serviceDurationMin,
    ignoreAppointmentId: isReschedule ? rescheduleApptId : null,
  });

  if (!stillFree) {
    alert('Sorry — that time was just taken. Please pick another.');
    // refresh the list so the user sees updated availability
    setLoadingSlots(true);
    const grouped = await fetchDaySlotsClient({
      businessId,
      calendarId: selectedCalendarId!,
      dateISO: selectedDateISO!,
      minMinutes: serviceDurationMin,
    });
    setSlots(grouped);
    setLoadingSlots(false);
    return;
  }

  // If it's still free, proceed with the commit
  if (isReschedule && rescheduleApptId) {
    setBookingInFlight(true);
    try {
      const ok = await patchAppointment(rescheduleApptId, selectedDateISO, selectedTimeHHMM);
      if (!ok) { alert("Could not reschedule."); return; }

      // Optimistic remove + refetch of slots for that day
      if (selectedTimeHHMM && serviceDurationMin) {
        removeBookedFromSlots(selectedTimeHHMM, serviceDurationMin);
      }
      setLoadingSlots(true);
      const grouped = await fetchDaySlotsClient({
        businessId,
        calendarId: selectedCalendarId!,
        dateISO:    selectedDateISO!,
        minMinutes: serviceDurationMin,
      });
      setSlots(grouped);
      setLoadingSlots(false);

      // clear reschedule state
      setIsReschedule(false);
      setRescheduleApptId(null);
      setIsConfirmOpen(false);
      alert("Appointment rescheduled!");
    } finally {
      setBookingInFlight(false);
    }
  } else {
    // normal booking path
    const ok = await createAppointment();
    if (ok) setIsConfirmOpen(false);
  }
};


async function fetchMonthAvailabilityClient(opts: {
  businessId: string;
  calendarId: string;
  year: number;
  monthZeroBased: number;
  minMinutes: number;
}): Promise<Set<string>> {
  const rows = await getUpcomingHoursRows(opts.businessId, opts.calendarId);
  console.log("[monthAvail] UH rows fetched:", rows.length, "calendarId:", opts.calendarId);

  const monthDates = new Set<string>();
  for (const r of rows) {
    const v = r.values || r;
    const iso = pickISODate(v);
    if (!iso) continue;
    const d = new Date(iso + "T00:00:00");
    if (d.getFullYear() === opts.year && d.getMonth() === opts.monthZeroBased) {
      monthDates.add(iso);
    }
  }
  console.log("[monthAvail] unique UH dates in month:", [...monthDates]);

  const valid = new Set<string>();
  for (const iso of monthDates) {
    const grouped = await fetchDaySlotsClient({
      businessId: opts.businessId,
      calendarId: opts.calendarId,
      dateISO: iso,
      minMinutes: opts.minMinutes,
    });
    const counts = {
      morning: grouped.morning.length,
      afternoon: grouped.afternoon.length,
      evening: grouped.evening.length,
    };
    console.log("[monthAvail] day", iso, "slot counts:", counts, "min:", opts.minMinutes);
    if (counts.morning + counts.afternoon + counts.evening > 0) {
      valid.add(iso);
    }
  }
  console.log("[monthAvail] final valid days:", [...valid]);
  return valid;
}

function collectFlatStartsForDate(rows: any[], dateISO: string): string[] {
  console.log("[UH] collectFlatStartsForDate date:", dateISO);

  const starts: string[] = [];
  for (const r of rows) {
    const v = r.values || r;
    const iso = pickISODate(v);
    if (iso !== dateISO) continue;

    const rawStart = (v.Start || v.start || v["Start Time"] || v["Start"]) as string | undefined;
    const rawEnd = (v.End || v.end || v["End Time"] || v["End"]) as string | undefined;
    const start = normalizeHHMM(rawStart),
      end = normalizeHHMM(rawEnd);
    if (!start || !end) continue;

    starts.push(...buildQuarterSteps(start, end));
  }
  console.debug("[UH] starts before dedupe (count):", starts.length);
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
async function shiftMonth(deltaMonths: number) {
  const next = new Date(monthCursor.getFullYear(), monthCursor.getMonth() + deltaMonths, 1);
  setMonthCursor(next);
  setSelectedDateISO(null);
  setSlots({ morning: [], afternoon: [], evening: [] });
  await loadMonth({ base: next }); // keep your existing loadMonth
}

async function selectDate(dateISO: string) {
  console.log("[ui] selectDate()", {
    dateISO,
    calendarId: selectedCalendarId,
    serviceId: selectedServiceId,
    dur: serviceDurationMin,
  });

  setSelectedDateISO(dateISO);
  if (!businessId || !selectedCalendarId || !selectedServiceId) return;

  setLoadingSlots(true);
  const grouped = await fetchDaySlotsClient({
    businessId,
    calendarId: selectedCalendarId,
    dateISO,
    minMinutes: serviceDurationMin || 0,
  });

  console.debug("[table] BEFORE booking (rendered slots)");
  console.table([
    ...grouped.morning.map((t: string) => ({ bucket: "morning", time: t })),
    ...grouped.afternoon.map((t: string) => ({ bucket: "afternoon", time: t })),
    ...grouped.evening.map((t: string) => ({ bucket: "evening", time: t })),
  ]);

  setSlots(grouped);
  setLoadingSlots(false);
}

  //fetchslots helper
// Robust date extractor used for Appointment rows
function pickISODateLoose(v: any, fallback?: any): string | null {
  if (!v) return null;
  const candidates = [
    v.Date, v.date, v.dateISO, v.iso, v.day, v["Date (ISO)"], fallback
  ].filter(Boolean);
  for (const c of candidates) {
    const s = String(c);
    if (s.length >= 10) return s.slice(0, 10);
  }
  return null;
}
async function fetchDaySlotsClient(opts: {
  businessId: string;
  calendarId: string;
  dateISO: string;
  minMinutes: number;
}): Promise<SlotGroups> {
  try {
    // 1) Upcoming Hours → candidate starts for this date
    const rows = await getUpcomingHoursRows(opts.businessId, opts.calendarId);
    const starts = collectFlatStartsForDate(rows, opts.dateISO);
    const startsAfterFit = filterStartsByDuration(starts, opts.minMinutes);

    console.debug("[slots] UH starts", {
      date: opts.dateISO,
      UH: starts.length,
      fit: startsAfterFit.length,
      min: opts.minMinutes,
    });

    console.table(
      startsAfterFit.map((t) => ({
        bucket:
          parseInt(t.slice(0, 2), 10) < 12
            ? "morning"
            : parseInt(t.slice(0, 2), 10) < 17
              ? "afternoon"
              : "evening",
        time: t,
      }))
    );

    if (!startsAfterFit.length) {
      return groupByTOA([]);
    }

    // 2) Booked windows (appointments + holds)
    let appointmentsOk = false;
    let booked: { start: string; end: string }[] = [];

    // 2a) Appointments
    try {
      const appts = await fetchAppointmentsForCalendar(opts.calendarId);
      appointmentsOk = true;

      const seenById = new Set<string>();
      const seenPair = new Set<string>();

      booked = appts
        .map((doc: any) => {
          const v = doc.values || doc;

          // ✅ calendar id can be an object OR a plain string
          const calId =
            refId(v.Calendar) ||
            refId(v.calendar) ||
            v.calendarId ||
            v.CalendarId;

          if (String(calId || "") !== String(opts.calendarId)) return null;

          const iso = pickISODateLoose(v, v?.Date);
          if (iso !== opts.dateISO) return null;

          const canceled =
            String(v["is Canceled"] ?? v.canceled ?? v.cancelled ?? false).toLowerCase() ===
            "true";
          if (canceled) return null;

          const hold =
            String(v.Hold ?? v.hold ?? false).toLowerCase() === "true";
          if (hold) return null;

          // ✅ recognize StartTime / DurationMin (and derive from EndTime if needed)
          const start = normalizeHHMM(
            v.Time ??
              v["Start Time"] ??
              v.start ??
              v.Start ??
              v.StartTime // NEW
          );

          let dur = Number(
            v.Duration ??
              v.duration ??
              v["Duration (min)"] ??
              v.Minutes ??
              v["Service Duration"] ??
              v.DurationMin ?? // NEW
              v["DurationMin"] ?? // NEW (just in case)
              0
          );

          if ((!Number.isFinite(dur) || dur <= 0) && start) {
            const endTxt = v.EndTime ?? v["End Time"] ?? v.end ?? v.End ?? null;
            const endHHMM = normalizeHHMM(endTxt);
            if (endHHMM) {
              const [sh, sm] = start.split(":").map(Number);
              const [eh, em] = endHHMM.split(":").map(Number);
              const delta = eh * 60 + em - (sh * 60 + sm);
              if (Number.isFinite(delta) && delta > 0) dur = delta;
            }
          }

          if (!start || !Number.isFinite(dur) || dur <= 0) return null;

          const end = addMinutesHHMM(start, dur);

          const id = String(doc._id || "");
          if (id && seenById.has(id)) return null;
          if (id) seenById.add(id);

          const key = `${start}-${end}`;
          if (seenPair.has(key)) return null;
          seenPair.add(key);

          return { start, end };
        })
        .filter(Boolean) as { start: string; end: string }[];
    } catch (e) {
      console.warn(
        "[slots] fetchAppointmentsForCalendar failed — ignoring booked filter",
        e
      );
      booked = [];
      appointmentsOk = false;
    }

    // 2b) Local short hold (lastBooked)
    try {
      const jb = JSON.parse(localStorage.getItem("lastBooked") || "null");
      if (
        jb &&
        String(jb.calId) === String(opts.calendarId) &&
        jb.date === opts.dateISO &&
        Date.now() - jb.ts < 5 * 60 * 1000
      ) {
        const heldStart = jb.start as string;
        const heldEnd = addMinutesHHMM(jb.start, jb.duration);

        if (!booked.some((b) => b.start === heldStart && b.end === heldEnd)) {
          booked.push({ start: heldStart, end: heldEnd });
        }
      }
    } catch {}

    // 2c) Server holds
    try {
      const holds = await fetchActiveHoldsForDay(
        opts.calendarId,
        opts.dateISO,
        rescheduleApptId
      );

      if (Array.isArray(holds) && holds.length) {
        for (const h of holds) {
          const hs = new Date(h.start);
          const he = new Date(h.end);
          const hhmmStart = toHHMM(hs);
          const hhmmEnd = toHHMM(he);

          if (!booked.some((b) => b.start === hhmmStart && b.end === hhmmEnd)) {
            booked.push({ start: hhmmStart, end: hhmmEnd });
          }
        }
      }
    } catch (e) {
      console.warn("[slots] holds fetch failed — continuing without holds", e);
    }

    console.log("[slots] booked windows used:", booked.length);
    if (booked.length) {
      console.table(booked.map((b) => ({ start: b.start, end: b.end })));
    }

    // 3) Remove time slots that overlap booked windows
    const validStarts = startsAfterFit.filter((s) => {
      const slotEnd = addMinutesHHMM(s, opts.minMinutes); // ✅ use FULL selected duration
      return !booked.some((b) => overlap(s, slotEnd, b.start, b.end));
    });

    console.log(
      "[slots] validStarts after booked overlap removal:",
      validStarts.length
    );

    // If we had UH-fit starts but ended up with zero after removing booked:
    if (!validStarts.length && startsAfterFit.length) {
      // Appointments loaded OK ⇒ truly fully booked
      if (appointmentsOk) {
        console.warn("[slots] fully booked for this day — returning empty");
        return groupByTOA([]);
      }

      // Appointments failed ⇒ fallback to UH-fit so UI still shows something
      console.warn(
        "[slots] appointments unavailable — returning UH-fit as fallback to keep UI usable"
      );
      return groupByTOA(startsAfterFit);
    }

    return groupByTOA(validStarts);
  } catch (e) {
    console.error(
      "[slots] fetchDaySlotsClient error, falling back to UH-only",
      e
    );

    try {
      const rows = await getUpcomingHoursRows(opts.businessId, opts.calendarId);
      const starts = collectFlatStartsForDate(rows, opts.dateISO);
      const fit = filterStartsByDuration(starts, opts.minMinutes);
      return groupByTOA(fit);
    } catch {
      return groupByTOA([]);
    }
  }
}

//Rescheule Hold helpers
// Track the current hold so we can release/replace it

async function createHold(opts: {
  businessId: string;
  calendarId: string;
  appointmentId: string; // reschedule target
  clientUserId: string;  // whoever is logged in
  dateISO: string;
  timeHHMM: string;
  durationMin: number;
}) {
  const start = new Date(`${opts.dateISO}T${opts.timeHHMM}:00`);
  const end   = new Date(start.getTime() + Math.max(0, opts.durationMin || 0) * 60_000);

  const r = await fetch(`${API}/api/holds`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      businessId:    opts.businessId,
      calendarId:    opts.calendarId,
      appointmentId: opts.appointmentId,
      clientUserId:  opts.clientUserId,
      start:         start.toISOString(),
      end:           end.toISOString(),
    }),
  });

  if (!r.ok) {
    console.warn('[HOLD] create failed', r.status, await r.text().catch(()=> ''));
    return null;
  }
  const json = await r.json();
  console.log('[HOLD] created', json);
currentHoldIdRef.current = String(json.holdId || "");
return currentHoldIdRef.current;

}

async function releaseHold() {
if (!currentHoldIdRef.current) return;
const id = currentHoldIdRef.current;

try {
  const r = await fetch(`${API}/api/holds/${encodeURIComponent(id)}`, {
    method: "DELETE",
    credentials: "include",
  });
  console.log("[HOLD] released", id, r.ok);
} finally {
  currentHoldIdRef.current = null;
}

}


function startOfDayLocal(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function parseISOToLocalStart(iso: string) {
  const [y, m, day] = iso.split("-").map(Number);
  return new Date(y, m - 1, day);
}

//Change time to standard time 
function to12h(hhmm: string) {
  const [hStr, mStr] = hhmm.split(":");
  const h = Number(hStr);
  const m = Number(mStr);

  const suffix = h >= 12 ? "PM" : "AM";
  const h12 = ((h + 11) % 12) + 1; // 0->12, 13->1, etc
  return `${h12}:${String(m).padStart(2, "0")} ${suffix}`;
}

// ─────────────────────────────────────────────
// Month builder + auto-refresh
// ─────────────────────────────────────────────
async function loadMonth({ base, minOverride }: { base: Date; minOverride?: number }) {
  const effMin =
    Number.isFinite(minOverride as number) && (minOverride as number) > 0
      ? (minOverride as number)
      : serviceDurationMin;

  const hasSvc = !!selectedServiceId || (Number.isFinite(effMin) && effMin > 0);

  console.log("[loadMonth] params", {
    calendarId: selectedCalendarId,
    serviceId: selectedServiceId,
    effMin,
    base: base.toISOString().slice(0, 7),
  });

  if (!businessId || !selectedCalendarId || !hasSvc || !effMin) {
    console.warn("[loadMonth] guard blocked", {
      hasBiz: !!businessId,
      hasCal: !!selectedCalendarId,
      hasSvc,
      effMin,
    });
    return;
  }

  setLoadingMonth(true);

  const avail = await fetchMonthAvailabilityClient({
    businessId,
    calendarId: selectedCalendarId!,
    year: base.getFullYear(),
    monthZeroBased: base.getMonth(),
    minMinutes: effMin,
  });

  const { start, end } = monthBoundaries(base);
  const toYMD = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const todayYMD = toYMD(new Date());

  const days: { dateISO: string; isToday: boolean; isAvailable: boolean }[] = [];
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const ymd = toYMD(d);
    days.push({
      dateISO: ymd,
      isToday: ymd === todayYMD,
      isAvailable: avail.has(ymd),
    });
  }

// ✅ after you finish building `days` in the for-loop:
const today0 = startOfDayLocal(new Date());

const daysWithPast = days.map((d) => {
  const day0 = parseISOToLocalStart(d.dateISO);
  const isPast = day0 < today0;

  return {
    ...d,
    isPast,
    isAvailable: !isPast && d.isAvailable, // 👈 kills green highlight on past dates
  };
});

setMonthDays(daysWithPast);

// logs should use daysWithPast now
const availDays = daysWithPast.filter((d) => d.isAvailable).map((d) => d.dateISO);
console.debug("[avail] month days available", {
  month: base.toISOString().slice(0, 7),
  count: availDays.length,
  days: availDays,
  minMinutes: effMin,
});


  setMonthLabel(base.toLocaleString(undefined, { month: "long", year: "numeric" }));
  setLoadingMonth(false);

  console.log("[flow] monthDays built:", {
    month: base.toISOString().slice(0, 7),
    total: days.length,
    availableCount: days.filter((d) => d.isAvailable).length,
  });
}

// keep the label in sync when just the cursor changes
useEffect(() => {
  setMonthLabel(monthCursor.toLocaleString(undefined, { month: "long", year: "numeric" }));
}, [monthCursor]);

// 🟢 Auto-refresh calendar when both a calendar & service are chosen
useEffect(() => {
  if (!businessId || !selectedCalendarId || !selectedServiceId || !serviceDurationMin) return;

  console.log("[flow] reload month for", {
    calendarId: selectedCalendarId,
    serviceId: selectedServiceId,
    dur: serviceDurationMin,
    month: monthCursor.toISOString().slice(0, 7),
  });

  // let loadMonth handle the loading states
  loadMonth({ base: monthCursor });
}, [
  businessId,
  selectedCalendarId,
  selectedServiceId,
  serviceDurationMin,
  monthCursor,
]);
// cache services we've seen (cross-category)
// cache services we've seen (cross-category)
const [serviceCache, setServiceCache] = useState<Record<string, any>>({});

// whenever you load services for a category, cache them:
useEffect(() => {
  if (!services?.length) return;
  setServiceCache(prev => {
    const next = { ...prev };
    for (const s of services) next[String(s._id)] = s;
    return next;
  });
}, [services]);

// 🔹 all services we've ever seen (across categories)
const allServices = React.useMemo(
  () => Object.values(serviceCache),
  [serviceCache]
);

// helper to look up a service by id from cache or current list
function lookupService(id: string) {
  return serviceCache[id] || (services || []).find((s: any) => String(s._id) === String(id)) || null;
}


  // ── AUTH (inside component!) ────────────────────────────────────────────────
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);


function openAuth() {
  // if user hit auth from the confirm modal, return to "book" after login
  if (isConfirmOpen) {
    pendingRef.current = () => {
      setConfirmStage("book");
      setIsConfirmOpen(true);
    };
  }
  setIsAuthOpen(true);
}


  function closeAuth(){ setIsAuthOpen(false); }

// 🔁 BASIC login: hits POST /login and then GET /check-login
// 🔁 BASIC login: hits POST /auth/login and then GET /check-login
async function login(email: string, password: string): Promise<boolean> {
  try {
    // 1) Log in
    const r = await fetch(`${API}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, password }),
    });

    if (!r.ok) {
      setIsLoggedIn(false);
      setCurrentUserId(null);
      setCurrentUser(null);
      return false;
    }

    // 2) Confirm session is actually set (cookie -> session -> user)
    const meRes = await fetch(`${API}/check-login?ts=${Date.now()}`, {
      credentials: "include",
      cache: "no-store",
      headers: { Accept: "application/json" },
    });

    if (!meRes.ok) {
      setIsLoggedIn(false);
      setCurrentUserId(null);
      setCurrentUser(null);
      return false;
    }

    const me = await meRes.json().catch(() => ({}));

    const uid =
      me?.userId ||
      me?.user?.id ||
      me?.user?._id ||
      me?._id ||
      me?.id ||
      null;

    const loggedIn =
      !!me?.loggedIn ||
      !!me?.isLoggedIn ||
      !!me?.authenticated ||
      !!uid;

    if (!loggedIn || !uid) {
      setIsLoggedIn(false);
      setCurrentUserId(null);
      setCurrentUser(null);
      return false;
    }

    const userObj = me?.user || me?.profile || me || null;

    const firstNameVal =
      userObj?.firstName ||
      userObj?.values?.firstName ||
      userObj?.values?.["First Name"] ||
      "";

    const lastNameVal =
      userObj?.lastName ||
      userObj?.values?.lastName ||
      userObj?.values?.["Last Name"] ||
      "";

    setCurrentUserId(String(uid));
    setIsLoggedIn(true);
    setNeedsName(!firstNameVal || !lastNameVal);
    setCurrentUser(userObj);

    // keep a global copy if you’re using window.STATE elsewhere
    try {
      (window as any).STATE = {
        ...(window as any).STATE,
        userId: String(uid),
        user: userObj,
      };
    } catch {}

    setIsAuthOpen(false);

    // run whatever was pending after auth (ONLY ONCE)
    const pendingFn = pendingRef.current;
    pendingRef.current = null;
    if (pendingFn) await Promise.resolve(pendingFn());

    return true;
  } catch (err) {
    setIsLoggedIn(false);
    setCurrentUserId(null);
    setCurrentUser(null);
    return false;
  }
}



 function requireAuthThen(fn: () => Promise<void> | void) {
  if (isLoggedIn) {
    Promise.resolve(fn());
  } else {
    pendingRef.current = fn;
    openAuth();
  }
}


  // ---------- Confirm modal state ----------
  // confirm popup
const [selectedTimeHHMM, setSelectedTimeHHMM] = useState<string | null>(null);

const [isConfirmOpen, setIsConfirmOpen] = useState(false);
const [confirmStage, setConfirmStage] = useState<ConfirmStage>("review");

function openConfirm(timeHHMM: string) {
  console.debug('[ui] openConfirm', { dateISO: selectedDateISO, timeHHMM });

  setSelectedTimeHHMM(timeHHMM);
  setConfirmStage("review");
  setIsConfirmOpen(true);

  // 🟢 Create a 5-min soft hold if this is a reschedule
  if (isReschedule && rescheduleApptId && selectedDateISO && selectedCalendarId) {
    // You need your logged-in user id. If you store it in state/session, swap this line:
    const clientUserId = (window as any).currentUser?._id || (window as any).STATE?.userId || 'anonymous';

    createHold({
      businessId,
      calendarId: selectedCalendarId,
      appointmentId: rescheduleApptId,
      clientUserId,
      dateISO: selectedDateISO,
      timeHHMM,
      durationMin: serviceDurationMin,
    }).catch(()=>{});
  }
}

function reopenConfirmAsBook() {
  if (isLoggedIn) {
    // already signed in → just switch the confirm modal to the “book” step
    setConfirmStage("book");
    setIsConfirmOpen(true);
    return;
  }
  // not signed in → open Auth and, after login, return to “book”
  pendingRef.current = () => {
    setConfirmStage("book");
    setIsConfirmOpen(true);
  };
  setIsAuthOpen(true);
}


// inside BasicFlowProvider (it's a client component)
  const closeConfirm = (mode?: "soft" | "hard" | boolean) => {
    setIsConfirmOpen(false);
    if (isReschedule) releaseHold().catch(() => {});

    if (mode === "soft") {
      try { router.refresh(); } catch {}
    } else if (mode === "hard" || mode === true) {
      if (typeof window !== "undefined") window.location.reload();
    }
  };

// 🔧 remove the just-booked time from the visible lists (optimistic UI)
// how many minutes to assume if we really can't figure it out


// inside BookingFlowProvider component, next to createAppointment
function removeBookedFromSlots(startHHMM: string, bookedMinutes?: number) {
  const minutes =
    bookedMinutes && bookedMinutes > 0
      ? bookedMinutes
      : serviceDurationMin && serviceDurationMin > 0
      ? serviceDurationMin
      : DEFAULT_MIN_FOR_UNKNOWN;

  const steps = Math.max(1, Math.ceil(minutes / 15));
  console.log("[removeBookedFromSlots]", { startHHMM, bookedMinutes, minutes, steps });

  const stepForward = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    const total = (h || 0) * 60 + (m || 0) + 15;
    const hh = String(Math.floor(total / 60)).padStart(2, "0");
    const mm = String(total % 60).padStart(2, "0");
    return `${hh}:${mm}`;
  };

  setSlots((prev) => {
    // build a set of times to remove: start, start+15, start+30, ...
    const toRemove = new Set<string>();
    let cur = startHHMM;
    for (let i = 0; i < steps; i++) {
      toRemove.add(cur);
      cur = stepForward(cur);
    }

    const keep = (list: string[]) =>
      Array.isArray(list) ? list.filter((t) => !toRemove.has(t)) : [];

    return {
      morning: keep(prev.morning),
      afternoon: keep(prev.afternoon),
      evening: keep(prev.evening),
    };
  });
}


      //Appointment Card 
// --- (optional) helper kept at module scope ---
// --- replace fetchBusinessNameStrict entirely ---
async function fetchBusinessNameStrict(bizId: string): Promise<string> {
  if (!bizId) return "";
  const url = `${API}/public/records?dataType=Business&_id=${encodeURIComponent(bizId)}`;

  try {
    const r = await fetch(url, { credentials: "include" });
    if (!r.ok) {
      console.warn("[bizName] public/records  failed", r.status, await r.text().catch(()=>""));
      return "";
    }
    const data: any = await r.json();
    const rec =
      Array.isArray(data) ? data[0] :
      (data?.records?.[0] || data?.items?.[0]) || data;

    const v = rec?.values ?? rec ?? {};
    const name: string = v?.Name ?? v?.name ?? v?.title ?? "";
    return name ? String(name) : "";
  } catch (e) {
    console.warn("[bizName] error", e);
    return "";
  }
}


// 🧾 actually create the appointment on your API (FINAL, single source of truth)
async function createAppointment() {
  if (bookingInFlight) return false;
  if (!selectedCalendarId || !selectedDateISO || !selectedTimeHHMM) return false;

  setBookingInFlight(true);

  try {
    const isMulti = selectedServiceId === "__MULTI__";

    let allPicked: any[] = [];
    let serviceIds: string[] = [];

    if (isMulti) {
      // 🔹 MULTI: trust the pickedServices array you already set in handleMultiServiceSelect
      allPicked = pickedServices.slice();
      serviceIds = pickedServices.map((s: any) => String(s._id));

      console.log("[createAppointment] multi mode", {
        serviceIds,
        pickedDurations: allPicked.map((s: any) => ({
          id: s._id,
          name: s.name,
          durationMin: s.durationMin,
          valuesDuration: s.values?.duration,
        })),
      });
    } else {
      // 🔹 SINGLE: look up the one selected service
      const svc = lookupService(selectedServiceId!);
      if (svc) {
        allPicked = [svc];
        serviceIds = [String(svc._id)];
      }

      console.log("[createAppointment] single mode", {
        serviceIds,
        pickedDurations: allPicked.map((s: any) => ({
          id: s._id,
          name: s.name,
          durationMin: s.durationMin,
          valuesDuration: s.values?.duration,
        })),
      });
    }

    // 🔢 recompute duration from the ACTUAL picked services
    let combinedMin = sumMinutes(allPicked);
    if (!Number.isFinite(combinedMin) || combinedMin <= 0) {
      // fall back to whatever the flow thought the duration was
      combinedMin =
        serviceDurationMin && serviceDurationMin > 0
          ? serviceDurationMin
          : DEFAULT_MIN_FOR_UNKNOWN;
    }

    console.log("[createAppointment] duration debug", {
      isMulti,
      serviceDurationMin,
      combinedMin,
      pickedCount: allPicked.length,
    });

    const combinedPrice = allPicked.reduce((acc, s) => {
      const p = Number(s?.price ?? s?.values?.Price ?? 0);
      return acc + (Number.isFinite(p) ? p : 0);
    }, 0);

    const firstName =
  currentUser?.firstName ||
  currentUser?.values?.firstName ||
  currentUser?.values?.["First Name"] ||
  "";

const lastName =
  currentUser?.lastName ||
  currentUser?.values?.lastName ||
  currentUser?.values?.["Last Name"] ||
  "";

let providerId: string | null = null;
let businessName = "";

// Always derive BOTH from the Business record
if (businessId) {
  try {
   const bizRec = await fetchBusinessRecordById(businessId);

console.log("[bizRec.createdBy]", bizRec?.createdBy);
console.log("[bizRec.values keys]", Object.keys(bizRec?.values || {}));

providerId = getProIdFromBusinessRecord(bizRec) || null;

console.log("[derived providerId]", providerId);

console.log("[bizRec FULL]", bizRec);
console.log("[bizRec.values]", bizRec?.values);

    businessName = getBusinessNameFromRecord(bizRec);
    providerId = getProIdFromBusinessRecord(bizRec) || null;

    console.log("[createAppointment] derived from Business", {
      businessId,
      businessName,
      providerId,
      bizKeys: Object.keys(bizRec?.values || bizRec || {}),
    });
  } catch (e) {
    console.warn("[createAppointment] business fetch/pro extract failed", e);
  }
}


const serviceNames = allPicked.map(s => s?.name).filter(Boolean).join(", ");

const values: any = {
  BusinessName: businessName,
  ServiceNames: serviceNames,

  Business: { _id: businessId },
  Calendar: { _id: selectedCalendarId },
  Client: currentUserId ? { _id: currentUserId } : undefined,

  ClientName: `${firstName} ${lastName}`.trim(),
  ClientFirstName: firstName,
  ClientLastName: lastName,

  businessId,
  calendarId: selectedCalendarId,
  clientId: currentUserId,

...(providerId ? { Pro: { _id: providerId }, proUserId: providerId } : {}),

  Date: selectedDateISO,
  StartTime: selectedTimeHHMM,
  EndTime: addMinutesHHMM(selectedTimeHHMM, combinedMin),

  DurationMin: combinedMin,
  Price: combinedPrice,

  "Service(s)": serviceIds.map((id) => ({ _id: id })),
};



    // ✅ DEBUG: appointment payload we are about to save
console.groupCollapsed("🧾 [createAppointment] payload");
console.log("businessId:", businessId);
console.log("calendarId:", selectedCalendarId);
console.log("clientUserId:", currentUserId);
console.log("selectedDateISO:", selectedDateISO);
console.log("selectedTimeHHMM:", selectedTimeHHMM);
console.log("serviceIds:", serviceIds);
console.log("combinedMin:", combinedMin);
console.log("combinedPrice:", combinedPrice);

// Print the actual record payload
console.log("values:", values);

// Pretty JSON (easy to copy/paste)
console.log("values JSON:", JSON.stringify(values, null, 2));

console.groupEnd();
 
const payload = {
  dataTypeName: "Appointment",
  dataType: "Appointment",
  values,
};

console.log("📦 [createAppointment] POST body:", payload);

const res = await fetch(`${API}/api/records/Appointment`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  credentials: "include",
  body: JSON.stringify({
    dataTypeName: "Appointment",
    dataType: "Appointment",
    values,
  }),
});

// ✅ READ BODY ONCE (as text), then parse it safely
const rawText = await res.text().catch(() => "");
let saved: any = null;

try {
  saved = rawText ? JSON.parse(rawText) : null;
} catch {}

// ✅ LOG WHAT WE GOT BACK
console.log("✅/❌ [createAppointment] status:", res.status);
console.log("[createAppointment] raw response:", rawText);
console.log("[createAppointment] parsed response:", saved);

if (!res.ok) {
  alert(`Booking failed (${res.status}). Check console.`);
  return false;
}

// ✅ OPTIONAL: fetch it back to confirm what actually got stored
if (saved?._id) {
  const check = await fetch(
    `${API}/public/records?dataType=Appointment&_id=${encodeURIComponent(saved._id)}&ts=${Date.now()}`,
    { cache: "no-store" }
  )
    .then((r) => r.json())
    .catch(() => null);

  console.log("🔎 [createAppointment] fetched back:", check);
}

    // 🔻 remove the whole block visually/ remove the appointment time
    if (selectedTimeHHMM && combinedMin) {
      removeBookedFromSlots(selectedTimeHHMM, combinedMin);
    }

    // refresh that day's slots
    if (selectedDateISO) {
      await selectDate(selectedDateISO);
    }

    localStorage.setItem(
      "lastBooked",
      JSON.stringify({
        calId: selectedCalendarId,
        date: selectedDateISO,
        start: selectedTimeHHMM,
        duration: combinedMin,
        ts: Date.now(),
      }),
    );

    clearPicks?.();
    return true;
  } catch (err) {
    console.error(err);
    return false;
  } finally {
    setBookingInFlight(false);
  }
}


// 🔁 On mount, use GET /check-login instead of /api/users/me
useEffect(() => {
  (async () => {
    try {
      const r = await fetch(`${API}/check-login?ts=${Date.now()}`, { credentials: "include" });
      if (!r.ok) { setIsLoggedIn(false); setCurrentUserId(null); return; }
      const data = await r.json().catch(() => ({}));
      const uid  = data?.userId || data?._id || data?.id || null;

      setCurrentUserId(uid || null);
      setIsLoggedIn(!!data?.loggedIn || !!uid);

      const userObj = data?.user || data?.profile || data;
setCurrentUser(userObj || null);

try {
  (window as any).STATE = {
    ...(window as any).STATE,
    userId: uid || null,
    user: userObj || null,
  };
} catch {}

      try { (window as any).STATE = { ...(window as any).STATE, userId: uid || null }; } catch {}
    } catch {
      setIsLoggedIn(false);
      setCurrentUserId(null);
    }
  })();
}, []);




//Flow Value
// ==== [FLOW_VALUE] Value passed to provider ===──────────────────────
const value: FlowContextType = {
  calendars, loading, selectedCalendarId, handleCalendarSelect,
  categories, loadingCats,
  selectedCategoryId, services, loadingServices, handleCategorySelect,

  selectedServiceId, selectedDateISO, monthCursor, monthLabel, monthDays,
  loadingMonth, loadingSlots, slots,

  serviceDurationMin, selectedTimeHHMM,

  isConfirmOpen, openConfirm, closeConfirm, confirmStage, reopenConfirmAsBook,

  handleServiceSelect, shiftMonth, selectDate,

  isLoggedIn, isAuthOpen, openAuth, closeAuth, login, requireAuthThen,

  createAppointment, removeBookedFromSlots,
heroUrl,
businessRec,

  isReschedule, rescheduleApptId, onConfirm,

  goBackToCalendars,
  goBackToCategories,
  goBackToServices,

  multiSelection,
  handleMultiServiceSelect,

  pickedServiceIds,
  pickedServices,
  addPick,
  removePick,
  clearPicks,
  isPicked,

  lookupService,
  currentUserId,
  currentUser,
   allServices,
   calendarCells,

};



  return <FlowCtx.Provider value={value}>{children}</FlowCtx.Provider>;
}

