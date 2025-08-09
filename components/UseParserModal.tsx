"use client";

import React, { useState, useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
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

interface UseParserModalProps {
  isOpen: boolean;
  onClose: () => void;
  parser: {
    _id: Id<"parsers">;
    name: string;
    uuid: string;
    code?: string;
  };
}

export default function UseParserModal({ isOpen, onClose, parser }: UseParserModalProps) {
  const [payload, setPayload] = useState('{\n  "example": "data",\n  "client": {\n    "email": "john.doe@example.com",\n    "firstName": "John",\n    "lastName": "Doe"\n  },\n  "order": {\n    "id": "ORD-2024-001",\n    "total": 100.50,\n    "currency": "USD"\n  }\n}');
  const [isExecuting, setIsExecuting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch the latest parser data to ensure we have the code
  const freshParser = useQuery(
    api.procedures.getParserByUuid,
    isOpen ? { uuid: parser.uuid } : "skip"
  );

  const processWebhookData = useMutation(api.procedures.processWebhookDataPublic);

  // Use fresh parser data if available, fallback to prop
  const activeParser = freshParser || parser;

    const executeParser = async () => {
    console.log("Original parser object:", parser);
    console.log("Fresh parser object:", freshParser);
    console.log("Active parser code:", activeParser.code);

    if (!activeParser.code) {
      setError("Parser code is not available. Make sure the parser has been successfully built and has generated code.");
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
        `${activeParser.code}\nreturn exec(payload);`
      );

      const parseResult = parseFunction(parsedPayload);
      console.log("Parse result:", parseResult);

      if (!parseResult) {
        setError("Parser returned null - check your payload format");
        return;
      }

      if (!parseResult.client || !parseResult.order) {
        setError("Parser result missing required fields (client and order)");
        return;
      }

      // Store the parsed data in the database
      const dbResult = await processWebhookData({
        clientData: parseResult.client,
        orderData: parseResult.order,
        shippingData: parseResult.shipping,
        orderLinesData: parseResult.orderLines,
      });

      console.log("Data stored successfully:", dbResult);
      setResult({
        parsed: parseResult,
        stored: dbResult,
      });

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

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Use Parser: {freshParser?.event ?? parser.name}</DialogTitle>
          <DialogDescription>
            Test the parser by providing a JSON payload. The parsed data will be stored in the database.
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

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-red-800 text-sm font-medium">Error:</p>
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          {result && (
            <div className="space-y-4">
              <div className="p-3 bg-green-50 border border-green-200 rounded-md">
                <p className="text-green-800 text-sm font-medium">✅ Success! Data stored in database</p>
                <p className="text-green-700 text-sm">
                  Client ID: {result.stored.clientId} | Order ID: {result.stored.orderId}
                </p>
              </div>

              <div className="grid gap-3">
                <div className="p-3 bg-gray-50 border rounded-md">
                  <Label className="text-sm font-medium text-gray-700">Parsed Result:</Label>
                  <pre className="mt-2 text-xs bg-white p-2 border rounded overflow-x-auto">
                    {JSON.stringify(result.parsed, null, 2)}
                  </pre>
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
            disabled={isExecuting || !activeParser.code}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {isExecuting ? (
              <span className="inline-flex items-center gap-2">
                <Spinner size={16} aria-label="Executing" />
                Executing
              </span>
            ) : !activeParser.code ? (
              "No Code Available"
            ) : (
              "Execute Parser"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
