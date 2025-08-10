import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { randomBytes, createCipheriv, createHash } from "crypto";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export const runtime = "nodejs";

function deriveKey(secret: string): Buffer {
  // Derive a 32-byte key from the provided secret
  return createHash("sha256").update(secret).digest();
}

function encryptWithAesGcm(plaintext: string, secret: string): { ciphertext: string; iv: string; authTag: string } {
  const key = deriveKey(secret);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(Buffer.from(plaintext, "utf8")), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return {
    ciphertext: encrypted.toString("base64"),
    iv: iv.toString("base64"),
    authTag: authTag.toString("base64"),
  };
}

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get("octos_session")?.value;
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { name, provider, openaiKey, summarizeProcessesWithAI } = await req.json();
    if (provider !== "openai" && provider !== "ollama") {
      return NextResponse.json({ error: "Invalid provider" }, { status: 400 });
    }

    // Single public mutation handles both updates using session token
    let openaiKeyCiphertext: string | undefined;
    let openaiKeyIv: string | undefined;
    let openaiKeyAuthTag: string | undefined;
    if (provider === "openai") {
      if (!openaiKey || typeof openaiKey !== "string" || !openaiKey.trim()) {
        return NextResponse.json({ error: "OpenAI key is required for OpenAI provider" }, { status: 400 });
      }
      const secret = process.env.ENCRYPTION_KEY;
      if (!secret) {
        return NextResponse.json({ error: "Server encryption key not configured" }, { status: 500 });
      }
      const enc = encryptWithAesGcm(openaiKey.trim(), secret);
      openaiKeyCiphertext = enc.ciphertext;
      openaiKeyIv = enc.iv;
      openaiKeyAuthTag = enc.authTag;
    }

    const result = await convex.mutation(api.authDb.savePartnerSettingsForSession, {
      token,
      name,
      provider,
      openaiKeyCiphertext,
      openaiKeyIv,
      openaiKeyAuthTag,
      summarizeProcessesWithAI: typeof summarizeProcessesWithAI === "boolean" ? summarizeProcessesWithAI : undefined,
    });

    return NextResponse.json({ ok: true, result });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
