"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { mensajeError, supabase } from "@/lib/supabase";
import { Boton, BotonIcono, Campo, Cargando, Encabezado, Etiqueta, Modal, Tarjeta, Vacio, useAvisos } from "./ui";
import { SoloAdmin } from "./SoloAdmin";

interface Fila {
  id: number;
  nombre: string;
  activo: boolean;
}

/**
 * Pantalla de catálogo de solo "nombre" (Categorías y Empleados):
 * agregar, renombrar, activar/desactivar y borrar (si no tiene historial).
 */
export function CatalogoSimple({
  tabla,
  titulo,
  singular,
  descripcion,
}: {
  tabla: "categoria" | "empleado";
  titulo: string;
  singular: string;
  descripcion: string;
}) {
  return (
    <SoloAdmin>
      <Contenido tabla={tabla} titulo={titulo} singular={singular} descripcion={descripcion} />
    </SoloAdmin>
  );
}

function Contenido({ tabla, titulo, singular, descripcion }: { tabla: string; titulo: string; singular: string; descripcion: string }) {
  const { avisar, confirmar } = useAvisos();
  const [filas, setFilas] = useState<Fila[]>([]);
  const [cargando, setCargando] = useState(true);
  const [nuevo, setNuevo] = useState("");
  const [editando, setEditando] = useState<Fila | null>(null);
  const [nombreEdit, setNombreEdit] = useState("");

  const cargar = useCallback(async () => {
    const { data, error } = await supabase.from(tabla).select("id, nombre, activo").order("nombre");
    if (error) avisar(mensajeError(error), "error");
    setFilas((data ?? []) as Fila[]);
    setCargando(false);
  }, [tabla, avisar]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function agregar(e: FormEvent) {
    e.preventDefault();
    const nombre = nuevo.trim();
    if (!nombre) return;
    const { error } = await supabase.from(tabla).insert({ nombre });
    if (error) return avisar(mensajeError(error), "error");
    setNuevo("");
    avisar(`${singular} agregado`);
    cargar();
  }

  async function guardarEdicion() {
    if (!editando || !nombreEdit.trim()) return;
    const { error } = await supabase.from(tabla).update({ nombre: nombreEdit.trim() }).eq("id", editando.id);
    if (error) return avisar(mensajeError(error), "error");
    setEditando(null);
    cargar();
  }

  async function alternarActivo(f: Fila) {
    const { error } = await supabase.from(tabla).update({ activo: !f.activo }).eq("id", f.id);
    if (error) return avisar(mensajeError(error), "error");
    cargar();
  }

  async function borrar(f: Fila) {
    const ok = await confirmar({
      titulo: `¿Borrar "${f.nombre}"?`,
      mensaje: "Si ya tiene historial no se podrá borrar; en ese caso se desactivará para que deje de aparecer.",
      textoConfirmar: "Borrar",
      peligro: true,
    });
    if (!ok) return;
    const { error } = await supabase.from(tabla).delete().eq("id", f.id);
    if (error?.code === "23503") {
      await supabase.from(tabla).update({ activo: false }).eq("id", f.id);
      avisar(`"${f.nombre}" tiene historial, así que se desactivó en lugar de borrarse`);
    } else if (error) {
      avisar(mensajeError(error), "error");
    } else {
      avisar(`"${f.nombre}" borrado`);
    }
    cargar();
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Encabezado titulo={titulo} subtitulo={descripcion} />

      <form onSubmit={agregar} className="mb-5 flex gap-2">
        <Campo
          className="flex-1"
          placeholder={`Nombre del nuevo ${singular.toLowerCase()}`}
          value={nuevo}
          onChange={(e) => setNuevo(e.target.value)}
        />
        <Boton type="submit" disabled={!nuevo.trim()}>
          <Plus size={16} /> Agregar
        </Boton>
      </form>

      {cargando ? (
        <Cargando />
      ) : filas.length === 0 ? (
        <Vacio>Todavía no hay registros.</Vacio>
      ) : (
        <Tarjeta className="divide-y divide-borde">
          {filas.map((f) => (
            <div key={f.id} className="flex items-center gap-2 px-4 py-2.5">
              <span className={`flex-1 text-sm font-medium ${f.activo ? "" : "text-gray-400"}`}>{f.nombre}</span>
              <button onClick={() => alternarActivo(f)} title={f.activo ? "Desactivar" : "Activar"}>
                <Etiqueta tono={f.activo ? "ok" : "apagado"}>{f.activo ? "Activo" : "Inactivo"}</Etiqueta>
              </button>
              <BotonIcono
                etiqueta="Editar"
                onClick={() => {
                  setEditando(f);
                  setNombreEdit(f.nombre);
                }}
              >
                <Pencil size={16} />
              </BotonIcono>
              <BotonIcono etiqueta="Borrar" onClick={() => borrar(f)} className="hover:text-salsa">
                <Trash2 size={16} />
              </BotonIcono>
            </div>
          ))}
        </Tarjeta>
      )}

      <Modal
        abierto={!!editando}
        titulo={`Editar ${singular.toLowerCase()}`}
        onCerrar={() => setEditando(null)}
        pie={
          <>
            <Boton variante="secundario" onClick={() => setEditando(null)}>
              Cancelar
            </Boton>
            <Boton onClick={guardarEdicion}>Guardar</Boton>
          </>
        }
      >
        <Campo
          etiqueta="Nombre"
          autoFocus
          value={nombreEdit}
          onChange={(e) => setNombreEdit(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && guardarEdicion()}
        />
      </Modal>
    </div>
  );
}
