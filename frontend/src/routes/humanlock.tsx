import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Activity } from "lucide-react";
import { Nav } from "@/components/aurora/Nav";
import { HumanLockDemo } from "@/components/aurora/HumanLockDemo";
import { HumanLockAttemptsReadout } from "@/components/aurora/HumanLockAttemptsReadout";
import { Footer } from "@/components/aurora/Footer";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/humanlock")({
  component: HumanLockPage,
  head: () => ({
    meta: [
      { title: "HumanLock — AURORA" },
      {
        name: "description",
        content:
          "HumanLock by AURORA: adversarial visual challenges that defeat modern AI vision models while staying easy for humans.",
      },
      { property: "og:title", content: "HumanLock — AURORA" },
      {
        property: "og:description",
        content: "Adversarial CAPTCHAs that AI vision models cannot solve.",
      },
    ],
  }),
});

function HumanLockPage() {
  const [open, setOpen] = useState(false);

  return (
    <main className="min-h-screen bg-background text-foreground pb-20">
      <Nav />
      <div className="pt-24">
        <HumanLockDemo />
        <div className="mx-auto -mt-12 mb-20 flex max-w-6xl justify-center px-6">
          <button
            onClick={() => setOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-primary/40 bg-primary/10 px-6 py-3 text-sm font-semibold text-primary backdrop-blur-md transition-all hover:bg-primary/20 hover:border-primary/60"
          >
            <Activity className="h-4 w-4" strokeWidth={2.25} />
            Agent Analysis
          </button>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl border-border bg-background/95 backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold tracking-tight">
              Agent Analysis
            </DialogTitle>
            <DialogDescription>
              AI agents that attempted to pass HumanLock — fingerprinted from timing and behavior.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-2">
            <HumanLockAttemptsReadout />
          </div>
        </DialogContent>
      </Dialog>

      <Footer />
    </main>
  );
}
