//C:\Users\tiffa\OneDrive\Desktop\suiteseat-web\src\app\[slug]\ClientBookingHost.tsx
// src/app/[slug]/ClientBookingHost.tsx
// src/app/[slug]/ClientBookingHost.tsx
"use client";

import BasicBookingTemplate from "./BookingTemplates/basic/Template";
import { BasicFlowProvider } from "./BookingFlows/basicFlow";

export default function ClientBookingHost({ business }: { business: any }) {
  return (
    <BasicFlowProvider businessId={String(business?._id || "")}>
      <BasicBookingTemplate business={business} />
    </BasicFlowProvider>
  );
}
