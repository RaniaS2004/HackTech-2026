import { FingerprintReadout } from "./FingerprintReadout";

export function FingerprintSection() {
  return (
    <section id="fingerprint" className="relative pt-8 pb-28">
      <div className="mx-auto max-w-5xl px-6">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <div className="mb-3 inline-flex items-center gap-2">
            <span className="h-px w-6 bg-primary" />
            <span className="text-xs font-medium uppercase tracking-widest text-primary">
              Agent fingerprinting
            </span>
            <span className="h-px w-6 bg-primary" />
          </div>
          <h2 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
            Know which model is knocking.
          </h2>
          <p className="mt-4 text-muted-foreground">
            From timing and behavior alone, AURORA identifies the model behind every request.
          </p>
        </div>

        <div className="mx-auto max-w-2xl">
          <FingerprintReadout />
        </div>
      </div>
    </section>
  );
}
