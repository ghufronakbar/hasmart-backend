import { z } from "zod";

const SalesDiscountSchema = z.object({
  percentage: z.number().int().min(0).max(100),
});

const SalesItemSchema = z.object({
  masterItemId: z.number().int().positive(),
  masterItemVariantId: z.number().int().positive(),
  qty: z.number().int().positive(),
  discounts: z.array(SalesDiscountSchema).optional().default([]),
});

export const SalesBodySchema = z.object({
  branchId: z.number().int().positive(),
  notes: z.string().optional().default(""),
  memberCode: z.string().optional().nullable(),
  items: z.array(SalesItemSchema).min(1, "Minimal harus ada 1 item"),
});

export type SalesBodyType = z.infer<typeof SalesBodySchema>;
export type SalesItemType = z.infer<typeof SalesItemSchema>;
export type SalesDiscountType = z.infer<typeof SalesDiscountSchema>;

export const SalesParamsSchema = z.object({
  salesId: z.coerce.number(),
});

export type SalesParamsType = z.infer<typeof SalesParamsSchema>;
