// src/app/signup/layout.tsx
import "./signup.css";
import Script from "next/script";

export default function SignupLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <Script src="/qassets/js/signup.js" strategy="afterInteractive" />
    </>
  );
}
