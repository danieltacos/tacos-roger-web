-- =====================================================================
-- Tacos el Roger · Migración 01 (aditiva)
-- ---------------------------------------------------------------------
-- Solo AGREGA columnas, tablas y funciones. No borra ni modifica datos,
-- y la app vieja de Flutter sigue funcionando después de correrla.
--
-- Cómo correrla: Supabase → SQL Editor → pega todo el archivo → Run.
-- Se puede correr más de una vez sin problema (usa "if not exists"
-- y "create or replace").
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. "Desactivar" en lugar de borrar
--    (producto ya tenía la columna; se agrega a las demás)
-- ---------------------------------------------------------------------
alter table public.categoria add column if not exists activo boolean not null default true;
alter table public.producto  add column if not exists activo boolean not null default true;
alter table public.insumo    add column if not exists activo boolean not null default true;
alter table public.empleado  add column if not exists activo boolean not null default true;

-- Por si algún insumo quedó sin costo (la app vieja tenía un error de
-- dedo al guardar "costo_unitario")
alter table public.insumo add column if not exists costo_unitario numeric not null default 0;


-- ---------------------------------------------------------------------
-- 2. Cancelar ventas sin borrarlas (se marcan como canceladas y los
--    reportes las ignoran; así queda el historial)
-- ---------------------------------------------------------------------
alter table public.venta add column if not exists cancelada     boolean not null default false;
alter table public.venta add column if not exists cancelada_en  timestamptz;
alter table public.venta add column if not exists cancelada_por uuid;


-- ---------------------------------------------------------------------
-- 3. Ligar cada movimiento de inventario con su venta (si viene de una).
--    Así, al cancelar, se devuelve EXACTAMENTE lo que se descontó,
--    aunque la receta haya cambiado después.
-- ---------------------------------------------------------------------
alter table public.movimiento_inventario
  add column if not exists venta_id bigint references public.venta(id) on delete set null;
alter table public.movimiento_inventario add column if not exists nota text;

create index if not exists movimiento_inventario_venta_id_idx on public.movimiento_inventario (venta_id);
create index if not exists venta_fecha_idx on public.venta (fecha);
create index if not exists detalle_venta_venta_id_idx on public.detalle_venta (venta_id);


-- ---------------------------------------------------------------------
-- 4. Usuarios y roles (login)
--    Cada cuenta de Supabase Auth tiene un perfil con rol:
--      admin  → todo
--      cajero → vender y registrar compras de insumos
--    Mientras no haya ningún admin, la siguiente cuenta que se cree
--    queda como admin automáticamente; las demás, como cajero.
-- ---------------------------------------------------------------------
create table if not exists public.perfil (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text,
  nombre     text,
  rol        text not null default 'cajero' check (rol in ('admin', 'cajero')),
  creado_en  timestamptz not null default now()
);

alter table public.perfil enable row level security;
grant select, update on public.perfil to authenticated;

create or replace function public.es_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.perfil where id = auth.uid() and rol = 'admin');
$$;

drop policy if exists perfil_leer on public.perfil;
create policy perfil_leer on public.perfil
  for select to authenticated
  using (id = auth.uid() or public.es_admin());

drop policy if exists perfil_admin_editar on public.perfil;
create policy perfil_admin_editar on public.perfil
  for update to authenticated
  using (public.es_admin())
  with check (public.es_admin());

create or replace function public.crear_perfil_nuevo_usuario()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.perfil (id, email, rol)
  values (
    new.id,
    new.email,
    case when exists (select 1 from public.perfil where rol = 'admin') then 'cajero' else 'admin' end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists al_crear_usuario on auth.users;
create trigger al_crear_usuario
  after insert on auth.users
  for each row execute function public.crear_perfil_nuevo_usuario();

-- Perfiles para usuarios que ya existían antes de esta migración
insert into public.perfil (id, email, rol)
select u.id, u.email, 'cajero' from auth.users u
on conflict (id) do nothing;


-- ---------------------------------------------------------------------
-- 5. registrar_venta: TODO en una sola transacción
--    (venta + detalle + descuento de inventario + movimientos).
--    Si algo falla, no se guarda nada. Resta el stock directo en la
--    base (stock = stock - x), así dos cajas vendiendo al mismo tiempo
--    no se pisan.
--
--    p_items: [{"producto_id": 1, "cantidad": 2, "precio": 25}, ...]
--    (el precio viene del carrito porque se puede editar por venta)
-- ---------------------------------------------------------------------
create or replace function public.registrar_venta(
  p_empleado_id bigint,
  p_metodo_pago text,
  p_items       jsonb
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_venta_id bigint;
  v_total    numeric;
  r          record;
begin
  if auth.uid() is null then
    raise exception 'Necesitas iniciar sesión';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'El carrito está vacío';
  end if;

  if p_metodo_pago not in ('efectivo', 'tarjeta', 'transferencia') then
    raise exception 'Método de pago inválido: %', p_metodo_pago;
  end if;

  if exists (
    select 1 from jsonb_to_recordset(p_items) as i(producto_id bigint, cantidad int, precio numeric)
    where i.producto_id is null or coalesce(i.cantidad, 0) <= 0 or coalesce(i.precio, -1) < 0
  ) then
    raise exception 'Hay un producto con cantidad o precio inválido';
  end if;

  select sum(i.cantidad * i.precio) into v_total
  from jsonb_to_recordset(p_items) as i(producto_id bigint, cantidad int, precio numeric);

  insert into venta (empleado_id, total, metodo_pago)
  values (p_empleado_id, v_total, p_metodo_pago)
  returning id into v_venta_id;

  insert into detalle_venta (venta_id, producto_id, cantidad, subtotal)
  select v_venta_id, i.producto_id, i.cantidad, i.cantidad * i.precio
  from jsonb_to_recordset(p_items) as i(producto_id bigint, cantidad int, precio numeric);

  -- Insumos a descontar, sumando si el mismo insumo aparece en varios productos
  for r in
    select pi.insumo_id, sum(pi.cantidad_usada * i.cantidad) as total_insumo
    from jsonb_to_recordset(p_items) as i(producto_id bigint, cantidad int, precio numeric)
    join producto_insumo pi on pi.producto_id = i.producto_id
    group by pi.insumo_id
  loop
    update insumo set stock_actual = stock_actual - r.total_insumo where id = r.insumo_id;

    insert into movimiento_inventario (insumo_id, tipo, cantidad, venta_id)
    values (r.insumo_id, 'salida', r.total_insumo, v_venta_id);
  end loop;

  return v_venta_id;
end;
$$;


-- ---------------------------------------------------------------------
-- 6. cancelar_venta (solo admin): marca la venta como cancelada y
--    devuelve el inventario, todo en una transacción.
--    - Ventas nuevas: devuelve exactamente los movimientos ligados.
--    - Ventas viejas (hechas con la app de Flutter, sin venta_id en
--      sus movimientos): devuelve según la receta actual, igual que
--      lo hacía la app vieja.
-- ---------------------------------------------------------------------
create or replace function public.cancelar_venta(p_venta_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cancelada boolean;
  r           record;
begin
  if not public.es_admin() then
    raise exception 'Solo un administrador puede cancelar ventas';
  end if;

  select cancelada into v_cancelada from venta where id = p_venta_id for update;

  if not found then
    raise exception 'La venta % no existe', p_venta_id;
  end if;
  if v_cancelada then
    raise exception 'La venta % ya estaba cancelada', p_venta_id;
  end if;

  if exists (select 1 from movimiento_inventario where venta_id = p_venta_id and tipo = 'salida') then
    for r in
      select insumo_id, sum(cantidad) as cantidad
      from movimiento_inventario
      where venta_id = p_venta_id and tipo = 'salida'
      group by insumo_id
    loop
      update insumo set stock_actual = stock_actual + r.cantidad where id = r.insumo_id;
      insert into movimiento_inventario (insumo_id, tipo, cantidad, venta_id, nota)
      values (r.insumo_id, 'entrada', r.cantidad, p_venta_id, 'Cancelación de venta');
    end loop;
  else
    for r in
      select pi.insumo_id, sum(pi.cantidad_usada * dv.cantidad) as cantidad
      from detalle_venta dv
      join producto_insumo pi on pi.producto_id = dv.producto_id
      where dv.venta_id = p_venta_id
      group by pi.insumo_id
    loop
      update insumo set stock_actual = stock_actual + r.cantidad where id = r.insumo_id;
      insert into movimiento_inventario (insumo_id, tipo, cantidad, venta_id, nota)
      values (r.insumo_id, 'entrada', r.cantidad, p_venta_id, 'Cancelación de venta');
    end loop;
  end if;

  update venta
  set cancelada = true, cancelada_en = now(), cancelada_por = auth.uid()
  where id = p_venta_id;
end;
$$;


-- ---------------------------------------------------------------------
-- 7. registrar_compra: suma al stock y guarda el movimiento.
--    Si se manda p_costo_unitario, también actualiza el costo.
-- ---------------------------------------------------------------------
create or replace function public.registrar_compra(
  p_insumo_id      bigint,
  p_cantidad       numeric,
  p_costo_unitario numeric default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Necesitas iniciar sesión';
  end if;
  if p_cantidad is null or p_cantidad <= 0 then
    raise exception 'La cantidad debe ser mayor que cero';
  end if;

  update insumo
  set stock_actual   = stock_actual + p_cantidad,
      costo_unitario = coalesce(p_costo_unitario, costo_unitario)
  where id = p_insumo_id;

  if not found then
    raise exception 'El insumo % no existe', p_insumo_id;
  end if;

  insert into movimiento_inventario (insumo_id, tipo, cantidad, nota)
  values (p_insumo_id, 'entrada', p_cantidad, 'Compra');
end;
$$;


-- ---------------------------------------------------------------------
-- 8. Reportes calculados en la base (sin el límite de 1,000 filas que
--    tenía la app vieja). Las fechas se agrupan en hora de Guadalajara.
--    El costo usa el costo actual de los insumos de cada receta.
-- ---------------------------------------------------------------------
create or replace function public.reporte_ventas_por_dia(
  p_desde date,
  p_hasta date,
  p_tz    text default 'America/Mexico_City'
)
returns table (dia date, total numeric, num_ventas bigint, costo numeric, ganancia numeric)
language sql
stable
security invoker
set search_path = public
as $$
  with costo_producto as (
    select pi.producto_id, sum(pi.cantidad_usada * coalesce(i.costo_unitario, 0)) as costo
    from producto_insumo pi
    join insumo i on i.id = pi.insumo_id
    group by pi.producto_id
  ),
  ventas as (
    select v.id, (v.fecha at time zone p_tz)::date as dia, v.total
    from venta v
    where not v.cancelada
      and (v.fecha at time zone p_tz)::date between p_desde and p_hasta
  ),
  costos as (
    select ve.dia, sum(dv.cantidad * coalesce(cp.costo, 0)) as costo
    from ventas ve
    join detalle_venta dv on dv.venta_id = ve.id
    left join costo_producto cp on cp.producto_id = dv.producto_id
    group by ve.dia
  )
  select ve.dia,
         sum(ve.total)::numeric                                   as total,
         count(*)                                                 as num_ventas,
         coalesce(max(c.costo), 0)::numeric                       as costo,
         (sum(ve.total) - coalesce(max(c.costo), 0))::numeric     as ganancia
  from ventas ve
  left join costos c on c.dia = ve.dia
  group by ve.dia
  order by ve.dia desc;
$$;

create or replace function public.reporte_productos(
  p_desde date,
  p_hasta date,
  p_tz    text default 'America/Mexico_City'
)
returns table (producto_id bigint, nombre text, cantidad bigint, importe numeric)
language sql
stable
security invoker
set search_path = public
as $$
  select dv.producto_id::bigint,
         coalesce(p.nombre, 'Producto eliminado')::text,
         sum(dv.cantidad)::bigint,
         sum(dv.subtotal)::numeric
  from venta v
  join detalle_venta dv on dv.venta_id = v.id
  left join producto p on p.id = dv.producto_id
  where not v.cancelada
    and (v.fecha at time zone p_tz)::date between p_desde and p_hasta
  group by dv.producto_id, p.nombre
  order by 3 desc;
$$;

-- Ventas de un día (incluye canceladas, para verlas tachadas).
-- Regresa filas de "venta", así que desde la app se pueden pedir
-- relaciones: .select('*, empleado(nombre), detalle_venta(*, producto(nombre))')
create or replace function public.ventas_del_dia(
  p_dia date,
  p_tz  text default 'America/Mexico_City'
)
returns setof public.venta
language sql
stable
security invoker
set search_path = public
as $$
  select * from venta
  where fecha >= (p_dia::timestamp at time zone p_tz)
    and fecha <  ((p_dia + 1)::timestamp at time zone p_tz)
  order by fecha;
$$;


-- ---------------------------------------------------------------------
-- 9. Permisos de las funciones
-- ---------------------------------------------------------------------
revoke all on function public.registrar_venta(bigint, text, jsonb)   from public, anon;
revoke all on function public.cancelar_venta(bigint)                 from public, anon;
revoke all on function public.registrar_compra(bigint, numeric, numeric) from public, anon;
revoke all on function public.reporte_ventas_por_dia(date, date, text) from public, anon;
revoke all on function public.reporte_productos(date, date, text)      from public, anon;
revoke all on function public.ventas_del_dia(date, text)               from public, anon;
revoke all on function public.crear_perfil_nuevo_usuario()             from public, anon, authenticated;

grant execute on function public.registrar_venta(bigint, text, jsonb)     to authenticated;
grant execute on function public.cancelar_venta(bigint)                   to authenticated;
grant execute on function public.registrar_compra(bigint, numeric, numeric) to authenticated;
grant execute on function public.reporte_ventas_por_dia(date, date, text) to authenticated;
grant execute on function public.reporte_productos(date, date, text)      to authenticated;
grant execute on function public.ventas_del_dia(date, text)               to authenticated;
grant execute on function public.es_admin()                               to authenticated;
