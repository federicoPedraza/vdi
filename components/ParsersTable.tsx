"use client";

import { useEffect, useRef, useState, memo, useMemo } from "react";
import { useQuery } from "convex/react";
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

export default function ParsersTable() {
  const parsers = useQuery(api.procedures.getAllParsers) as Parser[] | undefined;

  const formatDate = (timestamp: number) => new Date(timestamp).toLocaleString("en-US", {
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const [selectedById, setSelectedById] = useState<Record<string, boolean>>({});
  const [fingerprintDialogOpen, setFingerprintDialogOpen] = useState(false);
  const [activeFingerprint, setActiveFingerprint] = useState<string | null>(null);
  const [didCopy, setDidCopy] = useState(false);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const openFingerprint = (fp: string) => {
    setActiveFingerprint(fp);
    setFingerprintDialogOpen(true);
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

  if (!parsers) {
    return <div className="p-2">Loading...</div>;
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
                <TableHead className="font-bold uppercase underline">Language</TableHead>
                <TableHead className="font-bold uppercase underline">State</TableHead>
                <TableHead className="font-bold uppercase underline">Created</TableHead>
                <TableHead className="font-bold uppercase underline">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {parsers.map((parser) => {
                const id = parser._id as unknown as string;
                const isSelected = !!selectedById[id];
                return (
                  <TableRow key={parser._id}>
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
                    <TableCell className="font-mono text-center">
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
                            WebkitMaskImage: `url(${parser.state === "success" ? "/svg/doodles/fingerprint-done.svg" : parser.state === "failed" ? "/svg/doodles/fingerprint-pending.svg" : "/svg/doodles/fingerprint-building.svg"})`,
                            maskImage: `url(${parser.state === "success" ? "/svg/doodles/fingerprint-done.svg" : parser.state === "failed" ? "/svg/doodles/fingerprint-pending.svg" : "/svg/doodles/fingerprint-building.svg"})`,
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
                        {/* RESET */}
                        <button className="p-2 rounded-full group cursor-pointer opacity-50 hover:opacity-100 transition-opacity duration-200 disabled:cursor-default"
                          onClick={() => { }}>
                          <span
                            aria-hidden
                            className="inline-block w-5 h-5 align-middle text-cyan-500"
                            style={{
                              WebkitMaskImage: `url(/svg/doodles/restart.svg)`,
                              maskImage: `url(/svg/doodles/restart.svg)`,
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
                        <button className="p-2 rounded-full group cursor-pointer opacity-50 hover:opacity-100 transition-opacity duration-200 disabled:cursor-default"
                          onClick={() => { }}>
                          <span
                            aria-hidden
                            className="inline-block w-5 h-5 align-middle text-red-500"
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
    </div>
  );
}
