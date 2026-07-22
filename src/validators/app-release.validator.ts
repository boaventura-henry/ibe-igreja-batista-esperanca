import { z } from "zod";
import { isSemanticVersion } from "@/lib/semantic-version";

export const releaseSeenSchema = z.object({
  version: z.string().max(32).refine(isSemanticVersion, "Versao invalida.")
}).strict();
