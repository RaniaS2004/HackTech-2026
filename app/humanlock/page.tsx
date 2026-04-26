import type { Metadata } from "next";
import { HumanLockPage } from "@/components/aurora/HumanLockPage";

export const metadata: Metadata = {
  title: "HumanLock — AURORA",
  description: "Adversarial visual challenges that defeat modern AI vision models while staying easy for humans.",
};

export default function Page() {
  return <HumanLockPage />;
}
