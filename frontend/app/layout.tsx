import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LeadSignal",
  description: "AI-powered SaaS customer intelligence and monitoring",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background font-sans antialiased">
        <div className="relative flex min-h-screen flex-col">
          <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="flex">
              <a
                href="/"
                className="group flex items-center justify-center border-r border-border bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 px-6 py-3 transition-all hover:from-slate-100 hover:to-slate-200 dark:hover:from-slate-800 dark:hover:to-slate-700"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-slate-600 dark:text-slate-400 transition-transform group-hover:scale-110"
                >
                  <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                  <polyline points="9 22 9 12 15 12 15 22" />
                </svg>
              </a>
              <a
                href="/onboard"
                className="group flex flex-1 items-center justify-center gap-2 border-r border-border bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-blue-950 dark:to-indigo-900 px-4 py-3 transition-all hover:from-blue-100 hover:to-indigo-200 dark:hover:from-blue-900 dark:hover:to-indigo-800"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-blue-600 dark:text-blue-400 transition-transform group-hover:scale-110"
                >
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <line x1="19" x2="19" y1="8" y2="14" />
                  <line x1="22" x2="16" y1="11" y2="11" />
                </svg>
                <span className="font-semibold text-blue-900 dark:text-blue-100">Onboard</span>
              </a>
              <a
                href="/monitor"
                className="group flex flex-1 items-center justify-center gap-2 bg-gradient-to-br from-purple-50 to-pink-100 dark:from-purple-950 dark:to-pink-900 px-4 py-3 transition-all hover:from-purple-100 hover:to-pink-200 dark:hover:from-purple-900 dark:hover:to-pink-800"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-purple-600 dark:text-purple-400 transition-transform group-hover:scale-110"
                >
                  <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
                <span className="font-semibold text-purple-900 dark:text-purple-100">Monitor</span>
              </a>
            </div>
          </header>
          <main className="flex-1">{children}</main>
          <footer className="border-t py-6 md:py-0">
            <div className="container flex h-14 items-center justify-between text-sm text-muted-foreground">
              <p>Built with FastAPI + Next.js</p>
              <p>Powered by OpenAI Agents SDK</p>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
