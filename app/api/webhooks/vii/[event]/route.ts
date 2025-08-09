import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { v4 as uuidv4 } from "uuid";

function getType(value: any): string {
    if (value === null) return "null";
    if (Array.isArray(value)) return "array";
    return typeof value;
}

function buildSignature(obj: any): string {
    if (Array.isArray(obj)) {
        if (obj.length === 0) return "[]";
        return `[${buildSignature(obj[0])}]`;
    } else if (obj && typeof obj === "object") {
        const keys = Object.keys(obj).sort();
        const inner = keys.map(key => {
            const val = buildSignature(obj[key]);
            return `${key}:${val}`;
        }).join(",");
        return `{${inner}}`;
    } else {
        return getType(obj);
    }
}

export function getFingerprint(payload: any): string {
    if (typeof payload !== "object" || payload == null) return getType(payload);
    const keys = Object.keys(payload).sort();
    return keys.map(key => `${key}:${buildSignature(payload[key])}`).join(";");
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ event: string }> }) {
    const { event } = await params;
    const body = await request.json();
    console.log(`Received webhook: ${event}`, body);
    // Process with AI parser generator on server side
    try {
        const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL || 'https://famous-firefly-743.convex.cloud';
        const convex = new ConvexHttpClient(convexUrl);

        // Require a valid partner via session cookie
        const token = request.cookies.get('octos_session')?.value;
        if (!token) {
            return NextResponse.json({ message: "Partner authentication required" }, { status: 401 });
        }
        const partner = await convex.query(api.authDb.getPartnerBySession as any, { token });
        if (!partner?._id) {
            return NextResponse.json({ message: "Invalid or expired session" }, { status: 401 });
        }
        const partnerId: any = partner._id as any;

        // Generate fingerprint from payload structure
        const fingerprint = getFingerprint(body);

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
            partnerId,
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
