import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Grid3X3,
  List,
  ArrowUpDown,
  Package,
  Coffee,
  Cookie,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "@/lib/i18n";
import type { Product } from "@shared/schema";
// Import placeholders as data URLs since SVG imports are causing issues
const placeholderFood =
  "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDIwMCAyMDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CiAgPHJlY3Qgd2lkdGg9IjIwMCIgaGVpZ2h0PSIyMDAiIGZpbGw9IiNmM2Y0ZjYiLz4KICA8Y2lyY2xlIGN4PSIxMDAiIGN5PSI5MCIgcj0iMzAiIGZpbGw9IiMxMGI5ODEiIG9wYWNpdHk9IjAuMiIvPgogIDxyZWN0IHg9IjcwIiB5PSI3MCIgd2lkdGg9IjYwIiBoZWlnaHQ9IjQwIiByeD0iOCIgZmlsbD0iIzEwYjk4MSIgb3BhY2l0eT0iMC4zIi8+CiAgPGNpcmNsZSBjeD0iODUiIGN5PSI4NSIgcj0iNSIgZmlsbD0iIzEwYjk4MSIvPgogIDxjaXJjbGUgY3g9IjEwMCIgY3k9Ijg1IiByPSI1IiBmaWxsPSIjMTBiOTgxIi8+CiAgPGNpcmNsZSBjeD0iMTE1IiBjeT0iODUiIHI9IjUiIGZpbGw9IiMxMGI5ODEiLz4KICA8cmVjdCB4PSI4MCIgeT0iMTIwIiB3aWR0aD0iNDAiIGhlaWdodD0iMjAiIHJ4PSIxMCIgZmlsbD0iIzEwYjk4MSIgb3BhY2l0eT0iMC40Ii8+CiAgPHRleHQgeD0iMTAwIiB5PSIxNjAiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZpbGw9IiM2YjcyODAiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxMiI+7J2M7Iud7IqI7KK4PC90ZXh0Pgo8L3N2Zz4=";
const placeholderBeverage =
  "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDIwMCAyMDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CiAgPHJlY3Qgd2lkdGg9IjIwMCIgaGVpZ2h0PSIyMDAiIGZpbGw9IiNmM2Y0ZjYiLz4KICA8cmVjdCB4PSI4MCIgeT0iNTAiIHdpZHRoPSI0MCIgaGVpZ2h0PSI4MCIgcng9IjUiIGZpbGw9IiMzYjgyZjYiIG9wYWNpdHk9IjAuMiIvPgogIDxyZWN0IHg9IjgyIiB5PSI1NSIgd2lkdGg9IjM2IiBoZWlnaHQ9IjUwIiBmaWxsPSIjM2I4MmY2IiBvcGFjaXR5PSIwLjQiLz4KICA8Y2lyY2xlIGN4PSIxMDAiIHk9IjQwIiByPSI4IiBmaWxsPSIjM2I4MmY2IiBvcGFjaXR5PSIwLjMiLz4KICA8cmVjdCB4PSI5NiIgeT0iMzAiIHdpZHRoPSI4IiBoZWlnaHQ9IjE1IiBmaWxsPSIjM2I4MmY2IiBvcGFjaXR5PSIwLjUiLz4KICA8dGV4dCB4PSIxMDAiIHk9IjE2MCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0iIzZiNzI4MCIgZm9udC1mYW1pbHk9IkFyaWFsLCBzYW5zLXNlcmlmIiBmb250LXNpemU9IjEyIj7smYzro4zsnbTrr7w8L3RleHQ+Cjwvc3ZnPg==";
const placeholderSnack =
  "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDIwMCAyMDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CiAgPHJlY3Qgd2lkdGg9IjIwMCIgaGVpZ2h0PSIyMDAiIGZpbGw9IiNmM2Y0ZjYiLz4KICA8cmVjdCB4PSI2MCIgeT0iNzAiIHdpZHRoPSI4MCIgaGVpZ2h0PSI1MCIgcng9IjEwIiBmaWxsPSIjZjU5ZTBiIi9vcGFjaXR5PSIwLjIiLz4KICA8cmVjdCB4PSI2NSIgeT0iNzUiIHdpZHRoPSI3MCIgaGVpZ2h0PSIxNSIgcng9IjMiIGZpbGw9IiNmNTllMGIiIG9wYWNpdHk9IjAuNCIvPgogIDxyZWN0IHg9IjY1IiB5PSI5NSIgd2lkdGg9IjcwIiBoZWlnaHQ9IjE1IiByeD0iMyIgZmlsbD0iI2Y1OWUwYiIgb3BhY2l0eT0iMC4zIi8+CiAgPGNpcmNsZSBjeD0iN1giIGN5PSI4MyIgcj0iMyIgZmlsbD0iI2Y1OWUwYiIvPgogIDxjaXJjbGUgY3g9IjkwIiBjeT0iODMiIHI9IjMiIGZpbGw9IiNmNTllMGIiLz4KICA8Y2lyY2xlIGN4PSIxMDUiIGN5PSI4MyIgcj0iMyIgZmlsbD0iI2Y1OWUwYiIvPgogIDxjaXJjbGUgY3g9IjEyMCIgY3k9IjgzIiByPSIzIiBmaWxsPSIjZjU5ZTBiIi8+CiAgPHRleHQgeD0iMTAwIiB5PSIxNjAiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZpbGw9IiM2YjcyODAiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxMiI+7Iqk64WN7J207Ja47KeAPC90ZXh0Pgo8L3N2Zz4=";

interface ProductGridProps {
  selectedCategory: number | "all" | "bestsellers";
  searchQuery: string;
  onAddToCart: (productId: number) => void;
}

// Define CartItem type if it's not defined elsewhere
interface CartItem {
  id: number;
  name: string;
  price: string;
  quantity: number;
  total: string;
  imageUrl?: string;
  stock: number;
  taxRate?: string;
  afterTaxPrice?: string;
}

export function ProductGrid({
  selectedCategory,
  searchQuery,
  onAddToCart,
}: ProductGridProps) {
  const { toast } = useToast();
  const { t } = useTranslation();
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");
  const [sortBy, setSortBy] = useState<"name" | "price" | "stock">("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20); // Start with 20, increase by 10
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const lastProductRef = useRef<HTMLDivElement>(null);

  // Fetch store settings to check price inclusion of tax
  const { data: storeSettings } = useQuery({
    queryKey: ["http://42.118.102.26:4500/api/store-settings"],
    queryFn: async () => {
      const response = await fetch("http://42.118.102.26:4500/api/store-settings");
      if (!response.ok) throw new Error("Failed to fetch store settings");
      return response.json();
    },
    staleTime: Infinity,
  });

  const priceIncludesTax = storeSettings?.priceIncludesTax ?? false;

  // Reset when category or search changes
  useEffect(() => {
    setCurrentPage(1);
    setAllProducts([]);
    setHasMore(true);
  }, [selectedCategory, searchQuery]);

  const {
    data: productsResponse,
    isLoading,
    isFetching,
  } = useQuery({
    queryKey: [
      "http://42.118.102.26:4500/api/products",
      {
        category: selectedCategory,
        search: searchQuery,
        page: currentPage,
        limit: pageSize,
      },
    ],
    queryFn: async () => {
      const params = new URLSearchParams();

      if (searchQuery) {
        params.append("search", searchQuery);
      }

      if (selectedCategory === "bestsellers") {
        params.append("bestsellers", "true");
        params.append("limit", "30");
      } else {
        if (selectedCategory !== "all") {
          params.append("category", selectedCategory.toString());
        }
        params.append("page", currentPage.toString());
        params.append("limit", pageSize.toString());
      }

      // Only show active products in POS
      params.append("includeInactive", "false");

      const response = await fetch(`http://42.118.102.26:4500/api/products?${params}`);
      if (!response.ok) throw new Error("Failed to fetch products");
      const data = await response.json();

      console.log("Products response from API:", data);

      return data;
    },
    keepPreviousData: true,
  });

  // Update products list when new data arrives
  useEffect(() => {
    if (productsResponse?.products) {
      console.log(
        `📦 Received ${productsResponse.products.length} products for page ${currentPage}`,
      );

      if (currentPage === 1) {
        console.log("🔄 Resetting products list (page 1)");
        setAllProducts(productsResponse.products);
      } else {
        console.log(
          `➕ Appending products to existing list. Current: ${allProducts.length}, New: ${productsResponse.products.length}`,
        );

        // Store current products count to scroll to after append
        const previousCount = allProducts.length;

        setAllProducts((prev) => {
          const newProducts = [...prev, ...productsResponse.products];
          console.log(`✅ Total products after append: ${newProducts.length}`);

          // Scroll to first new product after state update
          setTimeout(() => {
            if (lastProductRef.current) {
              lastProductRef.current.scrollIntoView({
                behavior: "smooth",
                block: "start",
              });
              console.log(`📍 Scrolled to product #${previousCount + 1}`);
            }
          }, 100);

          return newProducts;
        });
      }

      const hasNext = productsResponse.pagination?.hasNext || false;
      console.log(
        `📊 Pagination - hasNext: ${hasNext}, Total: ${productsResponse.pagination?.totalCount}`,
      );
      setHasMore(hasNext);
    }
  }, [productsResponse, currentPage]);

  // Intersection Observer for infinite scroll - only load at bottom
  useEffect(() => {
    if (!hasMore || isFetching) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (first.isIntersecting) {
          console.log("📜 Scroll reached bottom - Loading more products");
          console.log(
            `📊 Current: ${allProducts.length}, PageSize: ${pageSize} → ${pageSize + 10}`,
          );

          // Increase pageSize by 10
          setPageSize((prev) => prev + 10);

          // Load next page
          setCurrentPage((prev) => prev + 1);
        }
      },
      {
        threshold: 1.0, // Only trigger when fully visible (at bottom)
        rootMargin: "0px", // No early loading
      },
    );

    const currentRef = loadMoreRef.current;
    if (currentRef) {
      observer.observe(currentRef);
      console.log("👀 Observing loadMore element at bottom");
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
    };
  }, [hasMore, isFetching, allProducts.length, pageSize]);

  const products = allProducts;
  const pagination = productsResponse?.pagination || {
    currentPage: 1,
    totalPages: 1,
    totalCount: 0,
    hasNext: false,
    hasPrev: false,
  };

  const handleAddToCart = (product: Product) => {
    if (product.trackInventory !== false && product.stock <= 0) {
      return;
    }

    console.log("Adding product to cart:", product.name);
    console.log("Product afterTaxPrice from database:", product.afterTaxPrice);
    console.log("Product afterTaxPrice type:", typeof product.afterTaxPrice);
    console.log(
      "Product afterTaxPrice is null?",
      product.afterTaxPrice === null,
    );
    console.log(
      "Product afterTaxPrice is empty string?",
      product.afterTaxPrice === "",
    );

    // Pass productId to onAddToCart as expected by the interface
    // Toast notification will be handled by the usePOS hook only
    onAddToCart(product.id);
  };

  // Function to calculate the display price based on store settings
  // This function is no longer used for direct price display but kept for potential future use or other logic.
  const getDisplayPrice = (product: Product): number => {
    const basePrice = parseFloat(product.price);
    if (priceIncludesTax) {
      // product.taxRate is a percentage like "8.00" for 8%
      const taxRate = parseFloat(product.taxRate || "0");
      return basePrice * (1 + taxRate / 100);
    }
    return basePrice;
  };

  // Mock updateCart function to demonstrate the change
  const updateCart = (productId: number, quantity: number) => {
    setCart((prev) =>
      prev.map((item) =>
        item.id === productId
          ? {
              ...item,
              quantity,
              total: (parseFloat(item.price) * quantity).toFixed(2),
              afterTaxPrice: item.afterTaxPrice, // Preserve afterTaxPrice
            }
          : item,
      ),
    );
  };

  const getPlaceholderImage = (categoryId: number, productName: string) => {
    // Determine the best placeholder based on category and product name
    const name = productName.toLowerCase();

    if (
      categoryId === 1 ||
      name.includes("coffee") ||
      name.includes("tea") ||
      name.includes("juice") ||
      name.includes("drink") ||
      name.includes("beverage")
    ) {
      return placeholderBeverage;
    } else if (
      categoryId === 2 ||
      name.includes("chip") ||
      name.includes("snack") ||
      name.includes("cookie")
    ) {
      return placeholderSnack;
    } else {
      return placeholderFood;
    }
  };

  const getPlaceholderIcon = (categoryId: number, productName: string) => {
    const name = productName.toLowerCase();

    if (
      categoryId === 1 ||
      name.includes("coffee") ||
      name.includes("tea") ||
      name.includes("juice") ||
      name.includes("drink") ||
      name.includes("beverage")
    ) {
      return Coffee;
    } else if (
      categoryId === 2 ||
      name.includes("chip") ||
      name.includes("snack") ||
      name.includes("cookie")
    ) {
      return Cookie;
    } else {
      return Package;
    }
  };

  const getStockStatus = (stock: number) => {
    if (stock === 0)
      return { text: t("pos.outOfStock"), color: "text-red-500" };
    if (stock <= 5)
      return { text: `${stock} ${t("pos.inStock")}`, color: "text-red-500" };
    if (stock <= 10)
      return { text: `${stock} ${t("pos.inStock")}`, color: "text-orange-500" };
    return { text: `${stock} ${t("pos.inStock")}`, color: "text-green-600" };
  };

  const getPopularBadge = (productName: string) => {
    // Mock logic for popular products
    const popularProducts = ["Premium Coffee", "Fresh Orange Juice"];
    return popularProducts.includes(productName);
  };

  const getLowStockBadge = (stock: number) => {
    return stock <= 5 && stock > 0;
  };

  // Chỉ hiển thị loading khi đang loading page 1 và chưa có dữ liệu
  const isInitialLoading = isLoading && currentPage === 1 && products.length === 0;
  
  if (isInitialLoading) {
    return (
      <main className="flex-1 flex flex-col items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-10 w-10 border-b-3 border-green-600"></div>
          <span className="text-sm text-gray-600 font-medium">Đang tải sản phẩm...</span>
        </div>
      </main>
    );
  }

  const getCategoryName = () => {
    if (selectedCategory === "bestsellers") return t("pos.bestsellers");
    if (selectedCategory === "all") return t("pos.allProducts");
    // This would ideally come from the categories query
    const categoryNames: Record<number, string> = {
      1: "Beverages",
      2: "Snacks",
      3: "Electronics",
      4: "Household",
      5: "Personal Care",
    };
    return categoryNames[selectedCategory as number] || "Products";
  };

  const handleSort = () => {
    if (sortBy === "name") {
      setSortBy("price");
    } else if (sortBy === "price") {
      setSortBy("stock");
    } else {
      setSortBy("name");
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    }
  };

  return (
    <main className="flex-1 flex flex-col">
      <div className="bg-white p-4 border-b pos-border flex items-center justify-between pt-[22px] pb-[22px] mt-2">
        <div>
          <h2 className="font-medium pos-text-primary text-[14px]">
            {getCategoryName()}
          </h2>
          <p className="text-sm pos-text-secondary">
            {pagination.totalCount} {t("pos.productsAvailable")}
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <Button
            variant={viewMode === "grid" ? "default" : "outline"}
            size="sm"
            className="flex items-center"
            onClick={() => setViewMode(viewMode === "grid" ? "list" : "grid")}
          >
            {viewMode === "grid" ? (
              <Grid3X3 className="mr-2" size={16} />
            ) : (
              <List className="mr-2" size={16} />
            )}
            {viewMode === "grid" ? t("pos.gridView") : t("pos.listView")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex items-center"
            onClick={handleSort}
          >
            <ArrowUpDown className="mr-2" size={16} />
            {sortBy === "name"
              ? t("pos.sortByName")
              : sortBy === "price"
                ? t("pos.sortByPrice")
                : t("pos.sortByStock")}{" "}
            ({sortOrder === "asc" ? "↑" : "↓"})
          </Button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {products.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-400 mb-4">
              <Grid3X3 size={48} className="mx-auto" />
            </div>
            <h3 className="text-lg font-medium pos-text-secondary mb-2">
              {t("pos.noProductsFound")}
            </h3>
            <p className="pos-text-tertiary">
              {searchQuery
                ? "Thử điều chỉnh từ khóa tìm kiếm"
                : selectedCategory === "bestsellers"
                  ? t("pos.bestsellersEmptyState")
                  : t("pos.noProductsInCategory")}
            </p>
          </div>
        ) : (
          <>
            <div
              className={
                viewMode === "grid"
                  ? "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4"
                  : "flex flex-col space-y-2"
              }
            >
              {products.map((product, index) => {
                const stockStatus = getStockStatus(product.stock);
                const isPopular = getPopularBadge(product.name);
                const isLowStock = getLowStockBadge(product.stock);

                // Mark first product of new batch for scroll target
                const isFirstOfNewBatch = index > 0 && index % pageSize === 0;

                return (
                  <div
                    key={`${product.id}-${index}`}
                    ref={isFirstOfNewBatch ? lastProductRef : null}
                    className={
                      viewMode === "grid"
                        ? "bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-200 overflow-hidden cursor-pointer relative border border-gray-100"
                        : "bg-white rounded-lg shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer relative border border-gray-100 flex items-center p-4"
                    }
                    onClick={() => handleAddToCart(product)}
                  >
                    {viewMode === "grid" ? (
                      <>
                        {product.imageUrl ? (
                          <img
                            src={product.imageUrl}
                            alt={product.name}
                            className="w-full h-32 object-cover"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.style.display = "none";
                              const placeholder =
                                target.nextElementSibling as HTMLElement;
                              if (placeholder)
                                placeholder.style.display = "flex";
                            }}
                          />
                        ) : null}
                        {!product.imageUrl ? (
                          <div className="w-full h-32 bg-gradient-to-br from-gray-100 to-gray-200 flex flex-col items-center justify-center">
                            <img
                              src={getPlaceholderImage(
                                product.categoryId,
                                product.name,
                              )}
                              alt={`${product.name} placeholder`}
                              className="w-20 h-20 opacity-60"
                            />
                          </div>
                        ) : (
                          <div className="w-full h-32 bg-gradient-to-br from-gray-100 to-gray-200 hidden flex-col items-center justify-center">
                            <img
                              src={getPlaceholderImage(
                                product.categoryId,
                                product.name,
                              )}
                              alt={`${product.name} placeholder`}
                              className="w-20 h-20 opacity-60"
                            />
                          </div>
                        )}

                        <div className="p-3">
                          <h3 className="font-medium pos-text-primary mb-1 line-clamp-2">
                            {product.name}
                          </h3>
                          <p className="text-sm pos-text-secondary mb-2">
                            SKU: {product.sku}
                          </p>
                          <div className="flex items-center justify-between">
                            <span className="text-lg font-bold text-green-600">
                              {Math.round(
                                parseFloat(product.price),
                              ).toLocaleString("vi-VN")}{" "}
                              ₫
                            </span>
                            {product.trackInventory !== false && (
                              <span
                                className={`text-xs font-medium ${stockStatus.color}`}
                              >
                                {stockStatus.text}
                              </span>
                            )}
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 mr-4">
                          {product.imageUrl ? (
                            <img
                              src={product.imageUrl}
                              alt={product.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                              <img
                                src={getPlaceholderImage(
                                  product.categoryId,
                                  product.name,
                                )}
                                alt={`${product.name} placeholder`}
                                className="w-8 h-8 opacity-60"
                              />
                            </div>
                          )}
                        </div>
                        <div className="flex-1">
                          <h3 className="font-medium pos-text-primary mb-1">
                            {product.name}
                          </h3>
                          <p className="text-sm pos-text-secondary mb-1">
                            SKU: {product.sku}
                          </p>
                          <div className="flex items-center justify-between">
                            <span className="text-lg font-bold text-green-600">
                              {Math.round(
                                parseFloat(product.price),
                              ).toLocaleString("vi-VN")}{" "}
                              ₫
                            </span>
                            {product.trackInventory !== false && (
                              <span
                                className={`text-xs font-medium ${stockStatus.color}`}
                              >
                                {stockStatus.text}
                              </span>
                            )}
                          </div>
                        </div>
                      </>
                    )}

                    {/* Badges */}
                    {isPopular && (
                      <div className="absolute top-2 right-2 bg-green-600 text-white text-xs px-2 py-1 rounded-full">
                        {t("pos.popular")}
                      </div>
                    )}
                    {isLowStock && product.trackInventory !== false && (
                      <div className="absolute top-2 right-2 bg-red-500 text-white text-xs px-2 py-1 rounded-full">
                        {t("pos.lowStock")}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Infinite Scroll Loading Indicator */}
            <div ref={loadMoreRef} className="py-8 text-center min-h-[100px]">
              {hasMore && isFetching && (
                <div className="flex flex-col items-center justify-center gap-3">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-3 border-green-600"></div>
                  <span className="text-sm text-gray-600 font-medium">
                    Đang tải thêm {pageSize} sản phẩm... (Trang {currentPage}/
                    {pagination.totalPages})
                  </span>
                </div>
              )}
              {hasMore && !isFetching && (
                <div className="text-sm text-gray-500 font-medium">
                  ⬇️ Scroll xuống cuối để tải thêm {pageSize + 10} sản phẩm
                </div>
              )}
            </div>

            {/* Total count display */}
            {!hasMore && products.length > 0 && (
              <div className="py-6 text-center">
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-50 text-green-700 rounded-full text-sm font-medium">
                  <svg
                    className="w-4 h-4"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Đã hiển thị tất cả {pagination.totalCount} sản phẩm
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
