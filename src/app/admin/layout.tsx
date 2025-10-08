import Script from "next/script";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <Script src="/qassets/js/admin.js" strategy="afterInteractive" />
    </>
  );
}
