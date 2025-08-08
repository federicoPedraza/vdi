"use client";

import GraphExplorer from "@/components/GraphExplorer";
import ParsersTable from "@/components/ParsersTable";
import Playground from "@/components/Playground";

export default function Home() {
  return (
    <main className="min-h-screen bg-white">
      <section className="px-6 py-10 md:py-16">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8 md:gap-10 items-center">
          <div className="flex flex-col gap-3 md:gap-4 lg:col-span-1">
            <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 via-fuchsia-500 to-pink-500 gradient-animate drop-shadow">
                Vibe Driven Integration
              </span>
            </h1>
            <p className="text-zinc-600 text-base md:text-lg">
              AI-powered system that generates intelligent parsers for any data format, creating seamless integrations and visualizing complex relationships in real-time.
            </p>
          </div>

          <div className="overflow-hidden lg:col-span-2" style={{ height: "66vh" }}>
            <GraphExplorer />
          </div>
        </div>
      </section>

      <section className="px-6 pb-10">
        <div className="max-w-7xl mx-auto">
          <ParsersTable />
        </div>
      </section>

      <section className="px-6 pb-16">
        <div className="max-w-7xl mx-auto">
          <Playground />
        </div>
      </section>
    </main>
  );
}
