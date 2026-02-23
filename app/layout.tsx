import type { Metadata, Viewport } from "next";
import { Toaster } from "sonner";
import { ChunkLoadErrorHandler } from "./ChunkLoadErrorHandler";
import { Providers } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Play Lottery 365",
  description: "Play Lottery 365",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <ChunkLoadErrorHandler />
        <Providers>
          {children}
          <Toaster position="top-right" richColors closeButton />
        </Providers>
      </body>
    </html>
  );
}
