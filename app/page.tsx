"use client";

import { useState, useEffect } from "react";
import OrdersTable from "@/components/OrdersTable";
import ContactsTable from "@/components/ContactsTable";
import ShippingsTable from "@/components/ShippingsTable";
import ParsersTable from "@/components/ParsersTable";
import WebhooksTable from "@/components/WebhooksTable";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function Home() {
  const [activeTab, setActiveTab] = useState("orders");

  useEffect(() => {
    // Check for tab parameter in URL
    const urlParams = new URLSearchParams(window.location.search);
    const tabParam = urlParams.get('tab');
    if (tabParam && ['orders', 'contacts', 'shippings', 'webhooks', 'parsers'].includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, []);
  return (
    <>
      <header className="sticky top-0 z-10 bg-white p-4 border-b-2 border-slate-200 flex flex-row justify-between items-center">
        Management Dashboard
      </header>
      <main className="min-h-screen bg-white">
        <div className="container mx-auto py-8">
          <h1 className="text-4xl font-bold text-center mb-8">
            Management Dashboard
          </h1>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="orders">Orders</TabsTrigger>
              <TabsTrigger value="contacts">Contacts</TabsTrigger>
              <TabsTrigger value="shippings">Shippings</TabsTrigger>
              <TabsTrigger value="webhooks">Webhooks</TabsTrigger>
              <TabsTrigger value="parsers">Parsers</TabsTrigger>
            </TabsList>

            <TabsContent value="orders" className="mt-6">
              <div className="text-center mb-4">
                <h2 className="text-2xl font-semibold">Orders Management</h2>
                <p className="text-muted-foreground">Manage and track your orders</p>
              </div>
              <OrdersTable />
            </TabsContent>

            <TabsContent value="contacts" className="mt-6">
              <div className="text-center mb-4">
                <h2 className="text-2xl font-semibold">Contacts Management</h2>
                <p className="text-muted-foreground">Manage your customer contacts</p>
              </div>
              <ContactsTable />
            </TabsContent>

            <TabsContent value="shippings" className="mt-6">
              <div className="text-center mb-4">
                <h2 className="text-2xl font-semibold">Shippings Management</h2>
                <p className="text-muted-foreground">Track and manage shipments</p>
              </div>
              <ShippingsTable />
            </TabsContent>

            <TabsContent value="webhooks" className="mt-6">
              <div className="text-center mb-4">
                <h2 className="text-2xl font-semibold">Webhooks Management</h2>
                <p className="text-muted-foreground">Configure webhook subscriptions for external services</p>
              </div>
              <WebhooksTable />
            </TabsContent>

            <TabsContent value="parsers" className="mt-6">
              <div className="text-center mb-4">
                <h2 className="text-2xl font-semibold">Parsers Management</h2>
                <p className="text-muted-foreground">Manage and track your parsers</p>
              </div>
              <ParsersTable />
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </>
  );
}
