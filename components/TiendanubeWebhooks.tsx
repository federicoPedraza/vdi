"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { generateInstallUrl } from "@/lib/tiendanube";

interface WebhookSubscription {
  id: number;
  event: string;
  url: string;
  created_at: string;
  updated_at: string;
}

interface WebhookEvent {
  event: string;
  description: string;
  enabled: boolean;
}

interface TiendanubeConnection {
  accessToken: string;
  storeId: string;
  isConnected: boolean;
}

export default function TiendanubeWebhooks({ baseUrl }: { baseUrl: string }) {
  const [webhookEvents, setWebhookEvents] = useState<WebhookEvent[]>([
    { event: "order/created", description: "Triggered when a new order is created", enabled: false },
    { event: "order/updated", description: "Triggered when an order is updated", enabled: false },
    { event: "order/paid", description: "Triggered when an order is paid", enabled: false },
    { event: "order/packed", description: "Triggered when an order is packed", enabled: false },
    { event: "order/fulfilled", description: "Triggered when an order is fulfilled", enabled: false },
    { event: "order/cancelled", description: "Triggered when an order is cancelled", enabled: false },
  ]);

  const [subscriptions, setSubscriptions] = useState<WebhookSubscription[]>([]);
  const [loading, setLoading] = useState(false);
  const [connection, setConnection] = useState<TiendanubeConnection>({
    accessToken: 'a8f14a6e794618ab232b4b815f2154a5ab369a1c',
    storeId: '6451847',
    isConnected: true
  });

    const generateWebhookUrl = (event: string) => {
    return `${baseUrl}/api/webhooks/tiendanube/${event.replace('/', '-')}`;
  };

  const handleConnectTiendanube = () => {
    // According to Tiendanube docs, we navigate directly to the install URL
    const installUrl = generateInstallUrl();
    window.location.href = installUrl;
  };

  const handleToggleWebhook = async (event: string, enabled: boolean) => {
    if (!connection.isConnected) {
      alert('Please connect to Tiendanube first');
      return;
    }

    setLoading(true);
    try {
      if (enabled) {
        // Subscribe to webhook
        const webhookUrl = generateWebhookUrl(event);
        console.log(`Subscribing to ${event} webhook at ${webhookUrl}`);

        const response = await fetch('/api/tiendanube/webhooks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            accessToken: connection.accessToken,
            storeId: connection.storeId,
            event,
            url: webhookUrl
          })
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to create webhook');
        }

        const { webhook } = await response.json();
        setSubscriptions(prev => [...prev, webhook]);

      } else {
        // Unsubscribe from webhook
        console.log(`Unsubscribing from ${event} webhook`);

        const subscription = subscriptions.find(s => s.event === event);
        if (subscription) {
          const response = await fetch('/api/tiendanube/webhooks', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              accessToken: connection.accessToken,
              storeId: connection.storeId,
              webhookId: subscription.id
            })
          });

          if (!response.ok) {
            throw new Error('Failed to delete webhook');
          }
        }

        setSubscriptions(prev => prev.filter(s => s.event !== event));
      }

      // Update the webhook event state
      setWebhookEvents(prev =>
        prev.map(w => w.event === event ? { ...w, enabled } : w)
      );

    } catch (error) {
      console.error(`Error toggling webhook for ${event}:`, error);
      alert(`Failed to ${enabled ? 'subscribe to' : 'unsubscribe from'} ${event} webhook`);
    } finally {
      setLoading(false);
    }
  };

    const fetchCurrentSubscriptions = async () => {
    if (!connection.isConnected) {
      return;
    }

    setLoading(true);
    try {
      console.log("Fetching current webhook subscriptions from Tiendanube...");

      const response = await fetch(`/api/tiendanube/webhooks?access_token=${connection.accessToken}&store_id=${connection.storeId}`);

      if (!response.ok) {
        throw new Error('Failed to fetch webhooks');
      }

      const data = await response.json();
      setSubscriptions(data.webhooks || []);

      // Update webhook events based on current subscriptions
      setWebhookEvents(prev =>
        prev.map(event => ({
          ...event,
          enabled: data.webhooks?.some((sub: WebhookSubscription) => sub.event === event.event) || false
        }))
      );

    } catch (error) {
      console.error("Error fetching webhook subscriptions:", error);
      alert("Failed to fetch current webhook subscriptions");
    } finally {
      setLoading(false);
    }
  };

  // Check for connection parameters in URL
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const accessToken = urlParams.get('access_token');
    const storeId = urlParams.get('store_id');
    const connected = urlParams.get('connected');

    if (accessToken && storeId && connected) {
      setConnection({
        accessToken,
        storeId,
        isConnected: true
      });

      // Clean up URL
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete('access_token');
      newUrl.searchParams.delete('store_id');
      newUrl.searchParams.delete('connected');
      window.history.replaceState({}, '', newUrl.toString());
    }
  }, []);

  useEffect(() => {
    if (connection.isConnected && baseUrl) {
      fetchCurrentSubscriptions();
    }
  }, [connection.isConnected, baseUrl]);

  return (
    <div className="space-y-6">
      {/* Connection Status */}
      <Card>
        <CardHeader>
          <CardTitle>Tiendanube Connection</CardTitle>
          <CardDescription>
            Connect your Tiendanube store to manage webhooks
          </CardDescription>
        </CardHeader>
        <CardContent>
          {connection.isConnected ? (
            <div className="flex items-center justify-between p-4 bg-green-50 border border-green-200 rounded-lg">
              <div>
                <p className="font-medium text-green-800">Connected to Tiendanube</p>
                <p className="text-sm text-green-600">Store ID: {connection.storeId}</p>
              </div>
              <div className="flex gap-2">
                <Button onClick={fetchCurrentSubscriptions} disabled={loading}>
                  {loading ? "Loading..." : "Refresh"}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div>
                <p className="font-medium text-yellow-800">Not connected to Tiendanube</p>
                <p className="text-sm text-yellow-600">Connect your store to manage webhooks</p>
              </div>
              <Button onClick={handleConnectTiendanube}>
                Connect Tiendanube
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Webhook Events Configuration */}
      {connection.isConnected && (
        <Card>
          <CardHeader>
            <CardTitle>Tiendanube Webhook Events</CardTitle>
            <CardDescription>
              Configure which order-related events should trigger webhooks to your application
            </CardDescription>
          </CardHeader>
        <CardContent className="space-y-4">
          {webhookEvents.map((webhook) => (
            <div key={webhook.event} className="flex items-center justify-between p-4 border rounded-lg">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Label htmlFor={webhook.event} className="font-medium">
                    {webhook.event}
                  </Label>
                  {webhook.enabled && (
                    <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded">
                      Active
                    </span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">{webhook.description}</p>
                <p className="text-xs text-muted-foreground">
                  Target URL: {generateWebhookUrl(webhook.event)}
                </p>
              </div>
              <Switch
                id={webhook.event}
                checked={webhook.enabled}
                onCheckedChange={(enabled) => handleToggleWebhook(webhook.event, enabled)}
                disabled={loading}
              />
            </div>
          ))}
          </CardContent>
        </Card>
      )}

      {/* Current Subscriptions */}
      {connection.isConnected && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Active Webhook Subscriptions</CardTitle>
                <CardDescription>
                  Current webhook subscriptions registered with Tiendanube
                </CardDescription>
              </div>
              <Button onClick={fetchCurrentSubscriptions} disabled={loading}>
                {loading ? "Loading..." : "Refresh"}
              </Button>
            </div>
          </CardHeader>
        <CardContent>
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Event</TableHead>
                  <TableHead>Target URL</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subscriptions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      No active webhook subscriptions found.
                    </TableCell>
                  </TableRow>
                ) : (
                  subscriptions.map((subscription) => (
                    <TableRow key={subscription.id}>
                      <TableCell className="font-medium">{subscription.event}</TableCell>
                      <TableCell className="font-mono text-sm">{subscription.url}</TableCell>
                      <TableCell>{new Date(subscription.created_at).toLocaleDateString()}</TableCell>
                      <TableCell>{new Date(subscription.updated_at).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleToggleWebhook(subscription.event, false)}
                          disabled={loading}
                        >
                          Unsubscribe
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
        </Card>
      )}
    </div>
  );
}
