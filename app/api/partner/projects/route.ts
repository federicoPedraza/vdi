import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get("octos_session")?.value;
    if (!token) return NextResponse.json({ projects: [], activeProjectId: null }, { status: 200 });

    const [projects, active] = await Promise.all([
      convex.query(api.authDb.listProjectsBySession as any, { token }),
      convex.query(api.authDb.getActiveProjectBySession as any, { token }),
    ]);

    return NextResponse.json({
      projects: (projects || []).map((p: any) => ({ _id: p._id, name: p.name })),
      activeProjectId: active?._id ?? null,
    });
  } catch (e) {
    return NextResponse.json({ projects: [], activeProjectId: null }, { status: 200 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get("octos_session")?.value;
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { name, slug, description, makeActive } = await req.json();
    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const result = await convex.mutation(api.authDb.createProjectForSession as any, {
      token,
      name,
      slug,
      description,
      makeActive: !!makeActive,
    });

    return NextResponse.json({ ok: true, projectId: result.projectId });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
