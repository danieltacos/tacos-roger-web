"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { mensajeError, supabase } from "@/lib/supabase";
import { dinero, numero } from "@/lib/formato";
import type { Insumo, LineaReceta, Producto } from "@/lib/types";
import { SoloAdmin } from "@/components/SoloAdmin";
import { Boton, BotonIcono, Campo, Cargando, Encabezado, Etiqueta, Selector, Tarjeta, Vacio, useAvisos } from "@/components/ui";

export default function Recetas() {
  return (
    <SoloAdmin>
      <Contenido />
    </SoloAdmin>
  );
}

interface LineaConProducto extends LineaReceta {
  producto_id: number;
}

function Contenido() {
  const { avisar } = useAvisos();
  const [cargando, setCargando] = useState(true);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [lineas, setLineas] = useState<LineaConProducto[]>([]);
  const [seleccionado, setSeleccionado] = useState<number | null>(null);
  const [nuevoInsumo, setNuevoInsumo] = useState("");
  const [nuevaCantidad, setNuevaCantidad] = useState("");

  const cargar = useCallback(async () => {
    const [p, i, r] = await Promise.all([
      supabase.from("producto").select("id, nombre, precio, activo, categoria_id, imagen_url").order("nombre"),
      supabase.from("insumo").select("id, nombre, unidad_medida, costo_unitario, activo, stock_actual, stock_minimo").order("nombre"),
      supabase.from("producto_insumo").select("producto_id, insumo_id, cantidad_usada, insumo(nombre, unidad_medida, costo_unitario)"),
    ]);
    const error = p.error ?? i.error ?? r.error;
    if (error) avisar(mensajeError(error), "error");
    setProductos((p.data ?? []) as Producto[]);
    setInsumos((i.data ?? []) as Insumo[]);
    setLineas((r.data ?? []) as unknown as LineaConProducto[]);
    setCargando(false);
  }, [avisar]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const costoPorProducto = useMemo(() => {
    const m = new Map<number, { costo: number; lineas: number }>();
    for (const l of lineas) {
      const actual = m.get(l.producto_id) ?? { costo: 0, lineas: 0 };
      actual.costo += Number(l.cantidad_usada) * Number(l.insumo?.costo_unitario ?? 0);
      actual.lineas += 1;
      m.set(l.producto_id, actual);
    }
    return m;
  }, [lineas]);

  const producto = productos.find((p) => p.id === seleccionado) ?? null;
  const receta = lineas.filter((l) => l.producto_id === seleccionado);
  const costo = costoPorProducto.get(seleccionado ?? -1)?.costo ?? 0;
  const precio = Number(producto?.precio ?? 0);
  const margen = precio > 0 ? ((precio - costo) / precio) * 100 : 0;

  async function agregar(e: FormEvent) {
    e.preventDefault();
    const cantidad = Number(nuevaCantidad.replace(",", "."));
    if (!seleccionado || !nuevoInsumo) return avisar("Elige un insumo", "error");
    if (!Number.isFinite(cantidad) || cantidad <= 0) return avisar("La cantidad debe ser mayor que cero", "error");
    const { error } = await supabase
      .from("producto_insumo")
      .upsert({ producto_id: seleccionado, insumo_id: Number(nuevoInsumo), cantidad_usada: cantidad });
    if (error) return avisar(mensajeError(error), "error");
    setNuevoInsumo("");
    setNuevaCantidad("");
    cargar();
  }

  async function cambiarCantidad(l: LineaConProducto, texto: string) {
    const cantidad = Number(texto.replace(",", "."));
    if (!Number.isFinite(cantidad) || cantidad <= 0 || cantidad === Number(l.cantidad_usada)) return;
    const { error } = await supabase
      .from("producto_insumo")
      .update({ cantidad_usada: cantidad })
      .eq("producto_id", l.producto_id)
      .eq("insumo_id", l.insumo_id);
    if (error) return avisar(mensajeError(error), "error");
    cargar();
  }

  async function quitar(l: LineaConProducto) {
    const { error } = await supabase
      .from("producto_insumo")
      .delete()
      .eq("producto_id", l.producto_id)
      .eq("insumo_id", l.insumo_id);
    if (error) return avisar(mensajeError(error), "error");
    cargar();
  }

  if (cargando) return <Cargando />;

  const disponibles = insumos.filter((i) => i.activo && !receta.some((l) => l.insumo_id === i.id));

  return (
    <div className="mx-auto max-w-5xl">
      <Encabezado titulo="Recetas" subtitulo="Qué insumos usa cada producto. Con esto se descuenta el inventario y se calcula la ganancia." />

      <div className="grid gap-5 md:grid-cols-[18rem_1fr]">
        {/* Lista de productos */}
        <Tarjeta className={`divide-y divide-borde self-start ${producto ? "hidden md:block" : ""}`}>
          {productos.length === 0 ? (
            <p className="p-4 text-sm text-tinta-suave">No hay productos.</p>
          ) : (
            productos.map((p) => {
              const info = costoPorProducto.get(p.id);
              return (
                <button
                  key={p.id}
                  onClick={() => setSeleccionado(p.id)}
                  className={`flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm transition ${
                    p.id === seleccionado ? "bg-salsa-suave" : "hover:bg-crema"
                  } ${p.activo ? "" : "text-gray-400"}`}
                >
                  <span className="flex-1 truncate font-medium">{p.nombre}</span>
                  {info ? (
                    <span className="cifras text-xs text-tinta-suave">{info.lineas} {info.lineas === 1 ? "insumo" : "insumos"}</span>
                  ) : (
                    <Etiqueta tono="alerta">Sin receta</Etiqueta>
                  )}
                </button>
              );
            })
          )}
        </Tarjeta>

        {/* Receta del producto elegido */}
        {!producto ? (
          <div className="hidden md:block">
            <Vacio>Elige un producto para ver o armar su receta.</Vacio>
          </div>
        ) : (
          <div>
            <button
              onClick={() => setSeleccionado(null)}
              className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-tinta-suave md:hidden"
            >
              <ArrowLeft size={16} /> Productos
            </button>
            <h2 className="mb-3 font-display text-xl font-bold">{producto.nombre}</h2>

            <div className="mb-4 grid grid-cols-3 gap-2">
              <Dato titulo="Precio" valor={dinero(precio)} />
              <Dato titulo="Costo" valor={dinero(costo)} />
              <Dato titulo="Margen" valor={receta.length ? `${numero(margen, 0)}%` : "—"} alerta={receta.length > 0 && margen < 30} />
            </div>

            <Tarjeta className="mb-4 divide-y divide-borde">
              {receta.length === 0 ? (
                <p className="p-4 text-sm text-tinta-suave">
                  Sin insumos todavía: al vender este producto no se descuenta nada del inventario.
                </p>
              ) : (
                receta.map((l) => (
                  <div key={l.insumo_id} className="flex items-center gap-2 px-4 py-2">
                    <span className="flex-1 truncate text-sm font-medium">{l.insumo?.nombre}</span>
                    <input
                      defaultValue={String(l.cantidad_usada)}
                      inputMode="decimal"
                      onBlur={(e) => cambiarCantidad(l, e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                      aria-label={`Cantidad de ${l.insumo?.nombre}`}
                      className="cifras h-8 w-20 rounded-md border border-borde px-2 text-right text-sm outline-none focus:border-salsa"
                    />
                    <span className="w-8 text-xs text-tinta-suave">{l.insumo?.unidad_medida}</span>
                    <span className="cifras w-16 text-right text-xs text-tinta-suave">
                      {dinero(Number(l.cantidad_usada) * Number(l.insumo?.costo_unitario ?? 0))}
                    </span>
                    <BotonIcono etiqueta="Quitar" onClick={() => quitar(l)} className="hover:text-salsa">
                      <Trash2 size={15} />
                    </BotonIcono>
                  </div>
                ))
              )}
            </Tarjeta>

            <form onSubmit={agregar} className="flex flex-wrap items-end gap-2">
              <Selector
                etiqueta="Agregar insumo"
                className="min-w-40 flex-1"
                value={nuevoInsumo}
                onChange={(e) => setNuevoInsumo(e.target.value)}
              >
                <option value="">Elige…</option>
                {disponibles.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.nombre} ({i.unidad_medida})
                  </option>
                ))}
              </Selector>
              <Campo
                etiqueta="Cantidad por unidad"
                inputMode="decimal"
                className="w-36"
                value={nuevaCantidad}
                onChange={(e) => setNuevaCantidad(e.target.value)}
              />
              <Boton type="submit">
                <Plus size={16} /> Agregar
              </Boton>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

function Dato({ titulo, valor, alerta }: { titulo: string; valor: string; alerta?: boolean }) {
  return (
    <div className="rounded-xl border border-borde bg-white p-3">
      <div className="text-xs font-semibold text-tinta-suave">{titulo}</div>
      <div className={`cifras font-display text-lg font-bold ${alerta ? "text-salsa" : ""}`}>{valor}</div>
    </div>
  );
}
