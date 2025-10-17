"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { ProgressDisplay } from "@/components/ProgressDisplay";
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

  // Sort signals by urgency
  const sortedSignals = result?.signals
    ? [...result.signals].sort((a, b) => b.urgency_score - a.urgency_score)
    : [];

  return (
    <div className="container py-10">
      <div className="mx-auto max-w-6xl space-y-8">
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

            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-8 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
            >
              {isSubmitting ? "Starting..." : "Start Monitoring"}
            </button>
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
            <div className="rounded-lg border border-border p-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">
                  Found {result.signals_found} Signal
                  {result.signals_found !== 1 ? "s" : ""}
                </h3>
                <button
                  onClick={handleReset}
                  className="text-sm text-primary hover:underline"
                >
                  Monitor Again
                </button>
              </div>
            </div>

            {sortedSignals.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border p-12 text-center">
                <p className="text-muted-foreground">
                  No buying signals detected for {result.saas_client} customers
                </p>
              </div>
            ) : (
              <div className="grid gap-4">
                {sortedSignals.map((signal, idx) => (
                  <SignalCard key={idx} signal={signal} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function SignalCard({ signal }: { signal: SignalSummary }) {
  const urgencyLabel = getUrgencyLabel(signal.urgency_score);
  const urgencyColor = getUrgencyColor(signal.urgency_score);

  return (
    <div className="rounded-lg border border-border bg-card p-6 transition-all hover:border-primary hover:shadow-md">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-3">
            <span className={`text-sm font-medium ${urgencyColor}`}>
              {urgencyLabel}
            </span>
            <h4 className="text-lg font-semibold">{signal.company_name}</h4>
            <span className="rounded bg-muted px-2 py-0.5 text-xs font-medium">
              {signal.ticker}
            </span>
          </div>

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
          </div>

          <p className="text-xs text-muted-foreground">
            {formatDate(signal.generated_at)}
          </p>
        </div>

        <a
          href={`/signals/${signal.ticker}`}
          className="inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-4 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          View Details
        </a>
      </div>
    </div>
  );
}
