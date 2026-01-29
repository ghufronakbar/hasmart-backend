import { z } from "zod";

const PurchaseDiscountSchema = z.object({
  percentage: z.number().int().min(0).max(100),
});

const PurchaseItemSchema = z.object({
  masterItemId: z.number().int().positive(),
  masterItemVariantId: z.number().int().positive(),
  qty: z.number().int().positive(),
  purchasePrice: z.number().int().min(0),
  discounts: z.array(PurchaseDiscountSchema).optional().default([]),
});

export const PurchaseBodySchema = z.object({
  invoiceNumber: z.string().min(1),
  transactionDate: z.coerce.date(),
  dueDate: z.coerce.date(),
  masterSupplierId: z.number().int().positive(),
  branchId: z.number().int().positive(),
  notes: z.string().optional().default(""),
  taxPercentage: z.number().int().min(0).max(100).default(0),
  items: z.array(PurchaseItemSchema).min(1, "Minimal harus ada 1 item"),
});

export type PurchaseBodyType = z.infer<typeof PurchaseBodySchema>;
export type PurchaseItemType = z.infer<typeof PurchaseItemSchema>;
export type PurchaseDiscountType = z.infer<typeof PurchaseDiscountSchema>;

export const PurchaseParamsSchema = z.object({
  purchaseId: z.coerce.number(),
});

export type PurchaseParamsType = z.infer<typeof PurchaseParamsSchema>;
