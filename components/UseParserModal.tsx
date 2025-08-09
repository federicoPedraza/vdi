"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import JsonInspector from "@/components/JsonInspector";

interface UseParserModalProps {
  isOpen: boolean;
  onClose: () => void;
  parser: {
    _id: Id<"parsers">;
    uuid: string;
    code?: string;
    event?: string;
    fingerprint?: string;
    payload?: string;
    state?: "idle" | "building" | "success" | "failed";
  };
}

export default function UseParserModal({ isOpen, onClose, parser }: UseParserModalProps) {
  const [payload, setPayload] = useState('{\n  "example": "data",\n  "client": {\n    "email": "john.doe@example.com",\n    "firstName": "John",\n    "lastName": "Doe"\n  },\n  "order": {\n    "id": "ORD-2024-001",\n    "total": 100.50,\n    "currency": "USD"\n  }\n}');
  const [isExecuting, setIsExecuting] = useState(false);
  const [result, setResult] = useState<unknown | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [computedFingerprint, setComputedFingerprint] = useState<string | null>(null);
  const [isFingerprintValid, setIsFingerprintValid] = useState<boolean>(false);

  const handleCopyResult = async () => {
    if (result === null) return;
    try {
      const text =
        typeof result === "string"
          ? result
          : (() => {
            try {
              return JSON.stringify(result, null, 2);
            } catch {
              return String(result);
            }
          })();
      await navigator.clipboard.writeText(text);
    } catch (e) {
      console.error("Failed to copy result", e);
    }
  };

  // Fetch the latest parser data to ensure we have the code
  const freshParser = useQuery(
    api.procedures.getParserByUuid,
    isOpen ? { uuid: parser.uuid } : "skip"
  );

  // Use fresh parser data if available, fallback to prop
  const activeParser = freshParser || parser;

  // Fingerprint helpers (kept in sync with server route)
  function getType(value: any): string {
    if (value === null) return "null";
    if (Array.isArray(value)) return "array";
    return typeof value;
  }
  function buildSignature(obj: any): string {
    if (Array.isArray(obj)) {
      if (obj.length === 0) return "[]";
      return `[${buildSignature(obj[0])}]`;
    } else if (obj && typeof obj === "object") {
      const keys = Object.keys(obj).sort();
      const inner = keys
        .map((key) => {
          const val = buildSignature((obj as any)[key]);
          return `${key}:${val}`;
        })
        .join(",");
      return `{${inner}}`;
    } else {
      return getType(obj);
    }
  }
  function getFingerprint(value: any): string {
    if (typeof value !== "object" || value == null) return getType(value);
    const keys = Object.keys(value).sort();
    return keys.map((key) => `${key}:${buildSignature((value as any)[key])}`).join(";");
  }

  // Prefill payload from parser when opening
  useEffect(() => {
    if (!isOpen) return;
    const initial = (freshParser as any)?.payload ?? parser.payload;
    if (typeof initial === "string" && initial.length > 0) {
      try {
        const parsed = JSON.parse(initial);
        setPayload(JSON.stringify(parsed, null, 2));
      } catch {
        setPayload(initial);
      }
    }
  }, [isOpen, (freshParser as any)?.payload, parser.payload]);

  useEffect(() => {
    if (!isOpen) return;
    try {
      const parsed = JSON.parse(payload);
      const fp = getFingerprint(parsed);
      setComputedFingerprint(fp);
      const expected = (activeParser as any)?.fingerprint as string | undefined;
      setIsFingerprintValid(!!expected && fp === expected);
      if (expected && fp !== expected) {
        setError("Payload fingerprint does not match parser's fingerprint. Adjust payload to match the original structure.");
      } else {
        setError(null);
      }
    } catch {
      setComputedFingerprint(null);
      setIsFingerprintValid(false);
      setError("Invalid JSON payload");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payload, isOpen, (activeParser as any)?.fingerprint]);

  const executeParser = async () => {
    console.log("Original parser object:", parser);
    console.log("Fresh parser object:", freshParser);
    console.log("Active parser code:", activeParser.code);

    if (!activeParser.code) {
      setError("Parser code is not available. Make sure the parser has been successfully built and has generated code.");
      return;
    }

    if (!isFingerprintValid) {
      setError("Payload fingerprint does not match parser's fingerprint.");
      return;
    }

    try {
      setIsExecuting(true);
      setError(null);
      setResult(null);

      // Parse the JSON payload
      let parsedPayload;
      try {
        parsedPayload = JSON.parse(payload);
      } catch (jsonError) {
        setError("Invalid JSON payload");
        return;
      }

      // Execute the parser code
      console.log("Executing parser with payload:", parsedPayload);

      // Create the parser function and execute it
      const parseFunction = new Function(
        "payload",
        `${activeParser.code}\nreturn typeof main === 'function' ? main(payload) : (typeof exec === 'function' ? exec(payload) : (function(){ throw new Error('No main or exec function found'); })());`
      );

      const parseResult = parseFunction(parsedPayload);
      console.log("Parse result:", parseResult);

      setResult(parseResult);

    } catch (execError) {
      console.error("Parser execution error:", execError);
      setError(execError instanceof Error ? execError.message : "Parser execution failed");
    } finally {
      setIsExecuting(false);
    }
  };

  const handleClose = () => {
    setPayload('{\n  "example": "data",\n  "client": {\n    "email": "john.doe@example.com",\n    "firstName": "John",\n    "lastName": "Doe"\n  },\n  "order": {\n    "id": "ORD-2024-001",\n    "total": 100.50,\n    "currency": "USD"\n  }\n}');
    setResult(null);
    setError(null);
    onClose();
  };

  const handleRemoveResult = () => {
    setResult(null);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Run Parser: {freshParser?.event ?? parser.event ?? parser.uuid}</DialogTitle>
          <DialogDescription>
            Provide a JSON payload. We will verify the payload structure matches this parser's fingerprint before executing.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="payload">JSON Payload</Label>
            <textarea
              id="payload"
              value={payload}
              onChange={(e) => setPayload(e.target.value)}
              className="w-full h-48 p-3 border rounded-md font-mono text-sm"
              placeholder="Enter your JSON payload here..."
              disabled={isExecuting}
            />
          </div>

          <div className="grid gap-1 text-xs">
            <div>
              <span className="opacity-70">Computed fingerprint:</span>
            </div>
            <pre className="w-full p-2 rounded bg-background/40 border overflow-x-auto">
              {computedFingerprint ?? "—"}
            </pre>
            <div className={isFingerprintValid ? "text-green-500" : "text-red-400"}>
              {isFingerprintValid ? "Fingerprint matches parser" : "Fingerprint mismatch or invalid JSON"}
            </div>
          </div>

          {result !== null && (
            <div className="grid gap-3">
              <div className="rounded-md">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Output:</Label>
                  <div className="flex flex-row justify-end items-center gap-2">
                    <button onClick={handleCopyResult} title="Copy output" className="p-1 rounded hover:bg-gray-100">
                      <img src="/svg/doodles/copy.svg" alt="Copy" className="w-4 h-4" />
                    </button>
                    <button onClick={handleRemoveResult} title="Remove output" className="p-1 rounded hover:bg-gray-100">
                      <img src="/svg/doodles/close.svg" alt="Copy" className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="mt-2 p-2 border rounded overflow-x-auto">
                  <JsonInspector data={result} />
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isExecuting}>
            Close
          </Button>
          <Button
            onClick={executeParser}
            disabled={isExecuting || !activeParser.code || !isFingerprintValid}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {isExecuting ? (
              <span className="inline-flex items-center gap-2">
                <Spinner size={16} aria-label="Executing" />
                Executing
              </span>
            ) : !activeParser.code ? (
              "No Code Available"
              ) : !isFingerprintValid ? (
                "Invalid payload (fingerprint)"
            ) : (
                    "Run"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
