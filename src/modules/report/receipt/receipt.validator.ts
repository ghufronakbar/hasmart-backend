import { z } from "zod";

export const ReceiptParamsSchema = z.object({
  receiptId: z.coerce.number(),
  type: z.enum(["sales", "sell"]),
});

export type ReceiptParamsType = z.infer<typeof ReceiptParamsSchema>;
