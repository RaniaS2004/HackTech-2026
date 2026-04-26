import type { Metadata } from "next";
import { AgentPassPage } from "@/components/aurora/AgentPassPage";

export const metadata: Metadata = {
  title: "AgentPass — AURORA",
  description: "A reverse CAPTCHA that lets legitimate AI agents prove they are authorized and receive a signed identity token.",
};

export default function Page() {
  return <AgentPassPage />;
}
