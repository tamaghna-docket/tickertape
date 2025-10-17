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

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [intelligence, setIntelligence] = useState<any>(null);

  useEffect(() => {
    if (ticker && saasClient) {
      loadIntelligence();
    }
  }, [ticker, saasClient]);

  const loadIntelligence = async () => {
    try {
      setLoading(true);
      const data = await api.getIntelligenceReport(ticker, saasClient);
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
            href="/monitor"
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

  return (
    <div className="container py-10">
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Header */}
        <div className="space-y-2">
          <a
            href="/monitor"
            className="inline-block text-sm text-muted-foreground hover:text-primary"
          >
            ← Back to Monitor
          </a>
          <h1 className="text-3xl font-bold">
            {customer.company_name || ticker}
          </h1>
          <div className="flex items-center gap-3">
            <span className="rounded bg-muted px-2 py-1 text-sm font-medium">
              {ticker}
            </span>
            <span className="text-sm text-muted-foreground">
              {signal.signal_type?.replace(/_/g, " ") || "N/A"}
            </span>
          </div>
        </div>

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

        {/* Opportunity Analysis */}
        {opportunity.analysis && (
          <div className="rounded-lg border border-border bg-card p-6">
            <h2 className="mb-4 text-xl font-semibold">Opportunity Analysis</h2>
            <div className="prose prose-sm max-w-none">
              <p className="whitespace-pre-wrap">{opportunity.analysis}</p>
            </div>
          </div>
        )}

        {/* Talking Points */}
        {intelligence.talking_points &&
          intelligence.talking_points.length > 0 && (
            <div className="rounded-lg border border-border bg-card p-6">
              <h2 className="mb-4 text-xl font-semibold">Talking Points</h2>
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
