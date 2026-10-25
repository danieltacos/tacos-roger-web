"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { mensajeError, supabase } from "@/lib/supabase";
import { dinero, diaSemanaCorto, fechaCorta, fechaLarga, hoy, inicioDeMes, numero, sumarDias } from "@/lib/formato";
import type { FilaReporteDia, FilaReporteProducto } from "@/lib/types";
import { SoloAdmin } from "@/components/SoloAdmin";
import { Campo, Cargando, Encabezado, Tarjeta, Vacio, useAvisos } from "@/components/ui";

type Rango = "hoy" | "7" | "30" | "mes" | "personalizado";

const RANGOS: { valor: Rango; etiqueta: string }[] = [
  { valor: "hoy", etiqueta: "Hoy" },
  { valor: "7", etiqueta: "7 días" },
  { valor: "30", etiqueta: "30 días" },
  { valor: "mes", etiqueta: "Este mes" },
  { valor: "personalizado", etiqueta: "Fechas…" },
];

function calcularRango(r: Rango, desde: string, hasta: string): [string, string] {
  const h = hoy();
  switch (r) {
    case "hoy":
      return [h, h];
    case "7":
      return [sumarDias(h, -6), h];
    case "30":
      return [sumarDias(h, -29), h];
    case "mes":
      return [inicioDeMes(h), h];
    default:
      return [desde, hasta];
  }
}

export default function Reportes() {
  return (
    <SoloAdmin>
      <ContenidoReportes />
    </SoloAdmin>
  );
}

function ContenidoReportes() {
  const { avisar } = useAvisos();
  const [rango, setRango] = useState<Rango>("7");
  const [desdeP, setDesdeP] = useState(sumarDias(hoy(), -6));
  const [hastaP, setHastaP] = useState(hoy());
  const [vista, setVista] = useState<"dias" | "productos">("dias");

  const [cargando, setCargando] = useState(true);
  const [dias, setDias] = useState<FilaReporteDia[]>([]);
  const [productos, setProductos] = useState<FilaReporteProducto[]>([]);

  const [desde, hasta] = calcularRango(rango, desdeP, hastaP);

  useEffect(() => {
    let vigente = true;
    (async () => {
      setCargando(true);
      const [d, p] = await Promise.all([
        supabase.rpc("reporte_ventas_por_dia", { p_desde: desde, p_hasta: hasta }),
        supabase.rpc("reporte_productos", { p_desde: desde, p_hasta: hasta }),
      ]);
      if (!vigente) return;
      const error = d.error ?? p.error;
      if (error) avisar(mensajeError(error), "error");
      setDias(((d.data ?? []) as FilaReporteDia[]).map((f) => ({ ...f, total: +f.total, costo: +f.costo, ganancia: +f.ganancia, num_ventas: +f.num_ventas })));
      setProductos(((p.data ?? []) as FilaReporteProducto[]).map((f) => ({ ...f, cantidad: +f.cantidad, importe: +f.importe })));
      setCargando(false);
    })();
    return () => {
      vigente = false;
    };
  }, [desde, hasta, avisar]);

  const resumen = useMemo(() => {
    const total = dias.reduce((s, d) => s + d.total, 0);
    const costo = dias.reduce((s, d) => s + d.costo, 0);
    const ventas = dias.reduce((s, d) => s + d.num_ventas, 0);
    return { total, costo, ganancia: total - costo, ventas, ticket: ventas ? total / ventas : 0 };
  }, [dias]);

  // Para la gráfica: todos los días del rango, aunque no haya ventas (máx. 31 barras)
  const serie = useMemo(() => {
    const porDia = new Map(dias.map((d) => [d.dia, d]));
    const lista: { dia: string; total: number; ganancia: number }[] = [];
    let d = desde;
    while (d <= hasta && lista.length < 62) {
      const f = porDia.get(d);
      lista.push({ dia: d, total: f?.total ?? 0, ganancia: f?.ganancia ?? 0 });
      d = sumarDias(d, 1);
    }
    return lista.slice(-31);
  }, [dias, desde, hasta]);

  const maximo = Math.max(1, ...serie.map((s) => s.total));
  const maxProducto = Math.max(1, ...productos.map((p) => p.cantidad));

  return (
    <div className="mx-auto max-w-5xl">
      <Encabezado
        titulo="Reportes"
        subtitulo={desde === hasta ? fechaLarga(desde) : `${fechaLarga(desde)} → ${fechaLarga(hasta)}`}
      />

      <div className="mb-5 flex flex-wrap items-end gap-2">
        <div className="flex gap-1 overflow-x-auto rounded-lg bg-white p-1 ring-1 ring-borde">
          {RANGOS.map((r) => (
            <button
              key={r.valor}
              onClick={() => setRango(r.valor)}
              className={`shrink-0 rounded-md px-3 py-1.5 text-sm font-semibold transition ${
                rango === r.valor ? "bg-salsa text-white" : "text-tinta-suave hover:text-tinta"
              }`}
            >
              {r.etiqueta}
            </button>
          ))}
        </div>
        {rango === "personalizado" && (
          <div className="flex gap-2">
            <Campo type="date" etiqueta="Desde" value={desdeP} max={hastaP} onChange={(e) => setDesdeP(e.target.value)} />
            <Campo type="date" etiqueta="Hasta" value={hastaP} min={desdeP} onChange={(e) => setHastaP(e.target.value)} />
          </div>
        )}
      </div>

      {cargando ? (
        <Cargando />
      ) : (
        <>
          <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
            <Indicador titulo="Vendido" valor={dinero(resumen.total)} destacado />
            <Indicador titulo="Ganancia" valor={dinero(resumen.ganancia)} nota={`Costo ${dinero(resumen.costo)}`} />
            <Indicador titulo="Ventas" valor={numero(resumen.ventas, 0)} />
            <Indicador titulo="Ticket promedio" valor={dinero(resumen.ticket)} />
          </div>

          {serie.length > 1 && (
            <Tarjeta className="mb-5 p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-bold">Ventas por día</h2>
                <div className="flex gap-3 text-xs text-tinta-suave">
                  <span className="flex items-center gap-1">
                    <span className="size-2.5 rounded-sm bg-salsa/25" /> Vendido
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="size-2.5 rounded-sm bg-salsa" /> Ganancia
                  </span>
                </div>
              </div>
              <div className="flex h-40 items-end gap-1">
                {serie.map((s) => (
                  <Link
                    key={s.dia}
                    href={`/reportes/dia/?fecha=${s.dia}`}
                    title={`${fechaLarga(s.dia)} · ${dinero(s.total)} · ganancia ${dinero(s.ganancia)}`}
                    className="group relative flex h-full min-w-0 flex-1 flex-col justify-end"
                  >
                    <div
                      className="relative w-full rounded-t bg-salsa/25 transition group-hover:bg-salsa/35"
                      style={{ height: `${(s.total / maximo) * 100}%` }}
                    >
                      <div
                        className="absolute inset-x-0 bottom-0 rounded-t bg-salsa"
                        style={{ height: s.total ? `${(Math.max(0, s.ganancia) / s.total) * 100}%` : 0 }}
                      />
                    </div>
                  </Link>
                ))}
              </div>
              <div className="mt-1 flex gap-1 text-[10px] text-tinta-suave">
                {serie.map((s, i) => (
                  <div key={s.dia} className="min-w-0 flex-1 truncate text-center">
                    {serie.length <= 10 || i % Math.ceil(serie.length / 8) === 0 ? fechaCorta(s.dia) : ""}
                  </div>
                ))}
              </div>
            </Tarjeta>
          )}

          <div className="mb-3 flex gap-4 border-b border-borde">
            {(["dias", "productos"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setVista(v)}
                className={`-mb-px border-b-2 pb-2 text-sm font-semibold ${
                  vista === v ? "border-salsa text-salsa" : "border-transparent text-tinta-suave"
                }`}
              >
                {v === "dias" ? "Por día" : "Productos más vendidos"}
              </button>
            ))}
          </div>

          {vista === "dias" ? (
            dias.length === 0 ? (
              <Vacio>No hay ventas en este periodo.</Vacio>
            ) : (
              <Tarjeta className="divide-y divide-borde">
                {dias.map((d) => (
                  <Link
                    key={d.dia}
                    href={`/reportes/dia/?fecha=${d.dia}`}
                    className="flex items-center gap-3 px-4 py-3 transition hover:bg-crema"
                  >
                    <div className="w-12 shrink-0 text-center">
                      <div className="text-[11px] font-semibold uppercase text-tinta-suave">{diaSemanaCorto(d.dia)}</div>
                      <div className="font-display text-lg font-bold leading-none">{Number(d.dia.slice(8))}</div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold">{fechaLarga(d.dia)}</div>
                      <div className="text-xs text-tinta-suave">
                        {d.num_ventas} {d.num_ventas === 1 ? "venta" : "ventas"} · ganancia {dinero(d.ganancia)}
                      </div>
                    </div>
                    <div className="cifras text-right font-bold">{dinero(d.total)}</div>
                    <ChevronRight size={16} className="text-tinta-suave" />
                  </Link>
                ))}
              </Tarjeta>
            )
          ) : productos.length === 0 ? (
            <Vacio>No hay productos vendidos en este periodo.</Vacio>
          ) : (
            <Tarjeta className="divide-y divide-borde">
              {productos.map((p, i) => (
                <div key={p.producto_id} className="flex items-center gap-3 px-4 py-3">
                  <span className="cifras w-6 text-center text-sm font-bold text-tinta-suave">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex justify-between gap-2 text-sm">
                      <span className="truncate font-semibold">{p.nombre}</span>
                      <span className="cifras shrink-0 text-tinta-suave">{dinero(p.importe)}</span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-crema">
                      <div className="h-full rounded-full bg-salsa" style={{ width: `${(p.cantidad / maxProducto) * 100}%` }} />
                    </div>
                  </div>
                  <span className="cifras w-14 text-right text-sm font-bold">{numero(p.cantidad, 0)}</span>
                </div>
              ))}
            </Tarjeta>
          )}
        </>
      )}
    </div>
  );
}

function Indicador({ titulo, valor, nota, destacado }: { titulo: string; valor: string; nota?: string; destacado?: boolean }) {
  return (
    <div className={`rounded-xl p-4 ${destacado ? "bg-salsa text-white" : "border border-borde bg-white"}`}>
      <div className={`text-xs font-semibold ${destacado ? "text-white/80" : "text-tinta-suave"}`}>{titulo}</div>
      <div className="cifras mt-1 font-display text-2xl font-bold">{valor}</div>
      {nota && <div className={`mt-0.5 text-xs ${destacado ? "text-white/70" : "text-tinta-suave"}`}>{nota}</div>}
    </div>
  );
}
