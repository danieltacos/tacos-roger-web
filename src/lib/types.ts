export type Rol = "admin" | "cajero";

export interface Perfil {
  id: string;
  email: string | null;
  nombre: string | null;
  rol: Rol;
}

export interface Categoria {
  id: number;
  nombre: string;
  activo: boolean;
}

export interface Producto {
  id: number;
  nombre: string;
  precio: number;
  categoria_id: number | null;
  imagen_url: string | null;
  activo: boolean;
  categoria?: { nombre: string } | null;
}

export interface Insumo {
  id: number;
  nombre: string;
  unidad_medida: string;
  stock_actual: number;
  stock_minimo: number;
  costo_unitario: number;
  activo: boolean;
}

export interface Empleado {
  id: number;
  nombre: string;
  activo: boolean;
}

export interface LineaReceta {
  insumo_id: number;
  cantidad_usada: number;
  insumo: { nombre: string; unidad_medida: string; costo_unitario: number } | null;
}

export type MetodoPago = "efectivo" | "tarjeta" | "transferencia";

export const METODOS_PAGO: { valor: MetodoPago; etiqueta: string }[] = [
  { valor: "efectivo", etiqueta: "Efectivo" },
  { valor: "tarjeta", etiqueta: "Tarjeta" },
  { valor: "transferencia", etiqueta: "Transferencia" },
];

export interface ItemCarrito {
  producto_id: number;
  nombre: string;
  precio: number; // editable por venta
  precio_catalogo: number;
  cantidad: number;
}

export interface FilaReporteDia {
  dia: string; // YYYY-MM-DD
  total: number;
  num_ventas: number;
  costo: number;
  ganancia: number;
}

export interface FilaReporteProducto {
  producto_id: number;
  nombre: string;
  cantidad: number;
  importe: number;
}

export interface VentaConDetalle {
  id: number;
  fecha: string;
  total: number;
  metodo_pago: MetodoPago;
  cancelada: boolean;
  empleado: { nombre: string } | null;
  detalle_venta: {
    id: number;
    cantidad: number;
    subtotal: number;
    producto: { nombre: string } | null;
  }[];
}

export interface Movimiento {
  id: number;
  tipo: "entrada" | "salida";
  cantidad: number;
  fecha: string;
  nota: string | null;
  venta_id: number | null;
}
