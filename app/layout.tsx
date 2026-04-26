import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AURORA — Identity for the Agentic Web",
  description: "Dual-sided identity layer that blocks unwanted bots, verifies humans, and issues signed reputation for legitimate AI agents.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
