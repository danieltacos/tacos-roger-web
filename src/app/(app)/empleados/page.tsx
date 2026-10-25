"use client";

import { CatalogoSimple } from "@/components/CatalogoSimple";

export default function Empleados() {
  return (
    <CatalogoSimple
      tabla="empleado"
      titulo="Empleados"
      singular="Empleado"
      descripcion="Quién atiende cada venta. Los inactivos ya no aparecen al cobrar."
    />
  );
}
