
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "@/lib/i18n";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Calendar, DollarSign, TrendingDown, Building2, RefreshCw } from "lucide-react";
import { format } from "date-fns";

export function SpendingReport() {
  const { t } = useTranslation();
  const [startDate, setStartDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(new Date(), "yyyy-MM-dd"));

  // Fetch purchase receipts
  const { data: purchaseReceipts, isLoading: isLoadingReceipts, refetch } = useQuery({
    queryKey: ["https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/purchase-receipts", { startDate, endDate }],
    queryFn: async () => {
      const params = new URLSearchParams({
        startDate,
        endDate,
      });
      const response = await fetch(`https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/purchase-receipts?${params}`);
      if (!response.ok) throw new Error("Failed to fetch purchase receipts");
      const result = await response.json();
      return result.data || [];
    },
  });

  // Fetch categories
  const { data: categories = [] } = useQuery({
    queryKey: ["https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/categories"],
  });

  // Fetch products to get category information
  const { data: products = [] } = useQuery({
    queryKey: ["https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/products"],
  });

  // Fetch suppliers
  const { data: suppliers = [] } = useQuery({
    queryKey: ["https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/suppliers"],
  });

  // Fetch orders for revenue calculation
  const { data: orders = [] } = useQuery({
    queryKey: ["https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/orders/date-range", startDate, endDate],
    queryFn: async () => {
      const response = await fetch(`https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/orders/date-range/${startDate}/${endDate}/all`);
      if (!response.ok) throw new Error("Failed to fetch orders");
      return response.json();
    },
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(amount);
  };

  // Process data for reports
  const reportData = useMemo(() => {
    if (!purchaseReceipts || !categories || !products) {
      return {
        rawMaterials: [],
        managementExpenses: [],
        fixedExpenses: [],
        supplierDebts: [],
        totalRawMaterials: 0,
        totalManagementExpenses: 0,
        totalFixedExpenses: 0,
        totalSupplierDebt: 0,
        totalSpending: 0,
      };
    }

    // Access data from the response object
    const receiptsData = Array.isArray(purchaseReceipts) 
      ? purchaseReceipts 
      : (purchaseReceipts?.data || []);

    console.log("📊 Purchase Receipts for Spending Report:", receiptsData);
    console.log("📊 Total receipts:", receiptsData.length);

    const rawMaterialsMap = new Map();
    const managementExpensesMap = new Map();
    const fixedExpensesMap = new Map();
    const supplierDebtsMap = new Map();

    receiptsData.forEach((receipt: any) => {
      console.log("📦 Processing receipt:", {
        id: receipt.id,
        receiptNumber: receipt.receiptNumber,
        purchaseType: receipt.purchaseType,
        itemsCount: receipt.items?.length
      });
      const supplier = suppliers.find((s: any) => s.id === receipt.supplierId);
      const supplierName = supplier?.name || "Không xác định";

      // I. Nguyên vật liệu đã mua (raw_materials)
      // Only process receipts with purchaseType = "raw_materials"
      if (receipt.purchaseType === "raw_materials") {
        console.log(`📦 Processing raw materials receipt ${receipt.receiptNumber}:`, {
          receiptId: receipt.id,
          itemsCount: receipt.items?.length,
          purchaseType: receipt.purchaseType
        });

        (receipt.items || []).forEach((item: any) => {
          console.log(`📦 Processing item:`, {
            productId: item.productId,
            productName: item.productName,
            categoryId: item.categoryId,
            total: item.total
          });

          // Get category from product's categoryId
          let categoryName = "Chưa phân loại";
          
          if (item.productId) {
            // Find product to get its category
            const product = products.find((p: any) => p.id === item.productId);
            if (product && product.categoryId) {
              const category = categories.find((c: any) => c.id === product.categoryId);
              categoryName = category?.name || categoryName;
            }
          }

          console.log(`📦 Category for item ${item.productName}:`, categoryName);

          if (!rawMaterialsMap.has(categoryName)) {
            rawMaterialsMap.set(categoryName, {
              categoryName,
              totalValue: 0,
            });
          }

          const categoryData = rawMaterialsMap.get(categoryName);
          const itemTotal = parseFloat(item.total || "0");
          categoryData.totalValue += itemTotal;

          console.log(`📦 Updated category ${categoryName} total:`, categoryData.totalValue);
        });
      }

      // II & III. Chi phí (expenses)
      if (receipt.purchaseType === "expenses") {
        (receipt.items || []).forEach((item: any) => {
          const category = categories.find((c: any) => item.categoryId === c.id);
          const categoryName = category?.name || item.categoryName || "Chưa phân loại";

          // Check if it's management expenses or fixed expenses based on category
          const isManagementExpense = categoryName.toLowerCase().includes("quản lý") ||
            categoryName.toLowerCase().includes("management");
          const isFixedExpense = categoryName.toLowerCase().includes("cố định") ||
            categoryName.toLowerCase().includes("fixed");

          if (isManagementExpense) {
            // Management expenses - group by product
            const key = item.productName;
            if (!managementExpensesMap.has(key)) {
              managementExpensesMap.set(key, {
                itemName: item.productName,
                totalValue: 0,
              });
            }
            const expenseData = managementExpensesMap.get(key);
            expenseData.totalValue += parseFloat(item.total || "0");
          } else if (isFixedExpense) {
            // Fixed expenses - group by product
            const key = item.productName;
            if (!fixedExpensesMap.has(key)) {
              fixedExpensesMap.set(key, {
                itemName: item.productName,
                totalValue: 0,
              });
            }
            const expenseData = fixedExpensesMap.get(key);
            expenseData.totalValue += parseFloat(item.total || "0");
          }
        });
      }

      // IV. Công nợ nhà cung cấp (unpaid supplier debt)
      // Calculate based on payment status
      if (receipt.paymentStatus !== "paid") {
        const key = receipt.supplierId;
        if (!supplierDebtsMap.has(key)) {
          supplierDebtsMap.set(key, {
            supplierName,
            debtAmount: 0,
          });
        }
        const debtData = supplierDebtsMap.get(key);
        debtData.debtAmount += parseFloat(receipt.total || "0");
      }
    });

    const rawMaterials = Array.from(rawMaterialsMap.values());
    const managementExpenses = Array.from(managementExpensesMap.values());
    const fixedExpenses = Array.from(fixedExpensesMap.values());
    const supplierDebts = Array.from(supplierDebtsMap.values());

    const totalRawMaterials = rawMaterials.reduce((sum, item) => sum + item.totalValue, 0);
    const totalManagementExpenses = managementExpenses.reduce((sum, item) => sum + item.totalValue, 0);
    const totalFixedExpenses = fixedExpenses.reduce((sum, item) => sum + item.totalValue, 0);
    const totalSupplierDebt = supplierDebts.reduce((sum, item) => sum + item.debtAmount, 0);
    const totalSpending = totalRawMaterials + totalManagementExpenses + totalFixedExpenses;

    return {
      rawMaterials,
      managementExpenses,
      fixedExpenses,
      supplierDebts,
      totalRawMaterials,
      totalManagementExpenses,
      totalFixedExpenses,
      totalSupplierDebt,
      totalSpending,
    };
  }, [purchaseReceipts, categories, suppliers, products]);

  // Calculate total revenue from orders
  const totalRevenue = useMemo(() => {
    if (!orders || !Array.isArray(orders)) return 0;
    return orders
      .filter((order: any) => order.paymentStatus === "paid")
      .reduce((sum: number, order: any) => sum + parseFloat(order.total || "0"), 0);
  }, [orders]);

  const netProfit = totalRevenue - reportData.totalSpending;

  if (isLoadingReceipts) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-gray-400" />
          <p className="text-gray-500">{t("reports.loadingData")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Date Range Filter */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            {t("reports.dateRange")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>{t("reports.startDate")}</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div>
              <Label>{t("reports.endDate")}</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <div className="flex items-end">
              <Button onClick={() => refetch()} className="w-full">
                <RefreshCw className="w-4 h-4 mr-2" />
                {t("reports.refresh")}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">
              {t("reports.totalSpending")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {formatCurrency(reportData.totalSpending)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">
              {t("reports.totalRevenue")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(totalRevenue)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">
              {t("reports.netProfit")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${netProfit >= 0 ? "text-blue-600" : "text-red-600"}`}>
              {formatCurrency(netProfit)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">
              {t("reports.unpaidSupplierDebt")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {formatCurrency(reportData.totalSupplierDebt)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* I. Raw Materials Purchased */}
      <Card>
        <CardHeader className="bg-red-50">
          <CardTitle className="flex items-center gap-2 text-red-700">
            <TrendingDown className="w-5 h-5" />
            I. {t("reports.rawMaterialsPurchased")}
          </CardTitle>
          <CardDescription>
            {t("reports.totalValue")}: <span className="font-bold text-red-700">{formatCurrency(reportData.totalRawMaterials)}</span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>No</TableHead>
                <TableHead>{t("reports.categoryName")}</TableHead>
                <TableHead className="text-right">{t("reports.totalValue")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reportData.rawMaterials.length > 0 ? (
                reportData.rawMaterials.map((item, index) => (
                  <TableRow key={index}>
                    <TableCell>{index + 1}</TableCell>
                    <TableCell className="font-medium">{item.categoryName}</TableCell>
                    <TableCell className="text-right text-red-600 font-semibold">
                      {formatCurrency(item.totalValue)}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-gray-500">
                    {t("reports.noDataAvailable")}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* II. Management Expenses */}
      <Card>
        <CardHeader className="bg-red-50">
          <CardTitle className="flex items-center gap-2 text-red-700">
            <DollarSign className="w-5 h-5" />
            II. {t("reports.managementExpenses")}
          </CardTitle>
          <CardDescription>
            {t("reports.totalValue")}: <span className="font-bold text-red-700">{formatCurrency(reportData.totalManagementExpenses)}</span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>No</TableHead>
                <TableHead>{t("reports.itemName")}</TableHead>
                <TableHead className="text-right">{t("reports.totalValue")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reportData.managementExpenses.length > 0 ? (
                reportData.managementExpenses.map((item, index) => (
                  <TableRow key={index}>
                    <TableCell>{index + 1}</TableCell>
                    <TableCell className="font-medium">{item.itemName}</TableCell>
                    <TableCell className="text-right text-red-600 font-semibold">
                      {formatCurrency(item.totalValue)}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-gray-500">
                    {t("reports.noDataAvailable")}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* III. Fixed Expenses */}
      <Card>
        <CardHeader className="bg-red-50">
          <CardTitle className="flex items-center gap-2 text-red-700">
            <DollarSign className="w-5 h-5" />
            III. {t("reports.fixedExpenses")}
          </CardTitle>
          <CardDescription>
            {t("reports.totalValue")}: <span className="font-bold text-red-700">{formatCurrency(reportData.totalFixedExpenses)}</span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>No</TableHead>
                <TableHead>{t("reports.itemName")}</TableHead>
                <TableHead className="text-right">{t("reports.totalValue")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reportData.fixedExpenses.length > 0 ? (
                reportData.fixedExpenses.map((item, index) => (
                  <TableRow key={index}>
                    <TableCell>{index + 1}</TableCell>
                    <TableCell className="font-medium">{item.itemName}</TableCell>
                    <TableCell className="text-right text-red-600 font-semibold">
                      {formatCurrency(item.totalValue)}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-gray-500">
                    {t("reports.noDataAvailable")}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* IV. Supplier Debts */}
      <Card>
        <CardHeader className="bg-orange-50">
          <CardTitle className="flex items-center gap-2 text-orange-700">
            <Building2 className="w-5 h-5" />
            {t("reports.unpaidSupplierDebt")}
          </CardTitle>
          <CardDescription>
            {t("reports.totalValue")}: <span className="font-bold text-orange-700">{formatCurrency(reportData.totalSupplierDebt)}</span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>No</TableHead>
                <TableHead>{t("reports.supplierName")}</TableHead>
                <TableHead className="text-right">{t("reports.debtAmount")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reportData.supplierDebts.length > 0 ? (
                reportData.supplierDebts.map((item, index) => (
                  <TableRow key={index}>
                    <TableCell>{index + 1}</TableCell>
                    <TableCell className="font-medium">{item.supplierName}</TableCell>
                    <TableCell className="text-right text-orange-600 font-semibold">
                      {formatCurrency(item.debtAmount)}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-gray-500">
                    {t("reports.noDataAvailable")}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
