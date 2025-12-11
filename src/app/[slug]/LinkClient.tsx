// src/app/[slug]/LinkClient.tsx
// src/app/[slug]/LinkClient.tsx
"use client";

import { LinkPageProvider } from "./LinkFlows/linkPageFlow";
import BasicLinkTemplate from "./LinkTemplates/basic/Template";

type LinkClientProps = {
  slug: string;
};

export default function LinkClient({ slug }: LinkClientProps) {
  return (
    <LinkPageProvider slug={slug}>
      <BasicLinkTemplate />
    </LinkPageProvider>
  );
}
