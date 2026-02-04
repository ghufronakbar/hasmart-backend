// hasmart-backend/src/modules/report/report/report.validator.ts
import { z } from "zod";

export const ReportQueryFilterSchema = z.object({
  exportAs: z.enum(["pdf", "xlsx"]),
});

export type ReportQueryFilterType = z.infer<typeof ReportQueryFilterSchema>;
