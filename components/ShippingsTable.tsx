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

interface Shipping {
  _id: Id<"shippings">;
  _creationTime: number;
  orderId: Id<"orders">;
  trackingNumber?: string;
  carrier?: string;
  method?: string;
  status: string;
  shippingAddress: {
    firstName?: string;
    lastName?: string;
    street?: string;
    city?: string;
    state?: string;
    country?: string;
    zipCode?: string;
    phone?: string;
  };
  shippedDate?: number;
  estimatedDelivery?: number;
  deliveredDate?: number;
  shippingCost?: number;
  platformShippingId?: string;
  platform: string;
  order?: {
    _id: Id<"orders">;
    platformOrderId: string;
    orderNumber?: string;
    total: number;
    currency: string;
  };
  client?: {
    _id: Id<"clients">;
    firstName?: string;
    lastName?: string;
    email?: string;
  };
}

export default function ShippingsTable() {
  const shippings = useQuery(api.procedures.getAllShippings, { limit: 100 }) as Shipping[] | undefined;
  const updateShippingStatus = useMutation(api.procedures.updateShippingStatus);
  const [selectedShippings, setSelectedShippings] = useState<string[]>([]);

  const handleSelectShipping = (shippingId: string) => {
    setSelectedShippings(prev => {
      if (prev.includes(shippingId)) {
        return prev.filter(id => id !== shippingId);
      } else {
        return [...prev, shippingId];
      }
    });
  };

  const handleStatusUpdate = async (shippingId: Id<"shippings">, newStatus: string) => {
    try {
      const updateData: any = { status: newStatus };

      // Set timestamps based on status
      if (newStatus === "shipped") {
        updateData.shippedDate = Date.now();
      } else if (newStatus === "delivered") {
        updateData.deliveredDate = Date.now();
      }

      await updateShippingStatus({
        shippingId,
        ...updateData,
      });
    } catch (error) {
      console.error("Failed to update shipping status:", error);
      alert("Failed to update shipping status. Please try again.");
    }
  };

  const formatDate = (timestamp?: number) => {
    if (!timestamp) return "-";
    return new Date(timestamp).toLocaleDateString();
  };

  const formatAddress = (address: Shipping["shippingAddress"]) => {
    const parts = [];
    if (address.street) parts.push(address.street);
    if (address.city) parts.push(address.city);
    if (address.state) parts.push(address.state);
    return parts.length > 0 ? parts.join(", ") : "-";
  };

  const formatCustomerName = (client?: Shipping["client"]) => {
    if (!client) return "-";
    const parts = [];
    if (client.firstName) parts.push(client.firstName);
    if (client.lastName) parts.push(client.lastName);
    return parts.length > 0 ? parts.join(" ") : client.email || "-";
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      case "shipped":
      case "in_transit":
        return "bg-blue-100 text-blue-800";
      case "delivered":
        return "bg-green-100 text-green-800";
      case "returned":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  if (!shippings) {
    return <div className="p-6">Loading shippings...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>Shipping</CardTitle>
            <p className="text-sm text-gray-600 mt-1">
              Track shipping information for all orders
            </p>
          </div>
          <div className="text-sm text-gray-600">
            Showing {shippings.length} shipping records
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {shippings.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No shipping records found. Orders with shipping info will appear here!
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
                        setSelectedShippings(shippings.map(shipping => shipping._id));
                      } else {
                        setSelectedShippings([]);
                      }
                    }}
                    checked={selectedShippings.length === shippings.length && shippings.length > 0}
                  />
                </TableHead>
                <TableHead>Order</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Carrier/Tracking</TableHead>
                <TableHead>Address</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Shipped Date</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shippings.map((shipping) => (
                <TableRow key={shipping._id}>
                  <TableCell>
                    <input
                      type="checkbox"
                      checked={selectedShippings.includes(shipping._id)}
                      onChange={() => handleSelectShipping(shipping._id)}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded max-w-fit">
                        {shipping.platform}
                      </span>
                      <span className="font-medium mt-1">
                        {shipping.order?.orderNumber || shipping.order?.platformOrderId || "-"}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">{formatCustomerName(shipping.client)}</span>
                      {shipping.shippingAddress.phone && (
                        <span className="text-xs text-gray-500">{shipping.shippingAddress.phone}</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">{shipping.carrier || "-"}</span>
                      {shipping.trackingNumber && (
                        <span className="text-xs text-gray-500 font-mono">{shipping.trackingNumber}</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      <div>{shipping.shippingAddress.firstName} {shipping.shippingAddress.lastName}</div>
                      <div className="text-gray-500">{formatAddress(shipping.shippingAddress)}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className={`text-xs px-2 py-1 rounded ${getStatusColor(shipping.status)}`}>
                      {shipping.status}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-gray-600">
                    {formatDate(shipping.shippedDate)}
                  </TableCell>
                  <TableCell>
                    <div className="flex space-x-1">
                      {shipping.status === "pending" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleStatusUpdate(shipping._id, "shipped")}
                          className="bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200"
                        >
                          Ship
                        </Button>
                      )}
                      {(shipping.status === "shipped" || shipping.status === "in_transit") && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleStatusUpdate(shipping._id, "delivered")}
                          className="bg-green-50 hover:bg-green-100 text-green-700 border-green-200"
                        >
                          Deliver
                        </Button>
                      )}
                    </div>
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
