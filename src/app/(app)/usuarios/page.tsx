"use client";

import { useCallback, useEffect, useState } from "react";
import { mensajeError, supabase } from "@/lib/supabase";
import { useSesion } from "@/lib/sesion";
import type { Perfil, Rol } from "@/lib/types";
import { SoloAdmin } from "@/components/SoloAdmin";
import { Cargando, Encabezado, Tarjeta, Vacio, useAvisos } from "@/components/ui";

export default function Usuarios() {
  return (
    <SoloAdmin>
      <Contenido />
    </SoloAdmin>
  );
}

function Contenido() {
  const { perfil: yo } = useSesion();
  const { avisar } = useAvisos();
  const [perfiles, setPerfiles] = useState<Perfil[]>([]);
  const [cargando, setCargando] = useState(true);

  const cargar = useCallback(async () => {
    const { data, error } = await supabase.from("perfil").select("id, email, nombre, rol").order("email");
    if (error) avisar(mensajeError(error), "error");
    setPerfiles((data ?? []) as Perfil[]);
    setCargando(false);
  }, [avisar]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function cambiarRol(p: Perfil, rol: Rol) {
    const { error } = await supabase.from("perfil").update({ rol }).eq("id", p.id);
    if (error) return avisar(mensajeError(error), "error");
    avisar(`${p.email} ahora es ${rol === "admin" ? "administrador" : "cajero"}`);
    cargar();
  }

  async function cambiarNombre(p: Perfil, nombre: string) {
    if (nombre.trim() === (p.nombre ?? "")) return;
    const { error } = await supabase.from("perfil").update({ nombre: nombre.trim() || null }).eq("id", p.id);
    if (error) return avisar(mensajeError(error), "error");
    cargar();
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Encabezado
        titulo="Usuarios"
        subtitulo="Quién puede entrar a la app. Las cuentas se crean en Supabase → Authentication → Users."
      />
      <div className="mb-4 rounded-xl bg-white p-4 text-sm text-tinta-suave ring-1 ring-borde">
        <b className="text-tinta">Administrador:</b> todo. <b className="text-tinta">Cajero:</b> vender, ver insumos y
        registrar compras.
      </div>
      {cargando ? (
        <Cargando />
      ) : perfiles.length === 0 ? (
        <Vacio>No hay usuarios.</Vacio>
      ) : (
        <Tarjeta className="divide-y divide-borde">
          {perfiles.map((p) => (
            <div key={p.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <input
                  defaultValue={p.nombre ?? ""}
                  placeholder="Nombre (opcional)"
                  onBlur={(e) => cambiarNombre(p, e.target.value)}
                  className="w-full bg-transparent text-sm font-semibold outline-none placeholder:font-normal placeholder:text-tinta-suave focus:underline"
                />
                <div className="truncate text-xs text-tinta-suave">{p.email}</div>
              </div>
              <select
                value={p.rol}
                disabled={p.id === yo?.id}
                title={p.id === yo?.id ? "No puedes quitarte el rol de administrador a ti mismo" : undefined}
                onChange={(e) => cambiarRol(p, e.target.value as Rol)}
                className="h-9 rounded-lg border border-borde bg-white px-2 text-sm disabled:opacity-60"
              >
                <option value="admin">Administrador</option>
                <option value="cajero">Cajero</option>
              </select>
            </div>
          ))}
        </Tarjeta>
      )}
    </div>
  );
}
