import type { Metadata, Viewport } from "next";
import SiteShell from "./SiteShell";
import "./globals.css";

export const metadata: Metadata = {
  title: "Vaporator",
  description: "Recommend new steam games",
};

export const viewport: Viewport = {
  colorScheme: "dark",
  themeColor: "#171a21",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>
        <SiteShell>{children}</SiteShell>
      </body>
    </html>
  );
}
