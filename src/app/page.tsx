// src/app/page.tsx
"use client";
import { useEffect } from "react";
export default function Page() {
  useEffect(() => { window.location.replace("/index.html"); }, []);
  return null;
}
