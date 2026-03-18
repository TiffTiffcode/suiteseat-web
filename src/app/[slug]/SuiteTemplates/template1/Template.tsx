//C:\Users\tiffa\OneDrive\Desktop\suiteseat-web\src\app\[slug]\SuiteTemplates\template1\Template.tsx


"use client";

export default function Template1({
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
      <h1>Template 1</h1>
      <p>This template is not designed yet.</p>
      <p>
        Business: {business?.name || business?.values?.["Location Name"] || "—"}
      </p>
      <p>Suites loaded: {suites?.length || 0}</p>
      {loading && <p>Loading...</p>}
      {error && <p>{error}</p>}
    </div>
  );
}