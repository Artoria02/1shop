import { z } from "zod";

export const createUserSchema = z.object({
  email: z.string().email("Invalid email address").optional(),
  phone: z.string().regex(/^\+\d{1,3}\d{4,14}$/, "Invalid phone number").optional(),
  password: z.string().min(6, "Password must be at least 6 characters"),
  displayName: z.string().min(1, "Display name is required").optional(),
  kind: z.enum(["BUYER", "MERCHANT_STAFF", "PLATFORM_ADMIN"]).optional()
});

export type CreateUserInput = z.infer<typeof createUserSchema>;