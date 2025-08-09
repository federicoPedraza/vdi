import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function POST(req: NextRequest) {
  const token = req.cookies.get("octos_session")?.value;
  if (token) {
    try {
      await convex.action(api.auth.logOut, { token });
    } catch {
      // ignore
    }
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set("octos_session", "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return res;
}
