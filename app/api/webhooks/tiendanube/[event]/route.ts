import { NextRequest, NextResponse } from 'next/server';
import { TiendanubeAPI } from '@/lib/tiendanube';
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { v4 as uuidv4 } from "uuid";

// Tiendanube-specific webhook payload interface
interface TiendanubeWebhookPayload {
  event: string;
  id: number;
  store_id: number;
}

// Extended payload with order details for parser generation
interface OrderDetailsPayload {
  webhookEvent: string;
  orderId: number;
  storeId: number;
  orderData?: any; // Full order object from Tiendanube API
  error?: string;
  originalWebhook?: TiendanubeWebhookPayload;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ event: string }> }
) {
    const { event } = await params;
    const body = await request.json() as TiendanubeWebhookPayload;
    console.log(`Received Tiendanube webhook: ${event}`, body);

    // Process with AI parser generator on server side
    try {
        const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL || 'https://famous-firefly-743.convex.cloud';
        const convex = new ConvexHttpClient(convexUrl);

        console.log('Storing parser metadata for later processing...');

        const parserName = `tiendanube_${event}_parser_${Date.now()}`;

        // Generate UUID for parser
        const parserUuid = uuidv4();

        // Determine the payload to use for parser generation
        let payloadForParser: TiendanubeWebhookPayload | OrderDetailsPayload = body;

        // Check if this is an order-related event and fetch order details
        if (event.toLowerCase().includes('order') && body.id && body.store_id) {
            try {
                // Using hardcoded access token for now
                const accessToken = "a8f14a6e794618ab232b4b815f2154a5ab369a1c";
                console.log(`Fetching order ${body.id} from store ${body.store_id}`);

                // Initialize Tiendanube API client and fetch order data
                const tiendanube = new TiendanubeAPI(accessToken, body.store_id.toString());
                const orderData = await tiendanube.getOrder(body.id);

                // Use order details as the payload instead of raw webhook
                payloadForParser = {
                    webhookEvent: body.event,
                    orderId: body.id,
                    storeId: body.store_id,
                    orderData: orderData // Full order object from Tiendanube API
                } as OrderDetailsPayload;

                console.log('✅ Order data fetched successfully');
            } catch (fetchError) {
                console.error('Error fetching order data:', fetchError);
                // Use webhook payload with error information
                payloadForParser = {
                    error: 'Failed to fetch order details',
                    webhookEvent: body.event,
                    orderId: body.id,
                    storeId: body.store_id,
                    originalWebhook: body
                } as OrderDetailsPayload;
            }
        }

        // Store parser with "building" state instead of processing immediately
        const parserId = await convex.mutation(api.procedures.storeParserBuildingPublic, {
            uuid: parserUuid,
            name: parserName,
            language: "javascript",
            code: "// Parser code will be generated when processed", // Placeholder code
            payloadSchema: payloadForParser,
            platform: "tiendanube",
            event: event,
            originalPayload: payloadForParser, // Store the order details for later processing
        });

        console.log('✅ Parser saved with "building" state');
        console.log(`Parser UUID: ${parserUuid}, Parser ID: ${parserId}`);
        console.log('📝 Parser will be processed later from the parsers page');

        // Return success response immediately after storing
        return NextResponse.json({
            message: "Webhook received and parser stored",
            parserId: parserId,
            parserUuid: parserUuid,
            status: "building"
        }, { status: 200 });

    } catch (error) {
        console.error('Error in AI processing:', error);
        // Return error response but don't fail the webhook
        return NextResponse.json({
            message: "Webhook received but parser generation failed",
            error: error instanceof Error ? error.message : "Unknown error"
        }, { status: 200 });
    }
}
