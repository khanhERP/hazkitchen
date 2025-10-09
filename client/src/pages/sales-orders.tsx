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
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { useTranslation } from "@/lib/i18n";
import * as XLSX from "xlsx";
import { EInvoiceModal } from "@/components/pos/einvoice-modal";
import { PrintDialog } from "@/components/pos/print-dialog";
import { ReceiptModal } from "@/components/pos/receipt-modal";
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
  paymentMethod?: string; // Allow string for new payment methods
  paymentStatus: string;
  einvoiceStatus: number;
  notes?: string;
  orderedAt: string;
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
  const [showInvoiceDetails, setShowInvoiceDetails] = useState(false);
  const [showEInvoiceModal, setShowEInvoiceModal] = useState(false);
  const [storeSettings, setStoreSettings] = useState<any>(null); // To store store settings for priceIncludesTax

  // Listen for print completion event
  useEffect(() => {
    const handlePrintCompleted = (event: CustomEvent) => {
      console.log(
        "📄 Sales Orders: Print completed, closing all modals and refreshing",
      );

      // Close all modals
      setSelectedInvoice(null);
      setShowInvoiceDetails(false);
      setShowPublishDialog(false);
      setShowCancelDialog(false);
      setShowPrintDialog(false);
      setShowEInvoiceModal(false);
      setPrintReceiptData(null);

      // Refresh data
      queryClient.invalidateQueries({ queryKey: ["https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/orders"] });
      queryClient.invalidateQueries({ queryKey: ["https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/tables"] });
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
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Handle column sort
  const handleSort = (field: string) => {
    if (sortField === field) {
      // Toggle sort order if same field
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      // New field, default to ascending
      setSortField(field);
      setSortOrder('asc');
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
    retry: 3,
    retryDelay: 1000,
    staleTime: 5000, // Cache for only 5 seconds
    refetchInterval: 10000, // Auto-refresh every 10 seconds
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
    staleTime: 300000, // Cache for 5 minutes
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
    staleTime: 300000, // Cache for 5 minutes
  });

  const getTableNumber = (tableId: number): string => {
    const table = tables.find((t: any) => t.id === tableId);
    // Use table.name if available, fallback to table.number or table.tableNumber
    const tableName = table?.name || table?.number || table?.tableNumber || tableId;

    // Check if tableName already starts with "Bàn" or "Ban" to avoid duplication
    const tableNameStr = String(tableName);
    if (tableNameStr.toLowerCase().startsWith('bàn') || tableNameStr.toLowerCase().startsWith('ban')) {
      return tableNameStr;
    }

    return `Bàn ${tableName}`;
  };

  const isLoading = ordersLoading; // Only orders loading is relevant now
  const hasError = ordersError; // Only orders error is relevant now

  // Query items for selected order
  const { data: orderItems = [] } = useQuery({
    queryKey: ["https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/order-items", selectedInvoice?.id], // selectedInvoice is used here but it's actually an order
    queryFn: async () => {
      if (!selectedInvoice?.id) return [];
      try {
        const response = await apiRequest(
          "GET",
          `https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/order-items/${selectedInvoice.id}`,
        );
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        console.log("Order items loaded:", data);
        return Array.isArray(data) ? data : [];
      } catch (error) {
        console.error("Error fetching order items:", error);
        return [];
      }
    },
    enabled: !!selectedInvoice?.id && getItemType(selectedInvoice) === "order",
    retry: 2,
  });

  // Mutation for updating an order
  const updateOrderMutation = useMutation({
    mutationFn: async (updatedOrder: Order) => {
      const response = await apiRequest(
        "PUT",
        `https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/orders/${updatedOrder.id}`,
        updatedOrder,
      );
      return response.json();
    },
    onSuccess: (data, updatedOrder) => {
      queryClient.invalidateQueries({ queryKey: ["https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/orders"] });
      setIsEditing(false);
      setEditableInvoice(null); // Resetting editableInvoice as it's used for both

      // Update selected order with new data
      if (selectedInvoice) {
        setSelectedInvoice({ ...selectedInvoice, ...updatedOrder });
      }
    },
    onError: (error) => {
      console.error("Error updating order:", error);
      alert(`Lỗi khi cập nhật đơn hàng: ${error.message}`);
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
              sku: item.sku || `SKU${item.productId || item.id}`,
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
    onSuccess: (data, orderId) => {
      console.log("Order cancelled successfully:", orderId);

      setShowCancelDialog(false);

      queryClient.invalidateQueries({ queryKey: ["https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/orders"] });

      // Update selected order if it was cancelled
      if (selectedInvoice && selectedInvoice.id === orderId) {
        setSelectedInvoice({
          ...selectedInvoice,
          status: "cancelled",
        });

        setIsEditing(false);
        setEditableInvoice(null);
      }

      console.log("Order cancelled and status updated");
    },
    onError: (error) => {
      console.error("Error canceling order:", error);
      setShowCancelDialog(false);
      alert(`Lỗi hủy đơn hàng: ${error.message}`);
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

  const getInvoiceStatusBadge = (status: number) => {
    const statusLabels = {
      1: "Hoàn thành",
      2: "Đang phục vụ",
      3: "Đã hủy",
    };

    const statusColors = {
      1: "bg-green-100 text-green-800",
      2: "bg-blue-100 text-blue-800",
      3: "bg-red-100 text-red-800",
    };

    return (
      <Badge
        className={
          statusColors[status as keyof typeof statusColors] || statusColors[1]
        }
      >
        {statusLabels[status as keyof typeof statusLabels] || "Hoàn thành"}
      </Badge>
    );
  };

  // Map orders to a consistent structure similar to Invoice for easier handling
  const combinedData: Invoice[] = Array.isArray(orders)
    ? orders.map((order: Order) => ({
        ...order,
        type: "order" as const,
        date: order.orderedAt,
        displayNumber:
          order.orderNumber || `ORD-${String(order.id).padStart(13, "0")}`,
        // Map order status to invoiceStatus convention
        displayStatus:
          order.status === "paid"
            ? 1
            : order.status === "pending"
              ? 2
              : order.status === "cancelled"
                ? 3
                : 2,
        customerName: order.customerName || "Khách hàng l ",
        invoiceStatus:
          order.status === "paid"
            ? 1
            : order.status === "pending"
              ? 2
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
        invoiceDate: order.orderedAt,
        einvoiceStatus: order.einvoiceStatus || 0,
        // Ensure all fields from Invoice interface are present, even if null/empty
        templateNumber: order.templateNumber || "",
        customerEmail: order.customerEmail || "",
        subtotal: order.subtotal || "0",
        tax: order.tax || "0",
        total: order.total || "0",
        paymentMethod: order.paymentMethod || "cash",
        notes: order.notes || "",
        createdAt: order.orderedAt || order.createdAt, // Use orderedAt as primary, fallback to createdAt
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
                  .includes(customerSearch.toLowerCase()));
            const orderMatch =
              !orderNumberSearch ||
              (item.displayNumber &&
                item.displayNumber
                  .toLowerCase()
                  .includes(orderNumberSearch.toLowerCase()));
            const customerCodeMatch =
              !customerCodeSearch ||
              (item.customerTaxCode &&
                item.customerTaxCode
                  .toLowerCase()
                  .includes(customerCodeSearch.toLowerCase()));

            // Order status filter
            const orderStatusMatch =
              orderStatusFilter === "all" ||
              (orderStatusFilter === "paid" && (item.status === "paid" || item.displayStatus === 1)) ||
              (orderStatusFilter === "pending" && (item.status === "pending" || item.displayStatus === 2)) ||
              (orderStatusFilter === "cancelled" && (item.status === "cancelled" || item.displayStatus === 3));

            // E-invoice status filter
            const einvoiceStatusMatch =
              einvoiceStatusFilter === "all" ||
              (einvoiceStatusFilter === "0" && item.einvoiceStatus === 0) ||
              (einvoiceStatusFilter === "1" && item.einvoiceStatus === 1) ||
              (einvoiceStatusFilter === "2" && item.einvoiceStatus === 2) ||
              (einvoiceStatusFilter === "3" && item.einvoiceStatus === 3) ||
              (einvoiceStatusFilter === "10" && item.einvoiceStatus === 10);

            return customerMatch && orderMatch && customerCodeMatch && orderStatusMatch && einvoiceStatusMatch;
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
              case 'orderNumber':
                aValue = a.displayNumber || '';
                bValue = b.displayNumber || '';
                break;
              case 'createdAt':
                aValue = new Date(a.createdAt || 0).getTime();
                bValue = new Date(b.createdAt || 0).getTime();
                break;
              case 'updatedAt':
                aValue = new Date(a.updatedAt || 0).getTime();
                bValue = new Date(b.updatedAt || 0).getTime();
                break;
              case 'salesChannel':
                aValue = a.salesChannel || '';
                bValue = b.salesChannel || '';
                break;
              case 'customerCode':
                aValue = a.customerCode || a.customerTaxCode || '';
                bValue = b.customerCode || b.customerTaxCode || '';
                break;
              case 'customerName':
                aValue = a.customerName || '';
                bValue = b.customerName || '';
                break;
              case 'subtotal':
                aValue = parseFloat(a.subtotal || '0');
                bValue = parseFloat(b.subtotal || '0');
                break;
              case 'discount':
                aValue = parseFloat(a.discount || '0');
                bValue = parseFloat(b.discount || '0');
                break;
              case 'tax':
                aValue = parseFloat(a.tax || '0');
                bValue = parseFloat(b.tax || '0');
                break;
              case 'total':
                aValue = parseFloat(a.total || '0');
                bValue = parseFloat(b.total || '0');
                break;
              case 'employeeCode':
                aValue = a.employeeId || 0;
                bValue = b.employeeId || 0;
                break;
              case 'employeeName':
                aValue = 'Phạm Vân Duy';
                bValue = 'Phạm Vân Duy';
                break;
              case 'symbol':
                aValue = a.symbol || a.templateNumber || '';
                bValue = b.symbol || b.templateNumber || '';
                break;
              case 'invoiceNumber':
                aValue = a.invoiceNumber || '';
                bValue = b.invoiceNumber || '';
                break;
              case 'notes':
                aValue = a.notes || '';
                bValue = b.notes || '';
                break;
              case 'status':
                aValue = a.displayStatus || 0;
                bValue = b.displayStatus || 0;
                break;
              default:
                aValue = '';
                bValue = '';
            }

            // Compare values
            if (typeof aValue === 'string' && typeof bValue === 'string') {
              const comparison = aValue.localeCompare(bValue, 'vi');
              return sortOrder === 'asc' ? comparison : -comparison;
            } else {
              const comparison = aValue - bValue;
              return sortOrder === 'asc' ? comparison : -comparison;
            }
          }

          // Default sort by date (newest first)
          const dateA = new Date(
            a.orderedAt || a.createdAt || a.date || a.invoiceDate,
          );
          const dateB = new Date(
            b.orderedAt || b.createdAt || b.date || b.invoiceDate,
          );

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

    if (orderParam && filteredInvoices.length > 0 && !selectedInvoice) {
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

      if (matchingOrder) {
        console.log(
          "🎯 Sales Orders: Auto-expanding matching order:",
          matchingOrder.displayNumber,
        );
        setSelectedInvoice(matchingOrder);

        // Clear URL parameter after auto-expand
        const newUrl = window.location.pathname;
        window.history.replaceState({}, "", newUrl);
      }
    }
  }, [filteredInvoices, selectedInvoice]);

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
      return vietnamTime.replace(/(\d{2})\/(\d{2})\/(\d{4}),?\s*(\d{2}):(\d{2}):(\d{2})/, "$1/$2/$3 $4:$5:$6");
    } catch (error) {
      console.error("Error formatting date:", dateStr, error);
      return "";
    }
  };

  const handleEditOrder = () => {
    // Renamed function
    if (selectedInvoice) {
      setEditableInvoice({ ...selectedInvoice });
      setIsEditing(true);
    }
  };

  const handleSaveOrder = () => {
    // Renamed function and mutation
    if (editableInvoice) {
      updateOrderMutation.mutate(editableInvoice as Order); // Cast to Order
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditableInvoice(null);
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
      | "notes",
    value: any,
  ) => {
    if (editableInvoice) {
      setEditableInvoice({
        ...editableInvoice,
        [field]: value,
      });
    }
  };

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

    setSelectedOrderIds(newSelectedIds);
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
        `DB${new Date().getFullYear()}${String(item.id).padStart(6, "0")}`;
      const orderDate = formatDate(item.date);
      const table =
        item.type === "order" && item.tableId ? getTableNumber(item.tableId) : "";
      const customerCode = item.customerTaxCode;
      const customerName = item.customerName || "";
      const subtotal = parseFloat(item.subtotal || "0");
      const discount = parseFloat(item.discount || "0");
      const tax = parseFloat(item.tax || "0");
      const total = parseFloat(item.total || "0");
      const paid = total;
      const employeeCode = item.employeeId || "NV0001";
      const employeeName = "Phạm Vân Duy";
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
                    {t("reports.customerCode")}
                  </label>
                  <Input
                    placeholder={t("reports.customerCodePlaceholder")}
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

          <div className="grid grid-cols-1 gap-6">
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
                      <p className="font-medium">Lỗi kết nối cơ sở dữ liệu</p>
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
                              className="w-[120px] px-3 py-3 text-left font-medium text-sm text-gray-600 cursor-pointer hover:bg-gray-100"
                              onClick={() => handleSort('orderNumber')}
                            >
                              <div className="leading-tight flex items-center gap-1">
                                {t("orders.orderCode")}
                                {sortField === 'orderNumber' && (
                                  <span className="text-blue-600">
                                    {sortOrder === 'asc' ? '↑' : '↓'}
                                  </span>
                                )}
                              </div>
                            </th>
                            <th 
                              className="w-[180px] px-3 py-3 text-left font-medium text-sm text-gray-600 cursor-pointer hover:bg-gray-100"
                              onClick={() => handleSort('createdAt')}
                            >
                              <div className="leading-tight flex items-center gap-1">
                                Ngày tạo đơn
                                {sortField === 'createdAt' && (
                                  <span className="text-blue-600">
                                    {sortOrder === 'asc' ? '↑' : '↓'}
                                  </span>
                                )}
                              </div>
                            </th>
                            <th 
                              className="w-[180px] px-3 py-3 text-left font-medium text-sm text-gray-600 cursor-pointer hover:bg-gray-100"
                              onClick={() => handleSort('updatedAt')}
                            >
                              <div className="leading-tight flex items-center gap-1">
                                Ngày hủy đơn/hoàn thành
                                {sortField === 'updatedAt' && (
                                  <span className="text-blue-600">
                                    {sortOrder === 'asc' ? '↑' : '↓'}
                                  </span>
                                )}
                              </div>
                            </th>
                            <th 
                              className="w-[80px] px-3 py-3 text-left font-medium text-sm text-gray-600 cursor-pointer hover:bg-gray-100"
                              onClick={() => handleSort('salesChannel')}
                            >
                              <div className="leading-tight flex items-center gap-1">
                                {t("orders.orderSource")}
                                {sortField === 'salesChannel' && (
                                  <span className="text-blue-600">
                                    {sortOrder === 'asc' ? '↑' : '↓'}
                                  </span>
                                )}
                              </div>
                            </th>
                            <th 
                              className="w-[120px] px-3 py-3 text-left font-medium text-sm text-gray-600 cursor-pointer hover:bg-gray-100"
                              onClick={() => handleSort('customerCode')}
                            >
                              <div className="leading-tight flex items-center gap-1">
                                {t("orders.customerCode")}
                                {sortField === 'customerCode' && (
                                  <span className="text-blue-600">
                                    {sortOrder === 'asc' ? '↑' : '↓'}
                                  </span>
                                )}
                              </div>
                            </th>
                            <th 
                              className="w-[150px] px-3 py-3 text-left font-medium text-sm text-gray-600 cursor-pointer hover:bg-gray-100"
                              onClick={() => handleSort('customerName')}
                            >
                              <div className="leading-tight flex items-center gap-1">
                                {t("orders.customerName")}
                                {sortField === 'customerName' && (
                                  <span className="text-blue-600">
                                    {sortOrder === 'asc' ? '↑' : '↓'}
                                  </span>
                                )}
                              </div>
                            </th>
                            <th 
                              className="w-[100px] px-3 py-3 text-right font-medium text-sm text-gray-600 cursor-pointer hover:bg-gray-100"
                              onClick={() => handleSort('subtotal')}
                            >
                              <div className="leading-tight flex items-center justify-end gap-1">
                                {t("common.subtotalAmount")}
                                {sortField === 'subtotal' && (
                                  <span className="text-blue-600">
                                    {sortOrder === 'asc' ? '↑' : '↓'}
                                  </span>
                                )}
                              </div>
                            </th>
                            <th 
                              className="w-[80px] px-3 py-3 text-right font-medium text-sm text-gray-600 cursor-pointer hover:bg-gray-100"
                              onClick={() => handleSort('discount')}
                            >
                              <div className="leading-tight flex items-center justify-end gap-1">
                                {t("common.discount")}
                                {sortField === 'discount' && (
                                  <span className="text-blue-600">
                                    {sortOrder === 'asc' ? '↑' : '↓'}
                                  </span>
                                )}
                              </div>
                            </th>
                            <th 
                              className="w-[90px] px-3 py-3 text-right font-medium text-sm text-gray-600 cursor-pointer hover:bg-gray-100"
                              onClick={() => handleSort('tax')}
                            >
                              <div className="leading-tight flex items-center justify-end gap-1">
                                {t("common.tax")}
                                {sortField === 'tax' && (
                                  <span className="text-blue-600">
                                    {sortOrder === 'asc' ? '↑' : '↓'}
                                  </span>
                                )}
                              </div>
                            </th>
                            <th 
                              className="w-[110px] px-3 py-3 text-right font-medium text-sm text-gray-600 cursor-pointer hover:bg-gray-100"
                              onClick={() => handleSort('total')}
                            >
                              <div className="leading-tight flex items-center justify-end gap-1">
                                {t("common.paid")}
                                {sortField === 'total' && (
                                  <span className="text-blue-600">
                                    {sortOrder === 'asc' ? '↑' : '↓'}
                                  </span>
                                )}
                              </div>
                            </th>
                            <th 
                              className="w-[110px] px-3 py-3 text-left font-medium text-sm text-gray-600 cursor-pointer hover:bg-gray-100"
                              onClick={() => handleSort('employeeCode')}
                            >
                              <div className="leading-tight flex items-center gap-1">
                                {t("common.employeeCode")}
                                {sortField === 'employeeCode' && (
                                  <span className="text-blue-600">
                                    {sortOrder === 'asc' ? '↑' : '↓'}
                                  </span>
                                )}
                              </div>
                            </th>
                            <th 
                              className="w-[120px] px-3 py-3 text-left font-medium text-sm text-gray-600 cursor-pointer hover:bg-gray-100"
                              onClick={() => handleSort('employeeName')}
                            >
                              <div className="leading-tight flex items-center gap-1">
                                {t("common.employeeName")}
                                {sortField === 'employeeName' && (
                                  <span className="text-blue-600">
                                    {sortOrder === 'asc' ? '↑' : '↓'}
                                  </span>
                                )}
                              </div>
                            </th>
                            <th 
                              className="w-[120px] px-3 py-3 text-left font-medium text-sm text-gray-600 cursor-pointer hover:bg-gray-100"
                              onClick={() => handleSort('symbol')}
                            >
                              <div className="leading-tight flex items-center gap-1">
                                {t("common.invoiceSymbol")}
                                {sortField === 'symbol' && (
                                  <span className="text-blue-600">
                                    {sortOrder === 'asc' ? '↑' : '↓'}
                                  </span>
                                )}
                              </div>
                            </th>
                            <th 
                              className="w-[110px] px-3 py-3 text-left font-medium text-sm text-gray-600 cursor-pointer hover:bg-gray-100"
                              onClick={() => handleSort('invoiceNumber')}
                            >
                              <div className="leading-tight flex items-center gap-1">
                                {t("common.invoiceNumber")}
                                {sortField === 'invoiceNumber' && (
                                  <span className="text-blue-600">
                                    {sortOrder === 'asc' ? '↑' : '↓'}
                                  </span>
                                )}
                              </div>
                            </th>
                            <th 
                              className="w-[200px] px-3 py-3 text-left font-medium text-sm text-gray-600 cursor-pointer hover:bg-gray-100"
                              onClick={() => handleSort('notes')}
                            >
                              <div className="leading-tight flex items-center gap-1">
                                {t("common.notes")}
                                {sortField === 'notes' && (
                                  <span className="text-blue-600">
                                    {sortOrder === 'asc' ? '↑' : '↓'}
                                  </span>
                                )}
                              </div>
                            </th>
                            <th 
                              className="w-[100px] px-3 py-3 text-center font-medium text-sm text-gray-600 cursor-pointer hover:bg-gray-100"
                              onClick={() => handleSort('status')}
                            >
                              <div className="leading-tight flex items-center justify-center gap-1">
                                {t("common.status")}
                                {sortField === 'status' && (
                                  <span className="text-blue-600">
                                    {sortOrder === 'asc' ? '↑' : '↓'}
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
                                colSpan={17}
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
                              const employeeName = "Phạm Vân Duy";
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
                                        className="font-medium truncate"
                                        title={item.displayNumber}
                                      >
                                        {item.displayNumber}
                                      </div>
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
                                        {formatCurrency(tax)}
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
                                    <td className="px-3 py-3 text-center">
                                      {getInvoiceStatusBadge(
                                        item.displayStatus,
                                      )}
                                    </td>
                                  </tr>
                                  {selectedInvoice &&
                                    selectedInvoice.id === item.id &&
                                    selectedInvoice.type === item.type && (
                                      <tr>
                                        <td colSpan={17} className="p-0">
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
                                                                type="date"
                                                                value={
                                                                  editableInvoice.createdAt?.split(
                                                                    "T",
                                                                  )[0] || ""
                                                                }
                                                                onChange={(e) =>
                                                                  updateEditableInvoiceField(
                                                                    "createdAt",
                                                                    e.target
                                                                      .value,
                                                                  )
                                                                }
                                                                className="w-32"
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
                                                              <Input
                                                                value={
                                                                  editableInvoice.customerName ||
                                                                  ""
                                                                }
                                                                onChange={(e) =>
                                                                  updateEditableInvoiceField(
                                                                    "customerName",
                                                                    e.target
                                                                      .value,
                                                                  )
                                                                }
                                                                className="w-40"
                                                              />
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
                                                                onChange={(e) =>
                                                                  updateEditableInvoiceField(
                                                                    "customerPhone",
                                                                    e.target
                                                                      .value,
                                                                  )
                                                                }
                                                                className="w-32"
                                                              />
                                                            ) : (
                                                              selectedInvoice.customerPhone ||
                                                              "-"
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
                                                                  2: `${(t("common.serving"))}`,
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
                                                          <td className="py-1 pr-6">
                                                            Phạm Vân Duy
                                                          </td>
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
                                                              />
                                                            ) : (
                                                              selectedInvoice.invoiceNumber ||
                                                              selectedInvoice.orderNumber ||
                                                              String(
                                                                selectedInvoice.id,
                                                              ).padStart(8, "0")
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
                                                  <div className="border rounded-lg overflow-hidden">
                                                    <div className="grid grid-cols-12 gap-2 text-xs font-medium text-gray-700 bg-gray-50 p-2">
                                                      <div className="col-span-1">
                                                        STT
                                                      </div>
                                                      <div className="col-span-2">
                                                        {t("common.itemCode")}
                                                      </div>
                                                      <div className="col-span-2">
                                                        {t("common.itemName")}
                                                      </div>
                                                      <div className="col-span-1">
                                                        {t("common.unit")}
                                                      </div>
                                                      <div className="col-span-1">
                                                        {t("common.quantity")}
                                                      </div>
                                                      <div className="col-span-1">
                                                        {t("common.unitPrice")}
                                                      </div>
                                                      <div className="col-span-1">
                                                        {t(
                                                          "common.totalAmountSubtotal",
                                                        )}
                                                      </div>
                                                      <div className="col-span-1">
                                                        {t("reports.discount")}
                                                      </div>
                                                      <div className="col-span-1">
                                                        {t("common.taxVAT")}
                                                      </div>
                                                      <div className="col-span-1">
                                                        {t(
                                                          "common.totalAmount",
                                                        )}
                                                      </div>
                                                    </div>
                                                    {(() => {
                                                      const items = orderItems;
                                                      if (
                                                        !items ||
                                                        items.length === 0
                                                      ) {
                                                        return (
                                                          <div className="text-center py-4 text-gray-500 border-t">
                                                            Không có sản phẩm
                                                            nào
                                                          </div>
                                                        );
                                                      }
                                                      return items.map(
                                                        (
                                                          item: any,
                                                          index: number,
                                                        ) => (
                                                          <div
                                                            key={item.id}
                                                            className="grid grid-cols-12 gap-2 text-xs p-2 border-t hover:bg-gray-50"
                                                          >
                                                            <div className="col-span-1 text-center py-1">
                                                              {index + 1}
                                                            </div>
                                                            <div className="col-span-2 text-left py-1">
                                                              {item.sku || item.productSku || `SP${String(item.productId).padStart(3, "0")}`}
                                                            </div>
                                                            <div
                                                              className="col-span-2 text-left py-1 truncate"
                                                              title={
                                                                item.productName
                                                              }
                                                            >
                                                              {item.productName}
                                                            </div>
                                                            <div className="col-span-1 py-1">
                                                              Cái
                                                            </div>
                                                            <div className="col-span-1 py-1">
                                                              {item.quantity}
                                                            </div>
                                                            <div className="col-span-1 py-1">
                                                              {formatCurrency(
                                                                item.unitPrice,
                                                              )}
                                                            </div>
                                                            <div className="col-span-1 py-1">
                                                              {(() => {
                                                                const unitPrice =
                                                                  parseFloat(
                                                                    item.unitPrice ||
                                                                      "0",
                                                                  );
                                                                const quantity =
                                                                  parseInt(
                                                                    item.quantity ||
                                                                      "0",
                                                                  );

                                                                // Calculate subtotal, tax, and discount for this item
                                                                const itemSubtotal =
                                                                  unitPrice *
                                                                  quantity;

                                                                return formatCurrency(
                                                                  itemSubtotal.toString(),
                                                                );
                                                              })()}
                                                            </div>
                                                            <div className="col-span-1 text-red-600 py-1">
                                                              -
                                                              {formatCurrency(
                                                                item.discount ||
                                                                  "0",
                                                              )}
                                                            </div>
                                                            {(() => {
                                                              const unitPrice =
                                                                parseFloat(
                                                                  item.unitPrice ||
                                                                    "0",
                                                                );
                                                              const quantity =
                                                                parseInt(
                                                                  item.quantity ||
                                                                    "0",
                                                                );
                                                              const itemDiscount =
                                                                parseFloat(
                                                                  item.discount ||
                                                                    "0",
                                                                );
                                                              const priceIncludesTax =
                                                                selectedInvoice?.priceIncludeTax ||
                                                                false;

                                                              // Find the product to get taxRate
                                                              const product =
                                                                Array.isArray(
                                                                  products,
                                                                )
                                                                  ? products.find(
                                                                      (
                                                                        p: any,
                                                                      ) =>
                                                                        p.id ===
                                                                        item.productId,
                                                                    )
                                                                  : null;

                                                              let taxAmount = 0;
                                                              let totalSum = 0;

                                                              if (
                                                                product?.taxRate &&
                                                                parseFloat(
                                                                  product.taxRate,
                                                                ) > 0
                                                              ) {
                                                                const taxRate =
                                                                  parseFloat(
                                                                    product.taxRate,
                                                                  ) / 100;

                                                                if (
                                                                  priceIncludesTax
                                                                ) {
                                                                  // When price includes tax:
                                                                  // giá bao gồm thuế = (price - (discount/quantity)) * quantity
                                                                  const discountPerUnit =
                                                                    itemDiscount /
                                                                    quantity;
                                                                  const adjustedPrice =
                                                                    Math.max(
                                                                      0,
                                                                      unitPrice -
                                                                        discountPerUnit,
                                                                    );
                                                                  const giaGomThue =
                                                                    adjustedPrice *
                                                                    quantity;
                                                                  // subtotal = giá bao gồm thuế / (1 + (taxRate / 100)) (làm tròn)
                                                                  const tamTinh =
                                                                    Math.round(
                                                                      giaGomThue /
                                                                        (1 +
                                                                          taxRate),
                                                                    );
                                                                  // tax = giá bao gồm thuế - subtotal
                                                                  taxAmount =
                                                                    giaGomThue -
                                                                    tamTinh;
                                                                  totalSum =
                                                                    giaGomThue;
                                                                } else {
                                                                  // When price doesn't include tax:
                                                                  // subtotal = (price - (discount/quantity)) * quantity
                                                                  const discountPerUnit =
                                                                    itemDiscount /
                                                                    quantity;
                                                                  const adjustedPrice =
                                                                    Math.max(
                                                                      0,
                                                                      unitPrice -
                                                                        discountPerUnit,
                                                                    );
                                                                  const tamTinh =
                                                                    adjustedPrice *
                                                                    quantity;
                                                                  // tax = subtotal * (taxRate / 100) (làm tròn)
                                                                  taxAmount =
                                                                    Math.round(
                                                                      tamTinh *
                                                                        taxRate,
                                                                    );
                                                                  totalSum =
                                                                    tamTinh +
                                                                    taxAmount;
                                                                }
                                                              }

                                                              return (
                                                                <>
                                                                  <div className="col-span-1 py-1">
                                                                    {formatCurrency(
                                                                      taxAmount,
                                                                    )}
                                                                  </div>
                                                                  <div className="col-span-1 py-1">
                                                                    {formatCurrency(
                                                                      Math.round(
                                                                        totalSum,
                                                                      ),
                                                                    )}
                                                                  </div>
                                                                </>
                                                              );
                                                            })()}
                                                          </div>
                                                        ),
                                                      );
                                                    })()}
                                                  </div>
                                                </div>

                                                <div>
                                                  <h4 className="font-medium mb-3">
                                                    {t("common.summary")}
                                                  </h4>
                                                  <div className="bg-blue-50 p-4 rounded-lg">
                                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                                      <div className="space-y-2">
                                                        {(() => {
                                                          const priceIncludeTax =
                                                            selectedInvoice.priceIncludeTax;
                                                          const storedSubtotal =
                                                            parseFloat(
                                                              selectedInvoice.subtotal ||
                                                                "0",
                                                            );
                                                          const storedTax =
                                                            parseFloat(
                                                              selectedInvoice.tax ||
                                                                "0",
                                                            );
                                                          const storedDiscount =
                                                            parseFloat(
                                                              selectedInvoice.discount ||
                                                                "0",
                                                            );

                                                          let thanhTien,
                                                            tax,
                                                            subtotal;

                                                          if (priceIncludeTax) {
                                                            thanhTien =
                                                              storedSubtotal;
                                                            tax = storedTax;
                                                            subtotal =
                                                              storedSubtotal;
                                                          } else {
                                                            thanhTien =
                                                              storedSubtotal;
                                                            tax = storedTax;
                                                            subtotal =
                                                              storedSubtotal;
                                                          }

                                                          const totalPayment =
                                                            parseFloat(
                                                              selectedInvoice.total ||
                                                                "0",
                                                            );
                                                          return (
                                                            <>
                                                              <div className="flex justify-between">
                                                                <span>
                                                                  {t(
                                                                    "common.totalPayment",
                                                                  )}
                                                                  :
                                                                </span>
                                                                <span className="font-bold">
                                                                  {formatCurrency(
                                                                    totalPayment,
                                                                  )}
                                                                </span>
                                                              </div>
                                                              <div className="flex justify-between">
                                                                <span>
                                                                  {t(
                                                                    "common.subtotalAmount",
                                                                  )}
                                                                  :
                                                                </span>
                                                                <span className="font-bold">
                                                                  {formatCurrency(
                                                                    thanhTien,
                                                                  )}
                                                                </span>
                                                              </div>
                                                              {(() => {
                                                                const discountAmount =
                                                                  storedDiscount;
                                                                return discountAmount >
                                                                  0 ? (
                                                                  <div className="flex justify-between text-red-600">
                                                                    <span>
                                                                      {t(
                                                                        "common.discount",
                                                                      )}
                                                                      :
                                                                    </span>
                                                                    <span className="font-bold">
                                                                      -
                                                                      {formatCurrency(
                                                                        discountAmount,
                                                                      )}
                                                                    </span>
                                                                  </div>
                                                                ) : null;
                                                              })()}
                                                              <div className="flex justify-between">
                                                                <span>
                                                                  {t(
                                                                    "common.totalTax",
                                                                  )}
                                                                  :
                                                                </span>
                                                                <span className="font-bold">
                                                                  {formatCurrency(
                                                                    tax,
                                                                  )}
                                                                </span>
                                                              </div>
                                                            </>
                                                          );
                                                        })()}
                                                      </div>
                                                      <div className="space-y-2">
                                                        {(() => {
                                                          const isPaid =
                                                            selectedInvoice.displayStatus ===
                                                              1 ||
                                                            selectedInvoice.status ===
                                                              "paid" ||
                                                            selectedInvoice.paymentStatus ===
                                                              "paid";

                                                          const subtotal =
                                                            parseFloat(
                                                              selectedInvoice.subtotal ||
                                                                "0",
                                                            );
                                                          const tax =
                                                            parseFloat(
                                                              selectedInvoice.tax ||
                                                                "0",
                                                            );
                                                          const discount =
                                                            parseFloat(
                                                              selectedInvoice.discount ||
                                                                "0",
                                                            );
                                                          const totalAmount =
                                                            Math.max(
                                                              0,
                                                              subtotal +
                                                                tax -
                                                                discount,
                                                            );

                                                          let paidAmount =
                                                            isPaid
                                                              ? totalAmount
                                                              : 0;
                                                          const paymentMethod =
                                                            selectedInvoice.paymentMethod;

                                                          return (
                                                            <>
                                                              <div className="flex justify-between">
                                                                <span>
                                                                  {t(
                                                                    "common.customerPaid",
                                                                  )}
                                                                  :
                                                                </span>
                                                                <span className="font-bold">
                                                                  {formatCurrency(
                                                                    parseFloat(selectedInvoice.total || "0"),
                                                                  )}
                                                                </span>
                                                              </div>
                                                              <div className="flex justify-between">
                                                                <span>
                                                                  {t(
                                                                    "common.cashPayment",
                                                                  )}
                                                                  :
                                                                </span>
                                                                <span className="font-bold">
                                                                  {isPaid &&
                                                                  paymentMethod ===
                                                                    1
                                                                    ? formatCurrency(
                                                                        paidAmount,
                                                                      )
                                                                    : "0"}
                                                                </span>
                                                              </div>
                                                              <div className="flex justify-between">
                                                                <span>
                                                                  {t(
                                                                    "common.bankTransfer",
                                                                  )}
                                                                  :
                                                                </span>
                                                                <span className="font-bold">
                                                                  {isPaid &&
                                                                  paymentMethod ===
                                                                    2
                                                                    ? formatCurrency(
                                                                        paidAmount,
                                                                      )
                                                                    : "0"}
                                                                </span>
                                                              </div>
                                                              <div className="flex justify-between">
                                                                <span>
                                                                  {t(
                                                                    "common.qrPayment",
                                                                  )}
                                                                  :
                                                                </span>
                                                                <span className="font-bold">
                                                                  {isPaid &&
                                                                  paymentMethod ===
                                                                    3
                                                                    ? formatCurrency(
                                                                        paidAmount,
                                                                      )
                                                                    : "0"}
                                                                </span>
                                                              </div>
                                                              </>
                                                          );
                                                        })()}
                                                      </div>
                                                    </div>
                                                  </div>

                                                  {/* Multi-payment details section */}
                                                  {(() => {
                                                    const paymentMethod = selectedInvoice.paymentMethod;
                                                    try {
                                                      if (paymentMethod && typeof paymentMethod === 'string') {
                                                        const parsed = JSON.parse(paymentMethod);
                                                        if (Array.isArray(parsed) && parsed.length > 0) {
                                                          return (
                                                            <div className="flex justify-end mt-4">
                                                              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-3 rounded-lg border border-blue-200 inline-block max-w-sm">
                                                                <h4 className="font-semibold text-blue-800 mb-2 text-sm">Thanh toán nhiều phương thức:</h4>
                                                                <div className="space-y-1">
                                                                  {parsed.map((pm: any, idx: number) => (
                                                                    <div key={idx} className="flex items-center gap-3 text-sm">
                                                                      <span className="text-blue-600">•</span>
                                                                      <span className="font-medium">{getPaymentMethodName(pm.method)}:</span>
                                                                      <span className="text-green-600 font-bold ml-auto">
                                                                        {formatCurrency(pm.amount)} ₫
                                                                      </span>
                                                                    </div>
                                                                  ))}
                                                                  <div className="flex items-center gap-3 pt-2 mt-2 border-t-2 border-blue-300 text-sm">
                                                                    <span className="font-bold text-blue-800">Tổng:</span>
                                                                    <span className="text-blue-600 font-bold ml-auto">
                                                                      {formatCurrency(parsed.reduce((sum: number, pm: any) => sum + pm.amount, 0))} ₫
                                                                    </span>
                                                                  </div>
                                                                </div>
                                                              </div>
                                                            </div>
                                                          );
                                                        }
                                                      }
                                                    } catch (e) {
                                                      // Not JSON, single payment
                                                    }

                                                    // Single payment method display
                                                    return (
                                                      <div className="flex justify-end mt-4">
                                                        <div className="bg-blue-50 p-3 rounded-lg border border-blue-200 inline-block">
                                                          <div className="flex items-center gap-3 text-sm">
                                                            <span className="font-semibold text-gray-700">
                                                              Phương thức thanh toán:
                                                            </span>
                                                            <span className="font-bold text-blue-600">
                                                              {getPaymentMethodName(selectedInvoice.paymentMethod)}
                                                            </span>
                                                          </div>
                                                        </div>
                                                      </div>
                                                    );
                                                  })()}
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
                                                    />
                                                  ) : (
                                                    <div className="p-3 bg-gray-50 rounded border min-h-[80px]">
                                                      {selectedInvoice.notes ||
                                                        t("common.noNotes")}
                                                    </div>
                                                  )}
                                                </div>

                                                <div className="flex gap-2 pt-4 border-t">
                                                  {selectedInvoice?.einvoiceStatus !== 1 && (
                                                    <Button
                                                      size="sm"
                                                      className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white"
                                                      onClick={() => {
                                                        if (
                                                          selectedInvoice &&
                                                          selectedInvoice.status !==
                                                            "cancelled"
                                                        ) {
                                                          setShowCancelDialog(
                                                            true,
                                                          );
                                                        }
                                                      }}
                                                      disabled={
                                                        selectedInvoice?.status ===
                                                          "cancelled" ||
                                                        cancelOrderMutation.isPending
                                                      }
                                                    >
                                                      <X className="w-4 h-4" />
                                                      {cancelOrderMutation.isPending
                                                        ? "Đang hủy..."
                                                        : t("common.cancelOrder")}
                                                    </Button>
                                                  )}
                                                  {!isEditing ? (
                                                    <>
                                                      {selectedInvoice?.einvoiceStatus !== 1 && (
                                                        <Button
                                                          size="sm"
                                                          variant="outline"
                                                          className="flex items-center gap-2 border-green-500 text-green-600 hover:bg-green-50"
                                                          onClick={
                                                            handleEditOrder
                                                          }
                                                        >
                                                          <FileText className="w-4 h-4" />
                                                          {t("common.editOrder")}
                                                        </Button>
                                                      )}
                                                      {selectedInvoice?.einvoiceStatus !== 1 && (
                                                        <Button
                                                          size="sm"
                                                          variant="outline"
                                                          className="flex items-center gap-2 border-blue-500 text-blue-600 hover:bg-blue-50"
                                                          onClick={() => {
                                                            if (selectedInvoice) {
                                                              setShowEInvoiceModal(
                                                                true,
                                                              );
                                                            }
                                                          }}
                                                        >
                                                          <Mail className="w-4 h-4" />
                                                          {selectedInvoice?.einvoiceStatus ===
                                                          0
                                                            ? t(
                                                                "common.publishEInvoice",
                                                              )
                                                            : "Chỉnh sửa & Phát hành lại"}
                                                        </Button>
                                                      )}
                                                      <Button
                                                        size="sm"
                                                        variant="outline"
                                                        className="flex items-center gap-2 border-green-500 text-green-600 hover:bg-green-50"
                                                        onClick={() => {
                                                          if (
                                                            selectedInvoice &&
                                                            orderItems.length >
                                                              0
                                                          ) {
                                                            console.log(
                                                              "📄 Sales Orders: Showing receipt modal for invoice printing",
                                                            );

                                                            const receiptData =
                                                              {
                                                                id: selectedInvoice.id,
                                                                transactionId:
                                                                  selectedInvoice.displayNumber ||
                                                                  `TXN-${selectedInvoice.id}`,
                                                                createdAt:
                                                                  selectedInvoice.date ||
                                                                  selectedInvoice.createdAt ||
                                                                  new Date().toISOString(),
                                                                cashierName:
                                                                  "System User",
                                                                paymentMethod:
                                                                  getItemType(
                                                                    selectedInvoice,
                                                                  ) === "order"
                                                                    ? selectedInvoice.paymentMethod
                                                                    : "invoice",
                                                                customerName:
                                                                  selectedInvoice.customerName ||
                                                                  "Khách hàng lẻ",
                                                                customerTaxCode:
                                                                  selectedInvoice.customerTaxCode ||
                                                                  null,
                                                                customerAddress:
                                                                  selectedInvoice.customerAddress ||
                                                                  "",
                                                                customerPhone:
                                                                  selectedInvoice.customerPhone ||
                                                                  "",
                                                                customerEmail:
                                                                  selectedInvoice.customerEmail ||
                                                                  "",
                                                                items:
                                                                  orderItems.map(
                                                                    (
                                                                      item: any,
                                                                    ) => ({
                                                                      id:
                                                                        item.id ||
                                                                        item.productId,
                                                                      productId:
                                                                        item.productId ||
                                                                        item.id,
                                                                      productName:
                                                                        item.productName ||
                                                                        item.name,
                                                                      quantity:
                                                                        item.quantity ||
                                                                        1,
                                                                      price:
                                                                        item.unitPrice ||
                                                                        item.price ||
                                                                        "0",
                                                                      total:
                                                                        item.total ||
                                                                        "0",
                                                                      unitPrice:
                                                                        item.unitPrice ||
                                                                        item.price ||
                                                                        "0",
                                                                    }),
                                                                  ),
                                                                subtotal:
                                                                  selectedInvoice.subtotal ||
                                                                  "0",
                                                                tax:
                                                                  selectedInvoice.tax ||
                                                                  "0",
                                                                total:
                                                                  selectedInvoice.total ||
                                                                  "0",
                                                                discount:
                                                                  selectedInvoice.discount ||
                                                                  "0",
                                                                exactDiscount:
                                                                  selectedInvoice.exactDiscount ||
                                                                  parseFloat(
                                                                    selectedInvoice.discount ||
                                                                      "0",
                                                                  ),
                                                                invoiceNumber:
                                                                  selectedInvoice.invoiceNumber ||
                                                                  null,
                                                                symbol:
                                                                  selectedInvoice.symbol ||
                                                                  "",
                                                                templateNumber:
                                                                  selectedInvoice.templateNumber ||
                                                                  "",
                                                              };

                                                            const correctdiscount =
                                                              parseFloat(
                                                                selectedInvoice.discount ||
                                                                  "0",
                                                              );

                                                            const correcttax =
                                                              parseFloat(
                                                                selectedInvoice.tax ||
                                                                  "0",
                                                              );

                                                            const correctsubtotal =
                                                              parseFloat(
                                                                selectedInvoice.subtotal ||
                                                                  "0",
                                                              );

                                                            receiptData.total =
                                                              correctsubtotal +
                                                              correcttax -
                                                              correctdiscount;

                                                            setSelectedReceipt(
                                                              receiptData,
                                                            );
                                                            setShowReceiptModal(
                                                              true,
                                                            );
                                                          }
                                                        }}
                                                      >
                                                        <Printer className="w-4 h-4" />
                                                        {t(
                                                          "common.printInvoice",
                                                        )}
                                                      </Button>
                                                    </>
                                                  ) : (
                                                    <>
                                                      <Button
                                                        size="sm"
                                                        variant="outline"
                                                        className="flex items-center gap-2 border-blue-500 text-blue-600 hover:bg-blue-50"
                                                        onClick={() => {
                                                          if (selectedInvoice) {
                                                            setShowEInvoiceModal(
                                                              true,
                                                            );
                                                          }
                                                        }}
                                                      >
                                                        <Mail className="w-4 h-4" />
                                                        {selectedInvoice?.einvoiceStatus ===
                                                        0
                                                          ? "Phát hành HĐ điện tử"
                                                          : "Chỉnh sửa & Phát hành lại"}
                                                      </Button>
                                                      <Button
                                                        size="sm"
                                                        variant="outline"
                                                        className="flex items-center gap-2 border-yellow-500 text-yellow-600 hover:bg-yellow-50"
                                                        onClick={
                                                          handleCancelEdit
                                                        }
                                                      >
                                                        <X className="w-4 h-4" />
                                                        Hủy sửa
                                                      </Button>
                                                    </>
                                                  )}
                                                  <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="flex items-center gap-2 border-red-500 text-red-600 hover:bg-red-50"
                                                    onClick={() => {
                                                      setSelectedInvoice(null);
                                                      setIsEditing(false);
                                                      setEditableInvoice(null);
                                                    }}
                                                  >
                                                    <X className="w-4 h-4" />
                                                    {t("common.close")}
                                                  </Button>
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
                                  currentPage === pageNum
                                    ? "default"
                                    : "outline"
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
                  </div>
                )}

                <div className="mt-4 border-t bg-blue-50 p-3 rounded text-center">
                  <div className="grid grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="font-medium">
                        {t("common.subtotalAmount")}:
                      </span>
                      <div className="font-bold text-blue-600">
                        {formatCurrency(totals.subtotal)}
                      </div>
                    </div>
                    <div>
                      <span className="font-medium">
                        {t("common.discount")}:
                      </span>
                      <div className="font-bold text-red-600">
                        -{formatCurrency(totals.discount || 0)}
                      </div>
                    </div>
                    <div>
                      <span className="font-medium">
                        {t("common.totalTax")}:
                      </span>
                      <div className="font-bold text-orange-600">
                        {formatCurrency(totals.tax)}
                      </div>
                    </div>
                    <div>
                      <span className="font-medium">
                        {t("common.grandTotal")}:
                      </span>
                      <div className="font-bold text-green-600">
                        {formatCurrency(totals.total)}
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
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
      {showEInvoiceModal && selectedInvoice && (
        <EInvoiceModal
          isOpen={showEInvoiceModal}
          onClose={() => setShowEInvoiceModal(false)}
          onConfirm={(eInvoiceData) => {
            console.log(
              "📧 E-Invoice confirmed from sales orders:",
              eInvoiceData,
            );
            setShowEInvoiceModal(false);

            if (eInvoiceData.success) {
              queryClient.invalidateQueries({ queryKey: ["https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/orders"] });
              toast({
                title: "Thành công",
                description: "Hóa đơn điện tử đã được xử lý thành công",
              });
            }
          }}
          total={(() => {
            if (!selectedInvoice) return 0;
            const subtotal = parseFloat(selectedInvoice.subtotal || "0");
            const tax = parseFloat(selectedInvoice.tax || "0");
            const discount = parseFloat(selectedInvoice.discount || "0");
            return Math.max(0, subtotal + tax - discount);
          })()}
          cartItems={orderItems.map((item) => ({
            id: item.productId || item.id,
            name: item.productName,
            price: parseFloat(item.unitPrice || "0"),
            quantity: item.quantity,
            sku: item.sku || `SKU${item.productId || item.id}`,
            taxRate: parseFloat(item.taxRate || "0"),
          }))}
          selectedPaymentMethod={(() => {
            const paymentMethod = selectedInvoice.paymentMethod;
            if (paymentMethod === 1) return "cash";
            if (paymentMethod === 2) return "creditCard";
            if (paymentMethod === 3) return "qrCode";
            return "cash";
          })()}
          source="sales-orders"
          orderId={selectedInvoice.id}
        />
      )}
      {showPrintDialog && printReceiptData && (
        <PrintDialog
          isOpen={showPrintDialog}
          onClose={() => {
            setShowPrintDialog(false);
            setPrintReceiptData(null);
          }}
          receiptData={printReceiptData}
        />
      )}
      {showReceiptModal && selectedReceipt && (
        <ReceiptModal
          isOpen={showReceiptModal}
          onClose={() => {
            console.log("🔴 Sales Orders: Closing receipt modal");
            setShowReceiptModal(false);
            setSelectedReceipt(null);
          }}
          receipt={selectedReceipt}
          cartItems={orderItems.map((item: any) => ({
            id: item.productId || item.id,
            name: item.productName || item.name,
            price: item.unitPrice || item.price || "0",
            quantity: item.quantity || 1,
            sku: item.sku || `SKU${item.productId || item.id}`,
            taxRate: parseFloat(item.taxRate || "0"),
          }))}
        />
      )}
    </div>
  );
}