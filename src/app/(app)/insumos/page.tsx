"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, History, Pencil, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { mensajeError, supabase } from "@/lib/supabase";
import { dinero, fechaHora, numero } from "@/lib/formato";
import { useSesion } from "@/lib/sesion";
import type { Insumo, Movimiento } from "@/lib/types";
import {
  Boton,
  BotonIcono,
  Campo,
  Cargando,
  Encabezado,
  Etiqueta,
  Modal,
  Tarjeta,
  Vacio,
  useAvisos,
} from "@/components/ui";

interface Formulario {
  id: number | null;
  nombre: string;
  unidad_medida: string;
  stock_actual: string;
  stock_minimo: string;
  costo_unitario: string;
}

const num = (s: string) => Number(s.replace(",", "."));

export default function Insumos() {
  const { esAdmin } = useSesion();
  const { avisar, confirmar } = useAvisos();
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [cargando, setCargando] = useState(true);
  const [soloBajos, setSoloBajos] = useState(false);

  const [form, setForm] = useState<Formulario | null>(null);
  const [compra, setCompra] = useState<{ insumo: Insumo; cantidad: string; costo: string } | null>(null);
  const [historial, setHistorial] = useState<{ insumo: Insumo; movs: Movimiento[] | null } | null>(null);
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    let q = supabase
      .from("insumo")
      .select("id, nombre, unidad_medida, stock_actual, stock_minimo, costo_unitario, activo")
      .order("nombre");
    if (!esAdmin) q = q.eq("activo", true);
    const { data, error } = await q;
    if (error) avisar(mensajeError(error), "error");
    setInsumos(
      ((data ?? []) as Insumo[]).map((i) => ({
        ...i,
        stock_actual: Number(i.stock_actual),
        stock_minimo: Number(i.stock_minimo),
        costo_unitario: Number(i.costo_unitario ?? 0),
      })),
    );
    setCargando(false);
  }, [esAdmin, avisar]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const bajo = (i: Insumo) => i.activo && i.stock_actual <= i.stock_minimo;
  const bajos = insumos.filter(bajo);
  const lista = soloBajos ? bajos : insumos;

  /* --- Alta / edición (admin) --- */
  async function guardar() {
    if (!form) return;
    const stockMinimo = num(form.stock_minimo);
    const costo = form.costo_unitario.trim() ? num(form.costo_unitario) : 0;
    const stockActual = num(form.stock_actual);
    if (!form.nombre.trim() || !form.unidad_medida.trim()) return avisar("Completa nombre y unidad", "error");
    if (![stockMinimo, costo].every(Number.isFinite) || (!form.id && !Number.isFinite(stockActual)))
      return avisar("Revisa que las cantidades sean números", "error");

    setGuardando(true);
    const datos = {
      nombre: form.nombre.trim(),
      unidad_medida: form.unidad_medida.trim(),
      stock_minimo: stockMinimo,
      costo_unitario: costo,
    };
    const { error } = form.id
      ? await supabase.from("insumo").update(datos).eq("id", form.id)
      : await supabase.from("insumo").insert({ ...datos, stock_actual: stockActual });
    setGuardando(false);
    if (error) return avisar(mensajeError(error), "error");
    avisar(form.id ? "Insumo actualizado" : "Insumo agregado");
    setForm(null);
    cargar();
  }

  async function borrar(i: Insumo) {
    const ok = await confirmar({
      titulo: `¿Borrar "${i.nombre}"?`,
      mensaje: "Si se usa en alguna receta o tiene movimientos, se desactivará en lugar de borrarse.",
      textoConfirmar: "Borrar",
      peligro: true,
    });
    if (!ok) return;
    const { error } = await supabase.from("insumo").delete().eq("id", i.id);
    if (error?.code === "23503") {
      await supabase.from("insumo").update({ activo: false }).eq("id", i.id);
      avisar(`"${i.nombre}" tiene historial, así que se desactivó`);
    } else if (error) {
      avisar(mensajeError(error), "error");
    } else {
      avisar(`"${i.nombre}" borrado`);
    }
    cargar();
  }

  async function alternarActivo(i: Insumo) {
    const { error } = await supabase.from("insumo").update({ activo: !i.activo }).eq("id", i.id);
    if (error) return avisar(mensajeError(error), "error");
    cargar();
  }

  /* --- Compra (todos) --- */
  async function registrarCompra() {
    if (!compra) return;
    const cantidad = num(compra.cantidad);
    const costo = compra.costo.trim() ? num(compra.costo) : null;
    if (!Number.isFinite(cantidad) || cantidad <= 0) return avisar("Escribe cuánto se compró", "error");
    if (costo !== null && (!Number.isFinite(costo) || costo < 0)) return avisar("El costo no es válido", "error");

    setGuardando(true);
    const { error } = await supabase.rpc("registrar_compra", {
      p_insumo_id: compra.insumo.id,
      p_cantidad: cantidad,
      p_costo_unitario: costo,
    });
    setGuardando(false);
    if (error) return avisar(mensajeError(error), "error");
    avisar(`+${numero(cantidad)} ${compra.insumo.unidad_medida} de ${compra.insumo.nombre}`);
    setCompra(null);
    cargar();
  }

  /* --- Historial --- */
  async function verHistorial(i: Insumo) {
    setHistorial({ insumo: i, movs: null });
    const { data, error } = await supabase
      .from("movimiento_inventario")
      .select("*")
      .eq("insumo_id", i.id)
      .order("fecha", { ascending: false })
      .limit(50);
    if (error) avisar(mensajeError(error), "error");
    setHistorial({ insumo: i, movs: (data ?? []) as Movimiento[] });
  }

  return (
    <div className="mx-auto max-w-4xl">
      <Encabezado
        titulo="Insumos"
        subtitulo="Inventario de lo que se usa para preparar."
        acciones={
          esAdmin && (
            <Boton
              onClick={() =>
                setForm({ id: null, nombre: "", unidad_medida: "", stock_actual: "", stock_minimo: "", costo_unitario: "" })
              }
            >
              <Plus size={16} /> Nuevo insumo
            </Boton>
          )
        }
      />

      {bajos.length > 0 && (
        <button
          onClick={() => setSoloBajos(!soloBajos)}
          className="mb-4 flex w-full items-center gap-3 rounded-xl border border-salsa/30 bg-salsa-suave px-4 py-3 text-left text-sm text-salsa-oscura"
        >
          <AlertTriangle size={18} className="shrink-0" />
          <span className="flex-1">
            <b>{bajos.length}</b> {bajos.length === 1 ? "insumo está" : "insumos están"} en o por debajo del mínimo.
          </span>
          <span className="font-semibold underline">{soloBajos ? "Ver todos" : "Ver solo esos"}</span>
        </button>
      )}

      {cargando ? (
        <Cargando />
      ) : lista.length === 0 ? (
        <Vacio>Todavía no hay insumos.</Vacio>
      ) : (
        <Tarjeta className="divide-y divide-borde">
          {lista.map((i) => {
            const pct = i.stock_minimo > 0 ? Math.min(100, (i.stock_actual / (i.stock_minimo * 3)) * 100) : 100;
            return (
              <div key={i.id} className={`flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 ${i.activo ? "" : "opacity-50"}`}>
                <div className="min-w-0 flex-1 basis-48">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-semibold">{i.nombre}</span>
                    {bajo(i) && <Etiqueta tono="alerta">Bajo</Etiqueta>}
                    {!i.activo && <Etiqueta tono="apagado">Inactivo</Etiqueta>}
                  </div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="h-1.5 w-28 overflow-hidden rounded-full bg-crema">
                      <div className={`h-full rounded-full ${bajo(i) ? "bg-salsa" : "bg-cilantro"}`} style={{ width: `${Math.max(3, pct)}%` }} />
                    </div>
                    <span className="cifras text-xs text-tinta-suave">
                      mín. {numero(i.stock_minimo)} · {dinero(i.costo_unitario)}/{i.unidad_medida}
                    </span>
                  </div>
                </div>
                <div className={`cifras text-right font-display text-lg font-bold ${bajo(i) ? "text-salsa" : ""}`}>
                  {numero(i.stock_actual)} <span className="text-xs font-normal text-tinta-suave">{i.unidad_medida}</span>
                </div>
                <div className="flex items-center">
                  {i.activo && (
                    <Boton
                      variante="secundario"
                      tamano="chico"
                      onClick={() => setCompra({ insumo: i, cantidad: "", costo: "" })}
                      className="mr-1"
                    >
                      <ShoppingBag size={14} /> Compra
                    </Boton>
                  )}
                  <BotonIcono etiqueta="Historial" onClick={() => verHistorial(i)}>
                    <History size={16} />
                  </BotonIcono>
                  {esAdmin && (
                    <>
                      <BotonIcono
                        etiqueta="Editar"
                        onClick={() =>
                          setForm({
                            id: i.id,
                            nombre: i.nombre,
                            unidad_medida: i.unidad_medida,
                            stock_actual: String(i.stock_actual),
                            stock_minimo: String(i.stock_minimo),
                            costo_unitario: String(i.costo_unitario),
                          })
                        }
                      >
                        <Pencil size={16} />
                      </BotonIcono>
                      <BotonIcono etiqueta="Borrar" onClick={() => borrar(i)} className="hover:text-salsa">
                        <Trash2 size={16} />
                      </BotonIcono>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </Tarjeta>
      )}

      {/* Alta / edición */}
      <Modal
        abierto={!!form}
        titulo={form?.id ? "Editar insumo" : "Nuevo insumo"}
        onCerrar={() => setForm(null)}
        pie={
          <>
            {form?.id && (
              <Boton
                variante="fantasma"
                className="mr-auto"
                onClick={() => {
                  const i = insumos.find((x) => x.id === form.id);
                  setForm(null);
                  if (i) alternarActivo(i);
                }}
              >
                {insumos.find((x) => x.id === form.id)?.activo ? "Desactivar" : "Activar"}
              </Boton>
            )}
            <Boton variante="secundario" onClick={() => setForm(null)}>
              Cancelar
            </Boton>
            <Boton onClick={guardar} disabled={guardando}>
              Guardar
            </Boton>
          </>
        }
      >
        {form && (
          <div className="grid grid-cols-2 gap-3">
            <Campo className="col-span-2" etiqueta="Nombre" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
            <Campo
              etiqueta="Unidad"
              placeholder="kg, pz, L…"
              value={form.unidad_medida}
              onChange={(e) => setForm({ ...form, unidad_medida: e.target.value })}
            />
            <Campo
              etiqueta="Costo por unidad"
              inputMode="decimal"
              value={form.costo_unitario}
              onChange={(e) => setForm({ ...form, costo_unitario: e.target.value })}
            />
            {!form.id && (
              <Campo
                etiqueta="Stock inicial"
                inputMode="decimal"
                value={form.stock_actual}
                onChange={(e) => setForm({ ...form, stock_actual: e.target.value })}
              />
            )}
            <Campo
              etiqueta="Stock mínimo"
              inputMode="decimal"
              ayuda="Avisa cuando llegue aquí"
              value={form.stock_minimo}
              onChange={(e) => setForm({ ...form, stock_minimo: e.target.value })}
            />
            {form.id && (
              <p className="col-span-2 text-xs text-tinta-suave">
                El stock no se edita a mano: cambia con las ventas y con «Compra», para que el historial cuadre.
              </p>
            )}
          </div>
        )}
      </Modal>

      {/* Compra */}
      <Modal
        abierto={!!compra}
        titulo={`Compra: ${compra?.insumo.nombre ?? ""}`}
        onCerrar={() => setCompra(null)}
        pie={
          <>
            <Boton variante="secundario" onClick={() => setCompra(null)}>
              Cancelar
            </Boton>
            <Boton onClick={registrarCompra} disabled={guardando}>
              Registrar compra
            </Boton>
          </>
        }
      >
        {compra && (
          <div className="space-y-3">
            <p className="text-sm text-tinta-suave">
              Hay {numero(compra.insumo.stock_actual)} {compra.insumo.unidad_medida}. Lo que registres se suma al stock.
            </p>
            <Campo
              etiqueta={`Cantidad comprada (${compra.insumo.unidad_medida})`}
              inputMode="decimal"
              autoFocus
              value={compra.cantidad}
              onChange={(e) => setCompra({ ...compra, cantidad: e.target.value })}
              onKeyDown={(e) => e.key === "Enter" && registrarCompra()}
            />
            <Campo
              etiqueta="Nuevo costo por unidad (opcional)"
              inputMode="decimal"
              placeholder={`Actual: ${dinero(compra.insumo.costo_unitario)}`}
              ayuda="Si el precio cambió, ponlo aquí y se actualiza el cálculo de ganancia."
              value={compra.costo}
              onChange={(e) => setCompra({ ...compra, costo: e.target.value })}
            />
          </div>
        )}
      </Modal>

      {/* Historial */}
      <Modal abierto={!!historial} titulo={`Movimientos: ${historial?.insumo.nombre ?? ""}`} onCerrar={() => setHistorial(null)}>
        {!historial?.movs ? (
          <Cargando />
        ) : historial.movs.length === 0 ? (
          <p className="py-6 text-center text-sm text-tinta-suave">Sin movimientos registrados.</p>
        ) : (
          <ul className="divide-y divide-borde text-sm">
            {historial.movs.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-2 py-2">
                <div>
                  <div className="font-medium">
                    {m.nota ?? (m.tipo === "entrada" ? "Entrada" : m.venta_id ? `Venta #${m.venta_id}` : "Venta")}
                  </div>
                  <div className="text-xs text-tinta-suave">{fechaHora(m.fecha)}</div>
                </div>
                <span className={`cifras font-bold ${m.tipo === "entrada" ? "text-cilantro" : "text-salsa"}`}>
                  {m.tipo === "entrada" ? "+" : "−"}
                  {numero(m.cantidad)} {historial.insumo.unidad_medida}
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-center text-xs text-tinta-suave">Últimos 50 movimientos</p>
      </Modal>
    </div>
  );
}
