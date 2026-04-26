import { AgentPassDemo } from "./AgentPassDemo";
import { Footer } from "./Footer";
import { Nav } from "./Nav";

export function AgentPassPage() {
  return (
    <main className="min-h-screen bg-background pb-20 text-foreground">
      <Nav />
      <AgentPassDemo />
      <Footer />
    </main>
  );
}
