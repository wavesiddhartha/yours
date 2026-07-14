import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export const metadata: Metadata = {
  title: "Vision — World-class Multimodal AI",
  description: "Upload photos, documents, PDFs, graphs, or UI mockups and ask Vision anything. Premium, calm, and intelligent multimodal reasoning powered by MiniMax M3.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full bg-background-warm text-text-primary selection:bg-accent-gold/20 selection:text-text-primary">
        {children}
      </body>
    </html>
  );
}
