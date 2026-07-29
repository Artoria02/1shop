import { z } from "zod";

export const createShipmentSchema = z.object({
  subOrderId: z.string().min(1),
  carrier: z.string().min(1, "Carrier is required"),
  trackingNo: z.string().min(1, "Tracking number is required"),
});

export type CreateShipmentInput = z.infer<typeof createShipmentSchema>;
