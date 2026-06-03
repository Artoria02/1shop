import { logger } from "@/lib/logger";

export type RequestLogEntry = {
  method: string;
  path: string;
  statusCode: number;
  durationMs: number;
  userAgent?: string;
  ip?: string;
  userId?: string;
};

export function logRequest(entry: RequestLogEntry): void {
  const level = entry.statusCode >= 500 ? "error" : entry.statusCode >= 400 ? "warn" : "info";
  const meta: Record<string, string> = {
    method: entry.method,
    path: entry.path,
    status: String(entry.statusCode),
    duration: entry.durationMs + "ms"
  };
  if (entry.userId) {
    meta.userId = entry.userId;
  }
  logger[level]("HTTP request", meta);
}