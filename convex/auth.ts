"use node";
import { action } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";

export const signUp = action({
  args: { email: v.string(), name: v.string(), password: v.string() },
  returns: v.object({ token: v.string(), partnerId: v.id("partners") }),
  handler: async (ctx, args) => {
    const exists = await ctx.runQuery(internal.authDb.getPartnerByEmail, { email: args.email });
    if (exists) throw new Error("Email already registered");
    const { randomBytes, createHash } = await import("crypto");
    const salt = randomBytes(16).toString("hex");
    const passwordHash = createHash("sha256").update(`${salt}|${args.password}`).digest("hex");
    const partnerId: Id<"partners"> = await ctx.runMutation(internal.authDb.createPartner, {
      email: args.email,
      name: args.name,
      passwordHash,
      salt,
    });
    const token = randomBytes(32).toString("hex");
    const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000;
    await ctx.runMutation(internal.authDb.createSession, { partnerId, token, expiresAt });
    return { token, partnerId };
  },
});

export const logIn = action({
  args: { email: v.string(), password: v.string() },
  returns: v.object({ token: v.string(), partnerId: v.id("partners") }),
  handler: async (ctx, args): Promise<{ token: string; partnerId: Id<"partners"> }> => {
    const partner = await ctx.runQuery(internal.authDb.getPartnerByEmail, { email: args.email });
    if (!partner) throw new Error("Invalid credentials");
    const { createHash, randomBytes } = await import("crypto");
    const computed = createHash("sha256").update(`${partner.salt}|${args.password}`).digest("hex");
    if (computed !== partner.passwordHash) throw new Error("Invalid credentials");
    const token = randomBytes(32).toString("hex");
    const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000;
    await ctx.runMutation(internal.authDb.createSession, { partnerId: partner._id, token, expiresAt });
    return { token, partnerId: partner._id };
  },
});

export const logOut = action({
  args: { token: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.runMutation(internal.authDb.deleteSessionByToken, { token: args.token });
    return null;
  },
});
