import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function POST(req: NextRequest) {
  try {
    const { email, name, password } = await req.json();
    if (!email || !name || !password) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }
    const { token, partnerId } = await convex.action(api.auth.signUp, {
      email,
      name,
      password,
    });
    const res = NextResponse.json({ ok: true, partnerId });
    res.cookies.set("octos_session", token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30, // 30d
    });
    return res;
  } catch (e) {
    const message = e instanceof Error ? e.message : "Sign up failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
