/**
 * WebSocket hook for real-time progress updates
 */

import { useEffect, useState, useCallback, useRef } from "react";
import { api } from "@/lib/api";
import type { WSMessage, TaskState, JobStatus } from "@/lib/types";

interface UseWebSocketResult {
  messages: WSMessage[];
  tasks: TaskState[];
  progress: number;
  status: JobStatus | null;
  currentStep: string | null;
  error: string | null;
  connectionState: "connecting" | "connected" | "disconnected" | "error";
  reconnect: () => void;
}

export function useWebSocket(jobId: string | null): UseWebSocketResult {
  const [messages, setMessages] = useState<WSMessage[]>([]);
  const [tasks, setTasks] = useState<TaskState[]>([]);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<JobStatus | null>(null);
  const [currentStep, setCurrentStep] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connectionState, setConnectionState] = useState<
    "connecting" | "connected" | "disconnected" | "error"
  >("disconnected");

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const connect = useCallback(() => {
    if (!jobId) return;

    try {
      const wsURL = api.getWebSocketURL(jobId);
      setConnectionState("connecting");

      const ws = new WebSocket(wsURL);

      ws.onopen = () => {
        console.log(`WebSocket connected for job ${jobId}`);
        setConnectionState("connected");
        setError(null);
      };

      ws.onmessage = (event) => {
        try {
          const message: WSMessage = JSON.parse(event.data);
          setMessages((prev) => [...prev, message]);

          // Handle different message types
          switch (message.type) {
            case "status":
              if (message.status) setStatus(message.status);
              if (message.progress !== undefined) setProgress(message.progress);
              if (message.current_step) setCurrentStep(message.current_step);
              break;

            case "progress":
              setProgress(message.progress);
              setCurrentStep(`${message.stage}: ${message.task}`);

              // Update tasks list
              setTasks((prev) => {
                const existingIndex = prev.findIndex(
                  (t) => t.name === message.task && t.stage === message.stage
                );

                const newTask: TaskState = {
                  name: message.task,
                  status: message.status,
                  stage: message.stage,
                  error: message.error,
                };

                if (existingIndex >= 0) {
                  const updated = [...prev];
                  updated[existingIndex] = newTask;
                  return updated;
                } else {
                  return [...prev, newTask];
                }
              });
              break;

            case "error":
              setError(message.error);
              setConnectionState("error");
              break;

            case "ping":
              // Just keepalive, no action needed
              break;
          }
        } catch (err) {
          console.error("Failed to parse WebSocket message:", err);
        }
      };

      ws.onerror = (event) => {
        console.error("WebSocket error:", event);
        setConnectionState("error");
        setError("WebSocket connection error");
      };

      ws.onclose = () => {
        console.log("WebSocket closed");
        setConnectionState("disconnected");

        // Auto-reconnect if job is still running
        if (status === "running" || status === "pending") {
          reconnectTimeoutRef.current = setTimeout(() => {
            console.log("Attempting to reconnect...");
            connect();
          }, 3000);
        }
      };

      wsRef.current = ws;
    } catch (err) {
      console.error("Failed to create WebSocket:", err);
      setConnectionState("error");
      setError("Failed to establish WebSocket connection");
    }
  }, [jobId, status]);

  const reconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
    }
    connect();
  }, [connect]);

  useEffect(() => {
    if (jobId) {
      connect();
    }

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [jobId, connect]);

  return {
    messages,
    tasks,
    progress,
    status,
    currentStep,
    error,
    connectionState,
    reconnect,
  };
}
