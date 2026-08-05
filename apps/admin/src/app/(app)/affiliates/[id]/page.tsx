"use client";

import { useParams } from "next/navigation";

import { ReferrerDetail } from "@/components/referrer-detail";

export default function AffiliateDetailPage() {
  const { id } = useParams<{ id: string }>();
  return <ReferrerDetail id={id} />;
}
