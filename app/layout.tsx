import type { Metadata } from "next";
import "@fontsource-variable/cormorant-garamond";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ogni scelta apre un universo.",
  description:
    "Una storia cinematografica sulla forza di vivere, scegliere e attraversare ogni sfida.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="it">
      <head>
        <meta name="theme-color" content="#050607" />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/npm/lenis@1.3.23/dist/lenis.css"
        />
        <script
          src="https://cdn.jsdelivr.net/npm/lenis@1.3.23/dist/lenis.min.js"
          defer
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
