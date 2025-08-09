import {
  query,
  internalMutation,
} from "./_generated/server";
import { v } from "convex/values";

// ===== WEBHOOK LOGGING =====

export const logWebhook = internalMutation({
  args: {
    platform: v.string(),
    event: v.string(),
    payload: v.any(),
    processed: v.boolean(),
  },
  returns: v.id("webhook_logs"),
  handler: async (ctx, args) => {
    return await ctx.db.insert("webhook_logs", {
      platform: args.platform,
      event: args.event,
      payload: args.payload,
      processed: args.processed,
    });
  },
});

export const markWebhookProcessed = internalMutation({
  args: {
    logId: v.id("webhook_logs"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.logId, {
      processed: true,
      processedAt: Date.now(),
    });
    return null;
  },
});

export const logWebhookError = internalMutation({
  args: {
    logId: v.id("webhook_logs"),
    error: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.logId, {
      processed: false,
      error: args.error,
      processedAt: Date.now(),
    });
    return null;
  },
});

/**
 * Get webhook logs for debugging
 */
export const getWebhookLogs = query({
  args: {
    limit: v.optional(v.number()),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const limit = args.limit || 50;
    return await ctx.db
      .query("webhook_logs")
      .order("desc")
      .take(limit);
  },
});
