import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Game Frontend",
  description: "Game frontend",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
