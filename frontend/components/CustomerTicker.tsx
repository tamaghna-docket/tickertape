"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

interface Customer {
  ticker: string;
  company_name: string;
  industry: string;
}

interface CustomerTickerProps {
  saasClientName: string;
}

export function CustomerTicker({ saasClientName }: CustomerTickerProps) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCustomers();
  }, [saasClientName]);

  const loadCustomers = async () => {
    try {
      const response = await fetch(
        `http://localhost:8000/api/customers/${saasClientName}`
      );
      const data = await response.json();
      setCustomers(data.customers || []);
    } catch (error) {
      console.error("Failed to load customers:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="overflow-hidden border-y border-border bg-muted/30 py-3">
        <div className="text-center text-sm text-muted-foreground">
          Loading customers...
        </div>
      </div>
    );
  }

  if (customers.length === 0) {
    return null;
  }

  // Duplicate customers array for seamless loop
  const tickerItems = [...customers, ...customers];

  return (
    <div className="relative overflow-hidden border-y border-border bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 py-3">
      {/* Label - Fixed width with clear background */}
      <div className="absolute left-0 top-0 z-20 flex h-full items-center bg-background px-6 pr-8">
        <span className="whitespace-nowrap text-xs font-bold uppercase tracking-wider text-primary">
          Customer Ticker
        </span>
      </div>

      {/* Gradient fade after label */}
      <div className="pointer-events-none absolute left-40 top-0 z-10 h-full w-16 bg-gradient-to-r from-background to-transparent"></div>

      {/* Scrolling Ticker */}
      <div className="flex animate-ticker space-x-6 pl-60">
        {tickerItems.map((customer, index) => (
          <a
            key={`${customer.ticker}-${index}`}
            href={`/signals/${customer.ticker}?client=${encodeURIComponent(
              saasClientName
            )}`}
            className="group flex min-w-fit items-center gap-3 rounded-lg border border-border bg-card px-4 py-2 shadow-sm transition-all hover:scale-105 hover:border-primary hover:shadow-md"
          >
            {/* Ticker Symbol Badge */}
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
              {customer.ticker}
            </div>

            {/* Company Name Only */}
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">
                {customer.company_name.split("—")[0].trim()}
              </div>
            </div>

            {/* Arrow indicator on hover */}
            <svg
              className="h-4 w-4 flex-shrink-0 text-primary opacity-0 transition-opacity group-hover:opacity-100"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path d="M9 5l7 7-7 7"></path>
            </svg>
          </a>
        ))}
      </div>

      {/* Gradient fade on right */}
      <div className="pointer-events-none absolute right-0 top-0 h-full w-32 bg-gradient-to-l from-background to-transparent"></div>

      <style jsx>{`
        @keyframes ticker {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          }
        }

        .animate-ticker {
          animation: ticker 20s linear infinite;
        }

        .animate-ticker:hover {
          animation-play-state: paused;
        }
      `}</style>
    </div>
  );
}
