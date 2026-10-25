"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, ChevronDown } from "lucide-react";
import { mensajeError, supabase } from "@/lib/supabase";
import { dinero, fechaLarga, hora, hoy } from "@/lib/formato";
import { METODOS_PAGO, type VentaConDetalle } from "@/lib/types";
import { SoloAdmin } from "@/components/SoloAdmin";
import { Boton, Cargando, Encabezado, Etiqueta, Tarjeta, Vacio, useAvisos } from "@/components/ui";

export default function DetalleDia() {
  return (
    <SoloAdmin>
      <Suspense fallback={<Cargando />}>
        <Contenido />
      </Suspense>
    </SoloAdmin>
  );
}

const etiquetaPago = (v: string) => METODOS_PAGO.find((m) => m.valor === v)?.etiqueta ?? v;

function Contenido() {
  const params = useSearchParams();
  const fecha = /^\d{4}-\d{2}-\d{2}$/.test(params.get("fecha") ?? "") ? params.get("fecha")! : hoy();
  const { avisar, confirmar } = useAvisos();
  const [cargando, setCargando] = useState(true);
  const [ventas, setVentas] = useState<VentaConDetalle[]>([]);
  const [abierta, setAbierta] = useState<number | null>(null);
  const [cancelando, setCancelando] = useState<number | null>(null);

  const cargar = useCallback(async () => {
    const { data, error } = await supabase
      .rpc("ventas_del_dia", { p_dia: fecha })
      .select(
        "id, fecha, total, metodo_pago, cancelada, empleado(nombre), detalle_venta(id, cantidad, subtotal, producto(nombre))",
      );
    if (error) avisar(mensajeError(error), "error");
    setVentas((data ?? []) as unknown as VentaConDetalle[]);
    setCargando(false);
  }, [fecha, avisar]);

  useEffect(() => {
    setCargando(true);
    cargar();
  }, [cargar]);

  async function cancelar(v: VentaConDetalle) {
    const ok = await confirmar({
      titulo: `¿Cancelar la venta #${v.id}?`,
      mensaje: `Se devolverá al inventario lo que se descontó y dejará de contar en los reportes (${dinero(v.total)}). La venta queda en el historial marcada como cancelada.`,
      textoConfirmar: "Sí, cancelar venta",
      peligro: true,
    });
    if (!ok) return;
    setCancelando(v.id);
    const { error } = await supabase.rpc("cancelar_venta", { p_venta_id: v.id });
    setCancelando(null);
    if (error) return avisar(mensajeError(error), "error");
    avisar(`Venta #${v.id} cancelada e inventario devuelto`);
    cargar();
  }

  const validas = ventas.filter((v) => !v.cancelada);
  const total = validas.reduce((s, v) => s + Number(v.total), 0);
  const porMetodo = METODOS_PAGO.map((m) => ({
    ...m,
    total: validas.filter((v) => v.metodo_pago === m.valor).reduce((s, v) => s + Number(v.total), 0),
  })).filter((m) => m.total > 0);

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/reportes/" className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-tinta-suave hover:text-salsa">
        <ArrowLeft size={16} /> Reportes
      </Link>
      <Encabezado titulo={fechaLarga(fecha)} />

      {cargando ? (
        <Cargando />
      ) : (
        <>
          <div className="mb-5 rounded-xl bg-salsa p-5 text-white">
            <div className="text-sm text-white/80">Total del día</div>
            <div className="cifras font-display text-4xl font-bold">{dinero(total)}</div>
            <div className="mt-1 text-sm text-white/80">
              {validas.length} {validas.length === 1 ? "venta" : "ventas"}
              {ventas.length > validas.length && ` · ${ventas.length - validas.length} cancelada(s)`}
            </div>
            {porMetodo.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {porMetodo.map((m) => (
                  <span key={m.valor} className="cifras rounded-full bg-white/15 px-2.5 py-1 text-xs font-semibold">
                    {m.etiqueta}: {dinero(m.total)}
                  </span>
                ))}
              </div>
            )}
          </div>

          {ventas.length === 0 ? (
            <Vacio>No hubo ventas este día.</Vacio>
          ) : (
            <Tarjeta className="divide-y divide-borde">
              {ventas.map((v) => {
                const expandida = abierta === v.id;
                const piezas = v.detalle_venta.reduce((s, d) => s + d.cantidad, 0);
                return (
                  <div key={v.id} className={v.cancelada ? "bg-gray-50" : ""}>
                    <button
                      onClick={() => setAbierta(expandida ? null : v.id)}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left"
                    >
                      <span className="cifras w-20 shrink-0 text-sm font-semibold">{hora(v.fecha)}</span>
                      <div className="min-w-0 flex-1">
                        <div className={`truncate text-sm ${v.cancelada ? "text-gray-400 line-through" : "font-semibold"}`}>
                          #{v.id} · {v.empleado?.nombre ?? "Sin empleado"}
                        </div>
                        <div className="text-xs text-tinta-suave">
                          {piezas} {piezas === 1 ? "pieza" : "piezas"} · {etiquetaPago(v.metodo_pago)}
                        </div>
                      </div>
                      {v.cancelada && <Etiqueta tono="apagado">Cancelada</Etiqueta>}
                      <span className={`cifras font-bold ${v.cancelada ? "text-gray-400 line-through" : ""}`}>
                        {dinero(v.total)}
                      </span>
                      <ChevronDown size={16} className={`text-tinta-suave transition ${expandida ? "rotate-180" : ""}`} />
                    </button>
                    {expandida && (
                      <div className="px-4 pb-4 pl-[6.5rem]">
                        <ul className="space-y-1 text-sm">
                          {v.detalle_venta.map((d) => (
                            <li key={d.id} className="flex justify-between gap-2">
                              <span>
                                <span className="cifras font-semibold">{d.cantidad}×</span> {d.producto?.nombre ?? "Producto eliminado"}
                              </span>
                              <span className="cifras text-tinta-suave">{dinero(d.subtotal)}</span>
                            </li>
                          ))}
                        </ul>
                        {!v.cancelada && (
                          <Boton
                            variante="peligro"
                            tamano="chico"
                            className="mt-3"
                            disabled={cancelando === v.id}
                            onClick={() => cancelar(v)}
                          >
                            {cancelando === v.id ? "Cancelando…" : "Cancelar venta"}
                          </Boton>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </Tarjeta>
          )}
        </>
      )}
    </div>
  );
}
