"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { ProgressDisplay } from "@/components/ProgressDisplay";
import { CustomerTicker } from "@/components/CustomerTicker";
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
  const [showCompanies, setShowCompanies] = useState(false);
  const [companies, setCompanies] = useState<any[]>([]);
  const [loadingCompanies, setLoadingCompanies] = useState(false);

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

  const handleViewCompanies = async () => {
    setShowCompanies(true);
    setLoadingCompanies(true);
    try {
      const data = await api.getAllCompanies();
      setCompanies(data.companies);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load companies");
    } finally {
      setLoadingCompanies(false);
    }
  };

  if (showCompanies) {
    return (
      <div className="py-6 px-6">
        <div className="mx-auto max-w-7xl space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <h1 className="text-3xl font-bold">Onboarded Companies</h1>
              <p className="text-muted-foreground">
                View all companies that have been onboarded to the platform
              </p>
            </div>
            <button
              onClick={() => setShowCompanies(false)}
              className="inline-flex h-10 items-center justify-center rounded-md border border-input bg-background px-6 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              ← Back to Onboarding
            </button>
          </div>

          {loadingCompanies ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">Loading companies...</p>
            </div>
          ) : companies.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-12 text-center">
              <p className="text-muted-foreground">No companies have been onboarded yet</p>
            </div>
          ) : (
            <div className="space-y-6">
              {companies.map((company) => (
                <div key={company.name} className="rounded-lg border border-border bg-card overflow-hidden">
                  {/* Header */}
                  <div className="bg-gradient-to-r from-primary/5 to-primary/10 p-6 border-b border-border">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-2xl font-bold">{company.name}</h3>
                        {company.website && (
                          <a
                            href={`https://${company.website}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-primary hover:underline"
                          >
                            {company.website}
                          </a>
                        )}
                      </div>
                      <a
                        href={`/monitor?company=${encodeURIComponent(company.name)}`}
                        className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                      >
                        Monitor Customers
                      </a>
                    </div>

                    {/* Quick Stats */}
                    <div className="grid grid-cols-3 md:grid-cols-6 gap-4 mt-4">
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Customers</p>
                        <p className="text-xl font-bold">{company.customer_count}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Signals</p>
                        <p className="text-xl font-bold">{company.signal_count}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Products</p>
                        <p className="text-xl font-bold">{company.products_count}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Pricing</p>
                        <p className="text-xl font-bold">{company.pricing_tiers_count}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">ICPs</p>
                        <p className="text-xl font-bold">{company.icps_count}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Personas</p>
                        <p className="text-xl font-bold">{company.personas_count}</p>
                      </div>
                    </div>
                  </div>

                  {/* Detailed Content */}
                  <div className="p-6 space-y-6">
                    {/* Products */}
                    {company.products && company.products.length > 0 && (
                      <div>
                        <h4 className="text-lg font-semibold mb-3">Products</h4>
                        <div className="grid gap-3 md:grid-cols-2">
                          {company.products.map((product: any, idx: number) => (
                            <div key={idx} className="rounded-lg border border-border p-4 space-y-2">
                              <h5 className="font-semibold text-primary">{product.name}</h5>
                              <p className="text-sm text-muted-foreground">{product.description}</p>
                              {product.key_features && product.key_features.length > 0 && (
                                <div className="pt-2">
                                  <p className="text-xs font-medium text-muted-foreground mb-1">Key Features:</p>
                                  <ul className="text-xs space-y-0.5">
                                    {product.key_features.slice(0, 3).map((feature: string, i: number) => (
                                      <li key={i} className="flex items-start gap-1">
                                        <span className="text-primary mt-0.5">•</span>
                                        <span>{feature}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Pricing Tiers */}
                    {company.pricing_tiers && company.pricing_tiers.length > 0 && (
                      <div>
                        <h4 className="text-lg font-semibold mb-3">Pricing Tiers</h4>
                        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                          {company.pricing_tiers.map((tier: any, idx: number) => (
                            <div key={idx} className="rounded-lg border border-border p-4 space-y-2">
                              <h5 className="font-semibold">{tier.name}</h5>
                              <p className="text-sm text-primary font-medium">{tier.price_range}</p>
                              <p className="text-xs text-muted-foreground">{tier.target_segment}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* ICPs */}
                    {company.icps && company.icps.length > 0 && (
                      <div>
                        <h4 className="text-lg font-semibold mb-3">Ideal Customer Profiles</h4>
                        <div className="grid gap-3 md:grid-cols-2">
                          {company.icps.map((icp: any, idx: number) => (
                            <div key={idx} className="rounded-lg border border-border p-4 space-y-2">
                              <h5 className="font-semibold text-primary">{icp.segment_name}</h5>
                              <p className="text-sm text-muted-foreground">{icp.description}</p>
                              {icp.characteristics && icp.characteristics.length > 0 && (
                                <div className="pt-1">
                                  <p className="text-xs font-medium text-muted-foreground mb-1">Characteristics:</p>
                                  <div className="flex flex-wrap gap-1">
                                    {icp.characteristics.slice(0, 3).map((char: string, i: number) => (
                                      <span key={i} className="rounded bg-primary/10 px-2 py-0.5 text-xs">
                                        {char}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* GTM Personas */}
                    {company.personas && company.personas.length > 0 && (
                      <div>
                        <h4 className="text-lg font-semibold mb-3">GTM Personas</h4>
                        <div className="grid gap-3 md:grid-cols-3">
                          {company.personas.map((persona: any, idx: number) => (
                            <div key={idx} className="rounded-lg border border-border p-4 space-y-2">
                              <h5 className="font-semibold text-primary">{persona.role}</h5>
                              <p className="text-sm text-muted-foreground">{persona.description}</p>
                              {persona.pain_points && persona.pain_points.length > 0 && (
                                <div className="pt-1">
                                  <p className="text-xs font-medium text-muted-foreground mb-1">Pain Points:</p>
                                  <ul className="text-xs space-y-0.5">
                                    {persona.pain_points.slice(0, 2).map((pain: string, i: number) => (
                                      <li key={i} className="flex items-start gap-1">
                                        <span className="text-red-500 mt-0.5">→</span>
                                        <span>{pain}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="py-6 px-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold">Onboard New Company</h1>
            <p className="text-muted-foreground">
              Enter a company name and website to automatically research products,
              pricing, customers, and more.
            </p>
          </div>
          <button
            onClick={handleViewCompanies}
            className="inline-flex h-10 items-center justify-center rounded-md border border-primary bg-primary/5 px-6 text-sm font-medium text-primary transition-colors hover:bg-primary/10"
          >
            View Onboarded Companies
          </button>
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
            {/* Customer Ticker - Shows discovered customers */}
            {result.enterprise_customers > 0 && (
              <CustomerTicker saasClientName={result.company_name} />
            )}

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
