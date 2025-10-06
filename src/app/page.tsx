// Redirect / -> /index.html so your static landing page shows
import { redirect } from "next/navigation";

export default function Home() {
  redirect("/index.html");
}
