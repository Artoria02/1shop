import { describe, it, expect } from "vitest";
import { loginSchema } from "../src/server/validations/auth.validation";

describe("auth validation", () => {
  describe("loginSchema", () => {
    it("should accept valid email and password", () => {
      const result = loginSchema.safeParse({ email: "test@example.com", password: "123456" });
      expect(result.success).toBe(true);
    });

    it("should reject invalid email", () => {
      const result = loginSchema.safeParse({ email: "not-an-email", password: "123456" });
      expect(result.success).toBe(false);
    });

    it("should reject empty password", () => {
      const result = loginSchema.safeParse({ email: "test@example.com", password: "" });
      expect(result.success).toBe(false);
    });

    it("should reject missing fields", () => {
      const result = loginSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });
});
