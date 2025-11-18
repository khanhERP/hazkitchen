import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { POSHeader } from "@/components/pos/header";
import { useTranslation } from "@/lib/i18n";
import {
  Check,
  Clock,
  ChefHat,
  AlertCircle,
  ArrowRight,
  Undo2,
  Utensils,
} from "lucide-react";
import type { Order, OrderItem, Product } from "@shared/schema";

interface KitchenOrder extends Order {
  items: OrderItem[];
}

interface PendingOrderItem extends OrderItem {
  productName?: string;
  productImage?: string;
  orderNumber?: string;
  tableNumber?: string;
  orderedAt?: string;
}

export default function KitchenDisplay() {
  const { t } = useTranslation();
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [viewMode, setViewMode] = useState<"table" | "dish">("table");
  const [activeStatusTab, setActiveStatusTab] = useState<
    "pending" | "progress" | "completed"
  >("pending");

  // Fetch pending order items
  const { data: pendingItems, refetch: refetchPendingItems } = useQuery<
    PendingOrderItem[]
  >({
    queryKey: ["http://42.118.102.26:4500/api/order-items/pending"],
    queryFn: async () => {
      const response = await fetch("http://42.118.102.26:4500/api/order-items/pending");
      if (!response.ok) {
        throw new Error("Failed to fetch pending order items");
      }
      return response.json();
    },
    refetchInterval: 2000,
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });

  // Fetch progress order items (ready to serve)
  const { data: progressItems, refetch: refetchProgressItems } = useQuery<
    PendingOrderItem[]
  >({
    queryKey: ["http://42.118.102.26:4500/api/order-items/progress"],
    queryFn: async () => {
      const response = await fetch("http://42.118.102.26:4500/api/order-items/progress");
      if (!response.ok) {
        throw new Error("Failed to fetch progress order items");
      }
      return response.json();
    },
    refetchInterval: 2000,
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });

  // Fetch completed order items
  const { data: completedItems, refetch: refetchCompletedItems } = useQuery<
    PendingOrderItem[]
  >({
    queryKey: ["http://42.118.102.26:4500/api/order-items/completed"],
    queryFn: async () => {
      const response = await fetch("http://42.118.102.26:4500/api/order-items/completed");
      if (!response.ok) {
        throw new Error("Failed to fetch completed order items");
      }
      return response.json();
    },
    refetchInterval: 2000,
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });

  // Fetch pending orders - orders that are NOT paid, completed, or cancelled
  const { data: orders, refetch } = useQuery<KitchenOrder[]>({
    queryKey: ["http://42.118.102.26:4500/api/orders"],
    queryFn: async () => {
      const response = await fetch("http://42.118.102.26:4500/api/orders");
      if (!response.ok) {
        throw new Error("Failed to fetch kitchen orders");
      }
      const allOrders = await response.json();
      // Filter to only show orders that are NOT in final states
      return allOrders.filter(
        (order: any) =>
          !["paid", "completed", "cancelled"].includes(order.status),
      );
    },
    refetchInterval: 2000, // Auto refresh every 5 seconds
  });

  // Fetch products for item details
  const { data: products } = useQuery<Product[]>({
    queryKey: ["http://42.118.102.26:4500/api/products"],
    queryFn: async () => {
      const response = await fetch(
        "http://42.118.102.26:4500/api/products?limit=50000&includeInactive=false",
      );
      if (!response.ok) {
        throw new Error("Failed to fetch products");
      }
      const data = await response.json();
      return data.products || [];
    },
  });

  // WebSocket connection for real-time updates
  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `http://42.118.102.26:4500/ws`;
    const socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      console.log("📡 Kitchen: WebSocket connected");
      socket.send(JSON.stringify({ type: "register_kitchen" }));
    };

    socket.onmessage = (event) => {
      const message = JSON.parse(event.data);
      console.log("📩 Kitchen: Received message:", message);

      if (message.type === "order_update" || message.type === "new_order") {
        refetch();
        refetchPendingItems();
        refetchProgressItems();
        refetchCompletedItems();
      }
    };

    socket.onclose = () => {
      console.log("📡 Kitchen: WebSocket disconnected");
    };

    setWs(socket);

    return () => {
      socket.close();
    };
  }, [refetch]);

  const updateOrderStatus = async (orderId: number, status: string) => {
    try {
      const response = await fetch(`http://42.118.102.26:4500/api/orders/${orderId}/kitchen-status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      if (!response.ok) {
        throw new Error("Failed to update order status");
      }

      refetch();
      refetchPendingItems();
      refetchProgressItems();
      refetchCompletedItems();
    } catch (error) {
      console.error("Error updating order status:", error);
    }
  };

  const updateOrderItemStatus = async (itemId: number, status: string) => {
    try {
      const response = await fetch(`http://42.118.102.26:4500/api/order-items/${itemId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      if (!response.ok) {
        throw new Error("Failed to update order item status");
      }

      refetchPendingItems();
      refetchProgressItems();
    } catch (error) {
      console.error("Error updating order item status:", error);
    }
  };

  const getProductName = (productId: number) => {
    const product = products?.find((p) => p.id === productId);
    return product?.name || "Unknown Product";
  };

  const getOrderAge = (orderedAt: string) => {
    const orderTime = new Date(orderedAt);
    const now = new Date();
    const diffMinutes = Math.floor(
      (now.getTime() - orderTime.getTime()) / 60000,
    );
    return diffMinutes;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "placed":
        return "bg-yellow-500";
      case "preparing":
        return "bg-blue-500";
      case "ready":
        return "bg-green-500";
      default:
        return "bg-gray-500";
    }
  };

  const pendingOrders = orders?.filter((o) => o.status === "placed") || [];
  const preparingOrders = orders?.filter((o) => o.status === "preparing") || [];
  const readyOrders = orders?.filter((o) => o.status === "ready") || [];

  // Group pending items by table
  const groupedByTable = (pendingItems || []).reduce(
    (acc, item) => {
      const tableKey = item.tableNumber || "N/A";
      if (!acc[tableKey]) {
        acc[tableKey] = [];
      }
      acc[tableKey].push(item);
      return acc;
    },
    {} as Record<string, PendingOrderItem[]>,
  );

  // Group pending items by dish
  const groupedByDish = (pendingItems || []).reduce(
    (acc, item) => {
      const dishKey = item.productName || "Unknown";
      if (!acc[dishKey]) {
        acc[dishKey] = [];
      }
      acc[dishKey].push(item);
      return acc;
    },
    {} as Record<string, PendingOrderItem[]>,
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <POSHeader />

      <div className="pt-24 px-4 sm:px-6 pb-6">
        <div className="mb-8">
          <div className="bg-white rounded-2xl shadow-lg p-6 border-l-4 border-green-500">
            <h1 className="text-3xl sm:text-4xl font-bold flex items-center gap-3 text-gray-800">
              <div className="p-3 bg-green-100 rounded-xl">
                <ChefHat className="w-8 h-8 text-green-600" />
              </div>
              {t("kitchen.title")}
            </h1>
            <p className="text-gray-600 mt-3 text-lg">
              {t("kitchen.description")}
            </p>
          </div>
        </div>

        {/* Main Tabs for Order Status */}
        <Tabs
          value={activeStatusTab}
          onValueChange={(value) =>
            setActiveStatusTab(value as "pending" | "progress" | "completed")
          }
          className="w-full"
        >
          <TabsList
            className="h-auto relative grid w-full grid-cols-3 bg-white/95 backdrop-blur-sm border border-gray-200 rounded-2xl p-2 mb-8 shadow-lg gap-2 after:absolute after:bottom-0 after:left-0 after:h-1 after:bg-gradient-to-r after:from-yellow-500 after:to-yellow-600 after:rounded-full after:transition-all after:duration-500 after:ease-out data-[value=pending]:after:w-[calc(33.333%-0.5rem)] data-[value=pending]:after:translate-x-1 data-[value=progress]:after:w-[calc(33.333%-0.5rem)] data-[value=progress]:after:translate-x-[calc(100%+0.75rem)] data-[value=progress]:after:from-blue-500 data-[value=progress]:after:to-blue-600 data-[value=completed]:after:w-[calc(33.333%-0.5rem)] data-[value=completed]:after:translate-x-[calc(200%+1.5rem)] data-[value=completed]:after:from-green-500 data-[value=completed]:after:to-green-600"
            data-value={activeStatusTab}
          >
            <TabsTrigger
              value="pending"
              className="relative group data-[state=active]:text-yellow-600 data-[state=active]:bg-yellow-50/50 flex items-center justify-center gap-1.5 font-bold text-sm sm:text-base py-3 px-2 transition-all duration-300 rounded-xl hover:bg-gray-50 border-0 z-10 min-w-0"
            >
              <Clock className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
              <span className="truncate">{t("kitchen.pending")}</span>
              <Badge className="bg-yellow-600 data-[state=active]:bg-yellow-700 text-white text-sm sm:text-base px-2 py-0.5 font-bold shadow-sm flex-shrink-0 ml-1">
                {(pendingItems || []).length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger
              value="progress"
              className="relative group data-[state=active]:text-blue-600 data-[state=active]:bg-blue-50/50 flex items-center justify-center gap-1.5 font-bold text-sm sm:text-base py-3 px-2 transition-all duration-300 rounded-xl hover:bg-gray-50 border-0 z-10 min-w-0"
            >
              <ChefHat className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
              <span className="truncate">{t("kitchen.readyToServe")}</span>
              <Badge className="bg-blue-600 data-[state=active]:bg-blue-700 text-white text-sm sm:text-base px-2 py-0.5 font-bold shadow-sm flex-shrink-0 ml-1">
                {(progressItems || []).length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger
              value="completed"
              className="relative group data-[state=active]:text-green-600 data-[state=active]:bg-green-50/50 flex items-center justify-center gap-1.5 font-bold text-sm sm:text-base py-3 px-2 transition-all duration-300 rounded-xl hover:bg-gray-50 border-0 z-10 min-w-0"
            >
              <Check className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
              <span className="truncate">{t("kitchen.completed")}</span>
              <Badge className="bg-green-600 data-[state=active]:bg-green-700 text-white text-sm sm:text-base px-2 py-0.5 font-bold shadow-sm flex-shrink-0 ml-1">
                {(completedItems || []).length}
              </Badge>
            </TabsTrigger>
          </TabsList>

          {/* Pending Orders Tab */}
          <TabsContent value="pending" className="mt-0">
            <div className="transform transition-all duration-300">
              <Card className="border-2 border-yellow-300 shadow-xl overflow-hidden">
                <CardHeader className="bg-gradient-to-r from-yellow-50 to-yellow-100 border-b-2 border-yellow-200">
                  <CardTitle className="flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-yellow-200 rounded-lg">
                        <Clock className="w-6 h-6 text-yellow-700" />
                      </div>
                      <div>
                        <span className="text-xl font-bold text-gray-800">
                          {t("kitchen.pending")}
                        </span>
                        <span className="ml-2 px-3 py-1 bg-yellow-500 text-white rounded-full text-sm font-semibold">
                          {pendingOrders.length}
                        </span>
                      </div>
                    </div>
                    {/* View Mode Toggle */}
                    <Tabs
                      value={viewMode}
                      onValueChange={(value) =>
                        setViewMode(value as "table" | "dish")
                      }
                      className="w-auto"
                    >
                      <TabsList className="bg-white shadow-md border border-gray-200">
                        <TabsTrigger
                          value="table"
                          className="data-[state=active]:bg-yellow-500 data-[state=active]:text-white gap-2 font-medium"
                        >
                          <Utensils className="w-4 h-4" />
                          {t("kitchen.byTable")}
                        </TabsTrigger>
                        <TabsTrigger
                          value="dish"
                          className="data-[state=active]:bg-yellow-500 data-[state=active]:text-white gap-2 font-medium"
                        >
                          <ChefHat className="w-4 h-4" />
                          {t("kitchen.byDish")}
                        </TabsTrigger>
                      </TabsList>
                    </Tabs>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  <ScrollArea className="h-[calc(100vh-300px)]">
                    <div className="space-y-4">
                      {viewMode === "table" ? (
                        // Display by table
                        Object.keys(groupedByTable).length > 0 ? (
                          Object.entries(groupedByTable).map(
                            ([tableNumber, items]) => (
                              <Card
                                key={tableNumber}
                                className="border-2 border-yellow-200 shadow-lg hover:shadow-xl transition-all duration-200 overflow-hidden"
                              >
                                <CardHeader className="pb-3 bg-gradient-to-r from-yellow-50 to-amber-50 border-b border-yellow-200">
                                  <div className="flex justify-between items-start">
                                    <div>
                                      <div className="font-bold text-xl text-yellow-700 flex items-center gap-2">
                                        <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
                                        Bàn {tableNumber}
                                      </div>
                                      <div className="text-sm text-gray-600 mt-1 flex items-center gap-1">
                                        <Clock className="w-3 h-3" />
                                        {items[0]?.orderedAt
                                          ? `${getOrderAge(items[0].orderedAt)} phút trước`
                                          : "Vài giây trước"}
                                      </div>
                                    </div>
                                    <Badge className="bg-yellow-500 text-white px-3 py-1 text-base font-bold shadow-md">
                                      {items.length}
                                    </Badge>
                                  </div>
                                </CardHeader>
                                <CardContent className="space-y-2 pb-3 pt-3 bg-gradient-to-b from-white to-gray-50">
                                  {items.map((item, idx) => (
                                    <div
                                      key={item.id}
                                      className="flex items-center gap-3 bg-white p-3 rounded-lg border-2 border-gray-100 hover:border-yellow-300 transition-all duration-200 shadow-sm"
                                    >
                                      <div className="flex-1 min-w-0">
                                        <div className="font-bold text-base text-gray-800 truncate">
                                          {item.productName || "Unknown"}
                                        </div>
                                        {item.notes && (
                                          <div className="text-sm text-orange-600 italic mt-1 font-medium">
                                            📝 {item.notes}
                                          </div>
                                        )}
                                        <div className="text-xs text-gray-500 flex items-center gap-2 mt-1">
                                          <span className="px-2 py-0.5 bg-gray-100 rounded">
                                            {item.orderNumber}
                                          </span>
                                          <span>
                                            {item.orderedAt
                                              ? new Date(
                                                  item.orderedAt,
                                                ).toLocaleTimeString("vi-VN", {
                                                  hour: "2-digit",
                                                  minute: "2-digit",
                                                })
                                              : ""}
                                          </span>
                                        </div>
                                      </div>
                                      {item.productImage && (
                                        <img
                                          src={item.productImage}
                                          alt={item.productName}
                                          className="w-14 h-14 object-cover rounded-lg shadow-md border-2 border-gray-200"
                                        />
                                      )}
                                      <div className="font-black text-2xl text-center min-w-[50px] text-yellow-600">
                                        {parseFloat(item.quantity)}
                                      </div>
                                      <Button
                                        size="icon"
                                        className="bg-blue-500 hover:bg-blue-600 text-white rounded-lg shadow-md hover:shadow-lg transition-all duration-200 h-10 w-10"
                                        onClick={() =>
                                          updateOrderItemStatus(
                                            item.id,
                                            "progress",
                                          )
                                        }
                                      >
                                        <ArrowRight className="w-5 h-5" />
                                      </Button>
                                    </div>
                                  ))}
                                </CardContent>
                              </Card>
                            ),
                          )
                        ) : (
                          <div className="text-center text-gray-400 py-8">
                            {t("kitchen.noPendingOrders")}
                          </div>
                        )
                      ) : // Display by dish
                      Object.keys(groupedByDish).length > 0 ? (
                        Object.entries(groupedByDish).map(
                          ([dishName, items]) => {
                            const totalQuantity = items.reduce(
                              (sum, item) => sum + (item.quantity || 0),
                              0,
                            );
                            return (
                              <Card
                                key={dishName}
                                className="border-yellow-300 shadow-md"
                              >
                                <CardHeader className="pb-3 bg-yellow-50">
                                  <div className="flex justify-between items-start">
                                    <div className="flex-1">
                                      <div className="font-bold text-lg">
                                        {dishName}
                                      </div>
                                      <div className="text-sm text-gray-500">
                                        {items.length} {t("kitchen.orders")}
                                      </div>
                                    </div>
                                    <Badge className="bg-blue-500 text-white text-lg px-3 py-1">
                                      {parseFloat(totalQuantity)}
                                    </Badge>
                                  </div>
                                </CardHeader>
                                <CardContent className="space-y-3 pb-3 pt-3">
                                  {items.map((item, idx) => (
                                    <div
                                      key={item.id}
                                      className="flex items-center gap-3 bg-white p-3 rounded border"
                                    >
                                      <div className="flex-1">
                                        <div className="font-semibold">
                                          Bàn {item.tableNumber || "N/A"}
                                        </div>
                                        {item.notes && (
                                          <div className="text-sm text-orange-600 italic">
                                            📝 {item.notes}
                                          </div>
                                        )}
                                        <div className="text-sm text-gray-500">
                                          {item.orderNumber} -{" "}
                                          {item.orderedAt
                                            ? new Date(
                                                item.orderedAt,
                                              ).toLocaleTimeString("vi-VN", {
                                                hour: "2-digit",
                                                minute: "2-digit",
                                              })
                                            : ""}
                                        </div>
                                      </div>
                                      {item.productImage && (
                                        <img
                                          src={item.productImage}
                                          alt={item.productName}
                                          className="w-12 h-12 object-cover rounded"
                                        />
                                      )}
                                      <div className="font-bold text-xl text-center min-w-[40px]">
                                        {parseFloat(item.quantity)}
                                      </div>
                                      <Button
                                        size="sm"
                                        className="bg-blue-500 hover:bg-blue-600 text-white gap-1"
                                        onClick={() =>
                                          updateOrderItemStatus(
                                            item.id,
                                            "progress",
                                          )
                                        }
                                      >
                                        <ArrowRight className="w-4 h-4" />
                                      </Button>
                                    </div>
                                  ))}
                                </CardContent>
                              </Card>
                            );
                          },
                        )
                      ) : (
                        <div className="text-center text-gray-400 py-8">
                          {t("kitchen.noPendingOrders")}
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Progress Orders Tab */}
          <TabsContent value="progress" className="mt-0">
            <div className="transform transition-all duration-300">
              <Card className="border-2 border-blue-300 shadow-xl overflow-hidden">
                <CardHeader className="bg-gradient-to-r from-blue-50 to-blue-100 border-b-2 border-blue-200">
                  <CardTitle className="flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-200 rounded-lg">
                        <ChefHat className="w-6 h-6 text-blue-700" />
                      </div>
                      <div>
                        <span className="text-xl font-bold text-gray-800">
                          {t("kitchen.readyToServe")}
                        </span>
                        <span className="ml-2 px-3 py-1 bg-blue-500 text-white rounded-full text-sm font-semibold">
                          {(progressItems || []).length}
                        </span>
                      </div>
                    </div>
                    {/* View Mode Toggle for Ready to Serve */}
                    <Tabs
                      value={viewMode}
                      onValueChange={(value) =>
                        setViewMode(value as "table" | "dish")
                      }
                      className="w-auto"
                    >
                      <TabsList className="bg-white shadow-md border border-gray-200">
                        <TabsTrigger
                          value="table"
                          className="data-[state=active]:bg-blue-500 data-[state=active]:text-white gap-2 font-medium"
                        >
                          <Utensils className="w-4 h-4" />
                          {t("kitchen.byTable")}
                        </TabsTrigger>
                        <TabsTrigger
                          value="dish"
                          className="data-[state=active]:bg-blue-500 data-[state=active]:text-white gap-2 font-medium"
                        >
                          <ChefHat className="w-4 h-4" />
                          {t("kitchen.byDish")}
                        </TabsTrigger>
                      </TabsList>
                    </Tabs>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  <ScrollArea className="h-[calc(100vh-300px)]">
                    <div className="space-y-4">
                      {viewMode === "table"
                        ? // Display by table for progress items
                          (() => {
                            const groupedByTable = (progressItems || []).reduce(
                              (acc, item) => {
                                const tableKey = item.tableNumber || "N/A";
                                if (!acc[tableKey]) {
                                  acc[tableKey] = [];
                                }
                                acc[tableKey].push(item);
                                return acc;
                              },
                              {} as Record<string, PendingOrderItem[]>,
                            );

                            return Object.keys(groupedByTable).length > 0 ? (
                              Object.entries(groupedByTable).map(
                                ([tableNumber, items]) => (
                                  <Card
                                    key={tableNumber}
                                    className="border-blue-300 shadow-md"
                                  >
                                    <CardHeader className="pb-3 bg-blue-50">
                                      <div className="flex justify-between items-start">
                                        <div>
                                          <div className="font-bold text-lg text-blue-600">
                                            Bàn {tableNumber}
                                          </div>
                                          <div className="text-sm text-gray-500">
                                            {items[0]?.orderedAt
                                              ? `${getOrderAge(items[0].orderedAt)} phút trước`
                                              : "Vài giây trước"}
                                          </div>
                                        </div>
                                        <Badge className="bg-green-500 text-white">
                                          {items.length}
                                        </Badge>
                                      </div>
                                    </CardHeader>
                                    <CardContent className="space-y-3 pb-3 pt-3">
                                      {items.map((item) => (
                                        <div
                                          key={item.id}
                                          className="flex items-center gap-3 bg-white p-3 rounded border"
                                        >
                                          <div className="flex-1">
                                            <div className="font-semibold text-base">
                                              {item.productName || "Unknown"}
                                            </div>
                                            {item.notes && (
                                              <div className="text-sm text-orange-600 italic">
                                                📝 {item.notes}
                                              </div>
                                            )}
                                            <div className="text-sm text-gray-500">
                                              {item.orderNumber} -{" "}
                                              {item.orderedAt
                                                ? new Date(
                                                    item.orderedAt,
                                                  ).toLocaleTimeString(
                                                    "vi-VN",
                                                    {
                                                      hour: "2-digit",
                                                      minute: "2-digit",
                                                    },
                                                  )
                                                : ""}
                                            </div>
                                          </div>
                                          {item.productImage && (
                                            <img
                                              src={item.productImage}
                                              alt={item.productName}
                                              className="w-12 h-12 object-cover rounded"
                                            />
                                          )}
                                          <div className="font-bold text-xl text-center min-w-[40px]">
                                            {parseFloat(item.quantity)}
                                          </div>
                                          <div className="flex gap-2">
                                            <Button
                                              size="icon"
                                              className="bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg shadow-md hover:shadow-lg transition-all duration-200 h-10 w-10"
                                              onClick={() =>
                                                updateOrderItemStatus(
                                                  item.id,
                                                  "pending",
                                                )
                                              }
                                            >
                                              <Undo2 className="w-5 h-5" />
                                            </Button>
                                            <Button
                                              size="icon"
                                              className="bg-blue-500 hover:bg-blue-600 text-white rounded-lg shadow-md hover:shadow-lg transition-all duration-200 h-10 w-10"
                                              onClick={() =>
                                                updateOrderItemStatus(
                                                  item.id,
                                                  "completed",
                                                )
                                              }
                                            >
                                              <ArrowRight className="w-5 h-5" />
                                            </Button>
                                          </div>
                                        </div>
                                      ))}
                                    </CardContent>
                                  </Card>
                                ),
                              )
                            ) : (
                              <div className="text-center text-gray-400 py-8">
                                Không có đơn đang chờ cung ứng
                              </div>
                            );
                          })()
                        : // Display by dish for progress items
                          (() => {
                            const groupedByDish = (progressItems || []).reduce(
                              (acc, item) => {
                                const dishKey = item.productName || "Unknown";
                                if (!acc[dishKey]) {
                                  acc[dishKey] = [];
                                }
                                acc[dishKey].push(item);
                                return acc;
                              },
                              {} as Record<string, PendingOrderItem[]>,
                            );

                            return Object.keys(groupedByDish).length > 0 ? (
                              Object.entries(groupedByDish).map(
                                ([dishName, items]) => {
                                  const totalQuantity = items.reduce(
                                    (sum, item) => sum + (item.quantity || 0),
                                    0,
                                  );
                                  return (
                                    <Card
                                      key={dishName}
                                      className="border-blue-300 shadow-md"
                                    >
                                      <CardHeader className="pb-3 bg-blue-50">
                                        <div className="flex justify-between items-start">
                                          <div className="flex-1">
                                            <div className="font-bold text-lg">
                                              {dishName}
                                            </div>
                                            <div className="text-sm text-gray-500">
                                              {items.length}{" "}
                                              {t("kitchen.orders")}
                                            </div>
                                          </div>
                                          <Badge className="bg-green-500 text-white text-lg px-3 py-1">
                                            {parseFloat(totalQuantity)}
                                          </Badge>
                                        </div>
                                      </CardHeader>
                                      <CardContent className="space-y-3 pb-3 pt-3">
                                        {items.map((item) => (
                                          <div
                                            key={item.id}
                                            className="flex items-center gap-3 bg-white p-3 rounded border"
                                          >
                                            <div className="flex-1">
                                              <div className="font-semibold">
                                                Bàn {item.tableNumber || "N/A"}
                                              </div>
                                              {item.notes && (
                                                <div className="text-sm text-orange-600 italic">
                                                  📝 {item.notes}
                                                </div>
                                              )}
                                              <div className="text-sm text-gray-500">
                                                {item.orderNumber} -{" "}
                                                {item.orderedAt
                                                  ? new Date(
                                                      item.orderedAt,
                                                    ).toLocaleTimeString(
                                                      "vi-VN",
                                                      {
                                                        hour: "2-digit",
                                                        minute: "2-digit",
                                                      },
                                                    )
                                                  : ""}
                                              </div>
                                            </div>
                                            {item.productImage && (
                                              <img
                                                src={item.productImage}
                                                alt={item.productName}
                                                className="w-12 h-12 object-cover rounded"
                                              />
                                            )}
                                            <div className="font-bold text-xl text-center min-w-[40px]">
                                              {parseFloat(item.quantity)}
                                            </div>
                                            <div className="flex gap-2">
                                              <Button
                                                size="icon"
                                                className="bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg shadow-md hover:shadow-lg transition-all duration-200 h-10 w-10"
                                                onClick={() =>
                                                  updateOrderItemStatus(
                                                    item.id,
                                                    "pending",
                                                  )
                                                }
                                              >
                                                <Undo2 className="w-5 h-5" />
                                              </Button>
                                              <Button
                                                size="icon"
                                                className="bg-blue-500 hover:bg-blue-600 text-white rounded-lg shadow-md hover:shadow-lg transition-all duration-200 h-10 w-10"
                                                onClick={() =>
                                                  updateOrderItemStatus(
                                                    item.id,
                                                    "completed",
                                                  )
                                                }
                                              >
                                                <ArrowRight className="w-5 h-5" />
                                              </Button>
                                            </div>
                                          </div>
                                        ))}
                                      </CardContent>
                                    </Card>
                                  );
                                },
                              )
                            ) : (
                              <div className="text-center text-gray-400 py-8">
                                Không có đơn đang chờ cung ứng
                              </div>
                            );
                          })()}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Completed Orders Tab */}
          <TabsContent value="completed" className="mt-0">
            <div className="transform transition-all duration-300">
              <Card className="border-2 border-green-300 shadow-xl overflow-hidden">
                <CardHeader className="bg-gradient-to-r from-green-50 to-green-100 border-b-2 border-green-200">
                  <CardTitle className="flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-green-200 rounded-lg">
                        <Check className="w-6 h-6 text-green-700" />
                      </div>
                      <div>
                        <span className="text-xl font-bold text-gray-800">
                          {t("kitchen.completed")}
                        </span>
                        <span className="ml-2 px-3 py-1 bg-green-500 text-white rounded-full text-sm font-semibold">
                          {(completedItems || []).length}
                        </span>
                      </div>
                    </div>
                    {/* View Mode Toggle for Completed */}
                    <Tabs
                      value={viewMode}
                      onValueChange={(value) =>
                        setViewMode(value as "table" | "dish")
                      }
                      className="w-auto"
                    >
                      <TabsList className="bg-white shadow-md border border-gray-200">
                        <TabsTrigger
                          value="table"
                          className="data-[state=active]:bg-green-500 data-[state=active]:text-white gap-2 font-medium"
                        >
                          <Utensils className="w-4 h-4" />
                          {t("kitchen.byTable")}
                        </TabsTrigger>
                        <TabsTrigger
                          value="dish"
                          className="data-[state=active]:bg-green-500 data-[state=active]:text-white gap-2 font-medium"
                        >
                          <ChefHat className="w-4 h-4" />
                          {t("kitchen.byDish")}
                        </TabsTrigger>
                      </TabsList>
                    </Tabs>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  <ScrollArea className="h-[calc(100vh-300px)]">
                    <div className="space-y-4">
                      {viewMode === "table"
                        ? // Display by table for completed items
                          (() => {
                            const groupedByTable = (
                              completedItems || []
                            ).reduce(
                              (acc, item) => {
                                const tableKey = item.tableNumber || "N/A";
                                if (!acc[tableKey]) {
                                  acc[tableKey] = [];
                                }
                                acc[tableKey].push(item);
                                return acc;
                              },
                              {} as Record<string, PendingOrderItem[]>,
                            );

                            return Object.keys(groupedByTable).length > 0 ? (
                              Object.entries(groupedByTable).map(
                                ([tableNumber, items]) => (
                                  <Card
                                    key={tableNumber}
                                    className="border-green-300 shadow-md"
                                  >
                                    <CardHeader className="pb-3 bg-green-50">
                                      <div className="flex justify-between items-start">
                                        <div>
                                          <div className="font-bold text-lg text-green-600">
                                            {t("kitchen.table")} {tableNumber}
                                          </div>
                                          <div className="text-sm text-gray-500">
                                            {items[0]?.orderedAt
                                              ? `${getOrderAge(items[0].orderedAt)} ${t("kitchen.minutesAgo")}`
                                              : t("kitchen.fewSecondsAgo")}
                                          </div>
                                        </div>
                                        <Badge className="bg-green-500 text-white">
                                          {items.length}
                                        </Badge>
                                      </div>
                                    </CardHeader>
                                    <CardContent className="space-y-3 pb-3 pt-3">
                                      {items.map((item) => (
                                        <div
                                          key={item.id}
                                          className="flex items-center gap-3 bg-white p-3 rounded border border-green-200"
                                        >
                                          <div className="flex-1">
                                            <div className="font-semibold text-base">
                                              {item.productName || "Unknown"}
                                            </div>
                                            {item.notes && (
                                              <div className="text-sm text-orange-600 italic">
                                                📝 {item.notes}
                                              </div>
                                            )}
                                            <div className="text-sm text-gray-500">
                                              {item.orderNumber} -{" "}
                                              {item.orderedAt
                                                ? new Date(
                                                    item.orderedAt,
                                                  ).toLocaleTimeString(
                                                    "vi-VN",
                                                    {
                                                      hour: "2-digit",
                                                      minute: "2-digit",
                                                    },
                                                  )
                                                : ""}
                                            </div>
                                          </div>
                                          {item.productImage && (
                                            <img
                                              src={item.productImage}
                                              alt={item.productName}
                                              className="w-12 h-12 object-cover rounded"
                                            />
                                          )}
                                          <div className="font-bold text-xl text-center min-w-[40px] text-green-600">
                                            ✓ {parseFloat(item.quantity)}
                                          </div>
                                          <Button
                                            size="icon"
                                            className="bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg shadow-md hover:shadow-lg transition-all duration-200 h-10 w-10"
                                            onClick={() =>
                                              updateOrderItemStatus(
                                                item.id,
                                                "progress",
                                              )
                                            }
                                          >
                                            <Undo2 className="w-5 h-5" />
                                          </Button>
                                        </div>
                                      ))}
                                    </CardContent>
                                  </Card>
                                ),
                              )
                            ) : (
                              <div className="text-center text-gray-400 py-8">
                                {t("kitchen.noCompletedOrders")}
                              </div>
                            );
                          })()
                        : // Display by dish for completed items
                          (() => {
                            const groupedByDish = (completedItems || []).reduce(
                              (acc, item) => {
                                const dishKey = item.productName || "Unknown";
                                if (!acc[dishKey]) {
                                  acc[dishKey] = [];
                                }
                                acc[dishKey].push(item);
                                return acc;
                              },
                              {} as Record<string, PendingOrderItem[]>,
                            );

                            return Object.keys(groupedByDish).length > 0 ? (
                              Object.entries(groupedByDish).map(
                                ([dishName, items]) => {
                                  const totalQuantity = items.reduce(
                                    (sum, item) => sum + (item.quantity || 0),
                                    0,
                                  );
                                  return (
                                    <Card
                                      key={dishName}
                                      className="border-green-300 shadow-md"
                                    >
                                      <CardHeader className="pb-3 bg-green-50">
                                        <div className="flex justify-between items-start">
                                          <div className="flex-1">
                                            <div className="font-bold text-lg">
                                              {dishName}
                                            </div>
                                            <div className="text-sm text-gray-500">
                                              {items.length}{" "}
                                              {t("kitchen.orders")}
                                            </div>
                                          </div>
                                          <Badge className="bg-green-500 text-white text-lg px-3 py-1">
                                            ✓ {parseFloat(totalQuantity)}
                                          </Badge>
                                        </div>
                                      </CardHeader>
                                      <CardContent className="space-y-3 pb-3 pt-3">
                                        {items.map((item) => (
                                          <div
                                            key={item.id}
                                            className="flex items-center gap-3 bg-white p-3 rounded border border-green-200"
                                          >
                                            <div className="flex-1">
                                              <div className="font-semibold">
                                                {t("kitchen.table")}{" "}
                                                {item.tableNumber || "N/A"}
                                              </div>
                                              {item.notes && (
                                                <div className="text-sm text-orange-600 italic">
                                                  📝 {item.notes}
                                                </div>
                                              )}
                                              <div className="text-sm text-gray-500">
                                                {item.orderNumber} -{" "}
                                                {item.orderedAt
                                                  ? new Date(
                                                      item.orderedAt,
                                                    ).toLocaleTimeString(
                                                      "vi-VN",
                                                      {
                                                        hour: "2-digit",
                                                        minute: "2-digit",
                                                      },
                                                    )
                                                  : ""}
                                              </div>
                                            </div>
                                            {item.productImage && (
                                              <img
                                                src={item.productImage}
                                                alt={item.productName}
                                                className="w-12 h-12 object-cover rounded"
                                              />
                                            )}
                                            <div className="font-bold text-xl text-center min-w-[40px] text-green-600">
                                              ✓ {parseFloat(item.quantity)}
                                            </div>
                                            <Button
                                              size="icon"
                                              className="bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg shadow-md hover:shadow-lg transition-all duration-200 h-10 w-10"
                                              onClick={() =>
                                                updateOrderItemStatus(
                                                  item.id,
                                                  "progress",
                                                )
                                              }
                                            >
                                              <Undo2 className="w-5 h-5" />
                                            </Button>
                                          </div>
                                        ))}
                                      </CardContent>
                                    </Card>
                                  );
                                },
                              )
                            ) : (
                              <div className="text-center text-gray-400 py-8">
                                {t("kitchen.noCompletedOrders")}
                              </div>
                            );
                          })()}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
