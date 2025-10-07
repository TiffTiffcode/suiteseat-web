// src/components/Header.tsx
import Link from "next/link";

export default function Header() {
  return (
    <header className="header">
      <section className="header-group-container">
        <div className="group left-group">
          {/* You can keep your SVG/icon here if you like */}
          Top pros use automations to run their business. Start now for free!
        </div>

        <div className="header-right-group">
          <Link href="/signup" className="orange sign-up">Sign Up Here</Link>
          <Link href="/login" className="orange log-in button">Log In</Link>
        </div>
      </section>

      {/* The “Suite Seat” title row you had */}
      <section className="subheader">
        <div className="left-group">
          <h2>Suite Seat</h2>
        </div>
        <div className="right-group">
          <Link href="/signup" className="orange sign-up">Sign Up Here</Link>
          <Link href="/login" className="orange log-in button">Log In</Link>
        </div>
      </section>
    </header>
  );
}
