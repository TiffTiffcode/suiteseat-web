// src/app/lib/format.ts
export type MaybeNum = number | string | null | undefined;

export const fmtDate = (ymd?: string | null) =>
  ymd
    ? new Date(ymd + "T00:00:00").toLocaleDateString("en-US", {
        month: "short",
        day: "2-digit",
        year: "numeric",
      })
    : "—";

export const fmtTime12h = (hhmm?: string | null) => {
  if (!hhmm) return "—";
  const [hRaw, mRaw] = hhmm.split(":");
  const h = Number(hRaw);
  const m = Number(mRaw);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return "—";
  const suffix = h >= 12 ? "PM" : "AM";
  const h12 = (h % 12) || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${suffix}`;
};

export const fmtUSD = (n?: MaybeNum) =>
  n === undefined || n === null || n === ""
    ? "—"
    : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" })
        .format(Number(n));

// leave getDurationMin as-is
export const getDurationMin = (svc: any): number | undefined => {
  const cand =
    svc?.durationMin ??
    svc?.duration ??
    svc?.values?.DurationMin ??
    svc?.values?.Duration ??
    svc?.values?.["Duration (min)"] ??
    svc?.values?.durationMin ??
    svc?.values?.duration;

  const n = typeof cand === "string" ? parseInt(cand, 10) : Number(cand);
  return Number.isFinite(n) && n > 0 ? n : undefined;
};