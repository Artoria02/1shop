import { NextResponse } from "next/server";
import { AppError } from "@/lib/errors";

export interface ApiSuccess<T> {
  success: true;
  data: T;
}

export interface ApiError {
  success: false;
  error: {
    message: string;
    code: string;
    details?: unknown;
  };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

export function success<T>(data: T, status = 200): NextResponse<ApiSuccess<T>> {
  return NextResponse.json({ success: true, data }, { status });
}

export function fail(message: string, code = "INTERNAL_ERROR", status = 500, details?: unknown): NextResponse<ApiError> {
  return NextResponse.json(
    { success: false, error: { message, code, ...(details !== undefined ? { details } : {}) } },
    { status }
  );
}

export function handleApiError(error: unknown): NextResponse<ApiError> {
  if (error instanceof AppError) {
    return fail(error.message, error.code, error.statusCode, error.details);
  }
  if (error instanceof Error) {
    return fail(error.message, "INTERNAL_ERROR", 500);
  }
  return fail("Unknown error", "INTERNAL_ERROR", 500);
}