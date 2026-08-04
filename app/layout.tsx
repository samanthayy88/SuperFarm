import type { Metadata } from "next";
import "./globals.css";
import { StoreProvider } from "@/lib/store";
import Sidebar from "@/components/Sidebar";

export const metadata: Metadata = {
  title: "Farm Manager",
  description: "Multi-farm operations dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full">
        <StoreProvider>
          <Sidebar />
          <main className="ml-60 min-h-screen p-6 lg:p-8">{children}</main>
        </StoreProvider>
      </body>
    </html>
  );
}
