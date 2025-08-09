import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get("octos_session")?.value;
    const { searchParams } = new URL(req.url);
    const fingerprint = searchParams.get("fingerprint");
    if (!token || !fingerprint) {
      return NextResponse.json({ unique: true }, { status: 200 });
    }
    const result = await convex.query(api.authDb.isFingerprintUniqueForSession, { token, fingerprint });
    return NextResponse.json(result, { status: 200 });
  } catch {
    return NextResponse.json({ unique: true }, { status: 200 });
  }
}


