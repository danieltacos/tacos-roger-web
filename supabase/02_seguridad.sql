-- =====================================================================
-- Tacos el Roger · Migración 02 (seguridad / RLS con login)
-- ---------------------------------------------------------------------
-- ⚠️  CÓRRELA SOLO CUANDO YA USES LA APP NUEVA.
--     Después de esto, la app vieja de Flutter (que no tiene login)
--     deja de poder leer y escribir datos.
--
-- Qué hace:
--   1. Quita las políticas abiertas de la v1 (las que permitían todo
--      a cualquiera, incluso sin iniciar sesión).
--   2. Solo usuarios con sesión pueden leer.
--   3. Solo admin puede modificar catálogos (categorías, productos,
--      insumos, recetas, empleados).
--   4. Nadie modifica ventas ni inventario directamente: solo a través
--      de las funciones registrar_venta / cancelar_venta /
--      registrar_compra (que validan todo dentro de la base).
--
-- No borra datos: solo cambia QUIÉN puede hacer QUÉ.
-- =====================================================================

-- 1. Quitar todas las políticas actuales de las 8 tablas
do $$
declare
  p record;
begin
  for p in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('categoria', 'producto', 'insumo', 'producto_insumo',
                        'empleado', 'venta', 'detalle_venta', 'movimiento_inventario')
  loop
    execute format('drop policy %I on %I.%I', p.policyname, p.schemaname, p.tablename);
  end loop;
end;
$$;

-- 2. RLS activado (ya lo estaba; esto es por si acaso)
alter table public.categoria             enable row level security;
alter table public.producto              enable row level security;
alter table public.insumo                enable row level security;
alter table public.producto_insumo       enable row level security;
alter table public.empleado              enable row level security;
alter table public.venta                 enable row level security;
alter table public.detalle_venta         enable row level security;
alter table public.movimiento_inventario enable row level security;

-- 3. Lectura: cualquier usuario con sesión
create policy leer on public.categoria             for select to authenticated using (true);
create policy leer on public.producto              for select to authenticated using (true);
create policy leer on public.insumo                for select to authenticated using (true);
create policy leer on public.producto_insumo       for select to authenticated using (true);
create policy leer on public.empleado              for select to authenticated using (true);
create policy leer on public.venta                 for select to authenticated using (true);
create policy leer on public.detalle_venta         for select to authenticated using (true);
create policy leer on public.movimiento_inventario for select to authenticated using (true);

-- 4. Catálogos: solo admin agrega / edita / borra
create policy admin_escribe on public.categoria       for all to authenticated
  using (public.es_admin()) with check (public.es_admin());
create policy admin_escribe on public.producto        for all to authenticated
  using (public.es_admin()) with check (public.es_admin());
create policy admin_escribe on public.insumo          for all to authenticated
  using (public.es_admin()) with check (public.es_admin());
create policy admin_escribe on public.producto_insumo for all to authenticated
  using (public.es_admin()) with check (public.es_admin());
create policy admin_escribe on public.empleado        for all to authenticated
  using (public.es_admin()) with check (public.es_admin());

-- venta, detalle_venta y movimiento_inventario: sin políticas de
-- escritura → solo se modifican con las funciones de la migración 01.


-- 5. Fotos de productos (bucket "productos"): todos pueden VER las
--    fotos (el bucket es público), pero solo admin puede subir/cambiar.
--    Se quitan primero las políticas de storage que mencionen ese bucket.
do $$
declare
  p record;
begin
  for p in
    select policyname
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and (coalesce(qual, '') ilike '%productos%' or coalesce(with_check, '') ilike '%productos%')
  loop
    execute format('drop policy %I on storage.objects', p.policyname);
  end loop;
end;
$$;

create policy productos_fotos_admin_subir on storage.objects
  for insert to authenticated
  with check (bucket_id = 'productos' and public.es_admin());

create policy productos_fotos_admin_cambiar on storage.objects
  for update to authenticated
  using (bucket_id = 'productos' and public.es_admin())
  with check (bucket_id = 'productos' and public.es_admin());

create policy productos_fotos_admin_borrar on storage.objects
  for delete to authenticated
  using (bucket_id = 'productos' and public.es_admin());
