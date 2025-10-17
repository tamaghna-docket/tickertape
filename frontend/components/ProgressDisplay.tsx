"use client";

import { useWebSocket } from "@/hooks/useWebSocket";
import { formatPercentage } from "@/lib/utils";
import type { TaskState } from "@/lib/types";

interface ProgressDisplayProps {
  jobId: string;
  title?: string;
}

export function ProgressDisplay({ jobId, title }: ProgressDisplayProps) {
  const {
    tasks,
    progress,
    status,
    currentStep,
    error,
    connectionState,
    reconnect,
  } = useWebSocket(jobId);

  // Group tasks by stage
  const tasksByStage = tasks.reduce((acc, task) => {
    if (!acc[task.stage]) {
      acc[task.stage] = [];
    }
    acc[task.stage].push(task);
    return acc;
  }, {} as Record<string, TaskState[]>);

  const getTaskIcon = (taskStatus: TaskState["status"]) => {
    switch (taskStatus) {
      case "completed":
        return (
          <svg
            className="h-5 w-5 text-green-600"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        );
      case "started":
        return (
          <svg
            className="h-5 w-5 text-blue-600 animate-spin"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
          </svg>
        );
      case "failed":
        return (
          <svg
            className="h-5 w-5 text-red-600"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="15" y1="9" x2="9" y2="15"></line>
            <line x1="9" y1="9" x2="15" y2="15"></line>
          </svg>
        );
      default:
        return (
          <svg
            className="h-5 w-5 text-gray-400"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <circle cx="12" cy="12" r="10"></circle>
          </svg>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        {title && <h2 className="text-2xl font-bold">{title}</h2>}
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Job ID: <code className="rounded bg-muted px-1">{jobId}</code>
          </span>
          <div className="flex items-center gap-2">
            <div
              className={`h-2 w-2 rounded-full ${
                connectionState === "connected"
                  ? "bg-green-500"
                  : connectionState === "connecting"
                  ? "bg-yellow-500 animate-pulse"
                  : "bg-red-500"
              }`}
            />
            <span className="text-muted-foreground capitalize">
              {connectionState}
            </span>
            {connectionState === "disconnected" && (
              <button
                onClick={reconnect}
                className="text-xs text-primary hover:underline"
              >
                Reconnect
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">
            Progress: {formatPercentage(progress)}
          </span>
          {status && (
            <span
              className={`rounded-full px-2 py-1 text-xs font-medium ${
                status === "completed"
                  ? "bg-green-100 text-green-700"
                  : status === "running"
                  ? "bg-blue-100 text-blue-700"
                  : status === "failed"
                  ? "bg-red-100 text-red-700"
                  : "bg-gray-100 text-gray-700"
              }`}
            >
              {status}
            </span>
          )}
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: formatPercentage(progress) }}
          />
        </div>
        {currentStep && (
          <p className="text-sm text-muted-foreground">{currentStep}</p>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <div className="flex items-start gap-2">
            <svg
              className="mt-0.5 h-5 w-5 text-red-600"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            <div className="flex-1">
              <h4 className="font-medium text-red-900">Error</h4>
              <p className="mt-1 text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Tasks by Stage */}
      {Object.keys(tasksByStage).length > 0 && (
        <div className="space-y-4">
          {Object.entries(tasksByStage).map(([stage, stageTasks]) => (
            <div key={stage} className="rounded-lg border border-border p-4">
              <h3 className="mb-3 font-semibold capitalize">
                {stage} Stage:
              </h3>
              <div className="space-y-2">
                {stageTasks.map((task, idx) => (
                  <div
                    key={`${task.stage}-${task.name}-${idx}`}
                    className="flex items-center gap-3"
                  >
                    {getTaskIcon(task.status)}
                    <span className="flex-1 text-sm">
                      {task.name.replace(/_/g, " ")}
                    </span>
                    <span className="text-xs text-muted-foreground capitalize">
                      {task.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {tasks.length === 0 && !error && (
        <div className="rounded-lg border border-dashed border-border p-8 text-center">
          <p className="text-muted-foreground">
            Waiting for progress updates...
          </p>
        </div>
      )}
    </div>
  );
}
