"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/api";

interface Customer {
  ticker: string;
  company_name: string;
  industry: string;
}

interface SignalUrgency {
  ticker: string;
  maxUrgency: number; // Highest urgency score for this ticker
}

interface CustomerTickerProps {
  saasClientName: string;
  filteredTickers?: string[]; // Optional: if provided, only show these tickers
  signalUrgencies?: SignalUrgency[]; // Optional: urgency data for each ticker
  label?: string; // Optional: custom label for the ticker
  signalCount?: number; // Optional: number of signals for this ticker group
  signalType?: string; // Optional: signal type to filter by on details page
}

export function CustomerTicker({ saasClientName, filteredTickers, signalUrgencies, label, signalCount, signalType }: CustomerTickerProps) {
  const searchParams = useSearchParams();

  // Build URL with current filter params
  const buildTickerUrl = (ticker: string) => {
    const params = new URLSearchParams();
    params.set("client", saasClientName);

    // Add signal type if provided (to filter on details page)
    if (signalType) {
      params.set("signalType", signalType);
    }

    // Preserve current filters
    const search = searchParams?.get("search");
    const urgency = searchParams?.get("urgency");
    const types = searchParams?.get("types");
    const sort = searchParams?.get("sort");

    if (search) params.set("search", search);
    if (urgency) params.set("urgency", urgency);
    if (types) params.set("types", types);
    if (sort) params.set("sort", sort);

    return `/signals/${ticker}?${params.toString()}`;
  };

  // Helper function to clean company name
  const getCleanCompanyName = (fullName: string) => {
    // Split by " — " or " - " to remove description
    const parts = fullName.split(/\s+[—\-]\s+/);
    const companyPart = parts[0] || fullName;

    // Remove stock exchange info like "(NASDAQ: EBAY)" or "(LSE: CNA)"
    const cleanName = companyPart.replace(/\s*\([^)]+:\s*[^)]+\)\s*/, "").trim();

    return cleanName;
  };

  const [allCustomers, setAllCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);

  // Helper function to get urgency label and color
  const getUrgencyBadge = (ticker: string) => {
    if (!signalUrgencies) return null;

    const urgencyData = signalUrgencies.find(u => u.ticker === ticker);
    if (!urgencyData) return null;

    const score = urgencyData.maxUrgency;

    if (score >= 0.8) {
      return { label: "HIGH", color: "bg-red-500 text-white" };
    } else if (score >= 0.6) {
      return { label: "MED", color: "bg-orange-500 text-white" };
    } else {
      return { label: "LOW", color: "bg-blue-500 text-white" };
    }
  };

  useEffect(() => {
    loadCustomers();
  }, [saasClientName]);

  const loadCustomers = async () => {
    try {
      const response = await fetch(
        `http://localhost:8000/api/customers/${saasClientName}`
      );
      const data = await response.json();
      setAllCustomers(data.customers || []);
    } catch (error) {
      console.error("Failed to load customers:", error);
    } finally {
      setLoading(false);
    }
  };

  // Filter customers based on filteredTickers prop
  const customers = filteredTickers && filteredTickers.length > 0
    ? allCustomers.filter(c => filteredTickers.includes(c.ticker))
    : allCustomers;

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

  const isFiltered = filteredTickers && filteredTickers.length > 0 && filteredTickers.length < allCustomers.length;

  return (
    <div className="relative overflow-hidden border-y border-border bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 py-3">
      {/* Label - FIXED WIDTH to ensure consistent alignment */}
      <div className="absolute left-0 top-0 z-20 flex h-full w-64 items-center bg-background px-6">
        <div className="flex flex-col">
          <span className="whitespace-nowrap text-xs font-bold uppercase tracking-wider text-primary">
            {label || "Customer Ticker"}
          </span>
          {signalCount !== undefined ? (
            <span className="whitespace-nowrap text-[10px] text-muted-foreground">
              {signalCount} signal{signalCount !== 1 ? 's' : ''}
            </span>
          ) : isFiltered ? (
            <span className="whitespace-nowrap text-[10px] text-muted-foreground">
              {customers.length} of {allCustomers.length}
            </span>
          ) : null}
        </div>
      </div>

      {/* Gradient fade after label - aligned with label width */}
      <div className="pointer-events-none absolute left-64 top-0 z-10 h-full w-16 bg-gradient-to-r from-background to-transparent"></div>

      {/* Scrolling Ticker - starts after label + fade */}
      <div className="flex animate-ticker space-x-6 pl-80">
        {tickerItems.map((customer, index) => {
          const urgencyBadge = getUrgencyBadge(customer.ticker);

          return (
            <a
              key={`${customer.ticker}-${index}`}
              href={buildTickerUrl(customer.ticker)}
              className="group flex min-w-fit items-center gap-3 rounded-lg border border-border bg-card px-4 py-2 shadow-sm transition-all hover:scale-105 hover:border-primary hover:shadow-md"
            >
              {/* Ticker Symbol Badge */}
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                {customer.ticker}
              </div>

              {/* Company Name with Urgency Badge */}
              <div className="flex min-w-0 items-center gap-2">
                <div className="truncate text-sm font-medium">
                  {getCleanCompanyName(customer.company_name)}
                </div>
                {urgencyBadge && (
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${urgencyBadge.color}`}>
                    {urgencyBadge.label}
                  </span>
                )}
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
          );
        })}
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
