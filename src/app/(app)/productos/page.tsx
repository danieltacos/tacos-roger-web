"use client";

import { useCallback, useEffect, useState } from "react";
import { ImagePlus, Pencil, Plus, Trash2 } from "lucide-react";
import { BUCKET_FOTOS, mensajeError, supabase } from "@/lib/supabase";
import { dinero } from "@/lib/formato";
import type { Categoria, Producto } from "@/lib/types";
import { SoloAdmin } from "@/components/SoloAdmin";
import {
  Boton,
  BotonIcono,
  Campo,
  Cargando,
  Encabezado,
  Etiqueta,
  Modal,
  Selector,
  Tarjeta,
  Vacio,
  useAvisos,
} from "@/components/ui";

interface Formulario {
  id: number | null;
  nombre: string;
  precio: string;
  categoria_id: string;
  imagen_url: string | null;
  archivo: File | null;
  vistaPrevia: string | null;
}

const VACIO: Formulario = { id: null, nombre: "", precio: "", categoria_id: "", imagen_url: null, archivo: null, vistaPrevia: null };

export default function Productos() {
  return (
    <SoloAdmin>
      <Contenido />
    </SoloAdmin>
  );
}

function Contenido() {
  const { avisar, confirmar } = useAvisos();
  const [productos, setProductos] = useState<Producto[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [cargando, setCargando] = useState(true);
  const [form, setForm] = useState<Formulario | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [verInactivos, setVerInactivos] = useState(false);

  const cargar = useCallback(async () => {
    const [p, c] = await Promise.all([
      supabase
        .from("producto")
        .select("id, nombre, precio, categoria_id, imagen_url, activo, categoria(nombre)")
        .order("nombre"),
      supabase.from("categoria").select("id, nombre, activo").order("nombre"),
    ]);
    const error = p.error ?? c.error;
    if (error) avisar(mensajeError(error), "error");
    setProductos((p.data ?? []) as unknown as Producto[]);
    setCategorias((c.data ?? []) as Categoria[]);
    setCargando(false);
  }, [avisar]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  function abrir(p?: Producto) {
    setForm(
      p
        ? {
            id: p.id,
            nombre: p.nombre,
            precio: String(p.precio),
            categoria_id: p.categoria_id ? String(p.categoria_id) : "",
            imagen_url: p.imagen_url,
            archivo: null,
            vistaPrevia: p.imagen_url,
          }
        : VACIO,
    );
  }

  function elegirFoto(archivo: File | undefined) {
    if (!archivo || !form) return;
    if (archivo.size > 5 * 1024 * 1024) return avisar("La foto pesa más de 5 MB", "error");
    setForm({ ...form, archivo, vistaPrevia: URL.createObjectURL(archivo) });
  }

  async function subirFoto(archivo: File): Promise<string> {
    const ext = archivo.name.split(".").pop()?.toLowerCase() || "jpg";
    const ruta = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await supabase.storage.from(BUCKET_FOTOS).upload(ruta, archivo, { contentType: archivo.type });
    if (error) throw error;
    return supabase.storage.from(BUCKET_FOTOS).getPublicUrl(ruta).data.publicUrl;
  }

  async function guardar() {
    if (!form) return;
    const precio = Number(form.precio.replace(",", "."));
    if (!form.nombre.trim() || !form.categoria_id) return avisar("Completa nombre y categoría", "error");
    if (!Number.isFinite(precio) || precio < 0) return avisar("El precio debe ser un número (ej. 25.50)", "error");

    setGuardando(true);
    try {
      const imagen_url = form.archivo ? await subirFoto(form.archivo) : form.imagen_url;
      const datos = { nombre: form.nombre.trim(), precio, categoria_id: Number(form.categoria_id), imagen_url };
      const { error } = form.id
        ? await supabase.from("producto").update(datos).eq("id", form.id)
        : await supabase.from("producto").insert({ ...datos, activo: true });
      if (error) throw error;
      avisar(form.id ? "Producto actualizado" : "Producto agregado");
      setForm(null);
      cargar();
    } catch (e) {
      avisar(mensajeError(e), "error");
    } finally {
      setGuardando(false);
    }
  }

  async function alternarActivo(p: Producto) {
    const { error } = await supabase.from("producto").update({ activo: !p.activo }).eq("id", p.id);
    if (error) return avisar(mensajeError(error), "error");
    cargar();
  }

  async function borrar(p: Producto) {
    const ok = await confirmar({
      titulo: `¿Borrar "${p.nombre}"?`,
      mensaje: "Si ya se vendió o tiene receta no se puede borrar; en ese caso se desactivará y dejará de aparecer en Ventas.",
      textoConfirmar: "Borrar",
      peligro: true,
    });
    if (!ok) return;
    const { error } = await supabase.from("producto").delete().eq("id", p.id);
    if (error?.code === "23503") {
      await supabase.from("producto").update({ activo: false }).eq("id", p.id);
      avisar(`"${p.nombre}" tiene historial, así que se desactivó`);
    } else if (error) {
      avisar(mensajeError(error), "error");
    } else {
      avisar(`"${p.nombre}" borrado`);
    }
    cargar();
  }

  const lista = productos.filter((p) => verInactivos || p.activo);
  const inactivos = productos.length - productos.filter((p) => p.activo).length;

  return (
    <div className="mx-auto max-w-4xl">
      <Encabezado
        titulo="Productos"
        subtitulo="Lo que se vende: nombre, precio, categoría y foto."
        acciones={
          <Boton onClick={() => abrir()}>
            <Plus size={16} /> Nuevo producto
          </Boton>
        }
      />

      {inactivos > 0 && (
        <label className="mb-3 flex items-center gap-2 text-sm text-tinta-suave">
          <input type="checkbox" checked={verInactivos} onChange={(e) => setVerInactivos(e.target.checked)} className="accent-salsa" />
          Mostrar inactivos ({inactivos})
        </label>
      )}

      {cargando ? (
        <Cargando />
      ) : lista.length === 0 ? (
        <Vacio>Todavía no hay productos.</Vacio>
      ) : (
        <Tarjeta className="divide-y divide-borde">
          {lista.map((p) => (
            <div key={p.id} className="flex items-center gap-3 px-3 py-2.5">
              <div className="size-12 shrink-0 overflow-hidden rounded-lg bg-crema">
                {p.imagen_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.imagen_url} alt="" className="size-full object-cover" />
                ) : (
                  <div className="flex size-full items-center justify-center font-display font-bold text-salsa/30">
                    {p.nombre.charAt(0)}
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className={`truncate text-sm font-semibold ${p.activo ? "" : "text-gray-400"}`}>{p.nombre}</div>
                <div className="text-xs text-tinta-suave">{p.categoria?.nombre ?? "Sin categoría"}</div>
              </div>
              <span className="cifras text-sm font-bold">{dinero(p.precio)}</span>
              <button onClick={() => alternarActivo(p)} title={p.activo ? "Desactivar" : "Activar"} className="hidden sm:block">
                <Etiqueta tono={p.activo ? "ok" : "apagado"}>{p.activo ? "Activo" : "Inactivo"}</Etiqueta>
              </button>
              <BotonIcono etiqueta="Editar" onClick={() => abrir(p)}>
                <Pencil size={16} />
              </BotonIcono>
              <BotonIcono etiqueta="Borrar" onClick={() => borrar(p)} className="hover:text-salsa">
                <Trash2 size={16} />
              </BotonIcono>
            </div>
          ))}
        </Tarjeta>
      )}

      <Modal
        abierto={!!form}
        titulo={form?.id ? "Editar producto" : "Nuevo producto"}
        onCerrar={() => setForm(null)}
        pie={
          <>
            <Boton variante="secundario" onClick={() => setForm(null)}>
              Cancelar
            </Boton>
            <Boton onClick={guardar} disabled={guardando}>
              {guardando ? "Guardando…" : "Guardar"}
            </Boton>
          </>
        }
      >
        {form && (
          <div className="space-y-3">
            <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-borde p-3 hover:border-salsa">
              <div className="size-16 shrink-0 overflow-hidden rounded-lg bg-crema">
                {form.vistaPrevia ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={form.vistaPrevia} alt="" className="size-full object-cover" />
                ) : (
                  <div className="flex size-full items-center justify-center text-tinta-suave">
                    <ImagePlus size={22} />
                  </div>
                )}
              </div>
              <span className="text-sm font-semibold text-tinta-suave">{form.vistaPrevia ? "Cambiar foto" : "Agregar foto"}</span>
              <input type="file" accept="image/*" className="hidden" onChange={(e) => elegirFoto(e.target.files?.[0])} />
            </label>
            <Campo etiqueta="Nombre" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
            <div className="grid grid-cols-2 gap-3">
              <Campo
                etiqueta="Precio"
                inputMode="decimal"
                value={form.precio}
                onChange={(e) => setForm({ ...form, precio: e.target.value })}
              />
              <Selector
                etiqueta="Categoría"
                value={form.categoria_id}
                onChange={(e) => setForm({ ...form, categoria_id: e.target.value })}
              >
                <option value="">Elige…</option>
                {categorias
                  .filter((c) => c.activo || String(c.id) === form.categoria_id)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre}
                    </option>
                  ))}
              </Selector>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
