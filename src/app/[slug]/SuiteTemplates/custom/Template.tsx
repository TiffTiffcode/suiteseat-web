"use client";

export default function CustomTemplate({
  business,
  suites,
  loading,
  error,
}: {
  business: any;
  suites: any[];
  loading: boolean;
  error: string | null;
}) {
  return (
    <div style={{ padding: 40 }}>
      <h1>Custom Page</h1>
      <p>This is where the custom-built page will render.</p>
      <p>
        Business: {business?.name || business?.values?.["Location Name"] || "—"}
      </p>
      <p>Suites loaded: {suites?.length || 0}</p>
      {loading && <p>Loading...</p>}
      {error && <p>{error}</p>}
    </div>
  );
}