"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
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
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import UseParserModal from "@/components/UseParserModal";
import {
  FingerprintIcon,
  ChevronDown,
  ChevronRight,
  FileText,
  Play,
  RotateCcw,
  Wand2,
  Trash2,
  ListTree,
  Eye,
  EyeOff,
} from "lucide-react";

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

interface ParserProcessing {
  _id: Id<"parser_processings">;
  _creationTime: number;
  parserId: Id<"parsers">;
  requestId: string;
  step: number;
  logs: string;
  status: "running" | "success" | "failed";
  startedAt: number;
  finishedAt?: number;
  error?: string;
}

function ParserProcesses({ parserId }: { parserId: Id<"parsers"> }) {
  const processings = useQuery(api.procedures.getProcessingsByParser, { parserId }) as
    | ParserProcessing[]
    | undefined;
  const [expandedLogs, setExpandedLogs] = useState<Record<string, boolean>>({});
  const [copied, setCopied] = useState<Record<string, boolean>>({});
  const [recentlyChanged, setRecentlyChanged] = useState<Record<string, boolean>>({});
  const previewMapRef = useState<Record<string, string>>({})[0];
  const logRefs = useState<Record<string, HTMLDivElement | null>>({})[0];

  const toggleLog = (id: string) =>
    setExpandedLogs((prev) => ({ ...prev, [id]: !prev[id] }));

  const TOTAL_STEPS = 9;

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    const s = Math.floor(ms / 1000);
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    const remS = s % 60;
    if (m < 60) return remS ? `${m}m ${remS}s` : `${m}m`;
    const h = Math.floor(m / 60);
    const remM = m % 60;
    return remM ? `${h}h ${remM}m` : `${h}h`;
  };

  const lastLine = (text: string) => {
    const lines = (text || "").split("\n").filter((l) => l.trim().length > 0);
    return lines.length > 0 ? lines[lines.length - 1] : "No logs";
  };

  // Detect preview changes to control transient blur while running
  if (processings) {
    for (const proc of processings) {
      const id = proc._id as unknown as string;
      const preview = lastLine(proc.logs);
      const prev = previewMapRef[id];
      const isRunning = proc.status === "running" && !proc.finishedAt;
      if (isRunning && preview !== prev) {
        previewMapRef[id] = preview;
        setRecentlyChanged((prevMap) => ({ ...prevMap, [id]: true }));
        // Clear the changed flag after a short delay to remove blur
        setTimeout(() => {
          setRecentlyChanged((prevMap) => ({ ...prevMap, [id]: false }));
        }, 1500);
      } else if (prev === undefined) {
        // Initialize map to avoid undefined comparisons later
        previewMapRef[id] = preview;
      }
    }
  }

  // Auto-scroll log viewers to the end when open or on log updates
  const requestAnimationScroll = (el: HTMLDivElement) => {
    // Use rAF for smoother scroll after DOM paints
    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
    });
  };

  if (processings) {
    for (const proc of processings) {
      const id = proc._id as unknown as string;
      const container = logRefs[id];
      if (container && expandedLogs[id]) {
        requestAnimationScroll(container);
      }
    }
  }

  if (!processings) return <div className="text-sm text-gray-500">Loading processes...</div>;
  if (processings.length === 0) return <div className="text-sm text-gray-500">No processes yet.</div>;

  return (
    <div className="space-y-2">
      <Table className="w-full">
        <TableHeader>
          <TableRow>
            <TableHead>Request ID</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Current Step</TableHead>
            <TableHead>Duration</TableHead>
            <TableHead>Logs</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {processings.map((proc) => {
            const isOpen = !!expandedLogs[proc._id as unknown as string];
            const durationMs = proc.finishedAt ? (proc.finishedAt - proc.startedAt) : (Date.now() - proc.startedAt);
            const isRunning = proc.status === "running" && !proc.finishedAt;
            return (
              <>
                <TableRow
                  key={proc._id + "-row"}
                  onClick={() => toggleLog(proc._id as unknown as string)}
                  className="cursor-pointer"
                >
                  <TableCell className="font-mono text-[10px] opacity-60 break-all">
                    <button
                      className="hover:opacity-100 transition-opacity"
                      onClick={(e) => {
                        e.stopPropagation();
                        const id = proc._id as unknown as string;
                        navigator.clipboard.writeText(proc.requestId).then(() => {
                          setCopied((prev) => ({ ...prev, [id]: true }));
                          setTimeout(() => setCopied((prev) => ({ ...prev, [id]: false })), 1200);
                        });
                      }}
                      title="Copy request ID"
                      aria-label="Copy request ID"
                    >
                      {proc.requestId.slice(0, 8)}...
                    </button>
                    {copied[proc._id as unknown as string] && (
                      <span className="ml-2 text-[10px] text-green-700">Copied</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {proc.status === "running" && (
                      <span className="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded">Running</span>
                    )}
                    {proc.status === "success" && (
                      <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded">Success</span>
                    )}
                    {proc.status === "failed" && (
                      <span className="bg-red-100 text-red-800 text-xs px-2 py-1 rounded">Failed</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">
                      {proc.step}/{isRunning ? TOTAL_STEPS : proc.step}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-gray-600">{formatDuration(durationMs)}</TableCell>
                  <TableCell>
                    <div className="flex items-center justify-between gap-2">
                      <div
                        className={
                          "text-xs text-gray-700 opacity-60 w-80 max-w-[28rem] overflow-hidden whitespace-nowrap text-ellipsis transition-all " +
                          (isRunning && recentlyChanged[proc._id as unknown as string] ? "blur-[1.5px]" : "blur-0")
                        }
                      >
                        {lastLine(proc.logs)}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleLog(proc._id as unknown as string);
                        }}
                        aria-label={isOpen ? "Hide logs" : "View logs"}
                        title={isOpen ? "Hide logs" : "View logs"}
                      >
                        {isOpen ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
                {isOpen && (
                  <TableRow key={proc._id + "-logs"}>
                    <TableCell colSpan={5}>
                      <div
                        ref={(el) => {
                          logRefs[proc._id as unknown as string] = el;
                        }}
                        className="bg-black text-green-200 border rounded p-3 max-h-80 overflow-auto font-mono text-xs"
                      >
                        <pre className="whitespace-pre-wrap">{proc.logs || "No logs"}</pre>
                        {proc.error && (
                          <div className="mt-2 text-xs text-red-400">Error: {proc.error}</div>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

export default function ParsersTable() {
  const parsers = useQuery(api.procedures.getAllParsers) as Parser[] | undefined;
  const deleteParser = useMutation(api.procedures.deleteParser);
  const resetFailedParser = useMutation(api.procedures.resetFailedParser);

  const [selectedParser, setSelectedParser] = useState<Parser | null>(null);
  const [isUseModalOpen, setIsUseModalOpen] = useState(false);
  const [openParsers, setOpenParsers] = useState<Record<string, boolean>>({});
  const [isFingerprintModalOpen, setIsFingerprintModalOpen] = useState(false);
  const [fingerprintToView, setFingerprintToView] = useState<string | null>(null);
  const [fingerprintCopied, setFingerprintCopied] = useState(false);

  const toggleParserProcesses = (id: string) =>
    setOpenParsers((prev) => ({ ...prev, [id]: !prev[id] }));

  const processIndividualParser = async (parserId: Id<"parsers">) => {
    try {
      const response = await fetch('/api/process-parser', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ parserId }),
      });

      if (response.ok) {
        const result = await response.json();
        console.log('Individual parser processing result:', result);
        // Refresh the page to show updated states
        window.location.reload();
      } else {
        console.error('Failed to process individual parser');
      }
    } catch (error) {
      console.error('Error processing individual parser:', error);
    }
  };

  const handleDeleteParser = async (parserId: Id<"parsers">) => {
    if (confirm("Are you sure you want to delete this parser?")) {
      try {
        await deleteParser({ parserId });
      } catch (error) {
        console.error("Failed to delete parser:", error);
      }
    }
  };

  const handleResetParser = async (parserId: Id<"parsers">) => {
    if (confirm("Are you sure you want to reset this failed parser? This will clear the error and allow it to be rebuilt.")) {
      try {
        await resetFailedParser({ parserId });
        console.log("Parser reset successfully");
      } catch (error) {
        console.error("Failed to reset parser:", error);
        alert("Failed to reset parser: " + (error as Error).message);
      }
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  const formatLastUsed = (timestamp?: number) => {
    if (!timestamp) return "Never";
    return new Date(timestamp).toLocaleString();
  };

  const getSuccessRate = (successCount: number, errorCount: number) => {
    const total = successCount + errorCount;
    if (total === 0) return "No executions";
    return `${Math.round((successCount / total) * 100)}% (${successCount}/${total})`;
  };

  if (!parsers) {
    return <div className="p-6">Loading parsers...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div className="flex flex-col justify-between items-start">
            <CardTitle>AI-Generated Parsers</CardTitle>
            <p className="text-sm text-gray-600">
              Manage AI-generated webhook parsers for different platforms and events
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {parsers.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No parsers found. Send a webhook to generate your first parser!
          </div>
        ) : (
          <Table className="w-full">
            <TableHeader>
              <TableRow>
                <TableHead>Fingerprint</TableHead>
                <TableHead>Event</TableHead>
                <TableHead>Language</TableHead>
                <TableHead>State</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {parsers.map((parser) => {
                const isOpen = !!openParsers[parser._id as unknown as string];
                return (
                  <>
                    <TableRow key={parser._id}>
                      <TableCell className="font-medium flex flex-col items-center space-y-1">
                        <button
                          className="flex items-center space-x-2 border border-gray-200 rounded-full p-2 hover:border-blue-500 hover:bg-blue-100 transition-colors group"
                          onClick={() => {
                            setFingerprintToView(parser.fingerprint);
                            setIsFingerprintModalOpen(true);
                            setFingerprintCopied(false);
                          }}
                          aria-label="View fingerprint"
                          title="View fingerprint"
                        >
                          <FingerprintIcon className="w-5 h-5 text-blue-500 group-hover:text-blue-500 transition-colors" />
                        </button>
                        <div className="text-xs text-gray-500 font-mono cursor-pointer hover:text-blue-500 transition-colors">
                          {parser.uuid.slice(0, 8)}...
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {parser.event ? (
                            <>
                              <div className="text-gray-500">{parser.event}</div>
                            </>
                          ) : (
                            <span className="text-gray-400">Generic</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">
                          {parser.language}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          {(parser.state === 'building' || parser.state === 'idle') && (
                            <span className="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded">
                              {parser.state === 'idle' ? 'Idle' : 'Building'}
                            </span>
                          )}
                          {parser.state === 'success' && (
                            <div className="flex flex-col space-y-1">
                              <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded">
                                Success
                              </span>
                            </div>
                          )}
                          {parser.state === 'failed' && (
                            <div className="flex flex-col space-y-1">
                              <span className="bg-red-100 text-red-800 text-xs px-2 py-1 rounded">
                                Failed
                              </span>
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-gray-600">
                        {formatDate(parser._creationTime)}
                      </TableCell>
                      <TableCell>
                        <div className="flex space-x-2 items-end justify-end">
                          {(parser.state === 'idle' || parser.state === 'building' || parser.state === 'failed') && (
                            <Button
                              variant="default"
                              size="icon"
                              onClick={() => processIndividualParser(parser._id)}
                              className="bg-blue-600 hover:bg-blue-700"
                              aria-label={parser.state === 'failed' ? 'Retry build' : 'Start build'}
                              title={parser.state === 'failed' ? 'Retry build' : 'Start build'}
                            >
                              {parser.state === 'failed' ? (
                                <RotateCcw className="w-4 h-4" />
                              ) : (
                                <Play className="w-4 h-4" />
                              )}
                            </Button>
                          )}
                          {/* Removed separate Reset action to keep only one retry action */}
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => {
                              setSelectedParser(parser);
                              setIsUseModalOpen(true);
                            }}
                            disabled={parser.state !== 'success'}
                            className="bg-green-50 hover:bg-green-100 text-green-700 border-green-200 disabled:opacity-50"
                            aria-label="Use parser"
                            title="Use parser"
                          >
                            <Wand2 className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => toggleParserProcesses(parser._id as unknown as string)}
                            aria-label={isOpen ? 'Hide processes' : 'Show processes'}
                            title={isOpen ? 'Hide processes' : 'Show processes'}
                          >
                            <ListTree className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="destructive"
                            size="icon"
                            onClick={() => handleDeleteParser(parser._id)}
                            aria-label="Delete parser"
                            title="Delete parser"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                    {isOpen && (
                      <TableRow key={parser._id + "-processes"}>
                        <TableCell colSpan={7}>
                          <div className="p-3 border rounded bg-gray-50">
                            <div className="mb-2 text-sm font-medium text-gray-700">Processes</div>
                            <ParserProcesses parserId={parser._id} />
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>

      {/* Use Parser Modal */}
      {selectedParser && (
        <UseParserModal
          isOpen={isUseModalOpen}
          onClose={() => {
            setIsUseModalOpen(false);
            setSelectedParser(null);
          }}
          parser={{
            _id: selectedParser._id,
            name: `Parser ${selectedParser.uuid.slice(0, 8)}`,
            uuid: selectedParser.uuid,
            code: selectedParser.code,
          }}
        />
      )}

      {/* Fingerprint Modal */}
      <Dialog open={isFingerprintModalOpen} onOpenChange={(open) => setIsFingerprintModalOpen(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Parser Fingerprint</DialogTitle>
          </DialogHeader>
          <div className="mt-2">
            <pre className="bg-gray-100 border rounded p-3 font-mono text-xs break-all whitespace-pre-wrap">
              {fingerprintToView}
            </pre>
          </div>
          <DialogFooter>
            <div className="flex w-full justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setIsFingerprintModalOpen(false)}
              >
                Close
              </Button>
              <Button
                onClick={() => {
                  if (fingerprintToView) {
                    navigator.clipboard.writeText(fingerprintToView);
                    setFingerprintCopied(true);
                    setTimeout(() => setFingerprintCopied(false), 1200);
                  }
                }}
                aria-label="Copy fingerprint"
                title="Copy fingerprint"
              >
                {fingerprintCopied ? "Copied" : "Copy"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
