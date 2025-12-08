// src/app/[slug]/BookingClient.tsx
"use client";

import { BasicFlowProvider } from "./BookingFlows/basicFlow";
import BasicBookingTemplate from "./BookingTemplates/basic/Template";

export default function BookingClient({ business }: { business: any }) {
  console.log("[client] business.heroUrl:", business?.heroUrl);

  return (
    <BasicFlowProvider businessId={business._id}>
      {!!business?.heroUrl && (
        <section className="bk-hero">
          <img
            className="bk-hero-img"
            src={business.heroUrl}
            alt={business.name}
            onLoad={() => console.log("[hero] img loaded:", business.heroUrl)}
            onError={(e) => console.log("[hero] img ERROR:", (e.target as HTMLImageElement).src)}
          />
          <div className="bk-hero-overlay">
         
            {business.description && <p className="bk-desc">{business.description}</p>}
          </div>
        </section>
      )}

      {/* Rest of booking UI */}
      <BasicBookingTemplate business={business} />
    </BasicFlowProvider>
  );
}
