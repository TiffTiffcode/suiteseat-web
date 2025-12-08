// C:\Users\tiffa\OneDrive\Desktop\suiteseat-web\src\app\[slug]\layout.tsx
// src/app/[slug]/layout.tsx
import Script from "next/script";

type LayoutProps = {
  children: React.ReactNode;
  // Next 15: params is a Promise in Server Components
  params: Promise<{ slug: string }>;
};

export default async function BookingLayout({ children, params }: LayoutProps) {
  const { slug } = await params;

  return (
    <>
      {/* Expose the slug to your client JS (optional) */}
      <Script id="booking-config" strategy="afterInteractive">
        {`window.BOOKING_PAGE = { slug: ${JSON.stringify(slug)} };`}
      </Script>

      {/* Load route-specific JS AFTER hydration (optional) */}
      {/* <Script src="/qassets/js/store.js" strategy="afterInteractive" /> */}

      {children}
    </>
  );
}
