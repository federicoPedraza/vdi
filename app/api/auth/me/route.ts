import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function GET(req: NextRequest) {
  const token = req.cookies.get("octos_session")?.value;
  if (!token) {
    return NextResponse.json({ partner: null, settings: null }, { status: 200 });
  }
  try {
    const [partner, settings] = await Promise.all([
      convex.query(api.authDb.getPartnerBySession as any, { token }),
      convex.query(api.authDb.getPartnerSettingsBySession as any, { token }),
    ]);
    // Also include active project if needed in future; for now settings carries activeProjectId
    return NextResponse.json({ partner, settings }, { status: 200 });
  } catch {
    return NextResponse.json({ partner: null, settings: null }, { status: 200 });
  }
}
