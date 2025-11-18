import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Plus, Minus, ShoppingCart } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Table, Product, Category } from "@shared/schema";
import { useTranslation } from "@/lib/i18n";
import { ReceiptModal } from "../pos/receipt-modal";

interface OrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  table: Table | null;
  existingOrder?: any;
  mode?: "create" | "edit";
}

interface CartItem {
  product: Product;
  quantity: number;
  notes?: string;
  itemDiscount?: number; // Individual item discount
  itemDiscountPercent?: number; // Individual item discount percentage
  itemDiscountType?: "amount" | "percent"; // Type of individual item discount
}

// Helper function for currency formatting
const formatCurrency = (amount: string): string => {
  return parseFloat(amount).toLocaleString("vi-VN", {
    style: "currency",
    currency: "VND",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
};

export function OrderDialog({
  open,
  onOpenChange,
  table,
  existingOrder,
  mode = "create",
}: OrderDialogProps) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [customerCount, setCustomerCount] = useState(1);
  const [discount, setDiscount] = useState(0);
  const [discountType, setDiscountType] = useState<"amount" | "percent">(
    "amount",
  );
  const [discountPercent, setDiscountPercent] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [existingItems, setExistingItems] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState(""); // State for search input
  const { toast } = useToast();
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  // State for receipt preview
  const [previewReceipt, setPreviewReceipt] = useState<any>(null);
  const [showReceiptPreview, setShowReceiptPreview] = useState(false);
  const [showDeleteItemDialog, setShowDeleteItemDialog] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<any>(null);
  const [showReduceQtyDialog, setShowReduceQtyDialog] = useState(false);
  const [itemToReduce, setItemToReduce] = useState<any>(null);
  const [deleteNote, setDeleteNote] = useState("");
  const [reduceNote, setReduceNote] = useState("");
  const [showIncreaseQtyDialog, setShowIncreaseQtyDialog] = useState(false);
  const [itemToIncrease, setItemToIncrease] = useState<any>(null);
  const [increaseNote, setIncreaseNote] = useState("");

  const { data: products } = useQuery({
    queryKey: ["http://42.118.102.26:4500/api/products/active"],
  });

  const { data: categories, isLoading: categoriesLoading } = useQuery({
    queryKey: ["http://42.118.102.26:4500/api/categories"],
  });

  const { data: storeSettings } = useQuery({
    queryKey: ["http://42.118.102.26:4500/api/store-settings"],
  });

  const { data: existingOrderItems, refetch: refetchExistingItems } = useQuery({
    queryKey: ["http://42.118.102.26:4500/api/order-items", existingOrder?.id],
    enabled: !!(existingOrder?.id && mode === "edit" && open),
    staleTime: 0,
    queryFn: async () => {
      console.log("Fetching existing order items for order:", existingOrder.id);
      const response = await apiRequest(
        "GET",
        `http://42.118.102.26:4500/api/order-items/${existingOrder.id}`,
      );
      const data = await response.json();
      console.log("Existing order items response:", data);
      return data;
    },
  });

  // Refetch existing items when dialog opens in edit mode
  useEffect(() => {
    if (mode === "edit" && open && existingOrder?.id) {
      console.log("Dialog opened in edit mode, refetching existing items");
      refetchExistingItems();
    }
  }, [mode, open, existingOrder?.id, refetchExistingItems]);

  const createOrderMutation = useMutation({
    mutationFn: async (orderData: {
      order: any;
      items: any[];
      existingItems?: any[];
    }) => {
      console.log("=== ORDER MUTATION STARTED ===");
      console.log("Mode:", mode);
      console.log("Existing order:", existingOrder);
      console.log(
        mode === "edit" ? "Updating existing order:" : "Creating new order:",
        JSON.stringify(orderData, null, 2),
      );

      try {
        if (mode === "edit" && existingOrder) {
          let finalResult = null;

          // Step 1: Add new items if any exist
          if (orderData.items.length > 0) {
            console.log(
              `📝 Adding ${orderData.items.length} new items to existing order ${existingOrder.id}`,
            );
            const addItemsResponse = await apiRequest(
              "POST",
              `http://42.118.102.26:4500/api/orders/${existingOrder.id}/items`,
              {
                items: orderData.items,
              },
            );

            const addItemsResult = await addItemsResponse.json();
            console.log("✅ Items added successfully:", addItemsResult);
            finalResult = addItemsResult.updatedOrder || addItemsResult;
          } else {
            console.log(
              `📝 No new items to add to order ${existingOrder.id}, proceeding with order update only`,
            );
          }

          // Step 1.5: If we have existing item changes, call recalculate API first
          const hasExistingItemChanges =
            existingItems.length !== (existingOrderItems?.length || 0);

          // Calculate total discount from individual items
          const sumOfItemDiscounts =
            existingItems.reduce((sum, item) => {
              return sum + parseFloat(item.discount || "0");
            }, 0) +
            cart.reduce((sum, item) => {
              return sum + parseFloat((item as any).itemDiscount || "0");
            }, 0);

          // Check if order discount equals sum of item discounts
          const discountsMatch = Math.abs(discount - sumOfItemDiscounts) < 0.01;

          const shouldRecalculate =
            hasExistingItemChanges ||
            (parseFloat(existingOrder.discount || "0") !== discount &&
              !discountsMatch);

          if (shouldRecalculate) {
            console.log(
              `🧮 Calling recalculate API for order ${existingOrder.id}`,
            );
            try {
              const recalcResponse = await apiRequest(
                "POST",
                `http://42.118.102.26:4500/api/orders/${existingOrder.id}/recalculate`,
              );
              const recalcResult = await recalcResponse.json();
              console.log("✅ Order totals recalculated:", recalcResult);
            } catch (error) {
              console.error("❌ Error recalculating order:", error);
            }
          } else if (discountsMatch) {
            console.log(
              `⏭️ Skipping recalculation - order discount matches sum of item discounts (${discount.toLocaleString()} ₫)`,
            );
          }

          // Step 1.6: Update discount, tax and priceBeforeTax for ALL order items (existing + new) via API
          // IMPORTANT: Always update, even when discount = 0 (to reset discount)
          // BUT: Skip if order discount equals sum of item discounts (already distributed correctly)

          // Calculate sum of item discounts again for this check
          const totalItemDiscounts =
            (orderData?.existingItems?.reduce((sum, item) => {
              return sum + parseFloat(item.discount || "0");
            }, 0) || 0) +
            (orderData.items?.reduce((sum, item) => {
              return sum + parseFloat(item.discount || "0");
            }, 0) || 0);

          const shouldUpdateItemDiscounts =
            Math.abs(discount - totalItemDiscounts) >= 0.01;

          if (
            orderData?.existingItems &&
            orderData.existingItems.length > 0 &&
            shouldUpdateItemDiscounts
          ) {
            // Calculate TOTAL amount including BOTH existing items AND new items
            let totalBeforeDiscount =
              (orderData?.existingItems?.reduce((sum, item) => {
                return (
                  sum +
                  parseFloat(item.unitPrice || "0") *
                    parseInt(item.quantity || "0")
                );
              }, 0) || 0) +
              (orderData.items?.reduce((sum, item) => {
                return (
                  sum +
                  parseFloat(item.unitPrice || "0") *
                    parseInt(item.quantity || "0")
                );
              }, 0) || 0);

            console.log(
              `💰 Updating discount, tax and priceBeforeTax for ${orderData.existingItems.length} existing order items`,
            );

            // Calculate updates for each existing item
            let allocatedDiscount = 0;
            const existingItemsCount = orderData?.existingItems.length || 0;
            const newItemsCount = orderData.items.length || 0;

            for (let i = 0; i < orderData.existingItems.length; i++) {
              const item = orderData.existingItems[i];
              const unitPrice = parseFloat(item.unitPrice || "0");
              const quantity = parseInt(item.quantity || "0");
              const itemSubtotal = unitPrice * quantity;
              const product = products?.find(
                (p: Product) => p.id === item.productId,
              );

              // Calculate discount
              let itemDiscountAmount = 0;
              const isLastOverallItem =
                i === existingItemsCount - 1 && newItemsCount === 0;

              if (discount > 0) {
                if (isLastOverallItem) {
                  itemDiscountAmount = Math.max(
                    0,
                    discount - allocatedDiscount,
                  );
                } else {
                  itemDiscountAmount =
                    totalBeforeDiscount > 0
                      ? Math.floor(
                          (discount * itemSubtotal) / totalBeforeDiscount,
                        )
                      : 0;
                  allocatedDiscount += itemDiscountAmount;
                }
              }

              // Calculate tax and priceBeforeTax
              let itemTax = 0;
              let priceBeforeTax = 0;

              if (product?.taxRate && parseFloat(product.taxRate) > 0) {
                const taxRate = parseFloat(product.taxRate) / 100;

                if (priceIncludesTax) {
                  const discountPerUnit = itemDiscountAmount / quantity;
                  const adjustedPrice = Math.max(
                    0,
                    unitPrice - discountPerUnit,
                  );
                  const giaGomThue = adjustedPrice * quantity;
                  priceBeforeTax = Math.round(giaGomThue / (1 + taxRate));
                  itemTax = giaGomThue - priceBeforeTax;
                } else {
                  priceBeforeTax = unitPrice * quantity;
                  itemTax = Math.round(priceBeforeTax * taxRate);
                }
              } else {
                priceBeforeTax = unitPrice * quantity;
                itemTax = 0;
              }

              // Update order item with all values
              try {
                const updatePayload = {
                  discount: parseFloat(itemDiscountAmount.toFixed(2)),
                  tax: parseFloat(Math.round(itemTax).toFixed(2)),
                  priceBeforeTax: parseFloat(
                    Math.round(priceBeforeTax).toFixed(2),
                  ),
                  quantity: quantity.toString(),
                  unitPrice: unitPrice.toString(), // Also update unitPrice if changed
                };

                console.log(
                  `🔧 Updating order item ${item.id} with payload:`,
                  updatePayload,
                );

                const updateResponse = await apiRequest(
                  "PUT",
                  `http://42.118.102.26:4500/api/order-items/${item.id}`,
                  updatePayload,
                );

                if (updateResponse.ok) {
                  const updatedItem = await updateResponse.json();
                  console.log(`✅ Updated order item ${item.id}:`, {
                    discount: updatedItem.discount,
                    tax: updatedItem.tax,
                    priceBeforeTax: updatedItem.priceBeforeTax,
                    unitPrice: updatedItem.unitPrice,
                  });
                } else {
                  const errorText = await updateResponse.text();
                  console.error(
                    `❌ Failed to update order item ${item.id}:`,
                    errorText,
                  );
                }
              } catch (itemError) {
                console.error(
                  `❌ Error updating order item ${item.id}:`,
                  itemError,
                );
              }
            }

            console.log(`✅ All order items updated successfully`);
          }

          // Step 2: Use EXACT displayed values from screen footer (NO recalculation)
          console.log(
            `📝 Using EXACT displayed values for order ${existingOrder.id} - NO recalculation`,
          );

          // Get the EXACT displayed values from the footer calculations
          const footerSubtotal = calculateSubtotal();
          const footerTax = calculateTax();
          const footerTotal = calculateTotal();

          // Use floor to match exactly what user sees in footer
          const displayedSubtotal = Math.floor(footerSubtotal);
          const displayedTax = Math.floor(footerTax);
          const displayedDiscount = Math.floor(discount);
          const displayedTotal = Math.floor(footerTotal);

          console.log("💰 Edit mode - Using EXACT footer displayed values:", {
            footerSubtotal,
            footerTax,
            footerTotal,
            displayedSubtotal,
            displayedTax,
            displayedDiscount,
            displayedTotal,
            source: "footer_display_exact_match",
          });

          const updateResponse = await apiRequest(
            "PUT",
            `http://42.118.102.26:4500/api/orders/${existingOrder.id}`,
            {
              customerName: orderData.order.customerName,
              customerCount: orderData.order.customerCount,
              subtotal: displayedSubtotal.toString(),
              tax: displayedTax.toString(),
              discount: displayedDiscount.toString(),
              total: displayedTotal.toString(),
            },
          );

          const updateResult = await updateResponse.json();
          console.log(
            "✅ Order updated successfully with current totals:",
            updateResult,
          );

          // Return the final result (prioritize the order update result)
          return updateResult;
        } else {
          console.log("📝 Creating new order...");

          const response = await apiRequest("POST", "http://42.118.102.26:4500/api/orders", orderData);

          if (!response.ok) {
            const errorData = await response.text();
            throw new Error(`Failed to create order: ${errorData}`);
          }

          const result = await response.json();
          console.log("✅ Order created successfully:", result);
          return result;
        }
      } catch (error) {
        console.error("=== ORDER MUTATION ERROR ===");
        console.error("Error details:", error);
        throw error;
      }
    },
    onSuccess: async (response) => {
      console.log("=== ORDER MUTATION SUCCESS (SINGLE CALL) ===");
      console.log(
        mode === "edit"
          ? "Order updated successfully (no duplicates):"
          : "Order created successfully:",
        response,
      );

      // IMMEDIATE: Clear cache and force fresh data fetch
      console.log("🔄 Clearing cache and forcing fresh data fetch...");
      queryClient.clear();
      queryClient.removeQueries();

      // Force immediate refetch of order items if in edit mode
      if (mode === "edit" && existingOrder?.id) {
        console.log(
          "🔄 Force refetching order items for order:",
          existingOrder.id,
        );
        try {
          // Clear existing cache for this specific order items
          queryClient.removeQueries({
            queryKey: ["http://42.118.102.26:4500/api/order-items", existingOrder.id],
          });

          // Force fresh fetch of order items
          const freshOrderItems = await queryClient.fetchQuery({
            queryKey: ["http://42.118.102.26:4500/api/order-items", existingOrder.id],
            queryFn: async () => {
              const response = await apiRequest(
                "GET",
                `http://42.118.102.26:4500/api/order-items/${existingOrder.id}`,
              );
              const data = await response.json();
              console.log("🔄 Fresh order items fetched:", data);
              return data;
            },
            staleTime: 0, // Force fresh data
            gcTime: 0, // Don't cache
          });

          // Update existing items state immediately
          if (freshOrderItems && Array.isArray(freshOrderItems)) {
            setExistingItems(freshOrderItems);
            console.log("✅ Existing items state updated with fresh data");
          }

          console.log("✅ Order items refetched successfully");
        } catch (error) {
          console.error("❌ Error refetching order items:", error);
        }
      }

      // Invalidate and refetch all related queries
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["http://42.118.102.26:4500/api/orders"] }),
        queryClient.invalidateQueries({ queryKey: ["http://42.118.102.26:4500/api/tables"] }),
        queryClient.invalidateQueries({ queryKey: ["http://42.118.102.26:4500/api/order-items"] }),
        queryClient.refetchQueries({ queryKey: ["http://42.118.102.26:4500/api/orders"] }),
        queryClient.refetchQueries({ queryKey: ["http://42.118.102.26:4500/api/tables"] }),
      ]);

      // Reset form state
      setCart([]);
      setCustomerName("");
      setCustomerCount(1);
      setDiscount(0);
      setSelectedCategory(null);
      setSearchQuery(""); // Reset search query
      setExistingItems([]);

      // toast({
      //   title: t("orders.orderUpdateSuccess"),
      //   description: t("orders.orderUpdateSuccessDesc"),
      // });

      // Đóng dialog - parent component sẽ xử lý việc mở lại order details
      console.log(
        "✅ Edit mode: closing edit dialog, parent will handle reopening order list",
      );
      onOpenChange(false);

      console.log("✅ Order mutation completed - proper update flow executed");
    },
    onError: (error: any) => {
      console.error("=== ORDER MUTATION ERROR ===");
      console.error("Full error object:", error);
      console.error("Error message:", error.message);
      console.error("Error response:", error.response);
      console.error("Error response data:", error.response?.data);

      let errorMessage = t("orders.orderFailed");

      if (error.response?.data?.details) {
        errorMessage = error.response.data.details;
      } else if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.message) {
        errorMessage = error.message;
      }

      // toast({
      //   title: t("common.error"),
      //   description:
      //     mode === "edit"
      //       ? `Lỗi cập nhật đơn hàng: ${errorMessage}`
      //       : `Lỗi tạo đơn hàng: ${errorMessage}`,
      //   variant: "destructive",
      // });
    },
  });

  const filteredProducts = products
    ? (products as Product[]).filter((product: Product) => {
        // Filter by category
        const categoryMatch =
          !selectedCategory || product.categoryId === selectedCategory;

        // Filter by table floor - if table has floor, only show products from same floor
        const floorMatch =
          !table?.floor ||
          !product.floor ||
          product.floor === table.floor ||
          product.floor === "all";

        const productType =
          Number(product.productType) !== 2 ||
          Number(product.productType) !== 4;

        // Exclude products from expense categories
        const category = categories?.find(
          (cat: any) => cat.id === product.categoryId,
        );
        const isExpenseCategory =
          product.categoryId == 15 || product.categoryId == 17;

        // Filter by search query (name or SKU)
        const searchMatch =
          !searchQuery ||
          product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (product.sku &&
            product.sku.toLowerCase().includes(searchQuery.toLowerCase()));

        return (
          categoryMatch &&
          floorMatch &&
          productType &&
          !isExpenseCategory &&
          searchMatch
        );
      })
    : [];

  const addToCart = (product: Product) => {
    // Only check stock for products that track inventory
    if (product.trackInventory !== false) {
      // Check if product is out of stock
      if (product.stock <= 0) {
        toast({
          title: t("common.error"),
          description: `${product.name} đã hết hàng`,
          variant: "destructive",
        });
        return;
      }
    }

    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        // Only check stock limit for products that track inventory
        if (
          product.trackInventory !== false &&
          existing.quantity >= product.stock
        ) {
          toast({
            title: t("common.warning"),
            description: `Chỉ còn ${product.stock} ${product.name} trong kho`,
            variant: "destructive",
          });
          return prev;
        }
        return prev.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item,
        );
      }

      // Calculate total discount already allocated to existing items
      const sumOfItemDiscounts =
        existingItems.reduce((sum, item) => {
          return sum + parseFloat(item.discount || "0");
        }, 0) +
        prev.reduce((sum, item) => {
          return sum + parseFloat((item as any).itemDiscount || "0");
        }, 0);

      // Check if discount is already fully allocated
      const discountsMatch = Math.abs(discount - sumOfItemDiscounts) < 0.01;

      // Add new product with itemDiscount = 0 if discount already fully allocated
      return [
        ...prev,
        {
          product,
          quantity: 1,
          itemDiscount: discountsMatch ? 0 : undefined,
          itemDiscountType: "amount",
        },
      ];
    });
  };

  const removeFromCart = (productId: number) => {
    // First, check if this product exists in the NEW cart items
    const cartItem = cart.find((item) => item.product.id === productId);

    // If found in cart, handle cart item removal (new items)
    if (cartItem) {
      setCart((prev) => {
        const existing = prev.find((item) => item.product.id === productId);
        if (existing && existing.quantity > 1) {
          return prev.map((item) =>
            item.product.id === productId
              ? { ...item, quantity: item.quantity - 1 }
              : item,
          );
        }
        return prev.filter((item) => item.product.id !== productId);
      });
      return;
    }

    // Only if NOT found in cart, then check existing order items
    const existingItem = existingItems.find(
      (item) => item.productId === productId,
    );
    if (mode === "edit" && existingItem) {
      // Check if status is empty or null - if so, reduce directly without confirmation
      const itemStatus = existingItem.status || "";
      const shouldSkipConfirmation = itemStatus === "" || itemStatus === null;

      if (shouldSkipConfirmation) {
        // Reduce quantity directly without showing confirmation dialog
        const oldQuantity = parseInt(existingItem.quantity);
        const newQuantity = oldQuantity - 1;

        if (newQuantity <= 0) {
          // Remove item if quantity becomes 0
          const itemIndex = existingItems.findIndex(
            (item) => item.productId === productId,
          );

          // Calculate discount to subtract from order discount
          const itemDiscount = parseFloat(existingItem.discount || "0");

          setExistingItems((prev) => prev.filter((_, i) => i !== itemIndex));

          // Subtract item discount from order discount
          setDiscount((prevDiscount) =>
            Math.max(0, prevDiscount - itemDiscount),
          );

          // Delete from database
          apiRequest("DELETE", `http://42.118.102.26:4500/api/order-items/${existingItem.id}`)
            .then(async () => {
              console.log(
                `✅ Order item ${existingItem.id} deleted (status was empty/null)`,
              );

              // Invalidate queries to refresh data
              queryClient.invalidateQueries({
                queryKey: ["http://42.118.102.26:4500/api/order-items"],
              });
              queryClient.invalidateQueries({
                queryKey: ["http://42.118.102.26:4500/api/orders"],
              });
            })
            .catch((error) => {
              console.error("Error deleting order item:", error);
              // Restore the item if deletion failed
              setExistingItems((prev) => [
                ...prev.slice(0, itemIndex),
                existingItem,
                ...prev.slice(itemIndex),
              ]);
              // Restore discount
              setDiscount((prevDiscount) => prevDiscount + itemDiscount);
              toast({
                title: "Lỗi xóa món",
                description: "Không thể xóa món khỏi đơn hàng",
                variant: "destructive",
              });
            });
        } else {
          // Calculate new discount proportionally based on new quantity
          const oldItemDiscount = parseFloat(existingItem.discount || "0");
          const newItemDiscount = Math.round(
            (oldItemDiscount * newQuantity) / oldQuantity,
          );
          const discountReduction = oldItemDiscount - newItemDiscount;

          // Update quantity and discount in database
          apiRequest("PUT", `http://42.118.102.26:4500/api/order-items/${existingItem.id}`, {
            quantity: newQuantity.toString(),
            discount: newItemDiscount.toString(),
          })
            .then(() => {
              console.log(
                `✅ Order item ${existingItem.id} quantity reduced to ${newQuantity}, discount reduced to ${newItemDiscount} (status was empty/null)`,
              );

              // Update existing items state with new quantity and discount
              setExistingItems((prev) =>
                prev.map((item) =>
                  item.id === existingItem.id
                    ? {
                        ...item,
                        quantity: newQuantity.toString(),
                        discount: newItemDiscount.toString(),
                      }
                    : item,
                ),
              );

              // Reduce order discount by the amount removed from this item
              setDiscount((prevDiscount) =>
                Math.max(0, prevDiscount - discountReduction),
              );
            })
            .catch((error) => {
              console.error("Error updating order item:", error);
              toast({
                title: "Lỗi",
                description: "Không thể cập nhật số lượng",
                variant: "destructive",
              });
            });
        }
        return;
      }

      // Status is not empty/null - show confirmation dialog as before
      if (existingItem.quantity > 1) {
        setItemToReduce({ item: existingItem, productId });
        setShowReduceQtyDialog(true);
      } else {
        setItemToDelete({
          item: existingItem,
          index: existingItems.findIndex(
            (item) => item.productId === productId,
          ),
        });
        setShowDeleteItemDialog(true);
      }
      return;
    }
  };

  const updateItemNotes = (productId: number, notes: string) => {
    setCart((prev) =>
      prev.map((item) =>
        item.product.id === productId ? { ...item, notes } : item,
      ),
    );
  };

  const calculateSubtotal = () => {
    let totalSubtotal = 0;
    const priceIncludesTax = storeSettings?.priceIncludesTax || false;

    console.log("📊 calculateSubtotal - Starting:", {
      priceIncludesTax,
      mode,
      existingItemsCount:
        mode === "edit" && existingItems ? existingItems.length : 0,
      cartItemsCount: cart.length,
    });

    // Calculate total before discount for proportional distribution
    const totalBeforeDiscount =
      (mode === "edit" && existingItems
        ? existingItems.reduce((sum, item) => {
            return (
              sum +
              parseFloat(item.unitPrice || "0") *
                parseInt(item.quantity || "0")
            );
          }, 0)
        : 0) +
      cart.reduce((sum, item) => {
        return sum + parseFloat(item.product.price) * item.quantity;
      }, 0);

    let allocatedDiscount = 0;

    const sumOfItemDiscounts = existingItems?.reduce((sum, item) => {
      return sum + parseFloat(item.discount || "0");
    }, 0);
    // Add existing order items if in edit mode
    if (mode === "edit" && existingItems && Array.isArray(existingItems)) {
      existingItems.forEach((item, index) => {
        const quantity = parseInt(item.quantity);
        const originalPrice = parseFloat(item.unitPrice); // Use editable unitPrice
        const product = products?.find((p: Product) => p.id === item.productId);

        let itemSubtotal = 0;
        let itemDiscountAmount = parseFloat(item.discount || "0");

        // Calculate proportional discount for this item
        if (
          discount >= 0 &&
          totalBeforeDiscount > 0 &&
          discount != sumOfItemDiscounts
        ) {
          const isLastItem =
            index === existingItems.length - 1 && cart.length === 0;

          if (isLastItem) {
            // Last item gets remaining discount
            itemDiscountAmount = Math.max(0, discount - allocatedDiscount);
          } else {
            // Proportional discount
            const itemTotal = originalPrice * quantity;
            itemDiscountAmount =
              (discount * itemSubtotal) / totalBeforeDiscount;
            allocatedDiscount += itemDiscountAmount;
          }
        } else {
          allocatedDiscount += itemDiscountAmount;
        }

        if (priceIncludesTax) {
          // When price includes tax: subtotal = (price - discount/qty) / (1 + tax_rate/100) * qty
          const taxRate = product?.taxRate ? parseFloat(product.taxRate) : 0;
          const discountPerUnit = itemDiscountAmount / quantity;
          const adjustedPrice = Math.max(0, originalPrice - discountPerUnit);
          itemSubtotal =
            taxRate > 0
              ? (adjustedPrice / (1 + taxRate / 100)) * quantity
              : adjustedPrice * quantity;
        } else {
          // When price doesn't include tax: subtotal = (price - discount/qty) * qty
          const discountPerUnit = itemDiscountAmount / quantity;
          const adjustedPrice = Math.max(0, originalPrice - discountPerUnit);
          itemSubtotal = adjustedPrice * quantity;
        }

        totalSubtotal += Math.round(itemSubtotal);

        console.log(`📊 Existing Item ${index + 1}:`, {
          productName: item.productName,
          originalPrice,
          quantity,
          itemDiscountAmount,
          itemSubtotal,
          runningSubtotal: totalSubtotal,
        });
      });
    }

    // Add new cart items
    const sumDiscountItems = cart.reduce((sum: number, item: any) => {
      return (
        sum +
        (parseFloat(item.itemDiscount || "0") ||
          parseFloat(item.discount || "0"))
      );
    }, 0);

    cart.forEach((item, index) => {
      const quantity = item.quantity;
      const originalPrice = parseFloat(item.product.price); // Use editable price from cart item
      const product = products?.find((p: Product) => p.id === item.product.id);

      let itemSubtotal = 0;
      let itemDiscountAmount = parseFloat(item.itemDiscount || "0");

      // Calculate proportional discount for this item
      if (
        discount >= 0 &&
        totalBeforeDiscount > 0 &&
        discount != sumOfItemDiscounts + sumDiscountItems
      ) {
        const isLastItem = index === cart.length - 1;

        if (isLastItem) {
          // Last item gets remaining discount
          itemDiscountAmount = Math.max(0, discount - allocatedDiscount);
        } else {
          const itemTotal = originalPrice * quantity;
          itemDiscountAmount = (discount * itemTotal) / totalBeforeDiscount;
          allocatedDiscount += itemDiscountAmount;
        }
      } else {
        allocatedDiscount += itemDiscountAmount;
      }

      // Calculate item subtotal (price before tax)
      const taxRate = product?.taxRate ? parseFloat(product.taxRate) : 0;

      if (priceIncludesTax && taxRate > 0) {
        // When price includes tax:
        // Step 1: Calculate price after discount per unit
        const discountPerUnit = itemDiscountAmount / quantity;
        const priceAfterDiscount = Math.max(0, originalPrice - discountPerUnit);

        // Step 2: Extract the pre-tax price from the discounted price
        const priceBeforeTaxPerUnit = priceAfterDiscount / (1 + taxRate / 100);
        itemSubtotal = Math.round(priceBeforeTaxPerUnit * quantity);
      } else {
        // When price doesn't include tax: subtotal = (price - discount/qty) * qty
        const discountPerUnit = itemDiscountAmount / quantity;
        const adjustedPrice = Math.max(0, originalPrice - discountPerUnit);
        itemSubtotal = Math.round(adjustedPrice * quantity);
      }

      totalSubtotal += Math.round(itemSubtotal);

      console.log(`📊 Cart Item ${index + 1}:`, {
        productName: item.product.name,
        originalPrice,
        quantity,
        itemDiscountAmount,
        itemSubtotal,
        runningSubtotal: totalSubtotal,
      });
    });

    console.log(`🎯 FINAL SUBTOTAL RESULT:`, {
      totalSubtotal,
      priceIncludesTax,
      totalDiscount: discount,
      allocatedDiscount,
      itemsProcessed: {
        existingItems:
          mode === "edit" && existingItems ? existingItems.length : 0,
        cartItems: cart.length,
      },
    });

    return totalSubtotal;
  };

  // Get priceIncludesTax setting from store settings
  const priceIncludesTax = storeSettings?.priceIncludesTax || false;

  const calculateTax = () => {
    const existingItemsOld = existingItems.map((item) => {
      return {
        ...item,
        product: products.find((p: Product) => p.id === item.productId),
      };
    });

    let cartOrder = [...cart, ...existingItemsOld];

    // Calculate total before discount for proportional distribution
    const totalBeforeDiscount = cartOrder.reduce((total: number, cartItem) => {
      // Use unitPrice for existing items, product.price for cart items
      const price = cartItem.unitPrice 
        ? parseFloat(cartItem.unitPrice)
        : parseFloat(cartItem?.product?.price || "0");
      return total + price * parseFloat(cartItem.quantity || "1");
    }, 0);

    let allocatedDiscount = 0;

    const sumDiscountItems = cartOrder.reduce((sum: number, item: any) => {
      return (
        sum +
        (parseFloat(item.itemDiscount || "0") ||
          parseFloat(item.discount || "0"))
      );
    }, 0);

    return cartOrder.reduce((sum, item, index) => {
      if (item?.product?.taxRate && parseFloat(item?.product?.taxRate) > 0) {
        // Use unitPrice for existing items (editable), product.price for cart items
        const originalPrice = item.unitPrice 
          ? parseFloat(item.unitPrice)
          : parseFloat(item.product.price);
        const quantity = item.quantity;
        let taxRate = parseFloat(item.product.taxRate) / 100;
        const orderDiscount = discount;

        // Calculate discount for this item using same logic as calculateSubtotal
        let itemDiscountAmount =
          parseFloat(item.itemDiscount || "0") ||
          parseFloat(item.discount || "0");
        if (
          orderDiscount >= 0 &&
          totalBeforeDiscount > 0 &&
          (itemDiscountAmount == 0 || sumDiscountItems != orderDiscount)
        ) {
          const isLastItem = index === cartOrder.length - 1;

          if (isLastItem) {
            // Last item: total discount - sum of all previous discounts
            itemDiscountAmount = Math.max(
              0,
              Math.round(orderDiscount - allocatedDiscount),
            );
          } else {
            // Regular calculation for non-last items
            const itemTotal = originalPrice * quantity;
            itemDiscountAmount =
              (orderDiscount * itemTotal) / totalBeforeDiscount;
            allocatedDiscount += itemDiscountAmount;
          }
        } else {
          allocatedDiscount += itemDiscountAmount;
        }

        let itemTax = 0;

        if (priceIncludesTax) {
          // When price includes tax:
          const discountPerUnit = itemDiscountAmount / quantity;
          const priceAfterDiscount = Math.max(
            0,
            originalPrice - discountPerUnit,
          );
          const totalAfterDiscount = priceAfterDiscount * quantity;

          // Calculate pre-tax amount from discounted price
          const priceBeforeTax = Math.round(totalAfterDiscount / (1 + taxRate));

          // Tax = total after discount - pre-tax amount
          itemTax = totalAfterDiscount - priceBeforeTax;
        } else {
          // When price doesn't include tax:
          const discountPerUnit = itemDiscountAmount / quantity;
          const adjustedPrice = Math.max(0, originalPrice - discountPerUnit);
          const priceBeforeTax = adjustedPrice * quantity;
          // tax = subtotal * taxRate
          itemTax = Math.round(priceBeforeTax * taxRate);
        }

        return sum + Math.round(itemTax);
      }
      return sum;
    }, 0);
  };

  const calculateTotal = () => {
    const subtotal = calculateSubtotal();
    const tax = calculateTax();
    const total = subtotal + tax;

    console.log("💰 calculateTotal:", {
      subtotal,
      tax,
      total,
      discount,
      mode,
    });

    return Math.max(0, total);
  };

  const calculateGrandTotal = () => {
    // Use the same calculation as calculateTotal for consistency
    return calculateTotal();
  };

  const handlePlaceOrder = async () => {
    // For edit mode, allow update even with empty cart
    // In create mode, require items in cart
    if (!table || (mode !== "edit" && cart.length === 0)) return;

    if (mode === "edit" && existingOrder) {
      // Check for various types of changes
      const hasNewItems = cart.length > 0;
      const hasRemovedItems = existingItems.some((item) => item.quantity === 0);
      const hasCustomerNameChange =
        (customerName || "") !== (existingOrder.customerName || "");
      const hasCustomerCountChange =
        customerCount !== (existingOrder.customerCount || 1);

      const hasAnyChanges =
        hasNewItems ||
        hasRemovedItems ||
        hasCustomerNameChange ||
        hasCustomerCountChange;

      console.log("📝 Order Dialog: Update attempt - Changes detected:", {
        hasNewItems,
        hasRemovedItems,
        hasCustomerNameChange,
        hasCustomerCountChange,
        hasAnyChanges,
        cartLength: cart.length,
      });

      // Always allow update to proceed - user wants to refresh/update order data
      console.log("📝 Order Dialog: Processing order update:", {
        hasNewItems,
        hasRemovedItems,
        hasCustomerNameChange,
        hasCustomerCountChange,
        hasAnyChanges,
        allowUpdate: true,
        cartItemsCount: cart.length,
      });

      // For edit mode, handle ONLY new items from cart (don't duplicate existing items)
      // Calculate pre-allocated discounts for new items
      let totalBeforeDiscount =
        existingItems.reduce((sum, item) => {
          return Number(item.unitPrice || 0) * Number(item.quantity || 0);
        }, 0) +
        cart.reduce((sum, item) => {
          return sum + parseFloat(item.product.price) * item.quantity;
        }, 0);

      let allocatedDiscountForExisting = 0;

      // Calculate discount already allocated to existing items
      if (existingItems.length > 0) {
        for (let i = 0; i < existingItems.length; i++) {
          const item = existingItems[i];
          const itemSubtotal =
            Number(item.unitPrice || 0) * Number(item.quantity || 0);

          const isLastExistingItem = i === existingItems.length - 1;
          const hasNewItems = cart.length > 0;

          if (isLastExistingItem && !hasNewItems) {
            // If this is the last item overall, it gets remaining discount
            allocatedDiscountForExisting = discount;
          } else {
            // Proportional discount
            const itemDiscount =
              totalBeforeDiscount > 0
                ? Math.round((discount * itemSubtotal) / totalBeforeDiscount)
                : 0;
            allocatedDiscountForExisting += itemDiscount;
          }
        }
      }

      const newItemsOnly = cart.map((item, index) => {
        const product = products?.find(
          (p: Product) => p.id === item.product.id,
        );
        const basePrice = parseFloat(item.product.price.toString());
        const quantity = item.quantity;
        const priceIncludesTax = storeSettings?.priceIncludesTax || false;

        // Calculate discount for this new item
        let itemDiscountAmount = parseFloat(item.itemDiscount || "0");
        const isLastNewItem = index === cart.length - 1;
        const itemSubtotal = basePrice * quantity;

        if (discount > 0 && itemDiscountAmount == 0) {
          if (isLastNewItem) {
            // Last new item gets remaining discount
            itemDiscountAmount = Math.max(
              0,
              discount - allocatedDiscountForExisting,
            );
          } else {
            // Proportional discount
            itemDiscountAmount =
              totalBeforeDiscount > 0
                ? Math.floor((discount * itemSubtotal) / totalBeforeDiscount)
                : 0;
            allocatedDiscountForExisting += itemDiscountAmount;
          }
        }

        // Calculate tax using the SAME logic as calculateTax function
        let itemTax = 0;
        let priceBeforeTax = 0;

        if (product?.taxRate && parseFloat(product.taxRate) > 0) {
          const taxRate = parseFloat(product.taxRate) / 100;

          if (priceIncludesTax) {
            // When price includes tax:
            // Step 1: Calculate price after discount
            const discountPerUnit = itemDiscountAmount / quantity;
            const adjustedPrice = Math.max(0, basePrice - discountPerUnit);
            const giaGomThue = adjustedPrice * quantity;

            // Step 2: Calculate subtotal (price before tax)
            priceBeforeTax = Math.round(giaGomThue / (1 + taxRate));

            // Step 3: Calculate tax
            itemTax = giaGomThue - priceBeforeTax;
          } else {
            // When price doesn't include tax:
            const discountPerUnit = itemDiscountAmount / quantity;
            const adjustedPrice = Math.max(0, basePrice - discountPerUnit);

            // priceBeforeTax = (price - discount) * quantity
            priceBeforeTax = Math.round(adjustedPrice * quantity);

            // tax = priceBeforeTax * taxRate
            itemTax = Math.round(priceBeforeTax * taxRate);
          }
        } else {
          // No tax rate
          const discountPerUnit = itemDiscountAmount / quantity;
          const adjustedPrice = Math.max(0, basePrice - discountPerUnit);
          priceBeforeTax = Math.round(adjustedPrice * quantity);
          itemTax = 0;
        }

        const itemTotalAmount = priceBeforeTax + itemTax;

        console.log(
          `📝 Order Dialog: Processing NEW cart item ${item.product.name}:`,
          {
            productId: item.product.id,
            quantity: item.quantity,
            basePrice,
            itemTax,
            itemTotalAmount,
            itemDiscountAmount,
            priceBeforeTax,
            priceIncludesTax,
          },
        );

        return {
          productId: item.product.id,
          quantity: item.quantity,
          unitPrice: basePrice.toString(), // Store the potentially edited base price
          total: itemTotalAmount.toString(),
          discount: Math.round(itemDiscountAmount).toString(),
          tax: Math.round(itemTax).toString(),
          priceBeforeTax: Math.round(priceBeforeTax).toString(),
          notes: item.notes || null,
        };
      });

      // Track any modifications to existing items (quantity changes, removals, etc.)
      const hasExistingItemChanges =
        existingItems.length !== (existingOrderItems?.length || 0);

      console.log(`📝 Order Dialog: Checking for existing item changes:`, {
        currentExistingItemsCount: existingItems.length,
        originalExistingItemsCount: existingOrderItems?.length || 0,
        hasExistingItemChanges,
        hasDiscountChange:
          parseFloat(existingOrder.discount || "0") !== discount,
      });

      // Include updated order information
      const updatedOrder = {
        ...existingOrder,
        customerName: customerName || null,
        customerCount: parseInt(customerCount.toString()) || 1,
        discount: discount.toString(),
      };

      console.log("📝 Processing order update:", {
        orderId: existingOrder.id,
        hasNewItems: newItemsOnly.length > 0,
        hasExistingItemChanges,
        hasCustomerChanges: hasCustomerNameChange || hasCustomerCountChange,
        hasDiscountChange:
          parseFloat(existingOrder.discount || "0") !== discount,
        customerUpdates: {
          name: customerName,
          count: customerCount,
        },
        newItemsCount: newItemsOnly.length,
        proceedWithUpdate: true,
      });

      let allocatedDiscount = 0;
      const updatedExistingItems = existingItems.map((item, index) => {
        let product = products?.find((p: Product) => p.id === item.productId);
        let itemDiscountAmount = parseFloat(item.discount || "0");

        if (discount > 0 && itemDiscountAmount == 0) {
          const itemSubtotal =
            Number(item.unitPrice || 0) * Number(item.quantity || 0);

          if (index === existingItems.length - 1) {
            // Last item gets remaining discount to ensure total matches exactly
            itemDiscountAmount = Math.max(0, discount - allocatedDiscount);
          } else {
            // Calculate proportional discount
            itemDiscountAmount =
              totalBeforeDiscount > 0
                ? Math.round((discount * itemSubtotal) / totalBeforeDiscount)
                : 0;
            allocatedDiscount += itemDiscountAmount;
          }
        }

        let itemTax = 0;
        let priceBeforeTax = 0;
        const unitPrice = parseFloat(item.unitPrice || "0"); // Use editable unitPrice
        const quantity = item.quantity;

        if (product?.taxRate && parseFloat(product.taxRate) > 0) {
          const taxRate = parseFloat(product.taxRate) / 100;

          if (priceIncludesTax) {
            // When price includes tax: tax calculation similar to calculateTax
            const discountPerUnit = itemDiscountAmount / quantity;
            const adjustedPrice = Math.max(0, unitPrice - discountPerUnit);
            const giaGomThue = adjustedPrice * quantity;
            priceBeforeTax = Math.round(giaGomThue / (1 + taxRate));
            itemTax = giaGomThue - priceBeforeTax;
          } else {
            // When price doesn't include tax: tax = subtotal * taxRate
            priceBeforeTax = unitPrice * quantity - itemDiscountAmount;
            itemTax = taxRate > 0 ? Math.round(priceBeforeTax * taxRate) : 0;
          }
        } else {
          // No tax rate
          priceBeforeTax = unitPrice * quantity - itemDiscountAmount;
          itemTax = 0;
        }

        return {
          ...item,
          discount: itemDiscountAmount.toString(),
          tax: Math.round(itemTax).toString(),
          priceBeforeTax: Math.round(priceBeforeTax).toString(),
          unitPrice: unitPrice.toString(), // Ensure unitPrice is updated
        };
      });

      // Save changes to order_change_history AND update order items in database
      if (existingOrder?.id) {
        // Track changes in existing items (quantity or discount changes)
        for (let i = 0; i < existingItems.length; i++) {
          const currentItem = existingItems[i];
          const originalItem = existingOrderItems?.find(
            (item: any) => item.id === currentItem.id,
          );

          if (originalItem) {
            const quantityChanged =
              parseInt(currentItem.quantity) !==
              parseInt(originalItem.quantity);
            const discountChanged =
              parseFloat(currentItem.discount || "0") !==
              parseFloat(originalItem.discount || "0");
            const unitPriceChanged =
              parseFloat(currentItem.unitPrice) !==
              parseFloat(originalItem.unitPrice);

            // Update order item in database if quantity, discount, or unitPrice changed
            if (quantityChanged || discountChanged || unitPriceChanged) {
              try {
                const updatePayload: any = {};

                if (quantityChanged) {
                  updatePayload.quantity = currentItem.quantity;
                }

                if (discountChanged) {
                  updatePayload.discount = currentItem.discount;
                }

                if (unitPriceChanged) {
                  updatePayload.unitPrice = currentItem.unitPrice;
                }

                // Recalculate tax and priceBeforeTax based on updated values
                const quantity = parseInt(currentItem.quantity);
                const unitPrice = parseFloat(currentItem.unitPrice);
                const itemDiscount = parseFloat(currentItem.discount || "0");

                // Get product for tax calculation
                const product = products?.find(
                  (p: Product) => p.id === currentItem.productId,
                );
                const taxRate = product?.taxRate
                  ? parseFloat(product.taxRate) / 100
                  : 0;

                let priceBeforeTax = 0;
                let itemTax = 0;

                if (priceIncludesTax && taxRate > 0) {
                  const discountPerUnit = itemDiscount / quantity;
                  const adjustedPrice = Math.max(0, unitPrice - discountPerUnit);
                  const giaGomThue = adjustedPrice * quantity;
                  priceBeforeTax = Math.round(giaGomThue / (1 + taxRate));
                  itemTax = giaGomThue - priceBeforeTax;
                } else {
                  priceBeforeTax = unitPrice * quantity - itemDiscount;
                  itemTax =
                    taxRate > 0 ? Math.round(priceBeforeTax * taxRate) : 0;
                }

                const total = priceBeforeTax + itemTax;

                updatePayload.total = total.toString();
                updatePayload.tax = Math.round(itemTax).toString();
                updatePayload.priceBeforeTax =
                  Math.round(priceBeforeTax).toString();

                console.log(
                  `📝 Updating order item ${currentItem.id}:`,
                  updatePayload,
                );

                await apiRequest(
                  "PUT",
                  `http://42.118.102.26:4500/api/order-items/${currentItem.id}`,
                  updatePayload,
                );

                console.log(
                  `✅ Order item ${currentItem.id} updated in database`,
                );
              } catch (error) {
                console.error(
                  `❌ Error updating order item ${currentItem.id}:`,
                  error,
                );
              }
            }

            // Log quantity change to history
            if (quantityChanged) {
              try {
                await apiRequest("POST", "http://42.118.102.26:4500/api/order-change-history", {
                  orderId: existingOrder.id,
                  orderNumber: existingOrder.orderNumber,
                  ipAddress: window.location.hostname || "unknown",
                  userName: "Nhân viên",
                  action: "update_quantity",
                  detailedDescription: JSON.stringify({
                    productName: currentItem.productName,
                    oldQuantity: parseInt(originalItem.quantity),
                    newQuantity: parseInt(currentItem.quantity),
                    unitPrice: currentItem.unitPrice,
                    note: "Cập nhật số lượng sản phẩm",
                  }),
                  storeCode: existingOrder.storeCode || null,
                });
                console.log(
                  `✅ Quantity change saved to order_change_history for ${currentItem.productName}`,
                );
              } catch (error) {
                console.error(
                  `❌ Error saving quantity change to order_change_history:`,
                  error,
                );
              }
            }

            // Log discount change to history
            if (discountChanged) {
              try {
                await apiRequest("POST", "http://42.118.102.26:4500/api/order-change-history", {
                  orderId: existingOrder.id,
                  orderNumber: existingOrder.orderNumber,
                  ipAddress: window.location.hostname || "unknown",
                  userName: "Nhân viên",
                  action: "update_discount",
                  detailedDescription: JSON.stringify({
                    productName: currentItem.productName,
                    oldDiscount: parseFloat(originalItem.discount || "0"),
                    newDiscount: parseFloat(currentItem.discount || "0"),
                    quantity: parseInt(currentItem.quantity),
                    unitPrice: currentItem.unitPrice,
                    note: "Cập nhật giảm giá sản phẩm",
                  }),
                  storeCode: existingOrder.storeCode || null,
                });
                console.log(
                  `✅ Discount change saved to order_change_history for ${currentItem.productName}`,
                );
              } catch (error) {
                console.error(
                  `❌ Error saving discount change to order_change_history:`,
                  error,
                );
              }
            }

            // Log unit price change to history
            if (unitPriceChanged) {
              try {
                await apiRequest("POST", "http://42.118.102.26:4500/api/order-change-history", {
                  orderId: existingOrder.id,
                  orderNumber: existingOrder.orderNumber,
                  ipAddress: window.location.hostname || "unknown",
                  userName: "Nhân viên",
                  action: "update_unit_price",
                  detailedDescription: JSON.stringify({
                    productName: currentItem.productName,
                    oldUnitPrice: parseFloat(originalItem.unitPrice),
                    newUnitPrice: parseFloat(currentItem.unitPrice),
                    quantity: parseInt(currentItem.quantity),
                    note: "Cập nhật đơn giá sản phẩm",
                  }),
                  storeCode: existingOrder.storeCode || null,
                });
                console.log(
                  `✅ Unit price change saved to order_change_history for ${currentItem.productName}`,
                );
              } catch (error) {
                console.error(
                  `❌ Error saving unit price change to order_change_history:`,
                  error,
                );
              }
            }
          }
        }
      }

      // Always proceed with mutation - adding new items and updating order totals/info
      console.log(
        `📝 Order Dialog: Sending mutation with ${newItemsOnly.length} NEW items and updated order info`,
      );
      createOrderMutation.mutate({
        order: updatedOrder,
        items: newItemsOnly,
        existingItems: updatedExistingItems, // Include updated existing items with new discount values
      });
    } else {
      // Create mode - use exact displayed values
      const subtotalAmount = Math.floor(calculateSubtotal());
      const taxAmount = Math.floor(calculateTax());
      const totalAmount = Math.floor(calculateTotal());

      const order = {
        orderNumber: `ORD-${Date.now()}`,
        tableId: table.id,
        employeeId: null, // Set to null since no employees exist
        customerName: customerName || null,
        customerCount: parseInt(customerCount) || 1,
        subtotal: subtotalAmount.toString(),
        tax: taxAmount.toString(),
        discount: discount.toString(),
        total: totalAmount.toString(),
        status: "served",
        paymentStatus: "pending",
        orderedAt: new Date().toISOString(),
      };

      // Calculate discount distribution for new cart items using SAME logic as display
      let cartItemsWithDiscount = cart.map((item) => {
        const product = products?.find(
          (p: Product) => p.id === item.product.id,
        );
        const basePrice = item.product.price;
        const quantity = item.quantity;
        const priceIncludesTax = storeSettings?.priceIncludesTax || false;

        // Calculate subtotal using SAME logic as calculateSubtotal function
        let itemSubtotal = 0;
        if (priceIncludesTax) {
          // When priceIncludesTax = true: use base price as subtotal (will adjust for tax later)
          itemSubtotal = basePrice * quantity;
        } else {
          // When priceIncludesTax = false: use base price as subtotal
          itemSubtotal = basePrice * quantity;
        }

        // Calculate tax using SAME logic as calculateTax function
        let itemTax = 0;
        let priceBeforeTax = 0;
        if (product?.taxRate && parseFloat(product.taxRate) > 0) {
          const taxRate = parseFloat(product.taxRate) / 100;

          if (priceIncludesTax) {
            // When price includes tax: tax calculation similar to calculateTax
            const giaGomThue = basePrice * quantity;
            priceBeforeTax = Math.round(giaGomThue / (1 + taxRate));
            itemTax = giaGomThue - priceBeforeTax;
          } else {
            // When price doesn't include tax: tax = subtotal * taxRate
            priceBeforeTax = itemSubtotal;
            itemTax = Math.round(itemSubtotal * taxRate);
          }
        }

        const itemTotal = itemSubtotal + itemTax;

        return {
          productId: item.product.id, // Ensure productId is set
          productName: item.product.name, // Add productName field
          product: item.product, // Preserve full product object
          quantity: item.quantity.toString(),
          unitPrice: basePrice.toString(),
          total: itemTotal.toString(),
          discount: item.itemDiscount.toString(), // Will be calculated below
          tax: Math.round(itemTax).toString(),
          priceBeforeTax: Math.round(priceBeforeTax).toString(),
          notes: item.notes || null,
          basePrice: basePrice,
          itemSubtotal: itemSubtotal,
        };
      });

      // Distribute discount among cart items if there's a discount
      if (discount > 0 && cartItemsWithDiscount.length > 0) {
        const cartSubtotal = cartItemsWithDiscount.reduce(
          (sum, item) => sum + item.itemSubtotal,
          0,
        );
        let allocatedDiscount = 0;

        cartItemsWithDiscount = cartItemsWithDiscount.map((item, index) => {
          let product = products?.find((p: Product) => p.id === item.productId);

          let itemDiscount = parseFloat(item.discount || "0");

          if (itemDiscount == 0) {
            if (index === cartItemsWithDiscount.length - 1) {
              // Last item gets remaining discount
              itemDiscount = Math.max(0, discount - allocatedDiscount);
            } else {
              // Calculate proportional discount
              itemDiscount =
                cartSubtotal > 0
                  ? Math.round((discount * item.itemSubtotal) / cartSubtotal)
                  : 0;
              allocatedDiscount += itemDiscount;
            }
          }

          // Calculate tax using SAME logic as calculateTax function
          let itemTax = 0;
          let priceBeforeTax = 0;
          if (product?.taxRate && parseFloat(product.taxRate) > 0) {
            const taxRate = parseFloat(product.taxRate) / 100;

            if (priceIncludesTax) {
              // When price includes tax: tax calculation similar to calculateTax
              const giaGomThue = item.basePrice * item.quantity - itemDiscount;
              priceBeforeTax = Math.round(giaGomThue / (1 + taxRate));
              itemTax = giaGomThue - priceBeforeTax;
            } else {
              // When price doesn't include tax: tax = subtotal * taxRate
              priceBeforeTax = item.itemSubtotal - itemDiscount;
              itemTax = Math.round(item.itemSubtotal * taxRate);
            }
          }

          return {
            ...item,
            tax: Math.round(itemTax).toString(),
            priceBeforeTax: Math.round(priceBeforeTax).toString(),
            discount: itemDiscount.toFixed(2),
          };
        });
      }

      // Clean up the items array for API
      const items = cartItemsWithDiscount.map((item) => ({
        productId: item.productId || item.product?.id, // Get from productId or product object
        productName: item.productName || item.product?.name, // Ensure productName is included
        quantity: item.quantity.toString(),
        unitPrice: item.unitPrice, // Use the potentially edited unit price
        total: item.total,
        discount: item.discount,
        tax: item.tax,
        priceBeforeTax: item.priceBeforeTax,
        notes: item.notes,
      }));

      // Ensure order discount reflects the sum of item discounts if order discount is zero
      if (parseFloat(order.discount || "0") === 0) {
        order.discount = items
          .reduce((sum, item) => sum + parseFloat(item.discount || "0"), 0)
          .toString();
      }

      console.log("Placing order:", { order, items });
      createOrderMutation.mutate({ order, items });
    }
  };

  const handleClose = () => {
    setCart([]);
    setCustomerName("");
    setCustomerCount(1);
    setDiscount(0);
    setSelectedCategory(null);
    setSearchQuery(""); // Clear search query on close
    // Only clear existing items if we're not in edit mode
    if (mode !== "edit") {
      setExistingItems([]);
    }
    // Reset receipt preview state
    setShowReceiptPreview(false);
    setPreviewReceipt(null);
    onOpenChange(false);
  };

  useEffect(() => {
    if (table && open) {
      if (mode === "edit" && existingOrder) {
        setCustomerName(existingOrder.customerName || "");
        setCustomerCount(existingOrder.customerCount || 1);
        setDiscount(parseFloat(existingOrder.discount || "0"));
        setDiscountType("amount");
        setDiscountPercent(0);
      } else {
        setCustomerCount(Math.min(table.capacity, 1));
        setDiscount(0);
        setDiscountType("amount");
        setDiscountPercent(0);
      }
    }
  }, [table, open, mode, existingOrder]);

  useEffect(() => {
    if (
      mode === "edit" &&
      existingOrderItems &&
      Array.isArray(existingOrderItems)
    ) {
      console.log("Setting existing items:", existingOrderItems);
      // Map existing items to include temporary properties for discount type and percentage
      const mappedExistingItems = existingOrderItems.map((item: any) => {
        // Default to amount type if discount is present
        const itemDiscountType =
          item.discount && parseFloat(item.discount) > 0 ? "amount" : undefined;
        return {
          ...item,
          itemDiscountType: itemDiscountType,
          itemDiscountPercent: 0, // Initialize percent to 0
          unitPrice: item.unitPrice || item.product?.price || "0", // Ensure unitPrice is set
        };
      });
      setExistingItems(mappedExistingItems);
    } else if (mode === "edit" && open && existingOrder?.id) {
      // Clear existing items when dialog opens in edit mode but no data yet
      setExistingItems([]);
    }
  }, [mode, existingOrderItems, open, existingOrder?.id]);

  if (!table) return null;

  const handleConfirmReduceQty = async () => {
    if (!itemToReduce) return;

    const { item, index } = itemToReduce; // Use index for state update
    const newQuantity = parseInt(item.quantity) - 1;

    if (newQuantity <= 0) {
      // If quantity becomes 0, delete the item instead
      setItemToDelete({
        item,
        index: existingItems.findIndex((i) => i.id === item.id),
      });
      setShowDeleteItemDialog(true);
      setShowReduceQtyDialog(false);
      return;
    }

    // Prepare the note to save (new note or keep existing)
    const noteToSave =
      reduceNote.trim() ||
      item.notes ||
      "Giảm số lượng sản phẩm xuống " + newQuantity;

    // Update order_items in database with notes
    try {
      await apiRequest("PUT", `http://42.118.102.26:4500/api/order-items/${item.id}`, {
        quantity: newQuantity.toString(),
        notes: noteToSave,
      });
      console.log(
        `✅ Order item ${item.id} updated with new quantity and notes:`,
        noteToSave,
      );
    } catch (error) {
      console.error(`❌ Error updating order item:`, error);
      toast({
        title: "Lỗi",
        description: "Không thể cập nhật số lượng",
        variant: "destructive",
      });
      setShowReduceQtyDialog(false);
      setItemToReduce(null);
      setReduceNote("");
      return;
    }

    // Update existing items state
    setExistingItems((prev) =>
      prev.map((existingItem) =>
        existingItem.id === item.id
          ? {
              ...existingItem,
              quantity: newQuantity.toString(),
              notes: noteToSave,
            }
          : existingItem,
      ),
    );

    // Save to order_change_history
    if (existingOrder?.id) {
      try {
        await apiRequest("POST", "http://42.118.102.26:4500/api/order-change-history", {
          orderId: existingOrder.id,
          orderNumber: existingOrder.orderNumber,
          ipAddress: window.location.hostname || "unknown",
          userName: "Nhân viên",
          action: "reduce_quantity",
          detailedDescription: JSON.stringify({
            productName: item.productName,
            oldQuantity: parseInt(item.quantity),
            newQuantity: newQuantity,
            unitPrice: item.unitPrice,
            note: noteToSave || "Giảm số lượng sản phẩm",
          }),
          storeCode: existingOrder.storeCode || null,
        });
        console.log(
          `✅ Quantity reduction saved to order_change_history for ${item.productName} with note:`,
          noteToSave || "Giảm số lượng sản phẩm",
        );
      } catch (error) {
        console.error(
          `❌ Error saving quantity reduction to order_change_history:`,
          error,
        );
      }
    }

    setShowReduceQtyDialog(false);
    setItemToReduce(null);
    setReduceNote("");
  };

  const handleConfirmIncreaseQty = async () => {
    if (!itemToIncrease) return;

    const { item, index } = itemToIncrease; // Use index for state update
    const newQuantity = parseInt(item.quantity) + 1;

    // Prepare the note to save (new note or keep existing)
    const noteToSave =
      increaseNote.trim() ||
      item.notes ||
      "Tăng số lượng sản phẩm lên " + newQuantity;

    // Update order_items in database with notes
    try {
      await apiRequest("PUT", `http://42.118.102.26:4500/api/order-items/${item.id}`, {
        quantity: newQuantity.toString(),
        notes: noteToSave,
      });
      console.log(
        `✅ Order item ${item.id} updated with new quantity and notes:`,
        noteToSave,
      );
    } catch (error) {
      console.error(`❌ Error updating order item:`, error);
      toast({
        title: "Lỗi",
        description: "Không thể cập nhật số lượng",
        variant: "destructive",
      });
      setShowIncreaseQtyDialog(false);
      setItemToIncrease(null);
      setIncreaseNote("");
      return;
    }

    // Update existing items state
    setExistingItems((prev) =>
      prev.map((existingItem) =>
        existingItem.id === item.id
          ? {
              ...existingItem,
              quantity: newQuantity.toString(),
              notes: noteToSave,
            }
          : existingItem,
      ),
    );

    // Save to order_change_history
    if (existingOrder?.id) {
      try {
        await apiRequest("POST", "http://42.118.102.26:4500/api/order-change-history", {
          orderId: existingOrder.id,
          orderNumber: existingOrder.orderNumber,
          ipAddress: window.location.hostname || "unknown",
          userName: "Nhân viên",
          action: "increase_quantity",
          detailedDescription: JSON.stringify({
            productName: item.productName,
            oldQuantity: parseInt(item.quantity),
            newQuantity: newQuantity,
            unitPrice: item.unitPrice,
            note: noteToSave || "Tăng số lượng sản phẩm",
          }),
          storeCode: existingOrder.storeCode || null,
        });
        console.log(
          `✅ Quantity increase saved to order_change_history for ${item.productName} with note:`,
          noteToSave || "Tăng số lượng sản phẩm",
        );
      } catch (error) {
        console.error(
          `❌ Error saving quantity increase to order_change_history:`,
          error,
        );
      }
    }

    toast({
      title: "Đã cập nhật",
      description: `Tăng số lượng "${item.productName}" từ ${item.quantity} lên ${newQuantity}`,
    });

    setShowIncreaseQtyDialog(false);
    setItemToIncrease(null);
    setIncreaseNote("");
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-[98vw] w-[1600px] max-h-[98vh] p-0 overflow-auto flex flex-col bg-gradient-to-br from-gray-50 to-white">
        <DialogHeader className="flex-shrink-0 px-4 pt-3 pb-2 bg-white border-b border-gray-200 sticky top-0 z-10">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <DialogTitle className="flex items-center gap-2 text-2xl font-bold text-gray-800">
                <div className="p-1.5 bg-green-100 rounded-lg">
                  <ShoppingCart className="w-5 h-5 text-green-600" />
                </div>
                {mode === "edit"
                  ? `${t("orders.editOrderTitle")} ${table.tableNumber}`
                  : `Bàn ${table.tableNumber}`}
              </DialogTitle>
              <DialogDescription className="text-sm text-gray-600 mt-1">
                {mode === "edit"
                  ? t("orders.editOrderDesc").replace(
                      "{orderNumber}",
                      existingOrder?.orderNumber || "",
                    )
                  : `${t("tables.tableCapacity")}: ${table.capacity} ${t("orders.people")} | ${t("tables.selectMenuToOrder")}`}
              </DialogDescription>
            </div>
          </div>

          {/* Summary Section */}
          {(cart.length > 0 ||
            (mode === "edit" && existingItems.length > 0) ||
            mode === "edit") && (
            <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-lg p-2 mt-2 border border-green-200">
              <div className="flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="text-gray-600 font-medium">
                    {t("orders.subtotal")}
                  </span>
                  <span className="font-semibold">
                    {Math.floor(calculateSubtotal()).toLocaleString()} ₫
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-gray-600 font-medium">
                    {t("reports.tax")}
                  </span>
                  <span className="font-semibold">
                    {Math.floor(calculateTax()).toLocaleString()} ₫
                  </span>
                </div>
                <div className="flex items-center gap-1.5 pl-3 border-l border-gray-300">
                  <span className="text-gray-800 font-bold text-sm">
                    {t("orders.totalAmount")}
                  </span>
                  <span className="font-bold text-base text-green-600">
                    {Math.floor(calculateTotal()).toLocaleString()} ₫
                  </span>
                </div>
              </div>
            </div>
          )}
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-[68%_32%] gap-2 flex-1 px-2 py-1.5 pb-[200px]">
          {/* Left Panel - Product Selection */}
          <div className="flex flex-col space-y-1.5 bg-white rounded-lg border border-gray-200 p-2">
            <div className="flex-shrink-0">
              <h3 className="text-xs font-bold text-gray-800 mb-1.5 flex items-center gap-1.5">
                <ShoppingCart className="w-3.5 h-3.5 text-green-600" />
                {t("tables.selectMenuToOrder")}
              </h3>

              {/* Customer Info */}
              <div className="grid grid-cols-2 gap-2 mb-2 p-2 bg-gray-50 rounded">
                <div className="flex items-center gap-2">
                  <Label
                    htmlFor="customerCount"
                    className="text-base font-medium text-gray-600 whitespace-nowrap"
                  >
                    {t("tables.customerCount")}
                  </Label>
                  <Input
                    id="customerCount"
                    type="number"
                    min={1}
                    max={table.capacity}
                    value={customerCount}
                    onChange={(e) =>
                      setCustomerCount(parseInt(e.target.value) || 1)
                    }
                    className="h-11 text-lg border-gray-300 focus:border-green-500 focus:ring-1 focus:ring-green-500 px-3"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Label
                    htmlFor="discount"
                    className="text-base font-medium text-gray-600 whitespace-nowrap"
                  >
                    {t("reports.discount")}
                  </Label>
                  <div className="flex items-center gap-1 flex-1">
                    <Input
                      id="discount"
                      type="text"
                      inputMode="numeric"
                      value={(() => {
                        if (discountType === "percent") {
                          return discountPercent > 0
                            ? discountPercent.toString()
                            : "";
                        }
                        return discount > 0
                          ? Math.floor(discount).toLocaleString("vi-VN")
                          : "";
                      })()}
                      onChange={(e) => {
                        const value = e.target.value.replace(/[^\d]/g, "");
                        const inputValue = value
                          ? Math.max(0, parseInt(value))
                          : 0;

                        let newDiscount = 0;
                        let newPercent = 0;

                        // Calculate total before discount for percentage calculation
                        const totalBeforeDiscount =
                          (mode === "edit" && existingItems
                            ? existingItems.reduce((sum, item) => {
                                return (
                                  sum +
                                  parseFloat(item.unitPrice || "0") *
                                    parseInt(item.quantity || "0")
                                );
                              }, 0)
                            : 0) +
                          cart.reduce((sum, item) => {
                            return (
                              sum +
                              parseFloat(item.product.price) * item.quantity
                            );
                          }, 0);

                        if (discountType === "percent") {
                          // Validate percentage (0-100)
                          newPercent = Math.min(100, inputValue);
                          newDiscount = Math.floor(
                            (totalBeforeDiscount * newPercent) / 100,
                          );
                        } else {
                          // Validate amount
                          newDiscount = inputValue;
                          if (newDiscount > totalBeforeDiscount) {
                            newDiscount = 0;
                            toast({
                              title: "Giảm giá không hợp lệ",
                              description: `Giảm giá không được vượt quá ${Math.floor(totalBeforeDiscount).toLocaleString("vi-VN")} ₫`,
                              variant: "destructive",
                            });
                          }
                          newPercent =
                            totalBeforeDiscount > 0
                              ? Math.floor(
                                  (newDiscount / totalBeforeDiscount) * 100,
                                )
                              : 0;
                        }

                        // Recalculate and redistribute discount to all items proportionally
                        if (newDiscount > 0 && totalBeforeDiscount > 0) {
                          // Redistribute to existing items
                          if (mode === "edit" && existingItems.length > 0) {
                            let allocatedDiscount = 0;
                            const hasNewItems = cart.length > 0;

                            setExistingItems((prev) =>
                              prev.map((item, index) => {
                                const itemSubtotal =
                                  parseFloat(item.unitPrice || "0") *
                                  parseInt(item.quantity || "0");

                                let itemDiscount = 0;
                                const isLastExistingItem =
                                  index === prev.length - 1;

                                if (isLastExistingItem && !hasNewItems) {
                                  // Last item gets remaining discount
                                  itemDiscount = Math.max(
                                    0,
                                    newDiscount - allocatedDiscount,
                                  );
                                } else {
                                  // Proportional discount
                                  itemDiscount = Math.floor(
                                    (newDiscount * itemSubtotal) /
                                      totalBeforeDiscount,
                                  );
                                  allocatedDiscount += itemDiscount;
                                }

                                return {
                                  ...item,
                                  discount: itemDiscount.toString(),
                                };
                              }),
                            );
                          }

                          // Redistribute to cart items
                          if (cart.length > 0) {
                            let allocatedForExisting = 0;

                            // Calculate discount already allocated to existing items
                            if (mode === "edit" && existingItems.length > 0) {
                              allocatedForExisting = existingItems.reduce(
                                (sum, item, index) => {
                                  const itemSubtotal =
                                    parseFloat(item.unitPrice || "0") *
                                    parseInt(item.quantity || "0");

                                  if (
                                    index === existingItems.length - 1 &&
                                    cart.length === 0
                                  ) {
                                    return newDiscount;
                                  }

                                  return (
                                    sum +
                                    Math.floor(
                                      (newDiscount * itemSubtotal) /
                                        totalBeforeDiscount,
                                    )
                                  );
                                },
                                0,
                              );
                            }

                            let allocatedForCart = 0;

                            setCart((prev) =>
                              prev.map((cartItem, index) => {
                                const itemSubtotal =
                                  parseFloat(cartItem.product.price) *
                                  cartItem.quantity;

                                let itemDiscount = 0;
                                const isLastCartItem =
                                  index === prev.length - 1;

                                if (isLastCartItem) {
                                  // Last cart item gets remaining discount
                                  itemDiscount = Math.max(
                                    0,
                                    newDiscount -
                                      allocatedForExisting -
                                      allocatedForCart,
                                  );
                                } else {
                                  // Proportional discount
                                  itemDiscount = Math.floor(
                                    (newDiscount * itemSubtotal) /
                                      totalBeforeDiscount,
                                  );
                                  allocatedForCart += itemDiscount;
                                }

                                return {
                                  ...cartItem,
                                  itemDiscount: itemDiscount,
                                };
                              }),
                            );
                          }
                        } else if (newDiscount === 0) {
                          // Clear all item discounts if order discount is 0
                          if (mode === "edit" && existingItems.length > 0) {
                            setExistingItems((prev) =>
                              prev.map((item) => ({
                                ...item,
                                discount: "0",
                              })),
                            );
                          }

                          setCart((prev) =>
                            prev.map((cartItem) => ({
                              ...cartItem,
                              itemDiscount: 0,
                            })),
                          );
                        }

                        setDiscount(newDiscount);
                        setDiscountPercent(newPercent);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          (e.target as HTMLInputElement).blur();
                        }
                      }}
                      className="flex-1 h-11 text-lg border-gray-300 focus:border-green-500 focus:ring-1 focus:ring-green-500 px-3 text-right"
                      placeholder="0"
                      title={
                        discountType === "percent"
                          ? "Nhập % giảm giá (0-100)"
                          : "Nhập số tiền giảm giá"
                      }
                    />
                    <Button
                      type="button"
                      variant={
                        discountType === "percent" ? "default" : "outline"
                      }
                      size="sm"
                      className="h-9 w-11 text-sm px-2"
                      onClick={() => {
                        setDiscountType("percent");
                      }}
                    >
                      %
                    </Button>
                    <Button
                      type="button"
                      variant={
                        discountType === "amount" ? "default" : "outline"
                      }
                      size="sm"
                      className="h-9 w-11 text-sm px-2"
                      onClick={() => {
                        setDiscountType("amount");
                      }}
                    >
                      ₫
                    </Button>
                  </div>
                </div>
              </div>

              {/* Search */}
              <Input
                placeholder={t("orders.searchPlaceholder")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-11 mb-2 text-lg border-gray-300 focus:border-green-500 focus:ring-1 focus:ring-green-500 px-3"
              />

              {/* Category Pills */}
              <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
                <Button
                  variant={selectedCategory === null ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedCategory(null)}
                  className={`whitespace-nowrap text-base h-11 px-4 ${selectedCategory === null ? "bg-green-600 hover:bg-green-700" : "hover:bg-gray-100"}`}
                >
                  {t("tables.allCategories")}
                </Button>
                {Array.isArray(categories) &&
                  categories
                    .filter((category: Category) => {
                      const isExpenseCategory =
                        category.id == 15 || category.id == 17;
                      const categoryProducts =
                        products?.filter(
                          (p: Product) => p.categoryId === category.id,
                        ) || [];
                      const hasValidProducts = categoryProducts.some(
                        (p: Product) => {
                          const productType =
                            Number(p.productType) !== 2 ||
                            Number(p.productType) !== 4;
                          return productType;
                        },
                      );
                      return !isExpenseCategory && hasValidProducts;
                    })
                    .map((category: Category) => (
                      <Button
                        key={category.id}
                        variant={
                          selectedCategory === category.id
                            ? "default"
                            : "outline"
                        }
                        size="sm"
                        onClick={() => setSelectedCategory(category.id)}
                        className={`whitespace-nowrap text-base h-11 px-4 ${selectedCategory === category.id ? "bg-green-600 hover:bg-green-700" : "hover:bg-gray-100"}`}
                      >
                        {category.name}
                      </Button>
                    ))}
              </div>
            </div>

            {/* Products Grid - 5 columns */}
            <div className="grid grid-cols-5 gap-2 overflow-y-auto flex-1 pb-1 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
              {filteredProducts.map((product: Product) => (
                <Card
                  key={product.id}
                  className={`transition-all ${
                    product.trackInventory === false ||
                    Number(product.stock) > 0
                      ? "cursor-pointer hover:shadow-md hover:border-green-500"
                      : "cursor-not-allowed opacity-50"
                  } border overflow-hidden`}
                >
                  <CardContent
                    className="p-0"
                    onClick={() =>
                      (product.trackInventory === false ||
                        Number(product.stock) > 0) &&
                      addToCart(product)
                    }
                  >
                    {/* Product Image */}
                    <div className="w-full h-32 bg-gradient-to-br from-gray-100 to-gray-200 relative overflow-hidden">
                      {product.imageUrl ? (
                        <img
                          src={product.imageUrl}
                          alt={product.name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.currentTarget.src =
                              'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Crect fill="%23f3f4f6" width="100" height="100"/%3E%3Ctext x="50%25" y="50%25" font-size="14" text-anchor="middle" dy=".3em" fill="%239ca3af"%3ENo Image%3C/text%3E%3C/svg%3E';
                          }}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <span className="text-gray-400 text-xs">
                            No Image
                          </span>
                        </div>
                      )}
                      {/* Stock badge overlay */}
                      <div className="absolute top-1 right-1">
                        {product.trackInventory !== false ? (
                          <Badge
                            variant={
                              Number(product.stock) > 0
                                ? "default"
                                : "destructive"
                            }
                            className="text-xs px-1.5 py-0.5 shadow-sm"
                          >
                            {Number(product.stock) > 0
                              ? `${product.stock}`
                              : "Hết"}
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="text-green-600 border-green-600 bg-white text-xs px-1.5 py-0.5 shadow-sm"
                          >
                            ✓
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Product Info */}
                    <div className="p-2 space-y-1">
                      <h4 className="font-semibold text-sm line-clamp-2 min-h-[2.5rem] text-gray-800 leading-tight">
                        {product.name}
                      </h4>
                      {product.sku && (
                        <p className="text-xs text-gray-500 truncate">
                          SKU: {product.sku}
                        </p>
                      )}
                      <div className="flex items-center justify-between">
                        <span
                          className={`font-bold text-base ${
                            product.trackInventory === false ||
                            Number(product.stock) > 0
                              ? "text-green-600"
                              : "text-gray-400"
                          }`}
                        >
                          {Math.round(
                            parseFloat(product.price),
                          ).toLocaleString("vi-VN")}{" "}
                          ₫
                        </span>
                        {product.taxRate && parseFloat(product.taxRate) > 0 && (
                          <span className="text-xs text-gray-500">
                            +{product.taxRate}% VAT
                          </span>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Right Panel - Order Summary */}
          <div className="flex flex-col min-h-0 bg-gradient-to-br from-green-50 to-white rounded-lg border-2 border-green-200 shadow-md">
            <div className="flex-shrink-0 p-2 bg-white border-b border-green-200">
              <div className="flex gap-1.5">
                <Button
                  variant="outline"
                  onClick={handleClose}
                  className="flex-1 h-9 text-sm border border-gray-300 hover:bg-gray-100 font-medium px-2"
                >
                  {t("common.close")}
                </Button>
                {/* Print Bill Button */}
                {(cart.length > 0 ||
                  (mode === "edit" && existingItems.length > 0) ||
                  mode === "edit") && (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => {
                        console.log("🖨️ Order Dialog: In tạm tính clicked", {
                          existingItemsCount: existingItems.length,
                          cartItemsCount: cart.length,
                          customerName,
                          discount,
                        });

                        const previewItems = [
                          ...existingItems.map((item) => ({
                            id: item.id,
                            productId: item.productId,
                            productName: item.productName,
                            quantity: item.quantity,
                            price: item.unitPrice, // Use editable unitPrice
                            unitPrice: item.unitPrice, // Use editable unitPrice
                            total: (
                              parseFloat(item.unitPrice) *
                              parseInt(item.quantity)
                            ).toString(),
                            discount: item.discount || "0",
                            tax: item.tax || "0",
                            sku: item.productSku || `SP${item.productId}`,
                            taxRate: (() => {
                              const product = products?.find(
                                (p: Product) => p.id === item.productId,
                              );
                              return product?.taxRate
                                ? parseFloat(product.taxRate)
                                : 0;
                            })(),
                          })),
                          ...cart.map((item) => ({
                            id: item.product.id,
                            productId: item.product.id,
                            productName: item.product.name,
                            quantity: item.quantity,
                            price: item.product.price, // Use editable price from cart
                            unitPrice: item.product.price, // Use editable price from cart
                            total: (
                              parseFloat(item.product.price) * item.quantity
                            ).toString(),
                            discount: "0",
                            tax: "0",
                            sku: item.product.sku || `SP${item.product.id}`,
                            taxRate: item.product.taxRate
                              ? parseFloat(item.product.taxRate)
                              : 0,
                          })),
                        ];

                        const subtotalAmount = Math.floor(calculateSubtotal());
                        const taxAmount = Math.floor(calculateTax());
                        const totalAmount = Math.floor(calculateTotal());

                        const previewReceipt = {
                          id: existingOrder?.id || 0,
                          orderId: existingOrder?.id || 0,
                          orderNumber:
                            existingOrder?.orderNumber ||
                            `ORD-PREVIEW-${Date.now()}`,
                          tableId: table?.id,
                          tableNumber: table?.tableNumber,
                          customerName: customerName || "Khách hàng",
                          customerPhone: existingOrder?.customerPhone || "",
                          customerCount: customerCount,
                          items: previewItems,
                          subtotal: subtotalAmount.toString(),
                          tax: taxAmount.toString(),
                          discount: discount.toString(),
                          total: totalAmount.toString(),
                          exactSubtotal: subtotalAmount,
                          exactTax: taxAmount,
                          exactDiscount: Math.floor(discount),
                          exactTotal: totalAmount,
                          transactionId:
                            existingOrder?.orderNumber ||
                            `PREVIEW-${Date.now()}`,
                          createdAt: new Date().toISOString(),
                          cashierName: "Table Service",
                          paymentMethod: "preview",
                          isPreview: true,
                          priceIncludeTax:
                            storeSettings?.priceIncludeTax || false,
                        };

                        setPreviewReceipt(previewReceipt);
                        setShowReceiptPreview(true);
                      }}
                      disabled={
                        !table ||
                        (mode !== "edit" && cart.length === 0) ||
                        (mode === "edit" &&
                          existingItems.length === 0 &&
                          cart.length === 0)
                      }
                      className="flex-1 h-9 text-sm border border-blue-400 text-blue-600 hover:bg-blue-50 font-medium px-2"
                    >
                      📄 {t("tables.printBill")}
                    </Button>
                    <Button
                      onClick={handlePlaceOrder}
                      disabled={
                        !table ||
                        (mode !== "edit" && cart.length === 0) ||
                        createOrderMutation.isPending
                      }
                      className="flex-1 bg-gradient-to-r from-green-600 to-green-500 hover:from-green-700 hover:to-green-600 text-white h-9 shadow-md hover:shadow-lg transition-all font-semibold text-sm px-2"
                    >
                      {createOrderMutation.isPending
                        ? mode === "edit"
                          ? t("orders.updating")
                          : t("tables.placing")
                        : mode === "edit"
                          ? t("orders.updateOrder")
                          : t("orders.placeOrder")}
                    </Button>
                  </>
                )}
              </div>
            </div>
            <div className="flex items-center justify-between p-2 border-b border-green-200 flex-shrink-0 bg-green-600">
              <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                <ShoppingCart className="w-4 h-4" />
                {mode === "edit"
                  ? t("orders.itemsAndNewItems")
                  : t("tables.orderHistory")}
              </h3>
              <Badge
                variant="secondary"
                className="px-2 py-0.5 text-xs font-bold bg-white text-green-700 shadow-sm"
              >
                {mode === "edit"
                  ? `${existingItems.length + cart.length} ${t("common.items")}`
                  : `${cart.length} ${t("tables.itemsSelected")}`}
              </Badge>
            </div>

            {/* Scrollable Content Area */}
            <div className="flex-1 overflow-y-auto space-y-1.5 p-2 min-h-0 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
              {/* Existing Items (Edit Mode Only) */}
              {mode === "edit" && existingItems.length > 0 && (
                <>
                  <div className="space-y-2">
                    <h4 className="text-base font-medium text-gray-600 flex-shrink-0">
                      {t("orders.previouslyOrdered")}
                    </h4>
                    <div className="space-y-1.5">
                      {existingItems.map((item, index) => (
                        <Card key={`existing-${index}`} className="bg-gray-50">
                          <CardContent className="p-3">
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <div className="mb-2">
                                  <h4 className="font-medium text-sm">
                                    {item.productName}
                                  </h4>
                                  <p className="text-xs text-gray-500">
                                    {t("orders.alreadyOrdered")}
                                  </p>
                                  <div className="text-xs text-gray-600 mt-1">
                                    {t("tables.unitPrice")}:{" "}
                                    <span className="font-semibold">
                                      {parseFloat(
                                        item.unitPrice || "0",
                                      ).toLocaleString()}{" "}
                                      ₫
                                    </span>
                                  </div>
                                </div>

                                {/* Quantity controls for existing items */}
                                <div className="flex items-center gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setItemToReduce({ item, index });
                                      setShowReduceQtyDialog(true);
                                    }}
                                    className="h-7 w-7 p-0"
                                    disabled={
                                      parseInt(item.quantity || "1") <= 1
                                    }
                                  >
                                    <Minus className="w-3 h-3" />
                                  </Button>
                                  <Input
                                    type="number"
                                    min="1"
                                    value={parseInt(item.quantity || "1")}
                                    onChange={(e) => {
                                      const newQuantity =
                                        parseInt(e.target.value) || 1;
                                      if (newQuantity >= 1) {
                                        setExistingItems((prev) =>
                                          prev.map((existingItem) =>
                                            existingItem.id === item.id
                                              ? {
                                                  ...existingItem,
                                                  quantity:
                                                    newQuantity.toString(),
                                                }
                                              : existingItem,
                                          ),
                                        );
                                      }
                                    }}
                                    className="w-14 h-7 text-center text-sm p-1 border rounded font-semibold"
                                  />
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setItemToIncrease({ item, index });
                                      setShowIncreaseQtyDialog(true);
                                    }}
                                    className="h-7 w-7 p-0"
                                  >
                                    <Plus className="w-3 h-3" />
                                  </Button>
                                </div>

                                {/* Unit Price Input for existing items */}
                                <div className="mt-2">
                                  <Label className="text-xs text-gray-600">Đơn giá:</Label>
                                  <Input
                                    type="text"
                                    inputMode="numeric"
                                    value={Math.floor(parseFloat(item.unitPrice || "0")).toLocaleString("vi-VN")}
                                    onChange={(e) => {
                                      const value = e.target.value.replace(/[^\d]/g, "");
                                      const newPrice = value ? parseInt(value) : 0;

                                      setExistingItems((prev) =>
                                        prev.map((existingItem) =>
                                          existingItem.id === item.id
                                            ? {
                                                ...existingItem,
                                                unitPrice: newPrice.toString(),
                                              }
                                            : existingItem,
                                        ),
                                      );
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") {
                                        e.preventDefault();
                                        (e.target as HTMLInputElement).blur();
                                      }
                                    }}
                                    className="w-full h-8 text-sm px-2 text-right"
                                  />
                                </div>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <div className="text-right">
                                  <div className="text-xs text-gray-500">
                                    {t("orders.itemTotal")}
                                  </div>
                                  <div className="text-base font-bold text-blue-600">
                                    {(() => {
                                      // Calculate display total based on priceIncludesTax
                                      const unitPrice = parseFloat(
                                        item.unitPrice || "0",
                                      );
                                      const quantity = parseInt(
                                        item.quantity || "0",
                                      );
                                      const itemTotal = unitPrice * quantity;

                                      return Math.floor(
                                        itemTotal,
                                      ).toLocaleString();
                                    })()}{" "}
                                    ₫
                                  </div>
                                </div>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => {
                                    setItemToDelete({ item, index });
                                    setShowDeleteItemDialog(true);
                                  }}
                                  className="h-7 w-7 p-0"
                                >
                                  <Minus className="w-3 h-3" />
                                </Button>
                              </div>
                            </div>
                            {/* Individual item discount for existing items */}
                            {(() => {
                              const originalPrice = Number(item.unitPrice || 0);
                              const quantity = Number(item.quantity || 0);
                              const itemTotal = originalPrice * quantity;

                              // Always use the stored discount value from the item
                              const itemDiscountAmount = parseFloat(
                                item.discount || "0",
                              );

                              return (
                                <div className="space-y-1 mt-1.5">
                                  <span className="text-xs text-gray-600 font-medium block">
                                    Giảm giá SP:
                                  </span>
                                  <div className="flex items-center gap-1.5 w-full">
                                    <Input
                                      type="text"
                                      inputMode="numeric"
                                      value={
                                        (item as any).itemDiscountType ===
                                        "percent"
                                          ? (item as any).itemDiscountPercent ||
                                            ""
                                          : itemDiscountAmount > 0
                                            ? Math.floor(
                                                itemDiscountAmount,
                                              ).toLocaleString("vi-VN")
                                            : ""
                                      }
                                      onChange={(e) => {
                                        const value = e.target.value.replace(
                                          /[^\d]/g,
                                          "",
                                        );
                                        const inputValue = value
                                          ? Math.max(0, parseInt(value))
                                          : 0;

                                        let newDiscount = 0;
                                        let newPercent = 0;

                                        if (
                                          (item as any).itemDiscountType ===
                                          "percent"
                                        ) {
                                          // Validate percentage (0-100)
                                          newPercent = Math.min(
                                            100,
                                            inputValue,
                                          );
                                          newDiscount = Math.floor(
                                            (itemTotal * newPercent) / 100,
                                          );
                                        } else {
                                          // Validate amount
                                          newDiscount = inputValue;
                                          if (newDiscount > itemTotal) {
                                            newDiscount = 0;
                                            toast({
                                              title: "Giảm giá không hợp lệ",
                                              description: `Giảm giá không được vượt quá ${Math.floor(itemTotal).toLocaleString("vi-VN")} ₫`,
                                              variant: "destructive",
                                            });
                                          }
                                          newPercent =
                                            itemTotal > 0
                                              ? Math.floor(
                                                  (newDiscount / itemTotal) *
                                                    100,
                                                )
                                              : 0;
                                        }

                                        // Update existing item discount
                                        setExistingItems((prev) =>
                                          prev.map((existingItem) =>
                                            existingItem.id === item.id
                                              ? {
                                                  ...existingItem,
                                                  discount:
                                                    newDiscount.toString(),
                                                  itemDiscountPercent:
                                                    newPercent,
                                                }
                                              : existingItem,
                                          ),
                                        );

                                        // Calculate new total discount from all items
                                        const newTotalItemDiscount =
                                          existingItems.reduce(
                                            (sum, existingItem) => {
                                              if (existingItem.id === item.id) {
                                                return sum + newDiscount;
                                              }
                                              return (
                                                sum +
                                                parseFloat(
                                                  existingItem.discount || "0",
                                                )
                                              );
                                            },
                                            0,
                                          ) +
                                          cart.reduce((sum, cartItem) => {
                                            return (
                                              sum +
                                              parseFloat(
                                                (cartItem as any)
                                                  .itemDiscount || "0",
                                              )
                                            );
                                          }, 0);

                                        // Update order discount to match sum of item discounts
                                        setDiscount(newTotalItemDiscount);
                                      }}
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                          e.preventDefault();
                                          (e.target as HTMLInputElement).blur();
                                        }
                                      }}
                                      className="flex-1 h-8 text-sm px-2.5 text-right bg-white border-gray-300 focus:border-blue-500"
                                      placeholder="0"
                                      title={
                                        (item as any).itemDiscountType ===
                                        "percent"
                                          ? "Nhập % giảm giá (0-100)"
                                          : "Nhập số tiền giảm giá"
                                      }
                                    />
                                    <Button
                                      type="button"
                                      variant={
                                        (item as any).itemDiscountType ===
                                        "percent"
                                          ? "default"
                                          : "outline"
                                      }
                                      size="sm"
                                      className="h-9 w-11 text-sm px-2"
                                      onClick={() => {
                                        setExistingItems((prev) =>
                                          prev.map((existingItem) =>
                                            existingItem.id === item.id
                                              ? {
                                                  ...existingItem,
                                                  itemDiscountType: "percent",
                                                }
                                              : existingItem,
                                          ),
                                        );
                                      }}
                                    >
                                      %
                                    </Button>
                                    <Button
                                      type="button"
                                      variant={
                                        (item as any).itemDiscountType ===
                                          "amount" ||
                                        !(item as any).itemDiscountType
                                          ? "default"
                                          : "outline"
                                      }
                                      size="sm"
                                      className="h-9 w-11 text-sm px-2"
                                      onClick={() => {
                                        setExistingItems((prev) =>
                                          prev.map((existingItem) =>
                                            existingItem.id === item.id
                                              ? {
                                                  ...existingItem,
                                                  itemDiscountType: "amount",
                                                }
                                              : existingItem,
                                          ),
                                        );
                                      }}
                                    >
                                      ₫
                                    </Button>
                                  </div>
                                </div>
                              );
                            })()}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                  {cart.length > 0 && <Separator className="my-2" />}
                  {cart.length > 0 && (
                    <h4 className="text-base font-medium text-gray-550">
                      {t("orders.newItemsToAdd")}
                    </h4>
                  )}
                </>
              )}

              {cart.length === 0 ? (
                <div className="text-center py-8 text-gray-500 max-w-xs mx-auto">
                  <ShoppingCart className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p className="text-base">{t("tables.noItemsSelected")}</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {cart.map((item) => (
                    <Card key={item.product.id}>
                      <CardContent className="p-3">
                        <div className="space-y-2">
                          <div className="flex justify-between items-start">
                            <h4 className="font-medium text-sm">
                              {item.product.name}
                            </h4>
                            <span className="text-sm font-bold">
                              {(() => {
                                const priceIncludesTax =
                                  storeSettings?.priceIncludesTax || false;
                                const basePrice = Number(item.product.price);
                                const taxRate = Number(
                                  item.product.taxRate || 0,
                                );
                                const quantity = item.quantity;

                                return Math.round(
                                  basePrice * quantity,
                                ).toLocaleString();
                              })()}{" "}
                              ₫
                            </span>
                          </div>

                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => removeFromCart(item.product.id)}
                                className="h-6 w-6 p-0"
                              >
                                <Minus className="w-3 h-3" />
                              </Button>
                              <Input
                                type="number"
                                min="1"
                                max={item.product.stock}
                                value={item.quantity}
                                onChange={(e) => {
                                  const newQuantity =
                                    parseInt(e.target.value) || 1;
                                  if (
                                    newQuantity >= 1 &&
                                    newQuantity <= item.product.stock
                                  ) {
                                    setCart((prev) =>
                                      prev.map((cartItem) =>
                                        cartItem.product.id === item.product.id
                                          ? {
                                              ...cartItem,
                                              quantity: newQuantity,
                                            }
                                          : cartItem,
                                      ),
                                    );
                                  }
                                }}
                                className="w-16 h-6 text-center text-sm p-1 border rounded"
                              />
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => addToCart(item.product)}
                                className="h-6 w-6 p-0"
                                disabled={item.quantity >= item.product.stock}
                              >
                                <Plus className="w-3 h-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => {
                                  setCart((prev) =>
                                    prev.filter(
                                      (cartItem) =>
                                        cartItem.product.id !== item.product.id
                                    )
                                  );
                                }}
                                className="h-6 w-6 p-0 ml-2"
                                title={t("common.delete")}
                              >
                                <Minus className="w-3 h-3" />
                              </Button>
                            </div>
                            <div className="text-xs text-gray-500 space-y-1">
                              <div className="flex items-center gap-1">
                                <span>{t("tables.unitPrice")}:</span>
                                <Input
                                  type="text"
                                  inputMode="numeric"
                                  value={Math.round(Number(item.product.price)).toLocaleString("vi-VN")}
                                  onChange={(e) => {
                                    const value = e.target.value.replace(/[^\d]/g, "");
                                    const newPrice = value ? parseInt(value) : 0;

                                    setCart((prev) =>
                                      prev.map((cartItem) =>
                                        cartItem.product.id === item.product.id
                                          ? {
                                              ...cartItem,
                                              product: {
                                                ...cartItem.product,
                                                price: newPrice.toString(),
                                              },
                                            }
                                          : cartItem,
                                      ),
                                    );
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      e.preventDefault();
                                      (e.target as HTMLInputElement).blur();
                                    }
                                  }}
                                  className="w-24 h-6 text-xs px-1 text-right inline-block"
                                />
                                <span>₫</span>
                              </div>
                              {(() => {
                                // Use edited unitPrice for calculation
                                const unitPrice = parseFloat(item.product.price || "0");
                                const quantity = parseInt(item.quantity || "0");
                                const product = products?.find(
                                  (p: Product) => p.id === item.productId,
                                );
                                const priceIncludesTax =
                                  storeSettings?.priceIncludesTax || false;

                                let itemTax = 0;

                                if (product?.taxRate && parseFloat(product.taxRate) > 0) {
                                  const taxRate = parseFloat(product.taxRate) / 100;
                                  const itemDiscountAmount = parseFloat(item.itemDiscount || "0");

                                  if (priceIncludesTax) {
                                    // When price includes tax:
                                    const discountPerUnit = itemDiscountAmount / quantity;
                                    const adjustedPrice = Math.max(0, unitPrice - discountPerUnit);
                                    const giaGomThue = adjustedPrice * quantity;
                                    const priceBeforeTax = Math.round(giaGomThue / (1 + taxRate));
                                    itemTax = giaGomThue - priceBeforeTax;
                                  } else {
                                    // When price doesn't include tax:
                                    const priceBeforeTax = unitPrice * quantity - itemDiscountAmount;
                                    itemTax = Math.round(priceBeforeTax * taxRate);
                                  }
                                }

                                return itemTax > 0 ? (
                                  <div>
                                    {t("reports.tax")}: {Math.round(itemTax).toLocaleString("vi-VN")} ₫
                                  </div>
                                ) : null;
                              })()}
                              {(() => {
                                const originalPrice = Number(
                                  item.product.price,
                                );
                                const quantity = item.quantity;
                                const itemTotal = originalPrice * quantity;

                                const sumOfItemDiscounts =
                                  existingItems.reduce((sum, item) => {
                                    return (
                                      sum +
                                      parseFloat(item.discount || "0")
                                    );
                                  }, 0) +
                                  cart.reduce((sum, item) => {
                                    return (
                                      sum +
                                      parseFloat(
                                        (item as any).itemDiscount || "0",
                                      )
                                    );
                                  }, 0);

                                // Get item-specific discount if exists
                                let itemDiscountAmount = parseFloat(
                                  (item as any).itemDiscount || "0",
                                );

                                // If no item-specific discount, calculate from order discount
                                if (
                                  itemDiscountAmount === 0 &&
                                  discount > 0 &&
                                  discount != sumOfItemDiscounts
                                ) {
                                  const totalBeforeDiscount =
                                    existingItems.reduce((sum, item) => {
                                      return (
                                        sum +
                                        Number(item.unitPrice || 0) *
                                          Number(item.quantity || 0)
                                      );
                                    }, 0) +
                                    cart.reduce((sum, item) => {
                                      return (
                                        sum +
                                        Number(item.product.price) *
                                          item.quantity
                                      );
                                    }, 0);

                                  if (totalBeforeDiscount > 0) {
                                    itemDiscountAmount = Math.round(
                                      (discount * itemTotal) /
                                        totalBeforeDiscount,
                                    );
                                  }
                                }
                                let finalTotal = itemTotal - itemDiscountAmount;

                                return (
                                  <div className="font-medium text-blue-600">
                                    {t("reports.totalMoney")}:{" "}
                                    {Math.floor(finalTotal).toLocaleString()} ₫
                                  </div>
                                );
                              })()}
                            </div>
                          </div>

                          {/* Individual item discount input with type toggle */}
                          <div className="space-y-1 mt-1.5">
                            <span className="text-xs text-gray-600 font-medium block">
                              Giảm giá SP:
                            </span>
                            <div className="flex items-center gap-1.5 w-full">
                              <Input
                                type="text"
                                inputMode="numeric"
                                value={(() => {
                                  const itemDiscountValue = parseFloat(
                                    (item as any).itemDiscount || "0",
                                  );

                                  if (
                                    (item as any).itemDiscountType === "percent"
                                  ) {
                                    return (
                                      (item as any).itemDiscountPercent || ""
                                    );
                                  }

                                  return itemDiscountValue > 0
                                    ? Math.floor(
                                        itemDiscountValue,
                                      ).toLocaleString("vi-VN")
                                    : "";
                                })()}
                                onChange={(e) => {
                                  const value = e.target.value.replace(
                                    /[^\d]/g,
                                    "",
                                  );
                                  const inputValue = value
                                    ? Math.max(0, parseInt(value))
                                    : 0;

                                  const itemTotal =
                                    parseFloat(item.product.price) *
                                    item.quantity;

                                  let newDiscount = 0;
                                  let newPercent = 0;

                                  if (
                                    (item as any).itemDiscountType === "percent"
                                  ) {
                                    // Validate percentage (0-100)
                                    newPercent = Math.min(100, inputValue);
                                    newDiscount = Math.floor(
                                      (itemTotal * newPercent) / 100,
                                    );
                                  } else {
                                    // Validate amount
                                    newDiscount = inputValue;
                                    if (newDiscount > itemTotal) {
                                      newDiscount = 0;
                                      toast({
                                        title: "Giảm giá không hợp lệ",
                                        description: `Giảm giá không được vượt quá ${Math.floor(itemTotal).toLocaleString("vi-VN")} ₫`,
                                        variant: "destructive",
                                      });
                                    }
                                    newPercent =
                                      itemTotal > 0
                                        ? Math.floor(
                                            (newDiscount / itemTotal) * 100,
                                          )
                                        : 0;
                                  }

                                  // Update cart item with individual discount
                                  setCart((prev) =>
                                    prev.map((cartItem) =>
                                      cartItem.product.id === item.product.id
                                        ? {
                                            ...cartItem,
                                            itemDiscount: newDiscount,
                                            itemDiscountPercent: newPercent,
                                          }
                                        : cartItem,
                                    ),
                                  );

                                  // Calculate new total discount from all items
                                  const newTotalItemDiscount =
                                    existingItems.reduce(
                                      (sum, existingItem) => {
                                        return (
                                          sum +
                                          parseFloat(
                                            existingItem.discount || "0",
                                          )
                                        );
                                      },
                                      0,
                                    ) +
                                    cart.reduce((sum, cartItem) => {
                                      if (
                                        cartItem.product.id === item.product.id
                                      ) {
                                        return sum + newDiscount;
                                      }
                                      return (
                                        sum +
                                        parseFloat(
                                          (cartItem as any).itemDiscount || "0",
                                        )
                                      );
                                    }, 0);

                                  // If they differ, recalculate order discount to match sum of item discounts
                                  const discountDifference = Math.abs(
                                    discount - newTotalItemDiscount,
                                  );
                                  if (discountDifference >= 0.01) {
                                    setDiscount(newTotalItemDiscount);
                                  }
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.preventDefault();
                                    (e.target as HTMLInputElement).blur();
                                  }
                                }}
                                className="flex-1 h-8 text-sm px-2.5 text-right bg-white border-gray-300 focus:border-blue-500"
                                placeholder="0"
                                title={
                                  (item as any).itemDiscountType === "percent"
                                    ? "Nhập % giảm giá (0-100)"
                                    : "Nhập số tiền giảm giá"
                                }
                              />
                              <Button
                                type="button"
                                variant={
                                  (item as any).itemDiscountType === "percent"
                                    ? "default"
                                    : "outline"
                                }
                                size="sm"
                                className="h-9 w-11 text-sm px-2"
                                onClick={() => {
                                  setCart((prev) =>
                                    prev.map((cartItem) =>
                                      cartItem.product.id === item.product.id
                                        ? {
                                            ...cartItem,
                                            itemDiscountType: "percent",
                                          }
                                        : cartItem,
                                    ),
                                  );
                                }}
                              >
                                %
                              </Button>
                              <Button
                                type="button"
                                variant={
                                  (item as any).itemDiscountType === "amount" ||
                                  !(item as any).itemDiscountType
                                    ? "default"
                                    : "outline"
                                }
                                size="sm"
                                className="h-9 w-11 text-sm px-2"
                                onClick={() => {
                                  setCart((prev) =>
                                    prev.map((cartItem) =>
                                      cartItem.product.id === item.product.id
                                        ? {
                                            ...cartItem,
                                            itemDiscountType: "amount",
                                          }
                                        : cartItem,
                                    ),
                                  );
                                }}
                              >
                                ₫
                              </Button>
                            </div>
                          </div>

                          {/* Individual item discount display */}
                          {(() => {
                            // Calculate sum of all order_item discounts
                            const sumOfItemDiscounts =
                              existingItems.reduce((sum, item) => {
                                return sum + parseFloat(item.discount || "0");
                              }, 0) +
                              cart.reduce((sum, item) => {
                                return (
                                  sum +
                                  parseFloat((item as any).itemDiscount || "0")
                                );
                              }, 0);

                            // Check if sum of item discounts equals order discount (with small tolerance for rounding)
                            const discountsMatch =
                              Math.abs(discount - sumOfItemDiscounts) < 0.01;

                            const itemDiscountAmount = parseFloat(
                              (item as any).itemDiscount || "0",
                            );

                            // If discounts match (already fully allocated), only show if this item has discount
                            if (discountsMatch) {
                              return itemDiscountAmount > 0 ? (
                                <div className="text-xs text-red-600 mt-1 bg-red-50 px-2 py-0.5 rounded">
                                  <span className="font-medium">
                                    {t("common.discount")}:{" "}
                                  </span>
                                  <span className="font-semibold">
                                    -
                                    {itemDiscountAmount.toLocaleString("vi-VN")}{" "}
                                    ₫
                                  </span>
                                </div>
                              ) : null;
                            }

                            // Otherwise, recalculate proportional discount from order-level discount
                            if (discount > 0 && !discountsMatch) {
                              const originalPrice = Number(item.product.price);
                              const quantity = item.quantity;
                              const itemTotal = originalPrice * quantity;

                              const totalBeforeDiscount =
                                existingItems.reduce((sum, item) => {
                                  return (
                                    sum +
                                    Number(item.unitPrice || 0) *
                                      Number(item.quantity || 0)
                                  );
                                }, 0) +
                                cart.reduce((sum, item) => {
                                  return (
                                    sum +
                                    Number(item.product.price) * item.quantity
                                  );
                                }, 0);

                              let proportionalDiscount = 0;
                              if (totalBeforeDiscount > 0) {
                                proportionalDiscount = Math.round(
                                  (discount * itemTotal) / totalBeforeDiscount,
                                );
                              }

                              return proportionalDiscount > 0 ? (
                                <div className="text-xs text-red-600 mt-1 text-end">
                                  <span>{t("common.discount")} : </span>
                                  <span>
                                    -{proportionalDiscount.toLocaleString()} ₫
                                  </span>
                                </div>
                              ) : null;
                            }

                            return null;
                          })()}

                          <Textarea
                            placeholder={t("tables.specialRequests")}
                            value={item.notes || ""}
                            onChange={(e) =>
                              updateItemNotes(item.product.id, e.target.value)
                            }
                            className="text-xs h-16"
                          />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>

            {/* Summary Section - Fixed at bottom of right panel */}
            {(cart.length > 0 ||
              (mode === "edit" && existingItems.length > 0) ||
              mode === "edit") && (
              <div className="flex-shrink-0 border-t-2 border-green-200 bg-white p-3">
                <div className="space-y-1.5 text-base">
                  {mode === "edit" && existingItems.length > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">
                        {t("orders.previousItems")}
                      </span>
                      <span className="font-medium">
                        {Math.floor(
                          existingItems.reduce((total, item) => {
                            const itemSubtotal =
                              Number(item.unitPrice || 0) *
                              Number(item.quantity || 0);
                            return total + itemSubtotal;
                          }, 0),
                        ).toLocaleString()}{" "}
                        ₫
                      </span>
                    </div>
                  )}
                  {cart.length > 0 && mode === "edit" && (
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">
                        {t("orders.newItems")}
                      </span>
                      <span className="font-medium">
                        {Math.floor(
                          cart.reduce(
                            (total, item) =>
                              total +
                              Number(item.product.price) * item.quantity,
                            0,
                          ),
                        ).toLocaleString()}{" "}
                        ₫
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">
                      {t("orders.subtotal")}
                    </span>
                    <span className="font-medium">
                      {Math.floor(calculateSubtotal()).toLocaleString()} ₫
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">{t("reports.tax")}</span>
                    <span className="font-medium">
                      {Math.floor(calculateTax()).toLocaleString()} ₫
                    </span>
                  </div>
                  {discount > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">
                        {t("reports.discount")}:
                      </span>
                      <span className="font-medium text-red-600">
                        -{Math.floor(discount).toLocaleString()} ₫
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                    <span className="text-gray-800 font-bold text-base">
                      {t("orders.totalAmount")}
                    </span>
                    <span className="font-bold text-xl text-green-600">
                      {Math.floor(calculateTotal()).toLocaleString()} ₫
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>

      {/* Receipt Preview Modal */}
      {showReceiptPreview && previewReceipt && (
        <ReceiptModal
          isOpen={showReceiptPreview}
          onClose={() => {
            console.log("🔒 Order Dialog: Closing receipt preview modal");
            setShowReceiptPreview(false);
            setPreviewReceipt(null);
          }}
          receipt={previewReceipt}
          cartItems={previewReceipt.items || []}
          total={previewReceipt.exactTotal || 0}
          isPreview={false}
          isTitle={false}
        />
      )}

      {/* Delete Item Confirmation Dialog */}
      <AlertDialog
        open={showDeleteItemDialog}
        onOpenChange={(open) => {
          setShowDeleteItemDialog(open);
          if (!open) {
            setDeleteNote("");
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("common.confirmDelete")}</AlertDialogTitle>
            <AlertDialogDescription>
              {(() => {
                const translation = t("orders.confirmDeleteItem");
                if (typeof translation === "string") {
                  return translation.replace(
                    "{itemName}",
                    itemToDelete?.item?.productName || "",
                  );
                }
                return `Bạn có chắc chắn muốn xóa "${itemToDelete?.item?.productName || ""}" khỏi đơn hàng?`;
              })()}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="px-6 py-4">
            <Label htmlFor="deleteNote" className="text-sm font-medium">
              Lý do xóa
            </Label>
            <Textarea
              id="deleteNote"
              value={deleteNote}
              onChange={(e) => setDeleteNote(e.target.value)}
              placeholder="Nhập lý do xóa sản phẩm..."
              className="mt-2"
              rows={3}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setShowDeleteItemDialog(false);
                setItemToDelete(null);
                setDeleteNote("");
              }}
            >
              {t("common.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!itemToDelete) return;

                const { item, index } = itemToDelete;

                // Remove item from existing items list
                setExistingItems((prev) => prev.filter((_, i) => i !== index));

                // Call API to delete the order item
                apiRequest("DELETE", `http://42.118.102.26:4500/api/order-items/${item.id}`)
                  .then(async () => {
                    console.log(
                      "🗑️ Order Dialog: Successfully deleted item:",
                      item.productName,
                    );

                    // Save delete note to order change history
                    if (existingOrder?.id) {
                      try {
                        await apiRequest("POST", "http://42.118.102.26:4500/api/order-change-history", {
                          orderId: existingOrder.id,
                          orderNumber: existingOrder.orderNumber,
                          ipAddress: window.location.hostname || "unknown",
                          userName: "Nhân viên",
                          action: "delete",
                          detailedDescription: JSON.stringify({
                            productName: item.productName,
                            quantity: parseFloat(item.quantity),
                            unitPrice: item.unitPrice,
                            total: item.total,
                            note: deleteNote || "Không có ghi chú",
                          }),
                          storeCode: existingOrder.storeCode || null,
                        });
                        console.log(
                          "✅ Delete note saved to order change history",
                        );
                      } catch (error) {
                        console.error(
                          "❌ Error saving delete note to order change history:",
                          error,
                        );
                      }
                    }

                    // toast({
                    //   title: "Xóa món thành công",
                    //   description: `Đã xóa "${item.productName}" khỏi đơn hàng`,
                    // });

                    // Recalculate order total if this is an existing order
                    if (existingOrder?.id) {
                      try {
                        console.log(
                          "🧮 Order Dialog: Starting order total recalculation for order:",
                          existingOrder.id,
                        );

                        // Fetch current order items after deletion
                        const response = await apiRequest(
                          "GET",
                          `http://42.118.102.26:4500/api/order-items/${existingOrder.id}`,
                        );
                        const remainingItems = await response.json();

                        console.log(
                          "📦 Order Dialog: Remaining items after deletion:",
                          remainingItems?.length || 0,
                        );

                        // Calculate new total based on remaining items
                        let newSubtotal = 0;
                        let newTax = 0;

                        if (
                          Array.isArray(remainingItems) &&
                          remainingItems.length > 0
                        ) {
                          remainingItems.forEach((remainingItem: any) => {
                            const basePrice = Number(
                              remainingItem.unitPrice || 0,
                            );
                            const quantity = Number(
                              remainingItem.quantity || 0,
                            );
                            const product = products?.find(
                              (p: any) => p.id === remainingItem.productId,
                            );

                            // Calculate subtotal
                            newSubtotal += basePrice * quantity;

                            // Calculate tax using Math.floor((after_tax_price - price) * quantity)
                            if (
                              product?.afterTaxPrice &&
                              product.afterTaxPrice !== null &&
                              product.afterTaxPrice !== ""
                            ) {
                              const afterTaxPrice = parseFloat(
                                product.afterTaxPrice,
                              );
                              const taxPerUnit = afterTaxPrice - basePrice;
                              newTax += Math.max(0, taxPerUnit * quantity);
                            }
                          });
                        }
                        // If no items left, totals should be 0
                        else {
                          console.log(
                            "📝 Order Dialog: No items left, setting totals to zero",
                          );
                          newSubtotal = 0;
                          newTax = 0;
                        }

                        const newTotal = newSubtotal + newTax;

                        console.log("💰 Order Dialog: Calculated new totals:", {
                          newSubtotal,
                          newTax,
                          newTotal,
                          itemsCount: remainingItems?.length || 0,
                        });

                        // Update order with new totals
                        apiRequest("PUT", `http://42.118.102.26:4500/api/orders/${existingOrder.id}`, {
                          subtotal: newSubtotal.toString(),
                          tax: newTax.toString(),
                          total: newTotal.toString(),
                        }).then(() => {
                          console.log(
                            "✅ Order Dialog: Order totals updated successfully",
                          );

                          // Force refresh of all related data to ensure UI updates immediately
                          Promise.all([
                            queryClient.invalidateQueries({
                              queryKey: ["http://42.118.102.26:4500/api/orders"],
                            }),
                            queryClient.invalidateQueries({
                              queryKey: ["http://42.118.102.26:4500/api/tables"],
                            }),
                            queryClient.invalidateQueries({
                              queryKey: ["http://42.118.102.26:4500/api/order-items"],
                            }),
                            queryClient.invalidateQueries({
                              queryKey: ["http://42.118.102.26:4500/api/order-items", existingOrder.id],
                            }),
                          ]).then(() => {
                            // Force immediate refetch to update table grid display
                            return Promise.all([
                              queryClient.refetchQueries({
                                queryKey: ["http://42.118.102.26:4500/api/orders"],
                              }),
                              queryClient.refetchQueries({
                                queryKey: ["http://42.118.102.26:4500/api/tables"],
                              }),
                            ]);
                          });
                        });

                        console.log(
                          "🔄 Order Dialog: All queries refreshed successfully",
                        );
                      } catch (error) {
                        console.error(
                          "❌ Order Dialog: Error recalculating order total:",
                          error,
                        );
                        toast({
                          title: "Cảnh báo",
                          description:
                            "Món đã được xóa nhưng có lỗi khi cập nhật tổng tiền",
                          variant: "destructive",
                        });
                      }
                    }

                    // Invalidate queries to refresh data
                    queryClient.invalidateQueries({
                      queryKey: ["http://42.118.102.26:4500/api/order-items"],
                    });
                    queryClient.invalidateQueries({
                      queryKey: ["http://42.118.102.26:4500/api/orders"],
                    });
                  })
                  .catch((error) => {
                    console.error("Error deleting order item:", error);
                    // Restore the item if deletion failed
                    setExistingItems((prev) => [
                      ...prev.slice(0, index),
                      item,
                      ...prev.slice(index),
                    ]);
                    toast({
                      title: "Lỗi xóa món",
                      description: "Không thể xóa món khỏi đơn hàng",
                      variant: "destructive",
                    });
                  });

                setShowDeleteItemDialog(false);
                setItemToDelete(null);
                setDeleteNote("");
              }}
              className="bg-red-600 hover:bg-red-700"
            >
              {t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reduce Quantity Confirmation Dialog */}
      <AlertDialog
        open={showReduceQtyDialog}
        onOpenChange={(open) => {
          setShowReduceQtyDialog(open);
          if (!open) {
            setReduceNote("");
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xác nhận giảm số lượng</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có chắc chắn muốn giảm số lượng "
              {itemToReduce?.item?.productName || ""}" từ{" "}
              {parseFloat(itemToReduce?.item?.quantity || 0)} xuống{" "}
              {parseFloat(itemToReduce?.item?.quantity || "0") - 1} không?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="px-6 py-4">
            <Label htmlFor="reduceNote" className="text-sm font-medium">
              Lý do giảm số lượng
            </Label>
            <Textarea
              id="reduceNote"
              value={reduceNote}
              onChange={(e) => setReduceNote(e.target.value)}
              placeholder="Nhập lý do giảm số lượng..."
              className="mt-2"
              rows={3}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setShowReduceQtyDialog(false);
                setItemToReduce(null);
                setReduceNote("");
              }}
            >
              {t("common.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmReduceQty}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Xác nhận
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Increase Quantity Confirmation Dialog */}
      <AlertDialog
        open={showIncreaseQtyDialog}
        onOpenChange={(open) => {
          setShowIncreaseQtyDialog(open);
          if (!open) {
            setIncreaseNote("");
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xác nhận tăng số lượng</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có chắc chắn muốn tăng số lượng "
              {itemToIncrease?.item?.productName || ""}" từ{" "}
              {parseFloat(itemToIncrease?.item?.quantity || 0)} lên{" "}
              {parseFloat(itemToIncrease?.item?.quantity || "0") + 1} không?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="px-6 py-4">
            <Label htmlFor="increaseNote" className="text-sm font-medium">
              Lý do tăng số lượng
            </Label>
            <Textarea
              id="increaseNote"
              value={increaseNote}
              onChange={(e) => setIncreaseNote(e.target.value)}
              placeholder="Nhập lý do tăng số lượng..."
              className="mt-2"
              rows={3}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setShowIncreaseQtyDialog(false);
                setItemToIncrease(null);
                setIncreaseNote("");
              }}
            >
              {t("common.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmIncreaseQty}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Xác nhận
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}