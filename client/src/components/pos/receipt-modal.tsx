import { X, Printer, Mail } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { Receipt } from "@shared/schema";
import logoPath from "@assets/EDPOS_1753091767028.png";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { EInvoiceModal } from "./einvoice-modal";
import { PaymentMethodModal } from "./payment-method-modal";
import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "@/lib/i18n";

interface ReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  receipt?: Receipt | null;
  cartItems?: any[];
  total?: number;
  isPreview?: boolean;
  onConfirm?: (orderData?: any) => void;
  isTitle?: boolean;
}

export function ReceiptModal({
  isOpen,
  onClose,
  receipt,
  cartItems = [],
  total = 0,
  isPreview = false,
  onConfirm,
  isTitle = true,
}: ReceiptModalProps) {
  // ALL HOOKS MUST BE AT THE TOP LEVEL - NEVER CONDITIONAL
  const [showEInvoiceModal, setShowEInvoiceModal] = useState(false);
  const [showPaymentMethodModal, setShowPaymentMethodModal] = useState(false);
  const [hasAutoOpened, setHasAutoOpened] = useState(false);
  const [printers, setPrinters] = useState([]);
  const { t } = useTranslation();

  console.log("🔍 ReceiptModal rendered with props:", {
    isOpen,
    isPreview,
    isTitle,
    hasReceipt: !!receipt,
    hasCartItems: cartItems?.length > 0,
    receiptIsPreview: receipt?.isPreview,
  });

  // CRITICAL: Always use prop isPreview, completely ignore receipt.isPreview
  console.log("🔍 ReceiptModal mode:", {
    propIsPreview: isPreview,
    receiptIsPreview: receipt?.isPreview,
    isTitleProp: isTitle,
    mode: isPreview ? "PREVIEW" : "FINAL RECEIPT",
  });

  // Calculate title: isTitle=true always shows payment invoice, otherwise use isPreview
  let title =
    isTitle === false
      ? `${t("pos.receiptPreview")}`
      : `${t("common.paymentInvoice")}`;

  // Query store settings
  const { data: storeSettings } = useQuery({
    queryKey: ["https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/store-settings"],
    queryFn: async () => {
      const response = await apiRequest("GET", "https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/store-settings");
      console.log("🏢 Store settings fetched:", response.json());
      return response.json();
    },
    enabled: isOpen, // Only fetch when modal is open
  });

  // Log receipt modal state for debugging - ALWAYS CALL THIS HOOK
  useEffect(() => {
    if (isOpen) {
      console.log("=== RECEIPT MODAL RENDERED ===");
      console.log(
        "Receipt Modal Mode:",
        isPreview ? "PREVIEW (Step 1)" : "FINAL RECEIPT (Step 5)",
      );
      console.log("Receipt Modal isOpen:", isOpen);
      console.log("Receipt Modal isPreview:", isPreview);
      console.log("Receipt Modal cartItems received:", cartItems);
      console.log("Receipt Modal cartItems length:", cartItems?.length || 0);
      console.log("Receipt Modal total:", total);
      console.log("Receipt Modal receipt:", receipt);
      console.log("🔍 ReceiptModal Props Debug:", {
        isOpen,
        isPreview,
        receipt,
        isTitle,
        cartItems: cartItems?.length || 0,
        onConfirm: !!onConfirm,
        hasReceiptData: !!(receipt && typeof receipt === "object"),
        hasValidData:
          !!(receipt && typeof receipt === "object") ||
          (isPreview &&
            cartItems &&
            Array.isArray(cartItems) &&
            cartItems.length > 0 &&
            total > 0),
      });

      console.log("Receipt Modal autoClose:", title);

      // Force show modal when receipt data exists
      if (receipt && typeof receipt === "object") {
        console.log(
          "✅ Receipt Modal: Valid receipt data found - modal will display",
        );
      }
    }
  }, [isOpen, receipt, isPreview, cartItems, total, onConfirm, isTitle]);

  // Don't return early here - let the Dialog component handle the open state

  useEffect(() => {
    async function fetchPrinterConfigs() {
      try {
        const printerResponse = await fetch("https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/printer-configs");
        if (!printerResponse.ok) {
          console.error("Failed to fetch printer configs");
          return;
        }

        const allConfigs = await printerResponse.json();
        console.log(`📋 Total printer configs found: ${allConfigs.length}`);

        // Get table floor if receipt has tableId
        let tableFloor = null;
        if (receipt?.tableId) {
          try {
            const tableResponse = await fetch(`https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/tables/${receipt.tableId}`);
            if (tableResponse.ok) {
              const tableData = await tableResponse.json();
              tableFloor = tableData.floor;
              console.log(
                `📍 Table ${receipt.tableId} is on floor: ${tableFloor}`,
              );
            }
          } catch (error) {
            console.error("Error fetching table data:", error);
          }
        }

        let activePrinterConfigs = [];

        // For kitchen receipts, get kitchen printers matching the floor + one employee printer
        let employeePrinter = allConfigs.filter(
          (config) => config.isActive && config.isEmployee,
        );

        let kitchenPrinters = allConfigs.filter(
          (config) => config.isActive && config.isKitchen,
        );

        console.log(
          `🍳 Kitchen receipt mode - Found ${kitchenPrinters.length} active kitchen printers`,
        );

        // Filter kitchen printers by floor if we have table floor info
        if (tableFloor) {
          kitchenPrinters = kitchenPrinters.filter(
            (config) => config.floor === tableFloor,
          );
          console.log(
            `🖨️ Filtered to ${kitchenPrinters.length} kitchen printers for floor ${tableFloor}`,
          );
        }

        // Combine kitchen printers with one employee printer
        activePrinterConfigs = [...kitchenPrinters, ...employeePrinter];

        if (isTitle) {
          activePrinterConfigs = activePrinterConfigs.filter(
            (config) => config.isEmployee,
          );
        }

        if (activePrinterConfigs.length > 0) {
          let lstPrinters = activePrinterConfigs.map((printer) => {
            return {
              name: printer.name,
              type: printer.printerType,
              ip: printer.ipAddress,
              port: printer.port ?? 9100,
              copies: printer.copies ?? 1,
              serinumber: printer.macAddress,
            };
          });
          setPrinters(lstPrinters);
          console.log("Danh sachs máy in", lstPrinters);
          console.log("✅ Final printer list to be used:");
        } else {
          console.log("⚠️ No matching printers found");
        }
      } catch (error) {
        console.error("Error in fetchPrinterConfigs:", error);
      }
    }
    fetchPrinterConfigs();
  }, [receipt?.tableId]);

  // Handle missing data cases
  const hasReceiptData = receipt && typeof receipt === "object";
  const hasCartData =
    cartItems && Array.isArray(cartItems) && cartItems.length > 0;
  const hasValidData =
    hasReceiptData || (isPreview && hasCartData && total > 0);

  if (!hasValidData) {
    console.log("❌ Receipt Modal: No valid data for display", {
      hasReceiptData,
      hasCartData,
      isPreview,
      total,
    });

    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Thông tin hóa đơn</DialogTitle>
          </DialogHeader>
          <div className="p-4 text-center">
            <p>
              {isPreview
                ? "Không có sản phẩm trong giỏ hàng để xem trư  c hóa đơn"
                : "Không có dữ liệu hóa đơn để hiển thị"}
            </p>
            <Button onClick={onClose} className="mt-4">
              Đóng
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const handleGetPrint = async () => {
    const printContent = document.getElementById("receipt-content");
    if (!printContent) {
      alert("Không tìm thấy nội dung hóa đơn để in.");
      return;
    }
    let content = printContent?.innerHTML ?? "";
    if (content) {
      content = formatForMiniPrinter(receipt, storeSettings);
      // content = generatePrintHTML(printContent, false);
    }

    console.log("🖨{�� ============ BẮT ĐẦU IN HÓA ĐƠN ============");
    console.log(
      `📝 Loại hóa đơn: ${isTitle ? "Hóa đơn nhân viên" : "Hóa đơn bếp"}`,
    );
    console.log(`📊 Số lượng máy in sẽ được sử dụng: ${printers.length}`);
    console.log(
      `🏢 Bàn: ${receipt?.tableId ? `Bàn ${receipt.tableId}` : "POS"}`,
    );
    console.log(`📍 Tầng: ${receipt?.tableId ? "Sẽ lọc theo tầng" : "N/A"}`);

    if (printers.length > 0) {
      console.log("📋 ==========================================");
      console.log("📋 DANH SÁCH MÁY IN SẼ ĐƯỢC SỬ DỤNG:");
      console.log("📋 ==========================================");
      printers.forEach((printer, index) => {
        console.log(`\n   🖨️  MÁY IN #${index + 1}:`);
        console.log(`   ├─ Tên máy in: ${printer.name}`);
        console.log(`   ├─ Loại máy in: ${printer.type}`);
        console.log(
          `   ├─ Kết nối: ${printer.ip ? `IP ${printer.ip}:${printer.port}` : "USB"}`,
        );
        console.log(`   └─ Số bản in: ${printer.copies} bản`);
      });
      console.log("\n📋 ==========================================\n");
    } else {
      console.log("⚠️ ==========================================");
      console.log("⚠️ KHÔNG CÓ MÁY IN NÀO ĐƯỢC CÁU HÌNH!");
      console.log("⚠️ ==========================================");
    }

    try {
      console.log("📤 Đang gửi lệnh in đến máy in...");
      console.log(
        `📦 Dữ liệu gửi đi: ${printers.length} máy in, ${content.length} ký tự nội dung`,
      );

      const response = await fetch("http://localhost:5000/print", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          printers,
          content,
        }),
      });

      const result = await response.text();
      console.log("✅ ==========================================");
      console.log("✅ KẾT QUẢ IN THÀNH CÔNG!");
      console.log("✅ ==========================================");
      console.log(`✅ Response: ${result}`);
      console.log(`✅ Đã in trên ${printers.length} máy in`);
      printers.forEach((printer, index) => {
        console.log(
          `   ✓ Máy in #${index + 1}: ${printer.name} - ${printer.copies} bản`,
        );
      });
      console.log("🖨️ ============ KẾT THÚC IN HÓA ĐƠN ============\n");
      alert("Kết quả in: " + result);

      onClose();
    } catch (error) {
      console.error("❌ ==========================================");
      console.error("❌ LỖI KHI IN HÓA ĐƠN!");
      console.error("❌ ==========================================");
      console.error("❌ Chi tiết lỗi:", error);
      console.error("❌ Số máy in đã cấu hình:", printers.length);
      if (printers.length > 0) {
        console.error("❌ Danh sách máy in:");
        printers.forEach((printer, index) => {
          console.error(
            `   ✗ Máy in #${index + 1}: ${printer.name} (${printer.ip || "USB"})`,
          );
        });
      }
      console.error("🖨️ ============ LỖI IN HÓA ĐƠN ============\n");
      alert(
        "Bạn chưa thiết lập cài đặt máy in. Vui lòng liên hệ với edpos để được hỗ trợ.",
      );
      onClose();
    }
  };

  const handlePrint = async () => {
    console.log(
      "🖨️ Receipt Modal: Print button clicked - processing for multi-platform printing",
    );

    const printContent = document.getElementById("receipt-content");
    if (!printContent) {
      alert("Không tìm thấy nội dung hóa đơn để in.");
      return;
    }

    try {
      // Enhanced device detection
      const userAgent = navigator.userAgent.toLowerCase();
      const isIOS = /iphone|ipad|ipod/.test(userAgent);
      const isAndroid = /android/.test(userAgent);
      const isMobile =
        isIOS || isAndroid || /mobile|tablet|phone/.test(userAgent);
      const isSafari = /safari/.test(userAgent) && !/chrome/.test(userAgent);
      const isChrome = /chrome/.test(userAgent);
      const isPOSTerminal =
        window.innerWidth <= 1024 && window.innerHeight <= 768;

      console.log("🔍 Enhanced device detection:", {
        isIOS,
        isAndroid,
        isMobile,
        isSafari,
        isChrome,
        isPOSTerminal,
        screenSize: `${window.innerWidth}x${window.innerHeight}`,
        userAgent: userAgent.substring(0, 100),
      });

      // Step 1: Check for active printer configurations
      let activePrinterConfigs = [];
      try {
        console.log("🖨️ Fetching active printer configurations...");
        const printerResponse = await fetch("https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/printer-configs");
        if (printerResponse.ok) {
          const allConfigs = await printerResponse.json();
          activePrinterConfigs = allConfigs.filter(
            (config) =>
              config.isActive && (config.isEmployee || config.isKitchen),
          );
          console.log("✅ Found active printer:", activePrinterConfigs);
          console.log(
            "✅ Found active printer configs:",
            activePrinterConfigs.length,
          );
        }
      } catch (configError) {
        console.log(
          "⚠️ Could not fetch printer configs, using fallback methods",
        );
      }

      // Step 2: Create receipt data structure for printing
      const receiptData = {
        content: printContent.innerHTML,
        type: "receipt",
        timestamp: new Date().toISOString(),
        orderId: receipt?.id,
        transactionId: receipt?.transactionId,
        deviceInfo: {
          userAgent: userAgent.substring(0, 100),
          platform: isIOS ? "iOS" : isAndroid ? "Android" : "Desktop",
          browser: isSafari ? "Safari" : isChrome ? "Chrome" : "Other",
          isMobile: isMobile,
        },
      };

      // Step 3: Try configured printers first (POS API with active configs)
      if (activePrinterConfigs.length > 0) {
        console.log("🖨️ Trying configured POS printers for all platforms...");

        try {
          const printResponse = await fetch("https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/pos/print-receipt", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              ...receiptData,
              printerConfigs: activePrinterConfigs,
              preferredConfig:
                activePrinterConfigs.find((c) => c.isEmployee) ||
                activePrinterConfigs[0],
            }),
          });

          if (printResponse.ok) {
            const result = await printResponse.json();
            console.log(
              "✅ Receipt sent to configured printer successfully:",
              result,
            );

            // Show success message based on device type
            const successMessage = isMobile
              ? "✅ Hóa đơn đã được gửi đến máy in thành công!\nKiểm tra máy in POS của bạn."
              : "✅ Hóa đơn đã được gửi đến máy in POS thành công!";

            alert(successMessage);
            onClose();

            if (typeof window !== "undefined") {
              window.dispatchEvent(
                new CustomEvent("printCompleted", {
                  detail: { closeAllModals: true, refreshData: true },
                }),
              );
            }
            return;
          } else {
            console.log(
              "⚠️ Configured printer API returned error, trying platform-specific fallbacks",
            );
          }
        } catch (apiError) {
          console.log(
            "⚠️ Configured printer API failed, using platform-specific fallbacks:",
            apiError.message,
          );
        }
      }

      // Step 4: Platform-specific fallback methods
      if (isMobile) {
        await handleMobilePrinting(
          printContent,
          isIOS,
          isAndroid,
          isSafari,
          isChrome,
        );
      } else {
        await handleDesktopPrinting(printContent);
      }
    } catch (error) {
      console.error("❌ Print error:", error);
      alert(`Có lỗi xảy ra khi in: ${error.message}\nVui lòng thử lại.`);
      // Final fallback to desktop method
      if (printContent) {
        handleDesktopPrint(printContent);
      }
    }
  };

  const formatForMiniPrinter = (receipt: any, config: any) => {
    const lineBreak = "\n";
    let formattedText = `
      ${config.storeName || "Tên cửa hàng"}
      Vị trí cửa hàng: ${config.address || "Địa chỉ cửa hàng"}
      Điện thoại: ${config.phone || "Số điện thoại"}
      ${title}
      Số giao dịch: ${receipt.transactionId}
      Ngày: ${new Date().toLocaleString("vi-VN")}
      Thu ngân: ${receipt.cashierName || "Tên thu ngân"}
      Phí ship: ${receipt.shippingFee ? `${receipt.shippingFee.toLocaleString("vi-VN")} ₫` : "0 ₫"}
    `;
    receipt.items.forEach((item: any) => {
      formattedText += `
      Tên sản phẩm: ${item.productName || "Không xác định"}
      SKU: ${item.sku} x ${item.quantity} (${Math.round(item.price, 0).toLocaleString("vi-VN")} ₫)
      Giảm giá: -${Math.round(item.discount, 0).toLocaleString("vi-VN")} ₫
      `;
    });

    let sumSubtotal = receipt.items.reduce((sum: any, item: any) => {
      return sum + item.price * item.quantity;
    }, 0);
    formattedText += `
      Thành tiền: ${sumSubtotal.toLocaleString("vi-VN")} ₫
      Thuế: ${receipt.tax.toLocaleString("vi-VN")} ₫
      Giảm giá tổng: -${receipt.discount.toLocaleString("vi-VN")} ₫
      Tổng tiền: ${receipt.total.toLocaleString("vi-VN")} ₫
    `;
    return formattedText.trim();
  };

  // Enhanced mobile printing handler
  const handleMobilePrinting = async (
    printContent: HTMLElement,
    isIOS: boolean,
    isAndroid: boolean,
    isSafari: boolean,
    isChrome: boolean,
  ) => {
    console.log(
      "📱 Using enhanced mobile printing for",
      isIOS ? "iOS" : isAndroid ? "Android" : "Mobile",
    );

    // Show user options for mobile printing with platform-specific messaging
    const platformMessage = isIOS
      ? "Máy in POS không khả dụng.\n\nChọn OK để tải file hóa đơn (Safari có thể mở trực tiếp).\nChọn Cancel để thử in trực tiếp từ trình duyệt."
      : isAndroid
        ? "Máy in POS không khả dụng.\n\nChọn OK để tải/chia sẻ file hóa đơn.\nChọn Cancel để thử in trực tiếp từ Chrome."
        : "Máy in POS không khả dụng.\n\nChọn OK để tải file hóa đơn.\nChọn Cancel để thử in trực tiếp.";

    const userChoice = confirm(platformMessage);

    if (userChoice) {
      // User chose to download/share file
      console.log("📱 User chose to download/share receipt file");
      await downloadReceiptFile(printContent, isIOS, isAndroid);
    } else {
      // User chose to try browser print dialog
      console.log("📱 User chose to try browser print dialog");
      await openBrowserPrintDialog(
        printContent,
        isIOS,
        isAndroid,
        isSafari,
        isChrome,
      );
    }
  };

  // Enhanced desktop printing handler
  const handleDesktopPrinting = async (printContent: HTMLElement) => {
    console.log("🖥️ Using enhanced desktop printing method");

    // Try direct browser print first
    try {
      const printWindow = window.open(
        "",
        "_blank",
        "width=800,height=600,scrollbars=yes,resizable=yes",
      );
      if (printWindow) {
        const printHTML = generatePrintHTML(printContent, false);
        printWindow.document.write(printHTML);
        printWindow.document.close();

        // Wait for content to load then print
        printWindow.onload = () => {
          setTimeout(() => {
            try {
              printWindow.print();
              printWindow.close();

              setTimeout(() => {
                console.log("🖨️ Desktop print completed, closing modal");
                onClose();

                if (typeof window !== "undefined") {
                  window.dispatchEvent(
                    new CustomEvent("printCompleted", {
                      detail: { closeAllModals: true, refreshData: true },
                    }),
                  );
                }
              }, 1000);
            } catch (printError) {
              console.log("⚠️ Direct print failed, offering download option");
              printWindow.close();
              // Fallback to download
              downloadReceiptFile(printContent, false, false);
            }
          }, 500);
        };

        // Handle print window errors
        printWindow.onerror = () => {
          console.log("⚠️ Print window error, offering download option");
          printWindow.close();
          downloadReceiptFile(printContent, false, false);
        };
      } else {
        // Popup blocked, offer download
        alert("Popup bị chặn. Sẽ tải file hóa đơn để bạn có thể in.");
        downloadReceiptFile(printContent, false, false);
      }
    } catch (error) {
      console.error("Desktop printing error:", error);
      downloadReceiptFile(printContent, false, false);
    }
  };

  // Generate optimized print HTML
  const generatePrintHTML = (printContent: HTMLElement, isMobile: boolean) => {
    const isIOS = /iphone|ipad|ipod/.test(navigator.userAgent.toLowerCase());
    const isAndroid = /android/.test(navigator.userAgent.toLowerCase());

    // Get clean HTML content and ensure consistent formatting
    let cleanContent = printContent.innerHTML;

    // Ensure all numbers are properly formatted for printing
    cleanContent = cleanContent.replace(
      /(\d{1,3}(?:\.\d{3})*) ₫/g,
      (match, number) => {
        return `${number} ₫`;
      },
    );

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Hóa đơn - ${receipt?.transactionId || "HĐ"}</title>
        <style>
          body {
            font-family: 'Courier New', monospace;
            font-weight: bold;
            font-size: 14px;
            line-height: 1.3;
            margin: ${isMobile ? "10px" : "15px"};
            padding: 0;
            background: white;
            color: black;
            width: ${isMobile ? "350px" : "280px"};
          }
          .text-center { text-align: center; }
          .text-right { text-align: right; }
          .text-left { text-align: left; }
          .font-bold { font-weight: bold; }
          .text-blue-600 { color: #2563eb; }
          .text-green-800 { color: #166534; }
          .text-red-600 { color: #dc2626; }
          .text-gray-600 { color: #4b5563; }
          .border-t { border-top: 1px solid #000; margin: 8px 0; padding-top: 8px; }
          .border-b { border-bottom: 1px solid #000; margin: 8px 0; padding-bottom: 8px; }
          .border-gray-300 { border-color: #d1d5db; }
          .flex { display: flex; justify-content: space-between; align-items: center; }
          .flex-1 { flex: 1; }
          .justify-between { justify-content: space-between; }
          .items-center { align-items: center; }
          .space-y-1 > * + * { margin-top: 2px; }
          .space-y-2 > * + * { margin-top: 4px; }
          .mb-1 { margin-bottom: 2px; }
          .mb-2 { margin-bottom: 4px; }
          .mb-3 { margin-bottom: 6px; }
          .mb-4 { margin-bottom: 8px; }
          .py-1 { padding: 2px 0; }
          .py-2 { padding: 4px 0; }
          .py-3 { padding: 6px 0; }
          .pt-3 { padding-top: 6px; }
          img { max-width: 80px; height: auto; display: block; margin: 0 auto; }
          .receipt-container { max-width: 100%; margin: 0 auto; }
          ${
            isMobile
              ? `
          .print-instructions {
            margin-top: 20px;
            padding: 15px;
            background: #f0f0f0;
            border-radius: 8px;
            font-size: 14px;
            font-weight: bold;
          }`
              : ""
          }
          @media print {
            body { 
              margin: 0; 
              padding: 10px;
              font-size: 14px;
              font-weight: bold;
              width: 280px;
            }
            .receipt-container { max-width: 100%; }
            .print-instructions { display: none; }
            .text-blue-600 { color: #000 !important; }
            .text-green-800 { color: #000 !important; }
            .text-red-600 { color: #000 !important; }
            .text-gray-600 { color: #666 !important; }
          }
          /* iOS Safari specific optimizations */
          @supports (-webkit-touch-callout: none) {
            body { -webkit-print-color-adjust: exact; }
          }
          /* Android Chrome specific optimizations */
          @media (max-device-width: 480px) {
            .receipt-container { max-width: 100%; padding: 0 5px; }
          }
        </style>
      </head>
      <body>
        <div class="receipt-container">
          ${cleanContent}
          ${
            isMobile
              ? `
          <div class="print-instructions">
            <div class="font-bold text-center">Hướng dẫn in:</div>
            <div>• Nhấn nút Menu hoặc Share trên trình duyệt</div>
            <div>• Chọn "Print" hoặc "In"</div>
            <div>• Hoặc chia sẻ với ứng dụng in khác</div>
            ${isIOS ? "<div>• Trên iOS: Chọn Share → Print</div>" : ""}
            ${isAndroid ? "<div>• Trên Android: Menu → Print hoặc Share</div>" : ""}
          </div>`
              : ""
          }
        </div>
        <script>
          // Auto-open print dialog after short delay (more reliable timing)
          setTimeout(() => {
            try {
              window.print();
            } catch (e) {
              console.log("Auto-print failed, user needs to print manually");
            }
          }, ${isMobile ? "1500" : "800"});
        </script>
      </body>
      </html>
    `;
  };

  // Enhanced download receipt file function - generates PDF
  const downloadReceiptFile = async (
    printContent: HTMLElement,
    isIOS: boolean,
    isAndroid: boolean,
  ) => {
    try {
      console.log("📄 Generating PDF for receipt download");

      // Create a new window for PDF generation
      const printWindow = window.open("", "_blank", "width=400,height=600");
      if (!printWindow) {
        throw new Error("Popup blocked - cannot generate PDF");
      }

      const cleanReceiptHTML = generatePrintHTML(printContent, true);
      printWindow.document.write(cleanReceiptHTML);
      printWindow.document.close();

      // Wait for content to load then trigger print to PDF
      await new Promise((resolve) => {
        printWindow.onload = () => {
          setTimeout(() => {
            try {
              // Trigger print dialog which allows saving as PDF
              printWindow.print();

              // Instructions for saving as PDF
              const pdfInstructions = isIOS
                ? "✅ Hộp thoại in đã mở!\n\nĐể lưu thành PDF:\n1. Trong hộp thoại in, chọn destination\n2. Chọn 'Save as PDF' hoặc 'Lưu thành PDF'\n3. Nhấn Save để tải file PDF"
                : isAndroid
                  ? "✅ Hộp thoại in đã mở!\n\nĐể lưu thành PDF:\n1. Trong hộp thoại in, chọn máy in\n2. Chọn 'Save as PDF' hoặc 'Lưu thành PDF'\n3. Nhấn Print để tải file PDF"
                  : "✅ Hộp thoại in đã mở!\n\nĐể lưu thành PDF:\n1. Trong hộp thoại in, chọn destination/máy in\n2. Chọn 'Save as PDF' hoặc 'Microsoft Print to PDF'\n3. Nhấn Save/Print để tải file PDF";

              alert(pdfInstructions);

              // Auto close after delay
              setTimeout(() => {
                if (!printWindow.closed) {
                  printWindow.close();
                }
                onClose();
              }, 3000);

              resolve(true);
            } catch (printError) {
              console.error("PDF generation error:", printError);
              printWindow.close();
              throw printError;
            }
          }, 1000);
        };
      });
    } catch (error) {
      console.error("❌ PDF generation failed:", error);

      // Fallback to HTML download if PDF generation fails
      console.log("🔄 Falling back to HTML download");
      const cleanReceiptHTML = generatePrintHTML(printContent, true);
      const blob = new Blob([cleanReceiptHTML], {
        type: "text/html;charset=utf-8",
      });
      const fileName = `hoa-don-${receipt?.transactionId || Date.now()}.html`;

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setTimeout(() => {
        const fallbackInstructions =
          "⚠️ Không thể tạo PDF, đã tải file HTML thay thế.\n\nĐể chuyển thành PDF:\n1. Mở file HTML vừa tải\n2. Nhấn Ctrl+P (hoặc Cmd+P trên Mac)\n3. Chọn 'Save as PDF' trong hộp thoại in\n4. Nhấn Save để lưu file PDF";
        alert(fallbackInstructions);
        onClose();
      }, 500);
    }
  };

  // Enhanced browser print dialog function
  const openBrowserPrintDialog = async (
    printContent: HTMLElement,
    isIOS: boolean,
    isAndroid: boolean,
    isSafari: boolean,
    isChrome: boolean,
  ) => {
    const windowFeatures = isAndroid
      ? "width=400,height=600,scrollbars=yes,resizable=yes"
      : isIOS
        ? "width=375,height=667,scrollbars=yes,resizable=yes"
        : "width=400,height=600,scrollbars=yes";

    const printWindow = window.open("", "_blank", windowFeatures);

    if (printWindow) {
      const printHTML = generatePrintHTML(printContent, true);
      printWindow.document.write(printHTML);
      printWindow.document.close();

      // Platform-specific print handling
      const printDelay = isIOS ? 2000 : isAndroid ? 1500 : 1000;

      setTimeout(() => {
        try {
          printWindow.print();

          // Auto close handling
          setTimeout(() => {
            if (!printWindow.closed) {
              printWindow.close();
            }
            onClose();
          }, printDelay);
        } catch (e) {
          const browserTip = isSafari
            ? "Vui lòng sử dụng menu Safari → Share → Print"
            : isChrome
              ? "Vui lòng sử dụng menu Chrome (⋮) → Print"
              : "Vui lòng sử dụng menu trình duyệt để in";

          alert(browserTip);
          setTimeout(() => {
            if (!printWindow.closed) {
              printWindow.close();
            }
            onClose();
          }, 500);
        }
      }, printDelay);
    } else {
      alert(
        "Không thể mở cửa sổ in. Popup có thể bị chặn.\nSẽ tải file để bạn có thể in.",
      );
      downloadReceiptFile(printContent, isIOS, isAndroid);
    }
  };

  const handleDesktopPrint = (printContent: HTMLElement) => {
    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Receipt</title>
            <style>
              body {
                font-family: tahoma;
                font-size: 14px;
                font-weight: bold;
                margin: 0;
                padding: 15px;
                background: white;
                color: black;
                width: 280px;
              }
              .receipt-container {
                width: 100%;
                margin: 0 auto;
              }
              .text-center { text-align: center; }
              .text-right { text-align: right; }
              .text-left { text-align: left; }
              .font-bold { font-weight: bold; }
              .text-blue-600 { color: #2563eb; }
              .text-green-800 { color: #166534; }
              .text-red-600 { color: #dc2626; }
              .text-gray-600 { color: #4b5563; }
              .border-t { border-top: 1px solid #000; margin: 8px 0; padding-top: 8px; }
              .border-b { border-bottom: 1px solid #000; margin: 8px 0; padding-bottom: 8px; }
              .border-gray-300 { border-color: #d1d5db; }
              .flex { display: flex; justify-content: space-between; align-items: center; }
              .flex-1 { flex: 1; }
              .justify-between { justify-content: space-between; }
              .items-center { align-items: center; }
              .space-y-1 > * + * { margin-top: 2px; }
              .space-y-2 > * + * { margin-top: 4px; }
              .mb-1 { margin-bottom: 2px; }
              .mb-2 { margin-bottom: 4px; }
              .mb-3 { margin-bottom: 6px; }
              .mb-4 { margin-bottom: 8px; }
              .py-1 { padding: 2px 0; }
              .py-2 { padding: 4px 0; }
              .py-3 { padding: 6px 0; }
              .pt-3 { padding-top: 6px; }
              img { max-width: 80px; height: auto; display: block; margin: 0 auto; }
              @media print {
                body { 
                  margin: 0; 
                  padding: 10px;
                  font-size: 14px;
                  font-weight: bold;
                  width: 280px;
                }
                .receipt-container { width: 100%; }
                .text-blue-600 { color: #000 !important; }
                .text-green-800 { color: #000 !important; }
                .text-red-600 { color: #000 !important; }
                .text-gray-600 { color: #666 !important; }
              }
            </style>
          </head>
          <body>
            ${printContent.innerHTML}
          </body>
        </html>
      `);
      printWindow.document.close();

      // Wait for images to load then print
      printWindow.onload = () => {
        setTimeout(() => {
          printWindow.print();

          // Auto close after print and refresh data
          setTimeout(() => {
            console.log(
              "🖨️ Receipt Modal: Auto-closing after print and refreshing data",
            );

            onClose();

            if (typeof window !== "undefined") {
              window.dispatchEvent(
                new CustomEvent("printCompleted", {
                  detail: { closeAllModals: true, refreshData: true },
                }),
              );
              window.dispatchEvent(
                new CustomEvent("refreshOrders", {
                  detail: { immediate: true },
                }),
              );
              window.dispatchEvent(
                new CustomEvent("refreshTables", {
                  detail: { immediate: true },
                }),
              );
            }
          }, 1000);
        }, 500);
      };

      // Close modal immediately after opening print window
      setTimeout(() => {
        console.log("🖨️ Closing receipt modal immediately after print");
        onClose();
      }, 50);
    }
  };

  const handleEmail = () => {
    // Mock email functionality
    alert("Email functionality would be implemented here");
  };

  const handleConfirmAndSelectPayment = () => {
    console.log(
      "📄 Receipt Modal: Confirming receipt and proceeding to payment method selection",
    );
    
    // Prepare complete order data with exact values
    const orderDataForPayment = {
      ...receipt,
      items: receipt?.items || cartItems.map((item: any) => ({
        id: item.id,
        productId: item.productId || item.id,
        productName: item.productName || item.name,
        sku: item.sku || `FOOD${String(item.productId || item.id).padStart(5, "0")}`,
        quantity: item.quantity,
        price: parseFloat(item.price || item.unitPrice || "0"),
        unitPrice: parseFloat(item.unitPrice || item.price || "0"),
        discount: parseFloat(item.discount || "0"),
        taxRate: parseFloat(item.taxRate || "0"),
        total: (parseFloat(item.price || item.unitPrice || "0") * item.quantity) - parseFloat(item.discount || "0")
      })),
      exactSubtotal: receipt?.exactSubtotal || parseFloat(receipt?.subtotal || "0"),
      exactTax: receipt?.exactTax || parseFloat(receipt?.tax || "0"),
      exactDiscount: receipt?.exactDiscount || parseFloat(receipt?.discount || "0"),
      exactTotal: receipt?.exactTotal || parseFloat(receipt?.total || "0") || total,
    };

    console.log("🎯 Complete order data being passed:", orderDataForPayment);

    // Store in window for parent component to access
    if (typeof window !== "undefined") {
      (window as any).orderForPayment = orderDataForPayment;
    }

    // Close preview modal first
    onClose();

    // Call onConfirm with order data if provided
    if (onConfirm) {
      console.log("📄 Receipt Modal: Calling onConfirm callback with order data");
      onConfirm(orderDataForPayment);
    }
  };

  // Placeholder for handlePaymentMethodSelect, assuming it's defined elsewhere or in a parent component
  const handlePaymentMethodSelect = (method: string) => {
    console.log("Selected payment method:", method);
    // Logic to handle payment method selection, potentially opening e-invoice modal
  };

  // If receipt is null but isPreview is true, we still render the modal structure but without receipt data
  // This case is handled by the check below, which will render a message if receipt is null.
  // We only return null if !isOpen
  if (!isOpen) {
    return null;
  }

  const handleClose = () => {
    console.log(
      "🔴 Receipt Modal: handleClose called - mode:",
      isPreview ? "PREVIEW" : "FINAL",
    );

    if (!isPreview) {
      window.dispatchEvent(
        new CustomEvent("printCompleted", {
          detail: { closeAllModals: true, refreshData: !isPreview },
        }),
      );
    }

    // Call onClose callback
    onClose();
  };

  // Use stored values directly from receipt data
  const calculateSubtotal = () => {
    return Math.floor(parseFloat(receipt?.subtotal || "0"));
  };

  const calculateTax = () => {
    return Math.floor(parseFloat(receipt?.tax || "0"));
  };

  const calculateTotal = () => {
    return Math.floor(parseFloat(receipt?.total || "0"));
  };

  // Always render the Dialog component, let it handle the open state
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md w-full max-h-screen overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isPreview ? t("pos.receiptPreview") : t("pos.receipt")}
          </DialogTitle>
        </DialogHeader>

        {hasValidData ? (
          <div
            id="receipt-content"
            className="receipt-print bg-white"
            style={{ padding: "16px", fontSize: "16px", fontWeight: "bold" }}
          >
            <div className="text-center mb-4">
              <p className="text-xs font-semibold mb-1">
                {storeSettings?.storeName ||
                  "Easy Digital Point Of Sale Service"}
              </p>
              <p className="text-xs mb-0.5">{t("pos.mainStoreLocation")}</p>
              <p className="text-xs mb-0.5">
                {storeSettings?.address || "123 Commerce St, City, State 12345"}
              </p>
              <p className="text-xs mb-2">
                {t("pos.phone")} {storeSettings?.phone || "(555) 123-4567"}
              </p>
              <div className="flex items-center justify-center">
                <img src={logoPath} alt="EDPOS Logo" className="h-6" />
              </div>
              <p className="text-lg mb-2 invoice_title">{title}</p>
            </div>

            <div className="border-t border-b border-gray-300 py-3 mb-3">
              <div className="flex justify-between text-sm">
                <span>{t("pos.transactionNumber")}</span>
                <span>{receipt.transactionId}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>{t("pos.date")}</span>
                <span>{new Date().toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>{t("pos.cashier")}</span>
                <span>{receipt.cashierName}</span>
              </div>
              {receipt?.customerName && (
                <div className="flex justify-between text-sm">
                  <span>{t("einvoice.customer")}:</span>
                  <span>{receipt.customerName}</span>
                </div>
              )}
              {receipt?.customerTaxCode && (
                <div className="flex justify-between text-sm">
                  <span>{t("einvoice.taxCode")}</span>
                  <span>{receipt.customerTaxCode}</span>
                </div>
              )}
              {receipt.paymentMethod === "einvoice" && (
                <div className="flex justify-between text-sm text-blue-600">
                  <span>{t("einvoice.invoicestatus")}:</span>
                  <span>
                    {receipt.invoiceNumber
                      ? `${t("einvoice.released")}`
                      : `${t("einvoice.notReleased")}`}
                  </span>
                </div>
              )}
            </div>

            <div className="space-y-2 mb-3">
              {(receipt.items || []).map((item, index) => {
                // Use exact values from database
                const unitPrice = parseFloat(
                  item.unitPrice || item.price || "0",
                );
                const quantity = item.quantity || 1;
                // Get item-level discount from order_items.discount - THIS IS THE DISCOUNT PER ITEM
                const itemDiscount = parseFloat(item.discount || "0");
                // Calculate subtotal before discount for this item
                const itemSubtotal = unitPrice * quantity;
                // Calculate final amount after discount
                const itemFinalAmount = itemSubtotal - itemDiscount;

                console.log(`Receipt Item ${index + 1}:`, {
                  name: item.productName || item.name,
                  unitPrice,
                  quantity,
                  itemDiscount,
                  itemSubtotal,
                  itemFinalAmount,
                  hasDiscount: itemDiscount > 0,
                  rawDiscount: item.discount,
                });

                return (
                  <div key={item.id || Math.random()}>
                    <div className="flex justify-between text-sm">
                      <div className="flex-1">
                        <div className="font-medium">
                          {item.productName || item.name || "Unknown Product"}
                        </div>
                        <div className="text-xs text-gray-600">
                          SKU:{" "}
                          {item.productSku ||
                            `FOOD${String(item.productId || item.id || "0").padStart(5, "0")}`}
                        </div>
                        <div className="text-xs text-gray-600">
                          {quantity} x{" "}
                          {Math.floor(unitPrice).toLocaleString("vi-VN")} ₫
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-gray-600">
                          {Math.floor(itemSubtotal).toLocaleString("vi-VN")} ₫
                        </div>
                      </div>
                    </div>
                    {/* Show discount as a separate line below item for better visibility */}
                    {itemDiscount > 0 && (
                      <div className="flex justify-between text-xs mt-1 pl-4">
                        <div className="text-red-600 font-medium">
                          Giảm giá:
                        </div>
                        <div className="text-red-600 font-medium">
                          -{Math.floor(itemDiscount).toLocaleString("vi-VN")} ₫
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="border-t border-gray-300 pt-3 space-y-1">
              <div className="flex justify-between text-sm">
                <span>{t("pos.totalAmount")}</span>
                <span>
                  {(() => {
                    // Calculate subtotal as sum of unit price * quantity for all items (before discount)
                    const itemsSubtotal = (receipt.items || []).reduce(
                      (sum, item) => {
                        const unitPrice = parseFloat(
                          item.unitPrice || item.price || "0",
                        );
                        const quantity = item.quantity || 1;
                        return sum + unitPrice * quantity;
                      },
                      0,
                    );
                    return Math.floor(itemsSubtotal).toLocaleString("vi-VN");
                  })()}{" "}
                  ₫
                </span>
              </div>
              {(() => {
                // Group items by tax rate and calculate tax for each group
                const taxGroups = (receipt.items || []).reduce(
                  (groups, item) => {
                    const taxRate = parseFloat(
                      item.taxRate || item.product?.taxRate || "0",
                    );
                    const unitPrice = parseFloat(
                      item.unitPrice || item.price || "0",
                    );
                    const quantity = item.quantity || 1;
                    const itemDiscount = parseFloat(item.discount || "0");
                    const itemSubtotal = unitPrice * quantity;
                    // Calculate tax for this item based on its tax rate
                    const itemTax =
                      (itemSubtotal - itemDiscount) *
                      (taxRate / (100 + taxRate));

                    if (!groups[taxRate]) {
                      groups[taxRate] = 0;
                    }
                    groups[taxRate] += itemTax;

                    return groups;
                  },
                  {} as Record<number, number>,
                );

                // Sort tax rates in descending order
                const sortedTaxRates = Object.keys(taxGroups)
                  .map(Number)
                  .sort((a, b) => b - a);

                return sortedTaxRates.map((taxRate) => (
                  <div key={taxRate} className="flex justify-between text-sm">
                    <span>
                      {t("reports.tax")} ({taxRate}%):
                    </span>
                    <span>
                      {Math.floor(taxGroups[taxRate]).toLocaleString("vi-VN")} ₫
                    </span>
                  </div>
                ));
              })()}
              {(() => {
                // Only show discount if there are item-level discounts or order-level discount
                // Calculate total discount: sum of item discounts + order discount
                const totalItemDiscount = (receipt.items || []).reduce(
                  (sum, item) => {
                    return sum + parseFloat(item.discount || "0");
                  },
                  0,
                );
                const orderDiscount = parseFloat(receipt.discount || "0");
                // Discount is already distributed to items, so only show order-level discount if it exists separately
                const totalDiscount =
                  orderDiscount > 0 ? orderDiscount : totalItemDiscount;
                return totalDiscount > 0;
              })() && (
                <div className="flex justify-between text-sm text-red-600">
                  <span>{t("reports.discount")}:</span>
                  <span className="font-medium">
                    -
                    {(() => {
                      // Show total discount (items + order level)
                      const totalItemDiscount = (receipt.items || []).reduce(
                        (sum, item) => {
                          return sum + parseFloat(item.discount || "0");
                        },
                        0,
                      );
                      const orderDiscount = parseFloat(receipt.discount || "0");
                      // Only add order discount if it's not already distributed to items
                      const totalDiscount =
                        orderDiscount > 0 ? orderDiscount : totalItemDiscount;
                      return Math.floor(totalDiscount).toLocaleString("vi-VN");
                    })()}{" "}
                    ₫
                  </span>
                </div>
              )}
              <div className="flex justify-between font-bold">
                <span>{t("reports.totalMoney")}:</span>
                <span>
                  {(() => {
                    // Always use total directly from database
                    const totalValue = parseFloat(receipt.total || "0");
                    return Math.floor(totalValue).toLocaleString("vi-VN");
                  })()}{" "}
                  ₫
                </span>
              </div>
            </div>
          </div>
        ) : isPreview && hasCartData && total > 0 ? (
          // Generate preview receipt from cartItems when in preview mode
          <div
            id="receipt-content"
            className="receipt-print bg-white"
            style={{ padding: "16px", fontSize: "16px", fontWeight: "bold" }}
          >
            <div className="text-center mb-4">
              <p className="text-xs font-semibold mb-1">
                {storeSettings?.storeName ||
                  "Easy Digital Point Of Sale Service"}
              </p>
              <p className="text-xs mb-0.5">{t("pos.mainStoreLocation")}</p>
              <p className="text-xs mb-0.5">
                {storeSettings?.address || "123 Commerce St, City, State 12345"}
              </p>
              <p className="text-xs mb-2">
                {t("pos.phone")} {storeSettings?.phone || "(555) 123-4567"}
              </p>
              <div className="flex items-center justify-center">
                <img src={logoPath} alt="EDPOS Logo" className="h-6" />
              </div>
              <p className="text-lg mb-2 invoice_title">{title}</p>
            </div>

            <div className="border-t border-b border-gray-300 py-3 mb-3">
              <div className="flex justify-between text-sm">
                <span>{t("pos.transactionNumber")}</span>
                <span>PREVIEW-{Date.now()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>{t("pos.date")}</span>
                <span>{new Date().toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>{t("pos.cashier")}</span>
                <span>Nhân viên</span>
              </div>
            </div>

            <div className="space-y-2 mb-3">
              {cartItems.map((item, index) => {
                const unitPrice =
                  typeof item.price === "string"
                    ? parseFloat(item.price)
                    : item.price;
                const quantity = item.quantity;
                const itemSubtotal = unitPrice * quantity;

                // Calculate item discount from order-level discount (proportional distribution)
                let itemDiscount = 0;
                const orderDiscount = parseFloat(
                  receipt?.discount || total?.discount || "0",
                );

                if (orderDiscount > 0) {
                  const totalBeforeDiscount = cartItems.reduce((sum, itm) => {
                    const price =
                      typeof itm.price === "string"
                        ? parseFloat(itm.price)
                        : itm.price;
                    return sum + price * itm.quantity;
                  }, 0);

                  // For last item, use remaining discount to avoid rounding errors
                  if (index === cartItems.length - 1) {
                    let previousDiscounts = 0;
                    for (let i = 0; i < cartItems.length - 1; i++) {
                      const prevItem = cartItems[i];
                      const prevPrice =
                        typeof prevItem.price === "string"
                          ? parseFloat(prevItem.price)
                          : prevItem.price;
                      const prevSubtotal = prevPrice * prevItem.quantity;
                      previousDiscounts +=
                        totalBeforeDiscount > 0
                          ? Math.round(
                              (orderDiscount * prevSubtotal) /
                                totalBeforeDiscount,
                            )
                          : 0;
                    }
                    itemDiscount = orderDiscount - previousDiscounts;
                  } else {
                    // Proportional discount for non-last items
                    itemDiscount =
                      totalBeforeDiscount > 0
                        ? Math.round(
                            (orderDiscount * itemSubtotal) /
                              totalBeforeDiscount,
                          )
                        : 0;
                  }
                }

                const itemFinalAmount = itemSubtotal - itemDiscount;

                console.log(`Preview Item ${index}:`, {
                  name: item.name,
                  unitPrice,
                  quantity,
                  itemDiscount,
                  itemSubtotal,
                  itemFinalAmount,
                  hasDiscount: itemDiscount > 0,
                });

                return (
                  <div key={item.id}>
                    <div className="flex justify-between text-sm">
                      <div className="flex-1">
                        <div className="font-medium">{item.name}</div>
                        <div className="text-xs text-gray-600">
                          SKU:{" "}
                          {item.sku ||
                            `FOOD${String(item.id).padStart(5, "0")}`}
                        </div>
                        <div className="text-xs text-gray-600">
                          {quantity} x {unitPrice.toLocaleString("vi-VN")} ₫
                        </div>
                        {itemDiscount > 0 && (
                          <div className="text-xs text-red-600 font-medium">
                            Giảm giá: -
                            {Math.round(itemDiscount).toLocaleString("vi-VN")} ₫
                          </div>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-gray-600">
                          {Math.floor(itemSubtotal).toLocaleString("vi-VN")} ₫
                        </div>
                        {itemDiscount > 0 && (
                          <div className="text-xs font-medium text-green-600">
                            {Math.floor(itemFinalAmount).toLocaleString(
                              "vi-VN",
                            )}{" "}
                            ₫
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="border-t border-gray-300 pt-3 space-y-1">
              <div className="flex justify-between text-sm">
                <span>{t("pos.totalAmount")}</span>
                <span>
                  {(() => {
                    // Calculate subtotal as sum of unit price * quantity for all items (before discount)
                    const itemsSubtotal = (receipt.items || []).reduce(
                      (sum, item) => {
                        const unitPrice = parseFloat(
                          item.unitPrice || item.price || "0",
                        );
                        const quantity = item.quantity || 1;
                        return sum + unitPrice * quantity;
                      },
                      0,
                    );
                    return Math.floor(itemsSubtotal).toLocaleString("vi-VN");
                  })()}{" "}
                  ₫
                </span>
              </div>
              {(() => {
                // Group cart items by tax rate and calculate tax for each group
                const taxGroups = cartItems.reduce(
                  (groups, item) => {
                    const taxRate = parseFloat(
                      item.taxRate || item.product?.taxRate || "0",
                    );
                    const unitPrice =
                      typeof item.price === "string"
                        ? parseFloat(item.price)
                        : item.price;
                    const quantity = item.quantity;
                    const itemSubtotal = unitPrice * quantity;

                    // Calculate item discount from order-level discount (proportional distribution)
                    let itemDiscount = 0;
                    const orderDiscount = parseFloat(
                      receipt?.discount || total?.discount || "0",
                    );

                    if (orderDiscount > 0) {
                      const totalBeforeDiscount = cartItems.reduce(
                        (sum, itm) => {
                          const price =
                            typeof itm.price === "string"
                              ? parseFloat(itm.price)
                              : itm.price;
                          return sum + price * itm.quantity;
                        },
                        0,
                      );

                      const itemIndex = cartItems.indexOf(item);
                      if (itemIndex === cartItems.length - 1) {
                        let previousDiscounts = 0;
                        for (let i = 0; i < cartItems.length - 1; i++) {
                          const prevItem = cartItems[i];
                          const prevPrice =
                            typeof prevItem.price === "string"
                              ? parseFloat(prevItem.price)
                              : prevItem.price;
                          const prevSubtotal = prevPrice * prevItem.quantity;
                          previousDiscounts +=
                            totalBeforeDiscount > 0
                              ? Math.round(
                                  (orderDiscount * prevSubtotal) /
                                    totalBeforeDiscount,
                                )
                              : 0;
                        }
                        itemDiscount = orderDiscount - previousDiscounts;
                      } else {
                        itemDiscount =
                          totalBeforeDiscount > 0
                            ? Math.round(
                                (orderDiscount * itemSubtotal) /
                                  totalBeforeDiscount,
                              )
                            : 0;
                      }
                    }

                    const itemFinalAmount = itemSubtotal - itemDiscount;

                    // Calculate tax for this item based on its tax rate
                    const itemTax =
                      (itemFinalAmount * taxRate) / (100 + taxRate);

                    if (!groups[taxRate]) {
                      groups[taxRate] = 0;
                    }
                    groups[taxRate] += itemTax;

                    return groups;
                  },
                  {} as Record<number, number>,
                );

                // Sort tax rates in descending order
                const sortedTaxRates = Object.keys(taxGroups)
                  .map(Number)
                  .sort((a, b) => b - a);

                return sortedTaxRates.map((taxRate) => (
                  <div key={taxRate} className="flex justify-between text-sm">
                    <span>
                      {t("reports.tax")} ({taxRate}%):
                    </span>
                    <span>
                      {Math.floor(taxGroups[taxRate]).toLocaleString("vi-VN")} ₫
                    </span>
                  </div>
                ));
              })()}
              {(() => {
                // Calculate total discount from cart items only (no double counting)
                const totalItemDiscount = cartItems.reduce((sum, item) => {
                  return sum + parseFloat(item.discount || "0");
                }, 0);
                // Don't add order discount if item discounts exist (to avoid double counting)
                const orderDiscount = parseFloat(
                  receipt?.discount || total?.discount || "0",
                );
                const totalDiscount =
                  orderDiscount > 0 ? orderDiscount : totalItemDiscount;
                return totalDiscount > 0;
              })() && (
                <div className="flex justify-between text-sm text-red-600">
                  <span>{t("reports.discount")}:</span>
                  <span className="font-medium">
                    -
                    {(() => {
                      const totalItemDiscount = cartItems.reduce(
                        (sum, item) => {
                          return sum + parseFloat(item.discount || "0");
                        },
                        0,
                      );
                      const orderDiscount = parseFloat(
                        receipt?.discount || total?.discount || "0",
                      );
                      // Show either item discounts or order discount, not both
                      const totalDiscount =
                        orderDiscount > 0 ? orderDiscount : totalItemDiscount;
                      return Math.floor(totalDiscount).toLocaleString("vi-VN");
                    })()}{" "}
                    ₫
                  </span>
                </div>
              )}
              <div className="flex justify-between font-bold">
                <span>{t("reports.totalMoney")}:</span>
                <span>
                  {Number(
                    receipt?.total || total?.total || total || 0,
                  ).toLocaleString("vi-VN")}{" "}
                  ₫
                </span>
              </div>
            </div>
          </div>
        ) : (
          // Fallback content - should not reach here due to validation above
          <div className="p-4 text-center">
            <p>Đang tải dữ liệu hóa đơn...</p>
            <Button onClick={onClose} className="mt-4">
              {t("reports.close")}
            </Button>
          </div>
        )}

        <div className="flex justify-center p-2 border-t">
          {isPreview ? (
            <div className="flex space-x-3 w-full">
              <Button
                onClick={handleClose}
                variant="outline"
                className="flex-1"
              >
                {t("pos.cancel")}
              </Button>
              <Button
                onClick={handleConfirmAndSelectPayment}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white transition-colors duration-200"
              >
                {t("pos.confirmAndSelectPayment")}
              </Button>
            </div>
          ) : (
            <div className="flex justify-center space-x-3">
              <Button
                onClick={() => {
                  if (printers?.length > 0) {
                    handleGetPrint();
                  } else {
                    handlePrint(); // First print
                  }
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white transition-colors duration-200"
              >
                <Printer className="mr-2" size={16} />
                {t("pos.printReceipt")}
              </Button>
              <Button onClick={handleClose} variant="outline" className="ml-2">
                {t("common.close")}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>

      {/* Payment Method Modal */}
      {showPaymentMethodModal && (
        <PaymentMethodModal
          isOpen={showPaymentMethodModal}
          onClose={() => setShowPaymentMethodModal(false)}
          onSelectMethod={handlePaymentMethodSelect}
          total={
            receipt?.exactTotal ||
            parseFloat(receipt?.total || "0") ||
            total ||
            0
          }
          cartItems={receipt?.items || cartItems}
          orderForPayment={receipt}
          receipt={receipt}
          onReceiptReady={(receiptData) => {
            console.log("📋 Receipt ready from payment method:", receiptData);
          }}
        />
      )}
    </Dialog>
  );
}
