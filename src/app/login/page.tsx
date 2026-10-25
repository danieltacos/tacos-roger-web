"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useSesion } from "@/lib/sesion";
import { Boton, Campo } from "@/components/ui";

export default function Login() {
  const router = useRouter();
  const { sesion, cargando } = useSesion();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (!cargando && sesion) router.replace("/ventas/");
  }, [cargando, sesion, router]);

  async function entrar(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setEnviando(false);
    if (error) {
      setError(
        error.message === "Invalid login credentials" ? "Correo o contraseña incorrectos" : error.message,
      );
      return;
    }
    router.replace("/ventas/");
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-salsa px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center text-white">
          <div className="mx-auto mb-3 flex size-16 items-center justify-center rounded-2xl bg-white text-3xl shadow-lg">
            🌮
          </div>
          <h1 className="font-display text-3xl font-bold">Tacos el Roger</h1>
          <p className="text-sm text-white/80">Punto de venta</p>
        </div>
        <form onSubmit={entrar} className="space-y-4 rounded-2xl bg-white p-6 shadow-xl">
          <Campo
            etiqueta="Correo"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Campo
            etiqueta="Contraseña"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error && <p className="rounded-lg bg-salsa-suave px-3 py-2 text-sm text-salsa-oscura">{error}</p>}
          <Boton type="submit" tamano="grande" className="w-full" disabled={enviando}>
            {enviando ? "Entrando…" : "Entrar"}
          </Boton>
        </form>
      </div>
    </main>
  );
}
