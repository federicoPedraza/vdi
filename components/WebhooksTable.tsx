"use client";

import { useState } from "react";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import TiendanubeWebhooks from "./TiendanubeWebhooks";
import { Spinner } from "@/components/ui/spinner";

interface WebhookLog {
  _id: Id<"webhook_logs">;
  _creationTime: number;
  platform: string;
  event: string;
  payload: any;
  processed: boolean;
  error?: string;
  processedAt?: number;
}

export default function WebhooksTable() {
  const webhookLogs = useQuery(api.procedures.getWebhookLogs, { limit: 50 }) as WebhookLog[] | undefined;
  const [baseUrl, setBaseUrl] = useState("https://your-domain.com");
  const [tempBaseUrl, setTempBaseUrl] = useState("https://your-domain.com");
  const [error, setError] = useState<string | null>(null);

  const handleSaveBaseUrl = () => {
    setBaseUrl(tempBaseUrl);
    // Save to local storage
    localStorage.setItem('webhooks_base_url', tempBaseUrl);
  };

  const handleLoadBaseUrl = () => {
    const saved = localStorage.getItem('webhooks_base_url');
    if (saved) {
      setBaseUrl(saved);
      setTempBaseUrl(saved);
    }
  };

  // Load base URL and check for errors on component mount
  useState(() => {
    handleLoadBaseUrl();

    // Check for error messages in URL
    const urlParams = new URLSearchParams(window.location.search);
    const errorParam = urlParams.get('error');
    if (errorParam) {
      setError(errorParam);
      // Clean up URL
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete('error');
      window.history.replaceState({}, '', newUrl.toString());
    }
  });

  return (
    <div className="w-full p-6 space-y-6">
      {/* Error Message */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 rounded-full bg-red-500"></div>
              <p className="text-red-800 font-medium">
                Connection Error: {error === 'missing_code' ? 'Authorization code not received' :
                                  error === 'auth_failed' ? 'Failed to authenticate with Tiendanube' :
                                  error}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Base URL Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Webhook Configuration</CardTitle>
          <CardDescription>
            Set the base URL for your webhook endpoints. All webhooks will be configured to point to this domain.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <Label htmlFor="baseUrl">Base URL</Label>
              <Input
                id="baseUrl"
                type="url"
                placeholder="https://your-domain.com"
                value={tempBaseUrl}
                onChange={(e) => setTempBaseUrl(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Webhooks will be configured as: {tempBaseUrl}/api/webhooks/[service]/[event]
              </p>
            </div>
            <Button onClick={handleSaveBaseUrl}>
              Save Base URL
            </Button>
          </div>

          {baseUrl && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm text-green-800">
                <strong>Current Base URL:</strong> {baseUrl}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Services */}
      <Card>
        <CardHeader>
          <CardTitle>Webhook Services</CardTitle>
          <CardDescription>
            Configure webhook subscriptions for different e-commerce platforms and services.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="tiendanube" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="tiendanube">Tiendanube</TabsTrigger>
              <TabsTrigger value="logs">Webhook Logs</TabsTrigger>
              {/* Future services can be added here */}
              {/* <TabsTrigger value="shopify">Shopify</TabsTrigger> */}
              {/* <TabsTrigger value="woocommerce">WooCommerce</TabsTrigger> */}
            </TabsList>

            <TabsContent value="tiendanube" className="mt-6">
              <div className="space-y-4">
                <div className="text-center pb-4 border-b">
                  <h3 className="text-lg font-semibold">Tiendanube Webhooks</h3>
                  <p className="text-sm text-muted-foreground">
                    Manage order-related webhook subscriptions for your Tiendanube store
                  </p>
                </div>

                {baseUrl ? (
                  <TiendanubeWebhooks baseUrl={baseUrl} />
                ) : (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">
                      Please set a base URL above to configure Tiendanube webhooks.
                    </p>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="logs" className="mt-6">
              <div className="space-y-4">
                <div className="text-center pb-4 border-b">
                  <h3 className="text-lg font-semibold">Webhook Activity Logs</h3>
                  <p className="text-sm text-muted-foreground">
                    Monitor recent webhook activity and debug any issues
                  </p>
                </div>

                {!webhookLogs ? (
                  <div className="flex justify-center py-8">
                    <Spinner size={24} aria-label="Loading webhook logs" />
                  </div>
                ) : webhookLogs.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">
                      No webhook logs found. Webhook activity will appear here.
                    </p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Platform</TableHead>
                        <TableHead>Event</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Received</TableHead>
                        <TableHead>Processed</TableHead>
                        <TableHead>Error</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {webhookLogs.map((log) => (
                        <TableRow key={log._id}>
                          <TableCell>
                            <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">
                              {log.platform}
                            </span>
                          </TableCell>
                          <TableCell className="font-medium">{log.event}</TableCell>
                          <TableCell>
                            <span className={`text-xs px-2 py-1 rounded ${
                              log.processed
                                ? "bg-green-100 text-green-800"
                                : log.error
                                ? "bg-red-100 text-red-800"
                                : "bg-yellow-100 text-yellow-800"
                            }`}>
                              {log.processed ? "Success" : log.error ? "Failed" : "Pending"}
                            </span>
                          </TableCell>
                          <TableCell className="text-sm text-gray-600">
                            {new Date(log._creationTime).toLocaleString()}
                          </TableCell>
                          <TableCell className="text-sm text-gray-600">
                            {log.processedAt ? new Date(log.processedAt).toLocaleString() : "-"}
                          </TableCell>
                          <TableCell className="text-sm text-red-600 max-w-xs truncate">
                            {log.error || "-"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Information Card */}
      <Card>
        <CardHeader>
          <CardTitle>How Webhooks Work</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <h4 className="font-medium mb-2">Webhook URL Structure</h4>
              <ul className="space-y-1 text-muted-foreground">
                <li>• Base URL: {baseUrl || "https://your-domain.com"}</li>
                <li>• Order Created: {baseUrl || "https://your-domain.com"}/api/webhooks/tiendanube/order-created</li>
                <li>• Order Updated: {baseUrl || "https://your-domain.com"}/api/webhooks/tiendanube/order-updated</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-2">Supported Events</h4>
              <ul className="space-y-1 text-muted-foreground">
                <li>• order/created - New order placed</li>
                <li>• order/updated - Order modified</li>
                <li>• order/paid - Payment received</li>
                <li>• order/packed - Order ready for shipping</li>
                <li>• order/fulfilled - Order delivered</li>
                <li>• order/cancelled - Order cancelled</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
