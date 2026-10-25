"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3,
  ChefHat,
  LogOut,
  Menu,
  Package,
  ShoppingCart,
  Tags,
  UserCog,
  Users,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";
import { useSesion } from "@/lib/sesion";
import { Cargando, Modal } from "@/components/ui";

interface Destino {
  href: string;
  etiqueta: string;
  icono: LucideIcon;
  soloAdmin?: boolean;
  principal?: boolean; // aparece en la barra inferior del celular
}

const DESTINOS: Destino[] = [
  { href: "/ventas/", etiqueta: "Ventas", icono: ShoppingCart, principal: true },
  { href: "/reportes/", etiqueta: "Reportes", icono: BarChart3, soloAdmin: true, principal: true },
  { href: "/insumos/", etiqueta: "Insumos", icono: Package, principal: true },
  { href: "/recetas/", etiqueta: "Recetas", icono: ChefHat, soloAdmin: true },
  { href: "/productos/", etiqueta: "Productos", icono: UtensilsCrossed, soloAdmin: true },
  { href: "/categorias/", etiqueta: "Categorías", icono: Tags, soloAdmin: true },
  { href: "/empleados/", etiqueta: "Empleados", icono: Users, soloAdmin: true },
  { href: "/usuarios/", etiqueta: "Usuarios", icono: UserCog, soloAdmin: true },
];

export default function LayoutApp({ children }: { children: ReactNode }) {
  const router = useRouter();
  const ruta = usePathname();
  const { cargando, sesion, perfil, esAdmin, salir } = useSesion();
  const [menuAbierto, setMenuAbierto] = useState(false);

  useEffect(() => {
    if (!cargando && !sesion) router.replace("/login/");
  }, [cargando, sesion, router]);

  if (cargando || !sesion) return <Cargando />;

  if (!perfil) {
    return (
      <div className="mx-auto max-w-md p-6 text-center text-sm text-tinta-suave">
        Tu usuario no tiene perfil todavía. Pide al administrador que corra la migración
        <code className="mx-1 rounded bg-white px-1">01_mejoras.sql</code>o que te dé acceso.
        <button className="mt-4 block w-full font-semibold text-salsa" onClick={salir}>
          Cerrar sesión
        </button>
      </div>
    );
  }

  const visibles = DESTINOS.filter((d) => esAdmin || !d.soloAdmin);
  const principales = visibles.filter((d) => d.principal);
  const secundarios = visibles.filter((d) => !d.principal);
  const activo = (href: string) => ruta?.startsWith(href.replace(/\/$/, ""));

  return (
    <div className="min-h-dvh md:flex">
      {/* Menú lateral (pantallas anchas) */}
      <aside className="sticky top-0 hidden h-dvh w-56 shrink-0 flex-col border-r border-borde bg-papel md:flex">
        <div className="flex items-center gap-2 bg-salsa px-4 py-4 text-white">
          <span className="text-2xl">🌮</span>
          <div className="leading-tight">
            <div className="font-display text-lg font-bold">Tacos el Roger</div>
            <div className="text-xs text-white/75">Punto de venta</div>
          </div>
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto p-2">
          {visibles.map((d) => (
            <Link
              key={d.href}
              href={d.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                activo(d.href) ? "bg-salsa-suave text-salsa-oscura" : "text-tinta-suave hover:bg-crema hover:text-tinta"
              }`}
            >
              <d.icono size={18} />
              {d.etiqueta}
            </Link>
          ))}
        </nav>
        <div className="border-t border-borde p-3 text-xs">
          <div className="truncate font-semibold text-tinta">{perfil.nombre || perfil.email}</div>
          <div className="mb-2 text-tinta-suave">{esAdmin ? "Administrador" : "Cajero"}</div>
          <button onClick={salir} className="flex items-center gap-1.5 font-semibold text-salsa hover:underline">
            <LogOut size={14} /> Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Barra superior (celular) */}
      <header className="sticky top-0 z-30 flex items-center gap-2 bg-salsa px-4 py-3 text-white md:hidden">
        <span className="text-xl">🌮</span>
        <span className="font-display text-lg font-bold">Tacos el Roger</span>
      </header>

      <main className="min-w-0 flex-1 px-4 pb-28 pt-5 md:px-8 md:pb-10 md:pt-8">{children}</main>

      {/* Barra inferior (celular) */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-borde bg-white pb-[env(safe-area-inset-bottom)] md:hidden">
        {principales.map((d) => (
          <Link
            key={d.href}
            href={d.href}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-semibold ${
              activo(d.href) ? "text-salsa" : "text-tinta-suave"
            }`}
          >
            <d.icono size={22} />
            {d.etiqueta}
          </Link>
        ))}
        <button
          onClick={() => setMenuAbierto(true)}
          className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-semibold ${
            secundarios.some((d) => activo(d.href)) ? "text-salsa" : "text-tinta-suave"
          }`}
        >
          <Menu size={22} />
          Más
        </button>
      </nav>

      <Modal abierto={menuAbierto} titulo="Menú" onCerrar={() => setMenuAbierto(false)}>
        <div className="grid grid-cols-3 gap-2">
          {secundarios.map((d) => (
            <Link
              key={d.href}
              href={d.href}
              onClick={() => setMenuAbierto(false)}
              className="flex flex-col items-center gap-1 rounded-xl border border-borde p-3 text-xs font-semibold text-tinta"
            >
              <d.icono size={22} className="text-salsa" />
              {d.etiqueta}
            </Link>
          ))}
          <button
            onClick={salir}
            className="flex flex-col items-center gap-1 rounded-xl border border-borde p-3 text-xs font-semibold text-tinta"
          >
            <LogOut size={22} className="text-salsa" />
            Salir
          </button>
        </div>
        <p className="mt-4 text-center text-xs text-tinta-suave">
          {perfil.email} · {esAdmin ? "Administrador" : "Cajero"}
        </p>
      </Modal>
    </div>
  );
}
