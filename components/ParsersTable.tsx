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
import UseParserModal from "@/components/UseParserModal";

interface Parser {
  _id: Id<"parsers">;
  _creationTime: number;
  uuid: string;
  name: string;
  language: string;
  platform?: string;
  event?: string;
  isActive: boolean;
  lastUsed?: number;
  successCount: number;
  errorCount: number;
  state: "building" | "success" | "failed";
  dir?: string;
  error?: string;
  code?: string;
}

export default function ParsersTable() {
  const parsers = useQuery(api.procedures.getAllParsers) as Parser[] | undefined;
  const toggleParserStatus = useMutation(api.procedures.toggleParserStatus);
  const deleteParser = useMutation(api.procedures.deleteParser);
  const resetFailedParser = useMutation(api.procedures.resetFailedParser);

  const [selectedParser, setSelectedParser] = useState<Parser | null>(null);
  const [isUseModalOpen, setIsUseModalOpen] = useState(false);

    const processBuildingParsers = async () => {
    try {
      const response = await fetch('/api/process-parsers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const result = await response.json();
        console.log('Processing result:', result);
        // Refresh the page to show updated states
        window.location.reload();
      } else {
        console.error('Failed to process parsers');
      }
    } catch (error) {
      console.error('Error processing parsers:', error);
    }
  };

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

  const handleToggleStatus = async (parserId: Id<"parsers">) => {
    try {
      await toggleParserStatus({ parserId });
    } catch (error) {
      console.error("Failed to toggle parser status:", error);
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
          <div className="flex space-x-2">
            {parsers?.some(p => p.state === 'building') && (
              <Button
                onClick={processBuildingParsers}
                variant="outline"
                className="bg-blue-50 hover:bg-blue-100"
              >
                Process Building Parsers
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {parsers.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No parsers found. Send a webhook to generate your first parser!
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Platform/Event</TableHead>
                <TableHead>Language</TableHead>
                <TableHead>State</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Success Rate</TableHead>
                <TableHead>Last Used</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {parsers.map((parser) => (
                <TableRow key={parser._id}>
                  <TableCell className="font-medium">
                    <div className="max-w-xs truncate" title={parser.name}>
                      {parser.name}
                    </div>
                    <div className="text-xs text-gray-500 font-mono">
                      {parser.uuid.slice(0, 8)}...
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      {parser.platform && parser.event ? (
                        <>
                          <div className="font-medium">{parser.platform}</div>
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
                      {parser.state === 'building' && (
                        <span className="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded">
                          Building
                        </span>
                      )}
                      {parser.state === 'success' && (
                        <div className="flex flex-col space-y-1">
                          <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded">
                            Success
                          </span>
                          {parser.dir && (
                            <span className="text-xs text-green-600" title={parser.dir}>
                              {parser.dir}
                            </span>
                          )}
                        </div>
                      )}
                      {parser.state === 'failed' && (
                        <div className="flex flex-col space-y-1">
                          <span className="bg-red-100 text-red-800 text-xs px-2 py-1 rounded">
                            Failed
                          </span>
                          {parser.error && (
                            <span className="text-xs text-red-600" title={parser.error}>
                              {parser.error.length > 30 ? parser.error.substring(0, 30) + '...' : parser.error}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <Switch
                        checked={parser.isActive}
                        onCheckedChange={() => handleToggleStatus(parser._id)}
                        disabled={parser.state === 'building'}
                      />
                      <span className={parser.isActive ? "text-green-600" : "text-gray-400"}>
                        {parser.isActive ? "Active" : "Inactive"}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      {getSuccessRate(parser.successCount, parser.errorCount)}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-gray-600">
                    {formatLastUsed(parser.lastUsed)}
                  </TableCell>
                  <TableCell className="text-sm text-gray-600">
                    {formatDate(parser._creationTime)}
                  </TableCell>
                  <TableCell>
                    <div className="flex space-x-2">
                      {(parser.state === 'building' || parser.state === 'failed') && (
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => processIndividualParser(parser._id)}
                          className="bg-blue-600 hover:bg-blue-700"
                        >
                          {parser.state === 'building' ? 'Start Building' : 'Retry Build'}
                        </Button>
                      )}
                      {parser.state === 'failed' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleResetParser(parser._id)}
                          className="bg-orange-50 hover:bg-orange-100 text-orange-700 border-orange-200"
                        >
                          Reset
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedParser(parser);
                          setIsUseModalOpen(true);
                        }}
                        disabled={parser.state !== 'success'}
                        className="bg-green-50 hover:bg-green-100 text-green-700 border-green-200"
                      >
                        Use
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDeleteParser(parser._id)}
                      >
                        Delete
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
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
            name: selectedParser.name,
            uuid: selectedParser.uuid,
            code: selectedParser.code,
          }}
        />
      )}
    </Card>
  );
}
