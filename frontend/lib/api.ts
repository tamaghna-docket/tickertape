/**
 * API client for Customer Intelligence Platform backend
 */

import type {
  OnboardRequest,
  MonitorRequest,
  JobResponse,
  JobStatusResponse,
  OnboardResult,
  MonitorResult,
} from "./types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

class APIClient {
  private baseURL: string;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
  }

  private async request<T>(
    endpoint: string,
    options?: RequestInit
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({
        detail: response.statusText,
      }));
      throw new Error(error.detail || `HTTP ${response.status}`);
    }

    return response.json();
  }

  // Onboarding endpoints
  async onboardCompany(data: OnboardRequest): Promise<JobResponse> {
    return this.request<JobResponse>("/api/onboard", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async getOnboardStatus(jobId: string): Promise<JobStatusResponse> {
    return this.request<JobStatusResponse>(`/api/onboard/${jobId}/status`);
  }

  async getOnboardResult(jobId: string): Promise<OnboardResult> {
    return this.request<OnboardResult>(`/api/onboard/${jobId}/result`);
  }

  // Monitoring endpoints
  async monitorCustomers(data: MonitorRequest): Promise<JobResponse> {
    return this.request<JobResponse>("/api/monitor", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async getMonitorStatus(jobId: string): Promise<JobStatusResponse> {
    return this.request<JobStatusResponse>(`/api/monitor/${jobId}/status`);
  }

  async getMonitorSignals(jobId: string): Promise<MonitorResult> {
    return this.request<MonitorResult>(`/api/monitor/${jobId}/signals`);
  }

  // Get signals directly from database (no job_id needed)
  async getSignalsFromDB(saasClientName: string): Promise<{
    saas_client: string;
    signals_found: number;
    signals: Array<{
      ticker: string;
      company_name: string;
      signal_type: string;
      opportunity_type: string;
      urgency_score: number;
      estimated_value: string;
      generated_at: string;
    }>;
  }> {
    return this.request(`/api/signals/${saasClientName}`);
  }

  // Get full intelligence report for a specific ticker and SaaS client
  async getIntelligenceReport(ticker: string, saasClientName: string): Promise<any> {
    return this.request(`/api/intelligence/${ticker}/${saasClientName}`);
  }

  // WebSocket URL helper
  getWebSocketURL(jobId: string): string {
    const wsProtocol = this.baseURL.startsWith("https") ? "wss" : "ws";
    const wsBase = this.baseURL.replace(/^https?/, wsProtocol);
    return `${wsBase}/ws/progress/${jobId}`;
  }
}

export const api = new APIClient(API_BASE_URL);
