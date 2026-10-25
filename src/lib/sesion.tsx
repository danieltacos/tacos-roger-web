"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import type { Perfil } from "./types";

interface EstadoSesion {
  cargando: boolean;
  sesion: Session | null;
  perfil: Perfil | null;
  esAdmin: boolean;
  salir: () => Promise<void>;
}

const Contexto = createContext<EstadoSesion | null>(null);

export function ProveedorSesion({ children }: { children: ReactNode }) {
  const [cargando, setCargando] = useState(true);
  const [sesion, setSesion] = useState<Session | null>(null);
  const [perfil, setPerfil] = useState<Perfil | null>(null);

  useEffect(() => {
    let activo = true;

    async function cargarPerfil(s: Session | null) {
      if (!s) {
        if (activo) {
          setPerfil(null);
          setCargando(false);
        }
        return;
      }
      const { data } = await supabase
        .from("perfil")
        .select("id, email, nombre, rol")
        .eq("id", s.user.id)
        .maybeSingle();
      if (activo) {
        setPerfil(data as Perfil | null);
        setCargando(false);
      }
    }

    supabase.auth.getSession().then(({ data }) => {
      if (!activo) return;
      setSesion(data.session);
      cargarPerfil(data.session);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_evento, s) => {
      setSesion(s);
      // Se difiere para no llamar a Supabase dentro del callback de auth
      setTimeout(() => cargarPerfil(s), 0);
    });

    return () => {
      activo = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const valor: EstadoSesion = {
    cargando,
    sesion,
    perfil,
    esAdmin: perfil?.rol === "admin",
    salir: async () => {
      await supabase.auth.signOut();
    },
  };

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useSesion() {
  const c = useContext(Contexto);
  if (!c) throw new Error("useSesion debe usarse dentro de <ProveedorSesion>");
  return c;
}
