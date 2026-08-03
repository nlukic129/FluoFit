import { ComingSoon, PageHeader } from "@/components/page-shell";

export default function ProvisioningPage() {
  return (
    <>
      <PageHeader title="Provisioning" subtitle="Generate, track, and void Box codes in batches." />
      <ComingSoon module="Provisioning" note="Built next in M1 (backend RPCs already exist)." />
    </>
  );
}
