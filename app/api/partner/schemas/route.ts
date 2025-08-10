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
    const { name, key, alias, description, color } = body;
    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }
    // Ensure the definition is proper JSON and strip comments (// and /* */) while preserving strings
    let def = body?.definition as unknown;
    if (typeof def === "string") {
      const src = def;
      let out = "";
      let inString = false;
      let stringChar: '"' | "'" | null = null;
      let i = 0;
      while (i < src.length) {
        const ch = src[i];
        const next = i + 1 < src.length ? src[i + 1] : '';
        const prev = i > 0 ? src[i - 1] : '';
        if (!inString) {
          if (ch === '"' || ch === "'") {
            inString = true;
            stringChar = ch as '"' | "'";
            out += ch;
            i += 1;
            continue;
          }
          // Line comments
          if (ch === '/' && next === '/') {
            while (i < src.length && src[i] !== '\n') i += 1;
            out += '\n';
            continue;
          }
          // Block comments
          if (ch === '/' && next === '*') {
            i += 2; // skip /*
            while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) i += 1;
            i += 2; // skip */
            continue;
          }
          out += ch;
          i += 1;
        } else {
          out += ch;
          if (ch === stringChar && prev !== '\\') {
            inString = false;
            stringChar = null;
          }
          i += 1;
        }
      }
      try {
        def = JSON.parse(out);
      } catch (e) {
        return NextResponse.json({ error: "Definition must be valid JSON (comments are removed automatically)" }, { status: 400 });
      }
    }
    const { schemaId } = await convex.mutation(api.authDb.upsertSchemaByName, {
      token,
      name: name.trim(),
      definition: def ?? {},
      key,
      alias,
      // If description is a JSON string (auto-generated mapping), keep as-is; otherwise, stringify
      description: typeof description === 'string' ? description : (description != null ? String(description) : undefined),
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
