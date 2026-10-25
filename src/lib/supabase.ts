import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!url || !key) {
  throw new Error(
    "Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY. Copia .env.example como .env.local.",
  );
}

export const supabase = createClient(url, key, {
  auth: { persistSession: true, autoRefreshToken: true },
});

export const BUCKET_FOTOS = "productos";

/** Convierte el error de Supabase en un mensaje entendible. */
export function mensajeError(error: unknown): string {
  if (!error) return "Error desconocido";
  const e = error as { code?: string; message?: string };
  if (e.code === "23503") {
    return "No se puede borrar porque tiene historial (ventas o recetas). Mejor desactívalo.";
  }
  if (e.code === "42501") return "No tienes permiso para hacer esto.";
  return e.message ?? String(error);
}
