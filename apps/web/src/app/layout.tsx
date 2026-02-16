import type { Metadata } from "next";
import "./globals.css";
import { LiveRefresh } from "./components/LiveRefresh";
import { ThemeProvider } from "@/components/theme-provider";
import { AppSidebar } from "@/components/app-sidebar";
import { DesktopHeader } from "./components/DesktopHeader";
import { Toaster } from "sonner";

export const metadata: Metadata = {
  title: "Mission Control",
  description: "AI Agent Operations Dashboard",
  icons: {
    icon: "/robot.svg",
    shortcut: "/robot.svg",
    apple: "/robot.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/robot.svg" type="image/svg+xml" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-background text-foreground antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <LiveRefresh />
          <AppSidebar />
          {/* Desktop header bar (like screenshot top-right area) */}
          <DesktopHeader />
          <main className="min-h-screen pt-14 lg:pl-56 lg:pt-14 bg-[#f5f5f5] dark:bg-background">
            <div className="p-4 lg:px-5 lg:py-5">
              {children}
            </div>
          </main>
          <Toaster richColors position="top-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}
