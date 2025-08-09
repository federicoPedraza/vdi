"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog as RadixDialog,
  DialogContent as RadixDialogContent,
  DialogDescription as RadixDialogDescription,
  DialogFooter as RadixDialogFooter,
  DialogHeader as RadixDialogHeader,
  DialogTitle as RadixDialogTitle,
  DialogTrigger as RadixDialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { countTokens } from "gpt-tokenizer";
import { countTokens as countTokensCl100 } from "gpt-tokenizer/encoding/cl100k_base";

type HttpMethod = "POST" | "GET" | "PUT" | "PATCH" | "DELETE";

const ALLOWED_METHODS: Array<HttpMethod> = ["POST", "GET", "PUT", "PATCH", "DELETE"];

const DEFAULT_HEADERS: Array<{ key: string; value: string }> = [
  { key: "content-type", value: "application/json" },
  { key: "x-test", value: "simulator" },
];

const DEFAULT_BODY = {
  event: "order/created",
  id: 123,
  store_id: 456,
};

const JSON_PLACEHOLDER = '{\n  "event": "order/created",\n  "id": 123,\n  "store_id": 456\n}';

export default function RequestSimulator() {
  const [open, setOpen] = useState(false);
  const [endpoint, setEndpoint] = useState("/api/webhooks/vii/order.created");
  const [event, setEvent] = useState("order.created");
  const [method, setMethod] = useState<HttpMethod>("POST");
  const [headers, setHeaders] = useState(DEFAULT_HEADERS);
  const [body, setBody] = useState<string>(JSON.stringify(DEFAULT_BODY, null, 2));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function prettyIfJson(input: string): string {
    try {
      const parsed = JSON.parse(input);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return input;
    }
  }

  useEffect(() => {
    const handler = (e: Event) => {
      const { detail } = e as CustomEvent<{
        event?: string;
        body?: string;
        endpoint?: string;
        method?: HttpMethod;
        headers?: Array<{ key: string; value: string }>;
      }>;
      if (!detail) return;
      if (typeof detail.endpoint === "string") setEndpoint(detail.endpoint);
      if (typeof detail.event === "string") setEvent(detail.event);
      if (typeof detail.body === "string") setBody(prettyIfJson(detail.body));
      if (typeof detail.method === "string") setMethod(detail.method);
      if (Array.isArray(detail.headers)) setHeaders(detail.headers);
      setOpen(true);
    };
    window.addEventListener("open-request-simulator", handler as EventListener);
    return () => window.removeEventListener("open-request-simulator", handler as EventListener);
  }, []);

  const computedHeaders = useMemo(() => {
    const record: Record<string, string> = {};
    for (const { key, value } of headers) {
      if (!key) continue;
      record[key] = value;
    }
    return record;
  }, [headers]);

  const tokenCount = useMemo(() => {
    try {
      return countTokens(body ?? "");
    } catch {
      try {
        return countTokensCl100(body ?? "");
      } catch {
        return null;
      }
    }
  }, [body]);

  async function submit() {
    setIsSubmitting(true);
    setResult(null);
    setError(null);
    try {
      const parsedBody = body ? JSON.parse(body) : undefined;
      const res = await fetch(endpoint, {
        method,
        headers: {
          ...computedHeaders,
          ...(parsedBody && typeof parsedBody === "object"
            ? { "x-event": event }
            : {}),
        },
        body: method === "GET" ? undefined : JSON.stringify(parsedBody ?? {}),
      });
      const text = await res.text();
      setResult(`${res.status} ${res.statusText}\n\n${text}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  function updateHeaderKey(index: number, nextKey: string) {
    setHeaders((prev) => prev.map((h, i) => (i === index ? { ...h, key: nextKey } : h)));
  }
  function updateHeaderValue(index: number, nextValue: string) {
    setHeaders((prev) => prev.map((h, i) => (i === index ? { ...h, value: nextValue } : h)));
  }
  function addHeader() {
    setHeaders((prev) => [...prev, { key: "", value: "" }]);
  }
  function removeHeader(index: number) {
    setHeaders((prev) => prev.filter((_, i) => i !== index));
  }

  return (
    <RadixDialog open={open} onOpenChange={setOpen}>
      <div className="fixed bottom-4 left-1/2 z-40 -translate-x-1/2">
        <RadixDialogTrigger asChild>
          <Button className="shadow-md" variant="secondary">Request simulator</Button>
        </RadixDialogTrigger>
      </div>
      <RadixDialogContent className="sm:max-w-2xl">
        <RadixDialogHeader>
          <RadixDialogTitle>Request simulator</RadixDialogTitle>
          <RadixDialogDescription>
            Configure a simulated webhook request and send it to your endpoint.
          </RadixDialogDescription>
        </RadixDialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="endpoint">Endpoint</Label>
            <Input
              id="endpoint"
              placeholder="/api/webhooks/vii/order.created"
              value={endpoint}
              onChange={(e) => setEndpoint(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="event">Event</Label>
              <Input
                id="event"
                placeholder="order.created"
                value={event}
                onChange={(e) => setEvent(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="method">Method</Label>
              <Input
                id="method"
                value={method}
                onChange={(e) => {
                  const next = e.target.value.toUpperCase();
                  setMethod((ALLOWED_METHODS.includes(next as HttpMethod) ? (next as HttpMethod) : "POST"));
                }}
              />
            </div>
          </div>

          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label>Headers</Label>
              <Button type="button" variant="outline" size="sm" onClick={addHeader}>
                Add header
              </Button>
            </div>
            <div className="grid gap-2">
              {headers.map((h, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-center">
                  <Input
                    className="col-span-5"
                    placeholder="Header name"
                    value={h.key}
                    onChange={(e) => updateHeaderKey(i, e.target.value)}
                  />
                  <Input
                    className="col-span-6"
                    placeholder="Header value"
                    value={h.value}
                    onChange={(e) => updateHeaderValue(i, e.target.value)}
                  />
                  <Button type="button" variant="ghost" size="sm" className="col-span-1" onClick={() => removeHeader(i)}>
                    ✕
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="body">Body (JSON)</Label>
            <Textarea
              id="body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={JSON_PLACEHOLDER}
            />
            <div className="mt-1 text-xs text-muted-foreground text-left">
              Tokens (o200k_base): {tokenCount ?? "—"}
            </div>
          </div>

          {(result || error) && (
            <div className="grid gap-2">
              <Label>Response</Label>
              <Textarea
                className="min-h-[160px]"
                readOnly
                value={(error ? `Error: ${error}\n\n` : "") + (result ?? "")}
              />
            </div>
          )}
        </div>

        <RadixDialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isSubmitting}>
            Close
          </Button>
          <Button type="button" onClick={submit} disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <span className="inline-flex items-center gap-2">
                  <span
                    className="inline-block w-4 h-4 text-cyan-400 animate-spin"
                    style={{
                      WebkitMaskImage: `url(/svg/doodles/loading.svg)`,
                      maskImage: `url(/svg/doodles/loading.svg)`,
                      WebkitMaskRepeat: "no-repeat",
                      maskRepeat: "no-repeat",
                      WebkitMaskPosition: "center",
                      maskPosition: "center",
                      WebkitMaskSize: "contain",
                      maskSize: "contain",
                      backgroundColor: "currentColor",
                    }}
                    aria-label="Sending"
                  />
                  Sending
                </span>
              </>
            ) : (
              "Send request"
            )}
          </Button>
        </RadixDialogFooter>
      </RadixDialogContent>
    </RadixDialog>
  );
}
