export default function Home() {
  return (
    <div className="flex flex-col" style={{ minHeight: 'calc(100vh - 60px)' }}>
      {/* Hero Section - Centered */}
      <div className="flex-1 flex items-center justify-center py-8 px-6 pb-12">
        <div className="max-w-4xl w-full text-center space-y-8">
          <div className="space-y-4">
            <h1 className="text-5xl md:text-6xl font-bold tracking-tight bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent pb-2">
              LeadSignal
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground">
              AI-powered SaaS customer intelligence and buying signal detection
            </p>
          </div>

          {/* Features Grid */}
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4 text-sm">
            <div className="flex items-center justify-center gap-2 rounded-lg border border-border bg-muted/50 px-4 py-3">
              <svg
                className="h-5 w-5 text-primary flex-shrink-0"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
              <span>10 parallel web research queries</span>
            </div>
            <div className="flex items-center justify-center gap-2 rounded-lg border border-border bg-muted/50 px-4 py-3">
              <svg
                className="h-5 w-5 text-primary flex-shrink-0"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
              <span>Real-time progress tracking</span>
            </div>
            <div className="flex items-center justify-center gap-2 rounded-lg border border-border bg-muted/50 px-4 py-3">
              <svg
                className="h-5 w-5 text-primary flex-shrink-0"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
              <span>Persona-specific insights</span>
            </div>
            <div className="flex items-center justify-center gap-2 rounded-lg border border-border bg-muted/50 px-4 py-3">
              <svg
                className="h-5 w-5 text-primary flex-shrink-0"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
              <span>SEC 8-K filing analysis</span>
            </div>
          </div>
        </div>
      </div>

      {/* Full-Width Navigation Buttons */}
      <div className="grid md:grid-cols-2">
        {/* Onboard Button */}
        <a
          href="/onboard"
          className="group relative overflow-hidden border-t border-r border-border bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-blue-950 dark:to-indigo-900 p-8 md:p-12 transition-all hover:from-blue-100 hover:to-indigo-200 dark:hover:from-blue-900 dark:hover:to-indigo-800"
        >
          <div className="relative z-10 space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 text-white transition-transform group-hover:scale-110 group-hover:rotate-6">
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
              <h2 className="text-2xl font-bold text-blue-900 dark:text-blue-100">Onboard</h2>
            </div>
            <p className="text-blue-700 dark:text-blue-300">
              Add new SaaS companies with AI research
            </p>
          </div>
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500/0 via-blue-500/20 to-blue-500/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
        </a>

        {/* Monitor Button */}
        <a
          href="/monitor"
          className="group relative overflow-hidden border-t border-border bg-gradient-to-br from-purple-50 to-pink-100 dark:from-purple-950 dark:to-pink-900 p-8 md:p-12 transition-all hover:from-purple-100 hover:to-pink-200 dark:hover:from-purple-900 dark:hover:to-pink-800"
        >
          <div className="relative z-10 space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-600 text-white transition-transform group-hover:scale-110 group-hover:rotate-6">
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
              <h2 className="text-2xl font-bold text-purple-900 dark:text-purple-100">Monitor</h2>
            </div>
            <p className="text-purple-700 dark:text-purple-300">
              Track customer signals and opportunities
            </p>
          </div>
          <div className="absolute inset-0 bg-gradient-to-r from-purple-500/0 via-purple-500/20 to-purple-500/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
        </a>
      </div>
    </div>
  );
}
