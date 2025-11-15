import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { OrderDialog } from "@/components/orders/order-dialog";
import {
  Users,
  Clock,
  CheckCircle2,
  Eye,
  CreditCard,
  QrCode,
  Plus,
  Printer,
  X,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "@/lib/i18n";
import { apiRequest } from "@/lib/queryClient";
import QRCodeLib from "qrcode";
import { createQRPosAsync, type CreateQRPosRequest } from "@/lib/api";
import { PaymentMethodModal } from "@/components/pos/payment-method-modal";
import { EInvoiceModal } from "@/components/pos/einvoice-modal";
import { ReceiptModal } from "@/components/pos/receipt-modal";
import { SplitOrderModal } from "./split-order-modal";
import type { Table, Order } from "@shared/schema";

// Helper function to format currency, assuming it's available in the scope or imported
// For demonstration purposes, defining a placeholder if not globally available.
const formatCurrency = (amount: string | number): string => {
  const numericAmount = parseFloat(String(amount));
  if (isNaN(numericAmount)) {
    return "0 ₫";
  }
  return numericAmount.toLocaleString("vi-VN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
};

interface TableGridProps {
  onTableSelect?: (tableId: number | null) => void;
  selectedTableId?: number | null;
}

export function TableGrid({ onTableSelect, selectedTableId }: TableGridProps) {
  const { toast } = useToast();
  const { t, currentLanguage } = useTranslation();
  const queryClient = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null); // Ref for WebSocket connection

  // ALL STATE DECLARATIONS MUST BE AT THE TOP - NO CONDITIONAL HOOKS
  const [orderDialogOpen, setOrderDialogOpen] = useState(false);
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [orderDetailsOpen, setOrderDetailsOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [paymentMethodsOpen, setPaymentMethodsOpen] = useState(false);
  const [pointsPaymentOpen, setPointsPaymentOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [pointsAmount, setPointsAmount] = useState("");
  const [showQRPayment, setShowQRPayment] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState("");
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<any>(null);
  const [editOrderOpen, setEditOrderOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [editingTable, setEditingTable] = useState<Table | null>(null);
  const [mixedPaymentOpen, setMixedPaymentOpen] = useState(false);
  const [mixedPaymentData, setMixedPaymentData] = useState<any>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [showPaymentMethodModal, setShowPaymentMethodModal] = useState(false);
  const [showEInvoiceModal, setShowEInvoiceModal] = useState(false);
  const [orderForEInvoice, setOrderForEInvoice] = useState<any>(null);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<any>(null);
  const [showReceiptPreview, setShowReceiptPreview] = useState(false);
  const [previewReceipt, setPreviewReceipt] = useState<any>(null);
  const [orderForPayment, setOrderForPayment] = useState<any>(null);
  const [activeFloor, setActiveFloor] = useState("1");
  const [isTitle, setIsTitle] = useState(false);
  const [splitOrderOpen, setSplitOrderOpen] = useState(false); // State for split order modal
  const [showCancelOrderDialog, setShowCancelOrderDialog] = useState(false);
  const [orderToCancel, setOrderToCancel] = useState<Order | null>(null);
  const [showTransferTableDialog, setShowTransferTableDialog] = useState(false);
  const [orderToTransfer, setOrderToTransfer] = useState<Order | null>(null);
  const [targetTableId, setTargetTableId] = useState<number | null>(null);

  // Listen for print completion event
  useEffect(() => {
    const handlePrintCompleted = (event: CustomEvent) => {
      console.log(
        "🍽️ Table Grid: Print completed, closing all modals and refreshing",
      );

      // Close all table-related modals
      setSelectedTable(null);
      setOrderDetailsOpen(false);
      setPaymentMethodsOpen(false);
      setShowPaymentMethodModal(false);
      setShowEInvoiceModal(false);
      setShowReceiptModal(false);
      setShowReceiptPreview(false);
      setPreviewReceipt(null);
      setSelectedOrder(null);
      setOrderForPayment(null);
      setSelectedReceipt(null);

      // Refresh data
      queryClient.invalidateQueries({ queryKey: ["https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/tables"] });
      queryClient.invalidateQueries({ queryKey: ["https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/orders"] });
    };

    window.addEventListener(
      "printCompleted",
      handlePrintCompleted as EventListener,
    );

    return () => {
      window.removeEventListener(
        "printCompleted",
        handlePrintCompleted as EventListener,
      );
    };
  }, [queryClient]);

  const {
    data: tables,
    isLoading,
    refetch: refetchTables,
  } = useQuery({
    queryKey: ["https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/tables"],
    staleTime: 60 * 1000, // Cache 1 phút
    gcTime: 5 * 60 * 1000, // Giữ cache 5 phút
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchInterval: false,
    retry: 2,
  });

  const { data: orders, refetch: refetchOrders } = useQuery({
    queryKey: ["https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/orders"],
    staleTime: 30 * 1000, // Cache 30 giây cho orders
    gcTime: 2 * 60 * 1000, // Giữ cache 2 phút
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchInterval: false,
    retry: 2,
  });

  const {
    data: orderItems,
    isLoading: orderItemsLoading,
    refetch: refetchOrderItems,
  } = useQuery({
    queryKey: ["https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/order-items", selectedOrder?.id || "none"],
    enabled: !!selectedOrder?.id && orderDetailsOpen,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchInterval: false,
    staleTime: 60 * 1000, // Cache 1 phút
    gcTime: 5 * 60 * 1000, // Giữ cache 5 phút
    retry: 2,
    queryFn: async () => {
      const orderId = selectedOrder?.id;
      if (!orderId) {
        return [];
      }

      try {
        const response = await apiRequest("GET", `https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/order-items/${orderId}`);
        const data = await response.json();
        return Array.isArray(data) ? data : [];
      } catch (error) {
        console.error("Error fetching order items:", error);
        return [];
      }
    },
  });

  const { data: products } = useQuery({
    queryKey: ["https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/products"],
    staleTime: 60 * 60 * 1000, // Cache for 1 hour (products don't change often)
    gcTime: 2 * 60 * 60 * 1000, // Keep in cache for 2 hours
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchInterval: false,
  });

  // Helper function to get product name - defined after products hook
  const getProductName = (productId: number) => {
    const product = Array.isArray(products)
      ? products.find((p: any) => p.id === productId)
      : null;
    return product?.name || `Product #${productId}`;
  };

  const { data: storeSettings } = useQuery({
    queryKey: ["https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/store-settings"],
    staleTime: 2 * 60 * 60 * 1000, // Cache for 2 hours (settings rarely change)
    gcTime: 4 * 60 * 60 * 1000, // Keep in cache for 4 hours
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchInterval: false,
  });

  const { data: customers } = useQuery({
    queryKey: ["https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/customers"],
    enabled: pointsPaymentOpen,
    staleTime: 30 * 60 * 1000, // Cache for 30 minutes
    gcTime: 60 * 60 * 1000, // Keep in cache for 1 hour
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchInterval: false,
  });

  // Filter customers based on search term
  const filteredCustomers = Array.isArray(customers)
    ? customers.filter((customer: any) => {
        if (!searchTerm) return true;

        const searchLower = searchTerm.toLowerCase();
        return (
          customer.name?.toLowerCase().includes(searchLower) ||
          customer.customerId?.toLowerCase().includes(searchLower) ||
          customer.phone?.includes(searchTerm)
        );
      })
    : [];

  // Extract active orders, subtotal, tax, and total from the `orders` data
  const activeOrders = Array.isArray(orders)
    ? orders.filter(
        (order: Order) => !["paid", "cancelled"].includes(order.status),
      )
    : [];

  // Calculate subtotal, tax, and total from active orders for broadcasting
  let subtotal = 0;
  let totalTax = 0;
  let grandTotal = 0;

  if (Array.isArray(activeOrders) && activeOrders.length > 0) {
    activeOrders.forEach((order) => {
      subtotal += parseFloat(order.subtotal || "0");
      totalTax += parseFloat(order.tax || "0");
      grandTotal += parseFloat(order.total || "0");
    });
  }

  // Only refetch order items when dialog opens and no cached data exists
  useEffect(() => {
    if (orderDetailsOpen && selectedOrder?.id) {
      const cachedData = queryClient.getQueryData([
        "https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/order-items",
        selectedOrder.id,
      ]);
      if (!cachedData) {
        console.log(
          `🔍 Table Grid: Loading order items for order ${selectedOrder.id} (no cached data)`,
        );
        refetchOrderItems();
      }
    }
  }, [orderDetailsOpen, selectedOrder?.id, queryClient, refetchOrderItems]);

  // Handle events but only refresh when absolutely necessary
  useEffect(() => {
    const handlePaymentCompleted = (event: CustomEvent) => {
      console.log("🛡️ Table Grid: Payment completed event received");

      // Only invalidate - don't force refetch, let cache handle it
      if (!event.detail?.skipAllRefetch) {
        queryClient.invalidateQueries({ queryKey: ["https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/orders"] });
        queryClient.invalidateQueries({ queryKey: ["https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/tables"] });
      }
    };

    const handleOrderUpdate = (event: CustomEvent) => {
      console.log("🛡️ Table Grid: Order update event received");

      // Only invalidate specific data that changed
      if (!event.detail?.skipAllRefetch && event.detail?.orderId) {
        queryClient.invalidateQueries({
          queryKey: ["https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/order-items", event.detail.orderId],
        });
      }
    };

    window.addEventListener(
      "paymentCompleted",
      handlePaymentCompleted as EventListener,
    );
    window.addEventListener(
      "orderTotalsUpdated",
      handleOrderUpdate as EventListener,
    );

    return () => {
      window.removeEventListener(
        "paymentCompleted",
        handlePaymentCompleted as EventListener,
      );
      window.removeEventListener(
        "orderTotalsUpdated",
        handleOrderUpdate as EventListener,
      );
    };
  }, [queryClient]);

  // Broadcast cart updates to customer display - only for selected table
  let broadcastCartUpdate = useCallback(
    async (specificTableId?: number) => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        let cartItems: any[] = [];
        let orderSubtotal = 0;
        let orderTax = 0;
        let orderTotal = 0;

        // If specific table ID is provided, get detailed order items for that table
        if (specificTableId) {
          const tableOrders = activeOrders.filter(
            (order) => order.tableId === specificTableId,
          );

          // If table has orders, get detailed items
          if (tableOrders.length > 0) {
            console.log(
              "📡 Table Grid: Getting detailed items for table",
              specificTableId,
              "with",
              tableOrders.length,
              "orders",
            );

            try {
              // Get detailed order items for all orders of this table
              for (const order of tableOrders) {
                console.log(
                  "📡 Table Grid: Fetching items for order",
                  order.id,
                );

                // Fetch order items for this order
                const response = await apiRequest(
                  "GET",
                  `https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/order-items/${order.id}`,
                );
                const orderItemsData = await response.json();

                if (
                  Array.isArray(orderItemsData) &&
                  orderItemsData.length > 0
                ) {
                  console.log(
                    "📡 Table Grid: Found",
                    orderItemsData.length,
                    "items for order",
                    order.id,
                  );

                  // Convert order items to cart format with full product details
                  const orderCartItems = orderItemsData.map((item: any) => {
                    const basePrice = Number(item.unitPrice || 0);
                    const quantity = Number(item.quantity || 0);
                    const product = Array.isArray(products)
                      ? products.find((p: any) => p.id === item.productId)
                      : null;

                    // Calculate subtotal for this item
                    const itemSubtotal = basePrice * quantity;
                    orderSubtotal += itemSubtotal;

                    // Calculate tax for this item using same logic as order details
                    let itemTax = 0;
                    if (
                      product?.afterTaxPrice &&
                      product.afterTaxPrice !== null &&
                      product.afterTaxPrice !== ""
                    ) {
                      const afterTaxPrice = parseFloat(product.afterTaxPrice);
                      const taxPerUnit = Math.max(0, afterTaxPrice - basePrice);
                      itemTax = Math.floor(taxPerUnit * quantity);
                      orderTax += itemTax;
                    }

                    const itemTotal = itemSubtotal + itemTax;
                    orderTotal += itemTotal;

                    return {
                      id: item.id,
                      productId: item.productId,
                      name: item.productName || getProductName(item.productId),
                      productName:
                        item.productName || getProductName(item.productId),
                      price: basePrice.toString(),
                      quantity: quantity,
                      total: itemTotal.toString(),
                      taxRate: product?.taxRate || "0",
                      afterTaxPrice: product?.afterTaxPrice || null,
                      unitPrice: item.unitPrice,
                      notes: item.notes,
                      orderNumber: order.orderNumber,
                      product: {
                        id: item.productId,
                        name:
                          item.productName || getProductName(item.productId),
                        price: basePrice.toString(),
                        afterTaxPrice: product?.afterTaxPrice || null,
                        taxRate: product?.taxRate || "0",
                      },
                    };
                  });

                  cartItems.push(...orderCartItems);
                }
              }

              console.log(
                "📡 Table Grid: Total cart items for table",
                specificTableId,
                ":",
                cartItems.length,
              );
              console.log("📡 Table Grid: Calculated totals:", {
                subtotal: orderSubtotal,
                tax: orderTax,
                total: orderTotal,
              });
            } catch (error) {
              console.error(
                "📡 Table Grid: Error fetching detailed order items:",
                error,
              );

              // Fallback to basic order data if detailed fetch fails
              cartItems = tableOrders.map((order) => ({
                id: order.id,
                productId: order.productId || order.id,
                name: order.name || `uơn hàng ${order.orderNumber}`,
                productName: order.name || `Đơn hàng ${order.orderNumber}`,
                price: order.price || "0",
                quantity: order.quantity || 1,
                total: order.total || "0",
                taxRate: order.taxRate || "0",
                afterTaxPrice: order.afterTaxPrice,
                orderNumber: order.orderNumber,
                product: {
                  id: order.productId || order.id,
                  name: order.name || `Đơn hàng ${order.orderNumber}`,
                  price: order.price || "0",
                  afterTaxPrice: order.afterTaxPrice,
                  taxRate: order.taxRate || "0",
                },
              }));

              // Use stored totals as fallback
              tableOrders.forEach((order) => {
                orderSubtotal += parseFloat(order.subtotal || "0");
                orderTax += parseFloat(order.tax || "0");
                orderTotal += parseFloat(order.total || "0");
              });
            }
          }
        } else {
          // If no specific table, clear the display
          cartItems = [];
          orderSubtotal = 0;
          orderTax = 0;
          orderTotal = 0;
        }

        const cartData = {
          type: "cart_update",
          cart: cartItems,
          subtotal: Math.floor(orderSubtotal),
          tax: Math.floor(orderTax),
          total: Math.floor(orderTotal),
          tableId: specificTableId || null,
          orderNumber: cartItems.length > 0 ? cartItems[0]?.orderNumber : null,
          timestamp: new Date().toISOString(),
        };

        console.log(
          "📡 Table Grid: Broadcasting detailed cart update for table:",
          {
            tableId: specificTableId,
            cartItemsCount: cartItems.length,
            subtotal: Math.floor(orderSubtotal),
            tax: Math.floor(orderTax),
            total: Math.floor(orderTotal),
            orderNumber: cartData.orderNumber,
            sampleItems: cartItems.slice(0, 3).map((item) => ({
              name: item.name,
              quantity: item.quantity,
              price: item.price,
              total: item.total,
            })),
          },
        );

        // try {
        //   wsRef.current.send(JSON.stringify(cartData));
        // } catch (error) {
        //   console.error(
        //     "📡 Table Grid: Error broadcasting cart update:",
        //     error,
        //   );
        // }
      } else {
        console.log("📡 Table Grid: WebSocket not available for broadcasting");
      }
    },
    [activeOrders, products, getProductName, queryClient],
  );

  // Auto-close dialog when no active orders remain on the selected table
  useEffect(() => {
    if (orderDetailsOpen && selectedTable) {
      const tableActiveOrders = activeOrders.filter(
        (order) => order.tableId === selectedTable.id,
      );

      if (tableActiveOrders.length === 0) {
        console.log(
          "🔴 Auto-closing order details dialog - no active orders on table",
          selectedTable.tableNumber,
        );
        setOrderDetailsOpen(false);
        setSelectedOrder(null);
        setSelectedTable(null);
        broadcastCartUpdate(null);
      }
    }
  }, [orderDetailsOpen, selectedTable, activeOrders, broadcastCartUpdate]);

  // Set first floor as active if no active floor is set - MUST be with other hooks
  useEffect(() => {
    if (!tables || !Array.isArray(tables)) {
      return;
    }

    // Group tables by floor
    const tablesByFloor = tables.reduce(
      (acc, table) => {
        const floor = table.floor || "1";
        if (!acc[floor]) {
          acc[floor] = [];
        }
        acc[floor].push(table);
        return acc;
      },
      {} as Record<string, Table[]>,
    );

    // Sort floors numerically (1층, 2층, 3층, etc.)
    const sortedFloors = Object.keys(tablesByFloor).sort((a, b) => {
      const floorNumA = parseInt(a) || 0;
      const floorNumB = parseInt(b) || 0;
      return floorNumA - floorNumB;
    });

    if (sortedFloors.length > 0 && !sortedFloors.includes(activeFloor)) {
      setActiveFloor(sortedFloors[0]);
    }
  }, [tables, activeFloor]);

  // Clear customer display when no order details are open
  useEffect(() => {
    if (!orderDetailsOpen && !selectedOrder) {
      // Clear customer display when no order is being viewed
      broadcastCartUpdate(null);
    }
  }, [orderDetailsOpen, selectedOrder, broadcastCartUpdate]);

  const updateTableStatusMutation = useMutation({
    mutationFn: ({ tableId, status }: { tableId: number; status: string }) =>
      apiRequest("PUT", `https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/tables/${tableId}/status`, { status }),
    onSuccess: async (data, variables) => {
      console.log(
        `🔄 Table Grid: Table ${variables.tableId} status updated to ${variables.status}`,
      );

      // Clear cache and force immediate refresh for immediate UI update
      queryClient.removeQueries({ queryKey: ["https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/tables"] });
      queryClient.removeQueries({ queryKey: ["https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/orders"] });

      // Force immediate fresh data fetch
      try {
        await Promise.all([refetchTables(), refetchOrders()]);
        console.log("✅ Table status update refresh completed");
      } catch (error) {
        console.error("❌ Table status update refresh failed:", error);
      }

      toast({
        title: t("tables.title"),
        description: t("common.success"),
      });
    },
    onError: () => {
      toast({
        title: t("common.error"),
        description: t("common.error"),
        variant: "destructive",
      });
    },
  });

  const completePaymentMutation = useMutation({
    mutationFn: ({
      orderId,
      paymentMethod,
    }: {
      orderId: number;
      paymentMethod: string;
    }) =>
      apiRequest("PUT", `https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/orders/${orderId}/status`, {
        status: "paid",
        paymentMethod,
      }),
    onSuccess: async (data, variables) => {
      console.log("🎯 Table completePaymentMutation.onSuccess called");

      // Find the order to get its table ID for status update
      const completedOrder = Array.isArray(orders)
        ? orders.find((o: any) => o.id === variables.orderId)
        : null;

      console.log("🔍 Completed order details:", {
        orderId: variables.orderId,
        tableId: completedOrder?.tableId,
        orderNumber: completedOrder?.orderNumber,
      });

      // If order has a table, check if we need to update table status
      if (completedOrder?.tableId) {
        try {
          // Check if there are any other unpaid orders on this table
          const otherActiveOrders = Array.isArray(orders)
            ? orders.filter(
                (o: any) =>
                  o.tableId === completedOrder.tableId &&
                  o.id !== variables.orderId &&
                  !["paid", "cancelled"].includes(o.status),
              )
            : [];

          console.log("🔍 Other active orders on table:", {
            tableId: completedOrder.tableId,
            otherOrdersCount: otherActiveOrders.length,
            otherOrders: otherActiveOrders.map((o) => ({
              id: o.id,
              orderNumber: o.orderNumber,
              status: o.status,
            })),
          });

          // If no other unpaid orders, update table to available
          if (otherActiveOrders.length === 0) {
            console.log(
              `🔄 Updating table ${completedOrder.tableId} to available status`,
            );

            try {
              await apiRequest(
                "PUT",
                `https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/tables/${completedOrder.tableId}/status`,
                {
                  status: "available",
                },
              );
              console.log(
                `✅ Table ${completedOrder.tableId} updated to available`,
              );
            } catch (tableError) {
              console.error(
                `❌ Error updating table ${completedOrder.tableId}:`,
                tableError,
              );
            }
          } else {
            console.log(
              `te Table ${completedOrder.tableId} still has ${otherActiveOrders.length} active orders, keeping occupied status`,
            );
          }
        } catch (error) {
          console.error("❌ Error checking table status update:", error);
        }
      }

      // IMMEDIATE: Clear all cache before any other operation
      queryClient.clear();
      queryClient.removeQueries();

      console.log(
        "🔄 Table: Starting aggressive data refresh after payment success",
      );

      // IMMEDIATE: Force fresh API calls with no-cache headers
      try {
        // Use fetch directly with no-cache to bypass React Query entirely for immediate update
        const [freshTables, freshOrders] = await Promise.all([
          fetch("https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/tables", {
            cache: "no-store",
            headers: { "Cache-Control": "no-cache" },
          }).then((r) => r.json()),
          fetch("https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/orders", {
            cache: "no-store",
            headers: { "Cache-Control": "no-cache" },
          }).then((r) => r.json()),
        ]);

        // Set fresh data immediately in cache
        queryClient.setQueryData(["https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/tables"], freshTables);
        queryClient.setQueryData(["https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/orders"], freshOrders);

        console.log("✅ Table: Fresh data fetched and set in cache");

        // Force component re-render by invalidating after setting fresh data
        setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ["https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/tables"] });
          queryClient.invalidateQueries({ queryKey: ["https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/orders"] });
        }, 50);
      } catch (fetchError) {
        console.error(
          "❌ Table: Error during immediate fresh fetch:",
          fetchError,
        );

        // Fallback to normal refetch
        await Promise.all([refetchTables(), refetchOrders()]);
      }

      // Strategy 5: Dispatch custom events for cross-component coordination
      if (typeof window !== "undefined") {
        const events = [
          new CustomEvent("paymentCompleted", {
            detail: {
              orderId: variables.orderId,
              paymentMethod: variables.paymentMethod,
              timestamp: new Date().toISOString(),
            },
          }),
          new CustomEvent("orderStatusUpdated", {
            detail: {
              orderId: variables.orderId,
              status: "paid",
              timestamp: new Date().toISOString(),
            },
          }),
          new CustomEvent("forceRefresh", {
            detail: {
              reason: "payment_completed",
              orderId: variables.orderId,
              source: "table-grid",
            },
          }),
        ];

        events.forEach((event) => {
          console.log("📡 Table: Dispatching refresh event:", event.type);
          window.dispatchEvent(event);
        });
      }

      toast({
        title: "Thanh toán thành công",
        description: "Đơn hàng đã được thanh toán và dữ liệu đã được làm mới",
      });

      // Fetch the completed order and its items for receipt
      try {
        const [completedOrder, orderItemsData] = await Promise.all([
          queryClient.fetchQuery({
            queryKey: ["https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/orders", variables.orderId],
            queryFn: async () => {
              const response = await apiRequest(
                "GET",
                `https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/orders/${variables.orderId}`,
              );
              return response.json();
            },
          }),
          queryClient.fetchQuery({
            queryKey: ["https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/order-items", variables.orderId],
            queryFn: async () => {
              const response = await apiRequest(
                "GET",
                `https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/order-items/${variables.orderId}`,
              );
              return response.json();
            },
          }),
        ]);

        if (completedOrder && orderItemsData) {
          console.log(
            "✅ Table payment completed - preparing receipt data with EXACT database values",
          );

          // Map order items WITHOUT recalculation - use database values directly
          const processedItems = Array.isArray(orderItemsData)
            ? orderItemsData.map((item: any) => ({
                id: item.id,
                productId: item.productId,
                productName: item.productName || getProductName(item.productId),
                quantity: item.quantity,
                price: item.unitPrice,
                total: item.total,
                unitPrice: item.unitPrice,
                discount: item.discount || "0", // Use exact database discount
                sku: item.productSku || `SP${item.productId}`,
                taxRate: 0, // Will be calculated from afterTaxPrice if available
              }))
            : [];

          // Use EXACT database values without any calculation
          const receiptData = {
            ...completedOrder,
            transactionId: `TXN-${Date.now()}`,
            createdAt: new Date().toISOString(),
            cashierName: "Table Service",
            paymentMethod: variables.paymentMethod || "cash",
            amountReceived: completedOrder.total,
            change: "0.00",
            items: processedItems,
            // Use EXACT database values without any calculation
            subtotal: completedOrder.subtotal,
            tax: completedOrder.tax,
            discount: completedOrder.discount || "0",
            total: completedOrder.total,
            exactSubtotal: Math.floor(Number(completedOrder.subtotal || 0)),
            exactTax: Math.floor(Number(completedOrder.tax || 0)),
            exactDiscount: Math.floor(Number(completedOrder.discount || 0)),
            exactTotal: Math.floor(Number(completedOrder.total || 0)),
            tableNumber:
              getTableInfo(completedOrder.tableId)?.tableNumber || "N/A",
          };

          console.log(
            "📄 Table receipt data prepared with EXACT database values:",
            {
              subtotal: receiptData.subtotal,
              tax: receiptData.tax,
              discount: receiptData.discount,
              total: receiptData.total,
              exactTotal: receiptData.exactTotal,
              source: "database_direct_no_calculation",
            },
          );

          // Close all dialogs first
          setOrderDetailsOpen(false);
          setPaymentMethodsOpen(false);
          setShowPaymentMethodModal(false);
          setShowEInvoiceModal(false);
          setOrderForPayment(null);
        }
      } catch (error) {
        console.error("Error fetching order details for receipt:", error);
        toast({
          title: "Cảnh báo",
          description: "Thanh toán thành công nhưng không thể hiển thị hóa đõn",
          variant: "destructive",
        });
      }
    },
    onError: () => {
      console.log("❌ Table completePaymentMutation.onError called");
      toast({
        title: "Lỗi",
        description: "Không thể hoàn tất thanh toán",
        variant: "destructive",
      });
      setOrderForPayment(null);
    },
  });

  const pointsPaymentMutation = useMutation({
    mutationFn: async ({
      customerId,
      points,
      orderId,
    }: {
      customerId: number;
      points: number;
      orderId: number;
    }) => {
      // First redeem points
      await apiRequest("POST", "https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/customers/redeem-points", {
        customerId,
        points,
      });

      // Then mark order as paid
      await apiRequest("PUT", `https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/orders/${orderId}/status`, {
        status: "paid",
        paymentMethod: "points",
        customerId,
      });
    },
    onSuccess: async (data, variables) => {
      // Find the order to get its table ID for status update
      const completedOrder = Array.isArray(orders)
        ? orders.find((o: any) => o.id === variables.orderId)
        : null;

      console.log("🔍 Points payment completed for order:", {
        orderId: variables.orderId,
        tableId: completedOrder?.tableId,
        orderNumber: completedOrder?.orderNumber,
      });

      // If order has a table, check if we need to update table status
      if (completedOrder?.tableId) {
        try {
          // Check if there are any other unpaid orders on this table
          const otherActiveOrders = Array.isArray(orders)
            ? orders.filter(
                (o: any) =>
                  o.tableId === completedOrder.tableId &&
                  o.id !== variables.orderId &&
                  !["paid", "cancelled"].includes(o.status),
              )
            : [];

          console.log("🔍 Other active orders on table after points payment:", {
            tableId: completedOrder.tableId,
            otherOrdersCount: otherActiveOrders.length,
          });

          // If no other unpaid orders, update table to available
          if (otherActiveOrders.length === 0) {
            console.log(
              `🔄 Updating table ${completedOrder.tableId} to available after points payment`,
            );

            try {
              await apiRequest(
                "PUT",
                `https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/tables/${completedOrder.tableId}/status`,
                {
                  status: "available",
                },
              );
              console.log(
                `✅ Table ${completedOrder.tableId} updated to available after points payment`,
              );
            } catch (tableError) {
              console.error(
                `❌ Error updating table ${completedOrder.tableId} after points payment:`,
                tableError,
              );
            }
          }
        } catch (error) {
          console.error(
            "❌ Error checking table status update after points payment:",
            error,
          );
        }
      }

      queryClient.invalidateQueries({ queryKey: ["https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/orders"] });
      queryClient.invalidateQueries({ queryKey: ["https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/tables"] });
      queryClient.invalidateQueries({ queryKey: ["https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/customers"] });
      queryClient.invalidateQueries({
        queryKey: ["https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/order-items", variables.orderId],
      });
      setOrderDetailsOpen(false);
      setPointsPaymentOpen(false);
      setSelectedCustomer(null);
      setPointsAmount("");
      setSearchTerm("");
      toast({
        title: "Thanh toán thành công",
        description: "Đơn hàng đã được thanh toán bằng điểm",
      });

      // Fetch the completed order to get its details for receipt
      queryClient
        .fetchQuery({
          queryKey: ["https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/orders", variables.orderId],
          queryFn: async () => {
            const response = await apiRequest(
              "GET",
              `https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/orders/${variables.orderId}`,
            );
            return response.json();
          },
        })
        .then(async (completedOrder) => {
          if (completedOrder) {
            console.log(
              "Points payment completed - preparing receipt with exact database values:",
              completedOrder,
            );

            // Also fetch order items for complete receipt
            try {
              const orderItemsResponse = await apiRequest(
                "GET",
                `https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/order-items/${variables.orderId}`,
              );
              const orderItemsData = await orderItemsResponse.json();

              const processedItems = Array.isArray(orderItemsData)
                ? orderItemsData.map((item: any) => ({
                    id: item.id,
                    productId: item.productId,
                    productName:
                      item.productName || getProductName(item.productId),
                    quantity: item.quantity,
                    price: item.unitPrice,
                    total: item.total,
                    unitPrice: item.unitPrice,
                    discount: item.discount || "0",
                    sku: item.productSku || `SP${item.productId}`,
                  }))
                : [];

              const receiptData = {
                ...completedOrder,
                transactionId: `TXN-${Date.now()}`,
                createdAt: new Date().toISOString(),
                cashierName: "Table Service",
                paymentMethod: "points",
                amountReceived: completedOrder.total,
                change: "0.00",
                items: processedItems,
                // Use exact database values - no recalculation
                subtotal: completedOrder.subtotal,
                tax: completedOrder.tax,
                discount: completedOrder.discount || "0",
                total: completedOrder.total,
                exactSubtotal: Math.floor(Number(completedOrder.subtotal || 0)),
                exactTax: Math.floor(Number(completedOrder.tax || 0)),
                exactDiscount: Math.floor(Number(completedOrder.discount || 0)),
                exactTotal: Math.floor(Number(completedOrder.total || 0)),
                tableNumber:
                  getTableInfo(completedOrder.tableId)?.tableNumber || "N/A",
              };

              setSelectedReceipt(receiptData);
              setShowReceiptModal(true);
            } catch (error) {
              console.error(
                "Error fetching order items for points payment receipt:",
                error,
              );
              // Fallback to basic receipt data
              setSelectedReceipt({
                ...completedOrder,
                transactionId: `TXN-${Date.now()}`,
                paymentMethod: "points",
                tableNumber:
                  getTableInfo(completedOrder.tableId)?.tableNumber || "N/A",
              });
              setShowReceiptModal(true);
            }
          }
        });
    },
    onError: () => {
      toast({
        title: "Lỗi",
        description: "Không thể hoàn tất thanh toán bằng điểm",
        variant: "destructive",
      });
    },
  });

  // Add the missing handlePointsPayment function
  const handlePointsPayment = () => {
    if (!selectedCustomer || !selectedOrder) {
      toast({
        title: "Lỗi",
        description: "Vui lòng chọn khách hàng và đơn hàng",
        variant: "destructive",
      });
      return;
    }

    const customerPoints = selectedCustomer.points || 0;
    const finalTotal = Math.floor(Number(selectedOrder.total || 0));
    const pointsValue = customerPoints * 1000; // 1 point = 1000 VND

    if (customerPoints === 0) {
      toast({
        title: "Lỗi",
        description: "Khách hàng không có điểm",
        variant: "destructive",
      });
      return;
    }

    if (pointsValue >= finalTotal) {
      // Full points payment
      const pointsToUse = Math.ceil(finalTotal / 1000);
      pointsPaymentMutation.mutate({
        customerId: selectedCustomer.id,
        points: pointsToUse,
        orderId: selectedOrder.id,
      });
    } else {
      // Mixed payment - use all available points + other payment method
      setMixedPaymentData({
        customerId: selectedCustomer.id,
        pointsToUse: customerPoints,
        orderId: selectedOrder.id,
        remainingAmount: finalTotal - pointsValue,
      });
      setPointsPaymentOpen(false);
      setMixedPaymentOpen(true);
    }
  };

  const mixedPaymentMutation = useMutation({
    mutationFn: async ({
      customerId,
      points,
      orderId,
      paymentMethod,
    }: {
      customerId: number;
      points: number;
      orderId: number;
      paymentMethod: string;
    }) => {
      // First redeem all available points
      await apiRequest("POST", "https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/customers/redeem-points", {
        customerId,
        points,
      });

      // Then mark order as paid with mixed payment
      await apiRequest("PUT", `https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/orders/${orderId}/status`, {
        status: "paid",
        paymentMethod: `points + ${paymentMethod}`,
        customerId,
      });
    },
    onSuccess: async (data, variables) => {
      // Find the order to get its table ID for status update
      const completedOrder = Array.isArray(orders)
        ? orders.find((o: any) => o.id === variables.orderId)
        : null;

      console.log("🔍 Mixed payment completed for order:", {
        orderId: variables.orderId,
        tableId: completedOrder?.tableId,
        orderNumber: completedOrder?.orderNumber,
      });

      // If order has a table, check if we need to update table status
      if (completedOrder?.tableId) {
        try {
          // Check if there are any other unpaid orders on this table
          const otherActiveOrders = Array.isArray(orders)
            ? orders.filter(
                (o: any) =>
                  o.tableId === completedOrder.tableId &&
                  o.id !== variables.orderId &&
                  !["paid", "cancelled"].includes(o.status),
              )
            : [];

          console.log("🔍 Other active orders on table after mixed payment:", {
            tableId: completedOrder.tableId,
            otherOrdersCount: otherActiveOrders.length,
          });

          // If no other unpaid orders, update table to available
          if (otherActiveOrders.length === 0) {
            console.log(
              `🔄 Updating table ${completedOrder.tableId} to available after mixed payment`,
            );

            try {
              await apiRequest(
                "PUT",
                `https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/tables/${completedOrder.tableId}/status`,
                {
                  status: "available",
                },
              );
              console.log(
                `✅ Table ${completedOrder.tableId} updated to available after mixed payment`,
              );
            } catch (tableError) {
              console.error(
                `❌ Error updating table ${completedOrder.tableId} after mixed payment:`,
                tableError,
              );
            }
          }
        } catch (error) {
          console.error(
            "❌ Error checking table status update after mixed payment:",
            error,
          );
        }
      }

      queryClient.invalidateQueries({ queryKey: ["https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/orders"] });
      queryClient.invalidateQueries({ queryKey: ["https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/tables"] });
      queryClient.invalidateQueries({ queryKey: ["https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/customers"] });
      queryClient.invalidateQueries({
        queryKey: ["https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/order-items", variables.orderId],
      });
      setOrderDetailsOpen(false);
      setMixedPaymentOpen(false);
      setMixedPaymentData(null);
      setSelectedCustomer(null);
      setPointsAmount("");
      setSearchTerm("");

      // Fetch the completed order to get its details for receipt
      queryClient
        .fetchQuery({
          queryKey: ["https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/orders", variables.orderId],
          queryFn: async () => {
            const response = await apiRequest(
              "GET",
              `https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/orders/${variables.orderId}`,
            );
            return response.json();
          },
        })
        .then(async (completedOrder) => {
          if (completedOrder) {
            console.log(
              "Mixed payment completed - preparing receipt with exact database values:",
              completedOrder,
            );

            // Also fetch order items for complete receipt
            try {
              const orderItemsResponse = await apiRequest(
                "GET",
                `https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/order-items/${variables.orderId}`,
              );
              const orderItemsData = await orderItemsResponse.json();

              const processedItems = Array.isArray(orderItemsData)
                ? orderItemsData.map((item: any) => ({
                    id: item.id,
                    productId: item.productId,
                    productName:
                      item.productName || getProductName(item.productId),
                    quantity: item.quantity,
                    price: item.unitPrice,
                    total: item.total,
                    unitPrice: item.unitPrice,
                    discount: item.discount || "0",
                    sku: item.productSku || `SP${item.productId}`,
                  }))
                : [];

              const receiptData = {
                ...completedOrder,
                transactionId: `TXN-${Date.now()}`,
                createdAt: new Date().toISOString(),
                cashierName: "Table Service",
                paymentMethod: `points + ${variables.paymentMethod}`,
                amountReceived: completedOrder.total,
                change: "0.00",
                items: processedItems,
                // Use exact database values - no recalculation
                subtotal: completedOrder.subtotal,
                tax: completedOrder.tax,
                discount: completedOrder.discount || "0",
                total: completedOrder.total,
                exactSubtotal: Math.floor(Number(completedOrder.subtotal || 0)),
                exactTax: Math.floor(Number(completedOrder.tax || 0)),
                exactDiscount: Math.floor(Number(completedOrder.discount || 0)),
                exactTotal: Math.floor(Number(completedOrder.total || 0)),
                tableNumber:
                  getTableInfo(completedOrder.tableId)?.tableNumber || "N/A",
              };

              setSelectedReceipt(receiptData);
              setShowReceiptModal(true);
            } catch (error) {
              console.error(
                "Error fetching order items for mixed payment receipt:",
                error,
              );
              // Fallback to basic receipt data
              setSelectedReceipt({
                ...completedOrder,
                transactionId: `TXN-${Date.now()}`,
                paymentMethod: `points + ${variables.paymentMethod}`,
                tableNumber:
                  getTableInfo(completedOrder.tableId)?.tableNumber || "N/A",
              });
              setShowReceiptModal(false);
            }
          }
        });
    },
    onError: () => {
      toast({
        title: "Lỗi",
        description: "Không thể hoàn tất thanh toán hỗn hợp",
        variant: "destructive",
      });
    },
  });

  const deleteOrderMutation = useMutation({
    mutationFn: async (orderId: number) => {
      // First cancel the order
      const response = await apiRequest(
        "PUT",
        `https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/orders/${orderId}/status`,
        { status: "cancelled" },
      );

      // Find the order to get its table ID
      const order = orders?.find((o: any) => o.id === orderId);
      if (order?.tableId) {
        // Check if there are any other active orders on this table
        const otherActiveOrders = orders?.filter(
          (o: any) =>
            o.tableId === order.tableId &&
            o.id !== orderId &&
            !["paid", "cancelled"].includes(o.status),
        );

        // If no other active orders, update table status to available
        if (!otherActiveOrders || otherActiveOrders.length === 0) {
          await apiRequest("PUT", `https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/tables/${order.tableId}/status`, {
            status: "available",
          });
        }
      }

      return response;
    },
    onSuccess: (data, orderId) => {
      queryClient.invalidateQueries({ queryKey: ["https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/orders"] });
      queryClient.invalidateQueries({ queryKey: ["https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/tables"] });
      queryClient.invalidateQueries({
        queryKey: ["https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/order-items", orderId],
      });
    },
    onError: () => {
      toast({
        title: "Lỗi",
        description: "Không thể xóa đơn hàng",
        variant: "destructive",
      });
    },
  });

  const transferTableMutation = useMutation({
    mutationFn: async ({
      orderId,
      newTableId,
    }: {
      orderId: number;
      newTableId: number;
    }) => {
      const order = orders?.find((o: any) => o.id === orderId);
      if (!order) throw new Error("Order not found");

      const oldTableId = order.tableId;

      console.log(`🔄 Starting table transfer:`, {
        orderId,
        oldTableId,
        newTableId,
        orderNumber: order.orderNumber,
      });

      // Step 1: Update order's table ID - this will transfer all order items automatically
      const orderUpdateResponse = await apiRequest(
        "PUT",
        `https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/orders/${orderId}`,
        {
          tableId: newTableId,
        },
      );

      const updatedOrder = await orderUpdateResponse.json();
      console.log(
        `✅ Order ${orderId} transferred to table ${newTableId}:`,
        updatedOrder,
      );

      // Step 2: Update new table status to occupied
      try {
        await apiRequest("PUT", `https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/tables/${newTableId}/status`, {
          status: "occupied",
        });
        console.log(`✅ New table ${newTableId} set to occupied`);
      } catch (tableError) {
        console.error(`❌ Error updating new table ${newTableId}:`, tableError);
      }

      // Step 3: Update old table status if no more active orders
      if (oldTableId) {
        try {
          // Fetch fresh orders data to check remaining orders on old table
          const freshOrdersResponse = await apiRequest("GET", `https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/orders`);
          const freshOrders = await freshOrdersResponse.json();

          const otherActiveOrders = freshOrders?.filter(
            (o: any) =>
              o.tableId === oldTableId &&
              o.id !== orderId &&
              !["paid", "cancelled"].includes(o.status),
          );

          console.log(`🔍 Checking old table ${oldTableId}:`, {
            otherActiveOrdersCount: otherActiveOrders?.length || 0,
          });

          if (!otherActiveOrders || otherActiveOrders.length === 0) {
            await apiRequest("PUT", `https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/tables/${oldTableId}/status`, {
              status: "available",
            });
            console.log(`✅ Old table ${oldTableId} set to available`);
          } else {
            console.log(
              `⏳ Old table ${oldTableId} still has ${otherActiveOrders.length} active orders`,
            );
          }
        } catch (oldTableError) {
          console.error(
            `❌ Error updating old table ${oldTableId}:`,
            oldTableError,
          );
        }
      }

      return updatedOrder;
    },
    onSuccess: async (data) => {
      console.log("🎉 Table transfer successful, refreshing data...");

      // Clear cache and force fresh data
      queryClient.clear();
      queryClient.removeQueries();

      // Force immediate fresh fetch
      try {
        const params = new URLSearchParams({
          _t: Date.now().toString(),
          _force: "true",
        });
        const [freshTables, freshOrders] = await Promise.all([
          fetch(`https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/tables?${params}`).then((r) => r.json()),
          fetch(`https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/orders?${params}`).then((r) => r.json()),
        ]);

        // Set fresh data immediately
        queryClient.setQueryData(["https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/tables"], freshTables);
        queryClient.setQueryData(["https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/orders"], freshOrders);

        console.log("✅ Fresh data loaded after table transfer");

        // Force re-render with invalidation
        setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ["https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/tables"] });
          queryClient.invalidateQueries({ queryKey: ["https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/orders"] });
        }, 50);
      } catch (fetchError) {
        console.error("❌ Error fetching fresh data:", fetchError);
        // Fallback to normal refresh
        await Promise.all([refetchTables(), refetchOrders()]);
      }

      // Close dialogs and clear states
      setShowTransferTableDialog(false);
      setOrderToTransfer(null);
      setTargetTableId(null);
      setOrderDetailsOpen(false);
      setSelectedOrder(null);
      setSelectedTable(null);

      // Clear customer display
      broadcastCartUpdate(null);
    },
    onError: (error) => {
      console.error("❌ Table transfer error:", error);
      toast({
        title: "Lỗi",
        description: "Không thể chuyển bàn. Vui lòng thử lại.",
        variant: "destructive",
      });
    },
  });

  // Mutation to recalculate order totals
  const recalculateOrderTotalMutation = useMutation({
    mutationFn: async (orderId: number) => {
      // Fetch current order items after deletion
      const response = await apiRequest("GET", `https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/order-items/${orderId}`);
      const remainingItems = await response.json();

      console.log(
        "📦 Remaining items after deletion:",
        remainingItems?.length || 0,
      );

      // Keep order even if no items remain - just recalculate totals to zero
      if (!remainingItems || remainingItems.length === 0) {
        console.log(
          "📝 No items left, setting order totals to zero but keeping order",
        );

        // Set totals to zero instead of deleting the order
        const updateResult = await apiRequest("PUT", `https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/orders/${orderId}`, {
          subtotal: "0",
          tax: "0",
          total: "0",
        });

        console.log("✅ Order totals reset to zero successfully");
        return updateResult;
      }

      // Calculate new totals based on remaining items
      let newSubtotal = 0;
      let newTax = 0;

      if (Array.isArray(remainingItems) && remainingItems.length > 0) {
        remainingItems.forEach((item: any) => {
          const basePrice = Number(item.unitPrice || 0);
          const quantity = Number(item.quantity || 0);
          const product = Array.isArray(products)
            ? products.find((p: any) => p.id === item.productId)
            : null;
          if (
            product?.afterTaxPrice &&
            product.afterTaxPrice !== null &&
            product.afterTaxPrice !== ""
          ) {
            const afterTaxPrice = parseFloat(product.afterTaxPrice);
            const taxPerUnit = Math.max(0, afterTaxPrice - basePrice);
            newTax += taxPerUnit * quantity;
          }
          // No tax calculation if no afterTaxPrice in database
        });
      }

      const newTotal = newSubtotal + newTax;

      console.log("💰 Calculated new totals:", {
        subtotal: newSubtotal,
        tax: newTax,
        total: newTotal,
        hasItems: remainingItems?.length > 0,
      });

      // Update order with new totals
      const updateResult = await apiRequest("PUT", `https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/orders/${orderId}`, {
        subtotal: newSubtotal.toString(),
        tax: newTax.toString(),
        total: newTotal.toString(),
      });

      console.log("✅ Order totals updated successfully");
      return updateResult;
    },
    onSuccess: (data, orderId) => {
      console.log(
        "🔄 Refreshing UI after order total recalculation for order:",
        orderId,
      );

      // Clear all cache and force fresh data fetch
      queryClient.clear(); // Clear entire cache
      queryClient.removeQueries(); // Remove all queries

      // Force immediate fresh fetch with no-cache
      Promise.all([
        fetch("https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/orders", { cache: "no-store" }).then((r) => r.json()),
        fetch("https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/tables", { cache: "no-store" }).then((r) => r.json()),
        fetch(`https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/order-items/${orderId}`, { cache: "no-store" }).then((r) =>
          r.json(),
        ),
      ])
        .then(() => {
          console.log(
            "✅ All queries refetched successfully, UI should now show updated totals",
          );

          // Force component re-render by setting a timestamp
          queryClient.setQueryData(["https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/orders"], (oldData: any) => {
            if (!oldData || !Array.isArray(oldData)) return oldData;

            return oldData.map((order: any) => {
              if (order.id === orderId) {
                console.log(
                  `🔄 Forcing UI refresh for order ${orderId} with total: ${order.total}`,
                );
                return { ...order, _lastUpdated: Date.now() };
              }
              return order;
            });
          });
        })
        .catch((error) => {
          console.error("❌ Error during query refetch:", error);
        });
    },
    onError: (error) => {
      console.error("❌ Error recalculating order total:", error);
    },
  });

  const getTableStatus = (status: string) => {
    const statusConfig = {
      available: {
        label: t("tables.available"),
        variant: "default" as const,
        color: "bg-green-500",
      },
      occupied: {
        label: t("tables.occupied"),
        variant: "destructive" as const,
        color: "bg-red-500",
      },
      reserved: {
        label: t("tables.reserved"),
        variant: "secondary" as const,
        color: "bg-yellow-500",
      },
      maintenance: {
        label: t("tables.outOfService"),
        variant: "outline" as const,
        color: "bg-gray-500",
      },
    };

    return (
      statusConfig[status as keyof typeof statusConfig] ||
      statusConfig.available
    );
  };

  // Helper function to calculate order total with tax consideration
  const calculateOrderTotal = useCallback(
    (order: Order, items: any[]) => {
      if (!items || items.length === 0) {
        return Math.floor(Number(order.total || 0));
      }

      const priceIncludesTax = storeSettings?.priceIncludesTax || false;

      let subtotal = 0;
      let tax = 0;

      items.forEach((item: any) => {
        const unitPrice = Number(item.unitPrice || 0);
        const quantity = Number(item.quantity || 0);
        const product = products?.find((p: any) => p.id === item.productId);

        if (priceIncludesTax) {
          // When priceIncludesTax = true: subtotal = sum(beforeTaxPrice * quantity)
          if (
            product?.beforeTaxPrice &&
            product.beforeTaxPrice !== null &&
            product.beforeTaxPrice !== ""
          ) {
            const beforeTaxPrice = parseFloat(product.beforeTaxPrice);
            subtotal += beforeTaxPrice * quantity;
            // Tax = price - beforeTaxPrice
            const taxPerUnit = Math.max(0, unitPrice - beforeTaxPrice);
            tax += Math.floor(taxPerUnit * quantity);
          } else {
            // Fallback to unitPrice if beforeTaxPrice not available
            subtotal += unitPrice * quantity;
          }
        } else {
          // When priceIncludesTax = false: use old calculation
          subtotal += unitPrice * quantity;

          // Calculate tax using afterTaxPrice
          if (
            product?.afterTaxPrice &&
            product.afterTaxPrice !== null &&
            product.afterTaxPrice !== ""
          ) {
            const afterTaxPrice = parseFloat(product.afterTaxPrice);
            const taxPerUnit = Math.max(0, afterTaxPrice - unitPrice);
            tax += Math.floor(taxPerUnit * quantity);
          }
        }
      });

      const total = subtotal + tax;
      return Math.floor(total);
    },
    [products, storeSettings],
  );

  const getActiveOrder = (tableId: number) => {
    if (!orders || !Array.isArray(orders)) return null;

    // Get all active orders for this table and sort by orderedAt descending to get the latest
    const activeOrders = orders.filter(
      (order: Order) =>
        order.tableId === tableId &&
        !["paid", "cancelled"].includes(order.status),
    );

    console.log(
      `Active orders for table ${tableId}:`,
      activeOrders.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        orderedAt: o.orderedAt,
        status: o.status,
        total: o.total,
      })),
    );

    if (activeOrders.length === 0) return null;

    // Sort by orderedAt descending and return the most recent order
    const latestOrder = activeOrders.sort(
      (a: Order, b: Order) =>
        new Date(b.orderedAt).getTime() - new Date(a.orderedAt).getTime(),
    )[0];

    console.log(`Latest order for table ${tableId}:`, {
      id: latestOrder.id,
      orderNumber: latestOrder.orderNumber,
      orderedAt: latestOrder.orderedAt,
      total: latestOrder.total,
    });

    return latestOrder;
  };

  // Helper function to get table info
  const getTableInfo = (tableId: number) => {
    const table = Array.isArray(tables)
      ? tables.find((t: any) => t.id === tableId)
      : null;
    return table;
  };

  // Helper function to handle edit order
  const handleEditOrder = (order: Order, table: Table) => {
    setEditingOrder(order);
    setEditingTable(table);
    setEditOrderOpen(true);
  };

  // Helper function to handle delete order
  const handleDeleteOrder = (order: Order) => {
    if (window.confirm(`${t("common.areyouremoteorder")}`)) {
      deleteOrderMutation.mutate(order.id);
    }
  };

  // Helper function to handle QR payment close
  const handleQRPaymentClose = () => {
    setShowQRPayment(false);
    setQrCodeUrl("");
    setSelectedPaymentMethod("");
    setMixedPaymentOpen(false);
  };

  // Helper function to handle QR payment confirm
  const handleQRPaymentConfirm = () => {
    if (!selectedOrder) return;

    if (mixedPaymentData) {
      // Mixed payment completion
      mixedPaymentMutation.mutate({
        customerId: mixedPaymentData.customerId,
        points: mixedPaymentData.pointsToUse,
        orderId: mixedPaymentData.orderId,
        paymentMethod: selectedPaymentMethod?.method?.name || "transfer",
      });
    } else {
      // Regular payment completion
      completePaymentMutation.mutate({
        orderId: selectedOrder.id,
        paymentMethod: selectedPaymentMethod?.key || "qrCode",
      });
    }

    setShowQRPayment(false);
    setQrCodeUrl("");
    setSelectedPaymentMethod("");
  };

  const handleTableClick = (table: Table) => {
    setSelectedTable(table);
    onTableSelect?.(table.id);

    if (table.status === "available") {
      setOrderDialogOpen(true);
    }
  };

  const handleStatusChange = (tableId: number, newStatus: string) => {
    updateTableStatusMutation.mutate({ tableId, status: newStatus });
  };

  const handleViewOrderDetails = (order: Order) => {
    console.log("=== VIEWING ORDER DETAILS ===");
    console.log("Selected order for details:", order);
    console.log(
      "Order ID:",
      order.id,
      "Table ID:",
      order.tableId,
      "Ordered at:",
      order.orderedAt,
    );
    console.log(
      "Order status:",
      order.status,
      "Order number:",
      order.orderNumber,
    );
    console.log("=== END ORDER DETAILS ===");

    // Set the selected order first
    setSelectedOrder(order);

    // Broadcast cart update for this specific table to customer display
    if (order.tableId) {
      broadcastCartUpdate(order.tableId);
    }

    // Then open the dialog - this ensures selectedOrder is set when the query runs
    setTimeout(() => {
      setOrderDetailsOpen(true);
    }, 0);
  };

  const handlePayment = async (paymentMethodKey: string) => {
    if (!selectedOrder) return;

    const method = getPaymentMethods().find(
      (m) => m.nameKey === paymentMethodKey,
    );
    if (!method) return;

    // If cash payment, proceed directly
    if (paymentMethodKey === "cash") {
      completePaymentMutation.mutate({
        orderId: selectedOrder.id,
        paymentMethod: paymentMethodKey,
      });
      return;
    }

    // For QR Code payment, use CreateQRPos API
    if (paymentMethodKey === "qrCode") {
      try {
        setQrLoading(true);
        const { createQRPosAsync, CreateQRPosRequest } = await import(
          "@/lib/api"
        );

        const transactionUuid = `TXN-${Date.now()}`;
        const depositAmt = Number(selectedOrder.total);

        const qrRequest: CreateQRPosRequest = {
          transactionUuid,
          depositAmt: depositAmt,
          posUniqueId: "ER002",
          accntNo: "0900993023",
          posfranchiseeName: "DOOKI-HANOI",
          posCompanyName: "HYOJUNG",
          posBillNo: `BILL-${Date.now()}`,
        };

        const bankCode = "79616001";
        const clientID = "91a3a3668724e631e1baf4f8526524f3";

        console.log("Calling CreateQRPos API with:", {
          qrRequest,
          bankCode,
          clientID,
        });

        const qrResponse = await createQRPosAsync(
          qrRequest,
          bankCode,
          clientID,
        );

        console.log("CreateQRPos API response:", qrResponse);

        // Generate QR code from the received QR data
        if (qrResponse.qrData) {
          // Use qrData directly for QR code generation
          let qrContent = qrResponse.qrData;
          try {
            // Try to decode if it's base64 encoded
            qrContent = atob(qrResponse.qrData);
          } catch (e) {
            // If decode fails, use the raw qrData
            console.log("Using raw qrData as it is not base64 encoded");
          }

          const qrUrl = await QRCodeLib.toDataURL(qrContent, {
            width: 256,
            margin: 2,
            color: {
              dark: "#000000",
              light: "#FFFFFF",
            },
          });
          setQrCodeUrl(qrUrl);
          setSelectedPaymentMethod({ key: paymentMethodKey, method });
          setShowQRPayment(true);
          setPaymentMethodsOpen(false);
        } else {
          console.error("No QR data received from API");
          // Fallback to mock QR code
          const fallbackData = `Payment via QR\nAmount: ${selectedOrder.total.toLocaleString("vi-VN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₫\nOrder: ${selectedOrder.orderNumber}\nTime: ${new Date().toLocaleString("vi-VN")}`;
          const qrUrl = await QRCodeLib.toDataURL(fallbackData, {
            width: 256,
            margin: 2,
            color: {
              dark: "#000000",
              light: "#FFFFFF",
            },
          });
          setQrCodeUrl(qrUrl);
          setSelectedPaymentMethod({ key: paymentMethodKey, method });
          setShowQRPayment(true);
          setPaymentMethodsOpen(false);
        }
      } catch (error) {
        console.error("Error calling CreateQRPos API:", error);
        // Fallback to mock QR code on error
        try {
          const fallbackData = `Payment via QR\nAmount: ${selectedOrder.total.toLocaleString("vi-VN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₫\nOrder: ${selectedOrder.orderNumber}\nTime: ${new Date().toLocaleString("vi-VN")}`;
          const qrUrl = await QRCodeLib.toDataURL(fallbackData, {
            width: 256,
            margin: 2,
            color: {
              dark: "#000000",
              light: "#FFFFFF",
            },
          });
          setQrCodeUrl(qrUrl);
          setSelectedPaymentMethod({ key: paymentMethodKey, method });
          setShowQRPayment(true);
          setPaymentMethodsOpen(false);
        } catch (fallbackError) {
          console.error("Error generating fallback QR code:", fallbackError);
          toast({
            title: "Lỗi",
            description: "Không thể tạo mã QR",
            variant: "destructive",
          });
        }
      } finally {
        setQrLoading(false);
      }
      return;
    }

    // For other non-cash payments, show mock QR code
    try {
      const qrData = `${method.name} Payment\nAmount: ${selectedOrder.total.toLocaleString("vi-VN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₫\nOrder: ${selectedOrder.orderNumber}\nTime: ${new Date().toLocaleString("vi-VN")}`;
      const qrUrl = await QRCodeLib.toDataURL(qrData, {
        width: 256,
        margin: 2,
        color: {
          dark: "#000000",
          light: "#FFFFFF",
        },
      });
      setQrCodeUrl(qrUrl);
      setSelectedPaymentMethod({ key: paymentMethodKey, method });
      setShowQRPayment(true);
      setPaymentMethodsOpen(false);
    } catch (error) {
      console.error("Error generating QR code:", error);
      toast({
        title: "Lỗi",
        description: "Không thể tạo mã QR",
        variant: "destructive",
      });
    }
  };

  // Define handlePaymentMethodSelect here - ENHANCED for immediate data refresh with proper discount handling
  const handlePaymentMethodSelect = async (
    method: string,
    paymentData?: any,
  ) => {
    console.log("💳 Table Grid: Payment method selected:", method, paymentData);

    if (method === "paymentCompleted" && paymentData?.success) {
      console.log("✅ Table Grid: Payment completed successfully", paymentData);

      try {
        // STEP 1: Clear ALL cache aggressively
        console.log("🔄 Table Grid: AGGRESSIVE cache clearing starting...");
        queryClient.clear();
        queryClient.removeQueries();

        // STEP 2: Force immediate fresh data fetch with multiple strategies
        console.log("🔄 Table Grid: Force fetching fresh data...");

        // Strategy A: Direct fetch with no-cache headers
        const params = new URLSearchParams({
          _t: Date.now().toString(),
          _force: "true",
        });
        const [freshTables, freshOrders] = await Promise.all([
          fetch(`https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/tables?${params}`).then((r) => r.json()),
          fetch(`https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/orders?${params}`).then((r) => r.json()),
        ]);

        // STEP 3: Set fresh data immediately in cache
        queryClient.setQueryData(["https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/tables"], freshTables);
        queryClient.setQueryData(["https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/orders"], freshOrders);
        console.log("✅ Table Grid: Fresh data loaded and cached");

        // STEP 4: Force multiple re-renders with different timings
        setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ["https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/tables"] });
          queryClient.invalidateQueries({ queryKey: ["https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/orders"] });
        }, 50);

        setTimeout(() => {
          queryClient.refetchQueries({ queryKey: ["https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/tables"] });
          queryClient.refetchQueries({ queryKey: ["https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/orders"] });
        }, 200);

        // STEP 5: Close all modals and clear states
        setShowPaymentMethodModal(false);
        setOrderForPayment(null);
        setOrderDetailsOpen(false);
        setSelectedOrder(null);
        setOrderForEInvoice(null);

        // CRITICAL: Show receipt modal if receipt data is provided
        if (paymentData.receipt && paymentData.shouldShowReceipt !== false) {
          console.log(
            "📄 Table Grid: Showing final receipt modal with data:",
            paymentData.receipt,
          );
          setSelectedReceipt(paymentData.receipt);
          setIsTitle(true);
          setShowReceiptModal(true); // CRITICAL: Enable receipt modal display
        }

        console.log(
          "🎉 Table Grid: Payment flow completed and data refreshed successfully",
        );
      } catch (error) {
        console.error(
          "❌ Table Grid: Error refreshing data after payment:",
          error,
        );

        // Fallback refresh with forced refetch
        try {
          await Promise.all([refetchTables(), refetchOrders()]);
          console.log("✅ Fallback refresh completed");
        } catch (fallbackError) {
          console.error(
            "❌ Table Grid: Fallback refresh also failed:",
            fallbackError,
          );
        }
      }

      return;
    }

    if (method === "paymentError" && paymentData) {
      console.error("❌ Table Grid: Payment failed", paymentData);

      toast({
        title: "Lỗi",
        description:
          paymentData.error ||
          "Không thể hoàn tất thanh toán. Vui lòng thử lại.",
        variant: "destructive",
      });

      // Close modal and clear states
      setShowPaymentMethodModal(false);
      setOrderForPayment(null);
      return;
    }

    if (!orderForPayment) {
      console.error("❌ No order for payment found");
      toast({
        title: "Lỗi",
        description: "Không tìm thấy đơn hàng để thanh toán",
        variant: "destructive",
      });
      return;
    }

    try {
      if (method === "einvoice") {
        console.log("📧 Opening E-invoice modal for table payment");
        setShowPaymentMethodModal(false);
        setShowEInvoiceModal(true);
        // Pass the relevant order details to the EInvoiceModal
        setOrderForEInvoice({
          ...orderForPayment,
          orderItems: orderItems || orderForPayment.orderItems, // Ensure orderItems are available
          exactSubtotal:
            orderForPayment.exactSubtotal ||
            parseFloat(orderForPayment.subtotal || "0"),
          exactTax:
            orderForPayment.exactTax || parseFloat(orderForPayment.tax || "0"),
          exactTotal:
            orderForPayment.exactTotal ||
            parseFloat(orderForPayment.total || "0"),
        });
        return;
      }

      // Store payment method for receipt display
      setSelectedPaymentMethod(method);

      // Close payment method modal and show receipt preview
      setShowPaymentMethodModal(false);

      // Calculate proper totals from order items with exact discount handling
      let calculatedSubtotal = 0;
      let calculatedTax = 0;
      let orderDiscount = 0;

      console.log("💰 Table Grid: Calculating receipt data from order items", {
        orderForPayment: orderForPayment,
        orderItems: orderItems?.length || 0,
      });

      // Get discount from orderForPayment first, then from selectedOrder
      if (
        orderForPayment.exactDiscount !== undefined &&
        orderForPayment.exactDiscount !== null
      ) {
        orderDiscount = Math.floor(Number(orderForPayment.exactDiscount));
      } else if (
        orderForPayment.discount !== undefined &&
        orderForPayment.discount !== null
      ) {
        orderDiscount = Math.floor(Number(orderForPayment.discount));
      } else if (selectedOrder?.discount) {
        orderDiscount = Math.floor(Number(selectedOrder.discount));
      }

      // Process order items to calculate subtotal and tax
      const processedItems =
        Array.isArray(orderItems) && orderItems.length > 0
          ? orderItems.map((item: any) => {
              const basePrice = Number(item.unitPrice || 0);
              const quantity = Number(item.quantity || 0);
              const product = Array.isArray(products)
                ? products.find((p: any) => p.id === item.productId)
                : null;

              // Calculate subtotal (base price without tax)
              calculatedSubtotal += basePrice * quantity;

              // Calculate tax using same logic as Order Details
              if (
                product?.afterTaxPrice &&
                product.afterTaxPrice !== null &&
                product.afterTaxPrice !== ""
              ) {
                const afterTaxPrice = parseFloat(product.afterTaxPrice);
                const taxPerUnit = afterTaxPrice - basePrice;
                calculatedTax += Math.floor(taxPerUnit * quantity);
              }

              return {
                id: item.id,
                productId: item.productId,
                productName: item.productName || getProductName(item.productId),
                quantity: quantity,
                price: item.unitPrice,
                unitPrice: item.unitPrice,
                discount: item.discount || "0",
                total: item.total,
                sku:
                  item.productSku ||
                  `FOOD${String(item.productId).padStart(6, "0")}`,
                taxRate: product?.taxRate ? parseFloat(product.taxRate) : 10,
              };
            })
          : [];

      // Final total calculation: subtotal + tax (discount applied during payment)
      const finalTotal = Math.floor(calculatedSubtotal + calculatedTax);

      const orderTotals = {
        subtotal: calculatedSubtotal,
        tax: calculatedTax,
        total: finalTotal,
      };

      console.log("💰 Table Grid: Calculated receipt totals", {
        orderTotals: orderTotals,
        orderDiscount: orderDiscount,
        itemsProcessed: processedItems.length,
      });

      // Create receipt preview data (MATCH table-grid format) with proper discount
      const receiptPreview = {
        id: selectedOrder.id,
        orderId: selectedOrder.id,
        orderNumber: selectedOrder.orderNumber,
        tableId: selectedOrder.tableId,
        customerCount: selectedOrder.customerCount,
        customerName: selectedOrder.customerName,
        items: processedItems,
        // Use EXACT calculated values from orderTotals (matches order details display)
        subtotal: Math.floor(orderTotals.subtotal).toString(),
        tax: Math.floor(orderTotals.tax).toString(),
        total: Math.floor(orderTotals.total).toString(),
        discount: Math.floor(orderDiscount).toString(),
        exactSubtotal: Math.floor(orderTotals.subtotal),
        exactTax: Math.floor(orderTotals.tax),
        exactDiscount: Math.floor(orderDiscount),
        exactTotal: Math.floor(orderTotals.total),
        transactionId: `PREVIEW-${Date.now()}`,
        createdAt: new Date().toISOString(),
        cashierName: "Table Service",
        paymentMethod: method,
        amountReceived:
          paymentData?.amountReceived?.toString() ||
          Math.floor(orderTotals.total).toString(),
        change: paymentData?.change?.toString() || "0.00",
        tableNumber: getTableInfo(selectedOrder.tableId)?.tableNumber || "N/A",
      };

      console.log("📄 Table Grid: Receipt preview created with proper format", {
        receiptPreview: receiptPreview,
        hasItems: receiptPreview.items?.length > 0,
      });

      setSelectedReceipt(receiptPreview);
      setShowReceiptPreview(false);
      setShowReceiptModal(false);

      console.log("📄 Showing receipt preview for table payment confirmation");
    } catch (error) {
      console.error("❌ Error preparing receipt preview:", error);
      toast({
        title: "Lỗi",
        description: "Không thể chuẩn bị hóa đơn",
        variant: "destructive",
      });
    }
  };

  // Handle receipt confirmation and complete payment
  const handleReceiptConfirm = async () => {
    if (!orderForPayment) {
      console.error("❌ No order for payment found");
      toast({
        title: "Lỗi",
        description: "Không tìm thấy đơn hàng để thanh toán",
        variant: "destructive",
      });
      return;
    }

    try {
      console.log("🔄 Completing payment for order:", orderForPayment.id);

      // Complete payment with the selected method
      await completePaymentMutation.mutateAsync({
        orderId: orderForPayment.id,
        paymentMethod: selectedPaymentMethod,
      });

      console.log("✅ Table payment completed successfully");

      // Close receipt modal and clear state
      setShowReceiptModal(false);
      setOrderForPayment(null);
      setSelectedPaymentMethod("");
      setSelectedReceipt(null);

      // Force immediate data refresh
      console.log("🔄 Table: Force refreshing data after payment completion");

      // Clear cache completely
      queryClient.clear();
      queryClient.removeQueries({ queryKey: ["https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/tables"] });
      queryClient.removeQueries({ queryKey: ["https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/orders"] });

      // Force fresh fetch immediately
      try {
        await Promise.all([refetchTables(), refetchOrders()]);
        console.log("✅ Table: Data refreshed successfully after payment");
      } catch (refreshError) {
        console.error("❌ Table: Error during data refresh:", refreshError);
      }

      // Send WebSocket signal for data refresh
      try {
        const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        const wsUrl = `https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/ws`;
        const ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          ws.send(
            JSON.stringify({
              type: "popup_close",
              success: true,
              source: "table_grid_receipt_confirm",
              timestamp: new Date().toISOString(),
            }),
          );

          setTimeout(() => ws.close(), 100);
        };
      } catch (error) {
        console.warn("⚠️ Table Grid: Could not send WebSocket signal:", error);
      }

      // Dispatch custom event as backup
      window.dispatchEvent(
        new CustomEvent("forceDataRefresh", {
          detail: {
            source: "table_grid_receipt_confirm",
            reason: "payment_completed",
            timestamp: new Date().toISOString(),
          },
        }),
      );
    } catch (error) {
      console.error("❌ Error completing payment from table:", error);
      toast({
        title: "Lỗi",
        description: "Không thể hoàn thành thanh toán",
        variant: "destructive",
      });
    }
  };

  // Handle E-invoice confirmation and complete payment
  const handleEInvoiceConfirm = async (invoiceData: any) => {
    if (!orderForPayment) {
      console.error("❌ No order for payment found");
      toast({
        title: "Lỗi",
        description: "Không tìm thấy đơn hàng để thanh toán",
        variant: "destructive",
      });
      return;
    }

    try {
      console.log(
        "🔄 Starting payment completion for order:",
        orderForPayment.id,
      );

      // Complete payment after e-invoice is created
      await completePaymentMutation.mutateAsync({
        orderId: orderForPayment.id,
        paymentMethod: "einvoice",
      });

      console.log("✅ Table payment completed successfully");

      // Close E-invoice modal first
      setShowEInvoiceModal(false);

      // Prepare proper receipt data using exact same calculation as Order Details
      let subtotal = 0;
      let totalTax = 0;

      // CRITICAL: Get the correct order ID from orderForPayment
      const currentOrderId = orderForPayment?.id;
      console.log(
        "🔍 Table: Getting order items for order ID:",
        currentOrderId,
      );

      // Fetch order items for the specific order being paid
      let currentOrderItems = [];
      if (currentOrderId) {
        try {
          const response = await apiRequest(
            "GET",
            `https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/order-items/${currentOrderId}`,
          );
          currentOrderItems = await response.json();
          console.log(
            "✅ Table: Fetched order items for E-invoice receipt:",
            currentOrderItems.length,
          );
        } catch (error) {
          console.error(
            "❌ Table: Error fetching order items for E-invoice:",
            error,
          );
          currentOrderItems = orderForPayment?.orderItems || [];
        }
      } else {
        currentOrderItems = orderForPayment?.orderItems || [];
      }

      if (Array.isArray(currentOrderItems) && Array.isArray(products)) {
        currentOrderItems.forEach((item: any) => {
          const basePrice = Number(item.unitPrice || 0);
          const quantity = Number(item.quantity || 0);
          const product = products.find((p: any) => p.id === item.productId);

          // Calculate subtotal
          subtotal += basePrice * quantity;

          // Use EXACT same tax calculation logic as Order Details
          if (
            product?.afterTaxPrice &&
            product.afterTaxPrice !== null &&
            product.afterTaxPrice !== ""
          ) {
            const afterTaxPrice = parseFloat(product.afterTaxPrice);
            const taxPerUnit = afterTaxPrice - basePrice;
            totalTax += taxPerUnit * quantity;
          }
        });
      }

      const finalTotal = subtotal + totalTax;

      // Create proper receipt data with calculated values
      const receiptData = {
        ...orderForPayment,
        transactionId: `TXN-${Date.now()}`,
        items: currentOrderItems.map((item: any) => ({
          id: item.id,
          productId: item.productId,
          productName: item.productName || getProductName(item.productId),
          quantity: item.quantity,
          price: item.unitPrice,
          total: item.total,
          sku: item.productSku || `SP${item.productId}`,
          taxRate: (() => {
            const product = Array.isArray(products)
              ? products.find((p: any) => p.id === item.productId)
              : null;
            return product?.taxRate ? parseFloat(product.taxRate) : 10;
          })(),
        })),
        subtotal: subtotal.toString(),
        tax: totalTax.toString(),
        total: finalTotal.toString(),
        paymentMethod: "einvoice",
        amountReceived: finalTotal.toString(),
        change: "0.00",
        cashierName: "Table Service",
        createdAt: new Date().toISOString(),
        customerName: invoiceData.customerName || orderForPayment.customerName,
        customerTaxCode: invoiceData.taxCode,
        invoiceNumber: invoiceData.invoiceNumber,
        tableNumber:
          getTableInfo(orderForPayment.tableId)?.tableNumber || "N/A",
      };

      console.log(
        "📄 Table: Showing receipt modal after E-invoice with proper data",
      );
      console.log("💰 Receipt data:", {
        itemsCount: receiptData.items.length,
        subtotal: receiptData.subtotal,
        tax: receiptData.tax,
        total: receiptData.total,
      });

      // Clear order for payment and show receipt
      setOrderForPayment(null);
    } catch (error) {
      console.error("❌ Error completing payment from table:", error);
      toast({
        title: "Lỗi",
        description: "Không thể hoàn thành thanh toán",
        variant: "destructive",
      });
    }
  };

  const getPaymentMethods = () => {
    // Get payment methods from localStorage (saved from settings)
    const savedPaymentMethods = localStorage.getItem("paymentMethods");

    // Default payment methods if none saved
    const defaultPaymentMethods = [
      {
        id: 1,
        name: "Tiền mặt",
        nameKey: "cash",
        type: "cash",
        enabled: true,
        icon: "💵",
      },
      {
        id: 2,
        name: "Thẻ tín dụng",
        nameKey: "creditCard",
        type: "card",
        enabled: true,
        icon: "💳",
      },
      {
        id: 3,
        name: "Thẻ ghi nợ",
        nameKey: "debitCard",
        type: "debit",
        enabled: true,
        icon: "💳",
      },
      {
        id: 4,
        name: "MoMo",
        nameKey: "momo",
        type: "digital",
        enabled: true,
        icon: "📱",
      },
      {
        id: 5,
        name: "ZaloPay",
        nameKey: "zalopay",
        type: "digital",
        enabled: true,
        icon: "📱",
      },
      {
        id: 6,
        name: "VNPay",
        nameKey: "vnpay",
        type: "digital",
        enabled: true,
        icon: "💳",
      },
      {
        id: 7,
        name: "QR Code",
        nameKey: "qrCode",
        type: "qr",
        enabled: true,
        icon: "📱",
      },
      {
        id: 8,
        name: "ShopeePay",
        nameKey: "shopeepay",
        type: "digital",
        enabled: false,
        icon: "🛒",
      },
      {
        id: 9,
        name: "GrabPay",
        nameKey: "grabpay",
        type: "digital",
        enabled: false,
        icon: "🚗",
      },
      {
        id: 10,
        name: "Hóa đơn điện tử",
        nameKey: "einvoice",
        type: "invoice",
        enabled: true,
        icon: "📄",
      },
    ];

    const paymentMethods = savedPaymentMethods
      ? JSON.parse(savedPaymentMethods)
      : defaultPaymentMethods;

    // Filter to only return enabled payment methods
    return paymentMethods.filter((method) => method.enabled);
  };

  const getOrderStatusBadge = (status: string) => {
    const statusConfig = {
      pending: {
        label: t("orders.status.pending"),
        variant: "secondary" as const,
      },
      confirmed: {
        label: t("orders.status.confirmed"),
        variant: "default" as const,
      },
      preparing: {
        label: t("orders.status.preparing"),
        variant: "secondary" as const,
      },
      ready: { label: t("orders.status.ready"), variant: "outline" as const },
      served: { label: t("common.serving"), variant: "outline" as const },
      delivering: {
        label: t("orders.status.delivering"),
        variant: "secondary" as const,
      },
      completed: {
        label: t("orders.status.completed"),
        variant: "default" as const,
      },
      paid: { label: t("orders.status.paid"), variant: "default" as const },
      cancelled: {
        label: t("orders.status.cancelled"),
        variant: "destructive" as const,
      },
    };

    return (
      statusConfig[status as keyof typeof statusConfig] || statusConfig.pending
    );
  };

  // Function to handle auto-print for orders
  const handlePrintOrder = async (order: any) => {
    console.log("🖨️ Starting auto-print for table order:", order.id);

    try {
      const orderItems = await queryClient.fetchQuery({
        queryKey: [`https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/order-items/${order.id}`],
        queryFn: async () => {
          const response = await apiRequest(
            "GET",
            `https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/order-items/${order.id}`,
          );
          return response.json();
        },
      });

      // Create receipt data
      const receiptData = {
        transactionId: order.orderNumber || `ORD-${order.id}`,
        items: order.items.map((item: any) => ({
          // Assuming order.items is available and structured
          id: item.id,
          productId: item.productId,
          productName: item.productName || getProductName(item.productId),
          price: item.unitPrice,
          quantity: item.quantity,
          discount: item.discount || "0",
          total: item.total,
          sku: item.productSku || `SP${item.productId}`,
          taxRate: (() => {
            const product = Array.isArray(products)
              ? products.find((p: any) => p.id === item.productId)
              : null;
            return product?.taxRate ? parseFloat(product.taxRate) : 10;
          })(),
        })),
        subtotal: order.subtotal,
        tax: order.tax,
        total: order.total,
        paymentMethod: order.paymentMethod || "cash",
        amountReceived: order.total,
        change: "0.00",
        cashierName: order.employeeName || "System User",
        createdAt: order.orderedAt || new Date().toISOString(),
        tableNumber: getTableInfo(order.tableId)?.tableNumber || "N/A",
      };

      // Call auto-print API for both employee and kitchen printers
      const response = await fetch("https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/auto-print", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          receiptData,
          printerType: "both", // Print to both employee and kitchen printers
        }),
      });

      const result = await response.json();

      if (result.success) {
        console.log("✅ Auto-print successful:", result.message);

        // Show detailed results for each printer
        const successfulPrints = result.results.filter(
          (r) => r.status === "success",
        );
        const failedPrints = result.results.filter((r) => r.status === "error");

        if (successfulPrints.length > 0) {
          console.log(
            `✅ Printed successfully on ${successfulPrints.length} printers:`,
            successfulPrints.map((p) => p.printerName),
          );
        }

        if (failedPrints.length > 0) {
          toast({
            title: "Một s  máy in gặp lỗi",
            description: failedPrints
              .map((r) => `• ${r.printerName}: ${r.message}`)
              .join("\n"),
            variant: "destructive",
          });
        }
      } else {
        console.log("⚠️ Auto-print failed, falling back to receipt modal");
        // Fallback to showing receipt modal for manual print
        setSelectedReceipt(receiptData);
        setShowReceiptModal(true);

        toast({
          title: "Không tìm thấy máy in",
          description:
            "Không tìm thấy máy in hom.c không có cấu hình máy in. Sử dụng chức năng in th. công.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("❌ Auto-print error:", error);

      toast({
        title: "Lỗi in tự động",
        description:
          "Có lỗi xảy ra khi in tự động. Sử dụng chức năng in thủ công.",
        variant: "destructive",
      });

      // Fallback to manual print - try to show receipt modal
      try {
        const orderItems = await queryClient.fetchQuery({
          queryKey: [`https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/order-items/${order.id}`],
          queryFn: async () => {
            const response = await apiRequest(
              "GET",
              `https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/order-items/${order.id}`,
            );
            return response.json();
          },
        });

        const receiptData = {
          transactionId: order.orderNumber || `ORD-${order.id}`,
          items: order.items.map((item: any) => ({
            id: item.id,
            productId: item.productId,
            productName: item.productName || getProductName(item.productId),
            price: item.unitPrice,
            quantity: item.quantity,
            discount: item.discount || "0",
            total: item.total,
            sku: item.productSku || `SP${item.productId}`,
            taxRate: (() => {
              const product = Array.isArray(products)
                ? products.find((p: any) => p.id === item.productId)
                : null;
              return product?.taxRate ? parseFloat(product.taxRate) : 10;
            })(),
          })),
          subtotal: order.subtotal,
          tax: order.tax,
          total: order.total,
          paymentMethod: order.paymentMethod || "cash",
          amountReceived: order.total,
          change: "0.00",
          cashierName: order.employeeName || "System User",
          createdAt: order.orderedAt || new Date().toISOString(),
          tableNumber: getTableInfo(order.tableId)?.tableNumber || "N/A",
        };

        setSelectedReceipt(receiptData);
        setShowReceiptModal(true);
      } catch (fallbackError) {
        console.error("Error preparing fallback receipt:", fallbackError);
      }
    }
  };

  const splitOrderMutation = useMutation({
    mutationFn: async (splitData: {
      originalOrderId: number;
      splitItems: any[];
    }) => {
      console.log("🔪 Split order mutation starting with data:", splitData);

      // Call split order API
      const response = await apiRequest("POST", "https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/orders/split", {
        originalOrderId: splitData.originalOrderId,
        splitItems: splitData.splitItems,
      });

      const result = await response.json();
      console.log("✅ Split order API response:", result);

      // Force refresh all related data
      await Promise.all([
        refetchOrders(),
        refetchTables(),
        queryClient.invalidateQueries({
          queryKey: ["https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/order-items", splitData.originalOrderId],
        }),
      ]);

      return result;
    },
    onSuccess: (data, variables) => {
      console.log("Split order successful:", data);
      setSplitOrderOpen(false);
      setOrderDetailsOpen(false);
      setSelectedOrder(null);
      // Force a full data refresh after split
      queryClient.clear();
      queryClient.removeQueries();
      Promise.all([refetchTables(), refetchOrders()]);
    },
    onError: (error) => {
      console.error("Error splitting order:", error);
      toast({
        title: "Lỗi tách đơn",
        description: "Không thể tách đơn hàng. Vui lòng thử lại.",
        variant: "destructive",
      });
    },
  });

  const handleSplitOrder = async (splitData: any) => {
    try {
      console.log("🔪 Split order data:", splitData);

      const response = await apiRequest("POST", "https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/orders/split", splitData);

      if (!response.ok) {
        throw new Error("Failed to split order");
      }

      const result = await response.json();
      console.log("✅ Split order result:", result);

      // IMMEDIATE: Clear all cache and force fresh data
      console.log("🔄 Clearing cache and forcing fresh data after split");
      queryClient.clear();
      queryClient.removeQueries();

      // Force immediate fresh fetch with no-cache
      try {
        const params = new URLSearchParams({
          _t: Date.now().toString(),
          _force: "true",
        });
        const [freshTables, freshOrders] = await Promise.all([
          fetch(`https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/tables?${params}`).then((r) => r.json()),
          fetch(`https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/orders?${params}`).then((r) => r.json()),
        ]);

        // Set fresh data immediately
        queryClient.setQueryData(["https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/tables"], freshTables);
        queryClient.setQueryData(["https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/orders"], freshOrders);

        console.log("✅ Fresh data loaded after split:", {
          tables: freshTables?.length || 0,
          orders: freshOrders?.length || 0,
        });

        // Force re-render with invalidation
        setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ["https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/tables"] });
          queryClient.invalidateQueries({ queryKey: ["https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/orders"] });
        }, 50);
      } catch (fetchError) {
        console.error("❌ Error fetching fresh data:", fetchError);
        // Fallback to normal refresh
        await Promise.all([refetchTables(), refetchOrders()]);
      }

      // Close modals
      setSplitOrderOpen(false);
      setOrderDetailsOpen(false);
      setSelectedOrder(null);
      setSelectedTable(null);

      // Clear customer display
      broadcastCartUpdate(null);
    } catch (error) {
      console.error("❌ Error splitting order:", error);
      toast({
        title: "Lỗi",
        description: "Không thể tách đơn hàng",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="animate-pulse">
            <div className="bg-gray-200 rounded-lg h-32"></div>
          </div>
        ))}
      </div>
    );
  }

  // Group tables by floor
  const tablesByFloor = Array.isArray(tables)
    ? tables.reduce(
        (acc, table) => {
          const floor = table.floor || "1층";
          if (!acc[floor]) {
            acc[floor] = [];
          }
          acc[floor].push(table);
          return acc;
        },
        {} as Record<string, Table[]>,
      )
    : {};

  // Sort floors numerically (1층, 2층, 3층, etc.)
  const sortedFloors = Object.keys(tablesByFloor).sort((a, b) => {
    const floorNumA = parseInt(a.replace("층", "")) || 0;
    const floorNumB = parseInt(b.replace("층", "")) || 0;
    return floorNumA - floorNumB;
  });

  return (
    <>
      {sortedFloors.length > 0 ? (
        <Tabs
          value={activeFloor}
          onValueChange={setActiveFloor}
          className="w-full"
        >
          {/* Floor Tabs */}
          <div className="w-full overflow-x-auto mb-6 flex justify-center">
            <TabsList className="h-auto min-h-[50px] items-center justify-center gap-1 bg-white border border-gray-200 rounded-lg p-2 shadow-sm flex">
              {sortedFloors.map((floor) => (
                <TabsTrigger
                  key={floor}
                  value={floor}
                  className="flex items-center gap-2 text-sm px-4 py-3 whitespace-nowrap data-[state=active]:bg-blue-500 data-[state=active]:text-white data-[state=active]:shadow-md hover:bg-blue-50 transition-all duration-200 rounded-md font-medium border border-transparent data-[state=active]:border-blue-600"
                >
                  <span className="font-semibold">
                    {t("common.floor")} {floor}
                  </span>
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          {/* Floor Content */}
          {sortedFloors.map((floor) => (
            <TabsContent key={floor} value={floor} className="mt-0">
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {tablesByFloor[floor].map((table: Table) => {
                  const statusConfig = getTableStatus(table.status);
                  const activeOrder = getActiveOrder(table.id);
                  const isSelected = selectedTableId === table.id;

                  return (
                    <Card
                      key={table.id}
                      className={`cursor-pointer transition-all duration-200 hover:shadow-lg ${
                        isSelected ? "ring-2 ring-blue-500" : ""
                      } ${table.status === "occupied" ? "bg-red-50" : "bg-white"}`}
                      onClick={() => {
                        if (table.status === "occupied") {
                          const activeOrder = getActiveOrder(table.id);
                          if (activeOrder) {
                            setSelectedTable(table);
                            handleViewOrderDetails(activeOrder);
                          }
                        } else {
                          handleTableClick(table);
                        }
                      }}
                    >
                      <CardContent className="p-4">
                        <div className="flex flex-col items-center text-center space-y-3">
                          {/* Table Number */}
                          <div className="relative">
                            <div
                              className={`px-3 py-2 rounded-lg ${statusConfig.color} flex items-center justify-center font-bold shadow-lg border-2 border-white min-w-[80px] min-h-[48px]`}
                              style={{
                                fontSize:
                                  table.tableNumber.length > 8
                                    ? "0.75rem"
                                    : table.tableNumber.length > 5
                                      ? "0.875rem"
                                      : "1rem",
                              }}
                            >
                              <span className="text-center leading-tight text-white break-words hyphens-auto px-1">
                                {table.tableNumber}
                              </span>
                            </div>
                            {activeOrder && (
                              <div className="absolute -top-2 -right-2 w-6 h-6 bg-orange-500 rounded-full animate-pulse border-2 border-white shadow-md flex items-center justify-center">
                                <div className="w-2 h-2 bg-white rounded-full"></div>
                              </div>
                            )}
                          </div>

                          {/* Table Info */}
                          <div className="space-y-1">
                            <div className="flex items-center justify-center text-sm text-gray-600">
                              <Users className="w-3 h-3 mr-1" />
                              {activeOrder ? (
                                <span>
                                  {activeOrder.customerCount || 1}/
                                  {table.capacity} {t("orders.people")}
                                </span>
                              ) : (
                                <span>
                                  {table.capacity} {t("orders.people")}
                                </span>
                              )}
                            </div>
                            <Badge
                              variant={
                                table.status === "occupied" && activeOrder
                                  ? getOrderStatusBadge(activeOrder.status)
                                      .variant
                                  : statusConfig.variant
                              }
                              className="text-xs rounded-full px-3 py-1 font-medium shadow-sm border-0"
                              style={{
                                backgroundColor:
                                  table.status === "available"
                                    ? "#dcfce7"
                                    : table.status === "occupied"
                                      ? "#fecaca"
                                      : table.status === "reserved"
                                        ? "#fef3c7"
                                        : "#f3f4f6",
                                color:
                                  table.status === "available"
                                    ? "#166534"
                                    : table.status === "occupied"
                                      ? "#dc2626"
                                      : table.status === "reserved"
                                        ? "#d97706"
                                        : "#6b7280",
                              }}
                            >
                              {table.status === "occupied" && activeOrder
                                ? t(
                                    getOrderStatusBadge(activeOrder.status)
                                      .label as any,
                                  )
                                : t(statusConfig.label as any)}
                            </Badge>
                          </div>

                          {/* Order Info */}
                          {activeOrder && (
                            <div className="space-y-1 text-xs text-gray-600">
                              <div className="flex items-center justify-center">
                                <Clock className="w-3 h-3 mr-1" />
                                {new Date(
                                  activeOrder.orderedAt,
                                ).toLocaleTimeString(
                                  currentLanguage === "ko"
                                    ? "ko-KR"
                                    : currentLanguage === "en"
                                      ? "en-US"
                                      : "vi-VN",
                                  {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  },
                                )}
                              </div>
                              <div className="font-medium text-gray-900">
                                {Math.floor(
                                  Number(activeOrder.total || 0),
                                ).toLocaleString("vi-VN")}{" "}
                                ₫
                              </div>
                            </div>
                          )}

                          {/* Bỏ nút Xem chi tiết - click vào card để xem */}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </TabsContent>
          ))}
        </Tabs>
      ) : (
        <div className="text-center py-8 text-gray-500">테이블이 없습니다.</div>
      )}

      {/* Order Dialog */}
      <OrderDialog
        open={orderDialogOpen}
        onOpenChange={setOrderDialogOpen}
        table={selectedTable}
      />

      {/* Edit Order Dialog */}
      <OrderDialog
        open={editOrderOpen}
        onOpenChange={(open) => {
          console.log("🔄 Edit dialog onOpenChange:", {
            open,
            hasEditingOrder: !!editingOrder,
          });

          setEditOrderOpen(open);

          // When đóng edit dialog, quay lại order details
          if (!open && editingOrder) {
            console.log("📋 Returning to order details list after edit");

            // Force refresh order data
            queryClient.invalidateQueries({ queryKey: ["https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/orders"] });
            queryClient.invalidateQueries({ queryKey: ["https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/tables"] });
            queryClient.invalidateQueries({
              queryKey: ["https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/order-items", editingOrder.id],
            });

            // Immediately reopen order details
            setOrderDetailsOpen(true);

            // Additional refresh after delay to ensure UI is updated
            setTimeout(() => {
              queryClient.refetchQueries({ queryKey: ["https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/orders"] });
              queryClient.refetchQueries({ queryKey: ["https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/tables"] });
            }, 200);
          }
        }}
        table={editingTable}
        existingOrder={editingOrder}
        mode="edit"
      />

      {/* Order Details Dialog - Now shows list of orders */}
      <Dialog
        open={orderDetailsOpen}
        onOpenChange={(open) => {
          setOrderDetailsOpen(open);
          // Clear customer display when closing order details
          if (!open) {
            setSelectedOrder(null);
            broadcastCartUpdate(null);
          }
        }}
      >
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {t("tables.orderList")} - {selectedTable?.tableNumber}
            </DialogTitle>
            <DialogDescription>
              {selectedTable &&
              activeOrders.filter((o) => o.tableId === selectedTable.id)
                .length > 0
                ? `${activeOrders.filter((o) => o.tableId === selectedTable.id).length}${t("tables.ordersActive")}`
                : t("tables.noActiveOrders")}
            </DialogDescription>
          </DialogHeader>

          {selectedTable && (
            <div className="space-y-4">
              {/* List of orders for this table */}
              {activeOrders
                .filter((order) => order.tableId === selectedTable.id)
                .map((order, index) => {
                  let subtotal = Number(order.subtotal || 0);
                  let displayTax = Math.floor(Number(order.tax || 0));
                  let orderTotal = Math.floor(Number(order.total || 0));
                  let orderDiscount = Math.floor(Number(order.discount || 0));
                  let displaySubtotal = Math.floor(subtotal + orderDiscount);
                  if (order.priceIncludeTax) {
                    displaySubtotal = Math.floor(
                      subtotal + displayTax + orderDiscount,
                    );
                  }

                  return (
                    <Card key={order.id} className="border-2">
                      <CardContent className="p-4">
                        <div className="space-y-3">
                          {/* Order Header */}
                          <div className="flex justify-between items-start">
                            <div>
                              <h4 className="font-bold text-lg text-blue-600">
                                {order.orderNumber}
                              </h4>
                              <p className="text-sm text-gray-600">
                                {new Date(order.orderedAt).toLocaleTimeString(
                                  currentLanguage === "ko"
                                    ? "ko-KR"
                                    : currentLanguage === "en"
                                      ? "en-US"
                                      : "vi-VN",
                                  {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  },
                                )}{" "}
                                - {order.customerCount} {t("orders.people")}
                              </p>
                            </div>
                            <div className="text-right">
                              <Badge
                                variant={
                                  order.status === "paid"
                                    ? "default"
                                    : "secondary"
                                }
                              >
                                {order.status === "paid"
                                  ? t("orders.status.paid")
                                  : t("orders.status.pending")}
                              </Badge>
                            </div>
                          </div>

                          <Separator />

                          {/* Order Summary */}
                          <div className="space-y-1">
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-600">
                                {t("pos.totalAmount")}
                              </span>
                              <span className="font-medium">
                                {displaySubtotal.toLocaleString("vi-VN")} ₫
                              </span>
                            </div>
                            <div className="flex justify-between text-lg">
                              <span className="text-gray-600">
                                {t("common.tax")}:
                              </span>
                              <span className="font-semibold text-orange-600">
                                {formatCurrency(Math.floor(displayTax))}
                              </span>
                            </div>
                            {orderDiscount > 0 && (
                              <div className="flex justify-between text-sm">
                                <span className="text-gray-600">
                                  {t("reports.discount")}:
                                </span>
                                <span className="font-medium text-red-600">
                                  -{orderDiscount.toLocaleString("vi-VN")} ₫
                                </span>
                              </div>
                            )}
                            <div className="flex justify-between text-base font-bold pt-2 border-t">
                              <span>{t("reports.totalMoney")}:</span>
                              <span className="text-blue-600">
                                {(() => {
                                  return Math.floor(orderTotal).toLocaleString(
                                    "vi-VN",
                                  );
                                })()}{" "}
                                ₫
                              </span>
                            </div>
                          </div>

                          {/* Action Buttons */}
                          {order.status !== "paid" && (
                            <div className="space-y-2 pt-2">
                              {/* Order-specific action buttons - All buttons displayed */}
                              <div className="grid grid-cols-3 gap-2">
                                {/* 1. Gọi thêm - Màu xanh dương */}
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setSelectedOrder(order);
                                    setEditingOrder(order);
                                    setEditingTable(selectedTable);
                                    // Keep orderDetailsOpen true - don't close it
                                    setEditOrderOpen(true);
                                  }}
                                  className="text-xs bg-blue-50 border-blue-300 text-blue-700 hover:bg-blue-100 hover:border-blue-400"
                                >
                                  <Plus className="w-3 h-3 mr-1" />
                                  {t("tables.addItems")}
                                </Button>

                                {/* 2. Thanh toán - Màu xanh lá */}
                                <Button
                                  size="sm"
                                  variant="default"
                                  onClick={async () => {
                                    console.log(
                                      "🎯 Payment button clicked for order:",
                                      order.id,
                                      order.orderNumber,
                                    );

                                    try {
                                      // Fetch order items for THIS SPECIFIC order - not any cached data
                                      const response = await apiRequest(
                                        "GET",
                                        `https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/order-items/${order.id}`,
                                      );
                                      const orderItemsData =
                                        await response.json();

                                      console.log(
                                        `📦 Fetched ${orderItemsData.length} items for order ${order.id}`,
                                      );

                                      const processedItems = orderItemsData.map(
                                        (item: any) => ({
                                          id: item.id,
                                          productId: item.productId,
                                          productName:
                                            item.productName ||
                                            getProductName(item.productId),
                                          price: item.unitPrice,
                                          quantity: item.quantity,
                                          discount: item.discount || "0",
                                          total: item.total,
                                          sku:
                                            item.productSku ||
                                            `SP${item.productId}`,
                                          taxRate: (() => {
                                            const product = Array.isArray(
                                              products,
                                            )
                                              ? products.find(
                                                  (p: any) =>
                                                    p.id === item.productId,
                                                )
                                              : null;
                                            return product?.taxRate
                                              ? parseFloat(product.taxRate)
                                              : 0;
                                          })(),
                                        }),
                                      );

                                      // SỬ DỤNG DỮ LIỆU TỪ ORDER HIỆN TẠI - KHÔNG DÙNG orderForPayment hay receipt cũ
                                      const currentOrderData = {
                                        ...order,
                                        transactionId:
                                          order.orderNumber ||
                                          `PREVIEW-${Date.now()}`,
                                        createdAt: new Date().toISOString(),
                                        cashierName: "Table Service",
                                        paymentMethod: "preview",
                                        items: processedItems,
                                        // Dùng giá trị từ order HIỆN TẠI
                                        subtotal: order.subtotal,
                                        tax: order.tax,
                                        total: order.total,
                                        discount: order.discount || "0",
                                        exactTotal: Math.floor(
                                          Number(order.total || 0),
                                        ),
                                        exactSubtotal: Math.floor(
                                          Number(order.subtotal || 0),
                                        ),
                                        exactTax: Math.floor(
                                          Number(order.tax || 0),
                                        ),
                                        exactDiscount: Math.floor(
                                          Number(order.discount || 0),
                                        ),
                                        orderItems: orderItemsData,
                                      };

                                      console.log(
                                        "💰 Prepared payment data for order:",
                                        {
                                          orderId: order.id,
                                          orderNumber: order.orderNumber,
                                          subtotal: currentOrderData.subtotal,
                                          tax: currentOrderData.tax,
                                          discount: currentOrderData.discount,
                                          total: currentOrderData.total,
                                          exactTotal:
                                            currentOrderData.exactTotal,
                                        },
                                      );

                                      // Set orderForPayment với dữ liệu đúng
                                      setPreviewReceipt(currentOrderData);
                                      setOrderDetailsOpen(false);
                                      setShowReceiptPreview(true);
                                    } catch (error) {
                                      console.error(
                                        "❌ Error preparing payment:",
                                        error,
                                      );
                                      toast({
                                        title: "Lỗi",
                                        description:
                                          "Không thể chuẩn bị thanh toán. Vui lòng thử lại.",
                                        variant: "destructive",
                                      });
                                    }
                                  }}
                                  className="text-xs bg-green-600 hover:bg-green-700 text-white"
                                >
                                  <CreditCard className="w-3 h-3 mr-1" />
                                  {t("orders.payment")}
                                </Button>

                                {/* 3. Tách đơn */}
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    console.log(
                                      "🔪 Opening split order modal for order:",
                                      order.id,
                                    );
                                    setSelectedOrder(order);
                                    setSplitOrderOpen(true);
                                  }}
                                  className="text-xs bg-purple-50 border-purple-300 text-purple-700 hover:bg-purple-100 hover:border-purple-400"
                                >
                                  <Plus className="w-3 h-3 mr-1" />
                                  {t("tables.splitOrder")}
                                </Button>

                                {/* 4. In tạm tính */}
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={async () => {
                                    console.log(
                                      "📄 Print bill for order:",
                                      order.id,
                                    );

                                    try {
                                      // Fetch order items for this specific order
                                      const response = await apiRequest(
                                        "GET",
                                        `https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/order-items/${order.id}`,
                                      );
                                      const orderItemsData =
                                        await response.json();

                                      const exactSubtotal = Number(
                                        order.subtotal || 0,
                                      );
                                      const exactTax = Number(order.tax || 0);
                                      const exactDiscount = Number(
                                        order.discount || 0,
                                      );
                                      const exactTotal = Number(
                                        order.total || 0,
                                      );

                                      const processedItems = orderItemsData.map(
                                        (item: any) => ({
                                          id: item.id,
                                          productId: item.productId,
                                          productName:
                                            item.productName ||
                                            getProductName(item.productId),
                                          price: item.unitPrice,
                                          quantity: item.quantity,
                                          total: item.total,
                                          discount: item.discount || "0",
                                          sku:
                                            item.productSku ||
                                            `SP${item.productId}`,
                                          taxRate: (() => {
                                            const product = Array.isArray(
                                              products,
                                            )
                                              ? products.find(
                                                  (p: any) =>
                                                    p.id === item.productId,
                                                )
                                              : null;
                                            return product?.taxRate
                                              ? parseFloat(product.taxRate)
                                              : 10;
                                          })(),
                                        }),
                                      );

                                      const billData = {
                                        ...order,
                                        transactionId:
                                          order.orderNumber ||
                                          `BILL-${order.id}`,
                                        items: processedItems,
                                        subtotal: exactSubtotal.toString(),
                                        tax: exactTax.toString(),
                                        discount: exactDiscount.toString(),
                                        total: exactTotal.toString(),
                                        exactSubtotal: exactSubtotal,
                                        exactTax: exactTax,
                                        exactDiscount: exactDiscount,
                                        exactTotal: exactTotal,
                                        paymentMethod: "unpaid",
                                        amountReceived: "0",
                                        change: "0",
                                        cashierName: "Table Service",
                                        createdAt:
                                          order.orderedAt ||
                                          new Date().toISOString(),
                                        customerName: order.customerName,
                                        tableNumber:
                                          getTableInfo(order.tableId)
                                            ?.tableNumber || "N/A",
                                      };

                                      setSelectedReceipt(billData);
                                      setOrderDetailsOpen(false);
                                      setIsTitle(false);
                                      setShowReceiptModal(true);
                                    } catch (error) {
                                      console.error(
                                        "❌ Error preparing bill:",
                                        error,
                                      );
                                      toast({
                                        title: "Lỗi",
                                        description:
                                          "Không thể tạo hóa đơn. Vui lòng thử lại.",
                                        variant: "destructive",
                                      });
                                    }
                                  }}
                                  className="text-xs bg-orange-50 border-orange-300 text-orange-700 hover:bg-orange-100 hover:border-orange-400"
                                >
                                  <Printer className="w-3 h-3 mr-1" />
                                  {t("tables.printBill")}
                                </Button>

                                {/* 5. TT điểm */}
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setSelectedOrder(order);
                                    setPointsPaymentOpen(true);
                                  }}
                                  className="text-xs bg-yellow-50 border-yellow-300 text-yellow-700 hover:bg-yellow-100 hover:border-yellow-400"
                                >
                                  <Users className="w-3 h-3 mr-1" />
                                  {t("tables.payWithPoints")}
                                </Button>

                                {/* 6. Chuyển bàn */}
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setOrderToTransfer(order);
                                    setShowTransferTableDialog(true);
                                  }}
                                  className="text-xs bg-indigo-50 border-indigo-300 text-indigo-700 hover:bg-indigo-100 hover:border-indigo-400"
                                >
                                  <svg
                                    className="w-3 h-3 mr-1"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
                                    />
                                  </svg>
                                  {t("tables.transferTable")}
                                </Button>

                                {/* 7. Hủy đơn */}
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setOrderToCancel(order);
                                    setShowCancelOrderDialog(true);
                                  }}
                                  className="text-xs bg-red-50 border-red-300 text-red-700 hover:bg-red-100 hover:border-red-400"
                                >
                                  <X className="w-3 h-3 mr-1" />
                                  {t("orders.cancelOrder")}
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}

              {/* No orders message */}
              {activeOrders.filter(
                (order) => order.tableId === selectedTable.id,
              ).length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  {t("tables.noActiveOrders")}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Split Order Modal */}
      <SplitOrderModal
        isOpen={splitOrderOpen}
        onClose={() => setSplitOrderOpen(false)}
        order={selectedOrder}
        orderItems={orderItems || []}
        onSplit={(splitData) => {
          console.log("🔪 Starting split order:", splitData);
          handleSplitOrder(splitData);
        }}
      />

      {/* Receipt Preview Modal - Step 1: "Xem trước hóa đơn" - Exactly like POS */}
      {showReceiptPreview && previewReceipt && (
        <ReceiptModal
          isOpen={showReceiptPreview}
          onClose={() => {
            console.log("🔴 Table: Closing receipt preview modal");
            setShowReceiptPreview(false);
            setPreviewReceipt(null);
          }}
          onConfirm={(itemReceipt: any) => {
            console.log(
              "📄 Table: Receipt preview confirmed, starting payment flow like POS",
            );

            if (!previewReceipt) {
              console.error("❌ No preview receipt data available");
              return;
            }

            // Prepare complete order data for payment flow - exactly like POS
            const completeOrderData = itemReceipt || {
              ...selectedOrder,
              orderItems: previewReceipt.orderItems || orderItems || [],
              items:
                previewReceipt.items ||
                previewReceipt.orderItems ||
                orderItems ||
                [],
              exactSubtotal: previewReceipt.exactSubtotal,
              exactTax: previewReceipt.exactTax,
              exactTotal: previewReceipt.exactTotal,
              exactDiscount: previewReceipt.exactDiscount,
              discount: previewReceipt.discount || selectedOrder?.discount || 0,
            };

            console.log(
              "💾 Table: Setting order for payment with complete data like POS:",
              completeOrderData,
            );
            setOrderForPayment(completeOrderData);

            // Close preview first
            setShowReceiptPreview(false);
            setPreviewReceipt(null);
            setIsTitle(true);
            setShowPaymentMethodModal(true);
          }}
          isPreview={showReceiptPreview}
          receipt={previewReceipt}
          cartItems={
            previewReceipt?.items?.map((item: any) => ({
              id: item.productId || item.id,
              name: item.productName || item.name,
              price: parseFloat(item.price || item.unitPrice || "0"),
              quantity: item.quantity,
              sku: item.sku || `SP${item.productId}`,
              taxRate: (() => {
                const product = Array.isArray(products)
                  ? products.find((p: any) => p.id === item.productId)
                  : null;
                return product?.taxRate ? parseFloat(product.taxRate) : 10;
              })(),
              afterTaxPrice: (() => {
                const product = Array.isArray(products)
                  ? products.find((p: any) => p.id === item.productId)
                  : null;
                return product?.afterTaxPrice || null;
              })(),
            })) || []
          }
          total={
            previewReceipt
              ? previewReceipt.exactTotal || parseFloat(previewReceipt.total)
              : 0
          }
        />
      )}

      {/* Payment Method Modal - Step 2: Chọn phương thức thanh toán */}
      {showPaymentMethodModal && orderForPayment && (
        <PaymentMethodModal
          isOpen={showPaymentMethodModal}
          onClose={() => {
            setShowPaymentMethodModal(false);
            setOrderForPayment(null);
          }}
          onSelectMethod={handlePaymentMethodSelect}
          total={(() => {
            // Use exact total with proper priority and discount consideration
            const baseTotal =
              orderForPayment?.exactTotal !== undefined &&
              orderForPayment.exactTotal !== null
                ? Number(orderForPayment.exactTotal)
                : Number(orderForPayment?.total || 0);

            const discountAmount = Number(
              orderForPayment?.exactDiscount || orderForPayment?.discount || 0,
            );
            const finalTotal = Math.max(0, baseTotal - discountAmount);

            console.log("💰 Payment Modal Total Calculation:", {
              baseTotal,
              discountAmount,
              finalTotal,
              source: "table_grid_payment",
            });

            return Math.floor(finalTotal);
          })()}
          cartItems={(() => {
            // Map order items to cart format for payment modal with full product details
            const itemsToMap =
              orderForPayment?.items || orderForPayment?.orderItems || [];
            console.log("🛒 Mapping items for payment modal:", {
              itemCount: itemsToMap.length,
              hasProducts: Array.isArray(products),
              productCount: products?.length || 0,
            });

            return itemsToMap.map((item: any) => {
              const product = Array.isArray(products)
                ? products.find((p: any) => p.id === item.productId)
                : null;

              const mappedItem = {
                id: item.productId || item.id,
                productId: item.productId,
                name:
                  item.productName ||
                  item.name ||
                  getProductName(item.productId),
                productName:
                  item.productName ||
                  item.name ||
                  getProductName(item.productId),
                price:
                  typeof item.price === "string"
                    ? parseFloat(item.price)
                    : item.price || parseFloat(item.unitPrice || "0"),
                quantity:
                  typeof item.quantity === "string"
                    ? parseInt(item.quantity)
                    : item.quantity || 1,
                unitPrice: item.unitPrice,
                total: item.total,
                sku: item.sku || `SP${item.productId}`,
                taxRate: parseFloat(item.taxRate || product?.taxRate || "0"),
                afterTaxPrice: item.afterTaxPrice || product?.afterTaxPrice,
                discount: item.discount || "0",
                notes: item.notes,
                product: product
                  ? {
                      id: product.id,
                      name: product.name,
                      price: product.price,
                      afterTaxPrice: product.afterTaxPrice,
                      taxRate: product.taxRate,
                    }
                  : null,
              };

              console.log(`📦 Mapped item ${item.productId}:`, {
                name: mappedItem.name,
                price: mappedItem.price,
                quantity: mappedItem.quantity,
                taxRate: mappedItem.taxRate,
                hasProduct: !!product,
              });

              return mappedItem;
            });
          })()}
          orderForPayment={orderForPayment}
          products={products}
          getProductName={getProductName}
          receipt={{
            ...orderForPayment,
            exactTotal: orderForPayment?.exactTotal,
            exactSubtotal: orderForPayment?.exactSubtotal,
            exactTax: orderForPayment?.exactTax,
            exactDiscount: orderForPayment?.exactDiscount,
            discount:
              orderForPayment?.discount ||
              orderForPayment?.exactDiscount?.toString() ||
              "0",
            orderItems:
              orderForPayment?.items || orderForPayment?.orderItems || [],
          }}
          onShowEInvoice={() => {
            setShowPaymentMethodModal(false);
            setShowEInvoiceModal(true);
          }}
        />
      )}

      {/* E-Invoice Modal */}
      {showEInvoiceModal && orderForEInvoice && (
        <EInvoiceModal
          isOpen={showEInvoiceModal}
          onClose={() => {
            setShowEInvoiceModal(false);
            setOrderForEInvoice(null);
          }}
          onConfirm={handleEInvoiceConfirm}
          total={(() => {
            // Use calculated total first, then fallback to stored total
            const calculatedTotal = orderForEInvoice?.calculatedTotal;
            const exactTotal = orderForEInvoice?.exactTotal;
            const storedTotal = orderForEInvoice?.total;

            const finalTotal =
              calculatedTotal || exactTotal || storedTotal || 0;

            console.log("🔍 Table Grid E-Invoice Modal: Total calculation:", {
              calculatedTotal,
              exactTotal,
              storedTotal,
              finalTotal,
              orderForEInvoiceId: orderForEInvoice?.id,
            });

            return Math.floor(finalTotal);
          })()}
          cartItems={
            orderForEInvoice?.orderItems?.map((item: any) => ({
              id: item.productId,
              name: item.productName,
              price: parseFloat(item.unitPrice || "0"),
              quantity: item.quantity,
              sku: item.productSku || `SP${item.productId}`,
              taxRate: (() => {
                const product = Array.isArray(products)
                  ? products.find((p: any) => p.id === item.productId)
                  : null;
                return product?.taxRate ? parseFloat(product.taxRate) : 10;
              })(),
              afterTaxPrice: (() => {
                const product = Array.isArray(products)
                  ? products.find((p: any) => p.id === item.productId)
                  : null;
                return product?.afterTaxPrice || null;
              })(),
            })) || []
          }
          source="table"
          orderId={orderForEInvoice?.id}
        />
      )}

      {/* Receipt Modal - Final receipt after payment - ENHANCED with aggressive refresh */}
      {showReceiptModal && selectedReceipt && (
        <ReceiptModal
          isOpen={showReceiptModal}
          onClose={() => {
            console.log("🔒 Receipt Modal: Closing receipt modal from table");
            setShowReceiptModal(false);
            setSelectedReceipt(null);
          }}
          onConfirm={handleReceiptConfirm}
          receipt={selectedReceipt}
          isPreview={!!orderForPayment} // Show as preview if there's an order waiting for payment
          isTitle={isTitle}
        />
      )}

      {/* Points Payment Dialog */}
      <Dialog open={pointsPaymentOpen} onOpenChange={setPointsPaymentOpen}>
        <DialogContent className="max-w-2md">
          <DialogHeader>
            <DialogTitle>{t("orders.pointsPaymentDialog.title")}</DialogTitle>
            <DialogDescription>
              {t("orders.pointsPaymentDialog.description")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Order Summary */}
            {selectedOrder && (
              <div className="p-4 bg-gray-50 rounded-lg">
                <h4 className="font-medium mb-2">{t("tables.orderInfo")}</h4>
                <div className="flex justify-between text-sm">
                  <span>{t("tables.orderCode")}:</span>
                  <span className="font-medium">
                    {selectedOrder.orderNumber}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>{t("tables.orderAmount")}:</span>
                  <span className="font-medium">
                    {(() => {
                      return Math.floor(
                        Number(selectedOrder.total || "0"),
                      ).toLocaleString("vi-VN");
                    })()}{" "}
                    ₫
                  </span>
                </div>
                {selectedOrder.discount &&
                  Number(selectedOrder.discount) > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-red-600">
                        {t("tables.orderDiscount")}:
                      </span>
                      <span className="font-medium text-red-600">
                        -
                        {Math.floor(
                          Number(selectedOrder.discount),
                        ).toLocaleString("vi-VN")}{" "}
                        ₫
                      </span>
                    </div>
                  )}
                <div className="flex justify-between text-sm font-bold border-t pt-2 mt-2">
                  <span>{t("tables.orderTotal")}:</span>
                  <span className="font-bold text-green-600">
                    {Math.floor(
                      Number(selectedOrder.total || 0),
                    ).toLocaleString("vi-VN")}{" "}
                    ₫
                  </span>
                </div>
              </div>
            )}

            {/* Customer Selection */}
            <div className="space-y-3">
              <Label>{t("orders.pointsPaymentDialog.searchCustomer")}</Label>
              <Input
                placeholder={t("orders.pointsPaymentDialog.searchPlaceholder")}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />

              <div className="max-h-64 overflow-y-auto border rounded-md">
                {filteredCustomers.map((customer: any) => (
                  <div
                    key={customer.id}
                    className={`p-3 cursor-pointer hover:bg-gray-50 border-b ${
                      selectedCustomer?.id === customer.id
                        ? "bg-blue-50 border-blue-200"
                        : ""
                    }`}
                    onClick={() => setSelectedCustomer(customer)}
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-medium">{customer.name}</p>
                        <p className="text-sm text-gray-600">
                          {customer.customerId}
                        </p>
                        {customer.phone && (
                          <p className="text-sm text-gray-600">
                            {customer.phone}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-green-600">
                          {(customer.points || 0).toLocaleString()}P
                        </p>
                        <p className="text-xs text-gray-500">
                          {t("orders.pointsPaymentDialog.accumulatedPoints")}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
                {filteredCustomers.length === 0 && searchTerm && (
                  <div className="p-4 text-center text-gray-500">
                    {t("common.noData")}
                  </div>
                )}
              </div>
            </div>

            {/* Selected Customer Info */}
            {selectedCustomer && selectedOrder && (
              <div className="p-4 bg-green-50 rounded-lg">
                <h4 className="font-medium mb-2">Khách hàng đã chọn</h4>
                <div className="flex justify-between items-center mb-3">
                  <div>
                    <p className="font-medium">{selectedCustomer.name}</p>
                    <p className="text-sm text-gray-600">
                      {selectedCustomer.customerId}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-green-600">
                      {(selectedCustomer.points || 0).toLocaleString()}P
                    </p>
                    <p className="text-xs text-gray-500">
                      ≈{" "}
                      {((selectedCustomer.points || 0) * 1000).toLocaleString()}{" "}
                      ₫
                    </p>
                  </div>
                </div>

                {/* Payment calculation */}
                <div className="pt-2 border-t border-green-200">
                  <div className="flex justify-between text-sm mb-1">
                    <span>Tổng đơn hàng:</span>
                    <span className="font-medium">
                      {Math.floor(
                        Number(selectedOrder.total || 0),
                      ).toLocaleString("vi-VN")}{" "}
                      ₫
                    </span>
                  </div>
                  {(() => {
                    const finalTotal = Math.floor(
                      Number(selectedOrder.total || 0),
                    );
                    const customerPointsValue =
                      (selectedCustomer.points || 0) * 1000;

                    return customerPointsValue >= finalTotal ? (
                      <div className="text-green-600 text-sm">
                        ✓ Đủ điểm để thanh toán toàn bộ
                      </div>
                    ) : (
                      <div className="text-orange-600 text-sm">
                        ⚠ Cần thanh toán thêm:{" "}
                        {(finalTotal - customerPointsValue).toLocaleString(
                          "vi-VN",
                        )}{" "}
                        ₫
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              variant="outline"
              onClick={() => setPointsPaymentOpen(false)}
            >
              {t("orders.cancel")}
            </Button>
            <Button
              onClick={handlePointsPayment}
              disabled={
                !selectedCustomer ||
                (selectedCustomer.points || 0) === 0 ||
                pointsPaymentMutation.isPending
              }
              className="bg-blue-600 hover:bg-blue-700"
            >
              {pointsPaymentMutation.isPending
                ? "Đang xử lý..."
                : selectedCustomer &&
                    selectedOrder &&
                    (selectedCustomer.points || 0) * 1000 >=
                      Number(selectedOrder.total)
                  ? t("orders.pointsPaymentTitle")
                  : t("orders.mixedPaymentButton")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* QR Payment Dialog */}
      <Dialog open={showQRPayment} onOpenChange={setShowQRPayment}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <QrCode className="w-5 h-5" />
              Thanh toán {selectedPaymentMethod?.method?.name}
            </DialogTitle>
            <DialogDescription>
              Quét mã QR để hoàn tất thanh toán
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 p-4">
            {/* Payment Amount Summary */}
            {selectedOrder && (
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600">
                  Đơn hàng: {selectedOrder.orderNumber}
                </p>
                <p className="text-sm text-gray-500 mb-2">
                  Số tiền cần thanh toán:
                </p>
                <p className="text-3xl font-bold text-green-600">
                  {mixedPaymentData
                    ? Math.floor(
                        mixedPaymentData.remainingAmount,
                      ).toLocaleString("vi-VN")
                    : Math.floor(
                        Number(selectedOrder?.total || 0),
                      ).toLocaleString("vi-VN")}{" "}
                </p>
                {mixedPaymentData && (
                  <div className="mt-2 pt-2 border-t border-gray-300">
                    <p className="text-xs text-blue-600">
                      Đã sử dụng {mixedPaymentData.pointsToUse.toLocaleString()}
                      P (-
                      {(
                        mixedPaymentData.pointsToUse * 1000
                      ).toLocaleString()}{" "}
                      ₫)
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* QR Code */}
            {qrCodeUrl && (
              <div className="flex justify-center">
                <div className="bg-white p-4 rounded-lg border-2 border-gray-200 shadow-lg">
                  <img
                    src={qrCodeUrl}
                    alt="QR Code for Payment"
                    className="w-64 h-64"
                  />
                </div>
              </div>
            )}

            <p className="text-sm text-gray-600 text-center">
              Sử dụng ứng dụng {selectedPaymentMethod?.method?.name} để quét mã
              QR và thực hiện thanh toán
            </p>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={handleQRPaymentClose}
                className="flex-1"
              >
                Quay lại
              </Button>
              <Button
                onClick={handleQRPaymentConfirm}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white transition-colors duration-200"
              >
                Xác nhận thanh toán
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Mixed Payment Dialog */}
      <Dialog open={mixedPaymentOpen} onOpenChange={setMixedPaymentOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-orange-600" />
              Thanh toán hỗn hợp
            </DialogTitle>
            <DialogDescription>
              Không đủ điểm, cần thanh toán thêm bằng tiền mặt hoặc chuyển khoản
            </DialogDescription>
          </DialogHeader>

          {mixedPaymentData && (
            <div className="space-y-4">
              {/* Payment Summary */}
              <div className="p-4 bg-gray-50 rounded-lg">
                <h4 className="font-medium mb-2">Tóm tắt thanh toán</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Tổng đơn hàng:</span>
                    <span className="font-medium">
                      {Math.floor(
                        Number(selectedOrder?.total || 0),
                      ).toLocaleString("vi-VN")}{" "}
                      ₫
                    </span>
                  </div>
                  <div className="flex justify-between text-blue-600">
                    <span>Thanh toán bằng điểm:</span>
                    <span className="font-medium">
                      {mixedPaymentData.pointsToUse.toLocaleString()}P
                      <span className="ml-1">
                        (-
                        {(mixedPaymentData.pointsToUse * 1000).toLocaleString(
                          "vi-VN",
                        )}{" "}
                        ₫)
                      </span>
                    </span>
                  </div>
                  <div className="border-t pt-2 flex justify-between font-medium text-orange-600">
                    <span>Cần thanh toán thêm:</span>
                    <span className="font-medium">
                      {Math.floor(
                        mixedPaymentData.remainingAmount,
                      ).toLocaleString("vi-VN")}{" "}
                      ₫
                    </span>
                  </div>
                </div>
              </div>

              {/* Payment Methods */}
              <div className="space-y-3">
                <h4 className="font-medium">
                  Chọn phương thức thanh toán cho phần còn lại:
                </h4>
                <div className="grid grid-cols-1 gap-2">
                  <Button
                    variant="outline"
                    className="justify-start h-auto p-4"
                    onClick={() =>
                      mixedPaymentMutation.mutate({
                        customerId: mixedPaymentData.customerId,
                        points: mixedPaymentData.pointsToUse,
                        orderId: mixedPaymentData.orderId,
                        paymentMethod: "cash",
                      })
                    }
                    disabled={mixedPaymentMutation.isPending}
                  >
                    <span className="text-2xl mr-3">💵</span>
                    <div className="text-left">
                      <p className="font-medium">Tiền mặt</p>
                      <p className="text-sm text-gray-500">
                        {Math.floor(
                          mixedPaymentData.remainingAmount,
                        ).toLocaleString()}{" "}
                        ₫
                      </p>
                    </div>
                  </Button>

                  <Button
                    variant="outline"
                    className="justify-start h-auto p-4"
                    onClick={async () => {
                      // Use CreateQRPos API for transfer payment like QR Code
                      try {
                        setQrLoading(true);
                        const transactionUuid = `TXN-TRANSFER-${Date.now()}`;
                        const depositAmt = Number(
                          mixedPaymentData.remainingAmount,
                        );

                        const qrRequest: CreateQRPosRequest = {
                          transactionUuid,
                          depositAmt: depositAmt,
                          posUniqueId: "ER002",
                          accntNo: "0900993023",
                          posfranchiseeName: "DOOKI-HANOI",
                          posCompanyName: "HYOJUNG",
                          posBillNo: `TRANSFER-${Date.now()}`,
                        };

                        const bankCode = "79616001";
                        const clientID = "91a3a3668724e631e1baf4f8526524f3";

                        console.log(
                          "Calling CreateQRPos API for transfer payment:",
                          { qrRequest, bankCode, clientID },
                        );

                        const qrResponse = await createQRPosAsync(
                          qrRequest,
                          bankCode,
                          clientID,
                        );

                        console.log(
                          "CreateQRPos API response for transfer:",
                          qrResponse,
                        );

                        // Generate QR code from the received QR data and show QR modal
                        if (qrResponse.qrData) {
                          let qrContent = qrResponse.qrData;
                          try {
                            // Try to decode if it's base64 encoded
                            qrContent = atob(qrResponse.qrData);
                          } catch (e) {
                            // If decode fails, use the raw qrData
                            console.log(
                              "Using raw qrData for transfer as it is not base64 encoded",
                            );
                          }

                          const qrUrl = await QRCodeLib.toDataURL(qrContent, {
                            width: 256,
                            margin: 2,
                            color: {
                              dark: "#000000",
                              light: "#FFFFFF",
                            },
                          });

                          // Set QR code data and show QR payment modal
                          setQrCodeUrl(qrUrl);
                          setSelectedPaymentMethod({
                            key: "transfer",
                            method: { name: "Chuyển khoản", icon: "💳" },
                          });
                          setShowQRPayment(true);
                          setMixedPaymentOpen(false);
                        } else {
                          console.error(
                            "No QR data received from API for transfer",
                          );
                          // Fallback to direct payment
                          mixedPaymentMutation.mutate({
                            customerId: mixedPaymentData.customerId,
                            points: mixedPaymentData.pointsToUse,
                            orderId: mixedPaymentData.orderId,
                            paymentMethod: "transfer",
                          });
                        }
                      } catch (error) {
                        console.error(
                          "Error calling CreateQRPos API for transfer:",
                          error,
                        );
                        // Fallback to direct payment on error
                        mixedPaymentMutation.mutate({
                          customerId: mixedPaymentData.customerId,
                          points: mixedPaymentData.pointsToUse,
                          orderId: mixedPaymentData.orderId,
                          paymentMethod: "transfer",
                        });
                      } finally {
                        setQrLoading(false);
                      }
                    }}
                    disabled={mixedPaymentMutation.isPending || qrLoading}
                  >
                    <span className="text-2xl mr-3">💳</span>
                    <div className="text-left">
                      <p className="font-medium">Chuyển khoản</p>
                      <p className="text-sm text-gray-500">
                        {Math.floor(
                          mixedPaymentData.remainingAmount,
                        ).toLocaleString()}{" "}
                        ₫
                      </p>
                    </div>
                  </Button>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setMixedPaymentOpen(false)}
                >
                  {t("orders.cancel")}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Transfer Table Dialog */}
      <Dialog
        open={showTransferTableDialog}
        onOpenChange={setShowTransferTableDialog}
      >
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Chuyển bàn</DialogTitle>
            <DialogDescription>
              Chọn bàn mới để chuyển đơn hàng {orderToTransfer?.orderNumber}
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue={sortedFloors[0]} className="w-full">
            {/* Floor Tabs */}
            <div className="w-full overflow-x-auto mb-4">
              <TabsList className="h-auto min-h-[50px] items-center justify-center gap-1 bg-white border border-gray-200 rounded-lg p-2 shadow-sm flex">
                {sortedFloors.map((floor) => (
                  <TabsTrigger
                    key={floor}
                    value={floor}
                    className="flex items-center gap-2 text-sm px-4 py-3 whitespace-nowrap data-[state=active]:bg-blue-500 data-[state=active]:text-white data-[state=active]:shadow-md hover:bg-blue-50 transition-all duration-200 rounded-md font-medium border border-transparent data-[state=active]:border-blue-600"
                  >
                    <span className="font-semibold">
                      {t("common.floor")} {floor}
                    </span>
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>

            {/* Floor Content */}
            {sortedFloors.map((floor) => (
              <TabsContent key={floor} value={floor} className="mt-0">
                <div className="grid grid-cols-3 gap-4 max-h-96 overflow-y-auto p-4">
                  {Array.isArray(tables) &&
                    tablesByFloor[floor]
                      .filter(
                        (table: Table) =>
                          table.id !== orderToTransfer?.tableId &&
                          table.status === "available",
                      )
                      .map((table: Table) => (
                        <Card
                          key={table.id}
                          className={`cursor-pointer transition-all ${
                            targetTableId === table.id
                              ? "ring-2 ring-blue-500 bg-blue-50"
                              : "hover:bg-gray-50"
                          }`}
                          onClick={() => setTargetTableId(table.id)}
                        >
                          <CardContent className="p-4 text-center">
                            <div className="font-bold text-lg mb-2">
                              {table.tableNumber}
                            </div>
                            <div className="text-sm text-gray-600">
                              <Users className="w-3 h-3 inline mr-1" />
                              {table.capacity} {t("orders.people")}
                            </div>
                            <Badge
                              variant="default"
                              className="mt-2 text-xs bg-green-500"
                            >
                              {t("tables.available")}
                            </Badge>
                          </CardContent>
                        </Card>
                      ))}
                  {tablesByFloor[floor].filter(
                    (table: Table) =>
                      table.id !== orderToTransfer?.tableId &&
                      table.status === "available",
                  ).length === 0 && (
                    <div className="col-span-3 text-center py-8 text-gray-500">
                      Không có bàn trống trên tầng này
                    </div>
                  )}
                </div>
              </TabsContent>
            ))}
          </Tabs>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowTransferTableDialog(false);
                setOrderToTransfer(null);
                setTargetTableId(null);
              }}
            >
              {t("common.cancel")}
            </Button>
            <Button
              onClick={() => {
                if (orderToTransfer && targetTableId) {
                  transferTableMutation.mutate({
                    orderId: orderToTransfer.id,
                    newTableId: targetTableId,
                  });
                }
              }}
              disabled={!targetTableId || transferTableMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {transferTableMutation.isPending
                ? "Đang chuyển..."
                : "Xác nhận chuyển"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Order Confirmation Dialog */}
      <AlertDialog
        open={showCancelOrderDialog}
        onOpenChange={setShowCancelOrderDialog}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("orders.cancelOrder")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("common.areyouremoteorder")}
              {orderToCancel && ` (${orderToCancel.orderNumber})`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setShowCancelOrderDialog(false);
                setOrderToCancel(null);
              }}
            >
              {t("common.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (orderToCancel) {
                  deleteOrderMutation.mutate(orderToCancel.id);
                }
                setShowCancelOrderDialog(false);
                setOrderToCancel(null);
              }}
              className="bg-red-600 hover:bg-red-700"
            >
              {t("orders.cancelOrder")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Order Dialog */}
      <OrderDialog
        open={editOrderOpen}
        onOpenChange={(open) => {
          setEditOrderOpen(open);
          // When dialog closes after editing, refresh all data
          if (!open && editingOrder) {
            console.log(
              "🔄 Edit dialog closed, triggering recalculation for order:",
              editingOrder.id,
            );

            // Clear editing states
            setEditingOrder(null);
            setEditingTable(null);
          }
        }}
        table={editingTable}
        existingOrder={editingOrder}
        mode="edit"
      />
    </>
  );
}
