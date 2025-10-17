"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { ProgressDisplay } from "@/components/ProgressDisplay";
import type { OnboardResult } from "@/lib/types";
import { formatDate } from "@/lib/utils";

export default function OnboardPage() {
  const [companyName, setCompanyName] = useState("");
  const [website, setWebsite] = useState("");
  const [deepResearch, setDeepResearch] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [result, setResult] = useState<OnboardResult | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await api.onboardCompany({
        company_name: companyName,
        website,
        deep_research: deepResearch,
      });

      setJobId(response.job_id);

      // Poll for result
      const pollInterval = setInterval(async () => {
        try {
          const status = await api.getOnboardStatus(response.job_id);

          if (status.status === "completed") {
            clearInterval(pollInterval);
            const finalResult = await api.getOnboardResult(response.job_id);
            setResult(finalResult);
          } else if (status.status === "failed") {
            clearInterval(pollInterval);
            setError(status.error || "Onboarding failed");
          }
        } catch (err) {
          // Continue polling
        }
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start onboarding");
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setCompanyName("");
    setWebsite("");
    setDeepResearch(true);
    setJobId(null);
    setResult(null);
    setError(null);
    setIsSubmitting(false);
  };

  return (
    <div className="container py-10">
      <div className="mx-auto max-w-4xl space-y-8">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold">Onboard New Company</h1>
          <p className="text-muted-foreground">
            Enter a company name and website to automatically research products,
            pricing, customers, and more.
          </p>
        </div>

        {!jobId && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label
                htmlFor="company_name"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Company Name
              </label>
              <input
                id="company_name"
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="e.g., Salesforce"
                required
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="website"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Website
              </label>
              <input
                id="website"
                type="text"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="e.g., salesforce.com"
                required
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>

            <div className="flex items-center space-x-2">
              <input
                id="deep_research"
                type="checkbox"
                checked={deepResearch}
                onChange={(e) => setDeepResearch(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-2 focus:ring-primary"
              />
              <label
                htmlFor="deep_research"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Enable deep research (recommended)
                <span className="ml-2 text-muted-foreground">
                  - 10 parallel queries for comprehensive analysis
                </span>
              </label>
            </div>

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-8 py-2 text-sm font-medium text-primary-foreground ring-offset-background transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
            >
              {isSubmitting ? "Starting..." : "Start Onboarding"}
            </button>
          </form>
        )}

        {jobId && !result && (
          <ProgressDisplay jobId={jobId} title={`Onboarding: ${companyName}`} />
        )}

        {result && (
          <div className="space-y-6">
            <div className="rounded-lg border border-green-200 bg-green-50 p-6">
              <div className="flex items-start gap-3">
                <svg
                  className="mt-0.5 h-6 w-6 text-green-600"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-green-900">
                    Onboarding Complete!
                  </h3>
                  <p className="mt-1 text-sm text-green-700">
                    Successfully onboarded {result.company_name}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-border p-6">
              <h3 className="mb-4 text-lg font-semibold">Results Summary</h3>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">
                    Total Customers Discovered
                  </p>
                  <p className="text-2xl font-bold">
                    {result.customers_discovered}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">
                    Enterprise Customers (with ticker)
                  </p>
                  <p className="text-2xl font-bold">
                    {result.enterprise_customers}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">
                    Products Identified
                  </p>
                  <p className="text-2xl font-bold">{result.products_found}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Pricing Tiers</p>
                  <p className="text-2xl font-bold">
                    {result.pricing_tiers_found}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">ICP Segments</p>
                  <p className="text-2xl font-bold">{result.icps_found}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">GTM Personas</p>
                  <p className="text-2xl font-bold">{result.personas_found}</p>
                </div>
              </div>
              {result.completed_at && (
                <p className="mt-4 text-sm text-muted-foreground">
                  Completed at {formatDate(result.completed_at)}
                </p>
              )}
            </div>

            <div className="flex gap-4">
              <a
                href={`/monitor?company=${encodeURIComponent(result.company_name)}`}
                className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-8 py-2 text-sm font-medium text-primary-foreground ring-offset-background transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                Monitor Customers
              </a>
              <button
                onClick={handleReset}
                className="inline-flex h-10 items-center justify-center rounded-md border border-input bg-background px-8 py-2 text-sm font-medium ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                Onboard Another Company
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
