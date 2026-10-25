# Tacos el Roger · v4 (web)

Punto de venta para la taquería **Tacos el Roger**: ventas, inventario y reportes,
desde cualquier navegador. Es la reescritura de la app de Flutter, usando **la misma
base de datos de Supabase** (no se pierde nada de lo que ya hay).

- **Frontend:** Next.js 16 + React 19 + TypeScript + Tailwind CSS 4
- **Backend:** Supabase (PostgreSQL, Auth, Storage)
- **Hosting:** Netlify (sitio estático)

## Qué cambió respecto a la versión de Flutter

| | Flutter (v1–v3) | Esta versión |
|---|---|---|
| Código | 1 archivo de ~2,240 líneas | Una carpeta por pantalla |
| Registrar venta | 4+ llamadas sueltas desde el navegador | 1 función SQL en una transacción (`registrar_venta`) |
| Si se cae el internet a media venta | Venta sin detalle o inventario a medias | No se guarda nada; o todo o nada |
| Dos cajas vendiendo a la vez | Una podía pisar el stock de la otra | El stock se resta dentro de la base |
| Cancelar venta | Se borraba | Se marca como cancelada (queda en el historial) y devuelve exactamente lo que se descontó |
| Reportes | Traía todo al navegador (se cortaba en 1,000 filas) | Se calculan en la base, por rango de fechas |
| Seguridad | Sin login; cualquiera con la URL podía leer o borrar | Login + roles (admin / cajero) |
| Borrar con historial | Fallaba | Se desactiva en su lugar |
| Empleados | Solo desde Supabase | Pantalla propia |

## Pantallas

- **Ventas** (todos): catálogo con fotos, filtro por categoría y búsqueda, carrito que sobrevive a una recarga, precio especial por venta, empleado y método de pago.
- **Insumos** (todos): stock con alertas, registrar compra (y actualizar el costo), historial de movimientos. Admin además agrega/edita/desactiva.
- **Reportes** (admin): hoy / 7 días / 30 días / mes / fechas a elegir; vendido, ganancia, número de ventas, ticket promedio; gráfica; por día y productos más vendidos.
- **Detalle del día** (admin): cada venta con su hora, empleado, productos y método de pago; total por método; cancelar venta.
- **Recetas** (admin): insumos por producto, con costo y margen.
- **Productos, Categorías, Empleados** (admin): alta, edición, activar/desactivar y borrado seguro.
- **Usuarios** (admin): cambiar roles.

## Estructura

```
supabase/
  01_mejoras.sql      ← funciones y columnas nuevas (no rompe la app vieja)
  02_seguridad.sql    ← login obligatorio y permisos por rol
src/
  app/
    login/            ← inicio de sesión
    (app)/            ← todo lo que requiere sesión (menú lateral / barra inferior)
      ventas/  reportes/  reportes/dia/  insumos/  recetas/
      productos/  categorias/  empleados/  usuarios/
  components/         ← botones, campos, modales, avisos
  lib/                ← cliente de Supabase, sesión, tipos, formatos de fecha y dinero
```

## Puesta en marcha

### 1. Base de datos (una sola vez)

1. Supabase → **SQL Editor** → pega `supabase/01_mejoras.sql` → **Run**.
   Solo agrega cosas; la app de Flutter sigue funcionando.
2. Supabase → **Authentication → Sign In / Providers**: desactiva **"Allow new users to sign up"**
   (así nadie de fuera puede crearse una cuenta).
3. **Authentication → Users → Add user**: crea tu cuenta (correo + contraseña, marca "Auto Confirm").
   La primera cuenta que crees queda como **admin** automáticamente; las siguientes, como cajero
   (lo cambias en la pantalla Usuarios).

### 2. Correr en tu compu

```bash
npm install
cp .env.example .env.local   # y pon tu URL y tu publishable key
npm run dev                  # http://localhost:3000
```

### 3. Publicar en Netlify

```bash
npm run build                # genera la carpeta out/
```

Sube la carpeta **`out/`** a Netlify (arrastrar y soltar), igual que antes con `build/web`.
O conecta el repositorio: comando de build `npm run build`, carpeta a publicar `out`, y agrega
las dos variables de `.env.example` en *Site settings → Environment variables*.

### 4. Cerrar la puerta (cuando ya uses solo la versión nueva)

Supabase → SQL Editor → pega `supabase/02_seguridad.sql` → **Run**.

⚠️ Después de esto la app de Flutter deja de funcionar (no tiene login). Quita las políticas
abiertas de la v1: solo usuarios con sesión leen datos, solo admin modifica catálogos, y las
ventas e inventario solo cambian a través de las funciones SQL.

## Notas

- Las fechas se agrupan en hora de Guadalajara (`America/Mexico_City`).
- La ganancia usa el **costo actual** de cada insumo × su receta (igual que antes).
- Las ventas canceladas se ven tachadas en el detalle del día y no cuentan en los reportes.
- Las ventas hechas con la app de Flutter también se pueden cancelar: como no tienen sus
  movimientos ligados, se devuelve el inventario según la receta actual.
