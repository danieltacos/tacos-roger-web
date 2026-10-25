"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
} from "react";
import { X } from "lucide-react";

/* ------------------------------------------------------------------ */
/* Botón                                                               */
/* ------------------------------------------------------------------ */
type Variante = "primario" | "secundario" | "peligro" | "fantasma";

const estilosBoton: Record<Variante, string> = {
  primario: "bg-salsa text-white hover:bg-salsa-oscura shadow-sm",
  secundario: "bg-white text-tinta border border-borde hover:bg-crema",
  peligro: "bg-white text-salsa border border-salsa/40 hover:bg-salsa-suave",
  fantasma: "text-tinta-suave hover:bg-crema hover:text-tinta",
};

export function Boton({
  variante = "primario",
  tamano = "normal",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: Variante;
  tamano?: "normal" | "chico" | "grande";
}) {
  const t =
    tamano === "chico" ? "h-8 px-3 text-sm" : tamano === "grande" ? "h-12 px-5 text-base" : "h-10 px-4 text-sm";
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${t} ${estilosBoton[variante]} ${className}`}
    />
  );
}

export function BotonIcono({
  etiqueta,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { etiqueta: string }) {
  return (
    <button
      {...props}
      aria-label={etiqueta}
      title={etiqueta}
      className={`inline-flex size-9 items-center justify-center rounded-lg text-tinta-suave transition-colors hover:bg-crema hover:text-tinta disabled:opacity-40 ${className}`}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Campos                                                              */
/* ------------------------------------------------------------------ */
const estiloCampo =
  "h-10 w-full rounded-lg border border-borde bg-white px-3 text-sm text-tinta outline-none transition focus:border-salsa focus:ring-2 focus:ring-salsa/20";

export function Campo({
  etiqueta,
  ayuda,
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { etiqueta?: string; ayuda?: string }) {
  return (
    <label className={`flex flex-col gap-1 ${className}`}>
      {etiqueta && <span className="text-xs font-semibold text-tinta-suave">{etiqueta}</span>}
      <input {...props} className={estiloCampo} />
      {ayuda && <span className="text-xs text-tinta-suave">{ayuda}</span>}
    </label>
  );
}

export function Selector({
  etiqueta,
  className = "",
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { etiqueta?: string }) {
  return (
    <label className={`flex flex-col gap-1 ${className}`}>
      {etiqueta && <span className="text-xs font-semibold text-tinta-suave">{etiqueta}</span>}
      <select {...props} className={estiloCampo}>
        {children}
      </select>
    </label>
  );
}

/* ------------------------------------------------------------------ */
/* Tarjeta y encabezado de página                                      */
/* ------------------------------------------------------------------ */
export function Tarjeta({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-borde bg-white ${className}`}>{children}</div>;
}

export function Encabezado({
  titulo,
  subtitulo,
  acciones,
}: {
  titulo: string;
  subtitulo?: string;
  acciones?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-display text-2xl font-bold text-tinta">{titulo}</h1>
        {subtitulo && <p className="mt-0.5 text-sm text-tinta-suave">{subtitulo}</p>}
      </div>
      {acciones && <div className="flex flex-wrap gap-2">{acciones}</div>}
    </div>
  );
}

export function Vacio({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-borde px-4 py-10 text-center text-sm text-tinta-suave">
      {children}
    </div>
  );
}

export function Cargando() {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="size-8 animate-spin rounded-full border-4 border-salsa/20 border-t-salsa" />
    </div>
  );
}

export function Etiqueta({
  children,
  tono = "neutro",
}: {
  children: ReactNode;
  tono?: "neutro" | "alerta" | "ok" | "apagado";
}) {
  const t = {
    neutro: "bg-crema text-tinta-suave",
    alerta: "bg-salsa-suave text-salsa-oscura",
    ok: "bg-cilantro-suave text-cilantro",
    apagado: "bg-gray-100 text-gray-500",
  }[tono];
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${t}`}>{children}</span>;
}

/* ------------------------------------------------------------------ */
/* Modal                                                               */
/* ------------------------------------------------------------------ */
export function Modal({
  abierto,
  titulo,
  onCerrar,
  children,
  pie,
}: {
  abierto: boolean;
  titulo: string;
  onCerrar: () => void;
  children: ReactNode;
  pie?: ReactNode;
}) {
  useEffect(() => {
    if (!abierto) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onCerrar();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [abierto, onCerrar]);

  if (!abierto) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onClick={onCerrar}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[90dvh] w-full flex-col rounded-t-2xl bg-white shadow-xl sm:max-w-md sm:rounded-2xl"
      >
        <div className="flex items-center justify-between border-b border-borde px-5 py-3">
          <h2 className="font-display text-lg font-bold">{titulo}</h2>
          <BotonIcono etiqueta="Cerrar" onClick={onCerrar}>
            <X size={18} />
          </BotonIcono>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {pie && <div className="flex justify-end gap-2 border-t border-borde px-5 py-3">{pie}</div>}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Avisos (toasts) y confirmación                                      */
/* ------------------------------------------------------------------ */
interface Aviso {
  id: number;
  texto: string;
  tipo: "ok" | "error";
}

interface Confirmacion {
  titulo: string;
  mensaje: string;
  textoConfirmar?: string;
  peligro?: boolean;
}

interface Herramientas {
  avisar: (texto: string, tipo?: "ok" | "error") => void;
  confirmar: (c: Confirmacion) => Promise<boolean>;
}

const ContextoAvisos = createContext<Herramientas | null>(null);

export function ProveedorAvisos({ children }: { children: ReactNode }) {
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const [conf, setConf] = useState<Confirmacion | null>(null);
  const resolver = useRef<((v: boolean) => void) | null>(null);
  const siguiente = useRef(0);

  const avisar = useCallback((texto: string, tipo: "ok" | "error" = "ok") => {
    const id = ++siguiente.current;
    setAvisos((a) => [...a, { id, texto, tipo }]);
    setTimeout(() => setAvisos((a) => a.filter((x) => x.id !== id)), tipo === "error" ? 6000 : 3000);
  }, []);

  const confirmar = useCallback((c: Confirmacion) => {
    setConf(c);
    return new Promise<boolean>((res) => {
      resolver.current = res;
    });
  }, []);

  const responder = (v: boolean) => {
    resolver.current?.(v);
    resolver.current = null;
    setConf(null);
  };

  return (
    <ContextoAvisos.Provider value={{ avisar, confirmar }}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex flex-col items-center gap-2 px-4 md:bottom-6">
        {avisos.map((a) => (
          <div
            key={a.id}
            role="status"
            className={`pointer-events-auto max-w-md rounded-lg px-4 py-2.5 text-sm font-medium text-white shadow-lg ${
              a.tipo === "error" ? "bg-salsa-oscura" : "bg-tinta"
            }`}
          >
            {a.texto}
          </div>
        ))}
      </div>
      <Modal
        abierto={!!conf}
        titulo={conf?.titulo ?? ""}
        onCerrar={() => responder(false)}
        pie={
          <>
            <Boton variante="secundario" onClick={() => responder(false)}>
              No
            </Boton>
            <Boton onClick={() => responder(true)}>
              {conf?.textoConfirmar ?? "Sí"}
            </Boton>
          </>
        }
      >
        <p className="text-sm text-tinta-suave">{conf?.mensaje}</p>
      </Modal>
    </ContextoAvisos.Provider>
  );
}

export function useAvisos() {
  const c = useContext(ContextoAvisos);
  if (!c) throw new Error("useAvisos debe usarse dentro de <ProveedorAvisos>");
  return c;
}
