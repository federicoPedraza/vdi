"use client";

import ParsersTable from "@/components/ParsersTable";

export default function Home() {
  return (
    <main className="min-h-screen bg-black">
      <section className="h-screen w-full flex items-center justify-center">
        <div className="w-full max-w-5xl px-4">
          <div className="flex flex-col items-center">
            <h2 className="text-lg font-bold tracking-tight mb-4">Adapters</h2>
          </div>
          <ParsersTable />
        </div>
      </section>
    </main>
  );
}
