export default function Home() {
  return (
    <div className="container py-10">
      <div className="mx-auto max-w-4xl space-y-8">
        <div className="space-y-2">
          <h1 className="text-4xl font-bold tracking-tight">
            Customer Intelligence Platform
          </h1>
          <p className="text-xl text-muted-foreground">
            AI-powered SaaS customer intelligence and buying signal detection
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Onboard Card */}
          <a
            href="/onboard"
            className="group block rounded-lg border border-border bg-card p-6 transition-all hover:border-primary hover:shadow-lg"
          >
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <line x1="19" x2="19" y1="8" y2="14" />
                    <line x1="22" x2="16" y1="11" y2="11" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold">Onboard Company</h2>
              </div>
              <p className="text-muted-foreground">
                Add a new SaaS company with automatic research. Discover
                products, pricing, ICPs, personas, and enterprise customers.
              </p>
              <div className="pt-2">
                <span className="text-sm font-medium text-primary group-hover:underline">
                  Start onboarding →
                </span>
              </div>
            </div>
          </a>

          {/* Monitor Card */}
          <a
            href="/monitor"
            className="group block rounded-lg border border-border bg-card p-6 transition-all hover:border-primary hover:shadow-lg"
          >
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold">Monitor Customers</h2>
              </div>
              <p className="text-muted-foreground">
                Monitor enterprise customers for buying signals. Get
                persona-specific intelligence on executive hires, acquisitions,
                and more.
              </p>
              <div className="pt-2">
                <span className="text-sm font-medium text-primary group-hover:underline">
                  Start monitoring →
                </span>
              </div>
            </div>
          </a>
        </div>

        {/* Features */}
        <div className="space-y-4 rounded-lg border border-border bg-muted/50 p-6">
          <h3 className="text-lg font-semibold">Features</h3>
          <ul className="grid gap-2 md:grid-cols-2">
            <li className="flex items-start space-x-2">
              <svg
                className="mt-0.5 h-5 w-5 text-primary"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
              <span className="text-sm">10 parallel web research queries</span>
            </li>
            <li className="flex items-start space-x-2">
              <svg
                className="mt-0.5 h-5 w-5 text-primary"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
              <span className="text-sm">Real-time progress tracking</span>
            </li>
            <li className="flex items-start space-x-2">
              <svg
                className="mt-0.5 h-5 w-5 text-primary"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
              <span className="text-sm">Persona-specific insights</span>
            </li>
            <li className="flex items-start space-x-2">
              <svg
                className="mt-0.5 h-5 w-5 text-primary"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
              <span className="text-sm">SEC 8-K filing analysis</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
