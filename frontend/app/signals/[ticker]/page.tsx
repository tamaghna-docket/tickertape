"use client";

import { useState, useEffect } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/utils";

export default function SignalDetailsPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const ticker = params?.ticker as string;
  const saasClient = searchParams?.get("client") || "";
  const signalType = searchParams?.get("signalType") || "";

  // Build back URL with preserved filters
  const backToMonitorUrl = () => {
    const params = new URLSearchParams();
    params.set("company", saasClient);

    // Preserve filter params from URL if they exist
    const search = searchParams?.get("search");
    const urgency = searchParams?.get("urgency");
    const types = searchParams?.get("types");
    const sort = searchParams?.get("sort");

    if (search) params.set("search", search);
    if (urgency) params.set("urgency", urgency);
    if (types) params.set("types", types);
    if (sort) params.set("sort", sort);

    return `/monitor?${params.toString()}`;
  };

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [intelligence, setIntelligence] = useState<any>(null);

  useEffect(() => {
    if (ticker && saasClient) {
      loadIntelligence();
    }
  }, [ticker, saasClient, signalType]);

  const loadIntelligence = async () => {
    try {
      setLoading(true);
      const data = await api.getIntelligenceReport(ticker, saasClient, signalType);
      setIntelligence(data);
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load intelligence report"
      );
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="container py-10">
        <div className="mx-auto max-w-4xl">
          <div className="text-center">Loading intelligence report...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container py-10">
        <div className="mx-auto max-w-4xl">
          <div className="rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="text-sm text-red-700">{error}</p>
          </div>
          <a
            href={backToMonitorUrl()}
            className="mt-4 inline-block text-sm text-primary hover:underline"
          >
            ← Back to Monitor
          </a>
        </div>
      </div>
    );
  }

  if (!intelligence) {
    return (
      <div className="container py-10">
        <div className="mx-auto max-w-4xl">
          <p>No intelligence report found</p>
        </div>
      </div>
    );
  }

  const customer = intelligence.enterprise_customer || {};
  const signal = intelligence.signal || {};
  const opportunity = intelligence.opportunity_analysis || {};

  // Extract clean company name and details
  const parseCompanyName = (fullName: string) => {
    // Split by " — " or " - " to separate name from description
    const parts = fullName.split(/\s+[—\-]\s+/);
    const companyPart = parts[0] || fullName;
    const description = parts.slice(1).join(" — ");

    // Extract stock exchange info if present (e.g., "(LSE: CNA)")
    const exchangeMatch = companyPart.match(/\(([^)]+:\s*[^)]+)\)/);
    const exchange = exchangeMatch ? exchangeMatch[1] : null;

    // Clean company name (remove exchange info)
    const cleanName = companyPart.replace(/\s*\([^)]+:\s*[^)]+\)\s*/, "").trim();

    // Extract URLs from description
    const urlMatch = description.match(/\[([^\]]+)\]\(([^)]+)\)/);
    const urlText = urlMatch ? urlMatch[1] : null;
    const url = urlMatch ? urlMatch[2] : null;

    // Clean description (remove markdown links and any remaining empty parentheses)
    const cleanDescription = description
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "")  // Remove markdown links
      .replace(/\(\s*\)/g, "")                   // Remove empty parentheses
      .replace(/\s+/g, " ")                      // Normalize whitespace
      .trim();

    return { cleanName, exchange, description: cleanDescription, urlText, url };
  };

  const companyInfo = customer.company_name
    ? parseCompanyName(customer.company_name)
    : { cleanName: ticker, exchange: null, description: "", urlText: null, url: null };

  return (
    <div className="container py-10">
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Header */}
        <div className="space-y-3">
          <a
            href={backToMonitorUrl()}
            className="inline-block text-sm text-muted-foreground hover:text-primary"
          >
            ← Back to Monitor
          </a>
          <div>
            <h1 className="text-3xl font-bold">
              {companyInfo.cleanName}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="rounded bg-primary/10 px-2.5 py-1 text-sm font-medium text-primary">
                {ticker}
              </span>
              {companyInfo.exchange && (
                <span className="rounded bg-muted px-2.5 py-1 text-sm font-medium text-muted-foreground">
                  {companyInfo.exchange}
                </span>
              )}
              <span className="rounded bg-muted px-2.5 py-1 text-sm font-medium">
                {signal.signal_type?.replace(/_/g, " ") || "N/A"}
              </span>
            </div>
            {companyInfo.description && (
              <p className="mt-3 text-sm text-muted-foreground">
                {companyInfo.description}
              </p>
            )}
            {companyInfo.url && (
              <a
                href={companyInfo.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-2 rounded-md border border-primary bg-primary/5 px-3 py-1.5 text-sm font-medium text-primary transition-colors hover:bg-primary/10"
              >
                <svg className="h-4 w-4" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                  <path d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path>
                </svg>
                {companyInfo.urlText || "View Source"}
              </a>
            )}
          </div>
        </div>

        {/* Signal Summary - Prominent display of what this signal is about */}
        {signal.summary && (
          <div className="rounded-lg border-2 border-primary/20 bg-primary/5 p-6">
            <h2 className="mb-3 text-lg font-semibold text-primary">Signal Summary</h2>
            <p className="text-base leading-relaxed">{signal.summary}</p>
          </div>
        )}

        {/* Opportunity Summary */}
        <div className="rounded-lg border border-border bg-card p-6">
          <h2 className="mb-4 text-xl font-semibold">Opportunity Summary</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-sm text-muted-foreground">Opportunity Type</p>
              <p className="font-medium">{intelligence.opportunity_type || "N/A"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Urgency Score</p>
              <p className="font-medium">
                {intelligence.urgency_score?.toFixed(2) || "N/A"}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Estimated Value</p>
              <p className="font-medium">
                {intelligence.estimated_opportunity_value || "N/A"}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Generated</p>
              <p className="font-medium">
                {formatDate(intelligence.generated_at)}
              </p>
            </div>
          </div>
        </div>

        {/* Signal Details */}
        {signal.filing_details && (
          <div className="rounded-lg border border-border bg-card p-6">
            <h2 className="mb-4 text-xl font-semibold">Signal Details</h2>
            <div className="space-y-3">
              {signal.filing_details.filing_date && (
                <div>
                  <p className="text-sm text-muted-foreground">Filing Date</p>
                  <p className="font-medium">{signal.filing_details.filing_date}</p>
                </div>
              )}
              {signal.filing_details.headline && (
                <div>
                  <p className="text-sm text-muted-foreground">Headline</p>
                  <p className="font-medium">{signal.filing_details.headline}</p>
                </div>
              )}
              {signal.filing_details.description && (
                <div>
                  <p className="text-sm text-muted-foreground">Description</p>
                  <p className="whitespace-pre-wrap text-sm">
                    {signal.filing_details.description}
                  </p>
                </div>
              )}
              {signal.filing_details.url && (
                <div>
                  <a
                    href={signal.filing_details.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary hover:underline"
                  >
                    View SEC Filing →
                  </a>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Signal Implications & Impact */}
        {(intelligence.signal_implications || intelligence.relationship_impact) && (
          <div className="rounded-lg border border-border bg-card p-6">
            <h2 className="mb-4 text-xl font-semibold">Strategic Analysis</h2>
            <div className="space-y-4">
              {intelligence.signal_implications && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Signal Implications
                  </p>
                  <p className="mt-1 text-sm">{intelligence.signal_implications}</p>
                </div>
              )}
              {intelligence.relationship_impact && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Relationship Impact
                  </p>
                  <p className="mt-1 text-sm">{intelligence.relationship_impact}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Recommended Action */}
        {intelligence.recommended_action && (
          <div className="rounded-lg border border-green-200 bg-green-50 p-6">
            <h2 className="mb-3 text-xl font-semibold text-green-900">
              Recommended Action
            </h2>
            <p className="text-sm text-green-800">
              {intelligence.recommended_action}
            </p>
          </div>
        )}

        {/* Suggested Products & Pricing */}
        <div className="grid gap-6 md:grid-cols-2">
          {intelligence.suggested_products &&
            intelligence.suggested_products.length > 0 && (
              <div className="rounded-lg border border-border bg-card p-6">
                <h3 className="mb-3 font-semibold">Suggested Products</h3>
                <ul className="space-y-2">
                  {intelligence.suggested_products.map((product: string, idx: number) => (
                    <li key={idx} className="flex items-center gap-2">
                      <span className="text-xs text-primary">✓</span>
                      <span className="text-sm">{product}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

          {intelligence.relevant_pricing_tiers &&
            intelligence.relevant_pricing_tiers.length > 0 && (
              <div className="rounded-lg border border-border bg-card p-6">
                <h3 className="mb-3 font-semibold">Recommended Pricing Tiers</h3>
                <ul className="space-y-2">
                  {intelligence.relevant_pricing_tiers.map((tier: string, idx: number) => (
                    <li key={idx} className="flex items-center gap-2">
                      <span className="text-xs text-primary">💰</span>
                      <span className="text-sm">{tier}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
        </div>

        {/* Persona Insights - This is the GOLD */}
        {intelligence.persona_insights &&
          intelligence.persona_insights.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-2xl font-bold">GTM Persona Playbooks</h2>
              {intelligence.persona_insights.map((persona: any, idx: number) => (
                <div
                  key={idx}
                  className="rounded-lg border-2 border-primary/20 bg-card p-6"
                >
                  <div className="mb-4 flex items-start justify-between">
                    <div>
                      <h3 className="text-lg font-semibold">
                        {persona.persona_role}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Relevance Score: {(persona.relevance_score * 100).toFixed(0)}%
                      </p>
                    </div>
                    <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                      {persona.relevance_score >= 0.8 ? "HIGH" : persona.relevance_score >= 0.6 ? "MEDIUM" : "LOW"} PRIORITY
                    </span>
                  </div>

                  {/* Why This Matters */}
                  <div className="mb-4 rounded-lg bg-muted/50 p-4">
                    <p className="text-sm font-medium text-muted-foreground">
                      Why This Matters
                    </p>
                    <p className="mt-1 text-sm">{persona.why_this_matters}</p>
                  </div>

                  {/* Talking Points */}
                  {persona.specific_talking_points &&
                    persona.specific_talking_points.length > 0 && (
                      <div className="mb-4">
                        <p className="mb-2 text-sm font-medium">
                          Specific Talking Points
                        </p>
                        <ul className="space-y-2">
                          {persona.specific_talking_points.map(
                            (point: string, pidx: number) => (
                              <li key={pidx} className="flex gap-2">
                                <span className="text-primary">→</span>
                                <span className="text-sm">{point}</span>
                              </li>
                            )
                          )}
                        </ul>
                      </div>
                    )}

                  {/* Suggested Approach */}
                  {persona.suggested_approach && (
                    <div className="mb-4">
                      <p className="mb-2 text-sm font-medium">Suggested Approach</p>
                      <p className="text-sm text-muted-foreground">
                        {persona.suggested_approach}
                      </p>
                    </div>
                  )}

                  {/* Recommended Products & Metrics */}
                  <div className="grid gap-4 md:grid-cols-2">
                    {persona.recommended_products &&
                      persona.recommended_products.length > 0 && (
                        <div>
                          <p className="mb-2 text-sm font-medium">
                            Recommended Products
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {persona.recommended_products.map(
                              (product: string, pidx: number) => (
                                <span
                                  key={pidx}
                                  className="rounded bg-primary/10 px-2 py-1 text-xs"
                                >
                                  {product}
                                </span>
                              )
                            )}
                          </div>
                        </div>
                      )}

                    {persona.key_metrics_to_highlight &&
                      persona.key_metrics_to_highlight.length > 0 && (
                        <div>
                          <p className="mb-2 text-sm font-medium">
                            Key Metrics to Highlight
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {persona.key_metrics_to_highlight.map(
                              (metric: string, midx: number) => (
                                <span
                                  key={midx}
                                  className="rounded bg-green-100 px-2 py-1 text-xs text-green-800"
                                >
                                  {metric}
                                </span>
                              )
                            )}
                          </div>
                        </div>
                      )}
                  </div>
                </div>
              ))}
            </div>
          )}

        {/* Suggested Email Template */}
        {intelligence.suggested_email && (
          <div className="rounded-lg border border-border bg-card p-6">
            <h2 className="mb-4 text-xl font-semibold">Ready-to-Send Email</h2>
            <div className="rounded bg-muted p-4 font-mono text-sm">
              <pre className="whitespace-pre-wrap">{intelligence.suggested_email}</pre>
            </div>
            <button
              onClick={() => {
                navigator.clipboard.writeText(intelligence.suggested_email);
                alert("Email template copied to clipboard!");
              }}
              className="mt-4 inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Copy to Clipboard
            </button>
          </div>
        )}

        {/* General Talking Points */}
        {intelligence.talking_points &&
          intelligence.talking_points.length > 0 && (
            <div className="rounded-lg border border-border bg-card p-6">
              <h2 className="mb-4 text-xl font-semibold">General Talking Points</h2>
              <ul className="space-y-2">
                {intelligence.talking_points.map((point: string, idx: number) => (
                  <li key={idx} className="flex gap-2">
                    <span className="text-primary">•</span>
                    <span className="text-sm">{point}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

        {/* Raw Data (for debugging) */}
        <details className="rounded-lg border border-border bg-card p-6">
          <summary className="cursor-pointer text-sm font-medium text-muted-foreground">
            View Raw Data
          </summary>
          <pre className="mt-4 overflow-auto rounded bg-muted p-4 text-xs">
            {JSON.stringify(intelligence, null, 2)}
          </pre>
        </details>
      </div>
    </div>
  );
}
