import type { Metadata, Viewport } from "next";
import "@/styles/globals.css";
import Providers from "@/components/Providers";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "Jin Sanskar Setu | जिन संस्कार सेतु",
  description: "Connecting Families • Strengthening Sangh • Nurturing Sanskars — Jain Sangh Community Survey & Management Initiative",
  applicationName: "Jin Sanskar Setu",
  icons: {
    icon: "/favicon.ico",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#b45309",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css"
        />
      </head>
      <body>
        <Providers>
          <Navbar />
          <main className="py-3 py-md-4">{children}</main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
