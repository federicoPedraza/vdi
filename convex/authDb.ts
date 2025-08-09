import { internalMutation, internalQuery, query, mutation } from "./_generated/server";
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
    const base = args.name
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-");

    let slug = base || "partner";
    let attempt = 1;
    // Ensure uniqueness
    for (;;) {
      const existing = await ctx.db
        .query("partners")
        .withIndex("by_slug", (q) => q.eq("slug", slug))
        .first();
      if (!existing) break;
      attempt += 1;
      slug = `${base}-${attempt}`;
    }

    return await ctx.db.insert("partners", {
      email: args.email,
      name: args.name,
      slug,
      passwordHash: args.passwordHash,
      salt: args.salt,
    });
  },
});

export const getPartnerBySlug = query({
  args: { slug: v.string() },
  returns: v.union(
    v.object({
      _id: v.id("partners"),
      _creationTime: v.number(),
      email: v.string(),
      name: v.string(),
      slug: v.string(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("partners")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
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

// ===== Partner settings =====

export const getPartnerSettingsByPartnerId = internalQuery({
    args: { partnerId: v.id("partners") },
    returns: v.union(
        v.object({
            _id: v.id("partner_settings"),
            _creationTime: v.number(),
            partnerId: v.id("partners"),
            provider: v.union(v.literal("openai"), v.literal("ollama")),
            openaiKeyCiphertext: v.optional(v.string()),
            openaiKeyIv: v.optional(v.string()),
            openaiKeyAuthTag: v.optional(v.string()),
            activeProjectId: v.optional(v.id("projects")),
        }),
        v.null()
    ),
    handler: async (ctx, args) => {
        return await ctx.db
            .query("partner_settings")
            .withIndex("by_partner", (q) => q.eq("partnerId", args.partnerId))
            .unique();
    },
});

export const getPartnerSettingsBySession = query({
    args: { token: v.string() },
    returns: v.union(
        v.object({
            _id: v.id("partner_settings"),
            _creationTime: v.number(),
            partnerId: v.id("partners"),
            provider: v.union(v.literal("openai"), v.literal("ollama")),
            openaiKeyCiphertext: v.optional(v.string()),
            openaiKeyIv: v.optional(v.string()),
            openaiKeyAuthTag: v.optional(v.string()),
            activeProjectId: v.optional(v.id("projects")),
        }),
        v.null()
    ),
    handler: async (ctx, args) => {
        const session = await ctx.db
            .query("sessions")
            .withIndex("by_token", (q) => q.eq("token", args.token))
            .unique();
        if (!session || session.expiresAt < Date.now()) return null;
        const settings = await ctx.db
            .query("partner_settings")
            .withIndex("by_partner", (q) => q.eq("partnerId", session.partnerId))
            .unique();
        return settings ?? null;
    },
});

export const upsertPartnerSettings = internalMutation({
    args: {
        partnerId: v.id("partners"),
        provider: v.union(v.literal("openai"), v.literal("ollama")),
        openaiKeyCiphertext: v.optional(v.string()),
        openaiKeyIv: v.optional(v.string()),
        openaiKeyAuthTag: v.optional(v.string()),
        activeProjectId: v.optional(v.id("projects")),
    },
    returns: v.id("partner_settings"),
    handler: async (ctx, args) => {
        const existing = await ctx.db
            .query("partner_settings")
            .withIndex("by_partner", (q) => q.eq("partnerId", args.partnerId))
            .unique();
        if (existing) {
            const update: any = { provider: args.provider };
            if (typeof args.openaiKeyCiphertext === "string") update.openaiKeyCiphertext = args.openaiKeyCiphertext;
            if (typeof args.openaiKeyIv === "string") update.openaiKeyIv = args.openaiKeyIv;
            if (typeof args.openaiKeyAuthTag === "string") update.openaiKeyAuthTag = args.openaiKeyAuthTag;
            if (args.activeProjectId) update.activeProjectId = args.activeProjectId;
            await ctx.db.patch(existing._id, update);
            return existing._id;
        }
        const doc: any = { partnerId: args.partnerId, provider: args.provider };
        if (typeof args.openaiKeyCiphertext === "string") doc.openaiKeyCiphertext = args.openaiKeyCiphertext;
        if (typeof args.openaiKeyIv === "string") doc.openaiKeyIv = args.openaiKeyIv;
        if (typeof args.openaiKeyAuthTag === "string") doc.openaiKeyAuthTag = args.openaiKeyAuthTag;
        if (args.activeProjectId) doc.activeProjectId = args.activeProjectId;
        return await ctx.db.insert("partner_settings", doc);
    },
});

export const updatePartnerName = internalMutation({
    args: { partnerId: v.id("partners"), name: v.string() },
    returns: v.null(),
    handler: async (ctx, args) => {
        await ctx.db.patch(args.partnerId, { name: args.name });
        return null;
    },
});

export const savePartnerSettingsForSession = mutation({
    args: {
        token: v.string(),
        name: v.optional(v.string()),
        provider: v.union(v.literal("openai"), v.literal("ollama")),
        openaiKeyCiphertext: v.optional(v.string()),
        openaiKeyIv: v.optional(v.string()),
        openaiKeyAuthTag: v.optional(v.string()),
        activeProjectId: v.optional(v.id("projects")),
    },
    returns: v.object({
        settingsId: v.id("partner_settings"),
        partnerName: v.string(),
    }),
    handler: async (ctx, args) => {
        const session = await ctx.db
            .query("sessions")
            .withIndex("by_token", (q) => q.eq("token", args.token))
            .unique();
        if (!session || session.expiresAt < Date.now()) {
            throw new Error("Unauthorized");
        }
        const partner = await ctx.db.get(session.partnerId);
        if (!partner) throw new Error("Unauthorized");

        // Update name when provided
        let finalName = partner.name;
        const desiredName = (args.name ?? "").trim();
        if (desiredName && desiredName !== partner.name) {
            await ctx.db.patch(partner._id, { name: desiredName });
            finalName = desiredName;
        }

        // Upsert settings
        const existing = await ctx.db
            .query("partner_settings")
            .withIndex("by_partner", (q) => q.eq("partnerId", partner._id))
            .unique();
        let settingsId;
        if (existing) {
            const update: any = { provider: args.provider };
            if (typeof args.openaiKeyCiphertext === "string") update.openaiKeyCiphertext = args.openaiKeyCiphertext;
            if (typeof args.openaiKeyIv === "string") update.openaiKeyIv = args.openaiKeyIv;
            if (typeof args.openaiKeyAuthTag === "string") update.openaiKeyAuthTag = args.openaiKeyAuthTag;
            if (args.activeProjectId) update.activeProjectId = args.activeProjectId;
            await ctx.db.patch(existing._id, update);
            settingsId = existing._id;
        } else {
            const doc: any = { partnerId: partner._id, provider: args.provider };
            if (typeof args.openaiKeyCiphertext === "string") doc.openaiKeyCiphertext = args.openaiKeyCiphertext;
            if (typeof args.openaiKeyIv === "string") doc.openaiKeyIv = args.openaiKeyIv;
            if (typeof args.openaiKeyAuthTag === "string") doc.openaiKeyAuthTag = args.openaiKeyAuthTag;
            if (args.activeProjectId) doc.activeProjectId = args.activeProjectId;
            settingsId = await ctx.db.insert("partner_settings", doc);
        }

        return { settingsId, partnerName: finalName };
    },
});

// ===== Projects & Schemas =====

export const listProjectsBySession = query({
    args: { token: v.string() },
    returns: v.array(
        v.object({
            _id: v.id("projects"),
            _creationTime: v.number(),
            partnerId: v.id("partners"),
            name: v.string(),
            slug: v.optional(v.string()),
            description: v.optional(v.string()),
        })
    ),
    handler: async (ctx, args) => {
        const session = await ctx.db
            .query("sessions")
            .withIndex("by_token", (q) => q.eq("token", args.token))
            .unique();
        if (!session || session.expiresAt < Date.now()) return [];
        return await ctx.db
            .query("projects")
            .withIndex("by_partner", (q) => q.eq("partnerId", session.partnerId))
            .order("desc")
            .collect();
    },
});

export const getActiveProjectBySession = query({
    args: { token: v.string() },
    returns: v.union(
        v.object({
            _id: v.id("projects"),
            _creationTime: v.number(),
            partnerId: v.id("partners"),
            name: v.string(),
            slug: v.optional(v.string()),
            description: v.optional(v.string()),
        }),
        v.null()
    ),
    handler: async (ctx, args) => {
        const session = await ctx.db
            .query("sessions")
            .withIndex("by_token", (q) => q.eq("token", args.token))
            .unique();
        if (!session || session.expiresAt < Date.now()) return null;
        const settings = await ctx.db
            .query("partner_settings")
            .withIndex("by_partner", (q) => q.eq("partnerId", session.partnerId))
            .unique();
        if (!settings?.activeProjectId) return null;
        const project = await ctx.db.get(settings.activeProjectId);
        return project ?? null;
    },
});

export const setActiveProjectForSession = mutation({
    args: { token: v.string(), projectId: v.id("projects") },
    returns: v.object({ ok: v.boolean() }),
    handler: async (ctx, args) => {
        const session = await ctx.db
            .query("sessions")
            .withIndex("by_token", (q) => q.eq("token", args.token))
            .unique();
        if (!session || session.expiresAt < Date.now()) throw new Error("Unauthorized");
        const project = await ctx.db.get(args.projectId);
        if (!project || project.partnerId !== session.partnerId) throw new Error("Invalid project");

        const existing = await ctx.db
            .query("partner_settings")
            .withIndex("by_partner", (q) => q.eq("partnerId", session.partnerId))
            .unique();
        if (existing) {
            await ctx.db.patch(existing._id, { activeProjectId: args.projectId });
        } else {
            // Default provider if none yet
            await ctx.db.insert("partner_settings", {
                partnerId: session.partnerId,
                provider: "ollama",
                activeProjectId: args.projectId,
            } as any);
        }
        return { ok: true };
    },
});

export const createProjectForSession = mutation({
    args: {
        token: v.string(),
        name: v.string(),
        slug: v.optional(v.string()),
        description: v.optional(v.string()),
        makeActive: v.optional(v.boolean()),
    },
    returns: v.object({ projectId: v.id("projects") }),
    handler: async (ctx, args) => {
        const session = await ctx.db
            .query("sessions")
            .withIndex("by_token", (q) => q.eq("token", args.token))
            .unique();
        if (!session || session.expiresAt < Date.now()) throw new Error("Unauthorized");

        const doc: any = {
            partnerId: session.partnerId,
            name: args.name.trim(),
        };
        // Normalize and enforce unique slug per partner
        const normalizeSlug = (s: string) =>
            s
                .toLowerCase()
                .normalize("NFKD")
                .replace(/[^\w\s-]/g, "")
                .trim()
                .replace(/\s+/g, "-")
                .replace(/-+/g, "-");

        const desiredSlugInput = (args.slug && args.slug.trim()) || args.name.trim();
        const desiredSlug = normalizeSlug(desiredSlugInput);
        if (desiredSlug) {
            const existingWithSlug = await ctx.db
                .query("projects")
                .withIndex("by_slug", (q) => q.eq("partnerId", session.partnerId).eq("slug", desiredSlug))
                .first();
            if (existingWithSlug) {
                throw new Error("Slug already in use");
            }
            doc.slug = desiredSlug;
        }
        if (args.description && args.description.trim()) doc.description = args.description.trim();

        const projectId = await ctx.db.insert("projects", doc);

        // Optionally set as active
        if (args.makeActive) {
            const existing = await ctx.db
                .query("partner_settings")
                .withIndex("by_partner", (q) => q.eq("partnerId", session.partnerId))
                .unique();
            if (existing) {
                await ctx.db.patch(existing._id, { activeProjectId: projectId });
            } else {
                await ctx.db.insert("partner_settings", {
                    partnerId: session.partnerId,
                    provider: "ollama",
                    activeProjectId: projectId,
                } as any);
            }
        }

        return { projectId };
    },
});

// ===== Project Schemas =====

export const listSchemasByActiveProject = query({
    args: { token: v.string() },
    returns: v.array(
        v.object({
            _id: v.id("project_schemas"),
            _creationTime: v.number(),
            projectId: v.id("projects"),
            name: v.string(),
            key: v.optional(v.string()),
            alias: v.optional(v.string()),
            color: v.optional(v.string()),
            definition: v.any(),
        })
    ),
    handler: async (ctx, args) => {
        const session = await ctx.db
            .query("sessions")
            .withIndex("by_token", (q) => q.eq("token", args.token))
            .unique();
        if (!session || session.expiresAt < Date.now()) return [];
        const settings = await ctx.db
            .query("partner_settings")
            .withIndex("by_partner", (q) => q.eq("partnerId", session.partnerId))
            .unique();
        if (!settings?.activeProjectId) return [];
        return await ctx.db
            .query("project_schemas")
            .withIndex("by_project", (q) => q.eq("projectId", settings.activeProjectId as any))
            .order("desc")
            .collect();
    },
});

export const upsertSchemaByName = mutation({
    args: {
        token: v.string(),
        name: v.string(),
        definition: v.any(),
        key: v.optional(v.string()),
        alias: v.optional(v.string()),
        color: v.optional(v.string()),
    },
    returns: v.object({ schemaId: v.id("project_schemas") }),
    handler: async (ctx, args) => {
        const session = await ctx.db
            .query("sessions")
            .withIndex("by_token", (q) => q.eq("token", args.token))
            .unique();
        if (!session || session.expiresAt < Date.now()) throw new Error("Unauthorized");
        const settings = await ctx.db
            .query("partner_settings")
            .withIndex("by_partner", (q) => q.eq("partnerId", session.partnerId))
            .unique();
        if (!settings?.activeProjectId) throw new Error("No active project");
        const projectId = settings.activeProjectId as any;

        // Find by name within project
        const existing = (await ctx.db
            .query("project_schemas")
            .withIndex("by_project", (q) => q.eq("projectId", projectId))
            .collect()).find((s) => s.name === args.name);

        const updateFields: any = { definition: args.definition };
        if (typeof args.key === "string") updateFields.key = args.key;
        if (typeof args.alias === "string") updateFields.alias = args.alias;
        if (typeof args.color === "string") updateFields.color = args.color;

        if (existing) {
            await ctx.db.patch(existing._id, updateFields);
            return { schemaId: existing._id };
        }
        const schemaId = await ctx.db.insert("project_schemas", {
            projectId,
            name: args.name,
            key: args.key,
            alias: args.alias,
            color: args.color,
            definition: args.definition,
        } as any);
        return { schemaId };
    },
});

export const deleteSchema = mutation({
    args: { token: v.string(), schemaId: v.id("project_schemas") },
    returns: v.null(),
    handler: async (ctx, args) => {
        const session = await ctx.db
            .query("sessions")
            .withIndex("by_token", (q) => q.eq("token", args.token))
            .unique();
        if (!session || session.expiresAt < Date.now()) throw new Error("Unauthorized");
        const schema = await ctx.db.get(args.schemaId);
        if (!schema) return null;
        const project = await ctx.db.get(schema.projectId as any);
        if (!project || (project as any).partnerId !== session.partnerId) throw new Error("Unauthorized");
        await ctx.db.delete(args.schemaId);
        return null;
    },
});
