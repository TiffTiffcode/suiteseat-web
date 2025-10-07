// src/app/page.tsx
import Link from "next/link";
// (Optional) If you want to use next/image instead of <img>:
// import Image from "next/image";

export default function Home() {
  return (
    <>
      {/* Site details (hero) */}
      <section className="site-details">
        <div className="site-details-left">
          <h1>256156SCHEDULE APPOINTMENTS AND SELL PRODUCTS</h1>
          <p className="subhead">all in the same place</p>

          <h2>Automations</h2>
          <h3>
            Whether you're on the go, in a suite, or salon, Suite Seat can help
            organize and automate your business
          </h3>

          <Link href="/signup" className="black-sign-up">Sign up Here</Link>

          <h2>Bookings</h2>
          <h3>Seamless booking system to accept appointments</h3>

          <h2>Ecommerce</h2>
          <h3>Sell products and manage inventory</h3>
        </div>

        <div className="site-details-right">
          {/* Keep your original <img> if you want */}
          <img src="/images/salonchair.jpg" alt="Salon Chair" className="landing-image" />
          {/* or with next/image:
          <Image src="/images/salonchair.jpg" alt="Salon Chair" width={800} height={450} className="landing-image" priority />
          */}
        </div>
      </section>

      {/* Pricing top */}
      <section className="pricing-top">
        <div className="pricing-left">
          <h2>Pricing</h2>
          <h3>Undeniable plans for all budgets</h3>
          <h4>Find your perfect fit plan</h4>
          <Link href="/signup" className="black start free button">Start free</Link>
        </div>
        <div className="pricing-right">
          <div className="blur-bar"></div>
          <img src="/images/lashchair.jpg" alt="Lash Chair" className="pricing-image" />
        </div>
      </section>

      {/* Pricing cards */}
      <section className="pricing-details">
        <div className="pricing-card freemium clickable">
          <h3>Freemium</h3>
          <p className="price">$0 <span>/ Month</span></p>
          <ul>
            <li className="included">✅ Accept Clients</li>
            <li className="included">✅ Client Management System</li>
            <li className="included">✅ Up to 3 Custom Calendars</li>
            <li className="included">✅ Automatic Client Email System</li>
            <li className="included">✅ Up to 2 Custom Ecommerce Stores</li>
            <li className="excluded">Client Messaging Portal</li>
            <li className="excluded">Link in bio</li>
          </ul>
        </div>

        <div className="pricing-card dynamic locked">
          <div className="overlay"></div>
          <div className="coming-soon-label">Coming Soon</div>
          <h3>Dynamic</h3>
          <p className="price">$17 <span>/ Month</span></p>
          <ul>
            <li className="included">✅ Accept Clients</li>
            <li className="included">✅ Client Management System</li>
            <li className="included">✅ Up to 6 Custom Calendars</li>
            <li className="included">✅ Automatic Client Email System</li>
            <li className="included">✅ Up to 2 Custom Ecommerce Stores</li>
            <li className="included">✅ Client Messaging Portal</li>
            <li className="excluded">Link in bio</li>
          </ul>
        </div>

        <div className="pricing-card elite locked">
          <div className="overlay"></div>
          <div className="coming-soon-label">Coming Soon</div>
          <h3>Elite</h3>
          <p className="price">$28 <span>/ Month</span></p>
          <ul>
            <li className="included">✅ Accept Clients</li>
            <li className="included">✅ Client Management System</li>
            <li className="included">✅ Unlimited Custom Calendars</li>
            <li className="included">✅ Automatic Client Email System</li>
            <li className="included">✅ Up to 6 Custom Ecommerce Stores</li>
            <li className="included">✅ Client Messaging Portal</li>
            <li className="included">✅ Link in bio</li>
          </ul>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="bottom-page-button">
        <Link href="/signup" className="black-sign-up">
          Sign Up
        </Link>
      </section>
    </>
  );
}
