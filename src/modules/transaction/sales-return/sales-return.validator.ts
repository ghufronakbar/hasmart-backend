import { z } from "zod";

const SalesReturnDiscountSchema = z.object({
  percentage: z.number().int().min(0).max(100),
});

const SalesReturnItemSchema = z.object({
  masterItemVariantId: z.number().int().positive(),
  qty: z.number().int().positive(),
  salesPrice: z.number().int().min(0),
  discounts: z.array(SalesReturnDiscountSchema).optional().default([]),
});

export const SalesReturnBodySchema = z.object({
  branchId: z.number().int().positive(),
  originalInvoiceNumber: z.string().min(1, "Nomor invoice asli wajib diisi"),
  notes: z.string().optional().default(""),
  items: z.array(SalesReturnItemSchema).min(1, "Minimal harus ada 1 item"),
});

export type SalesReturnBodyType = z.infer<typeof SalesReturnBodySchema>;
export type SalesReturnItemType = z.infer<typeof SalesReturnItemSchema>;
export type SalesReturnDiscountType = z.infer<typeof SalesReturnDiscountSchema>;

export const SalesReturnParamsSchema = z.object({
  salesReturnId: z.coerce.number(),
});

export type SalesReturnParamsType = z.infer<typeof SalesReturnParamsSchema>;
