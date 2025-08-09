import {
  query,
  mutation,
  internalMutation,
  internalQuery,
  action,
} from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";


/**
 * Get webhook logs
 */
export const getWebhookLogs = query({
  args: {
    limit: v.optional(v.number()),
    platform: v.optional(v.string()),
  },
  returns: v.array(v.object({
    _id: v.id("webhook_logs"),
    _creationTime: v.number(),
    platform: v.string(),
    event: v.string(),
    payload: v.any(),
    processed: v.boolean(),
    error: v.optional(v.string()),
    processedAt: v.optional(v.number()),
  })),
  handler: async (ctx, args) => {
    const limit = args.limit || 100;
    let query = ctx.db.query("webhook_logs").order("desc");

    if (args.platform) {
      query = ctx.db.query("webhook_logs")
        .withIndex("by_platform", (q) => q.eq("platform", args.platform as string))
        .order("desc");
    }

    return await query.take(limit);
  },
});

// ===== PARSER PROCEDURES =====

/**
 * Get all parsers
 */
export const getAllParsers = query({
  args: {},
  returns: v.array(v.object({
    _id: v.id("parsers"),
    _creationTime: v.number(),
    uuid: v.string(),
    code: v.optional(v.string()),
    language: v.string(),
    event: v.string(),
    fingerprint: v.string(),
    payload: v.string(),
    state: v.union(v.literal("idle"), v.literal("building"), v.literal("success"), v.literal("failed")),
    partnerId: v.id("partners"),
  })),
  handler: async (ctx, args) => {
    const parsers = await ctx.db.query("parsers").order("desc").collect();
    return parsers.map(parser => ({
      _id: parser._id,
      _creationTime: parser._creationTime,
      uuid: parser.uuid,
      code: parser.code,
      language: parser.language,
      event: parser.event,
      fingerprint: parser.fingerprint,
      payload: parser.payload,
      state: (parser.state as any) || "success" as const,
      partnerId: (parser as any).partnerId,
    }));
  },
});

/**
 * Get parser by ID (public)
 */
export const getParserByIdPublic = query({
  args: { parserId: v.id("parsers") },
  returns: v.union(
    v.object({
      _id: v.id("parsers"),
      _creationTime: v.number(),
      uuid: v.string(),
      language: v.string(),
      code: v.optional(v.string()),
      event: v.string(),
      fingerprint: v.string(),
      payload: v.string(),
      state: v.union(v.literal("idle"), v.literal("building"), v.literal("success"), v.literal("failed")),
      partnerId: v.id("partners"),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    return await ctx.db.get(args.parserId);
  },
});

/**
 * Get parser by UUID (public)
 */
export const getParserByUuid = query({
  args: {
    uuid: v.string(),
  },
  returns: v.union(
    v.object({
      _id: v.id("parsers"),
      _creationTime: v.number(),
      uuid: v.string(),
      language: v.string(),
      fingerprint: v.string(),
      code: v.optional(v.string()),
      event: v.string(),
      payload: v.string(),
      state: v.union(v.literal("idle"), v.literal("building"), v.literal("success"), v.literal("failed")),
      partnerId: v.id("partners"),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("parsers")
      .withIndex("by_uuid", (q) => q.eq("uuid", args.uuid))
      .unique();
  },
});

/**
 * Get parser by UUID (internal)
 */
export const getParserByUuidInternal = internalQuery({
  args: {
    uuid: v.string(),
  },
  returns: v.union(
    v.object({
      _id: v.id("parsers"),
      _creationTime: v.number(),
      uuid: v.string(),
      language: v.string(),
      fingerprint: v.string(),
      code: v.optional(v.string()),
      event: v.string(),
      payload: v.string(),
      state: v.union(v.literal("idle"), v.literal("building"), v.literal("success"), v.literal("failed")),
      partnerId: v.optional(v.id("partners")),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("parsers")
      .withIndex("by_uuid", (q) => q.eq("uuid", args.uuid))
      .unique();
  },
});

/**
 * Find parsers for a specific platform and event
 */
export const findParsersForEvent = internalQuery({
  args: {
    event: v.string(),
  },
  returns: v.array(
    v.object({
      _id: v.id("parsers"),
      _creationTime: v.number(),
      uuid: v.string(),
      language: v.string(),
      fingerprint: v.string(),
      payload: v.string(),
      code: v.optional(v.string()),
      event: v.string(),
      state: v.union(v.literal("idle"), v.literal("building"), v.literal("success"), v.literal("failed")),
      partnerId: v.id("partners"),
    })
  ),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("parsers")
      .withIndex("by_event", (q) => q.eq("event", args.event))
      .collect();
  },
});

/**
 * Delete parser
 */
export const deleteParser = mutation({
  args: {
    parserId: v.id("parsers"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const parser = await ctx.db.get(args.parserId);
    if (!parser) return null;

    // Prevent deleting while parser is building/running
    if ((parser.state as any) === "building") {
      throw new Error("Cannot delete a parser while it is running/building");
    }

    // Prevent deleting if there is an active processing still running
    const processings = await ctx.db
      .query("parser_processings")
      .withIndex("by_parser", (q) => q.eq("parserId", args.parserId))
      .collect();
    const hasActive = processings.some((p) => p.status === "running" && !p.finishedAt);
    if (hasActive) {
      throw new Error("Cannot delete a parser while a processing is running");
    }

    // Delete related parser_processings first
    for (const processing of processings) {
      await ctx.db.delete(processing._id);
    }

    // Finally delete the parser
    await ctx.db.delete(args.parserId);
    return null;
  },
});

/**
 * Store a generated parser in the database (internal)
 */
export const storeParser = internalMutation({
  args: {
    uuid: v.string(),
    language: v.string(),
    code: v.string(),
    payload: v.string(),
    event: v.string(),
    fingerprint: v.string(),
    partnerId: v.id("partners"),
  },
  returns: v.id("parsers"),
  handler: async (ctx, args) => {
    return await ctx.db.insert("parsers", {
      uuid: args.uuid,
      language: args.language,
      event: args.event,
      fingerprint: args.fingerprint,
      payload: args.payload,
      code: args.code,
      state: "idle" as const,
      partnerId: args.partnerId,
    });
  },
});

/**
 * Public webhook processing mutation - stores parser and processes data
 */
export const processWebhookData = internalMutation({
  args: {
    // Parser data
    parserUuid: v.string(),
    parserCode: v.string(),
    payload: v.string(),
    event: v.string(),
    fingerprint: v.string(),
    partnerId: v.id("partners"),
    // Parsed data
    clientData: v.any(),
    orderData: v.any(),
    shippingData: v.optional(v.any()),
    orderLinesData: v.optional(v.array(v.any())),
  },
  returns: v.object({
    parserId: v.id("parsers"),
  }),
  handler: async (ctx, args): Promise<{ parserId: Id<"parsers"> }> => {
    // Store parser
    const parserId: Id<"parsers"> = await ctx.db.insert("parsers", {
      uuid: args.parserUuid,
      language: "javascript",
      code: args.parserCode,
      payload: args.payload,
      event: args.event,
      fingerprint: args.fingerprint,
      state: "idle" as const,
      partnerId: args.partnerId,
    });

    return { parserId };
  },
});

/**
 * Store a parser with "building" state (for async processing) - Public version
 */
export const storeParserBuildingPublic = mutation({
  args: {
    uuid: v.string(),
    language: v.string(),
    code: v.string(),
    payload: v.string(),
    event: v.string(),
    fingerprint: v.string(),
    partnerId: v.id("partners"),
  },
  returns: v.id("parsers"),
  handler: async (ctx, args) => {
    // Generate fingerprint from payload schema

    return await ctx.db.insert("parsers", {
      uuid: args.uuid,
      language: args.language,
      code: args.code,
      payload: args.payload,
      event: args.event,
      fingerprint: args.fingerprint,
      state: "idle" as const,
      partnerId: args.partnerId,
    });
  },
});

/**
 * Get all parsers with "building" state
 */
export const getBuildingParsers = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("parsers"),
      _creationTime: v.number(),
      uuid: v.string(),
      language: v.string(),
      fingerprint: v.string(),
      payload: v.string(),
      code: v.optional(v.string()),
      event: v.optional(v.string()),
      state: v.union(v.literal("idle"), v.literal("building"), v.literal("success"), v.literal("failed")),
    })
  ),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("parsers")
      .withIndex("by_state", (q) => q.eq("state", "building"))
      .collect();
  },
});

/**
 * Get parsers pending build (idle or building)
 */
export const getPendingParsers = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("parsers"),
      _creationTime: v.number(),
      uuid: v.string(),
      language: v.string(),
      fingerprint: v.string(),
      payload: v.string(),
      code: v.optional(v.string()),
      event: v.optional(v.string()),
      state: v.union(v.literal("idle"), v.literal("building"), v.literal("success"), v.literal("failed")),
    })
  ),
  handler: async (ctx, args) => {
    const idle = await ctx.db
      .query("parsers")
      .withIndex("by_state", (q) => q.eq("state", "idle"))
      .collect();
    const building = await ctx.db
      .query("parsers")
      .withIndex("by_state", (q) => q.eq("state", "building"))
      .collect();
    return [...idle, ...building];
  },
});

/**
 * Mark a parser as building when a build starts
 */
export const startParserBuild = mutation({
  args: { parserId: v.id("parsers") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.parserId, { state: "building" as const });
    return null;
  },
});

/**
 * Update parser state to success with directory
 */
export const updateParserSuccess = internalMutation({
  args: {
    parserId: v.id("parsers"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.parserId, {
      state: "success" as const,
    });
    return null;
  },
});

/**
 * Update parser state to success with directory (public version)
 */
export const updateParserSuccessPublic = mutation({
  args: {
    parserId: v.id("parsers"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.parserId, {
      state: "success" as const,
    });
    return null;
  },
});

/**
 * Update parser state to failed (internal)
 */
export const updateParserFailed = internalMutation({
  args: {
    parserId: v.id("parsers"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.parserId, {
      state: "failed" as const,
    });
    return null;
  },
});

/**
 * Update parser state to failed (public)
 */
export const updateParserFailedPublic = mutation({
  args: {
    parserId: v.id("parsers"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.parserId, {
      state: "failed" as const,
    });
    return null;
  },
});

/**
 * Update parser code (public)
 */
export const updateParserCode = mutation({
  args: {
    parserId: v.id("parsers"),
    code: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.parserId, {
      code: args.code,
    });
    return null;
  },
});

/**
 * Reset a failed parser back to building state for retry
 */
export const resetFailedParser = mutation({
  args: {
    parserId: v.id("parsers"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const parser = await ctx.db.get(args.parserId);

    if (!parser) {
      throw new Error("Parser not found");
    }

    if (parser.state !== "failed") {
      throw new Error("Only failed parsers can be reset");
    }

    // Reset parser to idle state and clear error
    await ctx.db.patch(args.parserId, {
      state: "idle" as const,
      code: undefined,
    });

    return null;
  },
});

/**
 * Process a building parser with its original payload
 */
export const processBuildingParser = action({
  args: {
    parserId: v.id("parsers"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Get the parser
    const parser = await ctx.runQuery(internal.procedures.getParserById, {
      parserId: args.parserId,
    });

    if (!parser || (parser.state !== "building" && parser.state !== "idle")) {
      throw new Error("Parser not found or not in building state");
    }

    try {
      // Execute the parser with the original payload
      const parseFunction = new Function(
        "payload",
        `${parser.code || ""}\nreturn exec(payload);`
      );

      const result = parseFunction(parser.payload);

      if (result && result.client && result.order) {
        // Process the parsed data
        const processResult = await ctx.runMutation(internal.procedures.processWebhookData, {
          parserUuid: parser.uuid,
          parserCode: parser.code || "",
          event: parser.event || "webhook",
          payload: parser.payload,
          fingerprint: parser.fingerprint,
          partnerId: parser.partnerId,
          clientData: result.client,
          orderData: result.order,
          shippingData: result.shipping,
          orderLinesData: result.orderLines,
        });

        await ctx.runMutation(internal.procedures.updateParserSuccess, {
          parserId: args.parserId,
        });

        console.log(`✅ Parser ${parser.uuid} processed successfully`);
        console.log(`Parser ID: ${processResult.parserId}`);
      } else {
        throw new Error("Parser execution failed - invalid result structure");
      }
    } catch (error) {
      console.error(`❌ Parser ${parser.uuid} processing failed:`, error);

      // Update parser to failed state
      await ctx.runMutation(internal.procedures.updateParserFailed, {
        parserId: args.parserId,
      });
    }

    return null;
  },
});

/**
 * Find active parsers by fingerprint for reuse
 */
export const getParserByFingerprint = query({
  args: {
    fingerprint: v.string(),
  },
  returns: v.union(
    v.object({
      _id: v.id("parsers"),
      _creationTime: v.number(),
      uuid: v.string(),
      language: v.string(),
      code: v.optional(v.string()),
      payload: v.string(),
      event: v.string(),
      fingerprint: v.string(),
      state: v.union(v.literal("idle"), v.literal("building"), v.literal("success"), v.literal("failed")),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const parser = await ctx.db
      .query("parsers")
      .withIndex("by_fingerprint", (q) => q.eq("fingerprint", args.fingerprint))
      .filter((q) => q.eq(q.field("state"), "success"))
      .first();
    return parser;
  },
});

/**
 * Get parser by ID (internal)
 */
export const getParserById = internalQuery({
  args: {
    parserId: v.id("parsers"),
  },
  returns: v.union(
    v.object({
      _id: v.id("parsers"),
      _creationTime: v.number(),
      uuid: v.string(),
      language: v.string(),
      code: v.optional(v.string()),
      payload: v.string(),
      event: v.string(),
      fingerprint: v.string(),
      state: v.union(v.literal("idle"), v.literal("building"), v.literal("success"), v.literal("failed")),
      partnerId: v.id("partners"),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    return await ctx.db.get(args.parserId);
  },
});

// ===== PARSER PROCESSING TRACKING =====

export const startParserProcessing = mutation({
  args: {
    parserId: v.id("parsers"),
    requestId: v.string(),
    initialStep: v.number(),
    totalSteps: v.optional(v.number()),
    initialLogs: v.optional(v.string()),
    systemPrompt: v.optional(v.string()),
    userPrompt: v.optional(v.string()),
  },
  returns: v.id("parser_processings"),
  handler: async (ctx, args) => {
    const processingId = await ctx.db.insert("parser_processings", {
      parserId: args.parserId,
      requestId: args.requestId,
      step: args.initialStep,
      totalSteps: args.totalSteps,
      logs: args.initialLogs ?? "",
      status: "running" as const,
      startedAt: Date.now(),
      systemPrompt: args.systemPrompt,
      userPrompt: args.userPrompt,
    });
    return processingId;
  },
});

export const appendProcessingLog = mutation({
  args: {
    processingId: v.id("parser_processings"),
    step: v.number(),
    message: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const current = await ctx.db.get(args.processingId);
    if (!current) return null;
    const newLogs = (current.logs || "") + (current.logs ? "\n" : "") + args.message;
    await ctx.db.patch(args.processingId, { logs: newLogs, step: args.step });
    return null;
  },
});

export const setProcessingPrompts = mutation({
  args: {
    processingId: v.id("parser_processings"),
    systemPrompt: v.string(),
    userPrompt: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.processingId, {
      systemPrompt: args.systemPrompt,
      userPrompt: args.userPrompt,
    });
    return null;
  },
});

export const markProcessingSuccess = mutation({
  args: {
    processingId: v.id("parser_processings"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.processingId, { status: "success" as const, finishedAt: Date.now() });
    return null;
  },
});

export const markProcessingFailed = mutation({
  args: {
    processingId: v.id("parser_processings"),
    error: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.processingId, { status: "failed" as const, finishedAt: Date.now(), error: args.error });
    return null;
  },
});

export const getProcessingsByParser = query({
  args: { parserId: v.id("parsers") },
  returns: v.array(v.object({
    _id: v.id("parser_processings"),
    _creationTime: v.number(),
    parserId: v.id("parsers"),
    requestId: v.string(),
    step: v.number(),
    totalSteps: v.optional(v.number()),
    logs: v.string(),
    status: v.union(v.literal("running"), v.literal("success"), v.literal("failed")),
    startedAt: v.number(),
    finishedAt: v.optional(v.number()),
    error: v.optional(v.string()),
    systemPrompt: v.optional(v.string()),
    userPrompt: v.optional(v.string()),
  })),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("parser_processings")
      .withIndex("by_parser", (q) => q.eq("parserId", args.parserId))
      .order("desc")
      .collect();
  },
});

export const getProcessingByRequestId = query({
  args: { requestId: v.string() },
  returns: v.union(v.object({
    _id: v.id("parser_processings"),
    _creationTime: v.number(),
    parserId: v.id("parsers"),
    requestId: v.string(),
    step: v.number(),
    totalSteps: v.optional(v.number()),
    logs: v.string(),
    status: v.union(v.literal("running"), v.literal("success"), v.literal("failed")),
    startedAt: v.number(),
    finishedAt: v.optional(v.number()),
    error: v.optional(v.string()),
    systemPrompt: v.optional(v.string()),
    userPrompt: v.optional(v.string()),
  }), v.null()),
  handler: async (ctx, args) => {
    const proc = await ctx.db
      .query("parser_processings")
      .withIndex("by_request", (q) => q.eq("requestId", args.requestId))
      .first();
    return proc ?? null;
  },
});
