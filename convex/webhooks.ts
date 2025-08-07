import {
  query,
  internalMutation,
} from "./_generated/server";
import { v } from "convex/values";

// ===== WEBHOOK PROCESSING =====

// The main webhook processing is now handled directly in the API routes

// ===== WEBHOOK EVENT HANDLERS =====

export const processOrderWebhook = internalMutation({
  args: {
    platform: v.string(),
    event: v.string(),
    payload: v.any(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // This is where specific order processing logic would go
    // For now, it's an empty procedure that can be extended
    console.log(`Processing ${args.event} order webhook from ${args.platform}`);

    // Example structure for future implementation:
    // - Extract order data from payload
    // - Upsert client information
    // - Upsert order information
    // - Process order lines
    // - Handle shipping information

    return null;
  },
});

export const processClientWebhook = internalMutation({
  args: {
    platform: v.string(),
    event: v.string(),
    payload: v.any(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // This is where specific client processing logic would go
    console.log(`Processing ${args.event} client webhook from ${args.platform}`);

    return null;
  },
});

// ===== DATABASE PROCEDURES =====

/**
 * Upsert a client (create or update if exists)
 */
export const upsertClient = internalMutation({
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
    // Look for existing client
    const existingClient = await ctx.db
      .query("clients")
      .withIndex("by_platform_id", (q) =>
        q.eq("platform", args.platform).eq("platformId", args.platformId)
      )
      .unique();

    if (existingClient) {
      // Update existing client
      await ctx.db.patch(existingClient._id, {
        email: args.email,
        phone: args.phone,
        firstName: args.firstName,
        lastName: args.lastName,
        address: args.address,
        storeId: args.storeId,
      });
      return existingClient._id;
    } else {
      // Create new client
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
    }
  },
});

/**
 * Upsert an order (create or update if exists)
 */
export const upsertOrder = internalMutation({
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
    // Look for existing order
    const existingOrder = await ctx.db
      .query("orders")
      .withIndex("by_platform_order", (q) =>
        q.eq("platform", args.platform).eq("platformOrderId", args.platformOrderId)
      )
      .unique();

    if (existingOrder) {
      // Update existing order
      await ctx.db.patch(existingOrder._id, {
        clientId: args.clientId,
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
      return existingOrder._id;
    } else {
      // Create new order
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
    }
  },
});

/**
 * Create or update shipping information
 */
export const upsertShipping = internalMutation({
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
    // Look for existing shipping by order
    const existingShipping = await ctx.db
      .query("shippings")
      .withIndex("by_order", (q) => q.eq("orderId", args.orderId))
      .first();

    if (existingShipping) {
      // Update existing shipping
      await ctx.db.patch(existingShipping._id, {
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
      return existingShipping._id;
    } else {
      // Create new shipping
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
    }
  },
});

/**
 * Add order lines to an order
 */
export const addOrderLine = internalMutation({
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

// ===== QUERY FUNCTIONS =====

/**
 * Get all clients
 */
export const getClients = query({
  args: {},
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
    return await ctx.db.query("clients").collect();
  },
});

/**
 * Get orders with client information
 */
export const getOrdersWithClient = query({
  args: {},
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const orders = await ctx.db.query("orders").collect();

    const ordersWithClients = [];
    for (const order of orders) {
      const client = await ctx.db.get(order.clientId);
      ordersWithClients.push({
        ...order,
        client,
      });
    }

    return ordersWithClients;
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
