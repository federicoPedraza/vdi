import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api, internal } from "./_generated/api";

const http = httpRouter();

/**
 * Universal webhook receiver endpoint
 * Accepts webhooks from any platform (Tiendanube, Shopify, WooCommerce, etc.)
 *
 * URL structure: /webhooks/{platform}/{event}
 * Example: /webhooks/tiendanube/order-created
 *          /webhooks/shopify/orders/create
 *          /webhooks/woocommerce/order.updated
 */
http.route({
  path: "/webhooks/{platform}/{event}",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      // Extract platform and event from URL
      const url = new URL(request.url);
      const pathParts = url.pathname.split('/');
      const platform = pathParts[2]; // /webhooks/{platform}/{event}
      const event = pathParts[3];

      if (!platform || !event) {
        return new Response(
          JSON.stringify({ error: "Missing platform or event in URL" }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" }
          }
        );
      }

      // Parse webhook payload
      const payload = await request.json();

      console.log(`Received webhook: ${platform}/${event}`, {
        headers: request.headers,
        payload: payload
      });

      // Log the webhook
      await ctx.runMutation(internal.webhooks.logWebhook, {
        platform,
        event,
        payload,
        processed: false,
      });

      // Process using AI-powered parser generation
      console.log('Starting AI-powered webhook processing...');

      try {
        // Generate and execute parser for this webhook
        const generateResult = await ctx.runAction(api.parserGenerator.generateParser, {
          payload,
          platform,
          event,
          language: "javascript"
        });

        if (!generateResult.success) {
          console.error('Failed to generate parser:', generateResult.error);
          return new Response(
            JSON.stringify({
              received: true,
              processed: false,
              error: "Parser generation failed",
              details: generateResult.error
            }),
            {
              status: 500,
              headers: { "Content-Type": "application/json" }
            }
          );
        }

        // Execute the generated parser
        const parser = await ctx.runQuery(api.procedures.getParserByUuid, {
          uuid: generateResult.parserId
        });

        if (!parser) {
          console.error('Generated parser not found');
          return new Response(
            JSON.stringify({
              received: true,
              processed: false,
              error: "Generated parser not found"
            }),
            {
              status: 500,
              headers: { "Content-Type": "application/json" }
            }
          );
        }

        const executionResult = await ctx.runAction(internal.parserGenerator.executeParser, {
          parserUuid: parser.uuid,
          payload
        });

        if (!executionResult || !executionResult.success) {
          console.error('Parser execution failed:', executionResult?.error);
          return new Response(
            JSON.stringify({
              received: true,
              processed: false,
              error: "Parser execution failed",
              details: executionResult?.error
            }),
            {
              status: 500,
              headers: { "Content-Type": "application/json" }
            }
          );
        }

        // Process the parsed data
        const processedData = executionResult.result;
        if (processedData && processedData.client && processedData.order) {
          console.log('Storing parsed data in database...');

          // Store client first
          const clientId = await ctx.runMutation(internal.webhooks.upsertClient, {
            platformId: processedData.client.platformId,
            platform: processedData.client.platform,
            email: processedData.client.email,
            phone: processedData.client.phone,
            firstName: processedData.client.firstName,
            lastName: processedData.client.lastName,
            address: processedData.client.address,
            storeId: processedData.client.storeId,
          });

          // Store order
          const orderId = await ctx.runMutation(internal.webhooks.upsertOrder, {
            clientId,
            platformOrderId: processedData.order.platformOrderId,
            platform: processedData.order.platform,
            orderNumber: processedData.order.orderNumber,
            status: processedData.order.status,
            total: processedData.order.total,
            currency: processedData.order.currency,
            orderDate: processedData.order.orderDate,
            paidDate: processedData.order.paidDate,
            fulfilledDate: processedData.order.fulfilledDate,
            notes: processedData.order.notes,
            paymentMethod: processedData.order.paymentMethod,
            storeId: processedData.order.storeId,
          });

          // Store shipping if present
          if (processedData.shipping && processedData.shipping.address) {
            await ctx.runMutation(internal.webhooks.upsertShipping, {
              orderId,
              trackingNumber: processedData.shipping.trackingNumber,
              carrier: processedData.shipping.carrier,
              status: processedData.shipping.status,
              shippedDate: processedData.shipping.shippedDate,
              deliveredDate: processedData.shipping.deliveredDate,
              shippingAddress: processedData.shipping.address,
              platform: platform,
            });
          }

          // Store order lines if present
          if (processedData.orderLines && Array.isArray(processedData.orderLines)) {
            for (const line of processedData.orderLines) {
              await ctx.runMutation(internal.webhooks.addOrderLine, {
                orderId,
                productId: line.productId,
                sku: line.sku,
                productName: line.name,
                quantity: line.quantity,
                unitPrice: line.price,
                totalPrice: line.total,
                platform: platform,
              });
            }
          }

          console.log('Data stored successfully');
        }

        console.log(`AI webhook processing completed successfully: ${platform}/${event}`);

        return new Response(
          JSON.stringify({
            received: true,
            processed: true,
            parserId: generateResult.parserId,
            message: "Webhook processed successfully with AI parser"
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" }
          }
        );

      } catch (processingError) {
        console.error('Error in AI webhook processing:', processingError);
        const errorMessage = processingError instanceof Error ? processingError.message : "Unknown processing error";

        return new Response(
          JSON.stringify({
            received: true,
            processed: false,
            error: "AI processing failed",
            details: errorMessage
          }),
          {
            status: 500,
            headers: { "Content-Type": "application/json" }
          }
        );
      }

    } catch (error) {
      console.error('Error processing webhook:', error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";

      return new Response(
        JSON.stringify({
          received: true,
          processed: false,
          error: errorMessage
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" }
        }
      );
    }
  }),
});

/**
 * Legacy Tiendanube webhook endpoint for backwards compatibility
 * Redirects to the new universal endpoint
 */
http.route({
  path: "/api/webhooks/tiendanube/{event}",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    // Extract event from URL
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const event = pathParts[pathParts.length - 1];

    // Parse payload
    const payload = await request.json();

    // Note: Webhook processing has been moved to backend API routes
    // This legacy endpoint now only acknowledges receipt
    console.log(`Legacy webhook acknowledged: tiendanube/${event}`);

    return new Response(
      JSON.stringify({
        received: true,
        note: "Webhook processing moved to API routes. Use /api/webhooks/tiendanube/{event} instead."
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" }
      }
    );
  }),
});

export default http;
