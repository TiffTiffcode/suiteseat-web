// src/app/signup/page.tsx
import Link from "next/link";

export default function SignupPage() {
  return (
    <>
      {/* Header comes from the root layout; this page starts below it */}

      {/* Client/Pro Toggle */}
      <section className="toggle-bar">
        <div className="toggle-option active" id="clientToggle">Client</div>
        <div className="toggle-option" id="proToggle">Pro</div>
      </section>

      {/* Pro Section */}
      <section id="proSection">
        <h2 className="pro-header">Start Automating your Business</h2>
        <div className="container">

          {/* Pro Sign Up */}
          <div className="auth-card" id="proSignUpCard">
            <h2>Pro Sign Up</h2>
            <form id="proSignUpForm">
              <div className="input-group">
                <input type="text" id="pro-first-name" name="firstName" required />
                <label htmlFor="pro-first-name">First Name</label>
              </div>

              <div className="input-group">
                <input type="text" id="pro-last-name" name="lastName" required />
                <label htmlFor="pro-last-name">Last Name</label>
              </div>

              <div className="input-group">
                <input type="email" id="pro-signup-email" name="email" required />
                <label htmlFor="pro-signup-email">Email</label>
              </div>

              <div className="input-group" style={{ position: "relative" }}>
                <input type="password" id="pro-signup-password" name="password" required />
                <label htmlFor="pro-signup-password">Password</label>
                <span id="toggleProSignupPassword" className="eye-icon">👁️</span>
              </div>

              <small className="password-note">Must be 8–12 characters.</small>

              <div className="input-group">
                <input type="password" id="signup-reenter-pro-password" name="signup-reenter-pro-password" required />
                <label htmlFor="signup-reenter-pro-password">Re-enter Password</label>
              </div>

              <div className="input-group">
                <input type="text" id="signup-phone-number" name="phone" required />
                <label htmlFor="signup-phone-number">Phone Number</label>
              </div>

              <button type="submit" className="auth-button">Sign Up</button>
              <p className="switch-link">
                Already have an account?{" "}
                <a href="#" id="showProLogin">Log In</a>
              </p>
            </form>
          </div>

          {/* Pro Log in */}
          <div className="auth-card" id="proLoginCard" style={{ display: "none" }}>
            <h2>Pro Log In</h2>
            <form id="proLoginForm">
              <div className="input-group">
                <input type="email" id="pro-log-in-email" name="email" required />
                <label htmlFor="pro-log-in-email">Email</label>
              </div>

              <div className="input-group" style={{ position: "relative" }}>
                <input type="password" id="pro-log-in-password" name="password" required />
                <label htmlFor="pro-log-in-password">Password</label>
                <span id="toggleProPassword" className="eye-icon">👁️</span>
              </div>

              <button type="submit" className="auth-button">Log In</button>
              <p className="switch-link">
                Don’t have an account?{" "}
                <a href="#" id="showProSignup">Sign Up</a>
              </p>
              <p className="forgot-password">
                {/* change this to a Next route later */}
                <Link href="/forgot-password" id="forgot-client-password">Forgot your password?</Link>
              </p>
            </form>
          </div>
        </div>
      </section>

      {/* Client Section */}
      <section id="clientSection" style={{ display: "none" }}>
        <h2 className="client-header">Get Access to your Pro</h2>
        <div className="container">
          <div className="auth-card" id="clientSignUpCard">
            <h2>Client Sign Up</h2>
            <form id="clientSignUpForm">
              <div className="input-group">
                <input type="text" id="client-first-name" name="firstName" required />
                <label htmlFor="client-first-name">First Name</label>
              </div>

              <div className="input-group">
                <input type="text" id="client-last-name" name="lastName" required />
                <label htmlFor="client-last-name">Last Name</label>
              </div>

              <div className="input-group">
                <input type="email" id="client-signup-email" name="email" required />
                <label htmlFor="client-signup-email">Email</label>
              </div>

              <div className="input-group" style={{ position: "relative" }}>
                <input type="password" id="client-signup-password" name="password" required />
                <label htmlFor="client-signup-password">Password</label>
                <span id="toggleClientSignupPassword" className="eye-icon">👁️</span>
              </div>

              <small className="password-note">Must be 8–12 characters.</small>

              <div className="input-group">
                <input type="password" id="client-signup-reenter-password" name="signup-reenter-client-password" required />
                <label htmlFor="client-signup-reenter-password">Re-enter Password</label>
              </div>

              <div className="input-group">
                <input type="text" id="client-signup-phone-number" name="phone" required />
                <label htmlFor="client-signup-phone-number">Phone Number</label>
              </div>

              <button type="submit" className="auth-button">Sign Up</button>
              <p className="switch-link">
                Already have an account?{" "}
                <a href="#" id="showClientLogin">Log In</a>
              </p>
            </form>
          </div>

          {/* Client Log In */}
          <div className="auth-card" id="clientLoginCard" style={{ display: "none" }}>
            <h2>Client Log In</h2>
            <form id="clientLoginForm">
              <div className="input-group">
                <input type="email" id="client-log-in-email" name="email" required />
                <label htmlFor="client-log-in-email">Email</label>
              </div>

              <div className="input-group" style={{ position: "relative" }}>
                <input type="password" id="client-log-in-password" name="password" required />
                <label htmlFor="client-log-in-password">Password</label>
                <span id="toggleClientPassword" className="eye-icon">👁️</span>
              </div>

              <button type="submit" className="auth-button">Log In</button>
              <p className="switch-link">
                Don’t have an account?{" "}
                <a href="#" id="showClientSignup">Sign Up</a>
              </p>
              <p className="forgot-password">
                <Link href="/forgot-password" id="forgot-client-password">Forgot your password?</Link>
              </p>
            </form>
          </div>
        </div>
      </section>

      {/* Overlay */}
      <div
        id="popup-overlay"
        style={{
          display: "none",
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.5)",
          zIndex: 999,
        }}
      />
    </>
  );
}
