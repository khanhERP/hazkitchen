import { useState, useEffect, useCallback, useRef } from "react";
import {
  ShoppingCart as CartIcon,
  Minus,
  Plus,
  Trash2,
  CreditCard,
  Banknote,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTranslation } from "@/lib/i18n";
import { PaymentMethodModal } from "./payment-method-modal";
import { ReceiptModal } from "./receipt-modal";
import { EInvoiceModal } from "./einvoice-modal";
import { CustomerFormModal } from "@/components/customers/customer-form-modal";
import type { CartItem } from "@shared/schema";
import { toast } from "@/hooks/use-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";

interface ShoppingCartProps {
  cart: CartItem[];
  onUpdateQuantity: (id: number, quantity: number) => void;
  onRemoveItem: (id: number) => void;
  onClearCart: () => void;
  onCheckout: (paymentData: any) => void;
  isProcessing: boolean;
  orders?: Array<{ id: string; name: string; cart: CartItem[] }>;
  activeOrderId?: string;
  onCreateNewOrder?: () => void;
  onSwitchOrder?: (orderId: string) => void;
  onRemoveOrder?: (orderId: string) => void;
}

export function ShoppingCart({
  cart,
  onUpdateQuantity,
  onRemoveItem,
  onClearCart,
  onCheckout,
  isProcessing,
  orders = [],
  activeOrderId,
  onCreateNewOrder,
  onSwitchOrder,
  onRemoveOrder,
}: ShoppingCartProps) {
  const [paymentMethod, setPaymentMethod] = useState<string>("bankTransfer");
  const [amountReceived, setAmountReceived] = useState<string>("");
  const [discountAmount, setDiscountAmount] = useState<string>(""); // This state is still used for the input value itself
  const [discount, setDiscount] = useState(0);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showTableSelection, setShowTableSelection] = useState(false);
  const [currentOrderForPayment, setCurrentOrderForPayment] =
    useState<any>(null);
  const [showReceiptPreview, setShowReceiptPreview] = useState(false);
  const [selectedCardMethod, setSelectedCardMethod] = useState<string>("");
  const [previewReceipt, setPreviewReceipt] = useState<any>(null);
  const { t } = useTranslation();

  // State for Receipt Modal and E-Invoice Modal integration
  const [selectedReceipt, setSelectedReceipt] = useState<any>(null);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [showEInvoiceModal, setShowEInvoiceModal] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState("");
  const [showPaymentMethodModal, setShowPaymentMethodModal] = useState(false); // Added state for PaymentMethodModal
  const [isProcessingPayment, setIsProcessingPayment] = useState(false); // Flag to prevent duplicate processing

  // New state variables for order management flow
  const [lastCartItems, setLastCartItems] = useState<CartItem[]>([]);
  const [orderForPayment, setOrderForPayment] = useState(null);

  // State to manage the visibility of the print dialog
  const [showPrintDialog, setShowPrintDialog] = useState(false);

  // Query client for invalidating queries
  const queryClient = useQueryClient();

  // State for customer search
  const [customerSearchTerm, setCustomerSearchTerm] = useState("");
  const [suggestedCustomers, setSuggestedCustomers] = useState<any[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [isSearching, setIsSearching] = useState(false);
  const customerSearchDebounceTimer = useRef<NodeJS.Timeout | null>(null);

  // State for customer form modal
  const [showCustomerForm, setShowCustomerForm] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<any>(null);

  // State for managing customers per order
  const [orderCustomers, setOrderCustomers] = useState<{
    [orderId: string]: any | null;
  }>({});

  // Fetch store settings to check price_include_tax setting
  const { data: storeSettings } = useQuery({
    queryKey: ["store-settings"],
    queryFn: async () => {
      const response = await fetch("https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/store-settings");
      if (!response.ok) {
        throw new Error("Failed to fetch store settings");
      }
      return response.json();
    },
  });

  // Get priceIncludesTax setting from store settings
  const priceIncludesTax = storeSettings?.priceIncludesTax === true;

  // State to manage discounts for each order
  const [orderDiscounts, setOrderDiscounts] = useState<{
    [orderId: string]: string;
  }>({});

  // Calculate discount for the current active order
  const currentOrderDiscount = activeOrderId
    ? orderDiscounts[activeOrderId] || "0"
    : "0";

  const subtotal = cart.reduce((sum, item) => {
    const unitPrice = parseFloat(item.price);
    const quantity = item.quantity;
    const taxRate = parseFloat(item.taxRate || "0") / 100;
    const orderDiscount = parseFloat(currentOrderDiscount || "0");

    // Calculate discount for this item
    let itemDiscountAmount = 0;
    if (orderDiscount > 0) {
      const totalBeforeDiscount = cart.reduce((total, cartItem) => {
        return total + parseFloat(cartItem.price) * cartItem.quantity;
      }, 0);

      const currentIndex = cart.findIndex(
        (cartItem) => cartItem.id === item.id,
      );
      const isLastItem = currentIndex === cart.length - 1;

      if (isLastItem) {
        // Last item: total discount - sum of all previous discounts
        let previousDiscounts = 0;
        for (let i = 0; i < cart.length - 1; i++) {
          const prevItem = cart[i];
          const prevItemTotal = parseFloat(prevItem.price) * prevItem.quantity;
          const prevItemDiscount =
            totalBeforeDiscount > 0
              ? Math.round(
                  (orderDiscount * prevItemTotal) / totalBeforeDiscount,
                )
              : 0;
          previousDiscounts += prevItemDiscount;
        }
        itemDiscountAmount = orderDiscount - previousDiscounts;
      } else {
        // Regular calculation for non-last items
        const itemTotal = unitPrice * quantity;
        itemDiscountAmount =
          totalBeforeDiscount > 0
            ? Math.round((orderDiscount * itemTotal) / totalBeforeDiscount)
            : 0;
      }
    }

    if (priceIncludesTax && taxRate > 0) {
      // When price includes tax:
      // giá bao gồm thuế = (price - (discount/quantity)) * quantity
      const discountPerUnit = itemDiscountAmount / quantity;
      const adjustedPrice = Math.max(0, unitPrice - discountPerUnit);
      const giaGomThue = adjustedPrice * quantity;
      // subtotal = giá bao gồm thuế / (1 + (taxRate / 100)) (làm tròn)
      const itemSubtotal = Math.round(giaGomThue / (1 + taxRate));
      return sum + itemSubtotal;
    } else {
      // When price doesn't include tax:
      // subtotal = (price - (discount/quantity)) * quantity
      const discountPerUnit = itemDiscountAmount / quantity;
      const adjustedPrice = Math.max(0, unitPrice - discountPerUnit);
      const itemSubtotal = adjustedPrice * quantity;
      return sum + itemSubtotal;
    }
  }, 0);

  const tax = cart.reduce((sum, item, index) => {
    if (item.taxRate && parseFloat(item.taxRate) > 0) {
      const originalPrice = parseFloat(item.price);
      const quantity = item.quantity;
      const taxRate = parseFloat(item.taxRate) / 100;
      const orderDiscount = parseFloat(currentOrderDiscount || "0");

      // Calculate discount for this item
      let itemDiscountAmount = 0;
      if (orderDiscount > 0) {
        const totalBeforeDiscount = cart.reduce((total, cartItem) => {
          return total + parseFloat(cartItem.price) * cartItem.quantity;
        }, 0);

        const currentIndex = cart.findIndex(
          (cartItem) => cartItem.id === item.id,
        );
        const isLastItem = currentIndex === cart.length - 1;

        if (isLastItem) {
          // Last item: total discount - sum of all previous discounts
          let previousDiscounts = 0;
          for (let i = 0; i < cart.length - 1; i++) {
            const prevItem = cart[i];
            const prevItemTotal =
              parseFloat(prevItem.price) * prevItem.quantity;
            const prevItemDiscount =
              totalBeforeDiscount > 0
                ? Math.round(
                    (orderDiscount * prevItemTotal) / totalBeforeDiscount,
                  )
                : 0;
            previousDiscounts += prevItemDiscount;
          }
          itemDiscountAmount = orderDiscount - previousDiscounts;
        } else {
          // Regular calculation for non-last items
          const itemTotal = originalPrice * quantity;
          itemDiscountAmount =
            totalBeforeDiscount > 0
              ? Math.round((orderDiscount * itemTotal) / totalBeforeDiscount)
              : 0;
        }
      }

      let itemTax = 0;

      if (priceIncludesTax) {
        // When price includes tax:
        // giá bao gồm thuế = (price - (discount/quantity)) * quantity
        const discountPerUnit = itemDiscountAmount / quantity;
        const adjustedPrice = Math.max(0, originalPrice - discountPerUnit);
        const giaGomThue = adjustedPrice * quantity;
        // subtotal = giá bao gồm thuế / (1 + (taxRate / 100)) (làm tròn)
        const tamTinh = Math.round(giaGomThue / (1 + taxRate));
        // tax = giá bao gồm thuế - subtotal
        itemTax = giaGomThue - tamTinh;
      } else {
        // When price doesn't include tax:
        // subtotal = (price - (discount/quantity)) * quantity
        const discountPerUnit = itemDiscountAmount / quantity;
        const adjustedPrice = Math.max(0, originalPrice - discountPerUnit);
        const tamTinh = adjustedPrice * quantity;
        // tax = subtotal * (taxRate / 100) (làm tròn)
        itemTax = Math.round(tamTinh * taxRate);
      }

      return sum + Math.max(0, itemTax);
    }
    return sum;
  }, 0);
  const discountValue = parseFloat(currentOrderDiscount || "0");
  const total = Math.round(subtotal + tax); // Always subtract discount
  const finalTotal = Math.max(0, total); // finalTotal is same as total
  const change =
    paymentMethod === "cash"
      ? Math.max(0, parseFloat(amountReceived || "0") - finalTotal)
      : 0;

  // Helper functions for receipt generation (used in handlePaymentMethodSelect)
  const calculateSubtotal = () =>
    cart.reduce((sum, item) => sum + parseFloat(item.total), 0);
  const calculateTax = () =>
    cart.reduce((sum, item, index) => {
      if (item.taxRate && parseFloat(item.taxRate) > 0) {
        const unitPrice = parseFloat(item.price);
        const quantity = item.quantity;
        const taxRate = parseFloat(item.taxRate) / 100;

        // Calculate discount for this item
        const orderDiscount = parseFloat(discountAmount || "0");
        let itemDiscountAmount = 0;

        if (orderDiscount > 0) {
          const currentIndex = cart.findIndex(
            (cartItem) => cartItem.id === item.id,
          );
          const isLastItem = currentIndex === cart.length - 1;

          if (isLastItem) {
            // Last item: total discount - sum of all previous discounts
            let previousDiscounts = 0;
            const totalBeforeDiscount = cart.reduce((sum, itm) => {
              const itmUnitPrice = parseFloat(itm.price);
              const itmTaxRate = parseFloat(itm.taxRate || "0") / 100;
              let itmBasePrice;

              if (priceIncludesTax && itmTaxRate > 0) {
                itmBasePrice = itmUnitPrice / (1 + itmTaxRate);
              } else {
                itmBasePrice = itmUnitPrice;
              }

              return sum + itmBasePrice * itm.quantity;
            }, 0);

            for (let i = 0; i < cart.length - 1; i++) {
              const prevItem = cart[i];
              const prevUnitPrice = parseFloat(prevItem.price);
              const prevTaxRate = parseFloat(prevItem.taxRate || "0") / 100;
              let prevBasePrice;

              if (priceIncludesTax && prevTaxRate > 0) {
                prevBasePrice = prevUnitPrice / (1 + prevTaxRate);
              } else {
                prevBasePrice = prevUnitPrice;
              }

              const prevItemSubtotal = prevBasePrice * prevItem.quantity;
              const prevItemDiscount =
                totalBeforeDiscount > 0
                  ? Math.round(
                      (orderDiscount * prevItemSubtotal) / totalBeforeDiscount,
                    )
                  : 0;
              previousDiscounts += prevItemDiscount;
            }

            itemDiscountAmount = orderDiscount - previousDiscounts;
          } else {
            // Regular calculation for non-last items
            const totalBeforeDiscount = cart.reduce((sum, itm) => {
              const itmUnitPrice = parseFloat(itm.price);
              const itmTaxRate = parseFloat(itm.taxRate || "0") / 100;
              let itmBasePrice;

              if (priceIncludesTax && itmTaxRate > 0) {
                itmBasePrice = itmUnitPrice / (1 + itmTaxRate);
              } else {
                itmBasePrice = itmUnitPrice;
              }

              return sum + itmBasePrice * itm.quantity;
            }, 0);

            itemDiscountAmount =
              totalBeforeDiscount > 0
                ? Math.round(
                    (orderDiscount * (unitPrice * quantity)) /
                      totalBeforeDiscount,
                  )
                : 0;
          }
        }

        // Apply discount and calculate final tax
        const taxableAmount = Math.max(
          0,
          unitPrice * quantity - itemDiscountAmount,
        );

        if (priceIncludesTax) {
          // When price includes tax: tax = unit price - base price
          return (
            sum +
            Math.round(unitPrice * quantity - taxableAmount / (1 + taxRate))
          );
        } else {
          // When price doesn't include tax, use standard calculation
          return sum + Math.round(taxableAmount * taxRate);
        }
      }
      return sum;
    }, 0);
  const calculateDiscount = () => parseFloat(discountAmount || "0");
  const calculateTotal = () =>
    Math.max(
      0,
      Math.round(calculateSubtotal() + calculateTax()) - calculateDiscount(),
    );

  // Fetch products to calculate tax correctly based on afterTaxPrice
  const { data: products } = useQuery<any[]>({
    queryKey: ["products"],
    queryFn: async () => {
      const response = await fetch("https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/products");
      if (!response.ok) {
        throw new Error("Failed to fetch products");
      }
      return response.json();
    },
  });

  // Function to calculate display price based on store settings
  const getDisplayPrice = (item: any): number => {
    const basePrice = parseFloat(item.price);

    // If store setting says to include tax, calculate price with tax
    if (priceIncludesTax) {
      const taxRate = parseFloat(item.taxRate || "0");
      return basePrice * (1 + taxRate / 100);
    }

    // If store setting says not to include tax, show base price
    return basePrice;
  };

  // Single WebSocket connection for both refresh signals and cart broadcasting
  const wsRef = useRef<WebSocket | null>(null);

  // Fetch customers for search suggestions
  const fetchCustomers = async (searchTerm: string) => {
    try {
      setIsSearching(true);
      const response = await fetch(`https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/customers?search=${searchTerm}`);
      if (!response.ok) {
        throw new Error("Failed to fetch customers");
      }
      const data = await response.json();
      setSuggestedCustomers(data);
    } catch (error) {
      console.error("Error fetching customers:", error);
      setSuggestedCustomers([]);
    } finally {
      setIsSearching(false);
    }
  };

  // Optimized debounced customer search - ultra fast for phone numbers
  useEffect(() => {
    if (customerSearchTerm.length > 0) {
      if (customerSearchDebounceTimer.current) {
        clearTimeout(customerSearchDebounceTimer.current);
      }
      // Very short delay for phone numbers (50ms), normal delay for text search
      const isPhoneSearch = /^\d+$/.test(customerSearchTerm);
      const delay = isPhoneSearch ? 50 : 150;

      customerSearchDebounceTimer.current = setTimeout(() => {
        fetchCustomers(customerSearchTerm);
      }, delay);
    } else {
      setSuggestedCustomers([]); // Clear suggestions if search term is empty
      if (customerSearchDebounceTimer.current) {
        clearTimeout(customerSearchDebounceTimer.current);
      }
    }
    return () => {
      if (customerSearchDebounceTimer.current) {
        clearTimeout(customerSearchDebounceTimer.current);
      }
    };
  }, [customerSearchTerm]);

  // Filter customers locally for exact phone number matching
  const filteredSuggestedCustomers = suggestedCustomers.filter((customer) => {
    const searchLower = customerSearchTerm.toLowerCase().trim();

    // If search term is all digits (phone number search)
    if (/^\d+$/.test(searchLower)) {
      // Remove all non-digit characters from customer phone
      const cleanPhone = (customer.phone || "").replace(/\D/g, "");
      // Check if cleaned phone STARTS WITH search term (exact match from beginning)
      return cleanPhone.startsWith(searchLower);
    }

    // Otherwise search by name (case insensitive)
    return customer.name?.toLowerCase().includes(searchLower);
  });

  // Function to handle customer selection
  const handleCustomerSelect = (customer: any) => {
    setSelectedCustomer(customer);
    setCustomerSearchTerm(`${customer.name} (${customer.phone})`); // Display name and phone
    setSuggestedCustomers([]); // Clear suggestions after selection
    // Optionally, trigger other actions here if needed, e.g., updating cart with customer-specific info

    // Save customer to orderCustomers state
    if (activeOrderId) {
      setOrderCustomers((prev) => ({
        ...prev,
        [activeOrderId]: customer,
      }));
    }
  };

  useEffect(() => {
    console.log("📡 Shopping Cart: Initializing single WebSocket connection");
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/ws`;

    let reconnectTimer: NodeJS.Timeout | null = null;
    let shouldReconnect = true;
    let reconnectAttempts = 0;
    const maxReconnectAttempts = 5;

    const connectWebSocket = () => {
      if (reconnectAttempts >= maxReconnectAttempts) {
        console.log(
          "📡 Shopping Cart: Max reconnection attempts reached, giving up",
        );
        return;
      }

      try {
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;
        // Make wsRef available globally for external access if needed (e.g., in discount onChange)
        if (typeof window !== "undefined") {
          (window as any).wsRef = wsRef.current;
        }

        ws.onopen = () => {
          console.log("📡 Shopping Cart: WebSocket connected");
          reconnectAttempts = 0;

          // Register as shopping cart client
          ws.send(
            JSON.stringify({
              type: "register_shopping_cart",
              timestamp: new Date().toISOString(),
            }),
          );

          // Send initial cart state if cart has items
          if (cart.length > 0) {
            console.log("📡 Shopping Cart: Sending initial cart state");
            broadcastCartUpdate();
          }
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            console.log("📩 Shopping Cart: Received WebSocket message:", data);

            if (
              data.type === "payment_success" ||
              data.type === "popup_close" ||
              data.type === "force_refresh" ||
              data.type === "einvoice_published"
            ) {
              console.log(
                "🔄 Shopping Cart: Refreshing data due to WebSocket signal",
              );

              if (
                (data.type === "popup_close" && data.success) ||
                data.type === "payment_success" ||
                data.type === "einvoice_published" ||
                data.type === "force_refresh"
              ) {
                console.log("🧹 Shopping Cart: Clearing cart due to signal");
                onClearCart();

                // Clear any active orders
                if (
                  typeof window !== "undefined" &&
                  (window as any).clearActiveOrder
                ) {
                  (window as any).clearActiveOrder();
                }
              }
            }
          } catch (error) {
            console.error(
              "❌ Shopping Cart: Error processing WebSocket message:",
              error,
            );
          }
        };

        ws.onclose = () => {
          console.log("📡 Shopping Cart: WebSocket disconnected");
          wsRef.current = null;
          if (typeof window !== "undefined") {
            (window as any).wsRef = null;
          }
          if (shouldReconnect && reconnectAttempts < maxReconnectAttempts) {
            reconnectAttempts++;
            const delay = Math.min(2000 * reconnectAttempts, 10000);
            reconnectTimer = setTimeout(connectWebSocket, delay);
          }
        };

        ws.onerror = (error) => {
          console.error("❌ Shopping Cart: WebSocket error:", error);
          ws.current = null;
          if (typeof window !== "undefined") {
            (window as any).wsRef = null;
          }
        };
      } catch (error) {
        console.error("❌ Shopping Cart: Failed to connect WebSocket:", error);
        if (shouldReconnect && reconnectAttempts < maxReconnectAttempts) {
          reconnectAttempts++;
          const delay = Math.min(2000 * reconnectAttempts, 10000);
          reconnectTimer = setTimeout(connectWebSocket, delay);
        }
      }
    };

    connectWebSocket();

    return () => {
      console.log("🔗 Shopping Cart: Cleaning up WebSocket connection");
      shouldReconnect = false;

      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
      }

      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.close();
      }
      wsRef.current = null;
      if (typeof window !== "undefined") {
        (window as any).wsRef = null;
      }
    };
  }, []);

  // Function to broadcast cart updates to customer display
  const broadcastCartUpdate = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      // Ensure cart items have proper names before broadcasting
      const validatedCart = cart.map((item) => ({
        ...item,
        name:
          item.name ||
          item.productName ||
          item.product?.name ||
          `Sản phẩm ${item.id}`,
        productName:
          item.name ||
          item.productName ||
          item.product?.name ||
          `Sản phẩm ${item.id}`,
        price: item.price || "0",
        quantity: item.quantity || 1,
        total: item.total || "0",
      }));

      // Get current discount for active order
      const currentDiscount = activeOrderId
        ? parseFloat(orderDiscounts[activeOrderId] || "0")
        : parseFloat(discountAmount || "0");

      const cartUpdateMessage = {
        type: "cart_update",
        cart: validatedCart,
        subtotal: subtotal,
        tax: tax,
        total: total,
        discount: currentDiscount, // Add discount to broadcast message
        orderNumber: activeOrderId || `ORD-${Date.now()}`,
        timestamp: new Date().toISOString(),
      };

      console.log("📡 Shopping Cart: Broadcasting cart update:", {
        cartItems: validatedCart.length,
        subtotal: subtotal,
        tax: tax,
        total: total,
        discount: currentDiscount,
      });

      try {
        wsRef.current.send(JSON.stringify(cartUpdateMessage));
      } catch (error) {
        console.error(
          "📡 Shopping Cart: Error broadcasting cart update:",
          error,
        );
      }
    }
  }, [
    cart,
    subtotal,
    tax,
    total,
    activeOrderId,
    orderDiscounts,
    discountAmount,
  ]);

  // Broadcast cart updates when cart changes
  useEffect(() => {
    const timer = setTimeout(() => {
      broadcastCartUpdate();
    }, 100);

    return () => clearTimeout(timer);
  }, [cart, subtotal, tax, total, broadcastCartUpdate]);

  const getPaymentMethods = () => {
    // Only return cash and bank transfer payment methods
    const paymentMethods = [
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
        name: "Chuyển khoản",
        nameKey: "bankTransfer",
        type: "transfer",
        enabled: true,
        icon: "🏦",
      },
    ];

    return paymentMethods;
  };

  // Handler for when receipt preview is confirmed - move to payment method selection
  const handleReceiptPreviewConfirm = () => {
    console.log(
      "🎯 POS: Receipt preview confirmed, showing payment method modal",
    );

    // Update receipt preview with correct tax calculation before proceeding
    if (previewReceipt && orderForPayment) {
      const updatedReceipt = {
        ...previewReceipt,
        tax: tax.toString(),
        exactTax: tax,
        total: total.toString(),
        exactTotal: total,
      };

      const updatedOrder = {
        ...orderForPayment,
        tax: tax,
        exactTax: tax,
        total: total,
        exactTotal: total,
      };

      setPreviewReceipt(updatedReceipt);
      setOrderForPayment(updatedOrder);

      console.log("🔧 Updated receipt and order with correct tax:", {
        tax: tax,
        total: total,
        updatedReceipt: updatedReceipt,
        updatedOrder: updatedOrder,
      });
    }

    setShowReceiptPreview(false);
    setShowPaymentModal(true);
  };

  // Handler for when receipt preview is cancelled
  const handleReceiptPreviewCancel = () => {
    console.log("❌ POS: Receipt preview cancelled");
    setShowReceiptPreview(false);
    setPreviewReceipt(null);
    setOrderForPayment(null);
    // DON'T clear selected customer on cancel - keep it for retry
    // setSelectedCustomer(null); 
    // setCustomerSearchTerm("");
    // Don't clear customer for the current order on cancel
  };

  // Handler for payment method selection
  const handlePaymentMethodSelect = async (method: string, data?: any) => {
    console.log("🎯 POS: Payment method selected:", method, data);

    if (method === "paymentCompleted" && data?.success) {
      console.log("✅ POS: Payment completed successfully", data);

      // Close payment modal
      setShowPaymentModal(false);

      // CRITICAL: Clear cart immediately after successful payment
      console.log("🧹 POS: Clearing cart after successful payment");
      onClearCart();

      // Clear any active orders
      if (typeof window !== "undefined" && (window as any).clearActiveOrder) {
        (window as any).clearActiveOrder();
      }

      // Reset states including discount
      setPreviewReceipt(null);
      setOrderForPayment(null);
      setLastCartItems([]);
      setSelectedCustomer(null); // Clear selected customer on successful payment
      setCustomerSearchTerm(""); // Clear search term
      setOrderCustomers({}); // Clear all order customers
      
      // Clear discount for all orders
      setOrderDiscounts({});
      setDiscountAmount("0");

      // Show final receipt if needed
      if (data.shouldShowReceipt !== false) {
        console.log("📋 POS: Showing final receipt modal");
        setSelectedReceipt(data.receipt || null);
        setShowReceiptModal(true);
      }

      // Send WebSocket signal for refresh
      try {
        const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        const wsUrl = `https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/ws`;
        const ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          ws.send(
            JSON.stringify({
              type: "payment_success",
              success: true,
              source: "shopping-cart",
              timestamp: new Date().toISOString(),
            }),
          );
          setTimeout(() => ws.close(), 100);
        };
      } catch (error) {
        console.warn("⚠️ WebSocket signal failed (non-critical):", error);
      }

      console.log("🎉 POS: Payment flow completed successfully");
    } else if (method === "paymentError") {
      console.error("❌ POS: Payment failed", data);

      // Close payment modal but keep cart
      setShowPaymentModal(false);

      // Reset states
      setPreviewReceipt(null);
      setOrderForPayment(null);
    } else {
      // For other method selections, close payment modal
      setShowPaymentModal(false);
    }
  };

  const handlePlaceOrder = async () => {
    console.log("=== POS PLACE ORDER STARTED ===");

    if (cart.length === 0) {
      toast({
        title: t("pos.emptyCart"),
        description: t("pos.addProductsToStart"),
        variant: "destructive",
      });
      return;
    }

    // Check if customer is selected
    if (!selectedCustomer) {
      toast({
        title: "Chưa chọn khách hàng",
        description: "Vui lòng chọn khách hàng trước khi đặt hàng",
        variant: "destructive",
      });
      return;
    }

    // Use the EXACT same calculation logic as checkout
    const calculatedSubtotal = subtotal;
    const calculatedTax = tax;
    const baseTotal = Math.round(calculatedSubtotal + calculatedTax);
    const finalDiscount = parseFloat(
      activeOrderId
        ? orderDiscounts[activeOrderId] || "0"
        : discountAmount || "0",
    );
    const finalTotal = Math.max(0, baseTotal - finalDiscount);

    console.log("📝 Place Order Calculation:", {
      subtotal: calculatedSubtotal,
      tax: calculatedTax,
      discount: finalDiscount,
      total: finalTotal,
      customer: selectedCustomer.name,
    });

    // Prepare cart items for order
    const cartItemsForOrder = cart.map((item) => {
      const unitPrice = parseFloat(item.price);
      const quantity = item.quantity;
      const taxRate = parseFloat(item.taxRate || "0") / 100;
      const orderDiscount = parseFloat(
        activeOrderId
          ? orderDiscounts[activeOrderId] || "0"
          : discountAmount || "0",
      );

      let itemDiscountAmount = 0;
      let discountPerUnit = 0;

      if (orderDiscount > 0) {
        const totalBeforeDiscount = cart.reduce((total, cartItem) => {
          return total + parseFloat(cartItem.price) * cartItem.quantity;
        }, 0);

        const currentIndex = cart.findIndex(
          (cartItem) => cartItem.id === item.id,
        );
        const isLastItem = currentIndex === cart.length - 1;

        if (isLastItem) {
          let previousDiscounts = 0;
          for (let i = 0; i < cart.length - 1; i++) {
            const prevItem = cart[i];
            const prevItemTotal =
              parseFloat(prevItem.price) * prevItem.quantity;
            const prevItemDiscount =
              totalBeforeDiscount > 0
                ? Math.round(
                    (orderDiscount * prevItemTotal) / totalBeforeDiscount,
                  )
                : 0;
            previousDiscounts += prevItemDiscount;
          }
          itemDiscountAmount = Math.max(0, orderDiscount - previousDiscounts);
        } else {
          const itemTotal = unitPrice * quantity;
          itemDiscountAmount =
            totalBeforeDiscount > 0
              ? Math.round((orderDiscount * itemTotal) / totalBeforeDiscount)
              : 0;
        }
        discountPerUnit = quantity > 0 ? itemDiscountAmount / quantity : 0;
      }

      let totalAfterDiscount;
      let originalTotal;
      let itemPriceBeforeTax = 0;
      let itemTax = 0;

      if (priceIncludesTax && taxRate > 0) {
        originalTotal = unitPrice * quantity;
        const adjustedPrice = Math.max(0, unitPrice - discountPerUnit);
        const giaGomThue = adjustedPrice * quantity;
        itemPriceBeforeTax = Math.round(giaGomThue / (1 + taxRate));
        itemTax = giaGomThue - itemPriceBeforeTax;
        totalAfterDiscount = itemPriceBeforeTax;
      } else {
        originalTotal = unitPrice * quantity;
        const adjustedPrice = Math.max(0, unitPrice - discountPerUnit);
        itemPriceBeforeTax = Math.round(adjustedPrice * quantity);
        itemTax = taxRate > 0 ? Math.round(itemPriceBeforeTax * taxRate) : 0;
        totalAfterDiscount = itemPriceBeforeTax;
      }

      return {
        productId: item.id,
        productName: item.name,
        quantity: item.quantity,
        unitPrice: item.price,
        total: totalAfterDiscount.toString(),
        notes: null,
        discount: itemDiscountAmount.toString(),
        tax: itemTax.toString(),
        priceBeforeTax: itemPriceBeforeTax.toString(),
      };
    });

    // Create order with "pending" status (đặt hàng chưa thanh toán)
    const orderData = {
      orderNumber: `ORD-${Date.now()}`,
      tableId: null,
      customerId: selectedCustomer.id,
      customerName: selectedCustomer.name,
      customerPhone: selectedCustomer.phone || null,
      customerTaxCode: selectedCustomer.customerTaxCode || null,
      customerAddress: selectedCustomer.address || null,
      customerEmail: selectedCustomer.email || null,
      status: "pending", // Trạng thái: Đặt hàng
      paymentStatus: "pending", // Trạng thái thanh toán: Chưa thanh toán
      customerCount: 1,
      subtotal: Math.floor(calculatedSubtotal).toString(),
      tax: calculatedTax.toString(),
      discount: finalDiscount.toString(),
      total: finalTotal.toString(),
      paymentMethod: null, // Chưa có phương thức thanh toán
      salesChannel: "pos",
      priceIncludeTax: priceIncludesTax,
      einvoiceStatus: 0,
      notes: `Đặt hàng tại POS - Khách hàng: ${selectedCustomer.name}`,
    };

    try {
      console.log("📤 Sending place order request:", {
        orderData,
        items: cartItemsForOrder,
      });

      const response = await fetch("https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order: orderData,
          items: cartItemsForOrder,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to place order");
      }

      const result = await response.json();

      console.log("✅ Order placed successfully:", result);

      toast({
        title: "Đặt hàng thành công",
        description: `Đơn hàng ${result.orderNumber} đã được tạo - Trạng thái: Đặt hàng chưa thanh toán`,
      });

      // Clear cart and customer info
      onClearCart();
      setSelectedCustomer(null);
      setCustomerSearchTerm("");
      if (activeOrderId) {
        setOrderCustomers((prev) => {
          const updated = { ...prev };
          delete updated[activeOrderId];
          return updated;
        });
      }

      // Refresh orders list
      await queryClient.invalidateQueries({ queryKey: ["https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/orders"] });
    } catch (error) {
      console.error("❌ Error placing order:", error);
      toast({
        title: "Lỗi đặt hàng",
        description:
          error instanceof Error
            ? error.message
            : "Không thể đặt hàng. Vui lòng thử lại.",
        variant: "destructive",
      });
    }
  };

  const handleCheckout = async () => {
    console.log("=== POS CHECKOUT STARTED ===");

    if (cart.length === 0) {
      alert("Giỏ hàng trống. Vui lòng thêm sản phẩm trước khi thanh toán.");
      return;
    }

    // SỬ DỤNG ĐÚNG GIÁ TRỊ ĐÃ HIỂN THỊ - KHÔNG TÍNH LẠI
    const displayedSubtotal = subtotal;
    const displayedTax = tax;
    const displayedDiscount = parseFloat(currentOrderDiscount || "0");
    const displayedTotal = total;

    console.log("💰 Using DISPLAYED values:", {
      subtotal: displayedSubtotal,
      tax: displayedTax,
      discount: displayedDiscount,
      total: displayedTotal,
    });

    // Chuẩn bị items với đúng thông tin đã tính toán và hiển thị
    const cartItemsForReceipt = cart.map((item) => {
      const unitPrice = parseFloat(item.price);
      const quantity = item.quantity;
      const taxRate = parseFloat(item.taxRate || "0") / 100;
      const orderDiscount = displayedDiscount;

      // Tính discount cho item này (giống logic hiển thị)
      let itemDiscountAmount = 0;
      if (orderDiscount > 0) {
        const totalBeforeDiscount = cart.reduce((total, cartItem) => {
          return total + parseFloat(cartItem.price) * cartItem.quantity;
        }, 0);

        const currentIndex = cart.findIndex(
          (cartItem) => cartItem.id === item.id,
        );
        const isLastItem = currentIndex === cart.length - 1;

        if (isLastItem) {
          let previousDiscounts = 0;
          for (let i = 0; i < cart.length - 1; i++) {
            const prevItem = cart[i];
            const prevItemTotal =
              parseFloat(prevItem.price) * prevItem.quantity;
            const prevItemDiscount =
              totalBeforeDiscount > 0
                ? Math.round(
                    (orderDiscount * prevItemTotal) / totalBeforeDiscount,
                  )
                : 0;
            previousDiscounts += prevItemDiscount;
          }
          itemDiscountAmount = Math.max(0, orderDiscount - previousDiscounts);
        } else {
          const itemTotal = unitPrice * quantity;
          itemDiscountAmount =
            totalBeforeDiscount > 0
              ? Math.round((orderDiscount * itemTotal) / totalBeforeDiscount)
              : 0;
        }
      }

      const discountPerUnit = quantity > 0 ? itemDiscountAmount / quantity : 0;

      // Tính tax và total (giống logic hiển thị)
      let itemPriceBeforeTax = 0;
      let itemTax = 0;
      let totalAfterDiscount = 0;

      if (priceIncludesTax && taxRate > 0) {
        const adjustedPrice = Math.max(0, unitPrice - discountPerUnit);
        const giaGomThue = adjustedPrice * quantity;
        itemPriceBeforeTax = Math.round(giaGomThue / (1 + taxRate));
        itemTax = giaGomThue - itemPriceBeforeTax;
        totalAfterDiscount = itemPriceBeforeTax;
      } else {
        const adjustedPrice = Math.max(0, unitPrice - discountPerUnit);
        itemPriceBeforeTax = Math.round(adjustedPrice * quantity);
        itemTax = taxRate > 0 ? Math.round(itemPriceBeforeTax * taxRate) : 0;
        totalAfterDiscount = itemPriceBeforeTax;
      }

      return {
        id: item.id,
        productId: item.id,
        productName: item.name,
        quantity: item.quantity,
        unitPrice: unitPrice.toString(),
        total: totalAfterDiscount.toString(),
        price: unitPrice.toString(),
        sku: item.sku || `FOOD${String(item.id).padStart(5, "0")}`,
        taxRate: item.taxRate || "0",
        afterTaxPrice: item.afterTaxPrice,
        discount: itemDiscountAmount.toString(),
        discountAmount: itemDiscountAmount.toString(),
        discountPerUnit: discountPerUnit.toString(),
        originalPrice: unitPrice.toString(),
        originalTotal: (unitPrice * quantity).toString(),
        tax: itemTax.toString(),
        priceBeforeTax: itemPriceBeforeTax.toString(),
      };
    });

    // Receipt preview - sử dụng ĐÚNG giá trị hiển thị
    const receiptPreview = {
      id: `temp-${Date.now()}`,
      orderNumber: `POS-${Date.now()}`,
      customerId: selectedCustomer?.id || null,
      customerName: selectedCustomer?.name || "Khách hàng lẻ",
      customerPhone: selectedCustomer?.phone || null,
      customerTaxCode: selectedCustomer?.customerTaxCode || null,
      customerAddress: selectedCustomer?.address || null,
      customerEmail: selectedCustomer?.email || null,
      tableId: null,
      items: cartItemsForReceipt,
      subtotal: displayedSubtotal.toString(),
      tax: displayedTax.toString(),
      discount: displayedDiscount.toString(),
      total: displayedTotal.toString(),
      exactSubtotal: displayedSubtotal,
      exactTax: displayedTax,
      exactDiscount: displayedDiscount,
      exactTotal: displayedTotal,
      status: "pending",
      paymentStatus: "pending",
      orderedAt: new Date().toISOString(),
      timestamp: new Date().toISOString(),
    };

    // Order for payment - sử dụng ĐÚNG giá trị hiển thị
    const orderForPaymentData = {
      id: `temp-${Date.now()}`,
      orderNumber: `POS-${Date.now()}`,
      tableId: null,
      customerId: selectedCustomer?.id || null,
      customerName: selectedCustomer?.name || "Khách hàng lẻ",
      customerPhone: selectedCustomer?.phone || null,
      customerTaxCode: selectedCustomer?.customerTaxCode || null,
      customerAddress: selectedCustomer?.address || null,
      customerEmail: selectedCustomer?.email || null,
      status: "pending",
      paymentStatus: "pending",
      items: cartItemsForReceipt,
      subtotal: displayedSubtotal,
      tax: displayedTax,
      discount: displayedDiscount.toString(),
      total: displayedTotal,
      exactSubtotal: displayedSubtotal,
      exactTax: displayedTax,
      exactDiscount: displayedDiscount,
      exactTotal: displayedTotal,
      orderedAt: new Date().toISOString(),
    };

    console.log("✅ Receipt & Order data prepared with DISPLAYED values");

    setLastCartItems([...cartItemsForReceipt]);
    setOrderForPayment(orderForPaymentData);
    setPreviewReceipt(receiptPreview);
    setShowReceiptPreview(true);
  };

  // Handler for E-invoice completion
  const handleEInvoiceComplete = async (invoiceData: any) => {
    console.log("📧 POS: E-Invoice completed with data:", invoiceData);
    setShowEInvoiceModal(false);

    // Use the financial data from E-invoice processing (which includes all calculations)
    const receiptData = {
      transactionId: invoiceData.transactionId || `TXN-${Date.now()}`,
      invoiceNumber: invoiceData.invoiceNumber,
      createdAt: new Date().toISOString(),
      cashierName: "Nhân viên",
      customerName:
        invoiceData.customerName || selectedCustomer?.name || "Khách hàng lẻ",
      customerPhone:
        invoiceData.customerPhone || selectedCustomer?.phone || null,
      customerTaxCode:
        invoiceData.taxCode || selectedCustomer?.customerTaxCode || null,
      paymentMethod: "einvoice",
      originalPaymentMethod:
        invoiceData.paymentMethod || selectedPaymentMethod || "cash",
      amountReceived: Math.floor(invoiceData.total || 0).toString(),
      change: "0", // E-invoice doesn't have change
      items: lastCartItems.map((item: any) => ({
        // Use lastCartItems for consistency
        id: item.id,
        productId: item.id,
        productName: item.name,
        quantity: item.quantity,
        price: item.price.toString(),
        total: (parseFloat(item.price) * item.quantity).toString(),
        sku: item.sku || `ITEM${String(item.id).padStart(3, "0")}`,
        taxRate: item.taxRate || 0,
      })),
      subtotal: Math.floor(invoiceData.subtotal || 0).toString(),
      tax: Math.floor(invoiceData.tax || 0).toString(),
      total: Math.floor(invoiceData.total || 0).toString(),
      discount: Math.floor(invoiceData.discount || 0).toString(),
      einvoiceStatus: invoiceData.einvoiceStatus || 0,
    };

    console.log(
      "📄 POS: Showing receipt modal after E-invoice with complete financial data",
    );
    console.log("💰 Receipt data with all details:", receiptData);

    // Clear preview states
    setPreviewReceipt(null);
    setOrderForPayment(null);
    setShowReceiptPreview(false);

    // Show final receipt for printing
    setSelectedReceipt(receiptData);
    setShowReceiptModal(true);
  };

  const canCheckout = cart.length > 0;

  // Helper to clear cart and related states
  const clearCart = useCallback(() => {
    console.log("🧹 Shopping Cart: Clearing cart and states");
    onClearCart();
    setLastCartItems([]);
    setOrderForPayment(null);
    setPreviewReceipt(null);
    setShowReceiptPreview(false);
    setShowPaymentModal(false);
    setShowEInvoiceModal(false);
    setShowReceiptModal(false);
    setSelectedReceipt(null);
    setSelectedCustomer(null); // Clear selected customer
    setCustomerSearchTerm(""); // Clear search term
    setOrderCustomers({}); // Clear all order customers
    
    // Clear all discounts
    setOrderDiscounts({});
    setDiscountAmount("0");

    // Clear any active orders
    if (typeof window !== "undefined" && (window as any).clearActiveOrder) {
      (window as any).clearActiveOrder();
    }

    // Broadcast empty cart
    broadcastCartUpdate();
  }, [onClearCart, broadcastCartUpdate]);

  const removeOrder = (orderId: string) => {
    if (orders.length <= 1) {
      toast({
        title: "Không thể xóa",
        description: "Phải có ít nhất một đơn hàng.",
        variant: "destructive",
      });
      return;
    }

    // Remove customer for this order
    setOrderCustomers((prev) => {
      const updated = { ...prev };
      delete updated[orderId];
      return updated;
    });

    // Remove discount for this order
    setOrderDiscounts((prev) => {
      const updated = { ...prev };
      delete updated[orderId];
      return updated;
    });

    // Use the onRemoveOrder callback from parent component
    if (onRemoveOrder) {
      onRemoveOrder(orderId);
    }
  };

  // Cleanup when component unmounts and handle global events
  useEffect(() => {
    // Handle global popup close events
    const handleCloseAllPopups = (event: CustomEvent) => {
      console.log(
        "🔄 Shopping Cart: Received closeAllPopups event:",
        event.detail,
      );

      // Close all modals
      setShowReceiptPreview(false);
      setShowReceiptModal(false);
      setShowPaymentModal(false);
      setShowEInvoiceModal(false);
      setShowPrintDialog(false); // Ensure print dialog is also closed

      // Clear states
      setPreviewReceipt(null);
      setOrderForPayment(null);
      setSelectedReceipt(null);
      setLastCartItems([]);
      setSelectedCustomer(null); // Clear selected customer
      setCustomerSearchTerm(""); // Clear search term
      setOrderCustomers({}); // Clear all order customers

      // Clear cart after print completion
      if (
        event.detail.source === "print_dialog" ||
        event.detail.action === "print_completed"
      ) {
        console.log("🧹 Shopping Cart: Clearing cart after print completion");
        clearCart();
      }

      // Show success notification if requested
      if (event.detail.showSuccessNotification) {
        toast({
          title: `${t("common.success")}`,
          description: event.detail.message || "Thao tác hoàn tất",
        });
      }
    };

    // Handle cart clear events
    const handleClearCart = (event: CustomEvent) => {
      console.log("🗑️ Shopping Cart: Received clearCart event:", event.detail);
      clearCart(); // Use the memoized clearCart function
    };

    // Handle print completion events
    const handlePrintCompleted = (event: CustomEvent) => {
      console.log(
        "🖨️ Shopping Cart: Received print completed event:",
        event.detail,
      );

      // Close all modals and clear states
      setShowReceiptPreview(false);
      setShowReceiptModal(false);
      setShowPaymentModal(false);
      setShowEInvoiceModal(false);
      setShowPrintDialog(false);

      // Clear all states
      setPreviewReceipt(null);
      setOrderForPayment(null);
      setSelectedReceipt(null);
      setLastCartItems([]);
      setSelectedCustomer(null); // Clear selected customer
      setCustomerSearchTerm(""); // Clear search term
      setOrderCustomers({}); // Clear all order customers

      // Clear cart
      clearCart();

      // Send WebSocket signal for refresh
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: "force_refresh",
            source: "shopping_cart_print_completed",
            success: true,
            timestamp: new Date().toISOString(),
          }),
        );
      }

      toast({
        title: `${t("common.success")}`,
        description: `${t("common.invoiceprintingcompleted")}`,
      });
    };

    // Add event listeners
    if (typeof window !== "undefined") {
      window.addEventListener(
        "closeAllPopups",
        handleCloseAllPopups as EventListener,
      );
      window.addEventListener("clearCart", handleClearCart as EventListener);
      window.addEventListener(
        "printCompleted",
        handlePrintCompleted as EventListener,
      );
    }

    return () => {
      if (typeof window !== "undefined") {
        delete (window as any).eInvoiceCartItems;
        window.removeEventListener(
          "closeAllPopups",
          handleCloseAllPopups as EventListener,
        );
        window.removeEventListener(
          "clearCart",
          handleClearCart as EventListener,
        );
        window.removeEventListener(
          "printCompleted",
          handlePrintCompleted as EventListener,
        );
      }
    };
  }, [clearCart, toast, wsRef]); // Depend on clearCart, toast, and wsRef

  // Effect to sync selected customer with active order customer
  useEffect(() => {
    if (activeOrderId) {
      const customerForOrder = orderCustomers[activeOrderId];
      setSelectedCustomer(customerForOrder || null);
      setCustomerSearchTerm(
        customerForOrder
          ? `${customerForOrder.name} (${customerForOrder.phone})`
          : "",
      );
    } else {
      // If no active order, clear customer selection
      setSelectedCustomer(null);
      setCustomerSearchTerm("");
    }
  }, [activeOrderId, orderCustomers]);

  return (
    <aside className="w-96 bg-white shadow-material border-l pos-border flex flex-col">
      {/* Customer Search Input - Always visible for all business types */}
      <div className="p-4 border-b pos-border bg-gradient-to-r from-blue-50 to-indigo-50 mt-3">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center">
            <svg
              className="w-6 h-6 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
              />
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="text-base font-semibold text-gray-900">
              Thông tin khách hàng
            </h3>
            <p className="text-xs text-gray-500">
              Tìm kiếm hoặc tạo mới khách hàng
            </p>
          </div>
        </div>
        <div className="relative">
          <div className="relative">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <Input
              type="text"
              value={customerSearchTerm}
              onChange={(e) => {
                setCustomerSearchTerm(e.target.value);
                // Clear selected customer when user types
                if (selectedCustomer) {
                  setSelectedCustomer(null);
                }
              }}
              placeholder="Nhập số điện thoại hoặc tên khách hàng..."
              className="w-full pl-10 pr-4 py-2 border-2 border-gray-200 focus:border-blue-500 rounded-lg transition-colors"
            />
          </div>

          {/* Dropdown suggestions */}
          {customerSearchTerm.length > 0 && !selectedCustomer && (
            <div className="absolute top-full left-0 right-0 bg-white border-2 border-blue-200 rounded-lg shadow-2xl z-50 mt-2 max-h-72 overflow-hidden">
              <div className="px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-500">
                <p className="text-xs font-medium text-white">
                  {isSearching ? (
                    <>⏳ Đang tìm kiếm...</>
                  ) : (
                    <>
                      🔍 Tìm thấy {filteredSuggestedCustomers.length} khách hàng
                    </>
                  )}
                </p>
              </div>
              {filteredSuggestedCustomers.length > 0 && (
                <div className="max-h-60 overflow-y-auto">
                  {filteredSuggestedCustomers.map((customer, index) => (
                    <div
                      key={customer.id}
                      className={`p-3 cursor-pointer hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 transition-all duration-200 ${
                        index !== filteredSuggestedCustomers.length - 1
                          ? "border-b border-gray-100"
                          : ""
                      }`}
                      onClick={() => handleCustomerSelect(customer)}
                    >
                      <div className="flex justify-between items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm text-gray-900 truncate">
                            {customer.name}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-gray-600">
                              📞 {customer.phone}
                            </span>
                            {customer.customerTaxCode && (
                              <span className="text-xs text-gray-500 px-2 py-0.5 bg-gray-100 rounded">
                                MST: {customer.customerTaxCode}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 text-blue-600">
                          <span className="text-xs font-medium">Chọn</span>
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M9 5l7 7-7 7"
                            />
                          </svg>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* No results message with quick create button */}
          {customerSearchTerm.length > 0 &&
            filteredSuggestedCustomers.length === 0 &&
            !selectedCustomer && (
              <div className="absolute top-full left-0 right-0 bg-white border border-gray-300 rounded-md shadow-xl z-50 mt-1 p-4">
                <p className="text-sm text-gray-500 text-center mb-3">
                  {/^\d+$/.test(customerSearchTerm)
                    ? `Không tìm thấy khách hàng có SĐT bắt đầu bằng "${customerSearchTerm}"`
                    : `Không tìm thấy khách hàng "${customerSearchTerm}"`}
                </p>
                {/^\d+$/.test(customerSearchTerm) && (
                  <Button
                    onClick={() => {
                      // Pre-fill phone number and open customer form
                      setEditingCustomer(null); // Clear editing customer to create new
                      setShowCustomerForm(true);
                    }}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                    size="sm"
                  >
                    + Tạo khách hàng mới với SĐT {customerSearchTerm}
                  </Button>
                )}
              </div>
            )}
        </div>

        {/* Selected customer display */}
        {selectedCustomer && (
          <div className="mt-3 p-4 bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-200 rounded-lg shadow-sm">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
                <svg
                  className="w-6 h-6 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <button
                  onClick={() => {
                    setEditingCustomer(selectedCustomer);
                    setShowCustomerForm(true);
                  }}
                  className="text-sm font-bold text-green-900 hover:text-green-700 transition-colors inline-flex items-center gap-1 group"
                  title="Xem chi tiết khách hàng"
                >
                  {selectedCustomer.name}
                  <svg
                    className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 7l5 5m0 0l-5 5m5-5H6"
                    />
                  </svg>
                </button>
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <span className="text-xs text-green-700 bg-white px-2 py-1 rounded-md flex items-center gap-1">
                    <svg
                      className="w-3 h-3"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                      />
                    </svg>
                    {selectedCustomer.phone}
                  </span>
                  {selectedCustomer.customerTaxCode && (
                    <span className="text-xs text-green-600 bg-white px-2 py-1 rounded-md">
                      MST: {selectedCustomer.customerTaxCode}
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => {
                  setSelectedCustomer(null);
                  setCustomerSearchTerm("");
                  // Clear customer for the current order
                  if (activeOrderId) {
                    setOrderCustomers((prev) => {
                      const updated = { ...prev };
                      delete updated[activeOrderId];
                      return updated;
                    });
                  }
                }}
                className="w-7 h-7 flex items-center justify-center bg-red-100 hover:bg-red-200 text-red-600 rounded-full transition-colors flex-shrink-0"
                title="Xóa khách hàng"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Purchase History Section */}
      <div className="p-4 border-b pos-border bg-gray-50">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <svg
              className="w-5 h-5 text-gray-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
              />
            </svg>
            <h2 className="text-lg pos-text-primary font-semibold">
              {t("pos.purchaseHistory")}
            </h2>
          </div>
          {onCreateNewOrder && (
            <Button
              onClick={onCreateNewOrder}
              size="sm"
              className="bg-blue-500 hover:bg-blue-600 text-white text-xs px-3 py-1 rounded-md shadow-sm"
            >
              + {t("pos.newOrder")}
            </Button>
          )}
        </div>

        {/* Order Tabs */}
        {orders.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3 max-h-20 overflow-y-auto">
            {orders.map((order) => (
              <div
                key={order.id}
                className={`flex items-center px-3 py-1.5 rounded-lg text-xs cursor-pointer transition-all duration-200 ${
                  activeOrderId === order.id
                    ? "bg-blue-500 text-white border-2 border-blue-600 shadow-md"
                    : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
                }`}
                onClick={() => onSwitchOrder?.(order.id)}
              >
                <span className="truncate max-w-16 font-medium">
                  {order.name}
                </span>
                <span className="ml-1.5 text-xs opacity-90">
                  ({order.cart.length})
                </span>
                {orders.length > 1 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeOrder(order.id); // Use the new removeOrder function
                    }}
                    className={`ml-2 w-4 h-4 flex items-center justify-center rounded-full transition-colors ${
                      activeOrderId === order.id
                        ? "bg-white/20 hover:bg-white/30 text-white"
                        : "bg-red-100 hover:bg-red-200 text-red-600"
                    }`}
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between text-sm pos-text-secondary bg-white px-3 py-2 rounded-md">
          <span className="flex items-center gap-1">
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
            <span className="font-medium">{cart.length}</span>{" "}
            {t("common.items")}
          </span>
          {cart.length > 0 && (
            <button
              onClick={() => {
                console.log("🧹 Shopping Cart: Clear cart button clicked");
                clearCart();
              }}
              className="flex items-center gap-1 text-red-500 hover:text-red-700 transition-colors font-medium"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
              {t("pos.clearCart")}
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {cart.length === 0 ? (
          <div className="text-center py-12">
            <CartIcon className="mx-auto text-gray-400 mb-4" size={48} />
            <h3 className="text-lg font-medium pos-text-secondary mb-2">
              {t("pos.emptyCart")}
            </h3>
            <p className="pos-text-tertiary">{t("pos.addProductsToStart")}</p>
          </div>
        ) : (
          cart.map((item) => (
            <div key={item.id} className="bg-gray-50 rounded-lg p-2">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0 pr-2">
                  <h4 className="font-medium pos-text-primary text-sm truncate">
                    {item.name}
                  </h4>
                  <div className="space-y-1">
                    <p className="text-xs pos-text-secondary">
                      {Math.round(getDisplayPrice(item)).toLocaleString(
                        "vi-VN",
                      )}{" "}
                      ₫ {t("pos.each")}
                    </p>
                    {item.taxRate && parseFloat(item.taxRate) > 0 && (
                      <p className="text-xs text-orange-600">
                        Thuế ({item.taxRate}%):{" "}
                        {(() => {
                          const unitPrice = parseFloat(item.price);
                          const quantity = item.quantity;
                          const taxRate = parseFloat(item.taxRate) / 100;
                          const orderDiscount = parseFloat(
                            currentOrderDiscount || "0",
                          );

                          // Calculate discount for this item
                          let itemDiscountAmount = 0;
                          if (orderDiscount > 0) {
                            const totalBeforeDiscount = cart.reduce(
                              (total, cartItem) => {
                                return (
                                  total +
                                  parseFloat(cartItem.price) * cartItem.quantity
                                );
                              },
                              0,
                            );

                            const currentIndex = cart.findIndex(
                              (cartItem) => cartItem.id === item.id,
                            );
                            const isLastItem = currentIndex === cart.length - 1;

                            if (isLastItem) {
                              // Last item: total discount - sum of all previous discounts
                              let previousDiscounts = 0;
                              for (let i = 0; i < cart.length - 1; i++) {
                                const prevItem = cart[i];
                                const prevItemTotal =
                                  parseFloat(prevItem.price) *
                                  prevItem.quantity;
                                const prevItemDiscount =
                                  totalBeforeDiscount > 0
                                    ? Math.round(
                                        (orderDiscount * prevItemTotal) /
                                          totalBeforeDiscount,
                                      )
                                    : 0;
                                previousDiscounts += prevItemDiscount;
                              }
                              itemDiscountAmount =
                                orderDiscount - previousDiscounts;
                            } else {
                              // Regular calculation for non-last items
                              const itemTotal = unitPrice * quantity;
                              itemDiscountAmount =
                                totalBeforeDiscount > 0
                                  ? Math.round(
                                      (orderDiscount * itemTotal) /
                                        totalBeforeDiscount,
                                    )
                                  : 0;
                            }
                          }

                          if (priceIncludesTax) {
                            // When price includes tax:
                            // giá bao gồm thuế = (price - (discount/quantity)) * quantity
                            const discountPerUnit =
                              itemDiscountAmount / quantity;
                            const adjustedPrice = Math.max(
                              0,
                              unitPrice - discountPerUnit,
                            );
                            const giaGomThue = adjustedPrice * quantity;
                            // subtotal = giá bao gồm thuế / (1 + (taxRate / 100)) (làm tròn)
                            const tamTinh = Math.round(
                              giaGomThue / (1 + taxRate),
                            );
                            // tax = giá bao gồm thuế - subtotal
                            return giaGomThue - tamTinh;
                          } else {
                            // When price doesn't include tax:
                            // subtotal = (price - (discount/quantity)) * quantity
                            const discountPerUnit =
                              itemDiscountAmount / quantity;
                            const adjustedPrice = Math.max(
                              0,
                              unitPrice - discountPerUnit,
                            );
                            const tamTinh = adjustedPrice * quantity;
                            // tax = subtotal * (taxRate / 100) (làm tròn)
                            return Math.round(tamTinh * taxRate);
                          }
                        })().toLocaleString("vi-VN")}{" "}
                        ₫
                      </p>
                    )}

                    {/* Individual item discount display */}
                    {(() => {
                      // Calculate discount for this item using SAME logic as tax calculation
                      const orderDiscount = parseFloat(
                        currentOrderDiscount || "0",
                      );
                      if (orderDiscount > 0) {
                        const originalPrice = parseFloat(item.price);
                        const quantity = item.quantity;
                        const taxRate = parseFloat(item.taxRate || "0") / 100;

                        let itemDiscountAmount = 0;

                        if (priceIncludesTax) {
                          // For price includes tax: use total price for discount calculation
                          let giaGomThue = originalPrice * quantity;

                          const currentIndex = cart.findIndex(
                            (cartItem) => cartItem.id === item.id,
                          );
                          const isLastItem = currentIndex === cart.length - 1;

                          if (isLastItem) {
                            // Last item: total discount - sum of all previous discounts
                            let previousDiscounts = 0;
                            const totalBeforeDiscount = cart.reduce(
                              (sum, itm) => {
                                return (
                                  sum + parseFloat(itm.price) * itm.quantity
                                );
                              },
                              0,
                            );

                            for (let i = 0; i < cart.length - 1; i++) {
                              const prevItem = cart[i];
                              const prevItemTotal =
                                parseFloat(prevItem.price) * prevItem.quantity;
                              const prevItemDiscount =
                                totalBeforeDiscount > 0
                                  ? Math.round(
                                      (orderDiscount * prevItemTotal) /
                                        totalBeforeDiscount,
                                    )
                                  : 0;
                              previousDiscounts += prevItemDiscount;
                            }
                            itemDiscountAmount =
                              orderDiscount - previousDiscounts;
                          } else {
                            // Regular calculation for non-last items
                            const totalBeforeDiscount = cart.reduce(
                              (sum, itm) => {
                                return (
                                  sum + parseFloat(itm.price) * itm.quantity
                                );
                              },
                              0,
                            );
                            itemDiscountAmount =
                              totalBeforeDiscount > 0
                                ? Math.round(
                                    (orderDiscount * giaGomThue) /
                                      totalBeforeDiscount,
                                  )
                                : 0;
                          }
                        } else {
                          // For price doesn't include tax: use subtotal for discount calculation
                          let tamTinh = originalPrice * quantity;

                          const currentIndex = cart.findIndex(
                            (cartItem) => cartItem.id === item.id,
                          );
                          const isLastItem = currentIndex === cart.length - 1;

                          if (isLastItem) {
                            // Last item: total discount - sum of all previous discounts
                            let previousDiscounts = 0;
                            const totalBeforeDiscount = cart.reduce(
                              (sum, itm) => {
                                return (
                                  sum + parseFloat(itm.price) * itm.quantity
                                );
                              },
                              0,
                            );

                            for (let i = 0; i < cart.length - 1; i++) {
                              const prevItem = cart[i];
                              const prevItemTotal =
                                parseFloat(prevItem.price) * prevItem.quantity;
                              const prevItemDiscount =
                                totalBeforeDiscount > 0
                                  ? Math.round(
                                      (orderDiscount * prevItemTotal) /
                                        totalBeforeDiscount,
                                    )
                                  : 0;
                              previousDiscounts += prevItemDiscount;
                            }
                            itemDiscountAmount =
                              orderDiscount - previousDiscounts;
                          } else {
                            // Regular calculation for non-last items
                            const totalBeforeDiscount = cart.reduce(
                              (sum, itm) => {
                                return (
                                  sum + parseFloat(itm.price) * itm.quantity
                                );
                              },
                              0,
                            );
                            itemDiscountAmount =
                              totalBeforeDiscount > 0
                                ? Math.round(
                                    (orderDiscount * tamTinh) /
                                      totalBeforeDiscount,
                                  )
                                : 0;
                          }
                        }

                        return itemDiscountAmount > 0 ? (
                          <p className="text-xs text-red-600">
                            {t("common.discount")}: -
                            {Math.floor(itemDiscountAmount).toLocaleString(
                              "vi-VN",
                            )}{" "}
                            ₫
                          </p>
                        ) : null;
                      }
                      return null;
                    })()}
                  </div>
                </div>
                <div className="flex flex-col items-end space-y-2">
                  <div className="flex items-center space-x-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const productId =
                          typeof item.id === "string"
                            ? parseInt(item.id)
                            : item.id;
                        onUpdateQuantity(productId, item.quantity - 1);
                      }}
                      className="w-6 h-6 p-0"
                      disabled={item.quantity <= 1}
                    >
                      <Minus size={10} />
                    </Button>
                    <Input
                      type="number"
                      min="1"
                      max={item.trackInventory !== false ? item.stock : 999999}
                      value={item.quantity}
                      onChange={(e) => {
                        const newQuantity = parseInt(e.target.value) || 1;
                        if (item.trackInventory !== false) {
                          // Sản phẩm có check tồn kho - giới hạn theo stock
                          const maxQuantity = item.stock || 0;
                          if (newQuantity >= 1 && newQuantity <= maxQuantity) {
                            const productId =
                              typeof item.id === "string"
                                ? parseInt(item.id)
                                : item.id;
                            onUpdateQuantity(productId, newQuantity);
                          }
                        } else {
                          // Sản phẩm không check tồn kho - cho phép nhập tự do
                          if (newQuantity >= 1 && newQuantity <= 999999) {
                            const productId =
                              typeof item.id === "string"
                                ? parseInt(item.id)
                                : item.id;
                            onUpdateQuantity(productId, newQuantity);
                          }
                        }
                      }}
                      className="w-12 h-6 text-center text-xs p-1 border rounded"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const productId =
                          typeof item.id === "string"
                            ? parseInt(item.id)
                            : item.id;
                        onUpdateQuantity(productId, item.quantity + 1);
                      }}
                      className="w-6 h-6 p-0"
                      disabled={
                        item.trackInventory === true &&
                        item.quantity >= (item.stock || 0)
                      }
                    >
                      <Plus size={10} />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const productId =
                          typeof item.id === "string"
                            ? parseInt(item.id)
                            : item.id;
                        console.log(
                          `🗑️ Shopping Cart: Remove item ${productId} (${item.name})`,
                        );
                        onRemoveItem(productId);
                      }}
                      className="w-6 h-6 p-0 text-red-500 hover:text-red-700 border-red-300 hover:border-red-500"
                    >
                      <Trash2 size={10} />
                    </Button>
                  </div>
                  <div className="font-bold pos-text-primary text-sm">
                    {parseFloat(item.total).toLocaleString("vi-VN", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}{" "}
                    ₫
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
      {/* Cart Summary */}
      {cart.length > 0 && (
        <div className="border-t pos-border p-4 space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="pos-text-secondary">{t("pos.totalAmount")}</span>
              <span className="font-medium">
                {Math.round(subtotal).toLocaleString("vi-VN")} ₫
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="pos-text-secondary">{t("pos.tax")}</span>
              <span className="font-medium">
                {Math.round(tax).toLocaleString("vi-VN")} ₫
              </span>
            </div>

            {/* Discount Input */}
            <div className="space-y-2">
              <Label className="text-sm font-medium pos-text-primary">
                {t("common.discount")} (₫)
              </Label>
              <Input
                type="text"
                value={
                  currentOrderDiscount && parseFloat(currentOrderDiscount) > 0
                    ? parseFloat(currentOrderDiscount).toLocaleString("vi-VN")
                    : ""
                }
                onChange={(e) => {
                  const value = Math.max(
                    0,
                    parseFloat(e.target.value.replace(/[^\d]/g, "")) || 0,
                  );
                  setDiscountAmount(value.toString()); // Update local state for input display
                  if (activeOrderId) {
                    setOrderDiscounts((prev) => ({
                      ...prev,
                      [activeOrderId]: value.toString(),
                    }));
                  } else {
                    // If no active order, update discount amount directly
                    setDiscountAmount(value.toString());
                  }

                  // Send discount update via WebSocket with proper cart items
                  if (
                    wsRef.current &&
                    wsRef.current.readyState === WebSocket.OPEN
                  ) {
                    // Ensure cart items have proper structure
                    const validatedCart = cart.map((item) => ({
                      ...item,
                      name:
                        item.name ||
                        item.productName ||
                        item.product?.name ||
                        `Sản phẩm ${item.id}`,
                      productName:
                        item.name ||
                        item.productName ||
                        item.product?.name ||
                        `Sản phẩm ${item.id}`,
                      price: item.price || "0",
                      quantity: item.quantity || 1,
                      total: item.total || "0",
                    }));

                    wsRef.current.send(
                      JSON.stringify({
                        type: "cart_update",
                        cart: validatedCart, // Send validated cart items
                        subtotal: Math.floor(subtotal),
                        tax: Math.floor(tax),
                        total: Math.floor(total), // Total before discount
                        discount: value, // The new discount value
                        orderNumber: activeOrderId || `ORD-${Date.now()}`,
                        timestamp: new Date().toISOString(),
                        updateType: "discount_update", // Indicate this is a discount update
                      }),
                    );

                    console.log(
                      "📡 Shopping Cart: Discount update broadcasted:",
                      {
                        discount: value,
                        cartItems: validatedCart.length,
                        total: Math.floor(total),
                      },
                    );
                  }
                }}
                placeholder="0"
                className="text-right"
              />
            </div>

            <div className="border-t pt-2">
              <div className="flex justify-between">
                <span className="text-lg font-bold pos-text-primary">
                  {t("tables.total")}:
                </span>
                <span className="text-lg font-bold text-blue-600">
                  {(() => {
                    const baseTotal = Math.round(subtotal + tax);
                    const finalTotal = baseTotal;

                    console.log("🔍 Total Calculation Debug:", {
                      subtotal: subtotal,
                      tax: tax,
                      baseTotal: baseTotal,
                      finalTotal: finalTotal,
                      calculation: `${subtotal} + ${tax} = ${finalTotal}`,
                    });

                    return finalTotal.toLocaleString("vi-VN");
                  })()}{" "}
                  ₫
                </span>
              </div>
            </div>
          </div>

          {/* Cash Payment */}
          {paymentMethod === "cash" && (
            <div className="space-y-2">
              <Label className="text-sm font-medium pos-text-primary">
                {t("tables.amountReceived")}
              </Label>
              <Input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={amountReceived}
                onChange={(e) => setAmountReceived(e.target.value)}
              />
              <div className="flex justify-between text-sm">
                <span className="pos-text-secondary">
                  {t("tables.change")}:
                </span>
                <span className="font-bold text-green-600">
                  {change.toLocaleString("vi-VN", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}{" "}
                  ₫
                </span>
              </div>
            </div>
          )}

          <div className="flex gap-2">
            {storeSettings?.businessType === "laundry" && (
              <Button
                onClick={handlePlaceOrder}
                disabled={
                  cart.length === 0 || isProcessing || !selectedCustomer
                }
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 text-lg disabled:opacity-50 disabled:cursor-not-allowed"
                title={
                  !selectedCustomer
                    ? "Vui lòng chọn khách hàng trước khi đặt hàng"
                    : ""
                }
              >
                {t("pos.placeOrder")}
              </Button>
            )}
            <Button
              onClick={handleCheckout}
              disabled={
                cart.length === 0 ||
                isProcessing ||
                (storeSettings?.businessType === "laundry" && !selectedCustomer)
              }
              className={`${storeSettings?.businessType !== "laundry" ? "w-full" : "flex-1"} bg-green-600 hover:bg-green-700 text-white font-medium py-3 text-lg disabled:opacity-50 disabled:cursor-not-allowed`}
              title={
                storeSettings?.businessType === "laundry" && !selectedCustomer
                  ? "Vui lòng chọn khách hàng trước khi thanh toán"
                  : ""
              }
            >
              {isProcessing ? t("tables.placing") : t("pos.checkout")}
            </Button>
          </div>
        </div>
      )}

      {/* Receipt Preview Modal - Shows first like order management */}
      {showReceiptPreview && previewReceipt && (
        <ReceiptModal
          isOpen={showReceiptPreview}
          onClose={handleReceiptPreviewCancel}
          receipt={{
            ...previewReceipt,
            orderForPayment: orderForPayment,
            cartItems: lastCartItems,
          }}
          cartItems={lastCartItems}
          total={previewReceipt?.exactTotal || 0}
          isPreview={true}
          onConfirm={(orderData) => {
            console.log(
              "📦 Shopping Cart: Received order data from receipt modal:",
              orderData,
            );
            // Update orderForPayment with complete data
            setOrderForPayment(orderData || previewReceipt);
            handleReceiptPreviewConfirm();
          }}
        />
      )}

      {/* Payment Method Modal - Shows after receipt preview confirmation */}
      {showPaymentModal && orderForPayment && previewReceipt && (
        <PaymentMethodModal
          isOpen={showPaymentModal}
          onClose={() => {
            console.log("🔄 Closing Payment Method Modal");
            setShowPaymentModal(false);
            setPreviewReceipt(null);
            setOrderForPayment(null);
          }}
          onSelectMethod={handlePaymentMethodSelect}
          total={(() => {
            console.log(
              "🔍 Shopping Cart: Payment Modal Total Debug (VALIDATED):",
              {
                showPaymentModal: showPaymentModal,
                orderForPayment: orderForPayment,
                previewReceipt: previewReceipt,
                orderExactTotal: orderForPayment?.exactTotal,
                orderTotal: orderForPayment?.total,
                previewTotal: previewReceipt?.exactTotal,
                fallbackTotal: total,
                cartItemsCount: cart.length,
                hasValidOrderData: !!(orderForPayment && previewReceipt),
              },
            );

            // If we have valid order data, use it, otherwise use current cart calculation
            if (orderForPayment && previewReceipt) {
              const finalTotal =
                orderForPayment?.exactTotal ||
                orderForPayment?.total ||
                previewReceipt?.exactTotal ||
                previewReceipt?.total ||
                0;

              console.log(
                "💰 Shopping Cart: Using order/receipt total:",
                finalTotal,
              );
              return finalTotal;
            } else {
              // Fallback: Calculate from current cart
              const cartTotal = cart.reduce((sum, item) => {
                const itemTotal = parseFloat(item.total);
                return sum + itemTotal;
              }, 0);

              const cartTax = cart.reduce((sum, item) => {
                if (item.taxRate && parseFloat(item.taxRate) > 0) {
                  const basePrice = parseFloat(item.price);
                  if (
                    item.afterTaxPrice &&
                    item.afterTaxPrice !== null &&
                    item.afterTaxPrice !== ""
                  ) {
                    const afterTaxPrice = parseFloat(item.afterTaxPrice);
                    const taxPerItem = afterTaxPrice - basePrice;
                    return sum + Math.round(taxPerItem * item.quantity);
                  }
                }
                return sum;
              }, 0);

              const finalTotal = Math.round(cartTotal + cartTax);
              console.log(
                "💰 Shopping Cart: Using calculated cart total:",
                finalTotal,
              );
              return finalTotal;
            }
          })()}
          orderForPayment={orderForPayment}
          products={products}
          receipt={previewReceipt}
          cartItems={(() => {
            console.log(
              "📦 Shopping Cart: Cart Items Debug for Payment Modal (VALIDATED):",
              {
                orderForPaymentItems: orderForPayment?.items?.length || 0,
                previewReceiptItems: previewReceipt?.items?.length || 0,
                currentCartItems: cart?.length || 0,
                lastCartItems: lastCartItems?.length || 0,
                hasValidOrderData: !!(orderForPayment && previewReceipt),
              },
            );

            // If we have stored cart items from checkout process, use them first
            if (lastCartItems && lastCartItems.length > 0) {
              console.log(
                "📦 Shopping Cart: Using lastCartItems (most accurate):",
                lastCartItems,
              );
              return lastCartItems;
            }

            // If we have valid order data, use it
            if (orderForPayment?.items && orderForPayment.items.length > 0) {
              const mappedItems = orderForPayment.items.map((item) => ({
                id: item.id || item.productId,
                name: item.name || item.productName,
                price:
                  typeof (item.price || item.unitPrice) === "string"
                    ? parseFloat(item.price || item.unitPrice)
                    : item.price || item.unitPrice,
                quantity: item.quantity,
                sku:
                  item.sku ||
                  `FOOD${String(item.id || item.productId).padStart(5, "0")}`,
                taxRate: item.taxRate || 0,
                afterTaxPrice: item.afterTaxPrice,
              }));
              console.log(
                "📦 Shopping Cart: Using orderForPayment items:",
                mappedItems,
              );
              return mappedItems;
            }

            // Fallback to current cart
            if (cart && cart.length > 0) {
              const mappedItems = cart.map((item) => ({
                id: item.id,
                name: item.name,
                price:
                  typeof item.price === "string"
                    ? parseFloat(item.price)
                    : item.price,
                quantity: item.quantity,
                sku: item.sku || `FOOD${String(item.id).padStart(5, "0")}`,
                taxRate:
                  typeof item.taxRate === "string"
                    ? parseFloat(item.taxRate || "0")
                    : item.taxRate || 0,
                afterTaxPrice: item.afterTaxPrice,
              }));
              console.log(
                "📦 Shopping Cart: Using current cart as fallback:",
                mappedItems,
              );
              return mappedItems;
            }

            console.error(
              "❌ CRITICAL ERROR: No valid items found for Payment Modal",
            );
            return [];
          })()}
        />
      )}

      {/* Final Receipt Modal - Shows after successful payment */}
      {(showReceiptModal || selectedReceipt) && (
        <ReceiptModal
          isOpen={showReceiptModal}
          onClose={() => {
            console.log(
              "🔄 Shopping Cart: Receipt modal closing, clearing cart and sending comprehensive refresh signal",
            );

            // Close modal and clear states
            setShowReceiptModal(false);
            setSelectedReceipt(null);
            setLastCartItems([]);
            setOrderForPayment(null);
            setPreviewReceipt(null);
            setIsProcessingPayment(false);

            // Clear cart immediately
            clearCart(); // Use the memoized clearCart function

            // Send comprehensive refresh signals
            try {
              if (
                wsRef.current &&
                wsRef.current.readyState === WebSocket.OPEN
              ) {
                // Send multiple signals to ensure all components refresh
                wsRef.current.send(
                  JSON.stringify({
                    type: "popup_close",
                    success: true,
                    source: "shopping-cart-receipt",
                    timestamp: new Date().toISOString(),
                  }),
                );

                wsRef.current.send(
                  JSON.stringify({
                    type: "force_refresh",
                    source: "shopping-cart-receipt-close",
                    success: true,
                    timestamp: new Date().toISOString(),
                  }),
                );

                wsRef.current.send(
                  JSON.stringify({
                    type: "payment_success",
                    source: "shopping-cart-receipt-complete",
                    success: true,
                    timestamp: new Date().toISOString(),
                  }),
                );
              } else {
                // Fallback WebSocket connection if main one is not available
                const protocol =
                  window.location.protocol === "https:" ? "wss:" : "ws:";
                const wsUrl = `https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/ws`;
                const fallbackWs = new WebSocket(wsUrl);

                fallbackWs.onopen = () => {
                  fallbackWs.send(
                    JSON.stringify({
                      type: "popup_close",
                      success: true,
                      source: "shopping-cart-receipt-fallback",
                      timestamp: new Date().toISOString(),
                    }),
                  );

                  fallbackWs.send(
                    JSON.stringify({
                      type: "force_refresh",
                      source: "shopping-cart-receipt-fallback",
                      success: true,
                      timestamp: new Date().toISOString(),
                    }),
                  );

                  setTimeout(() => fallbackWs.close(), 100);
                };
              }
            } catch (error) {
              console.error(
                "❌ Shopping Cart: Failed to send refresh signal:",
                error,
              );
            }

            // Dispatch custom events for components that might not use WebSocket
            if (typeof window !== "undefined") {
              window.dispatchEvent(
                new CustomEvent("closeAllPopups", {
                  detail: {
                    source: "shopping_cart_receipt_close",
                    success: true,
                    action: "receipt_modal_closed",
                    showSuccessNotification: true,
                    message: "Thanh toán hoàn tất. Dữ liệu đã được cập nhật.",
                    timestamp: new Date().toISOString(),
                  },
                }),
              );

              window.dispatchEvent(
                new CustomEvent("refreshAllData", {
                  detail: {
                    source: "shopping_cart_receipt_close",
                    timestamp: new Date().toISOString(),
                  },
                }),
              );
            }

            console.log(
              "✅ Shopping Cart: Receipt modal closed with comprehensive refresh signals sent",
            );
          }}
          receipt={selectedReceipt}
          cartItems={
            selectedReceipt?.items ||
            lastCartItems.map((item) => ({
              id: item.id,
              name: item.name,
              price: parseFloat(item.price),
              quantity: item.quantity,
              sku: `ITEM${String(item.id).padStart(3, "0")}`,
              taxRate: parseFloat(item.taxRate || "0"),
            })) ||
            cart.map((item) => ({
              id: item.id,
              name: item.name,
              price: parseFloat(item.price),
              quantity: item.quantity,
              sku: `ITEM${String(item.id).padStart(3, "0")}`,
              taxRate: parseFloat(item.taxRate || "0"),
            }))
          }
        />
      )}

      {/* E-Invoice Modal for invoice processing */}
      {showEInvoiceModal && (
        <EInvoiceModal
          isOpen={showEInvoiceModal}
          onClose={() => {
            console.log("🔴 POS: Closing E-invoice modal");
            setShowEInvoiceModal(false);
            setIsProcessingPayment(false);

            // Don't clear cart here - let the e-invoice modal handle it
            console.log("🔴 POS: E-invoice modal closed without clearing cart");
          }}
          onConfirm={handleEInvoiceComplete}
          total={(() => {
            // Use the most accurate total available
            const totalToUse =
              orderForPayment?.exactTotal ||
              orderForPayment?.total ||
              previewReceipt?.exactTotal ||
              previewReceipt?.total ||
              total;

            console.log("🔍 POS E-Invoice Modal - Total calculation debug:", {
              orderForPaymentExactTotal: orderForPayment?.exactTotal,
              orderForPaymentTotal: orderForPayment?.total,
              previewReceiptExactTotal: previewReceipt?.exactTotal,
              previewReceiptTotal: previewReceipt?.total,
              fallbackTotal: total,
              finalTotalToUse: totalToUse,
            });

            return Math.floor(totalToUse || 0);
          })()}
          selectedPaymentMethod={selectedPaymentMethod}
          cartItems={(() => {
            // Use the most accurate cart items available
            const itemsToUse =
              lastCartItems.length > 0
                ? lastCartItems
                : orderForPayment?.items?.length > 0
                  ? orderForPayment.items.map((item) => ({
                      id: item.id || item.productId,
                      name: item.name || item.productName,
                      price:
                        typeof (item.price || item.unitPrice) === "string"
                          ? parseFloat(item.price || item.unitPrice)
                          : item.price || item.unitPrice,
                      quantity: item.quantity,
                      sku:
                        item.sku ||
                        `FOOD${String(item.id || item.productId).padStart(5, "0")}`,
                      taxRate:
                        typeof item.taxRate === "string"
                          ? parseFloat(item.taxRate || "0")
                          : item.taxRate || 0,
                      afterTaxPrice: item.afterTaxPrice,
                    }))
                  : cart.map((item) => ({
                      id: item.id,
                      name: item.name,
                      price:
                        typeof item.price === "string"
                          ? parseFloat(item.price)
                          : item.price,
                      quantity: item.quantity,
                      sku:
                        item.sku || `FOOD${String(item.id).padStart(5, "0")}`,
                      taxRate:
                        typeof item.taxRate === "string"
                          ? parseFloat(item.taxRate || "0")
                          : item.taxRate || 0,
                      afterTaxPrice: item.afterTaxPrice,
                    }));

            console.log(
              "🔍 POS E-Invoice Modal - Cart items calculation debug:",
              {
                lastCartItemsLength: lastCartItems.length,
                orderForPaymentItemsLength: orderForPayment?.items?.length || 0,
                currentCartLength: cart.length,
                finalItemsToUseLength: itemsToUse.length,
                finalItemsToUse: itemsToUse,
              },
            );

            return itemsToUse;
          })()}
          source="pos"
        />
      )}

      {/* Customer Form Modal */}
      {showCustomerForm && (
        <CustomerFormModal
          isOpen={showCustomerForm}
          onClose={() => {
            setShowCustomerForm(false);
            setEditingCustomer(null);
            // Refresh customer search after creating new customer
            if (customerSearchTerm.length > 0) {
              fetchCustomers(customerSearchTerm);
            }
          }}
          customer={editingCustomer}
          initialPhone={editingCustomer ? undefined : customerSearchTerm}
        />
      )}
    </aside>
  );
}
