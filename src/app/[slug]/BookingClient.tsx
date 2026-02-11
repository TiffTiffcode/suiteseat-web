// src/app/[slug]/BookingClient.tsx
//C:\Users\tiffa\OneDrive\Desktop\suiteseat-web\src\app\[slug]\BookingClient.tsx
"use client";

import { BasicFlowProvider } from "./BookingFlows/basicFlow";
import BasicBookingTemplate from "./BookingTemplates/basic/Template";

export default function BookingClient({ business }: { business: any }) {
  console.log("[client] business.heroUrl:", business?.heroUrl);

  return (
    <BasicFlowProvider businessId={business._id}>
      {/* ✅ No extra hero here – Template will render the hero */}
      <BasicBookingTemplate business={business} />
    </BasicFlowProvider>
  );
}
