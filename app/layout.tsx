import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "QR Light Switch",
  description: "QR code controlled flashlight",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
