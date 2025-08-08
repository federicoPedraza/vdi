"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  Node,
  Edge,
  useNodesState,
  useEdgesState,
} from "reactflow";
import "reactflow/dist/style.css";
import { useConvex, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { ShoppingCart, User2, Truck, Package as PackageIcon, RefreshCcw } from "lucide-react";
import type { ReactFlowInstance } from "reactflow";

type NodeKind = "order" | "client" | "shipping" | "product";

interface BaseGraphNodeData {
  kind: NodeKind;
  title: string;
  lines?: string[];
  onClick?: () => void;
  label?: React.ReactNode;
  connectionsHint?: Partial<Record<NodeKind, number>>;
  orderId?: string;
}

// Helper formatters
function formatDateShort(timestamp?: number) {
  if (!timestamp) return "-";
  try {
    return new Date(timestamp).toLocaleDateString();
  } catch {
    return "-";
  }
}

function formatMoney(amount?: number, currency?: string) {
  if (amount == null || !currency) return "-";
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() }).format(amount);
  } catch {
    return `${amount}`;
  }
}

function composeId(kind: NodeKind, id: string) {
  return `${kind}:${id}`;
}

function kindStyle(kind: NodeKind) {
  switch (kind) {
    case "order":
      return { badge: "bg-blue-50 text-blue-700", icon: <ShoppingCart size={12} className="text-blue-700" />, nodeBg: "#EFF6FF", nodeBorder: "#BFDBFE" };
    case "client":
      return { badge: "bg-emerald-50 text-emerald-700", icon: <User2 size={12} className="text-emerald-700" />, nodeBg: "#ECFDF5", nodeBorder: "#A7F3D0" };
    case "shipping":
      return { badge: "bg-violet-50 text-violet-700", icon: <Truck size={12} className="text-violet-700" />, nodeBg: "#F5F3FF", nodeBorder: "#DDD6FE" };
    case "product":
      return { badge: "bg-amber-50 text-amber-700", icon: <PackageIcon size={12} className="text-amber-700" />, nodeBg: "#FFFBEB", nodeBorder: "#FDE68A" };
  }
}

function makeNodeData(input: Omit<BaseGraphNodeData, "label">): BaseGraphNodeData {
  const { kind, title, lines, onClick } = input;
  const { badge, icon } = kindStyle(kind);
  return {
    kind,
    title,
    lines,
    onClick,
    label: (
      <div className="px-2.5 py-2 text-[11px] flex flex-col items-stretch">
        <div className="flex flex-col items-center gap-1 mb-1">
          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded ${badge} text-[9px] uppercase tracking-wide`}>
            {icon}
            {kind}
          </span>
          <span className="text-[12px] font-semibold truncate max-w-[160px] text-center" title={title}>
            {title}
          </span>
        </div>
        {lines && lines.length > 0 && (
          <div className="text-[10px] leading-tight text-slate-600 space-y-0.5">
            {lines.slice(0, 4).map((l, i) => (
              <div key={i} className="truncate max-w-[170px] mx-auto text-center" title={l}>
                {l}
              </div>
            ))}
          </div>
        )}
      </div>
    ),
  };
}

export default function GraphExplorer() {
  const convex = useConvex();
  const flowRef = useRef<ReactFlowInstance | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Initial seed: recent orders
  const recentOrders = useQuery(api.procedures.getRecentOrders, { limit: 30 }) as any[] | undefined;

  const [nodes, setNodes, onNodesChange] = useNodesState([] as Node<BaseGraphNodeData>[]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([] as Edge[]);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [mouse, setMouse] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [hoverNodeId, setHoverNodeId] = useState<string | null>(null);
  const [showTooltipFor, setShowTooltipFor] = useState<string | null>(null);
  const hoverTimer = useRef<number | null>(null);

  // Track which entity has been expanded to avoid duplicate fetches
  const expandedRef = useRef<Set<string>>(new Set());

  const addNode = useCallback((node: Node<BaseGraphNodeData>) => {
    setNodes((prev) => {
      if (prev.some((n) => n.id === node.id)) return prev;
      const kind = (node.data as BaseGraphNodeData | undefined)?.kind;
      const styleInfo = kind ? kindStyle(kind) : undefined;
      return [
        ...prev,
        {
          ...node,
          className: "graph-node",
          style: {
            width: 180,
            borderRadius: 10,
            border: `1px solid ${styleInfo?.nodeBorder ?? "#E2E8F0"}`,
            boxShadow: "0 2px 6px rgba(0,0,0,0.05)",
            background: styleInfo?.nodeBg ?? "#fff",
            cursor: "pointer",
            transition: "transform 120ms ease, box-shadow 120ms ease, border-color 120ms ease",
          },
        },
      ];
    });
  }, [setNodes]);

  const addEdgeSafe = useCallback((edge: Edge) => {
    setEdges((prev) => {
      if (prev.some((e) => e.id === edge.id)) return prev;
      return [...prev, edge];
    });
  }, [setEdges]);

  const placeAround = useCallback((center: { x: number; y: number }, index: number, radius = 260) => {
    const angle = (index / 8) * 2 * Math.PI; // up to 8 spokes, will spiral after
    return {
      x: center.x + Math.cos(angle) * radius + (index >= 8 ? (index - 7) * 12 : 0),
      y: center.y + Math.sin(angle) * radius + (index >= 8 ? (index - 7) * 12 : 0),
    };
  }, []);

  const createOrderNode = useCallback(
    (order: any, position: { x: number; y: number }) => {
      const nodeId = composeId("order", order._id);
      const title = order.orderNumber || order.platformOrderId;
      const data: BaseGraphNodeData = makeNodeData({
        kind: "order",
        title: title || "Order",
        lines: [
          `Status: ${order.status}`,
          `Date: ${formatDateShort(order.orderDate)}`,
          `Total: ${formatMoney(order.total, order.currency)}`,
        ],
        onClick: async () => {
          if (expandedRef.current.has(nodeId)) return;
          expandedRef.current.add(nodeId);

          const centerNode = nodesRef.current.find((n) => n.id === nodeId);
          const center = centerNode?.position || position;

          // Fetch complete order
          const complete = await convex.query(api.procedures.getCompleteOrder, { orderId: order._id as Id<"orders"> });
          if (!complete) return;

          let childIndex = 0;

          // Client node
          const clientObj = (complete as any).client as any | null;
          if (clientObj) {
            const clientId = composeId("client", clientObj._id);
            const clientPos = placeAround(center, childIndex++);
            addNode({
              id: clientId,
              data: makeNodeData({
                kind: "client",
                title: `${clientObj.firstName || ""} ${clientObj.lastName || ""}`.trim() || clientObj.email || "Client",
                lines: [clientObj.email || "-", clientObj.phone || "-"],
                onClick: async () => {
                  if (expandedRef.current.has(clientId)) return;
                  expandedRef.current.add(clientId);

                  const ordersByClient = await convex.query(api.procedures.getOrdersByClient, {
                    clientId: clientObj._id as Id<"clients">,
                  });

                  let index = 0;
                  for (const o of ordersByClient) {
                    const oNodeId = composeId("order", o._id);
                    const pos = placeAround(clientPos, index++);
                    createOrderNode(o, pos);
                    addEdgeSafe({ id: `${clientId}->${oNodeId}`, source: clientId, target: oNodeId });
                  }
                },
              }),
              position: clientPos,
              type: undefined,
            });
            addEdgeSafe({ id: `${nodeId}->${clientId}`, source: nodeId, target: clientId });
          }

          // Shipping node (single optional)
          if (complete.shipping) {
            const ship = complete.shipping as any;
            const shipId = composeId("shipping", ship._id);
            const shipPos = placeAround(center, childIndex++);
            addNode({
              id: shipId,
              data: makeNodeData({
                kind: "shipping",
                title: ship.carrier || ship.method || "Shipping",
                lines: [
                  `Tracking: ${ship.trackingNumber || "-"}`,
                  `Status: ${ship.status || "-"}`,
                ],
                onClick: async () => {
                  if (expandedRef.current.has(shipId)) return;
                  expandedRef.current.add(shipId);

                  const shipCenter = nodesRef.current.find((n) => n.id === shipId)?.position || shipPos;

                  // Fetch related data via the order
                  const c = await convex.query(api.procedures.getCompleteOrder, {
                    orderId: ship.orderId as Id<"orders">,
                  });
                  if (!c) return;

                  let sIndex = 0;
                  // Ensure order node is present and linked
                  const ord = c.order as any;
                  const ordNodeId = composeId("order", ord._id);
                  if (!nodesRef.current.some((n) => n.id === ordNodeId)) {
                    const pos = placeAround(shipCenter, sIndex++);
                    createOrderNode(ord, pos);
                  }
                  addEdgeSafe({ id: `${shipId}->${ordNodeId}`, source: shipId, target: ordNodeId });

                  // Link shipping to each order line (product) as well
                  if (Array.isArray(c.orderLines)) {
                    let pIndex = 0;
                    for (const line of c.orderLines as any[]) {
                      const prodId = composeId("product", line._id);
                      if (!nodesRef.current.some((n) => n.id === prodId)) {
                        const pos = placeAround(shipCenter, sIndex + pIndex);
                        addNode({
                          id: prodId,
                          data: makeNodeData({
                            kind: "product",
                            title: line.productName || line.variantName || "Product",
                            lines: [
                              `Qty: ${line.quantity}`,
                              `Price: ${formatMoney(line.unitPrice, ord.currency)}`,
                              line.sku ? `SKU: ${line.sku}` : undefined,
                            ].filter(Boolean) as string[],
                            onClick: async () => {
                              if (expandedRef.current.has(prodId)) return;
                              expandedRef.current.add(prodId);
                              const centerP = nodesRef.current.find((n) => n.id === prodId)?.position || pos;
                              const oc = await convex.query(api.procedures.getCompleteOrder, { orderId: line.orderId as Id<"orders"> });
                              if (!oc) return;
                              const o2 = oc.order as any;
                              const o2Id = composeId("order", o2._id);
                              if (!nodesRef.current.some((n) => n.id === o2Id)) {
                                const p = placeAround(centerP, 0);
                                createOrderNode(o2, p);
                              }
                              addEdgeSafe({ id: `${prodId}->${o2Id}`, source: prodId, target: o2Id });
                            },
                          }),
                          position: pos,
                          type: undefined,
                        });
                      }
                      addEdgeSafe({ id: `${shipId}->${prodId}`, source: shipId, target: prodId });
                      pIndex += 1;
                    }
                  }
                },
              }),
              position: shipPos,
              type: undefined,
            });
            addEdgeSafe({ id: `${nodeId}->${shipId}`, source: nodeId, target: shipId });
          }

          // Product nodes (order lines)
          if (Array.isArray(complete.orderLines)) {
            let index = 0;
            for (const line of complete.orderLines) {
              const prodId = composeId("product", line._id);
              const prodPos = placeAround(center, childIndex + index);
              addNode({
                id: prodId,
                data: makeNodeData({
                  kind: "product",
                  title: line.productName || line.variantName || "Product",
                  lines: [
                    `Qty: ${line.quantity}`,
                    `Price: ${formatMoney(line.unitPrice, order.currency)}`,
                    line.sku ? `SKU: ${line.sku}` : undefined,
                  ].filter(Boolean) as string[],
                  onClick: async () => {
                    // Focusing a product always pivots to its order focus
                    const c2 = await convex.query(api.procedures.getCompleteOrder, { orderId: line.orderId as Id<"orders"> });
                    if (!c2) return;
                    setNodes([]);
                    setEdges([]);
                    expandedRef.current.clear();
                    const center = { x: 0, y: 0 };
                    createOrderNode(c2.order, center);
                    setFocusedId(composeId("order", c2.order._id));
                  },
                }),
                position: prodPos,
                type: undefined,
              });
              addEdgeSafe({ id: `${nodeId}->${prodId}`, source: nodeId, target: prodId });
              index += 1;
            }
          }
        },
      });

      addNode({ id: nodeId, position, data, type: undefined });
    },
    [addNode, addEdgeSafe, convex, placeAround]
  );

  // Keep a live ref to nodes for positioning around center after async
  const nodesRef = useRef<Node<BaseGraphNodeData>[]>([]);
  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  // Visually highlight the focused node without moving it
  useEffect(() => {
    setNodes((prev) =>
      prev.map((n) => {
        const kind = (n.data as BaseGraphNodeData | undefined)?.kind;
        const styleInfo = kind ? kindStyle(kind) : undefined;
        const isFocused = focusedId === n.id;
        return {
          ...n,
          style: {
            ...(n.style || {}),
            border: isFocused
              ? `2px solid ${styleInfo?.nodeBorder ?? "#94A3B8"}`
              : `1px solid ${styleInfo?.nodeBorder ?? "#E2E8F0"}`,
            boxShadow: isFocused
              ? "0 12px 28px rgba(0,0,0,0.16)"
              : "0 2px 6px rgba(0,0,0,0.05)",
          },
        };
      })
    );
  }, [focusedId, setNodes]);

  // Seed graph from recent orders once or when defocused
  useEffect(() => {
    if (!recentOrders) return;
    if (recentOrders.length === 0) return;
    if (nodes.length > 0 || focusedId) return; // do not reseed if already present or focused

    const startX = 0;
    const startY = 0;
    const gapX = 380;
    const gapY = 240;
    const cols = 4;

    recentOrders.forEach((order, idx) => {
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      const position = { x: startX + col * gapX, y: startY + row * gapY };
      createOrderNode(order, position);
    });
  }, [recentOrders, nodes.length, focusedId, createOrderNode]);

  const nodeTypes = useMemo(() => ({}), []);

  const onNodeClick = useCallback(
    async (_: React.MouseEvent, node: Node<BaseGraphNodeData>) => {
      if (focusedId === node.id) return; // already focused; no-op
      setFocusedId(node.id);
      // Clear graph to only show this node and its connections when clicked
      setNodes([]);
      setEdges([]);
      // Each focus starts fresh expansions
      expandedRef.current.clear();
      // Build a focused view depending on kind
      const [kind] = node.id.split(":");
      if (kind === "order") {
        // Recreate the order node at its current position and expand around it
        const centerPos = nodesRef.current.find((n) => n.id === node.id)?.position || { x: 0, y: 0 };
        addNode({ id: node.id, position: centerPos, data: node.data, type: undefined });

        const orderId = node.id.split(":")[1] as any;
        const complete = await convex.query(api.procedures.getCompleteOrder, { orderId });
        if (complete) {
          let childIndex = 0;
          // Client node
          const clientObj = (complete as any).client as any | null;
          if (clientObj) {
            const clientId = composeId("client", clientObj._id);
            const clientPos = placeAround(centerPos, childIndex++);
            addNode({
              id: clientId,
              data: makeNodeData({
                kind: "client",
                title: `${clientObj.firstName || ""} ${clientObj.lastName || ""}`.trim() || clientObj.email || "Client",
                lines: [clientObj.email || "-", clientObj.phone || "-"],
                onClick: async () => {
                  if (expandedRef.current.has(clientId)) return;
                  expandedRef.current.add(clientId);
                  const ordersByClient = await convex.query(api.procedures.getOrdersByClient, { clientId: clientObj._id as Id<"clients"> });
                  let index = 0;
                  for (const o of ordersByClient) {
                    const oNodeId = composeId("order", o._id);
                    const pos = placeAround(clientPos, index++);
                    createOrderNode(o, pos);
                    addEdgeSafe({ id: `${clientId}->${oNodeId}`, source: clientId, target: oNodeId });
                  }
                },
              }),
              position: clientPos,
              type: undefined,
            });
            addEdgeSafe({ id: `${node.id}->${clientId}`, source: node.id, target: clientId });
          }

          // Shipping node
          if (complete.shipping) {
            const ship = complete.shipping as any;
            const shipId = composeId("shipping", ship._id);
            const shipPos = placeAround(centerPos, childIndex++);
            addNode({
              id: shipId,
              data: makeNodeData({
                kind: "shipping",
                title: ship.carrier || ship.method || "Shipping",
                lines: [`Tracking: ${ship.trackingNumber || "-"}`, `Status: ${ship.status || "-"}`],
              }),
              position: shipPos,
              type: undefined,
            });
            addEdgeSafe({ id: `${node.id}->${shipId}`, source: node.id, target: shipId });
          }

          // Product nodes
          if (Array.isArray(complete.orderLines)) {
            let index = 0;
            for (const line of complete.orderLines as any[]) {
              const prodId = composeId("product", line._id);
              const prodPos = placeAround(centerPos, childIndex + index);
              addNode({
                id: prodId,
                data: makeNodeData({
                  kind: "product",
                  title: line.productName || line.variantName || "Product",
                  lines: [
                    `Qty: ${line.quantity}`,
                    `Price: ${formatMoney(line.unitPrice, complete.order.currency)}`,
                    line.sku ? `SKU: ${line.sku}` : undefined,
                  ].filter(Boolean) as string[],
                }),
                position: prodPos,
                type: undefined,
              });
              addEdgeSafe({ id: `${node.id}->${prodId}`, source: node.id, target: prodId });
              index += 1;
            }
          }
        }
      } else if (kind === "client") {
        // For client focus: show client and all their orders
        const clientId = node.id.split(":")[1] as any;
        const centerPos = nodesRef.current.find((n) => n.id === node.id)?.position || { x: 0, y: 0 };
        addNode({ id: node.id, position: centerPos, data: node.data, type: undefined });
        const ordersByClient = await convex.query(api.procedures.getOrdersByClient, { clientId });
        let index = 0;
        for (const o of ordersByClient) {
          const oNodeId = composeId("order", o._id);
          const p = placeAround(centerPos, index++);
          createOrderNode(o, p);
          addEdgeSafe({ id: `${node.id}->${oNodeId}`, source: node.id, target: oNodeId });
        }
            } else if (kind === "shipping") {
        // For shipping focus: derive order from existing connections and recreate the view
        const centerPos = nodesRef.current.find((n) => n.id === node.id)?.position || { x: 0, y: 0 };

        // Add the shipping node itself at center
        addNode({ id: node.id, position: centerPos, data: node.data, type: undefined });

        // Find an existing edge to get the order ID, or try to derive from the last known order
        const existingEdge = edges.find((e) => e.source === node.id || e.target === node.id);
        let orderId: any = null;

        if (existingEdge) {
          // Get order ID from the edge target/source
          const orderNodeId = existingEdge.source.startsWith("order:") ? existingEdge.source : existingEdge.target;
          if (orderNodeId.startsWith("order:")) {
            orderId = orderNodeId.split(":")[1];
          }
        }

        // If we still don't have an order ID, we need to scan for the shipping's order
        // For now, let's get all recent orders and find one that has this shipping
        if (!orderId) {
          const recentOrders = await convex.query(api.procedures.getRecentOrders, { limit: 100 });
          for (const order of recentOrders) {
            const complete = await convex.query(api.procedures.getCompleteOrder, { orderId: order._id });
            if (complete?.shipping && complete.shipping._id === node.id.split(":")[1]) {
              orderId = order._id;
              break;
            }
          }
        }

        if (orderId) {
          const c = await convex.query(api.procedures.getCompleteOrder, { orderId });
          if (c) {
            // Add the order node
            const ordNodeId = composeId("order", c.order._id);
            let sIndex = 0;
            const orderPos = placeAround(centerPos, sIndex++);
            createOrderNode(c.order, orderPos);
            addEdgeSafe({ id: `${node.id}->${ordNodeId}`, source: node.id, target: ordNodeId });

            // Add product nodes from order lines
            if (Array.isArray(c.orderLines)) {
              for (const line of c.orderLines as any[]) {
                const prodId = composeId("product", line._id);
                const pos = placeAround(centerPos, sIndex++);
                addNode({
                  id: prodId,
                  data: makeNodeData({
                    kind: "product",
                    title: line.productName || line.variantName || "Product",
                    lines: [
                      `Qty: ${line.quantity}`,
                      `Price: ${formatMoney(line.unitPrice, c.order.currency)}`,
                      line.sku ? `SKU: ${line.sku}` : undefined,
                    ].filter(Boolean) as string[],
                  }),
                  position: pos,
                  type: undefined,
                });
                addEdgeSafe({ id: `${node.id}->${prodId}`, source: node.id, target: prodId });
              }
            }
          }
        }
      } else if (kind === "product") {
        // For product focus: derive order from existing connections and recreate the view
        const centerPos = nodesRef.current.find((n) => n.id === node.id)?.position || { x: 0, y: 0 };

        // Add the product node itself at center
        addNode({ id: node.id, position: centerPos, data: node.data, type: undefined });

        // Find an existing edge to get the order ID
        const existingEdge = edges.find((e) => e.source === node.id || e.target === node.id);
        let orderId: any = null;

        if (existingEdge) {
          // Get order ID from the edge target/source
          const orderNodeId = existingEdge.source.startsWith("order:") ? existingEdge.source : existingEdge.target;
          if (orderNodeId.startsWith("order:")) {
            orderId = orderNodeId.split(":")[1];
          }
        }

        // If we still don't have an order ID, scan recent orders to find one containing this product
        if (!orderId) {
          const recentOrders = await convex.query(api.procedures.getRecentOrders, { limit: 100 });
          for (const order of recentOrders) {
            const complete = await convex.query(api.procedures.getCompleteOrder, { orderId: order._id });
            if (complete?.orderLines && Array.isArray(complete.orderLines)) {
              const hasThisProduct = complete.orderLines.some((line: any) => line._id === node.id.split(":")[1]);
              if (hasThisProduct) {
                orderId = order._id;
                break;
              }
            }
          }
        }

        if (orderId) {
          const c = await convex.query(api.procedures.getCompleteOrder, { orderId });
          if (c) {
            // Add the order node
            const ordNodeId = composeId("order", c.order._id);
            const orderPos = placeAround(centerPos, 0);
            createOrderNode(c.order, orderPos);
            addEdgeSafe({ id: `${node.id}->${ordNodeId}`, source: node.id, target: ordNodeId });
          }
        }
      }
    },
    [addNode, focusedId]
  );

  const resetGraph = () => {
    expandedRef.current.clear();
    setNodes([]);
    setEdges([]);
    setFocusedId(null);
  };

  return (
    <div ref={containerRef} className="relative w-full h-full">
      <div className="absolute right-3 top-3 z-50 flex gap-2">
        <Button variant="outline" size="icon" onClick={resetGraph} aria-label="Reset graph" className="h-8 w-8">
          <RefreshCcw className="h-4 w-4" />
        </Button>
      </div>
      <ReactFlow
        onInit={(instance) => {
          flowRef.current = instance;
        }}
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onNodeMouseEnter={(_, n) => {
          setHoverNodeId(n.id);
          if (hoverTimer.current) window.clearTimeout(hoverTimer.current);
          hoverTimer.current = window.setTimeout(() => setShowTooltipFor(n.id), 1000);
        }}
        onNodeMouseMove={(e) => {
          setMouse({ x: (e as any).clientX, y: (e as any).clientY });
        }}
        onNodeMouseLeave={() => {
          if (hoverTimer.current) window.clearTimeout(hoverTimer.current);
          setHoverNodeId(null);
          setShowTooltipFor(null);
        }}
        fitView
        nodeTypes={nodeTypes}
      >
        <MiniMap pannable zoomable />
        <Controls />
        <Background gap={16} size={1} />
      </ReactFlow>

      {showTooltipFor && (() => {
        const rect = containerRef.current?.getBoundingClientRect();
        const left = rect ? mouse.x - rect.left + 12 : 0;
        const top = rect ? mouse.y - rect.top + 12 : 0;
        const connEdges = edges.filter((e) => e.source === showTooltipFor || e.target === showTooltipFor);
        const neighborIds = connEdges.map((e) => (e.source === showTooltipFor ? e.target : e.source));
        const neighborNodes = neighborIds
          .map((id) => nodesRef.current.find((n) => n.id === id))
          .filter(Boolean) as Node<BaseGraphNodeData>[];
        const counts = new Map<NodeKind, number>();
        neighborNodes.forEach((n) => {
          const k = (n.data as BaseGraphNodeData).kind;
          counts.set(k, (counts.get(k) || 0) + 1);
        });
        const parts = Array.from(counts.entries()).map(([k, c]) => `${c} ${k}${c > 1 ? "s" : ""}`);
        const text = parts.length ? parts.join(", ") : "No connections";
        return (
          <div className="pointer-events-none absolute z-50" style={{ left, top }}>
            <div className="rounded-md bg-slate-900 text-white text-[10px] px-2 py-1 shadow">
              Connections: {text}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
