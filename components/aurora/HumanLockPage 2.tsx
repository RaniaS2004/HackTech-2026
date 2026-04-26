"use client";

import { useState } from "react";
import { ActivityIcon, XIcon } from "./icons";
import { Footer } from "./Footer";
import { HumanLockAttemptsReadout } from "./HumanLockAttemptsReadout";
import { HumanLockDemo } from "./HumanLockDemo";
import { Nav } from "./Nav";

export function HumanLockPage() {
  const [open, setOpen] = useState(false);

  return (
    <main className="min-h-screen bg-background pb-20 text-foreground">
      <Nav />
      <div className="pt-24">
        <HumanLockDemo />
        <div className="mx-auto -mt-12 mb-20 flex max-w-6xl justify-center px-6">
          <button
            onClick={() => setOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-primary/40 bg-primary/10 px-6 py-3 text-sm font-semibold text-primary backdrop-blur-md transition-all hover:border-primary/60 hover:bg-primary/20"
          >
            <ActivityIcon className="h-4 w-4" />
            Agent Analysis
          </button>
        </div>
      </div>

      {open ? (
        <div className="fixed inset-0 z-50 bg-black/80 px-4 py-8">
          <div className="mx-auto mt-20 max-w-2xl rounded-2xl border border-border bg-background/95 p-6 backdrop-blur-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold tracking-tight">Agent Analysis</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  AI agents that attempted to pass HumanLock, fingerprinted from timing and behavior.
                </p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="rounded-md border border-border bg-background/70 p-2 text-muted-foreground transition-colors hover:bg-secondary/70 hover:text-foreground"
                aria-label="Close agent analysis"
              >
                <XIcon className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-4">
              <HumanLockAttemptsReadout />
            </div>
          </div>
        </div>
      ) : null}

      <Footer />
    </main>
  );
}
