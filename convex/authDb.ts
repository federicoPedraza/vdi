import { internalMutation, internalQuery, query } from "./_generated/server";
import { v } from "convex/values";

export const getPartnerByEmail = internalQuery({
  args: { email: v.string() },
  returns: v.union(
    v.object({
      _id: v.id("partners"),
      _creationTime: v.number(),
      email: v.string(),
      name: v.string(),
      passwordHash: v.string(),
      salt: v.string(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("partners")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .unique();
  },
});

export const createPartner = internalMutation({
  args: { email: v.string(), name: v.string(), passwordHash: v.string(), salt: v.string() },
  returns: v.id("partners"),
  handler: async (ctx, args) => {
    return await ctx.db.insert("partners", args);
  },
});

export const createSession = internalMutation({
  args: { partnerId: v.id("partners"), token: v.string(), expiresAt: v.number() },
  returns: v.id("sessions"),
  handler: async (ctx, args) => {
    return await ctx.db.insert("sessions", args);
  },
});

export const deleteSessionByToken = internalMutation({
  args: { token: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .unique();
    if (session) {
      await ctx.db.delete(session._id);
    }
    return null;
  },
});

export const getPartnerBySession = query({
  args: { token: v.string() },
  returns: v.union(
    v.object({
      _id: v.id("partners"),
      _creationTime: v.number(),
      email: v.string(),
      name: v.string(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .unique();
    if (!session) return null;
    if (session.expiresAt < Date.now()) return null;
    const partner = await ctx.db.get(session.partnerId);
    if (!partner) return null;
    return {
      _id: partner._id,
      _creationTime: partner._creationTime,
      email: partner.email,
      name: partner.name,
    };
  },
});

export const getParsersForSession = query({
  args: { token: v.string() },
  returns: v.array(
    v.object({
      _id: v.id("parsers"),
      _creationTime: v.number(),
      uuid: v.string(),
      language: v.string(),
      code: v.optional(v.string()),
      event: v.string(),
      fingerprint: v.string(),
      payload: v.string(),
      state: v.union(
        v.literal("idle"),
        v.literal("building"),
        v.literal("success"),
        v.literal("failed")
      ),
      partnerId: v.id("partners"),
    })
  ),
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .unique();
    if (!session || session.expiresAt < Date.now()) return [];
    return await ctx.db
      .query("parsers")
      .withIndex("by_partner", (q) => q.eq("partnerId", session.partnerId))
      .order("desc")
      .collect();
  },
});
