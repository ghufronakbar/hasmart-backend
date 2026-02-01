import { z } from "zod";

// Item Validators
export const ItemBodySchema = z.object({
  name: z.string().min(1),
  masterSupplierId: z.number().int().positive(),
  masterItemCategoryId: z.number().int().positive(),
  isActive: z.boolean().default(true),
  masterItemVariants: z
    .array(
      z.object({
        code: z.string().min(1),
        unit: z.string().min(1),
        amount: z.number().int().positive(),
        sellPrice: z.number().int().min(0),
        isBaseUnit: z.boolean(),
      }),
    )
    .min(1, "Minimal harus ada 1 variant"),
});

export type ItemBodyType = z.infer<typeof ItemBodySchema>;

export const ItemUpdateBodySchema = z.object({
  name: z.string().min(1),
  masterSupplierId: z.number().int().positive(),
  masterItemCategoryId: z.number().int().positive(),
  isActive: z.boolean(),
});

export type ItemUpdateBodyType = z.infer<typeof ItemUpdateBodySchema>;

export const ItemParamsSchema = z.object({
  masterItemId: z.coerce.number(),
});

export type ItemParamsType = z.infer<typeof ItemParamsSchema>;

// Variant Validators
export const VariantBodySchema = z.object({
  code: z.string().min(1),
  unit: z.string().min(1),
  amount: z.number().int().positive(),
  sellPrice: z.number().int().min(0),
  isBaseUnit: z.boolean(),
});

export type VariantBodyType = z.infer<typeof VariantBodySchema>;

export const VariantParamsSchema = z.object({
  masterItemId: z.coerce.number(),
  masterItemVariantId: z.coerce.number(),
});

export type VariantParamsType = z.infer<typeof VariantParamsSchema>;

export const GetVariantParamsSchema = z.object({
  masterItemCode: z.string().min(1),
});

export type GetVariantParamsType = z.infer<typeof GetVariantParamsSchema>;
