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

interface Order {
  _id: Id<"orders">;
  _creationTime: number;
  clientId: Id<"clients">;
  platformOrderId: string;
  platform: string;
  orderNumber?: string;
  status: string;
  total: number;
  currency: string;
  orderDate: number;
  paidDate?: number;
  fulfilledDate?: number;
  notes?: string;
  paymentMethod?: string;
  storeId?: string;
  client?: {
    _id: Id<"clients">;
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
  };
}

export default function OrdersTable() {
  const orders = useQuery(api.procedures.getRecentOrders, { limit: 100 }) as Order[] | undefined;
  const updateOrderStatus = useMutation(api.procedures.updateOrderStatus);
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);

  const handleSelectOrder = (orderId: string) => {
    setSelectedOrders(prev => {
      if (prev.includes(orderId)) {
        return prev.filter(id => id !== orderId);
      } else {
        return [...prev, orderId];
      }
    });
  };

  const handleStatusUpdate = async (orderId: Id<"orders">, newStatus: string) => {
    try {
      const updateData: any = { status: newStatus };

      // Set timestamps based on status
      if (newStatus === "paid") {
        updateData.paidDate = Date.now();
      } else if (newStatus === "fulfilled") {
        updateData.fulfilledDate = Date.now();
      }

      await updateOrderStatus({
        orderId,
        ...updateData,
      });
    } catch (error) {
      console.error("Failed to update order status:", error);
      alert("Failed to update order status. Please try again.");
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString();
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount);
  };

  const formatClientName = (client?: Order["client"]) => {
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
      case "paid":
        return "bg-green-100 text-green-800";
      case "fulfilled":
        return "bg-blue-100 text-blue-800";
      case "cancelled":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  if (!orders) {
    return <div className="p-6">Loading orders...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>Orders</CardTitle>
            <p className="text-sm text-gray-600 mt-1">
              Track orders from all connected platforms
            </p>
          </div>
          <div className="text-sm text-gray-600">
            Showing {orders.length} recent orders
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {orders.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No orders found. Send a webhook to create your first order!
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
                        setSelectedOrders(orders.map(order => order._id));
                      } else {
                        setSelectedOrders([]);
                      }
                    }}
                    checked={selectedOrders.length === orders.length && orders.length > 0}
                  />
                </TableHead>
                <TableHead>Platform/Order</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Order Date</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((order) => (
                <TableRow key={order._id}>
                  <TableCell>
                    <input
                      type="checkbox"
                      checked={selectedOrders.includes(order._id)}
                      onChange={() => handleSelectOrder(order._id)}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded max-w-fit">
                        {order.platform}
                      </span>
                      <span className="font-medium mt-1">
                        {order.orderNumber || order.platformOrderId}
                      </span>
                      <span className="text-xs text-gray-500 font-mono">
                        {order.platformOrderId}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">{formatClientName(order.client)}</span>
                      {order.client?.email && (
                        <span className="text-xs text-gray-500">{order.client.email}</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className={`text-xs px-2 py-1 rounded ${getStatusColor(order.status)}`}>
                      {order.status}
                    </span>
                  </TableCell>
                  <TableCell className="font-medium">
                    {formatCurrency(order.total, order.currency)}
                  </TableCell>
                  <TableCell className="text-sm text-gray-600">
                    {formatDate(order.orderDate)}
                  </TableCell>
                  <TableCell>
                    <div className="flex space-x-1">
                      {order.status === "pending" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleStatusUpdate(order._id, "paid")}
                          className="bg-green-50 hover:bg-green-100 text-green-700 border-green-200"
                        >
                          Mark Paid
                        </Button>
                      )}
                      {order.status === "paid" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleStatusUpdate(order._id, "fulfilled")}
                          className="bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200"
                        >
                          Fulfill
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
