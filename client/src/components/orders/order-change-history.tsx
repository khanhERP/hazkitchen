import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, ChevronLeft, ChevronRight, History, AlertCircle, ChevronsLeft, ChevronsRight } from "lucide-react";
import { useTranslation } from "@/lib/i18n";

interface ChangeHistoryRecord {
  id: number;
  orderId: number;
  orderNumber: string;
  changedAt: string;
  ipAddress: string;
  userId: number | null;
  userName: string;
  action: string;
  detailedDescription: string;
  storeCode: string | null;
  storeName: string | null;
  createdAt: string;
}

export function OrderChangeHistory() {
  const { t } = useTranslation();
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [searchTerm, setSearchTerm] = useState("");
  const [startDate, setStartDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [endDate, setEndDate] = useState(new Date().toISOString().split("T")[0]);
  const [orderNumberFilter, setOrderNumberFilter] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [userNameFilter, setUserNameFilter] = useState("");

  // Query order change history
  const { data: historyResponse, isLoading } = useQuery({
    queryKey: [
      "http://42.118.102.26:4500/api/order-change-history",
      currentPage,
      itemsPerPage,
      searchTerm,
      startDate,
      endDate,
      orderNumberFilter,
      actionFilter,
      userNameFilter,
    ],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append("page", currentPage.toString());
      params.append("limit", itemsPerPage.toString());
      if (searchTerm) params.append("search", searchTerm);
      if (startDate) params.append("startDate", startDate);
      if (endDate) params.append("endDate", endDate);
      if (orderNumberFilter) params.append("orderNumber", orderNumberFilter);
      if (actionFilter && actionFilter !== "all") params.append("action", actionFilter);
      if (userNameFilter) params.append("userName", userNameFilter);

      const response = await apiRequest(
        "GET",
        `http://42.118.102.26:4500/api/order-change-history?${params.toString()}`
      );
      if (!response.ok) throw new Error("Failed to fetch history");
      return response.json();
    },
    staleTime: 30000, // 30 seconds
  });

  const history = historyResponse?.history || [];
  const pagination = historyResponse?.pagination || {
    currentPage: 1,
    totalPages: 1,
    totalCount: 0,
    limit: 20,
    hasNext: false,
    hasPrev: false,
  };

  // Render detailed description with each field on a new line
  const renderDetailedDescription = (description: string): JSX.Element => {
    try {
      const data = JSON.parse(description);

      // Handle different action types
      if (data.productName) {
        // Product-related changes
        return (
          <div className="space-y-1">
            <div className="font-medium text-gray-900">
              {data.productName}
            </div>

            {data.oldQuantity !== undefined && data.newQuantity !== undefined && (
              <div className="flex items-center gap-2">
                <span className="text-gray-600">{t("common.quantity")}:</span>
                <span className="font-medium">{data.oldQuantity} → {data.newQuantity}</span>
              </div>
            )}

            {data.oldDiscount !== undefined && data.newDiscount !== undefined && (
              <div className="flex items-center gap-2">
                <span className="text-gray-600">{t("common.discount")}:</span>
                <span className="font-medium">{formatCurrency(data.oldDiscount)} → {formatCurrency(data.newDiscount)}</span>
              </div>
            )}

            {data.quantity && !(data.oldQuantity !== undefined && data.newQuantity !== undefined) && (
              <div className="flex items-center gap-2">
                <span className="text-gray-600">{t("common.quantity")}:</span>
                <span className="font-medium">{data.quantity}</span>
              </div>
            )}

            {data.unitPrice && (
              <div className="flex items-center gap-2">
                <span className="text-gray-600">{t("common.unitPrice")}:</span>
                <span className="font-medium">{formatCurrency(data.unitPrice)}</span>
              </div>
            )}

            {data.note && (
              <div className="flex items-start gap-2">
                <span className="text-gray-600">{t("common.notes")}:</span>
                <span className="italic text-gray-700">{data.note}</span>
              </div>
            )}
          </div>
        );
      }

      // Handle order-level changes
      if (data.oldValue !== undefined && data.newValue !== undefined) {
        return (
          <div className="flex items-center gap-2">
            <span className="text-gray-600">{data.field || t("orders.field")}:</span>
            <span className="font-medium">{data.oldValue} → {data.newValue}</span>
          </div>
        );
      }

      // Generic fallback
      return (
        <div className="space-y-1">
          {Object.entries(data).map(([key, value]) => (
            <div key={key} className="flex items-center gap-2">
              <span className="text-gray-600">{key}:</span>
              <span className="font-medium">{String(value)}</span>
            </div>
          ))}
        </div>
      );
    } catch (error) {
      // If not JSON or parsing fails, return as-is
      return <div className="text-gray-700">{description}</div>;
    }
  };

  const formatCurrency = (amount: number | string): string => {
    const num = typeof amount === "string" ? parseFloat(amount) : amount;
    if (isNaN(num)) return "0";
    return Math.floor(num).toLocaleString("vi-VN") + "₫";
  };

  const formatDate = (dateStr: string): string => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleString("vi-VN", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    } catch {
      return dateStr;
    }
  };

  const getActionBadge = (action: string) => {
    const actionMap: Record<
      string,
      { translationKey: string; variant: "default" | "secondary" | "destructive" }
    > = {
      increase_quantity: { translationKey: "orders.actions.increase_quantity", variant: "default" },
      decrease_quantity: { translationKey: "orders.actions.decrease_quantity", variant: "secondary" },
      reduce_quantity: { translationKey: "orders.actions.decrease_quantity", variant: "secondary" },
      update_quantity: { translationKey: "orders.actions.update_quantity", variant: "default" },
      update_discount: { translationKey: "orders.actions.update_discount", variant: "default" },
      delete_item: { translationKey: "orders.actions.delete_item", variant: "destructive" },
      delete: { translationKey: "orders.actions.delete_item", variant: "destructive" },
      add_item: { translationKey: "orders.actions.add_item", variant: "default" },
    };

    const config = actionMap[action] || {
      translationKey: null,
      variant: "default" as const,
    };

    const label = config.translationKey ? t(config.translationKey) : action;

    return <Badge variant={config.variant}>{label}</Badge>;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="w-5 h-5" />
            {t("orders.orderChangeHistory")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div>
              <label className="text-sm font-medium mb-1 block">{t("orders.fromDate")}</label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">{t("orders.toDate")}</label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">{t("orders.orderNumberFilter")}</label>
              <Input
                placeholder={t("orders.orderNumberPlaceholder")}
                value={orderNumberFilter}
                onChange={(e) => setOrderNumberFilter(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">{t("orders.userNameFilter")}</label>
              <Input
                placeholder={t("orders.userNamePlaceholder")}
                value={userNameFilter}
                onChange={(e) => setUserNameFilter(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">{t("orders.actionFilter")}</label>
              <Select value={actionFilter} onValueChange={setActionFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("orders.allActions")}</SelectItem>
                  <SelectItem value="increase_quantity">{t("orders.actions.increase_quantity")}</SelectItem>
                  <SelectItem value="decrease_quantity">{t("orders.actions.decrease_quantity")}</SelectItem>
                  <SelectItem value="update_quantity">{t("orders.actions.update_quantity")}</SelectItem>
                  <SelectItem value="update_discount">{t("orders.actions.update_discount")}</SelectItem>
                  <SelectItem value="delete">{t("orders.actions.delete_item")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">{t("orders.searchInDetails")}</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder={t("orders.searchPlaceholder")}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </div>

          {/* History Table */}
          <ScrollArea className="h-[600px] border rounded-lg">
            <Table>
              <TableHeader className="sticky top-0 bg-white z-10">
                <TableRow>
                  <TableHead className="w-[50px]">{t("common.no")}</TableHead>
                  <TableHead>{t("orders.timeColumn")}</TableHead>
                  <TableHead>{t("orders.orderCodeColumn")}</TableHead>
                  <TableHead>{t("orders.userColumn")}</TableHead>
                  <TableHead>{t("orders.actionColumn")}</TableHead>
                  <TableHead>{t("orders.detailsColumn")}</TableHead>
                  <TableHead>{t("orders.ipAddressColumn")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      <div className="flex items-center justify-center gap-2">
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-900"></div>
                        <span>{t("common.loading")}</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : history.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      <div className="flex flex-col items-center gap-2 text-gray-500">
                        <AlertCircle className="w-8 h-8" />
                        <p>{t("orders.noHistory")}</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  history.map((record: ChangeHistoryRecord, index: number) => (
                    <TableRow key={record.id} className="hover:bg-gray-50">
                      <TableCell className="font-medium">
                        {(currentPage - 1) * itemsPerPage + index + 1}
                      </TableCell>
                      <TableCell className="text-sm">
                        {formatDate(record.changedAt)}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {record.orderNumber || `#${record.orderId}`}
                      </TableCell>
                      <TableCell>{record.userName}</TableCell>
                      <TableCell>{getActionBadge(record.action)}</TableCell>
                      <TableCell className="max-w-md">
                        <div className="text-sm text-gray-700">
                          {renderDetailedDescription(record.detailedDescription)}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-gray-500 font-mono">
                        {record.ipAddress}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </ScrollArea>

          {/* Pagination */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-4">
            {/* Left side - Items per page selector */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">{t("orders.showing")}</span>
              <Select
                value={itemsPerPage.toString()}
                onValueChange={(value) => {
                  setItemsPerPage(Number(value));
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="h-8 w-[70px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent side="top">
                  <SelectItem value="10">{t("common.ten")}</SelectItem>
                  <SelectItem value="20">{t("common.twenty")}</SelectItem>
                  <SelectItem value="30">{t("common.thirty")}</SelectItem>
                  <SelectItem value="50">{t("common.fifty")}</SelectItem>
                  <SelectItem value="100">{t("common.hundred")}</SelectItem>
                </SelectContent>
              </Select>
              <span className="text-sm text-gray-600">{t("orders.recordsPerPage")}</span>
            </div>

            {/* Center - Page info */}
            <div className="text-sm text-gray-600">
              {t("orders.showing")} {(currentPage - 1) * itemsPerPage + 1} -{" "}
              {Math.min(currentPage * itemsPerPage, pagination.totalCount)} {t("orders.of")} {" "}
              {pagination.totalCount} {t("orders.records")}
            </div>

            {/* Right side - Page navigation */}
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setCurrentPage(1)}
                disabled={!pagination.hasPrev}
              >
                <ChevronsLeft className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setCurrentPage(currentPage - 1)}
                disabled={!pagination.hasPrev}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>

              {/* Page numbers */}
              <div className="flex items-center gap-1 px-2">
                {pagination.totalPages <= 7 ? (
                  // Show all pages if 7 or fewer
                  Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((page) => (
                    <Button
                      key={page}
                      variant={currentPage === page ? "default" : "outline"}
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setCurrentPage(page)}
                    >
                      {page}
                    </Button>
                  ))
                ) : (
                  // Show condensed version with ellipsis
                  <>
                    {currentPage > 3 && (
                      <>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => setCurrentPage(1)}
                        >
                          1
                        </Button>
                        <span className="px-1">...</span>
                      </>
                    )}

                    {Array.from({ length: 5 }, (_, i) => {
                      let page: number;
                      if (currentPage <= 3) {
                        page = i + 1;
                      } else if (currentPage >= pagination.totalPages - 2) {
                        page = pagination.totalPages - 4 + i;
                      } else {
                        page = currentPage - 2 + i;
                      }

                      if (page < 1 || page > pagination.totalPages) return null;

                      return (
                        <Button
                          key={page}
                          variant={currentPage === page ? "default" : "outline"}
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => setCurrentPage(page)}
                        >
                          {page}
                        </Button>
                      );
                    })}

                    {currentPage < pagination.totalPages - 2 && (
                      <>
                        <span className="px-1">...</span>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => setCurrentPage(pagination.totalPages)}
                        >
                          {pagination.totalPages}
                        </Button>
                      </>
                    )}
                  </>
                )}
              </div>

              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setCurrentPage(currentPage + 1)}
                disabled={!pagination.hasNext}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setCurrentPage(pagination.totalPages)}
                disabled={!pagination.hasNext}
              >
                <ChevronsRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}