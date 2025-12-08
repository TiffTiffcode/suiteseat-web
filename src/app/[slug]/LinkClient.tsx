// src/app/[slug]/LinkClient.tsx
"use client";

import { LinkPageProvider } from "./LinkFlows/linkPageFlow";
import BasicLinkTemplate from "./LinkTemplates/basic/Template";

export default function LinkClient({ slug }: { slug: string }) {
  return (
    <LinkPageProvider slug={slug}>
      <BasicLinkTemplate />
    </LinkPageProvider>
  );
}
