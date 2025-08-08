"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ConsoleEntry {
  timestamp: string;
  status: number | null;
  ok: boolean | null;
  body: string;
}

export default function Playground() {
  const [eventName, setEventName] = useState<string>("custom.test");
  const [payloadText, setPayloadText] = useState<string>(
    JSON.stringify(
      {
        example: "value",
        nested: { a: 1, b: true },
        items: [1, 2, 3],
      },
      null,
      2
    )
  );
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [consoleEntries, setConsoleEntries] = useState<ConsoleEntry[]>([]);

  const runWebhook = async () => {
    setIsRunning(true);
    try {
      let parsed: any = null;
      try {
        parsed = payloadText.trim() === "" ? {} : JSON.parse(payloadText);
      } catch (err) {
        appendConsole({
          status: null,
          ok: null,
          body: `Payload JSON parse error: ${(err as Error).message}`,
        });
        return;
      }

      const res = await fetch(`/api/webhooks/vii/${encodeURIComponent(eventName)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed),
      });

      let bodyText: string;
      try {
        const data = await res.json();
        bodyText = JSON.stringify(data, null, 2);
      } catch {
        bodyText = await res.text();
      }

      appendConsole({ status: res.status, ok: res.ok, body: bodyText });
    } catch (err) {
      appendConsole({
        status: null,
        ok: null,
        body: `Request failed: ${(err as Error).message}`,
      });
    } finally {
      setIsRunning(false);
    }
  };

  const appendConsole = ({ status, ok, body }: { status: number | null; ok: boolean | null; body: string }) => {
    const ts = new Date().toLocaleTimeString();
    setConsoleEntries((prev) => [
      {
        timestamp: ts,
        status,
        ok,
        body,
      },
      ...prev,
    ]);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Playground</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col md:flex-row md:items-end gap-3">
            <div className="flex-1">
              <Label htmlFor="event">Event</Label>
              <Input
                id="event"
                placeholder="e.g. order.created"
                value={eventName}
                onChange={(e) => setEventName(e.target.value)}
              />
            </div>
            <div>
              <Button onClick={runWebhook} disabled={isRunning || eventName.trim() === ""}>
                {isRunning ? "Running..." : "Run"}
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="min-h-[320px]">
              <Label htmlFor="payload">Payload</Label>
              <textarea
                id="payload"
                value={payloadText}
                onChange={(e) => setPayloadText(e.target.value)}
                className="mt-1 w-full h-[320px] rounded-md border border-input bg-[#0b1020] text-[#e2e8f0] font-mono text-sm p-3 shadow-xs focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                spellCheck={false}
              />
              <div className="text-xs text-muted-foreground mt-1">JSON only. This will be sent as the request body.</div>
            </div>

            <div className="min-h-[320px]">
              <div className="flex items-center justify-between">
                <Label>Console</Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setConsoleEntries([])}
                >
                  Clear
                </Button>
              </div>
              <div className="mt-1 h-[320px] w-full rounded-md border border-input bg-[#0b0f14] text-[#bfe1ff] font-mono text-xs p-3 overflow-auto">
                {consoleEntries.length === 0 ? (
                  <div className="text-muted-foreground">No output yet. Run to see the response.</div>
                ) : (
                  <pre className="whitespace-pre-wrap break-words">
{consoleEntries.map((entry, idx) => (
  <div key={idx} className="mb-3">
    <div className="text-[10px] text-[#94a3b8]">[{entry.timestamp}] {entry.status !== null ? `HTTP ${entry.status}${entry.ok ? " OK" : ""}` : "Client"}</div>
    <code className="block">{entry.body}</code>
  </div>
))}
                  </pre>
                )}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
