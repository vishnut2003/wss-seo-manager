import type { Metadata } from "next";
import { Rubik } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { NextAuthProviders } from "@/providers/NextAuthProviders";
import { Toaster } from "@/components/ui/sonner";

const rubik = Rubik({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "WSS SEO Manager",
  description: "Manage your SEO projects in one place.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={cn("h-full antialiased font-sans", rubik.variable)}
    >
      <body className={`${rubik.className} min-h-full flex flex-col`}>
        <NextAuthProviders>{children}</NextAuthProviders>
        <Toaster richColors position="top-center" />
      </body>
    </html>
  );
}
