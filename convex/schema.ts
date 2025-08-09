import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Webhook logs for debugging and monitoring
  webhook_logs: defineTable({
    platform: v.string(), // "tiendanube", "shopify", "woocommerce", etc.
    event: v.string(), // "order.created", "order.updated", etc.
    payload: v.any(), // The webhook payload
    processed: v.boolean(),
    error: v.optional(v.string()),
    processedAt: v.optional(v.number()),
  })
    .index("by_platform", ["platform"])
    .index("by_processed", ["processed"])
    .index("by_event", ["event"]),

  // AI-generated parsers for webhook processing
  parsers: defineTable({
    uuid: v.string(), // Unique identifier for the parser
    language: v.string(), // Programming language (javascript, python, etc.)
    code: v.optional(v.string()), // The generated parser code (optional for building parsers)
    event: v.string(), // Event type this parser handles (optional)
    fingerprint: v.string(), // Payload structure fingerprint for reuse detection
    payload: v.string(), // The original payload for the parser
    // Owner of this parser (required)
    partnerId: v.id("partners"),
    state: v.union(
      v.literal("idle"),
      v.literal("building"),
      v.literal("success"),
      v.literal("failed")
    ), // Parser processing state
  })
    .index("by_uuid", ["uuid"])
    .index("by_fingerprint", ["fingerprint"])
    .index("by_state", ["state"])
    .index("by_event", ["event"])
    .index("by_partner", ["partnerId"]),

  // Parser processing runs for tracking steps and logs per request
  parser_processings: defineTable({
    parserId: v.id("parsers"),
    requestId: v.string(),
    step: v.number(),
    totalSteps: v.optional(v.number()),
    logs: v.string(), // concatenated logs with breaklines
    status: v.union(v.literal("running"), v.literal("success"), v.literal("failed")),
    startedAt: v.number(),
    finishedAt: v.optional(v.number()),
    error: v.optional(v.string()),
    // Store prompts used for this processing run
    systemPrompt: v.optional(v.string()),
    userPrompt: v.optional(v.string()),
  })
    .index("by_parser", ["parserId"])
    .index("by_request", ["requestId"])
    .index("by_status", ["status"]),

  // Partners for owning parsers and authenticating
  partners: defineTable({
    email: v.string(),
    name: v.string(),
    slug: v.string(),
    passwordHash: v.string(),
    salt: v.string(),
  })
    .index("by_email", ["email"]) 
    .index("by_slug", ["slug"]),

  // Session tokens for basic login
  sessions: defineTable({
    partnerId: v.id("partners"),
    token: v.string(),
    expiresAt: v.number(),
  })
    .index("by_token", ["token"])
    .index("by_partner", ["partnerId"]),

  // Partner projects/collections for organizing schemas
  projects: defineTable({
    partnerId: v.id("partners"),
    name: v.string(),
    slug: v.optional(v.string()),
    description: v.optional(v.string()),
  })
    .index("by_partner", ["partnerId"])
    .index("by_slug", ["partnerId", "slug"]),

  // Schemas within a project; definition is arbitrary JSON schema/structure
  project_schemas: defineTable({
    projectId: v.id("projects"),
    name: v.string(),
    key: v.optional(v.string()),
    alias: v.optional(v.string()),
    color: v.optional(v.string()),
    definition: v.any(),
  }).index("by_project", ["projectId"]),

  // Per-partner settings and preferences
  partner_settings: defineTable({
    partnerId: v.id("partners"),
    provider: v.union(v.literal("openai"), v.literal("ollama")),
    // Encrypted OpenAI API key (AES-GCM): base64-encoded fields
    openaiKeyCiphertext: v.optional(v.string()),
    openaiKeyIv: v.optional(v.string()),
    openaiKeyAuthTag: v.optional(v.string()),
    // Currently selected project for the partner (optional)
    activeProjectId: v.optional(v.id("projects")),
  }).index("by_partner", ["partnerId"]),
});
