import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import AppFooter from "@/app/_components/app-footer";
import DomReadyGate from "@/app/_components/dom-ready-gate";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Re:Place",
  description: "Personal memory management for places, ideas, and articles.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <DomReadyGate>
          {children}
          <AppFooter />
        </DomReadyGate>
      </body>
    </html>
  );
}
