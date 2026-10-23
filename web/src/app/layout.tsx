import type { Metadata } from "next";
import { Libre_Franklin } from "next/font/google";
import "./globals.css";

const franklin = Libre_Franklin({
  subsets: ["latin"],
  variable: "--font-franklin",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Folio", template: "%s · Folio" },
  description: "Extracción verificable de estados financieros municipales: cada dato con su cita y su folio.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es-CO" className={franklin.variable}>
      <body>{children}</body>
    </html>
  );
}
