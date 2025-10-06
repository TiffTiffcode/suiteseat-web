'use client';

import { useEffect, useMemo, useState } from 'react';
import { apiGet, apiLogin, apiMe } from '@/lib/api';
import Link from 'next/link';



// ------------ Types & helpers ------------
type Values = Record<string, string | number | boolean | null | undefined>;
type Row = { _id: string; values?: Values };

type RefObj = { _id?: string | number; id?: string | number };
function isRefObj(x: unknown): x is RefObj {
  return typeof x === 'object' && x !== null && ('_id' in x || 'id' in x);
}
function refId(x: unknown): string {
  if (typeof x === 'string' || typeof x === 'number') return String(x);
  if (isRefObj(x)) {
    const val = x._id ?? x.id;
    return val == null ? '' : String(val);
  }
  return '';
}
function hasId(candidate: unknown, id: string): boolean {
  if (!id) return false;
  if (Array.isArray(candidate)) return candidate.some((x) => hasId(x, id));
  const s = refId(candidate);
  return s ? s === id : false;
}

function text(v: Values, key: string): string | undefined {
  const val = v[key];
  if (val == null) return undefined;
  return typeof val === 'string' ? val : String(val);
}

// titles
function calTitle(r: Row) {
  const v = r.values ?? {};
  return (
    text(v, 'calendarName') ??
    text(v, 'name') ??
    text(v, 'Calendar Name') ??
    text(v, 'title') ??
    text(v, 'displayName') ??
    'Calendar'
  );
}
function catTitle(r: Row) {
  const v = r.values ?? {};
  return (
    text(v, 'categoryName') ??
    text(v, 'name') ??
    text(v, 'Category Name') ??
    text(v, 'title') ??
    text(v, 'displayName') ??
    'Category'
  );
}
function svcTitle(r: Row) {
  const v = r.values ?? {};
  return (
    text(v, 'serviceName') ??
    text(v, 'name') ??
    text(v, 'Service Name') ??
    text(v, 'title') ??
    text(v, 'displayName') ??
    'Service'
  );
}
function svcPrice(r: Row) {
  const v = r.values ?? {};
  const price = v.Price ?? v.price;
  const n = Number(price);
  return Number.isFinite(n) ? `$${n.toFixed(2)}` : '';
}
function svcDuration(r: Row) {
  const v = r.values ?? {};
  const d =
    v['Duration (min)'] ??
    v.duration ??
    v.durationMin ??
    v.durationMinutes ??
    v['Duration Minutes'];
  const n = Number(d);
  return Number.isFinite(n) && n > 0 ? `${n} min` : '';
}

 

// time helpers
function toISODateOnly(x: unknown): string {
  if (!x) return '';
  if (typeof x === 'string') {
    const m = x.match(/^(\d{4}-\d{2}-\d{2})/);
    if (m) return m[1];
    if (x.includes('T')) return x.split('T')[0];
    const d = new Date(x);
    return Number.isNaN(+d) ? '' : d.toISOString().slice(0, 10);
  }
  if (x instanceof Date) return x.toISOString().slice(0, 10);
  return '';
}
function addMinutesHHMM(hhmm: string, mins: number): string {
  const [h, m] = hhmm.split(':').map(Number);
  const total = h * 60 + m + mins;
  const hh = Math.floor(total / 60) % 24;
  const mm = total % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}
function timeLT(a: string, b: string) {
  const [ah, am] = a.split(':').map(Number);
  const [bh, bm] = b.split(':').map(Number);
  return ah < bh || (ah === bh && am < bm);
}
function overlap(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  return timeLT(aStart, bEnd) && timeLT(bStart, aEnd);
}
function to12h(hhmm = '00:00') {
  const [H, M = '0'] = String(hhmm).split(':');
  let h = parseInt(H, 10);
  const m = parseInt(M, 10);
  const ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${String(m).padStart(2, '0')} ${ap}`;
}
function shiftMonthISO(iso: string, delta: number): string {
  const base = iso ? new Date(`${iso}T00:00:00Z`) : new Date();
  const d = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), 1));
  d.setUTCMonth(d.getUTCMonth() + delta);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = '01';
  return `${yyyy}-${mm}-${dd}`;
}


// ------------ Component ------------

export default function BookingFlow({ businessId }: { businessId: string }) {
 
  // Modals
  const [showConfirm, setShowConfirm] = useState(false);
  const [showLogin,   setShowLogin]   = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  // Login form
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPass,  setLoginPass]  = useState('');
  const [loginErr,   setLoginErr]   = useState('');

  // Data + selection state
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string>('');

  const [calendars,     setCalendars]     = useState<Row[]>([]);
  const [selectedCalId, setSelectedCalId] = useState<string>('');

  const [categories,    setCategories]    = useState<Row[]>([]);
  const [selectedCatId, setSelectedCatId] = useState<string>('');

  const [services,      setServices]      = useState<Row[]>([]);
  const [selectedSvcId, setSelectedSvcId] = useState<string>('');

  const [dateISO,       setDateISO]       = useState<string>('');
  const [durationMin,   setDurationMin]   = useState<number>(0);
  const [timeslots,     setTimeslots]     = useState<Array<{ start: string; end: string }>>([]);
// the time the user picked
const [selectedTime, setSelectedTime] = useState<string>('');

// booking in-flight flag (disables buttons while saving)
const [booking, setBooking] = useState<boolean>(false);

// 5-minute hold id (returned by your /api/holds endpoint)
const [holdId, setHoldId] = useState<string>('');

// who is signed in (optional, used in Confirm modal)
const [me, setMe] = useState<{ email?: string; _id?: string; firstName?: string; lastName?: string } | null>(null);
async function createHoldForSelection(nextStart: string) {
  // release any previous hold
  if (holdId) {
    try { await fetch(`/api/holds/${holdId}`, { method: 'DELETE' }); } catch {}
    setHoldId('');
  }
  // create a new hold for 5 minutes
  try {
    const r = await fetch('/api/holds', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        calendarId: selectedCalId,
        dateISO,
        start: nextStart,
        durationMin,
      }),
    });
    if (r.ok) {
      const h = await r.json();
      setHoldId(h.id);
    }
  } catch {}
}


  // ✅ Close success modal + refresh
function onSuccessClose() {
  setShowSuccess(false);
  setSelectedTime('');
  // full hard reload of the current page
  window.location.reload();
}


  // Collapse + current step (compute AFTER all state declarations)
  const collapseCompletedSteps = true;
  const step =
    selectedSvcId && dateISO && selectedTime ? 4 :
    selectedSvcId && dateISO ? 3 :
    selectedSvcId ? 2 : 1;

  // ---- Calendars ----
  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        let rows = await apiGet<Row[]>(
          `/public/records?dataType=Calendar&Business=${encodeURIComponent(businessId)}`
        );
        if (!Array.isArray(rows) || rows.length === 0) {
          rows = await apiGet<Row[]>(
            `/public/records?dataType=Calendar&businessId=${encodeURIComponent(businessId)}`
          );
        }
        if (!cancel) setCalendars(Array.isArray(rows) ? rows : []);
      } catch (e) {
        if (!cancel) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [businessId]);

  // ---- Categories ----
  useEffect(() => {
    setCategories([]);
    setSelectedCatId('');
    setServices([]);
    setSelectedSvcId('');
    if (!selectedCalId) return;

    let cancel = false;
    (async () => {
      setError('');
      try {
        let rows: Row[] = [];

        const dataTypes = ['Category', 'Categories'] as const;
        const bKeys = ['Business', 'businessId'] as const;
        const cKeys = ['Calendar', 'calendarId'] as const;

        outer: for (const dt of dataTypes) {
          for (const bk of bKeys) {
            for (const ck of cKeys) {
              const url =
                `/public/records?dataType=${dt}&` +
                `${bk}=${encodeURIComponent(businessId)}&` +
                `${ck}=${encodeURIComponent(selectedCalId)}`;
              try {
                const r = await apiGet<Row[]>(url);
                if (Array.isArray(r) && r.length) {
                  rows = r;
                  break outer;
                }
              } catch {/* try next */}
            }
          }
        }

        if (!rows.length) {
          for (const dt of dataTypes) {
            for (const bk of bKeys) {
              const url = `/public/records?dataType=${dt}&${bk}=${encodeURIComponent(businessId)}`;
              try {
                const all = await apiGet<Row[]>(url);
                const filtered = (all || []).filter((r) => {
                  const v = r.values || {};
                  const cands =
                    v.Calendar ?? v.calendar ?? v['Calendar'] ?? v['Calendar Id'] ??
                    v['calendarId'] ?? v.calendarId ?? v['Calendar Ref'] ?? v['Calendars'] ??
                    v.Calendars ?? v['Calendar(s)'];
                  return hasId(cands, selectedCalId);
                });
                if (filtered.length) {
                  rows = filtered;
                  break;
                }
              } catch {/* continue */}
            }
            if (rows.length) break;
          }
        }

        if (!cancel) setCategories(rows);
      } catch (e) {
        if (!cancel) setError(e instanceof Error ? e.message : String(e));
      }
    })();

    return () => {
      cancel = true;
    };
  }, [businessId, selectedCalId]);

  // ---- Services ----
  useEffect(() => {
    setServices([]);
    setSelectedSvcId('');
    if (!selectedCalId) return;

    let cancel = false;
    (async () => {
      setError('');
      try {
        let rows: Row[] = [];

        const dataTypes = ['Service', 'Services'] as const;
        const bKeys = ['Business', 'businessId'] as const;
        const cKeys = ['Calendar', 'calendarId'] as const;
        const catKeys = ['Category', 'categoryId'] as const;

        const attempts: string[] = [];
        for (const dt of dataTypes) {
          for (const bk of bKeys) {
            if (selectedCatId) {
              for (const ck of cKeys) {
                for (const ak of catKeys) {
                  attempts.push(
                    `/public/records?dataType=${dt}&${bk}=${encodeURIComponent(businessId)}` +
                    `&${ck}=${encodeURIComponent(selectedCalId)}&${ak}=${encodeURIComponent(selectedCatId)}`
                  );
                }
              }
              for (const ak of catKeys) {
                attempts.push(
                  `/public/records?dataType=${dt}&${bk}=${encodeURIComponent(businessId)}` +
                  `&${ak}=${encodeURIComponent(selectedCatId)}`
                );
              }
            }
            for (const ck of cKeys) {
              attempts.push(
                `/public/records?dataType=${dt}&${bk}=${encodeURIComponent(businessId)}` +
                `&${ck}=${encodeURIComponent(selectedCalId)}`
              );
            }
          }
        }

        for (const url of attempts) {
          try {
            const r = await apiGet<Row[]>(url);
            if (Array.isArray(r) && r.length) { rows = r; break; }
          } catch {/* try next */}
        }

        if (!rows.length) {
          for (const dt of dataTypes) {
            for (const bk of bKeys) {
              try {
                const all = await apiGet<Row[]>(
                  `/public/records?dataType=${dt}&${bk}=${encodeURIComponent(businessId)}`
                );
                const filtered = (all || []).filter((r) => {
                  const v = r.values || {};
                  const calCands =
                    v.Calendar ?? v.calendar ?? v['Calendar'] ?? v['Calendar Id'] ??
                    v['calendarId'] ?? v.calendarId ?? v['Calendar Ref'] ?? v['Calendars'] ??
                    v.Calendars ?? v['Calendar(s)'];
                  const calOK = hasId(calCands, selectedCalId);

                  if (selectedCatId) {
                    const catCands =
                      v.Category ?? v.category ?? v['Category'] ?? v['Category Id'] ??
                      v['categoryId'] ?? v.categoryId ?? v['Category Ref'] ?? v['Categories'] ??
                      v.Categories ?? v['Category(s)'];
                    const catOK = hasId(catCands, selectedCatId);
                    return calOK && catOK;
                  }
                  return calOK;
                });
                if (filtered.length) { rows = filtered; break; }
              } catch {/* keep trying */}
            }
            if (rows.length) break;
          }
        }

        if (!cancel) setServices(rows);
      } catch (e) {
        if (!cancel) setError(e instanceof Error ? e.message : String(e));
      }
    })();

    return () => { cancel = true; };
  }, [businessId, selectedCalId, selectedCatId]);

  // When a service is chosen, capture its duration
  useEffect(() => {
    setSelectedTime('');
    setTimeslots([]);
    if (!selectedSvcId) { setDurationMin(0); return; }
    const svc = services.find((s) => s._id === selectedSvcId);
    const v = (svc?.values ?? {}) as Values;
    const d = Number(
      v['Duration (min)'] ??
      v.duration ??
      v.durationMin ??
      v.durationMinutes ??
      v['Duration Minutes'] ??
      0
    );
    setDurationMin(Number.isFinite(d) ? d : 0);
  }, [selectedSvcId, services]);

  // Compute timeslots from Upcoming Hours – Appointments
  useEffect(() => {
    setTimeslots([]);
    setSelectedTime('');
    if (!selectedCalId || !dateISO || !durationMin) return;

    let cancel = false;
    (async () => {
      try {
        const dt = encodeURIComponent('Upcoming Hours');
        const uh = await apiGet<Row[]>(
          `/public/records?dataType=${dt}&Business=${encodeURIComponent(businessId)}&Calendar=${encodeURIComponent(selectedCalId)}`
        );

        const uhSameDay = (uh || []).filter((r) => {
          const v = (r.values ?? {}) as Values;
          const d = toISODateOnly(v.Date ?? v.date ?? v.dateISO ?? v.startISO ?? '');
          return d === dateISO;
        });

        let appts: Row[] = [];
        try {
          const where = encodeURIComponent(JSON.stringify({ Calendar: { _id: selectedCalId } }));
          const priv = await apiGet<Row[]>(`/records/Appointment?where=${where}&limit=500`);
          if (Array.isArray(priv)) appts = priv;
        } catch {}
        if (!appts.length) {
          try {
            const pub = await apiGet<Row[]>(
              `/public/records?dataType=Appointment&Calendar=${encodeURIComponent(selectedCalId)}`
            );
            if (Array.isArray(pub)) appts = pub;
          } catch {}
        }

        const booked = (appts || [])
          .map((a) => (a.values ?? {}) as Values)
          .filter((v) => {
            const sameDay = toISODateOnly(v.Date ?? v.date ?? v.startISO ?? v.start ?? '') === dateISO;
            const status = String(v['Appointment Status'] ?? v.Status ?? '').toLowerCase();
            const cancelled = v['is Canceled'] === true || status.includes('cancel');
            return sameDay && !cancelled;
          })
          .map((v) => {
            const start =
              (v.Time as string) ??
              (v['Start Time'] as string) ??
              String(v.start ?? '').slice(11, 16);
            const dur = Number(v.Duration ?? v.duration ?? 0);
            return start && dur ? { start, end: addMinutesHHMM(start, dur) } : null;
          })
          .filter(Boolean) as Array<{ start: string; end: string }>;

          // Active holds for that day (so other users don't see this time)
let holds: Array<{ start: string; end: string }> = [];
try {
  const hr = await fetch(
    `/api/holds?calendarId=${encodeURIComponent(selectedCalId)}&dateISO=${encodeURIComponent(dateISO)}`,
    { cache: 'no-store' }
  );
  if (hr.ok) {
    const data = await hr.json() as Array<{ start: string; durationMin: number }>;
    holds = data.map(h => ({ start: h.start, end: addMinutesHHMM(h.start, h.durationMin) }));
  }
} catch {}

        const slots: Array<{ start: string; end: string }> = [];
        uhSameDay.forEach((row) => {
          const v = (row.values ?? {}) as Values;
          const enabled = v.Enabled !== false && v.Enabled !== 'false';
          const available = v['is Available'] !== false && v['is Available'] !== 'false';
          const startOpen = (v.Start as string) ?? (v['Start Time'] as string);
          const endOpen = (v.End as string) ?? (v['End Time'] as string);
          if (!enabled || !available || !startOpen || !endOpen) return;

          let cursor = startOpen;
          while (addMinutesHHMM(cursor, durationMin) <= endOpen) {
            const s = cursor;
            const e = addMinutesHHMM(cursor, durationMin);
          const clash = booked.some((b) => overlap(s, e, b.start, b.end))
          || holds.some((h) => overlap(s, e, h.start, h.end));


            if (!clash) slots?.push({ start: s, end: e });
            cursor = addMinutesHHMM(cursor, 15);
          }
        });

        slots.sort((a, b) => (timeLT(a.start, b.start) ? -1 : 1));
        if (!cancel) setTimeslots(slots);
      } catch (e) {
        if (!cancel) console.error('[timeslots] failed', e);
      }
    })();

    return () => { cancel = true; };
  }, [businessId, selectedCalId, dateISO, durationMin]);

  useEffect(() => {
  return () => {
    if (holdId) {
      fetch(`/api/holds/${holdId}`, { method: 'DELETE' }).catch(() => {});
    }
  };
}, [holdId]);

  // ---- Derived categories if Category table is empty ----
  const derivedCategories = useMemo(() => {
    if (categories.length > 0) return [];
    const map = new Map<string, string>();
    for (const s of services) {
      const v = s.values || {};
      const catRef = v.Category ?? v.category ?? v['Category Id'] ?? v['categoryId'];
      const id = refId(catRef);
      if (!id) continue;
      const name =
        (typeof v['Category Name'] === 'string' && v['Category Name']) ||
        (typeof v.categoryName === 'string' && v.categoryName) ||
        String(id);
      if (!map.has(id)) map.set(id, name);
    }
    return Array.from(map.entries()).map<Row>(([id, name]) => ({
      _id: id,
      values: { name },
    }));
  }, [categories.length, services]);

useEffect(() => {
  if (!showConfirm) return;
  (async () => {
    const who = await apiMe();
    setMe(who);
  })();
}, [showConfirm]);

  // ---- Services filtered by selected category ----
  const filteredServices = useMemo(() => {
    if (!selectedCatId) return services;
    return services.filter((s) => {
      const v = s.values || {};
      const catCands =
        v.Category ?? v.category ?? v['Category'] ?? v['Category Id'] ??
        v['categoryId'] ?? v.categoryId ?? v['Category Ref'] ?? v['Categories'] ??
        v.Categories ?? v['Category(s)'];
      return hasId(catCands, selectedCatId);
    });
  }, [services, selectedCatId]);

  // Require login every time the user hits "Book Now" in the confirm modal
  function onConfirmClick() {
    setLoginErr('');
    setShowLogin(true);
  }

  // ---- Login submit ----
  async function onLoginSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoginErr('');
    try {
      await apiLogin(loginEmail, loginPass); // sets cookie via /api proxy
      setShowLogin(false);
      // after login, actually attempt to book
      await attemptBooking();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setLoginErr(msg || 'Login failed');
    }
  }

  // ---- Actually perform booking (called after login) ----
  async function attemptBooking() {
    if (!businessId || !selectedCalId || !selectedSvcId || !dateISO || !selectedTime || !durationMin) return;

    try {
      setBooking(true);

      const svc = services.find((s) => s._id === selectedSvcId);
      const svcName =
        (svc?.values?.['Service Name'] as string) ||
        (svc?.values?.serviceName as string) ||
        (svc?.values?.name as string) ||
        'Appointment';

      const res = await fetch('/api/records/Appointment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          values: {
            Business: { _id: businessId },
            Calendar: { _id: selectedCalId },
            Date: dateISO,
            Time: selectedTime,
            Duration: durationMin,
            'Service(s)': [{ _id: selectedSvcId }],
            Name: svcName,
            'Appointment Status': 'booked',
            'is Canceled': false,
          },
        }),
      });

      if (res.status === 401) { setShowLogin(true); return; }
      if (!res.ok) throw new Error(await res.text());

      // Success → close confirm, show success dialog
      setShowConfirm(false);
      setShowSuccess(true);

      // Optionally remove the taken slot from UI
      setTimeslots((prev) => prev.filter((t) => t.start !== selectedTime));

      // release hold now that booking is saved
if (holdId) {
  try { await fetch(`/api/holds/${holdId}`, { method: 'DELETE' }); } catch {}
  setHoldId('');
}

    } catch (e) {
      setLoginErr(e instanceof Error ? e.message : 'Booking failed');
    } finally {
      setBooking(false);
    }
  }

  if (error) return <div className="text-red-600">{error}</div>;

  // --- JSX ---
  return (
    <div className="space-y-8">
      {/* Calendars */}
      <section style={collapseCompletedSteps && step > 1 ? { display: 'none' } : undefined}>
        <h2 className="font-semibold mb-2">Calendars</h2>
        {loading ? (
          <div>Loading…</div>
        ) : calendars.length === 0 ? (
          <div className="text-gray-500">No calendars found.</div>
        ) : (
          <div className="flex flex-col gap-2 max-w-md">
            {calendars.map((c) => {
              const id = c._id;
              const active = id === selectedCalId;
              return (
                <button
                  key={id}
                  onClick={() => setSelectedCalId(id)}
                  className={`px-3 py-2 rounded border ${active ? 'bg-black text-white' : 'bg-white'}`}
                  title={id}
                >
                  {calTitle(c)}
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* Categories */}
      {selectedCalId && (
        <section style={collapseCompletedSteps && step > 1 ? { display: 'none' } : undefined}>
          <h2 className="font-semibold mb-2">Categories</h2>
          {categories.length === 0 && derivedCategories.length === 0 ? (
            <div className="text-gray-500">No categories for this calendar.</div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {(categories.length ? categories : derivedCategories).map((cat) => {
                const id = cat._id;
                const active = id === selectedCatId;
                return (
                  <button
                    key={id}
                    onClick={() => setSelectedCatId(active ? '' : id)}
                    className={`px-3 py-2 rounded border ${active ? 'bg-black text-white' : 'bg-white'}`}
                    title={id}
                  >
                    {catTitle(cat)}
                  </button>
                );
              })}
              {selectedCatId && (
                <button onClick={() => setSelectedCatId('')} className="px-3 py-2 rounded border bg-white">
                  Clear filter
                </button>
              )}
            </div>
          )}
        </section>
      )}

      {/* Services */}
      {selectedCalId && (
        <section style={collapseCompletedSteps && step > 1 ? { display: 'none' } : undefined}>
          <h2 className="font-semibold mb-2">Services</h2>
          {filteredServices.length === 0 ? (
            <div className="text-gray-500">No services for this selection.</div>
          ) : (
            <ul className="divide-y rounded border max-w-xl">
              {filteredServices.map((svc) => {
                const id = svc._id;
                const active = id === selectedSvcId;
                return (
                  <li key={id} className={`p-3 ${active ? 'bg-gray-50' : ''}`}>
                    <button onClick={() => setSelectedSvcId(id)} className="w-full text-left">
                      <div className="font-medium">{svcTitle(svc)}</div>
                      <div className="text-sm text-gray-600">
                        {svcDuration(svc)} {svcPrice(svc) ? ' • ' + svcPrice(svc) : ''}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      {/* Date picker */}
      {selectedSvcId && (
        <section style={collapseCompletedSteps && step > 2 ? { display: 'none' } : undefined}>
          <h2 className="font-semibold mb-2">Choose a date</h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="px-2 py-1 border rounded"
              aria-label="Previous month"
              onClick={() => setDateISO((prev) => shiftMonthISO(prev || toISODateOnly(new Date()), -1))}
            >
              ‹
            </button>

            <input
              type="date"
              className="border rounded px-3 py-2"
              value={dateISO}
              onChange={(e) => {
                setDateISO(e.target.value);
                setSelectedTime('');
              }}
            />

            <button
              type="button"
              className="px-2 py-1 border rounded"
              aria-label="Next month"
              onClick={() => setDateISO((prev) => shiftMonthISO(prev || toISODateOnly(new Date()), +1))}
            >
              ›
            </button>
          </div>
        </section>
      )}

      {/* Timeslots */}
      {selectedSvcId && dateISO && (
        <section style={collapseCompletedSteps && step > 3 ? { display: 'none' } : undefined}>
          <h2 className="font-semibold mb-2">Availability</h2>
          {timeslots.length === 0 ? (
            <div className="text-gray-500">No times available for this date.</div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {timeslots.map((t) => {
                const active = selectedTime === t.start;
                return (
                  <button
                    key={`${t.start}-${t.end}`}
                 onClick={async () => { setSelectedTime(t.start); await createHoldForSelection(t.start); }}

                    className={`px-3 py-2 rounded border ${active ? 'bg-black text-white' : 'bg-white'}`}
                    title={`${t.start}–${t.end}`}
                  >
                    {to12h(t.start)}
                  </button>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* Summary + Confirm */}
      {selectedSvcId && dateISO && selectedTime && (
        <section className="max-w-xl p-4 border rounded">
          <h2 className="font-semibold mb-3">Summary</h2>
          <ul className="text-sm space-y-1">
            <li><strong>Date:</strong> {dateISO}</li>
            <li><strong>Time:</strong> {to12h(selectedTime)} ({durationMin} min)</li>
            <li><strong>Service:</strong> {svcTitle(services.find((s) => s._id === selectedSvcId) as Row)}</li>
          </ul>
          <button
            onClick={() => setShowConfirm(true)}
            disabled={booking}
            className="mt-4 px-4 py-2 rounded bg-black text-white disabled:opacity-60"
          >
            {booking ? 'Booking…' : 'Book appointment'}
          </button>
        </section>
      )}

      {/* Confirm modal */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white p-5 rounded w-[420px] space-y-3 shadow-lg relative">
            <button className="absolute right-3 top-2 text-xl" onClick={() => setShowConfirm(false)}>×</button>
            <h3 className="text-lg font-semibold">Confirm</h3>
            <div className="text-sm space-y-1">
              <div><strong>Date:</strong> {dateISO}</div>
              <div><strong>Time:</strong> {to12h(selectedTime)} ({durationMin} min)</div>
              <div><strong>Service:</strong> {svcTitle(services.find((s) => s._id === selectedSvcId) as Row)}</div>
            </div>


            <div className="flex justify-end gap-2 pt-2">

              <div className="text-xs text-gray-600 border-t pt-3">
  {me?.email ? (
    <div>Signed in as <strong>{me.email}</strong></div>
  ) : (
    <div>Not signed in</div>
  )}
  <button
    type="button"
    className="mt-2 underline"
    onClick={() => { setShowLogin(true); setLoginErr(''); }}
  >
    {me?.email ? 'Switch account' : 'Sign in'}
  </button>
</div>

              <button className="px-3 py-2 border rounded" onClick={() => setShowConfirm(false)}>Back</button>
              <button className="px-3 py-2 rounded bg-black text-white" onClick={onConfirmClick} disabled={booking}>
                {booking ? 'Booking…' : 'Book Now'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Login modal */}
      {showLogin && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <form onSubmit={onLoginSubmit} className="bg-white p-4 rounded w-[360px] space-y-3 shadow-lg relative">
            <button className="absolute right-3 top-2 text-xl" type="button" onClick={() => setShowLogin(false)}>×</button>
            <h3 className="text-lg font-semibold">Sign in to book</h3>
            {loginErr && <div className="text-red-600 text-sm">{loginErr}</div>}
            <label className="block">
              <div className="text-sm mb-1">Email</div>
              <input
                type="email"
                className="w-full border rounded px-3 py-2"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                required
              />
            </label>
            <label className="block">
              <div className="text-sm mb-1">Password</div>
              <input
                type="password"
                className="w-full border rounded px-3 py-2"
                value={loginPass}
                onChange={(e) => setLoginPass(e.target.value)}
                required
              />
            </label>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowLogin(false)} className="px-3 py-2 border rounded">
                Cancel
              </button>
              <button type="submit" className="px-3 py-2 rounded bg-black text-white">
                Sign in & continue
              </button>
            </div>
          </form>
        </div>
      )}

     {/* Success modal — wire both buttons to onSuccessClose */}
      {showSuccess && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white p-5 rounded w-[420px] space-y-3 shadow-lg relative">
            <button
              className="absolute right-3 top-2 text-xl"
              onClick={onSuccessClose}  // ⬅️ use it here
            >
              ×
            </button>

            <h3 className="text-lg font-semibold">Appointment booked 🎉</h3>
            {/* ...details... */}

            <div className="flex justify-end gap-2 pt-2">
             
<button className="px-3 py-2 border rounded" onClick={onSuccessClose}>
  Done
</button>

<Link href="/client-dashboard.html" className="px-3 py-2 rounded bg-black text-white text-center">
  Go to Client Dashboard
</Link>


            </div>
          </div>
        </div>
      )}
    </div>
  );
}