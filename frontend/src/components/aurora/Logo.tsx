export function Logo({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="relative h-7 w-7">
        <div className="absolute inset-0 rounded-md bg-primary/20 blur-md" />
        <div className="relative flex h-7 w-7 items-center justify-center rounded-md border border-primary/40 bg-background">
          {/* Purple padlock with AS monogram */}
          <svg
            viewBox="0 0 24 24"
            className="h-5 w-5"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id="aurora-lock-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="hsl(var(--primary))" />
                <stop offset="100%" stopColor="hsl(var(--primary-glow, var(--primary)))" />
              </linearGradient>
            </defs>
            {/* Shackle */}
            <path
              d="M8 10V7a4 4 0 0 1 8 0v3"
              fill="none"
              stroke="url(#aurora-lock-gradient)"
              strokeWidth="2"
              strokeLinecap="round"
            />
            {/* Body */}
            <rect
              x="5"
              y="10"
              width="14"
              height="11"
              rx="2"
              fill="url(#aurora-lock-gradient)"
            />
            {/* AS monogram */}
            <text
              x="12"
              y="18.25"
              textAnchor="middle"
              fontSize="6.5"
              fontWeight="700"
              fontFamily="ui-sans-serif, system-ui, -apple-system, sans-serif"
              fill="#ffffff"
              letterSpacing="-0.3"
            >
              AS
            </text>
          </svg>
        </div>
      </div>
      <span className="text-lg font-semibold tracking-tight">
        <span style={{ color: "#ffffff" }}>AURORA</span>{" "}
        <span style={{ color: "#6b7280" }}>SECURE</span>
      </span>
    </div>
  );
}
