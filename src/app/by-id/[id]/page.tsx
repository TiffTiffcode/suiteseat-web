// src/app/by-id/[id]/page.tsx
import { redirect } from "next/navigation";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function ById({ params }: Props) {
  const { id } = await params; // 👈 await the promised params

  const base = process.env.NEXT_PUBLIC_API_BASE_URL as string;
  const res = await fetch(
    `${base}/api/public/booking-slug/by-business/${id}`,
    { cache: "no-store" }
  );

  if (!res.ok) {
    return (
      <main style={{ padding: 24 }}>
        <h1>Lookup failed</h1>
        <p>Status: {res.status}</p>
      </main>
    );
  }

  const data = (await res.json()) as { slug?: string };
  const slug = (data?.slug || "").trim();

  if (!slug) {
    return (
      <main style={{ padding: 24 }}>
        <h1>No booking page found</h1>
        <p>Check the Business ID and publication status.</p>
      </main>
    );
  }

  redirect(`/${slug}`);
}
