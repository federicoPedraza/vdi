import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function GET(req: NextRequest) {
  const token = req.cookies.get("octos_session")?.value;
  if (!token) {
    return NextResponse.json({ partner: null }, { status: 200 });
  }
  try {
    const partner = await convex.query(api.authDb.getPartnerBySession as any, { token });
    return NextResponse.json({ partner }, { status: 200 });
  } catch {
    return NextResponse.json({ partner: null }, { status: 200 });
  }
}
