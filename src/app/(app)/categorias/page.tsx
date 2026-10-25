"use client";

import { CatalogoSimple } from "@/components/CatalogoSimple";

export default function Categorias() {
  return (
    <CatalogoSimple
      tabla="categoria"
      titulo="Categorías"
      singular="Categoría"
      descripcion="Agrupan los productos en la pantalla de ventas (Tacos, Bebidas…)."
    />
  );
}
