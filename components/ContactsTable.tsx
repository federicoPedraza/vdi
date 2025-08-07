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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Client {
  _id: Id<"clients">;
  _creationTime: number;
  email?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  platformId: string;
  platform: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    country?: string;
    zipCode?: string;
  };
  storeId?: string;
}

export default function ContactsTable() {
  const clients = useQuery(api.procedures.getAllClients, {}) as Client[] | undefined;
  const deleteClient = useMutation(api.procedures.deleteClient);
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);

  const handleSelectContact = (contactId: string) => {
    setSelectedContacts(prev => {
      if (prev.includes(contactId)) {
        return prev.filter(id => id !== contactId);
      } else {
        return [...prev, contactId];
      }
    });
  };

  const handleDelete = async () => {
    if (selectedContacts.length === 0) {
      alert("Please select contacts to delete");
      return;
    }

    if (confirm(`Are you sure you want to delete ${selectedContacts.length} contact(s)? This will also delete all their orders, shipping info, and order lines.`)) {
      try {
        for (const contactId of selectedContacts) {
          await deleteClient({ clientId: contactId as Id<"clients"> });
        }
        setSelectedContacts([]);
        console.log("Deleted contacts:", selectedContacts);
      } catch (error) {
        console.error("Failed to delete contacts:", error);
        alert("Failed to delete some contacts. Please try again.");
      }
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString();
  };

  const formatName = (client: Client) => {
    const parts = [];
    if (client.firstName) parts.push(client.firstName);
    if (client.lastName) parts.push(client.lastName);
    return parts.length > 0 ? parts.join(" ") : "-";
  };

  const formatAddress = (address?: Client["address"]) => {
    if (!address) return "-";
    const parts = [];
    if (address.city) parts.push(address.city);
    if (address.state) parts.push(address.state);
    if (address.country) parts.push(address.country);
    return parts.length > 0 ? parts.join(", ") : "-";
  };

  if (!clients) {
    return <div className="p-6">Loading contacts...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>Contacts (Clients)</CardTitle>
            <p className="text-sm text-gray-600 mt-1">
              Manage customers from all connected platforms
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={handleDelete}
              variant="destructive"
              disabled={selectedContacts.length === 0}
            >
              Delete ({selectedContacts.length})
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {clients.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No contacts found. Send a webhook to create your first contact!
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <input
                    type="checkbox"
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedContacts(clients.map(client => client._id));
                      } else {
                        setSelectedContacts([]);
                      }
                    }}
                    checked={selectedContacts.length === clients.length && clients.length > 0}
                  />
                </TableHead>
                <TableHead>Platform</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clients.map((client) => (
                <TableRow key={client._id}>
                  <TableCell>
                    <input
                      type="checkbox"
                      checked={selectedContacts.includes(client._id)}
                      onChange={() => handleSelectContact(client._id)}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded max-w-fit">
                        {client.platform}
                      </span>
                      <span className="text-xs text-gray-500 font-mono mt-1">
                        {client.platformId}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">
                    {formatName(client)}
                  </TableCell>
                  <TableCell>{client.email || "-"}</TableCell>
                  <TableCell>{client.phone || "-"}</TableCell>
                  <TableCell>{formatAddress(client.address)}</TableCell>
                  <TableCell className="text-sm text-gray-600">
                    {formatDate(client._creationTime)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
