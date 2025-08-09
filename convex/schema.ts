import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const clientSchema = {
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
};

export const orderSchema = {
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
};

export const shippingSchema = {
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
};

export const orderLinesSchema = {
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
};

export default defineSchema({
  // E-commerce core tables
  clients: defineTable(clientSchema)
    .index("by_platform_id", ["platform", "platformId"])
    .index("by_email", ["email"])
    .index("by_phone", ["phone"]),

  orders: defineTable(orderSchema)
    .index("by_client", ["clientId"])
    .index("by_platform_order", ["platform", "platformOrderId"])
    .index("by_status", ["status"])
    .index("by_order_date", ["orderDate"]),

  shippings: defineTable(shippingSchema)
    .index("by_order", ["orderId"])
    .index("by_tracking", ["trackingNumber"])
    .index("by_status", ["status"]),

  order_lines: defineTable(orderLinesSchema)
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
    language: v.string(), // Programming language (javascript, python, etc.)
    code: v.optional(v.string()), // The generated parser code (optional for building parsers)
    event: v.string(), // Event type this parser handles (optional)
    fingerprint: v.string(), // Payload structure fingerprint for reuse detection
    payload: v.string(), // The original payload for the parser
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
    .index("by_event", ["event"]),

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
});
