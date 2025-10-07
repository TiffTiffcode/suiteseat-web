'use client';

import Link from 'next/link';

export default function SignUpPage() {
  return (
    <main className="p-6 max-w-xl mx-auto">
      <h1 className="text-2xl font-semibold mb-4">Create your account</h1>

      {/* TODO: replace with your real form */}
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); alert('submit'); }}>
        <input className="border p-2 w-full" placeholder="Email" />
        <input className="border p-2 w-full" placeholder="Password" type="password" />
        <button className="rounded bg-black text-white px-4 py-2">Sign up</button>
      </form>

      <p className="mt-4 text-sm">
        Already have an account? <Link className="underline" href="/login">Log in</Link>
      </p>
    </main>
  );
}
