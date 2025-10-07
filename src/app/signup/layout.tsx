// src/app/signup/layout.tsx
import type { Metadata } from "next";
import Script from "next/script";
import "./signup.css"; // this CSS is loaded only for /signup

export const metadata: Metadata = {
  title: "Sign Up — Suite Seat",
};

export default function SignupLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      {/* Load the old vanilla script just on this route */}
      <Script src="/qassets/js/signup.js" strategy="afterInteractive" />
    </>
  );
}
