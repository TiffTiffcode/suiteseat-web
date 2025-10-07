// src/app/demo/page.tsx
import Link from "next/link";
import styles from "./demo.module.css";

export default function DemoPage() {
  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <h1 className={styles.title}>This is a brand-new demo page</h1>
        <p className={styles.subtitle}>
          Styled with a route-scoped CSS Module. If you can see the gradient
          and card styles below, CSS is wired up correctly.
        </p>
        <Link href="/signup" className={styles.cta}>
          Go to Sign Up
        </Link>
      </section>

      <div className={styles.grid}>
        <article className={styles.card}>
          <h3>Card One</h3>
          <p>Some quick copy to show the styling.</p>
        </article>
        <article className={styles.card}>
          <h3>Card Two</h3>
          <p>Cards use the same module styles.</p>
        </article>
        <article className={styles.card}>
          <h3>Card Three</h3>
          <p>Shadows, rounded corners, easy.</p>
        </article>
      </div>
    </div>
  );
}
