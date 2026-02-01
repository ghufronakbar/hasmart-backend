import { z } from "zod";

const SellReturnDiscountSchema = z.object({
  percentage: z.number().int().min(0).max(100),
});

const SellReturnItemSchema = z.object({
  masterItemVariantId: z.number().int().positive(),
  qty: z.number().int().positive(),
  sellPrice: z.number().int().min(0),
  discounts: z.array(SellReturnDiscountSchema).optional().default([]),
});

export const SellReturnBodySchema = z.object({
  branchId: z.number().int().positive(),
  transactionDate: z.coerce.date(),
  dueDate: z.coerce.date(),
  memberCode: z.string().min(1, "Member code wajib diisi untuk transaksi B2B"),
  notes: z.string().optional().default(""),
  taxPercentage: z.number().int().min(0).max(100).optional().default(0),
  items: z.array(SellReturnItemSchema).min(1, "Minimal harus ada 1 item"),
  originalInvoiceCode: z.string().min(1, "Nomor invoice original wajib diisi"),
});

export type SellReturnBodyType = z.infer<typeof SellReturnBodySchema>;
export type SellReturnItemType = z.infer<typeof SellReturnItemSchema>;
export type SellReturnDiscountType = z.infer<typeof SellReturnDiscountSchema>;

export const SellReturnParamsSchema = z.object({
  sellReturnId: z.coerce.number(),
});

export type SellReturnParamsType = z.infer<typeof SellReturnParamsSchema>;
