import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const BASE_URL = "https://api-laundry-web.edpos.vn"; // 👈 đổi theo domain backend của bạn

export async function defaultFetcher({ queryKey }) {
  const [path] = queryKey;

  // Cho phép truyền cả path hoặc URL đầy đủ
  const url = path.startsWith("http") ? path : `${BASE_URL}${path}`;
  const token = localStorage.getItem("token");

  const res = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    credentials: "include", // nếu dùng cookie, giữ nguyên
  });

  // Xử lý token hết hạn hoặc lỗi xác thực
  if (res.status === 401) {
    console.warn("Token hết hạn hoặc không hợp lệ");
    localStorage.removeItem("token");
    window.location.href = "/";
    return;
  }

  if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`);

  return res.json();
}
