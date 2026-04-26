import { createFileRoute } from "@tanstack/react-router";
import { Nav } from "@/components/aurora/Nav";
import { AgentPassDemo } from "@/components/aurora/AgentPassDemo";
import { Footer } from "@/components/aurora/Footer";

export const Route = createFileRoute("/agentpass")({
  component: AgentPassPage,
  head: () => ({
    meta: [
      { title: "AgentPass — AURORA" },
      {
        name: "description",
        content:
          "AgentPass by AURORA: a reverse CAPTCHA that lets legitimate AI agents prove they're authorized and receive a signed identity token.",
      },
      { property: "og:title", content: "AgentPass — AURORA" },
      {
        property: "og:description",
        content: "Signed identity tokens for legitimate AI agents.",
      },
    ],
  }),
});

function AgentPassPage() {
  return (
    <main className="min-h-screen bg-background text-foreground pb-20">
      <Nav />
      <div className="pt-24">
        <AgentPassDemo />
      </div>
      <Footer />
    </main>
  );
}
