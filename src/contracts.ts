import { z } from "zod";

export const PROTOCOL_VERSION = "2026-08-22.plugin.v2" as const;

export const provenanceSchema = z.enum(["official_api", "local_artifact"]);
export type Provenance = z.infer<typeof provenanceSchema>;

export const artifactKindSchema = z.enum([
  "brand_wiki", "question_set", "collection_dataset", "baseline_analysis",
  "retest_analysis", "deliverable", "other",
]);
export type ArtifactKind = z.infer<typeof artifactKindSchema>;

export const artifactSchema = z.object({
  id: z.string(), name: z.string(), relativePath: z.string(), kind: artifactKindSchema,
  mediaType: z.enum(["text/markdown", "application/json", "text/csv", "text/html"]),
  bytes: z.number().int().nonnegative(), sha256: z.string(), provenance: provenanceSchema,
  createdAt: z.string().datetime(),
});
export type Artifact = z.infer<typeof artifactSchema>;

export const activitySchema = z.object({
  id: z.string(), type: z.enum(["collection", "artifact", "confirmation", "account", "system"]),
  title: z.string(), detail: z.string(), status: z.enum(["info", "waiting", "success", "warning", "error"]),
  occurredAt: z.string().datetime(),
});
export type Activity = z.infer<typeof activitySchema>;

export const collectionStateSchema = z.object({
  status: z.enum(["blocked", "ready", "waiting_user", "queued", "running", "partial_failed", "failed", "cancelled", "completed"]),
  questionSetId: z.string().nullable(), jobId: z.string().nullable(), receiptId: z.string().nullable(),
  provenance: z.enum(["official_api", "unavailable"]), nextAction: z.string(), updatedAt: z.string().datetime(),
});

export const projectStateSchema = z.object({
  schemaVersion: z.literal(2), protocolVersion: z.literal(PROTOCOL_VERSION), revision: z.number().int().nonnegative(),
  project: z.object({ localRootName: z.string(), cloudId: z.string().nullable(), cloudName: z.string().nullable() }),
  organization: z.object({ id: z.string(), name: z.string() }).nullable(),
  brand: z.object({
    id: z.string().nullable(), name: z.string().nullable(),
    wiki: z.object({ status: z.enum(["missing", "draft", "ready"]), root: z.literal("brand-wiki"), entryCount: z.number().int().nonnegative(), evidenceCount: z.number().int().nonnegative() }),
  }),
  credit: z.object({ available: z.number().nonnegative(), reserved: z.number().nonnegative(), currency: z.literal("CREDIT"), authoritative: z.boolean() }),
  task: z.object({ title: z.string(), budget: z.number().nonnegative(), estimatedCost: z.number().nonnegative() }),
  collection: collectionStateSchema, artifacts: z.array(artifactSchema), activity: z.array(activitySchema), updatedAt: z.string().datetime(),
});
export type ProjectState = z.infer<typeof projectStateSchema>;

export const cloudProjectSelectionSchema = z.object({
  organizationId: z.string().min(1), projectId: z.string().min(1), taskBudget: z.number().int().nonnegative().max(100_000),
});
export type CloudProjectSelection = z.infer<typeof cloudProjectSelectionSchema>;

export const confirmationTicketSchema = z.object({
  id: z.string(), operation: z.enum(["freeze_question_set", "start_capture", "register_artifact"]), summary: z.string(),
  estimatedCredit: z.number().nonnegative(), maxCredit: z.number().nonnegative(), expiresAt: z.string().datetime(), inputDigest: z.string(), expectedRevision: z.number().int().nonnegative(),
});
export type ConfirmationTicket = z.infer<typeof confirmationTicketSchema>;

export const apiErrorSchema = z.object({
  code: z.string(), message: z.string(), retryable: z.boolean(), requestId: z.string(), traceId: z.string().optional(), details: z.record(z.string(), z.unknown()).optional(),
});

export const questionSchema = z.object({
  id: z.string().min(1), text: z.string().trim().min(5).max(240),
  intent: z.enum(["awareness", "consideration", "comparison", "decision", "validation"]),
  persona: z.string().trim().min(1).max(80), questionType: z.enum(["decision", "open", "recommendation", "negative", "comparison"]),
  brandMention: z.enum(["required", "excluded", "natural"]), evidenceTier: z.enum(["A", "B", "C"]),
});
export const questionSetSchema = z.object({
  title: z.string().trim().min(1).max(120), methodVersion: z.literal("geo-question-method-2026-08"), questions: z.array(questionSchema).min(1).max(200),
});
export type QuestionSet = z.infer<typeof questionSetSchema>;

export const platformSchema = z.enum(["doubao", "qwen", "deepseek", "yuanbao", "kimi"]);
export type Platform = z.infer<typeof platformSchema>;
export const collectionRequestSchema = z.object({ questionSetId: z.string().min(1), platforms: z.array(platformSchema).min(1).max(5), maxCredit: z.number().positive().max(100_000) });
export type CollectionRequest = z.infer<typeof collectionRequestSchema>;

export const artifactRegistrationSchema = z.object({ relativePath: z.string().min(1), expectedSha256: z.string().regex(/^[a-f0-9]{64}$/), title: z.string().trim().min(1).max(160) });
export type ArtifactRegistration = z.infer<typeof artifactRegistrationSchema>;
