# AI-Powered Webhook Processing System

This system automatically generates and executes parsers to convert webhook payloads from any e-commerce platform into your unified order schema using AI.

## Features

- **AI Parser Generation**: Uses Ollama to generate JavaScript parsers that understand webhook structures
- **Runtime Execution**: Safely executes generated parsers in a sandboxed environment
- **Automatic Processing**: Webhooks trigger parser generation, execution, and data storage
- **Parser Management**: Track parser usage, success rates, and manage via UI
- **Multi-Platform**: Works with Tiendanube, Shopify, WooCommerce, and any webhook format

## Prerequisites

1. **Ollama**: Install and run Ollama with the `gpt-oss:20b` model
   ```bash
   # Install Ollama (see https://ollama.ai)
   ollama pull gpt-oss:20b
   ollama serve
   ```

2. **Convex Deployment**: Your Convex backend should be deployed and accessible

## Usage

### Webhook Endpoints

Send webhooks to: `https://your-deployment.convex.site/webhooks/{platform}/{event}`

Examples:
- `https://your-deployment.convex.site/webhooks/tiendanube/order-created`
- `https://your-deployment.convex.site/webhooks/shopify/orders-create`
- `https://your-deployment.convex.site/webhooks/woocommerce/order-updated`

### Testing

Test the system using curl commands:

```bash
# Test Tiendanube webhook
curl -X POST http://localhost:3000/api/webhooks/tiendanube/order-created \
  -H "Content-Type: application/json" \
  -d '{"event":"order/created","id":12345,"store_id":123456}'

# Test Shopify webhook
curl -X POST http://localhost:3000/api/webhooks/shopify/orders-create \
  -H "Content-Type: application/json" \
  -d '{"event":"orders/create","id":4567890123456789,"store_id":123456}'

# Test unknown provider webhook with complete order data (slugged partner)
curl -X POST http://localhost:3000/api/{your-partner-slug}/webhooks/vii/order-created \
  -H "Content-Type: application/json" \
  -d '{
  "example": "data",
  "client": {
    "email": "john.doe@example.com",
    "firstName": "John",
    "lastName": "Doe"
  },
  "order": {
    "id": "ORD-2024-001",
    "total": 100.50,
    "currency": "USD"
  }
}'
```

Or create a simple Node.js test script outside your project directory.

### Parser Management

Use the `ParsersTable` component in your React app to:
- View all generated parsers
- See success/failure rates
- Enable/disable parsers
- Delete old parsers

## How It Works

1. **Webhook Reception**: HTTP endpoint receives webhook payload
2. **AI Analysis**: Ollama analyzes the payload structure and generates a parser
3. **Parser Storage**: Generated parser is stored with UUID and metadata
4. **Execution**: Parser converts webhook data to your order schema
5. **Data Storage**: Converted data is saved to your database (clients, orders, shipping, order lines)

## Generated Schema

Parsers convert webhook data to these schemas:

### Client Schema
```javascript
{
  platformId: string,     // ID from external platform
  platform: string,       // "tiendanube", "shopify", etc.
  email?: string,
  phone?: string,
  firstName?: string,
  lastName?: string,
  address?: {
    street?: string,
    city?: string,
    state?: string,
    country?: string,
    zipCode?: string
  },
  storeId?: string
}
```

### Order Schema
```javascript
{
  clientId: string,           // Reference to client
  platformOrderId: string,    // Order ID from external platform
  platform: string,           // Platform name
  orderNumber?: string,
  status: string,             // "pending", "paid", "fulfilled", "cancelled"
  total: number,
  currency: string,
  orderDate: number,          // timestamp
  paidDate?: number,          // timestamp
  fulfilledDate?: number,     // timestamp
  notes?: string,
  paymentMethod?: string,
  storeId?: string
}
```

### Shipping Schema (Optional)
```javascript
{
  orderId: string,            // Reference to order
  trackingNumber?: string,
  carrier?: string,
  status: string,             // "pending", "shipped", "delivered"
  shippedDate?: number,
  deliveredDate?: number,
  shippingAddress: {
    firstName?: string,
    lastName?: string,
    street?: string,
    city?: string,
    state?: string,
    country?: string,
    zipCode?: string,
    phone?: string
  },
  platform: string
}
```

### Order Lines Schema (Optional)
```javascript
{
  orderId: string,            // Reference to order
  productId?: string,         // External platform product ID
  productName: string,
  variantId?: string,
  variantName?: string,
  sku?: string,
  quantity: number,
  unitPrice: number,
  totalPrice: number,
  weight?: number,
  dimensions?: {
    length?: number,
    width?: number,
    height?: number
  },
  platform: string
}
```

## Configuration

The system uses these environment variables:
- `CONVEX_URL`: Your Convex deployment URL
- `NEXT_PUBLIC_CONVEX_URL`: For client-side connections

## Error Handling

The system handles errors gracefully:
- Failed parser generation returns error details
- Parser execution failures are logged with context
- Invalid webhooks are acknowledged but not processed
- All errors are stored in webhook logs for debugging

## Security

- Parsers run in a sandboxed JavaScript environment
- Limited access to safe JavaScript APIs only
- No file system or network access from parsers
- Generated code is stored and can be reviewed

## Monitoring

Track system health through:
- Parser success/failure rates in the UI
- Webhook logs in the database
- Convex function logs in the dashboard
- Parser execution statistics

## Troubleshooting

**Parser Generation Fails:**
- Ensure Ollama is running on localhost:11434
- Check that `gpt-oss:20b` model is available
- Verify webhook payload is valid JSON

**Parser Execution Fails:**
- Check generated parser code for syntax errors
- Verify webhook structure matches expected format
- Review parser execution logs in Convex dashboard

**Data Not Stored:**
- Ensure required fields are present in parsed data
- Check database schema matches expected format
- Verify client creation succeeded before order creation
