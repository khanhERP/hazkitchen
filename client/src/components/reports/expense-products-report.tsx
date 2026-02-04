
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart, Package, DollarSign } from "lucide-react";
import { useTranslation } from "@/lib/i18n";

interface ExpenseProduct {
  receiptId: number;
  receiptNumber: string;
  purchaseDate: string;
  purchaseType: string;
  itemId: number;
  productId: number;
  productName: string;
  quantity: number;
  unitPrice: string;
  total: string;
  productType: number;
  categoryId: number;
  categoryName: string;
  productSku: string;
}

export function ExpenseProductsReport() {
  const { t, currentLanguage } = useTranslation();

  const { data: response, isLoading, error } = useQuery<{
    success: boolean;
    message: string;
    data: ExpenseProduct[];
  }>({
    queryKey: ["https://api-pos.edpos.vn/api/purchase-receipts/expense-products"],
  });

  const expenseProducts = response?.data || [];
  
  console.log("📊 Expense Products Report - API Response:", response);
  console.log("📊 Expense Products count:", expenseProducts.length);
  console.log("📊 Sample products:", expenseProducts.slice(0, 3));

  const formatCurrency = (amount: string) => {
    const locale = {
      ko: "ko-KR",
      en: "en-US",
      vi: "vi-VN",
    }[currentLanguage] || "vi-VN";

    return new Intl.NumberFormat(locale).format(parseFloat(amount || "0"));
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  // Calculate totals
  const totalQuantity = expenseProducts.reduce(
    (sum, item) => sum + item.quantity,
    0
  );
  const totalValue = expenseProducts.reduce(
    (sum, item) => sum + parseFloat(item.total || "0"),
    0
  );

  if (isLoading) {
    return (
      <div className="text-center py-12">
        <ShoppingCart className="w-16 h-16 text-gray-300 mx-auto mb-4 animate-pulse" />
        <p className="text-gray-500">Đang tải dữ liệu...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Tổng sản phẩm
            </CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{expenseProducts.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Tổng số lượng
            </CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalQuantity}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Tổng giá trị
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(totalValue.toString())} ₫
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Products Table */}
      <Card>
        <CardHeader>
          <CardTitle>Danh sách sản phẩm thu chi từ phiếu nhập</CardTitle>
        </CardHeader>
        <CardContent>
          {expenseProducts.length === 0 ? (
            <div className="text-center py-8">
              <Package className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">
                Không tìm thấy sản phẩm thu chi nào
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Số phiếu</TableHead>
                    <TableHead>Ngày nhập</TableHead>
                    <TableHead>Loại phiếu</TableHead>
                    <TableHead>Tên sản phẩm</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Danh mục</TableHead>
                    <TableHead className="text-right">Số lượng</TableHead>
                    <TableHead className="text-right">Đơn giá</TableHead>
                    <TableHead className="text-right">Thành tiền</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expenseProducts.map((item) => (
                    <TableRow key={item.itemId}>
                      <TableCell className="font-medium">
                        {item.receiptNumber}
                      </TableCell>
                      <TableCell>{formatDate(item.purchaseDate)}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {item.purchaseType || "Chưa xác định"}
                        </Badge>
                      </TableCell>
                      <TableCell>{item.productName}</TableCell>
                      <TableCell>
                        <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                          {item.productSku || "-"}
                        </code>
                      </TableCell>
                      <TableCell>
                        <Badge>{item.categoryName}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {item.quantity}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(item.unitPrice)}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatCurrency(item.total)} ₫
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
