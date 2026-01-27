import { z } from "zod";

const SellDiscountSchema = z.object({
  percentage: z.number().int().min(0).max(100),
});

const SellItemSchema = z.object({
  masterItemId: z.number().int().positive(),
  masterItemVariantId: z.number().int().positive(),
  qty: z.number().int().positive(),
  sellPrice: z.number().int().min(0),
  discounts: z.array(SellDiscountSchema).optional().default([]),
});

export const SellBodySchema = z.object({
  branchId: z.number().int().positive(),
  transactionDate: z.coerce.date(),
  dueDate: z.coerce.date(),
  memberCode: z.string().min(1, "Member code wajib diisi untuk transaksi B2B"),
  notes: z.string().optional().default(""),
  taxPercentage: z.number().int().min(0).max(100).optional().default(0),
  items: z.array(SellItemSchema).min(1, "Minimal harus ada 1 item"),
});

export type SellBodyType = z.infer<typeof SellBodySchema>;
export type SellItemType = z.infer<typeof SellItemSchema>;
export type SellDiscountType = z.infer<typeof SellDiscountSchema>;

export const SellParamsSchema = z.object({
  sellId: z.coerce.number(),
});

export type SellParamsType = z.infer<typeof SellParamsSchema>;
