import { z } from "zod";
import { ClaimError } from "./claim-management";

export const documentId = z.string().min(1).max(1500).regex(/^[^/\u0000-\u001f]+$/)
  .refine(id => id !== "." && id !== ".." && !/^__.*__$/.test(id) && new TextEncoder().encode(id).length <= 1500);
const claimInput = z.object({
  projectId: documentId,
  portionId: documentId.optional(),
  scope: z.string().optional(),
  scopeId: z.string().optional().nullable(),
  claimerName: z.string().trim().min(1).max(100),
  idToken: z.string().optional().nullable(),
  claimerEmail: z.string().trim().max(320).optional().nullable(),
  locale: z.enum(["en", "he", "es", "fr"]).optional(),
  duration: z.enum(["oneTime", "daily", "weekly", "indefinite", "untilDate"]).optional(),
  durationValue: z.number().int().positive().max(36500).optional().nullable(),
  durationEndDate: z.number().int().positive().max(8640000000000000).optional().nullable(),
  specificItem: z.string().max(500).optional().nullable(),
  reminderPreferences: z.array(z.enum(["confirmation", "halfway", "sevenDays", "threeDays", "oneDay", "daily", "weeklyDigest"])).max(7).optional(),
}).passthrough();

export function parseClaimInput(value: unknown) {
  const parsed = claimInput.safeParse(value);
  if (!parsed.success) throw new ClaimError(400, "Invalid commitment details");
  return parsed.data;
}
