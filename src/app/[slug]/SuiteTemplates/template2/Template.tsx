//C:\Users\tiffa\OneDrive\Desktop\suiteseat-web\src\app\[slug]\SuiteTemplates\template2\Template.tsx

"use client";

export default function Template2({
  business,
  suites,
  loading,
  error,
  pageJson,
}: {
  business: any;
  suites: any[];
  loading: boolean;
  error: string | null;
  pageJson: any;
}) {
  return (
    <div>
      <h1>Template 2</h1>
      <p>Saved elements: {pageJson?.elements?.length || 0}</p>
    </div>
  );
}