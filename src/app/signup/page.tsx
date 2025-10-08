'use client';

import { useState } from 'react';
import Link from 'next/link';
import styles from './signup.module.css';

type Tab = 'client' | 'pro';
type Card = 'signup' | 'login';

export default function SignupPage() {
  const [tab, setTab] = useState<Tab>('client');
  const [clientCard, setClientCard] = useState<Card>('signup');
  const [proCard, setProCard] = useState<Card>('signup');

  // password visibility toggles
  const [showClientSignupPw, setShowClientSignupPw] = useState(false);
  const [showClientLoginPw, setShowClientLoginPw] = useState(false);
  const [showProSignupPw, setShowProSignupPw] = useState(false);
  const [showProLoginPw, setShowProLoginPw] = useState(false);

  // stub handlers (wire to your API later)
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    console.log('submit', Object.fromEntries(fd.entries()));
    // TODO: POST to your API
  }

  return (
    <div className={styles.page}>
      {/* Toggle bar */}
      <section className={styles.toggleBar}>
        <button
          className={`${styles.toggleOption} ${tab === 'client' ? styles.active : ''}`}
          onClick={() => setTab('client')}
          type="button"
        >
          Client
        </button>
        <button
          className={`${styles.toggleOption} ${tab === 'pro' ? styles.active : ''}`}
          onClick={() => setTab('pro')}
          type="button"
        >
          Pro
        </button>
      </section>

      {/* PRO */}
      {tab === 'pro' && (
        <section>
          <h2 className={styles.sectionTitle}>Start Automating your Business</h2>
          <div className={styles.container}>
            {proCard === 'signup' ? (
              <div className={styles.card}>
                <h3>Pro Sign Up</h3>
                <form onSubmit={handleSubmit}>
                  <div className={styles.inputGroup}>
                    <label htmlFor="pro-first-name">First Name</label>
                    <input id="pro-first-name" name="firstName" required />
                  </div>
                  <div className={styles.inputGroup}>
                    <label htmlFor="pro-last-name">Last Name</label>
                    <input id="pro-last-name" name="lastName" required />
                  </div>
                  <div className={styles.inputGroup}>
                    <label htmlFor="pro-email">Email</label>
                    <input id="pro-email" name="email" type="email" required />
                  </div>
                  <div className={styles.inputGroup}>
                    <label htmlFor="pro-password">Password</label>
                    <div className={styles.passwordWrap}>
                      <input
                        id="pro-password"
                        name="password"
                        type={showProSignupPw ? 'text' : 'password'}
                        required
                      />
                      <button
                        type="button"
                        className={styles.eye}
                        aria-label="Toggle password visibility"
                        onClick={() => setShowProSignupPw(v => !v)}
                      >
                        👁️
                      </button>
                    </div>
                    <small className={styles.help}>Must be 8–12 characters.</small>
                  </div>
                  <div className={styles.inputGroup}>
                    <label htmlFor="pro-password-2">Re-enter Password</label>
                    <input id="pro-password-2" name="password2" type="password" required />
                  </div>
                  <div className={styles.inputGroup}>
                    <label htmlFor="pro-phone">Phone Number</label>
                    <input id="pro-phone" name="phone" required />
                  </div>

                  <button className={styles.primaryBtn} type="submit">Sign Up</button>
                  <p className={styles.switchLine}>
                    Already have an account?{' '}
                    <button type="button" className={styles.link} onClick={() => setProCard('login')}>
                      Log In
                    </button>
                  </p>
                </form>
              </div>
            ) : (
              <div className={styles.card}>
                <h3>Pro Log In</h3>
                <form onSubmit={handleSubmit}>
                  <div className={styles.inputGroup}>
                    <label htmlFor="pro-login-email">Email</label>
                    <input id="pro-login-email" name="email" type="email" required />
                  </div>
                  <div className={styles.inputGroup}>
                    <label htmlFor="pro-login-password">Password</label>
                    <div className={styles.passwordWrap}>
                      <input
                        id="pro-login-password"
                        name="password"
                        type={showProLoginPw ? 'text' : 'password'}
                        required
                      />
                      <button
                        type="button"
                        className={styles.eye}
                        aria-label="Toggle password visibility"
                        onClick={() => setShowProLoginPw(v => !v)}
                      >
                        👁️
                      </button>
                    </div>
                  </div>

                  <button className={styles.primaryBtn} type="submit">Log In</button>
                  <p className={styles.switchLine}>
                    Don’t have an account?{' '}
                    <button type="button" className={styles.link} onClick={() => setProCard('signup')}>
                      Sign Up
                    </button>
                  </p>
                  <p className={styles.forgot}>
                    <Link href="/forgot-password">Forgot your password?</Link>
                  </p>
                </form>
              </div>
            )}
          </div>
        </section>
      )}

      {/* CLIENT */}
      {tab === 'client' && (
        <section>
          <h2 className={styles.sectionTitle}>Get Access to your Pro</h2>
          <div className={styles.container}>
            {clientCard === 'signup' ? (
              <div className={styles.card}>
                <h3>Client Sign Up</h3>
                <form onSubmit={handleSubmit}>
                  <div className={styles.inputGroup}>
                    <label htmlFor="client-first-name">First Name</label>
                    <input id="client-first-name" name="firstName" required />
                  </div>
                  <div className={styles.inputGroup}>
                    <label htmlFor="client-last-name">Last Name</label>
                    <input id="client-last-name" name="lastName" required />
                  </div>
                  <div className={styles.inputGroup}>
                    <label htmlFor="client-email">Email</label>
                    <input id="client-email" name="email" type="email" required />
                  </div>
                  <div className={styles.inputGroup}>
                    <label htmlFor="client-password">Password</label>
                    <div className={styles.passwordWrap}>
                      <input
                        id="client-password"
                        name="password"
                        type={showClientSignupPw ? 'text' : 'password'}
                        required
                      />
                      <button
                        type="button"
                        className={styles.eye}
                        aria-label="Toggle password visibility"
                        onClick={() => setShowClientSignupPw(v => !v)}
                      >
                        👁️
                      </button>
                    </div>
                    <small className={styles.help}>Must be 8–12 characters.</small>
                  </div>
                  <div className={styles.inputGroup}>
                    <label htmlFor="client-password-2">Re-enter Password</label>
                    <input id="client-password-2" name="password2" type="password" required />
                  </div>
                  <div className={styles.inputGroup}>
                    <label htmlFor="client-phone">Phone Number</label>
                    <input id="client-phone" name="phone" required />
                  </div>

                  <button className={styles.primaryBtn} type="submit">Sign Up</button>
                  <p className={styles.switchLine}>
                    Already have an account?{' '}
                    <button type="button" className={styles.link} onClick={() => setClientCard('login')}>
                      Log In
                    </button>
                  </p>
                </form>
              </div>
            ) : (
              <div className={styles.card}>
                <h3>Client Log In</h3>
                <form onSubmit={handleSubmit}>
                  <div className={styles.inputGroup}>
                    <label htmlFor="client-login-email">Email</label>
                    <input id="client-login-email" name="email" type="email" required />
                  </div>
                  <div className={styles.inputGroup}>
                    <label htmlFor="client-login-password">Password</label>
                    <div className={styles.passwordWrap}>
                      <input
                        id="client-login-password"
                        name="password"
                        type={showClientLoginPw ? 'text' : 'password'}
                        required
                      />
                      <button
                        type="button"
                        className={styles.eye}
                        aria-label="Toggle password visibility"
                        onClick={() => setShowClientLoginPw(v => !v)}
                      >
                        👁️
                      </button>
                    </div>
                  </div>

                  <button className={styles.primaryBtn} type="submit">Log In</button>
                  <p className={styles.switchLine}>
                    Don’t have an account?{' '}
                    <button type="button" className={styles.link} onClick={() => setClientCard('signup')}>
                      Sign Up
                    </button>
                  </p>
                  <p className={styles.forgot}>
                    <Link href="/forgot-password">Forgot your password?</Link>
                  </p>
                </form>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
