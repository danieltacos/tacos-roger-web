/** Zona horaria del negocio: todas las fechas se muestran y agrupan aquí. */
export const ZONA = "America/Mexico_City";

const moneda = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" });
export const dinero = (n: number | string | null | undefined) => moneda.format(Number(n ?? 0));

export const numero = (n: number | string | null | undefined, decimales = 2) =>
  Number(n ?? 0).toLocaleString("es-MX", { maximumFractionDigits: decimales });

/** Fecha de hoy en Guadalajara como "YYYY-MM-DD". */
export function hoy(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: ZONA }).format(new Date());
}

/** Suma (o resta) días a una fecha "YYYY-MM-DD". */
export function sumarDias(fecha: string, dias: number): string {
  const [a, m, d] = fecha.split("-").map(Number);
  const f = new Date(Date.UTC(a, m - 1, d + dias));
  return f.toISOString().slice(0, 10);
}

export function inicioDeMes(fecha: string): string {
  return fecha.slice(0, 8) + "01";
}

const DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** "2026-10-24" → "Sábado 24 oct 2026" */
export function fechaLarga(fecha: string): string {
  const [a, m, d] = fecha.split("-").map(Number);
  const f = new Date(Date.UTC(a, m - 1, d));
  return `${DIAS[f.getUTCDay()]} ${d} ${MESES[m - 1]} ${a}`;
}

/** "2026-10-24" → "24 oct" */
export function fechaCorta(fecha: string): string {
  const [, m, d] = fecha.split("-").map(Number);
  return `${d} ${MESES[m - 1]}`;
}

export function diaSemanaCorto(fecha: string): string {
  const [a, m, d] = fecha.split("-").map(Number);
  return DIAS[new Date(Date.UTC(a, m - 1, d)).getUTCDay()].slice(0, 3);
}

/** Timestamp de la base → "9:41 p.m." en hora de Guadalajara */
export function hora(timestamp: string): string {
  return new Intl.DateTimeFormat("es-MX", {
    timeZone: ZONA,
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

/** Timestamp → "24 oct, 9:41 p.m." */
export function fechaHora(timestamp: string): string {
  return new Intl.DateTimeFormat("es-MX", {
    timeZone: ZONA,
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(timestamp));
}
