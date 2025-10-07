// src/app/layout.tsx
import type { Metadata } from "next";
import Script from "next/script";
import Header from "@/components/Header";

export const metadata: Metadata = { title: "Suite Seat" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        {/* Global (site-wide) CSS. Keep for now; we can split later per page. */}
        <link rel="stylesheet" href="/qassets/css/index.css" />
      </head>
      <body>
        <Header />
        <main>{children}</main>
        {/* Global script (if you really need it) */}
        <Script src="/qassets/js/index.js" strategy="afterInteractive" />
      </body>
    </html>
  );
}
