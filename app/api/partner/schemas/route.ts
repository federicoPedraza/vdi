import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get("octos_session")?.value;
    if (!token) return NextResponse.json({ schemas: [] }, { status: 200 });
    const items = await convex.query(api.authDb.listSchemasByActiveProject, { token });
    return NextResponse.json({ schemas: items || [] });
  } catch {
    return NextResponse.json({ schemas: [] }, { status: 200 });
  }
}

export async function PUT(req: NextRequest) {
  // Assign or unassign schemas to a parser (optional future use)
  try {
    const token = req.cookies.get("octos_session")?.value;
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const body = await req.json();
    const { parserId } = body as { parserId?: string };
    if (!parserId) return NextResponse.json({ error: "Missing parserId" }, { status: 400 });
    // This endpoint reserved for future assignments management if needed from UI list
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get("octos_session")?.value;
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const body = await req.json();
    const { name, key, alias, color } = body;
    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }
    // Be tolerant of invalid JSON in definition: if parsing fails, store the raw string
    let def = body?.definition;
    if (typeof def === "string") {
      try {
        def = JSON.parse(def);
      } catch {
        // keep as string
      }
    }
    const { schemaId } = await convex.mutation(api.authDb.upsertSchemaByName, {
      token,
      name: name.trim(),
      definition: def ?? {},
      key,
      alias,
      color,
    });
    return NextResponse.json({ ok: true, schemaId });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const token = req.cookies.get("octos_session")?.value;
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
    await convex.mutation(api.authDb.deleteSchema, { token, schemaId: id as Id<"project_schemas"> });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
