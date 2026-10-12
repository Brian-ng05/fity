import type { Metadata } from "next";
import "@fontsource/be-vietnam-pro/400.css";
import "@fontsource/be-vietnam-pro/500.css";
import "@fontsource/be-vietnam-pro/600.css";
import "@fontsource/be-vietnam-pro/700.css";
import "./globals.css";
import "./scan-review.css";
import "./commerce.css";
import "./scan-result.css";

export const metadata: Metadata = {
  title: "MORPH Studio — Một lựa chọn vừa bạn",
  description: "Demo tìm size và hình thể 3D từ hai ảnh, hỗ trợ webcam thân trên và ảnh toàn thân.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="vi"><body>{children}</body></html>;
}
