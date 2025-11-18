import { useQuery } from "@tanstack/react-query";
import {
  Search,
  BarChart3,
  Settings,
  Coffee,
  Cookie,
  Smartphone,
  Home,
  User,
  Grid3X3,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "@/lib/i18n";
import type { Category, Product } from "@shared/schema";

interface CategorySidebarProps {
  selectedCategory: number | "all" | "bestsellers";
  onCategorySelect: (categoryId: number | "all" | "bestsellers") => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onOpenProductManager: () => void;
  onAddToCart: (productId: number) => void;
}

const categoryIcons = {
  Beverages: Coffee,
  Snacks: Cookie,
  Electronics: Smartphone,
  Household: Home,
  "Personal Care": User,
};

export function CategorySidebar({
  selectedCategory,
  onCategorySelect,
  searchQuery,
  onSearchChange,
  onOpenProductManager,
  onAddToCart,
}: CategorySidebarProps) {
  const { toast } = useToast();
  const { t } = useTranslation();

  // Fetch category counts using new optimized API
  const { data: categoryCountsData } = useQuery({
    queryKey: ["http://42.118.102.26:4500/api/categories/product-counts"],
    queryFn: async () => {
      const response = await fetch(`http://42.118.102.26:4500/api/categories/product-counts`);
      if (!response.ok) throw new Error("Failed to fetch category counts");
      return await response.json();
    },
  });

  const filteredCategories = categoryCountsData?.categories || [];
  const totalProducts = categoryCountsData?.totalProducts || 0;

  const getProductCountForCategory = (categoryId: number | "all" | "bestsellers") => {
    if (categoryId === "all") {
      console.log("All products count (excluding expenses):", totalProducts);
      return totalProducts;
    }

    if (categoryId === "bestsellers") {
      // Bestsellers shows top 30 products, use totalProducts as fallback
      console.log("Bestsellers count: 30");
      return 30;
    }

    const category = filteredCategories.find((cat: any) => cat.id === categoryId);
    const count = category?.productCount || 0;
    console.log(`Category ${categoryId} products:`, count);
    return count;
  };

  const handleBarcodeScan = () => {
    // Simulate barcode scanning
    const sampleSkus = ["BEV001", "BEV002", "SNK001", "ELC001"];
    const randomSku = sampleSkus[Math.floor(Math.random() * sampleSkus.length)];

    fetch(`http://42.118.102.26:4500/api/products/barcode/${randomSku}`)
      .then((res) => res.json())
      .then((product) => {
        if (product.id) {
          onAddToCart(product.id);
        }
      })
      .catch(() => {
        toast({
          title: t("pos.scanFailed"),
          description: t("pos.productNotFound"),
          variant: "destructive",
        });
      });
  };

  return (
    <aside className="w-64 bg-white shadow-material border-r pos-border flex flex-col">
      <div className="p-4 border-b pos-border mt-2">
        <div className="relative mb-3">
          <Input
            type="text"
            placeholder={t("pos.searchProducts")}
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10"
          />
          <Search
            className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
            size={16}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-4">
          <h3 className="font-medium pos-text-primary mb-3">
            {t("pos.categories")}
          </h3>
          <div className="space-y-2">
            <button
              onClick={() => onCategorySelect("bestsellers")}
              className={`w-full text-left px-3 py-2 rounded-xl transition-colors duration-200 flex items-center justify-between ${
                selectedCategory === "bestsellers"
                  ? "bg-green-50 text-green-600 border-l-4 border-green-500"
                  : "hover:bg-gray-50"
              }`}
            >
              <span className="flex items-center">
                <BarChart3 className="w-5 mr-2 text-gray-500" size={16} />
                {t("pos.bestsellers")}
              </span>
            </button>

            {filteredCategories.map((category) => {
              const IconComponent =
                categoryIcons[category.name as keyof typeof categoryIcons] ||
                Grid3X3;
              const isSelected = selectedCategory === category.id;

              return (
                <button
                  key={category.id}
                  onClick={() => onCategorySelect(category.id)}
                  className={`w-full text-left px-3 py-2 rounded-xl transition-colors duration-200 flex items-center justify-between ${
                    isSelected
                      ? "bg-green-50 text-green-600 border-l-4 border-green-500"
                      : "hover:bg-gray-50"
                  }`}
                >
                  <span className="flex items-center">
                    <IconComponent
                      className="w-5 mr-2 text-gray-500"
                      size={16}
                    />
                    {category.name}
                  </span>
                  <span
                    className={`text-xs px-2 py-1 rounded-full ${
                      isSelected
                        ? "bg-green-500 text-white"
                        : "bg-gray-200 text-gray-600"
                    }`}
                  >
                    {getProductCountForCategory(category.id)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="p-4 border-t pos-border space-y-3">
        <Button
          onClick={onOpenProductManager}
          className="w-full bg-orange-500 hover:bg-orange-600 text-white flex items-center justify-center rounded-xl"
        >
          <Settings className="mr-2" size={16} />
          {t("pos.manageProducts")}
        </Button>
      </div>
    </aside>
  );
}