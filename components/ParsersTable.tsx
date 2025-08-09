"use client";

import { useEffect, useRef, useState, memo, useMemo, Fragment } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { Spinner } from "@/components/ui/spinner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import ConfirmDialog from "@/components/ConfirmDialog";
import UseParserModal from "@/components/UseParserModal";
import Editor from "react-simple-code-editor";
import Prism from "prismjs";
import "prismjs/components/prism-javascript";
import "prismjs/themes/prism-tomorrow.css";

interface Parser {
  _id: Id<"parsers">;
  _creationTime: number;
  uuid: string;
  language: string;
  event: string;
  state: "idle" | "building" | "success" | "failed";
  code?: string;
  fingerprint: string;
  payload: string;
}

interface Processing {
  _id: Id<"parser_processings">;
  _creationTime: number;
  parserId: Id<"parsers">;
  requestId: string;
  step: number;
  totalSteps?: number;
  logs: string;
  status: "running" | "success" | "failed";
  startedAt: number;
  finishedAt?: number;
  error?: string;
  systemPrompt?: string;
  userPrompt?: string;
}

export default function ParsersTable() {
  const token = typeof document !== "undefined" ? (document.cookie.match(/(?:^|; )octos_session=([^;]+)/)?.[1] || null) : null;
  const partnerScoped = useQuery(api.authDb.getParsersForSession, token ? ({ token } as { token: string }) : "skip") as (Parser[] | undefined) | null;
  const allParsers = useQuery(api.procedures.getAllParsers) as Parser[] | undefined;
  const parsers = (partnerScoped ?? undefined) || allParsers;
  const deleteParserMutation = useMutation(api.procedures.deleteParser);
  const resetParserMutation = useMutation(api.procedures.resetParser);
  const [processingById, setProcessingById] = useState<Record<string, boolean>>({});
  const [useParserOpen, setUseParserOpen] = useState(false);
  const [useParserTarget, setUseParserTarget] = useState<Parser | null>(null);

  const defaultDateOptions: Intl.DateTimeFormatOptions = {
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  };

  const parseProcessingDateFormat: Intl.DateTimeFormatOptions = {
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  };

  const formatDate = (timestamp: number, options: Intl.DateTimeFormatOptions = defaultDateOptions) => new Date(timestamp).toLocaleString("en-US", options);
  const formatParseProcessingDate = (timestamp: number) => new Date(timestamp).toLocaleString("en-US", parseProcessingDateFormat);

  const formatDuration = (ms: number) => {
    if (ms < 0 || !Number.isFinite(ms)) return "-";
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (hours > 0) {
      return `${hours}hr ${minutes}m`;
    }
    if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    }
    return `${seconds}s`;
  };

  // Replaced custom CodeViewer with react-simple-code-editor + PrismJS

  const [expandedById, setExpandedById] = useState<Record<string, boolean>>({});
  const [fingerprintDialogOpen, setFingerprintDialogOpen] = useState(false);
  const [activeFingerprint, setActiveFingerprint] = useState<string | null>(null);
  const [codeDialogOpen, setCodeDialogOpen] = useState(false);
  const [activeCode, setActiveCode] = useState<string | null>(null);
  const [didCopy, setDidCopy] = useState(false);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [deletingById, setDeletingById] = useState<Record<string, boolean>>({});
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [confirmDeleteTarget, setConfirmDeleteTarget] = useState<Parser | null>(null);
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const [confirmResetTarget, setConfirmResetTarget] = useState<Parser | null>(null);

  // Floating label (rendered via portal to avoid table stacking/overflow issues)
  const [hoverLabel, setHoverLabel] = useState<{ text: string; anchor: HTMLElement } | null>(null);
  const [, forceReposition] = useState(0);

  const showFloatingLabel = (text: string, target: HTMLElement) => {
    setHoverLabel({ text, anchor: target });
  };
  const hideFloatingLabel = () => setHoverLabel(null);

  useEffect(() => {
    if (!hoverLabel) return;
    const onMove = () => forceReposition((x) => x + 1);
    window.addEventListener("scroll", onMove, true);
    window.addEventListener("resize", onMove);
    return () => {
      window.removeEventListener("scroll", onMove, true);
      window.removeEventListener("resize", onMove);
    };
  }, [hoverLabel]);

  const openFingerprint = (fp: string) => {
    setActiveFingerprint(fp);
    setFingerprintDialogOpen(true);
    setDidCopy(false);
  };

  const openCode = (code: string) => {
    setActiveCode(code);
    setCodeDialogOpen(true);
    setDidCopy(false);
  };

  const notifyCopied = () => {
    if (copyTimeoutRef.current) {
      clearTimeout(copyTimeoutRef.current);
    }
    setDidCopy(true);
    copyTimeoutRef.current = setTimeout(() => {
      setDidCopy(false);
      copyTimeoutRef.current = null;
    }, 1200);
  };

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current);
      }
    };
  }, []);

  // No-op here; click-to-copy is handled inside the memoized code viewer

  const CodeFingerprintView = memo(function CodeFingerprintView({ fingerprint, onCopy }: { fingerprint: string; onCopy: () => void }) {
    const tokens = useMemo(() => {
      const s = fingerprint;
      const result: Array<React.ReactNode> = [];
      const isWord = (ch: string) => /[A-Za-z0-9_]/.test(ch);
      let i = 0;
      const len = s.length;
      const push = (text: string, className?: string) => {
        if (text.length === 0) return;
        result.push(className ? <span key={result.length} className={className}>{text}</span> : text);
      };
      const matchNumber = (start: number): string | null => {
        const m = s.slice(start).match(/^-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/);
        if (!m) return null;
        const end = start + m[0].length;
        const prev = start === 0 ? "" : s[start - 1];
        const next = end >= len ? "" : s[end];
        if ((prev && isWord(prev)) || (next && isWord(next))) return null;
        return m[0];
      };
      const typeWords = ["string", "number", "boolean", "object", "array"];
      const keywordWords = ["true", "false", "null"];
      const matchWord = (start: number, words: string[], caseInsensitive = false): string | null => {
        for (const w of words) {
          if (caseInsensitive) {
            if (s.slice(start, start + w.length).toLowerCase() === w.toLowerCase()) {
              const end = start + w.length;
              const prev = start === 0 ? "" : s[start - 1];
              const next = end >= len ? "" : s[end];
              if (!isWord(prev) && !isWord(next)) return s.slice(start, end);
            }
          } else if (s.startsWith(w, start)) {
            const end = start + w.length;
            const prev = start === 0 ? "" : s[start - 1];
            const next = end >= len ? "" : s[end];
            if (!isWord(prev) && !isWord(next)) return w;
          }
        }
        return null;
      };
      const punctRe = /^[{}\[\]\(\)\.,;:\+\-\*\/=\|\\\?`!%^~#@]/;
      while (i < len) {
        const ch = s[i];
        if (ch === '"' || ch === "'") {
          let j = i + 1;
          while (j < len && s[j] !== ch) j++;
          if (j < len) j++;
          push(s.slice(i, j), "text-emerald-300");
          i = j;
          continue;
        }
        if (ch === "<" || ch === ">" || ch === "&") {
          push(ch, "text-cyan-400");
          i++;
          continue;
        }
        const num = matchNumber(i);
        if (num) {
          push(num, "text-orange-300");
          i += num.length;
          continue;
        }
        const kw = matchWord(i, keywordWords);
        if (kw) {
          push(kw, "text-purple-300");
          i += kw.length;
          continue;
        }
        const tw = matchWord(i, typeWords, true);
        if (tw) {
          push(tw, "text-sky-300");
          i += tw.length;
          continue;
        }
        const punct = s.slice(i).match(punctRe)?.[0] ?? null;
        if (punct) {
          push(punct, "text-cyan-400");
          i += punct.length;
          continue;
        }
        push(ch);
        i++;
      }
      return result;
    }, [fingerprint]);

    const handleClick = async () => {
      const selection = window.getSelection();
      const selectedText = selection ? selection.toString() : "";
      if (selectedText.length === 0) {
        try {
          await navigator.clipboard.writeText(fingerprint);
          onCopy();
        } catch { }
      }
    };

    return (
      <div className="relative mx-auto w-full max-w-[36rem] group">
        <div
          role="textbox"
          aria-readonly="true"
          onClick={handleClick}
          className="w-full h-[320px] max-h-[320px] overflow-auto rounded-md bg-background/40 text-foreground font-mono text-sm p-3 outline-none focus:ring-2 focus:ring-cyan-500 whitespace-pre-wrap break-all leading-6 select-text cursor-text"
        >
          {tokens}
        </div>
        <button
          type="button"
          onClick={async () => { try { await navigator.clipboard.writeText(fingerprint); } catch { }; onCopy(); }}
          className="absolute top-2 right-2 p-2 rounded-md hover:bg-foreground/10 transition-opacity opacity-70 group-hover:opacity-100"
          aria-label="Copy fingerprint"
          title="Copy"
        >
          <span
            aria-hidden
            className="block group-hover:hidden hover:hidden w-5 h-5 text-white"
            style={{
              WebkitMaskImage: `url(/svg/doodles/copy.svg)`,
              maskImage: `url(/svg/doodles/copy.svg)`,
              WebkitMaskRepeat: "no-repeat",
              maskRepeat: "no-repeat",
              WebkitMaskPosition: "center",
              maskPosition: "center",
              WebkitMaskSize: "contain",
              maskSize: "contain",
              backgroundColor: "currentColor",
            }}
          />
          <span
            aria-hidden
            className="hidden group-hover:block hover:block w-5 h-5 text-white"
            style={{
              WebkitMaskImage: `url(/svg/doodles/copy-hover.svg)`,
              maskImage: `url(/svg/doodles/copy-hover.svg)`,
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
    );
  });

  const toggleExpanded = (id: string) => {
    setExpandedById((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const runProcessParser = async (parser: Parser) => {
    const id = parser._id as unknown as string;
    try {
      setProcessingById((prev) => ({ ...prev, [id]: true }));
      setExpandedById((prev) => ({ ...prev, [id]: true }));
      const response = await fetch("/api/process-parser", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parserId: parser._id }),
      });
      if (!response.ok) {
        // Try to read JSON error but fallback to status
        let errorBody: unknown = null;
        try { errorBody = await response.json(); } catch { }
        console.error("Failed to start parser processing", { status: response.status, error: errorBody });
      }
    } catch (err) {
      console.error("Failed to start parser processing", err);
    } finally {
      setProcessingById((prev) => ({ ...prev, [id]: false }));
    }
  };

  function ParserProcessings({ parserId }: { parserId: Id<"parsers"> }) {
    const processings = useQuery(api.procedures.getProcessingsByParser, { parserId }) as Processing[] | undefined;
    const [, forceTick] = useState(0);
    const hasRunning = (processings ?? []).some((p) => !p.finishedAt);
    useEffect(() => {
      if (!hasRunning) return;
      const interval = setInterval(() => forceTick((x) => x + 1), 1000);
      return () => clearInterval(interval);
    }, [hasRunning]);

    if (!processings) return (
      <div className="p-2 w-full flex justify-center items-center">
        <Spinner size={24} aria-label="Loading processes" />
      </div>
    );
    if (processings.length === 0) return <div className="p-2 text-sm opacity-70">No processes yet.</div>;
    
    const extendedClassName = cn("rounded-md bg-background/40 p-3", processings.length === 0 ? "border-b border-white/10" : "border-b-0");
    return (
      <div className={extendedClassName}>
        <Table className="w-full">
          <TableHeader>
            <TableRow>
              <TableHead className="font-bold uppercase underline">State</TableHead>
              <TableHead className="font-bold uppercase underline">Steps</TableHead>
              <TableHead className="font-bold uppercase underline">Start</TableHead>
              <TableHead className="font-bold uppercase underline">End</TableHead>
              <TableHead className="font-bold uppercase underline">Duration</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {processings.map((proc) => {
              const endTs = proc.finishedAt ?? Date.now();
              const duration = formatDuration(Math.max(0, endTs - proc.startedAt));
              const stateColor = proc.status === "success" ? "text-green-400" : proc.status === "failed" ? "text-red-400" : "text-cyan-400";
              return (
                <TableRow key={proc._id}>
                  <TableCell>
                    <span className={`capitalize ${stateColor}`}>{proc.status}</span>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {proc.step}{`/${proc.totalSteps ?? "—"}`}
                  </TableCell>
                  <TableCell>{formatParseProcessingDate(proc.startedAt)}</TableCell>
                  <TableCell>{proc.finishedAt ? formatParseProcessingDate(proc.finishedAt) : "—"}</TableCell>
                  <TableCell className="whitespace-nowrap">{duration}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    );
  }

  if (!parsers) {
    return (
      <div className="p-2 w-full flex justify-center items-center">
        <Spinner size={48} aria-label="Loading" />
      </div>
    );
  }

  return (
    <div>
      {parsers.length === 0 ? (
        <div className="py-4 w-full text-center">No adapters yet.</div>
      ) : (
          <Table className="w-full mx-auto">
            <TableHeader>
              <TableRow>
                <TableHead className="text-center font-bold uppercase underline">Fingerprint</TableHead>
                <TableHead className="text-center font-bold uppercase underline">Code</TableHead>
                <TableHead className="font-bold uppercase underline">Language</TableHead>
                <TableHead className="font-bold uppercase underline">State</TableHead>
                <TableHead className="font-bold uppercase underline">Time</TableHead>
                <TableHead className="font-bold uppercase underline">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {parsers.map((parser) => {
                const id = parser._id as unknown as string;
                return (
                  <Fragment key={id}>
                    <TableRow className="relative hover:z-[60] focus-within:z-[60]">
                      <TableCell className="font-mono text-center p-0 w-0 overflow-visible">
                        <div className="relative inline-flex">
                          <button
                            className="peer p-0 m-0 inline-flex items-center justify-center transition-transform duration-150 hover:scale-110 focus:outline-none focus:ring-2 focus:ring-cyan-500 rounded"
                            onClick={() => openFingerprint(parser.fingerprint)}
                            aria-label="Show fingerprint"
                            title="Show fingerprint"
                            onMouseEnter={(e) => showFloatingLabel("Fingerprint", e.currentTarget as unknown as HTMLElement)}
                            onMouseLeave={hideFloatingLabel}
                            onFocus={(e) => showFloatingLabel("Fingerprint", e.currentTarget as unknown as HTMLElement)}
                            onBlur={hideFloatingLabel}
                          >
                            <span
                              aria-hidden
                              className={`inline-block w-6 h-6 align-middle transition-opacity duration-150 hover:opacity-80 ${parser.state === "failed" ? "text-red-200" : parser.state === "success" ? "text-green-200" : parser.state === "building" ? "text-cyan-200" : "text-white"}`}
                              style={{
                                WebkitMaskImage: `url(${parser.state === "success" ? "/svg/doodles/fingerprint-done.svg" : parser.state === "failed" ? "/svg/doodles/fingerprint-pending.svg" : parser.state === "building" ? "/svg/doodles/fingerprint-building.svg" : "/svg/doodles/fingerprint-pending.svg"})`,
                                maskImage: `url(${parser.state === "success" ? "/svg/doodles/fingerprint-done.svg" : parser.state === "failed" ? "/svg/doodles/fingerprint-pending.svg" : parser.state === "building" ? "/svg/doodles/fingerprint-building.svg" : "/svg/doodles/fingerprint-pending.svg"})`,
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
                          <div
                            aria-hidden
                            className="hidden pointer-events-none absolute left-1/2 top-full mt-1 -translate-x-1/2 z-[9999] text-[10px] text-foreground opacity-0 scale-95 translate-y-1 transition-all duration-150 ease-out peer-hover:opacity-100 peer-hover:scale-100 peer-hover:translate-y-0 peer-focus:opacity-100 peer-focus:scale-100 peer-focus:translate-y-0"
                          >
                            Fingerprint
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-center overflow-visible">
                        <div className="relative inline-flex">
                          <button
                            className="peer p-0 m-0 inline-flex items-center justify-center transition-transform duration-150 hover:scale-110 focus:outline-none focus:ring-2 focus:ring-cyan-500 rounded"
                            onClick={() => openCode(parser.code || "")}
                            aria-label="Show parser code"
                            title="Show parser code"
                            onMouseEnter={(e) => showFloatingLabel("Code", e.currentTarget as unknown as HTMLElement)}
                            onMouseLeave={hideFloatingLabel}
                            onFocus={(e) => showFloatingLabel("Code", e.currentTarget as unknown as HTMLElement)}
                            onBlur={hideFloatingLabel}
                          >
                            <span
                              aria-hidden
                              className="inline-block w-6 h-6 align-middle text-white transition-opacity duration-150 hover:opacity-80"
                              style={{
                                WebkitMaskImage: `url(/svg/doodles/code.svg)`,
                                maskImage: `url(/svg/doodles/code.svg)`,
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
                          <div
                            aria-hidden
                            className="hidden pointer-events-none absolute left-1/2 top-full mt-1 -translate-x-1/2 z-[9999] text-[10px] text-foreground opacity-0 scale-95 translate-y-1 transition-all duration-150 ease-out peer-hover:opacity-100 peer-hover:scale-100 peer-hover:translate-y-0 peer-focus:opacity-100 peer-focus:scale-100 peer-focus:translate-y-0"
                          >
                            Code
                          </div>
                        </div>
                      </TableCell>
                    <TableCell>{parser.language}</TableCell>
                    <TableCell className="capitalize">{parser.state}</TableCell>
                    <TableCell>{formatDate(parser._creationTime)}</TableCell>
                      <TableCell className="overflow-visible">
                        <div className="flex gap-1">
                          {/* PLAY */}
                          <div className="relative inline-flex">
                            <button
                              className="peer p-2 inline-flex items-center justify-center transition-transform duration-150 hover:scale-110 focus:outline-none focus:ring-2 focus:ring-cyan-500 rounded disabled:cursor-default"
                              onClick={() => { setUseParserTarget(parser); setUseParserOpen(true); }}
                              disabled={!!processingById[id] || parser.state === "building"}
                              aria-label="Run parser"
                              title="Run parser"
                              onMouseEnter={(e) => showFloatingLabel("Run", e.currentTarget as unknown as HTMLElement)}
                              onMouseLeave={hideFloatingLabel}
                              onFocus={(e) => showFloatingLabel("Run", e.currentTarget as unknown as HTMLElement)}
                              onBlur={hideFloatingLabel}
                            >
                              <span
                                aria-hidden
                                className={`inline-block w-5 h-5 align-middle transition-opacity duration-150 ${processingById[id] || parser.state === "building" ? "opacity-30" : "text-green-400 hover:opacity-80"}`}
                                style={{
                                  WebkitMaskImage: `url(/svg/doodles/play.svg)`,
                                  maskImage: `url(/svg/doodles/play.svg)`,
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
                            <div
                              aria-hidden
                              className="hidden pointer-events-none absolute left-1/2 top-full mt-1 -translate-x-1/2 z-[9999] text-[10px] text-foreground opacity-0 scale-95 translate-y-1 transition-all duration-150 ease-out peer-hover:opacity-100 peer-hover:scale-100 peer-hover:translate-y-0 peer-focus:opacity-100 peer-focus:scale-100 peer-focus:translate-y-0"
                            >
                              Run
                            </div>
                          </div>
                          {/* EXECUTE */}
                          <div className="relative inline-flex">
                            <button
                              className="peer p-2 inline-flex items-center justify-center transition-transform duration-150 hover:scale-110 focus:outline-none focus:ring-2 focus:ring-cyan-500 rounded disabled:cursor-default"
                              onClick={() => { setConfirmResetTarget(parser); setConfirmResetOpen(true); }}
                              disabled={!!processingById[id] || parser.state === "building"}
                              aria-label="Reset and process parser"
                              title="Reset and process parser"
                              onMouseEnter={(e) => showFloatingLabel("Reset & Build", e.currentTarget as unknown as HTMLElement)}
                              onMouseLeave={hideFloatingLabel}
                              onFocus={(e) => showFloatingLabel("Reset & Build", e.currentTarget as unknown as HTMLElement)}
                              onBlur={hideFloatingLabel}
                            >
                              <span
                                aria-hidden
                                className={`inline-block w-5 h-5 align-middle transition-opacity duration-150 ${processingById[id] || parser.state === "building" ? "opacity-30" : "text-blue-400 hover:opacity-80"}`}
                                style={{
                                  WebkitMaskImage: `url(/svg/doodles/love.svg)`,
                                  maskImage: `url(/svg/doodles/love.svg)`,
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
                            <div
                              aria-hidden
                              className="hidden pointer-events-none absolute left-1/2 top-full mt-1 -translate-x-1/2 z-[9999] text-[10px] text-foreground opacity-0 scale-95 translate-y-1 transition-all duration-150 ease-out peer-hover:opacity-100 peer-hover:scale-100 peer-hover:translate-y-0 peer-focus:opacity-100 peer-focus:scale-100 peer-focus:translate-y-0"
                            >
                              Reset & Build
                            </div>
                          </div>
                          {/* START PARSING */}
                          <div className="relative inline-flex">
                            <button
                              className="peer p-2 inline-flex items-center justify-center transition-transform duration-150 hover:scale-110 focus:outline-none focus:ring-2 focus:ring-cyan-500 rounded disabled:cursor-default"
                              onClick={() => {
                                try {
                                  window.dispatchEvent(
                                    new CustomEvent("open-request-simulator", {
                                      detail: {
                                        event: parser.event,
                                        body: parser.payload,
                                      },
                                    }),
                                  );
                                } catch { }
                              }}
                              aria-label="Open request simulator"
                              title="Open request simulator"
                              disabled={!!processingById[id] || parser.state === "building"}
                              onMouseEnter={(e) => showFloatingLabel("Simulate", e.currentTarget as unknown as HTMLElement)}
                              onMouseLeave={hideFloatingLabel}
                              onFocus={(e) => showFloatingLabel("Simulate", e.currentTarget as unknown as HTMLElement)}
                              onBlur={hideFloatingLabel}
                            >
                              <span
                                aria-hidden
                                className={`inline-block w-5 h-5 align-middle transition-opacity duration-150 ${processingById[id] || parser.state === "building" ? "opacity-30" : "text-yellow-400 hover:opacity-80"}`}
                                style={{
                                  WebkitMaskImage: `url(/svg/doodles/parse.svg)`,
                                  maskImage: `url(/svg/doodles/parse.svg)`,
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
                            <div
                              aria-hidden
                              className="hidden pointer-events-none absolute left-1/2 top-full mt-1 -translate-x-1/2 z-[9999] text-[10px] text-foreground opacity-0 scale-95 translate-y-1 transition-all duration-150 ease-out peer-hover:opacity-100 peer-hover:scale-100 peer-hover:translate-y-0 peer-focus:opacity-100 peer-focus:scale-100 peer-focus:translate-y-0"
                            >
                              Simulate
                            </div>
                          </div>
                          {/* EXPAND/COLLAPSE PROCESSES */}
                          <div className="relative inline-flex">
                            <button
                              className="peer p-2 inline-flex items-center justify-center transition-transform duration-150 hover:scale-110 focus:outline-none focus:ring-2 focus:ring-cyan-500 rounded"
                              onClick={() => toggleExpanded(id)}
                              aria-label={expandedById[id] ? "Hide processes" : "Show processes"}
                              title={expandedById[id] ? "Hide processes" : "Show processes"}
                              onMouseEnter={(e) => showFloatingLabel(expandedById[id] ? "Hide" : "Show", e.currentTarget as unknown as HTMLElement)}
                              onMouseLeave={hideFloatingLabel}
                              onFocus={(e) => showFloatingLabel(expandedById[id] ? "Hide" : "Show", e.currentTarget as unknown as HTMLElement)}
                              onBlur={hideFloatingLabel}
                            >
                              <span
                                aria-hidden
                                className="inline-block w-5 h-5 align-middle text-gray-100 transition-opacity duration-150 hover:opacity-80"
                                style={{
                                  WebkitMaskImage: `url(${expandedById[id] ? "/svg/doodles/eye-on.svg" : "/svg/doodles/eye-off.svg"})`,
                                  maskImage: `url(${expandedById[id] ? "/svg/doodles/eye-on.svg" : "/svg/doodles/eye-off.svg"})`,
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
                            <div
                              aria-hidden
                              className="hidden pointer-events-none absolute left-1/2 top-full mt-1 -translate-x-1/2 z-[9999] text-[10px] text-foreground opacity-0 scale-95 translate-y-1 transition-all duration-150 ease-out peer-hover:opacity-100 peer-hover:scale-100 peer-hover:translate-y-0 peer-focus:opacity-100 peer-focus:scale-100 peer-focus:translate-y-0"
                            >
                              {expandedById[id] ? "Hide" : "Show"}
                            </div>
                          </div>
                          {/* DELETE */}
                          <div className="relative inline-flex">
                            <button
                              className="peer p-2 inline-flex items-center justify-center transition-transform duration-150 hover:scale-110 focus:outline-none focus:ring-2 focus:ring-cyan-500 rounded disabled:cursor-default"
                              onClick={() => { setConfirmDeleteTarget(parser); setConfirmDeleteOpen(true); }}
                              disabled={!!deletingById[id] || !!processingById[id] || parser.state === "building"}
                              aria-label="Delete parser"
                              title="Delete parser"
                              onMouseEnter={(e) => showFloatingLabel("Delete", e.currentTarget as unknown as HTMLElement)}
                              onMouseLeave={hideFloatingLabel}
                              onFocus={(e) => showFloatingLabel("Delete", e.currentTarget as unknown as HTMLElement)}
                              onBlur={hideFloatingLabel}
                            >
                              <span
                                aria-hidden
                                className={`inline-block w-5 h-5 align-middle transition-opacity duration-150 ${deletingById[id] ? "opacity-30" : "text-red-500 hover:opacity-80"}`}
                                style={{
                                  WebkitMaskImage: `url(/svg/doodles/delete.svg)`,
                                  maskImage: `url(/svg/doodles/delete.svg)`,
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
                            <div
                              aria-hidden
                              className="hidden pointer-events-none absolute left-1/2 top-full mt-1 -translate-x-1/2 z-[9999] text-[10px] text-foreground opacity-0 scale-95 translate-y-1 transition-all duration-150 ease-out peer-hover:opacity-100 peer-hover:scale-100 peer-hover:translate-y-0 peer-focus:opacity-100 peer-focus:scale-100 peer-focus:translate-y-0"
                            >
                              Delete
                            </div>
                          </div>
                        </div>
                      </TableCell>
                  </TableRow>
                    {expandedById[id] && (
                      <TableRow key={`${id}-details`}>
                        <TableCell colSpan={7} className="p-0">
                          <ParserProcessings parserId={parser._id} />
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              })}
            </TableBody>
          </Table>
      )}

      {/* Fingerprint dialog */}
      <Dialog open={fingerprintDialogOpen} onOpenChange={setFingerprintDialogOpen}>
        <DialogContent className="sm:max-w-xl border-none">
          <DialogHeader className="items-center">
            <span
              aria-hidden
              className="inline-block w-12 h-12 text-blue-500"
              style={{
                WebkitMaskImage: `url(/svg/doodles/secured.svg)`,
                maskImage: `url(/svg/doodles/secured.svg)`,
                WebkitMaskRepeat: "no-repeat",
                maskRepeat: "no-repeat",
                WebkitMaskPosition: "center",
                maskPosition: "center",
                WebkitMaskSize: "contain",
                maskSize: "contain",
                backgroundColor: "currentColor",
              }}
            />
            <DialogTitle className="sr-only">Fingerprint</DialogTitle>
            <div className="text-xs uppercase tracking-wider opacity-80">fingerprint</div>
          </DialogHeader>
          <div className="space-y-3">
            <CodeFingerprintView fingerprint={activeFingerprint ?? ""} onCopy={notifyCopied} />
            <div className={`text-xs text-cyan-300 transition-opacity ${didCopy ? "visible opacity-100" : "invisible opacity-0"}`}>
              Copied to clipboard
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Code dialog */}
      <Dialog open={codeDialogOpen} onOpenChange={setCodeDialogOpen}>
        <DialogContent className="sm:max-w-3xl border-none">
          <DialogHeader className="items-center">
            <span
              aria-hidden
              className="inline-block w-12 h-12 text-yellow-200"
              style={{
                WebkitMaskImage: `url(/svg/doodles/code-logo.svg)`,
                maskImage: `url(/svg/doodles/code-logo.svg)`,
                WebkitMaskRepeat: "no-repeat",
                maskRepeat: "no-repeat",
                WebkitMaskPosition: "center",
                maskPosition: "center",
                WebkitMaskSize: "contain",
                maskSize: "contain",
                backgroundColor: "currentColor",
              }}
            />
            <DialogTitle className="sr-only">Parser</DialogTitle>
            <div className="text-xs uppercase tracking-wider opacity-80">Parser</div>
          </DialogHeader>
          <div className="space-y-3">
            <div className="relative mx-auto w-full max-w-[64rem] group">
              <Editor
                value={activeCode ?? ""}
                onValueChange={() => { /* read-only */ }}
                highlight={(code) => Prism.highlight(code, Prism.languages.javascript, "javascript")}
                padding={12}
                className="rounded-md bg-background/40 text-foreground text-sm outline-none focus:ring-2 focus:ring-cyan-500"
                style={{
                  fontFamily: '"Fira code", monospace',
                  fontSize: 13,
                  width: "100%",
                  maxWidth: "100%",
                  minHeight: 240,
                  maxHeight: 520,
                  overflow: "auto",
                  lineHeight: 1.5,
                }}
              />
              <button
                type="button"
                onClick={async () => { try { await navigator.clipboard.writeText(activeCode ?? ""); } catch { } ; notifyCopied(); }}
                className="absolute top-2 right-2 p-2 rounded-md hover:bg-foreground/10 transition-opacity opacity-70 group-hover:opacity-100"
                aria-label="Copy code"
                title="Copy"
              >
                <span
                  aria-hidden
                  className="block group-hover:hidden hover:hidden w-5 h-5 text-white"
                  style={{
                    WebkitMaskImage: `url(/svg/doodles/copy.svg)`,
                    maskImage: `url(/svg/doodles/copy.svg)`,
                    WebkitMaskRepeat: "no-repeat",
                    maskRepeat: "no-repeat",
                    WebkitMaskPosition: "center",
                    maskPosition: "center",
                    WebkitMaskSize: "contain",
                    maskSize: "contain",
                    backgroundColor: "currentColor",
                  }}
                />
                <span
                  aria-hidden
                  className="hidden group-hover:block hover:block w-5 h-5 text-white"
                  style={{
                    WebkitMaskImage: `url(/svg/doodles/copy-hover.svg)`,
                    maskImage: `url(/svg/doodles/copy-hover.svg)`,
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
            <div className={`text-xs text-cyan-300 transition-opacity ${didCopy ? "visible opacity-100" : "invisible opacity-0"}`}>
              Copied to clipboard
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {useParserTarget && (
        <UseParserModal
          isOpen={useParserOpen}
          onClose={() => setUseParserOpen(false)}
          parser={{
            _id: useParserTarget._id,
            uuid: useParserTarget.uuid,
            code: useParserTarget.code,
            event: useParserTarget.event,
            fingerprint: useParserTarget.fingerprint,
            payload: useParserTarget.payload,
            state: useParserTarget.state,
          }}
        />
      )}

      {hoverLabel && typeof document !== "undefined" && createPortal(
        (() => {
          const rect = hoverLabel.anchor.getBoundingClientRect();
          const top = rect.bottom + 8;
          const left = rect.left + rect.width / 2;
          return (
            <div
              style={{ position: "fixed", top, left, transform: "translateX(-50%)" }}
              className="z-[99999] text-[10px] text-foreground whitespace-nowrap pointer-events-none"
            >
              {hoverLabel.text}
            </div>
          );
        })(),
        document.body
      )}

      {/* Confirm delete dialog */}
      <ConfirmDialog
        open={confirmDeleteOpen}
        onOpenChange={(o) => { if (!o) setConfirmDeleteTarget(null); setConfirmDeleteOpen(o); }}
        title="Delete parser?"
        description={
          <div className="space-y-2">
            <p>This will permanently remove the parser and its processing history. This action cannot be undone.</p>
            {confirmDeleteTarget ? (
              <div className="text-xs opacity-70">
                <div>UUID: <span className="font-mono">{confirmDeleteTarget.uuid}</span></div>
                <div>Event: <span className="font-mono">{confirmDeleteTarget.event}</span></div>
              </div>
            ) : null}
          </div>
        }
        confirmText="Delete"
        confirmVariant="destructive"
        onConfirm={async () => {
          const target = confirmDeleteTarget;
          if (!target) return;
          const id = target._id as unknown as string;
          setDeletingById((prev) => ({ ...prev, [id]: true }));
          try {
            await deleteParserMutation({ parserId: target._id });
          } finally {
            setDeletingById((prev) => ({ ...prev, [id]: false }));
          }
        }}
      />

      {/* Confirm reset and process dialog */}
      <ConfirmDialog
        open={confirmResetOpen}
        onOpenChange={(o) => { if (!o) setConfirmResetTarget(null); setConfirmResetOpen(o); }}
        title="Reset parser and generate again?"
        description={
          <div className="space-y-2">
            <p>We will clear the current code, set the parser back to idle, and start the processing flow again.</p>
            {confirmResetTarget ? (
              <div className="text-xs opacity-70">
                <div>UUID: <span className="font-mono">{confirmResetTarget.uuid}</span></div>
                <div>Event: <span className="font-mono">{confirmResetTarget.event}</span></div>
              </div>
            ) : null}
          </div>
        }
        confirmText="Reset & Rebuild"
        confirmVariant="default"
        onConfirm={async () => {
          const target = confirmResetTarget;
          if (!target) return;
          const id = target._id as unknown as string;
          setProcessingById((prev) => ({ ...prev, [id]: true }));
          try {
            await resetParserMutation({ parserId: target._id });
            await runProcessParser(target);
          } finally {
            setProcessingById((prev) => ({ ...prev, [id]: false }));
          }
        }}
      />
    </div>
  );
}
