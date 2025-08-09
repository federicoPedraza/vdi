"use client";

import ParsersTable from "@/components/ParsersTable";
import { useEffect, useState } from "react";

export default function Home() {
  const [partner, setPartner] = useState<{ name: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/auth/me", { method: "GET" });
        const data = (await res.json()) as { partner: { name: string } | null };
        if (!cancelled) setPartner(data.partner);
      } catch {
        if (!cancelled) setPartner(null);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      window.location.href = "/signin";
    }
  };

  return (
    <>
      <div className="flex items-start gap-3 p-4 fixed top-0 left-0 right-0 bg-black z-10">
        <span
          aria-hidden
          className="w-6 h-6 text-white"
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
        <div className="flex flex-col items-start gap-2">
          <h2 className="text-lg font-bold tracking-tight">Octos Adapters</h2>
          <div className="flex items-center gap-2 text-white/80 text-sm">
            {partner && (
              <button
                type="button"
                aria-label="Log out"
                onClick={handleLogout}
                className="w-2 h-2 text-white/50 hover:text-white"
              >
                <span
                  aria-hidden
                  className="block w-full h-full"
                  style={{
                    WebkitMaskImage: `url(/svg/doodles/close.svg)`,
                    maskImage: `url(/svg/doodles/close.svg)`,
                    WebkitMaskRepeat: "no-repeat",
                    maskRepeat: "no-repeat",
                    WebkitMaskPosition: "center",
                    maskPosition: "center",
                    WebkitMaskSize: "contain",
                    maskSize: "contain",
                    backgroundColor: "currentColor",
                  }}
                />
              </button>
            )}
            <span className="truncate max-w-[60vw]">
              {partner?.name ?? ""}
            </span>
          </div>
        </div>
      </div>
      <main className="min-h-screen bg-black">
        <section className="h-screen w-full flex items-center justify-center">
          <div className="w-full max-w-5xl px-4">
            <ParsersTable />
          </div>
        </section>
      </main>
    </>
  );
}
