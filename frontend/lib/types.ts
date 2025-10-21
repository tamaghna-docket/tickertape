/**
 * TypeScript types matching the FastAPI backend models
 */

export type JobStatus = "pending" | "running" | "completed" | "failed";

export interface OnboardRequest {
  company_name: string;
  website: string;
  deep_research?: boolean;
}

export interface MonitorRequest {
  saas_client_name: string;
  customer_age_days?: number;
}

export interface JobResponse {
  job_id: string;
  status: JobStatus;
  message: string;
}

export interface JobStatusResponse {
  job_id: string;
  status: JobStatus;
  progress: number;
  current_step: string | null;
  error: string | null;
}

export interface OnboardResult {
  job_id: string;
  status: JobStatus;
  company_name: string;
  customers_discovered: number;
  enterprise_customers: number;
  products_found: number;
  pricing_tiers_found: number;
  icps_found: number;
  personas_found: number;
  completed_at: string | null;
}

export interface SignalSummary {
  ticker: string;
  company_name: string;
  signal_type: string;
  signal_summary?: string;  // Summary of the signal to differentiate multiples
  filing_date?: string;      // Filing date for the signal
  opportunity_type: string;
  urgency_score: number;
  estimated_value: string;
  generated_at: string;
}

export interface MonitorResult {
  job_id: string;
  status: JobStatus;
  saas_client: string;
  signals_found: number;
  signals: SignalSummary[];
  completed_at: string | null;
}

// WebSocket message types
export type WSMessageType =
  | "status"
  | "progress"
  | "stage_start"
  | "stage_complete"
  | "error"
  | "ping";

export interface WSBaseMessage {
  type: WSMessageType;
  timestamp?: string;
}

export interface WSStatusMessage extends WSBaseMessage {
  type: "status";
  job_id?: string;
  status: JobStatus;
  progress?: number;
  current_step?: string | null;
  message?: string;
  result_summary?: any;
}

export interface WSProgressMessage extends WSBaseMessage {
  type: "progress";
  stage: string;
  task: string;
  status: "started" | "completed" | "failed";
  progress: number;
  completed: number;
  total: number;
  failed: number;
  error?: string;
  metadata?: Record<string, any>;
}

export interface WSStageMessage extends WSBaseMessage {
  type: "stage_start" | "stage_complete";
  stage: string;
  message: string;
}

export interface WSErrorMessage extends WSBaseMessage {
  type: "error";
  error: string;
}

export interface WSPingMessage extends WSBaseMessage {
  type: "ping";
}

export type WSMessage =
  | WSStatusMessage
  | WSProgressMessage
  | WSStageMessage
  | WSErrorMessage
  | WSPingMessage;

// Task state for UI
export interface TaskState {
  name: string;
  status: "pending" | "started" | "completed" | "failed";
  stage: string;
  error?: string;
}
