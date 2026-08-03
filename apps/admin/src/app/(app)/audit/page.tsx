import { ComingSoon, PageHeader } from "@/components/page-shell";

export default function AuditPage() {
  return (
    <>
      <PageHeader title="Audit Log" subtitle="Every mutating admin action: who, when, what, why." />
      <ComingSoon module="Audit Log" />
    </>
  );
}
