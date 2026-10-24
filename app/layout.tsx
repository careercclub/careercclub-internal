import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import type { ReactNode } from "react";
import { PwaRegistration } from "./_components/pwa-registration";
import { SelectMenuHost } from "./_components/select-menu";
import "./globals.css";
import { THEME_BOOT_SCRIPT } from "@/lib/theme/theme";

const uiFont = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-ui",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "CCC Internal Dashboard",
    template: "%s | CCC Internal",
  },
  description: "CareerCclub internal operations dashboard built with Next.js App Router.",
  manifest: "/manifest.webmanifest",
  applicationName: "CCC Internal",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "CCC Internal",
  },
  icons: {
    icon: "/favicon.ico",
    apple: "/pwa-icon/180",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#edf0f4",
};

type RootLayoutProps = Readonly<{
  children: ReactNode;
}>;

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html className={uiFont.variable} data-theme="light" lang="id" suppressHydrationWarning>
      <head>
        {/* Sets data-theme before the first paint so dark mode never flashes white. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
        <link
          href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@3.31.0/dist/tabler-icons.min.css"
          rel="stylesheet"
        />
      </head>
      <body className={uiFont.className}>
        <PwaRegistration />
        {children}
        <SelectMenuHost />
      </body>
    </html>
  );
}
