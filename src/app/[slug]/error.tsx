//C:\Users\tiffa\OneDrive\Desktop\suiteseat-web\src\app\[slug]\error.tsx
'use client';
export default function Error({ error }: { error: Error }) {
  console.error(error);
  return <div className="p-6 text-red-600">Something went wrong.</div>;
}
