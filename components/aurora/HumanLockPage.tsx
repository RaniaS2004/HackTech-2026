import { Footer } from "./Footer";
import { HumanLockDemo } from "./HumanLockDemo";
import { Nav } from "./Nav";

export function HumanLockPage() {
  return (
    <main className="min-h-screen bg-background pb-20 text-foreground">
      <Nav />
      <HumanLockDemo />
      <Footer />
    </main>
  );
}
