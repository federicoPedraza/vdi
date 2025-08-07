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

// ===== CLIENT PROCEDURES =====

/**
 * Create a new client
 */
export const createClient = mutation({
  args: {
    platformId: v.string(),
    platform: v.string(),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    address: v.optional(v.object({
      street: v.optional(v.string()),
      city: v.optional(v.string()),
      state: v.optional(v.string()),
      country: v.optional(v.string()),
      zipCode: v.optional(v.string()),
    })),
    storeId: v.optional(v.string()),
  },
  returns: v.id("clients"),
  handler: async (ctx, args) => {
    return await ctx.db.insert("clients", {
      platformId: args.platformId,
      platform: args.platform,
      email: args.email,
      phone: args.phone,
      firstName: args.firstName,
      lastName: args.lastName,
      address: args.address,
      storeId: args.storeId,
    });
  },
});

/**
 * Update an existing client
 */
export const updateClient = mutation({
  args: {
    clientId: v.id("clients"),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    address: v.optional(v.object({
      street: v.optional(v.string()),
      city: v.optional(v.string()),
      state: v.optional(v.string()),
      country: v.optional(v.string()),
      zipCode: v.optional(v.string()),
    })),
    storeId: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { clientId, ...updates } = args;
    await ctx.db.patch(clientId, updates);
    return null;
  },
});

/**
 * Get client by platform ID
 */
export const getClientByPlatformId = query({
  args: {
    platform: v.string(),
    platformId: v.string(),
  },
  returns: v.union(
    v.object({
      _id: v.id("clients"),
      _creationTime: v.number(),
      email: v.optional(v.string()),
      phone: v.optional(v.string()),
      firstName: v.optional(v.string()),
      lastName: v.optional(v.string()),
      platformId: v.string(),
      platform: v.string(),
      address: v.optional(v.object({
        street: v.optional(v.string()),
        city: v.optional(v.string()),
        state: v.optional(v.string()),
        country: v.optional(v.string()),
        zipCode: v.optional(v.string()),
      })),
      storeId: v.optional(v.string()),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("clients")
      .withIndex("by_platform_id", (q) =>
        q.eq("platform", args.platform).eq("platformId", args.platformId)
      )
      .unique();
  },
});

/**
 * Get clients by email
 */
export const getClientsByEmail = query({
  args: {
    email: v.string(),
  },
  returns: v.array(v.object({
    _id: v.id("clients"),
    _creationTime: v.number(),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    platformId: v.string(),
    platform: v.string(),
    address: v.optional(v.object({
      street: v.optional(v.string()),
      city: v.optional(v.string()),
      state: v.optional(v.string()),
      country: v.optional(v.string()),
      zipCode: v.optional(v.string()),
    })),
    storeId: v.optional(v.string()),
  })),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("clients")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .collect();
  },
});

/**
 * Delete a client and all related data
 */
export const deleteClient = mutation({
  args: {
    clientId: v.id("clients"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Get all orders for this client
    const orders = await ctx.db
      .query("orders")
      .withIndex("by_client", (q) => q.eq("clientId", args.clientId))
      .collect();

    // Delete all related data
    for (const order of orders) {
      // Delete order lines
      const orderLines = await ctx.db
        .query("order_lines")
        .withIndex("by_order", (q) => q.eq("orderId", order._id))
        .collect();

      for (const line of orderLines) {
        await ctx.db.delete(line._id);
      }

      // Delete shippings
      const shippings = await ctx.db
        .query("shippings")
        .withIndex("by_order", (q) => q.eq("orderId", order._id))
        .collect();

      for (const shipping of shippings) {
        await ctx.db.delete(shipping._id);
      }

      // Delete order
      await ctx.db.delete(order._id);
    }

    // Delete client
    await ctx.db.delete(args.clientId);
    return null;
  },
});

// ===== ORDER PROCEDURES =====

/**
 * Create a new order
 */
export const createOrder = mutation({
  args: {
    clientId: v.id("clients"),
    platformOrderId: v.string(),
    platform: v.string(),
    orderNumber: v.optional(v.string()),
    status: v.string(),
    total: v.number(),
    currency: v.string(),
    orderDate: v.number(),
    paidDate: v.optional(v.number()),
    fulfilledDate: v.optional(v.number()),
    notes: v.optional(v.string()),
    paymentMethod: v.optional(v.string()),
    storeId: v.optional(v.string()),
  },
  returns: v.id("orders"),
  handler: async (ctx, args) => {
    return await ctx.db.insert("orders", {
      clientId: args.clientId,
      platformOrderId: args.platformOrderId,
      platform: args.platform,
      orderNumber: args.orderNumber,
      status: args.status,
      total: args.total,
      currency: args.currency,
      orderDate: args.orderDate,
      paidDate: args.paidDate,
      fulfilledDate: args.fulfilledDate,
      notes: args.notes,
      paymentMethod: args.paymentMethod,
      storeId: args.storeId,
    });
  },
});

/**
 * Update order status
 */
export const updateOrderStatus = mutation({
  args: {
    orderId: v.id("orders"),
    status: v.string(),
    paidDate: v.optional(v.number()),
    fulfilledDate: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { orderId, ...updates } = args;
    await ctx.db.patch(orderId, updates);
    return null;
  },
});

/**
 * Get order by platform ID
 */
export const getOrderByPlatformId = query({
  args: {
    platform: v.string(),
    platformOrderId: v.string(),
  },
  returns: v.union(
    v.object({
      _id: v.id("orders"),
      _creationTime: v.number(),
      clientId: v.id("clients"),
      platformOrderId: v.string(),
      platform: v.string(),
      orderNumber: v.optional(v.string()),
      status: v.string(),
      total: v.number(),
      currency: v.string(),
      orderDate: v.number(),
      paidDate: v.optional(v.number()),
      fulfilledDate: v.optional(v.number()),
      notes: v.optional(v.string()),
      paymentMethod: v.optional(v.string()),
      storeId: v.optional(v.string()),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("orders")
      .withIndex("by_platform_order", (q) =>
        q.eq("platform", args.platform).eq("platformOrderId", args.platformOrderId)
      )
      .unique();
  },
});

/**
 * Get orders by client
 */
export const getOrdersByClient = query({
  args: {
    clientId: v.id("clients"),
  },
  returns: v.array(v.object({
    _id: v.id("orders"),
    _creationTime: v.number(),
    clientId: v.id("clients"),
    platformOrderId: v.string(),
    platform: v.string(),
    orderNumber: v.optional(v.string()),
    status: v.string(),
    total: v.number(),
    currency: v.string(),
    orderDate: v.number(),
    paidDate: v.optional(v.number()),
    fulfilledDate: v.optional(v.number()),
    notes: v.optional(v.string()),
    paymentMethod: v.optional(v.string()),
    storeId: v.optional(v.string()),
  })),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("orders")
      .withIndex("by_client", (q) => q.eq("clientId", args.clientId))
      .order("desc")
      .collect();
  },
});

/**
 * Get orders by status
 */
export const getOrdersByStatus = query({
  args: {
    status: v.string(),
    limit: v.optional(v.number()),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const limit = args.limit || 100;
    return await ctx.db
      .query("orders")
      .withIndex("by_status", (q) => q.eq("status", args.status))
      .order("desc")
      .take(limit);
  },
});

// ===== SHIPPING PROCEDURES =====

/**
 * Create shipping information
 */
export const createShipping = mutation({
  args: {
    orderId: v.id("orders"),
    trackingNumber: v.optional(v.string()),
    carrier: v.optional(v.string()),
    method: v.optional(v.string()),
    status: v.string(),
    shippingAddress: v.object({
      firstName: v.optional(v.string()),
      lastName: v.optional(v.string()),
      street: v.optional(v.string()),
      city: v.optional(v.string()),
      state: v.optional(v.string()),
      country: v.optional(v.string()),
      zipCode: v.optional(v.string()),
      phone: v.optional(v.string()),
    }),
    shippedDate: v.optional(v.number()),
    estimatedDelivery: v.optional(v.number()),
    deliveredDate: v.optional(v.number()),
    shippingCost: v.optional(v.number()),
    platformShippingId: v.optional(v.string()),
    platform: v.string(),
  },
  returns: v.id("shippings"),
  handler: async (ctx, args) => {
    return await ctx.db.insert("shippings", {
      orderId: args.orderId,
      trackingNumber: args.trackingNumber,
      carrier: args.carrier,
      method: args.method,
      status: args.status,
      shippingAddress: args.shippingAddress,
      shippedDate: args.shippedDate,
      estimatedDelivery: args.estimatedDelivery,
      deliveredDate: args.deliveredDate,
      shippingCost: args.shippingCost,
      platformShippingId: args.platformShippingId,
      platform: args.platform,
    });
  },
});

/**
 * Update shipping status
 */
export const updateShippingStatus = mutation({
  args: {
    shippingId: v.id("shippings"),
    status: v.string(),
    trackingNumber: v.optional(v.string()),
    shippedDate: v.optional(v.number()),
    deliveredDate: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { shippingId, ...updates } = args;
    await ctx.db.patch(shippingId, updates);
    return null;
  },
});

/**
 * Get shipping by order
 */
export const getShippingByOrder = query({
  args: {
    orderId: v.id("orders"),
  },
  returns: v.union(
    v.object({
      _id: v.id("shippings"),
      _creationTime: v.number(),
      orderId: v.id("orders"),
      trackingNumber: v.optional(v.string()),
      carrier: v.optional(v.string()),
      method: v.optional(v.string()),
      status: v.string(),
      shippingAddress: v.object({
        firstName: v.optional(v.string()),
        lastName: v.optional(v.string()),
        street: v.optional(v.string()),
        city: v.optional(v.string()),
        state: v.optional(v.string()),
        country: v.optional(v.string()),
        zipCode: v.optional(v.string()),
        phone: v.optional(v.string()),
      }),
      shippedDate: v.optional(v.number()),
      estimatedDelivery: v.optional(v.number()),
      deliveredDate: v.optional(v.number()),
      shippingCost: v.optional(v.number()),
      platformShippingId: v.optional(v.string()),
      platform: v.string(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("shippings")
      .withIndex("by_order", (q) => q.eq("orderId", args.orderId))
      .first();
  },
});

/**
 * Get shippings by tracking number
 */
export const getShippingByTracking = query({
  args: {
    trackingNumber: v.string(),
  },
  returns: v.union(
    v.object({
      _id: v.id("shippings"),
      _creationTime: v.number(),
      orderId: v.id("orders"),
      trackingNumber: v.optional(v.string()),
      carrier: v.optional(v.string()),
      method: v.optional(v.string()),
      status: v.string(),
      shippingAddress: v.object({
        firstName: v.optional(v.string()),
        lastName: v.optional(v.string()),
        street: v.optional(v.string()),
        city: v.optional(v.string()),
        state: v.optional(v.string()),
        country: v.optional(v.string()),
        zipCode: v.optional(v.string()),
        phone: v.optional(v.string()),
      }),
      shippedDate: v.optional(v.number()),
      estimatedDelivery: v.optional(v.number()),
      deliveredDate: v.optional(v.number()),
      shippingCost: v.optional(v.number()),
      platformShippingId: v.optional(v.string()),
      platform: v.string(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("shippings")
      .withIndex("by_tracking", (q) => q.eq("trackingNumber", args.trackingNumber))
      .first();
  },
});

// ===== ORDER LINE PROCEDURES =====

/**
 * Create order line
 */
export const createOrderLine = mutation({
  args: {
    orderId: v.id("orders"),
    productId: v.optional(v.string()),
    productName: v.string(),
    variantId: v.optional(v.string()),
    variantName: v.optional(v.string()),
    sku: v.optional(v.string()),
    quantity: v.number(),
    unitPrice: v.number(),
    totalPrice: v.number(),
    weight: v.optional(v.number()),
    dimensions: v.optional(v.object({
      length: v.optional(v.number()),
      width: v.optional(v.number()),
      height: v.optional(v.number()),
    })),
    platformLineId: v.optional(v.string()),
    platform: v.string(),
  },
  returns: v.id("order_lines"),
  handler: async (ctx, args) => {
    return await ctx.db.insert("order_lines", {
      orderId: args.orderId,
      productId: args.productId,
      productName: args.productName,
      variantId: args.variantId,
      variantName: args.variantName,
      sku: args.sku,
      quantity: args.quantity,
      unitPrice: args.unitPrice,
      totalPrice: args.totalPrice,
      weight: args.weight,
      dimensions: args.dimensions,
      platformLineId: args.platformLineId,
      platform: args.platform,
    });
  },
});

/**
 * Get order lines by order
 */
export const getOrderLinesByOrder = query({
  args: {
    orderId: v.id("orders"),
  },
  returns: v.array(v.object({
    _id: v.id("order_lines"),
    _creationTime: v.number(),
    orderId: v.id("orders"),
    productId: v.optional(v.string()),
    productName: v.string(),
    variantId: v.optional(v.string()),
    variantName: v.optional(v.string()),
    sku: v.optional(v.string()),
    quantity: v.number(),
    unitPrice: v.number(),
    totalPrice: v.number(),
    weight: v.optional(v.number()),
    dimensions: v.optional(v.object({
      length: v.optional(v.number()),
      width: v.optional(v.number()),
      height: v.optional(v.number()),
    })),
    platformLineId: v.optional(v.string()),
    platform: v.string(),
  })),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("order_lines")
      .withIndex("by_order", (q) => q.eq("orderId", args.orderId))
      .collect();
  },
});

/**
 * Update order line quantity
 */
export const updateOrderLineQuantity = mutation({
  args: {
    orderLineId: v.id("order_lines"),
    quantity: v.number(),
    totalPrice: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { orderLineId, ...updates } = args;
    await ctx.db.patch(orderLineId, updates);
    return null;
  },
});

/**
 * Delete order line
 */
export const deleteOrderLine = mutation({
  args: {
    orderLineId: v.id("order_lines"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.delete(args.orderLineId);
    return null;
  },
});

// ===== COMPREHENSIVE QUERIES =====

/**
 * Get complete order information with client, shipping, and order lines
 */
export const getCompleteOrder = query({
  args: {
    orderId: v.id("orders"),
  },
  returns: v.union(
    v.object({
      order: v.any(),
      client: v.any(),
      shipping: v.union(v.any(), v.null()),
      orderLines: v.array(v.any()),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const order = await ctx.db.get(args.orderId);
    if (!order) return null;

    const client = await ctx.db.get(order.clientId);
    const shipping = await ctx.db
      .query("shippings")
      .withIndex("by_order", (q) => q.eq("orderId", args.orderId))
      .first();
    const orderLines = await ctx.db
      .query("order_lines")
      .withIndex("by_order", (q) => q.eq("orderId", args.orderId))
      .collect();

    return {
      order,
      client,
      shipping,
      orderLines,
    };
  },
});

/**
 * Get recent orders with pagination
 */
export const getRecentOrders = query({
  args: {
    limit: v.optional(v.number()),
    platform: v.optional(v.string()),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const limit = args.limit || 50;

    let query = ctx.db.query("orders").order("desc");

    if (args.platform) {
      // If platform is specified, we'd need to filter, but for now we'll get all
      // In practice, you might want to add a platform index
    }

    const orders = await query.take(limit);

    // Enrich with client information
    const enrichedOrders = [];
    for (const order of orders) {
      const client = await ctx.db.get(order.clientId);
      enrichedOrders.push({
        ...order,
        client,
      });
    }

    return enrichedOrders;
  },
});

/**
 * Get all clients
 */
export const getAllClients = query({
  args: {
    limit: v.optional(v.number()),
  },
  returns: v.array(v.object({
    _id: v.id("clients"),
    _creationTime: v.number(),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    platformId: v.string(),
    platform: v.string(),
    address: v.optional(v.object({
      street: v.optional(v.string()),
      city: v.optional(v.string()),
      state: v.optional(v.string()),
      country: v.optional(v.string()),
      zipCode: v.optional(v.string()),
    })),
    storeId: v.optional(v.string()),
  })),
  handler: async (ctx, args) => {
    const limit = args.limit || 100;
    return await ctx.db.query("clients").order("desc").take(limit);
  },
});

/**
 * Get all shippings with order and client information
 */
export const getAllShippings = query({
  args: {
    limit: v.optional(v.number()),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const limit = args.limit || 100;
    const shippings = await ctx.db.query("shippings").order("desc").take(limit);

    // Enrich with order and client information
    const enrichedShippings = [];
    for (const shipping of shippings) {
      const order = await ctx.db.get(shipping.orderId);
      let client = null;
      if (order) {
        client = await ctx.db.get(order.clientId);
      }
      enrichedShippings.push({
        ...shipping,
        order,
        client,
      });
    }

    return enrichedShippings;
  },
});

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
    name: v.string(),
    code: v.optional(v.string()),
    language: v.string(),
    payloadSchema: v.optional(v.any()),
    platform: v.optional(v.string()),
    event: v.optional(v.string()),
    isActive: v.boolean(),
    lastUsed: v.optional(v.number()),
    successCount: v.number(),
    errorCount: v.number(),
    state: v.union(v.literal("building"), v.literal("success"), v.literal("failed")),
    dir: v.optional(v.string()),
    originalPayload: v.optional(v.any()),
    error: v.optional(v.string()),
  })),
  handler: async (ctx, args) => {
    const parsers = await ctx.db.query("parsers").order("desc").collect();
    return parsers.map(parser => ({
      _id: parser._id,
      _creationTime: parser._creationTime,
      uuid: parser.uuid,
      name: parser.name,
      code: parser.code,
      language: parser.language,
      payloadSchema: parser.payloadSchema,
      platform: parser.platform,
      event: parser.event,
      isActive: parser.isActive,
      lastUsed: parser.lastUsed,
      successCount: parser.successCount,
      errorCount: parser.errorCount,
      state: parser.state || "success" as const, // Default to success for backward compatibility
      dir: parser.dir,
      originalPayload: parser.originalPayload,
      error: parser.error,
    }));
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
      name: v.string(),
      language: v.string(),
      code: v.optional(v.string()),
      payloadSchema: v.optional(v.any()),
      platform: v.optional(v.string()),
      event: v.optional(v.string()),
      isActive: v.boolean(),
      lastUsed: v.optional(v.number()),
      successCount: v.number(),
      errorCount: v.number(),
      state: v.union(v.literal("building"), v.literal("success"), v.literal("failed")),
      dir: v.optional(v.string()),
      originalPayload: v.optional(v.any()),
      error: v.optional(v.string()),
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
      name: v.string(),
      language: v.string(),
      code: v.optional(v.string()),
      payloadSchema: v.optional(v.any()),
      platform: v.optional(v.string()),
      event: v.optional(v.string()),
      isActive: v.boolean(),
      lastUsed: v.optional(v.number()),
      successCount: v.number(),
      errorCount: v.number(),
      state: v.union(v.literal("building"), v.literal("success"), v.literal("failed")),
      dir: v.optional(v.string()),
      originalPayload: v.optional(v.any()),
      error: v.optional(v.string()),
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
    platform: v.string(),
    event: v.string(),
  },
  returns: v.array(
    v.object({
      _id: v.id("parsers"),
      _creationTime: v.number(),
      uuid: v.string(),
      name: v.string(),
      language: v.string(),
      code: v.optional(v.string()),
      payloadSchema: v.optional(v.any()),
      platform: v.optional(v.string()),
      event: v.optional(v.string()),
      isActive: v.boolean(),
      lastUsed: v.optional(v.number()),
      successCount: v.number(),
      errorCount: v.number(),
      state: v.union(v.literal("building"), v.literal("success"), v.literal("failed")),
      dir: v.optional(v.string()),
      originalPayload: v.optional(v.any()),
      error: v.optional(v.string()),
    })
  ),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("parsers")
      .withIndex("by_platform_event", (q) =>
        q.eq("platform", args.platform).eq("event", args.event)
      )
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();
  },
});

/**
 * Toggle parser active status
 */
export const toggleParserStatus = mutation({
  args: {
    parserId: v.id("parsers"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const parser = await ctx.db.get(args.parserId);
    if (!parser) throw new Error("Parser not found");

    await ctx.db.patch(args.parserId, {
      isActive: !parser.isActive,
    });

    return null;
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
    name: v.string(),
    language: v.string(),
    code: v.string(),
    payloadSchema: v.any(),
    platform: v.optional(v.string()),
    event: v.optional(v.string()),
  },
  returns: v.id("parsers"),
  handler: async (ctx, args) => {
    return await ctx.db.insert("parsers", {
      uuid: args.uuid,
      name: args.name,
      language: args.language,
      code: args.code,
      payloadSchema: args.payloadSchema,
      platform: args.platform,
      event: args.event,
      isActive: true,
      successCount: 0,
      errorCount: 0,
      state: "success" as const,
    });
  },
});

/**
 * Update parser statistics after execution (internal)
 */
export const updateParserStats = internalMutation({
  args: {
    parserId: v.id("parsers"),
    success: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const parser = await ctx.db.get(args.parserId);
    if (!parser) return null;

    const updates: any = {
      lastUsed: Date.now(),
    };

    if (args.success) {
      updates.successCount = parser.successCount + 1;
    } else {
      updates.errorCount = parser.errorCount + 1;
    }

    await ctx.db.patch(args.parserId, updates);
    return null;
  },
});

/**
 * Public webhook processing mutation - stores parser and processes data
 */
export const processWebhookData = internalMutation({
  args: {
    // Parser data
    parserUuid: v.string(),
    parserName: v.string(),
    parserCode: v.string(),
    payloadSchema: v.any(),
    platform: v.string(),
    event: v.string(),
    // Parsed data
    clientData: v.any(),
    orderData: v.any(),
    shippingData: v.optional(v.any()),
    orderLinesData: v.optional(v.array(v.any())),
  },
  returns: v.object({
    parserId: v.id("parsers"),
    clientId: v.id("clients"),
    orderId: v.id("orders"),
  }),
  handler: async (ctx, args): Promise<{ parserId: Id<"parsers">; clientId: Id<"clients">; orderId: Id<"orders"> }> => {
    // Store parser
    const parserId: Id<"parsers"> = await ctx.db.insert("parsers", {
      uuid: args.parserUuid,
      name: args.parserName,
      language: "javascript",
      code: args.parserCode,
      payloadSchema: args.payloadSchema,
      platform: args.platform,
      event: args.event,
      isActive: true,
      successCount: 0,
      errorCount: 0,
      state: "success" as const,
    });

    // Store client
    const clientId: Id<"clients"> = await ctx.runMutation(internal.webhooks.upsertClient, args.clientData);

    // Store order
    const orderId: Id<"orders"> = await ctx.runMutation(internal.webhooks.upsertOrder, {
      ...args.orderData,
      clientId,
    });

    // Store shipping if present
    if (args.shippingData) {
      await ctx.runMutation(internal.webhooks.upsertShipping, {
        ...args.shippingData,
        orderId,
      });
    }

    // Store order lines if present
    if (args.orderLinesData) {
      for (const line of args.orderLinesData) {
        await ctx.runMutation(internal.webhooks.addOrderLine, {
          ...line,
          orderId,
        });
      }
    }

    return { parserId, clientId, orderId };
  },
});

/**
 * Store a parser with "building" state (for async processing) - Public version
 */
export const storeParserBuildingPublic = mutation({
  args: {
    uuid: v.string(),
    name: v.string(),
    language: v.string(),
    code: v.string(),
    payloadSchema: v.any(),
    platform: v.optional(v.string()),
    event: v.optional(v.string()),
    originalPayload: v.any(), // Store the original payload for processing later
  },
  returns: v.id("parsers"),
  handler: async (ctx, args) => {
    return await ctx.db.insert("parsers", {
      uuid: args.uuid,
      name: args.name,
      language: args.language,
      code: args.code,
      payloadSchema: args.payloadSchema,
      platform: args.platform,
      event: args.event,
      isActive: true,
      successCount: 0,
      errorCount: 0,
      state: "building" as const,
      originalPayload: args.originalPayload, // Store payload for later processing
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
      name: v.string(),
      language: v.string(),
      code: v.optional(v.string()),
      payloadSchema: v.optional(v.any()),
      platform: v.optional(v.string()),
      event: v.optional(v.string()),
      isActive: v.boolean(),
      lastUsed: v.optional(v.number()),
      successCount: v.number(),
      errorCount: v.number(),
      state: v.union(v.literal("building"), v.literal("success"), v.literal("failed")),
      dir: v.optional(v.string()),
      originalPayload: v.optional(v.any()),
      error: v.optional(v.string()),
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
 * Update parser state to success with directory
 */
export const updateParserSuccess = internalMutation({
  args: {
    parserId: v.id("parsers"),
    dir: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.parserId, {
      state: "success" as const,
      dir: args.dir,
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
    dir: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.parserId, {
      state: "success" as const,
      dir: args.dir,
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
    error: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.parserId, {
      state: "failed" as const,
      error: args.error,
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
    error: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.parserId, {
      state: "failed" as const,
      error: args.error,
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

    // Reset parser to building state and clear error
    await ctx.db.patch(args.parserId, {
      state: "building" as const,
      error: undefined,
      code: undefined, // Clear any failed code - will be regenerated during build
      dir: undefined, // Clear any failed directory
    });

    return null;
  },
});

/**
 * Public webhook processing mutation - processes parsed data without creating duplicate parser
 */
export const processWebhookDataPublic = mutation({
  args: {
    // Parsed data
    clientData: v.any(),
    orderData: v.any(),
    shippingData: v.optional(v.any()),
    orderLinesData: v.optional(v.array(v.any())),
  },
  returns: v.object({
    clientId: v.id("clients"),
    orderId: v.id("orders"),
  }),
  handler: async (ctx, args): Promise<{ clientId: Id<"clients">; orderId: Id<"orders"> }> => {
    // Store client
    const clientId: Id<"clients"> = await ctx.runMutation(internal.webhooks.upsertClient, args.clientData);

    // Store order
    const orderId: Id<"orders"> = await ctx.runMutation(internal.webhooks.upsertOrder, {
      ...args.orderData,
      clientId,
    });

    // Store shipping if present
    if (args.shippingData) {
      await ctx.runMutation(internal.webhooks.upsertShipping, {
        ...args.shippingData,
        orderId,
      });
    }

    // Store order lines if present
    if (args.orderLinesData && args.orderLinesData.length > 0) {
      for (const orderLine of args.orderLinesData) {
        await ctx.runMutation(internal.webhooks.addOrderLine, {
          ...orderLine,
          orderId,
        });
      }
    }

    return {
      clientId,
      orderId,
    };
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

    if (!parser || parser.state !== "building") {
      throw new Error("Parser not found or not in building state");
    }

    try {
      // Execute the parser with the original payload
      const parseFunction = new Function(
        "payload",
        `${parser.code || ""}\nreturn exec(payload);`
      );

      const result = parseFunction(parser.originalPayload);

      if (result && result.client && result.order) {
        // Process the parsed data
        const processResult = await ctx.runMutation(internal.procedures.processWebhookData, {
          parserUuid: parser.uuid,
          parserName: parser.name,
          parserCode: parser.code || "",
          payloadSchema: parser.payloadSchema,
          platform: parser.platform || "unknown",
          event: parser.event || "webhook",
          clientData: result.client,
          orderData: result.order,
          shippingData: result.shipping,
          orderLinesData: result.orderLines,
        });

        // Update parser to success state with directory
        const parserDir = `/parsers/${parser.uuid}`;
        await ctx.runMutation(internal.procedures.updateParserSuccess, {
          parserId: args.parserId,
          dir: parserDir,
        });

        console.log(`✅ Parser ${parser.uuid} processed successfully`);
        console.log(`Parser ID: ${processResult.parserId}, Order ID: ${processResult.orderId}`);
      } else {
        throw new Error("Parser execution failed - invalid result structure");
      }
    } catch (error) {
      console.error(`❌ Parser ${parser.uuid} processing failed:`, error);

      // Update parser to failed state
      await ctx.runMutation(internal.procedures.updateParserFailed, {
        parserId: args.parserId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }

    return null;
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
      name: v.string(),
      language: v.string(),
      code: v.optional(v.string()),
      payloadSchema: v.optional(v.any()),
      platform: v.optional(v.string()),
      event: v.optional(v.string()),
      isActive: v.boolean(),
      lastUsed: v.optional(v.number()),
      successCount: v.number(),
      errorCount: v.number(),
      state: v.union(v.literal("building"), v.literal("success"), v.literal("failed")),
      dir: v.optional(v.string()),
      error: v.optional(v.string()),
      originalPayload: v.optional(v.any()),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    return await ctx.db.get(args.parserId);
  },
});
