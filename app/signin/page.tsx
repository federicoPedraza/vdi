"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SignIn() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/auth/${mode === "login" ? "login" : "signup"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, ...(mode === "signup" ? { name } : {}) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed");
      router.replace("/");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen grid place-items-center bg-black text-white p-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-6">
          <div
            aria-hidden
            className="w-14 h-14 mb-3 text-white"
            style={{
              WebkitMaskImage: `url(/svg/doodles/vdi-logo.svg)`,
              maskImage: `url(/svg/doodles/vdi-logo.svg)`,
              WebkitMaskRepeat: "no-repeat",
              maskRepeat: "no-repeat",
              WebkitMaskPosition: "center",
              maskPosition: "center",
              WebkitMaskSize: "contain",
              maskSize: "contain",
              backgroundColor: "currentColor",
            }}
          />
          <h1 className="text-2xl font-semibold tracking-tight">Octos</h1>
          <p className="text-sm opacity-70 mt-1">Sign in to continue</p>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-lg p-4">
          <form onSubmit={submit} className="space-y-3">
            {mode === "signup" && (
              <div className="space-y-1">
                <label className="text-sm">Name</label>
                <input
                  className="w-full px-3 py-2 rounded-md bg-black/40 border border-white/10 outline-none focus:ring-2 focus:ring-cyan-500"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  required
                />
              </div>
            )}
            <div className="space-y-1">
              <label className="text-sm">Email</label>
              <input
                type="email"
                className="w-full px-3 py-2 rounded-md bg-black/40 border border-white/10 outline-none focus:ring-2 focus:ring-cyan-500"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm">Password</label>
              <input
                type="password"
                className="w-full px-3 py-2 rounded-md bg-black/40 border border-white/10 outline-none focus:ring-2 focus:ring-cyan-500"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>

            {error && <div className="text-sm text-red-300">{error}</div>}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 rounded-md bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50"
            >
              {loading ? "Please wait…" : mode === "login" ? "Log in" : "Sign up"}
            </button>
          </form>
          <div className="text-xs opacity-70 mt-3 text-center">
            {mode === "login" ? (
              <button className="underline" onClick={() => setMode("signup")}>Create an account</button>
            ) : (
              <button className="underline" onClick={() => setMode("login")}>Have an account? Log in</button>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
