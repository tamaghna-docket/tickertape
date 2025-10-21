"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { ProgressDisplay } from "@/components/ProgressDisplay";
import { CustomerTicker } from "@/components/CustomerTicker";
import type { MonitorResult, SignalSummary } from "@/lib/types";
import { formatDate, getUrgencyLabel, getUrgencyColor } from "@/lib/utils";

export default function MonitorPage() {
  const searchParams = useSearchParams();
  const [companyName, setCompanyName] = useState(
    searchParams?.get("company") || ""
  );
  const [customerAgeDays, setCustomerAgeDays] = useState(90);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [result, setResult] = useState<MonitorResult | null>(null);
  const [loadingExisting, setLoadingExisting] = useState(false);

  // Filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [urgencyFilter, setUrgencyFilter] = useState<"all" | "high" | "medium" | "low">("all");
  const [signalTypeFilters, setSignalTypeFilters] = useState<string[]>([]); // Changed to array for multi-select
  const [signalTypeDropdownOpen, setSignalTypeDropdownOpen] = useState(false);
  const [sortBy, setSortBy] = useState<"urgency" | "date" | "value">("urgency");
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");

  const handleLoadExisting = async () => {
    if (!companyName) {
      setError("Please enter a company name");
      return;
    }

    setError(null);
    setLoadingExisting(true);

    try {
      const data = await api.getSignalsFromDB(companyName);

      // Convert to MonitorResult format
      setResult({
        job_id: "from-db",
        status: "completed" as const,
        saas_client: data.saas_client,
        signals_found: data.signals_found,
        signals: data.signals,
        completed_at: new Date().toISOString()
      });
      setLoadingExisting(false);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load existing signals"
      );
      setLoadingExisting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await api.monitorCustomers({
        saas_client_name: companyName,
        customer_age_days: customerAgeDays,
      });

      setJobId(response.job_id);

      // Poll for result
      const pollInterval = setInterval(async () => {
        try {
          const status = await api.getMonitorStatus(response.job_id);

          if (status.status === "completed") {
            clearInterval(pollInterval);
            const finalResult = await api.getMonitorSignals(response.job_id);
            setResult(finalResult);
          } else if (status.status === "failed") {
            clearInterval(pollInterval);
            setError(status.error || "Monitoring failed");
          }
        } catch (err) {
          // Continue polling
        }
      }, 2000);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to start monitoring"
      );
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setCompanyName("");
    setJobId(null);
    setResult(null);
    setError(null);
    setIsSubmitting(false);
  };

  // Filter and sort signals
  const filteredAndSortedSignals = result?.signals
    ? [...result.signals]
        // Apply search filter
        .filter((signal) => {
          if (!searchQuery) return true;
          const query = searchQuery.toLowerCase();
          return (
            signal.company_name.toLowerCase().includes(query) ||
            signal.ticker.toLowerCase().includes(query) ||
            signal.signal_type.toLowerCase().includes(query)
          );
        })
        // Apply urgency filter (aligned with getUrgencyLabel thresholds)
        .filter((signal) => {
          if (urgencyFilter === "all") return true;
          if (urgencyFilter === "high") return signal.urgency_score >= 0.8;
          if (urgencyFilter === "medium")
            return signal.urgency_score >= 0.6 && signal.urgency_score < 0.8;
          if (urgencyFilter === "low") return signal.urgency_score < 0.6;
          return true;
        })
        // Apply signal type filter (multiple selection)
        .filter((signal) => {
          if (signalTypeFilters.length === 0) return true;
          return signalTypeFilters.includes(signal.signal_type);
        })
        // Apply sorting
        .sort((a, b) => {
          if (sortBy === "urgency") return b.urgency_score - a.urgency_score;
          if (sortBy === "date")
            return (
              new Date(b.generated_at).getTime() -
              new Date(a.generated_at).getTime()
            );
          if (sortBy === "value") {
            // Extract numeric value from estimated_value string
            const extractValue = (str: string) => {
              const match = str.match(/\d+/);
              return match ? parseInt(match[0]) : 0;
            };
            return extractValue(b.estimated_value) - extractValue(a.estimated_value);
          }
          return 0;
        })
    : [];

  // Get unique signal types for filter dropdown
  const signalTypes = result?.signals
    ? Array.from(new Set(result.signals.map((s) => s.signal_type)))
    : [];

  // Statistics for quick insights (aligned with getUrgencyLabel thresholds)
  const stats = {
    total: result?.signals_found || 0,
    high: result?.signals.filter((s) => s.urgency_score >= 0.8).length || 0,
    medium:
      result?.signals.filter((s) => s.urgency_score >= 0.6 && s.urgency_score < 0.8)
        .length || 0,
    low: result?.signals.filter((s) => s.urgency_score < 0.6).length || 0,
    showing: filteredAndSortedSignals.length,
  };

  // Group signals by signal type for multiple tickers
  const hasActiveFilters = searchQuery !== "" || urgencyFilter !== "all" || signalTypeFilters.length > 0;
  const signalsToDisplay = hasActiveFilters ? filteredAndSortedSignals : (result?.signals || []);

  // Group by signal type
  const signalsByType = signalsToDisplay.reduce((acc, signal) => {
    if (!acc[signal.signal_type]) {
      acc[signal.signal_type] = [];
    }
    acc[signal.signal_type].push(signal);
    return acc;
  }, {} as Record<string, SignalSummary[]>);

  // For each signal type, get unique tickers and their max urgency
  const tickerGroupsByType = Object.entries(signalsByType).map(([signalType, signals]) => {
    const tickers = Array.from(new Set(signals.map(s => s.ticker)));
    const urgencies = Array.from(
      signals.reduce((acc, signal) => {
        const existing = acc.get(signal.ticker);
        if (!existing || signal.urgency_score > existing.maxUrgency) {
          acc.set(signal.ticker, {
            ticker: signal.ticker,
            maxUrgency: signal.urgency_score,
          });
        }
        return acc;
      }, new Map<string, { ticker: string; maxUrgency: number }>())
    ).map(([, value]) => value);

    return {
      signalType,
      tickers,
      urgencies,
      count: signals.length,
    };
  }).sort((a, b) => b.count - a.count); // Sort by count descending

  return (
    <div className="py-6 px-6">
      <div className="mx-auto max-w-full space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold">Monitor Customers</h1>
          <p className="text-muted-foreground">
            Monitor enterprise customers for buying signals from SEC 8-K filings
          </p>
        </div>

        {!jobId && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label
                htmlFor="company_name"
                className="text-sm font-medium leading-none"
              >
                SaaS Company Name
              </label>
              <input
                id="company_name"
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="e.g., Salesforce"
                required
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="customer_age"
                className="text-sm font-medium leading-none"
              >
                Customer Age (days)
              </label>
              <select
                id="customer_age"
                value={customerAgeDays}
                onChange={(e) => setCustomerAgeDays(Number(e.target.value))}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value={30}>Last 30 days</option>
                <option value={60}>Last 60 days</option>
                <option value={90}>Last 90 days</option>
                <option value={180}>Last 180 days</option>
                <option value={365}>Last year</option>
              </select>
              <p className="text-sm text-muted-foreground">
                Only monitor customers seen in the last N days
              </p>
            </div>

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-8 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
              >
                {isSubmitting ? "Starting..." : "Start Monitoring"}
              </button>
              <button
                type="button"
                onClick={handleLoadExisting}
                disabled={loadingExisting || !companyName}
                className="inline-flex h-10 items-center justify-center rounded-md border border-input bg-background px-8 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
              >
                {loadingExisting ? "Loading..." : "Load Existing Signals"}
              </button>
            </div>
          </form>
        )}

        {jobId && !result && (
          <ProgressDisplay
            jobId={jobId}
            title={`Monitoring: ${companyName} Customers`}
          />
        )}

        {result && (
          <div className="space-y-6">
            {/* Multiple Tickers Grouped by Signal Type */}
            {tickerGroupsByType.length > 0 && (
              <div className="space-y-2">
                {tickerGroupsByType.map((group) => (
                  <CustomerTicker
                    key={group.signalType}
                    saasClientName={result.saas_client}
                    filteredTickers={group.tickers}
                    signalUrgencies={group.urgencies}
                    label={group.signalType.replace(/_/g, " ").toUpperCase()}
                    signalCount={group.count}
                  />
                ))}
              </div>
            )}

            {/* Stats Overview */}
            <div className="grid gap-4 md:grid-cols-4">
              <div className="rounded-lg border border-border bg-card p-4">
                <p className="text-sm text-muted-foreground">Total Signals</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                <p className="text-sm text-red-700">High Urgency</p>
                <p className="text-2xl font-bold text-red-900">{stats.high}</p>
              </div>
              <div className="rounded-lg border border-orange-200 bg-orange-50 p-4">
                <p className="text-sm text-orange-700">Medium Urgency</p>
                <p className="text-2xl font-bold text-orange-900">{stats.medium}</p>
              </div>
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                <p className="text-sm text-blue-700">Low Urgency</p>
                <p className="text-2xl font-bold text-blue-900">{stats.low}</p>
              </div>
            </div>

            {/* Filter Controls */}
            <div className="rounded-lg border border-border bg-card p-6">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-semibold">
                  Showing {stats.showing} of {stats.total} Signals
                </h3>
                <button
                  onClick={handleReset}
                  className="text-sm text-primary hover:underline"
                >
                  Monitor Again
                </button>
              </div>

              {/* Search and Filters */}
              <div className="space-y-4">
                {/* Search Bar */}
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search by company name, ticker, or signal type..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-4 py-2 pl-10 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                  <svg
                    className="absolute left-3 top-2.5 h-5 w-5 text-muted-foreground"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <circle cx="11" cy="11" r="8"></circle>
                    <path d="m21 21-4.35-4.35"></path>
                  </svg>
                </div>

                {/* Filter Row */}
                <div className="flex flex-wrap items-center gap-3">
                  {/* Urgency Filter */}
                  <div className="flex items-center gap-2">
                    <label className="text-sm font-medium">Urgency:</label>
                    <div className="flex rounded-md border border-input">
                      <button
                        onClick={() => setUrgencyFilter("all")}
                        className={`px-3 py-1 text-xs ${
                          urgencyFilter === "all"
                            ? "bg-primary text-primary-foreground"
                            : "bg-background hover:bg-muted"
                        }`}
                      >
                        All
                      </button>
                      <button
                        onClick={() => setUrgencyFilter("high")}
                        className={`border-l border-input px-3 py-1 text-xs ${
                          urgencyFilter === "high"
                            ? "bg-red-500 text-white"
                            : "bg-background hover:bg-muted"
                        }`}
                      >
                        High ({stats.high})
                      </button>
                      <button
                        onClick={() => setUrgencyFilter("medium")}
                        className={`border-l border-input px-3 py-1 text-xs ${
                          urgencyFilter === "medium"
                            ? "bg-orange-500 text-white"
                            : "bg-background hover:bg-muted"
                        }`}
                      >
                        Medium ({stats.medium})
                      </button>
                      <button
                        onClick={() => setUrgencyFilter("low")}
                        className={`border-l border-input px-3 py-1 text-xs ${
                          urgencyFilter === "low"
                            ? "bg-blue-500 text-white"
                            : "bg-background hover:bg-muted"
                        }`}
                      >
                        Low ({stats.low})
                      </button>
                    </div>
                  </div>

                  {/* Signal Type Filter - Dropdown with checkboxes */}
                  <div className="relative flex items-center gap-2">
                    <label className="text-sm font-medium">Signal Type:</label>
                    <div className="relative">
                      <button
                        onClick={() => setSignalTypeDropdownOpen(!signalTypeDropdownOpen)}
                        className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-3 py-1 text-sm hover:bg-muted"
                      >
                        {signalTypeFilters.length === 0
                          ? "All Types"
                          : `${signalTypeFilters.length} selected`}
                        <svg
                          className={`h-4 w-4 transition-transform ${signalTypeDropdownOpen ? 'rotate-180' : ''}`}
                          fill="none"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path d="M19 9l-7 7-7-7"></path>
                        </svg>
                      </button>

                      {signalTypeDropdownOpen && (
                        <>
                          {/* Backdrop to close dropdown */}
                          <div
                            className="fixed inset-0 z-10"
                            onClick={() => setSignalTypeDropdownOpen(false)}
                          />

                          {/* Dropdown menu */}
                          <div className="absolute left-0 top-full z-20 mt-1 w-64 rounded-md border border-border bg-background shadow-lg">
                            <div className="max-h-64 overflow-y-auto p-2">
                              {signalTypes.map((type) => (
                                <label
                                  key={type}
                                  className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted"
                                >
                                  <input
                                    type="checkbox"
                                    checked={signalTypeFilters.includes(type)}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setSignalTypeFilters([...signalTypeFilters, type]);
                                      } else {
                                        setSignalTypeFilters(signalTypeFilters.filter(t => t !== type));
                                      }
                                    }}
                                    className="h-4 w-4 rounded border-gray-300"
                                  />
                                  <span className="flex-1">{type.replace(/_/g, " ")}</span>
                                </label>
                              ))}
                            </div>
                            {signalTypeFilters.length > 0 && (
                              <div className="border-t border-border p-2">
                                <button
                                  onClick={() => setSignalTypeFilters([])}
                                  className="w-full text-center text-xs text-primary hover:underline"
                                >
                                  Clear all
                                </button>
                              </div>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Sort By */}
                  <div className="flex items-center gap-2">
                    <label className="text-sm font-medium">Sort By:</label>
                    <select
                      value={sortBy}
                      onChange={(e) =>
                        setSortBy(e.target.value as "urgency" | "date" | "value")
                      }
                      className="rounded-md border border-input bg-background px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <option value="urgency">Urgency (High to Low)</option>
                      <option value="date">Date (Newest First)</option>
                      <option value="value">Estimated Value</option>
                    </select>
                  </div>

                  {/* View Mode Toggle */}
                  <div className="ml-auto flex rounded-md border border-input">
                    <button
                      onClick={() => setViewMode("list")}
                      className={`px-3 py-1 text-xs ${
                        viewMode === "list"
                          ? "bg-primary text-primary-foreground"
                          : "bg-background hover:bg-muted"
                      }`}
                    >
                      List
                    </button>
                    <button
                      onClick={() => setViewMode("grid")}
                      className={`border-l border-input px-3 py-1 text-xs ${
                        viewMode === "grid"
                          ? "bg-primary text-primary-foreground"
                          : "bg-background hover:bg-muted"
                      }`}
                    >
                      Grid
                    </button>
                  </div>
                </div>

                {/* Active Filter Tags */}
                {(searchQuery || urgencyFilter !== "all" || signalTypeFilters.length > 0) && (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-muted-foreground">Active filters:</span>
                    {searchQuery && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-1 text-xs">
                        Search: "{searchQuery}"
                        <button
                          onClick={() => setSearchQuery("")}
                          className="hover:text-primary"
                        >
                          ×
                        </button>
                      </span>
                    )}
                    {urgencyFilter !== "all" && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-1 text-xs">
                        Urgency: {urgencyFilter}
                        <button
                          onClick={() => setUrgencyFilter("all")}
                          className="hover:text-primary"
                        >
                          ×
                        </button>
                      </span>
                    )}
                    {signalTypeFilters.map((type) => (
                      <span key={type} className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-1 text-xs">
                        Type: {type.replace(/_/g, " ")}
                        <button
                          onClick={() => setSignalTypeFilters(signalTypeFilters.filter(t => t !== type))}
                          className="hover:text-primary"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                    <button
                      onClick={() => {
                        setSearchQuery("");
                        setUrgencyFilter("all");
                        setSignalTypeFilters([]);
                      }}
                      className="text-xs text-primary hover:underline"
                    >
                      Clear all
                    </button>
                  </div>
                )}
              </div>
            </div>

            {filteredAndSortedSignals.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border p-12 text-center">
                <p className="text-muted-foreground">
                  {searchQuery || urgencyFilter !== "all" || signalTypeFilters.length > 0
                    ? "No signals match your filters. Try adjusting your search criteria."
                    : `No buying signals detected for ${result.saas_client} customers`}
                </p>
              </div>
            ) : (
              <div
                className={
                  viewMode === "grid"
                    ? "grid gap-4 md:grid-cols-2"
                    : "grid gap-4"
                }
              >
                {filteredAndSortedSignals.map((signal, idx) => (
                  <SignalCard
                    key={idx}
                    signal={signal}
                    saasClient={result.saas_client}
                    viewMode={viewMode}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function SignalCard({
  signal,
  saasClient,
  viewMode = "list"
}: {
  signal: SignalSummary;
  saasClient: string;
  viewMode?: "list" | "grid";
}) {
  const urgencyLabel = getUrgencyLabel(signal.urgency_score);
  const urgencyColor = getUrgencyColor(signal.urgency_score);

  // Clean company name (remove everything after — or ([)
  const cleanCompanyName = signal.company_name.split(/—|\(/)[0].trim();

  return (
    <div className="rounded-lg border border-border bg-card p-6 transition-all hover:border-primary hover:shadow-md">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-3">
            <span className={`text-sm font-medium ${urgencyColor}`}>
              {urgencyLabel}
            </span>
            <h4 className="text-lg font-semibold">{cleanCompanyName}</h4>
            <span className="rounded bg-muted px-2 py-0.5 text-xs font-medium">
              {signal.ticker}
            </span>
          </div>

          {/* Show signal summary if available */}
          {signal.signal_summary && (
            <p className="text-sm text-foreground">
              {signal.signal_summary}
            </p>
          )}

          <div className="grid gap-2 text-sm md:grid-cols-2">
            <div>
              <span className="text-muted-foreground">Signal Type: </span>
              <span className="font-medium">
                {signal.signal_type.replace(/_/g, " ")}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Opportunity: </span>
              <span className="font-medium">{signal.opportunity_type}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Urgency: </span>
              <span className="font-medium">
                {signal.urgency_score.toFixed(2)}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Est. Value: </span>
              <span className="font-medium">{signal.estimated_value}</span>
            </div>
            {signal.filing_date && (
              <div className="md:col-span-2">
                <span className="text-muted-foreground">Filing Date: </span>
                <span className="font-medium">{signal.filing_date}</span>
              </div>
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            Generated: {formatDate(signal.generated_at)}
          </p>
        </div>

        <a
          href={`/signals/${signal.ticker}?client=${encodeURIComponent(saasClient)}`}
          className="inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-4 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          View Details
        </a>
      </div>
    </div>
  );
}
