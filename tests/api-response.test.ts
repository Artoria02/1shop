import { describe, it, expect } from "vitest";
import { success, fail, handleApiError } from "../src/lib/api-response";
import { NotFoundError, ValidationError } from "../src/lib/errors";

describe("api-response", () => {
  describe("success()", () => {
    it("should return a JSON response with success: true", async () => {
      const res = success({ id: "1" });
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data).toEqual({ id: "1" });
      expect(res.status).toBe(200);
    });

    it("should allow custom status code", () => {
      const res = success("created", 201);
      expect(res.status).toBe(201);
    });
  });

  describe("fail()", () => {
    it("should return a JSON response with success: false", async () => {
      const res = fail("Something broke");
      const body = await res.json();
      expect(body.success).toBe(false);
      expect(body.error.message).toBe("Something broke");
      expect(body.error.code).toBe("INTERNAL_ERROR");
      expect(res.status).toBe(500);
    });

    it("should pass through code, status, and details", async () => {
      const res = fail("Bad input", "VALIDATION_ERROR", 422, { email: "required" });
      const body = await res.json();
      expect(body.error.code).toBe("VALIDATION_ERROR");
      expect(body.error.details).toEqual({ email: "required" });
      expect(res.status).toBe(422);
    });
  });

  describe("handleApiError()", () => {
    it("should handle AppError subclasses", async () => {
      const res = handleApiError(new NotFoundError("User"));
      const body = await res.json();
      expect(body.error.code).toBe("NOT_FOUND");
      expect(res.status).toBe(404);
    });

    it("should handle plain Error", async () => {
      const res = handleApiError(new Error("plain error"));
      const body = await res.json();
      expect(body.error.code).toBe("INTERNAL_ERROR");
      expect(res.status).toBe(500);
    });

    it("should handle unknown error", () => {
      const res = handleApiError("string error");
      expect(res.status).toBe(500);
    });
  });
});
