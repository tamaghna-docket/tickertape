import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(dateString: string | null): string {
  if (!dateString) return "N/A";

  try {
    const date = new Date(dateString);
    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateString;
  }
}

export function formatPercentage(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export function getUrgencyColor(score: number): string {
  if (score >= 0.8) return "text-red-600";
  if (score >= 0.6) return "text-orange-600";
  if (score >= 0.4) return "text-yellow-600";
  return "text-green-600";
}

export function getUrgencyLabel(score: number): string {
  if (score >= 0.8) return "🔥 HIGH";
  if (score >= 0.6) return "⭐ MEDIUM";
  return "📌 LOW";
}
