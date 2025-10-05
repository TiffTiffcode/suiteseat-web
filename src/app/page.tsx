// src/app/page.tsx
import { redirect } from "next/navigation";

export default function Home() {
  // Serve the static HTML file in /public at the root route
  redirect("/index.html");
}
