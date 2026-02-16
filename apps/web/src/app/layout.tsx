import type { Metadata } from "next";
import "./globals.css";
import { LiveRefresh } from "./components/LiveRefresh";

export const metadata: Metadata = {
  title: "Mission Control",
  description: "Mission Control dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-zinc-50 text-zinc-900">
        <LiveRefresh />
        {children}
      </body>
    </html>
  );
}
