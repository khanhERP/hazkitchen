import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: any,
  options: RequestInit = {},
) {
  // Log payment method tracking for order status updates
  if (
    url.includes("https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/orders/") &&
    url.includes("/status") &&
    method === "PUT"
  ) {
    console.log(
      "🔍 apiRequest: Payment method tracking for order status update:",
      {
        method,
        url,
        data,
        hasPaymentMethod: data && "paymentMethod" in data,
        paymentMethodValue: data?.paymentMethod,
        paymentMethodType: typeof data?.paymentMethod,
        paymentMethodIsNull: data?.paymentMethod === null,
        paymentMethodIsUndefined: data?.paymentMethod === undefined,
        paymentMethodIsEmpty: data?.paymentMethod === "",
        fullRequestData: data,
        timestamp: new Date().toISOString(),
      },
    );
  }

  const config: RequestInit = {
    method,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
    ...options,
  };

  if (data && (method === "POST" || method === "PUT" || method === "PATCH")) {
    config.body = JSON.stringify(data);

    // Additional logging for payment method requests
    if (
      url.includes("https://bad07204-3e0d-445f-a72e-497c63c9083a-00-3i4fcyhnilzoc.pike.replit.dev/api/orders/") &&
      url.includes("/status") &&
      method === "PUT"
    ) {
      console.log("🔍 apiRequest: Final request body for payment:", {
        url,
        requestBodyString: JSON.stringify(data),
        parsedBack: JSON.parse(JSON.stringify(data)),
        timestamp: new Date().toISOString(),
      });
    }
  }

  const response = await fetch(url, config);

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return response;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey.join("/") as string, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // queryFn: defaultFetcher,   // 👈 set mặc định ở đây
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: true,
      staleTime: 0, // No cache
      gcTime: 0, // Don't keep in memory
      retry: 1,
      refetchOnMount: true,
      refetchOnReconnect: true,
      networkMode: "online",
    },
    mutations: {
      retry: false,
      onError: (error) => {
        console.error("Mutation error:", error);
      },
    },
  },
});
