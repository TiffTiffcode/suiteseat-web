// src/app/_utils/origin.ts
export function upstreamOrigin(): string {
  // prefer public var in case code is shared on client
  const v =
    process.env.NEXT_PUBLIC_BOOKING_ORIGIN ||
    process.env.API_BASE_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    ""; // same-origin (proxy) fallback
  return v.replace(/\/+$/, ""); // trim trailing slash
}
