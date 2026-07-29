import { z } from "zod";

export const callbackSchema = z.object({
  idempotencyKey: z.string().min(1),
  transactionId: z.string().min(1),
  sign: z.string().optional(),
});

export const mockPaySchema = z.object({
  paymentId: z.string().min(1),
});

export type CallbackInput = z.infer<typeof callbackSchema>;
