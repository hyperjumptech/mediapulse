import "@workspace/ui/globals.css";

import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";

import { Providers } from "@/components/providers";
import { cn } from "@workspace/ui/lib/utils";
import { Metadata } from "next";

const fontSans = Geist({
  subsets: ["latin"],
  variable: "--font-sans",
});

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://dashboard.mediapulse.hyperjump.tech"),
  title: "MediaPulse by Hyperjump | Newsletter for Executives.",
  description:
    "Get a personalized newsletter that learns what matters to you, delivered daily with only the news that impacts your business.",
  openGraph: {
    title: "MediaPulse by Hyperjump | Newsletter for Executives.",
    description:
      "Get a personalized newsletter that learns what matters to you, delivered daily with only the news that impacts your business.",
    images: [{ url: "/images/hyperjump-icon-only.png" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={cn(
          fontSans.variable,
          fontMono.variable,
          "font-sans antialiased",
        )}
      >
        <Providers>
          {children}
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
