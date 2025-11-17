import { OrderChangeHistory } from "@/components/orders/order-change-history";
import { POSHeader } from "@/components/pos/header";
import { RightSidebar } from "@/components/ui/right-sidebar";

export default function OrderHistoryPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <POSHeader />
      <RightSidebar />

      {/* Main content with proper spacing for header and sidebar */}
      <div className="pt-16 pl-10 transition-all duration-300">
        <div className="container mx-auto px-4 py-6">
          <OrderChangeHistory />
        </div>
      </div>
    </div>
  );
}
