import { z } from "zod";

export const PROTOCOL_VERSION = "2026-08-09.plugin.v1" as const;

export const nodeKindSchema = z.enum([
  "question_research",
  "platform_capture",
  "metric_analysis",
  "content_production",
  "distribution_task",
  "same_question_retest",
]);
export type NodeKind = z.infer<typeof nodeKindSchema>;

export const nodeStatusSchema = z.enum([
  "not_selected",
  "blocked",
  "ready",
  "running",
  "waiting_user",
  "partial_failed",
  "failed",
  "cancelled",
  "completed",
]);
export type NodeStatus = z.infer<typeof nodeStatusSchema>;

export const provenanceSchema = z.enum(["official_api", "local_artifact"]);
export type Provenance = z.infer<typeof provenanceSchema>;

export const nodeSchema = z.object({
  kind: nodeKindSchema,
  title: z.string(),
  status: nodeStatusSchema,
  summary: z.string(),
  nextAction: z.string().nullable(),
  artifactCount: z.number().int().nonnegative(),
  updatedAt: z.string().datetime(),
});
export type GeoNode = z.infer<typeof nodeSchema>;

export const knowledgeEntrySchema = z.object({
  id: z.string(),
  title: z.string(),
  category: z.enum(["brand", "audience", "product", "evidence", "competitor"]),
  status: z.enum(["draft", "published", "conflict"]),
  source: z.string(),
  updatedAt: z.string().datetime(),
});
export type KnowledgeEntry = z.infer<typeof knowledgeEntrySchema>;

export const artifactSchema = z.object({
  id: z.string(),
  name: z.string(),
  relativePath: z.string(),
  mediaType: z.enum(["text/markdown", "application/json", "text/csv", "text/html"]),
  bytes: z.number().int().nonnegative(),
  sha256: z.string(),
  provenance: provenanceSchema,
  createdAt: z.string().datetime(),
});
export type Artifact = z.infer<typeof artifactSchema>;

export const activitySchema = z.object({
  id: z.string(),
  type: z.enum(["job", "artifact", "confirmation", "system"]),
  title: z.string(),
  detail: z.string(),
  status: z.enum(["info", "waiting", "success", "warning", "error"]),
  occurredAt: z.string().datetime(),
});
export type Activity = z.infer<typeof activitySchema>;

export const projectStateSchema = z.object({
  schemaVersion: z.literal(1),
  protocolVersion: z.literal(PROTOCOL_VERSION),
  revision: z.number().int().nonnegative(),
  mode: z.literal("cloud"),
  project: z.object({
    id: z.string(),
    name: z.string(),
    rootName: z.string(),
  }),
  organization: z.object({ id: z.string(), name: z.string() }),
  brand: z.object({
    id: z.string(),
    name: z.string(),
    publicationId: z.string().nullable(),
    publicationStatus: z.enum(["missing", "draft", "published"]),
    completeness: z.number().min(0).max(100),
  }),
  credit: z.object({
    available: z.number().nonnegative(),
    reserved: z.number().nonnegative(),
    currency: z.literal("CREDIT"),
    authoritative: z.boolean(),
  }),
  task: z.object({
    id: z.string(),
    title: z.string(),
    status: nodeStatusSchema,
    nextAction: z.string(),
    budget: z.number().nonnegative(),
    estimatedCost: z.number().nonnegative(),
  }),
  nodes: z.array(nodeSchema).length(6),
  knowledge: z.array(knowledgeEntrySchema),
  artifacts: z.array(artifactSchema),
  activity: z.array(activitySchema),
  updatedAt: z.string().datetime(),
});
export type ProjectState = z.infer<typeof projectStateSchema>;

export const cloudProjectSelectionSchema = z.object({
  organizationId: z.string().min(1),
  projectId: z.string().min(1),
  taskBudget: z.number().int().nonnegative().max(100_000),
});
export type CloudProjectSelection = z.infer<typeof cloudProjectSelectionSchema>;

export const confirmationTicketSchema = z.object({
  id: z.string(),
  operation: z.enum(["freeze_question_set", "start_capture", "register_artifact"]),
  summary: z.string(),
  estimatedCredit: z.number().nonnegative(),
  maxCredit: z.number().nonnegative(),
  expiresAt: z.string().datetime(),
  inputDigest: z.string(),
  expectedRevision: z.number().int().nonnegative(),
});
export type ConfirmationTicket = z.infer<typeof confirmationTicketSchema>;

export const apiErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  retryable: z.boolean(),
  requestId: z.string(),
  traceId: z.string().optional(),
  details: z.record(z.string(), z.unknown()).optional(),
});
export type ApiError = z.infer<typeof apiErrorSchema>;

export const questionSchema = z.object({
  id: z.string().min(1),
  text: z.string().trim().min(5).max(240),
  intent: z.enum(["awareness", "consideration", "comparison", "decision", "validation"]),
  persona: z.string().trim().min(1).max(80),
});
export const questionSetSchema = z.object({
  title: z.string().trim().min(1).max(120),
  questions: z.array(questionSchema).min(1).max(100),
});
export type QuestionSet = z.infer<typeof questionSetSchema>;

export const platformSchema = z.enum(["doubao", "qwen", "deepseek", "yuanbao", "kimi"]);
export type Platform = z.infer<typeof platformSchema>;

export const captureRequestSchema = z.object({
  questionSetId: z.string().min(1),
  platforms: z.array(platformSchema).min(1).max(5),
  maxCredit: z.number().positive().max(100_000),
});
export type CaptureRequest = z.infer<typeof captureRequestSchema>;

export const artifactRegistrationSchema = z.object({
  relativePath: z.string().min(1),
  expectedSha256: z.string().regex(/^[a-f0-9]{64}$/),
  title: z.string().trim().min(1).max(160),
});
export type ArtifactRegistration = z.infer<typeof artifactRegistrationSchema>;
