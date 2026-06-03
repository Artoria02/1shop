import { describe, it, expect } from "vitest";
import {
  AppError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
  ConflictError
} from "../src/lib/errors";

describe("AppError", () => {
  it("should store message, statusCode, and code", () => {
    const err = new AppError("test", 400, "BAD_REQUEST");
    expect(err.message).toBe("test");
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe("BAD_REQUEST");
    expect(err.name).toBe("AppError");
  });

  it("should default to 500 status and INTERNAL_ERROR code", () => {
    const err = new AppError("oops");
    expect(err.statusCode).toBe(500);
    expect(err.code).toBe("INTERNAL_ERROR");
  });
});

describe("UnauthorizedError", () => {
  it("should have status 401 and code UNAUTHORIZED", () => {
    const err = new UnauthorizedError();
    expect(err.statusCode).toBe(401);
    expect(err.code).toBe("UNAUTHORIZED");
  });

  it("should accept custom message", () => {
    const err = new UnauthorizedError("No access");
    expect(err.message).toBe("No access");
  });
});

describe("ForbiddenError", () => {
  it("should have status 403 and code FORBIDDEN", () => {
    const err = new ForbiddenError();
    expect(err.statusCode).toBe(403);
    expect(err.code).toBe("FORBIDDEN");
  });
});

describe("NotFoundError", () => {
  it("should include resource name in message", () => {
    const err = new NotFoundError("User");
    expect(err.message).toContain("User");
    expect(err.statusCode).toBe(404);
    expect(err.code).toBe("NOT_FOUND");
  });
});

describe("ValidationError", () => {
  it("should have status 422 and store details", () => {
    const err = new ValidationError("Invalid input", { field: "email" });
    expect(err.statusCode).toBe(422);
    expect(err.code).toBe("VALIDATION_ERROR");
    expect(err.details).toEqual({ field: "email" });
  });
});

describe("ConflictError", () => {
  it("should have status 409 and code CONFLICT", () => {
    const err = new ConflictError("Already exists");
    expect(err.statusCode).toBe(409);
    expect(err.code).toBe("CONFLICT");
  });
});
