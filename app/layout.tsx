import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "JANUS — Identity Layer for the Agentic Web",
  description: "Dual-sided identity verification: HumanLock for humans, AgentPass for AI agents.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
