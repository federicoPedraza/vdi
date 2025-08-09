import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get("octos_session")?.value;
    if (!token) return NextResponse.json({ schemas: [] }, { status: 200 });
    const items = await convex.query(api.authDb.listSchemasByActiveProject as any, { token });
    return NextResponse.json({ schemas: items || [] });
  } catch (e) {
    return NextResponse.json({ schemas: [] }, { status: 200 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get("octos_session")?.value;
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { name, definition, key, alias, color } = await req.json();
    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }
    const def = typeof definition === "string" ? JSON.parse(definition) : definition;
    const { schemaId } = await convex.mutation(api.authDb.upsertSchemaByName as any, {
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
    await convex.mutation(api.authDb.deleteSchema as any, { token, schemaId: id as any });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
