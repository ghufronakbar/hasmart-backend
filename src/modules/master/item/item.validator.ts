import { ValidationError } from "../../../utils/error";
import { z } from "zod";

// Item Validators
export const ItemBodySchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1),
  masterSupplierId: z.number().int().positive(),
  masterItemCategoryId: z.number().int().positive(),
  isActive: z.boolean().default(true),
  masterItemVariants: z
    .array(
      z.object({
        unit: z.string().min(1),
        amount: z.number().int().positive(),
        sellPrice: z.number().int().min(0),
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

export const ItemQuerySchema = z.object({
  idNotIns: z
    .string()
    .optional()
    .transform((s) => {
      // undefined => undefined
      if (s == null) return undefined;

      const trimmed = s.trim();

      // string kosong => undefined
      if (trimmed === "") return undefined;

      const parts = trimmed.split(",").map((x) => x.trim());

      // token kosong => error (mis: "1,,2" atau "1,2,")
      if (parts.some((p) => p === "")) {
        throw new ValidationError(
          "idNotIns harus berisi angka dengan separator koma",
        );
      }

      // harus integer
      const nums = parts.map((p) => {
        if (!/^-?\d+$/.test(p)) {
          throw new ValidationError(`Invalid number: "${p}"`);
        }
        return Number(p);
      });

      // dedupe + sort (hapus kalau tidak perlu)
      return Array.from(new Set(nums)).sort((a, b) => a - b);
    }),
});

export type ItemQueryType = z.infer<typeof ItemQuerySchema>;

// Variant Validators
export const VariantBodySchema = z.object({
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

export const GetItemByCodeParamsSchema = z.object({
  code: z.string().min(1),
});

export type GetItemByCodeParamsType = z.infer<typeof GetItemByCodeParamsSchema>;
