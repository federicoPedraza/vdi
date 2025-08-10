"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { v4 as uuidv4 } from "uuid";
import { Id } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";
import Editor from "react-simple-code-editor";
import Prism from "prismjs";
import "prismjs/components/prism-json";
import "prismjs/themes/prism-tomorrow.css";

type SchemaItem = { _id: Id<"project_schemas">; name: string; alias?: string; description?: string; key?: string; color?: string; definition: unknown };

function getType(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

function buildSignature(obj: unknown): string {
  if (Array.isArray(obj)) {
    if (obj.length === 0) return "[]";
    return `[${buildSignature(obj[0])}]`;
  } else if (obj && typeof obj === "object") {
    const keys = Object.keys(obj as Record<string, unknown>).sort();
    const inner = keys
      .map((key) => {
        const val = buildSignature((obj as Record<string, unknown>)[key]);
        return `${key}:${val}`;
      })
      .join(",");
    return `{${inner}}`;
  } else {
    return getType(obj);
  }
}

function computeFingerprint(payload: unknown): string {
  if (typeof payload !== "object" || payload == null) return getType(payload);
  const keys = Object.keys(payload as Record<string, unknown>).sort();
  return keys
    .map((key) => `${key}:${buildSignature((payload as Record<string, unknown>)[key])}`)
    .join(";");
}

export default function CreateParserModal({ isOpen, onClose, onCreated }: { isOpen: boolean; onClose: () => void; onCreated?: () => void }) {
  const [event, setEvent] = useState<string>("webhook");
  const [payload, setPayload] = useState<string>("{\n  \"example\": true\n}");
  const [schemas, setSchemas] = useState<SchemaItem[]>([]);
  const [loadingSchemas, setLoadingSchemas] = useState<boolean>(false);
  const [selectedSchemaIds, setSelectedSchemaIds] = useState<Array<Id<"project_schemas">>>([]);
  const [asArrayBySchemaId, setAsArrayBySchemaId] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState<boolean>(false);
  const [checkingUnique, setCheckingUnique] = useState<boolean>(false);
  const [uniqueness, setUniqueness] = useState<{ unique: boolean; existingParserId?: string } | null>(null);
  // response preview is derived; no local state needed

  // Derived: parsed payload and fingerprint
  const parsedPayload: unknown | null = useMemo(() => {
    try {
      return JSON.parse(payload);
    } catch {
      return null;
    }
  }, [payload]);

  // Build a live response example from assigned schemas and array flags
  const responseExample = useMemo(() => {
    const obj: Record<string, unknown> = {};
    for (const s of schemas) {
      if (!selectedSchemaIds.includes(s._id)) continue;
      const key = s.key || s.name;
      const idStr = s._id as unknown as string;
      const asArray = !!asArrayBySchemaId[idStr];
      obj[key] = asArray ? [] : {};
    }
    try {
      return JSON.stringify(obj, null, 2);
    } catch {
      return "{}";
    }
  }, [schemas, selectedSchemaIds, asArrayBySchemaId]);

  const fingerprint = useMemo(() => (parsedPayload === null ? null : computeFingerprint(parsedPayload)), [parsedPayload]);

  // Debounced uniqueness check via server route (server reads httpOnly cookie)
  useEffect(() => {
    if (!isOpen || !fingerprint) {
      setUniqueness(null);
      setCheckingUnique(false);
      return;
    }
    setCheckingUnique(true);
    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      try {
        const res = await fetch(`/api/partner/parsers/unique?fingerprint=${encodeURIComponent(fingerprint)}`, {
          method: "GET",
          signal: controller.signal,
        });
        const data = await res.json();
        setUniqueness(data && typeof data.unique === "boolean" ? data : { unique: true });
      } catch {
        setUniqueness({ unique: true });
      } finally {
        setCheckingUnique(false);
      }
    }, 300);
    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [isOpen, fingerprint]);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    (async () => {
      try {
        setLoadingSchemas(true);
        const res = await fetch("/api/partner/schemas", { method: "GET" });
        const data = await res.json();
        const items: SchemaItem[] = Array.isArray(data.schemas) ? data.schemas : [];
        if (!cancelled) setSchemas(items);
      } catch {
        if (!cancelled) setSchemas([]);
      } finally {
        if (!cancelled) setLoadingSchemas(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  const toggleSchema = (id: Id<"project_schemas">) => {
    setSelectedSchemaIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const toggleAsArray = (id: Id<"project_schemas">) => {
    setAsArrayBySchemaId((prev) => ({ ...prev, [id as unknown as string]: !prev[id as unknown as string] }));
  };

  const canSubmit = Boolean(
    event.trim() && parsedPayload !== null && fingerprint && !checkingUnique && uniqueness?.unique && selectedSchemaIds.length > 0
  );

  const submit = async () => {
    if (!canSubmit) return;
    setError(null);
    setCreating(true);
    try {
      const fp = fingerprint as string;
      const id = uuidv4();
      const res = await fetch("/api/partner/parsers/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uuid: id,
          event: event.trim(),
          payload,
          fingerprint: fp,
          language: "javascript",
          schemaAssignments: selectedSchemaIds.map((schemaId) => ({
            schemaId,
            asArray: !!asArrayBySchemaId[schemaId as unknown as string],
          })),
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error || "Failed to create parser");
      onCreated?.();
      onClose();
      // reset
      setEvent("webhook");
      setPayload("{\n  \"example\": true\n}");
      setSelectedSchemaIds([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create parser");
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent size="3xl">
        <DialogHeader>
          <DialogTitle>Create parser</DialogTitle>
          <DialogDescription>
            Provide a sample JSON payload and select one or more schemas. We&apos;ll compute a fingerprint and ensure it&apos;s unique.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-3">
            <div className="grid gap-1">
              <Label htmlFor="cp-event">Event</Label>
              <Input id="cp-event" value={event} onChange={(e) => setEvent(e.target.value)} placeholder="order.created" />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="cp-payload">Payload (JSON example)</Label>
              <div className="flex flex-col gap-1 min-w-0">
                <Editor
                  value={payload}
                  onValueChange={setPayload}
                  highlight={(code) => Prism.highlight(code, Prism.languages.json, "json")}
                  padding={10}
                  style={{
                    fontFamily: '"Fira code", monospace',
                    fontSize: 14,
                    width: "100%",
                    maxWidth: "100%",
                    minHeight: 120,
                    maxHeight: 320,
                    overflow: "auto",
                  }}
                />
              </div>
              {parsedPayload === null && <div className="text-xs text-red-400">Invalid JSON</div>}
            </div>
            <div className="grid gap-1 text-xs">
              <div className="opacity-70">Computed fingerprint</div>
              <pre className="w-full p-2 rounded bg-background/40 border overflow-x-auto min-h-10">
                {fingerprint ?? "—"}
              </pre>
              { checkingUnique ? (
                <div className="text-[11px] opacity-70">Checking uniqueness…</div>
              ) : uniqueness?.unique ? (
                <div className="text-[11px] text-green-400">Unique</div>
              ) : fingerprint !== null ? (
                <div className="text-[11px] text-red-400">A parser with this fingerprint already exists</div>
              ) : (
                <></>
              )}
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-sm opacity-70">Assign schemas</div>
              {loadingSchemas && <Spinner size={16} aria-label="Loading schemas" />}
            </div>
            {schemas.length === 0 && !loadingSchemas ? (
              <div className="text-sm opacity-70">No schemas in the active project. Create one first.</div>
            ) : (
              <div className="max-h-64 overflow-auto border border-white/10 rounded">
                <ul>
                  {schemas.map((s) => {
                    const isSelected = selectedSchemaIds.includes(s._id);
                    const idStr = s._id as unknown as string;
                    const asArray = !!asArrayBySchemaId[idStr];
                    return (
                      <li key={s._id} className="flex items-center justify-between gap-3 px-3 py-2 last:border-b-0">
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => toggleSchema(s._id)}
                            aria-label={isSelected ? "Deselect schema" : "Select schema"}
                            className="block p-0 m-0"
                          >
                            <span
                              aria-hidden
                              className={cn("inline-block w-4 h-4 align-middle", isSelected ? "opacity-100" : "opacity-10 hover:opacity-40 transition-opacity duration-200")}
                              style={{
                                WebkitMaskImage: `url(/svg/doodles/checkbox-on.svg)`,
                                maskImage: `url(/svg/doodles/checkbox-on.svg)`,
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
                          <div className="flex items-center gap-2">
                            <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: s.color || "#ffffff" }} />
                            <div className="text-sm">{s.description || s.alias || s.name}</div>
                          </div>
                        </div>
                        {isSelected && (
                          <div className="flex items-center gap-2 text-xs">
                            <span className="opacity-70">array</span>
                            <button
                              type="button"
                              onClick={() => toggleAsArray(s._id)}
                              aria-label={asArray ? "Set as object" : "Set as array"}
                              className="block p-0 m-0"
                            >
                              <span
                                aria-hidden
                                className={cn("inline-block w-4 h-4 align-middle", asArray ? "opacity-100" : "opacity-10 hover:opacity-40 transition-opacity duration-200")}
                                style={{
                                  WebkitMaskImage: `url(/svg/doodles/checkbox-on.svg)`,
                                  maskImage: `url(/svg/doodles/checkbox-on.svg)`,
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
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
            <div className="grid gap-1">
              <Label htmlFor="cp-response">Response (JSON example)</Label>
              <div className="flex flex-col gap-1 min-w-0">
                <Editor
                  value={responseExample}
                  onValueChange={() => { /* read-only preview */ }}
                  highlight={(code) => Prism.highlight(code, Prism.languages.json, "json")}
                  padding={10}
                  style={{
                    fontFamily: '"Fira code", monospace',
                    fontSize: 14,
                    width: "100%",
                    maxWidth: "100%",
                    minHeight: 120,
                    maxHeight: 320,
                    overflow: "auto",
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {error && <div className="text-sm text-red-400">{error}</div>}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={creating}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!canSubmit || creating}>
            {creating ? (
              <span className="inline-flex items-center gap-2">
                <Spinner size={16} aria-label="Creating" />
                Creating
              </span>
            ) : (
              "Create"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


