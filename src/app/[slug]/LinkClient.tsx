// src/app/[slug]/LinkClient.tsx
"use client";

import BasicLinkTemplate from "./LinkTemplates/basic/Template";
import { LinkPageProvider } from "./LinkFlows/linkPageFlow";

export default function LinkClient({ slug }: { slug: string }) {
  return (
    <LinkPageProvider slug={slug}>
      <BasicLinkTemplate />
    </LinkPageProvider>
  );
}
