import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get("octos_session")?.value;
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const body = await req.json();
    const { uuid, event, payload, fingerprint, language, schemaAssignments } = body as {
      uuid: string;
      event: string;
      payload: string;
      fingerprint: string;
      language?: string;
      schemaAssignments: Array<{ schemaId: Id<"project_schemas">; asArray?: boolean }>;
    };

    if (!uuid || !event || !payload || !fingerprint || !Array.isArray(schemaAssignments) || schemaAssignments.length === 0) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const result = await convex.mutation(api.authDb.createParserForSession, {
      token,
      uuid,
      event,
      payload,
      fingerprint,
      language,
      schemaAssignments,
    })
    return NextResponse.json(result, { status: 200 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}


