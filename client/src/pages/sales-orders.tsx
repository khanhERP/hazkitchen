import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { POSHeader } from "@/components/pos/header";
import { RightSidebar } from "@/components/ui/right-sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
  Calendar,
  Search,
  FileText,
  Package,
  Printer,
  Mail,
  X,
  Download,
  CreditCard, // Import CreditCard icon
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { useTranslation } from "@/lib/i18n";
import * as XLSX from "xlsx";
import { EInvoiceModal } from "@/components/pos/einvoice-modal";
import { PrintDialog } from "@/components/pos/print-dialog";
import { ReceiptModal } from "@/components/pos/receipt-modal";
import { PaymentMethodModal } from "@/components/pos/payment-method-modal"; // Import PaymentMethodModal
import { toast } from "@/hooks/use-toast";

interface Invoice {
  id: number;
  invoiceNumber: string;
  tradeNumber: string;
  templateNumber: string;
  symbol: string;
  customerName: string;
  customerTaxCode: string;
  customerAddress: string;
  customerPhone: string;
  customerEmail: string;
  subtotal: string;
  tax: string;
  total: string;
  paymentMethod: number | string; // Allow string for new payment methods
  invoiceDate: string;
  status: string;
  einvoiceStatus: number;
  invoiceStatus: number;
  notes: string;
  createdAt: string;
  updatedAt?: string; // Added updatedAt field
  type?: "invoice" | "order"; // Added to differentiate
  displayNumber?: string;
  displayStatus?: number;
  orderNumber?: string;
  salesChannel?: string;
  tableId?: number;
  orderedAt?: string;
  discount?: string; // Added discount field
  date?: string; // Added missing date field
  employeeId?: number; // Added missing employeeId field
  customerCode?: string; // Added missing customerCode field
  paymentStatus?: string; // Added missing paymentStatus field
  exactDiscount?: string; // Added missing exactDiscount field
  priceIncludeTax?: boolean; // Added priceIncludeTax field
  isPaid?: boolean; // Added isPaid field
}

interface InvoiceItem {
  id: number;
  invoiceId: number;
  productId: number;
  productName: string;
  quantity: number;
  unitPrice: string;
  total: string;
  taxRate: string;
  discount?: string; // Added discount field
  sku?: string; // Added sku field
}

interface Order {
  id: number;
  orderNumber: string;
  tableId?: number;
  employeeId?: number;
  status: string;
  customerName?: string;
  customerCount: number;
  subtotal: string;
  tax: string;
  total: string;
  paymentMethod?: number | string; // Allow string for new payment methods
  paymentStatus: string;
  einvoiceStatus: number;
  notes?: string;
  orderedAt: string;
  createdAt: string;
  salesChannel?: string;
  invoiceNumber?: string;
  invoiceDate?: string;
  customerPhone?: string;
  customerAddress?: string;
  customerTaxCode?: string;
  symbol?: string;
  templateNumber?: string;
  customerEmail?: string;
  invoiceStatus?: number;
  type?: "order";
  date?: string;
  displayNumber?: string;
  displayStatus?: number;
  discount?: string; // Added discount field
  priceIncludeTax?: boolean; // Added priceIncludeTax field
  isPaid?: boolean; // Added isPaid field
}

// Helper function to safely determine item type
const getItemType = (item: any): "invoice" | "order" => {
  if (item?.type) return item.type;
  if (item?.orderNumber) return "order";
  if (item?.invoiceNumber || item?.tradeNumber) return "invoice";
  return "invoice"; // default fallback
};

export default function SalesOrders() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [storeSettings, setStoreSettings] = useState<any>(null); // To store store settings for priceIncludesTax

  // State for PaymentMethodModal
  const [showPaymentMethodModal, setShowPaymentMethodModal] = useState(false);
  const [orderForPayment, setOrderForPayment] = useState<any>(null);
  const [showEInvoiceModal, setShowEInvoiceModal] = useState(false); // State for EInvoiceModal

  // Listen for print completion and einvoice modal close events
  useEffect(() => {
    const handlePrintCompleted = (event: CustomEvent) => {
      console.log(
        "📄 Sales Orders: Print completed, closing all modals and refreshing",
      );

      // Close all modals
      setSelectedInvoice(null);
      setShowPublishDialog(false);
      setShowCancelDialog(false);
      setShowPrintDialog(false);
      setShowEInvoiceModal(false);
      setPrintReceiptData(null);

      // Refresh data
      queryClient.invalidateQueries({ queryKey: ["https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/orders"] });
      queryClient.invalidateQueries({ queryKey: ["https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/tables"] });
    };

    const handleEInvoiceModalClosed = async (event: CustomEvent) => {
      console.log("📧 Sales Orders: E-invoice modal closed, refreshing data");

      // Clear cache completely and force fresh fetch
      queryClient.removeQueries({ queryKey: ["https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/orders"] });
      queryClient.removeQueries({ queryKey: ["https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/order-items"] });
      queryClient.removeQueries({ queryKey: ["https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/invoices"] });

      // Force immediate refetch with fresh data
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/orders"] }),
        queryClient.invalidateQueries({ queryKey: ["https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/order-items"] }),
        queryClient.invalidateQueries({ queryKey: ["https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/invoices"] }),
        queryClient.invalidateQueries({ queryKey: ["https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/tables"] }),
        queryClient.refetchQueries({ queryKey: ["https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/orders"] }),
        queryClient.refetchQueries({ queryKey: ["https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/invoices"] }),
      ]);

      console.log("✅ Sales Orders: Data refreshed successfully from database");
    };

    window.addEventListener(
      "printCompleted",
      handlePrintCompleted as EventListener,
    );
    window.addEventListener(
      "einvoiceModalClosed",
      handleEInvoiceModalClosed as EventListener,
    );

    return () => {
      window.removeEventListener(
        "printCompleted",
        handlePrintCompleted as EventListener,
      );
      window.removeEventListener(
        "einvoiceModalClosed",
        handleEInvoiceModalClosed as EventListener,
      );
    };
  }, [queryClient]);

  // Auto-refresh when new orders are created
  useEffect(() => {
    const handleNewOrder = () => {
      console.log("📱 Sales Orders: New order detected, refreshing data...");
      // Force immediate refresh with all date ranges
      queryClient.invalidateQueries({ queryKey: ["https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/orders"] });
      queryClient.invalidateQueries({ queryKey: ["https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/invoices"] });
      queryClient.invalidateQueries({ queryKey: ["https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/transactions"] });
      queryClient.invalidateQueries({ queryKey: ["https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/orders/date-range"] });
      queryClient.invalidateQueries({ queryKey: ["https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/invoices/date-range"] });
    };

    const handleOrderUpdate = () => {
      console.log("🔄 Sales Orders: Order updated, refreshing data...");
      queryClient.invalidateQueries({ queryKey: ["https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/orders"] });
      queryClient.invalidateQueries({ queryKey: ["https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/invoices"] });
      queryClient.invalidateQueries({ queryKey: ["https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/transactions"] });
      queryClient.invalidateQueries({ queryKey: ["https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/orders/date-range"] });
      queryClient.invalidateQueries({ queryKey: ["https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/invoices/date-range"] });
    };

    const handleRefreshOrders = () => {
      console.log("🔄 Sales Orders: Manual refresh triggered...");
      queryClient.invalidateQueries({ queryKey: ["https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/orders"] });
      queryClient.invalidateQueries({ queryKey: ["https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/invoices"] });
      queryClient.invalidateQueries({ queryKey: ["https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/transactions"] });
      queryClient.invalidateQueries({ queryKey: ["https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/orders/date-range"] });
      queryClient.invalidateQueries({ queryKey: ["https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/invoices/date-range"] });
    };

    // Listen for order creation and update events
    window.addEventListener("newOrderCreated", handleNewOrder);
    window.addEventListener("orderStatusUpdated", handleOrderUpdate);
    window.addEventListener("paymentCompleted", handleOrderUpdate);
    window.addEventListener("refreshOrders", handleRefreshOrders);
    window.addEventListener("invoiceCreated", handleNewOrder);
    window.addEventListener("receiptCreated", handleNewOrder);

    return () => {
      window.removeEventListener("newOrderCreated", handleNewOrder);
      window.removeEventListener("orderStatusUpdated", handleOrderUpdate);
      window.removeEventListener("paymentCompleted", handleOrderUpdate);
      window.removeEventListener("refreshOrders", handleRefreshOrders);
      window.removeEventListener("invoiceCreated", handleNewOrder);
      window.removeEventListener("receiptCreated", handleNewOrder);
    };
  }, [queryClient]);
  // Get URL parameters
  const urlParams = new URLSearchParams(window.location.search);
  const orderParam = urlParams.get("order");

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [orderNumberSearch, setOrderNumberSearch] = useState(orderParam || "");
  const [customerCodeSearch, setCustomerCodeSearch] = useState("");
  const [salesChannelFilter, setSalesChannelFilter] = useState("all");
  const [orderStatusFilter, setOrderStatusFilter] = useState("all");
  const [einvoiceStatusFilter, setEinvoiceStatusFilter] = useState("all");
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null); // Renamed to selectedItem for clarity
  const [isEditing, setIsEditing] = useState(false);
  const [editableInvoice, setEditableInvoice] = useState<Invoice | null>(null); // Renamed to editableItem
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(
    new Set(),
  );
  const [showBulkCancelDialog, setShowBulkCancelDialog] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [showPublishDialog, setShowPublishDialog] = useState(false);
  const [showPrintDialog, setShowPrintDialog] = useState(false);
  const [printReceiptData, setPrintReceiptData] = useState<any>(null);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<any>(null);
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  // Handle column sort
  const handleSort = (field: string) => {
    if (sortField === field) {
      // Toggle sort order if same field
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      // New field, default to ascending
      setSortField(field);
      setSortOrder("asc");
    }
  };

  // Fetch store settings
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await apiRequest("GET", "https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/store-settings");
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        setStoreSettings(data);
      } catch (error) {
        console.error("Error fetching store settings:", error);
      }
    };
    fetchSettings();
  }, []);

  // Query customers for datalist
  const { data: customers = [] } = useQuery({
    queryKey: ["https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/customers"],
    queryFn: async () => {
      try {
        const response = await apiRequest("GET", "https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/customers");
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        return Array.isArray(data) ? data : [];
      } catch (error) {
        console.error("Error fetching customers:", error);
        return [];
      }
    },
    staleTime: 0,
    gcTime: 0,
  });

  // Query orders by date range - load all orders regardless of salesChannel
  const {
    data: orders = [],
    isLoading: ordersLoading,
    error: ordersError,
  } = useQuery({
    queryKey: [
      "https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/orders/date-range",
      startDate,
      endDate,
      currentPage,
      itemsPerPage,
    ],
    queryFn: async () => {
      try {
        let url;
        if (startDate && endDate) {
          // If both dates are provided, use date range endpoint
          url = `https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/orders/date-range/${startDate}/${endDate}?page=${currentPage}&limit=${itemsPerPage}`;
        } else {
          // If no dates provided, fetch all orders
          url = `https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/orders?page=${currentPage}&limit=${itemsPerPage}`;
        }

        const response = await apiRequest("GET", url);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        console.log("Sales Orders - All orders loaded:", {
          url: url,
          total: data?.length || 0,
          tableOrders:
            data?.filter((o: any) => o.salesChannel === "table").length || 0,
          posOrders:
            data?.filter((o: any) => o.salesChannel === "pos").length || 0,
          onlineOrders:
            data?.filter((o: any) => o.salesChannel === "online").length || 0,
          deliveryOrders:
            data?.filter((o: any) => o.salesChannel === "delivery").length || 0,
        });
        return Array.isArray(data) ? data : [];
      } catch (error) {
        console.error("Error fetching orders:", error);
        return [];
      }
    },
    retry: 1,
    retryDelay: 500,
    staleTime: 0, // No cache - always fresh
    gcTime: 0, // Don't keep in memory
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    refetchInterval: false,
  });

  // Query all products to get tax rates
  const { data: products = [] } = useQuery({
    queryKey: ["https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/products"],
    queryFn: async () => {
      try {
        const response = await apiRequest("GET", "https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/products");
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        return Array.isArray(data) ? data : [];
      } catch (error) {
        console.error("Error fetching products:", error);
        return [];
      }
    },
    staleTime: 0,
    gcTime: 0,
  });

  // Query tables to map tableId to table number
  const { data: tables = [] } = useQuery({
    queryKey: ["https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/tables"],
    queryFn: async () => {
      try {
        const response = await apiRequest("GET", "https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/tables");
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        return Array.isArray(data) ? data : [];
      } catch (error) {
        console.error("Error fetching tables:", error);
        return [];
      }
    },
    staleTime: 0,
    gcTime: 0,
  });

  const getTableNumber = (tableId: number): string => {
    const table = tables.find((t: any) => t.id === tableId);
    // Use table.name if available, fallback to table.number or table.tableNumber
    const tableName =
      table?.name || table?.number || table?.tableNumber || tableId;

    // Check if tableName already starts with "Bàn" or "Ban" to avoid duplication
    const tableNameStr = String(tableName);
    if (
      tableNameStr.toLowerCase().startsWith("bàn") ||
      tableNameStr.toLowerCase().startsWith("ban")
    ) {
      return tableNameStr;
    }

    return `Bàn ${tableName}`;
  };

  const isLoading = ordersLoading; // Only orders loading is relevant now
  const hasError = ordersError; // Only orders error is relevant now

  // Query items for selected order
  const {
    data: orderItems = [],
    isLoading: orderItemsLoading,
    error: orderItemsError,
  } = useQuery({
    queryKey: ["https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/order-items", selectedInvoice?.id],
    queryFn: async () => {
      if (!selectedInvoice?.id) {
        console.log("❌ No selected invoice ID");
        return [];
      }

      console.log("📦 Fetching order items for order:", selectedInvoice.id);

      try {
        const response = await apiRequest(
          "GET",
          `https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/order-items/${selectedInvoice.id}`,
        );

        if (!response.ok) {
          const errorText = await response.text();
          console.error("❌ Error response:", response.status, errorText);
          throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        const data = await response.json();
        console.log(
          "✅ Order items loaded successfully:",
          data?.length || 0,
          "items",
        );

        return Array.isArray(data) ? data : [];
      } catch (error) {
        console.error("❌ Error fetching order items:", error);
        throw error; // Re-throw to trigger error state
      }
    },
    enabled: !!selectedInvoice?.id && getItemType(selectedInvoice) === "order",
    retry: 2,
    retryDelay: 1000,
    staleTime: 0,
    gcTime: 0,
  });

  // Mutation for updating an order
  const updateOrderMutation = useMutation({
    mutationFn: async (updatedOrder: Order) => {
      console.log("🔄 Updating order with data:", updatedOrder);

      const updatePayload = {
        customerName: updatedOrder.customerName || "",
        customerPhone: updatedOrder.customerPhone || "",
        customerAddress: updatedOrder.customerAddress || "",
        customerTaxCode: updatedOrder.customerTaxCode || "",
        customerEmail: updatedOrder.customerEmail || "",
        isPaid: updatedOrder.isPaid, // Trạng thái đã trả đồ
        notes: updatedOrder.notes || "",
        status: updatedOrder.status,
        paymentStatus: updatedOrder.paymentStatus,
        subtotal: updatedOrder.subtotal,
        tax: updatedOrder.tax,
        total: updatedOrder.total,
        discount: updatedOrder.discount,
      };

      console.log("📝 Update payload:", updatePayload);

      const response = await apiRequest(
        "PUT",
        `https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/orders/${updatedOrder.id}`,
        updatePayload,
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to update order: ${errorText}`);
      }

      return response.json();
    },
    onSuccess: async (data, updatedOrder) => {
      console.log("✅ Order updated successfully:", data);

      // Clear cache completely
      queryClient.removeQueries({ queryKey: ["https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/orders"] });
      queryClient.removeQueries({
        queryKey: ["https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/order-items", updatedOrder.id],
      });

      // Force fresh fetch from server
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/orders"] }),
        queryClient.invalidateQueries({
          queryKey: ["https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/order-items", updatedOrder.id],
        }),
        queryClient.refetchQueries({ queryKey: ["https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/orders"] }),
        queryClient.refetchQueries({
          queryKey: ["https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/order-items", updatedOrder.id],
        }),
      ]);

      setIsEditing(false);
      setEditableInvoice(null);

      // Update selected order with fresh data from server
      if (selectedInvoice) {
        setSelectedInvoice({ ...selectedInvoice, ...data });
      }

      toast({
        title: "Cập nhật thành công",
        description: "Đơn hàng đã được cập nhật và danh sách đã được làm mới",
      });
    },
    onError: (error) => {
      console.error("Error updating order:", error);
      toast({
        title: "Lỗi cập nhật",
        description: `Không thể cập nhật đơn hàng: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Mutation for bulk canceling orders
  const bulkCancelOrdersMutation = useMutation({
    mutationFn: async (orderIds: string[]) => {
      // Changed to accept orderIds directly
      const results = [];
      for (const orderId of orderIds) {
        try {
          // For orders, update status to 'cancelled'
          const response = await apiRequest(
            "PUT",
            `https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/orders/${orderId}/status`,
            {
              status: "cancelled",
            },
          );

          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to cancel order ${orderId}: ${errorText}`);
          }

          results.push({ orderId, success: true });
        } catch (error) {
          console.error(`Error canceling order ${orderId}:`, error);
          results.push({
            orderId,
            success: false,
            error: (error as Error).message,
          });
        }
      }
      return results;
    },
    onSuccess: (results) => {
      console.log("Bulk cancel results:", results);

      const successCount = results.filter((r) => r.success).length;
      const failCount = results.length - successCount;

      setShowBulkCancelDialog(false);
      setSelectedOrderIds(new Set());

      queryClient.invalidateQueries({ queryKey: ["https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/orders"] });

      // Update selected order if it was cancelled
      if (selectedInvoice) {
        const wasCancelled = results.find(
          (r) => r.orderId === String(selectedInvoice.id) && r.success,
        );
        if (wasCancelled) {
          setSelectedInvoice({
            ...selectedInvoice,
            status: "cancelled",
          });
          setIsEditing(false);
          setEditableInvoice(null);
        }
      }

      if (successCount > 0) {
        alert(
          `Đã hủy thành công ${successCount} đơn hàng${failCount > 0 ? `, ${failCount} đơn thất bại` : ""}`,
        );
      } else {
        alert(`Không thể hủy đơn hàng nào`);
      }
    },
    onError: (error) => {
      console.error("Bulk cancel error:", error);
      setShowBulkCancelDialog(false);
      alert(`Lỗi hủy đơn hàng: ${error.message}`);
    },
  });

  // Mutation for publishing invoice (kept for now, but might be removed if only orders are displayed)
  const publishRequestMutation = useMutation({
    mutationFn: async (invoiceData: any) => {
      const response = await apiRequest(
        "POST",
        "https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/einvoice/publish",
        invoiceData,
      );
      return response.json();
    },
    onSuccess: async (result, variables) => {
      console.log("✅ E-invoice published successfully:", result);

      if (result.success && selectedInvoice) {
        try {
          const invoiceNo =
            result.data?.invoiceNo || result.invoiceNumber || null;
          const symbol = result.data?.symbol || result.symbol || "AA/25E";
          const templateNumber =
            result.data?.templateNumber || result.templateNumber || "1C25TYY";

          const updateData = {
            einvoiceStatus: 1, // Đã phát hành
            invoiceStatus: 1, // Hoàn thành
            status: "published",
            invoiceNumber: invoiceNo,
            symbol: symbol,
            templateNumber: templateNumber,
            tradeNumber:
              invoiceNo || selectedInvoice.orderNumber || `TXN-${Date.now()}`,
            notes: `E-Invoice published - Invoice No: ${invoiceNo || "N/A"}`,
          };

          console.log(`Updating order with data:`, updateData);

          const updateResponse = await apiRequest(
            "PUT",
            `https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/orders/${selectedInvoice.id}`,
            updateData,
          );
          console.log(
            "✅ Order updated successfully after publish:",
            updateResponse,
          );

          const items = orderItems;
          const receiptData = {
            transactionId:
              invoiceNo || selectedInvoice.orderNumber || `TXN-${Date.now()}`,
            orderId: selectedInvoice.id,
            items: items.map((item) => ({
              id: item.id || item.productId,
              productName: item.productName || item.name,
              price: item.unitPrice || item.price || "0",
              quantity: item.quantity || 1,
              total: item.total || "0",
              sku: item.sku || `SKU${item.productId}`,
              taxRate: parseFloat(item.taxRate || "0"),
            })),
            subtotal: selectedInvoice.subtotal || "0",
            tax: selectedInvoice.tax || "0",
            total: selectedInvoice.total || "0",
            paymentMethod: "einvoice",
            amountReceived: selectedInvoice.total || "0",
            change: "0",
            cashierName: "System User",
            createdAt: new Date().toISOString(),
            invoiceNumber: invoiceNo,
            customerName: selectedInvoice.customerName || "Khách hàng",
            customerTaxCode: selectedInvoice.customerTaxCode || null,
          };

          setPrintReceiptData(receiptData);
          setShowPrintDialog(true);

          queryClient.invalidateQueries({ queryKey: ["https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/orders"] });

          setShowPublishDialog(false);
          setSelectedInvoice(null);

          alert(
            `Hóa đơn đã phát hành thành công!\nSố hóa đơn: ${invoiceNo || "N/A"}\n\nMàn hình in hóa đơn sẽ hiển thị.`,
          );
        } catch (updateError) {
          console.error("❌ Error updating order after publish:", {
            error: updateError,
            message: (updateError as Error)?.message,
            stack: (updateError as Error)?.stack,
          });

          const errorMessage =
            (updateError as Error)?.message ||
            (updateError as Error)?.toString() ||
            "Lỗi không xác định";
          alert(
            `Hóa đơn đã phát hành nhưng không thể cập nhật trạng thái: ${errorMessage}`,
          );
        }
      } else {
        alert(`Lỗi phát hành hóa đơn: ${result.message || "Không xác định"}`);
      }
    },
    onError: (error) => {
      console.error("❌ Error publishing invoice:", error);
      alert(`Lỗi phát hành hóa đơn: ${(error as Error).message}`);
    },
  });

  // Mutation for canceling a single order
  const cancelOrderMutation = useMutation({
    mutationFn: async (orderId: number) => {
      // Changed to accept orderId
      const response = await apiRequest(
        "PUT",
        `https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/orders/${orderId}/status`,
        {
          status: "cancelled",
        },
      );

      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}`;
        try {
          const errorData = await response.text();
          errorMessage = errorData || errorMessage;
        } catch (textError) {
          console.error("Could not parse error response:", textError);
        }
        throw new Error(`Không thể hủy đơn hàng: ${errorMessage}`);
      }

      try {
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          return await response.json();
        } else {
          return { success: true, message: "Order cancelled successfully" };
        }
      } catch (jsonError) {
        console.warn(
          "Response is not valid JSON, but request was successful:",
          jsonError,
        );
        return { success: true, message: "Order cancelled successfully" };
      }
    },
    onSuccess: async (data, orderId) => {
      console.log("Order cancelled successfully:", orderId);

      setShowCancelDialog(false);

      // Clear cache completely and force fresh fetch
      queryClient.removeQueries({ queryKey: ["https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/orders"] });
      queryClient.removeQueries({ queryKey: ["https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/orders/date-range"] });

      // Force immediate refetch with fresh data
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/orders"] }),
        queryClient.invalidateQueries({ queryKey: ["https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/orders/date-range"] }),
        queryClient.refetchQueries({ queryKey: ["https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/orders"] }),
        queryClient.refetchQueries({
          queryKey: [
            "https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/orders/date-range",
            startDate,
            endDate,
            currentPage,
            itemsPerPage,
          ],
        }),
      ]);

      // Update selected order if it was cancelled
      if (selectedInvoice && selectedInvoice.id === orderId) {
        setSelectedInvoice({
          ...selectedInvoice,
          status: "cancelled",
        });

        setIsEditing(false);
        setEditableInvoice(null);
      }

      console.log("✅ Order cancelled and list refreshed from database");

      toast({
        title: "Đã hủy đơn hàng",
        description: "Đơn hàng đã được hủy và danh sách đã được cập nhật",
      });
    },
    onError: (error) => {
      console.error("Error canceling order:", error);
      setShowCancelDialog(false);
      toast({
        title: "Lỗi hủy đơn hàng",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const getPaymentMethodName = (method: number | string | null) => {
    // Handle null/undefined cases explicitly
    if (method === null || method === undefined) {
      return "Chưa thanh toán";
    }

    switch (method) {
      case 1:
      case "cash":
        return "Tiền mặt";
      case 2:
      case "creditCard":
      case "debitCard":
        return "Chuyển khoản";
      case 3:
      case "qrCode":
      case "momo":
      case "zalopay":
      case "vnpay":
      case "grabpay":
        return "QR Code InfoCAMS";
      case "Đối trừ công nợ":
        return "Đối trừ công nợ";
      case "unpaid":
        return "Chưa thanh toán";
      default:
        return "Chưa thanh toán"; // Changed default from "Tiền mặt" to "Chưa thanh toán"
    }
  };

  const getStatusBadge = (status: string) => {
    const statusColors = {
      draft: "bg-gray-100 text-gray-800",
      published: "bg-green-100 text-green-800",
      cancelled: "bg-red-100 text-red-800",
      pending: "bg-yellow-100 text-yellow-800", // Added pending status
      paid: "bg-green-100 text-green-800", // Added paid status
    };

    const statusLabels = {
      draft: "Nháp",
      published: "Đã xuất",
      cancelled: "Đã hủy",
      pending: "Chờ xử lý",
      paid: "Đã thanh toán",
    };

    return (
      <Badge
        className={
          statusColors[status as keyof typeof statusColors] ||
          statusColors.draft
        }
      >
        {statusLabels[status as keyof typeof statusLabels] || status}
      </Badge>
    );
  };

  const getEInvoiceStatusBadge = (status: number) => {
    const statusLabels = {
      0: t("common.einvoiceStatus.notPublished"),
      1: t("common.einvoiceStatus.published"),
      2: t("common.einvoiceStatus.draft"),
      3: t("common.einvoiceStatus.approved"),
      4: t("common.einvoiceStatus.replaced"),
      5: t("common.einvoiceStatus.tempReplaced"),
      6: t("common.einvoiceStatus.replacement"),
      7: t("common.einvoiceStatus.adjusted"),
      8: t("common.einvoiceStatus.tempAdjusted"),
      9: t("common.einvoiceStatus.adjustment"),
      10: t("common.einvoiceStatus.cancelled"),
    };

    const statusColors = {
      0: "bg-gray-100 text-gray-800",
      1: "bg-green-100 text-green-800",
      2: "bg-blue-100 text-blue-800",
      3: "bg-green-100 text-green-800",
      4: "bg-red-100 text-red-800",
      5: "bg-yellow-100 text-yellow-800",
      6: "bg-green-100 text-green-800",
      7: "bg-orange-100 text-orange-800",
      8: "bg-yellow-100 text-yellow-800",
      9: "bg-orange-100 text-orange-800",
      10: "bg-red-100 text-red-800",
    };

    return (
      <Badge
        className={
          statusColors[status as keyof typeof statusColors] || statusColors[0]
        }
      >
        {statusLabels[status as keyof typeof statusColors] ||
          t("common.einvoiceStatus.notPublished")}
      </Badge>
    );
  };

  const getInvoiceStatusBadge = (status: number, order?: Order) => {
    const statusLabels = {
      1: t("common.completed"),
      2: t("common.serving"),
      3: t("common.cancelled"),
    };

    const statusColors = {
      1: "bg-green-100 text-green-800",
      2: "bg-blue-100 text-blue-800",
      3: "bg-red-100 text-red-800",
    };

    // Special handling for pending unpaid orders - only show for laundry business
    if (
      storeSettings?.businessType === "laundry" &&
      order &&
      order.status === "pending" &&
      order.paymentStatus === "pending"
    ) {
      return (
        <Badge className="bg-yellow-100 text-yellow-800">
          {t("orders.status.ordered")}
        </Badge>
      );
    }

    return (
      <Badge
        className={
          statusColors[status as keyof typeof statusColors] || statusColors[1]
        }
      >
        {statusLabels[status as keyof typeof statusLabels] ||
          t("common.completed")}
      </Badge>
    );
  };

  // Map orders to a consistent structure similar to Invoice for easier handling
  const combinedData: Invoice[] = Array.isArray(orders)
    ? orders.map((order: Order) => ({
        ...order,
        type: "order" as const,
        date: order.createdAt,
        displayNumber:
          order.orderNumber || `ORD-${String(order.id).padStart(13, "0")}`,
        // Map order status to invoiceStatus convention
        displayStatus:
          order.status === "paid"
            ? 1
            : order.status === "pending" && order.paymentStatus === "pending"
              ? 2 // Chờ xử lý (pending unpaid)
              : order.status === "pending"
                ? 2 // Đang phục vụ
                : order.status === "cancelled"
                  ? 3
                  : 2,
        customerName: order.customerName || "Khách hàng l ",
        invoiceStatus:
          order.status === "paid"
            ? 1
            : order.status === "pending" && order.paymentStatus === "pending"
              ? 2 // Chờ xử lý (pending unpaid)
              : order.status === "pending"
                ? 2 // Đang phục vụ
                : order.status === "cancelled"
                  ? 3
                  : 2,
        customerPhone: order.customerPhone || "",
        customerAddress: order.customerAddress || "",
        customerTaxCode: order.customerTaxCode || "",
        symbol: order.symbol || order.templateNumber || "",
        invoiceNumber:
          order.orderNumber || `ORD-${String(order.id).padStart(8, "0")}`,
        tradeNumber: order.orderNumber || "",
        invoiceDate: order.createdAt,
        einvoiceStatus: order.einvoiceStatus || 0,
        // Ensure all fields from Invoice interface are present, even if null/empty
        templateNumber: order.templateNumber || "",
        customerEmail: order.customerEmail || "",
        subtotal: order.subtotal || "0",
        tax: order.tax || "0",
        total: order.total || "0",
        paymentMethod: order.paymentMethod || "cash",
        notes: order.notes || "",
        createdAt: order.createdAt, // Use orderedAt as primary, fallback to createdAt
        updatedAt: order.updatedAt, // Keep updatedAt for cancellation/completion time
        discount: order.discount || "0", // Map discount field
        priceIncludeTax: order.priceIncludeTax || false, // Map priceIncludeTax field
      }))
    : [];

  const filteredInvoices = Array.isArray(combinedData)
    ? combinedData
        .filter((item: any) => {
          try {
            if (!item) return false;

            const customerMatch =
              !customerSearch ||
              (item.customerName &&
                item.customerName
                  .toLowerCase()
                  .includes(customerSearch.toLowerCase())) ||
              (item.customerPhone &&
                item.customerPhone
                  .toLowerCase()
                  .includes(customerSearch.toLowerCase()));
            const orderMatch =
              !orderNumberSearch ||
              (item.displayNumber &&
                item.displayNumber
                  .toLowerCase()
                  .includes(orderNumberSearch.toLowerCase()));
            // Product/item search - check if any order item matches the search
            const productMatch =
              !customerCodeSearch ||
              (async () => {
                // This will be replaced with actual orderItems check
                return true;
              })();

            // Sales channel filter
            const salesChannelMatch =
              salesChannelFilter === "all" ||
              item.salesChannel === salesChannelFilter;

            // Order status filter
            const orderStatusMatch =
              orderStatusFilter === "all" ||
              (orderStatusFilter === "paid" &&
                (item.status === "paid" || item.displayStatus === 1)) ||
              (orderStatusFilter === "pending" &&
                (item.status === "pending" || item.displayStatus === 2)) ||
              (orderStatusFilter === "cancelled" &&
                (item.status === "cancelled" || item.displayStatus === 3));

            // E-invoice status filter
            const einvoiceStatusMatch =
              einvoiceStatusFilter === "all" ||
              (einvoiceStatusFilter === "0" && item.einvoiceStatus === 0) ||
              (einvoiceStatusFilter === "1" && item.einvoiceStatus === 1) ||
              (einvoiceStatusFilter === "2" && item.einvoiceStatus === 2) ||
              (einvoiceStatusFilter === "3" && item.einvoiceStatus === 3) ||
              (einvoiceStatusFilter === "10" && item.einvoiceStatus === 10);

            return (
              customerMatch &&
              orderMatch &&
              productMatch &&
              salesChannelMatch &&
              orderStatusMatch &&
              einvoiceStatusMatch
            );
          } catch (error) {
            console.error("Error filtering item:", item, error);
            return false;
          }
        })
        .sort((a: any, b: any) => {
          // Apply custom sorting if a field is selected
          if (sortField) {
            let aValue: any;
            let bValue: any;

            switch (sortField) {
              case "orderNumber":
                aValue = a.displayNumber || "";
                bValue = b.displayNumber || "";
                break;
              case "createdAt":
                aValue = new Date(a.createdAt || 0).getTime();
                bValue = new Date(b.createdAt || 0).getTime();
                break;
              case "updatedAt":
                aValue = new Date(a.updatedAt || 0).getTime();
                bValue = new Date(b.updatedAt || 0).getTime();
                break;
              case "salesChannel":
                aValue = a.salesChannel || "";
                bValue = b.salesChannel || "";
                break;
              case "customerCode":
                aValue = a.customerCode || a.customerTaxCode || "";
                bValue = b.customerCode || b.customerTaxCode || "";
                break;
              case "customerName":
                aValue = a.customerName || "";
                bValue = b.customerName || "";
                break;
              case "subtotal":
                aValue = parseFloat(a.subtotal || "0");
                bValue = parseFloat(b.subtotal || "0");
                break;
              case "discount":
                aValue = parseFloat(a.discount || "0");
                bValue = parseFloat(b.discount || "0");
                break;
              case "tax":
                aValue = parseFloat(a.tax || "0");
                bValue = parseFloat(b.tax || "0");
                break;
              case "total":
                aValue = parseFloat(a.total || "0");
                bValue = parseFloat(b.total || "0");
                break;
              case "employeeCode":
                aValue = a.employeeId || 0;
                bValue = b.employeeId || 0;
                break;
              case "employeeName":
                aValue = "";
                bValue = "";
                break;
              case "symbol":
                aValue = a.symbol || a.templateNumber || "";
                bValue = b.symbol || b.templateNumber || "";
                break;
              case "invoiceNumber":
                aValue = a.invoiceNumber || "";
                bValue = b.invoiceNumber || "";
                break;
              case "notes":
                aValue = a.notes || "";
                bValue = b.notes || "";
                break;
              case "status":
                aValue = a.displayStatus || 0;
                bValue = b.displayStatus || 0;
                break;
              default:
                aValue = "";
                bValue = "";
            }

            // Compare values
            if (typeof aValue === "string" && typeof bValue === "string") {
              const comparison = aValue.localeCompare(bValue, "vi");
              return sortOrder === "asc" ? comparison : -comparison;
            } else {
              const comparison = aValue - bValue;
              return sortOrder === "asc" ? comparison : -comparison;
            }
          }

          // Default sort by date (newest first)
          const dateA = new Date(a.createdAt);
          const dateB = new Date(b.createdAt);

          if (isNaN(dateA.getTime()) && isNaN(dateB.getTime())) return 0;
          if (isNaN(dateA.getTime())) return 1;
          if (isNaN(dateB.getTime())) return -1;

          return dateB.getTime() - dateA.getTime();
        })
    : [];

  // Handle URL parameter for order filtering and auto-expand
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const orderParam = urlParams.get("order");

    if (orderParam) {
      console.log("🔍 Sales Orders: Auto-filtering by order:", orderParam);
      setOrderNumberSearch(orderParam);
    }
  }, []);

  // Auto-expand matching order when data is available and order param exists
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const orderParam = urlParams.get("order");

    if (orderParam && filteredInvoices.length > 0) {
      const matchingOrder = filteredInvoices.find((item) => {
        const displayNumber = item.displayNumber?.toLowerCase() || "";
        const orderNumber = item.orderNumber?.toLowerCase() || "";
        const invoiceNumber = item.invoiceNumber?.toLowerCase() || "";
        const searchParam = orderParam.toLowerCase();

        return (
          displayNumber.includes(searchParam) ||
          orderNumber.includes(searchParam) ||
          invoiceNumber.includes(searchParam) ||
          displayNumber === searchParam ||
          orderNumber === searchParam ||
          invoiceNumber === searchParam
        );
      });

      if (
        matchingOrder &&
        (!selectedInvoice || selectedInvoice.id !== matchingOrder.id)
      ) {
        console.log(
          "🎯 Sales Orders: Auto-expanding matching order:",
          matchingOrder.displayNumber,
        );
        setSelectedInvoice(matchingOrder);

        // Clear URL parameter after auto-expand
        setTimeout(() => {
          const newUrl = window.location.pathname;
          window.history.replaceState({}, "", newUrl);
        }, 500);
      }
    }
  }, [filteredInvoices]);

  const formatCurrency = (
    amount: string | number | undefined | null,
  ): string => {
    const num = typeof amount === "string" ? parseFloat(amount) : amount;
    if (typeof num !== "number" || isNaN(num)) {
      return "0";
    }
    return Math.floor(num).toLocaleString("vi-VN");
  };

  const formatDate = (dateStr: string | undefined | null): string => {
    if (!dateStr) return "";
    try {
      // Parse as UTC date and convert to Vietnam timezone (UTC+7)
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return "";

      // Convert to Vietnam timezone using toLocaleString
      const vietnamTime = date.toLocaleString("vi-VN", {
        timeZone: "Asia/Ho_Chi_Minh",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      });

      // Format: dd/MM/yyyy HH:mm:ss
      return vietnamTime.replace(
        /(\d{2})\/(\d{2})\/(\d{4}),?\s*(\d{2}):(\d{2}):(\d{2})/,
        "$1/$2/$3 $4:$5:$6",
      );
    } catch (error) {
      console.error("Error formatting date:", dateStr, error);
      return "";
    }
  };

  const handleEditOrder = (order: Order) => {
    setEditableInvoice({ ...order });
    setIsEditing(true);
    // Fetch order items to populate editable state
    // The orderItems data is already fetched by useQuery, so we just need to use it.
  };

  // Function to add a new order item row (only in UI, not saved to database yet)
  const handleAddNewOrderItem = () => {
    if (!selectedInvoice || !selectedInvoice.id) {
      toast({
        title: "Lỗi",
        description: "Vui lòng chọn đơn hàng trước khi thêm dòng mới",
        variant: "destructive",
      });
      return;
    }

    console.log("➕ Adding new empty row for order:", selectedInvoice.id);

    // Generate a temporary negative ID for the new row (to distinguish from real database items)
    const tempId = -Date.now();

    // New item will have 0 values initially
    // When user enters product info, all values will be recalculated in updateOrderItemField
    const newItemDiscount = "0";
    const newItemTax = "0";
    const newItemPriceBeforeTax = "0";

    // Create an empty row item
    const newEmptyItem = {
      id: tempId,
      orderId: selectedInvoice.id,
      productId: 0,
      productName: "",
      sku: "",
      quantity: 1,
      unitPrice: "0",
      total: "0",
      discount: newItemDiscount,
      tax: newItemTax,
      priceBeforeTax: newItemPriceBeforeTax,
      _isNew: true, // Flag to identify new unsaved items
    };

    // Add the new empty item to editedOrderItems state
    setEditedOrderItems((prev) => ({
      ...prev,
      [tempId]: {
        productId: 0,
        productName: "",
        sku: "",
        quantity: 1,
        unitPrice: "0",
        total: "0",
        discount: newItemDiscount,
        tax: newItemTax,
        priceBeforeTax: newItemPriceBeforeTax,
        _isNew: true,
      },
    }));

    // Add to the orderItems query data temporarily for display
    queryClient.setQueryData(
      ["https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/order-items", selectedInvoice.id],
      (oldData: any) => {
        const currentItems = Array.isArray(oldData) ? oldData : [];
        return [...currentItems, newEmptyItem];
      },
    );

    toast({
      title: "Đã thêm dòng mới",
      description: "Vui lòng nhập thông tin sản phẩm và ấn Lưu",
    });

    // Focus on SKU field of new row after a short delay
    setTimeout(() => {
      const visibleItems = orderItems.filter(
        (item: any) => !editedOrderItems[item.id]?._deleted,
      );
      const newRowIndex = visibleItems.length;
      const skuInput = document.querySelector(
        `[data-field="orderitem-sku-${newRowIndex}"]`,
      ) as HTMLInputElement;
      skuInput?.focus();
    }, 100);
  };

  const handleSaveOrder = async () => {
    if (!editableInvoice) return;

    try {
      console.log("💾 Starting save order process:", {
        orderId: editableInvoice.id,
        editedItemsCount: Object.keys(editedOrderItems).length,
        editedItems: editedOrderItems,
      });

      // Step 1: Separate new items from existing items
      const itemsToCreate: any[] = [];
      const itemsToUpdate: any[] = [];
      const itemsToDelete: any[] = [];

      // Use for...of loop to support continue/break statements
      for (const [itemId, changes] of Object.entries(editedOrderItems)) {
        const id = parseInt(itemId);

        if (changes._deleted) {
          // Only delete if it's an existing item (positive ID)
          if (id > 0) {
            itemsToDelete.push({ id, ...changes });
          }
          continue; // Skip to next item
        }

        if (changes._isNew || id < 0) {
          // ✨ NEW ITEM - Will be INSERTED into database
          console.log(`➕ Processing NEW item for INSERT (ID: ${id})`);

          // Get data from cache (may be incomplete for new items)
          const fullItemData = orderItems.find((item: any) => item.id === id);

          // Merge all available data - prioritize changes from editedOrderItems
          const completeItemData = {
            ...(fullItemData || {}),
            ...changes,
            // Ensure required fields are set
            productId: changes.productId || fullItemData?.productId || 0,
            productName: changes.productName || fullItemData?.productName || "",
            sku:
              changes.sku ||
              fullItemData?.sku ||
              fullItemData?.productSku ||
              "",
            quantity:
              changes.quantity !== undefined
                ? changes.quantity
                : fullItemData?.quantity || 1,
            unitPrice:
              changes.unitPrice !== undefined
                ? changes.unitPrice
                : fullItemData?.unitPrice || "0",
            total: changes.total || fullItemData?.total || "0",
            discount:
              changes.discount !== undefined
                ? changes.discount
                : fullItemData?.discount || "0",
            tax:
              changes.tax !== undefined
                ? changes.tax
                : fullItemData?.tax || "0",
            priceBeforeTax:
              changes.priceBeforeTax || fullItemData?.priceBeforeTax || "0",
          };

          // Validate required fields before INSERT
          if (!completeItemData.productId || completeItemData.productId <= 0) {
            console.warn(`⚠️ Skipping new item ${id} - missing productId`);
            continue;
          }

          if (!completeItemData.productName) {
            console.warn(`⚠️ Skipping new item ${id} - missing productName`);
            continue;
          }

          console.log(
            `✅ Will INSERT new item: ${completeItemData.productName} (Product ID: ${completeItemData.productId})`,
          );
          itemsToCreate.push(completeItemData);
        } else {
          // 🔄 EXISTING ITEM - Will be UPDATED in database
          console.log(`🔄 Processing EXISTING item for UPDATE (ID: ${id})`);
          itemsToUpdate.push({ id, ...changes });
        }
      }

      console.log("📝 Items to create:", itemsToCreate.length);
      console.log("📝 Items to update:", itemsToUpdate.length);
      console.log("📝 Items to delete:", itemsToDelete.length);

      // Step 2: Delete marked items
      for (const item of itemsToDelete) {
        console.log(`🗑️ Deleting order item ${item.id}`);
        const response = await apiRequest(
          "DELETE",
          `https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/order-items/${item.id}`,
        );
        if (!response.ok) {
          throw new Error(`Failed to delete order item ${item.id}`);
        }
      }

      // Step 3: INSERT new items into database
      for (const item of itemsToCreate) {
        console.log(`📝 [INSERT] Creating new order item in database:`, {
          productId: item.productId,
          productName: item.productName,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        });

        // Double-check validation before INSERT
        if (!item.productId || item.productId <= 0) {
          console.error(`❌ [INSERT FAILED] Missing valid productId:`, item);
          continue;
        }

        if (!item.productName) {
          console.error(`❌ [INSERT FAILED] Missing productName:`, item);
          continue;
        }

        const product = products.find((p: any) => p.id === item.productId);
        const taxRate = product?.taxRate
          ? parseFloat(product.taxRate) / 100
          : 0;
        const unitPrice = parseFloat(item.unitPrice || "0");
        const quantity = parseInt(item.quantity || "1");

        console.log(`📊 Item calculation data:`, {
          productId: item.productId,
          productName: item.productName,
          unitPrice,
          quantity,
          taxRate: taxRate * 100 + "%",
        });

        // Calculate totals based on discount allocation
        const orderDiscount = parseFloat(editableInvoice.discount || "0");
        let itemDiscountAmount = parseFloat(item.discount || "0");

        let itemSubtotal = unitPrice * quantity;
        let itemTax = 0;
        let priceBeforeTax = 0;

        const priceIncludeTax =
          editableInvoice.priceIncludeTax ??
          storeSettings?.priceIncludesTax ??
          false;

        if (priceIncludeTax && taxRate > 0) {
          const discountPerUnit = itemDiscountAmount / quantity;
          const adjustedPrice = Math.max(0, unitPrice - discountPerUnit);
          const giaGomThue = adjustedPrice * quantity;
          priceBeforeTax = Math.round(giaGomThue / (1 + taxRate));
          itemTax = giaGomThue - priceBeforeTax;
        } else {
          priceBeforeTax = Math.round(itemSubtotal - itemDiscountAmount);
          itemTax = Math.round(priceBeforeTax * taxRate);
        }

        const totalAmount = priceBeforeTax + itemTax;

        const payload = {
          productId: item.productId,
          productName: item.productName,
          sku: item.sku || product?.sku || `SKU${item.productId}`,
          quantity: quantity,
          unitPrice: unitPrice.toFixed(2),
          total: totalAmount.toFixed(2),
          discount: itemDiscountAmount.toFixed(2),
          tax: Math.round(itemTax).toFixed(2),
          priceBeforeTax: Math.round(priceBeforeTax).toFixed(2),
          notes: item.notes || null,
        };

        console.log(`📝 Creating order item with payload:`, payload);

        const response = await apiRequest(
          "POST",
          `https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/order-items/${editableInvoice.id}`,
          payload,
        );

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`❌ Failed to create order item:`, errorText);
          throw new Error(`Failed to create order item: ${errorText}`);
        }

        const createdItem = await response.json();
        console.log(`✅ New order item created successfully:`, createdItem);
      }

      // Step 4: UPDATE existing items in database
      for (const item of itemsToUpdate) {
        console.log(
          `📝 [UPDATE] Updating existing order item ID ${item.id} in database`,
        );
        const originalItem = orderItems.find((oi) => oi.id === item.id);

        // Build complete payload with all calculated fields
        const payload: any = {
          quantity:
            item.quantity !== undefined
              ? item.quantity
              : originalItem?.quantity,
          unitPrice:
            item.unitPrice !== undefined
              ? item.unitPrice
              : originalItem?.unitPrice,
          total: item.total !== undefined ? item.total : originalItem?.total,
          discount:
            item.discount !== undefined
              ? item.discount
              : originalItem?.discount || "0.00",
          tax: item.tax !== undefined ? item.tax : originalItem?.tax || "0.00",
          priceBeforeTax:
            item.priceBeforeTax !== undefined
              ? item.priceBeforeTax
              : originalItem?.priceBeforeTax || "0.00",
        };

        // Include optional fields if provided
        if (item.notes !== undefined) payload.notes = item.notes;
        if (item.productId !== undefined) payload.productId = item.productId;
        if (item.sku !== undefined) payload.sku = item.sku;
        if (item.productName !== undefined)
          payload.productName = item.productName;

        // Get values for calculation (use edited values if available, otherwise original)
        const product = products.find(
          (p: any) =>
            p.id ===
            (item.productId ||
              originalItem?.productId ||
              (item.sku
                ? products.find((prod) => prod.sku === item.sku)?.id
                : null)),
        );

        const taxRate = product?.taxRate
          ? parseFloat(product.taxRate) / 100
          : 0;

        const unitPrice =
          item.unitPrice !== undefined
            ? parseFloat(item.unitPrice)
            : parseFloat(originalItem?.unitPrice || "0");

        const quantity =
          item.quantity !== undefined
            ? parseInt(item.quantity)
            : parseInt(originalItem?.quantity || "0");

        // Calculate totals
        let itemSubtotal = unitPrice * quantity;
        let itemTax = 0;
        let priceBeforeTax = 0;

        const priceIncludeTax =
          editableInvoice.priceIncludeTax ??
          storeSettings?.priceIncludesTax ??
          false;

        if (priceIncludeTax && taxRate > 0) {
          const giaGomThue = itemSubtotal;
          priceBeforeTax = Math.round(giaGomThue / (1 + taxRate));
          itemTax = itemSubtotal - priceBeforeTax;
        } else {
          priceBeforeTax = Math.round(itemSubtotal);
          itemTax = Math.round(priceBeforeTax * taxRate);
        }

        const totalAmount = priceBeforeTax + itemTax;

        // Always set calculated values
        payload.total = totalAmount.toString();
        payload.tax = Math.round(itemTax).toString();
        payload.priceBeforeTax = Math.round(priceBeforeTax).toString();

        console.log(`📝 Updating order item ${item.id}:`, payload);

        // Update the item
        const response = await apiRequest(
          "PATCH",
          `https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/order-items/${item.id}`,
          payload,
        );

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(
            `Failed to update order item ${item.id}: ${errorText}`,
          );
        }
      }

      // Step 5: Recalculate order totals from fresh data
      const allCurrentItemsResponse = await apiRequest(
        "GET",
        `https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/order-items/${editableInvoice.id}`,
      );
      const allCurrentItems = await allCurrentItemsResponse.json();

      console.log(
        "📊 Recalculating order totals from",
        allCurrentItems.length,
        "items",
      );

      const priceIncludeTax =
        editableInvoice.priceIncludeTax ??
        storeSettings?.priceIncludesTax ??
        false;
      const orderDiscount = parseFloat(editableInvoice.discount || "0");

      let exactSubtotal = 0;
      let exactTax = 0;

      allCurrentItems.forEach((item: any) => {
        const product = products.find((p: any) => p.id === item.productId);
        const taxRate = product?.taxRate
          ? parseFloat(product.taxRate) / 100
          : 0;
        const unitPrice = parseFloat(item.unitPrice || "0");
        const quantity = parseInt(item.quantity || "0");
        const itemSubtotal = unitPrice * quantity;

        if (priceIncludeTax && taxRate > 0) {
          const priceBeforeTax = itemSubtotal / (1 + taxRate);
          const itemTax = itemSubtotal - priceBeforeTax;
          exactSubtotal += priceBeforeTax;
          exactTax += itemTax;
        } else {
          exactSubtotal += itemSubtotal;
          exactTax += itemSubtotal * taxRate;
        }
      });

      const exactTotal = exactSubtotal + exactTax - orderDiscount;

      // Step 6: Update order with new totals and all editable fields
      const orderData: Partial<Order> = {
        id: editableInvoice.id,
        customerName: editableInvoice.customerName,
        customerPhone: editableInvoice.customerPhone,
        customerAddress: editableInvoice.customerAddress,
        customerTaxCode: editableInvoice.customerTaxCode,
        customerEmail: editableInvoice.customerEmail,
        isPaid: editableInvoice.isPaid,
        notes: editableInvoice.notes,
        status: editableInvoice.status,
        paymentStatus: editableInvoice.paymentStatus,
        subtotal: Math.floor(exactSubtotal).toString(),
        tax: Math.floor(exactTax).toString(),
        total: Math.floor(exactTotal).toString(),
        discount: orderDiscount.toString(),
        priceIncludeTax: editableInvoice.priceIncludeTax,
      };

      console.log("💾 Saving order with recalculated totals:", orderData);

      // Clear local edits after successful preparation
      setEditedOrderItems({});

      // Validate order data before mutation
      if (!orderData || !orderData.id) {
        throw new Error("Dữ liệu đơn hàng không hợp lệ");
      }

      // Use the mutation to update the main order
      await updateOrderMutation.mutateAsync(orderData as Order);

      // Clear and refresh all related queries
      queryClient.removeQueries({ queryKey: ["https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/orders"] });
      queryClient.removeQueries({ queryKey: ["https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/order-items"] });
      queryClient.removeQueries({
        queryKey: ["https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/orders/date-range"],
      });

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/orders"] }),
        queryClient.invalidateQueries({
          queryKey: ["https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/order-items", editableInvoice.id],
        }),
        queryClient.invalidateQueries({
          queryKey: ["https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/orders/date-range"],
        }),
        queryClient.refetchQueries({ queryKey: ["https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/orders"] }),
        queryClient.refetchQueries({
          queryKey: ["https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/order-items", editableInvoice.id],
        }),
        queryClient.refetchQueries({
          queryKey: [
            "https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/orders/date-range",
            startDate,
            endDate,
            currentPage,
            itemsPerPage,
          ],
        }),
      ]);

      // Reset editing state
      setIsEditing(false);
      setEditableInvoice(null);
      setEditedOrderItems({});

      // Close the selected invoice to show the updated list
      setSelectedInvoice(null);

      toast({
        title: "Lưu thành công",
        description: "Đơn hàng đã được cập nhật và danh sách đã được làm mới",
      });
    } catch (error) {
      console.error("❌ Error saving order:", error);
      toast({
        title: "Lỗi lưu đơn hàng",
        description: error instanceof Error ? error.message : "Đã xảy ra lỗi",
        variant: "destructive",
      });
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditableInvoice(null);
    setEditedOrderItems({}); // Clear local edits
    // Invalidate order items to reset them if any changes were made but not saved
    queryClient.invalidateQueries({
      queryKey: ["https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/order-items", selectedInvoice?.id],
    });
  };

  const updateEditableInvoiceField = (
    field:
      | keyof Invoice
      | "orderedAt"
      | "orderNumber"
      | "customerName"
      | "customerPhone"
      | "customerAddress"
      | "symbol"
      | "invoiceNumber"
      | "notes"
      | "discount" // Added discount field
      | "priceIncludeTax", // Added priceIncludeTax field
    value: any,
  ) => {
    if (editableInvoice) {
      setEditableInvoice({
        ...editableInvoice,
        [field]: value,
      });
    }
  };

  // State to track edited items locally (only update UI, not database)
  const [editedOrderItems, setEditedOrderItems] = useState<{
    [itemId: number]: {
      quantity?: number;
      unitPrice?: string;
      discount?: string;
      total?: string; // Add total to track calculated total
      sku?: string; // Add sku field
      productName?: string; // Add productName field
      productId?: number; // Add productId field
      _deleted?: boolean; // Flag for deletion
      notes?: string; // Add notes field
      tax?: string; // Add tax to edited item state
    };
  }>({});

  const updateOrderItemField = (itemId: number, field: string, value: any) => {
    setEditedOrderItems((prev) => {
      const currentItem = prev[itemId] || {};
      const originalItem = orderItems.find((item: any) => item.id === itemId);

      // Get current or updated values
      let quantity =
        currentItem.quantity !== undefined
          ? currentItem.quantity
          : originalItem?.quantity || 1;
      let unitPrice =
        currentItem.unitPrice !== undefined
          ? parseFloat(currentItem.unitPrice)
          : parseFloat(originalItem?.unitPrice || "0");
      let productId =
        currentItem.productId !== undefined
          ? currentItem.productId
          : originalItem?.productId || 0;
      let sku =
        currentItem.sku !== undefined
          ? currentItem.sku
          : originalItem?.sku || "";
      let productName =
        currentItem.productName !== undefined
          ? currentItem.productName
          : originalItem?.productName || "";

      // Track if product changed (to recalculate tax with new taxRate)
      let productChanged = false;

      // Update the changed field
      if (field === "quantity") {
        quantity = parseInt(value) || 1;
      } else if (field === "unitPrice") {
        unitPrice = parseFloat(value) || 0;
      } else if (field === "productId") {
        productId = value;
        productChanged = true;
        // Get product info when productId changes
        const product = products.find((p: any) => p.id === value);
        if (product) {
          productName = product.name;
          sku = product.sku;
          unitPrice = parseFloat(product.price || "0");
        }
      } else if (field === "sku") {
        sku = value;
        // When SKU changes, find product and update all related fields
        const product = products.find((p: any) => p.sku === value);
        if (product) {
          productId = product.id;
          productName = product.name;
          unitPrice = parseFloat(product.price || "0");
          productChanged = true;
        }
      } else if (field === "productName") {
        productName = value;
        // When product name changes, find product and update all related fields
        const product = products.find((p: any) => p.name === value);
        if (product) {
          productId = product.id;
          sku = product.sku;
          unitPrice = parseFloat(product.price || "0");
          productChanged = true;
        }
      }

      // Calculate item subtotal
      const itemSubtotal = quantity * unitPrice;

      // Calculate discount allocation
      const orderDiscount = parseFloat(
        editableInvoice?.discount || selectedInvoice?.discount || "0",
      );
      let itemDiscountAmount = 0;

      if (orderDiscount > 0) {
        // Get all visible items (including new items with negative IDs)
        const visibleItems = orderItems.filter(
          (item: any) => !prev[item.id]?._deleted,
        );

        // Calculate total before discount for ALL items (including this updated one)
        const totalBeforeDiscount = visibleItems.reduce(
          (sum: number, item: any) => {
            const editedItem = prev[item.id] || {};
            let itPrice = parseFloat(
              editedItem.unitPrice !== undefined
                ? editedItem.unitPrice
                : item.unitPrice || "0",
            );
            let itQty = parseInt(
              editedItem.quantity !== undefined
                ? editedItem.quantity
                : item.quantity || "0",
            );

            // Use new values for the current item being updated
            if (item.id === itemId) {
              itPrice = unitPrice;
              itQty = quantity;
            }

            return sum + itPrice * itQty;
          },
          0,
        );

        // Calculate proportional discount for this item
        if (totalBeforeDiscount > 0) {
          // Check if this is the last item
          const currentIndex = visibleItems.findIndex(
            (item: any) => item.id === itemId,
          );
          const isLastItem = currentIndex === visibleItems.length - 1;

          if (isLastItem) {
            // Last item gets remaining discount
            let previousDiscounts = 0;
            for (let i = 0; i < visibleItems.length - 1; i++) {
              const item = visibleItems[i];
              const editedItem = prev[item.id] || {};
              const itPrice = parseFloat(
                editedItem.unitPrice !== undefined
                  ? editedItem.unitPrice
                  : item.unitPrice || "0",
              );
              const itQty = parseInt(
                editedItem.quantity !== undefined
                  ? editedItem.quantity
                  : item.quantity || "0",
              );
              const itSubtotal = itPrice * itQty;
              previousDiscounts += Math.floor(
                (orderDiscount * itSubtotal) / totalBeforeDiscount,
              );
            }
            itemDiscountAmount = Math.max(0, orderDiscount - previousDiscounts);
          } else {
            // Proportional allocation
            itemDiscountAmount = Math.floor(
              (orderDiscount * itemSubtotal) / totalBeforeDiscount,
            );
          }
        }
      }

      // Calculate tax - ALWAYS get product info to ensure we have latest taxRate
      const product = products.find((p: any) => p.id === productId);
      const taxRate = product?.taxRate ? parseFloat(product.taxRate) / 100 : 0;
      const priceIncludeTax =
        editableInvoice?.priceIncludeTax ??
        selectedInvoice?.priceIncludeTax ??
        storeSettings?.priceIncludesTax ??
        false;

      let itemTax = 0;
      let priceBeforeTax = 0;

      if (taxRate > 0) {
        if (priceIncludeTax) {
          // Price includes tax
          const discountPerUnit = itemDiscountAmount / quantity;
          const adjustedPrice = Math.max(0, unitPrice - discountPerUnit);
          const giaGomThue = adjustedPrice * quantity;
          priceBeforeTax = Math.round(giaGomThue / (1 + taxRate));
          itemTax = giaGomThue - priceBeforeTax;
        } else {
          // Price excludes tax
          priceBeforeTax = Math.round(itemSubtotal - itemDiscountAmount);
          itemTax = Math.round(priceBeforeTax * taxRate);
        }
      } else {
        priceBeforeTax = Math.round(itemSubtotal - itemDiscountAmount);
      }

      const calculatedTotal = priceBeforeTax + itemTax;

      console.log(
        `🔢 Tính toán thuế cho item ${itemId} ${productChanged ? "(SẢN PHẨM MỚI)" : ""}:`,
        {
          productId,
          productName,
          sku,
          quantity,
          unitPrice,
          itemSubtotal,
          taxRate: taxRate * 100 + "%",
          priceIncludeTax,
          itemDiscountAmount,
          priceBeforeTax,
          itemTax: Math.round(itemTax),
          calculatedTotal,
        },
      );

      // ALWAYS return updated calculated fields to ensure UI reflects latest values
      return {
        ...prev,
        [itemId]: {
          ...currentItem,
          [field]: value,
          productId,
          productName,
          sku,
          quantity,
          unitPrice: unitPrice.toString(),
          total: calculatedTotal.toString(),
          discount: itemDiscountAmount.toString(),
          tax: Math.round(itemTax).toString(),
          priceBeforeTax: Math.round(priceBeforeTax).toString(),
          taxRate: (taxRate * 100).toString(),
        },
      };
    });
  };

  // Handle keyboard navigation for order items table
  const handleOrderItemKeyDown = (
    e: React.KeyboardEvent,
    index: number,
    fieldType: string,
  ) => {
    // Only editable fields (có input)
    const editableFields = ["sku", "productName", "quantity", "unitPrice"];
    const currentFieldIndex = editableFields.indexOf(fieldType);

    // Get visible items (not deleted)
    const visibleItems = orderItems.filter(
      (item: any) => !editedOrderItems[item.id]?._deleted,
    );

    // Enter or Tab - move to next editable field
    if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();

      if (currentFieldIndex === editableFields.length - 1) {
        // At the last editable field (unitPrice)
        if (index < visibleItems.length - 1) {
          // Not the last row, move to first field of next row
          setTimeout(() => {
            const nextRowInput = document.querySelector(
              `[data-field="orderitem-${editableFields[0]}-${index + 1}"]`,
            ) as HTMLInputElement;
            nextRowInput?.focus();
          }, 50);
        }
      } else {
        // Move to next editable field in same row
        const nextFieldType = editableFields[currentFieldIndex + 1];
        setTimeout(() => {
          const nextInput = document.querySelector(
            `[data-field="orderitem-${nextFieldType}-${index}"]`,
          ) as HTMLInputElement;
          nextInput?.focus();
        }, 50);
      }
    }
    // Arrow Right - move to next editable field
    else if (e.key === "ArrowRight") {
      e.preventDefault();
      if (currentFieldIndex < editableFields.length - 1) {
        const nextFieldType = editableFields[currentFieldIndex + 1];
        setTimeout(() => {
          const nextInput = document.querySelector(
            `[data-field="orderitem-${nextFieldType}-${index}"]`,
          ) as HTMLInputElement;
          nextInput?.focus();
        }, 50);
      }
    }
    // Arrow Left - move to previous editable field
    else if (e.key === "ArrowLeft") {
      e.preventDefault();
      if (currentFieldIndex > 0) {
        const prevFieldType = editableFields[currentFieldIndex - 1];
        setTimeout(() => {
          const prevInput = document.querySelector(
            `[data-field="orderitem-${prevFieldType}-${index}"]`,
          ) as HTMLInputElement;
          prevInput?.focus();
        }, 50);
      }
    }
    // Arrow Down - move to same field in next row
    else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (index < visibleItems.length - 1) {
        setTimeout(() => {
          const nextRowInput = document.querySelector(
            `[data-field="orderitem-${fieldType}-${index + 1}"]`,
          ) as HTMLInputElement;
          nextRowInput?.focus();
        }, 50);
      }
    }
    // Arrow Up - move to same field in previous row
    else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (index > 0) {
        setTimeout(() => {
          const prevRowInput = document.querySelector(
            `[data-field="orderitem-${fieldType}-${index - 1}"]`,
          ) as HTMLInputElement;
          prevRowInput?.focus();
        }, 50);
      }
    }
  };

  // Calculate totals from the filtered and sorted invoice list
  const calculateTotals = () => {
    const totals = filteredInvoices.reduce(
      (acc, item) => {
        acc.subtotal += parseFloat(item.subtotal || "0");
        acc.tax += parseFloat(item.tax || "0");
        acc.discount += parseFloat(item.discount || "0");
        acc.total += parseFloat(item.total || "0");
        return acc;
      },
      { subtotal: 0, tax: 0, discount: 0, total: 0 },
    );
    return totals;
  };

  // Calculate totals dynamically based on order items and edits
  const displayTotals = (() => {
    if (!selectedInvoice) return { subtotal: 0, tax: 0, discount: 0, total: 0 };

    // Always recalculate if we have order items (either editing or viewing)
    if (orderItems && orderItems.length > 0) {
      const priceIncludeTax =
        (isEditing
          ? editableInvoice?.priceIncludeTax
          : selectedInvoice.priceIncludeTax) ??
        storeSettings?.priceIncludesTax ??
        false;

      const orderDiscount = parseFloat(
        (isEditing ? editableInvoice?.discount : selectedInvoice.discount) ||
          "0",
      );

      // Get visible items (exclude deleted when editing)
      const visibleItems = orderItems.filter(
        (item: any) => !editedOrderItems[item.id]?._deleted,
      );

      let calculatedSubtotal = 0;
      let calculatedTax = 0;

      visibleItems.forEach((item: any) => {
        // Get edited values if in edit mode, otherwise use original
        const editedItem = isEditing ? editedOrderItems[item.id] || {} : {};

        const unitPrice = parseFloat(
          editedItem.unitPrice !== undefined
            ? editedItem.unitPrice
            : item.unitPrice || "0",
        );
        const quantity = parseInt(
          editedItem.quantity !== undefined
            ? editedItem.quantity
            : item.quantity || "0",
        );

        // Find product for tax rate
        const productId =
          editedItem.productId !== undefined
            ? editedItem.productId
            : item.productId;
        const product = products.find((p: any) => p.id === productId);
        const taxRate = product?.taxRate
          ? parseFloat(product.taxRate) / 100
          : 0;

        const itemSubtotal = unitPrice * quantity;

        if (priceIncludeTax && taxRate > 0) {
          // Price includes tax: separate out the tax portion
          const priceBeforeTax = itemSubtotal / (1 + taxRate);
          const itemTax = itemSubtotal - priceBeforeTax;
          calculatedSubtotal += priceBeforeTax;
          calculatedTax += itemTax;
        } else {
          // Price excludes tax: add tax on top
          calculatedSubtotal += itemSubtotal;
          calculatedTax += itemSubtotal * taxRate;
        }
      });

      // Total = subtotal + tax - discount
      const totalPayment = Math.max(
        0,
        calculatedSubtotal + calculatedTax - orderDiscount,
      );

      return {
        subtotal: calculatedSubtotal,
        tax: calculatedTax,
        discount: orderDiscount,
        total: totalPayment,
      };
    }

    // Fallback: use database values if items not loaded yet
    return {
      subtotal: parseFloat(selectedInvoice.subtotal || "0"),
      tax: parseFloat(selectedInvoice.tax || "0"),
      discount: parseFloat(selectedInvoice.discount || "0"),
      total: parseFloat(selectedInvoice.total || "0"),
    };
  })();

  const handleSelectOrder = (
    orderId: number,
    orderType: string,
    checked: boolean,
  ) => {
    const orderKey = `${orderType}-${orderId}`;
    const newSelectedIds = new Set(selectedOrderIds);

    if (checked) {
      newSelectedIds.add(orderKey);
    } else {
      newSelectedIds.delete(orderKey);
    }

    setSelectedOrderIds(new Set(newSelectedIds));
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allOrderKeys = filteredInvoices.map(
        (item) => `${item.type}-${item.id}`,
      );
      setSelectedOrderIds(new Set(allOrderKeys));
    } else {
      setSelectedOrderIds(new Set());
    }
  };

  const isOrderSelected = (orderId: number, orderType: string) => {
    return selectedOrderIds.has(`${orderType}-${orderId}`);
  };

  const isAllSelected =
    filteredInvoices.length > 0 &&
    selectedOrderIds.size === filteredInvoices.length;
  const isIndeterminate =
    selectedOrderIds.size > 0 &&
    selectedOrderIds.size < filteredInvoices.length;

  const exportSelectedOrdersToExcel = () => {
    if (selectedOrderIds.size === 0) {
      alert("Vui lòng chọn ít nhất một đơn hàng để xuất Excel");
      return;
    }

    const selectedOrders = filteredInvoices.filter((item) =>
      selectedOrderIds.has(`${item.type}-${item.id}`),
    );

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([]);
    ws["!defaultFont"] = { name: "Times New Roman", sz: 11 };

    XLSX.utils.sheet_add_aoa(ws, [["DANH SÁCH ĐƠN HÀNG BÁN"]], {
      origin: "A1",
    });
    if (!ws["!merges"]) ws["!merges"] = [];
    ws["!merges"].push({ s: { r: 0, c: 0 }, e: { r: 0, c: 14 } });

    XLSX.utils.sheet_add_aoa(ws, [[]], { origin: "A2" });

    const headers = [
      "Số đơn bán",
      "Ngày đơn bán",
      "Bàn",
      "Mã khách hàng",
      "Tên khách hàng",
      "Thành tiền",
      "Giảm giá",
      "Tiền thuế",
      "Đã thanh toán",
      "Mã nhân viên",
      "Tên nhân viên",
      "Ký hiệu hóa đơn",
      "Số hóa đơn",
      "Ghi chú",
      "Trạng thái",
    ];
    XLSX.utils.sheet_add_aoa(ws, [headers], { origin: "A3" });

    const dataRows = selectedOrders.map((item, index) => {
      const orderNumber =
        item.tradeNumber ||
        item.invoiceNumber ||
        item.orderNumber ||
        `ORD-${String(item.id).padStart(8, "0")}`;
      const orderDate = formatDate(item.createdAt);
      const table =
        item.type === "order" && item.tableId
          ? getTableNumber(item.tableId)
          : "";
      const customerCode = item.customerTaxCode;
      const customerName = item.customerName || "";
      const subtotal = parseFloat(item.subtotal || "0");
      const discount = parseFloat(item.discount || "0");
      const tax = parseFloat(item.tax || "0");
      const total = parseFloat(item.total || "0");
      const paid = total;
      const employeeCode = item.employeeId || "NV0001";
      const employeeName = "";
      const symbol = item.symbol || "";
      const invoiceNumber =
        item.invoiceNumber || String(item.id).padStart(8, "0");
      const status =
        item.displayStatus === 1
          ? "Đã hoàn thành"
          : item.displayStatus === 2
            ? "Đang phục vụ"
            : "Đã hủy";

      return [
        orderNumber,
        orderDate,
        table,
        customerCode,
        customerName,
        subtotal,
        discount,
        tax,
        paid,
        employeeCode,
        employeeName,
        symbol,
        invoiceNumber,
        item.notes || "",
        status,
      ];
    });

    XLSX.utils.sheet_add_aoa(ws, dataRows, { origin: "A4" });

    ws["!cols"] = [
      { wch: 15 },
      { wch: 13 },
      { wch: 8 },
      { wch: 12 },
      { wch: 15 },
      { wch: 12 },
      { wch: 10 },
      { wch: 10 },
      { wch: 12 },
      { wch: 12 },
      { wch: 15 },
      { wch: 12 },
      { wch: 12 },
      { wch: 20 },
      { wch: 12 },
    ];

    ws["!rows"] = [
      { hpt: 25 },
      { hpt: 15 },
      { hpt: 20 },
      ...Array(selectedOrders.length).fill({ hpt: 18 }),
    ];

    if (ws["A1"]) {
      ws["A1"].s = {
        font: {
          name: "Times New Roman",
          sz: 16,
          bold: true,
          color: { rgb: "000000" },
        },
        alignment: { horizontal: "center", vertical: "center" },
        fill: { patternType: "solid", fgColor: { rgb: "FFFFFF" } },
      };
    }

    for (let col = 0; col <= 14; col++) {
      const cellAddress = XLSX.utils.encode_cell({ r: 2, c: col });
      if (ws[cellAddress]) {
        ws[cellAddress].s = {
          font: {
            name: "Times New Roman",
            sz: 11,
            bold: true,
            color: { rgb: "FFFFFF" },
          },
          fill: { patternType: "solid", fgColor: { rgb: "92D050" } },
          alignment: { horizontal: "center", vertical: "center" },
          border: {
            top: { style: "thin", color: { rgb: "000000" } },
            bottom: { style: "thin", color: { rgb: "000000" } },
            left: { style: "thin", color: { rgb: "000000" } },
            right: { style: "thin", color: { rgb: "000000" } },
          },
        };
      }
    }

    for (let row = 3; row < 3 + selectedOrders.length; row++) {
      const isEven = (row - 3) % 2 === 0;
      const bgColor = isEven ? "FFFFFF" : "F2F2F2";

      for (let col = 0; col <= 14; col++) {
        const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
        const isCurrency = [5, 6, 7, 8].includes(col);

        if (ws[cellAddress]) {
          ws[cellAddress].s = {
            font: { name: "Times New Roman", sz: 11, color: { rgb: "000000" } },
            fill: { patternType: "solid", fgColor: { rgb: bgColor } },
            alignment: {
              horizontal: isCurrency ? "right" : "center",
              vertical: "center",
            },
            border: {
              top: { style: "thin", color: { rgb: "BFBFBF" } },
              bottom: { style: "thin", color: { rgb: "BFBFBF" } },
              left: { style: "thin", color: { rgb: "BFBFBF" } },
              right: { style: "thin", color: { rgb: "BFBFBF" } },
            },
          };

          if (isCurrency && typeof ws[cellAddress].v === "number") {
            ws[cellAddress].z = "#,##0";
          }
        }
      }
    }

    XLSX.utils.book_append_sheet(wb, ws, "Danh sách đơn hàng");

    wb.Props = {
      Title: "Danh sách đơn hàng bán",
      Subject: "Báo cáo đơn hàng",
      Author: "EDPOS System",
      CreatedDate: new Date(),
    };

    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, "-");
    const defaultFilename = `danh-sach-don-hang-ban_${timestamp}.xlsx`;

    try {
      XLSX.writeFile(wb, defaultFilename, {
        bookType: "xlsx",
        cellStyles: true,
        sheetStubs: false,
        compression: true,
      });

      console.log(
        "✅ Excel file exported successfully with Times New Roman formatting",
      );
      alert(
        "File Excel đã được xuất thành công với định dạng Times New Roman!",
      );
    } catch (error) {
      console.error("❌ Error exporting Excel file:", error);
      XLSX.writeFile(wb, defaultFilename, { bookType: "xlsx" });
      alert("File Excel đã được xuất nhưng có thể thiếu một số định dạng.");
    }
  };

  const totals = calculateTotals();

  // Function to handle payment initiation
  const handlePayment = async (order: Invoice) => {
    console.log("💳 Payment initiated for order:", order.id);

    // Update order status to paid
    try {
      const updateResponse = await apiRequest(
        "PUT",
        `https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/orders/${order.id}`,
        {
          paymentStatus: "paid",
          status: "paid",
          paidAt: new Date().toISOString(),
        },
      );

      if (updateResponse.ok) {
        console.log("✅ Order payment status updated successfully");

        // Refresh orders list
        queryClient.invalidateQueries({ queryKey: ["https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/orders"] });
        queryClient.invalidateQueries({ queryKey: ["https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/tables"] });

        toast({
          title: "Thanh toán thành công",
          description: "Đơn hàng đã được cập nhật trạng thái thanh toán",
        });

        // For laundry business, show receipt modal after payment
        if (storeSettings?.businessType === "laundry") {
          console.log("🧺 Laundry business: Preparing receipt after payment");

          // Fetch fresh order items
          const itemsResponse = await apiRequest(
            "GET",
            `https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/order-items/${order.id}`,
          );
          const items = await itemsResponse.json();

          // Prepare receipt data
          const receiptData = {
            id: order.id,
            tableId: order.tableId || null,
            orderNumber: order.orderNumber || order.displayNumber,
            transactionId: order.orderNumber || `TXN-${order.id}`,
            items: items.map((item: any) => ({
              id: item.id,
              productId: item.productId,
              productName: item.productName,
              price: item.unitPrice,
              quantity: item.quantity,
              total: item.total,
              discount: item.discount || "0",
              sku: item.productSku || item.sku || `ITEM${item.productId}`,
              taxRate: parseFloat(item.taxRate || "0"),
            })),
            subtotal: order.subtotal,
            tax: order.tax,
            total: order.total,
            paymentMethod: order.paymentMethod || "cash",
            amountReceived: order.total,
            change: "0",
            cashierName: "System User",
            createdAt: order?.createdAt ?? new Date().toISOString(),
            customerName: order.customerName || "Khách hàng",
            customerTaxCode: order.customerTaxCode || null,
            tableNumber: order.tableId ? getTableNumber(order.tableId) : null,
          };

          console.log("🧾 Opening receipt modal with data:", receiptData);
          setSelectedReceipt(receiptData);
          setShowReceiptModal(true);
        }
      }
    } catch (error) {
      console.error("❌ Error updating payment status:", error);
      toast({
        title: "Lỗi thanh toán",
        description: "Không thể cập nhật trạng thái thanh toán",
        variant: "destructive",
      });
    }
  };

  // Handler for when payment is completed
  const handlePaymentComplete = (data: any) => {
    console.log("💳 Sales Orders: Payment completed:", data);

    // Close payment modal
    setShowPaymentMethodModal(false);

    if (data.success && data.receipt) {
      console.log(
        "✅ Sales Orders: Showing receipt modal with data:",
        data.receipt,
      );

      // Set receipt data
      setSelectedReceipt(data.receipt);

      // Show receipt modal with a small delay to ensure state is properly set
      setTimeout(() => {
        setShowReceiptModal(true);
      }, 100);

      // Refresh orders list after a delay to avoid interfering with receipt modal
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/orders"] });
        queryClient.invalidateQueries({
          queryKey: [
            "https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/orders/date-range",
            startDate,
            endDate,
            currentPage,
            itemsPerPage,
          ],
        });
      }, 500);
    }
  };

  // Function to print receipt for a given order
  const handlePrintReceipt = async (order: any) => {
    try {
      console.log("📄 Sales Orders: Preparing receipt for order:", order.id);

      // Fetch order items with tax information
      const response = await apiRequest("GET", `https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/order-items/${order.id}`);
      const items = await response.json();

      // Enrich items with product information including tax rates
      const enrichedItems = items.map((item: any) => {
        const product = products.find((p: any) => p.id === item.productId);
        return {
          id: item.id,
          productId: item.productId,
          productName: item.productName,
          price: item.unitPrice,
          quantity: item.quantity,
          discount: item.discount || "0",
          total: item.total,
          tax: item.tax || "0", // Include tax for the item if available
          sku: item.productSku || item.sku || `SKU${item.productId}`,
          // Prioritize item.taxRate, fallback to product.taxRate, then default to 0
          taxRate: parseFloat(item.taxRate || product?.taxRate || "0"),
          product: product || null, // Include the full product object for potential future use
        };
      });

      const receiptData = {
        ...order,
        transactionId: order.orderNumber || order.invoiceNumber,
        items: enrichedItems,
        cashierName: "System",
        amountReceived: order.total,
        change: "0",
      };

      console.log("📄 Sales Orders: Receipt data with tax info:", receiptData);

      setSelectedReceipt(receiptData);
      setShowReceiptModal(true);
    } catch (error) {
      console.error("❌ Error preparing receipt:", error);
      toast({
        title: "Lỗi",
        description: "Không thể tải thông tin hóa đơn",
        variant: "destructive",
      });
    }
  };

  // Effect to handle receipt modal close events and prevent reopening
  useEffect(() => {
    const handleReceiptModalClosed = (event: CustomEvent) => {
      console.log(
        "🔒 Sales Orders: Receipt modal closed event received",
        event.detail,
      );

      // Only clear if event detail confirms intentional close
      if (event.detail?.intentionalClose) {
        setShowReceiptModal(false);
        setSelectedReceipt(null);
        setShowPaymentMethodModal(false);
        console.log("✅ Sales Orders: Receipt modal states cleared");
      }
    };

    window.addEventListener(
      "receiptModalClosed",
      handleReceiptModalClosed as EventListener,
    );

    return () => {
      window.removeEventListener(
        "receiptModalClosed",
        handleReceiptModalClosed as EventListener,
      );
    };
  }, []);

  return (
    <div className="min-h-screen bg-green-50 grocery-bg">
      {/* Header */}
      <POSHeader />
      {/* Right Sidebar */}
      <RightSidebar />
      <div className="main-content pt-16 px-6">
        <div className="max-w-full mx-auto py-8">
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-4">
              <FileText className="w-6 h-6 text-green-600" />
              <h1 className="text-2xl font-bold text-gray-800">
                {t("purchases.salesOrdersList")}
              </h1>
            </div>
            <p className="text-gray-600 mb-4">
              {t("orders.realTimeOrderStatus")}
            </p>
          </div>

          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg">{t("common.filters")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    {t("reports.startDate")}
                  </label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">
                    {t("reports.endDate")}
                  </label>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">
                    {t("orders.customer")}
                  </label>
                  <Input
                    placeholder={t("reports.customerFilterPlaceholder")}
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Mặt hàng
                  </label>
                  <Input
                    placeholder="Tìm theo tên hoặc mã mặt hàng"
                    value={customerCodeSearch}
                    onChange={(e) => setCustomerCodeSearch(e.target.value)}
                    className="w-full"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    {t("orders.orderNumber")}
                  </label>
                  <Input
                    placeholder={t("reports.orderNumberPlaceholder")}
                    value={orderNumberSearch}
                    onChange={(e) => setOrderNumberSearch(e.target.value)}
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Hình thức bán
                  </label>
                  <select
                    value={salesChannelFilter}
                    onChange={(e) => setSalesChannelFilter(e.target.value)}
                    className="w-full h-10 px-3 rounded-md border border-gray-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    <option value="all">Tất cả</option>
                    <option value="table">Ăn tại chỗ</option>
                    <option value="pos">Bán tại quầy</option>
                    <option value="online">Bán online</option>
                    <option value="delivery">Giao hàng</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Trạng thái đơn hàng
                  </label>
                  <select
                    value={orderStatusFilter}
                    onChange={(e) => setOrderStatusFilter(e.target.value)}
                    className="w-full h-10 px-3 rounded-md border border-gray-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    <option value="all">Tất cả</option>
                    <option value="paid">Đã thanh toán</option>
                    <option value="pending">Chờ xử lý</option>
                    <option value="cancelled">Đã hủy</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Trạng thái hóa đơn điện tử
                  </label>
                  <select
                    value={einvoiceStatusFilter}
                    onChange={(e) => setEinvoiceStatusFilter(e.target.value)}
                    className="w-full h-10 px-3 rounded-md border border-gray-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    <option value="all">Tất cả</option>
                    <option value="0">Chưa phát hành</option>
                    <option value="1">Đã phát hành</option>
                  </select>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex items-center gap-2 border-red-500 text-red-600 hover:bg-red-50"
                    disabled={selectedOrderIds.size === 0}
                    onClick={() => setShowBulkCancelDialog(true)}
                  >
                    <X className="w-4 h-4" />
                    {t("common.cancelOrder")} ({selectedOrderIds.size})
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex items-center gap-2 border-green-500 text-green-600 hover:bg-green-50"
                    disabled={selectedOrderIds.size === 0}
                    onClick={exportSelectedOrdersToExcel}
                  >
                    <Download className="w-4 h-4" />
                    {t("common.exportExcel")} ({selectedOrderIds.size})
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
                  <p className="mt-2 text-gray-500">Đang tải...</p>
                </div>
              ) : hasError ? (
                <div className="text-center py-8">
                  <div className="text-red-500 mb-4">
                    <X className="w-8 h-8 mx-auto mb-2" />
                    <p className="font-medium">Lỗi kết nối cơ sp dữ liệu</p>
                  </div>
                  <p className="text-gray-500 mb-4">
                    Không thể tải dữ liệu đơn hàng. Vui lòng thử lại.
                  </p>
                  <Button
                    onClick={() => {
                      queryClient.invalidateQueries({
                        queryKey: ["https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/orders"],
                      });
                    }}
                  >
                    Thử lại
                  </Button>
                </div>
              ) : (
                <div>
                  <div className="w-full overflow-x-auto border rounded-md bg-white">
                    <table className="w-full min-w-[1600px] table-fixed">
                      <thead>
                        <tr className="bg-gray-50 border-b">
                          <th className="w-[50px] px-3 py-3 text-center font-medium text-sm text-gray-600">
                            <Checkbox
                              checked={isAllSelected}
                              ref={(el) => {
                                if (el) el.indeterminate = isIndeterminate;
                              }}
                              onCheckedChange={handleSelectAll}
                            />
                          </th>
                          <th
                            className="w-[180px] px-3 py-3 text-left font-medium text-sm text-gray-600 cursor-pointer hover:bg-gray-100"
                            onClick={() => handleSort("orderNumber")}
                          >
                            <div className="leading-tight flex items-center gap-1">
                              Số đơn bán
                              {sortField === "orderNumber" && (
                                <span className="text-blue-600">
                                  {sortOrder === "asc" ? "↑" : "↓"}
                                </span>
                              )}
                            </div>
                          </th>
                          {storeSettings?.businessType === "laundry" && (
                            <th className="w-[100px] px-3 py-3 text-center font-medium text-sm text-gray-600">
                              {t("common.returned")}
                            </th>
                          )}
                          <th
                            className="w-[120px] px-3 py-3 text-center font-medium text-sm text-gray-600 cursor-pointer hover:bg-gray-100"
                            onClick={() => handleSort("status")}
                          >
                            <div className="leading-tight flex items-center justify-center gap-1">
                              {t("common.status")}
                              {sortField === "status" && (
                                <span className="text-blue-600">
                                  {sortOrder === "asc" ? "↑" : "↓"}
                                </span>
                              )}
                            </div>
                          </th>
                          <th
                            className="w-[180px] px-3 py-3 text-left font-medium text-sm text-gray-600 cursor-pointer hover:bg-gray-100"
                            onClick={() => handleSort("createdAt")}
                          >
                            <div className="leading-tight flex items-center gap-1">
                              Ngày tạo đơn
                              {sortField === "createdAt" && (
                                <span className="text-blue-600">
                                  {sortOrder === "asc" ? "↑" : "↓"}
                                </span>
                              )}
                            </div>
                          </th>
                          <th
                            className="w-[180px] px-3 py-3 text-left font-medium text-sm text-gray-600 cursor-pointer hover:bg-gray-100"
                            onClick={() => handleSort("updatedAt")}
                          >
                            <div className="leading-tight flex items-center gap-1">
                              Ngày hủy đơn/hoàn thành
                              {sortField === "updatedAt" && (
                                <span className="text-blue-600">
                                  {sortOrder === "asc" ? "↑" : "↓"}
                                </span>
                              )}
                            </div>
                          </th>
                          <th
                            className="w-[80px] px-3 py-3 text-left font-medium text-sm text-gray-600 cursor-pointer hover:bg-gray-100"
                            onClick={() => handleSort("salesChannel")}
                          >
                            <div className="leading-tight flex items-center gap-1">
                              {t("orders.orderSource")}
                              {sortField === "salesChannel" && (
                                <span className="text-blue-600">
                                  {sortOrder === "asc" ? "↑" : "↓"}
                                </span>
                              )}
                            </div>
                          </th>
                          <th
                            className="w-[120px] px-3 py-3 text-left font-medium text-sm text-gray-600 cursor-pointer hover:bg-gray-100"
                            onClick={() => handleSort("customerCode")}
                          >
                            <div className="leading-tight flex items-center gap-1">
                              {t("orders.customerCode")}
                              {sortField === "customerCode" && (
                                <span className="text-blue-600">
                                  {sortOrder === "asc" ? "↑" : "↓"}
                                </span>
                              )}
                            </div>
                          </th>
                          <th
                            className="w-[150px] px-3 py-3 text-left font-medium text-sm text-gray-600 cursor-pointer hover:bg-gray-100"
                            onClick={() => handleSort("customerName")}
                          >
                            <div className="leading-tight flex items-center gap-1">
                              {t("orders.customerName")}
                              {sortField === "customerName" && (
                                <span className="text-blue-600">
                                  {sortOrder === "asc" ? "↑" : "↓"}
                                </span>
                              )}
                            </div>
                          </th>
                          <th
                            className="w-[100px] px-3 py-3 text-right font-medium text-sm text-gray-600 cursor-pointer hover:bg-gray-100"
                            onClick={() => handleSort("subtotal")}
                          >
                            <div className="leading-tight flex items-center justify-end gap-1">
                              {t("common.subtotalAmount")}
                              {sortField === "subtotal" && (
                                <span className="text-blue-600">
                                  {sortOrder === "asc" ? "↑" : "↓"}
                                </span>
                              )}
                            </div>
                          </th>
                          <th
                            className="w-[80px] px-3 py-3 text-right font-medium text-sm text-gray-600 cursor-pointer hover:bg-gray-100"
                            onClick={() => handleSort("discount")}
                          >
                            <div className="leading-tight flex items-center justify-end gap-1">
                              {t("common.discount")}
                              {sortField === "discount" && (
                                <span className="text-blue-600">
                                  {sortOrder === "asc" ? "↑" : "↓"}
                                </span>
                              )}
                            </div>
                          </th>
                          <th
                            className="w-[90px] px-3 py-3 text-right font-medium text-sm text-gray-600 cursor-pointer hover:bg-gray-100"
                            onClick={() => handleSort("tax")}
                          >
                            <div className="leading-tight flex items-center justify-end gap-1">
                              {t("common.tax")}
                              {sortField === "tax" && (
                                <span className="text-blue-600">
                                  {sortOrder === "asc" ? "↑" : "↓"}
                                </span>
                              )}
                            </div>
                          </th>
                          <th
                            className="w-[110px] px-3 py-3 text-right font-medium text-sm text-gray-600 cursor-pointer hover:bg-gray-100"
                            onClick={() => handleSort("total")}
                          >
                            <div className="leading-tight flex items-center justify-end gap-1">
                              {t("common.paid")}
                              {sortField === "total" && (
                                <span className="text-blue-600">
                                  {sortOrder === "asc" ? "↑" : "↓"}
                                </span>
                              )}
                            </div>
                          </th>
                          <th
                            className="w-[110px] px-3 py-3 text-left font-medium text-sm text-gray-600 cursor-pointer hover:bg-gray-100"
                            onClick={() => handleSort("employeeCode")}
                          >
                            <div className="leading-tight flex items-center gap-1">
                              {t("common.employeeCode")}
                              {sortField === "employeeCode" && (
                                <span className="text-blue-600">
                                  {sortOrder === "asc" ? "↑" : "↓"}
                                </span>
                              )}
                            </div>
                          </th>
                          <th
                            className="w-[120px] px-3 py-3 text-left font-medium text-sm text-gray-600 cursor-pointer hover:bg-gray-100"
                            onClick={() => handleSort("employeeName")}
                          >
                            <div className="leading-tight flex items-center gap-1">
                              {t("common.employeeName")}
                              {sortField === "employeeName" && (
                                <span className="text-blue-600">
                                  {sortOrder === "asc" ? "↑" : "↓"}
                                </span>
                              )}
                            </div>
                          </th>
                          <th
                            className="w-[120px] px-3 py-3 text-left font-medium text-sm text-gray-600 cursor-pointer hover:bg-gray-100"
                            onClick={() => handleSort("symbol")}
                          >
                            <div className="leading-tight flex items-center gap-1">
                              {t("common.invoiceSymbol")}
                              {sortField === "symbol" && (
                                <span className="text-blue-600">
                                  {sortOrder === "asc" ? "↑" : "↓"}
                                </span>
                              )}
                            </div>
                          </th>
                          <th
                            className="w-[110px] px-3 py-3 text-left font-medium text-sm text-gray-600 cursor-pointer hover:bg-gray-100"
                            onClick={() => handleSort("invoiceNumber")}
                          >
                            <div className="leading-tight flex items-center gap-1">
                              {t("common.invoiceNumber")}
                              {sortField === "invoiceNumber" && (
                                <span className="text-blue-600">
                                  {sortOrder === "asc" ? "↑" : "↓"}
                                </span>
                              )}
                            </div>
                          </th>
                          <th
                            className="w-[200px] px-3 py-3 text-left font-medium text-sm text-gray-600 cursor-pointer hover:bg-gray-100"
                            onClick={() => handleSort("notes")}
                          >
                            <div className="leading-tight flex items-center gap-1">
                              {t("common.notes")}
                              {sortField === "notes" && (
                                <span className="text-blue-600">
                                  {sortOrder === "asc" ? "↑" : "↓"}
                                </span>
                              )}
                            </div>
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {filteredInvoices.length === 0 ? (
                          <tr>
                            <td
                              colSpan={
                                storeSettings?.businessType === "laundry"
                                  ? 18
                                  : 17
                              }
                              className="p-8 text-center text-sm text-gray-500"
                            >
                              <div className="flex flex-col items-center gap-2">
                                <FileText className="w-8 h-8 text-gray-400" />
                                <p>Không có đơn hàng nào</p>
                                <p className="text-xs">
                                  Thử thay đổi bộ lọc để xem kết quả khác
                                </p>
                              </div>
                            </td>
                          </tr>
                        ) : (
                          filteredInvoices.map((item) => {
                            const customerCode =
                              item.customerCode ||
                              item.customerTaxCode ||
                              `KH000${String(item.id).padStart(3, "0")}`;
                            const customerName =
                              item.customerName || "Khách hàng lẻ";
                            const discount = parseFloat(item.discount || "0");
                            const tax = parseFloat(item.tax || "0");
                            const subtotal = parseFloat(item.subtotal || "0");
                            const total = parseFloat(item.total || "0");
                            const paid = total;
                            const employeeCode = item.employeeId || "NV0001";
                            const employeeName = "";
                            const symbol = item.symbol || "";
                            const invoiceNumber =
                              item.invoiceNumber ||
                              String(item.id).padStart(8, "0");
                            const notes = item.notes || "";

                            const itemSymbol =
                              item.symbol || item.templateNumber || "";

                            return (
                              <>
                                <tr
                                  key={`${item.type}-${item.id}`}
                                  className={`hover:bg-gray-50 ${
                                    selectedInvoice?.id === item.id &&
                                    selectedInvoice?.type === item.type
                                      ? "bg-blue-100"
                                      : ""
                                  }`}
                                  onClick={() => {
                                    const itemWithType = {
                                      ...item,
                                      type:
                                        item.type ||
                                        (item.orderNumber
                                          ? "order"
                                          : "invoice"),
                                    };
                                    setSelectedInvoice(itemWithType);
                                  }}
                                >
                                  <td className="px-3 py-3 text-center">
                                    <Checkbox
                                      checked={isOrderSelected(
                                        item.id,
                                        item.type,
                                      )}
                                      onCheckedChange={(checked) =>
                                        handleSelectOrder(
                                          item.id,
                                          item.type,
                                          checked as boolean,
                                        )
                                      }
                                      onClick={(e) => e.stopPropagation()}
                                    />
                                  </td>
                                  <td className="px-3 py-3">
                                    <div
                                      className="font-medium text-xs"
                                      title={
                                        item.orderNumber || item.displayNumber
                                      }
                                    >
                                      {item.orderNumber || item.displayNumber}
                                    </div>
                                  </td>
                                  {storeSettings?.businessType ===
                                    "laundry" && (
                                    <td className="text-center border-r min-w-[100px] px-4">
                                      <Badge
                                        className={
                                          item.isPaid
                                            ? "bg-green-100 text-green-800"
                                            : "bg-gray-100 text-gray-600"
                                        }
                                      >
                                        {item.isPaid ? "Đã trả" : "Chưa trả"}
                                      </Badge>
                                    </td>
                                  )}
                                  <td className="px-3 py-3 text-center">
                                    {getInvoiceStatusBadge(
                                      item.displayStatus,
                                      item,
                                    )}
                                  </td>
                                  <td className="px-3 py-3">
                                    <div className="text-sm truncate">
                                      {formatDate(item.createdAt)}
                                    </div>
                                  </td>
                                  <td className="px-3 py-3">
                                    <div className="text-sm truncate">
                                      {(() => {
                                        // Show completion/cancellation date based on status
                                        if (
                                          item.displayStatus === 1 ||
                                          item.status === "paid"
                                        ) {
                                          // Completed - show updatedAt
                                          return formatDate(item.updatedAt);
                                        } else if (
                                          item.displayStatus === 3 ||
                                          item.status === "cancelled"
                                        ) {
                                          // Cancelled - show updatedAt
                                          return formatDate(item.updatedAt);
                                        }
                                        return "-";
                                      })()}
                                    </div>
                                  </td>
                                  <td className="px-3 py-3">
                                    <div className="text-sm">
                                      {(() => {
                                        if (item.salesChannel === "table") {
                                          return item.tableId
                                            ? getTableNumber(item.tableId)
                                            : "Bàn";
                                        } else if (
                                          item.salesChannel === "pos"
                                        ) {
                                          return "POS";
                                        } else if (
                                          item.salesChannel === "online"
                                        ) {
                                          return "Online";
                                        } else if (
                                          item.salesChannel === "delivery"
                                        ) {
                                          return "Giao hàng";
                                        }
                                        return "POS"; // default fallback
                                      })()}
                                    </div>
                                  </td>
                                  <td className="px-3 py-3">
                                    <div
                                      className="text-sm font-mono truncate"
                                      title={customerCode}
                                    >
                                      {customerCode}
                                    </div>
                                  </td>
                                  <td className="px-3 py-3">
                                    <div
                                      className="text-sm truncate"
                                      title={customerName}
                                    >
                                      {customerName}
                                    </div>
                                  </td>
                                  <td className="px-3 py-3 text-right">
                                    <div className="text-sm font-medium">
                                      {formatCurrency(subtotal)}
                                    </div>
                                  </td>
                                  <td className="px-3 py-3 text-right">
                                    <div className="text-sm">
                                      {formatCurrency(discount)}
                                    </div>
                                  </td>
                                  <td className="px-3 py-3 text-right">
                                    <div className="text-sm">
                                      {formatCurrency(
                                        parseFloat(item.tax || "0"),
                                      )}
                                    </div>
                                  </td>
                                  <td className="px-3 py-3 text-right">
                                    <div className="text-sm font-medium">
                                      {formatCurrency(
                                        parseFloat(item.total || "0"),
                                      )}
                                    </div>
                                  </td>
                                  <td className="px-3 py-3">
                                    <div className="text-sm font-mono">
                                      {employeeCode}
                                    </div>
                                  </td>
                                  <td className="px-3 py-3">
                                    <div
                                      className="text-sm truncate"
                                      title={employeeName}
                                    >
                                      {employeeName}
                                    </div>
                                  </td>
                                  <td className="px-3 py-3">
                                    <div className="text-sm">
                                      {itemSymbol || "-"}
                                    </div>
                                  </td>
                                  <td className="px-3 py-3">
                                    <div className="text-sm font-mono">
                                      {invoiceNumber}
                                    </div>
                                  </td>
                                  <td className="px-3 py-3">
                                    <div
                                      className="text-sm truncate"
                                      title={notes || "-"}
                                    >
                                      {notes || "-"}
                                    </div>
                                  </td>
                                </tr>
                                {selectedInvoice &&
                                  selectedInvoice.id === item.id &&
                                  selectedInvoice.type === item.type && (
                                    <tr>
                                      <td
                                        colSpan={
                                          storeSettings?.businessType ===
                                          "laundry"
                                            ? 18
                                            : 17
                                        }
                                        className="p-0"
                                      >
                                        <div className="p-4 border-l-4 border-blue-500 bg-gray-50">
                                          <Card className="shadow-lg">
                                            <CardHeader className="pb-3">
                                              <CardTitle className="text-lg text-blue-700">
                                                {t("common.orderDetails")}
                                              </CardTitle>
                                            </CardHeader>
                                            <CardContent className="space-y-4">
                                              <div className="bg-white p-4 rounded-lg overflow-x-auto">
                                                <div className="min-w-[1200px]">
                                                  <table className="w-full text-sm border-collapse">
                                                    <tbody>
                                                      <tr>
                                                        <td className="py-1 pr-4 font-medium whitespace-nowrap">
                                                          Số đơn bán:
                                                        </td>
                                                        <td className="py-1 pr-6 text-blue-600 font-medium">
                                                          {isEditing &&
                                                          editableInvoice ? (
                                                            <Input
                                                              value={
                                                                editableInvoice.orderNumber ||
                                                                ""
                                                              }
                                                              onChange={(e) =>
                                                                updateEditableInvoiceField(
                                                                  "orderNumber",
                                                                  e.target
                                                                    .value,
                                                                )
                                                              }
                                                              className="w-32"
                                                              disabled={true}
                                                            />
                                                          ) : (
                                                            selectedInvoice.orderNumber ||
                                                            selectedInvoice.displayNumber
                                                          )}
                                                        </td>
                                                        <td className="py-1 pr-4 font-medium whitespace-nowrap">
                                                          Ngày:
                                                        </td>
                                                        <td className="py-1 pr-6">
                                                          {isEditing &&
                                                          editableInvoice ? (
                                                            <Input
                                                              type="datetime-local"
                                                              value={
                                                                editableInvoice.createdAt?.slice(
                                                                  0,
                                                                  16,
                                                                ) || ""
                                                              }
                                                              onChange={(e) =>
                                                                updateEditableInvoiceField(
                                                                  "createdAt",
                                                                  e.target
                                                                    .value,
                                                                )
                                                              }
                                                              className="w-44"
                                                              disabled={
                                                                selectedInvoice.displayStatus ===
                                                                1
                                                              }
                                                            />
                                                          ) : (
                                                            formatDate(
                                                              selectedInvoice.createdAt,
                                                            )
                                                          )}
                                                        </td>
                                                        <td className="py-1 pr-4 font-medium whitespace-nowrap">
                                                          Khách hàng:
                                                        </td>
                                                        <td className="py-1 pr-6 text-blue-600 font-medium">
                                                          {isEditing &&
                                                          editableInvoice ? (
                                                            <>
                                                              <Input
                                                                list="customer-list-datalist"
                                                                value={
                                                                  editableInvoice.customerName ||
                                                                  ""
                                                                }
                                                                onChange={(
                                                                  e,
                                                                ) => {
                                                                  const inputValue =
                                                                    e.target
                                                                      .value;

                                                                  // Luôn cập nhật tên khách hàng trước
                                                                  updateEditableInvoiceField(
                                                                    "customerName",
                                                                    inputValue,
                                                                  );

                                                                  // Nếu xóa hoàn toàn (rỗng hoặc chỉ có khoảng trắng)
                                                                  if (
                                                                    inputValue.trim() ===
                                                                    ""
                                                                  ) {
                                                                    updateEditableInvoiceField(
                                                                      "customerPhone",
                                                                      "",
                                                                    );
                                                                    updateEditableInvoiceField(
                                                                      "customerTaxCode",
                                                                      "",
                                                                    );
                                                                    updateEditableInvoiceField(
                                                                      "customerAddress",
                                                                      "",
                                                                    );
                                                                    updateEditableInvoiceField(
                                                                      "customerEmail",
                                                                      "",
                                                                    );
                                                                    return;
                                                                  }

                                                                  // Chỉ tìm khách hàng nếu dữ liệu đã được load
                                                                  if (
                                                                    Array.isArray(
                                                                      customers,
                                                                    ) &&
                                                                    customers.length >
                                                                      0
                                                                  ) {
                                                                    // Tìm khách hàng khớp chính xác
                                                                    const matchingCustomer =
                                                                      customers.find(
                                                                        (
                                                                          c: any,
                                                                        ) =>
                                                                          c.name ===
                                                                          inputValue,
                                                                      );

                                                                    if (
                                                                      matchingCustomer
                                                                    ) {
                                                                      // Cập nhật tất cả thông tin khách hàng
                                                                      updateEditableInvoiceField(
                                                                        "customerPhone",
                                                                        matchingCustomer.phone ||
                                                                          "",
                                                                      );
                                                                      updateEditableInvoiceField(
                                                                        "customerTaxCode",
                                                                        matchingCustomer.customerTaxCode ||
                                                                          "",
                                                                      );
                                                                      updateEditableInvoiceField(
                                                                        "customerAddress",
                                                                        matchingCustomer.address ||
                                                                          "",
                                                                      );
                                                                      updateEditableInvoiceField(
                                                                        "customerEmail",
                                                                        matchingCustomer.email ||
                                                                          "",
                                                                      );
                                                                    }
                                                                  }
                                                                }}
                                                                onBlur={(e) => {
                                                                  const inputValue =
                                                                    e.target.value.trim();

                                                                  // Nếu rỗng sau khi blur, xóa hết
                                                                  if (
                                                                    inputValue ===
                                                                    ""
                                                                  ) {
                                                                    updateEditableInvoiceField(
                                                                      "customerName",
                                                                      "",
                                                                    );
                                                                    updateEditableInvoiceField(
                                                                      "customerPhone",
                                                                      "",
                                                                    );
                                                                    updateEditableInvoiceField(
                                                                      "customerTaxCode",
                                                                      "",
                                                                    );
                                                                    updateEditableInvoiceField(
                                                                      "customerAddress",
                                                                      "",
                                                                    );
                                                                    updateEditableInvoiceField(
                                                                      "customerEmail",
                                                                      "",
                                                                    );
                                                                    return;
                                                                  }

                                                                  // Chỉ kiểm tra lại khách hàng nếu dữ liệu đã load
                                                                  if (
                                                                    Array.isArray(
                                                                      customers,
                                                                    ) &&
                                                                    customers.length >
                                                                      0
                                                                  ) {
                                                                    // Tìm khách hàng khớp chính xác
                                                                    const matchingCustomer =
                                                                      customers.find(
                                                                        (
                                                                          c: any,
                                                                        ) =>
                                                                          c.name ===
                                                                          inputValue,
                                                                      );

                                                                    if (
                                                                      matchingCustomer
                                                                    ) {
                                                                      updateEditableInvoiceField(
                                                                        "customerName",
                                                                        matchingCustomer.name,
                                                                      );
                                                                      updateEditableInvoiceField(
                                                                        "customerPhone",
                                                                        matchingCustomer.phone ||
                                                                          "",
                                                                      );
                                                                      updateEditableInvoiceField(
                                                                        "customerTaxCode",
                                                                        matchingCustomer.customerTaxCode ||
                                                                          "",
                                                                      );
                                                                      updateEditableInvoiceField(
                                                                        "customerAddress",
                                                                        matchingCustomer.address ||
                                                                          "",
                                                                      );
                                                                      updateEditableInvoiceField(
                                                                        "customerEmail",
                                                                        matchingCustomer.email ||
                                                                          "",
                                                                      );
                                                                    }
                                                                  }
                                                                }}
                                                                className="w-40"
                                                                disabled={
                                                                  selectedInvoice.displayStatus ===
                                                                  1
                                                                }
                                                                placeholder={
                                                                  !Array.isArray(
                                                                    customers,
                                                                  ) ||
                                                                  customers.length ===
                                                                    0
                                                                    ? "Đang tải..."
                                                                    : "Chọn hoặc nhập tên"
                                                                }
                                                              />
                                                              {Array.isArray(
                                                                customers,
                                                              ) &&
                                                                customers.length >
                                                                  0 && (
                                                                  <datalist id="customer-list-datalist">
                                                                    {customers.map(
                                                                      (
                                                                        customer: any,
                                                                      ) => (
                                                                        <option
                                                                          key={
                                                                            customer.id
                                                                          }
                                                                          value={
                                                                            customer.name
                                                                          }
                                                                        >
                                                                          {
                                                                            customer.customerId
                                                                          }{" "}
                                                                          -{" "}
                                                                          {
                                                                            customer.name
                                                                          }{" "}
                                                                          (
                                                                          {
                                                                            customer.phone
                                                                          }
                                                                          )
                                                                        </option>
                                                                      ),
                                                                    )}
                                                                  </datalist>
                                                                )}
                                                            </>
                                                          ) : (
                                                            selectedInvoice.customerName ||
                                                            "Khách hàng"
                                                          )}
                                                        </td>
                                                        <td className="py-1 pr-4 font-medium whitespace-nowrap">
                                                          Điện thoại:
                                                        </td>
                                                        <td className="py-1 pr-6">
                                                          {isEditing &&
                                                          editableInvoice ? (
                                                            <Input
                                                              value={
                                                                editableInvoice.customerPhone ||
                                                                ""
                                                              }
                                                              onChange={(e) => {
                                                                updateEditableInvoiceField(
                                                                  "customerPhone",
                                                                  e.target
                                                                    .value,
                                                                );
                                                              }}
                                                              className="w-32"
                                                              disabled={
                                                                selectedInvoice.displayStatus ===
                                                                1
                                                              }
                                                              placeholder="Số điện thoại"
                                                            />
                                                          ) : (
                                                            <span className="text-sm">
                                                              {selectedInvoice.customerPhone ||
                                                                "-"}
                                                            </span>
                                                          )}
                                                        </td>
                                                        <td className="py-1 pr-4 font-medium whitespace-nowrap">
                                                          Bàn:
                                                        </td>
                                                        <td className="py-1 pr-6">
                                                          {selectedInvoice.salesChannel ===
                                                            "table" &&
                                                          selectedInvoice.tableId
                                                            ? getTableNumber(
                                                                selectedInvoice.tableId,
                                                              )
                                                            : "-"}
                                                        </td>
                                                        <td className="py-1 pr-4 font-medium whitespace-nowrap">
                                                          Trạng thái:
                                                        </td>
                                                        <td className="py-1">
                                                          {(() => {
                                                            const statusLabels =
                                                              {
                                                                1: `${t("common.completed")}`,
                                                                2: `${t("common.serving")}`,
                                                                3: `${t("common.cancelled")}`,
                                                              };
                                                            return (
                                                              statusLabels[
                                                                selectedInvoice
                                                                  .displayStatus
                                                              ] ||
                                                              "Đang phục vụ"
                                                            );
                                                          })()}
                                                        </td>
                                                      </tr>
                                                      <tr>
                                                        <td className="py-1 pr-4 font-medium whitespace-nowrap">
                                                          Thu ngân:
                                                        </td>
                                                        <td className="py-1 pr-6"></td>
                                                        {storeSettings?.businessType ===
                                                          "laundry" && (
                                                          <>
                                                            <td className="py-1 pr-4 font-medium whitespace-nowrap">
                                                              Đã trả đồ:
                                                            </td>
                                                            <td className="py-1 pr-6">
                                                              {isEditing &&
                                                              editableInvoice ? (
                                                                <Checkbox
                                                                  checked={
                                                                    editableInvoice.isPaid ||
                                                                    false
                                                                  }
                                                                  onCheckedChange={(
                                                                    checked,
                                                                  ) => {
                                                                    console.log(
                                                                      "✅ isPaid checkbox changed to:",
                                                                      checked,
                                                                    );
                                                                    updateEditableInvoiceField(
                                                                      "isPaid",
                                                                      checked as boolean,
                                                                    );
                                                                  }}
                                                                />
                                                              ) : (
                                                                <Badge
                                                                  className={
                                                                    selectedInvoice?.isPaid
                                                                      ? "bg-green-100 text-green-800"
                                                                      : "bg-gray-100 text-gray-600"
                                                                  }
                                                                >
                                                                  {selectedInvoice?.isPaid
                                                                    ? "Đã trả"
                                                                    : "Chưa trả"}
                                                                </Badge>
                                                              )}
                                                            </td>
                                                          </>
                                                        )}
                                                        <td className="py-1 pr-4 font-medium whitespace-nowrap">
                                                          Hình thức bán:
                                                        </td>
                                                        <td className="py-1 pr-6">
                                                          {(() => {
                                                            const salesChannel =
                                                              selectedInvoice.salesChannel;
                                                            if (
                                                              salesChannel ===
                                                              "table"
                                                            )
                                                              return "Ăn tại chỗ";
                                                            if (
                                                              salesChannel ===
                                                              "pos"
                                                            )
                                                              return "Bán tại quầy";
                                                            if (
                                                              salesChannel ===
                                                              "online"
                                                            )
                                                              return "Bán online";
                                                            if (
                                                              salesChannel ===
                                                              "delivery"
                                                            )
                                                              return "Giao hàng";
                                                            return "Ăn tại chỗ";
                                                          })()}
                                                        </td>
                                                        <td className="py-1 pr-4 font-medium whitespace-nowrap">
                                                          Ký hiệu hóa đơn:
                                                        </td>
                                                        <td className="py-1 pr-6">
                                                          {isEditing &&
                                                          editableInvoice ? (
                                                            <Input
                                                              value={
                                                                editableInvoice.symbol ||
                                                                ""
                                                              }
                                                              onChange={(e) =>
                                                                updateEditableInvoiceField(
                                                                  "symbol",
                                                                  e.target
                                                                    .value,
                                                                )
                                                              }
                                                              className="w-24"
                                                              disabled={
                                                                selectedInvoice.displayStatus ===
                                                                1
                                                              }
                                                            />
                                                          ) : (
                                                            selectedInvoice.symbol ||
                                                            "-"
                                                          )}
                                                        </td>
                                                        <td className="py-1 pr-4 font-medium whitespace-nowrap">
                                                          Số hóa đơn:
                                                        </td>
                                                        <td className="py-1 pr-6">
                                                          {isEditing &&
                                                          editableInvoice ? (
                                                            <Input
                                                              value={
                                                                editableInvoice.invoiceNumber ||
                                                                ""
                                                              }
                                                              onChange={(e) =>
                                                                updateEditableInvoiceField(
                                                                  "invoiceNumber",
                                                                  e.target
                                                                    .value,
                                                                )
                                                              }
                                                              className="w-32"
                                                              disabled={
                                                                selectedInvoice.displayStatus ===
                                                                1
                                                              }
                                                              placeholder="Nhập số hóa đơn"
                                                            />
                                                          ) : (
                                                            <span className="font-medium text-blue-600">
                                                              {selectedInvoice.invoiceNumber ||
                                                                "-"}
                                                            </span>
                                                          )}
                                                        </td>
                                                        <td className="py-1 pr-4 font-medium whitespace-nowrap">
                                                          {t(
                                                            "common.invoiceStatusLabel",
                                                          )}
                                                        </td>
                                                        <td className="py-1">
                                                          {(() => {
                                                            const statusLabels =
                                                              {
                                                                0: "Chưa phát hành",
                                                                1: "Đã phát hành",
                                                              };
                                                            return (
                                                              statusLabels[
                                                                selectedInvoice.einvoiceStatus ||
                                                                  0
                                                              ] ||
                                                              "Chưa phát hành"
                                                            );
                                                          })()}
                                                        </td>
                                                      </tr>
                                                    </tbody>
                                                  </table>
                                                </div>
                                              </div>

                                              <div>
                                                <h4 className="font-medium mb-3">
                                                  {t("common.itemList")}
                                                </h4>
                                                {orderItemsLoading ? (
                                                  <div className="text-center py-8">
                                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto"></div>
                                                    <p className="mt-2 text-gray-500">
                                                      Đang tải sản phẩm...
                                                    </p>
                                                  </div>
                                                ) : orderItemsError ? (
                                                  <div className="text-center py-8">
                                                    <div className="text-red-500 mb-4">
                                                      <X className="w-8 h-8 mx-auto mb-2" />
                                                      <p className="font-medium">
                                                        Lỗi tải dữ liệu sản phẩm
                                                      </p>
                                                    </div>
                                                    <p className="text-gray-500 mb-4">
                                                      Không thể tải danh sách
                                                      sản phẩm. Vui lòng thử
                                                      lại.
                                                    </p>
                                                    <Button
                                                      onClick={() => {
                                                        queryClient.invalidateQueries(
                                                          {
                                                            queryKey: [
                                                              "https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/order-items",
                                                              selectedInvoice?.id,
                                                            ],
                                                          },
                                                        );
                                                      }}
                                                      size="sm"
                                                    >
                                                      Thử lại
                                                    </Button>
                                                  </div>
                                                ) : !orderItems ||
                                                  orderItems.length === 0 ? (
                                                  <div className="text-center py-8">
                                                    <Package className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                                                    <p className="text-gray-500">
                                                      Không có sản phẩm nào
                                                    </p>
                                                  </div>
                                                ) : (
                                                  <div className="border rounded-lg overflow-x-auto">
                                                    <table className="w-full text-sm min-w-[1200px]">
                                                      <thead>
                                                        <tr className="bg-gray-50 border-b">
                                                          <th className="text-center px-3 py-2 border-r font-medium text-xs whitespace-nowrap w-[50px]">
                                                            STT
                                                          </th>
                                                          <th className="text-left px-3 py-2 border-r font-medium text-xs whitespace-nowrap w-[120px]">
                                                            Mã hàng
                                                          </th>
                                                          <th className="text-left px-3 py-2 border-r font-medium text-xs whitespace-nowrap w-[150px]">
                                                            Tên hàng hóa
                                                          </th>
                                                          <th className="text-center px-3 py-2 border-r font-medium text-xs whitespace-nowrap w-[80px]">
                                                            Đơn vị
                                                          </th>
                                                          <th className="text-center px-3 py-2 border-r font-medium text-xs whitespace-nowrap w-[100px]">
                                                            Số lượng
                                                          </th>
                                                          <th className="text-right px-3 py-2 border-r font-medium text-xs whitespace-nowrap w-[120px]">
                                                            Đơn giá
                                                          </th>
                                                          <th className="text-right px-3 py-2 border-r font-medium text-xs whitespace-nowrap w-[120px]">
                                                            Thành tiền
                                                          </th>
                                                          <th className="text-right px-3 py-2 border-r font-medium text-xs whitespace-nowrap w-[100px]">
                                                            Chiết khấu
                                                          </th>
                                                          <th className="text-right px-3 py-2 border-r font-medium text-xs whitespace-nowrap w-[100px]">
                                                            Tiền thuế
                                                          </th>
                                                          <th className="text-right px-3 py-2 border-r font-medium text-xs whitespace-nowrap w-[120px]">
                                                            Tổng cộng
                                                          </th>
                                                          <th className="text-center px-3 py-2 font-medium text-xs whitespace-nowrap w-[80px]">
                                                            {isEditing &&
                                                            selectedInvoice?.displayStatus !==
                                                              1 &&
                                                            !(
                                                              storeSettings?.businessType ===
                                                                "laundry" &&
                                                              selectedInvoice?.status ===
                                                                "paid"
                                                            ) ? (
                                                              <button
                                                                onClick={
                                                                  handleAddNewOrderItem
                                                                }
                                                                className="text-green-600 hover:text-green-700 font-bold text-lg"
                                                                title="Thêm dòng mới"
                                                              >
                                                                +
                                                              </button>
                                                            ) : (
                                                              ""
                                                            )}
                                                          </th>
                                                        </tr>
                                                      </thead>
                                                      <tbody>
                                                        {(() => {
                                                          // Filter out items marked for deletion
                                                          const visibleItems =
                                                            orderItems.filter(
                                                              (item: any) =>
                                                                !editedOrderItems[
                                                                  item.id
                                                                ]?._deleted,
                                                            );

                                                          if (
                                                            !visibleItems ||
                                                            visibleItems.length ===
                                                              0
                                                          ) {
                                                            return (
                                                              <tr className="border-t">
                                                                <td
                                                                  colSpan={11}
                                                                  className="text-center py-4 text-gray-500"
                                                                >
                                                                  Không có sản
                                                                  phẩm nào
                                                                </td>
                                                              </tr>
                                                            );
                                                          }
                                                          return visibleItems.map(
                                                            (
                                                              item: any,
                                                              index: number,
                                                            ) => {
                                                              const product =
                                                                products.find(
                                                                  (p: any) =>
                                                                    p.id ===
                                                                    item.productId,
                                                                );
                                                              const priceIncludeTax =
                                                                selectedInvoice?.priceIncludeTax ??
                                                                storeSettings?.priceIncludesTax ??
                                                                false;

                                                              // Get edited values or use original
                                                              const editedItem =
                                                                editedOrderItems[
                                                                  item.id
                                                                ] || {};
                                                              const unitPrice =
                                                                parseFloat(
                                                                  editedItem.unitPrice !==
                                                                    undefined
                                                                    ? editedItem.unitPrice
                                                                    : item.unitPrice ||
                                                                        "0",
                                                                );
                                                              const quantity =
                                                                parseInt(
                                                                  editedItem.quantity !==
                                                                    undefined
                                                                    ? editedItem.quantity
                                                                    : item.quantity ||
                                                                        "0",
                                                                );

                                                              const orderDiscount =
                                                                parseFloat(
                                                                  selectedInvoice?.discount ||
                                                                    "0",
                                                                );

                                                              // Get discount from editedOrderItems if available, otherwise calculate
                                                              let itemDiscountAmount = 0;

                                                              if (
                                                                editedItem.discount !==
                                                                undefined
                                                              ) {
                                                                // Use the allocated discount from editedOrderItems
                                                                itemDiscountAmount =
                                                                  parseFloat(
                                                                    editedItem.discount,
                                                                  );
                                                              } else if (
                                                                orderDiscount >
                                                                0
                                                              ) {
                                                                // Calculate total before discount for proportional distribution
                                                                const totalBeforeDiscount =
                                                                  visibleItems.reduce(
                                                                    (
                                                                      sum: number,
                                                                      item,
                                                                    ) => {
                                                                      const editedItem =
                                                                        editedOrderItems[
                                                                          item
                                                                            .id
                                                                        ] || {};
                                                                      const itPrice =
                                                                        parseFloat(
                                                                          editedItem.unitPrice !==
                                                                            undefined
                                                                            ? editedItem.unitPrice
                                                                            : item.unitPrice ||
                                                                                "0",
                                                                        );
                                                                      const itQty =
                                                                        parseInt(
                                                                          editedItem.quantity !==
                                                                            undefined
                                                                            ? editedItem.quantity
                                                                            : item.quantity ||
                                                                                "0",
                                                                        );
                                                                      return (
                                                                        sum +
                                                                        itPrice *
                                                                          itQty
                                                                      );
                                                                    },
                                                                    0,
                                                                  );

                                                                if (
                                                                  totalBeforeDiscount >
                                                                  0
                                                                ) {
                                                                  const isLastItem =
                                                                    index ===
                                                                    visibleItems.length -
                                                                      1;
                                                                  const itemSubtotal =
                                                                    unitPrice *
                                                                    quantity;

                                                                  if (
                                                                    isLastItem
                                                                  ) {
                                                                    // Last item: total discount - sum of all previous discounts
                                                                    const previousDiscounts =
                                                                      visibleItems
                                                                        .slice(
                                                                          0,
                                                                          -1,
                                                                        )
                                                                        .reduce(
                                                                          (
                                                                            sum,
                                                                            item,
                                                                          ) => {
                                                                            const editedItem =
                                                                              editedOrderItems[
                                                                                item
                                                                                  .id
                                                                              ] || {};
                                                                            const itPrice =
                                                                              parseFloat(
                                                                                editedItem.unitPrice !==
                                                                                  undefined
                                                                                  ? editedItem.unitPrice
                                                                                  : item.unitPrice ||
                                                                                      "0",
                                                                              );
                                                                            const itQty =
                                                                              parseInt(
                                                                                editedItem.quantity !==
                                                                                  undefined
                                                                                  ? editedItem.quantity
                                                                                  : item.quantity ||
                                                                                      "0",
                                                                              );
                                                                            const itSubtotal =
                                                                              itPrice *
                                                                              itQty;
                                                                            return (
                                                                              sum +
                                                                              Math.floor(
                                                                                (orderDiscount *
                                                                                  itSubtotal) /
                                                                                  totalBeforeDiscount,
                                                                              )
                                                                            );
                                                                          },
                                                                          0,
                                                                        );
                                                                    itemDiscountAmount =
                                                                      Math.max(
                                                                        0,
                                                                        orderDiscount -
                                                                          previousDiscounts,
                                                                      );
                                                                  } else {
                                                                    itemDiscountAmount =
                                                                      Math.floor(
                                                                        (orderDiscount *
                                                                          itemSubtotal) /
                                                                          totalBeforeDiscount,
                                                                      );
                                                                  }
                                                                }
                                                              }

                                                              // Calculate tax based on priceIncludeTax setting
                                                              const taxRate =
                                                                product?.taxRate
                                                                  ? parseFloat(
                                                                      product.taxRate,
                                                                    ) / 100
                                                                  : 0;
                                                              let itemTax = 0;
                                                              let itemTotal = 0;

                                                              if (
                                                                priceIncludeTax &&
                                                                taxRate > 0
                                                              ) {
                                                                const itemSubtotal =
                                                                  unitPrice *
                                                                  quantity;
                                                                const priceBeforeTax =
                                                                  itemSubtotal /
                                                                  (1 + taxRate);
                                                                itemTax =
                                                                  itemSubtotal -
                                                                  priceBeforeTax;
                                                                itemTotal =
                                                                  itemSubtotal -
                                                                  itemDiscountAmount;
                                                              } else {
                                                                const itemSubtotal =
                                                                  unitPrice *
                                                                  quantity;
                                                                itemTax =
                                                                  itemSubtotal *
                                                                  taxRate;
                                                                itemTotal =
                                                                  itemSubtotal +
                                                                  itemTax -
                                                                  itemDiscountAmount;
                                                              }

                                                              return (
                                                                <tr
                                                                  key={item.id}
                                                                  className="border-b hover:bg-gray-50"
                                                                >
                                                                  <td className="text-center py-2 px-3 border-r text-xs w-[50px]">
                                                                    {index + 1}
                                                                  </td>
                                                                  <td className="text-left py-2 px-3 border-r text-xs w-[120px]">
                                                                    {isEditing ? (
                                                                      <div className="relative">
                                                                        <Input
                                                                          list={`product-sku-list-${item.id}`}
                                                                          value={
                                                                            editedOrderItems[
                                                                              item
                                                                                .id
                                                                            ]
                                                                              ?.sku !==
                                                                            undefined
                                                                              ? editedOrderItems[
                                                                                  item
                                                                                    .id
                                                                                ]
                                                                                  .sku
                                                                              : item.sku ||
                                                                                product?.sku ||
                                                                                ""
                                                                          }
                                                                          disabled={
                                                                            selectedInvoice.displayStatus ===
                                                                            1
                                                                          }
                                                                          data-field={`orderitem-sku-${index}`}
                                                                          onChange={(
                                                                            e,
                                                                          ) => {
                                                                            const selectedSku =
                                                                              e
                                                                                .target
                                                                                .value;
                                                                            updateOrderItemField(
                                                                              item.id,
                                                                              "sku",
                                                                              selectedSku,
                                                                            );

                                                                            // Tìm sản phẩm theo SKU
                                                                            const selectedProduct =
                                                                              products.find(
                                                                                (
                                                                                  p: any,
                                                                                ) =>
                                                                                  p.sku ===
                                                                                  selectedSku,
                                                                              );

                                                                            if (
                                                                              selectedProduct
                                                                            ) {
                                                                              // Cập nhật thông tin sản phẩm
                                                                              updateOrderItemField(
                                                                                item.id,
                                                                                "productId",
                                                                                selectedProduct.id,
                                                                              );
                                                                              updateOrderItemField(
                                                                                item.id,
                                                                                "productName",
                                                                                selectedProduct.name,
                                                                              );
                                                                              updateOrderItemField(
                                                                                item.id,
                                                                                "unitPrice",
                                                                                selectedProduct.price,
                                                                              );
                                                                            }
                                                                          }}
                                                                          onKeyDown={(
                                                                            e,
                                                                          ) =>
                                                                            handleOrderItemKeyDown(
                                                                              e,
                                                                              index,
                                                                              "sku",
                                                                            )
                                                                          }
                                                                          className="w-full h-8 text-xs"
                                                                          placeholder="Chọn mã hàng"
                                                                        />
                                                                        <datalist
                                                                          id={`product-sku-list-${item.id}`}
                                                                        >
                                                                          {products
                                                                            .filter(
                                                                              (
                                                                                p: any,
                                                                              ) =>
                                                                                p.isActive &&
                                                                                p.productType !==
                                                                                  4,
                                                                            )
                                                                            .map(
                                                                              (
                                                                                p: any,
                                                                              ) => (
                                                                                <option
                                                                                  key={
                                                                                    p.id
                                                                                  }
                                                                                  value={
                                                                                    p.sku
                                                                                  }
                                                                                >
                                                                                  {
                                                                                    p.sku
                                                                                  }{" "}
                                                                                  -{" "}
                                                                                  {
                                                                                    p.name
                                                                                  }{" "}
                                                                                  (
                                                                                  {formatCurrency(
                                                                                    p.price,
                                                                                  )}

                                                                                  )
                                                                                </option>
                                                                              ),
                                                                            )}
                                                                        </datalist>
                                                                      </div>
                                                                    ) : (
                                                                      <div className="truncate">
                                                                        {item.sku ||
                                                                          product?.sku ||
                                                                          "-"}
                                                                      </div>
                                                                    )}
                                                                  </td>
                                                                  <td className="text-left py-2 px-3 border-r text-xs w-[150px]">
                                                                    {isEditing ? (
                                                                      <div className="relative">
                                                                        <Input
                                                                          list={`product-name-list-${item.id}`}
                                                                          value={
                                                                            editedOrderItems[
                                                                              item
                                                                                .id
                                                                            ]
                                                                              ?.productName !==
                                                                            undefined
                                                                              ? editedOrderItems[
                                                                                  item
                                                                                    .id
                                                                                ]
                                                                                  .productName
                                                                              : item.productName ||
                                                                                ""
                                                                          }
                                                                          disabled={
                                                                            selectedInvoice.displayStatus ===
                                                                            1
                                                                          }
                                                                          data-field={`orderitem-productName-${index}`}
                                                                          onChange={(
                                                                            e,
                                                                          ) => {
                                                                            const selectedName =
                                                                              e
                                                                                .target
                                                                                .value;
                                                                            updateOrderItemField(
                                                                              item.id,
                                                                              "productName",
                                                                              selectedName,
                                                                            );

                                                                            // Tìm sản phẩm theo tên
                                                                            const selectedProduct =
                                                                              products.find(
                                                                                (
                                                                                  p: any,
                                                                                ) =>
                                                                                  p.name ===
                                                                                  selectedName,
                                                                              );

                                                                            if (
                                                                              selectedProduct
                                                                            ) {
                                                                              // Cập nhật thông tin sản phẩm
                                                                              updateOrderItemField(
                                                                                item.id,
                                                                                "productId",
                                                                                selectedProduct.id,
                                                                              );
                                                                              updateOrderItemField(
                                                                                item.id,
                                                                                "sku",
                                                                                selectedProduct.sku,
                                                                              );
                                                                              updateOrderItemField(
                                                                                item.id,
                                                                                "unitPrice",
                                                                                selectedProduct.price,
                                                                              );
                                                                            }
                                                                          }}
                                                                          onKeyDown={(
                                                                            e,
                                                                          ) =>
                                                                            handleOrderItemKeyDown(
                                                                              e,
                                                                              index,
                                                                              "productName",
                                                                            )
                                                                          }
                                                                          className="w-full h-8 text-xs"
                                                                          placeholder="Chọn tên hàng"
                                                                        />
                                                                        <datalist
                                                                          id={`product-name-list-${item.id}`}
                                                                        >
                                                                          {products
                                                                            .filter(
                                                                              (
                                                                                p: any,
                                                                              ) =>
                                                                                p.isActive &&
                                                                                p.productType !==
                                                                                  4,
                                                                            )
                                                                            .map(
                                                                              (
                                                                                p: any,
                                                                              ) => (
                                                                                <option
                                                                                  key={
                                                                                    p.id
                                                                                  }
                                                                                  value={
                                                                                    p.name
                                                                                  }
                                                                                >
                                                                                  {
                                                                                    p.name
                                                                                  }{" "}
                                                                                  -{" "}
                                                                                  {
                                                                                    p.sku
                                                                                  }{" "}
                                                                                  (
                                                                                  {formatCurrency(
                                                                                    p.price,
                                                                                  )}

                                                                                  )
                                                                                </option>
                                                                              ),
                                                                            )}
                                                                        </datalist>
                                                                      </div>
                                                                    ) : (
                                                                      <div className="truncate">
                                                                        {
                                                                          item.productName
                                                                        }
                                                                      </div>
                                                                    )}
                                                                  </td>
                                                                  <td className="text-center py-2 px-3 border-r text-xs w-[80px]">
                                                                    {product?.unit ||
                                                                      "Cái"}
                                                                  </td>
                                                                  <td className="text-center py-2 px-3 border-r text-xs w-[100px]">
                                                                    {isEditing ? (
                                                                      <Input
                                                                        type="number"
                                                                        min="1"
                                                                        value={
                                                                          quantity
                                                                        }
                                                                        data-field={`orderitem-quantity-${index}`}
                                                                        onChange={(
                                                                          e,
                                                                        ) => {
                                                                          const newQty =
                                                                            parseInt(
                                                                              e
                                                                                .target
                                                                                .value,
                                                                            ) ||
                                                                            1;
                                                                          updateOrderItemField(
                                                                            item.id,
                                                                            "quantity",
                                                                            newQty,
                                                                          );
                                                                        }}
                                                                        disabled={
                                                                          selectedInvoice.displayStatus ===
                                                                          1
                                                                        }
                                                                        onBlur={(
                                                                          e,
                                                                        ) => {
                                                                          if (
                                                                            parseInt(
                                                                              e
                                                                                .target
                                                                                .value,
                                                                            ) <
                                                                            1
                                                                          ) {
                                                                            updateOrderItemField(
                                                                              item.id,
                                                                              "quantity",
                                                                              1,
                                                                            );
                                                                          }
                                                                        }}
                                                                        onKeyDown={(
                                                                          e,
                                                                        ) =>
                                                                          handleOrderItemKeyDown(
                                                                            e,
                                                                            index,
                                                                            "quantity",
                                                                          )
                                                                        }
                                                                        className="w-20 text-right h-8"
                                                                      />
                                                                    ) : (
                                                                      quantity
                                                                    )}
                                                                  </td>
                                                                  <td className="text-right py-2 px-3 border-r text-xs w-[120px]">
                                                                    {isEditing ? (
                                                                      <Input
                                                                        type="text"
                                                                        value={Math.floor(
                                                                          unitPrice,
                                                                        ).toLocaleString(
                                                                          "vi-VN",
                                                                        )}
                                                                        disabled={
                                                                          selectedInvoice.displayStatus ===
                                                                          1
                                                                        }
                                                                        data-field={`orderitem-unitPrice-${index}`}
                                                                        onChange={(
                                                                          e,
                                                                        ) => {
                                                                          const value =
                                                                            e.target.value.replace(
                                                                              /[^\d]/g,
                                                                              "",
                                                                            );
                                                                          const newPrice =
                                                                            parseFloat(
                                                                              value,
                                                                            ) ||
                                                                            0;
                                                                          updateOrderItemField(
                                                                            item.id,
                                                                            "unitPrice",
                                                                            newPrice.toString(),
                                                                          );
                                                                        }}
                                                                        onKeyDown={(
                                                                          e,
                                                                        ) =>
                                                                          handleOrderItemKeyDown(
                                                                            e,
                                                                            index,
                                                                            "unitPrice",
                                                                          )
                                                                        }
                                                                        className="w-full text-right h-8"
                                                                      />
                                                                    ) : (
                                                                      Math.floor(
                                                                        unitPrice,
                                                                      ).toLocaleString(
                                                                        "vi-VN",
                                                                      )
                                                                    )}
                                                                  </td>
                                                                  <td className="text-right py-2 px-3 border-r text-xs w-[120px]">
                                                                    {(() => {
                                                                      // Use edited total if available, otherwise calculate from current values
                                                                      const editedItem =
                                                                        editedOrderItems[
                                                                          item
                                                                            .id
                                                                        ] || {};
                                                                      if (
                                                                        editedItem.total !==
                                                                        undefined
                                                                      ) {
                                                                        return Math.floor(
                                                                          parseFloat(
                                                                            editedItem.total,
                                                                          ),
                                                                        ).toLocaleString(
                                                                          "vi-VN",
                                                                        );
                                                                      }
                                                                      return Math.floor(
                                                                        unitPrice *
                                                                          quantity,
                                                                      ).toLocaleString(
                                                                        "vi-VN",
                                                                      );
                                                                    })()}
                                                                  </td>
                                                                  <td className="text-red-600 text-right py-2 px-3 border-r text-xs w-[100px]">
                                                                    {Math.floor(
                                                                      itemDiscountAmount,
                                                                    ).toLocaleString(
                                                                      "vi-VN",
                                                                    )}
                                                                  </td>
                                                                  <td className="text-right py-2 px-3 border-r text-xs w-[100px]">
                                                                    {(() => {
                                                                      // ALWAYS use edited tax if available from state
                                                                      const editedItem =
                                                                        editedOrderItems[
                                                                          item
                                                                            .id
                                                                        ] || {};
                                                                      if (
                                                                        editedItem.tax !==
                                                                        undefined
                                                                      ) {
                                                                        return Math.floor(
                                                                          parseFloat(
                                                                            editedItem.tax,
                                                                          ),
                                                                        ).toLocaleString(
                                                                          "vi-VN",
                                                                        );
                                                                      }
                                                                      // Fallback to calculated itemTax
                                                                      return Math.floor(
                                                                        itemTax,
                                                                      ).toLocaleString(
                                                                        "vi-VN",
                                                                      );
                                                                    })()}
                                                                  </td>
                                                                  <td className="text-right py-2 px-3 border-r font-medium text-xs w-[120px]">
                                                                    {Math.floor(
                                                                      itemTotal,
                                                                    ).toLocaleString(
                                                                      "vi-VN",
                                                                    )}
                                                                  </td>
                                                                  <td className="text-center py-2 px-3 text-xs w-[80px]">
                                                                    {isEditing &&
                                                                      selectedInvoice.displayStatus !==
                                                                        1 && (
                                                                        <Button
                                                                          size="sm"
                                                                          variant="ghost"
                                                                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                                                          onClick={() => {
                                                                            if (
                                                                              window.confirm(
                                                                                `Bạn có chắc chắn muốn xóa "${item.productName}" khỏi đơn hàng?`,
                                                                              )
                                                                            ) {
                                                                              setEditedOrderItems(
                                                                                (
                                                                                  prev,
                                                                                ) => ({
                                                                                  ...prev,
                                                                                  [item.id]:
                                                                                    {
                                                                                      ...prev[
                                                                                        item
                                                                                          .id
                                                                                      ],
                                                                                      _deleted:
                                                                                        true,
                                                                                    },
                                                                                }),
                                                                              );
                                                                            }
                                                                          }}
                                                                        >
                                                                          <X className="h-4 w-4" />
                                                                        </Button>
                                                                      )}
                                                                  </td>
                                                                </tr>
                                                              );
                                                            },
                                                          );
                                                        })()}
                                                      </tbody>
                                                    </table>
                                                  </div>
                                                )}
                                              </div>

                                              <div>
                                                <h4 className="font-medium mb-3">
                                                  {t("common.summary")}
                                                </h4>
                                                <div className="bg-blue-50 p-4 rounded-lg">
                                                  <div className="grid grid-cols-2 gap-8">
                                                    {/* Cột trái - Các trường cũ */}
                                                    <div className="space-y-2 text-sm">
                                                      <div className="flex justify-between items-center">
                                                        <span>
                                                          {t(
                                                            "common.totalPayment",
                                                          )}
                                                          :
                                                        </span>
                                                        <span className="font-bold">
                                                          {formatCurrency(
                                                            Math.floor(
                                                              displayTotals.total,
                                                            ),
                                                          )}
                                                        </span>
                                                      </div>
                                                      <div className="flex justify-between items-center">
                                                        <span>
                                                          {t(
                                                            "common.subtotalAmount",
                                                          )}
                                                          :
                                                        </span>
                                                        <span className="font-bold">
                                                          {formatCurrency(
                                                            Math.floor(
                                                              displayTotals.subtotal,
                                                            ),
                                                          )}
                                                        </span>
                                                      </div>
                                                      {/* Add the new line for pre-tax amount */}
                                                      <div className="flex justify-between">
                                                        <span>
                                                          Tiền trước thuế:
                                                        </span>
                                                        <span className="font-bold">
                                                          {formatCurrency(
                                                            Math.floor(
                                                              displayTotals.subtotal -
                                                                displayTotals.discount,
                                                            ),
                                                          )}
                                                        </span>
                                                      </div>
                                                      <div className="flex justify-between text-red-600">
                                                        <span>Chiết khấu:</span>
                                                        {isEditing &&
                                                        editableInvoice ? (
                                                          <Input
                                                            type="text"
                                                            inputMode="numeric"
                                                            value={parseFloat(
                                                              editableInvoice.discount ||
                                                                "0",
                                                            ).toLocaleString(
                                                              "vi-VN",
                                                            )}
                                                            onFocus={(e) =>
                                                              e.target.select()
                                                            }
                                                            onChange={(e) => {
                                                              const value =
                                                                e.target.value.replace(
                                                                  /[^0-9]/g,
                                                                  "",
                                                                );
                                                              const newDiscount =
                                                                parseFloat(
                                                                  value,
                                                                ) || 0;

                                                              console.log(
                                                                "💰 Thay đổi chiết khấu:",
                                                                {
                                                                  oldDiscount:
                                                                    editableInvoice.discount,
                                                                  newDiscount,
                                                                  orderItems:
                                                                    orderItems.length,
                                                                },
                                                              );

                                                              // Cập nhật chiết khấu đơn hàng
                                                              updateEditableInvoiceField(
                                                                "discount",
                                                                newDiscount.toString(),
                                                              );

                                                              // Phân bổ chiết khấu vào từng mặt hàng theo tỷ lệ thành tiền
                                                              const visibleItems =
                                                                orderItems.filter(
                                                                  (item: any) =>
                                                                    !editedOrderItems[
                                                                      item.id
                                                                    ]?._deleted,
                                                                );

                                                              if (
                                                                visibleItems.length >
                                                                0
                                                              ) {
                                                                // Tính tổng thành tiền trước chiết khấu
                                                                const totalBeforeDiscount =
                                                                  visibleItems.reduce(
                                                                    (
                                                                      sum: number,
                                                                      item: any,
                                                                    ) => {
                                                                      const editedItem =
                                                                        editedOrderItems[
                                                                          item
                                                                            .id
                                                                        ] || {};
                                                                      const unitPrice =
                                                                        parseFloat(
                                                                          editedItem.unitPrice !==
                                                                            undefined
                                                                            ? editedItem.unitPrice
                                                                            : item.unitPrice ||
                                                                                "0",
                                                                        );
                                                                      const quantity =
                                                                        parseInt(
                                                                          editedItem.quantity !==
                                                                            undefined
                                                                            ? editedItem.quantity
                                                                            : item.quantity ||
                                                                                "0",
                                                                        );
                                                                      return (
                                                                        sum +
                                                                        unitPrice *
                                                                          quantity
                                                                      );
                                                                    },
                                                                    0,
                                                                  );

                                                                console.log(
                                                                  "📊 Tổng thành tiền trước CK:",
                                                                  totalBeforeDiscount,
                                                                );

                                                                // Phân bổ chiết khấu theo tỷ lệ
                                                                let allocatedDiscount = 0;
                                                                const newEditedItems =
                                                                  {
                                                                    ...editedOrderItems,
                                                                  };

                                                                visibleItems.forEach(
                                                                  (
                                                                    item: any,
                                                                    index: number,
                                                                  ) => {
                                                                    const editedItem =
                                                                      editedOrderItems[
                                                                        item.id
                                                                      ] || {};
                                                                    const unitPrice =
                                                                      parseFloat(
                                                                        editedItem.unitPrice !==
                                                                          undefined
                                                                          ? editedItem.unitPrice
                                                                          : item.unitPrice ||
                                                                              "0",
                                                                      );
                                                                    const quantity =
                                                                      parseInt(
                                                                        editedItem.quantity !==
                                                                          undefined
                                                                          ? editedItem.quantity
                                                                          : item.quantity ||
                                                                              "0",
                                                                      );
                                                                    const itemSubtotal =
                                                                      unitPrice *
                                                                      quantity;

                                                                    let itemDiscount = 0;
                                                                    if (
                                                                      index ===
                                                                      visibleItems.length -
                                                                        1
                                                                    ) {
                                                                      // Mặt hàng cuối cùng: nhận phần CK còn lại
                                                                      itemDiscount =
                                                                        Math.max(
                                                                          0,
                                                                          Math.floor(
                                                                            newDiscount -
                                                                              allocatedDiscount,
                                                                          ),
                                                                        );
                                                                    } else {
                                                                      // Các mặt hàng khác: phân bổ theo tỷ lệ
                                                                      itemDiscount =
                                                                        totalBeforeDiscount >
                                                                        0
                                                                          ? Math.floor(
                                                                              (newDiscount *
                                                                                itemSubtotal) /
                                                                                totalBeforeDiscount,
                                                                            )
                                                                          : 0;
                                                                      allocatedDiscount +=
                                                                        itemDiscount;
                                                                    }

                                                                    console.log(
                                                                      `📦 Mặt hàng ${index + 1} (${item.productName}):`,
                                                                      {
                                                                        itemSubtotal,
                                                                        itemDiscount,
                                                                        allocatedDiscount,
                                                                      },
                                                                    );

                                                                    // Lưu chiết khấu đã phân bổ cho mặt hàng
                                                                    newEditedItems[
                                                                      item.id
                                                                    ] = {
                                                                      ...newEditedItems[
                                                                        item.id
                                                                      ],
                                                                      discount:
                                                                        itemDiscount.toString(),
                                                                    };
                                                                  },
                                                                );

                                                                setEditedOrderItems(
                                                                  newEditedItems,
                                                                );

                                                                console.log(
                                                                  "✅ Phân bổ CK hoàn tất:",
                                                                  {
                                                                    totalDiscount:
                                                                      newDiscount,
                                                                    totalBeforeDiscount,
                                                                    allocatedDiscount,
                                                                    itemCount:
                                                                      visibleItems.length,
                                                                    editedItems:
                                                                      newEditedItems,
                                                                  },
                                                                );
                                                              }
                                                            }}
                                                            className="h-7 text-xs w-32 text-right font-bold text-red-600 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                            disabled={
                                                              selectedInvoice.displayStatus ===
                                                              1
                                                            }
                                                          />
                                                        ) : (
                                                          <span className="font-bold">
                                                            -
                                                            {formatCurrency(
                                                              Math.floor(
                                                                displayTotals.discount,
                                                              ),
                                                            )}
                                                          </span>
                                                        )}
                                                      </div>
                                                      <div className="flex justify-between">
                                                        <span>
                                                          {t("common.totalTax")}
                                                          :
                                                        </span>
                                                        <span className="font-bold">
                                                          {formatCurrency(
                                                            Math.floor(
                                                              displayTotals.tax,
                                                            ),
                                                          )}
                                                        </span>
                                                      </div>
                                                    </div>

                                                    {/* Cột phải - Khách hàng trả và Phương thức thanh toán */}
                                                    <div className="space-y-2 text-sm">
                                                      {storeSettings?.businessType ===
                                                        "laundry" && (
                                                        <div className="flex justify-between items-center">
                                                          <span className="font-semibold text-gray-700">
                                                            Khách hàng trả:
                                                          </span>
                                                          <span className="font-bold text-green-600">
                                                            {formatCurrency(
                                                              Math.floor(
                                                                displayTotals.total,
                                                              ),
                                                            )}
                                                          </span>
                                                        </div>
                                                      )}
                                                      <div className="flex justify-between items-center">
                                                        <span className="font-semibold text-gray-700">
                                                          Phương thức thanh
                                                          toán:
                                                        </span>
                                                        <span className="font-bold text-blue-600">
                                                          {(() => {
                                                            const paymentMethod =
                                                              selectedInvoice.paymentMethod;
                                                            try {
                                                              if (
                                                                paymentMethod &&
                                                                typeof paymentMethod ===
                                                                  "string"
                                                              ) {
                                                                const parsed =
                                                                  JSON.parse(
                                                                    paymentMethod,
                                                                  );
                                                                if (
                                                                  Array.isArray(
                                                                    parsed,
                                                                  ) &&
                                                                  parsed.length >
                                                                    0
                                                                ) {
                                                                  return "Nhiều phương thức";
                                                                }
                                                              }
                                                            } catch (e) {}
                                                            return getPaymentMethodName(
                                                              selectedInvoice.paymentMethod,
                                                            );
                                                          })()}
                                                        </span>
                                                      </div>
                                                    </div>
                                                  </div>
                                                </div>
                                              </div>

                                              <div>
                                                <label className="block text-sm font-medium mb-2">
                                                  {t("common.notes")}
                                                </label>
                                                {isEditing &&
                                                editableInvoice ? (
                                                  <textarea
                                                    value={
                                                      editableInvoice.notes ||
                                                      ""
                                                    }
                                                    onChange={(e) =>
                                                      updateEditableInvoiceField(
                                                        "notes",
                                                        e.target.value,
                                                      )
                                                    }
                                                    className="w-full p-3 border rounded min-h-[80px] resize-none"
                                                    placeholder="Nhập ghi chú..."
                                                    disabled={
                                                      selectedInvoice.displayStatus ===
                                                      1
                                                    }
                                                  />
                                                ) : (
                                                  <div className="p-3 bg-gray-50 rounded border min-h-[80px]">
                                                    {selectedInvoice.notes ||
                                                      t("common.noNotes")}
                                                  </div>
                                                )}
                                              </div>

                                              <div className="flex gap-2 pt-4 border-t">
                                                {!isEditing ? (
                                                  <>
                                                    {/* Nút Hủy đơn: hiển thị khi order.status != 'cancelled' && order.status != 'paid' */}
                                                    {selectedInvoice.status !==
                                                      "cancelled" &&
                                                      selectedInvoice.status !==
                                                        "paid" && (
                                                        <Button
                                                          variant="destructive"
                                                          size="sm"
                                                          onClick={() =>
                                                            setShowCancelDialog(
                                                              true,
                                                            )
                                                          }
                                                        >
                                                          {t(
                                                            "common.cancelOrder",
                                                          )}
                                                        </Button>
                                                      )}

                                                    {/* Nút Sửa đơn: logic phức tạp dựa vào businessType và isPaid */}
                                                    {(() => {
                                                      const canEdit =
                                                        selectedInvoice.status !==
                                                          "cancelled" &&
                                                        selectedInvoice.status !==
                                                          "paid";
                                                      const isLaundry =
                                                        storeSettings?.businessType ===
                                                        "laundry";
                                                      const canEditLaundry =
                                                        (selectedInvoice.status !==
                                                          "cancelled" ||
                                                          selectedInvoice.status ===
                                                            "paid") &&
                                                        selectedInvoice.isPaid ===
                                                          false;

                                                      if (isLaundry) {
                                                        // Với laundry: cho phép sửa nếu chưa cancelled và chưa paid
                                                        if (canEditLaundry) {
                                                          return (
                                                            <Button
                                                              onClick={() =>
                                                                handleEditOrder(
                                                                  selectedInvoice,
                                                                )
                                                              }
                                                              size="sm"
                                                            >
                                                              {t(
                                                                "common.editOrder",
                                                              )}
                                                            </Button>
                                                          );
                                                        }
                                                      } else {
                                                        // Với business khác: chỉ cho sửa khi canEdit
                                                        if (canEdit) {
                                                          return (
                                                            <Button
                                                              onClick={() =>
                                                                handleEditOrder(
                                                                  selectedInvoice,
                                                                )
                                                              }
                                                              size="sm"
                                                            >
                                                              {t(
                                                                "common.editOrder",
                                                              )}
                                                            </Button>
                                                          );
                                                        }
                                                      }
                                                      return null;
                                                    })()}

                                                    {/* Nút Thanh toán: hiển thị khi order.status != 'cancelled' && order.status != 'paid' */}
                                                    {selectedInvoice.status !==
                                                      "cancelled" &&
                                                      selectedInvoice.status !==
                                                        "paid" && (
                                                        <Button
                                                          onClick={async () => {
                                                            if (
                                                              !selectedInvoice
                                                            ) {
                                                              toast({
                                                                title: "Lỗi",
                                                                description:
                                                                  "Vui lòng chọn đơn hàng",
                                                                variant:
                                                                  "destructive",
                                                              });
                                                              return;
                                                            }

                                                            try {
                                                              // Fetch fresh order items
                                                              const itemsResponse =
                                                                await apiRequest(
                                                                  "GET",
                                                                  `https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/order-items/${selectedInvoice.id}`,
                                                                );
                                                              const items =
                                                                await itemsResponse.json();

                                                              // Prepare order data for payment
                                                              const orderForPayment =
                                                                {
                                                                  ...selectedInvoice,
                                                                  orderItems:
                                                                    items,
                                                                  items:
                                                                    items.map(
                                                                      (
                                                                        item: any,
                                                                      ) => ({
                                                                        id: item.id,
                                                                        productId:
                                                                          item.productId,
                                                                        productName:
                                                                          item.productName,
                                                                        price:
                                                                          item.unitPrice,
                                                                        quantity:
                                                                          item.quantity,
                                                                        total:
                                                                          item.total,
                                                                        discount:
                                                                          item.discount ||
                                                                          "0",
                                                                        sku:
                                                                          item.productSku ||
                                                                          item.sku ||
                                                                          `SKU${item.productId}`,
                                                                        taxRate:
                                                                          parseFloat(
                                                                            item.taxRate ||
                                                                              "0",
                                                                          ),
                                                                      }),
                                                                    ),
                                                                  exactSubtotal:
                                                                    parseFloat(
                                                                      selectedInvoice.subtotal ||
                                                                        "0",
                                                                    ),
                                                                  exactTax:
                                                                    parseFloat(
                                                                      selectedInvoice.tax ||
                                                                        "0",
                                                                    ),
                                                                  exactDiscount:
                                                                    parseFloat(
                                                                      selectedInvoice.discount ||
                                                                        "0",
                                                                    ),
                                                                  exactTotal:
                                                                    parseFloat(
                                                                      selectedInvoice.total ||
                                                                        "0",
                                                                    ),
                                                                };

                                                              // Open payment method modal first
                                                              setOrderForPayment(
                                                                orderForPayment,
                                                              );
                                                              setShowPaymentMethodModal(
                                                                true,
                                                              );
                                                            } catch (error) {
                                                              console.error(
                                                                "❌ Error preparing payment:",
                                                                error,
                                                              );
                                                              toast({
                                                                title: "Lỗi",
                                                                description:
                                                                  "Không thể tải thông tin đơn hàng",
                                                                variant:
                                                                  "destructive",
                                                              });
                                                            }
                                                          }}
                                                          className="bg-green-600 hover:bg-green-700 text-white"
                                                        >
                                                          <CreditCard className="w-4 h-4 mr-2" />
                                                          Thanh toán
                                                        </Button>
                                                      )}

                                                    {/* Nút Phát hành hóa đơn: hiển thị khi order.status != 'cancelled' && order.status == 'paid' && einvoiceStatus == 0 */}
                                                    {selectedInvoice.status !==
                                                      "cancelled" &&
                                                      selectedInvoice.status ===
                                                        "paid" &&
                                                      selectedInvoice.einvoiceStatus ===
                                                        0 &&
                                                      storeSettings?.businessType !==
                                                        "laundry" && (
                                                        <Button
                                                          onClick={() =>
                                                            setShowEInvoiceModal(
                                                              true,
                                                            )
                                                          }
                                                          variant="outline"
                                                          size="sm"
                                                          className="border-green-500 text-green-600 hover:bg-green-50"
                                                        >
                                                          Phát hành hóa đơn
                                                        </Button>
                                                      )}

                                                    {/* Nút In hóa đơn: hiển thị khi order.status != 'paid' */}
                                                    {selectedInvoice.status ===
                                                      "paid" && (
                                                      <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => {
                                                          setSelectedReceipt({
                                                            ...selectedInvoice,
                                                            items: orderItems,
                                                          });
                                                          setShowReceiptModal(
                                                            true,
                                                          );
                                                        }}
                                                        className="border-blue-500 text-blue-600 hover:bg-blue-50"
                                                      >
                                                        <Printer className="w-4 h-4 mr-2" />
                                                        {t(
                                                          "common.printInvoice",
                                                        )}
                                                      </Button>
                                                    )}

                                                    {/* Nút Đóng: luôn hiển thị */}
                                                    <Button
                                                      size="sm"
                                                      variant="outline"
                                                      onClick={() =>
                                                        setSelectedInvoice(null)
                                                      }
                                                    >
                                                      {t("common.close")}
                                                    </Button>
                                                  </>
                                                ) : (
                                                  <>
                                                    {/* Chế độ editing: chỉ hiển thị Lưu và Hủy */}
                                                    {(() => {
                                                      const isLaundry =
                                                        storeSettings?.businessType ===
                                                        "laundry";
                                                      const isPaidOrder =
                                                        selectedInvoice.status ===
                                                        "paid";

                                                      // Nếu là laundry và đơn đã paid, chỉ cho phép sửa isPaid
                                                      if (
                                                        isLaundry &&
                                                        isPaidOrder
                                                      ) {
                                                        return (
                                                          <>
                                                            <Button
                                                              onClick={
                                                                handleSaveOrder
                                                              }
                                                              size="sm"
                                                              disabled={
                                                                updateOrderMutation.isPending
                                                              }
                                                            >
                                                              {updateOrderMutation.isPending
                                                                ? t(
                                                                    "common.saving",
                                                                  )
                                                                : t(
                                                                    "common.save",
                                                                  )}
                                                            </Button>
                                                            <Button
                                                              onClick={
                                                                handleCancelEdit
                                                              }
                                                              variant="outline"
                                                              size="sm"
                                                            >
                                                              {t(
                                                                "common.cancel",
                                                              )}
                                                            </Button>
                                                          </>
                                                        );
                                                      }

                                                      // Trường hợp bình thường: hiển thị Lưu và Hủy
                                                      return (
                                                        <>
                                                          <Button
                                                            onClick={
                                                              handleSaveOrder
                                                            }
                                                            size="sm"
                                                            disabled={
                                                              updateOrderMutation.isPending
                                                            }
                                                          >
                                                            {updateOrderMutation.isPending
                                                              ? t(
                                                                  "common.saving",
                                                                )
                                                              : t(
                                                                  "common.save",
                                                                )}
                                                          </Button>
                                                          <Button
                                                            onClick={
                                                              handleCancelEdit
                                                            }
                                                            variant="outline"
                                                            size="sm"
                                                          >
                                                            {t("common.cancel")}
                                                          </Button>
                                                        </>
                                                      );
                                                    })()}
                                                  </>
                                                )}
                                              </div>
                                            </CardContent>
                                          </Card>
                                        </div>
                                      </td>
                                    </tr>
                                  )}
                              </>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex justify-between items-center mt-4">
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-gray-600">
                        {t("common.itemsPerPage")}:
                      </span>
                      <select
                        value={itemsPerPage}
                        onChange={(e) => {
                          setItemsPerPage(parseInt(e.target.value, 10));
                          setCurrentPage(1);
                        }}
                        className="border rounded p-1 text-sm"
                      >
                        <option value={10}>10</option>
                        <option value={20}>20</option>
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                      </select>
                    </div>
                    <div className="flex items-center gap-1">
                      {(() => {
                        const totalPagesForPagination =
                          Math.ceil(filteredInvoices.length / itemsPerPage) ||
                          1;

                        if (totalPagesForPagination <= 7) {
                          return Array.from(
                            { length: totalPagesForPagination },
                            (_, i) => i + 1,
                          ).map((pageNum) => (
                            <Button
                              key={pageNum}
                              variant={
                                currentPage === pageNum ? "default" : "outline"
                              }
                              size="sm"
                              onClick={() => setCurrentPage(pageNum)}
                              className="w-8 h-8 p-0 text-sm"
                            >
                              {pageNum}
                            </Button>
                          ));
                        }

                        const pages = [];

                        pages.push(1);

                        if (currentPage > 4) {
                          pages.push("...");
                        }

                        const start = Math.max(2, currentPage - 1);
                        const end = Math.min(
                          totalPagesForPagination - 1,
                          currentPage + 1,
                        );

                        for (let i = start; i <= end; i++) {
                          if (i !== 1 && i !== totalPagesForPagination) {
                            pages.push(i);
                          }
                        }

                        if (currentPage < totalPagesForPagination - 3) {
                          pages.push("...");
                        }

                        if (totalPagesForPagination > 1) {
                          pages.push(totalPagesForPagination);
                        }

                        return pages.map((pageNumber, index) => {
                          if (pageNumber === "...") {
                            return (
                              <span
                                key={`ellipsis-${index}`}
                                className="px-2 text-gray-500 text-sm"
                              >
                                ...
                              </span>
                            );
                          }

                          return (
                            <Button
                              key={pageNumber}
                              variant={
                                currentPage === pageNumber
                                  ? "default"
                                  : "outline"
                              }
                              size="sm"
                              onClick={() =>
                                setCurrentPage(pageNumber as number)
                              }
                              className="w-8 h-8 p-0 text-sm"
                            >
                              {pageNumber}
                            </Button>
                          );
                        });
                      })()}
                    </div>
                  </div>

                  <div className="mt-4 border-t bg-blue-50 p-3 rounded text-center">
                    <div className="grid grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="font-medium">
                          {t("common.subtotalAmount")}:
                        </span>
                        <div className="font-bold text-blue-600">
                          {formatCurrency(displayTotals.subtotal)}
                        </div>
                      </div>
                      <div>
                        <span className="font-medium">
                          {t("common.discount")}:
                        </span>
                        <div className="font-bold text-red-600">
                          -{formatCurrency(displayTotals.discount || 0)}
                        </div>
                      </div>
                      <div>
                        <span className="font-medium">
                          {t("common.totalTax")}:
                        </span>
                        <div className="font-bold text-orange-600">
                          {formatCurrency(displayTotals.tax)}
                        </div>
                      </div>
                      <div>
                        <span className="font-medium">
                          {t("common.grandTotal")}:
                        </span>
                        <div className="font-bold text-green-600">
                          {formatCurrency(displayTotals.total)}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
      {/* Bulk Cancel Confirmation Dialog */}
      <AlertDialog
        open={showBulkCancelDialog}
        onOpenChange={setShowBulkCancelDialog}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hủy đơn hàng bán</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có chắc muốn hủy {selectedOrderIds.size} đơn hàng đã chọn
              không? Hành động này không thể hoàn tác.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Bỏ qua</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (selectedOrderIds.size > 0) {
                  bulkCancelOrdersMutation.mutate(
                    Array.from(selectedOrderIds).map((id) => id.split("-")[1]),
                  ); // Extract order IDs
                }
              }}
              className="bg-red-600 hover:bg-red-700"
            >
              {bulkCancelOrdersMutation.isPending
                ? "Đang hủy..."
                : `Hủy ${selectedOrderIds.size} đơn`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xác nhận hủy đơn hàng</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có chắc chắn muốn hủy đơn hàng{" "}
              {selectedInvoice?.displayNumber} này không? Hành động này không
              thể hoàn tác.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (selectedInvoice) {
                  console.log("Cancelling order:", selectedInvoice.id);
                  cancelOrderMutation.mutate(selectedInvoice.id);
                }
              }}
              className="bg-red-600 hover:bg-red-700"
            >
              {cancelOrderMutation.isPending ? "Đang hủy..." : "Xác nhận hủy"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Payment Method Modal - STEP 2 */}
      {showPaymentMethodModal && orderForPayment && (
        <PaymentMethodModal
          isOpen={showPaymentMethodModal}
          onClose={() => {
            console.log("💳 Closing payment modal from sales-orders");
            setShowPaymentMethodModal(false);
            setOrderForPayment(null);

            // Refresh data after closing
            // queryClient.invalidateQueries({ queryKey: ["https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/orders"] });
          }}
          onSelectMethod={handlePaymentComplete}
          total={
            orderForPayment.exactTotal ||
            parseFloat(orderForPayment.total || "0")
          }
          cartItems={orderForPayment.items || []}
          orderForPayment={orderForPayment}
          products={products}
          getProductName={(productId) => {
            const product = products.find((p: any) => p.id === productId);
            return product?.name || `Product #${productId}`;
          }}
          receipt={{
            exactSubtotal: orderForPayment.exactSubtotal,
            exactTax: orderForPayment.exactTax,
            exactDiscount: orderForPayment.exactDiscount,
            exactTotal: orderForPayment.exactTotal,
            subtotal: orderForPayment.subtotal,
            tax: order.tax, // Corrected to use order.tax from the original order object
            discount: order.discount, // Corrected to use order.discount from the original order object
            total: order.total, // Corrected to use order.total from the original order object
          }}
        />
      )}

      {/* E-Invoice Modal */}
      {showEInvoiceModal && selectedInvoice && (
        <EInvoiceModal
          isOpen={showEInvoiceModal}
          onClose={() => setShowEInvoiceModal(false)}
          order={{
            id: selectedInvoice.id,
            orderNumber:
              selectedInvoice.orderNumber || selectedInvoice.displayNumber,
            customerName: selectedInvoice.customerName || "",
            customerTaxCode: selectedInvoice.customerTaxCode || "",
            customerAddress: selectedInvoice.customerAddress || "",
            customerPhone: selectedInvoice.customerPhone || "",
            customerEmail: selectedInvoice.customerEmail || "",
            subtotal: selectedInvoice.subtotal,
            tax: selectedInvoice.tax,
            total: selectedInvoice.total,
            paymentMethod: selectedInvoice.paymentMethod || 1,
          }}
          items={orderItems || []}
        />
      )}

      {/* Receipt Modal */}
      {showReceiptModal && selectedReceipt && (
        <ReceiptModal
          isOpen={showReceiptModal}
          onClose={() => {
            console.log("🔒 Sales Orders: Receipt modal closed by user");

            // Dispatch intentional close event
            window.dispatchEvent(
              new CustomEvent("receiptModalClosed", {
                detail: {
                  intentionalClose: true,
                  source: "sales_orders_receipt_close",
                },
              }),
            );

            setShowReceiptModal(false);
            setSelectedReceipt(null);

            queryClient.invalidateQueries({ queryKey: ["https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/orders"] });
          }}
          receipt={selectedReceipt}
          isPreview={false}
        />
      )}
    </div>
  );
}