"use client";

import { useEffect, useRef, useState, memo, useMemo, Fragment } from "react";
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
  const parsers = useQuery(api.procedures.getAllParsers) as Parser[] | undefined;
  const deleteParserMutation = useMutation(api.procedures.deleteParser);

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

  const CodeViewer = memo(function CodeViewer({ code, onCopy }: { code: string; onCopy: () => void }) {
    const tokens = useMemo(() => {
      // Very lightweight JS-ish tokenizer for coloring and line numbers
      const punctuation = /[{}\[\]\(\)\.,;:\+\-\*\/=\|\\\?`!%^~#@]/;
      const word = /[A-Za-z_$][A-Za-z0-9_$]*/y;
      const number = /-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/y;
      const stringDQ = /"(?:[^"\\]|\\.)*"/y;
      const stringSQ = /'(?:[^'\\]|\\.)*'/y;
      const space = /\s+/y;
      const keywords = new Set([
        "const", "let", "var", "function", "return", "if", "else", "for", "while", "do", "switch", "case", "break", "continue", "try", "catch", "finally", "throw", "new", "class", "extends", "super", "this", "typeof", "instanceof", "in", "of", "await", "async", "import", "from", "export", "default", "null", "true", "false"
      ]);

      const lines: Array<Array<React.ReactNode>> = [[]];
      const pushToken = (node: React.ReactNode) => {
        lines[lines.length - 1].push(node);
      };

      let i = 0;
      while (i < code.length) {
        // Newline handling
        if (code[i] === '\n') {
          lines.push([]);
          i++;
          continue;
        }
        // Strings
        stringDQ.lastIndex = i;
        const mDQ = stringDQ.exec(code);
        if (mDQ && mDQ.index === i) {
          pushToken(<span key={`s${i}`} className="text-emerald-300">{mDQ[0]}</span>);
          i = stringDQ.lastIndex;
          continue;
        }
        stringSQ.lastIndex = i;
        const mSQ = stringSQ.exec(code);
        if (mSQ && mSQ.index === i) {
          pushToken(<span key={`s${i}`} className="text-emerald-300">{mSQ[0]}</span>);
          i = stringSQ.lastIndex;
          continue;
        }
        // Numbers
        number.lastIndex = i;
        const mNum = number.exec(code);
        if (mNum && mNum.index === i) {
          pushToken(<span key={`n${i}`} className="text-orange-300">{mNum[0]}</span>);
          i = number.lastIndex;
          continue;
        }
        // Words
        word.lastIndex = i;
        const mWord = word.exec(code);
        if (mWord && mWord.index === i) {
          const w = mWord[0];
          if (keywords.has(w)) {
            pushToken(<span key={`k${i}`} className="text-sky-300">{w}</span>);
          } else if (w === "null" || w === "true" || w === "false") {
            pushToken(<span key={`b${i}`} className="text-purple-300">{w}</span>);
          } else {
            pushToken(w);
          }
          i = word.lastIndex;
          continue;
        }
        // Punctuation
        if (punctuation.test(code[i])) {
          pushToken(<span key={`p${i}`} className="text-cyan-400">{code[i]}</span>);
          i++;
          continue;
        }
        // Spaces
        space.lastIndex = i;
        const mSpace = space.exec(code);
        if (mSpace && mSpace.index === i) {
          pushToken(mSpace[0]);
          i = space.lastIndex;
          continue;
        }
        // Fallback single char
        pushToken(code[i]);
        i++;
      }

      return lines;
    }, [code]);

    const handleClick = async () => {
      const selection = window.getSelection();
      const selectedText = selection ? selection.toString() : "";
      if (selectedText.length === 0) {
        try {
          await navigator.clipboard.writeText(code);
          onCopy();
        } catch { }
      }
    };

    return (
      <div className="relative mx-auto w-full max-w-[64rem] group">
        <div
          role="textbox"
          aria-readonly="true"
          onClick={handleClick}
          className="w-full h-[520px] max-h-[520px] overflow-auto rounded-md bg-background/40 text-foreground font-mono text-sm p-3 outline-none focus:ring-2 focus:ring-cyan-500 leading-6 select-text cursor-text"
        >
          {tokens.map((line, idx) => (
            <div key={idx} className="flex gap-3">
              <div className="w-10 shrink-0 text-right pr-2 text-muted-foreground/70 select-none">{idx + 1}</div>
              <pre className="whitespace-pre-wrap break-words m-0 p-0">{line}</pre>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={async () => { try { await navigator.clipboard.writeText(code); } catch { }; onCopy(); }}
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
    );
  });

  const [selectedById, setSelectedById] = useState<Record<string, boolean>>({});
  const [expandedById, setExpandedById] = useState<Record<string, boolean>>({});
  const [fingerprintDialogOpen, setFingerprintDialogOpen] = useState(false);
  const [activeFingerprint, setActiveFingerprint] = useState<string | null>(null);
  const [codeDialogOpen, setCodeDialogOpen] = useState(false);
  const [activeCode, setActiveCode] = useState<string | null>(null);
  const [didCopy, setDidCopy] = useState(false);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [deletingById, setDeletingById] = useState<Record<string, boolean>>({});

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

  const allIds = (parsers ?? []).map((p) => (p._id as unknown as string));
  const numSelected = allIds.filter((id) => selectedById[id]).length;
  const allSelected = parsers && parsers.length > 0 && numSelected === parsers.length;
  const noneSelected = numSelected === 0;
  const someSelected = !noneSelected && !allSelected;

  const toggleAll = () => {
    if (!parsers) return;
    if (allSelected) {
      setSelectedById({});
    } else {
      const next: Record<string, boolean> = {};
      for (const p of parsers) {
        next[p._id as unknown as string] = true;
      }
      setSelectedById(next);
    }
  };

  const toggleOne = (id: string) => {
    setSelectedById((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleExpanded = (id: string) => {
    setExpandedById((prev) => ({ ...prev, [id]: !prev[id] }));
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

    return (
      <div className="rounded-md bg-background/40 p-3 border-b border-white/10">
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
        <div className="py-4">No adapters yet.</div>
      ) : (
          <Table className="w-full mx-auto">
            <TableHeader>
              <TableRow>
                <TableHead className="w-8 p-0">
                  <button className="block p-0 m-0" onClick={toggleAll} aria-label="Select all">
                    <span
                      aria-hidden
                      className={cn(
                        "inline-block w-4 h-4 mx-2 align-middle text-white",
                        someSelected ? "opacity-100 hover:opacity-40 transition-opacity duration-200" : allSelected ? "opacity-100" : "opacity-10 hover:opacity-40 transition-opacity duration-200",
                      )}
                      style={{
                        WebkitMaskImage: `url(${someSelected ? "/svg/doodles/checkbox-middle.svg" : allSelected ? "/svg/doodles/checkbox-on.svg" : "/svg/doodles/checkbox-off.svg"})`,
                        maskImage: `url(${someSelected ? "/svg/doodles/checkbox-middle.svg" : allSelected ? "/svg/doodles/checkbox-on.svg" : "/svg/doodles/checkbox-off.svg"})`,
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
                </TableHead>
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
                const isSelected = !!selectedById[id];
                return (
                  <Fragment key={id}>
                    <TableRow>
                    <TableCell className="p-0 align-middle">
                      <button
                        className="block p-0 m-0"
                        onClick={() => toggleOne(id)}
                        aria-label={isSelected ? "Deselect" : "Select"}
                      >
                        <span
                          aria-hidden
                          className={cn("inline-block w-4 h-4 mx-2 align-middle", isSelected ? "opacity-100" : "opacity-10 hover:opacity-40 transition-opacity duration-200")}
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
                    </TableCell>
                      <TableCell className="font-mono text-center p-0 w-0">
                      <button
                        className="p-0 m-0 inline-flex items-center justify-center transition-transform duration-150 hover:scale-110 focus:outline-none focus:ring-2 focus:ring-cyan-500 rounded"
                        onClick={() => openFingerprint(parser.fingerprint)}
                        aria-label="Show fingerprint"
                        title="Show fingerprint"
                      >
                        <span
                          aria-hidden
                          className={`inline-block w-6 h-6 align-middle transition-opacity duration-150 hover:opacity-80 ${parser.state === "failed" ? "text-red-200" : parser.state === "building" ? "text-cyan-200" : "text-white"}`}
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
                      </TableCell>
                      <TableCell className="font-mono text-center">
                        <button
                          className="p-0 m-0 inline-flex items-center justify-center transition-transform duration-150 hover:scale-110 focus:outline-none focus:ring-2 focus:ring-cyan-500 rounded"
                          onClick={() => openCode(parser.code || "")}
                          aria-label="Show parser code"
                          title="Show parser code"
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
                      </TableCell>
                    <TableCell>{parser.language}</TableCell>
                    <TableCell className="capitalize">{parser.state}</TableCell>
                    <TableCell>{formatDate(parser._creationTime)}</TableCell>
                    <TableCell>
                      <div>
                          {/* EXECUTE */}
                          <button
                            className="p-2 inline-flex items-center justify-center transition-transform duration-150 hover:scale-110 focus:outline-none focus:ring-2 focus:ring-cyan-500 rounded disabled:cursor-default"
                            onClick={() => { }}
                          >
                            <span
                              aria-hidden
                              className="inline-block w-5 h-5 align-middle text-blue-400 transition-opacity duration-150 hover:opacity-80"
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
                          {/* START PARSING */}
                          <button
                            className="p-2 inline-flex items-center justify-center transition-transform duration-150 hover:scale-110 focus:outline-none focus:ring-2 focus:ring-cyan-500 rounded disabled:cursor-default"
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
                          >
                            <span
                              aria-hidden
                              className="inline-block w-5 h-5 align-middle text-green-400 transition-opacity duration-150 hover:opacity-80"
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
                          {/* EXPAND/COLLAPSE PROCESSES */}
                          <button
                            className="p-2 inline-flex items-center justify-center transition-transform duration-150 hover:scale-110 focus:outline-none focus:ring-2 focus:ring-cyan-500 rounded"
                            onClick={() => toggleExpanded(id)}
                            aria-label={expandedById[id] ? "Hide processes" : "Show processes"}
                            title={expandedById[id] ? "Hide processes" : "Show processes"}
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
                          {/* DELETE */}
                          <button
                            className="p-2 inline-flex items-center justify-center transition-transform duration-150 hover:scale-110 focus:outline-none focus:ring-2 focus:ring-cyan-500 rounded disabled:cursor-default"
                            onClick={async () => {
                              try {
                                setDeletingById((prev) => ({ ...prev, [id]: true }));
                                await deleteParserMutation({ parserId: parser._id });
                              } catch (err) {
                                console.error("Failed to delete parser", err);
                              } finally {
                                setDeletingById((prev) => ({ ...prev, [id]: false }));
                              }
                            }}
                            disabled={!!deletingById[id]}
                            aria-label="Delete parser"
                            title="Delete parser"
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
            <CodeViewer code={activeCode ?? ""} onCopy={notifyCopied} />
            <div className={`text-xs text-cyan-300 transition-opacity ${didCopy ? "visible opacity-100" : "invisible opacity-0"}`}>
              Copied to clipboard
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
