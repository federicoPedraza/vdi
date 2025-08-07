import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // E-commerce core tables
  clients: defineTable({
    // Basic client information
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    // External platform reference
    platformId: v.string(), // ID from the external platform (Tiendanube, Shopify, etc.)
    platform: v.string(), // "tiendanube", "shopify", "woocommerce", etc.
    // Additional client data
    address: v.optional(v.object({
      street: v.optional(v.string()),
      city: v.optional(v.string()),
      state: v.optional(v.string()),
      country: v.optional(v.string()),
      zipCode: v.optional(v.string()),
    })),
    // Store metadata
    storeId: v.optional(v.string()),
  })
    .index("by_platform_id", ["platform", "platformId"])
    .index("by_email", ["email"])
    .index("by_phone", ["phone"]),

  orders: defineTable({
    // Reference to client
    clientId: v.id("clients"),
    // Order identification
    platformOrderId: v.string(), // Order ID from external platform
    platform: v.string(), // "tiendanube", "shopify", "woocommerce", etc.
    orderNumber: v.optional(v.string()),
    // Order details
    status: v.string(), // "pending", "paid", "fulfilled", "cancelled", etc.
    total: v.number(),
    currency: v.string(),
    // Dates
    orderDate: v.number(), // timestamp
    paidDate: v.optional(v.number()),
    fulfilledDate: v.optional(v.number()),
    // Additional order data
    notes: v.optional(v.string()),
    paymentMethod: v.optional(v.string()),
    // Store metadata
    storeId: v.optional(v.string()),
  })
    .index("by_client", ["clientId"])
    .index("by_platform_order", ["platform", "platformOrderId"])
    .index("by_status", ["status"])
    .index("by_order_date", ["orderDate"]),

  shippings: defineTable({
    // Reference to order
    orderId: v.id("orders"),
    // Shipping details
    trackingNumber: v.optional(v.string()),
    carrier: v.optional(v.string()),
    method: v.optional(v.string()),
    status: v.string(), // "pending", "in_transit", "delivered", "returned", etc.
    // Shipping address
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
    // Dates
    shippedDate: v.optional(v.number()),
    estimatedDelivery: v.optional(v.number()),
    deliveredDate: v.optional(v.number()),
    // Costs
    shippingCost: v.optional(v.number()),
    // Platform data
    platformShippingId: v.optional(v.string()),
    platform: v.string(),
  })
    .index("by_order", ["orderId"])
    .index("by_tracking", ["trackingNumber"])
    .index("by_status", ["status"]),

  order_lines: defineTable({
    // Reference to order
    orderId: v.id("orders"),
    // Product information
    productId: v.optional(v.string()), // External platform product ID
    productName: v.string(),
    variantId: v.optional(v.string()),
    variantName: v.optional(v.string()),
    sku: v.optional(v.string()),
    // Quantities and pricing
    quantity: v.number(),
    unitPrice: v.number(),
    totalPrice: v.number(),
    // Product details
    weight: v.optional(v.number()),
    dimensions: v.optional(v.object({
      length: v.optional(v.number()),
      width: v.optional(v.number()),
      height: v.optional(v.number()),
    })),
    // Platform data
    platformLineId: v.optional(v.string()),
    platform: v.string(),
  })
    .index("by_order", ["orderId"])
    .index("by_product", ["productId"])
    .index("by_sku", ["sku"]),

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
    name: v.string(), // Human-readable name for the parser
    language: v.string(), // Programming language (javascript, python, etc.)
    code: v.optional(v.string()), // The generated parser code (optional for building parsers)
    payloadSchema: v.optional(v.any()), // JSON schema of the expected payload structure (optional for building parsers)
    platform: v.optional(v.string()), // Platform this parser is for (optional)
    event: v.optional(v.string()), // Event type this parser handles (optional)
    isActive: v.boolean(), // Whether this parser is currently active
    lastUsed: v.optional(v.number()), // Timestamp when parser was last used
    successCount: v.number(), // Number of successful executions
    errorCount: v.number(), // Number of failed executions
    state: v.union(v.literal("building"), v.literal("success"), v.literal("failed")), // Parser processing state
    dir: v.optional(v.string()), // Directory where parser is stored (when successful)
    originalPayload: v.optional(v.any()), // Original payload for building parsers
    error: v.optional(v.string()), // Error message for failed parsers
  })
    .index("by_uuid", ["uuid"])
    .index("by_platform_event", ["platform", "event"])
    .index("by_active", ["isActive"])
    .index("by_last_used", ["lastUsed"])
    .index("by_state", ["state"]),
});
