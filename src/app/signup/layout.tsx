// src/app/signup/layout.tsx
import Script from "next/script";

export default function SignupLayout({
  children,
}: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <Script src="/qassets/js/signup.js" strategy="afterInteractive" />
    </>
  );
}
