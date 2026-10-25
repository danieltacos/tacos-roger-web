"use client";

import type { ReactNode } from "react";
import { useSesion } from "@/lib/sesion";
import { Vacio } from "./ui";

/** Muestra el contenido solo a administradores. */
export function SoloAdmin({ children }: { children: ReactNode }) {
  const { esAdmin } = useSesion();
  if (!esAdmin) return <Vacio>Esta sección es solo para administradores.</Vacio>;
  return <>{children}</>;
}
