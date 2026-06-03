import { createHash } from "crypto";

export type IdempotencyStatus = "pending" | "completed" | "failed";

interface IdempotencyRecord {
  key: string;
  status: IdempotencyStatus;
  result?: unknown;
  createdAt: Date;
}

const store = new Map<string, IdempotencyRecord>();

export function generateIdempotencyKey(...parts: string[]): string {
  const raw = parts.join(":");
  return createHash("sha256").update(raw).digest("hex").slice(0, 32);
}

export function getCachedResult(key: string): IdempotencyRecord | undefined {
  return store.get(key);
}

export function setCachedResult(
  key: string,
  status: IdempotencyStatus,
  result?: unknown
): void {
  store.set(key, {
    key,
    status,
    result,
    createdAt: new Date()
  });
}

export function clearCachedResult(key: string): void {
  store.delete(key);
}

export { store as _idempotencyStoreForTesting };