import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "شبیه‌ساز Behpardakht | درگاه پرداخت محلی",
  description: "شبیه‌ساز محلی برای توسعه. هیچ پرداخت واقعی انجام نمی‌شود.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fa" dir="rtl" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
