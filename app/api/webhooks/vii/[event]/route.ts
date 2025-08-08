import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { v4 as uuidv4 } from "uuid";

function generateFingerprint(payload: any): string {
  return Object
    .keys(payload || {})
    .sort()
    .join('|');
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ event: string }> }) {
    const { event } = await params;
    const body = await request.json();
    console.log(`Received webhook: ${event}`, body);
            // Process with AI parser generator on server side
    try {
        const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL || 'https://famous-firefly-743.convex.cloud';
        const convex = new ConvexHttpClient(convexUrl);

        // Generate fingerprint from payload structure
        const fingerprint = generateFingerprint(body);

        // Check if we already have a parser for this fingerprint
        const existingParser = await convex.query(api.procedures.getParserByFingerprint, {
            fingerprint: fingerprint
        });

        if (existingParser) {
                        console.log('✅ Found existing parser for fingerprint, reusing...');
            console.log(`Existing parser: ${existingParser.uuid}`);

            // TODO: Execute the existing parser here
            console.log('🚀 Would execute existing parser...');
            return NextResponse.json({
                message: "Webhook received and processed with existing parser",
                parserId: existingParser._id,
                parserUuid: existingParser.uuid,
                status: "reused",
                fingerprint: fingerprint
            }, { status: 200 });
        }

        console.log('No existing parser found, creating new one...');

        // Generate UUID for parser
        const parserUuid = uuidv4();

        // Store parser initially as idle and process later
        const parserId = await convex.mutation(api.procedures.storeParserBuildingPublic, {
            uuid: parserUuid,
            language: "javascript",
            code: "// Parser code will be generated when processed", // Placeholder code
            payload: JSON.stringify(body),
            event: event,
            fingerprint,
        });

        console.log('✅ Parser saved with "building" state');
        console.log(`Parser UUID: ${parserUuid}, Parser ID: ${parserId}`);
        console.log('📝 Parser will be processed later from the parsers page');

        // Return success response immediately after storing
        return NextResponse.json({
            message: "Webhook received and parser stored",
            parserId: parserId,
            parserUuid: parserUuid,
            status: "idle"
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
