import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "LVAEP Tutor Reports",
    template: "%s | LVAEP Tutor Reports",
  },
  description:
    "Record tutoring sessions and submit monthly reports for Literacy Volunteers of America, Essex/Passaic County.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-gray-50 text-foreground">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
