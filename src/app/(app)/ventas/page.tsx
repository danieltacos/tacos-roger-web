"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Minus, Pencil, Plus, Search, ShoppingCart, Trash2 } from "lucide-react";
import { mensajeError, supabase } from "@/lib/supabase";
import { dinero } from "@/lib/formato";
import {
  METODOS_PAGO,
  type Categoria,
  type Empleado,
  type ItemCarrito,
  type MetodoPago,
  type Producto,
} from "@/lib/types";
import { Boton, BotonIcono, Cargando, Modal, Selector, Vacio, useAvisos } from "@/components/ui";

const CLAVE_CARRITO = "tacos-roger:carrito";

interface CarritoGuardado {
  items: ItemCarrito[];
  empleadoId: number | null;
  metodoPago: MetodoPago;
}

function leerCarrito(): CarritoGuardado | null {
  try {
    const crudo = localStorage.getItem(CLAVE_CARRITO);
    return crudo ? (JSON.parse(crudo) as CarritoGuardado) : null;
  } catch {
    return null;
  }
}

export default function Ventas() {
  const { avisar } = useAvisos();
  const [cargando, setCargando] = useState(true);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [empleados, setEmpleados] = useState<Empleado[]>([]);

  const [filtroCategoria, setFiltroCategoria] = useState<number | null>(null);
  const [busqueda, setBusqueda] = useState("");

  const [items, setItems] = useState<ItemCarrito[]>([]);
  const [empleadoId, setEmpleadoId] = useState<number | null>(null);
  const [metodoPago, setMetodoPago] = useState<MetodoPago>("efectivo");
  const [carritoListo, setCarritoListo] = useState(false);

  const [enviando, setEnviando] = useState(false);
  const [carritoMovil, setCarritoMovil] = useState(false);
  const [editandoPrecio, setEditandoPrecio] = useState<ItemCarrito | null>(null);
  const [precioTexto, setPrecioTexto] = useState("");

  /* --- Carga inicial --- */
  useEffect(() => {
    (async () => {
      const [p, c, e] = await Promise.all([
        supabase
          .from("producto")
          .select("id, nombre, precio, categoria_id, imagen_url, activo, categoria(nombre)")
          .eq("activo", true)
          .order("nombre"),
        supabase.from("categoria").select("id, nombre, activo").eq("activo", true).order("nombre"),
        supabase.from("empleado").select("id, nombre, activo").eq("activo", true).order("nombre"),
      ]);
      const error = p.error ?? c.error ?? e.error;
      if (error) avisar(mensajeError(error), "error");
      setProductos((p.data ?? []) as unknown as Producto[]);
      setCategorias((c.data ?? []) as Categoria[]);
      setEmpleados((e.data ?? []) as Empleado[]);
      setCargando(false);
    })();
  }, [avisar]);

  /* --- Carrito guardado en el navegador (por si se recarga la página) --- */
  useEffect(() => {
    const g = leerCarrito();
    if (g) {
      setItems(g.items ?? []);
      setEmpleadoId(g.empleadoId ?? null);
      setMetodoPago(g.metodoPago ?? "efectivo");
    }
    setCarritoListo(true);
  }, []);

  useEffect(() => {
    if (!carritoListo) return;
    try {
      localStorage.setItem(CLAVE_CARRITO, JSON.stringify({ items, empleadoId, metodoPago }));
    } catch {
      /* sin almacenamiento disponible: el carrito solo vive en memoria */
    }
  }, [items, empleadoId, metodoPago, carritoListo]);

  /* --- Derivados --- */
  const visibles = useMemo(() => {
    const b = busqueda.trim().toLowerCase();
    return productos.filter(
      (p) => (filtroCategoria === null || p.categoria_id === filtroCategoria) && (!b || p.nombre.toLowerCase().includes(b)),
    );
  }, [productos, filtroCategoria, busqueda]);

  const total = items.reduce((s, i) => s + i.precio * i.cantidad, 0);
  const piezas = items.reduce((s, i) => s + i.cantidad, 0);

  /* --- Acciones del carrito --- */
  const agregar = useCallback((p: Producto) => {
    setItems((actual) => {
      const ya = actual.find((i) => i.producto_id === p.id);
      if (ya) return actual.map((i) => (i === ya ? { ...i, cantidad: i.cantidad + 1 } : i));
      const precio = Number(p.precio);
      return [...actual, { producto_id: p.id, nombre: p.nombre, precio, precio_catalogo: precio, cantidad: 1 }];
    });
  }, []);

  const cambiarCantidad = (id: number, delta: number) =>
    setItems((a) =>
      a.map((i) => (i.producto_id === id ? { ...i, cantidad: i.cantidad + delta } : i)).filter((i) => i.cantidad > 0),
    );

  const quitar = (id: number) => setItems((a) => a.filter((i) => i.producto_id !== id));

  function abrirEditarPrecio(item: ItemCarrito) {
    setEditandoPrecio(item);
    setPrecioTexto(String(item.precio));
  }

  function guardarPrecio() {
    const valor = Number(precioTexto.replace(",", "."));
    if (!editandoPrecio || !Number.isFinite(valor) || valor < 0) {
      avisar("Escribe un precio válido", "error");
      return;
    }
    setItems((a) => a.map((i) => (i.producto_id === editandoPrecio.producto_id ? { ...i, precio: valor } : i)));
    setEditandoPrecio(null);
  }

  async function cobrar() {
    if (items.length === 0) return avisar("Agrega al menos un producto", "error");
    if (empleadoId === null) return avisar("Selecciona qué empleado hizo la venta", "error");

    setEnviando(true);
    const { data, error } = await supabase.rpc("registrar_venta", {
      p_empleado_id: empleadoId,
      p_metodo_pago: metodoPago,
      p_items: items.map((i) => ({ producto_id: i.producto_id, cantidad: i.cantidad, precio: i.precio })),
    });
    setEnviando(false);

    if (error) return avisar(mensajeError(error), "error");

    setItems([]);
    setCarritoMovil(false);
    avisar(`Venta #${data} registrada · ${dinero(total)}`);
  }

  if (cargando) return <Cargando />;

  /* --- Panel del carrito (se usa en escritorio y en la hoja del celular) --- */
  const panelCarrito = (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-2 overflow-y-auto">
        {items.length === 0 ? (
          <p className="py-8 text-center text-sm text-tinta-suave">Toca un producto para agregarlo.</p>
        ) : (
          items.map((i) => (
            <div key={i.producto_id} className="rounded-lg border border-borde bg-papel p-2.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">{i.nombre}</div>
                  <button
                    onClick={() => abrirEditarPrecio(i)}
                    className="cifras inline-flex items-center gap-1 text-xs text-tinta-suave hover:text-salsa"
                  >
                    {dinero(i.precio)} c/u
                    {i.precio !== i.precio_catalogo && <span className="font-semibold text-maiz">· especial</span>}
                    <Pencil size={11} />
                  </button>
                </div>
                <BotonIcono etiqueta={`Quitar ${i.nombre}`} onClick={() => quitar(i.producto_id)} className="size-7">
                  <Trash2 size={15} />
                </BotonIcono>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <div className="flex items-center rounded-lg border border-borde bg-white">
                  <BotonIcono etiqueta="Uno menos" onClick={() => cambiarCantidad(i.producto_id, -1)} className="size-8">
                    <Minus size={15} />
                  </BotonIcono>
                  <span className="cifras w-8 text-center text-sm font-bold">{i.cantidad}</span>
                  <BotonIcono etiqueta="Uno más" onClick={() => cambiarCantidad(i.producto_id, 1)} className="size-8">
                    <Plus size={15} />
                  </BotonIcono>
                </div>
                <span className="cifras text-sm font-bold">{dinero(i.precio * i.cantidad)}</span>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="mt-3 space-y-3 border-t border-borde pt-3">
        <Selector
          etiqueta="Empleado"
          value={empleadoId ?? ""}
          onChange={(e) => setEmpleadoId(e.target.value ? Number(e.target.value) : null)}
        >
          <option value="">Selecciona…</option>
          {empleados.map((e) => (
            <option key={e.id} value={e.id}>
              {e.nombre}
            </option>
          ))}
        </Selector>
        <div>
          <span className="text-xs font-semibold text-tinta-suave">Método de pago</span>
          <div className="mt-1 grid grid-cols-3 gap-1 rounded-lg bg-crema p-1">
            {METODOS_PAGO.map((m) => (
              <button
                key={m.valor}
                onClick={() => setMetodoPago(m.valor)}
                className={`rounded-md py-1.5 text-xs font-semibold transition ${
                  metodoPago === m.valor ? "bg-white text-salsa shadow-sm" : "text-tinta-suave"
                }`}
              >
                {m.etiqueta}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-tinta-suave">
            Total · {piezas} {piezas === 1 ? "pieza" : "piezas"}
          </span>
          <span className="cifras font-display text-3xl font-bold text-tinta">{dinero(total)}</span>
        </div>
        <Boton tamano="grande" className="w-full" onClick={cobrar} disabled={enviando || items.length === 0}>
          {enviando ? "Registrando…" : "Cobrar"}
        </Boton>
        {items.length > 0 && (
          <button onClick={() => setItems([])} className="w-full text-center text-xs font-semibold text-tinta-suave hover:text-salsa">
            Vaciar carrito
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="lg:flex lg:gap-6">
      {/* Catálogo */}
      <section className="min-w-0 flex-1">
        <div className="mb-4 flex flex-col gap-3">
          <div className="relative">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-tinta-suave" />
            <input
              type="search"
              placeholder="Buscar producto…"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="h-11 w-full rounded-xl border border-borde bg-white pl-9 pr-3 text-sm outline-none focus:border-salsa focus:ring-2 focus:ring-salsa/20"
            />
          </div>
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0">
            <Chip activo={filtroCategoria === null} onClick={() => setFiltroCategoria(null)}>
              Todo
            </Chip>
            {categorias.map((c) => (
              <Chip key={c.id} activo={filtroCategoria === c.id} onClick={() => setFiltroCategoria(c.id)}>
                {c.nombre}
              </Chip>
            ))}
          </div>
        </div>

        {visibles.length === 0 ? (
          <Vacio>{productos.length === 0 ? "No hay productos activos. Agrégalos en Productos." : "Nada coincide con la búsqueda."}</Vacio>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {visibles.map((p) => {
              const enCarrito = items.find((i) => i.producto_id === p.id)?.cantidad ?? 0;
              return (
                <button
                  key={p.id}
                  onClick={() => agregar(p)}
                  className={`group relative overflow-hidden rounded-xl border bg-white text-left transition active:scale-[0.98] ${
                    enCarrito ? "border-salsa ring-2 ring-salsa/20" : "border-borde hover:border-salsa/50"
                  }`}
                >
                  <div className="aspect-[16/10] w-full bg-crema">
                    {p.imagen_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.imagen_url} alt="" className="size-full object-cover" loading="lazy" />
                    ) : (
                      <div className="flex size-full items-center justify-center font-display text-4xl font-bold text-salsa/25">
                        {p.nombre.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="p-2.5">
                    <div className="line-clamp-2 text-sm font-semibold leading-tight">{p.nombre}</div>
                    <div className="cifras mt-1 text-sm font-bold text-salsa">{dinero(p.precio)}</div>
                  </div>
                  {enCarrito > 0 && (
                    <span className="cifras absolute right-2 top-2 flex size-7 items-center justify-center rounded-full bg-salsa text-sm font-bold text-white shadow">
                      {enCarrito}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* Carrito: columna fija en pantallas grandes */}
      <aside className="hidden w-80 shrink-0 lg:block">
        <div className="sticky top-8 flex h-[calc(100dvh-4rem)] flex-col rounded-xl border border-borde bg-white p-4">
          <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-bold">
            <ShoppingCart size={18} className="text-salsa" /> Orden
          </h2>
          {panelCarrito}
        </div>
      </aside>

      {/* Carrito: botón flotante + hoja en pantallas chicas */}
      <button
        onClick={() => setCarritoMovil(true)}
        className="fixed inset-x-4 bottom-20 z-30 flex items-center justify-between rounded-xl bg-salsa px-4 py-3 text-white shadow-lg md:bottom-6 md:left-auto md:right-8 md:w-80 lg:hidden"
      >
        <span className="flex items-center gap-2 font-semibold">
          <ShoppingCart size={18} /> Ver orden {piezas > 0 && `(${piezas})`}
        </span>
        <span className="cifras font-bold">{dinero(total)}</span>
      </button>

      <Modal abierto={carritoMovil} titulo="Orden" onCerrar={() => setCarritoMovil(false)}>
        {panelCarrito}
      </Modal>

      <Modal
        abierto={!!editandoPrecio}
        titulo={`Precio especial: ${editandoPrecio?.nombre ?? ""}`}
        onCerrar={() => setEditandoPrecio(null)}
        pie={
          <>
            <Boton variante="secundario" onClick={() => setEditandoPrecio(null)}>
              Cancelar
            </Boton>
            <Boton onClick={guardarPrecio}>Guardar</Boton>
          </>
        }
      >
        <p className="mb-3 text-sm text-tinta-suave">
          Solo cambia el precio en esta venta. El de catálogo es {dinero(editandoPrecio?.precio_catalogo)}.
        </p>
        <input
          autoFocus
          inputMode="decimal"
          value={precioTexto}
          onChange={(e) => setPrecioTexto(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && guardarPrecio()}
          className="h-12 w-full rounded-lg border border-borde px-3 text-lg outline-none focus:border-salsa focus:ring-2 focus:ring-salsa/20"
        />
      </Modal>
    </div>
  );
}

function Chip({ activo, onClick, children }: { activo: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-semibold transition ${
        activo ? "border-salsa bg-salsa text-white" : "border-borde bg-white text-tinta-suave hover:text-tinta"
      }`}
    >
      {children}
    </button>
  );
}
