# Webhook Processing System

This system provides a universal webhook receiver that can handle webhooks from multiple e-commerce platforms (Tiendanube, Shopify, WooCommerce, etc.) and process them into a unified database schema.

## Architecture

### Database Schema

The system uses four main tables with the following relationships:

- **clients**: Customer information
- **orders**: Order data (references clients)
- **shippings**: Shipping information (references orders)
- **order_lines**: Order line items (references orders)

### Webhook Flow

1. **HTTP Endpoint** (`convex/http.ts`):
   - Universal endpoint: `/webhooks/{platform}/{event}`
   - Legacy endpoint: `/api/webhooks/tiendanube/{event}` (backwards compatibility)

2. **Webhook Processing** (`convex/webhooks.ts`):
   - Routes webhooks to appropriate handlers
   - Logs all webhook events for debugging
   - Provides error handling and retry logic

3. **Database Procedures** (`convex/procedures.ts`):
   - CRUD operations for all tables
   - Upsert functions for handling duplicates
   - Comprehensive queries with joins

## Usage

### Webhook URLs

For any platform, use this URL structure:
```
https://your-domain.convex.site/webhooks/{platform}/{event}
```

Examples:
- `https://your-domain.convex.site/webhooks/tiendanube/order-created`
- `https://your-domain.convex.site/webhooks/shopify/orders/create`
- `https://your-domain.convex.site/webhooks/woocommerce/order.updated`

### Processing Custom Webhooks

To add support for a new platform or event:

1. **Update the webhook processor** in `convex/webhooks.ts`:
   ```typescript
   export const processOrderWebhook = internalMutation({
     // Add platform-specific parsing logic here
   });
   ```

2. **Use the database procedures** to store data:
   ```typescript
   // Example: processing a Shopify order webhook
   const clientId = await ctx.runMutation(internal.webhooks.upsertClient, {
     platformId: payload.customer.id,
     platform: "shopify",
     email: payload.customer.email,
     // ... other fields
   });

   const orderId = await ctx.runMutation(internal.webhooks.upsertOrder, {
     clientId,
     platformOrderId: payload.id,
     platform: "shopify",
     // ... other fields
   });
   ```

### Available Procedures

#### Client Operations
- `createClient` - Create new client
- `updateClient` - Update existing client
- `getClientByPlatformId` - Find client by platform ID
- `getClientsByEmail` - Find clients by email
- `deleteClient` - Delete client and all related data

#### Order Operations
- `createOrder` - Create new order
- `updateOrderStatus` - Update order status
- `getOrderByPlatformId` - Find order by platform ID
- `getOrdersByClient` - Get all orders for a client
- `getOrdersByStatus` - Get orders by status

#### Shipping Operations
- `createShipping` - Create shipping information
- `updateShippingStatus` - Update shipping status
- `getShippingByOrder` - Get shipping for an order
- `getShippingByTracking` - Find shipping by tracking number

#### Order Line Operations
- `createOrderLine` - Add product to order
- `getOrderLinesByOrder` - Get all products in an order
- `updateOrderLineQuantity` - Update product quantity
- `deleteOrderLine` - Remove product from order

#### Comprehensive Queries
- `getCompleteOrder` - Get order with client, shipping, and lines
- `getRecentOrders` - Get recent orders with pagination

### Webhook Logging

All webhooks are automatically logged to the `webhook_logs` table for debugging:

```typescript
// Get recent webhook logs
const logs = await ctx.runQuery(api.webhooks.getWebhookLogs, { limit: 100 });
```

### Error Handling

The system provides comprehensive error handling:
- Failed webhooks are logged with error messages
- Webhooks are marked as processed/failed for monitoring
- Duplicate data is handled via upsert operations

## Testing

You can test webhook processing by sending POST requests to your webhook endpoints:

```bash
curl -X POST https://your-domain.convex.site/webhooks/test/order-created \
  -H "Content-Type: application/json" \
  -d '{"test": "data"}'
```

The webhook will be logged and you can check the processing status via the `getWebhookLogs` query.
