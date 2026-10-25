"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSesion } from "@/lib/sesion";
import { Cargando } from "@/components/ui";

export default function Inicio() {
  const router = useRouter();
  const { cargando, sesion } = useSesion();

  useEffect(() => {
    if (cargando) return;
    router.replace(sesion ? "/ventas/" : "/login/");
  }, [cargando, sesion, router]);

  return <Cargando />;
}
