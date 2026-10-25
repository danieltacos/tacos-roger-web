import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ProveedorSesion } from "@/lib/sesion";
import { ProveedorAvisos } from "@/components/ui";

export const metadata: Metadata = {
  title: "Tacos el Roger",
  description: "Ventas, inventario y reportes de la taquería",
};

export const viewport: Viewport = {
  themeColor: "#c62828",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es-MX">
      <body className="antialiased">
        <ProveedorSesion>
          <ProveedorAvisos>{children}</ProveedorAvisos>
        </ProveedorSesion>
      </body>
    </html>
  );
}
