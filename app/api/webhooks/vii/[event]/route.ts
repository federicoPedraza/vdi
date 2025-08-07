import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { v4 as uuidv4 } from "uuid";

export async function POST(request: NextRequest, { params }: { params: Promise<{ event: string }> }) {
    const { event } = await params;
    const body = await request.json();
    console.log(`Received webhook: ${event}`, body);
            // Process with AI parser generator on server side
    try {
        const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL || 'https://famous-firefly-743.convex.cloud';
        const convex = new ConvexHttpClient(convexUrl);

        console.log('Storing parser metadata for later processing...');

        const parserName = `vii_${event}_parser_${Date.now()}`;

        // Generate UUID for parser
        const parserUuid = uuidv4();

        // Store parser with "building" state instead of processing immediately
        const parserId = await convex.mutation(api.procedures.storeParserBuildingPublic, {
            uuid: parserUuid,
            name: parserName,
            language: "javascript",
            code: "// Parser code will be generated when processed", // Placeholder code
            payloadSchema: body,
            platform: "vii",
            event: event,
            originalPayload: body, // Store the original payload for later processing
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
