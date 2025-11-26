import { apiRequest } from "./queryClient";
interface KitchenPrintItem {
  productId: number;
  productName: string;
  quantity: number;
  unitName?: string;
  notes?: string;
  changeType?: "new" | "increase" | "decrease";
  changeAmount?: number;
}

interface KitchenPrintData {
  orderNumber: string;
  tableNumber: string;
  customerCount: number;
  employeeName: string;
  items: KitchenPrintItem[];
  floor: string;
  createdAt: Date;
}

/**
 * Generate kitchen receipt content in plain text format
 */
function generateKitchenReceiptContent(data: KitchenPrintData): string {
  const date = new Date(data.createdAt);
  const formattedDate = date.toLocaleDateString("vi-VN");
  const formattedTime = date.toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  let content = `
                CHẾ BIẾN

Order: ${data.orderNumber}    Ngày: ${formattedDate} (${formattedTime})

Bàn: ${data.tableNumber}     SL khách: ${data.customerCount}

Phục vụ: ${data.employeeName}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Món                    ĐVT     SL    ghi chú
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;

  data.items.forEach((item) => {
    const unitName = item.unitName || "Đĩa";
    let notesText = "";

    if (item.changeType) {
      if (item.changeType === "new") {
        notesText = "Mới";
      } else if (item.changeType === "increase") {
        notesText = `Thêm ${item.changeAmount}`;
      } else if (item.changeType === "decrease") {
        notesText = `Bớt ${item.changeAmount}`;
      }
    }

    if (item.notes && item.notes.trim()) {
      notesText = notesText ? `${notesText}, ${item.notes}` : item.notes;
    }

    const productLine = `${item.productName.padEnd(22)} ${unitName.padEnd(8)} ${String(item.quantity).padStart(3)}`;
    content += productLine;

    if (notesText) {
      content += `  ${notesText}`;
    }

    content += "\n";
  });

  content += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

  return content;
}

/**
 * Print kitchen receipt for new or changed items
 */
export async function printKitchenReceipt(
  orderNumber: string,
  tableNumber: string,
  tableFloor: string,
  customerCount: number,
  employeeName: string,
  newItems: KitchenPrintItem[],
  changedItems: KitchenPrintItem[],
): Promise<void> {
  try {
    // Combine new and changed items
    const allItems = [
      ...newItems.map((item) => ({ ...item, changeType: "new" as const })),
      ...changedItems,
    ];

    if (allItems.length === 0) {
      console.log("📝 No items to print for kitchen");
      return;
    }
    const printerResponse = await fetch("https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/printer-configs");
    if (!printerResponse.ok) {
      console.error("Failed to fetch printer configs");
      return;
    }

    const allConfigs = await printerResponse.json();

      // Group items by product floor to match with kitchen printers
      const itemsByFloor = new Map<string, KitchenPrintItem[]>();

      for (const item of allItems) {
        // Get product details to determine floor
        try {
          const response = await apiRequest(
            "GET",
            `https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/products/${item.productId}`,
          );
          const product = await response.json();
          const productFloor = product.floor;

          if (!itemsByFloor.has(productFloor)) {
            itemsByFloor.set(productFloor, []);
          }
          itemsByFloor.get(productFloor)!.push({
            ...item,
            unitName: product.unit || "Đĩa",
          });
        } catch (error) {
          console.error(`Error fetching product ${item.productId}:`, error);
          // Fallback to table floor if product fetch fails
          if (!itemsByFloor.has(tableFloor)) {
            itemsByFloor.set(tableFloor, []);
          }
          itemsByFloor.get(tableFloor)!.push(item);
        }
      }

      // Print for each floor
      for (const [floor, items] of itemsByFloor.entries()) {
        const printData: KitchenPrintData = {
          orderNumber,
          tableNumber,
          customerCount,
          employeeName,
          items,
          floor,
          createdAt: new Date(),
        };

        const receiptContent = generateKitchenReceiptContent(printData);

        console.log(`🖨️ Printing kitchen receipt for floor ${floor}:`, {
          orderNumber,
          tableNumber,
          itemCount: items.length,
          floor,
        });

        // Send to printer API
        try {

          let kitchenPrinters = allConfigs.filter(
            (config) => config.floor === floor || config.floor === "all",
          );

          if (kitchenPrinters.length > 0) {
            let lstPrinters = kitchenPrinters.map((printer) => {
              return {
                name: printer.name,
                type: printer.printerType,
                ip: printer.ipAddress,
                port: printer.port ?? 9100,
                copies: printer.copies ?? 1,
                serinumber: printer.macAddress,
              };
            });
          }
          const printResponse = await fetch("http://localhost:5000/print", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              lstPrinters,
              receiptContent,
            }),
          });
          // const printResponse = await apiRequest(
          //   "POST",
          //   "https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/pos/print-kitchen-receipt",
          //   {
          //     content: receiptContent,
          //     floor,
          //     orderNumber,
          //     tableNumber,
          //     timestamp: new Date().toISOString(),
          //   },
          // );

          if (printResponse.ok) {
            console.log(
              `✅ Kitchen receipt sent to printer for floor ${floor}`,
            );
          } else {
            console.error(
              `❌ Failed to send kitchen receipt to printer for floor ${floor}`,
            );
          }
        } catch (printError) {
          console.error(
            `❌ Error printing kitchen receipt for floor ${floor}:`,
            printError,
          );
        }
      }
    
  } catch (error) {
    console.error("❌ Error in printKitchenReceipt:", error);
    throw error;
  }
}

/**
 * Calculate changes between old and new order items
 */
export function calculateOrderChanges(
  oldItems: Array<{ productId: number; quantity: number; productName: string }>,
  newItems: Array<{
    productId: number;
    quantity: number;
    productName: string;
    notes?: string;
  }>,
): { newItems: KitchenPrintItem[]; changedItems: KitchenPrintItem[] } {
  const oldItemsMap = new Map(
    oldItems.map((item) => [item.productId, item.quantity]),
  );
  const newItemsList: KitchenPrintItem[] = [];
  const changedItemsList: KitchenPrintItem[] = [];

  newItems.forEach((item) => {
    const oldQuantity = oldItemsMap.get(item.productId);

    if (oldQuantity === undefined) {
      // New item
      newItemsList.push({
        productId: item.productId,
        productName: item.productName,
        quantity: item.quantity,
        notes: item.notes,
        changeType: "new",
      });
    } else if (oldQuantity !== item.quantity) {
      // Changed quantity
      const difference = item.quantity - oldQuantity;
      changedItemsList.push({
        productId: item.productId,
        productName: item.productName,
        quantity: item.quantity,
        notes: item.notes,
        changeType: difference > 0 ? "increase" : "decrease",
        changeAmount: Math.abs(difference),
      });
    }
  });

  return { newItems: newItemsList, changedItems: changedItemsList };
}
