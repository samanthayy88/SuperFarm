import type { Metadata, Viewport } from "next";
import "./globals.css";
import { StoreProvider } from "@/lib/store";
import { ThemeProvider, themeInitScript } from "@/lib/theme";
import Sidebar from "@/components/Sidebar";

export const metadata: Metadata = {
  title: "Farm Manager",
  description: "Multi-farm operations dashboard",
};

// `themeColor` / `colorScheme` belong on the viewport export — the metadata
// equivalents are deprecated.
export const viewport: Viewport = {
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f8fa" },
    { media: "(prefers-color-scheme: dark)", color: "#141417" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <head>
        {/* Applies the stored theme before first paint, so there is no flash. */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-full">
        <ThemeProvider>
          <StoreProvider>
            <Sidebar />
            <main className="min-h-screen p-4 pt-18 sm:p-6 sm:pt-18 lg:ml-64 lg:p-8">{children}</main>
          </StoreProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
